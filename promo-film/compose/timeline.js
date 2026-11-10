// Washing Basket — 60 s story film. Deterministic: window.render(t) draws the frame for time t (seconds).
// Every UI element shown is a crop of a real app capture (assets/screens). The film graphics only restate
// facts that are visible in the app (₹2,000 top-up + 5% bonus = ₹2,100, FIRSTWASH ₹214 → ₹181, …).
(() => {
  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const lerp = (a, b, p) => a + (b - a) * p;
  const eOut = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
  const eInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const eIn = (p) => p * p * p;
  const eBack = (p) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
  const spring = (x) => (x <= 0 ? 0 : 1 - Math.exp(-6.5 * x) * Math.cos(10 * x)); // x in seconds
  const el = (tag, cls, parent, css, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; (parent || stage).appendChild(e); return e; };
  const show = (e, on) => { e.style.display = on ? 'block' : 'none'; };
  const CUES = []; const cue = (t, k, g) => CUES.push({ t: +t.toFixed(3), k, g: g || 1 });
  const SCR = (n) => `assets/screens/${n}.jpg`;
  const inr = (v) => '₹' + Math.round(v).toLocaleString('en-IN');

  // ── 1. Problem: a packed week, then the laundry pile ──
  const cal = el('div', 'abs', stage, 'width:1080px;height:1920px');
  const calBlocks = [];
  const COLS = ['#013E86', '#54B6F8', '#FE8701', '#FFA742', '#0A1C3E', '#D30D24', '#9DB8D9'];
  let rnd = 7; const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
  ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach((d, i) => {
    el('div', '', cal, `position:absolute;left:${130 + i * 120}px;top:1010px;width:100px;text-align:center;font-weight:600;font-size:30px;color:#8A8F9C`, d);
    let y = 1070; const n = 3 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const h = 60 + Math.floor(rand() * 90);
      const b = el('div', 'cal', cal, `left:${135 + i * 120}px;top:${y}px;width:90px;height:${h}px;background:${COLS[Math.floor(rand() * COLS.length)]}`);
      calBlocks.push({ e: b, t: 0.45 + calBlocks.length * 0.042, vy: rand() }); y += h + 12;
    }
  });
  calBlocks.forEach((b) => cue(b.t, 'blip', 0.35));
  cue(1.95, 'whoosh', 0.8);

  const pile = el('div', 'abs', stage, 'width:1080px;height:1920px');
  const CLOTH = ['#013E86', '#FFA742', '#54B6F8', '#FFFFFF', '#D30D24', '#0A1C3E', '#FE8701', '#C9D9EE', '#2B5FA8', '#FFFFFF', '#FFA742'];
  const cloths = []; let stackY = 1650;
  CLOTH.forEach((c, i) => {
    const w = 330 + rand() * 120, h = 64 + rand() * 14; stackY -= h - 4;
    const e = el('div', 'cloth', pile, `width:${w}px;height:${h}px;background:${c};${c === '#FFFFFF' ? 'box-shadow:inset 0 0 0 3px #DDD6CA;' : ''}`);
    const ci = { e, w, h, x: 540 - w / 2 + (rand() - 0.5) * 70, y: stackY, r: (rand() - 0.5) * 9, t: 2.35 + i * 0.19 };
    cloths.push(ci); cue(ci.t + 0.28, 'thud', 0.8);
  });
  const shirt = el('img', 'illus', pile, 'width:330px'); shirt.src = 'assets/illus/worried-stained-shirt.png';
  cue(3.95, 'pop', 0.8); cue(5.2, 'suck', 1);

  // ── 2. Logo, assembled from the real logo artwork ──
  const LP = window.LOGO_PARTS;
  const mkLogo = () => {
    const g = el('div', 'abs', stage, 'width:1254px;height:1254px;transform-origin:0 0'); const parts = {};
    ['basket', 'towel', 'clothRed', 'clothTop', 'sparkles'].forEach((n) => {
      const p = LP[n]; const im = el('img', 'logoPart', g, `left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px;transform-origin:50% 50%`);
      im.src = `assets/logo/${n}.png`; parts[n] = im;
    });
    return { g, parts };
  };
  const WM = window.WORDMARK;
  const mkWm = (h) => el('div', 'abs', stage, `width:${WM.w * h}px;height:${h * 1.3}px`, `<svg width="${(WM.w * h).toFixed(1)}" height="${(h * 1.3).toFixed(1)}" viewBox="0 -1.02 ${WM.w} 1.3"><path d="${WM.d}" fill="#013E86"/></svg>`);
  const logoA = mkLogo(), wmA = mkWm(76), logoB = mkLogo(), wmB = mkWm(76);
  const PC = { x: (241 + 1010) / 2, y: (217 + 998) / 2 };
  // Mirrors the app's AnimatedLogo intro (INTRO_TIMELINE, ms): basket glides in from the right with a tilt (50),
  // towel unrolls (560), red cloth falls (980), orange cloth falls (1400), sparkles pop (1790), then the lockup
  // glides left and the wordmark reveals (2250).
  const KL = 0.27, WMH = 76, LX0 = 182, LCX = LX0 + (1010 - 241) * KL / 2, WMX = LX0 + (1010 - 241) * KL + 34;
  const kick = (t, a) => { const d = seg(t, a, a + 0.3); return d > 0 && d < 1 ? Math.exp(-5.5 * d) * Math.cos(Math.PI * 3 * d) : 0; };
  function drawLogo(L, wm, t, T0, cy) {
    const at = (ms) => T0 + ms / 1000, P = L.parts;
    const bx = eOut(seg(t, at(50), at(530))), sett = seg(t, at(530), at(900));
    const g = kick(t, at(1265)) + kick(t, at(1685));
    const tilt = -2.6 * (1 - bx) + 2.4 * Math.sin(Math.PI * sett) * (1 - sett);
    const base = `translateX(${(1 - bx) * 900}px) translateY(${g * 1254 * 0.03}px) rotate(${tilt}deg)`;
    P.basket.style.transformOrigin = '50% 100%'; P.basket.style.opacity = seg(t, at(50), at(150));
    P.basket.style.transform = `${base} scaleY(${1 - g * 0.07}) scaleX(${1 + g * 0.035})`;
    const tk = seg(t, at(560), at(960)), un = 1 - Math.pow(1 - tk, 2.4);
    const sway = kick(t, at(1265)) * 8.5 + kick(t, at(1685)) * 6 + (tk > 0 && tk < 1 ? Math.exp(-4.5 * tk) * Math.sin(Math.PI * 3 * tk) * 9 : 0);
    P.towel.style.transformOrigin = '50% 0'; P.towel.style.opacity = seg(t, at(560), at(640));
    P.towel.style.transform = `${base} rotate(${sway}deg) scaleY(${Math.max(0.001, un + 0.2 * kick(t, at(1265)))})`;
    const cloth = (im, from, tl) => {
      const k = seg(t, from, from + 0.285), fall = k * k, r = seg(t, from + 0.285, from + 0.495);
      const sq = r > 0 ? Math.exp(-6.5 * r) * Math.cos(Math.PI * 2.5 * r) : 0, reb = Math.sin(Math.PI * Math.min(1, r * 1.6)) * (1 - r) * 276 * 0.14;
      im.style.transformOrigin = '50% 100%'; im.style.opacity = Math.min(1, k * 5);
      im.style.transform = `translateY(${-(1 - fall) * 441 - reb + g * 1254 * 0.02}px) rotate(${(1 - fall) * tl}deg) scaleY(${1 - sq * 0.22}) scaleX(${1 + sq * 0.11})`;
    };
    cloth(P.clothRed, at(980), -8); cloth(P.clothTop, at(1400), 7);
    const sk = seg(t, at(1790), at(1970)), pop = sk < 1 ? 0.4 + sk * 0.75 : 1.15 - seg(t, at(1970), at(2120)) * 0.15;
    P.sparkles.style.opacity = Math.min(1, sk * 2.5); P.sparkles.style.transform = `scale(${t < at(1790) ? 0 : pop * (1 + 0.02 * Math.sin(t * 4))}) rotate(${(1 - sk) * -45}deg)`;
    const m = eInOut(seg(t, at(2250), at(2850))), k = lerp(0.46, KL, m), cx = lerp(540, LCX, m);
    L.g.style.transform = `translate(${cx - PC.x * k}px,${cy - PC.y * k}px) scale(${k})`;
    const wr = eOut(seg(t, at(2400), at(3050)));
    wm.style.transform = `translate(${WMX - (1 - wr) * 40}px,${cy - 0.555 * WMH}px)`; wm.style.clipPath = `inset(0 ${100 - wr * 100}% 0 0)`;
  }
  const cueLogo = (T0) => { cue(T0 + 0.05, 'whoosh', 1); cue(T0 + 0.5, 'thump', 1); cue(T0 + 0.6, 'swish', 0.6); cue(T0 + 1.265, 'drop', 1.1); cue(T0 + 1.685, 'drop', 1.1); cue(T0 + 1.79, 'shimmer', 1.3); cue(T0 + 2.25, 'swoosh', 0.9); };
  cueLogo(6.05); cueLogo(55.6);

  // ── 3. Phone ──
  const shadow = el('div', 'abs', stage, ''); shadow.id = 'shadow';
  const phone = el('div', 'abs', stage, 'transform-origin:320px 669px'); phone.id = 'phone';
  el('div', 'frame', phone); el('div', 'bezel', phone);
  const screen = el('div', '', phone); screen.id = 'screen';
  const shots = [
    [0, 's01-login'], [14.35, 's02-phone'], [14.85, 's03-otp'], [16.2, 's04-otp-filled'],
    [16.95, 'h01-home'], [21.35, 'w01-wallet'], [23.3, 'w03-topup-2000'], [26.35, 'w05-topup-done'],
    [28.25, 'b04-items-done'], [30.5, 'b07-days'], [31.55, 'b08-day-picked'], [32.35, 'b09-slots'], [33.25, 'b10-slot-picked'], [34.55, 'b11-review'],
    [37.75, 'o05-order'], [38.85, 'p01-pay-sheet'], [40.65, 'p03-coupon-applied'], [43.15, 'p05-paying-2'], [43.6, 'p05-paying-3'], [44.05, 'p05-paying-4'], [44.35, 'p05-paying-5'], [44.65, 'p05-paying-6'], [44.95, 'p05-paying-7'],
    [46.2, 'o05-order'], [48.0, 'q01-qr-unlocked'], [52.05, 'r-ready-progress'],
  ].map(([t, n]) => { const im = el('img', '', screen); im.src = SCR(n); return { t, im }; });
  el('div', '', screen).id = 'island';
  const tapEl = el('div', '', screen); tapEl.id = 'tap';
  const dim = el('div', '', screen); dim.id = 'dim';
  const TAPS = [[14.55, 0.5, 0.812], [16.3, 0.5, 0.9], [22.9, 0.5, 0.875], [23.9, 0.8, 0.67], [24.35, 0.5, 0.94],
    [31.45, 0.3, 0.375], [33.15, 0.26, 0.495], [34.4, 0.86, 0.915], [38.6, 0.74, 0.725], [40.4, 0.45, 0.43], [42.95, 0.5, 0.915]];
  TAPS.forEach(([t]) => cue(t, 'click', 1));
  const CAM = [[0, 540, 2350, 0.9, -10], [11.55, 540, 2350, 0.9, -10], [12.5, 540, 1202, 0.96, 0], [55.2, 540, 1202, 0.96, 0], [56.05, 540, 2500, 0.92, 7], [60, 540, 2500, 0.92, 7]];
  cue(11.6, 'whoosh', 1.2); cue(55.2, 'whoosh', 1);
  function cam(t) {
    let i = 0; while (i < CAM.length - 2 && t >= CAM[i + 1][0]) i++;
    const a = CAM[i], b = CAM[i + 1], p = eInOut(seg(t, a[0], b[0]));
    return { cx: lerp(a[1], b[1], p), cy: lerp(a[2], b[2], p) + Math.sin(t * 0.6) * 5, s: lerp(a[3], b[3], p), r: lerp(a[4], b[4], p) + Math.sin(t * 0.45) * 0.35 };
  }
  const toStage = (C, fx, fy) => ({ x: C.cx + (20 - 320 + fx * 600) * C.s, y: C.cy + (20 - 669 + fy * 1298) * C.s });

  // ── 4. Lifted UI cards: crops of the real screens that rise out of the phone ──
  const CARDS = [
    { k: 'field', t0: 12.75, t1: 14.75, imgs: [['s02-phone', 0]], to: [540, 900, 1000], rot: -1,
      wipe: { rect: [0.285, 0.684, 0.60, 0.722], color: 'rgb(244,242,235)', a: 13.2, b: 14.3, steps: 11 } },
    { k: 'otp', t0: 15.0, t1: 16.85, imgs: [['s03-otp', 0]], to: [540, 900, 1000], rot: 1,
      boxes: { img: 's04-otp-filled', t: 15.35, dt: 0.15, x: 0.058, w: 0.134, step: 0.15, y0: 0.700, y1: 0.771 } },
    { k: 'orders', t0: 17.5, t1: 21.2, imgs: [['h01-home', 0]], to: [540, 820, 980], rot: -1.2 },
    { k: 'hwallet', t0: 18.3, t1: 21.2, imgs: [['h01-home', 0]], to: [700, 1230, 560], rot: 2.5 },
    { k: 'wcard', t0: 21.75, t1: 23.2, imgs: [['w01-wallet', 0]], to: [540, 840, 980], rot: -1 },
    { k: 'chips', t0: 23.45, t1: 24.5, imgs: [['w03-topup-2000', 0]], to: [540, 900, 980], rot: 0, punch: 23.9 },
    { k: 'wcard', t0: 26.45, t1: 28.15, imgs: [['w05-topup-done', 0]], to: [540, 760, 980], rot: -1, punch: 27.0 },
    { k: 'txns', t0: 26.95, t1: 28.15, imgs: [['w05-topup-done', 0]], to: [540, 1330, 940], rot: 1 },
    { k: 'service', t0: 28.65, t1: 30.55, imgs: [['b04-items-done', 0]], to: [540, 820, 980], rot: -1 },
    { k: 'items', t0: 29.2, t1: 30.55, imgs: [['b11-review', 0]], to: [540, 1230, 940], rot: 1.2, from: 'below' },
    { k: 'days', t0: 30.75, t1: 34.5, imgs: [['b07-days', 0], ['b08-day-picked', 31.55]], to: [540, 800, 1000], rot: 0, punch: 31.55 },
    { k: 'slots', t0: 32.6, t1: 34.5, imgs: [['b09-slots', 0], ['b10-slot-picked', 33.25]], to: [540, 1230, 1000], rot: 0, punch: 33.25 },
    { k: 'pickup', t0: 34.8, t1: 37.65, imgs: [['b11-review', 0]], to: [540, 820, 1000], rot: -1 },
    { k: 'bill', t0: 35.4, t1: 37.65, imgs: [['b11-review', 0]], to: [540, 1180, 960], rot: 1 },
    { k: 'coupon', t0: 39.05, t1: 42.5, imgs: [['p01-pay-sheet', 0], ['p03-coupon-applied', 40.65]], to: [540, 830, 1000], rot: -2, punch: 40.65, stamp: true },
    { k: 'pbill', t0: 41.0, t1: 42.5, imgs: [['p01-pay-sheet', 0], ['p03-coupon-applied', 41.6]], to: [540, 1370, 960], rot: 1 },
    { k: 'paybtn', t0: 42.4, t1: 43.35, imgs: [['p03-coupon-applied', 0]], to: [540, 1100, 960], rot: 0, punch: 42.95 },
    { k: 'slip', t0: 43.75, t1: 45.25, imgs: [['p05-paying-3', 0], ['p05-paying-4', 44.05], ['p05-paying-5', 44.35], ['p05-paying-6', 44.65], ['p05-paying-7', 44.95]], to: [540, 1090, 640], rot: 0 },
    { k: 'qr', t0: 46.45, t1: 51.95, imgs: [['o05-order', 0], ['q01-qr-unlocked', 48.0]], to: [540, 1060, 880], rot: 0,
      wiggle: [47.1, 47.65], flash: 47.95, scan: { t0: 48.5, t1: 50.6, rect: [0.27, 0.32, 0.73, 0.58], beep: 50.3 } },
    { k: 'prog', t0: 52.45, t1: 55.45, imgs: [['r-ready-progress', 0]], to: [540, 980, 940], rot: 0,
      pops: [0.046, 0.114, 0.183, 0.252, 0.324].map((c, i) => ({ rect: [0.04, c - 0.034, 0.96, c + 0.034], color: '#fff', t: 52.85 + 0.45 * i, fade: 0.28, k: 'step' })) },
  ];
  const NW0 = 780, NH0 = 1688;
  CARDS.forEach((c, idx) => {
    const CR = window.CROPS[c.k]; c.crop = CR.c;
    const [x0, y0, x1, y1] = c.crop;
    c.nw = NW0 * (x1 - x0); c.nh = NH0 * (y1 - y0); c.idx = idx;
    c.e = el('div', 'card', stage, `width:${c.nw}px;height:${c.nh}px;border-radius:${CR.r}px`);
    const L = (fx) => (fx - x0) * NW0, T = (fy) => (fy - y0) * NH0;
    c.ims = c.imgs.map(([n, t]) => { const im = el('img', '', c.e, `left:${-x0 * NW0}px;top:${-y0 * NH0}px`); im.src = SCR(n); return { im, t }; });
    if (c.wipe) {
      const r = c.wipe.rect; c.wipe.e = el('div', 'cover', c.e, `top:${T(r[1])}px;height:${T(r[3]) - T(r[1])}px;background:${c.wipe.color}`);
      c.wipe.caret = el('div', 'caret', c.e, `top:${T(r[1]) + 4}px;height:${T(r[3]) - T(r[1]) - 8}px`);
      c.wipe.L = L; for (let k = 0; k < c.wipe.steps; k++) if (k !== 5) cue(c.wipe.a + ((c.wipe.b - c.wipe.a) * (k + 0.5)) / c.wipe.steps, 'type', 1);
    }
    (c.pops || []).forEach((p) => { const r = p.rect; p.e = el('div', 'cover', c.e, `left:${L(r[0])}px;top:${T(r[1])}px;width:${L(r[2]) - L(r[0])}px;height:${T(r[3]) - T(r[1])}px;background:${p.color};border-radius:10px`); cue(p.t, p.k, 1); });
    (c.rings || []).forEach((g) => { const r = g.rect; g.e = el('div', 'ring', c.e, `left:${L(r[0]) - 6}px;top:${T(r[1]) - 6}px;width:${L(r[2]) - L(r[0]) + 12}px;height:${T(r[3]) - T(r[1]) + 12}px`); cue(g.t, 'ding', 1); });
    if (c.badge) { const b = c.badge; b.e = el('div', 'lay', c.e, `left:${L(b.fx) - 34}px;top:${T(b.fy) - 34}px;width:68px;height:68px;border-radius:50%;background:#16A34A;transform-origin:50% 50%;box-shadow:0 8px 18px rgba(22,163,74,.35)`, '<svg width="68" height="68" viewBox="0 0 68 68"><path d="M20 35 L30 45 L49 24" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>'); cue(b.t, 'success', 0.9); }
    if (c.flash) { c.flashE = el('div', 'lay', c.e, `width:${c.nw}px;height:${c.nh}px;background:radial-gradient(closest-side,rgba(255,255,255,1),rgba(255,255,255,.6) 60%,rgba(255,255,255,0));opacity:0`); cue(c.flash - 0.1, 'unlock', 1.2); }
    if (c.wiggle) cue(c.wiggle[0], 'locked', 1);
    if (c.boxes) { const B = c.boxes; B.els = []; for (let i = 0; i < 6; i++) { const bx = B.x + i * B.step; const d = el('div', 'lay', c.e, `left:${L(bx)}px;top:${T(B.y0)}px;width:${B.w * NW0}px;height:${(B.y1 - B.y0) * NH0}px;overflow:hidden;transform-origin:50% 50%;opacity:0`); const im = el('img', '', d, `left:${-bx * NW0}px;top:${-B.y0 * NH0}px`); im.src = SCR(B.img); B.els.push({ d, t: B.t + i * B.dt }); cue(B.t + i * B.dt, 'tick', 1); } }
    if (c.scan) {
      const r = c.scan.rect, s = c.scan;
      s.e = el('div', 'lay scan', c.e, `left:${L(r[0])}px;top:${T(r[1])}px;width:${L(r[2]) - L(r[0])}px;height:${T(r[3]) - T(r[1])}px;opacity:0`);
      s.cs = ['left:0;top:0;border-right:0;border-bottom:0;border-top-left-radius:22px', 'right:0;top:0;border-left:0;border-bottom:0;border-top-right-radius:22px', 'left:0;bottom:0;border-right:0;border-top:0;border-bottom-left-radius:22px', 'right:0;bottom:0;border-left:0;border-top:0;border-bottom-right-radius:22px'].filter(() => false); // the app's own QR corners are used
      s.bar = el('div', 'bar', s.e, ''); s.h = T(r[3]) - T(r[1]);
      cue(s.t0, 'scan', 1); cue(s.beep, 'beep', 1.2);
    }
    if (c.punch) cue(c.punch, c.stamp ? 'stamp' : 'pop', 1.2);
    cue(c.t0, 'lift', 1); cue(c.t1 - 0.36, 'swish', 0.7);
  });

  function drawCards(t, C) {
    let lift = 0;
    for (const c of CARDS) {
      if (t < c.t0 || t > c.t1) { c.e.style.opacity = 0; continue; }
      const [x0, y0] = c.crop;
      const o = toStage(C, x0, y0);
      let ox = o.x, oy = o.y, os = (600 * C.s) / NW0;
      const st = c.to[2] / c.nw, tx = c.to[0] - c.to[2] / 2, ty = c.to[1] - (c.nh * st) / 2;
      if (c.from === 'below') { ox = tx; oy = ty + 420; os = st * 0.9; }
      const pr = seg(t, c.t0, c.t0 + 0.5), p = eOut(pr);
      const q = eIn(seg(t, c.t1 - 0.36, c.t1));
      let op = c.from === 'below' ? seg(t, c.t0, c.t0 + 0.3) : seg(t, c.t0, c.t0 + 0.1);
      const pe = p * (1 - q);
      let x = lerp(ox, tx, pe), y = lerp(oy, ty, pe);
      const base = lerp(os, st, pe);
      let s = base * (1 + 0.035 * eInOut(seg(t, c.t0 + 0.4, c.t1 - 0.36)) * (1 - q));
      let r = c.rot * pe - 3 * (1 - p);
      op *= 1 - seg(q, 0.92, 1);
      if (c.out === 'up') { y -= 300 * eIn(q); op *= 1 - q; }
      if (c.out === 'fade') { s *= 1 - 0.08 * q; op *= 1 - q; }
      y += Math.sin((t - c.t0) * 1.7 + c.idx) * 7 * p * (1 - q);
      if (c.punch && t >= c.punch) { const d = t - c.punch; s *= 1 - 0.07 * Math.exp(-d * 7) * Math.sin(d * 22); }
      if (c.wiggle && t >= c.wiggle[0] && t <= c.wiggle[1]) r += Math.sin((t - c.wiggle[0]) * 45) * 3.2 * Math.sin(Math.PI * seg(t, c.wiggle[0], c.wiggle[1]));
      x -= (c.nw * s - c.nw * base) / 2; y -= (c.nh * s - c.nh * base) / 2;
      c.e.style.opacity = op;
      c.e.style.transform = `translate(${x}px,${y}px) rotate(${r}deg) scale(${s})`;
      const sh = p * (1 - q);
      c.e.style.boxShadow = `0 ${36 * sh}px ${70 * sh}px rgba(52,40,22,${0.24 * sh}), 0 ${8 * sh}px ${18 * sh}px rgba(52,40,22,${0.12 * sh})`;
      c.ims.forEach((m, i) => { m.im.style.opacity = i === 0 ? 1 : seg(t, m.t, m.t + 0.22); });
      if (c.wipe) {
        const w2 = c.wipe, r2 = w2.rect, k = Math.floor(seg(t, w2.a, w2.b) * w2.steps) / w2.steps;
        const left = w2.L(r2[0]) + k * (w2.L(r2[2]) - w2.L(r2[0]));
        w2.e.style.left = left + 'px'; w2.e.style.width = Math.max(0, w2.L(r2[2]) - left) + 'px';
        w2.caret.style.left = left + 2 + 'px'; w2.caret.style.opacity = (t > w2.a && t < w2.b) || Math.floor(t * 2.2) % 2 === 0 ? 1 : 0;
      }
      (c.pops || []).forEach((pp) => { const f = seg(t, pp.t, pp.t + (pp.fade || 0.12)); pp.e.style.opacity = 1 - f; pp.e.style.transform = pp.fade ? `translateX(${f * 40}px)` : `scale(${1 - f})`; });
      (c.rings || []).forEach((g) => { const f = seg(t, g.t, g.t + 0.35); g.e.style.opacity = f * (0.85 + 0.15 * Math.sin((t - g.t) * 6)); g.e.style.transform = `scale(${lerp(1.25, 1, eOut(f))})`; });
      if (c.boxes) c.boxes.els.forEach((b) => { const f = eBack(seg(t, b.t, b.t + 0.3)); b.d.style.opacity = seg(t, b.t, b.t + 0.06); b.d.style.transform = `scale(${0.6 + 0.4 * f})`; });
      if (c.badge) { const f = eBack(seg(t, c.badge.t, c.badge.t + 0.4)); c.badge.e.style.transform = `scale(${f})`; c.badge.e.style.opacity = seg(t, c.badge.t, c.badge.t + 0.05); }
      if (c.flashE) c.flashE.style.opacity = Math.sin(Math.PI * seg(t, c.flash - 0.15, c.flash + 0.45));
      if (c.scan) {
        const s2 = c.scan, f = seg(t, s2.t0, s2.t0 + 0.3) * (1 - seg(t, s2.t1, s2.t1 + 0.3));
        s2.e.style.opacity = f; s2.e.style.transform = `scale(${lerp(1.15, 1, eOut(seg(t, s2.t0, s2.t0 + 0.4)))})`;
        const ok = t >= s2.beep; s2.cs.forEach((cc) => (cc.style.borderColor = ok ? '#16A34A' : '#FE8701'));
        s2.bar.style.top = s2.h * (0.5 - 0.46 * Math.cos((t - s2.t0) * 3.4)) + 'px'; s2.bar.style.opacity = ok ? 0 : 1;
      }
      lift = Math.max(lift, sh);
    }
    return lift;
  }

  // ── 5. Film graphics ──
  const panel = el('div', 'abs', stage, 'width:900px;height:620px;border-radius:44px;background:#fff;box-shadow:0 40px 90px rgba(52,40,22,.18)');
  const counter = el('div', 'abs', stage, ''); counter.id = 'counter';
  counter.innerHTML = '<div class="lab" id="cLab">Demo top-up</div><div class="num" id="cNum">₹0</div><div class="rule">5% extra on top-ups of ₹2,000 or more</div>';
  const bonus = el('div', 'chip abs', stage, 'background:#FE8701;color:#fff;box-shadow:0 16px 32px rgba(254,135,1,.3)', '+ ₹100 bonus');
  for (let i = 0; i < 16; i++) cue(24.62 + i * 0.045, 'tick', 0.55);
  cue(25.45, 'pop', 1.2); for (let i = 0; i < 6; i++) cue(25.65 + i * 0.06, 'tick', 0.55); cue(26.05, 'success', 1);

  const burst = el('div', 'abs', stage, 'width:1080px;height:1920px');
  const waves = [0, 1, 2].map(() => el('div', 'wave', burst, ''));
  const check = el('div', 'check abs', burst, '', '<svg width="300" height="300" viewBox="0 0 300 300"><path d="M88 156 L132 198 L214 110" fill="none" stroke="#fff" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="220" stroke-dashoffset="220"/></svg>');
  const ckp = check.querySelector('path');
  const paid = el('div', 'abs', burst, 'width:1080px;text-align:center;font-weight:700;font-size:64px;letter-spacing:-0.03em;color:#0A1C3E', 'Payment successful<div style="font-weight:600;font-size:38px;color:#16A34A;margin-top:12px;letter-spacing:-0.01em">₹181 paid from wallet</div>');
  cue(45.25, 'success', 1.4); cue(45.25, 'impact', 1); for (let i = 0; i < 12; i++) cue(43.8 + i * 0.11, 'type', 0.45); // receipt printing

  const ill = ['washing-and-drying', 'ironing-and-packing', 'out-for-delivery'].map((n, i) => { const im = el('img', 'illus', stage, 'width:290px'); im.src = `assets/illus/${n}.png`; return { im, t: 53.3 + 0.45 * i, x: 200 + i * 340 }; });
  const cta = el('div', 'abs', stage, 'width:1080px;text-align:center'); cta.id = 'cta'; cta.innerHTML = '<span>Get started today</span>';
  cue(58.8, 'pop', 1);

  // ── 6. Kinetic headlines ──
  const HEADS = [
    { t0: 0.45, t1: 2.15, y: 600, size: 116, lines: [['Your week'], ['is packed.']] },
    { t0: 2.15, t1: 5.55, y: 250, size: 96, lines: [['And the laundry?'], ['It keeps piling up.', 1.25, 'accent']] },
    { t0: 9.25, t1: 11.45, y: 1040, size: 58, w: 600, lines: [['Laundry, made effortless.', 0, 'accent']] },
    { t0: 11.85, t1: 16.9, y: 236, size: 92, lines: [['Get started'], ['in seconds.', 0.15, 'accent']] },
    { t0: 17.0, t1: 21.3, y: 236, size: 84, lines: [['Your laundry.'], ['One simple dashboard.', 0.15, 'accent']] },
    { t0: 21.4, t1: 28.2, y: 236, size: 92, lines: [['More value.'], ['Every top-up.', 0.15, 'accent']] },
    { t0: 28.3, t1: 37.7, y: 236, size: 92, lines: [['Book your pickup.'], ['Your way.', 0.15, 'accent']] },
    { t0: 37.8, t1: 46.15, y: 236, size: 92, lines: [['Smart savings.'], ['Simple payments.', 0.15, 'accent']] },
    { t0: 46.15, t1: 52.1, y: 236, size: 92, lines: [['Your order.'], ['One secure QR.', 0.15, 'accent']] },
    { t0: 52.2, t1: 55.45, y: 236, size: 92, lines: [['Track every step.'], ['Right to your door.', 0.15, 'accent']] },
    { t0: 58.35, t1: 61, y: 980, size: 58, w: 600, lines: [['Laundry, made effortless.', 0, 'accent']] },
  ];
  HEADS.forEach((h) => {
    h.e = el('div', 'head', stage, `top:${h.y}px;font-size:${h.size}px;font-weight:${h.w || 700}`); h.words = [];
    h.lines.forEach(([txt, at, cls]) => {
      const ln = el('span', 'ln' + (cls ? ' ' + cls : ''), h.e); const ws = txt.split(' ');
      ws.forEach((wd, i) => {
        const w = el('span', 'w', ln); const inner = el('span', '', w, '', wd);
        if (i < ws.length - 1) ln.appendChild(document.createTextNode(' '));
        h.words.push({ e: inner, t: h.t0 + (at || 0) + h.words.length * 0.065 });
      });
    });
    cue(h.t0, 'swoosh', 0.55);
  });
  function drawHeads(t) {
    for (const h of HEADS) {
      const on = t >= h.t0 && t < h.t1; show(h.e, on); if (!on) continue;
      const out = eIn(seg(t, h.t1 - 0.42, h.t1));
      h.words.forEach((w) => { const p = eOut(seg(t, w.t, w.t + 0.8)); w.e.style.transform = `translateY(${(1 - p) * 110 - out * 110}%)`; w.e.style.opacity = p > 0 ? 1 : 0; });
    }
  }

  // ── render ──
  window.CUES = CUES.sort((a, b) => a.t - b.t);
  window.render = (t) => {
    drawHeads(t);
    show(cal, t < 2.8);
    calBlocks.forEach((b) => {
      const p = eBack(seg(t, b.t, b.t + 0.35)), f = seg(t, 1.95 + b.vy * 0.25, 2.75);
      b.e.style.transform = `translateY(${eIn(f) * 1100}px) rotate(${f * (b.vy - 0.5) * 60}deg) scale(${p})`; b.e.style.opacity = p > 0 ? 1 : 0;
    });
    show(pile, t > 2.2 && t < 6.2);
    const suck = (d) => eIn(seg(t, 5.2 + d, 5.75 + d));
    cloths.forEach((c, i) => {
      const q = spring(t - c.t), sk = suck((cloths.length - i) * 0.025);
      const shake = t > 4.6 && t < 5.2 ? Math.sin(t * 38 + i) * 1.4 : 0;
      const x = lerp(c.x, 540 - c.w / 2, sk), y = lerp(lerp(-200, c.y, q), 1180, sk);
      c.e.style.transform = `translate(${x}px,${y}px) rotate(${c.r * q + shake}deg) scale(${1 - sk * 0.85})`;
      c.e.style.opacity = (t > c.t ? 1 : 0) * (1 - seg(sk, 0.8, 1));
    });
    const sp = eBack(seg(t, 3.95, 4.4)), ssk = suck(0);
    shirt.style.transform = `translate(${lerp(640, 375, ssk)}px,${lerp(700, 1050, ssk)}px) rotate(${10 + Math.sin(t * 5) * 4}deg) scale(${sp * (1 - ssk * 0.9)})`;
    shirt.style.opacity = sp > 0 ? 1 - seg(ssk, 0.8, 1) : 0;

    const lx = eIn(seg(t, 11.25, 11.85));
    const onA = t > 5.9 && t < 11.9; show(logoA.g, onA); show(wmA, onA);
    if (onA) { drawLogo(logoA, wmA, t, 6.05, 880 - lx * 400); logoA.g.style.opacity = wmA.style.opacity = 1 - lx; }
    const onB = t > 55.55; show(logoB.g, onB); show(wmB, onB);
    if (onB) drawLogo(logoB, wmB, t, 55.6, 820);
    const cp = eBack(seg(t, 58.8, 59.3));
    show(cta, t > 58.7); cta.style.transform = `translateY(${1130 + (1 - cp) * 60}px) scale(${0.9 + 0.1 * cp})`; cta.style.opacity = seg(t, 58.8, 59.0);

    const C = cam(t);
    const onP = t > 11.5 && t < 56.1; show(phone, onP); show(shadow, onP);
    if (onP) {
      phone.style.transform = `translate(${C.cx - 320}px,${C.cy - 669}px) rotate(${C.r}deg) scale(${C.s})`;
      const bottom = C.cy + 669 * C.s;
      shadow.style.transform = `translate(${C.cx - 350}px,${Math.min(bottom, 1880) - 40}px) scale(${C.s})`;
      shadow.style.opacity = clamp(1 - (bottom - 1850) / 300);
      let cur = 0; shots.forEach((s, i) => { if (t >= s.t) cur = i; });
      shots.forEach((s, i) => { s.im.style.opacity = i === cur ? seg(t, s.t, s.t + 0.18) : i === cur - 1 ? 1 : 0; s.im.style.zIndex = i === cur ? 2 : 1; });
      let tp = null; TAPS.forEach((k) => { if (t >= k[0] && t < k[0] + 0.5) tp = k; });
      if (tp) { const f = seg(t, tp[0], tp[0] + 0.5); tapEl.style.left = tp[1] * 600 + 'px'; tapEl.style.top = tp[2] * 1298 + 'px'; tapEl.style.opacity = (1 - f) * 0.95; tapEl.style.transform = `scale(${0.45 + 0.75 * eOut(f)})`; } else tapEl.style.opacity = 0;
    }
    const lift = drawCards(t, C);

    const cin = eOut(seg(t, 24.45, 25.0)), cout = eInOut(seg(t, 26.15, 26.55));
    const onC = t > 24.4 && t < 26.6; show(panel, onC); show(counter, onC); show(bonus, onC);
    if (onC) {
      const y = 690 + (1 - cin) * 120 - cout * 120;
      panel.style.transform = `translate(90px,${y}px) scale(${0.94 + 0.06 * cin})`; panel.style.opacity = cin * (1 - cout);
      counter.style.transform = `translate(0px,${y + 80}px)`; counter.style.opacity = cin * (1 - cout);
      $('cNum').textContent = inr(2000 * eOut(seg(t, 24.6, 25.35)) + 100 * eOut(seg(t, 25.65, 26.0)));
      $('cLab').textContent = t < 25.65 ? 'Demo top-up' : 'New balance';
      $('cNum').style.color = t < 25.65 ? '#0A1C3E' : '#013E86';
      const bp = eBack(seg(t, 25.4, 25.75));
      bonus.style.transform = `translate(370px,${y + 420}px) scale(${bp})`; bonus.style.opacity = bp > 0 ? 1 - cout : 0;
    }
    const onB2 = t > 45.2 && t < 46.25; show(burst, onB2);
    if (onB2) {
      const bo = 1 - seg(t, 45.85, 46.2), cs = eBack(seg(t, 45.25, 45.7));
      check.style.transform = `translate(390px,1030px) scale(${cs})`; check.style.opacity = bo;
      const pp = eOut(seg(t, 45.6, 46.1)); paid.style.transform = `translateY(${1400 + (1 - pp) * 50}px)`; paid.style.opacity = pp * bo;
      ckp.setAttribute('stroke-dashoffset', 220 * (1 - eOut(seg(t, 45.5, 45.9))));
      waves.forEach((w, i) => { const f = seg(t, 45.35 + i * 0.15, 46.2 + i * 0.1), r = 150 + 330 * eOut(f); w.style.cssText = `left:${540 - r}px;top:${1180 - r}px;width:${2 * r}px;height:${2 * r}px;opacity:${(1 - f) * bo}`; });
    }
    ill.forEach((m) => { const p = eBack(seg(t, m.t, m.t + 0.45)), o = seg(t, 55.0, 55.45); show(m.im, t > m.t && t < 55.5); m.im.style.transform = `translate(${m.x - 145}px,${1470 + (1 - p) * 80 - o * 200 + Math.sin(t * 2 + m.x) * 6}px) scale(${p})`; m.im.style.opacity = 1 - o; });

    const extra = Math.max(Math.min(seg(t, 24.4, 24.8), 1 - seg(t, 26.2, 26.6)), Math.min(seg(t, 45.2, 45.5), 1 - seg(t, 45.9, 46.25)));
    dim.style.opacity = Math.max(lift * 0.6, extra * 0.9);
  };
  window.ready = Promise.all([document.fonts.ready, ...[...document.images].map((im) => (im.complete ? 1 : new Promise((r) => { im.onload = im.onerror = r; })))]).then(() => { window.render(0); return true; });
})();
