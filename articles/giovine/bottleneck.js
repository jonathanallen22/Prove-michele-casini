// ════════════════════════════════════════════════════════════════
// Currency bottleneck — Giovine, "A Game of Pretense"
// v3: faster greying, sound on toggle + absorption
// ════════════════════════════════════════════════════════════════
(function () {
    const canvas = document.getElementById('btl-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const btn = document.getElementById('btl-toggle');
    const rPath = document.getElementById('btl-path');

    const TYPES = [
        { name: 'food',      c: '#f4a261' },
        { name: 'time',      c: '#2a9d8f' },
        { name: 'care',      c: '#e63946' },
        { name: 'knowledge', c: '#4361ee' },
    ];
    const N = 140;
    const LINK_RANGE = 140;
    const SKIM_BASE = 0.38;
    const PARTICLE_SPEED = 2.4;
    const MAX_PARTICLES = 160;
    const LINK_SCAN_EVERY = 3;

    let W = 0, H = 0;
    const pts = [];
    const particles = [];
    const drainPulses = [];
    const absorptionFlashes = [];
    let activeLinks = [];
    let monetized = false;
    let absorbedCount = 0, deliveredCount = 0, totalSpawned = 0;
    let t = 0;
    let avgPath = 0, pathLenSum = 0, pathLenCount = 0;
    let lastAbsorbSound = 0;

    // ── Audio ─────────────────────────────────────────────────────
    let audioCtx = null;
    function ensureAudio() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
    }

    function playAbsorption() {
        if (!audioCtx) return;
        const now = performance.now();
        if (now - lastAbsorbSound < 120) return; // throttle
        lastAbsorbSound = now;
        const t0 = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, t0);
        osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.18);
        const f = audioCtx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 280;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.07, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
        osc.connect(f); f.connect(g); g.connect(audioCtx.destination);
        osc.start(t0); osc.stop(t0 + 0.18);
    }

    function playMonetizedOn() {
        if (!audioCtx) return;
        const t0 = audioCtx.currentTime;
        // low ominous chord drop
        [90, 110, 135].forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            const f = audioCtx.createBiquadFilter();
            f.type = 'lowpass'; f.frequency.value = 600;
            const g = audioCtx.createGain();
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.05, t0 + 0.15);
            g.gain.exponentialRampToValueAtTime(0.001, t0 + 2.0);
            osc.connect(f); f.connect(g); g.connect(audioCtx.destination);
            osc.start(t0); osc.stop(t0 + 2.0);
        });
        // high screech
        const osc2 = audioCtx.createOscillator();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(900, t0);
        osc2.frequency.exponentialRampToValueAtTime(200, t0 + 0.4);
        const g2 = audioCtx.createGain();
        g2.gain.setValueAtTime(0.04, t0);
        g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
        osc2.connect(g2); g2.connect(audioCtx.destination);
        osc2.start(t0); osc2.stop(t0 + 0.4);
    }

    function playMonetizedOff() {
        if (!audioCtx) return;
        const t0 = audioCtx.currentTime;
        [350, 450, 580].forEach((freq, i) => {
            const dt = i * 0.07;
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const g = audioCtx.createGain();
            g.gain.setValueAtTime(0.07, t0 + dt);
            g.gain.exponentialRampToValueAtTime(0.001, t0 + dt + 0.4);
            osc.connect(g); g.connect(audioCtx.destination);
            osc.start(t0 + dt); osc.stop(t0 + dt + 0.4);
        });
    }

    // ── Color utils ───────────────────────────────────────────────
    function lerpHex(hex1, hex2, f) {
        const p = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
        const a = p(hex1), b = p(hex2);
        return `rgb(${Math.round(a[0]+(b[0]-a[0])*f)},${Math.round(a[1]+(b[1]-a[1])*f)},${Math.round(a[2]+(b[2]-a[2])*f)})`;
    }

    // ── Theme ─────────────────────────────────────────────────────
    let theme = null, lastDark = null;
    function getTheme() {
        const dark = document.body.classList.contains('dark-mode');
        if (dark === lastDark && theme) return theme;
        lastDark = dark;
        theme = dark ? {
            dark: true,
            bg: '#05060a',
            trail: 'rgba(5,6,10,0.22)',
            linkAlphaScale: 0.22,
            nodeGlowAlpha: 0.30,
            nodeCoreAlpha: 0.90,
            particleGlowAlpha: 0.25,
            particleCoreAlpha: 0.95,
            disk: '#080910',
            diskBorder: 'rgba(255,20,60,',
            haloStart: 'rgba(255,20,60,',
            glyphColor: '#ff2255',
            greyTarget: '#333344',
            moneLinkColor: '90,65,75',
            bgTint: 'rgba(50,4,8,',
        } : {
            dark: false,
            bg: '#fbfaf7',
            trail: 'rgba(251,250,247,0.28)',
            linkAlphaScale: 0.42,
            nodeGlowAlpha: 0.22,
            nodeCoreAlpha: 1.0,
            particleGlowAlpha: 0.18,
            particleCoreAlpha: 1.0,
            disk: '#f5f0f2',
            diskBorder: 'rgba(255,20,60,',
            haloStart: 'rgba(255,20,60,',
            glyphColor: '#cc0033',
            greyTarget: '#aaaaaa',
            moneLinkColor: '160,120,130',
            bgTint: 'rgba(160,20,40,',
        };
        return theme;
    }

    // ── Sizing ────────────────────────────────────────────────────
    function resize() {
        const r = canvas.getBoundingClientRect();
        const d = window.devicePixelRatio || 1;
        W = r.width; H = r.height;
        canvas.width = Math.round(W * d);
        canvas.height = Math.round(H * d);
        ctx.setTransform(d, 0, 0, d, 0, 0);
    }
    function center() { return { x: W / 2, y: H / 2 }; }
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

    // ── Build ─────────────────────────────────────────────────────
    function build() {
        pts.length = 0;
        for (let i = 0; i < N; i++) {
            pts.push({
                x: W / 2 + (Math.random() - 0.5) * W * 0.6,
                y: H / 2 + (Math.random() - 0.5) * H * 0.6,
                vx: 0, vy: 0,
                type: TYPES[i % TYPES.length],
                role: Math.random() < 0.5 ? 'd' : 'o',
                brightness: 1.0,
            });
        }
        particles.length = 0;
        drainPulses.length = 0;
        absorptionFlashes.length = 0;
        activeLinks.length = 0;
    }

    // ── Node dynamics ─────────────────────────────────────────────
    function updateNodes() {
        const c0 = center();
        const accum = Math.min(1, absorbedCount / 500);
        for (const p of pts) {
            if (monetized) {
                const dx = c0.x - p.x, dy = c0.y - p.y;
                const d = Math.hypot(dx, dy) || 1;
                const pull = d > 60 ? 0.005 + accum * 0.007 : -0.004;
                p.vx += (dx / d) * pull;
                p.vy += (dy / d) * pull;
                // darken faster — visible within a few seconds
                p.brightness = Math.max(0.18, p.brightness - 0.004);
            } else {
                p.brightness = Math.min(1.0, p.brightness + 0.012);
            }
            const bias = p.role === 'd' ? -0.008 : 0.008;
            p.vx += bias + (Math.random() - 0.5) * 0.18;
            p.vy +=        (Math.random() - 0.5) * 0.18;
            p.vx *= 0.92; p.vy *= 0.92;
            p.x += p.vx; p.y += p.vy;
            p.x = Math.max(0, Math.min(W, p.x));
            p.y = Math.max(0, Math.min(H, p.y));
        }
    }

    // ── Particles ─────────────────────────────────────────────────
    function spawnParticle(a, b) {
        particles.push({
            from: a, to: b,
            viaCenter: monetized,
            segIdx: 0, segT: 0,
            color: a.type.c,
            alive: true,
        });
        totalSpawned++;
    }
    function waypointPos(p, i) {
        if (i === 0) return p.from;
        if (p.viaCenter) {
            if (i === 1) return center();
            if (i === 2) return p.to;
        } else {
            if (i === 1) return p.to;
        }
        return null;
    }

    function updateParticles() {
        const accum = Math.min(1, absorbedCount / 500);
        const skimRate = SKIM_BASE + accum * 0.22;
        for (const p of particles) {
            if (!p.alive) continue;
            const seg = waypointPos(p, p.segIdx);
            const next = waypointPos(p, p.segIdx + 1);
            if (!next) { p.alive = false; deliveredCount++; continue; }
            const segLen = Math.hypot(next.x - seg.x, next.y - seg.y) || 0.0001;
            p.segT += PARTICLE_SPEED / segLen;
            if (p.segT >= 1) {
                p.segT = 0;
                p.segIdx++;
                if (p.viaCenter && p.segIdx === 1) {
                    if (Math.random() < skimRate) {
                        p.alive = false;
                        absorbedCount++;
                        const radius = 20 + accum * 22;
                        drainPulses.push({ r: radius * 0.6, maxR: 80 + accum * 50, alpha: 1 });
                        absorptionFlashes.push({ life: 1.0, radius });
                        playAbsorption();
                    }
                }
            }
        }
        for (let i = drainPulses.length - 1; i >= 0; i--) {
            const dp = drainPulses[i];
            dp.r += 2.2;
            dp.alpha = 1 - dp.r / dp.maxR;
            if (dp.alpha <= 0) drainPulses.splice(i, 1);
        }
        for (let i = absorptionFlashes.length - 1; i >= 0; i--) {
            absorptionFlashes[i].life -= 0.09;
            if (absorptionFlashes[i].life <= 0) absorptionFlashes.splice(i, 1);
        }
        for (let i = particles.length - 1; i >= 0; i--) {
            if (!particles[i].alive) particles.splice(i, 1);
        }
    }

    // ── Links ─────────────────────────────────────────────────────
    function processLinks() {
        if (t % LINK_SCAN_EVERY !== 0) return;
        pathLenSum = 0; pathLenCount = 0;
        activeLinks.length = 0;
        const c0 = center();
        for (let i = 0; i < N; i++) {
            for (let j = i + 1; j < N; j++) {
                const a = pts[i], b = pts[j];
                const d = dist(a, b);
                if (d > LINK_RANGE) continue;
                const sameType = a.type.name === b.type.name;
                const strength = sameType ? 1 : 0.25;
                activeLinks.push({ a, b, proximity: 1 - d / LINK_RANGE, strength, color: a.type.c });
                const pathLen = monetized ? dist(a, c0) + dist(c0, b) : d;
                pathLenSum += pathLen * strength;
                pathLenCount += strength;
                if (particles.length < MAX_PARTICLES
                    && Math.random() < 0.004 * strength * LINK_SCAN_EVERY) {
                    spawnParticle(a, b);
                }
            }
        }
    }

    // ── Draw: links ───────────────────────────────────────────────
    function drawLinks(th) {
        const c0 = center();
        if (!monetized) {
            const buckets = new Map();
            for (const link of activeLinks) {
                const alpha = link.proximity * link.strength * th.linkAlphaScale;
                const aq = Math.round(alpha * 25) / 25;
                if (aq <= 0) continue;
                const key = link.color + '|' + aq;
                let arr = buckets.get(key);
                if (!arr) { arr = []; buckets.set(key, arr); }
                arr.push(link);
            }
            ctx.lineWidth = 1;
            for (const [key, links] of buckets) {
                const [color, aq] = key.split('|');
                ctx.globalAlpha = parseFloat(aq);
                ctx.strokeStyle = color;
                ctx.beginPath();
                for (const link of links) {
                    ctx.moveTo(link.a.x, link.a.y);
                    ctx.lineTo(link.b.x, link.b.y);
                }
                ctx.stroke();
            }
        } else {
            // monetized: grey, all routed through center
            ctx.lineWidth = 0.7;
            ctx.strokeStyle = `rgba(${th.moneLinkColor},0.14)`;
            ctx.globalAlpha = 1;
            ctx.beginPath();
            for (const link of activeLinks) {
                if (link.proximity * link.strength < 0.05) continue;
                ctx.moveTo(link.a.x, link.a.y);
                ctx.lineTo(c0.x, c0.y);
                ctx.lineTo(link.b.x, link.b.y);
            }
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    // ── Draw: particles ───────────────────────────────────────────
    function drawParticles(th) {
        if (!monetized) {
            // free: vibrant, batched by color
            const byColor = new Map();
            for (const p of particles) {
                if (!p.alive) continue;
                const seg = waypointPos(p, p.segIdx);
                const next = waypointPos(p, p.segIdx + 1);
                if (!next) continue;
                const x = seg.x + (next.x - seg.x) * p.segT;
                const y = seg.y + (next.y - seg.y) * p.segT;
                let arr = byColor.get(p.color);
                if (!arr) { arr = []; byColor.set(p.color, arr); }
                arr.push(x, y);
            }
            for (const [color, xs] of byColor) {
                ctx.fillStyle = color;
                ctx.globalAlpha = th.particleGlowAlpha;
                ctx.beginPath();
                for (let i = 0; i < xs.length; i += 2) {
                    ctx.moveTo(xs[i]+5, xs[i+1]);
                    ctx.arc(xs[i], xs[i+1], 5, 0, Math.PI*2);
                }
                ctx.fill();
                ctx.globalAlpha = th.particleCoreAlpha;
                ctx.beginPath();
                for (let i = 0; i < xs.length; i += 2) {
                    ctx.moveTo(xs[i]+2.2, xs[i+1]);
                    ctx.arc(xs[i], xs[i+1], 2.2, 0, Math.PI*2);
                }
                ctx.fill();
            }
        } else {
            // monetized: desaturate to grey as particles approach center
            for (const p of particles) {
                if (!p.alive) continue;
                const seg = waypointPos(p, p.segIdx);
                const next = waypointPos(p, p.segIdx + 1);
                if (!next) continue;
                const x = seg.x + (next.x - seg.x) * p.segT;
                const y = seg.y + (next.y - seg.y) * p.segT;

                // corruption 0 = original color, 1 = grey
                // particles grey out quickly as they move toward center
                let corruption;
                if (p.segIdx === 0) {
                    corruption = 0.25 + p.segT * 0.75; // 25%→100% grey approaching center
                } else {
                    corruption = 1.0 - p.segT * 0.55; // leaves as grey, partial recovery
                }
                corruption = Math.max(0, Math.min(1, corruption));

                const col = lerpHex(p.color, th.greyTarget, corruption);
                const size = Math.max(0.8, 2.2 - corruption * 1.4);
                const glowSize = Math.max(1.2, 5 - corruption * 4);

                ctx.globalAlpha = th.particleGlowAlpha * (1 - corruption * 0.6);
                ctx.fillStyle = col;
                ctx.beginPath();
                ctx.arc(x, y, glowSize, 0, Math.PI*2);
                ctx.fill();

                ctx.globalAlpha = th.particleCoreAlpha;
                ctx.fillStyle = col;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI*2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    }

    // ── Draw: nodes ───────────────────────────────────────────────
    function drawNodes(th) {
        if (!monetized) {
            const byColor = new Map();
            for (const p of pts) {
                let arr = byColor.get(p.type.c);
                if (!arr) { arr = []; byColor.set(p.type.c, arr); }
                arr.push(p.x, p.y);
            }
            for (const [color, data] of byColor) {
                ctx.fillStyle = color;
                ctx.globalAlpha = th.nodeGlowAlpha;
                ctx.beginPath();
                for (let i = 0; i < data.length; i += 2) {
                    ctx.moveTo(data[i]+2.4, data[i+1]);
                    ctx.arc(data[i], data[i+1], 2.4, 0, Math.PI*2);
                }
                ctx.fill();
                ctx.globalAlpha = th.nodeCoreAlpha;
                ctx.beginPath();
                for (let i = 0; i < data.length; i += 2) {
                    ctx.moveTo(data[i]+1.1, data[i+1]);
                    ctx.arc(data[i], data[i+1], 1.1, 0, Math.PI*2);
                }
                ctx.fill();
            }
        } else {
            // monetized: nodes individually suppressed toward grey
            for (const p of pts) {
                const b = p.brightness;
                // brightness 1→0.18, lerp color toward grey as it falls
                const greyAmount = 1 - b;
                const col = lerpHex(p.type.c, th.greyTarget, greyAmount);
                ctx.fillStyle = col;
                ctx.globalAlpha = th.nodeGlowAlpha * b;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2.4, 0, Math.PI*2);
                ctx.fill();
                ctx.globalAlpha = th.nodeCoreAlpha * b;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 1.1, 0, Math.PI*2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    }

    // ── Draw: drain effects ───────────────────────────────────────
    function drawDrainEffects() {
        if (!drainPulses.length && !absorptionFlashes.length) return;
        const c0 = center();
        for (const fl of absorptionFlashes) {
            const fr = fl.radius * (1.4 + (1 - fl.life) * 0.8);
            ctx.globalAlpha = fl.life * fl.life * 0.32;
            ctx.fillStyle = '#ff2255';
            ctx.beginPath();
            ctx.arc(c0.x, c0.y, fr, 0, Math.PI*2);
            ctx.fill();
        }
        for (const dp of drainPulses) {
            ctx.globalAlpha = dp.alpha * 0.45;
            ctx.strokeStyle = '#ff2255';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(c0.x, c0.y, dp.r, 0, Math.PI*2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    // ── Draw: center disk ─────────────────────────────────────────
    function drawCenter(th) {
        if (!monetized) return;
        const c0 = center();
        const accum = Math.min(1, absorbedCount / 500);
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.07);
        const radius = 20 + accum * 22;

        // distortion rings
        for (let ring = 4; ring >= 1; ring--) {
            const rr = radius * (1.4 + ring * 0.9) + pulse * 5;
            ctx.globalAlpha = (0.22 - ring * 0.04) * (0.4 + accum * 0.6);
            ctx.strokeStyle = '#ff2255';
            ctx.lineWidth = ring === 1 ? 1.2 : 0.6;
            ctx.beginPath();
            ctx.arc(c0.x, c0.y, rr, 0, Math.PI*2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // halo
        const haloR = radius * 2.8 + pulse * 10;
        const g = ctx.createRadialGradient(c0.x, c0.y, radius * 0.3, c0.x, c0.y, haloR);
        g.addColorStop(0, `rgba(255,15,55,${0.48 + accum * 0.32 + pulse * 0.08})`);
        g.addColorStop(0.4, `rgba(255,15,55,${0.10 + accum * 0.08})`);
        g.addColorStop(1, 'rgba(255,15,55,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(c0.x, c0.y, haloR, 0, Math.PI*2);
        ctx.fill();

        // core disk
        ctx.fillStyle = th.disk;
        ctx.beginPath();
        ctx.arc(c0.x, c0.y, radius, 0, Math.PI*2);
        ctx.fill();

        ctx.strokeStyle = th.diskBorder + (0.65 + accum * 0.35 + pulse * 0.15) + ')';
        ctx.lineWidth = 1.5 + accum * 1.5;
        ctx.stroke();

        // accumulation arc
        if (accum > 0.02) {
            ctx.strokeStyle = 'rgba(255,20,60,0.55)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(c0.x, c0.y, radius + 5, -Math.PI/2, -Math.PI/2 + accum * Math.PI*2);
            ctx.stroke();
        }

        // $ glyph
        const fontSize = Math.round(14 + accum * 10);
        ctx.fillStyle = th.glyphColor;
        ctx.font = `bold ${fontSize}px 'Courier New', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', c0.x, c0.y);
        ctx.globalAlpha = 1;
    }

    // ── Main draw ─────────────────────────────────────────────────
    function draw() {
        const th = getTheme();
        ctx.fillStyle = th.trail;
        ctx.fillRect(0, 0, W, H);
        if (monetized) {
            const accum = Math.min(1, absorbedCount / 500);
            if (accum > 0.04) {
                ctx.fillStyle = th.bgTint + (accum * 0.035) + ')';
                ctx.fillRect(0, 0, W, H);
            }
        }
        drawLinks(th);
        drawDrainEffects();
        drawParticles(th);
        drawNodes(th);
        drawCenter(th);
    }

    // ── Readout ───────────────────────────────────────────────────
    function updateReadout() {
        if (pathLenCount > 0) {
            const inst = pathLenSum / pathLenCount;
            avgPath = avgPath * 0.92 + inst * 0.08;
        }
        if (t % 6 === 0 && rPath) {
            rPath.textContent = avgPath ? Math.round(avgPath) + ' px' : '—';
        }
    }

    // ── Toggle ────────────────────────────────────────────────────
    function setToggleLabel() {
        if (!btn) return;
        btn.innerHTML = monetized
            ? `<span style="opacity:0.35">free</span> <span class="btl-arr">/</span> <span>monetized</span>`
            : `<span>free</span> <span class="btl-arr">/</span> <span style="opacity:0.35">monetized</span>`;
    }
    if (btn) {
        btn.onclick = () => {
            ensureAudio();
            monetized = !monetized;
            if (monetized) playMonetizedOn();
            else playMonetizedOff();
            setToggleLabel();
            absorbedCount = 0; deliveredCount = 0; totalSpawned = 0;
            avgPath = 0;
            particles.length = 0;
            activeLinks.length = 0;
            drainPulses.length = 0;
            absorptionFlashes.length = 0;
            for (const p of pts) p.brightness = 1.0;
        };
        setToggleLabel();
    }

    // ── Resize ────────────────────────────────────────────────────
    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { resize(); build(); }, 120);
    });

    const observer = new MutationObserver(() => {
        const th = getTheme();
        ctx.fillStyle = th.bg;
        ctx.fillRect(0, 0, W, H);
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    resize();
    build();
    (function loop() {
        t++;
        updateNodes();
        processLinks();
        updateParticles();
        draw();
        updateReadout();
        requestAnimationFrame(loop);
    })();
})();
