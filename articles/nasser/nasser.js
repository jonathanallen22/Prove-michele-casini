/* ════════════════════════════════════════════════════════════════
   NASSER — "Zhourat" fluid substrate

   Colored-fluid cellular automaton (after w-shadow, 2009).
   Six herb emitters pulse palette-tinted liquid that flows,
   deflects off margin obstacles, mixes by mass-weighted pigment
   carry, and drains at the bottom.

   See docs/superpowers/specs/2026-05-13-nasser-fluid-simulation-design.md
   ════════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    const CONFIG = {
        cellSize:           8,         // CSS px per cell (desktop)
        cellSizeMobile:    12,
        mobileBreakpoint: 880,         // matches CSS @media break
        tempo:            1.5,         // sim iters per render frame (fractional accumulator)
        maxMass:          1.0,
        maxCompress:      0.02,
        minMass:          1e-4,
        minFlow:          0.01,
        maxSpeed:         1.0,
        evaporation:      0.9999,      // per-step mass + pigment decay (slow enough for thick, visible streams)
        reducedMotionSpinUp: 600,      // ticks of headless spin-up before freeze
        backgroundLight:  [0xf5, 0xec, 0xd9],  // z-cream
        backgroundDark:   [0x14, 0x11, 0x0e],
        obstacleTintLight: [0x6b, 0x4a, 0x5a], // z-plum
        obstacleTintDark:  [0xc4, 0x7b, 0x5a], // z-rose
        obstacleTintAlphaLight: 0.06,    // almost invisible — obstacles only become legible when water flows around them
        obstacleTintAlphaDark:  0.05,

        // Interactive pour + flower infusion.
        pourMassPerTick:        8.0,        // mass added at the cursor cell per simulation tick during a pour
        infusionRate:           1.0,        // single successful infusion saturates the cell to the flower's full colour
        infusionProbability:    0.45,       // chance per tick that any given infusion cell actually rolls (rest pass through)
        infusionLockThreshold:  0.08,       // if a cell already has pigment above this ratio, further flowers don't tint it (one colour per stream)
        infusionMinMass:        0.05,       // minimum cell mass before infusion fires
        waterTintLight:         [0xea, 0xdd, 0xc8],  // unpigmented-water tone in light mode
        waterTintDark:          [0x2a, 0x24, 0x1d],  // unpigmented-water tone in dark mode
    };

    const AIR = 0;
    const SOLID = 1;

    // The lebanon-cedar silhouette sits high in the article so water
    // poured at the wreath flows straight down into its branches. Below
    // the tree, a small set of deflectors and pebbles routes whatever
    // makes it through into the basin's drain gaps. obstacleTintAlpha
    // is low so the tree is almost invisible until water gives it shape.
    const OBSTACLES = [
        // ── The tree — bigger, higher. wFrac 0.60 with 1:1 aspect means
        //    a ~60vw square shape centred at yFracDoc 0.20. ──
        { kind: 'svg', src: '../../multimedia/nasser-media/lebanon_tree.svg',
          xFrac: 0.50, yFracDoc: 0.25, wFrac: 1.10, alphaThreshold: 60 },

        // ── Below the tree — two outward-deflectors clearing the lower
        //    margins. ──
        { kind: 'slab',   xFrac: 0.18, yFracDoc: 0.58, wFrac: 0.12, hFrac: 0.012, angleDeg: -22 },
        { kind: 'slab',   xFrac: 0.82, yFracDoc: 0.58, wFrac: 0.12, hFrac: 0.012, angleDeg:  22 },

        // ── Gutter pebbles catch the deflected streams. ──
        { kind: 'pebble', xFrac: 0.06, yFracDoc: 0.66, rxFrac: 0.025, ryFrac: 0.015 },
        { kind: 'pebble', xFrac: 0.94, yFracDoc: 0.66, rxFrac: 0.025, ryFrac: 0.015 },

        // ── Mid-zigzag pulling water back toward the centre. ──
        { kind: 'slab',   xFrac: 0.30, yFracDoc: 0.73, wFrac: 0.14, hFrac: 0.012, angleDeg:  20 },
        { kind: 'slab',   xFrac: 0.70, yFracDoc: 0.73, wFrac: 0.14, hFrac: 0.012, angleDeg: -20 },

        // ── Inward funnels just above the basin. ──
        { kind: 'slab',   xFrac: 0.25, yFracDoc: 0.86, wFrac: 0.20, hFrac: 0.013, angleDeg:  24 },
        { kind: 'slab',   xFrac: 0.75, yFracDoc: 0.86, wFrac: 0.20, hFrac: 0.013, angleDeg: -24 },

        // ── Basin with two drain gaps. ──
        { kind: 'slab',   xFrac: 0.50, yFracDoc: 0.94, wFrac: 0.90, hFrac: 0.014,
          angleDeg: 0, gaps: [0.30, 0.70] },
    ];

    // SVG obstacle images need to be loaded asynchronously. We preload
    // them at module init; on load, we kick a re-rasterise so cells that
    // were missed during the first resize get marked SOLID.
    const SVG_IMAGES = {};
    for (const o of OBSTACLES) {
        if (o.kind === 'svg' && !SVG_IMAGES[o.src]) {
            const img = new Image();
            img.addEventListener('load', () => {
                if (blocks && blocks.length > 0) {
                    blocks.fill(0);
                    rasterizeObstacles();
                }
            });
            img.src = o.src;
            SVG_IMAGES[o.src] = img;
        }
    }

    // — DOM —
    const canvas = document.getElementById('field-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const hero = document.querySelector('.zhourat-hero');

    // — Module state —
    let cellSize = CONFIG.cellSize;
    let cols = 0, rows = 0;
    let W = 0, H = 0, dpr = 1;
    let mass, massR, massG, massB;
    let newMass, newR, newG, newB;
    let blocks;
    let imgData = null;
    let off = null, offCtx = null;
    let isPaused = false;
    let reducedMotion = false;
    let infusionCells = [];
    const pour = {
        active: false,
        pointerId: -1,
        lastClientX: 0,
        lastClientY: 0,
        teapotOffsetX: 0,    // cursor → teapot top-left offset captured on pointerdown
        teapotOffsetY: 0,
    };

    // (Spout position is now read from the .zhourat-spout marker inside
    // the teapot button — see spawnPour. The marker handles rotation for us.)
    let tempoAccum = 0;

    function isMobile() {
        return window.innerWidth <= CONFIG.mobileBreakpoint;
    }

    function chooseCellSize() {
        return isMobile() ? CONFIG.cellSizeMobile : CONFIG.cellSize;
    }

    function rasterizeObstacles() {
        for (const o of OBSTACLES) {
            if (o.kind === 'slab')   rasterizeSlab(o);
            else if (o.kind === 'pebble') rasterizePebble(o);
            else if (o.kind === 'svg')    rasterizeSvg(o);
        }
    }

    // Rasterise an SVG by drawing it into a temp canvas at grid-cell
    // resolution and reading the alpha channel — opaque pixels become
    // SOLID cells. Preserves the SVG's native aspect ratio so the tree
    // doesn't get squashed.
    function rasterizeSvg(o) {
        const img = SVG_IMAGES[o.src];
        if (!img || !img.complete || !img.naturalWidth) {
            // Image not loaded yet — the onload handler will retrigger
            // rasterisation when it finishes.
            return;
        }
        const wPx = o.wFrac * W;
        const aspect = img.naturalHeight / img.naturalWidth;
        const hPx = wPx * aspect;
        const cx = o.xFrac * W;
        const cy = o.yFracDoc * H;
        const left = cx - wPx / 2;
        const top  = cy - hPx / 2;
        const cellsW = Math.max(1, Math.ceil(wPx / cellSize));
        const cellsH = Math.max(1, Math.ceil(hPx / cellSize));
        const startX = Math.floor(left / cellSize);
        const startY = Math.floor(top  / cellSize);
        const alphaThresh = o.alphaThreshold != null ? o.alphaThreshold : 50;

        // Draw the SVG to a tiny temp canvas sized to the grid footprint.
        const tmp = document.createElement('canvas');
        tmp.width = cellsW;
        tmp.height = cellsH;
        const tctx = tmp.getContext('2d');
        try {
            tctx.drawImage(img, 0, 0, cellsW, cellsH);
        } catch (e) {
            return;
        }
        let data;
        try {
            data = tctx.getImageData(0, 0, cellsW, cellsH).data;
        } catch (e) {
            // Tainted canvas (cross-origin) — give up silently.
            return;
        }

        for (let dy = 0; dy < cellsH; dy++) {
            const gy = startY + dy;
            if (gy < 0 || gy >= rows) continue;
            for (let dx = 0; dx < cellsW; dx++) {
                const gx = startX + dx;
                if (gx < 0 || gx >= cols) continue;
                const alpha = data[(dy * cellsW + dx) * 4 + 3];
                if (alpha >= alphaThresh) {
                    blocks[gy * cols + gx] = SOLID;
                }
            }
        }
    }

    function rasterizeSlab(o) {
        const cx = o.xFrac * W;
        const cy = o.yFracDoc * H;
        const w  = o.wFrac * W;
        const h  = o.hFrac * H;
        const theta = o.angleDeg * Math.PI / 180;
        const cos = Math.cos(theta), sin = Math.sin(theta);
        const halfW = w / 2, halfH = h / 2;
        const bound = Math.hypot(halfW, halfH);
        const x0 = Math.max(0, Math.floor((cx - bound) / cellSize));
        const x1 = Math.min(cols - 1, Math.ceil ((cx + bound) / cellSize));
        const y0 = Math.max(0, Math.floor((cy - bound) / cellSize));
        const y1 = Math.min(rows - 1, Math.ceil ((cy + bound) / cellSize));
        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
                const px = x * cellSize + cellSize / 2;
                const py = y * cellSize + cellSize / 2;
                const dx = px - cx, dy = py - cy;
                const rx =  cos * dx + sin * dy;
                const ry = -sin * dx + cos * dy;
                if (Math.abs(rx) <= halfW && Math.abs(ry) <= halfH) {
                    if (o.gaps) {
                        const frac = rx / w + 0.5;
                        let inGap = false;
                        for (const g of o.gaps) {
                            if (Math.abs(frac - g) < 0.05) { inGap = true; break; }
                        }
                        if (inGap) continue;
                    }
                    blocks[y * cols + x] = SOLID;
                }
            }
        }
    }

    function rasterizePebble(o) {
        // semiX/semiY are the ellipse semi-axes in world (CSS) pixels.
        // (Named to avoid collision with the rotated-local rx/ry inside rasterizeSlab.)
        const cx = o.xFrac * W;
        const cy = o.yFracDoc * H;
        const semiX = o.rxFrac * W;
        const semiY = o.ryFrac * H;
        const x0 = Math.max(0, Math.floor((cx - semiX) / cellSize));
        const x1 = Math.min(cols - 1, Math.ceil ((cx + semiX) / cellSize));
        const y0 = Math.max(0, Math.floor((cy - semiY) / cellSize));
        const y1 = Math.min(rows - 1, Math.ceil ((cy + semiY) / cellSize));
        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
                const px = x * cellSize + cellSize / 2;
                const py = y * cellSize + cellSize / 2;
                const ndx = (px - cx) / semiX;
                const ndy = (py - cy) / semiY;
                if (ndx * ndx + ndy * ndy <= 1) {
                    blocks[y * cols + x] = SOLID;
                }
            }
        }
    }

    // — Random wreath generation ───────────────────────────────────
    // The flora container in HTML is empty; we generate its children
    // here so density and species mix can be tuned without rewriting
    // 80 inline <img> tags.
    const FLOWER_SPECIES = [
        { id: 'chamomile-head',  color: '#c79a35', weight: 3.0 },
        { id: 'chamomile-bud',   color: '#c79a35', weight: 2.2 },
        { id: 'sage-leaf',       color: '#8a9b6f', weight: 2.5 },
        { id: 'mint-leaf',       color: '#9eb785', weight: 1.8 },
        { id: 'rose-terracotta', color: '#5e2230', weight: 1.5 },
        { id: 'rose-soft',       color: '#b76858', weight: 1.2 },
        { id: 'plum-rose',       color: '#5a3548', weight: 1.0 },
        { id: 'calendula',       color: '#d97920', weight: 1.0 },
        { id: 'ochre-marigold',  color: '#b8862e', weight: 1.0 },
        { id: 'lavender',        color: '#d8cba8', weight: 1.0 },
    ];

    // Where flowers may land, in viewport-fraction terms.
    const FLOWER_ZONE = { xMin: 0.00, xMax: 1.00, yMin: 0.00, yMax: 0.40 };
    // Rectangles where flowers must NOT land — cuts the article column
    // text shape out of the wreath canvas. The first hole is the title;
    // the second covers the meta line + author + prose-start band below
    // the title. Outside the column (xFrac < 0.27 or > 0.73), flowers
    // continue normally and form garlands in the side gutters.
    const HOLES = [
        { xMin: 0.27, xMax: 0.58, yMin: 0.09, yMax: 0.20 },   // title
        { xMin: 0.27, xMax: 0.73, yMin: 0.20, yMax: 0.40 },   // meta + author + top of prose
    ];

    const FLOWER_COUNT_DESKTOP = 200;
    const FLOWER_COUNT_MOBILE  = 100;
    const FLOWER_SIZE_MIN      = 85;
    const FLOWER_SIZE_MAX      = 100;

    function generateWreath() {
        const flora = document.querySelector('.zhourat-flora');
        if (!flora) return;
        flora.textContent = '';   // clear if regenerating

        const count = window.innerWidth <= CONFIG.mobileBreakpoint
            ? FLOWER_COUNT_MOBILE
            : FLOWER_COUNT_DESKTOP;

        const totalWeight = FLOWER_SPECIES.reduce((a, s) => a + s.weight, 0);

        for (let i = 0; i < count; i++) {
            // Reject samples that land on any text area (title / meta /
            // prose). Each rejection redraws inside FLOWER_ZONE.
            let x, y;
            for (let tries = 0; tries < 40; tries++) {
                x = FLOWER_ZONE.xMin + Math.random() * (FLOWER_ZONE.xMax - FLOWER_ZONE.xMin);
                y = FLOWER_ZONE.yMin + Math.random() * (FLOWER_ZONE.yMax - FLOWER_ZONE.yMin);
                let inHole = false;
                for (let h = 0; h < HOLES.length; h++) {
                    const H = HOLES[h];
                    if (x > H.xMin && x < H.xMax && y > H.yMin && y < H.yMax) {
                        inHole = true;
                        break;
                    }
                }
                if (!inHole) break;
            }

            // Pick a species by weighted choice.
            let r = Math.random() * totalWeight;
            let sp = FLOWER_SPECIES[0];
            for (let j = 0; j < FLOWER_SPECIES.length; j++) {
                r -= FLOWER_SPECIES[j].weight;
                if (r <= 0) { sp = FLOWER_SPECIES[j]; break; }
            }

            const size = FLOWER_SIZE_MIN + Math.random() * (FLOWER_SIZE_MAX - FLOWER_SIZE_MIN);
            const rotation = (Math.random() * 80) - 40;   // -40..40 deg

            const img = document.createElement('img');
            img.className = 'zhourat-flower';
            img.dataset.color = sp.color;
            img.src = '../../multimedia/nasser-media/flowers/' + sp.id + '.svg';
            img.alt = '';
            img.style.left      = (x * 100).toFixed(2) + '%';
            img.style.top       = (y * 100).toFixed(2) + '%';
            img.style.width     = size.toFixed(0) + 'px';
            img.style.transform = 'rotate(' + rotation.toFixed(0) + 'deg)';
            flora.appendChild(img);
        }
    }

    // Generate the wreath as soon as the script runs. The DOM has
    // already parsed past the <div class="zhourat-flora"> by the time
    // nasser.js executes (the <script> tag is at the bottom of body).
    generateWreath();

    // — Flower infusion ───────────────────────────────────────────
    function parseHexColor(hex) {
        const h = hex.charAt(0) === '#' ? hex.slice(1) : hex;
        return [
            parseInt(h.slice(0, 2), 16),
            parseInt(h.slice(2, 4), 16),
            parseInt(h.slice(4, 6), 16),
        ];
    }

    function projectFlowers() {
        infusionCells = [];
        const flowers = document.querySelectorAll('.zhourat-flower');
        for (const flowerEl of flowers) {
            const rect = flowerEl.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) continue;
            const color = parseHexColor(flowerEl.dataset.color || '#ffffff');
            const docTop  = rect.top  + window.scrollY;
            const docLeft = rect.left + window.scrollX;
            const insetX = rect.width  * 0.10;
            const insetY = rect.height * 0.10;
            const x0 = Math.max(0, Math.floor((docLeft + insetX) / cellSize));
            const x1 = Math.min(cols - 1, Math.ceil ((docLeft + rect.width  - insetX) / cellSize));
            const y0 = Math.max(0, Math.floor((docTop  + insetY) / cellSize));
            const y1 = Math.min(rows - 1, Math.ceil ((docTop  + rect.height - insetY) / cellSize));
            for (let y = y0; y <= y1; y++) {
                for (let x = x0; x <= x1; x++) {
                    infusionCells.push({ i: y * cols + x, color });
                }
            }
        }
    }

    function applyFlowerInfusion() {
        const rate = CONFIG.infusionRate;
        const minMass = CONFIG.infusionMinMass;
        const prob = CONFIG.infusionProbability;
        const lockThresh = CONFIG.infusionLockThreshold;
        for (let k = 0; k < infusionCells.length; k++) {
            if (Math.random() > prob) continue;
            const cell = infusionCells[k];
            const i = cell.i;
            const m = mass[i];
            if (m <= minMass) continue;
            // One colour per stream: once a cell carries pigment above
            // lockThresh (ratio of total pigment to mass), no further
            // flower can tint it. Pigment flows downstream through the
            // transport step so a stream keeps its first colour.
            const pigmentRatio = (massR[i] + massG[i] + massB[i]) / m;
            if (pigmentRatio > lockThresh) continue;
            const color = cell.color;
            massR[i] += m * rate * (color[0] / 255);
            massG[i] += m * rate * (color[1] / 255);
            massB[i] += m * rate * (color[2] / 255);
        }
    }

    // — Pour spawn ─────────────────────────────────────────────────
    // Water emits from the .zhourat-spout marker, which is positioned
    // inside the teapot button at the spout tip and rotates with the
    // button. getBoundingClientRect() returns its post-rotation pixel
    // position, so no rotation math is needed in JS.
    function spawnPour() {
        if (!pour.active) return;
        const spout = document.querySelector('.zhourat-spout');
        if (!spout) return;
        const rect = spout.getBoundingClientRect();
        const px = rect.left + window.scrollX;
        const py = rect.top  + window.scrollY;
        const gx = Math.max(0, Math.min(cols - 1, Math.floor(px / cellSize)));
        const gy = Math.max(0, Math.min(rows - 1, Math.floor(py / cellSize)));
        const i = gy * cols + gx;
        if (blocks[i] !== SOLID) {
            mass[i] += CONFIG.pourMassPerTick;
            // No pigment writes — water starts clear.
        }
    }

    // — Sizing and grid build —
    function resize() {
        const docW = document.documentElement.clientWidth;
        const docH = document.documentElement.scrollHeight;
        dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

        const oldCols = cols, oldRows = rows;
        const oldMass = mass, oldR = massR, oldG = massG, oldB = massB;

        W = docW;
        H = docH;
        cellSize = chooseCellSize();

        canvas.style.width  = W + 'px';
        canvas.style.height = H + 'px';
        canvas.width  = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        const newCols = Math.max(40, Math.floor(W / cellSize));
        const newRows = Math.max(40, Math.floor(H / cellSize));

        cols = newCols;
        rows = newRows;
        const n = cols * rows;

        const newMassArr = new Float32Array(n);
        const newRArr    = new Float32Array(n);
        const newGArr    = new Float32Array(n);
        const newBArr    = new Float32Array(n);

        if (oldMass && oldCols > 0 && oldRows > 0) {
            // Major delta resets the field; minor delta preserves it via NN map.
            const dwRatio = oldCols / cols;
            const dhRatio = oldRows / rows;
            const major = (dwRatio < 0.5 || dwRatio > 2 || dhRatio < 0.5 || dhRatio > 2);
            if (!major) {
                for (let y = 0; y < rows; y++) {
                    const oy = Math.min(oldRows - 1, Math.floor(y * dhRatio));
                    for (let x = 0; x < cols; x++) {
                        const ox = Math.min(oldCols - 1, Math.floor(x * dwRatio));
                        const ni = y * cols + x;
                        const oi = oy * oldCols + ox;
                        newMassArr[ni] = oldMass[oi];
                        newRArr[ni]    = oldR[oi];
                        newGArr[ni]    = oldG[oi];
                        newBArr[ni]    = oldB[oi];
                    }
                }
            }
        }

        mass    = newMassArr;
        massR   = newRArr;
        massG   = newGArr;
        massB   = newBArr;
        newMass = new Float32Array(n);
        newR    = new Float32Array(n);
        newG    = new Float32Array(n);
        newB    = new Float32Array(n);
        blocks  = new Uint8Array(n);

        if (!off) {
            off = document.createElement('canvas');
            offCtx = off.getContext('2d');
        }
        off.width  = cols;
        off.height = rows;
        imgData = offCtx.createImageData(cols, rows);

        rasterizeObstacles();
        projectFlowers();
    }

    // — Physics helpers —
    function getStableState(total) {
        const mm = CONFIG.maxMass;
        const mc = CONFIG.maxCompress;
        if (total <= mm) return mm;
        if (total < 2 * mm + mc) return (mm * mm + total * mc) / (mm + mc);
        return (total + mc) / 2;
    }

    function transferProportional(from, to, f, mFrom) {
        newMass[from] -= f;
        newMass[to]   += f;
        const ratio = f / mFrom;
        const dR = massR[from] * ratio;
        const dG = massG[from] * ratio;
        const dB = massB[from] * ratio;
        newR[from] -= dR;  newR[to] += dR;
        newG[from] -= dG;  newG[to] += dG;
        newB[from] -= dB;  newB[to] += dB;
    }

    // — Per-step physics —
    function step() {
        newMass.set(mass);
        newR.set(massR);
        newG.set(massG);
        newB.set(massB);

        const minMass  = CONFIG.minMass;
        const minFlow  = CONFIG.minFlow;
        const maxSpeed = CONFIG.maxSpeed;

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const i = y * cols + x;
                if (blocks[i] === SOLID) continue;
                const m = mass[i];
                if (m < minMass) continue;
                let remaining = m;
                let f;

                // RULE 1 — down
                if (y + 1 < rows && blocks[i + cols] !== SOLID) {
                    f = getStableState(remaining + mass[i + cols]) - mass[i + cols];
                    if (f > minFlow) f *= 0.5;
                    if (f > maxSpeed) f = maxSpeed;
                    if (f > remaining) f = remaining;
                    if (f < 0) f = 0;
                    if (f > 0) {
                        transferProportional(i, i + cols, f, m);
                        remaining -= f;
                    }
                }

                // RULE 2 — left
                if (remaining > minMass && x > 0 && blocks[i - 1] !== SOLID) {
                    f = (remaining - mass[i - 1]) / 4;
                    if (f > minFlow) f *= 0.5;
                    if (f > remaining) f = remaining;
                    if (f < 0) f = 0;
                    if (f > 0) {
                        transferProportional(i, i - 1, f, m);
                        remaining -= f;
                    }
                }

                // RULE 3 — right
                if (remaining > minMass && x < cols - 1 && blocks[i + 1] !== SOLID) {
                    f = (remaining - mass[i + 1]) / 4;
                    if (f > minFlow) f *= 0.5;
                    if (f > remaining) f = remaining;
                    if (f < 0) f = 0;
                    if (f > 0) {
                        transferProportional(i, i + 1, f, m);
                        remaining -= f;
                    }
                }

                // RULE 4 — up (compression)
                if (remaining > minMass && y > 0 && blocks[i - cols] !== SOLID) {
                    f = remaining - getStableState(remaining + mass[i - cols]);
                    if (f > minFlow) f *= 0.5;
                    if (f > remaining) f = remaining;
                    if (f < 0) f = 0;
                    if (f > 0) {
                        transferProportional(i, i - cols, f, m);
                        remaining -= f;
                    }
                }
            }
        }

        // Commit new buffers
        let tmp;
        tmp = mass;  mass  = newMass; newMass = tmp;
        tmp = massR; massR = newR;    newR    = tmp;
        tmp = massG; massG = newG;    newG    = tmp;
        tmp = massB; massB = newB;    newB    = tmp;

        // Evaporation
        const ev = CONFIG.evaporation;
        const n = cols * rows;
        for (let i = 0; i < n; i++) {
            mass[i]  *= ev;
            massR[i] *= ev;
            massG[i] *= ev;
            massB[i] *= ev;
        }

        // Bottom sink — drain the bottom row
        const bottom = (rows - 1) * cols;
        for (let x = 0; x < cols; x++) {
            const i = bottom + x;
            mass[i] = 0; massR[i] = 0; massG[i] = 0; massB[i] = 0;
        }
    }

    // — Render —
    function render() {
        const dark = document.body.classList.contains('dark-mode');
        const bg        = dark ? CONFIG.backgroundDark : CONFIG.backgroundLight;
        const tint      = dark ? CONFIG.obstacleTintDark : CONFIG.obstacleTintLight;
        const a         = dark ? CONFIG.obstacleTintAlphaDark : CONFIG.obstacleTintAlphaLight;
        const waterTint = dark ? CONFIG.waterTintDark : CONFIG.waterTintLight;
        const obR = Math.round(bg[0] * (1 - a) + tint[0] * a);
        const obG = Math.round(bg[1] * (1 - a) + tint[1] * a);
        const obB = Math.round(bg[2] * (1 - a) + tint[2] * a);
        const data = imgData.data;
        const n = cols * rows;
        const minMass = CONFIG.minMass;
        const maxMass = CONFIG.maxMass;
        for (let i = 0, p = 0; i < n; i++, p += 4) {
            if (blocks[i] === SOLID) {
                data[p] = obR; data[p+1] = obG; data[p+2] = obB; data[p+3] = 255;
                continue;
            }
            const m = mass[i];
            if (m < minMass) {
                data[p] = bg[0]; data[p+1] = bg[1]; data[p+2] = bg[2]; data[p+3] = 255;
                continue;
            }
            // Pigment density per unit mass → 0..255 channel.
            const rRatio = massR[i] / m;
            const gRatio = massG[i] / m;
            const bRatio = massB[i] / m;
            // If pigment is essentially zero, render the cell as faintly-cream water
            // so the reader can see what they are pouring before it dyes.
            const pigmentMag = rRatio + gRatio + bRatio;
            let pr, pg, pb;
            if (pigmentMag < 0.05) {
                pr = waterTint[0]; pg = waterTint[1]; pb = waterTint[2];
            } else {
                pr = rRatio * 255; if (pr > 255) pr = 255; if (pr < 0) pr = 0;
                pg = gRatio * 255; if (pg > 255) pg = 255; if (pg < 0) pg = 0;
                pb = bRatio * 255; if (pb > 255) pb = 255; if (pb < 0) pb = 0;
            }
            let alpha = m / maxMass; if (alpha > 1) alpha = 1;
            data[p]     = Math.round(bg[0] * (1 - alpha) + pr * alpha);
            data[p + 1] = Math.round(bg[1] * (1 - alpha) + pg * alpha);
            data[p + 2] = Math.round(bg[2] * (1 - alpha) + pb * alpha);
            data[p + 3] = 255;
        }
        offCtx.putImageData(imgData, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(off, 0, 0, cols, rows, 0, 0, W, H);
    }

    // — Main loop —
    function frame() {
        if (!isPaused && !reducedMotion) {
            tempoAccum += CONFIG.tempo;
            const iters = Math.floor(tempoAccum);
            tempoAccum -= iters;
            for (let k = 0; k < iters; k++) {
                spawnPour();
                applyFlowerInfusion();
                step();
            }
            render();
        }
        requestAnimationFrame(frame);
    }

    // — Pour pointer handlers ─────────────────────────────────────
    // The teapot is the pour affordance AND the spout. Pressing it
    // starts a pour; dragging moves the teapot under the cursor;
    // releasing leaves the teapot where the reader dropped it.
    function onPourStart(e) {
        if (reducedMotion) return;
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        const teapotEl = e.currentTarget;
        const rect = teapotEl.getBoundingClientRect();
        pour.active = true;
        pour.pointerId = e.pointerId;
        pour.lastClientX = e.clientX;
        pour.lastClientY = e.clientY;
        pour.teapotOffsetX = e.clientX - rect.left;
        pour.teapotOffsetY = e.clientY - rect.top;
        // Switch from bottom/right anchoring to absolute left/top so
        // we can move the teapot freely.
        teapotEl.style.left = (e.clientX - pour.teapotOffsetX) + 'px';
        teapotEl.style.top  = (e.clientY - pour.teapotOffsetY) + 'px';
        teapotEl.style.right = 'auto';
        teapotEl.style.bottom = 'auto';
        try { teapotEl.setPointerCapture(e.pointerId); } catch (_) {}
        teapotEl.classList.add('is-pouring');
        document.body.classList.add('zhourat-pouring');
        document.body.classList.add('has-poured');
        e.preventDefault();
    }

    function onPointerMove(e) {
        if (!pour.active) return;
        if (e.pointerId !== pour.pointerId) return;
        pour.lastClientX = e.clientX;
        pour.lastClientY = e.clientY;
        const teapotEl = document.querySelector('.zhourat-teapot');
        if (teapotEl) {
            teapotEl.style.left = (e.clientX - pour.teapotOffsetX) + 'px';
            teapotEl.style.top  = (e.clientY - pour.teapotOffsetY) + 'px';
        }
    }

    function onPourEnd(e) {
        if (!pour.active) return;
        if (e.pointerId !== pour.pointerId) return;
        pour.active = false;
        const teapotEl = document.querySelector('.zhourat-teapot');
        if (teapotEl) {
            teapotEl.classList.remove('is-pouring');
            try { teapotEl.releasePointerCapture(e.pointerId); } catch (_) {}
        }
        document.body.classList.remove('zhourat-pouring');
        pour.pointerId = -1;
    }

    // — Bootstrap —
    function start() {
        reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        resize();
        if (reducedMotion) {
            // Spin the field up to a representative pooled state, render once,
            // leave the rAF loop unstarted, and re-render on dark-mode toggle
            // so the palette tracks the user's preference even when frozen.
            for (let i = 0; i < CONFIG.reducedMotionSpinUp; i++) {
                step();
            }
            render();
            const obs = new MutationObserver(() => render());
            obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
            return;
        }
        document.addEventListener('visibilitychange', () => {
            isPaused = document.hidden;
        });
        requestAnimationFrame(frame);
    }

    function whenHeroReady(cb) {
        const img = hero ? hero.querySelector('img') : null;
        if (!img || img.complete) {
            // Defer one rAF so layout has settled and scrollHeight is accurate.
            requestAnimationFrame(cb);
            return;
        }
        img.addEventListener('load',  cb, { once: true });
        img.addEventListener('error', cb, { once: true });
    }

    let resizeTimer = null;
    function scheduleResize() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { resize(); render(); }, 120);
    }
    window.addEventListener('resize', scheduleResize);
    // Catch reflows from image / font loads and article content changes.
    if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(scheduleResize);
        ro.observe(document.body);
    }

    // Pour interaction — teapot starts it, window tracks the drag.
    const teapotEl = document.querySelector('.zhourat-teapot');
    if (teapotEl) {
        teapotEl.addEventListener('pointerdown', onPourStart);
    }
    window.addEventListener('pointermove',  onPointerMove);
    window.addEventListener('pointerup',    onPourEnd);
    window.addEventListener('pointercancel', onPourEnd);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => whenHeroReady(start));
    } else {
        whenHeroReady(start);
    }
})();
