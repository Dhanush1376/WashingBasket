// The book's content. One source for the PDF and the DOCX.
// Block types: p, lead, h, list, table, fig, note(verified|proposed|rule|finding), kv, quote.
const { PARTS, VB, logo, mono, wordmark, lockup, cmyk, hex2rgb, contrast, grade, isDark, esc } = require('./lib');

const META = {
  brand: 'Washing Basket',
  title: 'Brand Identity & Visual Design Guidelines',
  version: '1.0',
  date: '10 November 2026',
  status: 'Version 1.0 — documents the identity as built; proposals marked for approval',
  owner: 'Washing Basket brand & product team',
};

/* ───────────── colour data (every value read from the codebase) ───────────── */
const C = {
  navy: { name: 'Basket Navy', hex: '#013E86', src: 'theme brand.navy · sampled from logo', use: 'Logo sparkles and towel; links, focus rings, structure, dark offer tickets.' },
  logoOrange: { name: 'Logo Orange', hex: '#FE8701', src: 'theme brand.logoOrange · sampled from logo', use: 'The basket and orange cloth in the logo. Reserved for the mark.' },
  red: { name: 'Cloth Red', hex: '#D30D24', src: 'theme brand.red · sampled from logo', use: 'The red cloth in the logo; the “Cleaned.” brand band; seasonal tickets.' },
  ink: { name: 'Ink', hex: '#0A1C3E', src: 'theme colors.ink', use: 'All primary text, the wordmark, dark buttons and dark stat cards.' },
  orange: { name: 'Action Orange', hex: '#FFA742', src: 'theme brand.orange / colors.cta', use: 'Primary buttons, wallet card, highlights, selection, active accents.' },
  navyDeep: { name: 'Deep Navy', hex: '#012A5C', src: 'theme app.navyDeep · site --navy-deep', use: 'Drawer, dark cards, website footer, pressed dark surfaces.' },
};
const SHADES = [
  ['Soft Blue', '#54B6F8', 'Blue Tint', '#EBF6FE', 'Towel and sparkle echo; info surfaces, calendar highlights.'],
  ['Soft Orange', '#FFA742', 'Orange Tint', '#FFF4E8', 'Warmth; CTA, offer and wallet surfaces.'],
  ['Soft Green', '#62D487', 'Green Tint', '#EBF9F0', 'Fresh and delivered; completed states.'],
  ['Soft Red', '#F87C87', 'Red Tint', '#FEF0F2', 'Cancelled and error surfaces, gentle alerts.'],
  ['Soft Gold', '#FED843', 'Gold Tint', '#FFFBEA', 'Warm highlights, rewards, referral moments.'],
];
const NEUTRALS = [
  ['White', '#FFFFFF', 'App canvas, cards, sheets'],
  ['Ivory', '#FBF9F4', 'Website canvas (--ivory)'],
  ['Paper', '#F5F1E8', 'Website panels (--paper)'],
  ['Stone', '#EAE6DB', 'Website deep panels (--stone)'],
  ['Field', '#F4F2EB', 'Resting text-field fill'],
  ['Subtle', '#F4F5F7', 'Secondary surfaces (app.cream)'],
  ['Admin Canvas', '#F8F9FA', 'Admin portal background'],
  ['Line', '#E3E6EB', 'Hairlines and dividers'],
  ['Line Strong', '#CBD5E1', 'Input borders, table rules'],
  ['Ink Muted', '#667085', 'Captions, helper text'],
  ['Ink Soft', '#5B6475', 'Body copy, labels'],
  ['Ink', '#0A1C3E', 'Headings, primary text'],
];
const SEMANTIC = [
  ['Success', '#12AD2B', '#EBF9F0', 'Paid, delivered, live. “Parrot green: bright and unmistakably positive.”'],
  ['Warning', '#B97800', '#FFF4D9', 'Pending payment, slot nearly full, needs attention.'],
  ['Danger', '#C8102E', '#FEF0F2', 'Errors, failed payments, cancelled orders, destructive actions.'],
  ['Information', '#013E86', '#EEF3FB', 'Navy doubles as the info colour (navyTint surface).'],
];
const PLATES = [
  ['Collect', '#FD4C14', 'plate1.jpg'],
  ['Wash', '#FD6801', 'plate2.jpg'],
  ['Dry', '#FEA902', 'plate3.jpg'],
  ['Iron', '#FEC503', 'plate4.jpg'],
  ['Pack', '#013888', 'plate5.jpg'],
  ['Return', '#FECF04', 'plate6.jpg'],
];

const rgbStr = (h) => hex2rgb(h).join(' · ');
const cmykStr = (h) => cmyk(h).join(' · ');
const txtOn = (h) => (isDark(h) ? '#FFFFFF' : '#0A1C3E');

function swatch(c, { big = false, h = 0 } = {}) {
  const t = txtOn(c.hex);
  return `<div class="sw ${big ? 'sw--big' : ''}" style="background:${c.hex};color:${t};${h ? `height:${h}mm` : ''}${c.hex === '#FFFFFF' ? ';box-shadow:inset 0 0 0 1px #E3E6EB' : ''}">
  <div class="sw__name">${esc(c.name)}</div>
  <div class="sw__vals"><span>HEX</span>${c.hex}<br><span>RGB</span>${rgbStr(c.hex)}<br><span>CMYK</span>${cmykStr(c.hex)}</div></div>`;
}

const tag = (k) => `<span class="tag tag--${k}">${{ verified: 'Verified', proposed: 'Proposed', rule: 'Rule', finding: 'Finding' }[k]}</span>`;

/* ───────────── small figure builders ───────────── */
const imgTag = (n, style = '') => `<img src="img/${n}" style="${style}">`;
const tile = (inner, bg = '#FFFFFF', label = '', extra = '') =>
  `<div class="tile" style="background:${bg};${extra}"><div class="tile__in">${inner}</div>${label ? `<div class="tile__lbl" style="color:${txtOn(bg)}">${label}</div>` : ''}</div>`;
const dontTile = (inner, label, bg = '#FFFFFF') =>
  `<div class="tile tile--dont" style="background:${bg}"><div class="tile__in">${inner}</div><div class="tile__lbl"><b class="x">✕</b> ${label}</div></div>`;
const doTile = (inner, label, bg = '#FFFFFF') =>
  `<div class="tile tile--do" style="background:${bg}"><div class="tile__in">${inner}</div><div class="tile__lbl" style="color:${txtOn(bg)}"><b class="ok">✓</b> ${label}</div></div>`;

function partialLogo(h, keep, colors) {
  const P = PARTS;
  const col = { basket: colors.orange, basketRim: colors.orange, towel: colors.navy, clothOrange: colors.orange, clothRed: colors.red, sparkleLarge: colors.navy, sparkleSmall: colors.navy };
  // crop the viewBox to the kept parts so each part fills its space
  const bx = keep.map((k) => P[k].box);
  const x0 = Math.min(...bx.map((b) => b.x)) - 10, y0 = Math.min(...bx.map((b) => b.y)) - 10;
  const x1 = Math.max(...bx.map((b) => b.x + b.w)) + 10, y1 = Math.max(...bx.map((b) => b.y + b.h)) + 10;
  const full = keep.length >= 5;
  const vb = full ? [VB.x, VB.y, VB.w, VB.h] : [x0, y0, x1 - x0, y1 - y0];
  const w = (h * vb[2]) / vb[3];
  return `<svg width="${w}" height="${h}" viewBox="${vb.join(' ')}">${keep
    .map((k) => `<path d="${P[k].d}" fill="${col[k]}" ${k === 'basket' ? 'fill-rule="evenodd"' : ''}/>`)
    .join('')}</svg>`;
}

/* construction diagram: logo with bounding boxes of each part, in logo units */
function constructionSVG() {
  const P = PARTS;
  const boxes = ['basketRim', 'basket', 'towel', 'clothOrange', 'clothRed', 'sparkleLarge', 'sparkleSmall'];
  const labels = { basketRim: 'Rim', basket: 'Basket', towel: 'Towel', clothOrange: 'Orange cloth', clothRed: 'Red cloth', sparkleLarge: 'Sparkle L', sparkleSmall: 'Sparkle S' };
  const pad = 250;
  const vb = `${VB.x - pad} ${VB.y - 60} ${VB.w + pad * 2} ${VB.h + 120}`;
  let g = '';
  // grid of 1/8 units of width
  for (let i = 0; i <= 8; i++) {
    const x = VB.x + (VB.w * i) / 8;
    g += `<line x1="${x}" y1="${VB.y - 40}" x2="${x}" y2="${VB.y + VB.h + 40}" stroke="#54B6F8" stroke-width="1.5" opacity=".45"/>`;
  }
  for (let i = 0; i <= 8; i++) {
    const y = VB.y + (VB.h * i) / 8;
    g += `<line x1="${VB.x - 40}" y1="${y}" x2="${VB.x + VB.w + 40}" y2="${y}" stroke="#54B6F8" stroke-width="1.5" opacity=".45"/>`;
  }
  let b = '';
  for (const k of boxes) {
    const { x, y, w, h } = P[k].box;
    b += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#0A1C3E" stroke-width="2" stroke-dasharray="8 6"/>`;
  }
  const lab = (k, side, dy = 0) => {
    const { x, y, w, h } = P[k].box;
    const ly = y + h / 2 + dy;
    const lx = side === 'l' ? VB.x - 40 : VB.x + VB.w + 40;
    const ax = side === 'l' ? x : x + w;
    return `<line x1="${ax}" y1="${ly}" x2="${lx}" y2="${ly}" stroke="#0A1C3E" stroke-width="1.5"/><circle cx="${ax}" cy="${ly}" r="6" fill="#0A1C3E"/><text x="${side === 'l' ? lx - 10 : lx + 10}" y="${ly + 9}" text-anchor="${side === 'l' ? 'end' : 'start'}" font-family="Inter" font-size="26" font-weight="600" fill="#0A1C3E">${labels[k]}</text>`;
  };
  const labs = lab('clothOrange', 'l') + lab('clothRed', 'l') + lab('towel', 'l', 40) + lab('basket', 'l', 60) + lab('sparkleLarge', 'r', -40) + lab('sparkleSmall', 'r', 30) + lab('basketRim', 'r');
  const dim = `<line x1="${VB.x}" y1="${VB.y + VB.h + 30}" x2="${VB.x + VB.w}" y2="${VB.y + VB.h + 30}" stroke="#FE8701" stroke-width="3"/><text x="${VB.x + VB.w / 2}" y="${VB.y + VB.h + 62}" text-anchor="middle" font-family="Inter" font-size="24" font-weight="700" fill="#FE8701">776 u (1.000)</text>
  <line x1="${VB.x + VB.w + 25}" y1="${VB.y}" x2="${VB.x + VB.w + 25}" y2="${VB.y + VB.h}" stroke="#FE8701" stroke-width="3" opacity="0"/>`;
  return `<svg viewBox="${vb}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${g}${logo({ w: VB.w }).replace(/<svg[^>]*>/, '').replace('</svg>', '').replace(/fill="#FE8701"/g, 'fill="#FE8701" opacity=".92"')}${b}${labs}${dim}</svg>`;
}

function clearSpaceSVG() {
  const x = PARTS.sparkleSmall.box.h; // 122u
  const vb = `${VB.x - x - 20} ${VB.y - x - 20} ${VB.w + 2 * x + 40} ${VB.h + 2 * x + 40}`;
  const inner = logo({ w: VB.w }).replace(/<svg[^>]*>/, '').replace('</svg>', '');
  const xs = (cx, cy) => `<g transform="translate(${cx},${cy}) scale(${x / PARTS.sparkleSmall.box.h})"><path d="${PARTS.sparkleSmall.d}" transform="translate(${-PARTS.sparkleSmall.box.x},${-PARTS.sparkleSmall.box.y})" fill="#54B6F8" opacity=".7"/></g>`;
  return `<svg viewBox="${vb}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
  <rect x="${VB.x - x}" y="${VB.y - x}" width="${VB.w + 2 * x}" height="${VB.h + 2 * x}" fill="#EBF6FE" stroke="#54B6F8" stroke-width="3" stroke-dasharray="10 8"/>
  <rect x="${VB.x}" y="${VB.y}" width="${VB.w}" height="${VB.h}" fill="#FFFFFF"/>
  ${inner}
  ${xs(VB.x - x, VB.y - x)}${xs(VB.x + VB.w, VB.y - x)}${xs(VB.x - x, VB.y + VB.h)}${xs(VB.x + VB.w, VB.y + VB.h)}
  <text x="${VB.x - x / 2}" y="${VB.y + VB.h / 2}" text-anchor="middle" font-family="Plus Jakarta Sans" font-weight="800" font-size="56" fill="#013E86">x</text>
  <text x="${VB.x + VB.w + x / 2}" y="${VB.y + VB.h / 2}" text-anchor="middle" font-family="Plus Jakarta Sans" font-weight="800" font-size="56" fill="#013E86">x</text>
  <text x="${VB.x + VB.w / 2}" y="${VB.y - x / 2 + 18}" text-anchor="middle" font-family="Plus Jakarta Sans" font-weight="800" font-size="56" fill="#013E86">x</text>
  <text x="${VB.x + VB.w / 2}" y="${VB.y + VB.h + x / 2 + 18}" text-anchor="middle" font-family="Plus Jakarta Sans" font-weight="800" font-size="56" fill="#013E86">x</text></svg>`;
}

/* icons: paths copied from mobile/src/components/ui/icons.tsx and common app glyphs */
const ICONS = [
  ['Chevron down', '<path d="M6 9l6 6 6-6"/>'],
  ['Chevron left', '<path d="M15 18l-6-6 6-6"/>'],
  ['Check', '<path d="M5 12.5l4.5 4.5L19 7.5"/>'],
  ['Alert', '<path d="M12 21a9 9 0 100-18 9 9 0 000 18z"/><path d="M12 7.5v5.5M12 16.4v.1"/>'],
  ['Shield check', '<path d="M12 3l7 3v5.5c0 4.3-3 8-7 9.5-4-1.5-7-5.2-7-9.5V6l7-3z"/><path d="M9 12l2.2 2.2L15.5 10"/>'],
  ['Close', '<path d="M18 6L6 18M6 6l12 12"/>'],
];
const icon = (d, { s = 40, c = '#0A1C3E', w = 2 } = {}) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

/* ───────────── UI component replicas (tokens from mobile/src/theme) ───────────── */
const ui = {
  btnPrimary: (t = 'Book now') => `<div class="u-btn u-btn--orange">${t}</div>`,
  btnDark: (t = 'Continue') => `<div class="u-btn u-btn--ink">${t}</div>`,
  btnOutline: (t = 'View all') => `<div class="u-btn u-btn--outline">${t}</div>`,
  btnGhost: (t = 'Skip') => `<div class="u-btn u-btn--ghost">${t}</div>`,
  field: (ph = 'Mobile number', focus = false) => `<div class="u-field ${focus ? 'u-field--focus' : ''}"><span class="u-field__pre">+91 <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0A1C3E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle"><path d="M6 9l6 6 6-6"/></svg></span>${ph}</div>`,
  chip: (t, on) => `<span class="u-chip ${on ? 'u-chip--on' : ''}">${t}</span>`,
  badge: (t, fg, bg) => `<span class="u-badge" style="color:${fg};background:${bg}"><i style="background:${fg}"></i>${t}</span>`,
};

/* ───────────── pages ───────────── */
const pages = [];
const P = (p) => pages.push(p);

/* 00 — front matter */
P({ id: 'cover', layout: 'cover', title: META.title });

