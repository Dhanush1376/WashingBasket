// Renders pages.js to book.html (A4 landscape, one div per page).
const fs = require('fs');
const { META } = require('./pages');
const { logo, lockup, wordmark, esc, mono, ph } = require('./lib');

const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const TAGS = { verified: 'Verified', proposed: 'Proposed', rule: 'Rule', finding: 'Finding' };

// page numbers & toc (markers start a section without a divider page)
const all = require('./pages').pages;
const pages = all.filter((p) => p.layout !== 'marker');
pages.forEach((p, i) => (p.no = i + 1));
const sections = [];
let cur = null;
all.forEach((p, i) => {
  if (p.layout === 'divider' || p.layout === 'marker') {
    const next = p.layout === 'divider' ? p : all.slice(i + 1).find((q) => q.layout !== 'marker');
    cur = { num: p.num, title: p.title, no: next.no, subs: [] };
    sections.push(cur);
    if (p.layout === 'marker') next.sectionStart = { num: p.num, title: p.title };
  } else if (cur && p.title && p.layout !== 'back' && p.id !== 'appendix') cur.subs.push({ t: p.title, no: p.no });
});

function block(b) {
  const span = b.span ? ` style="grid-column:span ${b.span}"` : '';
  switch (b.t) {
    case 'p': return `<p class="p"${span}>${md(b.text)}</p>`;
    case 'lead': return `<p class="lead">${md(b.text)}</p>`;
    case 'h': return `<h4 class="h">${esc(b.text)}</h4>`;
    case 'list': return `<ul class="list">${b.items.map((i) => `<li>${md(i)}</li>`).join('')}</ul>`;
    case 'table': return `<table class="tbl"><colgroup>${b.widths.map((w) => `<col style="width:${w}%">`).join('')}</colgroup><thead><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c, i) => `<td${i === 0 ? ' class="b"' : ''}>${md(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    case 'fig': return `<figure class="fig" style="height:${b.h}mm" data-fig="${b.id}"><div class="fig__in">${b.html}</div></figure>${b.caption ? `<figcaption class="cap">${esc(b.caption)}</figcaption>` : ''}`;
    case 'note': return `<div class="note note--${b.kind}"><span class="tag tag--${b.kind}">${TAGS[b.kind]}</span><p>${md(b.text)}</p></div>`;
    case 'kv': return `<dl class="kv">${b.items.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${md(v)}</dd>`).join('')}</dl>`;
    case 'quote': return `<blockquote class="quote ${b.small ? 'quote--s' : ''}">${md(b.text)}</blockquote>`;
    case 'code': return `<pre class="code">${esc(b.text)}</pre>`;
    case 'cols': return `<div class="cols cols--${b.items.length}">${b.items.map((c) => `<div>${c.map(block).join('')}</div>`).join('')}</div>`;
    case 'stack': return `<div class="stack">${b.items.map(block).join('')}</div>`;
    case 'span': return `<div class="spanall">${b.items.map(block).join('')}</div>`;
    case 'grid3': return `<div class="g3">${b.items.map((i) => `<div class="g3__i g3--${i.tag}"><span class="tag tag--${i.tag}">${TAGS[i.tag]}</span><h5>${esc(i.title)}</h5><p>${md(i.text)}</p></div>`).join('')}</div>`;
    case 'finding': return `<div class="fnd"><div class="fnd__n">${b.n}</div><div><h5>${esc(b.title)}</h5><p>${md(b.text)}</p><p class="fnd__fix"><b>Resolve:</b> ${md(b.fix)}</p></div></div>`;
    case 'pillar': return `<div class="pil"><span class="pil__l">${esc(b.label)}</span><h3>${esc(b.title)}</h3><p>${md(b.text)}</p><span class="tag tag--${b.tag}">${TAGS[b.tag]}</span></div>`;
    case 'values': return `<div class="vals">${b.items.map(([n, d, e], i) => `<div class="val"><span class="val__n">0${i + 1}</span><h5>${n}</h5><p>${md(d)}</p><em>Evidence: ${esc(e)}</em></div>`).join('')}</div>`;
    case 'check': return `<div class="chk"><h5>${esc(b.title)}</h5><ul>${b.items.map((i) => `<li><i></i>${md(i)}</li>`).join('')}</ul></div>`;
    default: throw new Error('unknown block ' + b.t);
  }
}

const run = (p) => `<div class="run"><span>${lockup(11)}</span><span class="run__s">${p.sectionStart ? `<b class="secno">${p.sectionStart.num}</b> ` : ''}${esc(p.section || '')}</span></div>`;
const foot = (p, dark) => `<div class="foot ${dark ? 'foot--d' : ''}"><span>${esc(META.brand)} · Brand Identity Guidelines · v${META.version}</span><span class="foot__n">${String(p.no).padStart(2, '0')}</span></div>`;

function page(p) {
  switch (p.layout) {
    case 'cover':
      return `<section class="page cover"><div class="cover__l"><div class="cover__lk">${lockup(26)}</div><div><div class="cover__k">Brand Identity &amp; Visual Design Guidelines</div><h1 class="cover__t">Collected.<br>Cleaned.<br>Returned.</h1><div class="cover__m">Version ${META.version} · ${META.date}</div></div></div><div class="cover__r"><div class="cover__bands"><i style="background:#FE8701"></i><i style="background:#D30D24"></i><i style="background:#013E86"></i></div><div class="cover__mark">${logo({ h: 330 })}</div></div></section>`;
    case 'divider':
      return `<section class="page div" style="background:${p.bg};color:${p.fg}"><div class="div__l"><div class="div__num">${p.num}</div><h2 class="div__t">${esc(p.title)}</h2><ul class="div__list">${p.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div><div class="div__r">${
        p.ph ? `<div class="div__ph">${ph({ ...p.ph, bg: p.bg })}</div>` : p.plate ? `<img src="img/${p.plate}">` : p.logoDivider ? `<div class="div__mark">${logo({ h: 360, c: { navy: '#FFFFFF', knock: '#013E86' } })}</div>` : `<div class="div__aa"><span style="font-family:Inter;font-weight:700">Aa</span><span style="font-family:Inter;font-weight:500">Aa</span></div>`
      }</div>${foot(p, isDarkHex(p.bg))}</section>`;
    case 'toc':
      return `<section class="page std">${run(p)}<div class="toc"><div class="toc__h"><div class="kick">${esc(p.kicker)}</div><h2 class="title">Contents</h2><p class="lead">Front matter: about this edition (2), how to use this book (4), identity audit (5–6).</p></div><div class="toc__g">${sections.map((s) => `<div class="toc__s"><div class="toc__n">${s.num}</div><div><div class="toc__t"><span>${esc(s.title)}</span><b>${s.no}</b></div><ul>${s.subs.map((x) => `<li><span>${esc(x.t)}</span><em>${x.no}</em></li>`).join('')}</ul></div></div>`).join('')}<div class="toc__s"><div class="toc__n">A</div><div><div class="toc__t"><span>Appendix · tokens and assets</span><b>${pages.find((x) => x.id === 'appendix').no}</b></div></div></div></div></div>${foot(p)}</section>`;
    case 'manifesto':
      return `<section class="page mani">${run(p)}<div class="mani__in"><div class="kick" style="color:#FFA742">${esc(p.kicker)}</div><div class="mani__lines">${p.lines.map((l, i) => `<p class="${i === p.lines.length - 1 ? 'last' : ''}">${esc(l)}</p>`).join('')}</div><div class="note note--proposed" style="max-width:120mm;background:rgba(255,255,255,.06);border-color:#FFA742"><span class="tag tag--proposed">Proposed</span><p style="color:#fff">${esc(p.note)}</p></div></div>${foot(p, true)}</section>`;
    case 'split-img':
      return `<section class="page std split">${run(p)}<div class="split__g"><div class="split__img" style="background:${p.imgBg}"><img src="img/${p.img}"></div><div class="split__t"><div class="kick">${esc(p.kicker)}</div><h2 class="title">${esc(p.title)}</h2>${p.body.map(block).join('')}</div></div>${foot(p)}</section>`;
    case 'back':
      return `<section class="page back"><div class="back__mark">${logo({ h: 150, c: { navy: '#FFFFFF', knock: '#012A5C' } })}</div><div class="back__wm">${wordmark(40, '#FFFFFF')}</div><div class="back__t">Collected. Cleaned. Returned.</div><div class="back__m">Brand Identity &amp; Visual Design Guidelines · Version ${META.version} · ${META.date}<br>Questions about the brand: Washing Basket brand &amp; product team</div></section>`;
    case 'side':
      return `<section class="page std">${run(p)}<div class="side"><div class="side__l"><div class="kick">${esc(p.kicker)}</div><h2 class="title">${esc(p.title)}</h2>${p.lead ? `<p class="lead">${md(p.lead)}</p>` : ''}${(p.side || []).map(block).join('')}</div><div class="side__r">${p.body.map(block).join('')}</div></div>${foot(p)}</section>`;
    case 'top':
      return `<section class="page std">${run(p)}<div class="top"><div class="top__h"><div><div class="kick">${esc(p.kicker)}</div><h2 class="title">${esc(p.title)}</h2></div>${p.lead ? `<p class="lead">${md(p.lead)}</p>` : ''}</div><div class="top__b ${p.cols ? 'top__b--' + p.cols : ''}">${p.body.map(block).join('')}</div></div>${foot(p)}</section>`;
  }
  throw new Error('layout ' + p.layout);
}
function isDarkHex(h) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.55;
}

const css = fs.readFileSync(__dirname + '/book.css', 'utf8');
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Washing Basket — Brand Identity Guidelines</title><style>${css}</style></head><body>${pages.map(page).join('\n')}</body></html>`;
fs.writeFileSync(__dirname + '/book.html', html);
fs.writeFileSync(__dirname + '/toc.json', JSON.stringify(sections, null, 1));
console.log('pages', pages.length);
