// Magazine Title Flying Navigation System
// DVD screensaver-style bouncing with integrated spark transformation
// Self-contained: injects its own DOM element, color system, and listeners

// ─────────────────────────────────────────────
// COLOR SYSTEM
// ─────────────────────────────────────────────

const _colors = ['#ff3366', '#3366ff', '#33ff66', '#ff9933', '#9933ff', '#33ffff'];
let _colorIndex = 0;

function changeColor() {
    _colorIndex = (_colorIndex + 1) % _colors.length;
    document.documentElement.style.setProperty('--dynamic-color', _colors[_colorIndex]);
}

// Expose globally so other scripts (perry-lee, etc.) can call it
window.changeColor = changeColor;


// ─────────────────────────────────────────────
// MAGAZINE TITLE CLASS
// ─────────────────────────────────────────────

class MagazineTitle {
    constructor() {
        this._injectElement();

        this.element = document.querySelector('.magazine-title');
        this.x = 0;
        this.y = 0;
        this.dx = 1.5;
        this.dy = 1.5;
        this.animationId = null;
        this.isExpanded = false;
        this.originalContent = '';
        this._collapsedWidth = 0;
        this._collapsedHeight = 0;

        this.init();
    }

    _injectElement() {
        if (document.querySelector('.magazine-title')) return;

        // Inject base styles once
        if (!document.getElementById('magazine-title-styles')) {
            const style = document.createElement('style');
            style.id = 'magazine-title-styles';
            style.textContent = `
                .magazine-title {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-family: 'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif; ;
                    text-transform: uppercase;
                    letter-spacing: 0.2em;
                    opacity: 0.5;
                    z-index: 90;
                    transition: color 0.6s cubic-bezier(0.4, 0.0, 0.2, 1);
                    color: var(--dynamic-color);
                    pointer-events: none;
                    user-select: none;
                    line-height: 0.9;
                    text-align: center;
                    padding: 0.75rem 1.25rem;
                    border: 2px solid currentColor;
                    border-radius: 4px;
                    white-space: nowrap;
                }
                .magazine-title .title-main {
                    font-size: 2 rem;
                    font-weight: 500;
                    display: block;
                }
                .magazine-title .title-sub {
                    font-size: 0.75rem;
                    font-weight: 400;
                    letter-spacing: 0.3em;
                    display: block;
                    margin-top: 0.25rem;
                }
            `;
            document.head.appendChild(style);
        }

        const el = document.createElement('div');
        el.className = 'magazine-title';
        el.id = 'magazineTitle';
        el.innerHTML = '<span class="title-main">ANTITESI</span><span class="title-sub"></span>';
        document.body.appendChild(el);
    }