P({
  id: 'docinfo', section: 'Front matter', layout: 'side', kicker: 'Document information', title: 'About this edition',
  lead: 'The official reference for how Washing Basket looks, sounds and behaves across its app, admin portal, website and everything printed or worn.',
  side: [{ t: 'note', kind: 'rule', text: 'This book documents the identity that already exists in the product. Nothing in it replaces the approved logo or invents official colours.' }],
  body: [
    { t: 'kv', items: [
      ['Brand', 'Washing Basket'],
      ['Document', META.title],
      ['Version', `${META.version} — first edition`],
      ['Date', META.date],
      ['Status', 'Approved elements documented; proposals awaiting sign-off'],
      ['Owner', META.owner],
      ['Audience', 'Designers, developers, marketing, content creators, agencies, new team members'],
      ['Formats', 'Editable Word (.docx) and print PDF (A4 landscape) carrying the same content'],
    ] },
    { t: 'h', text: 'Sources audited for this edition' },
    { t: 'table', head: ['Source', 'What it contributed'], widths: [34, 66], rows: [
      ['assets/brand/WashingBasket-logo.png', 'Master logo (1254 × 1254 px), sampled colour values'],
      ['website/src/logoGeometry.ts', 'Vector trace of the mark used to draw every logo in this book'],
      ['mobile/src/theme/index.ts', 'Colour, type, radius, spacing and elevation tokens'],
      ['admin/src/theme/tokens.ts · website/src/styles/base.css', 'Portal and website token mappings'],
      ['mobile/src/components/logo/*', 'Wordmark, lockup proportions, logo animation timings'],
      ['assets/artwork · assets/illustrations · assets/avatars', 'Illustration systems and characters'],
      ['website/src/content.ts', 'Positioning, services, prices and real customer-facing copy'],
      ['Running product (website, admin, mobile web)', 'Screenshots captured 10 Nov 2026'],
    ] },
    { t: 'h', text: 'Revision history' },
    { t: 'table', head: ['Version', 'Date', 'Change'], widths: [16, 24, 60], rows: [['1.0', META.date, 'First edition, written from a full audit of the codebase and assets']] },
  ],
});

P({ id: 'toc', section: 'Front matter', layout: 'toc', kicker: 'Contents', title: 'Contents' });

P({
  id: 'howto', section: 'Front matter', layout: 'side', kicker: 'How to use this book', title: 'Verified, proposed, and rules',
  lead: 'Every page tells you how sure you can be. Some things are already in the product and approved. Some are recommendations to fill gaps the audit found.',
  body: [
    { t: 'grid3', items: [
      { tag: 'verified', title: 'Verified', text: 'Exists in the codebase or approved assets today. Values were read from source files or sampled from the master artwork. Use as-is.' },
      { tag: 'proposed', title: 'Proposed', text: 'A recommendation that fills a gap: a missing logo version, a rule nobody wrote down, a print application. Needs sign-off before it becomes official.' },
      { tag: 'rule', title: 'Rule', text: 'Mandatory. Breaking a rule makes the work off-brand regardless of how good it looks. Rules are collected again in the Governance checklists.' },
    ] },
    { t: 'note', kind: 'finding', text: '“Finding” marks an inconsistency or gap discovered during the audit, such as two places in the code that disagree. Each finding carries a recommended resolution.' },
    { t: 'h', text: 'Who should read what' },
    { t: 'table', head: ['Role', 'Start with'], widths: [30, 70], rows: [
      ['Designers', 'Logo (02), Colour (03), Typography (04), Illustration (05), Digital (08)'],
      ['Developers', 'Colour tokens (03), Type scale (04), Digital design system (08), Motion (09), Appendix tokens'],
      ['Marketing & content', 'Brand foundations (01), Applications (10), Voice (11)'],
      ['Agencies & freelancers', 'Logo (02), Illustration rules (05), Governance checklists (12)'],
    ] },
  ],
});

P({
  id: 'inventory', section: 'Front matter', layout: 'top', kicker: 'Identity audit', title: 'What the brand owns today',
  lead: 'An inventory of every identity element found in the repository, where it lives, and its condition.',
  body: [
    { t: 'table', head: ['Element', 'Location', 'Condition'], widths: [24, 44, 32], rows: [
      ['Primary mark (basket, clothes, sparkles)', 'assets/brand/WashingBasket-logo.png · admin/public/logo.png', 'Verified · PNG only, no master vector file'],
      ['Vector trace of the mark', 'website/src/logoGeometry.ts · mobile/src/components/logo/logoGeometry.ts', 'Verified · used by the product to draw and animate the logo'],
      ['Wordmark “WashingBasket”', 'mobile/src/components/logo/Wordmark.tsx · admin brand.css', 'Verified · typeset live in Plus Jakarta Sans, no outlined artwork'],
      ['Horizontal lockup', 'CinematicLogoLockup.tsx · admin sidebar · website nav', 'Verified'],
      ['Favicon', 'admin/public/favicon.png · website/public/favicon.png', 'Verified'],
      ['Mobile app icon & splash', 'mobile/assets/icon.png, android-icon-*.png, splash-icon.png', 'Finding · still the Expo template placeholder'],
      ['Colour tokens', 'mobile/src/theme/index.ts (source of truth for all three products)', 'Verified'],
      ['Fonts', 'Plus Jakarta Sans, Inter, Nunito, Courier Prime (Google Fonts, OFL)', 'Verified'],
      ['Process illustration plates (6)', 'assets/artwork/1–6.png · mobile/assets/scenes', 'Verified'],
      ['Status vignettes (10)', 'assets/illustrations · mobile/assets/illustrations', 'Verified'],
      ['Service illustrations (5)', 'mobile/assets/services', 'Verified'],
      ['Customer avatars (3)', 'assets/avatars (Ananya, Rahul, Sneha)', 'Verified'],
      ['Brand films & loops', 'hero-loop/, brand-film/, website/public/media', 'Verified · rendered from the plates'],
      ['Icon set', 'mobile/src/components/ui/icons.tsx · admin Icon.tsx', 'Verified · 24 px outline, 2 px stroke'],
      ['Photography', '—', 'None exists · illustration carries imagery'],
      ['Print & merchandise', '—', 'None exists · proposals in section 10'],
    ] },
  ],
});

P({
  id: 'findings', section: 'Front matter', layout: 'top', cols: 2, kicker: 'Identity audit', title: 'Findings and how to resolve them',
  lead: 'Places where the identity is incomplete or where two parts of the product disagree. None of these change the brand; they make it consistent.',
  body: [
    { t: 'finding', n: '01', title: 'No master vector logo', text: 'The only logo files are PNGs. The product draws the mark from a vector trace (logoGeometry.ts), which proves the shapes, but there is no signed-off SVG/PDF/EPS for print.', fix: 'Export the trace as the official SVG and EPS, check it against the PNG at 400%, and store it in assets/brand.' },
    { t: 'finding', n: '02', title: 'App icon is a placeholder', text: 'mobile/assets/icon.png and the Android adaptive icons are the Expo template (a blue chevron). The store listing would show no Washing Basket branding.', fix: 'Build the icon from the mark on a white tile (see page “Icon-only mark”) before store submission.' },
    { t: 'finding', n: '03', title: 'White text on Action Orange', text: 'Primary buttons put white text on #FFA742. That pair measures 1.9:1, below the 4.5:1 WCAG AA minimum for text.', fix: 'Use Ink (#0A1C3E) labels on Action Orange (9.3:1), or keep white text only at 18 px bold and above as a stopgap.' },
    { t: 'finding', n: '04', title: 'Wordmark font comment', text: 'theme/index.ts names Nunito Black as the wordmark font, but Wordmark.tsx, the lockup and the admin portal all set it in Plus Jakarta Sans.', fix: 'Plus Jakarta Sans is the shipped wordmark. Update the comment; keep Nunito out of the identity until a use is approved.' },
    { t: 'finding', n: '05', title: 'Two primary-button colours', text: 'The token says CTAs are Action Orange, while the sign-in “Continue” and admin “Sign in” buttons are Ink.', fix: 'Adopt the rule: Orange for the one commercial action on a screen (Book, Pay, Top up); Ink for flow steps (Continue, Sign in).' },
    { t: 'finding', n: '06', title: 'Placeholder contact details', text: 'Support email care@washingbasket.example is a placeholder domain.', fix: 'Replace with the live address before any print or store material uses it.' },
  ],
});

/* 01 — Brand foundations */
P({ id: 'd1', layout: 'divider', num: '01', section: 'Brand foundations', title: 'Brand foundations', plate: 'plate1.jpg', bg: '#FD4C14', fg: '#FFFFFF',
  items: ['Overview and story', 'Purpose, vision and mission', 'Values and personality', 'Positioning and audience', 'Manifesto'] });

P({
  id: 'overview', section: 'Brand foundations', layout: 'side', kicker: 'Brand overview', title: 'Clean clothes, without the laundry day.',
  lead: 'Washing Basket collects laundry at your door or a campus counter, washes, dries and irons it with care, and brings it back. Booked and followed in one app.',
  side: [{ t: 'note', kind: 'verified', text: 'Headline and description are the live website hero (website/src/content.ts).' }],
  body: [
    { t: 'fig', id: 'overview-fig', h: 62, caption: 'The five steps of every order, drawn as the brand’s process plates.', html: `<div class="strip">${PLATES.filter((p) => p[0] !== 'Pack').map((p) => `<div class="strip__i"><img src="img/${p[2]}"><span>${p[0]}</span></div>`).join('')}</div>` },
    { t: 'cols', items: [
      [{ t: 'h', text: 'What it is' }, { t: 'p', text: 'A digital laundry service with seven services, from **Only Wash at ₹45/kg** to dry cleaning, blankets, shoes and colour dye. Customers book, pay and track in a mobile app; staff run the counters with a QR scanner; operations run from an admin portal.' }],
      [{ t: 'h', text: 'Where it works' }, { t: 'p', text: 'Campus counters at **Lovely Professional University** and **NIT Jalandhar**, and doorstep pickup around **Model Town, Jalandhar**, in two-hour slots.' }],
      [{ t: 'h', text: 'Origin' }, { t: 'p', text: 'The brand was built for campus life, where laundry competes with lectures, labs and deadlines. Founding date, founders and early history are not recorded in the materials audited.' }, { t: 'note', kind: 'proposed', text: 'Add the founding story here once supplied. Do not invent one.' }],
    ] },
  ],
});

P({
  id: 'story', section: 'Brand foundations', layout: 'split-img', img: 'ill-worried-about-a-stained-shirt.jpg', imgBg: '#FFFFFF', kicker: 'Brand story', title: 'Campus life is full. Laundry should be simple.',
  body: [
    { t: 'quote', text: 'Lectures. Labs. Deadlines. Plans. And somewhere in between, the laundry that should never have been yours to worry about.' },
    { t: 'p', text: 'The story Washing Basket tells is not about washing machines. It is about **time and headspace**. A student with a stained shirt and a full week does not want a lesson in fabric care; they want the problem to disappear and come back folded.' },
    { t: 'p', text: 'So the service is built around three verbs, written on the website as a single brand moment: **Collected. Cleaned. Returned.** Everything else, from the app’s live progress timeline to the QR handover at the counter, exists to make those three words dependable.' },
    { t: 'note', kind: 'verified', text: 'Story lines, the four-word rhythm and the three brand bands are live on the website (STORY and BRAND in content.ts).' },
  ],
});

P({
  id: 'purpose', section: 'Brand foundations', layout: 'top', cols: 3, kicker: 'Purpose · Vision · Mission', title: 'Why we exist, where we are going',
  body: [
    { t: 'pillar', label: 'Purpose', title: 'Give people their time back.', text: 'Take laundry off the list of things a busy person has to think about, and return it cared for.', tag: 'proposed' },
    { t: 'pillar', label: 'Vision', title: 'Laundry as dependable as a utility.', text: 'Wherever students and families live, laundry day should be a tap in an app and a basket handed over, nothing more.', tag: 'proposed' },
    { t: 'pillar', label: 'Mission', title: 'Collect, care, return. Every order.', text: 'Run a counted, tracked, five-step process with hygiene, fabric care and professional handling, and show every step in the app.', tag: 'proposed' },
    { t: 'span', items: [
      { t: 'note', kind: 'proposed', text: 'No written purpose, vision or mission exists in the codebase. These statements are drafted from what the product demonstrably does and from the live “quality promise”: hygiene, fabric care and professional handling. Approve or edit before external use.' },
    ] },
  ],
});

P({
  id: 'values', section: 'Brand foundations', layout: 'top', kicker: 'Values & personality', title: 'Five values, one calm personality',
  body: [
    { t: 'values', items: [
      ['Care', 'Every piece counted in front of you, handled by fabric, checked on return.', 'Quality promise; QR item count'],
      ['Clarity', 'Prices shown in full before you book. Every stage visible in the app.', 'Price list; tracking timeline'],
      ['Reliability', 'Two-hour pickup slots, stated turnarounds: 48 h, 72 h, 5 days.', 'services.json; pickup slots'],
      ['Ease', 'Book in a minute, hand over your basket, get on with your week.', 'Website story copy'],
      ['Honesty', 'No invented numbers, awards or testimonials, ever.', 'Stated rule in content.ts'],
    ] },
    { t: 'h', text: 'Personality framework' },
    { t: 'table', head: ['', 'We are', 'We are not'], widths: [16, 42, 42], rows: [
      ['Feel', 'Warm, fresh, orderly. A folded stack of clean clothes.', 'Clinical, corporate, sterile.'],
      ['Sound', 'Calm, short, concrete. Full stops, plain verbs.', 'Hype, exclamation marks, slang overload.'],
      ['Behave', 'Helpful and transparent: show the price, show the step.', 'Pushy upsells, hidden fees, vague promises.'],
      ['Look', 'Flat, friendly illustration; bright primaries on calm neutrals.', 'Stock photos, glossy gradients, neon.'],
    ] },
    { t: 'note', kind: 'verified', text: 'Values are drawn from behaviour the product already shows; the evidence column cites where. The framework wording is new.' },
  ],
});

P({
  id: 'position', section: 'Brand foundations', layout: 'top', cols: 2, kicker: 'Positioning & audience', title: 'For people with full weeks',
  body: [
    { t: 'stack', items: [
      { t: 'h', text: 'Positioning statement' },
      { t: 'quote', small: true, text: 'For students and busy households who would rather not spend a day on laundry, Washing Basket is the laundry service that collects, cleans and returns your clothes, booked and tracked in one calm app, with every piece counted and every price shown up front.' },
      { t: 'h', text: 'Brand promise' },
      { t: 'p', text: '**Collected. Cleaned. Returned.** Your basket comes back the way you handed it over, only clean, on the day we said.' },
      { t: 'h', text: 'What sets it apart' },
      { t: 'list', items: ['Campus counters with QR handover, counted in front of you', 'Live, step-by-step order tracking in the app', 'Transparent per-kg and per-piece pricing before booking', 'Wallet, referrals and live offer codes built in', 'A warm illustrated world instead of generic laundry imagery'] },
    ] },
    { t: 'stack', items: [
      { t: 'h', text: 'Audience' },
      { t: 'table', head: ['Segment', 'Need', 'Where they meet us'], widths: [26, 40, 34], rows: [
        ['Hostel students (LPU, NITJ)', 'Quick, affordable, no-fuss laundry between classes', 'Campus counter, app'],
        ['Residents & families', 'Doorstep pickup that fits a schedule', 'Two-hour slots, Model Town'],
        ['Occasion & specialty', 'Dry cleaning, blankets, shoes, colour dye', 'Service catalogue'],
      ] },
      { t: 'h', text: 'Desired perception' },
      { t: 'p', text: 'Customers should describe Washing Basket as **“the one that just handles it.”** Dependable before delightful; friendly without being childish; modern without feeling like a tech company.' },
      { t: 'h', text: 'Emotional experience' },
      { t: 'p', text: 'Relief at hand-over, reassurance while tracking, and a small pleasure at return: the crisp, folded stack the logo itself depicts.' },
      { t: 'note', kind: 'proposed', text: 'Audience and positioning are derived from the product’s locations, services and copy; refine with customer research.' },
    ] },
  ],
});

