// ─────────────────────────────────────────────────────────────
// Research Mode — keyword graph overlay
// Self-contained module. Depends on global `articles` (from
// articles-and-utils.js) and global `changeColor()` if present.
//
// Usage:
//   ResearchMode.init({ onArticleSelected: (article) => { ... } });
//   ResearchMode.enter();
//   ResearchMode.exit();
//   ResearchMode.toggle();
//   ResearchMode.isActive();
//
// The host page must contain the overlay markup:
//   <div class="research-mode-overlay" id="researchModeOverlay">
//     <canvas class="keyword-graph-canvas" id="keywordGraphCanvas"></canvas>
//   </div>
// ─────────────────────────────────────────────────────────────

(function () {
    'use strict';

    let isResearchMode = false;
    let isSelectionPanelOpen = false;
    let animationId = null;
    let keywordGraph = null;
    let onArticleSelected = null;

    class KeywordGraph {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;
            this.width = canvas.width / dpr;
            this.height = canvas.height / dpr;
            this.nodes = [];
            this.connections = [];
            this.mouse = { x: 0, y: 0 };

            canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
            canvas.addEventListener('click', (e) => this.onClick(e));

            // Mobile touch: treat tap as both hover + click
            canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const t = e.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                this.mouse.x = t.clientX - rect.left;
                this.mouse.y = t.clientY - rect.top;
                this.nodes.forEach(node => {
                    const dist = Math.hypot(this.mouse.x - node.x, this.mouse.y - node.y);
                    node.hovered = dist < node.radius + 10;
                    const scale = node._scale || 1;
                    const base = node._isMobile
                        ? (32 + (node.articles.length - 1) * 6) * Math.max(0.5, scale)
                        : 32 + (node.articles.length - 1) * 8;
                    node.targetRadius = node.hovered ? base + (node._isMobile ? 6 : 8) : base;
                });
            }, { passive: false });

            canvas.addEventListener('touchend', (e) => {
                e.preventDefault();
                const synth = {
                    clientX: this.mouse.x + this.canvas.getBoundingClientRect().left,
                    clientY: this.mouse.y + this.canvas.getBoundingClientRect().top
                };
                this.onClick(synth);
            }, { passive: false });

            this.setupKeywordData();
            this.animate();
        }

        setupKeywordData() {
            const keywordMap = new Map();

            articles.forEach(article => {
                article.keywords.forEach(keyword => {
                    if (!keywordMap.has(keyword)) {
                        const angle = Math.random() * Math.PI * 2;
                        const spawnR = Math.min(this.width, this.height) * (0.2 + Math.random() * 0.15);
                        keywordMap.set(keyword, {
                            keyword,
                            articles: [],
                            x: this.width / 2 + Math.cos(angle) * spawnR,
                            y: this.height / 2 + Math.sin(angle) * spawnR,
                            vx: (Math.random() - 0.5) * 0.2,
                            vy: (Math.random() - 0.5) * 0.2,
                            radius: 20,
                            targetRadius: 20,
                            hovered: false
                        });
                    }
                    keywordMap.get(keyword).articles.push(article);
                });
            });

            this.nodes = Array.from(keywordMap.values());

            const isMobile = window.innerWidth < 768;
            const scale = isMobile ? Math.min(this.width, this.height) / 700 : 1;
            this.nodes.forEach(node => {
                const r = isMobile
                    ? (42 + (node.articles.length - 1) * 6) * Math.max(0.5, scale)
                    : 32 + (node.articles.length - 1) * 8;
                node.radius = r;
                node.targetRadius = r;
                node._scale = scale;
                node._isMobile = isMobile;
            });

            this.connections = [];
            for (let i = 0; i < this.nodes.length; i++) {
                for (let j = i + 1; j < this.nodes.length; j++) {
                    const shared = this.nodes[i].articles.filter(a1 =>
                        this.nodes[j].articles.some(a2 => a2.id === a1.id)
                    );
                    if (shared.length > 0) {
                        this.connections.push({ from: this.nodes[i], to: this.nodes[j], strength: shared.length });
                    }
                }
            }
        }

        onMouseMove(e) {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
            this.nodes.forEach(node => {
                const dist = Math.hypot(this.mouse.x - node.x, this.mouse.y - node.y);
                node.hovered = dist < node.radius + 10;
                const scale = node._scale || 1;
                const base = node._isMobile
                    ? (22 + (node.articles.length - 1) * 6) * Math.max(0.5, scale)
                    : 32 + (node.articles.length - 1) * 8;
                node.targetRadius = node.hovered ? base + (node._isMobile ? 6 : 8) : base;
            });
        }

        onClick(e) {
            if (isSelectionPanelOpen) return;
            const rect = this.canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            const clickedNode = this.nodes.find(node =>
                Math.hypot(clickX - node.x, clickY - node.y) < node.radius + 15
            );
            if (clickedNode) {
                const matched = articles.filter(a => a.keywords.includes(clickedNode.keyword));
                if (matched.length === 1) {
                    exitResearchMode();
                    if (onArticleSelected) onArticleSelected(matched[0]);
                } else {
                    this.showArticleSelectionPanel(clickedNode, matched);
                }
                if (typeof changeColor === 'function') changeColor();
            }
        }

        showArticleSelectionPanel(node, articlesWithKeyword) {
            this.hideArticleSelectionPanel();
            isSelectionPanelOpen = true;
            const panel = document.createElement('div');
            panel.className = 'keyword-selection-panel';
            panel.id = 'keywordSelectionPanel';
            panel.style.left = (node.x + 60) + 'px';
            panel.style.top = (node.y - 40) + 'px';
            panel.innerHTML = `
                <div class="panel-close" data-action="close">×</div>
                <div class="panel-header">${node.keyword}</div>
                ${articlesWithKeyword.map(a =>
                    `<div class="panel-article" data-article-id="${a.id}">${a.title}</div>`
                ).join('')}
            `;

            // Delegated handlers (no inline onclick → no globals needed)
            panel.querySelector('[data-action="close"]').addEventListener('click', () => {
                this.hideArticleSelectionPanel();
            });
            panel.querySelectorAll('.panel-article').forEach(el => {
                el.addEventListener('click', () => {
                    const id = el.dataset.articleId;
                    const article = articles.find(a => a.id === id);
                    if (article) {
                        this.hideArticleSelectionPanel();
                        exitResearchMode();
                        if (onArticleSelected) onArticleSelected(article);
                    }
                });
            });

            document.getElementById('researchModeOverlay').appendChild(panel);
        }

        hideArticleSelectionPanel() {
            const p = document.getElementById('keywordSelectionPanel');
            if (p) p.remove();
            isSelectionPanelOpen = false;
        }

        update() {
            this.nodes.forEach(node => {
                let fx = 0, fy = 0;
                this.nodes.forEach(other => {
                    if (other !== node) {
                        const dx = node.x - other.x;
                        const dy = node.y - other.y;
                        const dist = Math.max(1, Math.hypot(dx, dy));
                        const repulsion = 800 / Math.max(1, dist * dist * 0.01);
                        fx += (dx / dist) * repulsion;
                        fy += (dy / dist) * repulsion;
                    }
                });
                this.connections.forEach(conn => {
                    if (conn.from === node || conn.to === node) {
                        const other = conn.from === node ? conn.to : conn.from;
                        const dx = other.x - node.x;
                        const dy = other.y - node.y;
                        const dist = Math.hypot(dx, dy);
                        if (dist > 0) {
                            const attraction = (dist - 120) * 0.05 * conn.strength;
                            fx += (dx / dist) * attraction;
                            fy += (dy / dist) * attraction;
                        }
                    }
                });
                const cx = this.width / 2, cy = this.height / 2;
                const cd = Math.hypot(cx - node.x, cy - node.y);
                if (cd > 0) {
                    const ca = cd * 0.0003;
                    fx += (cx - node.x) / cd * ca;
                    fy += (cy - node.y) / cd * ca;
                }
                node.vx = (node.vx + fx * 0.01) * 0.85;
                node.vy = (node.vy + fy * 0.01) * 0.85;
                node.x += node.vx;
                node.y += node.vy;
                const m = Math.min(60, this.width * 0.12) + node.radius;
                if (node.x < m) { node.x = m; node.vx *= -0.5; }
                if (node.x > this.width - m) { node.x = this.width - m; node.vx *= -0.5; }
                if (node.y < m) { node.y = m; node.vy *= -0.5; }
                if (node.y > this.height - m) { node.y = this.height - m; node.vy *= -0.5; }
                node.radius += (node.targetRadius - node.radius) * 0.15;
            });
        }

        draw() {
            this.ctx.clearRect(0, 0, this.width, this.height);
            const dark = document.body.classList.contains('dark-mode');
            this.connections.forEach(conn => {
                const opacity = Math.min(0.3, conn.strength * 0.15);
                this.ctx.strokeStyle = `rgba(${dark ? '255,255,255' : '0,0,0'}, ${opacity})`;
                this.ctx.lineWidth = Math.min(1.5, conn.strength * 0.8);
                this.ctx.beginPath();
                this.ctx.moveTo(conn.from.x, conn.from.y);
                this.ctx.lineTo(conn.to.x, conn.to.y);
                this.ctx.stroke();
            });
            this.nodes.forEach(node => {
                this.ctx.strokeStyle = node.hovered ? '#3366ff' : (dark ? '#fff' : '#000');
                this.ctx.lineWidth = node.hovered ? 2 : 1.5;
                this.ctx.beginPath();
                this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.fillStyle = dark ? '#fff' : '#000';
                const isMob = node._isMobile;
                const fs = isMob ? Math.max(9, Math.min(11, this.width * 0.026)) : 12;
                const fsH = isMob ? Math.max(10, Math.min(12, this.width * 0.030)) : 14;
                this.ctx.font = `${node.hovered ? fsH : fs}px "Crimson Pro", serif`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                const words = node.keyword.split(' ');
                if (words.length === 1) {
                    this.ctx.fillText(node.keyword, node.x, node.y);
                } else {
                    const lh = node.hovered ? fsH + 2 : fs + 2;
                    words.forEach((word, i) => {
                        this.ctx.fillText(word, node.x, node.y + (i - (words.length - 1) / 2) * lh);
                    });
                }
            });
            const hovered = this.nodes.find(n => n.hovered);
            if (hovered) {
                this.ctx.fillStyle = dark ? 'rgba(0,0,0,0.92)' : 'rgba(255,255,255,0.92)';
                this.ctx.fillRect(this.mouse.x + 15, this.mouse.y - 45, 180, 50);
                this.ctx.strokeStyle = dark ? '#333' : '#ddd';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(this.mouse.x + 15, this.mouse.y - 45, 180, 50);
                this.ctx.fillStyle = dark ? '#fff' : '#000';
                this.ctx.font = '13px "Inter", sans-serif';
                this.ctx.textAlign = 'left';
                this.ctx.fillText(hovered.keyword, this.mouse.x + 20, this.mouse.y - 30);
                this.ctx.font = '11px "Inter", sans-serif';
                this.ctx.fillStyle = dark ? '#ccc' : '#666';
                this.ctx.fillText(`${hovered.articles.length} article${hovered.articles.length > 1 ? 's' : ''}`, this.mouse.x + 20, this.mouse.y - 15);
            }
        }

        animate() {
            this.update();
            this.draw();
            animationId = requestAnimationFrame(() => this.animate());
        }
    }

    function enterResearchMode() {
        if (isResearchMode) return;
        isResearchMode = true;
        isSelectionPanelOpen = false;
        document.body.classList.add('research-mode');
        const overlay = document.getElementById('researchModeOverlay');
        overlay.classList.add('active');
        const canvas = document.getElementById('keywordGraphCanvas');
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        keywordGraph = new KeywordGraph(canvas);
        keywordGraph.ctx.scale(dpr, dpr);
        if (typeof changeColor === 'function') changeColor();
    }

    function exitResearchMode() {
        if (!isResearchMode) return;
        isResearchMode = false;
        document.body.classList.remove('research-mode');
        document.getElementById('researchModeOverlay').classList.remove('active');
        if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
        if (keywordGraph) keywordGraph.hideArticleSelectionPanel();
        isSelectionPanelOpen = false;
        keywordGraph = null;
    }

    // ── Public API ─────────────────────────────────────────
    window.ResearchMode = {
        init({ onArticleSelected: cb } = {}) {
            onArticleSelected = cb || null;
        },
        enter: enterResearchMode,
        exit: exitResearchMode,
        toggle() {
            if (isResearchMode) exitResearchMode();
            else enterResearchMode();
        },
        isActive() {
            return isResearchMode;
        }
    };
})();