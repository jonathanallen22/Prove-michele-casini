// --- LOGICA DROPDOWN ALGORITMO ---
document.getElementById('linesInfoToggle').addEventListener('click', function(e) {
    e.stopPropagation(); // Previene che il click interferisca col canvas
    const dropdown = document.getElementById('algorithmDropdown');
    dropdown.classList.toggle('open');
});

// --- LOGICA CANVAS "DRAW A LINE" ---
(function initHeroCanvas() {
    const drawCanvas = document.getElementById('drawingCanvas');
    const drawCtx = drawCanvas.getContext('2d');
    let isDrawing = false, lastPoint = null, points = [];

    function resizeCanvas() {
        if (drawCanvas.classList.contains('shrunk')) return;
        drawCanvas.width = window.innerWidth;
        drawCanvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function analyzeSharpness(pts) {
        if (pts.length < 5) return 0;
        let totalLen = 0; const segs = [];
        for (let i = 1; i < pts.length; i++) {
            const d = Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y);
            segs.push(d); totalLen += d;
        }
        if (totalLen < 40) return 0;
        const N = Math.min(200, Math.max(30, Math.floor(totalLen / 5)));
        const step = totalLen / (N - 1);
        const rs = [pts[0]]; let acc = 0, j = 1;
        for (let i = 1; i < N - 1; i++) {
            const target = i * step;
            while (j < pts.length && acc + segs[j-1] < target) { acc += segs[j-1]; j++; }
            if (j >= pts.length) break;
            const t = (target - acc) / segs[j-1];
            rs.push({ x: pts[j-1].x + t * (pts[j].x - pts[j-1].x), y: pts[j-1].y + t * (pts[j].y - pts[j-1].y) });
        }
        rs.push(pts[pts.length - 1]);
        const sm = rs.map((p, i) => {
            if (i === 0 || i === rs.length - 1) return p;
            const a = rs[i-1], b = rs[i], c = rs[i+1];
            const xs = [a.x, b.x, c.x].sort((u, v) => u - v);
            const ys = [a.y, b.y, c.y].sort((u, v) => u - v);
            return { x: xs[1], y: ys[1] };
        });
        const W = 4; const angles = [];
        for (let i = W; i < sm.length - W; i++) {
            const ax = sm[i].x - sm[i-W].x, ay = sm[i].y - sm[i-W].y;
            const bx = sm[i+W].x - sm[i].x, by = sm[i+W].y - sm[i].y;
            const mag = Math.hypot(ax, ay) * Math.hypot(bx, by);
            if (mag < 1e-10) { angles.push(0); continue; }
            const cos = Math.max(-1, Math.min(1, (ax*bx + ay*by) / mag));
            angles.push(Math.acos(cos));
        }
        if (!angles.length) return 0;
        const cum = [0];
        for (let i = 1; i < sm.length; i++) { cum.push(cum[i-1] + Math.hypot(sm[i].x - sm[i-1].x, sm[i].y - sm[i-1].y)); }
        const L = cum[cum.length - 1];
        function maxAngleInArc(start, end) {
            let maxA = 0;
            for (let k = 0; k < angles.length; k++) {
                const arc = cum[k + W];
                if (arc >= start && arc <= end && angles[k] > maxA) { maxA = angles[k]; }
            }
            return maxA;
        }
        const nMain = Math.max(1, Math.ceil(L / 192));
        const mainLen = L / nMain;
        const windows = [];
        for (let i = 0; i < nMain; i++) { windows.push([i * mainLen, (i + 1) * mainLen]); }
        for (let i = 1; i < nMain; i++) {
            const c = i * mainLen; const half = mainLen / 2;
            windows.push([Math.max(0, c - half), Math.min(L, c + half)]);
        }
        const maxes = windows.map(([s, e]) => maxAngleInArc(s, e));
        const mean = maxes.reduce((s, v) => s + v, 0) / maxes.length;
        return Math.min(1, mean / Math.PI);
    }

    function analyzeDrawing() {
        if (typeof articles === 'undefined' || !articles.length) return;
        const sharpness = analyzeSharpness(points);
        const wSharp = 1.0; 

        function dist(dS) { return Math.sqrt(wSharp * dS * dS); }

        const best = articles.reduce((prev, curr) => {
            const dSharpPrev = (prev.sharpness ?? 0.5) - sharpness;
            const dSharpCurr = (curr.sharpness ?? 0.5) - sharpness;
            return dist(dSharpCurr) < dist(dSharpPrev) ? curr : prev;
        });

        document.querySelector('.prompt-text').textContent = "Nice line";
        
        const sharpStyle = sharpness > 0.5 ? 'analytical thinking' : 'narrative flow';
        document.getElementById('recText').innerHTML =
            `Your line suggests a preference for ${sharpStyle}. Recommended article: ` +
            `<a href="${articlePath(best)}" style="color:inherit;text-decoration:none;border-bottom:1px solid #000;">"${best.title}"</a>`;
        
        let minX = points[0].x, maxX = points[0].x, minY = points[0].y, maxY = points[0].y;
        for (let p of points) {
            if(p.x < minX) minX = p.x;
            if(p.x > maxX) maxX = p.x;
            if(p.y < minY) minY = p.y;
            if(p.y > maxY) maxY = p.y;
        }
        
        let drawCX = (minX + maxX) / 2;
        let drawCY = (minY + maxY) / 2;

        let targetCX = window.innerWidth / 2;
        let targetCY = window.innerHeight * 0.25; 

        let dx = targetCX - drawCX;
        let dy = targetCY - drawCY;

        drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        
        const isDark = document.body.classList.contains('dark-mode');
        drawCtx.strokeStyle = isDark ? '#ffffff' : '#000000';
        drawCtx.lineWidth = 3;
        drawCtx.lineCap = 'round';
        drawCtx.beginPath();
        drawCtx.moveTo(points[0].x + dx, points[0].y + dy);
        for (let i = 1; i < points.length; i++) {
            drawCtx.lineTo(points[i].x + dx, points[i].y + dy);
        }
        drawCtx.stroke();

        document.querySelector('.hero-canvas-section').classList.add('shrunk');
        document.getElementById('drawingCanvas').classList.add('shrunk');
        document.getElementById('articleRec').classList.add('visible');
    }

    function startDraw(x, y) {
        if (y < 130) return; // Zona di sicurezza titoli

        if (drawCanvas.classList.contains('shrunk')) {
            document.querySelector('.hero-canvas-section').classList.remove('shrunk', 'scrolled'); // Puliamo entrambe le classi
            drawCanvas.classList.remove('shrunk');
            document.querySelector('.prompt-text').textContent = "draw a line";
        }

        document.querySelector('.hero-canvas-section').classList.add('drawing');

        drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        document.getElementById('articleRec').classList.remove('visible');
        isDrawing = true;
        lastPoint = {x, y};
        points = [lastPoint];
    }

    function moveDraw(x, y) {
        if (!isDrawing) return;
        const isDark = document.body.classList.contains('dark-mode');
        drawCtx.strokeStyle = isDark ? '#ffffff' : '#000000';
        drawCtx.lineWidth = 3;
        drawCtx.lineCap = 'round';
        drawCtx.beginPath();
        drawCtx.moveTo(lastPoint.x, lastPoint.y);
        drawCtx.lineTo(x, y);
        drawCtx.stroke();
        points.push({x, y});
        lastPoint = {x, y};
    }

    function endDraw() {
        if (isDrawing && points.length > 5) {
            analyzeDrawing();
        }
        
        isDrawing = false;
        document.querySelector('.hero-canvas-section').classList.remove('drawing');
    }

    drawCanvas.addEventListener('mousedown', e => {
        if (e.target.closest('.center-prompt') || e.target.closest('.header-titles') || e.target.closest('.nav-minimal')) return;
        startDraw(e.clientX, e.clientY);
    });
    drawCanvas.addEventListener('mousemove', e => moveDraw(e.clientX, e.clientY));
    drawCanvas.addEventListener('mouseup', endDraw);
    
    drawCanvas.addEventListener('touchstart', e => { 
        if (e.target.closest('.center-prompt') || e.target.closest('.header-titles') || e.target.closest('.nav-minimal')) return;
        e.preventDefault(); 
        startDraw(e.touches[0].clientX, e.touches[0].clientY); 
    });
    drawCanvas.addEventListener('touchmove', e => { 
        if(isDrawing) { e.preventDefault(); moveDraw(e.touches[0].clientX, e.touches[0].clientY); }
    });
    drawCanvas.addEventListener('touchend', endDraw);
})();