P({ id: 'manifesto', section: 'Brand foundations', layout: 'manifesto', kicker: 'Manifesto', title: 'Manifesto',
  lines: ['Your week is full.', 'Lectures. Labs. Deadlines. Plans.', 'Laundry was never meant to be one more thing.', 'So hand us the basket.', 'We will count every piece in front of you,', 'wash it the way you chose,', 'dry it right through, never rushed,', 'press it, fold it, pack it,', 'and bring it back when we said we would.', 'No fuss. No guesswork. No laundry day.', 'Collected. Cleaned. Returned.'],
  note: 'Proposed manifesto. Built from live website lines (story, care steps and brand bands); approve before publishing.' });

/* 02 — Logo */
P({ id: 'd2', layout: 'divider', num: '02', section: 'Logo', title: 'Logo identity', logoDivider: true, bg: '#013E86', fg: '#FFFFFF',
  items: ['The mark and its anatomy', 'Symbolism', 'Construction and proportion', 'Wordmark and lockups', 'Clear space and minimum size', 'Colour versions and backgrounds', 'Misuse'] });

P({
  id: 'mark', section: 'Logo', layout: 'side', kicker: 'Primary logo', title: 'The mark',
  lead: 'A laundry basket holding two folded cloths, a towel draped over its rim, and two sparkles above. Four shapes, three colours, one idea: clean laundry, ready to hand back.',
  side: [{ t: 'note', kind: 'verified', text: 'Drawn here from the product’s own vector trace of the master PNG (logoGeometry.ts). Colours: Logo Orange #FE8701, Cloth Red #D30D24, Basket Navy #013E86.' }, { t: 'note', kind: 'rule', text: 'Never redraw, re-trace or “improve” the mark. Use supplied artwork only.' }],
  body: [{ t: 'fig', id: 'mark-hero', h: 150, html: `<div class="hero-mark">${logo({ h: 430 })}</div>` }],
});

P({
  id: 'anatomy', section: 'Logo', layout: 'top', cols: 2, kicker: 'Symbolism', title: 'What the mark says',
  body: [
    { t: 'fig', id: 'anatomy-fig', h: 128, html: `<div class="anat">${partialLogo(150, ['basket', 'basketRim'], { orange: '#FE8701' })}${partialLogo(150, ['towel'], { navy: '#013E86' })}${partialLogo(150, ['clothOrange', 'clothRed'], { orange: '#FE8701', red: '#D30D24' })}${partialLogo(150, ['sparkleLarge', 'sparkleSmall'], { navy: '#013E86' })}</div><div class="anat-l"><span>Basket</span><span>Towel</span><span>Folded cloths</span><span>Sparkles</span></div>` },
    { t: 'stack', items: [
      { t: 'kv', items: [
        ['Basket', 'The hand-over. The product is named after it and the customer’s first act is giving it to us. The grid of six openings reads as a sturdy, everyday object.'],
        ['Folded cloths', 'The result. Stacked orange over red, each ending in a rounded fold with a tucked line, they show laundry already done: washed, pressed, folded.'],
        ['Towel', 'A navy towel draped over the rim, separated by a white knockout so it reads as a soft object resting on a hard one.'],
        ['Sparkles', 'Clean. Two four-point stars, large and small, the universal shorthand for freshness, set where your eye ends its journey up the stack.'],
      ] },
      { t: 'p', text: '**Reading order.** The mark reads bottom to top: basket, clothes, sparkle. It tells the service in one glance: collected, cared for, clean.' },
      { t: 'note', kind: 'verified', text: 'Part names (basket, basketRim, towel, clothOrange, clothRed, sparkleLarge, sparkleSmall) are the product’s own layer names, used to animate the mark.' },
    ] },
  ],
});

P({
  id: 'construction', section: 'Logo', layout: 'side', kicker: 'Construction', title: 'Geometry and proportion',
  lead: 'Measured in logo units (u) from the product trace. The mark is almost square: 776 u wide × 787 u tall.',
  side: [
    { t: 'table', head: ['Part', 'W × H (u)', 'Share of height'], widths: [38, 32, 30], rows: [
      ['Whole mark', '776 × 787', '100%'],
      ['Basket incl. rim', '776 × 364', '46%'],
      ['Rim bar', '776 × 75', '10%'],
      ['Red cloth', '509 × 139', '18%'],
      ['Orange cloth', '448 × 149', '19%'],
      ['Sparkle large', '169 × 179', '23%'],
      ['Sparkle small', '113 × 122', '16%'],
    ] },
    { t: 'p', text: 'All terminals are round. The rim and cloths are capsule-ended bars; the basket body tapers inward toward a radius at the foot. There are no sharp corners outside the sparkle points.' },
    { t: 'note', kind: 'verified', text: 'Dimensions are bounding boxes from logoGeometry.ts. The 8 × 8 grid is a measuring aid, not a construction grid the mark was drawn on.' },
  ],
  body: [{ t: 'fig', id: 'construct-fig', h: 160, html: `<div class="construct">${constructionSVG()}</div>` }],
});

P({
  id: 'lockups', section: 'Logo', layout: 'top', kicker: 'Wordmark & lockups', title: 'Wordmark and lockups',
  body: [
    { t: 'fig', id: 'lockup-fig', h: 74, html: `<div class="lockups">
      <div class="lk lk--wide"><div class="lk__art">${lockup(34)}</div><div class="lk__l">${tag('verified')} Primary horizontal lockup</div></div>
      <div class="lk"><div class="lk__art lk__art--stack">${logo({ h: 82 })}<div style="height:8px"></div>${wordmark(22)}</div><div class="lk__l">${tag('proposed')} Stacked lockup</div></div>
      <div class="lk"><div class="lk__art">${logo({ h: 104 })}</div><div class="lk__l">${tag('verified')} Mark only</div></div>
      <div class="lk"><div class="lk__art">${wordmark(26)}</div><div class="lk__l">${tag('verified')} Wordmark only</div></div></div>` },
    { t: 'cols', items: [
      [{ t: 'h', text: 'Wordmark specification' }, { t: 'kv', items: [['Typeface', 'Plus Jakarta Sans'], ['Weights', 'Bold 700; capitals W and B ExtraBold 800'], ['Capitals', 'Set 1.22× the lowercase size (1.28× in the animated app intro)'], ['Tracking', '−0.35 px at 24 px (≈ −0.015 em)'], ['Colour', 'Ink #0A1C3E; white on dark'], ['Spelling', 'Set solid: WashingBasket']] }],
      [{ t: 'h', text: 'Lockup proportions' }, { t: 'kv', items: [['Mark width', '3.42 × wordmark font size (82 px at 24 px)'], ['Gap', '0.5 × font size (12 px at 24 px)'], ['Alignment', 'Wordmark vertically centred on the mark'], ['Source', 'CinematicLogoLockup.tsx; admin sidebar and website nav']] }, { t: 'note', kind: 'rule', text: 'In running text always write the name as two words, “Washing Basket”. The solid form belongs to the wordmark only.' }],
      [{ t: 'h', text: 'When to use which' }, { t: 'list', items: ['Horizontal lockup: default for headers, nav bars, documents, signage.', 'Mark only: app icon, favicon, avatars, loaders, small spaces where the name is already present.', 'Wordmark only: rare; footers or legal lines where the mark appears elsewhere.', 'Stacked: square formats such as social avatars and packaging fronts (proposed).'] }],
    ] },
  ],
});

P({
  id: 'clearspace', section: 'Logo', layout: 'top', cols: 2, kicker: 'Clear space & minimum size', title: 'Give it room to breathe',
  body: [
    { t: 'fig', id: 'clear-fig', h: 120, html: `<div class="clear">${clearSpaceSVG()}</div>` },
    { t: 'stack', items: [
      { t: 'h', text: 'Clear space' },
      { t: 'p', text: 'Keep a margin of **x** on every side, where x is the height of the small sparkle (122 u, about 15% of the mark’s height). Nothing — text, edges, other logos — enters this zone. For the horizontal lockup, measure x from the mark and apply it around the whole lockup.' },
      { t: 'h', text: 'Minimum size' },
      { t: 'table', head: ['Version', 'Digital', 'Print'], widths: [40, 30, 30], rows: [
        ['Mark only', '24 px tall', '8 mm tall'],
        ['Horizontal lockup', '28 px tall (mark)', '10 mm tall (mark)'],
        ['Favicon', '16 px (simplified pixel version)', '—'],
      ] },
      { t: 'p', text: 'Below these sizes the knockout between towel and rim, and the tuck lines in the cloths, fill in. The product’s smallest live use is the 38 px admin sidebar mark.' },
      { t: 'note', kind: 'proposed', text: 'Clear space and minimum sizes are new rules derived from the mark’s geometry and from the smallest sizes the product already uses successfully.' },
    ] },
  ],
});

P({
  id: 'versions', section: 'Logo', layout: 'top', kicker: 'Colour versions', title: 'Colour versions',
  lead: 'Full colour is the default. Single-colour versions exist for situations where full colour cannot reproduce.',
  body: [
    { t: 'fig', id: 'versions-fig', h: 108, html: `<div class="tiles t4">
      ${tile(logo({ h: 120 }), '#FFFFFF', `${tag('verified')} Full colour on white`)}
      ${tile(logo({ h: 120, c: { knock: '#FBF9F4' } }), '#FBF9F4', `${tag('verified')} Full colour on ivory`)}
      ${tile(logo({ h: 120, c: { navy: '#FFFFFF', knock: '#012A5C' } }), '#012A5C', `${tag('proposed')} Reversed on deep navy`)}
      ${tile(logo({ h: 120, c: mono('#013E86', '#FFFFFF') }), '#FFFFFF', `${tag('proposed')} Navy monochrome`)}
      ${tile(logo({ h: 120, c: mono('#0A1C3E', '#FFFFFF') }), '#FFFFFF', `${tag('proposed')} Ink monochrome`)}
      ${tile(logo({ h: 120, c: mono('#FFFFFF', '#013E86') }), '#013E86', `${tag('proposed')} White on navy`)}
      ${tile(logo({ h: 120, c: mono('#FFFFFF', '#FD6801') }), '#FD6801', `${tag('proposed')} White on plate colour`)}
      ${tile(logo({ h: 120, c: mono('#000000', '#FFFFFF') }), '#FFFFFF', `${tag('proposed')} Black (fax, stamps, engraving)`)}</div>` },
    { t: 'cols', items: [
      [{ t: 'p', text: '**Reversed version.** On deep navy the navy towel and sparkles would disappear, so they turn white while the orange and red stay. This is the only permitted colour swap.' }],
      [{ t: 'p', text: '**Monochrome.** The product already supports a one-colour mark (the tint option in LogoLayer.tsx). The towel knockout is drawn in the background colour, so the gap survives in every version.' }],
      [{ t: 'note', kind: 'proposed', text: 'Only full colour exists as approved artwork. Reversed and monochrome versions follow the product’s own tint logic; export and approve them as official files.' }],
    ] },
  ],
});

P({
  id: 'backgrounds', section: 'Logo', layout: 'top', kicker: 'Backgrounds & placement', title: 'Backgrounds and placement',
  body: [
    { t: 'fig', id: 'bg-fig', h: 62, html: `<div class="tiles t5">
      ${doTile(logo({ h: 92 }), 'White, Ivory, Paper')}
      ${doTile(`<div class="appicon">${logo({ h: 74 })}</div>`, 'On colour: inside a white tile', '#FD6801')}
      ${doTile(logo({ h: 92, c: { navy: '#FFFFFF', knock: '#012A5C' } }), 'Deep navy: reversed', '#012A5C')}
      ${dontTile(logo({ h: 92, c: { knock: '#FE8701' } }), 'Full colour on orange', '#FE8701')}
      ${dontTile(logo({ h: 92, c: { knock: '#013E86' } }), 'Full colour on navy', '#013E86')}</div>` },
    { t: 'fig', id: 'placement-fig', h: 56, caption: 'Live placements: mobile app intro lockup, admin sidebar, website navigation.', html: `<div class="shots3">
      <div class="shot"><img src="img/crop-mob-lockup.jpg"></div>
      <div class="shot"><img src="img/crop-admin-sidebar.jpg" style="object-position:0 0"></div>
      <div class="shot"><img src="img/crop-web-nav.jpg" style="object-position:0 0"></div></div>` },
    { t: 'cols', items: [
      [{ t: 'p', text: '**Placement.** The lockup sits top-left in every product: app header, admin sidebar, website nav. On print, place it top-left or centred on the vertical axis; never in the middle of body content.' }],
      [{ t: 'note', kind: 'rule', text: 'On Logo Orange, plate colours or busy artwork, place the full-colour mark inside a white rounded tile, or use a single-colour white version.' }],
    ] },
  ],
});

P({
  id: 'iconmark', section: 'Logo', layout: 'top', cols: 2, kicker: 'Icon-only mark', title: 'App icon and favicon',
  body: [
    { t: 'fig', id: 'appicon-fig', h: 100, html: `<div class="icons-row">
      <div class="ic-col"><div class="appicon appicon--xl">${logo({ h: 150 })}</div><span>${tag('proposed')} App icon 1024 px</span></div>
      <div class="ic-col"><div class="appicon appicon--m">${logo({ h: 60 })}</div><span>180 px</span></div>
      <div class="ic-col"><div class="appicon appicon--s">${logo({ h: 32 })}</div><span>87 px</span></div>
      <div class="ic-col"><img src="img/favicon.png" style="width:40px;height:40px"><span>${tag('verified')} Favicon</span></div>
      <div class="ic-col"><div class="placeholder"><img src="img/expo-placeholder-icon.png"></div><span>${tag('finding')} Current app icon</span></div></div>` },
    { t: 'stack', items: [
      { t: 'p', text: 'The mark carries the brand wherever the name cannot fit. On device home screens it sits on a **white tile** with the mark at about 70% of the tile width, centred optically (nudge 2% down so the sparkles do not crowd the top).' },
      { t: 'kv', items: [['Tile colour', 'White #FFFFFF'], ['Mark size', '~70% of tile width'], ['Android adaptive', 'Mark inside the 66% safe zone on a white background layer'], ['Monochrome (Android 13+)', 'Single-colour version from page “Colour versions”']] },
      { t: 'note', kind: 'finding', text: 'The current mobile/assets/icon.png and android-icon-*.png are the Expo template. Replace before store submission.' },
      { t: 'note', kind: 'verified', text: 'The website and admin favicon is already the mark (favicon.png).' },
    ] },
  ],
});

