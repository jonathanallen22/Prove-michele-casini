// ─── Perry Lee Intro – mobile landing greeting ────────────────────────────────
// Self-contained mobile welcome scene. Big centered Perry + speech balloon
// as one unit. Tap anywhere to advance the monologue. Last tap dismisses.
// One-shot per tab session via sessionStorage.
// ──────────────────────────────────────────────────────────────────────────────

(function () {

    // ── Monologue ───────────────────────────────────────────────────────────
    const MESSAGES = [
        "Hey! Trying to navigate...\nwith a smartphone?",
        "Okay. Fine. Can do that.",
        "You really should try this\non a wider screen.",
    ];

    // ── Inject CSS ──────────────────────────────────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        body.perry-intro-active {
            overflow: hidden;
            height: 100svh;
        }
        #perry-intro {
            position: fixed;
            inset: 0;
            z-index: 9999;
            background: var(--white, #fff);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.6s var(--ease, cubic-bezier(.4, 0, .2, 1));
            cursor: pointer;
        }
        body.dark-mode #perry-intro {
            background: var(--black, #000);
        }
        #perry-intro.perry-intro--exit {
            transform: translateY(100%);
        }

        /* Stage: Perry + balloon scale together as a single unit.
           The balloon is positioned relative to the viewer, exactly like
           desktop perry-lee.js does it. */
        .perry-intro__viewer {
            position: relative;
            width: 80vw;
            max-width: 480px;
            aspect-ratio: 1 / 1;
            display: flex;
            align-items: center;
            justify-content: center;
            transform: translateY(10vh);
        }
        .perry-intro__viewer canvas {
            width: 100% !important;
            height: 100% !important;
            opacity: 0;
            transition: opacity 0.5s var(--ease, ease);
        }
        .perry-intro__viewer canvas.is-ready {
            opacity: 1;
        }

        /* Speech balloon — same proportions as desktop perry-lee.js
           (180px bubble for 240px Perry = 75% width).
           Positioned relative to the viewer, tail overlapping Perry's head. */
        #speech-bubble {
            display: none;
            position: absolute;
            left: 42%;
            transform: translateX(-50%);
            bottom: 100%;
            margin-bottom: -36%;
            width: 75%;
            pointer-events: none;
        }
        #speech-bubble img { width: 100%; display: block; }
        #speech-bubble span {
            position: absolute;
            top: 44%;
            left: 54%;
            transform: translate(-60%, -55%);
            font-family: inherit;
            font-size: clamp(0.85rem, 3.2vw, 1rem);
            text-align: center;
            width: 67%;
            white-space: pre-line;
        }
        body.dark-mode #speech-bubble img {
            filter: invert(1);
        }

        /* Minimal spinner — shown while Three.js + model load */
        .perry-intro__spinner {
            position: absolute;
            width: 24px;
            height: 24px;
            border: 1px solid currentColor;
            border-top-color: transparent;
            border-radius: 50%;
            opacity: 0.4;
            animation: perry-intro-spin 0.9s linear infinite;
        }
        @keyframes perry-intro-spin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);

    // ── Inject overlay DOM ──────────────────────────────────────────────────
    document.body.classList.add('perry-intro-active');
    const overlay = document.createElement('div');
    overlay.id = 'perry-intro';
    overlay.innerHTML = `
        <div class="perry-intro__viewer" id="perry-intro-viewer">
            <div id="speech-bubble">
                <img src="multimedia/images/balloon.svg" alt="">
                <span id="bubble-text"></span>
            </div>
            <div class="perry-intro__spinner"></div>
        </div>
    `;
    document.body.appendChild(overlay);

    const viewer     = overlay.querySelector('#perry-intro-viewer');
    const bubble     = overlay.querySelector('#speech-bubble');
    const bubbleText = overlay.querySelector('#bubble-text');
    const spinner    = overlay.querySelector('.perry-intro__spinner');

    // ── Dismiss ─────────────────────────────────────────────────────────────
    let dismissed = false;
    function dismiss() {
        if (dismissed) return;
        dismissed = true;
        sessionStorage.setItem('perryIntroSeen', 'true');
        overlay.classList.add('perry-intro--exit');
        document.body.classList.remove('perry-intro-active');
        setTimeout(() => overlay.remove(), 700);
    }

    // ── Tap-driven monologue ────────────────────────────────────────────────
    let msgIndex = -1;
    let ready = false;

    function showMessage(text) {
        bubbleText.textContent = text;
        bubble.style.display = 'block';
    }

    function advance() {
        if (!ready || dismissed) return;
        msgIndex++;
        if (msgIndex >= MESSAGES.length) {
            dismiss();
            return;
        }
        showMessage(MESSAGES[msgIndex]);
    }

    overlay.addEventListener('click', advance);

    // ── Load Three.js + mount Perry ─────────────────────────────────────────
    Promise.all([
        import('three'),
        import('three/examples/jsm/loaders/GLTFLoader.js'),
    ]).then(([THREE, { GLTFLoader }]) => {
        const scene = new THREE.Scene();
        scene.background = null;

        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
        camera.position.set(0, 1.5, 20);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        const size = viewer.clientWidth || 360;
        renderer.setSize(size, size);
        renderer.setPixelRatio(window.devicePixelRatio);
        viewer.appendChild(renderer.domElement);

        // Lights
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dl = new THREE.DirectionalLight(0xffffff, 0.8);
        dl.position.set(5, 5, 5);
        scene.add(dl);

        // Model
        let model;
        new GLTFLoader().load(
            './multimedia/models/LeePerrySmith.glb',
            (gltf) => {
                model = gltf.scene;
                model.position.y = 0;
                const texture = new THREE.TextureLoader().load('multimedia/images/perry_color.png', () => {
                    renderer.domElement.classList.add('is-ready');
                    spinner.style.display = 'none';
                    ready = true;
                    advance();
                });
                texture.colorSpace = THREE.SRGBColorSpace;
                model.traverse(obj => {
                    if (obj.isMesh) obj.material = new THREE.MeshMatcapMaterial({ matcap: texture });
                });
                scene.add(model);
            },
            undefined,
            (err) => {
                console.error('Perry Lee Intro: model load error:', err);
                ready = true;
                advance();
            }
        );

        // Render loop — gentle idle rotation
        const clock = new THREE.Clock();
        function animate() {
            if (dismissed) return;
            requestAnimationFrame(animate);
            if (model) {
                model.rotation.y = Math.sin(clock.getElapsedTime() * 0.6) * 0.25;
            }
            renderer.render(scene, camera);
        }
        animate();

        // Resize handling
        window.addEventListener('resize', () => {
            const s = viewer.clientWidth || 360;
            renderer.setSize(s, s);
        });

    }).catch(err => {
        console.error('Perry Lee Intro: Three.js load failed:', err);
        ready = true;
        advance();
    });

})();