// ==========================================
// DATABASE ANTITESI MAGAZINE (articles.js)
// ==========================================

const articles = [
    {
        id: "burnout-clarity",
        title: "Burnout clarity",
        author: "Michele Mazzocchi",
        writing_from: "Argentina",
        description: "On misreading, immune syntax, and the network logic of disease. A two-part investigation from Buenos Aires on what happens when biological systems speak.",
        filename: "burnout-clarity",
        folder: "mazzocchi",
        type: "narrative", // narrative or analytical
        sharpness: 0.45,
        colors: ["#1c8a28"],
        //takeonit: "specific", // specific or general
        //spread: 0.6,
        recommendationDesc: "An analytical piece exploring viral syntax and immune networks.",
        keywords: ["virology", "immunology", "buenos aires", "misreading", "dengue", "network theory", "syntax"],
        readTime: "10 min",
        publishDate: "January 2026",
        citations: ["William S. Burroughs/Language is a virus from outer space."]
    },
    {
        id: "road-to-nowhere",
        title: "Road to nowhere",
        author: "Olmo Notarianni",
        writing_from: "Italy",
        description: "When you don't know where you are nor where to go, but you have maps and a whole lotta love. A journey through concept drift detection across Europe and beyond.",
        filename: "road-to-nowhere",
        folder: "notarianni",
        type: "analytical", // narrative or analytical
        sharpness: 0.65,
        colors: ["#FF4D00"],
        //takeonit: "general", // specific or general
        //spread: 0.4,
        recommendationDesc: "A narrative journey about concept drift detection.",
        keywords: ["machine learning", "concept drift", "map", "signs", "distance", "random"],
        readTime: "10 min",
        publishDate: "February 2026",
        citations: []
    },
    {
        id: "weaving-my-rhapsody",
        title: "Weaving my rhapsody",
        author: "Matilde Filippi",
        writing_from: "Greece",
        description: "I wrap myself in this warm, embroidered cloak and for a few moments the little voice that endlessly asks “Was it the right choice?” falls silent.",
        filename: "weaving-rhapsody",
        folder: "filippi",
        type: "narrative", // narrative or analytical
        sharpness: 0.25,
        colors: ["#0000bf"],
        //takeonit: "specific", // specific or general
        //spread: 0.7,
        recommendationDesc: "The embroidery began. How easy it is to create a mythology of oneself.",
        keywords: ["embroidery", "symbol", "chance", "ῥαψῳδός", "WW2", "i hate france"],
        readTime: "10 min",
        publishDate: "March 2026",
        citations: []
    },
    {
        id: "Dont-miss-your-stop",
        title: "Don't miss your stop",
        author: "Lenny Stratas",
        writing_from: "Argentina",
        description: "Is physics intuition any different from aesthetic criteria? What do Dirac, Escher, and Lenny have in common? A scientific's hunt for beauty as method.",
        type: "analytical", // narrative or analytical
        sharpness: 0.6,
        colors: ["#129487"],
        //takeonit: "general", // specific or general
        //spread: 0.65,
        recommendationDesc: "Explore three histories through the infinite reflections of science and beauty as two opposite mirrors.",
        filename: "dont-miss-your-stop",
        folder: "stratas",
        keywords: ["science", "complex analysis", "physics", "beauty", "intuition"],
        readTime: "15 min",
        publishDate: "April 2026",
        citations: []
    },
    {
        id: "not-without-uttering",
        title: "…not without uttering a host of obscene words…",
        author: "Ianius Durrachiensis",
        writing_from: "United Kingdom",
        description: "A philologist locks himself in the Oxford Bodleian loo with a forbidden pen and writes Latin graffiti on the walls. An essay on obscenity and ancient inscriptions.",
        filename: "not-without-uttering",
        folder: "durrachiensis",
        type: "narrative", // narrative or analytical
        sharpness: 0.4,
        colors: ["#f10051"],
        //takeonit: "specific", // specific or general
        //spread: 0.7,
        recommendationDesc: "Forbidden pens, and the continuity between Pompeian walls and X.com.",
        keywords: ["pompeii", "graffiti", "romans", "philology", "obscene", "latrinalia"],
        readTime: "13 min",
        publishDate: "April 2026",
        citations: ["Marchese de Sade/…not without uttering a host of obscene words…", "Il Panormita/Hodus ait nostram vitam non esse pudicam: E scriptis mentem concipit ille meis", "Carl Jung/Knowledge rests not upon truth alone, but on error also"]
    },
    {
        id: "oltre-la-siepe",
        title: "Oltre la siepe",
        author: "Elena Bassani",
        writing_from: "Italy",
        description: "L'infinito di Leopardi offre l'occasione e lo spunto per riflettere sulla libertà e sul senso della vita.",
        filename: "oltre-la-siepe",
        folder: "bassani",
        type: "narrative", // narrative or analytical
        sharpness: 0.3,
        colors: ["#f10051", "#1ab741", "#4f7ba7"],
        //takeonit: "specific", // specific or general
        //spread: 0.7,
        recommendationDesc: "Riflessioni sulla libertà a partire dall'infinito di Leopardi.",
        keywords: ["choice", "direction", "freedom", "action", "Leopardi", "Maslow"],
        readTime: "10 min",
        publishDate: "May 2026",
        citations: ["Viktor Frankl/If I am not for others, what am I? And if not now, when?"]
    },
    {
        id: "moving-the-goalpost",
        title: "Moving the goalpost",
        author: "Oliverio Starosta",
        writing_from: "Argentina",
        description: "it's just one pendulum hanging of another, how bad can it be?",
        filename: "moving-the-goalpost",
        folder: "starosta",
        type: "analytical",
        sharpness: 0.75,
        colors: ["#ffee06"],
        //takeonit: "",
        //spread: ,
        recommendationDesc: "",
        keywords: ["physics", "approximation", "double pendulum", "chaos", "Taylor series", "perturbation theory"],
        readTime: "8 min",
        publishDate: "April 2026",
        citations: []
    },
    {
        id: "lil-mouse",
        title: "A lil mouse moving around the page",
        author: "Marquis",
        writing_from: "Netherlands",
        description: "",
        filename: "template_mouse",
        folder: "marquis",
        type: "narrative",
        sharpness: 0.4,
        colors: ["#c08a84"],
        //takeonit: "specific",
        //spread: 0.6,
        recommendationDesc: "",
        keywords: [],
        readTime: "2 min",
        publishDate: "April 2026",
        citations: []
    },
        
    {
        id: "zhourat",
        title: "Zhourat",
        author: "Suna Houssein Nasser",
        writing_from: "Italy",
        description: "",
        filename: "zhourat",
        folder: "nasser",
        type: "narrative",
        sharpness: 0.3,
        colors: ["#6d4962", "#889f72"],
        //takeonit: "specific",
        //spread: 0.6,
        recommendationDesc: "",
        keywords: [],
        readTime: "8 min",
        publishDate: "May 2026",
        citations: []
    },

    {
        id: "a-game-of-pretence",
        title: "A Game of Pretence",
        author: "Lorenzo Giovine",
        writing_from: "Italy",
        description: "",
        filename: "a-game-of-pretence",
        folder: "giovine",
        type: "analytical",
        sharpness: 0.8,
        colors: ["#a1f79b", "#0a005e"],
        //takeonit: "specific",
        //spread: 0.6,
        recommendationDesc: "",
        keywords: [],
        readTime: "9 min",
        publishDate: "May 2026",
        citations: []
    },
];

// ==========================================
// FUNZIONI GLOBALI (Disponibili per tutto il sito)
// ==========================================

// Questa funzione prende un articolo e costruisce l'URL corretto
function articlePath(article) {
    return `/articles/${article.folder}/${article.filename}`;
}