P({
  id: 'misuse', section: 'Logo', layout: 'top', kicker: 'Incorrect usage', title: 'Never do this',
  body: [
    { t: 'fig', id: 'misuse-fig', h: 128, html: `<div class="tiles t4">
      ${dontTile(`<div style="transform:scaleX(1.45)">${logo({ h: 96 })}</div>`, 'Stretch or squash')}
      ${dontTile(logo({ h: 96, c: { orange: '#7C5CFC', red: '#16A34A', navy: '#F43F5E' } }), 'Recolour')}
      ${dontTile(`<div style="transform:rotate(-16deg)">${logo({ h: 96 })}</div>`, 'Rotate')}
      ${dontTile(`<div style="filter:drop-shadow(6px 8px 6px rgba(0,0,0,.45))">${logo({ h: 96 })}</div>`, 'Add shadows or effects')}
      ${dontTile(partialLogo(96, ['basket', 'basketRim', 'towel', 'clothOrange', 'clothRed'], { orange: '#FE8701', red: '#D30D24', navy: '#013E86' }), 'Remove or rearrange parts')}
      ${dontTile(`<span class="lockup" style="gap:10px">${logo({ h: 60 })}<span style="font-family:Georgia,serif;font-size:30px;color:#0A1C3E">Washing Basket</span></span>`, 'Retype the wordmark')}
      ${dontTile(`<div style="position:relative;width:100%;height:100%;background:url(img/plate1.jpg) center/cover;display:flex;align-items:center;justify-content:center">${logo({ h: 80, c: { knock: '#FD4C14' } })}</div>`, 'Place on busy artwork')}
      ${dontTile(`<div style="background:linear-gradient(135deg,#FE8701,#D30D24);padding:10px">${logo({ h: 80, c: mono('#FFFFFF', 'transparent') })}</div>`, 'Gradients or outlines')}</div>` },
    { t: 'note', kind: 'rule', text: 'Do not stretch, recolour, rotate, outline, add effects, separate or re-arrange the parts, retype the wordmark, or place the mark on a background that hides any of its shapes.' },
  ],
});

/* 03 — Colour */
P({ id: 'd3', layout: 'divider', num: '03', section: 'Colour', title: 'Colour identity', plate: 'plate2.jpg', bg: '#FD6801', fg: '#FFFFFF',
  items: ['Core palette', 'Soft brand shades', 'Neutrals and surfaces', 'Semantic colours', 'Proportion and hierarchy', 'Contrast and combinations', 'Illustration plate colours'] });

P({
  id: 'core', section: 'Colour', layout: 'top', kicker: 'Primary palette', title: 'Core palette',
  lead: 'Three colours come from the logo. Three more run the product. Together they are the brand’s signature.',
  body: [
    { t: 'fig', id: 'core-fig', h: 66, html: `<div class="sws sws--6">${['navy', 'logoOrange', 'red', 'ink', 'orange', 'navyDeep'].map((k) => swatch(C[k], { big: true })).join('')}</div>` },
    { t: 'table', head: ['Colour', 'HEX', 'Token', 'Usage'], widths: [16, 10, 30, 44], rows: ['navy', 'logoOrange', 'red', 'ink', 'orange', 'navyDeep'].map((k) => [C[k].name, C[k].hex, C[k].src, C[k].use]) },
    { t: 'note', kind: 'verified', text: 'Navy, Logo Orange and Red re-sampled from the master PNG for this book: #013E86, #FE8701, #D30D24 match the theme exactly. CMYK values are mathematical conversions — confirm with a printer’s proof before production.' },
  ],
});

P({
  id: 'orange-note', section: 'Colour', layout: 'top', cols: 2, kicker: 'Two oranges', title: 'Logo Orange and Action Orange',
  body: [
    { t: 'fig', id: 'oranges-fig', h: 100, html: `<div class="two-or"><div style="background:#FE8701"><b>Logo Orange</b><span>#FE8701</span><em>The mark only</em>${logo({ h: 90, c: mono('#FFFFFF', '#FE8701') })}</div><div style="background:#FFA742"><b>Action Orange</b><span>#FFA742</span><em>Product &amp; marketing</em><div class="u-btn u-btn--ink" style="width:auto;padding:0 26px">Book now</div></div></div>` },
    { t: 'stack', items: [
      { t: 'p', text: 'The code keeps two oranges on purpose. **Logo Orange (#FE8701)** is the deep, saturated orange of the basket and cloth. **Action Orange (#FFA742)** is a softer, lighter tone the product uses for buttons, the wallet card and highlights — described in the theme as “modern, soft brand shades, inspired by the logo without being harsh”.' },
      { t: 'list', items: ['Logo Orange appears inside the logo and nowhere else in UI.', 'Action Orange is the orange of the product, website panels and campaigns.', 'Never place the two side by side as flat fills; the near-match looks like an error.'] },
      { t: 'note', kind: 'rule', text: 'Keep the two oranges in their lanes: Logo Orange for the mark, Action Orange for everything else.' },
      { t: 'note', kind: 'finding', text: 'White text on Action Orange is 1.9:1 and fails WCAG. Use Ink labels (9.3:1), as shown.' },
    ] },
  ],
});

P({
  id: 'shades', section: 'Colour', layout: 'top', kicker: 'Secondary palette', title: 'Soft brand shades',
  lead: 'Five soft shades, each paired with a tint for surfaces. They give the product its friendly, fresh character without diluting the core.',
  body: [
    { t: 'fig', id: 'shades-fig', h: 84, html: `<div class="shades">${SHADES.map(([n, h, tn, th]) => `<div class="shade"><div class="shade__a" style="background:${h};color:${txtOn(h)}"><b>${n}</b><span>${h}</span><span>RGB ${rgbStr(h)}</span></div><div class="shade__b" style="background:${th}"><b>${tn}</b><span>${th}</span></div></div>`).join('')}</div>` },
    { t: 'table', head: ['Shade', 'HEX', 'Tint', 'HEX', 'Use'], widths: [14, 11, 14, 11, 50], rows: SHADES.map(([n, h, tn, th, u]) => [n, h, tn, th, u]) },
    { t: 'note', kind: 'verified', text: 'From brandShades in mobile/src/theme/index.ts and the website’s --blue … --gold tokens.' },
  ],
});

P({
  id: 'neutrals', section: 'Colour', layout: 'top', kicker: 'Neutrals & surfaces', title: 'Neutrals, surfaces and text',
  body: [
    { t: 'fig', id: 'neutrals-fig', h: 70, html: `<div class="neut">${NEUTRALS.map(([n, h, u]) => `<div class="neut__i"><div class="neut__c" style="background:${h}"></div><b>${n}</b><span>${h}</span><em>${u}</em></div>`).join('')}</div>` },
    { t: 'cols', items: [
      [{ t: 'h', text: 'Backgrounds' }, { t: 'p', text: '**White** is the app canvas (“clean pure white behind everything, no cream”). **Ivory, Paper and Stone** form the warmer environment of the website. The admin portal sits on a cool **#F8F9FA**.' }],
      [{ t: 'h', text: 'Text' }, { t: 'p', text: '**Ink** for headings and primary text, **Ink Soft** for body and labels, **Ink Muted** for captions and helper text. Never use pure black for type.' }],
      [{ t: 'h', text: 'Lines & fields' }, { t: 'p', text: '**Line** for hairlines, **Line Strong** for input and table borders. Text fields rest on **Field #F4F2EB** and turn white with a navy edge on focus.' }],
    ] },
    { t: 'note', kind: 'verified', text: 'All values from mobile/src/theme/index.ts, admin/src/theme/tokens.ts and website/src/styles/base.css.' },
  ],
});

P({
  id: 'semantic', section: 'Colour', layout: 'top', cols: 2, kicker: 'Semantic colours', title: 'Status and feedback',
  body: [
    { t: 'fig', id: 'semantic-fig', h: 112, html: `<div class="sem">${SEMANTIC.map(([n, h, t]) => `<div class="sem__i"><div class="sem__c" style="background:${h}"><b>${n}</b><span>${h}</span></div><div class="sem__t" style="background:${t}">${ui.badge(n === 'Success' ? 'Delivered' : n === 'Warning' ? 'Payment pending' : n === 'Danger' ? 'Cancelled' : 'Drop-off ready', h, '#FFFFFFAA')}<span>${t}</span></div></div>`).join('')}</div>` },
    { t: 'stack', items: [
      { t: 'table', head: ['Role', 'Colour', 'Tint', 'Meaning'], widths: [18, 15, 15, 52], rows: SEMANTIC.map(([n, h, t, u]) => [n, h, t, u]) },
      { t: 'p', text: 'Semantic colours appear as **small signals** — a dot, a badge, an icon, a thin bar — on their tint. They never fill large areas, and status is never shown by colour alone: pair it with a word (“Delivered”) or an icon.' },
      { t: 'note', kind: 'verified', text: 'success, danger, warning and their tints from the theme; admin adds success-ink #0D7A21 for text on green tint.' },
    ] },
  ],
});

const pairs = [
  ['#0A1C3E', '#FFFFFF', 'Ink on White'], ['#0A1C3E', '#FBF9F4', 'Ink on Ivory'], ['#5B6475', '#FFFFFF', 'Ink Soft on White'], ['#667085', '#FFFFFF', 'Ink Muted on White'],
  ['#FFFFFF', '#013E86', 'White on Navy'], ['#FFFFFF', '#012A5C', 'White on Deep Navy'], ['#0A1C3E', '#FFA742', 'Ink on Action Orange'], ['#FFFFFF', '#FFA742', 'White on Action Orange'],
  ['#FFFFFF', '#FE8701', 'White on Logo Orange'], ['#FFFFFF', '#D30D24', 'White on Red'], ['#0A1C3E', '#FED843', 'Ink on Gold'], ['#FFFFFF', '#12AD2B', 'White on Success'],
  ['#0D7A21', '#EBF9F0', 'Success ink on tint'], ['#C8102E', '#FEF0F2', 'Danger on tint'], ['#B97800', '#FFF4D9', 'Warning on tint'], ['#013E86', '#EEF3FB', 'Navy on Navy tint'],
];
P({
  id: 'contrast', section: 'Colour', layout: 'top', kicker: 'Accessibility', title: 'Contrast and combinations',
  lead: 'Measured WCAG 2.2 contrast ratios for the combinations the product uses. AA requires 4.5:1 for body text and 3:1 for large text (18 px bold / 24 px regular) and UI parts.',
  body: [
    { t: 'fig', id: 'contrast-fig', h: 100, html: `<div class="cpairs">${pairs.map(([f, b, n]) => { const r = contrast(f, b); const g = grade(r); return `<div class="cp" style="background:${b};color:${f}${b === '#FFFFFF' || b === '#FBF9F4' ? ';box-shadow:inset 0 0 0 1px #E3E6EB' : ''}"><b>Aa</b><span>${n}</span><em class="g g--${g.replace(' ', '')}">${r.toFixed(1)}:1 · ${g}</em></div>`; }).join('')}</div>` },
    { t: 'cols', items: [
      [{ t: 'note', kind: 'rule', text: 'Body text must reach 4.5:1. Use Ink on light surfaces and white on Navy, Deep Navy or Red.' }],
      [{ t: 'note', kind: 'finding', text: 'White on Action Orange (1.9:1) and on Logo Orange (2.4:1) fail for text. Use Ink on oranges and yellows.' }],
      [{ t: 'note', kind: 'verified', text: 'Ratios computed for this book from the token HEX values.' }],
    ] },
  ],
});

P({
  id: 'proportion', section: 'Colour', layout: 'top', cols: 2, kicker: 'Hierarchy & proportion', title: 'How much of each',
  body: [
    { t: 'fig', id: 'prop-fig', h: 104, html: `<div class="prop"><div style="flex:62;background:#FBF9F4;color:#0A1C3E"><b>62%</b>Neutrals<br>White · Ivory · Paper</div><div style="flex:16;background:#0A1C3E;color:#fff"><b>16%</b>Ink &amp; Navy</div><div style="flex:12;background:#FFA742;color:#0A1C3E"><b>12%</b>Action Orange</div><div style="flex:6;background:#54B6F8;color:#0A1C3E"><b>6%</b>Shades</div><div style="flex:4;background:#D30D24;color:#fff"><b>4%</b></div></div>
    <div class="combos"><div class="combo"><i style="background:#FFFFFF"></i><i style="background:#0A1C3E"></i><i style="background:#FFA742"></i><span>${tag('verified')} App: white, ink, orange</span></div><div class="combo"><i style="background:#FBF9F4"></i><i style="background:#0A1C3E"></i><i style="background:#013E86"></i><i style="background:#FFA742"></i><span>${tag('verified')} Website</span></div><div class="combo"><i style="background:#FE8701"></i><i style="background:#D30D24"></i><i style="background:#013E86"></i><span>${tag('verified')} Brand bands</span></div><div class="combo combo--x"><i style="background:#FE8701"></i><i style="background:#FFA742"></i><span>${tag('finding')} Two oranges side by side</span></div><div class="combo combo--x"><i style="background:#D30D24"></i><i style="background:#12AD2B"></i><span>✕ Red with green</span></div><div class="combo combo--x"><i style="background:#013E86"></i><i style="background:#0A1C3E"></i><span>✕ Navy text on ink</span></div></div>` },
    { t: 'stack', items: [
      { t: 'p', text: 'The product reads as **calm first, bright second.** Most of every screen is white or ivory. Ink and Navy give structure. Orange marks the one thing to do next. Shades and semantic colours are accents.' },
      { t: 'list', items: ['One Action Orange element per view where possible: the primary action.', 'Red is a brand colour, not an alert colour, except in the semantic Danger role.', 'Plate colours (next page) belong to illustration and campaigns, not UI chrome.', 'Dark sections use Deep Navy, never pure black.'] },
      { t: 'note', kind: 'proposed', text: 'Percentages are a guide measured from the live app and website screens, not a mathematical rule.' },
      { t: 'note', kind: 'verified', text: 'The orange-red-navy band sequence is the website’s brand moment: Collected. Cleaned. Returned.' },
    ] },
  ],
});

P({
  id: 'plates', section: 'Colour', layout: 'top', kicker: 'Campaign palette', title: 'Illustration plate colours',
  lead: 'Each step of the care process has its own saturated plate colour. Together they run warm, from red-orange to gold, with one navy plate for contrast.',
  body: [
    { t: 'fig', id: 'plates-fig', h: 100, html: `<div class="plates">${PLATES.map(([n, h, f]) => `<div class="plate"><img src="img/${f}"><div class="plate__k" style="background:${h};color:${txtOn(h)}"><b>${n}</b><span>${h}</span></div></div>`).join('')}</div>` },
    { t: 'cols', items: [
      [{ t: 'p', text: 'These colours live **inside the artwork**. They are the backgrounds of the six process plates and the hero cards (Collect #FC4C13, Care #FE6900, Return #FDCE03 in content.ts).' }],
      [{ t: 'p', text: 'Offer tickets borrow the same family: #FF6F3C, #013E86, #FEC837, #D30D24 and #FEDB7D, each with a darker stub.' }],
      [{ t: 'note', kind: 'verified', text: 'Sampled from assets/artwork/1–6.png; values vary slightly across each plate’s grain. Not for UI text or buttons.' }],
    ] },
  ],
});

/* 04 — Typography */
P({ id: 'd4', layout: 'divider', num: '04', section: 'Typography', title: 'Typography system', typeDivider: true, bg: '#0A1C3E', fg: '#FFFFFF',
  items: ['Typefaces', 'Plus Jakarta Sans', 'Inter', 'Type scale', 'Supporting faces'] });

