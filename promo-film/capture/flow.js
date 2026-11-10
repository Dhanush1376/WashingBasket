// Walks the real app (Expo web on localhost:8081) as a brand-new customer and saves a screenshot at each
// step into ../shots. One process from start to finish, so the app's in-memory state is kept.
// Usage: node capture/flow.js [stopAfterPhase]
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const STOP = process.argv[2] || 'end';
const SHOTS = path.join(__dirname, '..', 'shots');
const LOG = path.join(__dirname, '..', 'shots', 'log.txt');
fs.mkdirSync(SHOTS, { recursive: true });
fs.writeFileSync(LOG, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => { const s = a.join(' '); console.log(s); fs.appendFileSync(LOG, s + '\n'); };

let p;
const shot = async (name) => { await p.screenshot({ path: path.join(SHOTS, name + '.png') }); log('shot', name); };
const text = () => p.evaluate(() => document.body.innerText);
const dump = async (label) => log(`\n===== ${label}\n` + (await text()));

// Click the smallest visible element whose text matches (RN-web renders Pressables as divs).
async function tap(label, { exact = true, nth = 0, within } = {}) {
  const box = await p.evaluate((label, exact, nth, within) => {
    const root = within ? [...document.querySelectorAll('div')].find((d) => (d.innerText || '').trim().startsWith(within)) || document : document;
    const els = [...root.querySelectorAll('div,span,button,a')].filter((e) => {
      const t = (e.innerText || '').trim();
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && (exact ? t === label : t.includes(label));
    });
    els.sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height);
    const e = els[nth];
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label, exact, nth, within);
  if (!box) return tapAria(label);
  await p.mouse.click(box.x, box.y);
  log('tap', label, Math.round(box.x), Math.round(box.y));
  return box;
}
// Click the last-rendered visible element with this exact aria-label (tab bar, icon buttons).
async function tapAria(label, { contains = false } = {}) {
  const box = await p.evaluate((label, contains) => {
    const els = [...document.querySelectorAll('[aria-label]')].filter((e) => {
      const a = e.getAttribute('aria-label');
      const r = e.getBoundingClientRect();
      return (contains ? a.includes(label) : a === label) && r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
    });
    const e = els[els.length - 1];
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label, contains);
  if (!box) throw new Error('no aria: ' + label);
  await p.mouse.click(box.x, box.y);
  log('tapAria', label, Math.round(box.x), Math.round(box.y));
  return box;
}
async function reveal(label) {
  await p.evaluate((label) => { const els = [...document.querySelectorAll('[aria-label]')].filter((e) => e.getAttribute('aria-label') === label && e.getBoundingClientRect().width > 0); const e = els[els.length - 1]; if (e) e.scrollIntoView({ block: 'center', behavior: 'instant' }); }, label);
  await sleep(500);
}
const arias = () => p.evaluate(() => [...document.querySelectorAll('[aria-label]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight; }).map((e) => e.getAttribute('aria-label')));
async function typeInto(selector, value, delay = 70) {
  await p.waitForSelector(selector, { timeout: 15000 });
  await p.focus(selector);
  await p.keyboard.type(value, { delay });
}
const done = async (phase) => { if (STOP === phase) { await dump('STOP ' + phase); throw new Error('__stop__'); } };

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'] });
  p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  // Serve the dev bundle with the fresh-account fixture applied (see fresh-account.js).
  await p.setRequestInterception(true);
  p.on('request', async (req) => {
    if (!req.url().includes('/index.ts.bundle')) return req.continue();
    const r = await fetch(req.url());
    const body = require('./fresh-account')(await r.text());
    log('fixture applied to bundle');
    req.respond({ status: 200, contentType: 'application/javascript', body });
  });
  try {
    await p.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 120000 });
    await p.waitForSelector('input[type=tel]', { timeout: 60000 });
    await sleep(8000); // splash + sheet entrance

    /* ── Sign-up: phone + OTP ── */
    await shot('s01-login');
    await typeInto('input[type=tel]', '9812345670');
    await sleep(500);
    await shot('s02-phone');
    await tap('Continue');
    await sleep(2500);
    await shot('s03-otp');
    await typeInto('input[aria-label="6-digit code"]', '123456', 140);
    await sleep(500);
    await shot('s04-otp-filled');
    try { await tap('Verify'); } catch {}
    await sleep(900);
    await shot('s05-verified');
    await sleep(2500);
    await dump('after verify');
    await shot('s06-next');
    await done('signup');

    /* ── Details + PIN code (the real sign-up asks for these after the OTP) ── */
    await typeInto('input[placeholder="Full name"]', 'Aarav Mehta', 40);
    await typeInto('input[placeholder="Email address"]', 'aarav@example.com', 25);
    await sleep(400);
    await shot('s07-details');
    await tap('Continue');
    await sleep(2000);
    await dump('after details');
    await shot('s08-pincode');
    await typeInto('input[placeholder="6-digit PIN code"]', '144003', 80);
    await sleep(500);
    try { await tap('Check availability'); } catch {}
    await sleep(1800);
    await shot('s09-pincode-ok');
    await dump('after pincode');
    try { await tap('Continue'); } catch {}
    await sleep(3500);
    await shot('s10-after-signup');
    await dump('after signup');
    await done('details');

    /* ── Fresh dashboard ── */
    await sleep(2500);
    await shot('h01-home');
    log(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('[role=tab],[role=button],a')].map((e) => [e.getAttribute('aria-label'), (e.innerText || '').slice(0, 20), Math.round(e.getBoundingClientRect().x), Math.round(e.getBoundingClientRect().y)]).filter((x) => x[0]))));
    await done('home');

    /* ── Wallet: ₹0 → demo top-up ── */
    await tapAria('Wallet');
    await sleep(2500);
    await shot('w01-wallet');
    await done('wallet');
    await tap('Top Up');
    await sleep(1500);
    await shot('w02-topup-sheet');
    log('ARIAS', JSON.stringify(await arias()));
    await tapAria('₹2,000');
    await sleep(900);
    await shot('w03-topup-2000');
    log('ARIAS', JSON.stringify((await arias()).slice(-6)));
    await tapAria('Top Up ₹2,000', { contains: true });
    for (let i = 0; i < 6; i++) { await sleep(450); await shot('w04-topup-progress-' + i); }
    await sleep(2500);
    await shot('w05-topup-done');
    await sleep(2500);
    await shot('w06-wallet-after');
    await done('topup');

    /* ── Booking ── */
    await tapAria('New order');
    await sleep(2500);
    await shot('b01-book');
    log('ARIAS', JSON.stringify((await arias()).filter((a) => !/^(Home|Wallet|Orders|Profile|Washing Basket.*|Notifications|Open menu|Close menu|My Orders|Offers|Refer & Earn|Price List|Support|Log out|Close)$/.test(a))));
    await done('book1');
    await tapAria('Normal wash, ₹55 per kg. Choose clothes'); // Wash & Iron · Normal wash
    await sleep(1500);
    await shot('b02-picker');
    await done('book2');
    for (const [g, n] of [['Shirt', 4], ['T-shirt', 3], ['Jeans', 2]]) for (let i = 0; i < n; i++) { if (g === 'Jeans' && i === 0) { await tapAria('Bottomwear'); await sleep(700); } await tapAria(i === 0 ? `Add ${g}` : `Add one ${g}`); await sleep(350); }
    await sleep(600);
    await shot('b03-picker-filled');
    await done('book3');
    await tapAria('Done, 9 clothes added');
    await sleep(1200);
    await shot('b04-items-done');
    await tap('Continue');
    await sleep(1500);
    await shot('b05-pickup');
    await done('book4');
    await p.focus('textarea[aria-label="Pickup address"], input[aria-label="Pickup address"]');
    await p.keyboard.type('Flat 4B, Green Avenue, Model Town', { delay: 35 });
    await sleep(500);
    await shot('b06-address');
    await reveal('Wednesday, 11 November');
    await shot('b07-days');
    await tapAria('Wednesday, 11 November');
    await sleep(700);
    await shot('b08-day-picked');
    await reveal('Morning, 8:00 – 10:00 AM');
    await shot('b09-slots');
    await tapAria('Morning, 8:00 – 10:00 AM');
    await sleep(700);
    await shot('b10-slot-picked');
    await tap('Continue');
    await sleep(1800);
    await shot('b11-review');
    await done('book5');
    await tap('Continue');
    for (let i = 0; i < 4; i++) { await sleep(700); await shot('o0' + i + '-after-submit'); }
    await sleep(2000);
    await shot('o05-order');
    await done('order1');
    await tapAria('to unlock QR code', { contains: true });
    await sleep(1600);
    await shot('p01-pay-sheet');
    await done('pay1');
    await tapAria('FIRSTWASH, Flat 20% off. Tap to apply');
    for (let i = 0; i < 3; i++) { await sleep(400); await shot('p02-coupon-' + i); }
    await sleep(1000);
    await shot('p03-coupon-applied');
    await p.evaluate(() => { const s = [...document.querySelectorAll('div')].filter((d) => d.scrollHeight > d.clientHeight + 40 && getComputedStyle(d).overflowY !== 'visible' && (d.innerText || '').includes('Coupons & Offers')); const e = s[s.length - 1]; if (e) e.scrollTop = e.scrollHeight; });
    await sleep(800);
    await shot('p04-wallet-method');
    log('ARIAS', JSON.stringify((await arias()).slice(-12)));
    await tapAria('& Unlock QR', { contains: true }).catch(() => tap('& Unlock QR', { exact: false }));
    for (let i = 0; i < 8; i++) { await sleep(400); await shot('p05-paying-' + i); }
    await sleep(2500);
    await shot('p06-paid');
    await done('pay2');
    await tapAria('Close slip');
    await sleep(1500);
    await shot('q01-qr-unlocked');
    const code = (await arias()).find((a) => /^Code [A-Z0-9]{5}-[A-Z0-9]{5}/.test(a)).slice(5, 16);
    log('QRCODE', code);
    await reveal('Pickup & Collection, current step');
    await shot('q02-progress');
    await done('qr');

    /* ── Staff partner scans the pickup QR (the app's own staff mode, demo pickup partner for Model Town) ── */
    const c = p; // customer page
    p = await c.browser().newPage();
    await p.setRequestInterception(true);
    p.on('request', async (req) => {
      if (!req.url().includes('/index.ts.bundle')) return req.continue();
      const r = await fetch(req.url());
      req.respond({ status: 200, contentType: 'application/javascript', body: require('./fresh-account')(await r.text()) });
    });
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await p.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 120000 });
    await sleep(9000);
    await shot('h02-home-active');
    await done('staff1');
    await tapAria('Open menu');
    await sleep(900);
    await tap('Log out');
    await sleep(1500);
    try { await tap('Log out', { nth: 0 }); } catch {}
    await sleep(4000);
    await dump('after logout');
    await typeInto('input[type=tel]', '9876543210');
    await sleep(1500);
    await shot('t00-staff-phone');
    await tap('Continue');
    await sleep(2500);
    await typeInto('input[aria-label="6-digit code"]', '123456', 100);
    await sleep(4000);
    await typeInto('input[placeholder="6-digit PIN code"]', '144003', 60).catch(async () => { await dump('no pin field'); throw new Error('pin'); });
    await sleep(300);
    await tap('Check availability').catch(() => tap('Continue'));
    await sleep(5000);
    await shot('t01-staff-home');
    await done('staff2');
    await tapAria('Type code');
    await sleep(1500);
    await tapAria('Type code');
    await sleep(1500);
    await shot('t02-type-sheet');
    log('INPUTS', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('input,textarea')].map((i) => [i.getAttribute('aria-label'), i.placeholder]))));
    log('ARIAS', JSON.stringify((await arias()).slice(-15)));
    await typeInto('input[aria-label="QR code or order number"]', code, 60);
    await sleep(500);
    await shot('t02-code-typed');
    await tapAria('Check code');
    await sleep(2500);
    await shot('t03-scan-result');
    log('ARIAS', JSON.stringify((await arias()).slice(-20)));
    await tapAria('Confirm count', { contains: true }).catch(() => log('no confirm count'));
    await sleep(800);
    await tapAria('Accept & collect');
    await sleep(2500);
    await shot('t04-accepted');
    log('ARIAS', JSON.stringify((await arias()).slice(-20)));
    await done('staff3');

    /* @@REST@@ */
  } catch (e) {
    if (e.message !== '__stop__') { log('ERROR', e.stack); await shot('zz-error'); await dump('error'); }
  }
  await b.close();
})();
