// Screenshot a Steam web page target by URL regex:  node tools/shot-url.mjs "steampowered" out.png
import { writeFileSync } from 'node:fs';
const [re, out] = process.argv.slice(2);
const list = await (await fetch('http://127.0.0.1:8080/json')).json();
const t = list.find(x => new RegExp(re).test(x.url) && x.webSocketDebuggerUrl);
if (!t) { console.log('no target for', re, list.map(x => x.url).join(' | ')); process.exit(1); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => { ws.onopen = r; });
const data = await new Promise(r => { ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id === 1) r(m.result.data); }; ws.send(JSON.stringify({ id: 1, method: 'Page.captureScreenshot', params: { format: 'png' } })); });
writeFileSync(out, Buffer.from(data, 'base64'));
ws.close();
console.log('saved', out, t.url);
