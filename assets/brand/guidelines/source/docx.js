// Builds the editable Word edition from the same pages.js content.
const fs = require('fs');
const path = require('path');
const D = require('docx');
const { pages: all, META, C, SHADES, NEUTRALS, SEMANTIC, pairs, scale, TL } = require('./pages');
const { cmyk, hex2rgb, contrast, grade, isDark } = require('./lib');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  AlignmentType, HeadingLevel, LevelFormat, PageOrientation, Header, Footer, PageNumber, TableOfContents,
  PositionalTab, PositionalTabAlignment, PositionalTabRelativeTo, PositionalTabLeader, VerticalAlign, TableLayoutType,
} = D;

const F = path.join(__dirname, 'fonts');
const FIG = path.join(__dirname, 'out', 'figs');
const pages = all.filter((p) => p.layout !== 'marker');
pages.forEach((p, i) => (p.no = i + 1));

// fonts (Word family names from each TTF's name table)
const JAK = 'Plus Jakarta Sans', JAKX = 'Plus Jakarta Sans ExtraBold', INTER = 'Inter', INTERSB = 'Inter SemiBold', MONO = 'Courier Prime';
const rf = (n) => fs.readFileSync(path.join(F, n));
const fonts = [
  { name: INTER, data: rf('Inter_400Regular.ttf'), bold: rf('Inter_700Bold.ttf') },
  { name: INTERSB, data: rf('Inter_600SemiBold.ttf') },
  { name: JAK, data: rf('PlusJakartaSans_400Regular.ttf'), bold: rf('PlusJakartaSans_700Bold.ttf') },
  { name: JAKX, data: rf('PlusJakartaSans_800ExtraBold.ttf') },
  { name: MONO, data: rf('CourierPrime_400Regular.ttf'), bold: rf('CourierPrime_700Bold.ttf') },
  { name: 'Inter Medium', data: rf('Inter_500Medium.ttf') },
  { name: 'Plus Jakarta Sans Medium', data: rf('PlusJakartaSans_500Medium.ttf') },
  { name: 'Plus Jakarta Sans SemiBold', data: rf('PlusJakartaSans_600SemiBold.ttf') },
];
// map a CSS family + weight to a Word font name and bold flag
function face(fam, w) {
  if (fam.startsWith('Plus')) return w >= 800 ? [JAKX, false] : w >= 700 ? [JAK, true] : w >= 600 ? ['Plus Jakarta Sans SemiBold', false] : w >= 500 ? ['Plus Jakarta Sans Medium', false] : [JAK, false];
  if (fam.startsWith('Courier')) return [MONO, w >= 700];
  return w >= 700 ? [INTER, true] : w >= 600 ? [INTERSB, false] : w >= 500 ? ['Inter Medium', false] : [INTER, false];
}

const INK = '0A1C3E', BODY = '2C3A55', SOFT = '5B6475', MUTE = '667085', LINE = 'E3E6EB', LOR = 'FE8701';
const PAGE_W = 16838, PAGE_H = 11906, MARGIN = 850;
const CW = PAGE_W - 2 * MARGIN; // content width in DXA
const px = (dxa) => dxa / 15; // 96 dpi
const TAGC = { verified: ['0D7A21', 'EBF9F0', '12AD2B', 'VERIFIED'], proposed: ['A85A00', 'FFF4E8', 'FFA742', 'PROPOSED'], rule: ['FFFFFF', '0A1C3E', '0A1C3E', 'RULE'], finding: ['C8102E', 'FEF0F2', 'C8102E', 'FINDING'] };

// inline **bold**
function runs(text, o = {}) {
  const out = [];
  String(text).split(/(\*\*.+?\*\*)/).forEach((s) => {
    if (!s) return;
    const b = s.startsWith('**');
    out.push(new TextRun({ text: b ? s.slice(2, -2) : s, bold: b || o.bold, font: b ? INTERSB : o.font || INTER, color: b ? INK : o.color || BODY, size: o.size || 18, ...(b ? { bold: false } : {}) }));
  });
  return out;
}
const P = (children, o = {}) => new Paragraph({ children, spacing: { after: o.after ?? 100, before: o.before ?? 0, line: o.line ?? 300 }, ...o.p });

