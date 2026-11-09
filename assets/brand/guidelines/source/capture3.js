const puppeteer = require('puppeteer-core');
const OUT = process.argv[2];
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args:['--hide-scrollbars'] });
  const a = await b.newPage();
  await a.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await a.goto('http://localhost:8082', { waitUntil: 'domcontentloaded', timeout: 180000 });
  const t0 = Date.now();
  for (let i = 0; i < 10; i++) { await sleep(i < 4 ? 700 : 2500); await a.screenshot({ path: OUT + `/mob-${i}.png` }); }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