    init() {
        if (!this.element) return;

        this.originalContent = this.element.innerHTML;

        this.element.style.transform = 'none';
        this.element.style.cursor = 'pointer';
        this.element.style.pointerEvents = 'all';

        this.element.addEventListener('click', (e) => this.handleClick(e));
        this.element.addEventListener('touchend', (e) => this.handleClick(e));

        // Global click: change color on any click EXCEPT the magazine title itself
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#magazineTitle')) {
                changeColor();
            }
        });

        // Global keydown: change color on any key
        document.addEventListener('keydown', changeColor);

        document.fonts.ready.then(() => {
            setTimeout(() => {
                this.initializePosition();
                this.startAnimation();
            }, 0);
        });

        window.addEventListener('resize', () => this.handleResize());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isExpanded) {
                this.collapse();
            }
        });

        document.addEventListener('click', (e) => {
            if (this.isExpanded && !this.element.contains(e.target)) {
                this.collapse();
            }
        });
    }

    cacheCollapsedSize() {
        if (!this.isExpanded) {
            this._collapsedWidth = this.element.offsetWidth;
            this._collapsedHeight = this.element.offsetHeight;
        }
    }

    initializePosition() {
        const titleWidth = this.element.offsetWidth;
        const titleHeight = this.element.offsetHeight;

        this.cacheCollapsedSize();

        this.x = Math.random() * (window.innerWidth - titleWidth - 20) + 10;
        this.y = Math.random() * (window.innerHeight - titleHeight - 20) + 10;
        this.dx = 1.5;
        this.dy = 1.5;

        this.element.style.left = this.x + 'px';
        this.element.style.top = this.y + 'px';
    }

    animate() {
        if (window._sparkAway) {
            this.animationId = requestAnimationFrame(() => this.animate());
            return;
        }

        const titleWidth = this._collapsedWidth || this.element.offsetWidth;
        const titleHeight = this._collapsedHeight || this.element.offsetHeight;

        const baseSpeed = 1;
        const speedMultiplier = this.isExpanded ? 0.5 : 1.0;
        const actualSpeed = baseSpeed * speedMultiplier;

        this.x += this.dx * actualSpeed;
        this.y += this.dy * actualSpeed;

        if (this.x + titleWidth >= window.innerWidth || this.x <= 0) {
            this.dx = -this.dx;
            this.x = Math.max(0, Math.min(this.x, window.innerWidth - titleWidth));
            changeColor();
        }
        if (this.y + titleHeight >= window.innerHeight || this.y <= 0) {
            this.dy = -this.dy;
            this.y = Math.max(0, Math.min(this.y, window.innerHeight - titleHeight));
            changeColor();
        }

        this.element.style.left = this.x + 'px';
        this.element.style.top = this.y + 'px';

        // Expose position for perry-lee.js
        window.flyingMagazinePos = {
            x: this.x,
            y: this.y,
            w: this._collapsedWidth || this.element.offsetWidth,
            h: this._collapsedHeight || this.element.offsetHeight,
        };

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    handleClick(e) {
        e.preventDefault();
        e.stopPropagation();

        if (this.isExpanded) {
            this.collapse();
        } else {
            this.expand();
        }

        changeColor();
    }

    expand() {
        if (this.isExpanded) return;

        const oldW = this.element.offsetWidth;
        const oldH = this.element.offsetHeight;
        const centerX = this.x + oldW / 2;
        const centerY = this.y + oldH / 2;

        this.isExpanded = true;

        this.element.style.transition = 'background-color 0.3s, border-color 0.3s, opacity 0.3s, padding 0.3s, font-size 0.3s, transform 0.3s';

        this.element.innerHTML = `
            <div class="nav-item" data-action="archive" style="margin: 0.5rem 0; cursor: pointer; opacity: 1; transition: all 0.2s; font-size: 1.2rem; font-weight: 500; padding: 0.2rem 0.4rem; border-radius: 2px;">Archive</div>
            <div class="nav-item" data-action="colophon" style="margin: 0.5rem 0; cursor: pointer; opacity: 1; transition: all 0.2s; font-size: 1.2rem; font-weight: 500; padding: 0.2rem 0.4rem; border-radius: 2px;">Colophon</div>
        `;

        this.element.style.transform = 'scale(1.4)';
        this.element.style.transformOrigin = 'center';
        this.element.style.padding = '1rem 1rem';
        this.element.style.fontSize = '0.85rem';
        this.element.style.lineHeight = '1';
        this.element.style.letterSpacing = '0.08em';
        this.element.style.whiteSpace = 'nowrap';
        this.element.style.zIndex = '9999';

        const newW = this.element.offsetWidth;
        const newH = this.element.offsetHeight;
        this.x = centerX - newW / 2;
        this.y = centerY - newH / 2;

        this.addNavigationListeners();
    }

    collapse() {
        if (!this.isExpanded) return;

        const oldW = this.element.offsetWidth;
        const oldH = this.element.offsetHeight;
        const centerX = this.x + oldW / 2;
        const centerY = this.y + oldH / 2;

        this.isExpanded = false;

        this.element.innerHTML = this.originalContent;

        this.element.style.transform = 'none';
        this.element.style.padding = '0.75rem 1.25rem';
        this.element.style.fontSize = '';
        this.element.style.lineHeight = '0.9';
        this.element.style.letterSpacing = '0.2em';
        this.element.style.whiteSpace = 'nowrap';
        this.element.style.zIndex = '9999';

        const newW = this.element.offsetWidth;
        const newH = this.element.offsetHeight;
        this.x = centerX - newW / 2;
        this.y = centerY - newH / 2;

        setTimeout(() => {
            this.element.style.transition = '';
        }, 300);
    }

    addNavigationListeners() {
        const navItems = this.element.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('mouseenter', () => {
                item.style.opacity = '1';
                item.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                item.style.transform = 'translateX(4px)';
            });

            item.addEventListener('mouseleave', () => {
                item.style.opacity = '0.8';
                item.style.backgroundColor = 'transparent';
                item.style.transform = 'translateX(0)';
            });

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = item.getAttribute('data-action');
                this.handleNavAction(action);
            });
        });
    }

    handleNavAction(action) {
        this.collapse();

        setTimeout(() => {
            const currentPath = window.location.pathname;
            const segments = currentPath.split('/').filter(Boolean);
            const articlesIdx = segments.indexOf('articles');
            const levelsDeep = articlesIdx >= 0 ? segments.length - articlesIdx - 1 : 0;
            const prefix = '../'.repeat(levelsDeep);

            switch (action) {
                case 'archive':
                    window.location.href = prefix + 'archive';
                    break;
                case 'colophon':
                    window.location.href = prefix + 'colophon';
                    break;
            }
        }, 300);
    }

    startAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.animate();
    }

    handleResize() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        setTimeout(() => {
            this.initializePosition();
            this.startAnimation();
        }, 100);
    }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.magazineTitleInstance = new MagazineTitle();
    });
} else {
    window.magazineTitleInstance = new MagazineTitle();
}


