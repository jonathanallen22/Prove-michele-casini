# Publishing a New Article on Antitesi Magazine

Two sections: one for collecting material from authors, one for editors doing the technical work.

---

## Part 1 — What to collect from the author



### Author intake checklist

Title, text, multimedia, but also...
- **Short description** — 2–3 sentences. This appears e.g. on the archive. Should describe what the piece is about without being an abstract.
- **One-line recommendation blurb** — even shorter than the description. One sentence max. Used inside the drawing widget ("Recommended for you: ..."). Example: *"A narrative journey about concept drift detection."*
- **4–5 keywords** used in the archive's Research mode.
- **A citation** (optional) — one quote they love, related to the piece or their research.  
- **A related song or album** (optional) — something that accompanied their work, or fits the mood of the piece. This goes into the Explore playlist.

### Fields we can assign ourselves but nice to ask 

- **`softness`** — a float between 0 and 1. This powers the drawing recommendation on Explore: smooth curves → high softness, sharp angles → low softness. Think of it as: how lyrical and flowing is this piece? `0.3` = very narrative/lyrical; `0.7` = more analytical/structural. Just guess. **TODO: we are calling it softness but it is related to the curvature... we have to decide on this**
- **`readTime`** — estimate after reading the final HTML. Rough rule: 200 words/minute plus time for any interactive elements.
- **`publishDate`**

---

## Part 2 — Technical publishing steps

### Step 1 — Add the article to the database

Open `js/articles-and-utils.js` and add a new entry to the `articles` array. Copy an existing one as a starting point:

```js
{
    id: "your-slug",
    title: "Article Title",
    author: "First Last",
    description: "2–3 sentence description for the archive and recommendation widget.",
    filename: "your-slug.html",
    folder: "lastname",         
    type: "narrative",          // "narrative" or "analytical"
    softness: 0.5,              // 0.0 (lyrical) → 1.0 (analytical)
    recommendationDesc: "One sentence for the drawing widget recommendation.",
    keywords: ["keyword one", "keyword two", "keyword three"],
    readTime: "X min",
    publishDate: "Month Year",
    citations: ["Author Name/Quote text without quotation marks"]
                                // Empty array [] if no citation
},
```

This single entry automatically makes the article appear in:
- The **archive** (timeline and author view)
- The **Explore** toolbar article list
- The **drawing recommendation** widget
- The **keyboard `A` shortcut** (cycles through articles in order)
- The **keyword network** (press R on archive)


### Step 2 — Create the HTML file

Copy `article-template.html` into the `articles/author/` subdirectory and rename it to match the `filename` field you set above.

```
articles/lastname/
  your-slug.html   ← your new file
```

Then edit the template. Every place you need to change is marked with `<!-- EDIT -->` or a comment. The main things:

1. **`<title>`** tag — format: `Article Title - Author Name | Antitesi Magazine`
2. **`--dynamic-color`** in `:root` — pick an accent color for this article. Each article should feel visually distinct. The color affects links, the progress bar, the references section border, and any element using `var(--dynamic-color)`.

The IIFE script block (the one that reads `const filename = window.location.pathname...`) populates the author and metadata from `js/articles-and-utils.js` automatically. Don't touch it.

### Step 3 — Add optional libraries

The template has Leaflet and MathJax commented out. Uncomment what you need, delete what you don't.

If the article has **custom interactive elements** (games, simulations, etc.), these can be add as separate files in the articles/author/ folder

### Step 4 — Add images and multimedia

Images go in `multimedia/images/` (or a subfolder). Reference them with paths relative to the article file:

```html
<img src="../../multimedia/images/your-image.jpg" alt="Caption">
```

### Step 5 — Add the song to the Explore playlist

Ask M. 

### Step 6 — Test locally

```bash
bash server.sh
```

Then open `http://localhost:8000` and check:

- [ ] Article loads at `http://localhost:8000/articles/lastname_your-slug.html`
- [ ] Author name and metadata appear correctly in the header 
- [ ] Color looks right in light and dark mode
- [ ] Article appears in the archive (`archive.html`)
- [ ] Article appears in the Explore toolbar article list
- [ ] Pressing `A` from any page eventually cycles to the new article
- [ ] Mobile layout is readable (resize browser or use DevTools)

### Step 7 — Commit and push

```bash
git add articles/lastname_your-slug.html js/articles-and-utils.js
git add multimedia/images/   # if you added images
git commit -m "publish: Article Title by Author Name"
git push
```

---

## Quick reference — article metadata fields

| Field | Type | Example | Notes |
|---|---|---|---|
| `id` | string | `"road-to-nowhere"` | Slug, no spaces |
| `title` | string | `"Road to nowhere"` | As it appears in the byline |
| `author` | string | `"Olmo Notarianni"` | Full name |
| `description` | string | `"When you don't know..."` | 2–3 sentences |
| `filename` | string | `"road-to-nowhere.html"` | Must match actual file |
| `type` | string | `"narrative"` | `"narrative"` or `"analytical"` |
| `softness` | float | `0.7` | 0 = lyrical, 1 = analytical |
| `recommendationDesc` | string | `"A narrative journey..."` | One sentence |
| `keywords` | array | `["maps", "drift"]` | 4–5 lowercase strings |
| `readTime` | string | `"12 min"` | Estimate after final read |
| `publishDate` | string | `"February 2025"` | Month + year |
| `citations` | array | `["Author/Quote"]` | `[]` if none |