P({
  id: 'faces', section: 'Typography', layout: 'top', kicker: 'Typefaces', title: 'Two families do the work',
  body: [
    { t: 'fig', id: 'faces-fig', h: 76, html: `<div class="faces">
      <div class="face"><div class="face__aa" style="font-family:'Plus Jakarta Sans';font-weight:800">Aa</div><b>Plus Jakarta Sans</b><span>Display · headings · wordmark</span>${tag('verified')}</div>
      <div class="face"><div class="face__aa" style="font-family:Inter;font-weight:600">Aa</div><b>Inter</b><span>Body · UI · numbers</span>${tag('verified')}</div>
      <div class="face face--sm"><div class="face__aa" style="font-family:'Courier Prime';font-weight:700">Aa</div><b>Courier Prime</b><span>Laundry slips &amp; receipts</span>${tag('verified')}</div>
      <div class="face face--sm"><div class="face__aa" style="font-family:Nunito;font-weight:900">Aa</div><b>Nunito Black</b><span>Loaded, not used in identity</span>${tag('finding')}</div></div>` },
    { t: 'table', head: ['Typeface', 'Role', 'Why it belongs', 'Weights in use'], widths: [17, 20, 43, 20], rows: [
      ['Plus Jakarta Sans', 'Primary · display', 'A geometric sans with open, friendly curves and a modern edge. Its round bowls echo the capsule-ended cloths of the mark.', '500, 600, 700, 800'],
      ['Inter', 'Secondary · text & UI', '“Crisp, precise and highly legible at every size.” Tabular figures keep prices and order numbers aligned.', '400, 500, 600, 700'],
      ['Courier Prime', 'Supporting · print slips', '“The typewriter print on the laundry slip” — a tactile, receipt-like voice for order tickets and tags.', '400, 700'],
      ['Nunito', 'Not in identity', 'Bundled in the app and named in a theme comment, but no shipped screen uses it for the wordmark.', '—'],
    ] },
    { t: 'note', kind: 'verified', text: 'All four are open-source Google Fonts (SIL OFL) loaded by @expo-google-fonts and @fontsource. This book is set in the same files.' },
  ],
});

const spec = (fam, w, name) => `<div class="spec"><div class="spec__big" style="font-family:'${fam}';font-weight:${w}">Aa Bb Cc</div><div class="spec__chars" style="font-family:'${fam}';font-weight:${w === 800 ? 700 : 400}">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>abcdefghijklmnopqrstuvwxyz<br>0123456789 ₹ &amp; @ ? ! % ( ) / –</div></div>`;
const weights = (fam, ws) => `<div class="weights">${ws.map(([w, n]) => `<div style="font-family:'${fam}';font-weight:${w}"><span>${n} ${w}</span>Collected. Cleaned. Returned.</div>`).join('')}</div>`;

P({
  id: 'jakarta', section: 'Typography', layout: 'top', cols: 2, kicker: 'Primary typeface', title: 'Plus Jakarta Sans',
  body: [
    { t: 'fig', id: 'jakarta-fig', h: 120, html: spec('Plus Jakarta Sans', 800) },
    { t: 'stack', items: [
      { t: 'fig', id: 'jakarta-w', h: 52, html: weights('Plus Jakarta Sans', [[500, 'Medium'], [600, 'SemiBold'], [700, 'Bold'], [800, 'ExtraBold']]) },
      { t: 'kv', items: [['Personality', 'Confident, warm, contemporary'], ['Use for', 'Hero headlines, section titles, big numbers, the wordmark'], ['Tracking', 'Tight: −0.03 em at display sizes, −0.01 em at 20–32 px'], ['Line height', '1.05–1.15 for display, 1.2 for headings'], ['Avoid', 'Body paragraphs, small labels under 14 px, all-caps blocks']] },
    ] },
  ],
});

P({
  id: 'inter', section: 'Typography', layout: 'top', cols: 2, kicker: 'Secondary typeface', title: 'Inter',
  body: [
    { t: 'fig', id: 'inter-fig', h: 120, html: spec('Inter', 600) },
    { t: 'stack', items: [
      { t: 'fig', id: 'inter-w', h: 52, html: weights('Inter', [[400, 'Regular'], [500, 'Medium'], [600, 'SemiBold'], [700, 'Bold']]) },
      { t: 'kv', items: [['Personality', 'Neutral, precise, highly legible'], ['Use for', 'Body text, UI labels, buttons, forms, tables, prices'], ['Numbers', 'Tabular figures (tnum) for amounts, order IDs, times'], ['Admin', 'Stylistic sets cv11 and ss01 enabled'], ['Line height', '1.4–1.55 body; 1.3 for labels']] },
    ] },
  ],
});

const scale = [
  ['Hero headline', 'Plus Jakarta Sans', 800, 64, 1.04, '-0.035em', 'Clean clothes, without the laundry day.'],
  ['Section heading', 'Plus Jakarta Sans', 800, 40, 1.08, '-0.03em', 'Five careful steps, every single order.'],
  ['Subheading', 'Plus Jakarta Sans', 700, 24, 1.25, '-0.6px', 'Schedule a pickup'],
  ['Screen title (app)', 'Inter', 700, 22, 1.27, '-0.6px', 'Welcome to Washing Basket'],
  ['Body paragraph', 'Inter', 400, 14, 1.43, '0', 'Pick a date, a time slot and your address. A partner collects your basket during your two-hour slot.'],
  ['Button label', 'Inter', 600, 15, 1.2, '0.2px', 'Book now'],
  ['Navigation label', 'Inter', 500, 12, 1.33, '0.2px', 'Home   Orders   Wallet   Profile'],
  ['Amount', 'Inter', 600, 18, 1.33, '-0.3px', '₹1,293.00'],
  ['Caption', 'Inter', 400, 12, 1.33, '0', 'We’ll text you a 6-digit code to confirm it’s you.'],
];
P({
  id: 'scale', section: 'Typography', layout: 'top', cols: 2, kicker: 'Type scale', title: 'The scale in use',
  body: [
    { t: 'fig', id: 'scale-fig', h: 146, html: `<div class="tscale">${scale.map(([n, f, w, s, lh, ls, ex]) => `<div class="ts"><div class="ts__m"><b>${n}</b><span>${f} ${w} · ${s}/${Math.round(s * lh)} · ${ls}</span></div><div class="ts__ex" style="font-family:'${f}';font-weight:${w};font-size:${s > 30 ? s * 0.42 : s * 0.62}pt;line-height:${lh};letter-spacing:${ls};${n === 'Amount' ? 'font-variant-numeric:tabular-nums' : ''}">${ex}</div></div>`).join('')}</div>` },
    { t: 'stack', items: [
      { t: 'table', head: ['Style', 'Font', 'Weight', 'Size / line', 'Tracking'], widths: [24, 24, 14, 20, 18], rows: scale.map(([n, f, w, s, lh, ls]) => [n, f, String(w), `${s} / ${Math.round(s * lh)} px`, ls]) },
      { t: 'note', kind: 'verified', text: 'App styles from type and text in mobile/src/theme/index.ts. Hero and section sizes are the website’s desktop values (fluid on smaller screens). Example sizes in the figure are reduced to fit the page.' },
    ] },
  ],
});

P({
  id: 'typerules', section: 'Typography', layout: 'top', cols: 2, kicker: 'Supporting faces & rules', title: 'Slips, numbers and rules',
  body: [
    { t: 'fig', id: 'slip-fig', h: 120, html: `<div class="slip"><div class="slip__h">WASHING BASKET</div><div class="slip__s">LAUNDRY SLIP · MODEL TOWN</div><div class="slip__r"><span>ORDER</span><span>WB-1011</span></div><div class="slip__r"><span>DATE</span><span>08 NOV 2026</span></div><div class="slip__d"></div><div class="slip__r"><span>Normal wash · 4.2 kg</span><span>₹189</span></div><div class="slip__r"><span>Shirt — steam press × 3</span><span>₹45</span></div><div class="slip__r"><span>Stain treatment × 1</span><span>₹70</span></div><div class="slip__d"></div><div class="slip__r slip__t"><span>TOTAL</span><span>₹304</span></div><div class="slip__bc"></div><div class="slip__s">COUNTED IN FRONT OF YOU · THANK YOU</div></div>` },
    { t: 'stack', items: [
      { t: 'p', text: '**Courier Prime** is the voice of the physical laundry slip, the order tag and the receipt. Use it in uppercase for labels and mixed case for line items; never for headlines or UI.' },
      { t: 'h', text: 'Typography rules' },
      { t: 'list', items: ['Sentence case for every heading, button and label. No Title Case, no ALL CAPS except short eyebrow labels and slips.', 'Headlines often break into two short lines with a full stop: “Seven services, / one basket.”', 'Use the rupee sign ₹ before amounts with no space; tabular figures in lists.', 'Left-align text. Centre only short headlines on marketing moments.', 'Never set body text in Plus Jakarta Sans, or headlines in Courier Prime.', 'Never substitute Arial, Helvetica or system fonts in brand materials; install the brand fonts.'] },
      { t: 'note', kind: 'rule', text: 'Only Plus Jakarta Sans, Inter and Courier Prime may appear in Washing Basket materials.' },
      { t: 'note', kind: 'proposed', text: 'The slip shown is a concept built on the theme’s stated use of Courier Prime; layout to be approved.' },
    ] },
  ],
});

/* 05 — Illustration */
P({ id: 'd5', layout: 'divider', num: '05', section: 'Illustration', title: 'Illustration & characters', plate: 'plate3.jpg', bg: '#FEA902', fg: '#0A1C3E',
  items: ['Four illustration families', 'The characters', 'Process plates', 'Status vignettes', 'Services and avatars', 'Rules for new illustration'] });

P({
  id: 'families', section: 'Illustration', layout: 'top', kicker: 'Graphic language', title: 'Four illustration families',
  body: [
    { t: 'fig', id: 'families-fig', h: 88, html: `<div class="fam">
      <div><div class="fam__img"><img src="img/plate4.jpg"></div><b>Process plates</b><span>Full-bleed colour, one scene, one step. Hero, onboarding, brand films.</span></div>
      <div><div class="fam__img" style="background:#fff"><img src="img/ill-washing-and-drying.jpg" style="object-fit:contain"></div><b>Status vignettes</b><span>White ground, soft blob, leaves. Order states and empty states.</span></div>
      <div><div class="fam__img"><img src="img/svc-stain-treatment.jpg"></div><b>Service scenes</b><span>Richer props for each service: gloves, bottles, plants.</span></div>
      <div><div class="fam__img" style="background:#fff;display:flex;gap:4px;align-items:center;justify-content:center"><img src="img/avatar-ananya.png" style="width:31%;height:auto;object-fit:contain"><img src="img/avatar-rahul.png" style="width:31%;height:auto;object-fit:contain"><img src="img/avatar-sneha.png" style="width:31%;height:auto;object-fit:contain"></div><b>Avatars</b><span>Ink line portraits on pastel tints. Profiles, referrals, reviews.</span></div></div>` },
    { t: 'table', head: ['Attribute', 'Shared rule across all families'], widths: [22, 78], rows: [
      ['Style', 'Flat vector with soft cel shading; no outlines on bodies, minimal texture, gentle grain on plates'],
      ['Shape language', 'Rounded and soft; capsule folds on cloth stacks, round baskets and tubs, no sharp angles'],
      ['Line', 'Only avatars use line; elsewhere shapes are defined by colour. Hair and apron details in ink navy'],
      ['Palette', 'Navy uniforms, white tees, brand oranges, warm yellows, a little green from plants and lavender-grey leaves'],
      ['Mood', 'Calm, competent, kind. People are mid-task and smiling, never posed or exaggerated'],
    ] },
    { t: 'note', kind: 'verified', text: 'Families and attributes catalogued from assets/artwork, assets/illustrations, mobile/assets/services and assets/avatars.' },
  ],
});

P({
  id: 'characters', section: 'Illustration', layout: 'top', kicker: 'Characters', title: 'The people of Washing Basket',
  lead: 'There is no mascot. The brand is carried by three recurring people: two care partners and a customer, drawn consistently across every family.',
  body: [
    { t: 'fig', id: 'chars-fig', h: 96, html: `<div class="chars">
      <div class="char"><div class="char__img"><img src="img/plate2.jpg" style="object-position:50% 30%"></div><b>The care partner (she)</b><span>Dark hair in a high bun, navy apron over a white tee. Washes, dries, folds. Focused, gentle smile.</span></div>
      <div class="char"><div class="char__img"><img src="img/plate4.jpg" style="object-position:40% 20%"></div><b>The pickup partner (he)</b><span>Short beard, navy cap, navy apron, white tee. Collects, irons and delivers. Open, friendly expression.</span></div>
      <div class="char"><div class="char__img"><img src="img/plate6.jpg" style="object-position:85% 30%"></div><b>The customer</b><span>Long dark hair, cream sweater, dark trousers. Hands over and receives. Relieved, happy.</span></div></div>` },
    { t: 'cols', items: [
      [{ t: 'h', text: 'Uniform' }, { t: 'p', text: 'Partners always wear a **navy apron over a white crew-neck tee**; the pickup partner adds a navy cap. This is the brand’s only fixed costume — it makes staff instantly recognisable.' }],
      [{ t: 'h', text: 'Expressions & poses' }, { t: 'p', text: 'Calm concentration at work; warm smiles at hand-over; one worried look for the “stained shirt” problem state. Poses are mid-action: handing, scrubbing, hanging, pressing, folding, riding.' }],
      [{ t: 'h', text: 'Proportions' }, { t: 'p', text: 'Naturalistic adult proportions, slightly enlarged heads and hands for readability. Faces are simple: dot-and-curve eyes, small nose, clear brows.' }, { t: 'note', kind: 'proposed', text: 'Character names are not defined. Leave them unnamed unless the team approves names.' }],
    ] },
  ],
});

P({
  id: 'plates-system', section: 'Illustration', layout: 'top', kicker: 'Process plates', title: 'One step, one colour, one scene',
  body: [
    { t: 'fig', id: 'platesys-fig', h: 104, html: `<div class="psys">${[['01', 'Collect', 'plate1.jpg', 'Handing over the bag'], ['02', 'Wash', 'plate2.jpg', 'Scrubbing in a tub of suds'], ['03', 'Dry', 'plate3.jpg', 'Hanging on the line'], ['04', 'Iron', 'plate4.jpg', 'Pressing a white shirt'], ['05', 'Pack', 'plate5.jpg', 'Folding into stacks'], ['06', 'Return', 'plate6.jpg', 'Handing back the stack']].map(([n, w, f, d]) => `<div class="ps"><img src="img/${f}"><b>${n} ${w}</b><span>${d}</span></div>`).join('')}</div>` },
    { t: 'cols', items: [
      [{ t: 'p', text: '**Composition.** One or two figures, cropped at the waist or knees, filling the lower two-thirds. A plain saturated background with soft grain; a few props only (tub, basket, line, iron, stack).' }],
      [{ t: 'p', text: '**Use.** Website hero cards and care journey, the mobile sign-in carousel, the admin sign-in film, and the hero loop and brand film generated from these plates.' }],
      [{ t: 'note', kind: 'verified', text: 'assets/artwork/1–6.png; also mobile/assets/scenes and website/src/assets/art-*.webp.' }],
    ] },
  ],
});

