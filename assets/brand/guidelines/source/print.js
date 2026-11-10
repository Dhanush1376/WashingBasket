// node print.js [--pdf] [--figs] [--previews]  — overflow check always runs
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const args = process.argv.slice(2);
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT + '/figs', { recursive: true });
fs.mkdirSync(OUT + '/prev', { recursive: true });

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1240, height: 900, deviceScaleFactor: 1 });
  await p.emulateMediaType('print');
  await p.goto('file:///' + path.join(__dirname, 'book.html').replace(/\\/g, '/'), { waitUntil: 'load', timeout: 120000 });
  await p.evaluate(() => document.fonts.ready);
  const fontsOk = await p.evaluate(() => ['700 12px Inter', '400 12px Inter', '700 12px "Courier Prime"'].map((f) => document.fonts.check(f)));
  console.log('fonts', fontsOk);

  const issues = await p.evaluate(() => {
    const mm = 96 / 25.4;
    const out = [];
    document.querySelectorAll('.page').forEach((pg, i) => {
      const r = pg.getBoundingClientRect();
      const limit = r.bottom - 11 * mm;
      let worst = 0, who = '';
      pg.querySelectorAll('*').forEach((el) => {
        if (el.closest('.foot') || el.closest('.fig__in') || el.closest('.cover') || el.closest('.div') || el.closest('.div__r') || el.closest('.back')) return;
        const e = el.getBoundingClientRect();
        if (e.height === 0) return;
        if (e.bottom - limit > worst) { worst = e.bottom - limit; who = el.className || el.tagName; }
        if (e.right > r.right - 10 * mm + 2 && !el.closest('.div')) { out.push(`p${i + 1} right-overflow ${el.className || el.tagName} by ${(e.right - r.right + 10 * mm).toFixed(0)}px`); }
      });
      if (worst > 1) out.push(`p${i + 1} bottom-overflow ${(worst / mm).toFixed(1)}mm (${String(who).slice(0, 40)})`);
      pg.querySelectorAll('.fig__in').forEach((f) => {
        const fr = f.getBoundingClientRect();
        f.querySelectorAll('*').forEach((el) => {
          const e = el.getBoundingClientRect();
          if (e.height && e.bottom > fr.bottom + 2 && getComputedStyle(el).position !== 'absolute' && !el.closest('.shot') && !el.closest('.mood__i') && !el.closest('.tile__in') && el.tagName !== 'path')
            out.push(`p${i + 1} fig ${f.parentElement.dataset.fig} clip ${String(el.className.baseVal ?? el.className).slice(0, 30)} by ${(e.bottom - fr.bottom).toFixed(0)}px`);
        });
      });
      pg.querySelectorAll('.ts__ex').forEach((el) => { if (el.scrollWidth > el.clientWidth + 1) out.push(`p${i + 1} type-scale example truncated: ${el.textContent.slice(0, 30)}`); });
    });
    return out;
  });
  const uniq = [...new Set(issues)];
  console.log(uniq.length ? uniq.slice(0, 60).join('\n') : 'no overflow');

  if (args.includes('--previews')) {
    const n = await p.evaluate(() => document.querySelectorAll('.page').length);
    await p.emulateMediaType('print');
    for (let i = 0; i < n; i++) {
      const el = (await p.$$('.page'))[i];
      await el.screenshot({ path: `${OUT}/prev/p${String(i + 1).padStart(2, '0')}.png` });
    }
  }
  if (args.includes('--figs')) {
    await p.setViewport({ width: 1240, height: 900, deviceScaleFactor: 2.5 });
    await p.evaluate(() => document.fonts.ready);
    const figs = await p.$$('[data-fig]');
    for (const f of figs) {
      const id = await f.evaluate((e) => e.dataset.fig);
      await f.screenshot({ path: `${OUT}/figs/${id}.png`, omitBackground: false });
    }
    // full-page renders for cover, dividers, manifesto, back (used as images in the DOCX)
    const specials = await p.$$('.page.cover, .page.div, .page.mani, .page.back');
    for (const s of specials) {
      const idx = await s.evaluate((e) => [...document.querySelectorAll('.page')].indexOf(e) + 1);
      await s.screenshot({ path: `${OUT}/figs/page-${idx}.jpg`, type: 'jpeg', quality: 90 });
    }
    // header lockup for the Word edition (outlined wordmark, transparent)
    const lk = await p.$('.page.std .run .lockup');
    await lk.screenshot({ path: `${OUT}/figs/lockup.png`, omitBackground: true });
    console.log('figs', figs.length, 'specials', specials.length);
  }
  if (args.includes('--pdf')) {
    await p.pdf({ path: `${OUT}/book.pdf`, width: '297mm', height: '210mm', printBackground: true, preferCSSPageSize: true, tagged: true, outline: true });
    console.log('pdf written');
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
