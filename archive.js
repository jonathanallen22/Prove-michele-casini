// --- archive.js ---

document.addEventListener("DOMContentLoaded", () => {
    // Peschiamo il contenitore dal nostro HTML
    const archiveSheet = document.getElementById('archiveSheet');
    
    // Controllo di sicurezza
    if (typeof articles === 'undefined') {
        console.error("Database articoli non trovato! Assicurati di caricare articles.js prima di archive.js");
        return;
    }

    // Cicliamo su tutti gli articoli del database e creiamo l'HTML
    archiveSheet.innerHTML = articles.map((article, i) => {
        
        // 1. GESTIONE IMMAGINE (Usa i placeholder finché non le metti nel database)
        const placeholders = [
            '1.png', '2.png', '3.png', '4.png', '5.png'
        ];
        const imgSrc = article.image ? article.image : placeholders[i % placeholders.length];

        // 2. GESTIONE ANNO (Estrae l'anno, es: da "January 2026" a "2026")
        const year = article.publishDate ? article.publishDate.split(' ').pop() : '';

        // 3. COSTRUZIONE DELLA RIGA
        return `
            <a href="${articlePath(article)}" class="archive-row" data-article-id="${article.id}">
                
                <div class="cell cell-title">
                    <span>${article.title}</span>
                </div>

                <div class="cell cell-author">
                    <span>${article.author || ''}</span>
                </div>

                <div class="cell cell-year">
                    <span>${year}</span>
                </div>

                <div class="cell cell-image">
                    <img src="${imgSrc}" alt="${article.title}">
                </div>

                <div class="cell cell-preview">
                    <span>${article.description || ''}</span>
                </div>

            </a>
        `;
    }).join(''); // Il join unisce tutte le righe in un unico blocco HTML

    // ==========================================
    // LOGICA FILTRI E LINEA DI COLLEGAMENTO
    // ==========================================
    
    const filterBoxes = document.querySelectorAll('.filter-box');
    const svgPath = document.getElementById('curvedPath');
    const filterSection = document.getElementById('filterSection');
    
    let activeFormat = null;
    let activeTopic = null;

    // Quando clicchi su un box...
    filterBoxes.forEach(box => {
        box.addEventListener('click', function() {
            const group = this.dataset.group;

            // 1. Togli lo stato 'active' agli altri box della stessa riga
            document.querySelectorAll(`.filter-box[data-group="${group}"]`).forEach(b => {
                if (b !== this) b.classList.remove('active');
            });

            // 2. Attiva/Disattiva questo box
            this.classList.toggle('active');

            // 3. Registra quale box è attivo in questo momento
            if (group === 'format') activeFormat = this.classList.contains('active') ? this : null;
            if (group === 'topic') activeTopic = this.classList.contains('active') ? this : null;

            // 4. Disegna la linea!
            drawConnection();
        });
    });

    // Funzione che calcola e disegna la linea curva
    function drawConnection() {
        // Se non ci sono due box attivi, cancella la linea e fermati
        if (!activeFormat || !activeTopic) {
            svgPath.setAttribute('d', '');
            return;
        }

        // Calcoliamo le posizioni relative alla sezione filtri
        const sectionRect = filterSection.getBoundingClientRect();
        const rect1 = activeFormat.getBoundingClientRect();
        const rect2 = activeTopic.getBoundingClientRect();

        // Punto di partenza (Centro-basso del bottone superiore)
        const startX = rect1.left + (rect1.width / 2) - sectionRect.left;
        const startY = rect1.bottom - sectionRect.top;

        // Punto di arrivo (Centro-alto del bottone inferiore, con piccolo offset per la freccia)
        const endX = rect2.left + (rect2.width / 2) - sectionRect.left;
        const endY = rect2.top - sectionRect.top - 3; 

        // Crea una curva di Bézier morbida a forma di S
        // (Il 40 e il -40 determinano la curvatura, se vuoi una linea più tesa abbassali)
        const pathData = `M ${startX} ${startY} C ${startX} ${startY + 40}, ${endX} ${endY - 40}, ${endX} ${endY}`;
        
        svgPath.setAttribute('d', pathData);
    }

    // Se l'utente ridimensiona la finestra, ricalcola la linea per non farla sfasare!
    window.addEventListener('resize', drawConnection);
});