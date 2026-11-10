// Product mock-ups for Brand applications: drawn as layered SVG with fabric/paper shading, real shadows and print effects.
// The mark and wordmark are placed from the master artwork (lib.js); nothing is redrawn.
const { logo, wordmark, mono } = require('./lib');

let uid = 0;
const id = (p) => `${p}${++uid}`;
// place an inline <svg> (from logo()/wordmark()) at x,y with a given width or height
function place(svg, x, y, { w, h } = {}) {
  const W = +svg.match(/width="([\d.]+)"/)[1], H = +svg.match(/height="([\d.]+)"/)[1];
  const k = w ? w / W : h / H;
  return svg.replace(/^<svg[^>]*?width="[\d.]+" height="[\d.]+"/, (m) => m.replace(/width="[\d.]+" height="[\d.]+"/, `x="${x}" y="${y}" width="${(W * k).toFixed(2)}" height="${(H * k).toFixed(2)}"`));
}
const defsCommon = (n) => `
  <filter id="${n}soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="${n}blur2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter>
  <filter id="${n}grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .07 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
  <filter id="${n}weave" x="0" y="0" width="100%" height="100%"><feTurbulence type="turbulence" baseFrequency="0.9 0.06" numOctaves="1" seed="3" result="a"/><feTurbulence type="turbulence" baseFrequency="0.06 0.9" numOctaves="1" seed="5" result="b"/><feBlend in="a" in2="b" mode="multiply" result="c"/><feColorMatrix in="c" type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.32  0 0 0 0 0.36  0 0 0 .10 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>`;

/* 1 · White cotton drawstring laundry bag, navy cord, full-colour mark printed */
function laundryBag() {
  const n = id('bag');
  const body = 'M86 64 C70 80 34 96 31 140 L29 222 Q29 252 62 254 L138 254 Q171 252 171 222 L169 140 C166 96 130 80 114 64 Z';
  const ruff = 'M82 66 Q76 46 84 34 Q92 26 100 30 Q108 26 116 34 Q124 46 118 66 Z';
  return `<svg class="mock" viewBox="0 0 200 278" xmlns="http://www.w3.org/2000/svg"><defs>${defsCommon(n)}
    <linearGradient id="${n}cloth" x1="0" x2="1"><stop offset="0" stop-color="#DCE1E8"/><stop offset=".22" stop-color="#F7F8FA"/><stop offset=".55" stop-color="#FFFFFF"/><stop offset=".85" stop-color="#EEF1F4"/><stop offset="1" stop-color="#D6DCE4"/></linearGradient>
    <linearGradient id="${n}bot" x1="0" y1="0" x2="0" y2="1"><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#2A3446" stop-opacity=".16"/></linearGradient>
    <linearGradient id="${n}rf" x1="0" x2="1"><stop offset="0" stop-color="#D9DEE6"/><stop offset=".5" stop-color="#FBFCFD"/><stop offset="1" stop-color="#D3D9E1"/></linearGradient>
    <clipPath id="${n}clip"><path d="${body}"/></clipPath></defs>
    <ellipse cx="100" cy="258" rx="74" ry="9" fill="#0A1C3E" opacity=".22" filter="url(#${n}soft)"/>
    <path d="${body}" fill="url(#${n}cloth)"/>
    <g clip-path="url(#${n}clip)">
      <rect x="0" y="0" width="200" height="278" filter="url(#${n}weave)" fill="#fff"/>
      <path d="${body}" fill="url(#${n}bot)"/>
      <g fill="none" stroke="#5C6B82" stroke-linecap="round" filter="url(#${n}blur2)" opacity=".22">
        <path d="M92 66 C80 100 66 130 60 180" stroke-width="5"/><path d="M108 66 C122 100 136 134 142 186" stroke-width="5"/>
        <path d="M100 68 C99 110 101 150 98 196" stroke-width="3"/><path d="M40 150 C38 190 42 220 48 246" stroke-width="7"/><path d="M160 150 C163 190 159 220 152 246" stroke-width="7"/>
      </g>
      <g fill="none" stroke="#fff" stroke-linecap="round" filter="url(#${n}blur2)" opacity=".85"><path d="M78 110 C70 150 70 190 74 236" stroke-width="5"/><path d="M118 104 C126 140 128 190 126 236" stroke-width="3"/></g>
      ${place(logo({ h: 100 }), 70, 120, { w: 60 }).replace('<svg ', '<svg style="mix-blend-mode:multiply" opacity=".96" ')}
      ${place(wordmark(10), 55, 188, { w: 90 }).replace('<svg ', '<svg opacity=".92" ')}
      <path d="M30 238 Q100 246 170 238" stroke="#9AA5B6" stroke-width=".8" stroke-dasharray="2.2 2" fill="none" opacity=".6"/>
    </g>
    <path d="${ruff}" fill="url(#${n}rf)"/>
    <path d="M86 40 Q90 52 88 64 M96 32 Q97 48 95 64 M104 32 Q103 48 105 64 M113 38 Q110 52 112 64" stroke="#8C98AA" stroke-width="1.1" fill="none" opacity=".55"/>
    <path d="M80 64 Q100 70 120 64" stroke="#013E86" stroke-width="5.5" fill="none" stroke-linecap="round"/>
    <path d="M80 64 Q100 70 120 64" stroke="#3D6DB0" stroke-width="5.5" fill="none" stroke-dasharray="1.6 2.4" opacity=".7"/>
    <g fill="none" stroke-linecap="round">
      <path d="M86 68 C78 92 72 104 76 124" stroke="#013E86" stroke-width="3.4"/><path d="M86 68 C78 92 72 104 76 124" stroke="#4E7EC0" stroke-width="3.4" stroke-dasharray="1.4 2.2" opacity=".75"/>
      <path d="M94 69 C92 92 86 108 84 128" stroke="#013E86" stroke-width="3.4"/><path d="M94 69 C92 92 86 108 84 128" stroke="#4E7EC0" stroke-width="3.4" stroke-dasharray="1.4 2.2" opacity=".75"/>
    </g>
    <rect x="72" y="92" width="15" height="11" rx="3" fill="#0A1C3E" transform="rotate(-8 80 97)"/><rect x="75" y="95" width="9" height="2.2" rx="1" fill="#2E3D5C" transform="rotate(-8 80 97)"/>
    <circle cx="76.5" cy="126" r="2.8" fill="#0A1C3E"/><circle cx="84.5" cy="130" r="2.8" fill="#0A1C3E"/>
  </svg>`;
}