// --- LOGICA ARCHIVIO ---
let currentFilter = { view: 'timeline' };

function initializeArchive() {
    if (typeof articles === 'undefined') { console.warn('Articles data not loaded'); return; }
    calculateStatistics();
    renderArticles();
}
window.addEventListener('load', initializeArchive);

function calculateStatistics() {
    animateCounter('totalArticles', articles.length);
    animateCounter('totalHours', 0);
}

function animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    const duration = 1000;
    const startTime = performance.now();
    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        element.textContent = Math.floor(targetValue * easedProgress);
        if (progress < 1) requestAnimationFrame(updateCounter);
    }
    requestAnimationFrame(updateCounter);
}

function setViewMode(mode) {
    currentFilter.view = mode;
    document.querySelectorAll('[data-view]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === mode);
    });
    const grid = document.getElementById('archiveGrid');
    grid.classList.add('is-switching');
    setTimeout(() => {
        renderArticles();
        grid.classList.remove('is-switching');
    }, 200);
}

function parseDate(dateString) {
    if (dateString === 'random') return new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28));
    const months = { 'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5, 'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11 };
    const parts = dateString.toLowerCase().split(' ');
    return new Date(parseInt(parts[1]) || 2025, months[parts[0]] || 0, 1);
}

function getFilteredAndSortedArticles() {
    return [...articles].sort((a, b) => {
        if (currentFilter.view === 'timeline') return parseDate(b.publishDate) - parseDate(a.publishDate);
        return a.author.localeCompare(b.author);
    });
}