P({
  id: 'vignettes', section: 'Illustration', layout: 'top', kicker: 'Status vignettes', title: 'Illustrating the order journey',
  body: [
    { t: 'fig', id: 'vign-fig', h: 104, html: `<div class="vig">${[['payment-pending', 'Payment pending'], ['washing-and-drying', 'Washing & drying'], ['ironing-and-packing', 'Ironing & packing'], ['out-for-delivery', 'Out for delivery'], ['delivered', 'Delivered'], ['worried-about-a-stained-shirt', 'Problem / stain'], ['map-pin-and-folded-laundry-basket', 'Area unavailable'], ['minimalist-laundry-day-illustration', 'Empty state']].map(([f, l]) => `<div class="vg"><img src="img/ill-${f}.jpg"><span>${l}</span></div>`).join('')}</div>` },
    { t: 'cols', items: [
      [{ t: 'p', text: '**Style.** White ground; a soft, pale blob (cream, mint or lilac) behind the scene; lavender-grey leaves framing one side; a single bright accent icon (✕ badge, card, sun) to tell the state.' }],
      [{ t: 'p', text: '**Where.** Order tracking states, empty and error states, unavailable-area screen (pincode check), loading interstitials and onboarding confirmations.' }],
      [{ t: 'note', kind: 'verified', text: 'assets/illustrations and mobile/assets/illustrations, used by the app’s order and pincode screens.' }],
    ] },
  ],
});

P({
  id: 'services-ill', section: 'Illustration', layout: 'top', kicker: 'Service scenes & avatars', title: 'Services and people',
  body: [
    { t: 'fig', id: 'svc-fig', h: 72, html: `<div class="svcs">${[['blanket', 'Blanket'], ['color-dye', 'Colour Dye'], ['dry-clean', 'Dry Clean'], ['shoes-bags-and-soft-toys', 'Shoes, Bags & Soft Toys'], ['stain-treatment', 'Stain Treatment']].map(([f, l]) => `<div class="sv"><img src="img/svc-${f}.jpg"><span>${l}</span></div>`).join('')}</div>` },
    { t: 'fig', id: 'av-fig', h: 40, html: `<div class="avs">${['ananya', 'rahul', 'sneha'].map((a) => `<div class="av"><img src="img/avatar-${a}.png"><span>${a[0].toUpperCase() + a.slice(1)}</span></div>`).join('')}<div class="av-t"><b>Avatars.</b> Bold ink line, no fill on skin, simple hair shapes, set on a pastel tint square (green, blue, red tints from the soft shades). Use for customer profiles, referrals and support threads.</div></div>` },
    { t: 'note', kind: 'verified', text: 'Service scenes add blue nitrile gloves, spray bottles and potted plants — signals of hygiene and care that match the quality promise.' },
  ],
});

P({
  id: 'illrules', section: 'Illustration', layout: 'top', cols: 2, kicker: 'Rules', title: 'Making new illustration',
  body: [
    { t: 'stack', items: [
      { t: 'h', text: 'Mandatory' },
      { t: 'list', items: ['Flat vector with soft shading, no outlines on figures (avatars excepted).', 'Partners wear the navy apron over a white tee; keep the three established characters consistent.', 'Plates: one step, one saturated plate colour from the campaign palette, one or two figures.', 'Vignettes: white ground, pale blob, lavender-grey leaves, one accent icon.', 'Represent real campus and Indian household settings; vary skin tones and body types respectfully.', 'Every new illustration is reviewed against this page before release.'] },
      { t: 'note', kind: 'rule', text: 'No 3D renders, stock clip-art, photo-realism, mascots or emoji-style faces in the brand illustration set.' },
    ] },
    { t: 'stack', items: [
      { t: 'h', text: 'Flexible' },
      { t: 'list', items: ['Props and backgrounds can change for seasonal campaigns (monsoon, winter bedding).', 'Crops can be tighter for small UI spots, as long as faces stay complete.', 'Material textures (cloth, wood, wicker) may be used on the website as stage sets, separate from character art.'] },
      { t: 'h', text: 'Production notes' },
      { t: 'kv', items: [['Master size', '≥ 1200 px wide, PNG with transparency for vignettes'], ['Plates', 'Portrait ≈ 11:12, full-bleed background'], ['Export', 'WebP for web, PNG for app, layered source kept in assets/'], ['Animation', 'Cut into layers for hero-loop/brand-film pipelines']] },
      { t: 'note', kind: 'proposed', text: 'These production specs reflect the existing files; adopt as standard.' },
    ] },
  ],
});

/* 06 — Icons & elements */
P({ id: 'd6', layout: 'marker', num: '06', section: 'Iconography & elements', title: 'Iconography & visual elements', plate: 'plate5.jpg', bg: '#013888', fg: '#FFFFFF',
  items: ['Icon language', 'Radius, borders and shadows', 'Signature graphic elements'] });

P({
  id: 'icons', section: 'Iconography & elements', layout: 'top', cols: 2, kicker: 'Icon language', title: 'Outline icons, rounded ends',
  body: [
    { t: 'fig', id: 'icons-fig', h: 110, html: `<div class="icg">${ICONS.map(([n, d]) => `<div class="icc"><div class="icc__grid">${icon(d, { s: 64 })}</div><span>${n}</span></div>`).join('')}</div><div class="icsz">${[14, 16, 20, 22, 24].map((s) => `<div>${icon(ICONS[4][1], { s: s * 1.6, w: 2 })}<span>${s}px</span></div>`).join('')}</div>` },
    { t: 'stack', items: [
      { t: 'kv', items: [['Grid', '24 × 24 viewBox, 2 px padding'], ['Stroke', '2 px default; 1.8 for small shields; 2.4–2.8 for checks'], ['Ends & joins', 'Round caps, round joins'], ['Fill', 'None. Outline only; filled glyphs only inside status dots'], ['Corner radius', 'Follow the stroke; no hard corners'], ['Sizes', '14, 16, 20, 22, 24 px'], ['Colour', 'Ink Muted #64748B at rest; Ink or Navy active; semantic colour for status']] },
      { t: 'p', text: '**Spacing.** Icons sit 8 px from a label. Tap targets are at least 44 × 44 px even when the glyph is 20 px — round icon buttons in the app give that room.' },
      { t: 'note', kind: 'verified', text: 'Glyphs reproduced from mobile/src/components/ui/icons.tsx. The style matches Lucide/Feather-like outline icons used across admin.' },
    ] },
  ],
});

P({
  id: 'elements', section: 'Iconography & elements', layout: 'top', kicker: 'Visual elements', title: 'Radius, borders, shadows',
  body: [
    { t: 'fig', id: 'radius-fig', h: 52, html: `<div class="rads">${[['Button · field', 12], ['Inner', 16], ['Tile', 20], ['Sheet', 24], ['Card', 26], ['Chip · round', 999]].map(([n, r]) => `<div class="rad"><div style="border-radius:${Math.min(r, 60)}px"></div><b>${r === 999 ? 'Pill' : r + ' px'}</b><span>${n}</span></div>`).join('')}</div>` },
    { t: 'fig', id: 'shadow-fig', h: 32, html: `<div class="shadows"><div class="sh" style="box-shadow:0 6px 16px rgba(20,33,61,.06)"><b>Card</b><span>0 6 16 · #14213D 6%</span></div><div class="sh" style="box-shadow:0 30px 60px -30px rgba(10,28,62,.35),0 12px 24px -16px rgba(10,28,62,.18)"><b>Website float</b><span>Two-layer navy shadow</span></div><div class="sh" style="box-shadow:none;border:1px solid #E3E6EB"><b>Hairline</b><span>1 px Line #E3E6EB</span></div><div class="sh" style="box-shadow:0 0 0 2px #013E86"><b>Focus</b><span>2 px Navy, 3 px offset</span></div></div>` },
    { t: 'table', head: ['Element', 'App', 'Admin', 'Website'], widths: [22, 26, 26, 26], rows: [
      ['Card radius', '26 px (shape.card)', '14 px (dense)', '26 px (--r-card)'],
      ['Tile radius', '20 px', '12 px', '20 px'],
      ['Field radius', '12 px', '10 px', 'Pill (999)'],
      ['Shadow', 'One soft level; most surfaces use colour, not shadow', 'Borders over shadows', 'Floating navy shadow on device frames'],
    ] },
    { t: 'note', kind: 'verified', text: 'radius, shape and elevation in mobile/src/theme; admin overrides in tokens.ts; website in base.css. The admin is intentionally tighter for dense data.' },
  ],
});

P({
  id: 'signature', section: 'Iconography & elements', layout: 'top', kicker: 'Signature elements', title: 'Graphic motifs',
  body: [
    { t: 'fig', id: 'motif-fig', h: 92, html: `<div class="motifs">
      <div class="mo"><div class="bands"><div style="background:#FE8701">Collected.</div><div style="background:#D30D24">Cleaned.</div><div style="background:#013E86">Returned.</div></div><b>Brand bands</b></div>
      <div class="mo"><img src="img/ui-offer-ticket.png" style="height:100%;width:100%;object-fit:contain"><b>Offer tickets</b></div>
      <div class="mo"><div class="spk">${partialLogo(120, ['sparkleLarge', 'sparkleSmall'], { navy: '#013E86' })}</div><b>Sparkle accent</b></div>
      <div class="mo"><img src="img/cloth-weave.jpg" style="height:100%;width:100%;object-fit:cover"><b>Cloth texture</b></div></div>` },
    { t: 'cols', items: [
      [{ t: 'p', text: '**Brand bands.** Three full-width stripes in logo orange, red and navy with one word each. The single strongest graphic device outside the mark.' }],
      [{ t: 'p', text: '**Offer tickets.** Perforated coupons with a darker stub, vertical side label and barcode. Used for every offer in app and web.' }],
      [{ t: 'p', text: '**Sparkles.** The two stars may appear alone as a “fresh / clean” accent next to success messages. Always navy or white, never rotated.' }, { t: 'note', kind: 'proposed', text: 'Sparkles-only use is a proposal; currently they appear only inside the mark.' }],
    ] },
  ],
});

/* 07 — Photography */
P({ id: 'd7', layout: 'marker', num: '07', section: 'Imagery', title: 'Photography & image direction', plate: 'svc-stain-treatment.jpg', bg: '#FDC406', fg: '#0A1C3E',
  items: ['Illustration first', 'Photography direction (proposed)', 'Material renders', 'Approved and unapproved treatments'] });

P({
  id: 'photo', section: 'Imagery', layout: 'top', cols: 2, kicker: 'Image direction', title: 'Illustration first, photography second',
  body: [
    { t: 'stack', items: [
      { t: 'note', kind: 'verified', text: 'The audit found no photography in the brand. Every image is illustration or a rendered material texture — a distinctive choice worth keeping.' },
      { t: 'p', text: 'Keep illustration as the face of the brand. Add photography only where proof matters — real counters, staff and folded orders — and make it feel like the illustrations brought to life.' },
      { t: 'h', text: 'Proposed photography direction' },
      { t: 'kv', items: [
        ['Light', 'Bright, soft daylight; no harsh flash, no dark moody shadows'],
        ['Background', 'Plain walls in white, ivory or a plate colour; uncluttered'],
        ['Composition', 'One subject, centred or rule-of-thirds, generous negative space for type'],
        ['Perspective', 'Eye level for people; top-down for folded stacks and baskets on Ivory or Paper'],
        ['People', 'Real staff in navy aprons and white tees, mid-task, natural smiles'],
        ['Grading', 'Warm whites, true navy, slightly lifted shadows; no filters'],
      ] },
      { t: 'note', kind: 'proposed', text: 'All photography guidance is a recommendation for future shoots.' },
    ] },
    { t: 'fig', id: 'photo-fig', h: 132, html: `<div class="mood">
      <div class="mood__i mood--ok"><img src="img/table-wood.jpg"><span>✓ Calm material, top-down</span></div>
      <div class="mood__i mood--ok"><img src="img/basket.png" style="object-fit:cover;background:#EAE6DB"><span>✓ Folded order, top-down</span></div>
      <div class="mood__i mood--ok"><img src="img/plate5.jpg"><span>✓ Reference: the plate composition</span></div>
      <div class="mood__i mood--ok"><img src="img/cloth-weave.jpg"><span>✓ Texture as a stage</span></div>
      <div class="mood__i mood--no"><img src="img/plate4.jpg" style="filter:saturate(2.6) contrast(1.5) hue-rotate(70deg)"><span>✕ Over-processed colour grading</span></div>
      <div class="mood__i mood--no"><img src="img/cloth-crumple.jpg" style="filter:brightness(.45) contrast(1.4)"><span>✕ Dark, moody, crumpled</span></div></div>` },
  ],
});

/* 08 — Digital */
P({ id: 'd8', layout: 'divider', num: '08', section: 'Digital', title: 'Digital design system', plate: 'plate4.jpg', bg: '#FEC503', fg: '#0A1C3E',
  items: ['Website', 'Mobile app', 'Admin portal', 'Components', 'Spacing, grid and radius', 'Accessibility'] });

P({
  id: 'website', section: 'Digital', layout: 'top', kicker: 'Website', title: 'The marketing website',
  body: [
    { t: 'fig', id: 'web-fig', h: 104, caption: 'Live website, captured 10 Nov 2026: hero, brand bands, the app section, offers and footer.', html: `<div class="wgrid"><div class="wg wg--big"><img src="img/shot-web-hero.jpg"></div><div class="wg"><img src="img/shot-web-01.jpg"></div><div class="wg"><img src="img/shot-web-04.jpg"></div><div class="wg"><img src="img/shot-web-13.jpg"></div><div class="wg"><img src="img/shot-web-14.jpg"></div></div>` },
    { t: 'cols', items: [
      [{ t: 'p', text: '**Navigation.** A floating pill nav (Home, Story, The app, How it works) with the lockup left and a dark “Get the app” pill right.' }],
      [{ t: 'p', text: '**Hero.** Two-column: three-line headline left, an illustration card stack (Collect, Care, Return) right on the ivory canvas.' }],
      [{ t: 'p', text: '**Sections.** Full-bleed panels alternate Ivory, Action Orange and texture stages; GSAP scroll scenes; Deep Navy footer.' }],
      [{ t: 'p', text: '**Responsive.** Fluid gutters clamp(20px, 4vw, 64px), 1360 px max width; layouts switch at 900 px.' }],
    ] },
  ],
});

P({
  id: 'mobile', section: 'Digital', layout: 'top', kicker: 'Mobile application', title: 'The customer app',
  body: [
    { t: 'fig', id: 'mob-fig', h: 112, caption: 'Sign-in, Home, Services, Track, Wallet and Offers screens from the app.', html: `<div class="phones">${['shot-mob-4.jpg', 'screen-home.jpg', 'screen-items.jpg', 'screen-track.jpg', 'screen-wallet.jpg', 'screen-offers.jpg'].map((f) => `<div class="phone"><img src="img/${f}"></div>`).join('')}</div>` },
    { t: 'cols', items: [
      [{ t: 'p', text: '**Bottom navigation.** Five round icon buttons on a floating bar; the active item fills Ink. A centred “+” books a new order.' }],
      [{ t: 'p', text: '**Cards.** White, 26 px radius, soft elevation; dark Ink stat cards and Action Orange wallet card for emphasis.' }],
      [{ t: 'p', text: '**Sheets & modals.** Rising bottom sheets, 24 px top radius, spring motion; sign-in sits on a sheet over the plate carousel.' }],
      [{ t: 'p', text: '**States.** Status pills with dot, live progress timeline, vignettes for empty and error states.' }],
    ] },
  ],
});