/* 2 · Hang tag on card stock: navy print, metal eyelet, cotton string */
function hangTag() {
  const n = id('tag');
  const shape = 'M28 34 L50 12 L150 12 L172 34 L172 262 Q172 268 166 268 L34 268 Q28 268 28 262 Z';
  const bars = [];
  let x = 46;
  const pat = [2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 1, 2, 2, 1, 1, 3, 1, 2, 1, 1, 2, 1, 3, 2, 1, 1, 2, 1, 1, 3, 1, 2];
  pat.forEach((w, i) => { if (i % 2 === 0) bars.push(`<rect x="${x}" y="222" width="${w * 1.05}" height="22" fill="#141B29"/>`); x += w * 1.05 + 0.7; });
  return `<svg class="mock" viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg"><defs>${defsCommon(n)}
    <linearGradient id="${n}card" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".6" stop-color="#F7F8F9"/><stop offset="1" stop-color="#E8EBEF"/></linearGradient>
    <radialGradient id="${n}ring" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".45" stop-color="#C9CFD8"/><stop offset=".8" stop-color="#8E98A6"/><stop offset="1" stop-color="#B8C0CB"/></radialGradient>
    <clipPath id="${n}clip"><path d="${shape}"/></clipPath></defs>
    <g transform="rotate(-5 100 150)">
      <path d="${shape}" transform="translate(3 7)" fill="#0A1C3E" opacity=".25" filter="url(#${n}soft)"/>
      <path d="${shape}" fill="url(#${n}card)"/>
      <g clip-path="url(#${n}clip)">
        <rect x="0" y="0" width="200" height="300" fill="#fff" filter="url(#${n}grain)"/>
        <rect x="0" y="0" width="200" height="96" fill="#013E86"/>
        <rect x="0" y="0" width="200" height="96" fill="#fff" filter="url(#${n}grain)" opacity=".5"/>
        ${place(logo({ h: 100, c: mono('#FFFFFF', '#013E86') }), 44, 52, { h: 30 })}
        <text x="80" y="74" font-family="Courier Prime" font-weight="700" font-size="17" fill="#fff" letter-spacing="1">WB-1011</text>
        <g font-family="Courier Prime" fill="#141B29">
          <text x="44" y="122" font-size="8.5" letter-spacing="1.4">PIECES</text><text x="44" y="138" font-size="15" font-weight="700">4</text>
          <text x="44" y="160" font-size="8.5" letter-spacing="1.4">SERVICE</text><text x="44" y="176" font-size="15" font-weight="700">WASH &amp; IRON</text>
          <text x="44" y="198" font-size="8.5" letter-spacing="1.4">RETURN</text><text x="44" y="214" font-size="15" font-weight="700">10 NOV</text>
        </g>
        ${bars.join('')}
        <text x="100" y="257" text-anchor="middle" font-family="Courier Prime" font-size="7" fill="#3A4558" letter-spacing="1.5">MODEL TOWN · COUNTER 2</text>
        <path d="M28 104 L172 104" stroke="#AEB6C2" stroke-width=".8" stroke-dasharray="2 2.4"/>
      </g>
      <path d="${shape}" fill="none" stroke="#D3D9E1" stroke-width=".8"/>
      <circle cx="100" cy="32" r="9" fill="url(#${n}ring)"/><circle cx="100" cy="32" r="5" fill="#E9EDF2"/><circle cx="100" cy="32" r="5" fill="none" stroke="#6E7887" stroke-width=".8"/>
    </g>
    <path d="M98 28 C92 10 70 -2 40 -6" stroke="#D8CDB8" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path d="M102 28 C112 8 138 -2 170 -8" stroke="#CFC3AD" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path d="M98 28 C92 10 70 -2 40 -6 M102 28 C112 8 138 -2 170 -8" stroke="#B6A88E" stroke-width="2.6" fill="none" stroke-dasharray="1 2.2" opacity=".8"/>
  </svg>`;
}

