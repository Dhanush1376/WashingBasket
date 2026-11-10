// Exact Word edition, step 1: from book.html, record every visible text line (position, font, size, colour)
// and render each page's graphics with the HTML text hidden. Output: out/live/pages.json + out/live/bgNN.jpg
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, 'out', 'live');
fs.mkdirSync(OUT, { recursive: true });
const DPI = 220;

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1240, height: 900, deviceScaleFactor: DPI / 96 });
  await p.emulateMediaType('print');
  await p.goto('file:///' + path.join(__dirname, 'book.html').split(path.sep).join('/'), { waitUntil: 'load', timeout: 120000 });
  await p.evaluate(() => document.fonts.ready);
  await p.addStyleTag({ content: '@media screen{.page{margin:0 auto!important;box-shadow:none!important}}' });

  const data = await p.evaluate(() => {
    const ASC = (fam) => (/courier/i.test(fam) ? 0.78125 : 0.96875);
    const parseC = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return [0, 0, 0, 1]; const v = m[1].split(',').map((x) => parseFloat(x)); return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1]; };
    const isBlock = (cs) => !/^inline/.test(cs.display) || cs.display === 'inline-block' || cs.display === 'inline-flex';
    function bgOf(el) {
      for (let e = el; e; e = e.parentElement) { const c = parseC(getComputedStyle(e).backgroundColor); if (c[3] > 0.5) return c; }
      return [255, 255, 255, 1];
    }
    function clipOf(el, pageR) {
      let r = { l: pageR.left, t: pageR.top, r: pageR.right, b: pageR.bottom };
      for (let e = el; e && !e.classList.contains('page'); e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { const q = e.getBoundingClientRect(); r = { l: Math.max(r.l, q.left), t: Math.max(r.t, q.top), r: Math.min(r.r, q.right), b: Math.min(r.b, q.bottom) }; }
      }
      return r;
    }
    const pages = [...document.querySelectorAll('.page')];
    return pages.map((pg) => {
      const P = pg.getBoundingClientRect();
      const frags = [];
      const tw = document.createTreeWalker(pg, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      let n;
      while ((n = tw.nextNode())) {
        const el = n.parentElement;
        if (!el || el.closest('svg') || !n.textContent.trim()) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden') continue;
        let op = 1; for (let e = el; e && e !== pg.parentElement; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
        const col = parseC(cs.color); const a = col[3] * op;
        if (a < 0.05) continue;
        const bg = bgOf(el);
        const rgb = col.slice(0, 3).map((v, i) => Math.round(v * a + bg[i] * (1 - a)));
        const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
        const fs = parseFloat(cs.fontSize);
        let lh = cs.lineHeight === 'normal' ? fs * (/courier/i.test(fam) ? 1.123 : 1.21) : parseFloat(cs.lineHeight);
        const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing);
        let block = el; while (block !== pg && !isBlock(getComputedStyle(block))) block = block.parentElement;
        const st = { fam, w: parseInt(cs.fontWeight, 10), fs, ls, it: cs.fontStyle === 'italic', color: rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase(), up: cs.textTransform === 'uppercase', align: getComputedStyle(block).textAlign };
        const clip = clipOf(el, P);
        const t = n.textContent;
        let cur = null, prevWs = true;
        for (let k = 0; k < t.length; k++) {
          const ch = /\s/.test(t[k]) ? ' ' : t[k];
          if (ch === ' ' && prevWs) continue;
          range.setStart(n, k); range.setEnd(n, k + 1);
          const rs = range.getClientRects();
          if (!rs.length) continue;
          const q = rs[0];
          if (q.width === 0 && ch === ' ') continue;
          const cx = q.left + q.width / 2, cy = q.top + q.height / 2;
          if (cx < clip.l || cx > clip.r || cy < clip.t || cy > clip.b) { prevWs = ch === ' '; continue; }
          if (!cur || Math.abs(q.top - cur.top) > 1.5 || q.left < cur.right - 2) {
            if (cur) frags.push(cur);
            if (ch === ' ') { prevWs = true; cur = null; continue; }
            cur = { top: q.top, bot: q.bottom, left: q.left, right: q.right, text: '', st, lh, block, n: 0, lead: k > 0 && /\s/.test(t[k - 1]) };
          }
          cur.text += st.up ? ch.toUpperCase() : ch; cur.right = Math.max(cur.right, q.right); cur.n++;
          prevWs = ch === ' ';
        }
        if (cur) frags.push(cur);
      }
      // merge fragments into lines (same block, same baseline row, touching)
      const lines = [];
      for (const f of frags) {
        f.sp = /\s$/.test(f.text); f.text = f.text.replace(/\s+$/, ''); if (!f.text) continue;
        const base = f.top + ASC(f.st.fam) * f.st.fs;
        const L = lines[lines.length - 1];
        if (L && L.block === f.block && Math.abs(L.base - base) < 2.5 && f.left >= L.right - 2 && f.left - L.right < f.st.fs * 1.2) {
          const gap = f.left - L.right;
          const last = L.runs[L.runs.length - 1];
          if ((gap > f.st.fs * 0.15 || L.sp || f.lead) && !/ $/.test(last.text)) last.text += ' ';
          L.runs.push({ text: f.text, st: f.st }); L.right = f.right; L.sp = f.sp; L.lh = Math.max(L.lh, f.lh);
        } else lines.push({ sp: f.sp, block: f.block, base, left: f.left, right: f.right, lh: f.lh, runs: [{ text: f.text, st: f.st }], align: f.st.align });
      }
      // stack lines of one block with the same left edge and an even pitch into one text box
      const boxes = [];
      for (const l of lines) {
        const B = boxes[boxes.length - 1];
        const pitch = B && B.lines.length ? l.base - B.lines[B.lines.length - 1].base : 0;
        if (B && B.block === l.block && Math.abs(B.left - l.left) < 1.2 && (B.align === 'left' || B.align === 'start' || B.align === 'justify') && pitch > 0 && (B.pitch === 0 || Math.abs(pitch - B.pitch) < 0.8)) {
          B.lines.push(l); B.pitch = B.pitch || pitch; B.right = Math.max(B.right, l.right);
        } else boxes.push({ block: l.block, left: l.left, right: l.right, lines: [l], pitch: 0, align: l.align });
      }
      const mmpx = 96 / 25.4;
      return {
        bg: getComputedStyle(pg).backgroundColor,
        boxes: boxes.map((B) => ({
          x: B.left - P.left, base: B.lines[0].base - P.top, w: B.right - B.left, L: B.pitch || B.lines[0].lh,
          lines: B.lines.map((l) => ({ w: l.right - l.left, runs: l.runs.map((r) => ({ text: r.text, ...r.st, block: undefined })) })),
        })),
        W: P.width, H: P.height, mm: P.width / mmpx,
      };
    });
  });
  fs.writeFileSync(path.join(OUT, 'pages.json'), JSON.stringify(data));
  console.log('pages', data.length, 'boxes', data.reduce((a, d) => a + d.boxes.length, 0), 'lines', data.reduce((a, d) => a + d.boxes.reduce((s, b) => s + b.lines.length, 0), 0));

  // graphics-only backgrounds: hide HTML text (SVG artwork, including its own text, stays)
  await p.addStyleTag({ content: 'body *:not(svg):not(svg *){color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;text-decoration-color:transparent!important;caret-color:transparent!important}' });
  await new Promise((r) => setTimeout(r, 300));
  const els = await p.$$('.page');
  for (let i = 0; i < els.length; i++) await els[i].screenshot({ path: path.join(OUT, `bg${String(i + 1).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 90 });
  console.log('backgrounds', els.length);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
