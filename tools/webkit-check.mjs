// Reports what the theme injected into every open store/community page.
//   node tools/webkit-check.mjs
const list = await (await fetch('http://127.0.0.1:8080/json')).json();
for (const t of list.filter(x => /steampowered\.com|steamcommunity\.com/.test(x.url) && x.webSocketDebuggerUrl)) {
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  const expr = `JSON.stringify({
    url: location.href.slice(0, 70),
    style: document.documentElement.getAttribute('data-rfs-style'),
    js: !!window.__rfsWebkit,
    tagged: document.querySelectorAll('[data-rfs]').length,
    accent: getComputedStyle(document.documentElement).getPropertyValue('--rf-accent').trim(),
    sheets: [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.href).filter(h => /millennium/.test(h)).map(h => h.split('/').pop()),
  })`;
  const res = await new Promise(r => { ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id === 1) r(m.result); }; ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } })); });
  console.log(res.result ? res.result.value : JSON.stringify(res));
  ws.close();
}
