// Page-exact Word edition: every PDF page, rendered at 220 dpi, placed full-bleed on its own A4-landscape page.
// What you see in Word is pixel-for-pixel the PDF. (Text edits are made in pages.js, then both files are rebuilt.)
// node docx-exact.js  → expects out/exact/pNN.jpg (+ pNN.txt for alt text) made from out/book.pdf
const fs = require('fs');
const path = require('path');
const D = require('docx');
const { META } = require('./pages');

const DIR = path.join(__dirname, 'out', 'exact');
const files = fs.readdirSync(DIR).filter((f) => /^p\d+\.jpg$/.test(f)).sort();
const W_TW = 16838, H_TW = 11906; // A4 landscape in twips
const W_EMU = 10692130, H_EMU = 7560310; // 297 × 210 mm in EMU

const sections = files.map((f, i) => {
  const txt = fs.existsSync(path.join(DIR, f.replace('.jpg', '.txt'))) ? fs.readFileSync(path.join(DIR, f.replace('.jpg', '.txt')), 'utf8') : '';
  return {
    properties: {
      page: { size: { width: H_TW, height: W_TW, orientation: D.PageOrientation.LANDSCAPE }, margin: { top: 0, right: 0, bottom: 0, left: 0, header: 0, footer: 0, gutter: 0 } },
      type: i === 0 ? undefined : D.SectionType.NEXT_PAGE,
    },
    children: [new D.Paragraph({
      spacing: { before: 0, after: 0, line: 20, lineRule: D.LineRuleType.EXACT },
      children: [new D.ImageRun({
        type: 'jpg', data: fs.readFileSync(path.join(DIR, f)),
        transformation: { width: 1122.52, height: 793.7 },
        altText: { title: `Page ${i + 1}`, description: txt, name: `Page ${i + 1}` },
        floating: {
          horizontalPosition: { relative: D.HorizontalPositionRelativeFrom.PAGE, offset: 0 },
          verticalPosition: { relative: D.VerticalPositionRelativeFrom.PAGE, offset: 0 },
          behindDocument: true, allowOverlap: true, lockAnchor: true, layoutInCell: true,
          wrap: { type: D.TextWrappingType.NONE },
        },
      })],
    })],
  };
});

const doc = new D.Document({
  creator: META.owner, title: `Washing Basket — ${META.title} v${META.version}`, subject: 'Brand guidelines', description: 'Page-exact edition of the PDF',
  styles: { default: { document: { run: { size: 2 }, paragraph: { spacing: { before: 0, after: 0 } } } } },
  sections,
});
D.Packer.toBuffer(doc).then((b) => {
  const out = path.join(__dirname, 'out', 'book-exact.docx');
  fs.writeFileSync(out, b);
  console.log('pages', files.length, 'bytes', b.length, '(EMU check', W_EMU, H_EMU, ')');
});
