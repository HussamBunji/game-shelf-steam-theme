// Measures the store page layout (content column vs free side space) in the open store/community page.
//   node tools/store-measure.mjs
const list = await (await fetch('http://127.0.0.1:8080/json')).json();
const t = list.find(x => /steampowered\.com|steamcommunity\.com/.test(x.url) && x.webSocketDebuggerUrl);
if (!t) { console.log('no store page open'); process.exit(1); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => { ws.onopen = r; });
const expr = `(() => {
  const W = innerWidth;
  // widest element that is centred and much narrower than the window = the content column
  let col = null;
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.height < 300 || r.width < 600 || r.width > W * 0.85) continue;
    if (Math.abs((r.left + r.right) / 2 - W / 2) > 40) continue;
    if (!col || r.width > col.r.width) col = { el, r };
  }
  const sel = el => el ? el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '.' + String(el.className).split(' ').slice(0, 3).join('.') : null;
  return JSON.stringify({
    url: location.href, W, H: innerHeight, dpr: devicePixelRatio,
    column: col && { sel: sel(col.el), left: Math.round(col.r.left), width: Math.round(col.r.width) },
    freeLeft: col ? Math.round(col.r.left) : null,
    purchase: !!document.querySelector('#game_area_purchase, .game_area_purchase_game'),
    wishlistBtn: !!document.querySelector('#add_to_wishlist_area, .queue_btn_wishlist, [class*="wishlist" i]'),
    appHeader: sel(document.querySelector('.apphub_AppName, #appHubAppName')),
  }, null, 1);
})()`;
const res = await new Promise(r => { ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id === 1) r(m.result); }; ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } })); });
console.log(res.result ? res.result.value : JSON.stringify(res));
ws.close();
