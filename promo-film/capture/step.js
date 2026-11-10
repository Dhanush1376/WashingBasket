// node capture/step.js "<async js using p, shot, tap, text, sleep>"
const L = require('./lib');
(async () => {
  const { b, p } = await L.page();
  const fn = new Function('p', 'L', 'shot', 'tap', 'text', 'sleep', `return (async()=>{${process.argv[2]}})()`);
  try { const r = await fn(p, L, (n) => L.shot(p, n), (t, o) => L.tap(p, t, o), () => L.text(p), L.sleep); if (r !== undefined) console.log(typeof r === 'string' ? r : JSON.stringify(r, null, 1)); }
  catch (e) { console.error('ERR', e.message); }
  b.disconnect();
})();
