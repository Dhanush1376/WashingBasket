# Washing Basket — Brand Identity & Visual Design Guidelines

| File | What it is |
|---|---|
| `Washing-Basket-Brand-Identity-Guidelines-v1.0.pdf` | Print/share master. A4 landscape, 68 pages, brand fonts embedded, bookmarked outline. |
| `Washing-Basket-Brand-Identity-Guidelines-v1.0.docx` | Editable Word edition, same content (70 pages, because Word reflows text). Brand fonts are embedded. |
| `MASTER-PROMPT.md` | Reusable brief for producing the same kind of book for any other brand. |
| `source/` | The generator that built both files. |

## Editing the Word edition
- **Editable as native Word content:** all text, headings, tables, colour swatches (cell shading and hex values), the contrast grid, type specimens and scale, the slip and timeline, and the checklists (real tick boxes).
- **TOC:** right-click → *Update Field* after you edit.
- **Placed images:** logos, construction drawings, illustrations, product screenshots and divider plates. Replace one with right-click → *Change Picture*.
- **Never redraw the logo.** It comes from `website/src/logoGeometry.ts` and `assets/brand/WashingBasket-logo.png`.

Edits made in Word do not flow back to the PDF. For a lasting change, edit `source/pages.js` and rebuild both files (see below), or export the edited .docx to PDF from Word.

## Rebuilding
Needs Node 18+, Python 3 with Pillow, Google Chrome, and Microsoft Word on Windows for the finishing pass.
```bash
cd assets/brand/guidelines/source && npm install
python prep.py img <folder-of-app-screenshots>   # optimised images → img/ (screenshots come from capture*.js)
node render.js                                   # pages.js → book.html
node print.js --figs --pdf                       # overflow check, figure renders, out/book.pdf
node docx.js                                     # out/book-raw.docx
powershell -File word-pass.ps1 out/book-raw.docx out/book-word.docx
python stripfonts.py out/book-word.docx out/Washing-Basket-Brand-Identity-Guidelines-v1.0.docx
```
`print.js` must report `no overflow` before you ship.

## Reusing for another brand
1. Audit that brand first (see `MASTER-PROMPT.md`). Nothing goes into the book that has not been found in its code or assets, unless it is labelled *Proposed*.
2. In `pages.js`, replace `META`, the colour data (`C`, `SHADES`, `NEUTRALS`, `SEMANTIC`, `pairs`), the type `scale`, and the page content. Keep the layouts and block types.
3. In `lib.js`, point the logo source at the new brand's official vector (or swap `logo()` to inline its SVG file), and update the lockup ratio.
4. In `book.css` and `docx.js`, swap the font families and the `fonts/` TTFs. Update the `KEEP` list in `stripfonts.py`.
5. Rebuild and check every page.
