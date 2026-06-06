// ─── Perry Lee – standalone module ────────────────────────────────────────────
// Drop  <div id="viewer"></div>  anywhere and include this script.
// Behaviour is driven by the page-config table below.
// ──────────────────────────────────────────────────────────────────────────────

(function () {

    // ── Per-page configuration ──────────────────────────────────────────────
    // key   : substring matched against window.location.pathname
    // value : object with any overrides you want for that page
    //   messages      – array of strings cycled through on click
    //   rotateMessage – what Perry says when rotated
    //   idleMessages  – optional: messages shown unprompted after a delay
    // ────────────────────────────────────────────────────────────────────────
    const PAGE_CONFIG = {
        'index': {
            firstClick: [
                "I'm not a doorbell, you know?",
                "Stop clicking me.",
                "I do have some dignity.",
                "I regret becoming interactive.",
            ],
            firstRotate: [
                "Careful with\nthe neck.",
                "That feels good.",
                "I really was happier as a mannequin."
            ],
            secondInteraction: [
                "That title up there. Go on. Press it.",
                "Bit lost? Explore.",
            ],
            flyingReactions: [
                'That flapping thing again...',
                "Yes, it's meant to move. Don't ask.",
                "If it annoys you, you may as well click it.",
            ],
        },
        'archive': {
            firstClick: [
                "I'm not a doorbell, you know?",
                "Stop clicking me.",
                "I regret becoming interactive.",
            ],
            firstRotate: [
                "Careful with\nthe neck.",
                "That feels good.",
                "I really was happier as a mannequin."
            ],
            secondInteraction: [
                "Archivists have their tricks ;) Press R",
            ],
            flyingReactions: [
                'That flapping thing again...',
                "Yes, it's meant to move. Don't ask.",
                "If it annoys you, you may as well click it.",
            ],
        },
        'colophon': {
            firstClick: [
                "Don't look at me. I didn't design this.",
            ],
            firstRotate: [
                "My eyes decline.",
            ],
            secondInteraction: [
                "Seriously. Not my fault.",
                "Talk to the editors.",
            ],
            idleMessage: [
                'Ugh. Modal scales.\nCome on...'
            ]
        },
        '404': {
            introMessage: [
                "I'm sorry — we don't\nhave that page here.",
            ],
            firstClick: [
                "I know. I know.",
                "I looked everywhere.",
                "It's really not here.",
            ],
            firstRotate: [
                "The page isn't this way either.",
                "Still 404 from this angle.",
            ],
            secondInteraction: [
                "The button below does work, at least.",
            ],
        },
        _default: {
            firstClick: ['hello'],
            firstRotate: ['stop rotating me'],
            secondInteraction: ['stop clicking me'],
        },
    };

    // ── Resolve config for the current page ─────────────────────────────────
    function getConfig() {
        if (window.is404Page) return PAGE_CONFIG['404'];
        const path = window.location.pathname;
        for (const key of Object.keys(PAGE_CONFIG)) {
            if (key !== '_default' && (path.includes(key) || (key === 'index' && (path === '/' || path.endsWith('/'))))) return PAGE_CONFIG[key];
        }
        return PAGE_CONFIG._default;
    }

    // ── Inject CSS ───────────────────────────────────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        #speech-bubble {
            display: none;
            position: absolute;
            left: 38%;
            transform: translateX(-50%);
            bottom: 100%;
            margin-bottom: -88px;
            width: 180px;
            pointer-events: none;
        }
        #speech-bubble img { width: 100%; }
        #speech-bubble span {
            position: absolute;
            top: 42%;
            left: 54%;
            transform: translate(-60%, -55%);
            font-family: inherit;
            font-size: 14px;
            text-align: center;
            width: 67%;
            white-space: pre-line;
        }
        body.dark-mode #speech-bubble img {
            filter: invert(1);
        }
        #viewer { display: inline-block; }
        @media (max-width: 1200px) { #viewer { display: none; } }
    `;
    document.head.appendChild(style);

    // ── Inject HTML into #viewer ─────────────────────────────────────────────
    const container = document.getElementById('viewer');
    if (!container) return; // nothing to do if the page has no #viewer

    container.style.position = 'relative';
    container.innerHTML = `
        <div id="speech-bubble">
            <img src="multimedia/images/balloon.svg">
            <span id="bubble-text"></span>
        </div>
    `;

    // ── Load Three.js via injected script tags (no importmap needed) ─────────
    const THREE_CDN = 'https://unpkg.com/three@0.160.0/build/three.module.js';
    const GLTF_CDN = 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
    const ORBIT_CDN = 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';

    import(THREE_CDN).then(THREE => {
        return Promise.all([
            import(GLTF_CDN),
            import(ORBIT_CDN),
        ]).then(([{ GLTFLoader }, { OrbitControls }]) => {
            boot(THREE, GLTFLoader, OrbitControls);
        });
    }).catch(err => console.warn('Perry Lee: Three.js not available:', err));

    function boot(THREE, GLTFLoader, OrbitControls) {
        const config = getConfig();

        // ── Scene / Camera / Renderer ──────────────────────────────────────
        const scene = new THREE.Scene();
        scene.background = null;

        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
        camera.position.set(5, 1.5, 12);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(240, 240);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.domElement.style.opacity = '0';
        renderer.domElement.style.transition = 'opacity 0.4s ease';
        container.appendChild(renderer.domElement);

        // ── Lights ─────────────────────────────────────────────────────────
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const light = new THREE.DirectionalLight(0xffffff, 0.8);
        light.position.set(5, 5, 5);
        scene.add(light);

        // ── Controls ───────────────────────────────────────────────────────
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.enableZoom = false;
        controls.minDistance = 20;
        controls.maxDistance = 20;

        // ── Model ──────────────────────────────────────────────────────────
        let model;
        new GLTFLoader().load(
            './multimedia/models/LeePerrySmith.glb',
            (gltf) => {
                model = gltf.scene;
                model.position.y = 0;
                const texture = new THREE.TextureLoader().load('multimedia/images/perry_color.png', () => {
                    renderer.domElement.style.opacity = '1';
                    if (config.introMessage) {
                        setTimeout(() => showMessage(config.introMessage[Math.floor(Math.random() * config.introMessage.length)]), 600);
                    }
                });
                texture.colorSpace = THREE.SRGBColorSpace;
                model.traverse(obj => {
                    if (obj.isMesh) obj.material = new THREE.MeshMatcapMaterial({ matcap: texture });
                });
                scene.add(model);
            },
            undefined,
            (err) => console.error('Perry Lee: model load error:', err)
        );

        // ── Speech bubble ──────────────────────────────────────────────────
        const bubble = document.getElementById('speech-bubble');
        const bubbleText = document.getElementById('bubble-text');
        let hideTimer;
        let messageVisible = false;

        const MSG_DURATION = 4000;
        const INTERACT_COOLDOWN = 500;
        const FLYING_INTERACT_COOLDOWN = 2000; // delay between flying convo steps

        function showMessage(text) {
            bubbleText.textContent = text;
            bubble.style.display = 'block';
            messageVisible = true;
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => {
                bubble.style.display = 'none';
                messageVisible = false;
            }, MSG_DURATION);
        }

        // ── Idle behavior ──────────────────────────────────────────────────
        const IDLE_DELAY = 8000;
        let idleTimer;

        function resetIdleTimer() {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                if (config.idleMessage) {
                    showMessage(config.idleMessage);
                    ['mousemove', 'keydown', 'scroll', 'click'].forEach(ev => {
                        document.removeEventListener(ev, resetIdleTimer);
                    });
                }
            }, IDLE_DELAY);
        }

        if (config.idleMessage) {
            ['mousemove', 'keydown', 'scroll', 'click'].forEach(ev => {
                document.addEventListener(ev, resetIdleTimer, { passive: true });
            });
            resetIdleTimer();
        }

        // ── Flying object proximity detection ─────────────────────────────
        let flyingReactionIndex = 0;
        let lastFlyingInteract = 0; // cooldown for click-advancing flying convo

        if (config.flyingReactions) {
            let flyingCooldown = false;
            const FLYING_COOLDOWN = 6000;
            const PROXIMITY = 160;

            function checkFlyingProximity() {
                const pos = window.flyingMagazinePos;
                if (!pos || flyingCooldown) return;

                const viewerRect = container.getBoundingClientRect();
                const perryX = viewerRect.left + viewerRect.width / 2;
                const perryY = viewerRect.top + viewerRect.height / 2;
                const dist = Math.hypot((pos.x + pos.w / 2) - perryX, (pos.y + pos.h / 2) - perryY);

                if (dist < PROXIMITY && !tortureMode) {
                    const msg = config.flyingReactions[Math.min(flyingReactionIndex, config.flyingReactions.length - 1)];
                    showMessage(msg);
                    flyingReactionIndex++;
                    lastFlyingInteract = Date.now();
                    flyingCooldown = true;
                    setTimeout(() => { flyingCooldown = false; }, FLYING_COOLDOWN);
                }
            }

            (function flyingLoop() {
                checkFlyingProximity();
                requestAnimationFrame(flyingLoop);
            })();
        }

        // ── Interaction state (click + rotate, independent of flying) ─────
        let interactionStage = 0;
        let firstClickMsg = null;
        let firstRotateMsg = null;
        let lastInteractTime = 0;
        let secondMsgShownAt = 0; // timestamp when secondInteraction was displayed

        function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

        function handleInteraction(type) {
            const now = Date.now();
            if (now - lastInteractTime < INTERACT_COOLDOWN) return;
            lastInteractTime = now;

            // flying branch: if a flying message is showing, advance that convo only
            if (config.flyingReactions && messageVisible) {
                const currentFlyingMsg = config.flyingReactions[flyingReactionIndex - 1];
                if (flyingReactionIndex > 0 &&
                    bubbleText.textContent === currentFlyingMsg &&
                    flyingReactionIndex < config.flyingReactions.length) {
                    if (now - lastFlyingInteract < FLYING_INTERACT_COOLDOWN) return;
                    lastFlyingInteract = now;
                    showMessage(config.flyingReactions[flyingReactionIndex]);
                    flyingReactionIndex++;
                    return;
                }
            }

            if (interactionStage === 0) {
                // First ever interaction — pick and lock both messages, show the right one
                firstClickMsg = config.firstClick ? pick(config.firstClick) : null;
                firstRotateMsg = config.firstRotate ? pick(config.firstRotate) : null;
                const msg = type === 'rotate' ? firstRotateMsg : firstClickMsg;
                if (msg) showMessage(msg);
                interactionStage = 1;

            } else if (interactionStage === 1) {
                // While first message is still visible: do nothing (500ms cooldown already set)
                if (messageVisible) return;
                // First message gone — show second interaction
                if (config.secondInteraction) {
                    showMessage(pick(config.secondInteraction));
                    secondMsgShownAt = now;
                }
                interactionStage = 2;

            } else {
                // Stage 2+: locked for the full MSG_DURATION after secondInteraction appeared
                if (now - secondMsgShownAt < MSG_DURATION) return;
                const msg = type === 'rotate' ? firstRotateMsg : firstClickMsg;
                if (msg) showMessage(msg);
            }
        }

        // ── Torture mode ───────────────────────────────────────────────────
        // Activated by spam-clicking Perry. Messages are defined per-page via
        // window.perryTortureMessages (array of strings). If undefined or empty,
        // torture mode is not available on that page.
        const TORTURE_MESSAGES = (Array.isArray(window.perryTortureMessages) && window.perryTortureMessages.length)
            ? window.perryTortureMessages : null;
        const TORTURE_SPAM_COUNT = 5;   // clicks needed within the window
        const TORTURE_SPAM_WINDOW = 1500; // ms
        const TORTURE_CLICK_COOLDOWN = 500;

        let tortureMode = false;
        let tortureMsgIndex = 0;
        let lastTortureClick = 0;
        let spamClicks = [];

        function enterTortureMode() {
            tortureMode = true;
            tortureMsgIndex = 0;
            spamClicks = [];
            showMessage(TORTURE_MESSAGES[tortureMsgIndex]);
            tortureMsgIndex++;
        }

        function advanceTortureConvo() {
            if (tortureMsgIndex < TORTURE_MESSAGES.length) {
                showMessage(TORTURE_MESSAGES[tortureMsgIndex]);
                tortureMsgIndex++;
            } else {
                // Conversation finished — exit torture mode
                tortureMode = false;
                tortureMsgIndex = 0;
                bubble.style.display = 'none';
                messageVisible = false;
            }
        }

        // ── Click interaction ──────────────────────────────────────────────
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        renderer.domElement.addEventListener('click', (e) => {
            if (!model) return;
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            if (!raycaster.intersectObject(model, true).length) return;

            const now = Date.now();

            // ── If already in torture mode, advance convo ──────────────────
            if (tortureMode) {
                if (now - lastTortureClick < TORTURE_CLICK_COOLDOWN) return;
                lastTortureClick = now;
                advanceTortureConvo();
                return;
            }

            // ── Spam detection (only if torture messages exist for this page)
            if (TORTURE_MESSAGES) {
                spamClicks.push(now);
                spamClicks = spamClicks.filter(t => now - t < TORTURE_SPAM_WINDOW);
                if (spamClicks.length >= TORTURE_SPAM_COUNT) {
                    lastTortureClick = now;
                    enterTortureMode();
                    return;
                }
            }

            handleInteraction('click');
        });

        // ── Rotation interaction ───────────────────────────────────────────
        let lastAngle = controls.getAzimuthalAngle();
        const ROTATION_THRESHOLD = 0.4;

        function checkRotation() {
            const angle = controls.getAzimuthalAngle();
            if (Math.abs(angle - lastAngle) > ROTATION_THRESHOLD) {
                lastAngle = angle;
                handleInteraction('rotate');
            }
        }

        // ── Render loop ────────────────────────────────────────────────────
        function animate() {
            requestAnimationFrame(animate);
            controls.update();
            checkRotation();
            renderer.render(scene, camera);
        }
        animate();
    }

})();