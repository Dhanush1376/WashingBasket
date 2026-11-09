// Shared helpers: logo geometry (from website/src/logoGeometry.ts, the product's own trace), colour maths.
const fs = require('fs');
const path = require('path');

const geoSrc = fs.readFileSync(require('path').resolve(__dirname, '../../../../website/src/logoGeometry.ts'), 'utf8');
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

function wordmark(size = 24, color = '#0A1C3E') {
  return `<span class="wm" style="font-size:${size}px;color:${color}"><b>W</b>ashing<b>B</b>asket</span>`;
}
/** Horizontal lockup, proportions from CinematicLogoLockup.tsx: mark 82 / gap 12 / font 24 (caps ×1.22). */
function lockup(font = 24, { color = '#0A1C3E', c, knock } = {}) {
  const mw = (82 / 24) * font;
  return `<span class="lockup" style="gap:${(12 / 24) * font}px">${logo({ w: mw, c: c || (knock ? { knock } : {}) })}${wordmark(font, color)}</span>`;
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

module.exports = { PARTS, VB, BRAND, logo, mono, wordmark, lockup, hex2rgb, cmyk, contrast, grade, isDark, esc, img };
