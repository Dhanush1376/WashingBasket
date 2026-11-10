// Renders compose/index.html frame by frame (deterministic render(t)) and encodes the MP4.
//   node render.js stills 2 9 20 ...   → work/still-<t>.jpg
//   node render.js                      → dist/washing-basket-brand-film-video.mp4 (no audio), then mux.py adds sound
const puppeteer = require('puppeteer-core');
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const FPS = 30, DUR = 60, W = 1080, H = 1920;
const FFMPEG = execFileSync('python', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
const url = 'file:///' + path.join(__dirname, 'compose', 'index.html').replace(/\\/g, '/');

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--allow-file-access-from-files', '--hide-scrollbars'] });
  const p = await b.newPage();
  await p.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await p.goto(url, { waitUntil: 'load' });
  await p.evaluate(() => window.ready);
  fs.mkdirSync(path.join(__dirname, 'work'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'work', 'cues.json'), JSON.stringify(await p.evaluate(() => window.CUES)));
  fs.mkdirSync(path.join(__dirname, 'work'), { recursive: true });
  fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });

  if (process.argv[2] === 'stills') {
    for (const t of process.argv.slice(3).map(Number)) {
      await p.evaluate((t) => window.render(t), t);
      await p.screenshot({ path: path.join(__dirname, 'work', `still-${t}.jpg`), type: 'jpeg', quality: 85 });
      console.log('still', t);
    }
    await b.close();
    return;
  }

  const out = path.join(__dirname, 'dist', 'video-only.mp4');
  const ff = spawn(FFMPEG, ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(FPS), '-movflags', '+faststart', out], { stdio: ['pipe', 'ignore', 'inherit'] });
  const N = FPS * DUR;
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    await p.evaluate((t) => window.render(t), i / FPS);
    const buf = await p.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`frame ${i}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await b.close();
  console.log('done', out);
})();
