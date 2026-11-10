/* Washing Basket — 60 s brand film. Deterministic: window.render(t) draws the frame at t seconds. */
(() => {
  const DUR = 60;
  const K = 600 / 390; // app screenshots are 390×844 CSS px; the phone screen is 600 px wide
  const A = { x: 540, y: 1135 }; // where the camera focus point sits on the canvas
  const BEZ = 20;

  /* ── easing ── */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const eio = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2); // cubic in-out
  const eout = (p) => 1 - Math.pow(1 - p, 3);
  const eout5 = (p) => 1 - Math.pow(1 - p, 5);
  const ein = (p) => p * p * p;
  const spring = (p) => (p >= 1 ? 1 : 1 - Math.exp(-6.5 * p) * Math.cos(9 * p)); // gentle settle, small overshoot
  const prog = (t, a, b) => clamp((t - a) / (b - a));

  /* ── scenes: headline + one supporting line ── */
  const SCENES = [
    { a: 5.0, b: 12.0, eb: '01 · SIGN UP', h: ['GET STARTED', 'IN SECONDS.'], s: 'Your mobile number and a one-time code.' },
    { a: 12.0, b: 17.0, eb: '02 · DASHBOARD', h: ['YOUR LAUNDRY.', 'ONE SIMPLE DASHBOARD.'], s: 'A new account starts at <b>₹0</b> and <b>0</b> orders.' },
    { a: 17.0, b: 23.0, eb: '03 · WALLET', h: ['MORE VALUE.', 'EVERY TOP-UP.'], s: 'Top up <b>₹2,000</b>, get a <b>5% bonus</b>: <b>₹2,100</b>.' },
    { a: 23.0, b: 37.0, eb: '04 · BOOKING', h: ['BOOK YOUR PICKUP.', 'YOUR WAY.'], s: 'Pick a service, a day and a two-hour slot.' },
    { a: 37.0, b: 46.0, eb: '05 · COUPON & PAYMENT', h: ['SMART SAVINGS.', 'SIMPLE PAYMENTS.'], s: '<b>FIRSTWASH</b> saves ₹33. Pay <b>₹181</b> from your wallet.' },
    { a: 46.0, b: 52.0, eb: '06 · QR CODE', h: ['YOUR ORDER.', 'ONE SECURE QR.'], s: 'Unlocked by payment. Scanned at your door.' },
    { a: 52.0, b: 56.9, eb: '07 · TRACKING', h: ['TRACK', 'EVERY STEP.'], s: 'From collected to delivered, live in the app.' },
  ];

  /* ── real app screens, in order (time the screen is fully shown, file, crossfade length) ── */
  const BEATS = [
    [5.0, 's01-login'], [6.55, 's02-phone'], [8.0, 's03-otp'], [9.05, 's04-otp-filled', 0.2],
    [11.3, 'h01-home', 0.45],
    [17.0, 'w01-wallet'], [18.7, 'w02-topup-sheet'], [19.8, 'w03-topup-2000', 0.2],
    [21.2, 'w04-topup-progress-0', 0.15], [21.45, 'w04-topup-progress-1', 0.12], [21.7, 'w04-topup-progress-2', 0.12], [22.0, 'w05-topup-done', 0.2],
    [23.2, 'b01-book'], [24.6, 'b02-picker'], [25.9, 'b03-picker-filled', 0.25], [27.2, 'b04-items-done'],
    [28.3, 'b05-pickup'], [29.2, 'b06-address', 0.25], [30.2, 'b07-days', 0.35], [31.1, 'b08-day-picked', 0.18],
    [32.2, 'b09-slots', 0.35], [33.2, 'b10-slot-picked', 0.18], [34.7, 'b11-review'], [36.8, 'o05-order'],
    [37.9, 'p01-pay-sheet'], [39.7, 'p02-coupon-1', 0.2], [40.3, 'p03-coupon-applied', 0.25],
    [43.3, 'p05-paying-2', 0.2], [44.2, 'p05-paying-3', 0.25],
    [46.0, 'q01-qr-unlocked', 0.45],
    [50.4, 'r01-orders-list'], [52.0, 'r-picked-progress', 0.4], [53.6, 'r-washing-progress', 0.35], [55.2, 'r-ready-progress', 0.35],
  ];
  const XF = 0.3;

  /* ── taps (time, x, y in app CSS px) — from the capture log ── */
  const TAPS = [
    [5.95, 195, 593], [7.7, 195, 687], [8.5, 120, 470],
    [16.6, 141, 803], [18.4, 182, 738], [19.5, 326, 566], [20.9, 195, 796],
    [22.85, 195, 803], [24.3, 195, 565], [25.2, 319, 401], [25.5, 345, 401], [25.75, 345, 506], [26.9, 326, 808],
    [28.0, 292, 735], [30.8, 117, 312], [32.9, 104, 422], [34.4, 292, 700], [36.5, 292, 700],
    [37.6, 284, 546], [39.4, 174, 339], [43.0, 207, 759],
    [50.0, 249, 803], [51.5, 195, 156],
  ];

  /* ── camera: (time, scale, focus x, focus y) in app CSS px; eased between keys ── */
  const BASE = [1, 195, 422];
  const CAM = [
    [0, ...BASE], [11.0, ...BASE],
    [12.0, 1.0, 195, 422], [13.4, 1.42, 195, 215], [15.6, 1.42, 195, 260], [16.4, ...BASE],
    [17.2, ...BASE], [18.0, 1.28, 195, 200], [18.5, ...BASE],
    [19.8, ...BASE], [20.4, 1.3, 195, 640], [20.95, 1.3, 195, 640], [21.6, 1.32, 195, 220], [22.6, 1.25, 195, 300], [23.2, ...BASE],
    [24.4, ...BASE], [25.0, 1.18, 230, 450], [26.8, 1.18, 230, 450], [27.4, ...BASE],
    [29.9, ...BASE], [30.6, 1.5, 195, 315], [31.9, 1.5, 195, 315], [32.5, 1.45, 195, 420], [33.9, 1.45, 195, 420], [34.6, ...BASE],
    [35.0, ...BASE], [35.6, 1.22, 195, 560], [36.4, 1.22, 195, 560], [36.9, ...BASE],
    [38.0, ...BASE], [38.6, 1.35, 195, 300], [39.9, 1.35, 195, 300], [40.6, 1.45, 195, 640], [42.7, 1.45, 195, 660], [43.0, ...BASE],
    [45.4, ...BASE], [46.6, 1.62, 195, 381], [49.9, 1.62, 195, 381], [50.4, ...BASE],
    [52.2, ...BASE], [52.9, 1.32, 195, 170], [56.4, 1.32, 195, 170], [60, 1.32, 195, 170],
  ];

  /* ── DOM ── */
  const $ = (id) => document.getElementById(id);
  const imgs = {};
  const holder = $('screens');
  for (const [, n] of BEATS) {
    if (imgs[n]) continue;
    const im = new Image();
    im.src = `assets/screens/${n}.jpg`;
    holder.appendChild(im);
    imgs[n] = im;
  }
  window.ready = Promise.all([...Object.values(imgs), ...document.querySelectorAll('img')].map((i) => i.decode().catch(() => {}))).then(() => document.fonts.ready);

  // wordmark artwork (outlined, never typed)
  const WM = window.WORDMARK;
  const wmSvg = (h) => `<svg width="${(WM.w * h).toFixed(1)}" height="${(h * 1.3).toFixed(1)}" viewBox="0 -1.02 ${WM.w} 1.3"><path d="${WM.d}" fill="#fff"/></svg>`;
  $('introWm').innerHTML = wmSvg(96);
  $('outWm').innerHTML = wmSvg(104);

  // background fabric lines
  const lines = $('lines');
  const LINES = [
    { y: 300, a: 70, f: 0.0042, sp: 0.35, w: 2, c: 'rgba(255,255,255,.07)' },
    { y: 520, a: 90, f: 0.0035, sp: -0.25, w: 2, c: 'rgba(255,255,255,.06)' },
    { y: 1450, a: 110, f: 0.003, sp: 0.2, w: 3, c: 'rgba(84,182,248,.16)' },
    { y: 1600, a: 80, f: 0.0045, sp: -0.3, w: 2, c: 'rgba(255,255,255,.06)' },
    { y: 1760, a: 60, f: 0.005, sp: 0.4, w: 3, c: 'rgba(254,135,1,.22)' },
  ];
  lines.innerHTML = LINES.map(() => '<path/>').join('');
  const linePaths = [...lines.querySelectorAll('path')];

  let lastHead = -1;
  function setHead(i) {
    if (i === lastHead) return;
    lastHead = i;
    const sc = SCENES[i];
    $('headText').innerHTML = sc ? sc.h.map((l) => `<span class="line"><span>${l}</span></span>`).join('') : '';
    $('subText').innerHTML = sc ? sc.s : '';
    $('eyebrow').textContent = sc ? sc.eb : '';
  }

  function camAt(t) {
    let i = 0;
    while (i < CAM.length - 2 && CAM[i + 1][0] <= t) i++;
    const [t0, s0, x0, y0] = CAM[i];
    const [t1, s1, x1, y1] = CAM[i + 1];
    const p = eio(prog(t, t0, t1));
    return [lerp(s0, s1, p), lerp(x0, x1, p), lerp(y0, y1, p)];
  }

  window.render = function (t) {
    /* background drift */
    $('bg').style.transform = `scale(${1.04 + 0.02 * Math.sin(t / 9)}) translateY(${Math.sin(t / 7) * 10}px)`;
    $('glow').style.opacity = 0.7 + 0.3 * Math.sin(t / 3.2);
    const draw = clamp(t / 2.2);
    LINES.forEach((L, k) => {
      let d = '';
      for (let x = -40; x <= 1120; x += 20) {
        const y = L.y + Math.sin(x * L.f + t * L.sp + k) * L.a + Math.sin(x * L.f * 2.3 - t * L.sp * 0.7) * L.a * 0.25;
        d += (x === -40 ? 'M' : 'L') + x + ' ' + y.toFixed(1);
      }
      const el = linePaths[k];
      el.setAttribute('d', d);
      el.setAttribute('stroke', L.c);
      el.setAttribute('stroke-width', L.w);
      el.setAttribute('stroke-dasharray', '1400');
      el.setAttribute('stroke-dashoffset', String(1400 * (1 - eout(clamp(draw * 1.2 - k * 0.08)))));
    });

    /* intro 0–5 s */
    const intro = $('intro');
    if (t < 5.6) {
      intro.style.display = 'block';
      const out = eio(prog(t, 4.3, 5.1));
      intro.style.opacity = 1 - out;
      intro.style.transform = `translateY(${-160 * out}px)`;
      const tp = spring(prog(t, 0.6, 1.9));
      const tile = $('introTile');
      tile.style.left = '390px'; tile.style.top = '640px';
      tile.style.transform = `scale(${lerp(0.6, 1, tp)}) rotate(${lerp(-8, 0, tp)}deg)`;
      tile.style.opacity = clamp(prog(t, 0.6, 1.0));
      tile.querySelector('.sweep').style.left = `${lerp(-60, 130, eio(prog(t, 2.0, 3.0)))}%`;
      const wm = $('introWm');
      const wmw = WM.w * 96;
      wm.style.left = `${540 - wmw / 2}px`; wm.style.top = '1010px';
      wm.style.width = `${wmw * eout5(prog(t, 1.5, 2.6))}px`;
      wm.style.height = '125px';
      const hl = [...intro.querySelectorAll('#introHead .line span')];
      hl.forEach((s, k) => { s.style.transform = `translateY(${110 * (1 - eout5(prog(t, 2.4 + k * 0.12, 3.2 + k * 0.12)))}%)`; });
    } else intro.style.display = 'none';

    /* phone */
    const phone = $('phone');
    const enter = eout5(prog(t, 4.5, 5.6));
    const exit = eio(prog(t, 56.5, 57.4));
    if (t >= 4.5 && t < 57.5) {
      phone.style.display = 'block';
      const [s, fx, fy] = camAt(t);
      const px = BEZ + fx * K, py = BEZ + fy * K;
      const tx = A.x - s * px;
      const ty = A.y - s * py + (1 - enter) * 1100 + exit * 900;
      const rot = (1 - enter) * 9 - exit * 6;
      phone.style.transform = `translate(${tx}px, ${ty}px) scale(${s}) rotate(${rot}deg)`;
      phone.style.opacity = 1 - exit;
    } else phone.style.display = 'none';

    /* screens: crossfade between beats */
    let cur = 0;
    while (cur < BEATS.length - 1 && BEATS[cur + 1][0] - (BEATS[cur + 1][2] || XF) <= t) cur++;
    const nxt = BEATS[cur + 1];
    for (const n in imgs) imgs[n].style.opacity = 0;
    const curImg = imgs[BEATS[cur][1]];
    curImg.style.opacity = 1; curImg.style.zIndex = 1; curImg.style.transform = 'none';
    if (nxt) {
      const xf = nxt[2] || XF;
      const p = prog(t, nxt[0] - xf, nxt[0]);
      if (p > 0) { const ni = imgs[nxt[1]]; ni.style.opacity = eio(p); ni.style.zIndex = 2; ni.style.transform = `scale(${lerp(1.015, 1, eout(p))})`; }
    }

    /* tap ripple */
    const tap = $('tap');
    let tv = 0;
    for (const [tt, x, y] of TAPS) {
      const p = prog(t, tt - 0.12, tt + 0.45);
      if (p > 0 && p < 1) {
        tv = 1;
        tap.style.left = `${x * K}px`; tap.style.top = `${y * K}px`;
        const grow = eout(prog(t, tt - 0.12, tt + 0.45));
        tap.style.transform = `scale(${lerp(0.45, 1.25, grow)})`;
        tap.style.opacity = t < tt ? prog(t, tt - 0.12, tt) : 1 - prog(t, tt, tt + 0.45);
      }
    }
    if (!tv) tap.style.opacity = 0;

    /* QR unlock glow + scanner */
    const QR = { x: 195 * K, y: 381 * K, size: 250 * K };
    const un = $('unlock');
    const ug = prog(t, 45.6, 46.6);
    un.style.left = `${QR.x - QR.size * 0.75}px`; un.style.top = `${QR.y - QR.size * 0.75}px`;
    un.style.width = un.style.height = `${QR.size * 1.5}px`;
    un.style.opacity = ug > 0 && ug < 1 ? Math.sin(ug * Math.PI) * 0.9 : 0;
    un.style.transform = `scale(${lerp(0.6, 1.3, ug)})`;
    const sc = $('scan');
    const so = prog(t, 47.0, 47.5) * (1 - prog(t, 49.7, 50.1));
    sc.style.opacity = so;
    const fr = QR.size * lerp(1.15, 1, eout(prog(t, 47.0, 47.6)));
    sc.style.left = `${QR.x - fr / 2}px`; sc.style.top = `${QR.y - fr / 2}px`;
    sc.style.width = sc.style.height = `${fr}px`;
    const sweep = prog(t, 47.5, 49.6);
    const bar = sc.querySelector('.bar');
    bar.style.top = `${(0.08 + 0.84 * (0.5 - 0.5 * Math.cos(sweep * Math.PI * 2))) * fr}px`;
    $('sheen').style.transform = `translateX(${lerp(-120, 120, ((t * 0.07) % 1))}%)`;

    /* headlines */
    let si = SCENES.findIndex((s) => t >= s.a && t < s.b);
    setHead(si);
    if (si >= 0) {
      const sc2 = SCENES[si];
      const spans = [...document.querySelectorAll('#headText .line span')];
      spans.forEach((sp, k) => {
        const pin = eout5(prog(t, sc2.a + 0.15 + k * 0.09, sc2.a + 0.85 + k * 0.09));
        const pout = ein(prog(t, sc2.b - 0.5 + k * 0.05, sc2.b - 0.12 + k * 0.05));
        sp.style.transform = `translateY(${(1 - pin) * 110 - pout * 110}%)`;
      });
      $('subText').style.opacity = eout(prog(t, sc2.a + 0.55, sc2.a + 1.1)) * (1 - prog(t, sc2.b - 0.45, sc2.b - 0.15));
      $('subText').style.transform = `translateY(${(1 - eout(prog(t, sc2.a + 0.55, sc2.a + 1.1))) * 18}px)`;
      $('eyebrow').style.opacity = 0.9 * eout(prog(t, sc2.a + 0.05, sc2.a + 0.6)) * (1 - prog(t, sc2.b - 0.45, sc2.b - 0.15));
    }

    /* outro 57–60 s */
    const outro = $('outro');
    if (t >= 57.0) {
      outro.style.display = 'block';
      const tp = spring(prog(t, 57.2, 58.4));
      const tile = $('outTile');
      tile.style.left = '390px'; tile.style.top = '560px';
      tile.style.transform = `scale(${lerp(0.7, 1, tp)})`;
      tile.style.opacity = clamp(prog(t, 57.2, 57.6));
      tile.querySelector('.sweep').style.left = `${lerp(-60, 130, eio(prog(t, 58.3, 59.2)))}%`;
      const wm = $('outWm');
      const wmw = WM.w * 104;
      wm.style.left = `${540 - wmw / 2}px`; wm.style.top = '930px';
      wm.style.width = `${wmw * eout5(prog(t, 57.7, 58.6))}px`; wm.style.height = '136px';
      const tg = $('outTag');
      tg.style.opacity = eout(prog(t, 58.2, 58.8));
      tg.style.letterSpacing = `${lerp(0.3, 0.14, eout(prog(t, 58.2, 59.2)))}em`;
      const cta = $('outCta');
      cta.style.opacity = eout(prog(t, 58.6, 59.1));
      cta.style.transform = `translateY(${(1 - eout5(prog(t, 58.6, 59.2))) * 30}px)`;
    } else outro.style.display = 'none';

    /* fade from / to black */
    $('fade').style.opacity = Math.max(1 - prog(t, 0, 0.6), prog(t, 59.55, 60));
  };
  window.DUR = DUR;
})();
