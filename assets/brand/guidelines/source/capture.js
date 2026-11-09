const puppeteer = require('puppeteer-core');
const OUT = process.argv[2];
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args:['--hide-scrollbars'] });
  const p = await b.newPage();
  // website
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
  await p.goto('http://localhost:5191', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000); await p.mouse.click(700,450); await sleep(2500);
  await p.screenshot({ path: OUT + '/web-hero.png' });
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  console.log('web height', H);
  for (let i = 1; i <= 14; i++) {
    await p.evaluate(y => window.scrollTo(0, y), Math.round(H * i / 15)); await sleep(1800);
    await p.screenshot({ path: OUT + `/web-${String(i).padStart(2,'0')}.png` });
  }
  // admin
  const a = await b.newPage();
  await a.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
  await a.goto('http://localhost:5181/login', { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(3500);
  await a.screenshot({ path: OUT + '/admin-login.png' });
  await a.click('.login__demo'); await sleep(4000);
  for (const r of ['', 'orders', 'pickups', 'customers', 'services', 'offers', 'wallet', 'schedule', 'laundry/locations', 'support']) {
    await a.goto('http://localhost:5181/' + r, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(2500);
    await a.screenshot({ path: OUT + '/admin-' + (r.replace('/', '-') || 'overview') + '.png' });
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
