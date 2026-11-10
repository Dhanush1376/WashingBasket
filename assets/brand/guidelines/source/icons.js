// Mobile app icons from the brand's own logo vector (website/src/logoGeometry.ts via lib.logo) — replaces the Expo template icons.
// node icons.js <mobile/assets dir>
const puppeteer = require('puppeteer-core');
const path = require('path');
const { logo } = require('./lib');
const OUT = process.argv[2];
const mono = (col, knock) => ({ orange: col, red: col, navy: col, knock });

// [file, canvas px, background, mark width as share of canvas, colours, nudge down (share)]
const JOBS = [
  ['icon.png', 1024, '#FFFFFF', 0.70, {}, 0.02],                      // iOS / store icon: white tile, mark ~70%
  ['android-icon-foreground.png', 512, 'transparent', 0.44, {}, 0.012], // inside the 66 dp safe zone of 108 dp
  ['android-icon-background.png', 512, '#FFFFFF', 0, {}, 0],
  ['android-icon-monochrome.png', 432, '#000000', 0.44, mono('#FFFFFF', '#000000'), 0.012], // white-on-black → alpha below
  ['splash-icon.png', 1024, 'transparent', 0.86, {}, 0],
  ['favicon.png', 48, 'transparent', 0.92, {}, 0],
];

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
  const p = await b.newPage();
  for (const [f, S, bg, share, c, nudge] of JOBS) {
    await p.setViewport({ width: S, height: S, deviceScaleFactor: 1 });
    const mark = share ? logo({ w: S * share, c }) : '';
    await p.setContent(`<html><body style="margin:0;width:${S}px;height:${S}px;background:${bg};display:flex;align-items:center;justify-content:center"><div style="transform:translateY(${(S * nudge).toFixed(1)}px);line-height:0">${mark}</div></body></html>`);
    await p.screenshot({ path: path.join(OUT, f), omitBackground: bg === 'transparent', clip: { x: 0, y: 0, width: S, height: S } });
    console.log(f, S);
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