P({
  id: 'admin', section: 'Digital', layout: 'top', kicker: 'Admin portal', title: 'The operations portal',
  body: [
    { t: 'fig', id: 'admin-fig', h: 110, caption: 'Admin portal: sign-in, dashboard, orders, offers, service areas and mobile help-desk view.', html: `<div class="agrid"><div class="ag ag--big"><img src="img/shot-admin-overview.jpg"></div><div class="ag"><img src="img/shot-admin-login.jpg"></div><div class="ag"><img src="img/shot-admin-orders.jpg"></div><div class="ag"><img src="img/shot-admin-offers.jpg"></div><div class="ag"><img src="img/shot-admin-service-areas.jpg"></div></div>` },
    { t: 'cols', items: [
      [{ t: 'p', text: '**Same brand, denser.** Identical colour and type tokens, imported straight from the app theme. Radii drop to 14/12/10 px; tables replace cards.' }],
      [{ t: 'p', text: '**Stat cards.** The signature row: an Ink card, an Action Orange card and white cards, each with an icon button and one big number.' }],
      [{ t: 'p', text: '**Layout.** 260 px white sidebar (72 px collapsed) with grouped sections, a top bar with search and location picker, and an orange announcement ticker.' }],
    ] },
  ],
});

P({
  id: 'components', section: 'Digital', layout: 'top', kicker: 'Components', title: 'Core components',
  body: [
    { t: 'fig', id: 'comp-fig', h: 112, html: `<div class="comps">
      <div class="cg"><h5>Buttons · 52 px · radius 12</h5>${ui.btnPrimary('Book now')}${ui.btnDark('Continue')}${ui.btnOutline('View all orders')}<div class="u-row">${ui.btnGhost('Skip')}<div class="u-btn u-btn--dis">Disabled</div></div></div>
      <div class="cg"><h5>Inputs · fill #F4F2EB</h5>${ui.field('Mobile number')}${ui.field('98765 43210', true)}<div class="u-err">⊘ Enter a valid 10-digit number.</div><h5 style="margin-top:10px">Chips &amp; tabs</h5><div class="u-row">${ui.chip('All services', true)}${ui.chip('Wash')}${ui.chip('Dry clean')}</div><div class="u-tabs"><span class="on">Active</span><span>Upcoming</span><span>Expired</span></div></div>
      <div class="cg"><h5>Badges</h5><div class="u-row" style="flex-wrap:wrap">${ui.badge('Drop-off ready', '#013E86', '#EEF3FB')}${ui.badge('Delivered', '#0D7A21', '#EBF9F0')}${ui.badge('Payment pending', '#B97800', '#FFF4D9')}${ui.badge('Cancelled', '#C8102E', '#FEF0F2')}</div><h5 style="margin-top:10px">Cards</h5><img src="img/ui-order-card.png" class="u-img"><img src="img/ui-active-orders.png" class="u-img"></div>
      <div class="cg"><h5>Real components</h5><img src="img/ui-wallet-card.png" class="u-img"><img src="img/ui-transactions.png" class="u-img"></div></div>` },
    { t: 'table', head: ['Component', 'Specification'], widths: [20, 80], rows: [
      ['Primary button', 'Action Orange, 52 px tall, 12 px radius, Inter SemiBold 15 / +0.2 px; pressed #E58E2E and scale 0.98; success state turns green with a check'],
      ['Dark button', 'Ink fill, white label; for flow steps (Continue, Sign in) and the app’s floating actions'],
      ['Text field', '52 px, Field #F4F2EB at rest, 12 px radius; focus = white fill + navy edge; errors in Danger with an icon and words'],
      ['Badge', 'Pill, coloured dot + label in the semantic colour on its tint'],
    ] },
  ],
});

P({
  id: 'layout', section: 'Digital', layout: 'top', cols: 2, kicker: 'Spacing & grid', title: 'Spacing, grid and layout',
  body: [
    { t: 'fig', id: 'space-fig', h: 112, html: `<div class="space">${[['xs', 4], ['sm', 8], ['md', 12], ['lg', 16], ['xl', 20], ['xxl', 24], ['xxxl', 32]].map(([n, v]) => `<div class="spc"><div style="width:${v * 2.4}px;height:${v * 2.4}px"></div><b>${v}</b><span>${n}</span></div>`).join('')}</div><div class="gridviz"><div class="gv gv--m"><b>Mobile</b>${Array(4).fill('<i></i>').join('')}<span>16–20 px margins · 4 col</span></div><div class="gv gv--d"><b>Desktop</b>${Array(12).fill('<i></i>').join('')}<span>12 col · 1360 max · fluid gutter</span></div></div>` },
    { t: 'stack', items: [
      { t: 'kv', items: [['Base unit', '4 px; tokens xs 4 → xxxl 32'], ['Control height', '52 px for fields and buttons'], ['Mobile margins', '16–20 px; cards stack with 12–16 px gaps'], ['Website', 'Gutter clamp(20px, 4vw, 64px), max width 1360 px, break at 900 px'], ['Admin', 'Sidebar 260 / 72 px; content grid of stat cards and tables']] },
      { t: 'h', text: 'Layout principles' },
      { t: 'list', items: ['Calm first: one primary action per screen, lots of white.', 'Group with surfaces and space before lines and shadows.', 'Hierarchy by size and weight, not by colour.', 'Content max width ~68 characters for reading.'] },
      { t: 'note', kind: 'verified', text: 'space tokens and CONTROL_HEIGHT in mobile/src/theme; website --gutter and --max in base.css; admin --sidebar-w in layout.css. Column grids are proposed formalisations.' },
    ] },
  ],
});

P({
  id: 'a11y', section: 'Digital', layout: 'top', cols: 2, kicker: 'Accessibility', title: 'Accessible by default',
  body: [
    { t: 'stack', items: [
      { t: 'h', text: 'Already in the product' },
      { t: 'list', items: ['Visible 2 px navy focus rings with 3 px offset on web and admin.', 'Skip link on the website; reduced-motion support that removes smooth scrolling and scene motion.', 'Accessibility labels on the logo and wordmark (“WashingBasket”).', 'Errors written in words with an icon, never colour alone.', 'Tabular figures for amounts.'] },
      { t: 'note', kind: 'verified', text: 'From base.css, motion.ts, Wordmark.tsx and TextField components.' },
    ] },
    { t: 'stack', items: [
      { t: 'h', text: 'Rules for new work' },
      { t: 'list', items: ['Text contrast ≥ 4.5:1; large text and UI parts ≥ 3:1 (see Colour · Contrast).', 'Ink, not white, on Action Orange, Gold and yellow plates.', 'Tap targets ≥ 44 × 44 px.', 'Minimum body size 14 px in app, 16 px on web.', 'Every illustration gets alt text describing the action (“A partner hands a stack of folded clothes back to a customer”).', 'Honour prefers-reduced-motion everywhere.'] },
      { t: 'note', kind: 'rule', text: 'Accessibility is not optional. A design that fails contrast or target size is not on-brand.' },
    ] },
  ],
});

/* 09 — Motion */
P({ id: 'd9', layout: 'marker', num: '09', section: 'Motion', title: 'Motion & animation', plate: 'svc-shoes-bags-and-soft-toys.jpg', bg: '#FC3B07', fg: '#FFFFFF',
  items: ['Motion personality', 'The logo intro', 'Durations and easing', 'Interaction patterns', 'Do and don’t'] });

const TL = [['Basket', 50, '#FE8701'], ['Towel', 560, '#013E86'], ['Red cloth', 980, '#D30D24'], ['Orange cloth', 1400, '#FE8701'], ['Sparkle L', 1790, '#013E86'], ['Sparkle S', 1910, '#013E86'], ['Wordmark', 2250, '#0A1C3E'], ['Complete', 4400, '#667085']];
P({
  id: 'motion', section: 'Motion', layout: 'top', kicker: 'Logo animation', title: 'The basket fills itself',
  lead: 'The brand moves the way laundry does: things drop in with a little weight, settle, and rest. Physical, quick, never bouncy for its own sake.',
  body: [
    { t: 'fig', id: 'tl-fig', h: 78, html: `<div class="tl"><div class="tl__axis">${[0, 1000, 2000, 3000, 4000].map((t) => `<span style="left:${(t / 4400) * 100}%">${t} ms</span>`).join('')}</div>${TL.map(([n, t, c], i) => `<div class="tl__row"><b>${n}</b><div class="tl__track"><i style="left:${(t / 4400) * 100}%;background:${c}"></i><em style="left:${(t / 4400) * 100}%">${t}</em></div></div>`).join('')}</div>` },
    { t: 'cols', items: [
      [{ t: 'p', text: '**Sequence.** The basket slides in from the right, leaning with momentum, and sits upright. The towel flops over the rim. The red cloth drops in, the basket gives; the orange cloth lands on top, the basket gives again. Two sparkles pop. The mark glides left and the wordmark rises letter by letter (38 ms stagger, 520 ms each).' }],
      [{ t: 'p', text: '**Where.** App intro splash, admin sign-in intro, website opening. A shorter 1.5 s loop (clothes dropping) is the brand loader. Tap anywhere to skip; every element rests at its final position, so “no animation” shows the finished logo.' }, { t: 'note', kind: 'verified', text: 'Times from INTRO_TIMELINE in AnimatedLogo.tsx; ported to admin brand.css.' }],
    ] },
  ],
});

P({
  id: 'motion2', section: 'Motion', layout: 'top', cols: 2, kicker: 'Durations & easing', title: 'Timing, curves and interactions',
  body: [
    { t: 'stack', items: [
      { t: 'table', head: ['Token', 'Value', 'Use'], widths: [26, 38, 36], rows: [
        ['Ease out (signature)', 'cubic-bezier(0.16, 1, 0.3, 1)', 'Entrances, glides, page scenes'],
        ['Ease decel', 'cubic-bezier(0.22, 1, 0.36, 1)', 'Slides, basket entry'],
        ['Ease in-out', 'cubic-bezier(0.45, 0, 0.55, 1)', 'Fades, shadows'],
        ['GSAP default', 'power3.out', 'Website scroll scenes'],
        ['Sheet spring', 'damping 22 · stiffness 240 · mass 0.8', 'Bottom sheets'],
        ['Pop spring', 'damping 13 · stiffness 190', 'Reveal / success pops'],
        ['Press', '90 ms down · spring 300 ms back, scale 0.98', 'Buttons'],
        ['Smooth scroll', 'Lenis, 1.15 s, expo out', 'Website'],
      ] },
      { t: 'kv', items: [['Micro (press, hover)', '90–150 ms'], ['Small (toggle, chip)', '200–300 ms'], ['Medium (sheet, card)', '320–500 ms'], ['Large (intro, scene)', '600–1000 ms']] },
      { t: 'note', kind: 'verified', text: 'Curves and springs from mobile/src (Easing.bezier, withSpring), website motion.ts and base.css --ease.' },
    ] },
    { t: 'stack', items: [
      { t: 'h', text: 'What motion should communicate' },
      { t: 'p', text: '**Care and weight.** Objects have mass: clothes fall with gravity (~285 ms), baskets give when they land. **Progress.** The order timeline fills step by step. **Reassurance.** Success turns the button green with a check; payments get a short celebration.' },
      { t: 'h', text: 'Do' },
      { t: 'list', items: ['Ease out on entrances; settle with one small overshoot at most.', 'Stagger lists by 30–60 ms.', 'Animate transform and opacity only.', 'Offer skip on anything over 1 s; respect reduced motion.'] },
      { t: 'h', text: 'Don’t' },
      { t: 'list', items: ['Elastic, wobbly, spinning or flipping logos.', 'Linear movement on UI (except progress and timelines).', 'Motion that blocks input or loops endlessly in UI.', 'Parallax on text.'] },
      { t: 'note', kind: 'rule', text: 'The logo only ever animates with its official fill-the-basket sequence or the loader; never spin, flip or morph it.' },
    ] },
  ],
});

/* 10 — Applications */
P({ id: 'd10', layout: 'divider', num: '10', section: 'Applications', title: 'Brand applications', plate: 'plate6.jpg', bg: '#FECF04', fg: '#0A1C3E',
  items: ['Business card and staff ID', 'Uniform and laundry bag', 'Order tag and slip', 'Social posts and stories', 'Email and app banners'] });

const bizFront = `<div class="bc bc--f">${lockup(15)}<div class="bc__n"><b>Name Surname</b><span>Operations Lead</span></div><div class="bc__c">+91 80 4718 2020<br>care@washingbasket.example<br>Model Town, Jalandhar</div></div>`;
const bizBack = `<div class="bc bc--b">${logo({ h: 70, c: { navy: '#FFFFFF', knock: '#012A5C' } })}<div class="bc__t">Collected. Cleaned. Returned.</div></div>`;
const staffId = `<div class="sid"><div class="sid__top">${logo({ h: 26 })}<span class="wm" style="font-size:11px"><b>W</b>ashing<b>B</b>asket</span></div><div class="sid__ph"><img src="img/avatar-rahul.png"></div><b>Rahul M.</b><span>Pickup Partner</span><div class="sid__loc">NIT Jalandhar counter</div><div class="sid__bar"></div><div class="sid__band"></div></div>`;
const apron = `<svg viewBox="0 0 200 240" width="170" height="204"><path d="M30 40 Q100 -10 170 40 L200 90 L170 110 L165 240 L35 240 L30 110 L0 90Z" fill="#FFFFFF" stroke="#E3E6EB" stroke-width="2"/><path d="M60 10 Q100 0 140 10 L150 60 Q178 70 182 100 L176 230 Q100 242 24 230 L18 100 Q22 70 50 60Z" fill="#14213D"/><path d="M60 10 Q100 0 140 10" stroke="#0A1C3E" stroke-width="6" fill="none"/><path d="M50 60 Q20 50 5 70" stroke="#14213D" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M150 60 Q180 50 195 70" stroke="#14213D" stroke-width="8" fill="none" stroke-linecap="round"/><rect x="60" y="150" width="80" height="44" rx="8" fill="#0F1C38"/>${''}</svg>`;
P({
  id: 'app1', section: 'Applications', layout: 'top', kicker: 'Identity applications', title: 'Cards, ID and uniform',
  body: [
    { t: 'fig', id: 'app1-fig', h: 110, html: `<div class="apps1"><div class="ap"><div class="bcs">${bizFront}${bizBack}</div><span>Business card · 85 × 55 mm · Ivory front, Deep Navy back</span></div><div class="ap">${staffId}<span>Staff ID · 54 × 86 mm</span></div><div class="ap"><div class="apron2">${apron}<div class="apron2__logo">${logo({ h: 30, c: mono('#FFFFFF', '#14213D') })}</div></div><span>Uniform reference: navy apron, white tee; white mark on chest</span></div></div>` },
    { t: 'cols', items: [
      [{ t: 'p', text: '**Business card.** Horizontal lockup top-left on Ivory; Inter for details; back in Deep Navy with the reversed mark and the brand line.' }],
      [{ t: 'p', text: '**Staff ID.** White card, lockup top, avatar or photo, name in Plus Jakarta Sans, role in Inter, the brand bands as a footer stripe.' }],
      [{ t: 'p', text: '**Uniform.** The navy apron over a white tee already defines staff in every illustration. Add a white single-colour mark on the chest, 60–70 mm wide.' }],
      [{ t: 'note', kind: 'proposed', text: 'All applications on these pages are concept mockups. No printed materials exist yet.' }],
    ] },
  ],
});