// image size from file header
function imgSize(file) {
  const b = fs.readFileSync(file);
  if (b[0] === 0x89) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), type: 'png', b };
  let i = 2;
  while (i < b.length) {
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc3) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7), type: 'jpg', b };
    i += 2 + len;
  }
  throw new Error('size ' + file);
}
function image(file, maxWdxa, maxHmm = 112, align = AlignmentType.LEFT) {
  const s = imgSize(file);
  const maxW = px(maxWdxa), maxH = (maxHmm / 25.4) * 96;
  const k = Math.min(maxW / s.w, maxH / s.h);
  return new Paragraph({ alignment: align, spacing: { after: 120 }, children: [new ImageRun({ type: s.type, data: s.b, transformation: { width: Math.round(s.w * k), height: Math.round(s.h * k) } })] });
}

const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };

function tagRun(kind) {
  const [fg, bg, , label] = TAGC[kind];
  return new TextRun({ text: ` ${label} `, font: INTERSB, size: 12, color: fg, shading: { type: ShadingType.CLEAR, fill: bg, color: 'auto' }, characterSpacing: 20 });
}

function note(kind, text) {
  const [, bg, edge] = TAGC[kind];
  const fill = kind === 'rule' ? 'EEF3FB' : kind === 'finding' ? 'FEF0F2' : 'FFFFFF';
  return new Paragraph({
    children: [tagRun(kind), new TextRun({ text: '  ', size: 16 }), ...runs(text, { size: 15 })],
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: edge, space: 6 } },
    shading: { type: ShadingType.CLEAR, fill, color: 'auto' },
    spacing: { before: 60, after: 140, line: 276 }, indent: { left: 120 },
  });
}

function table(head, rows, widths, W) {
  const cols = widths.map((w) => Math.round((w / 100) * W));
  cols[cols.length - 1] = W - cols.slice(0, -1).reduce((a, b) => a + b, 0);
  const cell = (t, i, isHead) => new TableCell({
    width: { size: cols[i], type: WidthType.DXA },
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    borders: { top: NONE, left: NONE, right: NONE, bottom: isHead ? { style: BorderStyle.SINGLE, size: 8, color: INK } : { style: BorderStyle.SINGLE, size: 4, color: LINE } },
    children: [new Paragraph({ spacing: { after: 0, line: 264 }, children: isHead ? [new TextRun({ text: t.toUpperCase(), font: INTERSB, size: 12, color: MUTE, characterSpacing: 16 })] : runs(t, { size: 15, color: i === 0 ? INK : BODY, font: i === 0 ? INTERSB : INTER }) })],
  });
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: cols, layout: TableLayoutType.FIXED, borders: noBorders,
    rows: [new TableRow({ tableHeader: true, children: head.map((h, i) => cell(h, i, true)) }), ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false)) }))],
  });
}

function grid(cellsBlocks, W, gap = 300, shade) {
  const n = cellsBlocks.length;
  const cw = Math.floor(W / n);
  const cols = Array(n).fill(cw);
  return new Table({
    width: { size: cw * n, type: WidthType.DXA }, columnWidths: cols, layout: TableLayoutType.FIXED, borders: noBorders,
    rows: [new TableRow({ cantSplit: false, children: cellsBlocks.map((blocks, i) => new TableCell({
      width: { size: cw, type: WidthType.DXA }, borders: noBorders,
      shading: shade ? { type: ShadingType.CLEAR, fill: shade, color: 'auto' } : undefined,
      margins: { left: i === 0 && !shade ? 0 : gap / 2, right: i === n - 1 && !shade ? 0 : gap / 2, top: shade ? 120 : 0, bottom: shade ? 120 : 0 },
      children: blocks.length ? blocks : [new Paragraph('')],
    })) })],
  });
}
const spacer = (h = 120) => new Paragraph({ spacing: { after: 0, before: 0, line: h }, children: [] });

