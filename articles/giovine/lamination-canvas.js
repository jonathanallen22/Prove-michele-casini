// ════════════════════════════════════════════════════════════════
// Lamination canvas — Giovine, "A Game of Pretense"
// v3: particles, strain glow, wind, gravity, trails, screen shake
// ════════════════════════════════════════════════════════════════
(function () {

    const canvas = document.getElementById('lam-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const slider = document.getElementById('lam-slider');
    const bcEl = document.getElementById('lam-broken-count');
    const totalEl = document.getElementById('lam-total');
    const lE = document.getElementById('lam-label-elastic');
    const lP = document.getElementById('lam-label-plastified');
    const lL = document.getElementById('lam-label-laminated');
    const resetBtn = document.getElementById('lam-reset');
    const soundBtn = document.getElementById('lam-sound-btn');
    const soundLabel = document.getElementById('sound-label');

    // ── Audio ─────────────────────────────────────────────────────
    let soundOn = false, audioCtx = null;

    function ensureAudio() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
    }

    function playSnap(intensity = 1) {
        if (!soundOn || !audioCtx) return;
        const t = audioCtx.currentTime;
        const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.07, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1)
                * Math.exp(-i / (audioCtx.sampleRate * 0.01))
                * Math.min(intensity, 1.4);
        }
        const src = audioCtx.createBufferSource(); src.buffer = buf;
        const f = audioCtx.createBiquadFilter(); f.type = 'bandpass';
        f.frequency.value = 700 + Math.random() * 1000; f.Q.value = 1.1;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.22, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
        src.connect(f); f.connect(g); g.connect(audioCtx.destination);
        src.start(t); src.stop(t + 0.07);
    }

    function playCreak(freq = 200, dur = 0.1) {
        if (!soundOn || !audioCtx) return;
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator(); osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.linearRampToValueAtTime(freq * 0.55, t + dur);
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.05, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        const f = audioCtx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
        osc.connect(f); f.connect(g); g.connect(audioCtx.destination);
        osc.start(t); osc.stop(t + dur);
    }

    function playReset() {
        if (!soundOn || !audioCtx) return;
        const t = audioCtx.currentTime;
        [0, 0.04, 0.08].forEach((dt, i) => {
            const osc = audioCtx.createOscillator(); osc.type = 'sine';
            osc.frequency.value = 300 + i * 130;
            const g = audioCtx.createGain();
            g.gain.setValueAtTime(0.1, t + dt);
            g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.14);
            osc.connect(g); g.connect(audioCtx.destination);
            osc.start(t + dt); osc.stop(t + dt + 0.14);
        });
    }

    if (soundBtn) {
        soundBtn.addEventListener('click', () => {
            soundOn = !soundOn;
            if (soundOn) { ensureAudio(); playCreak(280, 0.09); }
            soundBtn.classList.toggle('on', soundOn);
            const icon = soundBtn.querySelector('i');
            if (icon) icon.className = soundOn ? 'ti ti-volume' : 'ti ti-volume-off';
            if (soundLabel) soundLabel.textContent = soundOn ? 'sound on' : 'sound off';
        });
    }

    // ── Labels ────────────────────────────────────────────────────
    const updateLabels = () => {
        const v = parseFloat(slider.value);
        if (lE) lE.classList.toggle('active', v < 0.4);
        if (lP) lP.classList.toggle('active', v >= 0.4 && v < 0.65);
        if (lL) lL.classList.toggle('active', v >= 0.65);
    };
    slider.addEventListener('input', updateLabels);

    // ── Particles ─────────────────────────────────────────────────
    let particles = [];
    const MAX_PARTICLES = 280;

    function emitBreak(x, y, count, speed) {
        const room = MAX_PARTICLES - particles.length;
        const n = Math.min(count, room);
        for (let i = 0; i < n; i++) {
            const angle = Math.random() * Math.PI * 2;
            const v = speed * (0.6 + Math.random());
            particles.push({
                x, y,
                vx: Math.cos(angle) * v,
                vy: Math.sin(angle) * v - Math.random() * speed * 0.4,
                life: 1.0,
                decay: 0.022 + Math.random() * 0.028,
                r: 1.0 + Math.random() * 1.8,
            });
        }
    }

    function stepParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.vy += 0.055;
            p.vx *= 0.93; p.vy *= 0.93;
            p.x += p.vx; p.y += p.vy;
            p.life -= p.decay;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    function drawParticles(accent) {
        if (!particles.length) return;
        for (const p of particles) {
            ctx.globalAlpha = p.life * p.life;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
            ctx.fillStyle = accent;
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ── Mesh ──────────────────────────────────────────────────────
    const COLS = 22, ROWS = 12, ITER_BASE = 2, ITER_MAX = 16, DAMPING = 0.985;
    const GRAVITY = 0.055;
    let nodes = [], springs = [], springsByNode = [], W = 0, H = 0;
    let simTime = 0, shakeIntensity = 0;

    function getWind() {
        return Math.sin(simTime * 0.007) * Math.cos(simTime * 0.011) * 0.16;
    }

    function resize() {
        const r = canvas.getBoundingClientRect(), d = window.devicePixelRatio || 1;
        W = r.width; H = r.height;
        canvas.width = Math.round(W * d); canvas.height = Math.round(H * d);
        ctx.setTransform(d, 0, 0, d, 0, 0);
    }

    function buildMesh() {
        nodes = []; springs = []; particles = [];
        shakeIntensity = 0;
        const PX = W * 0.06, PY = H * 0.10;
        const dx = (W - PX * 2) / (COLS - 1), dy = (H - PY * 2) / (ROWS - 1);
        for (let r = 0; r < ROWS; r++)
            for (let c = 0; c < COLS; c++) {
                const x = PX + c * dx, y = PY + r * dy;
                nodes.push({ x, y, px: x, py: y, pinned: c === 0 || c === COLS - 1, anchored: true });
            }
        const addS = (a, b) => springs.push({
            a, b,
            rest: Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y),
            broken: false, strain: 0,
        });
        const idx = (r, c) => r * COLS + c;
        for (let r = 0; r < ROWS; r++)
            for (let c = 0; c < COLS; c++) {
                if (c < COLS - 1) addS(idx(r, c), idx(r, c + 1));
                if (r < ROWS - 1) addS(idx(r, c), idx(r + 1, c));
                if (r < ROWS - 1 && c < COLS - 1) addS(idx(r, c), idx(r + 1, c + 1));
                if (r < ROWS - 1 && c > 0) addS(idx(r, c), idx(r + 1, c - 1));
            }
        springsByNode = Array.from({ length: nodes.length }, () => []);
        for (let i = 0; i < springs.length; i++) {
            springsByNode[springs[i].a].push(i);
            springsByNode[springs[i].b].push(i);
        }
        for (let i = 0; i < springs.length; i++) {
            const s = springs[i], set = new Set();
            for (const n of springsByNode[s.a]) if (n !== i) set.add(n);
            for (const n of springsByNode[s.b]) if (n !== i) set.add(n);
            s.neighbors = [...set];
        }
        if (totalEl) totalEl.textContent = springs.length;
    }

    function recomputeAnchored() {
        for (const n of nodes) n.anchored = false;
        const q = [];
        for (let i = 0; i < nodes.length; i++)
            if (nodes[i].pinned) { nodes[i].anchored = true; q.push(i); }
        while (q.length) {
            const ni = q.shift();
            for (const si of springsByNode[ni]) {
                const s = springs[si]; if (s.broken) continue;
                const o = s.a === ni ? s.b : s.a;
                if (!nodes[o].anchored) { nodes[o].anchored = true; q.push(o); }
            }
        }
    }

    // ── Sound state ───────────────────────────────────────────────
    let pendingSoundSnaps = 0, lastCreakTime = 0, lastSnapTime = 0;
    const SNAP_INTERVAL_MS = 80;
    const SNAP_QUEUE_MAX = 4;

    // ── Physics ───────────────────────────────────────────────────
    function step() {
        simTime++;
        const rig = parseFloat(slider.value);
        const isLaminated = rig >= 0.65;
        const wind = getWind();

        for (const n of nodes) {
            if (n.pinned) continue;
            const d = n.anchored ? DAMPING : 0.62;
            const vx = (n.x - n.px) * d;
            const vy = (n.y - n.py) * d;
            n.px = n.x; n.py = n.y;
            n.x += vx + (n.anchored ? wind * 0.25 : wind);
            n.y += vy + (n.anchored ? 0 : GRAVITY);
        }

        const iters = Math.round(ITER_BASE + (ITER_MAX - ITER_BASE) * rig);
        const rigBreak = rig < 0.4 ? rig * 0.5 : 0.2 + (rig - 0.3) * 1.195;
        const breakActive = rigBreak > 0.12;
        const breakLimit = 5 - 4.82 * rigBreak;
        const stiffness = 0.35 + 0.65 * rig;
        const cf = bn => bn === 0 ? 1 : (1 - rigBreak) + rigBreak / (1 + 1.4 * bn);

        const newlyBroken = [];
        let maxStrain = 0;

        for (let it = 0; it < iters; it++) {
            for (const s of springs) {
                if (s.broken) continue;
                const a = nodes[s.a], b = nodes[s.b];
                const dx = b.x - a.x, dy = b.y - a.y;
                const dist = Math.hypot(dx, dy) || 0.0001;
                const strain = (dist - s.rest) / s.rest;
                s.strain = strain;
                if (Math.abs(strain) > maxStrain) maxStrain = Math.abs(strain);
                if (it === 0 && breakActive) {
                    let bn = 0;
                    for (const ni of s.neighbors) if (springs[ni].broken) bn++;
                    if (Math.abs(strain) > breakLimit * cf(bn)) {
                        s.broken = true; newlyBroken.push(s); continue;
                    }
                }
                const diff = (dist - s.rest) / dist * stiffness;
                const ox = dx * 0.5 * diff, oy = dy * 0.5 * diff;
                if (!a.pinned) { a.x += ox; a.y += oy; }
                if (!b.pinned) { b.x -= ox; b.y -= oy; }
            }
        }

        if (newlyBroken.length) {
            const SHOCK = 0.6 + 1.2 * rigBreak;
            for (const s of newlyBroken) {
                const a = nodes[s.a], b = nodes[s.b];
                const dx = b.x - a.x, dy = b.y - a.y;
                const dist = Math.hypot(dx, dy) || 0.0001;
                const ux = dx / dist, uy = dy / dist;
                if (!a.pinned) { a.x -= ux * SHOCK; a.y -= uy * SHOCK; }
                if (!b.pinned) { b.x += ux * SHOCK; b.y += uy * SHOCK; }
                // emit particles at break midpoint
                const mx = (nodes[s.a].x + nodes[s.b].x) * 0.5;
                const my = (nodes[s.a].y + nodes[s.b].y) * 0.5;
                emitBreak(mx, my, isLaminated ? 7 : 4, 1.2 + rigBreak * 2.5);
            }
            recomputeAnchored();
            // screen shake on mass failure
            if (newlyBroken.length >= 3) {
                shakeIntensity = Math.min(shakeIntensity + newlyBroken.length * 0.6, 7);
            }
            const snapMax = isLaminated ? 1 : SNAP_QUEUE_MAX;
            const snapAdd = isLaminated ? 1 : newlyBroken.length;
            pendingSoundSnaps = Math.min(pendingSoundSnaps + snapAdd, snapMax);
        }

        const now = performance.now();
        if (!isLaminated && maxStrain > 0.08 && now - lastCreakTime > 350) {
            lastCreakTime = now;
            playCreak(140 + maxStrain * 550, 0.06 + maxStrain * 0.09);
        }

        stepParticles();
        shakeIntensity *= 0.82;
    }

    // ── Render ────────────────────────────────────────────────────
    function draw() {
        ctx.clearRect(0, 0, W, H);
        const rig = parseFloat(slider.value);
        const dark = document.body.classList.contains('dark-mode');
        const idx = (r, c) => r * COLS + c;

        // apply screen shake
        const sx = shakeIntensity > 0.3 ? (Math.random() - 0.5) * shakeIntensity : 0;
        const sy = shakeIntensity > 0.3 ? (Math.random() - 0.5) * shakeIntensity : 0;
        ctx.save();
        ctx.translate(sx, sy);

        // quad fill
        for (let r = 0; r < ROWS - 1; r++)
            for (let c = 0; c < COLS - 1; c++) {
                const n00 = nodes[idx(r, c)], n10 = nodes[idx(r, c + 1)];
                const n01 = nodes[idx(r + 1, c)], n11 = nodes[idx(r + 1, c + 1)];
                let strainAvg = 0, strainCount = 0, anyBroken = false;
                for (const s of springs) {
                    const aIn = s.a === idx(r, c) || s.a === idx(r, c + 1) ||
                                s.a === idx(r + 1, c) || s.a === idx(r + 1, c + 1);
                    const bIn = s.b === idx(r, c) || s.b === idx(r, c + 1) ||
                                s.b === idx(r + 1, c) || s.b === idx(r + 1, c + 1);
                    if (aIn && bIn) {
                        if (s.broken) anyBroken = true;
                        else { strainAvg += Math.abs(s.strain); strainCount++; }
                    }
                }
                if (strainCount > 0) strainAvg /= strainCount;
                if (anyBroken) continue;
                const r0 = dark ? 28 : 252, g0 = dark ? 26 : 248, b0 = dark ? 22 : 240;
                const r1 = dark ? 38 : 198, g1 = dark ? 44 : 204, b1 = dark ? 54 : 214;
                let rR = r0 + (r1 - r0) * rig;
                let gR = g0 + (g1 - g0) * rig;
                let bR = b0 + (b1 - b0) * rig;
                const st = Math.min(1, strainAvg * 0.7) * rig;
                rR = rR * (1 - st) + 255 * st;
                gR = gR * (1 - st) + 51 * st;
                bR = bR * (1 - st) + 80 * st;
                ctx.fillStyle = `rgb(${rR | 0},${gR | 0},${bR | 0})`;
                ctx.beginPath();
                ctx.moveTo(n00.x, n00.y); ctx.lineTo(n10.x, n10.y);
                ctx.lineTo(n11.x, n11.y); ctx.lineTo(n01.x, n01.y);
                ctx.closePath(); ctx.fill();
            }

        // bucket springs by strain level for heat-map rendering
        const lowS = [], medS = [], highS = [];
        for (const s of springs) {
            if (s.broken) continue;
            const a = Math.abs(s.strain);
            if (a > 0.22) highS.push(s);
            else if (a > 0.09) medS.push(s);
            else lowS.push(s);
        }

        // low strain — normal grid lines
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = dark
            ? `rgba(255,255,255,${0.14 + 0.20 * rig})`
            : `rgba(0,0,0,${0.14 + 0.18 * rig})`;
        ctx.beginPath();
        for (const s of lowS) {
            ctx.moveTo(nodes[s.a].x, nodes[s.a].y);
            ctx.lineTo(nodes[s.b].x, nodes[s.b].y);
        }
        ctx.stroke();

        // medium strain — warm orange tint
        if (medS.length) {
            ctx.lineWidth = 1;
            ctx.strokeStyle = dark ? 'rgba(255,150,60,0.55)' : 'rgba(220,100,30,0.50)';
            ctx.beginPath();
            for (const s of medS) {
                ctx.moveTo(nodes[s.a].x, nodes[s.a].y);
                ctx.lineTo(nodes[s.b].x, nodes[s.b].y);
            }
            ctx.stroke();
        }

        // high strain — hot red with glow
        if (highS.length) {
            ctx.lineWidth = 1.4;
            ctx.strokeStyle = 'rgba(255,55,55,0.9)';
            ctx.shadowColor = 'rgba(255,70,30,0.7)';
            ctx.shadowBlur = 7;
            ctx.beginPath();
            for (const s of highS) {
                ctx.moveTo(nodes[s.a].x, nodes[s.a].y);
                ctx.lineTo(nodes[s.b].x, nodes[s.b].y);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // motion trails for detached/fast fragments
        ctx.lineWidth = 1;
        for (const n of nodes) {
            if (n.pinned || n.anchored) continue;
            const vx = n.x - n.px, vy = n.y - n.py;
            const spd = Math.hypot(vx, vy);
            if (spd > 1.2) {
                const alpha = Math.min(spd * 0.07, 0.28);
                ctx.strokeStyle = dark ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
                ctx.beginPath();
                ctx.moveTo(n.px - vx * 2, n.py - vy * 2);
                ctx.lineTo(n.x, n.y);
                ctx.stroke();
            }
        }

        // broken springs
        const accent = getComputedStyle(document.documentElement)
            .getPropertyValue('--dynamic-color').trim() || '#ff3366';
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = accent;
        ctx.shadowColor = accent; ctx.shadowBlur = 5;
        ctx.beginPath();
        for (const s of springs) {
            if (!s.broken) continue;
            ctx.moveTo(nodes[s.a].x, nodes[s.a].y);
            ctx.lineTo(nodes[s.b].x, nodes[s.b].y);
        }
        ctx.stroke(); ctx.shadowBlur = 0;

        // particles
        drawParticles(accent);

        // nodes — pinned ones pulse
        const pulse = 0.5 + 0.5 * Math.sin(simTime * 0.05);
        for (const n of nodes) {
            const baseR = n.pinned ? 2.6 : 1.8;
            const r = n.pinned ? baseR + pulse * 0.7 : baseR;
            const baseAlpha = n.pinned ? 0.55 + pulse * 0.18 : 0.7;
            ctx.beginPath();
            ctx.fillStyle = dark
                ? `rgba(255,255,255,${baseAlpha})`
                : `rgba(0,0,0,${baseAlpha})`;
            ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    // ── Interaction ───────────────────────────────────────────────
    let grabbed = null; const GR = 32;
    const ep = e => {
        const r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e;
        return { x: t.clientX - r.left, y: t.clientY - r.top };
    };
    const findNear = (x, y) => {
        let best = null, bd = GR * GR;
        for (const n of nodes) {
            if (n.pinned) continue;
            const dx = n.x - x, dy = n.y - y, d = dx * dx + dy * dy;
            if (d < bd) { bd = d; best = n; }
        }
        return best;
    };
    const onDown = e => {
        if (soundOn) ensureAudio();
        const p = ep(e); grabbed = findNear(p.x, p.y);
        if (grabbed) { canvas.classList.add('dragging'); e.preventDefault(); }
    };
    const onMove = e => {
        if (!grabbed) return;
        const p = ep(e); grabbed.x = p.x; grabbed.y = p.y; grabbed.px = p.x; grabbed.py = p.y;
        e.preventDefault();
    };
    const onUp = () => { grabbed = null; canvas.classList.remove('dragging'); };

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);

    // ── Reset ─────────────────────────────────────────────────────
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (soundOn) { ensureAudio(); playReset(); }
            resetBtn.classList.remove('shake');
            void resetBtn.offsetWidth;
            resetBtn.classList.add('shake');
            pendingSoundSnaps = 0;
            resize(); buildMesh(); recomputeAnchored();
            if (bcEl) { bcEl.textContent = '0'; bcEl.classList.remove('broken'); }
        });
    }

    window.addEventListener('resize', () => { resize(); buildMesh(); recomputeAnchored(); });
    resize(); buildMesh(); recomputeAnchored(); updateLabels();

    // ── Loop ──────────────────────────────────────────────────────
    (function loop() {
        step(); draw();
        const isLaminated = parseFloat(slider.value) >= 0.65;

        let n = 0;
        for (const s of springs) if (s.broken) n++;
        if (bcEl) { bcEl.textContent = n; bcEl.classList.toggle('broken', n > 0); }

        const now = performance.now();
        const snapInterval = isLaminated ? 400 : SNAP_INTERVAL_MS;
        if (pendingSoundSnaps > 0 && soundOn && now - lastSnapTime > snapInterval) {
            playSnap(isLaminated ? 1.2 : 0.5 + pendingSoundSnaps * 0.25);
            lastSnapTime = now;
            pendingSoundSnaps = Math.max(0, pendingSoundSnaps - 1);
        } else if (!soundOn) {
            pendingSoundSnaps = 0;
        }

        requestAnimationFrame(loop);
    })();
})();
