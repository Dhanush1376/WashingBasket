// Keeps one Chrome alive so capture steps can be run one by one (connect with ws from .ws).
const puppeteer = require('puppeteer-core');
const fs = require('fs');
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--hide-scrollbars'] });
  fs.writeFileSync(__dirname + '/.ws', b.wsEndpoint());
  console.log('ready', b.wsEndpoint());
})();