function heading(text, level, o = {}) {
  return new Paragraph({ heading: level, children: [new TextRun({ text })], pageBreakBefore: o.pb, spacing: o.spacing });
}
const kicker = (t, pb) => new Paragraph({ pageBreakBefore: pb, keepNext: true, spacing: { after: 60 }, children: [new TextRun({ text: t.toUpperCase(), font: INTERSB, size: 14, color: LOR, characterSpacing: 40 })] });
const lead = (t) => P(runs(t, { size: 22, color: SOFT }), { after: 200, line: 320 });

function blocks(list, W) { return list.flatMap((b) => block(b, W)); }

function block(b, W) {
  switch (b.t) {
    case 'p': return [P(runs(b.text))];
    case 'lead': return [lead(b.text)];
    case 'h': return [heading(b.text, HeadingLevel.HEADING_3)];
    case 'list': return b.items.map((i) => new Paragraph({ numbering: { reference: 'dots', level: 0 }, spacing: { after: 50, line: 280 }, children: runs(i, { size: 17 }) }));
    case 'table': return [table(b.head, b.rows, b.widths, W), spacer()];
    case 'fig': {
      if (NATIVE[b.id]) return [...NATIVE[b.id](W), ...(b.caption ? [P([new TextRun({ text: b.caption, size: 14, color: MUTE, font: INTER })], { after: 160 })] : [])];
      const file = path.join(FIG, b.id + '.jpg');
      const out = [image(file, W, Math.min(118, b.h * 0.95))];
      if (b.caption) out.push(P([new TextRun({ text: b.caption, size: 14, color: MUTE, font: INTER })], { after: 160 }));
      return out;
    }
    case 'note': return [note(b.kind, b.text)];
    case 'kv': return [table(['Item', 'Detail'], b.items, [30, 70], W), spacer()];
    case 'quote': return [new Paragraph({ border: { left: { style: BorderStyle.SINGLE, size: 24, color: 'FFA742', space: 10 } }, indent: { left: 200 }, spacing: { after: 200, line: 320 }, children: [new TextRun({ text: b.text.replace(/\*\*/g, ''), font: JAK, bold: true, size: b.small ? 22 : 30, color: INK })] })];
    case 'code': return b.text.split('\n').map((l, i, a) => new Paragraph({ shading: { type: ShadingType.CLEAR, fill: INK, color: 'auto' }, spacing: { after: i === a.length - 1 ? 160 : 0, line: 260 }, children: [new TextRun({ text: l || ' ', font: MONO, size: 16, color: 'E8EDF7' })] }));
    case 'cols': { const g = gridW(W, b.items.length); return [grid(b.items.map((c) => blocks(c, g)), W), spacer()]; }
    case 'stack': case 'span': return blocks(b.items, W);
    case 'grid3': { const g = gridW(W, 3); return [grid(b.items.map((i) => [P([tagRun(i.tag)]), P([new TextRun({ text: i.title, font: JAKX, size: 24, color: INK })], { after: 60 }), P(runs(i.text, { size: 16 }))]), W), spacer()]; }
    case 'finding': return [
      new Paragraph({ keepNext: true, spacing: { before: 120, after: 40 }, children: [new TextRun({ text: b.n + '  ', font: JAKX, size: 26, color: 'C8102E' }), new TextRun({ text: b.title, font: JAK, bold: true, size: 20, color: INK })] }),
      P(runs(b.text, { size: 16 }), { after: 40 }),
      P([new TextRun({ text: 'Resolve: ', font: INTERSB, size: 16, color: '0D7A21' }), ...runs(b.fix, { size: 16 })], { after: 120 }),
    ];
    case 'pillar': return [P([new TextRun({ text: b.label.toUpperCase(), font: INTERSB, size: 14, color: LOR, characterSpacing: 40 })], { after: 60 }), P([new TextRun({ text: b.title, font: JAKX, size: 30, color: INK })], { after: 80, line: 300 }), P(runs(b.text)), P([tagRun(b.tag)], { after: 200 })];
    case 'values': { const g = gridW(W, 5); return [grid(b.items.map(([n, d, e], i) => [P([new TextRun({ text: '0' + (i + 1), font: JAKX, size: 18, color: LOR })], { after: 20 }), P([new TextRun({ text: n, font: JAKX, size: 24, color: INK })], { after: 40 }), P(runs(d, { size: 15 }), { after: 40 }), P([new TextRun({ text: 'Evidence: ' + e, size: 12, color: MUTE, font: INTER })])]), W, 200), spacer(200)]; }
    case 'check': return [P([new TextRun({ text: b.title, font: JAKX, size: 22, color: INK })], { after: 60 }), ...b.items.map((i) => P([new D.CheckBox({ checkedState: { value: '2612', font: 'MS Gothic' }, uncheckedState: { value: '2610', font: 'MS Gothic' } }), new TextRun({ text: '  ', size: 16 }), ...runs(i, { size: 16 })], { after: 40 })), spacer(200)];
    default: throw new Error('docx block ' + b.t);
  }
}
const gridW = (W, n) => Math.floor(W / n) - 300;