/* 3 · Thermal laundry slip with torn bottom edge */
function slip() {
  const n = id('slip');
  let zig = '';
  for (let x = 164; x >= 36; x -= 8) zig += ` L${x - 4} ${x % 16 === 12 ? 276 : 271} L${x - 8} 274`;
  const shape = `M36 8 L164 8 L164 274${zig} Z`;
  const row = (y, a, b, bold) => `<text x="47" y="${y}" font-size="6.6" ${bold ? 'font-weight="700"' : ''}>${a}</text><text x="153" y="${y}" font-size="6.6" text-anchor="end" ${bold ? 'font-weight="700"' : ''}>${b}</text>`;
  const bars = [];
  let x = 64;
  [1, 2, 1, 1, 3, 1, 2, 1, 1, 2, 2, 1, 3, 1, 1, 2, 1, 2, 1, 3, 1, 1, 2, 1, 2, 1, 1, 3, 1, 2].forEach((w, i) => { if (i % 2 === 0) bars.push(`<rect x="${x}" y="214" width="${w * 0.95}" height="20" fill="#262626"/>`); x += w * 0.95 + 0.6; });
  return `<svg class="mock" viewBox="0 0 200 290" xmlns="http://www.w3.org/2000/svg"><defs>${defsCommon(n)}
    <linearGradient id="${n}paper" x1="0" x2="1"><stop offset="0" stop-color="#E9ECEF"/><stop offset=".12" stop-color="#FAFBFB"/><stop offset=".5" stop-color="#FFFFFF"/><stop offset=".88" stop-color="#F6F7F8"/><stop offset="1" stop-color="#E2E6EA"/></linearGradient>
    <linearGradient id="${n}curl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".07"/><stop offset=".06" stop-color="#000" stop-opacity="0"/><stop offset=".9" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".05"/></linearGradient>
    <clipPath id="${n}clip"><path d="${shape}"/></clipPath></defs>
    <path d="${shape}" transform="translate(4 6)" fill="#0A1C3E" opacity=".2" filter="url(#${n}soft)"/>
    <path d="${shape}" fill="url(#${n}paper)"/>
    <g clip-path="url(#${n}clip)">
      <rect width="200" height="290" fill="#fff" filter="url(#${n}grain)"/><rect width="200" height="290" fill="url(#${n}curl)"/>
      <g opacity=".86">${place(logo({ h: 100, c: mono('#2A2A2A', '#FFFFFF') }), 89, 18, { h: 22 })}</g>
      <g font-family="Courier Prime" fill="#2A2A2A">
        <text x="100" y="54" text-anchor="middle" font-size="9" font-weight="700" letter-spacing="1.2">WASHING BASKET</text>
        <text x="100" y="64" text-anchor="middle" font-size="5.4" letter-spacing=".6">LAUNDRY SLIP · MODEL TOWN</text>
        ${row(82, 'ORDER', 'WB-1011')}${row(92, 'DATE', '08 NOV 2026')}
        <path d="M47 100 L153 100" stroke="#2A2A2A" stroke-width=".6" stroke-dasharray="1.6 1.6"/>
        ${row(114, 'Normal wash 4.2kg', '₹189')}${row(126, 'Shirt press x3', '₹45')}${row(138, 'Stain treatment', '₹70')}
        <path d="M47 148 L153 148" stroke="#2A2A2A" stroke-width=".6" stroke-dasharray="1.6 1.6"/>
        ${row(164, 'TOTAL', '₹304', true)}
        ${row(178, 'PAID', 'WALLET')}
        <text x="100" y="200" text-anchor="middle" font-size="6.2" letter-spacing="1">COUNTED IN FRONT OF YOU</text>
        ${bars.join('')}
        <text x="100" y="246" text-anchor="middle" font-size="6.6" letter-spacing="2.4">WB1011081126</text>
        <text x="100" y="260" text-anchor="middle" font-size="6.2" letter-spacing="1">THANK YOU</text>
      </g>
    </g>
  </svg>`;
}

