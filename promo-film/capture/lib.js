const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function page() {
  const b = await puppeteer.connect({ browserWSEndpoint: fs.readFileSync(__dirname + '/.ws', 'utf8'), defaultViewport: null });
  let [p] = (await b.pages()).filter((x) => x.url().includes('localhost:8081'));
  if (!p) { p = await b.newPage(); }
  const v = p.viewport(); if (!v || v.width !== 390 || v.deviceScaleFactor !== 3) await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  return { b, p };
}
const SHOTS = path.join(__dirname, '..', 'shots');
async function shot(p, name) { await p.screenshot({ path: path.join(SHOTS, name + '.png') }); console.log('shot', name); }
// click the smallest visible element whose text exactly matches
async function tap(p, text, { exact = true, nth = 0 } = {}) {
  const ok = await p.evaluate((text, exact, nth) => {
    const els = [...document.querySelectorAll('div,span,button,a,[role=button]')].filter((e) => {
      const t = (e.innerText || '').trim();
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (exact ? t === text : t.includes(text));
    });
    els.sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height);
    const e = els[nth];
    if (!e) return false;
    let c = e; while (c && !(c.getAttribute('role') === 'button' || c.tagName === 'BUTTON' || c.tabIndex >= 0) && c.parentElement) c = c.parentElement;
    (c || e).click();
    return true;
  }, text, exact, nth);
  if (!ok) throw new Error('no element: ' + text);
}
const text = (p) => p.evaluate(() => document.body.innerText);
module.exports = { page, shot, tap, text, sleep };