// body for one book page
function pageBody(p) {
  const out = [];
  const isFirstContent = p.no === 1;
  switch (p.layout) {
    case 'cover':
      out.push(image(path.join(FIG, `page-${p.no}.jpg`), CW, 128, AlignmentType.CENTER));
      out.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(META.title)] }));
      out.push(P([new TextRun({ text: `Washing Basket  ·  Version ${META.version}  ·  ${META.date}`, size: 18, color: MUTE })]));
      return out;
    case 'divider':
      out.push(heading(`${p.num}   ${p.title}`, HeadingLevel.HEADING_1, { pb: true }));
      out.push(image(path.join(FIG, `page-${p.no}.jpg`), CW, 120, AlignmentType.LEFT));
      out.push(P([new TextRun({ text: 'In this section: ', font: INTERSB, size: 17, color: INK }), new TextRun({ text: p.items.join('  ·  '), size: 17, color: SOFT })]));
      return out;
    case 'toc':
      out.push(kicker('Contents', true));
      out.push(heading('Contents', HeadingLevel.HEADING_2));
      out.push(new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' }));
      return out;
    case 'manifesto':
      out.push(kicker(p.kicker, true));
      out.push(heading('Manifesto', HeadingLevel.HEADING_2));
      p.lines.forEach((l, i) => out.push(new Paragraph({ spacing: { after: 40, line: 340 }, children: [new TextRun({ text: l, font: i === p.lines.length - 1 ? JAKX : JAK, bold: i !== p.lines.length - 1, size: i === p.lines.length - 1 ? 40 : 30, color: i === p.lines.length - 1 ? LOR : INK })] })));
      out.push(spacer(200));
      out.push(note('proposed', p.note));
      return out;
    case 'back':
      out.push(new Paragraph({ pageBreakBefore: true, children: [] }));
      out.push(image(path.join(FIG, `page-${p.no}.jpg`), CW, 160, AlignmentType.CENTER));
      return out;
    default: {
      // a section without a divider page starts here: give it a Heading 1 for the contents
      const start = p.sectionStart;
      if (start) out.push(heading(`${start.num}   ${start.title}`, HeadingLevel.HEADING_1, { pb: true }));
      out.push(kicker(p.kicker, !start));
      out.push(heading(p.title, HeadingLevel.HEADING_2));
      if (p.lead) out.push(lead(p.lead));
      if (p.layout === 'split-img') out.push(image(path.join(__dirname, 'img', p.img), CW, 80));
      if (p.side) out.push(...blocks(p.side, CW));
      if (p.cols && p.layout === 'top') {
        // reproduce the page grid: rows of `cols` cells
        const g = gridW(CW, p.cols);
        const items = p.body.filter((b) => b.t !== 'span');
        for (let i = 0; i < items.length; i += p.cols) {
          const row = items.slice(i, i + p.cols);
          while (row.length < p.cols) row.push({ t: 'stack', items: [] });
          out.push(grid(row.map((b) => block(b, g)), CW));
          out.push(spacer(160));
        }
        p.body.filter((b) => b.t === 'span').forEach((b) => out.push(...block(b, CW)));
      } else out.push(...blocks(p.body, CW));
      return out;
    }
  }
}