// ─────────────────────────────────────────────
// SPARK INTEGRATION
// ─────────────────────────────────────────────

(function () {

    function injectSpark() {
        if (document.getElementById('spark-wrap')) return;
        const wrap = document.createElement('div');
        wrap.id = 'spark-wrap';
        wrap.innerHTML =
            '<div id="spark-core"></div>' +
            '<canvas id="spark-canvas"></canvas>' +
            '<div id="spark-label">ANTITESI</div>';
        wrap.addEventListener('click', sparkReturn);
        document.body.appendChild(wrap);
        initCanvas();
    }

    // Canvas star configuration
    const ARMS = [
        { angle: 0, len: 72, base: 1.3 },
        { angle: 180, len: 67, base: 1.2 },
        { angle: 90, len: 40, base: 0.95 },
        { angle: 270, len: 43, base: 1.0 },
        { angle: 42, len: 17, base: 0.55 },
        { angle: 222, len: 15, base: 0.5 },
        { angle: 138, len: 12, base: 0.42 },
        { angle: 318, len: 13, base: 0.45 },
    ];
    let _ctx, _phase = 0, _targetAlpha = 0, _currentAlpha = 0, _currentColor = null;

    function getCurrentMagazineColor() {
        const magTitle = document.querySelector('.magazine-title');
        if (!magTitle) return { r: 255, g: 51, b: 102 };

        const color = window.getComputedStyle(magTitle).color;
        const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
        }
        return { r: 255, g: 51, b: 102 };
    }

    function initCanvas() {
        const c = document.getElementById('spark-canvas');
        c.width = c.height = 180;
        _ctx = c.getContext('2d');
        animateStar();
    }

    function drawArm(arm, gA, pulse) {
        const cx = 90, cy = 90;
        const rad = (arm.angle - 90) * Math.PI / 180;
        const len = arm.len * pulse;
        const tip = { x: cx + Math.cos(rad) * len, y: cy + Math.sin(rad) * len };
        const perp = { x: -Math.sin(rad), y: Math.cos(rad) };
        const base = arm.base * Math.max(0.3, pulse);

        const c = _currentColor || getCurrentMagazineColor();
        const bright = { r: Math.min(255, c.r + 40), g: Math.min(255, c.g + 40), b: Math.min(255, c.b + 40) };
        const light = { r: Math.min(255, c.r + 80), g: Math.min(255, c.g + 80), b: Math.min(255, c.b + 80) };

        const g = _ctx.createLinearGradient(cx, cy, tip.x, tip.y);
        g.addColorStop(0, `rgba(${light.r},${light.g},${light.b},${0.55 * gA})`);
        g.addColorStop(0.35, `rgba(${bright.r},${bright.g},${bright.b},${0.38 * gA})`);
        g.addColorStop(0.7, `rgba(${c.r},${c.g},${c.b},${0.14 * gA})`);
        g.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
        _ctx.beginPath();
        _ctx.moveTo(tip.x, tip.y);
        _ctx.lineTo(cx + perp.x * base, cy + perp.y * base);
        _ctx.lineTo(cx - perp.x * base, cy - perp.y * base);
        _ctx.closePath();
        _ctx.fillStyle = g;
        _ctx.fill();
    }

    function animateStar() {
        if (!_ctx) { requestAnimationFrame(animateStar); return; }
        _ctx.clearRect(0, 0, 180, 180);
        _currentAlpha += (_targetAlpha - _currentAlpha) * 0.035;

        if (Math.floor(_phase * 100) % 60 === 0) {
            _currentColor = getCurrentMagazineColor();
        }

        if (_currentAlpha > 0.002) {
            const pulse = 0.75 + 0.25 * (Math.sin(_phase * 0.65) * 0.6 + Math.sin(_phase * 1.25 + 1.1) * 0.4);
            ARMS.forEach(arm => drawArm(arm, _currentAlpha, pulse));
            _phase += 0.010;
        }
        requestAnimationFrame(animateStar);
    }

    const SX = () => window.innerWidth * 0.15;
    const SY = () => window.innerHeight * 0.18;
    let _isAway = false;

    function showSpark() {
        const wrap = document.getElementById('spark-wrap');
        const core = document.getElementById('spark-core');

        _currentColor = getCurrentMagazineColor();

        const c = _currentColor;
        const brightCore = `rgba(${Math.min(255, c.r + 60)},${Math.min(255, c.g + 60)},${Math.min(255, c.b + 60)},0.9)`;
        core.style.background = brightCore;

        core.style.transform = core.style.opacity = core.style.transition = '';
        wrap.classList.remove('lit');
        wrap.classList.add('appearing');
        core.addEventListener('animationend', () => {
            wrap.classList.remove('appearing');
            wrap.classList.add('lit');
            _targetAlpha = 1;
        }, { once: true });
    }

    function hideSpark(cb) {
        const wrap = document.getElementById('spark-wrap');
        const core = document.getElementById('spark-core');
        _targetAlpha = 0;
        wrap.classList.remove('lit');
        core.style.transition = 'transform 0.6s ease, opacity 0.6s ease';
        core.style.transform = 'translate(-50%,-50%) scale(0)';
        core.style.opacity = '0';
        setTimeout(() => { core.style.transition = ''; if (cb) cb(); }, 650);
    }

    function sparkSendAway() {
        if (_isAway) return;

        const w = document.querySelector('.magazine-title');
        if (!w) return;

        _isAway = true;
        window._sparkAway = true;

        const rect = w.getBoundingClientRect();

        w.style.left = rect.left + 'px';
        w.style.top = rect.top + 'px';
        w.style.transformOrigin = 'center center';

        w.offsetHeight;

        requestAnimationFrame(() => {
            w.classList.add('traveling');
            w.style.transition = 'left 1.5s cubic-bezier(0.45, 0, 0.55, 1), top 1.5s cubic-bezier(0.45, 0, 0.55, 1), transform 1.5s cubic-bezier(0.45, 0, 0.55, 1)';
            w.style.left = (SX() - rect.width / 2) + 'px';
            w.style.top = (SY() - rect.height / 2) + 'px';
            w.style.transform = 'scale(0.05)';
        });

        w.addEventListener('transitionend', function h(e) {
            if (e.propertyName !== 'left') return;
            w.removeEventListener('transitionend', h);
            w.classList.remove('traveling');
            w.style.transition = 'none';
            w.style.opacity = '';
            w.classList.add('spark-gone');
            setTimeout(() => {
                showSpark();
            }, 50);
        });
    }

    function sparkReturn() {
        if (!_isAway) return;
        _isAway = false;
        hideSpark(() => {
            const w = document.querySelector('.magazine-title');
            if (!w) return;

            const newX = SX() - 60;
            const newY = SY() - 40;

            w.style.left = newX + 'px';
            w.style.top = newY + 'px';
            w.style.transform = 'scale(1)';
            w.style.opacity = '';
            w.style.transition = 'none';
            w.classList.remove('spark-gone');
            w.classList.remove('traveling');

            if (window.magazineTitleInstance) {
                window.magazineTitleInstance.x = newX;
                window.magazineTitleInstance.y = newY;
            }

            window._sparkAway = false;
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (window.magazineSparkMode === true) {
            injectSpark();
            function waitForMagazine(attempts = 0) {
                const magTitle = document.querySelector('.magazine-title');
                if (magTitle && magTitle.style.left && magTitle.style.top) {
                    setTimeout(sparkSendAway, 100);
                } else if (attempts < 10) {
                    setTimeout(() => waitForMagazine(attempts + 1), 200);
                }
            }
            setTimeout(() => waitForMagazine(), 100);
        }
    });

    window.sparkSendAway = sparkSendAway;
    window.sparkReturn = sparkReturn;

})();