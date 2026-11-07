// Page-change speed in the Steam main window (Steam must run with -dev and be on screen; never launches a game).
//   node tools/navperf.mjs [label] [rounds]
// Walks Library home <-> a game page <-> Store <-> Downloads and prints, per destination (median):
// tReady = ms from the navigation call until the page is on screen in the DOM, tPaint = + the next painted frame,
// and the main-thread cost of each change (style / layout / script ms from Performance.getMetrics, longest long task).
// See docs/PERFORMANCE.md.
async function open(t) {
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const send = (method, params = {}, ms = 30000) => new Promise((resolve, reject) => {
    const my = ++id;
    const timer = setTimeout(() => reject(new Error('timeout ' + method)), ms);
    const h = ev => { const m = JSON.parse(ev.data); if (m.id === my) { clearTimeout(timer); ws.removeEventListener('message', h); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); } };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: my, method, params }));
  });
  const evaluate = async (expression, ms) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, ms);
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500));
    return r && r.result ? r.result.value : undefined;
  };
  return { ws, send, evaluate, close: () => ws.close() };
}
async function targets() { return (await fetch('http://127.0.0.1:8080/json')).json(); }
async function main() {
  const list = await targets();
  for (const t of list.filter(x => x.title === 'Steam' && x.webSocketDebuggerUrl)) {
    try { const p = await open(t); const v = await p.evaluate('document.visibilityState', 3000); if (v === 'visible') return p; p.close(); } catch (e) {}
  }
  const t = list.find(x => x.title === 'Steam'); return open(t);
}
const label = process.argv[2] || 'run';
const rounds = +(process.argv[3] || 3);
const p = await main();
await p.send('Performance.enable');
const metrics = async () => Object.fromEntries((await p.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
const setup = `(() => {
  const A = window.__rfsShelf.SteamAPI;
  window.__bn = window.__bn || {};
  if (!window.__bn.obs) { window.__bn.lt = []; try { const o = new PerformanceObserver(l => { for (const e of l.getEntries()) window.__bn.lt.push(e.duration); }); o.observe({ entryTypes: ['longtask'] }); window.__bn.obs = o; } catch (e) { window.__bn.lterr = String(e); } }
  const sel = { app: A.sel('AppDetailsOverviewPanel') || A.sel('PlayBar', 'Glassy'), dl: A.sel('DownloadsPage', 'RemoveAllButton') || A.sel('DownloadsPage') };
  const game = (window.__rfsShelf.state.games[0] || {}).appid;
  const vis = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 50 && r.height > 50; };
  const ready = {
    home: () => A.route().startsWith('/library/home') && (getComputedStyle(document.documentElement).getPropertyValue('--rf-layout').trim() === 'original' ? vis(A.updatesBlock()) : (document.querySelector('#rfs.on') && document.querySelector('#rfs').getElementsByTagName('*').length > 30 && vis(document.querySelector('#rfs')))),
    app: () => A.route().startsWith('/library/app/') && sel.app && vis(document.querySelector(sel.app)) && !document.querySelector('#rfs.on'),
    dl: () => A.route().startsWith('/library/downloads') && sel.dl && vis(document.querySelector(sel.dl)) && !document.querySelector('#rfs.on'),
    store: () => A.route().startsWith('/browser') && !document.querySelector('#rfs.on'),
  };
  const go = { home: () => A.navigate('/library/home'), app: () => A.navigate('/library/app/' + game), dl: () => A.navigate('/library/downloads'), store: () => A.steamUrl('steam://url/StoreFrontPage') };
  window.__bn.step = async (k) => {
    window.__bn.lt.length = 0;
    const t0 = performance.now(); let tRoute = 0;
    go[k]();
    const want = { home: '/library/home', app: '/library/app', dl: '/library/downloads', store: '/browser' }[k];
    while (performance.now() - t0 < 8000) {
      await new Promise(r => requestAnimationFrame(r));
      if (!tRoute && A.route().startsWith(want)) tRoute = performance.now() - t0;
      if (ready[k]()) break;
    }
    const tReady = performance.now() - t0;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const tPaint = performance.now() - t0;
    const ok = !!ready[k]();
    await new Promise(r => setTimeout(r, 1200));
    const lt = window.__bn.lt.slice();
    return JSON.stringify({ k, tRoute: Math.round(tRoute), tReady: Math.round(tReady), tPaint: Math.round(tPaint), ok, longTasks: lt.length, longMax: Math.round(Math.max(0, ...lt)), longSum: Math.round(lt.reduce((a, b) => a + b, 0)) });
  };
  return JSON.stringify({ sel, game, lterr: window.__bn.lterr });
})()`;
console.error(await p.evaluate(setup));
await p.evaluate(`window.__bn.step('home')`);
const seq = ['app', 'home', 'store', 'home', 'dl', 'home', 'app', 'dl', 'store', 'app'];
const rows = [];
for (let r = 0; r < rounds; r++) {
  for (const k of seq) {
    const m0 = await metrics();
    const res = JSON.parse(await p.evaluate(`window.__bn.step('${k}')`, 30000));
    const m1 = await metrics();
    res.taskMs = Math.round((m1.TaskDuration - m0.TaskDuration) * 1000);
    res.styleMs = Math.round((m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000);
    res.layoutMs = Math.round((m1.LayoutDuration - m0.LayoutDuration) * 1000);
    res.scriptMs = Math.round((m1.ScriptDuration - m0.ScriptDuration) * 1000);
    res.recalcs = m1.RecalcStyleCount - m0.RecalcStyleCount;
    rows.push(res);
  }
}
await p.evaluate(`window.__bn.step('home')`);
// aggregate by destination (median)
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const agg = {};
for (const k of ['home', 'app', 'store', 'dl']) {
  const rs = rows.filter(r => r.k === k);
  agg[k] = Object.fromEntries(['tReady', 'tPaint', 'taskMs', 'styleMs', 'layoutMs', 'scriptMs', 'longMax', 'longSum'].map(f => [f, med(rs.map(r => r[f]))]));
  agg[k].n = rs.length; agg[k].fails = rs.filter(r => !r.ok).length;
}
console.log(JSON.stringify({ label, agg }));
if (process.env.V) for (const r of rows) console.log(JSON.stringify(r));
p.close(); process.exit(0);