function renderArticles() {
    const archiveGrid = document.getElementById('archiveGrid');
    const sorted = getFilteredAndSortedArticles();
    
    archiveGrid.innerHTML = sorted.map((article, i) => {
        const placeholders = [
            'https://img.magnific.com/premium-vector/png-files-transparent-vector-background-png-background_302321-1276.jpg'
        ];
        const imgSrc = placeholders[i % placeholders.length];
        const pickLabel = i === 0 ? `<div class="editor-pick-outside">Our pick for you &darr;</div>` : '';

        return `
            <a class="article-entry" href="/articles/${article.folder}/${article.filename}" data-article-id="${article.id}" style="--i: ${i}">
                ${pickLabel}
                <div class="card-inner">
                    <div class="card-text-col">
                        <div class="title-wrapper">
                            <h2 class="block-title">${article.title}</h2>
                        </div>
                        
                        <div class="card-lower-text">
                            <div class="block-meta">
                                <span class="block-author">${article.author || ''}</span>
                                <span class="block-readtime"># ${String(i).padStart(3, '0')}</span>
                            </div>
                            <div class="description-wrapper">
                                <div class="block-description">${article.description || 'Lorem ipsum dolor sit amet consectetur...'}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card-img-col">
                        <img src="${imgSrc}" alt="${article.title}">
                    </div>
                </div>
            </a>`;
    }).join('');
}

function attachTilt(el) {
    el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width  - 0.5;
        const y = (e.clientY - r.top)  / r.height - 0.5;
        el.style.transition = 'transform 0.05s linear, box-shadow 0.4s ease';
        el.style.transform = `perspective(600px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateZ(8px)`;
        el.style.boxShadow = `${-x * 20}px ${-y * 20}px 40px rgba(0,0,0,0.2)`;
    });
    el.addEventListener('mouseleave', () => {
        el.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.5s ease';
        el.style.transform = '';
        el.style.boxShadow = '';
    });
}

window.addEventListener('scroll', () => { document.body.classList.add('has-scrolled'); }, { passive: true, once: true });

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderArticles, 200);
});

if(typeof ResearchMode !== 'undefined') {
    ResearchMode.init({ onArticleSelected: highlightAndScrollToArticle });
}