P({
  id: 'app2', section: 'Applications', layout: 'top', kicker: 'Operations applications', title: 'Bags, tags and slips',
  body: [
    { t: 'fig', id: 'app2-fig', h: 112, html: `<div class="apps2">
      <div class="ap"><div class="bag"><div class="bag__knot"></div><div class="bag__body"><div class="bag__lk">${logo({ h: 64 })}</div><div class="bag__t">Laundry, handled.</div></div></div><span>Laundry bag · white cotton, full-colour mark</span></div>
      <div class="ap"><div class="tagc"><div class="tagc__hole"></div><div class="tagc__h">${logo({ h: 22, c: mono('#FFFFFF', '#013E86') })} WB-1011</div><div class="tagc__b"><div><span>PIECES</span>4</div><div><span>SERVICE</span>WASH &amp; IRON</div><div><span>RETURN</span>10 NOV</div></div><div class="tagc__bc"></div></div><span>Order tag · Courier Prime</span></div>
      <div class="ap"><div class="box"><div class="box__band"><i style="background:#FE8701"></i><i style="background:#D30D24"></i><i style="background:#013E86"></i></div>${lockup(13)}<div class="box__t">Freshly cleaned for you</div></div><span>Return pack / sleeve</span></div>
      <div class="ap"><div class="shopper">${logo({ h: 72 })}<div class="wm" style="font-size:15px;color:#fff;margin-top:8px"><b>W</b>ashing<b>B</b>asket</div></div><span>Tote / shopping bag · Action Orange</span></div></div>` },
    { t: 'cols', items: [
      [{ t: 'p', text: '**Laundry bag.** Echoes the white drawstring bag in the Collect plate. The bag is the customer’s “basket” on the move.' }],
      [{ t: 'p', text: '**Order tag.** Navy header with order number, Courier Prime fields for pieces, service and return date, and a barcode/QR area that matches the counter scanner.' }],
      [{ t: 'p', text: '**Return pack & tote.** The brand bands as a closing seal; on Action Orange use the mark inside a white tile or in white.' }, { t: 'note', kind: 'proposed', text: 'Concepts; confirm materials and print methods with suppliers.' }],
    ] },
  ],
});

P({
  id: 'app3', section: 'Applications', layout: 'top', kicker: 'Marketing applications', title: 'Social, email and banners',
  body: [
    { t: 'fig', id: 'app3-fig', h: 120, html: `<div class="apps3">
      <div class="ap"><div class="post" style="background:#FD4C14"><img src="img/plate1.jpg"><div class="post__t">Hand over<br>your basket.</div><div class="post__lk">${logo({ h: 22, c: mono('#FFFFFF', '#FD4C14') })}</div></div><span>Instagram post · 1080 × 1080</span></div>
      <div class="ap"><div class="story"><div class="story__top">${logo({ h: 20 })}<span class="wm" style="font-size:9px"><b>W</b>ashing<b>B</b>asket</span></div><div class="story__tk"><b>20%</b><span>OFF</span><em>FIRSTWASH</em></div><div class="story__t">Your first three pickups, 20% off.</div><div class="u-btn u-btn--ink" style="height:26px;font-size:9px;border-radius:7px">Book now</div></div><span>Story · 1080 × 1920</span></div>
      <div class="ap"><div class="mail"><div class="mail__h">${lockup(10)}</div><div class="mail__img"><img src="img/ill-delivered.jpg"></div><div class="mail__b"><b>Your laundry is on its way back.</b><span>Order WB-1011 · 4 pieces · Out for delivery</span><div class="u-btn u-btn--orange" style="height:22px;font-size:8px;border-radius:6px;color:#0A1C3E">Track order</div></div><div class="mail__f">Collected. Cleaned. Returned.</div></div><span>Transactional email</span></div>
      <div class="ap ap--wide"><div class="banner"><div class="banner__t"><b>Seven services,<br>one basket.</b><span>From ₹45/kg · LPU · NIT Jalandhar · Model Town</span><div class="u-btn u-btn--ink" style="height:24px;font-size:9px;border-radius:7px;width:90px">See prices</div></div><img src="img/svc-dry-clean.jpg"></div><span>Website / app banner · 1200 × 400</span></div></div>` },
    { t: 'cols', items: [
      [{ t: 'p', text: '**Social.** A plate illustration, a two-line Plus Jakarta Sans headline with a full stop, the white mark small in a corner. One message per post.' }],
      [{ t: 'p', text: '**Offers.** Use the ticket motif and the real offer code; Ink text on yellow or Action Orange.' }],
      [{ t: 'p', text: '**Email.** White body, lockup header, a status vignette, one Action Orange button, brand line in the footer.' }, { t: 'note', kind: 'proposed', text: 'Concept layouts using real offer codes and copy from the app.' }],
    ] },
  ],
});

/* 11 — Voice */
P({ id: 'd11', layout: 'marker', num: '11', section: 'Voice', title: 'Communication & voice', plate: 'svc-dry-clean.jpg', bg: '#032D75', fg: '#FFFFFF',
  items: ['Tone of voice', 'Writing principles', 'Vocabulary', 'Messaging by moment', 'Headlines and CTAs'] });

P({
  id: 'voice', section: 'Voice', layout: 'top', cols: 2, kicker: 'Tone of voice', title: 'Calm, clear, kind',
  body: [
    { t: 'stack', items: [
      { t: 'p', text: 'Washing Basket sounds like a **capable friend who has it handled**. It speaks in short sentences, plain verbs and real facts. It is warm without being cute, and confident without boasting.' },
      { t: 'h', text: 'Writing principles' },
      { t: 'kv', items: [
        ['Short and rhythmic', 'Full stops do the work. “Collected. Cleaned. Returned.”'],
        ['Concrete', 'Say the price, the slot, the step. “48 hours.” “₹45/kg.” “Two-hour slot.”'],
        ['True', 'No invented numbers, awards, testimonials or history. Ever.'],
        ['Customer first', '“Your basket”, “your door”, “your week”. Talk about their day, not our machines.'],
        ['Calm', 'No exclamation marks in UI. No urgency tricks.'],
      ] },
      { t: 'note', kind: 'verified', text: 'Principles are distilled from live copy in website/src/content.ts and the app; “no invented history, numbers, awards, testimonials” is a rule written in that file.' },
    ] },
    { t: 'stack', items: [
      { t: 'h', text: 'Vocabulary' },
      { t: 'table', head: ['Say', 'Avoid'], widths: [50, 50], rows: [
        ['Basket, hand over, collect, return', 'Consignment, drop shipment'],
        ['Partner (for staff)', 'Worker, boy, guy'],
        ['Care, fresh, folded, pressed', 'Hygienic-certified, germ-killing (unless proven)'],
        ['Counter, doorstep, slot', 'Facility, logistics window'],
        ['Washing Basket (two words)', 'WashingBasket, WB, Washing-Basket in prose'],
        ['From ₹45/kg', 'Cheapest, best price guaranteed'],
        ['Track your laundry', 'Monitor your consignment'],
      ] },
      { t: 'h', text: 'Preferred phrases' },
      { t: 'list', items: ['Clean clothes, without the laundry day.', 'Hand over your basket.', 'Counted in front of you.', 'Every stage, live in the app.', 'Book your pickup and leave the rest to us.'] },
    ] },
  ],
});

P({
  id: 'voice2', section: 'Voice', layout: 'top', kicker: 'Messaging by moment', title: 'How we sound, moment to moment',
  body: [
    { t: 'table', head: ['Moment', 'Tone', 'Example (live copy)'], widths: [18, 22, 60], rows: [
      ['Welcome / sign-in', 'Simple, welcoming', '“Welcome to Washing Basket. Enter your mobile number to continue.”'],
      ['Home', 'Personal, glanceable', '“Hello, Kiran!” · “Fresh clothes, at your door.”'],
      ['Booking', 'Clear, step-by-step', '“Pick a date, a time slot and your address.”'],
      ['Tracking', 'Reassuring, factual', '“Washing & Drying” · “Out for delivery” · “Every stage, live in the app.”'],
      ['Help text', 'Helpful, honest', '“We’ll text you a 6-digit code to confirm it’s you.”'],
      ['Errors', 'Calm, says how to fix', '“Enter your email and password.”'],
      ['Offers', 'Light, specific', '“Flat 20% off on your first 3 laundry pickups.”'],
      ['Admin', 'Efficient, operational', '“Every pickup, wash and delivery, in one place.”'],
    ] },
    { t: 'cols', items: [
      [{ t: 'h', text: 'Headlines' }, { t: 'list', items: ['Clean clothes, without the laundry day.', 'Seven services, one basket.', 'Five careful steps, every single order.', 'The whole service, in your pocket.', 'Your next laundry day starts with a tap.'] }],
      [{ t: 'h', text: 'CTAs' }, { t: 'p', text: 'Verb first, two or three words, sentence case: **Book now · Continue · Track order · Top up · Get the app · See prices**. Never “Click here” or “Submit”.' }],
      [{ t: 'h', text: 'Social' }, { t: 'p', text: 'One idea per post, a short headline, a real fact (service, price, slot, campus). Emoji sparingly — at most one, never in place of words. Reply to customers by name, in the same calm voice.' }, { t: 'note', kind: 'proposed', text: 'Social guidance is new; no social channels are recorded in the codebase.' }],
    ] },
  ],
});

/* 12 — Governance */
P({ id: 'd12', layout: 'marker', num: '12', section: 'Governance', title: 'Brand governance', plate: 'svc-blanket.jpg', bg: '#FEC703', fg: '#0A1C3E',
  items: ['Checklists', 'Mandatory vs flexible', 'Approval workflow', 'Asset organisation', 'Consistency audit'] });

const chk = (t, items) => ({ t: 'check', title: t, items });
P({
  id: 'checklists', section: 'Governance', layout: 'top', cols: 3, kicker: 'Checklists', title: 'Before anything ships',
  body: [
    chk('Logo', ['Supplied artwork, not redrawn', 'Correct version for the background', 'Clear space x on all sides', 'Above minimum size', 'Not stretched, rotated or recoloured', '“Washing Basket” two words in text']),
    chk('Colour', ['Only palette colours from this book', 'Logo Orange only in the mark', 'Text contrast ≥ 4.5:1', 'Ink, not white, on orange/yellow', 'Status colour paired with words']),
    chk('Typography', ['Plus Jakarta Sans / Inter / Courier Prime only', 'Sentence case', 'Tight tracking on display', 'Tabular figures for amounts', 'No font substitution']),
    chk('Illustration & imagery', ['From an existing family', 'Navy apron, white tee on partners', 'Correct plate colour per step', 'Alt text written', 'No stock photos or 3D clip-art']),
    chk('Digital UI', ['Tokens from mobile/src/theme', '52 px controls, 12 px radius', 'One primary action per screen', 'Focus states visible', 'Reduced motion respected']),
    chk('Marketing', ['Facts and prices match the app', 'Real offer codes and validity', 'No invented claims or testimonials', 'One message per piece', 'Contact details are live (not .example)']),
  ],
});

P({
  id: 'governance', section: 'Governance', layout: 'top', cols: 2, kicker: 'Governance', title: 'Keeping it consistent',
  body: [
    { t: 'stack', items: [
      { t: 'h', text: 'Mandatory rules vs creative freedom' },
      { t: 'table', head: ['Mandatory', 'Flexible'], widths: [50, 50], rows: [
        ['Logo artwork, versions, clear space', 'Layout and composition of each piece'],
        ['Core palette and contrast', 'Which shades accent a campaign'],
        ['Three typefaces', 'Headline wording and line breaks'],
        ['Partner uniform in illustration', 'Props, scenes and seasonal themes'],
        ['Truthful copy, real prices', 'Tone shading by channel'],
        ['Accessibility minimums', 'Motion choreography inside the rules'],
      ] },
      { t: 'h', text: 'Approval workflow' },
      { t: 'list', items: ['1 · Brief names the audience, message and channel.', '2 · Creator self-checks against the checklists.', '3 · Brand owner reviews logo, colour, type and claims.', '4 · Product owner verifies prices, offers and app facts.', '5 · Approved files are stored with version and date.'] },
      { t: 'note', kind: 'proposed', text: 'Workflow and owners to be confirmed by the team.' },
    ] },
    { t: 'stack', items: [
      { t: 'h', text: 'Asset organisation' },
      { t: 'table', head: ['Folder', 'Contents'], widths: [40, 60], rows: [
        ['assets/brand/logo/', 'SVG, EPS, PDF, PNG per version (to create)'],
        ['assets/brand/app-icon/', 'iOS and Android icon sets (to create)'],
        ['assets/brand/fonts/', 'Licences and TTFs for the three faces'],
        ['assets/artwork/', 'Process plates (existing)'],
        ['assets/illustrations/', 'Status vignettes (existing)'],
        ['assets/avatars/', 'Customer avatars (existing)'],
        ['assets/brand/guidelines/', 'This book, .docx and .pdf'],
      ] },
      { t: 'h', text: 'Consistency audit · every quarter' },
      { t: 'list', items: ['Diff theme tokens across mobile, admin and website.', 'Screenshot every key screen; check against this book.', 'Review new illustrations and marketing pieces.', 'Re-run contrast checks on any new colour pair.', 'Log findings and update this book’s version.'] },
    ] },
  ],
});

P({
  id: 'appendix', section: 'Appendix', layout: 'top', cols: 2, kicker: 'Appendix', title: 'Token and asset reference',
  body: [
    { t: 'stack', items: [
      { t: 'h', text: 'Colour tokens (CSS)' },
      { t: 'code', text: `--navy: #013E86;      --navy-deep: #012A5C;\n--logo-orange: #FE8701; --red: #D30D24;\n--orange: #FFA742;    --orange-pressed: #E58E2E;\n--ink: #0A1C3E;       --ink-soft: #5B6475;\n--ink-muted: #667085; --line: #E3E6EB;\n--ivory: #FBF9F4;     --paper: #F5F1E8;\n--field: #F4F2EB;     --subtle: #F4F5F7;\n--success: #12AD2B;   --warning: #B97800;\n--danger: #C8102E;    --navy-tint: #EEF3FB;\n--blue: #54B6F8;      --green: #62D487;\n--gold: #FED843;      --soft-red: #F87C87;` },
      { t: 'h', text: 'Type & shape tokens' },
      { t: 'code', text: `--display: 'Plus Jakarta Sans';\n--text: 'Inter';  --mono: 'Courier Prime';\n--control-h: 52px; --r-button: 12px;\n--r-field: 12px;   --r-sheet: 24px;\n--r-card: 26px;    --r-tile: 20px;\n--space: 4 8 12 16 20 24 32;\n--ease: cubic-bezier(0.16, 1, 0.3, 1);` },
    ] },
    { t: 'stack', items: [
      { t: 'h', text: 'Source of truth' },
      { t: 'p', text: '**mobile/src/theme/index.ts** is the single source. The admin portal imports it directly (admin/src/theme/tokens.ts) and the website mirrors it in base.css. Change a colour there first.' },
      { t: 'h', text: 'Brand asset index' },
      { t: 'table', head: ['Asset', 'Path'], widths: [36, 64], rows: [
        ['Master logo PNG', 'assets/brand/WashingBasket-logo.png'],
        ['Logo vector trace', 'website/src/logoGeometry.ts'],
        ['Favicon', 'admin/public/favicon.png'],
        ['Process plates', 'assets/artwork/1.png – 6.png'],
        ['Status vignettes', 'assets/illustrations/*.png'],
        ['Service scenes', 'mobile/assets/services/*.png'],
        ['Avatars', 'assets/avatars/*.png'],
        ['Hero loop / films', 'website/public/media · hero-loop · brand-film'],
        ['Fonts', '@expo-google-fonts/* · @fontsource/*'],
      ] },
      { t: 'p', text: '**Font licences.** Plus Jakarta Sans, Inter, Nunito and Courier Prime are licensed under the SIL Open Font License 1.1 and are free for commercial use.' },
    ] },
  ],
});

P({ id: 'back', layout: 'back' });

module.exports = { pages, META, C, PLATES, SHADES, NEUTRALS, SEMANTIC, pairs, scale, TL };