// mark section starts for marker sections (render.js sets this on the HTML side too)
all.forEach((p, i) => {
  if (p.layout === 'marker') {
    const next = all.slice(i + 1).find((q) => q.layout !== 'marker');
    next.sectionStart = { num: p.num, title: p.title };
  }
});
const appendix = pages.find((p) => p.id === 'appendix');
appendix.sectionStart = { num: 'A', title: 'Appendix' };

/* ───────────── native, editable versions of the data figures ───────────── */
const h6 = (hex) => hex.replace('#', '').toUpperCase();
const onC = (hex) => (isDark(hex) ? 'FFFFFF' : INK);
const tr = (text, o = {}) => new TextRun({ text, font: o.font || INTER, size: o.size || 14, color: o.color || INK, bold: o.bold, characterSpacing: o.cs });
const line = (children, o = {}) => new Paragraph({ spacing: { after: o.after ?? 0, before: o.before ?? 0, line: o.line ?? 252 }, alignment: o.align, children });
const edge = (hex) => (hex.toUpperCase() === '#FFFFFF' || ['#FBF9F4', '#F8F9FA', '#F4F5F7', '#F5F1E8', '#F4F2EB'].includes(hex.toUpperCase()) ? { style: BorderStyle.SINGLE, size: 4, color: LINE } : NONE);
function colourTable(rows, W, gap = 90) {
  // rows: [{ height(mm), cells: [{ fill, children }] }]
  const n = Math.max(...rows.map((r) => r.cells.length));
  const cw = Math.floor(W / n);
  return new Table({
    width: { size: cw * n, type: WidthType.DXA }, columnWidths: Array(n).fill(cw), layout: TableLayoutType.FIXED, borders: noBorders,
    rows: rows.map((r) => new TableRow({ cantSplit: true, height: { value: Math.round(r.height * 56.7), rule: D.HeightRule.ATLEAST }, children: r.cells.map((c) => {
      const e = edge(c.fill);
      return new TableCell({
        width: { size: cw, type: WidthType.DXA }, verticalAlign: c.valign || VerticalAlign.TOP,
        shading: { type: ShadingType.CLEAR, fill: h6(c.fill), color: 'auto' },
        borders: { top: e.style === BorderStyle.NONE ? { style: BorderStyle.SINGLE, size: 12, color: 'FBF9F4' } : e, bottom: { style: BorderStyle.SINGLE, size: 12, color: 'FBF9F4' }, left: { style: BorderStyle.SINGLE, size: gap / 6, color: 'FBF9F4' }, right: { style: BorderStyle.SINGLE, size: gap / 6, color: 'FBF9F4' } },
        margins: { top: 110, bottom: 110, left: 130, right: 110 },
        children: c.children,
      });
    }) })),
  });
}
const vals = (hex, col) => [
  line([tr('HEX  ', { size: 12, color: col, font: INTERSB }), tr(hex.toUpperCase(), { size: 13, color: col })]),
  line([tr('RGB  ', { size: 12, color: col, font: INTERSB }), tr(hex2rgb(hex).join(' · '), { size: 13, color: col })]),
  line([tr('CMYK  ', { size: 12, color: col, font: INTERSB }), tr(cmyk(hex).join(' · '), { size: 13, color: col })]),
];
const swName = (t, col, size = 20) => line([tr(t, { font: JAKX, size, color: col })], { after: 60 });

