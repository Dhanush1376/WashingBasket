// Shared: absolutely positioned, borderless, zero-inset VML text boxes for the exact Word edition.
const fs = require('fs');
const path = require('path');
const D = require('docx');
const JSZip = require('jszip');

const F = path.join(__dirname, 'fonts');
const rf = (n) => fs.readFileSync(path.join(F, n));
const FONTS = [
  { name: 'Inter', data: rf('Inter_400Regular.ttf'), bold: rf('Inter_700Bold.ttf') },
  { name: 'Inter Medium', data: rf('Inter_500Medium.ttf') },
  { name: 'Inter SemiBold', data: rf('Inter_600SemiBold.ttf') },
  { name: 'Courier Prime', data: rf('CourierPrime_400Regular.ttf'), bold: rf('CourierPrime_700Bold.ttf') },
];
// CSS family + weight → Word font + bold
function face(fam, w) {
  if (/courier/i.test(fam)) return ['Courier Prime', w >= 600];
  if (w >= 700) return ['Inter', true];
  if (w >= 600) return ['Inter SemiBold', false];
  if (w >= 500) return ['Inter Medium', false];
  return ['Inter', false];
}
const pt = (v) => `${(+v).toFixed(2)}pt`;
const flowPara = { spacing: { before: 0, after: 0, line: 20, lineRule: D.LineRuleType.EXACT } };

/** box = { x, y, w, h (pt), lines: [[{text, font, bold, size(pt), color, spacing(pt), italic}]], lineH (pt), align } */
function textBox(box, z) {
  const kids = box.lines.map((runs, li) => new D.Paragraph({
    alignment: box.align || D.AlignmentType.LEFT,
    spacing: { before: 0, after: 0, line: Math.round(box.lineH * 20), lineRule: D.LineRuleType.EXACT },
    children: runs.map((r) => new D.TextRun({ text: r.text, font: r.font, bold: r.bold, italics: r.italic, size: Math.round(r.size * 2), color: r.color, characterSpacing: r.spacing ? Math.round(r.spacing * 20) : undefined })),
  }));
  return new D.Textbox({
    ...flowPara,
    style: { position: 'absolute', positionHorizontalRelative: 'page', positionVerticalRelative: 'page', left: pt(box.x), top: pt(box.y), width: pt(box.w), height: pt(box.h), zIndex: 10 + z },
    children: kids,
  });
}

/** fix the library's VML defaults: no fill, no outline, no inner padding, no autofit drift */
async function finish(buf) {
  const zip = await JSZip.loadAsync(buf);
  let x = await zip.file('word/document.xml').async('string');
  x = x.replace(/<v:shape (?![^>]*filled=)/g, '<v:shape filled="f" stroked="f" ')
    .replace(/<v:textbox style="mso-fit-shape-to-text:t;">/g, '<v:textbox inset="0,0,0,0">');
  zip.file('word/document.xml', x);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
module.exports = { D, FONTS, face, textBox, finish, flowPara, pt };
