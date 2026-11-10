// Exact + editable Word edition: per page, the graphics (text removed) sit behind the page,
// and every line of text is live Word text in a borderless text box at the PDF's exact position.
// node extract.js && node docx-live.js  → out/book-live.docx
const fs = require('fs');
const path = require('path');
const { D, FONTS, face, finish, flowPara, pt } = require('./tbox');
const { META } = require('./pages');

const DIR = path.join(__dirname, 'out', 'live');
const pages = JSON.parse(fs.readFileSync(path.join(DIR, 'pages.json'), 'utf8'));
const K = 0.75; // CSS px → pt
const W_TW = 16838, H_TW = 11906;

function runOf(r, extraPx) {
  const s = r.fs * K;
  const half = Math.max(1, Math.round(s * 2)); // Word sizes are half-points
  const fixed = half / 2;
  // keep the line length identical: compensate the rounded size through tracking
  const spPt = r.ls * K + extraPx * (1 - fixed / s) * K;
  let [font, bold] = /georgia/i.test(r.fam) ? ['Georgia', false] : face(r.fam, r.w);
  return new D.TextRun({
    text: r.text, font, bold, italics: r.it, size: half, color: r.color,
    characterSpacing: Math.abs(spPt) >= 0.025 ? Math.round(spPt * 20) : undefined,
    kern: 2,
  });
}

function box(b, z) {
  const L = b.L;
  const align = b.lines[0].runs[0].align;
  const slack = Math.max(8, b.w * 0.12);
  let x = b.x, w = b.w + slack;
  let A = D.AlignmentType.LEFT;
  if (align === 'center') { x -= slack / 2; A = D.AlignmentType.CENTER; }
  else if (align === 'right' || align === 'end') { x -= slack; A = D.AlignmentType.RIGHT; }
  const top = (b.base - 0.8 * L) * K;
  const kids = b.lines.map((l) => {
    const n = l.runs.reduce((a, r) => a + r.text.length, 0) || 1;
    const lsSum = l.runs.reduce((a, r) => a + r.ls * r.text.length, 0);
    const avg = Math.max(0, (l.w - lsSum) / n); // natural advance per character, px
    return new D.Paragraph({
      alignment: A,
      spacing: { before: 0, after: 0, line: Math.round(L * K * 20), lineRule: D.LineRuleType.EXACT },
      children: l.runs.map((r) => runOf(r, avg)),
    });
  });
  return new D.Textbox({
    ...flowPara,
    style: { position: 'absolute', positionHorizontalRelative: 'page', positionVerticalRelative: 'page', left: pt(x * K), top: pt(top), width: pt(w * K), height: pt((L * (b.lines.length + 0.6)) * K), zIndex: 10 + z },
    children: kids,
  });
}

const sections = pages.map((pg, i) => ({
  properties: {
    page: { size: { width: H_TW, height: W_TW, orientation: D.PageOrientation.LANDSCAPE }, margin: { top: 0, right: 0, bottom: 0, left: 0, header: 0, footer: 0, gutter: 0 } },
    type: i === 0 ? undefined : D.SectionType.NEXT_PAGE,
  },
  children: [
    new D.Paragraph({
      ...flowPara,
      children: [new D.ImageRun({
        type: 'jpg', data: fs.readFileSync(path.join(DIR, `bg${String(i + 1).padStart(2, '0')}.jpg`)),
        transformation: { width: 1122.52, height: 793.7 },
        altText: { title: `Page ${i + 1} artwork`, description: `Page ${i + 1} graphics`, name: `Page ${i + 1} artwork` },
        floating: {
          horizontalPosition: { relative: D.HorizontalPositionRelativeFrom.PAGE, offset: 0 },
          verticalPosition: { relative: D.VerticalPositionRelativeFrom.PAGE, offset: 0 },
          behindDocument: true, allowOverlap: true, lockAnchor: true, layoutInCell: true,
          wrap: { type: D.TextWrappingType.NONE },
        },
      })],
    }),
    ...pg.boxes.map((b, z) => box(b, z)),
  ],
}));

const doc = new D.Document({
  creator: META.owner, title: `Washing Basket — ${META.title} v${META.version}`, subject: 'Brand guidelines', description: 'Exact, editable edition of the PDF',
  fonts: FONTS,
  styles: { default: { document: { run: { size: 2, font: 'Inter' }, paragraph: { spacing: { before: 0, after: 0 } } } } },
  sections,
});
D.Packer.toBuffer(doc).then(finish).then((b) => {
  fs.writeFileSync(path.join(__dirname, 'out', 'book-live.docx'), b);
  console.log('pages', pages.length, 'boxes', pages.reduce((a, p) => a + p.boxes.length, 0), 'MB', (b.length / 1e6).toFixed(1));
});
