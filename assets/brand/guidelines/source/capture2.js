const puppeteer = require('puppeteer-core');
const OUT = process.argv[2];
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args:['--hide-scrollbars'] });
  const a = await b.newPage();
  await a.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
  await a.goto('http://localhost:5181/login', { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(1700);
  await a.screenshot({ path: OUT + '/admin-intro.png' });
  await sleep(3500); await a.mouse.click(720, 450); await sleep(1500);
  await a.screenshot({ path: OUT + '/admin-login.png' });
  await a.click('.login__demo'); await sleep(5000);
  console.log('url', a.url());
  for (const r of ['', 'orders', 'pickups', 'customers', 'services', 'offers', 'wallet', 'schedule', 'service-areas', 'laundry/locations', 'support']) {
    await a.evaluate(r => { history.pushState({}, '', '/' + r); dispatchEvent(new PopStateEvent('popstate')); }, r); await sleep(2500);
    await a.screenshot({ path: OUT + '/admin-' + (r.replace('/', '-') || 'overview') + '.png' });
  }
  await a.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
  await sleep(1500); await a.screenshot({ path: OUT + '/admin-mobile.png' });
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
