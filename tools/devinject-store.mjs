// Injects style + webkit.css into any open Store / Community page (dev preview of the webkit skin).
//   node tools/devinject-store.mjs [classic|neon|glass|original]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const style = process.argv[2] || 'classic';
const css = readFileSync(path.join(ROOT, `src/styles/${style}.css`), 'utf8') + '\n' + readFileSync(path.join(ROOT, 'src/css/webkit.css'), 'utf8');
const list = await (await fetch('http://127.0.0.1:8080/json')).json();
const pages = list.filter(t => /steampowered\.com|steamcommunity\.com/.test(t.url) && t.webSocketDebuggerUrl);
for (const t of pages) {
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const js = readFileSync(path.join(ROOT, 'src/js/webkit.js'), 'utf8');
  const expr = `(() => { let s = document.getElementById('rfs-dev-css'); if (!s) { s = document.createElement('style'); s.id = 'rfs-dev-css'; document.head.appendChild(s); } s.textContent = ${JSON.stringify(css)}; ${js}; return location.href; })()`;
  await new Promise(res => { ws.onmessage = () => res(); ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr } })); });
  await new Promise(r => setTimeout(r, 1500));
  if (process.argv[3]) {
    await new Promise(res => { ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id === 2) { import('node:fs').then(fs => { fs.writeFileSync(process.argv[3], Buffer.from(m.result.data, 'base64')); res(); }); } }; ws.send(JSON.stringify({ id: 2, method: 'Page.captureScreenshot', params: { format: 'png' } })); });
  }
  ws.close();
  console.log('styled', t.url);
}
if (!pages.length) console.log('no store/community page open');