function highlightAndScrollToArticle(targetArticle) {
    document.querySelectorAll('.article-entry').forEach(e => e.classList.remove('highlighted'));
    const el = document.querySelector(`[data-article-id="${targetArticle.id}"]`);
    if (el) {
        el.classList.add('highlighted');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => el.classList.remove('highlighted'), 3000);
    }
}

let _thesisTaps = 0, _thesisTapTimer;
document.querySelector('.thesis-statement').addEventListener('click', () => {
    _thesisTaps++;
    clearTimeout(_thesisTapTimer);
    if (_thesisTaps >= 3) { 
        _thesisTaps = 0;
        window.location.href = 'konami_page';
        return;
    }
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
    _thesisTapTimer = setTimeout(() => { _thesisTaps = 0; }, 600);
});

// --- PERRY LEE INTEGRATION ---

// 1. Dichiariamo la funzione in modo chiaro e visibile a tutti
function initPerryLee() {
    console.log("Inizializzazione Perry avviata. isDesktop:", window.isDesktop);
    
    // Mobile Intro
    if (!window.isDesktop && sessionStorage.getItem('perryIntroSeen') !== 'true') {
        const introScript = document.createElement('script');
        introScript.type = 'module';
        introScript.src = 'js/perry-lee-intro.js';
        document.body.appendChild(introScript);
    }

    // Desktop Character
    if (window.isDesktop) {
        window.perryTortureMessages = [
            "…okay. Fine. You want a secret.",
            "There is one, you know?",
            "It's not something you click.",
            "It's a sequence. Directions first...",
            "...then a couple of letters.",
            "Trying to make me tell you, aren't you.",
            "Fine. I'll give you a hint.",
            "Just... type\n↑↑ ↓↓ ← → ← → b a.",
            "I probably shouldn't have said that.",
            "Too late now.",
            "Gamers knew it for decades anyway…"
        ];

        // Creiamo e carichiamo lo script di Perry
        const script = document.createElement('script');
        script.type = 'module';
        // Aggiungiamo un parametro casuale così il browser è costretto a scaricare il file aggiornato!
        script.src = 'js/perry-lee.js?v=' + new Date().getTime();
        document.body.appendChild(script);
    }
}


// Avvia l'inizializzazione SOLO quando la pagina è pronta
window.addEventListener('DOMContentLoaded', initPerryLee);

// --- LOGICA HAMBURGER MENU ---
document.getElementById('hamburgerBtn').addEventListener('click', function() {
    // Aggiunge o toglie la classe "open" al bottone (per fare la X)
    this.classList.toggle('open');
    // Aggiunge o toglie la classe "open" all'overlay (per mostrarlo/nasconderlo)
    document.getElementById('hamburgerOverlay').classList.toggle('open');
});
// --- ANIMAZIONE AL PRIMO SCROLL ---
let isAnimatingLayout = false; // Una "guardia" per sapere se l'animazione è in corso

window.addEventListener('scroll', function() {
    const hero = document.querySelector('.hero-canvas-section');
    const canvas = document.getElementById('drawingCanvas');
    
    // Se scorri, la sezione non è rimpicciolita, e non stiamo già animando...
    if (window.scrollY > 10 && !hero.classList.contains('shrunk') && !isAnimatingLayout) {
        
        isAnimatingLayout = true; // Alziamo la paletta di stop
        
        // 1. Blocca fisicamente la rotellina nascondendo l'overflow
        document.body.style.overflow = 'hidden';
        
        // 2. Riporta la visuale al pixel zero
        window.scrollTo(0, 0);
        
        // 3. Fai partire la magia
        hero.classList.add('shrunk', 'scrolled'); // Aggiungiamo anche scrolled!
        if (canvas) canvas.classList.add('shrunk');
        
        const wheelWrap = document.getElementById('colorWheelWrap');
        if (wheelWrap) wheelWrap.classList.remove('open');
        
        // 4. Aspetta esattamente 1 secondo (la durata del tuo CSS) 
        // e poi ridai all'utente il controllo della pagina!
        setTimeout(() => {
            document.body.style.overflow = ''; // Sblocca lo scroll
            isAnimatingLayout = false; // Abbassa la paletta
        }, 1000); 
    }
});
