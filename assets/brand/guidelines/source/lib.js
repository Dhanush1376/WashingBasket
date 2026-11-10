// Shared helpers: logo geometry (from website/src/logoGeometry.ts, the product's own trace), colour maths.
const fs = require('fs');
const path = require('path');

const geoSrc = fs.readFileSync(process.env.LOGO_GEOMETRY || path.resolve(__dirname, '../../../../website/src/logoGeometry.ts'), 'utf8');
const PARTS = {};
for (const m of geoSrc.matchAll(/(\w+): \{\s*box: \{ x: (\d+), y: (\d+), w: (\d+), h: (\d+) \},\s*d: '([^']+)'/g)) {
  PARTS[m[1]] = { box: { x: +m[2], y: +m[3], w: +m[4], h: +m[5] }, d: m[6] };
}
const VB = { x: 237, y: 214, w: 776, h: 787 };

const BRAND = { orange: '#FE8701', red: '#D30D24', navy: '#013E86' };

/** The mark as inline SVG. c = {orange, red, navy, knock}; knock is the towel knockout (= background). */
function logo({ h = 100, w, c = {}, extra = '', cls = '', style = '' } = {}) {
  const o = c.orange || BRAND.orange, r = c.red || BRAND.red, n = c.navy || BRAND.navy, k = c.knock || '#FFFFFF';
  const height = w ? (w * VB.h) / VB.w : h;
  const width = w || (h * VB.w) / VB.h;
  const P = PARTS;
  return `<svg class="${cls}" style="${style}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" xmlns="http://www.w3.org/2000/svg">
<path d="${P.basket.d}" fill="${o}" fill-rule="evenodd"/><path d="${P.basketRim.d}" fill="${o}"/>
<path d="${P.towel.d}" fill="${k}" stroke="${k}" stroke-width="16" stroke-linejoin="round"/><path d="${P.towel.d}" fill="${n}"/>
<path d="${P.clothOrange.d}" fill="${o}"/><path d="${P.clothRed.d}" fill="${r}"/>
<path d="${P.sparkleLarge.d}" fill="${n}"/><path d="${P.sparkleSmall.d}" fill="${n}"/>${extra}</svg>`;
}
const mono = (col, knock) => ({ orange: col, red: col, navy: col, knock });

// The wordmark is the website's own setting (site.css .brand-title: caps 500 at 1.25em, rest 600 at 0.72em),
// outlined to paths by wordmark.py so it never depends on an installed font.
const WM = JSON.parse(fs.readFileSync(path.join(__dirname, 'wordmark.json'), 'utf8'));
const WM_TOP = -1.091, WM_H = 1.251; // symmetric about the cap-height centre, so it centres on the mark
function wordmark(size = 24, color = '#0A1C3E') {
  return `<svg class="wm" width="${(WM.w * size).toFixed(1)}" height="${(WM_H * size).toFixed(1)}" viewBox="0 ${WM_TOP} ${WM.w} ${WM_H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="WashingBasket"><path d="${WM.d}" fill="${color}"/></svg>`;
}
/** Horizontal lockup as the product shows it: mark height = 2.28 × size, gap 0.47 × size, caps centred on the mark. */
function lockup(font = 24, { color = '#0A1C3E', c, knock } = {}) {
  return `<span class="lockup" style="gap:${(0.47 * font).toFixed(1)}px">${logo({ h: 2.28 * font, c: c || (knock ? { knock } : {}) })}${wordmark(font, color)}</span>`;
}

// colour maths
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function cmyk(h) {
  const [r, g, b] = hex2rgb(h).map((v) => v / 255);
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 100];
  return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k].map((v) => Math.round(v * 100));
}
function lum(h) {
  return hex2rgb(h)
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
    .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
const grade = (r) => (r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA Large' : 'Fail');
const isDark = (h) => lum(h) < 0.33;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const img = (name) => `img/${name}`;

/** Image placeholder: where no existing asset fits exactly, the page carries the brief for the image to be made.
 *  o = { file, title, prompt, size, bg } */
function ph(o) {
  const dark = o.bg && isDark(o.bg);
  return `<div class="ph ${dark ? 'ph--d' : ''}" style="${o.bg ? `background:${o.bg};` : ''}"><div class="ph__k"><span class="ph__ic"></span>Image to generate</div><div class="ph__t">${esc(o.title)}</div><p class="ph__p">${esc(o.prompt)}</p><div class="ph__s"><b>File</b> ${esc(o.file)}<br><b>Size</b> ${esc(o.size)}</div></div>`;
}
const phGrid = (list, cols = list.length) => `<div class="phg" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">${list.map(ph).join('')}</div>`;

module.exports = { ph, phGrid, PARTS, VB, BRAND, logo, mono, wordmark, lockup, hex2rgb, cmyk, contrast, grade, isDark, esc, img };