const NATIVE = {
  'core-fig': (W) => [colourTable([{ height: 38, cells: ['navy', 'logoOrange', 'red', 'ink', 'orange', 'navyDeep'].map((k) => { const c = C[k], col = onC(c.hex); return { fill: c.hex, children: [swName(c.name, col), line([tr(' ', { size: 60 })], { line: 900 }), ...vals(c.hex, col)] }; }) }], W), spacer(160)],
  'shades-fig': (W) => [colourTable([
    { height: 28, cells: SHADES.map(([n, h]) => ({ fill: h, children: [swName(n, onC(h), 18), line([tr(' ')], { line: 500 }), line([tr(h, { size: 13, color: onC(h) })]), line([tr('RGB ' + hex2rgb(h).join(' · '), { size: 12, color: onC(h) })])] })) },
    { height: 12, cells: SHADES.map(([, , tn, th]) => ({ fill: th, children: [line([tr(tn, { font: JAK, bold: true, size: 15 })]), line([tr(th, { size: 13 })])] })) },
  ], W), spacer(160)],
  'neutrals-fig': (W) => {
    const rows = [];
    for (let i = 0; i < NEUTRALS.length; i += 6) rows.push({ height: 20, cells: NEUTRALS.slice(i, i + 6).map(([n, h, u]) => ({ fill: h, valign: VerticalAlign.BOTTOM, children: [line([tr(n, { font: JAK, bold: true, size: 15, color: onC(h) })]), line([tr(h, { size: 13, color: onC(h) })]), line([tr(u, { size: 11, color: onC(h) === 'FFFFFF' ? 'DDE3EE' : MUTE })])] })) });
    return [colourTable(rows, W), spacer(160)];
  },
  'semantic-fig': (W) => [colourTable([
    { height: 24, cells: SEMANTIC.map(([n, h]) => ({ fill: h, children: [swName(n, 'FFFFFF', 20), line([tr(' ')], { line: 400 }), line([tr(h, { size: 14, color: 'FFFFFF' })])] })) },
    { height: 12, cells: SEMANTIC.map(([n, h, t]) => ({ fill: t, children: [line([tr('● ', { size: 12, color: h6(h) }), tr(n === 'Success' ? 'Delivered' : n === 'Warning' ? 'Payment pending' : n === 'Danger' ? 'Cancelled' : 'Drop-off ready', { size: 14, color: h6(h), font: INTERSB })]), line([tr('Tint ' + t, { size: 12, color: MUTE })])] })) },
  ], W / 2 > 6000 ? W : W), spacer(160)],
  'contrast-fig': (W) => {
    const cell = ([f, b, n]) => { const r = contrast(f, b), g = grade(r); return { fill: b, children: [line([tr('Aa', { font: JAKX, size: 34, color: h6(f) })], { after: 60, line: 360 }), line([tr(n, { size: 12, color: h6(f), font: INTERSB })]), line([new TextRun({ text: ` ${r.toFixed(1)}:1 · ${g} `, font: INTERSB, size: 12, color: g === 'Fail' ? 'FFFFFF' : g === 'AA Large' ? 'B97800' : '0D7A21', shading: { type: ShadingType.CLEAR, fill: g === 'Fail' ? 'C8102E' : 'FFFFFF', color: 'auto' } })], { before: 40 })] }; };
    return [colourTable([{ height: 26, cells: pairs.slice(0, 8).map(cell) }, { height: 26, cells: pairs.slice(8).map(cell) }], W), spacer(160)];
  },
  'prop-fig': (W) => {
    const parts = [[62, '#FBF9F4', 'Neutrals', 'White · Ivory · Paper'], [16, '#0A1C3E', 'Ink & Navy', ''], [12, '#FFA742', 'Action Orange', ''], [6, '#54B6F8', 'Shades', ''], [4, '#D30D24', '', '']];
    const cols = parts.map(([p]) => Math.round((p / 100) * W));
    return [new Table({ width: { size: cols.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: cols, layout: TableLayoutType.FIXED, borders: { ...noBorders, top: { style: BorderStyle.SINGLE, size: 4, color: LINE }, bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE }, left: { style: BorderStyle.SINGLE, size: 4, color: LINE }, right: { style: BorderStyle.SINGLE, size: 4, color: LINE } },
      rows: [new TableRow({ height: { value: 1500, rule: D.HeightRule.ATLEAST }, children: parts.map(([p, h, n, s], i) => new TableCell({ width: { size: cols[i], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: h6(h), color: 'auto' }, margins: { top: 100, left: 100, right: 60 }, children: [line([tr(p + '%', { font: JAKX, size: 26, color: onC(h) })]), line([tr(n, { size: 12, color: onC(h) })]), line([tr(s, { size: 11, color: onC(h) })])] })) })] }),
      spacer(120),
      table(['Combination', 'Status', 'Colours'], [['App', 'Verified', 'White · Ink · Action Orange'], ['Website', 'Verified', 'Ivory · Ink · Navy · Action Orange'], ['Brand bands', 'Verified', 'Logo Orange · Cloth Red · Basket Navy'], ['Two oranges side by side', 'Avoid', 'Logo Orange next to Action Orange'], ['Red with green', 'Avoid', 'Cloth Red next to Success green'], ['Navy text on ink', 'Avoid', 'Basket Navy on Ink']], [34, 16, 50], W), spacer()];
  },
  'jakarta-fig': (W) => specimen('Plus Jakarta Sans', 800),
  'inter-fig': (W) => specimen('Inter', 600),
  'jakarta-w': (W) => weightLines('Plus Jakarta Sans', [[500, 'Medium'], [600, 'SemiBold'], [700, 'Bold'], [800, 'ExtraBold']]),
  'inter-w': (W) => weightLines('Inter', [[400, 'Regular'], [500, 'Medium'], [600, 'SemiBold'], [700, 'Bold']]),
  'scale-fig': (W) => scale.map(([n, f, w, s, lh, ls, ex]) => { const [fn, bold] = face(f, w); return new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 4 } }, spacing: { after: 100, line: 264 }, children: [tr(n.toUpperCase() + '   ', { size: 11, color: MUTE, font: INTERSB, cs: 20 }), new TextRun({ text: ex, font: fn, bold, size: Math.round(Math.min(s, 40) * 0.75 * 2), color: INK })] }); }),
  'slip-fig': (W) => {
    const rowsTxt = [['ORDER', 'WB-1011'], ['DATE', '08 NOV 2026'], null, ['Normal wash · 4.2 kg', '₹189'], ['Shirt — steam press × 3', '₹45'], ['Stain treatment × 1', '₹70'], null, ['TOTAL', '₹304']];
    const kids = [line([tr('WASHING BASKET', { font: MONO, bold: true, size: 26, cs: 40 })], { align: AlignmentType.CENTER }), line([tr('LAUNDRY SLIP · MODEL TOWN', { font: MONO, size: 14, cs: 20 })], { align: AlignmentType.CENTER, after: 120 })];
    rowsTxt.forEach((r) => kids.push(r ? new Paragraph({ spacing: { after: 40 }, tabStops: [{ type: D.TabStopType.RIGHT, position: 4600 }], children: [tr(r[0], { font: MONO, size: 17, bold: r[0] === 'TOTAL' }), tr('\t' + r[1], { font: MONO, size: 17, bold: r[0] === 'TOTAL' })] }) : new Paragraph({ border: { bottom: { style: BorderStyle.DASHED, size: 6, color: '1D2433' } }, spacing: { after: 80 }, children: [] })));
    kids.push(line([tr('COUNTED IN FRONT OF YOU · THANK YOU', { font: MONO, size: 13, cs: 20 })], { align: AlignmentType.CENTER, before: 160 }));
    return [new Table({ width: { size: 5000, type: WidthType.DXA }, columnWidths: [5000], borders: noBorders, rows: [new TableRow({ children: [new TableCell({ width: { size: 5000, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: 'FFFDF7', color: 'auto' }, borders: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E3DCCB' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E3DCCB' }, left: { style: BorderStyle.SINGLE, size: 4, color: 'E3DCCB' }, right: { style: BorderStyle.SINGLE, size: 4, color: 'E3DCCB' } }, margins: { top: 200, bottom: 200, left: 200, right: 200 }, children: kids })] })] }), spacer(160)];
  },
  'tl-fig': (W) => [table(['Layer', 'Starts at', 'Colour', 'Position on the 4.4 s timeline'], TL.map(([n, t, c]) => [n, `${t} ms`, c, '▮'.repeat(Math.max(1, Math.round((t / 4400) * 40))) ]), [18, 14, 14, 54], W), spacer()],
};
function specimen(fam, w) {
  const [fn, bold] = face(fam, w);
  const [fr] = face(fam, 400);
  return [line([new TextRun({ text: 'Aa Bb Cc', font: fn, bold, size: 120, color: INK })], { line: 250, after: 160 }),
    ...['ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz', '0123456789 ₹ & @ ? ! % ( ) / –'].map((t) => line([new TextRun({ text: t, font: fr, size: 26, color: BODY })], { line: 300 })), spacer(200)];
}
function weightLines(fam, ws) {
  return ws.map(([w, n]) => { const [fn, bold] = face(fam, w); return new Paragraph({ spacing: { after: 80 }, children: [tr(`${n} ${w}`.padEnd(16, ' ') + '   ', { size: 12, color: MUTE }), new TextRun({ text: 'Collected. Cleaned. Returned.', font: fn, bold, size: 28, color: INK })] }); }).concat([spacer(120)]);
}

