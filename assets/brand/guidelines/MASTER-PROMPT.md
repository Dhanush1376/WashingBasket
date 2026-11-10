# Master Prompt: Brand Identity & Visual Design Guidelines Book

Reusable brief. Fill in the **Brand inputs** section, then give the whole file to Claude Code from inside the brand's repository. The Washing Basket v1.0 book in this folder is the reference output, and `source/` is the generator to adapt.

---

## Brand inputs (replace for each brand)
- **Brand name:**
- **Repositories / folders to audit:** (website, app, admin, marketing, `assets/`)
- **Approved logo files:** (vector source first, then PNG)
- **Known decisions already made:** (colours, fonts or taglines the owner has signed off)
- **Audience and markets:**
- **Version / date / owner:**

## Non-negotiable rules
1. **Audit before writing.** Read the real code, design tokens, CSS, theme files, fonts, logo geometry, illustrations, photography and running UI, and take screenshots of each surface. Every claim in the book must trace back to a file or a screenshot.
2. **Never replace, redraw or "improve" the approved logo.** Render it from the official source only. Construction notes describe the logo as it is. Any meaning attributed to the logo needs evidence, or it is labelled *Proposed*.
3. **Never invent official colours or fonts.** Official values are only the ones found in code or assets. Tints, contrast pairings and print conversions are derived from those values and marked as derived. Print values (CMYK/Pantone) are marked *to be proofed*.
4. **Label everything** *Verified* (found in the codebase), *Proposed* (recommended, not yet adopted), *Rule* (do or don't) or *Finding* (an inconsistency from the audit, with a fix).
5. **Keep the brand's personality**, and write in the brand's own voice.
6. **Images must fit exactly or not appear.** Never crop artwork through a person or object. Show illustrations whole, and screenshots whole inside a real device or browser frame. When no existing asset fits, insert a placeholder that carries the full generation brief (subject, style, background colour, framing, file name, pixel size).
7. **Typography follows the owner's decision**, even where the code differs. Record the gap as a finding. Treat the wordmark as outlined artwork, never as retyped text.
8. **Generous spacing.** Body line-height of at least 1.6, headings at least 1.15, no negative tracking tighter than −0.02 em.
9. **No filler.** Each page earns its place with a real figure, rule or decision. Target 35–70 A4-landscape pages.

## Contents (in this order)
Cover · Document info / version · Contents · How to use this book · Identity audit (inventory and findings), then:
1. Brand strategy: purpose, promise, positioning, values with evidence, personality
2. Logo: master, anatomy, construction, clear space, minimum size, lockups, colour versions, backgrounds, placement in real products, misuse
3. Colour: core palette (HEX/RGB/CMYK), tints, neutrals, semantic colours, proportion, WCAG contrast matrix, gradients and plates
4. Typography: families, weights, specimens, type scale, pairing, hierarchy, fallbacks, numerals and currency
5. Illustration: style, how it is built, palette in use, do and don't
6. Iconography: grid, stroke, sizes, set, do and don't
7. Photography and imagery: art direction, mood, treatment, misuse
8. Digital and UI: components, buttons, forms, cards, states, spacing, radius, elevation, app icon, favicon
9. Motion: principles, timing tokens, easing, logo and loading motion
10. Applications: packaging, uniform, vehicle, receipts and slips, social, print, signage
11. Voice and tone: principles, vocabulary, dos and don'ts, message examples
12. Governance: approval flow, file naming, versioning, checklists
13. Appendix: design tokens, asset index with file paths

## Production spec
- A4 landscape, 297 × 210 mm, with a 12-column grid, running head, folio and section numbers.
- Section dividers use the brand's own artwork or colour.
- **PDF:** fonts embedded, tagged, bookmarked, and no element overflowing any page (check this automatically).
- **DOCX:** genuinely editable.
  - Use real Word styles, Heading 1–3 and a live TOC.
  - Build colour swatches, contrast grids, type scales and checklists as native tables, text and tick boxes, not pictures.
  - Use images only for logos, artwork and screenshots.
  - Embed the brand fonts, and strip system fonts from the package.
- Final QC: open the DOCX in Word, edit and save it, then export Word's own PDF and look at every page.

## Deliverables
- `<Brand>-Brand-Identity-Guidelines-v<version>.pdf`
- `<Brand>-Brand-Identity-Guidelines-v<version>.docx`
- Generator source, with brand data kept separate from the layout
- A README explaining how to edit, rebuild and reuse the book
