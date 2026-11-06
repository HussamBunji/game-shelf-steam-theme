// Measures how heavy the theme is in the Steam main window (Steam must run with -dev and be on screen).
//   node tools/perf.mjs [label]
// Prints: DOM elements, idle main-thread time (ms per second), and a 4 s auto-scroll of the library home
// (average FPS, slow frames > 33 ms, worst frame) plus layout / style recalculations during the scroll.
const label = process.argv[2] || '';
const list = await (await fetch('http://127.0.0.1:8080/json')).json();

async function open(t) {
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const send = (method, params = {}, ms = 15000) => new Promise((resolve, reject) => {
    const my = ++id;
    const timer = setTimeout(() => reject(new Error('timeout ' + method)), ms);
    const h = ev => { const m = JSON.parse(ev.data); if (m.id === my) { clearTimeout(timer); ws.removeEventListener('message', h); resolve(m.result); } };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: my, method, params }));
  });
  const evaluate = async (expression, ms) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, ms);
    return r && r.result ? r.result.value : undefined;
  };
  return { ws, send, evaluate };
}

// the live, visible main window (after a UI reload an old hidden "Steam" target can linger)
let page = null;
for (const t of list.filter(x => x.title === 'Steam' && x.webSocketDebuggerUrl)) {
  try {
    const p = await open(t);
    const vis = await p.evaluate('document.visibilityState', 3000);
    if (vis === 'visible' && !page) { page = p; continue; }
    p.ws.close();
  } catch (e) { /* dead target */ }
}
if (!page) { console.log('no visible Steam window — bring Steam to the front'); process.exit(1); }

await page.send('Performance.enable');
const metrics = async () => Object.fromEntries((await page.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));

const m0 = await metrics();
await new Promise(r => setTimeout(r, 5000));
const m1 = await metrics();
const idleMsPerSec = ((m1.TaskDuration - m0.TaskDuration) * 1000 / 5).toFixed(1);

const info = await page.evaluate(`JSON.stringify({ nodes: document.getElementsByTagName('*').length, layout: getComputedStyle(document.documentElement).getPropertyValue('--rf-layout').trim(), heapMB: +(performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0).toFixed(1) })`);

const s0 = await metrics();
const scroll = await page.evaluate(`(async () => {
  const home = document.getElementById('rfs');
  let sc = home; while (sc && sc !== document.body && !(sc.scrollHeight > sc.clientHeight + 50 && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
  if (!sc || sc === document.body) return JSON.stringify({ error: 'no scroll container' });
  sc.scrollTop = 0; await new Promise(r => setTimeout(r, 300));
  const times = []; let last = performance.now(); const end = last + 4000; let dir = 1;
  await new Promise(done => { const step = now => { times.push(now - last); last = now;
    if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2) dir = -1; else if (sc.scrollTop <= 0) dir = 1;
    sc.scrollTop += 28 * dir; if (now < end) requestAnimationFrame(step); else done(); }; requestAnimationFrame(step); });
  times.shift();
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  return JSON.stringify({ fps: +(1000 / avg).toFixed(1), slowFrames: times.filter(t => t > 33).length, frames: times.length, worstMs: +Math.max(...times).toFixed(0) });
})()`, 20000);
const s1 = await metrics();

const out = { label, ...JSON.parse(info), idleMsPerSec: +idleMsPerSec, ...JSON.parse(scroll),
  layoutsDuringScroll: s1.LayoutCount - s0.LayoutCount, styleRecalcsDuringScroll: s1.RecalcStyleCount - s0.RecalcStyleCount,
  layoutMs: +((s1.LayoutDuration - s0.LayoutDuration) * 1000).toFixed(0), styleMs: +((s1.RecalcStyleDuration - s0.RecalcStyleDuration) * 1000).toFixed(0) };
console.log(JSON.stringify(out));
page.ws.close();
process.exit(0); // a lingering old 'Steam' target can keep a socket open