const children = pages.flatMap(pageBody);

const hdrLogo = imgSize(path.join(__dirname, 'img', 'favicon.png'));
const header = new Header({ children: [new Paragraph({
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 6 } },
  children: [new ImageRun({ type: 'png', data: hdrLogo.b, transformation: { width: 14, height: 14 } }), new TextRun({ text: '  Washing', font: JAK, bold: true, size: 15, color: INK }), new TextRun({ text: 'Basket', font: JAK, bold: true, size: 15, color: INK }),
    new TextRun({ children: [new PositionalTab({ alignment: PositionalTabAlignment.RIGHT, relativeTo: PositionalTabRelativeTo.MARGIN, leader: PositionalTabLeader.NONE }), 'BRAND IDENTITY GUIDELINES'], font: INTERSB, size: 12, color: MUTE, characterSpacing: 30 })],
})] });
const footer = new Footer({ children: [new Paragraph({ children: [
  new TextRun({ text: `Washing Basket · Brand Identity & Visual Design Guidelines · v${META.version}`, size: 13, color: MUTE, font: INTER }),
  new TextRun({ children: [new PositionalTab({ alignment: PositionalTabAlignment.RIGHT, relativeTo: PositionalTabRelativeTo.MARGIN, leader: PositionalTabLeader.NONE }), PageNumber.CURRENT], font: JAKX, size: 20, color: INK }),
] })] });

