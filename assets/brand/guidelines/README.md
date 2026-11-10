# Washing Basket — Brand Identity & Visual Design Guidelines

| File | What it is |
|---|---|
| `Washing-Basket-Brand-Identity-Guidelines-v1.0.pdf` | The book. A4 landscape, 66 pages, brand fonts embedded, bookmarked outline. |
| `MASTER-PROMPT.md` | Reusable brief for producing the same kind of book for any other brand. |
| `source/` | The generator that builds the PDF. |

## Editing
Change content in `source/pages.js` (and styles in `source/book.css`), then rebuild. Converting the PDF to Word reflows the layout and breaks it, so edit the source instead. A Word edition can still be made if ever needed: see `docx-live.js` below.

## Artwork
Supplied artwork lives in `source/img/`:

| File | Where |
|---|---|
| `div-01.jpg` | Section 01 divider: hand-over of the laundry bag |
| `div-03.jpg` | Section 03 divider: folded stacks in orange, red and navy |
| `div-05.jpg` | Section 05 divider: care partner at the washing line |
| `div-08.jpg` | Section 08 divider: hands holding the app |
| `div-10.jpg` | Section 10 divider: flat lay of bag, tag, slip and tote |
| `sheet-bag.jpg`, `sheet-tote.jpg` | Page 60, laundry bag and return tote product renders |
| `app-icon.png`, `app-icon-fg.png` | Page 22, the new mobile app icon |

`fitimg.py` fits each original into the divider panel (141 × 210 mm) without cropping anything. It does this by extending the picture's own background colour with a soft edge, and the divider page uses that same colour.

Four photographs are still placeholders on the Photography page, each with its brief in a dashed box: `photo-counter-handover`, `photo-folded-order`, `photo-care-detail` and `photo-ready-shelf` (3000 × 2000 px). Add them to `source/img/`, swap the photo figure in `pages.js` for an image grid, and rebuild.

## App icon
`icons.js` builds the mobile app icons from the mark's own vector (`website/src/logoGeometry.ts`). These replace the Expo template in `mobile/assets/`: `icon.png`, the `android-icon-*` layers, `splash-icon.png` and `favicon.png`. Run it as `node icons.js ../../../../mobile/assets`, then turn the monochrome layer's luminance into alpha.

## Typography decision (v1.0)
The book uses **Inter** for all display and text, and **Courier Prime** for slips. The **wordmark is outlined artwork** (`source/wordmark.json`, made by `wordmark.py` from the website's `.brand-title` setting), so it never depends on a font. Website and admin code still load Plus Jakarta Sans for headings, and finding 04 in the book records the migration.

## Rebuilding
Needs Node 18+, Python 3 with Pillow, Google Chrome, and Microsoft Word only for the optional Word edition.
```bash
cd assets/brand/guidelines/source && npm install
python prep.py img <folder-of-app-screenshots>   # optimised images → img/ (screenshots come from capture*.js)
node render.js                                   # pages.js → book.html
node print.js --figs --pdf                       # overflow check, figure renders, out/book.pdf
# optional Word edition: node extract.js && node docx-live.js  → out/book-live.docx
```
`print.js` must report `no overflow` before you ship.

## Reusing for another brand
1. Audit that brand first (see `MASTER-PROMPT.md`). Nothing goes into the book that has not been found in its code or assets, unless it is labelled *Proposed*.
2. In `pages.js`, replace `META`, the colour data (`C`, `SHADES`, `NEUTRALS`, `SEMANTIC`, `pairs`), the type `scale`, and the page content. Keep the layouts and block types.
3. In `lib.js`, point the logo source at the new brand's official vector (or swap `logo()` to inline its SVG file), and update the lockup ratio.
4. In `book.css`, swap the font families and the `fonts/` TTFs.
5. Rebuild and check every page.