/* 4 · Action Orange paper tote with gusset and twisted paper handles */
function tote() {
  const n = id('tote');
  return `<svg class="mock" viewBox="0 0 210 280" xmlns="http://www.w3.org/2000/svg"><defs>${defsCommon(n)}
    <linearGradient id="${n}front" x1="0" x2="1"><stop offset="0" stop-color="#FFB257"/><stop offset=".5" stop-color="#FFA742"/><stop offset="1" stop-color="#F59A33"/></linearGradient>
    <linearGradient id="${n}side" x1="0" x2="1"><stop offset="0" stop-color="#D9822A"/><stop offset=".5" stop-color="#E8902F"/><stop offset="1" stop-color="#C77421"/></linearGradient>
    <linearGradient id="${n}shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".10"/><stop offset=".12" stop-color="#000" stop-opacity="0"/><stop offset=".85" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".10"/></linearGradient></defs>
    <ellipse cx="108" cy="266" rx="88" ry="8" fill="#0A1C3E" opacity=".25" filter="url(#${n}soft)"/>
    <g fill="none" stroke-linecap="round">
      <path d="M62 92 C60 30 116 30 114 92" stroke="#C26F1E" stroke-width="5.5"/><path d="M62 92 C60 30 116 30 114 92" stroke="#F0A04A" stroke-width="5.5" stroke-dasharray="2 2.6"/>
      <path d="M96 92 C94 22 152 22 150 92" stroke="#D07A24" stroke-width="5.5"/><path d="M96 92 C94 22 152 22 150 92" stroke="#FFB966" stroke-width="5.5" stroke-dasharray="2 2.6"/>
    </g>
    <path d="M170 82 L194 92 L194 262 L170 266 Z" fill="url(#${n}side)"/>
    <path d="M182 87 L182 263" stroke="#B5671C" stroke-width="1.2" opacity=".7"/><path d="M170 160 L182 166 L194 160" stroke="#B5671C" stroke-width="1" fill="none" opacity=".6"/>
    <rect x="22" y="82" width="148" height="184" fill="url(#${n}front)"/>
    <rect x="22" y="82" width="148" height="184" fill="#fff" filter="url(#${n}grain)" opacity=".7"/>
    <rect x="22" y="82" width="148" height="184" fill="url(#${n}shade)"/>
    <rect x="22" y="82" width="148" height="14" fill="#000" opacity=".06"/><path d="M22 96 L170 96" stroke="#D88A30" stroke-width=".8"/>
    <circle cx="62" cy="90" r="2.6" fill="#8A4E14"/><circle cx="114" cy="90" r="2.6" fill="#8A4E14"/>
    <rect x="66" y="118" width="60" height="60" rx="14" fill="#fff"/><rect x="66" y="118" width="60" height="60" rx="14" fill="#000" opacity=".03"/>
    ${place(logo({ h: 100 }), 74, 125, { h: 46 })}
    ${place(wordmark(10, '#FFFFFF'), 40, 194, { w: 112 })}
    <path d="M22 266 L170 266" stroke="#C97A26" stroke-width="1"/>
  </svg>`;
}

module.exports = { laundryBag, hangTag, slip, tote };