const hs = (font, size, before, after, color = INK) => ({ run: { font, size, color }, paragraph: { spacing: { before, after }, keepNext: true, keepLines: true } });
const doc = new Document({
  creator: META.owner, title: `Washing Basket — ${META.title}`, description: 'Official brand identity reference', subject: 'Brand guidelines',
  fonts,
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: INTER, size: 18, color: BODY } } },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', run: { font: JAKX, size: 56, color: INK }, paragraph: { spacing: { before: 200, after: 120 } } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, ...hs(JAKX, 48, 0, 200), paragraph: { spacing: { before: 0, after: 200 }, keepNext: true, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, ...hs(JAKX, 40, 0, 160), paragraph: { spacing: { before: 0, after: 160 }, keepNext: true, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: JAK, bold: true, size: 20, color: INK }, paragraph: { spacing: { before: 160, after: 80 }, keepNext: true, outlineLevel: 2 } },
      { id: 'TOC1', name: 'toc 1', basedOn: 'Normal', next: 'Normal', run: { font: JAK, bold: true, size: 20, color: INK }, paragraph: { spacing: { before: 120, after: 40 } } },
      { id: 'TOC2', name: 'toc 2', basedOn: 'Normal', next: 'Normal', run: { font: INTER, size: 16, color: SOFT }, paragraph: { spacing: { before: 0, after: 20 }, indent: { left: 360 } } },
    ],
  },
  numbering: { config: [{ reference: 'dots', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { run: { color: 'FFA742' }, paragraph: { indent: { left: 280, hanging: 200 } } } }] }] },
  sections: [{
    properties: { titlePage: true, page: { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: MARGIN + 150, bottom: MARGIN, left: MARGIN, right: MARGIN, header: 420, footer: 360 } } },
    headers: { default: header, first: new Header({ children: [new Paragraph('')] }) },
    footers: { default: footer, first: new Footer({ children: [new Paragraph('')] }) },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(path.join(__dirname, 'out', 'book-raw.docx'), buf);
  console.log('docx bytes', buf.length, 'blocks', children.length);
});
