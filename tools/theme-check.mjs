// Switches Steam to each given style, then screenshots the library home and reports whether its layout rendered.
//   node tools/theme-check.mjs <outDir> "Terminal" "RPG Vault" ...      (Steam must run with -dev and be on screen)
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { connect } from './cdp.mjs';

const [outDir, ...styles] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function visibleSteam() {
  const list = await (await fetch('http://127.0.0.1:8080/json')).json();
  for (const t of list.filter(x => x.title === 'Steam' && x.webSocketDebuggerUrl)) {
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    try { await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; setTimeout(j, 2500); }); } catch (e) { continue; }
    let id = 0;
    const send = (method, params = {}, ms = 20000) => new Promise((resolve, reject) => {
      const my = ++id; const timer = setTimeout(() => reject(new Error('timeout ' + method)), ms);
      const h = ev => { const m = JSON.parse(ev.data); if (m.id === my) { clearTimeout(timer); ws.removeEventListener('message', h); resolve(m.result); } };
      ws.addEventListener('message', h); ws.send(JSON.stringify({ id: my, method, params }));
    });
    const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r && r.result ? r.result.value : undefined; };
    try { if ((await ev('document.visibilityState')) === 'visible') return { ws, send, ev }; } catch (e) { /* dead */ }
    ws.close();
  }
  return null;
}

for (const style of styles) {
  const sj = await connect(/^SharedJSContext$/);
  try {
    await sj.evaluate(`window.MILLENNIUM_API.ffi('core','Core_ChangeCondition')('rf-shelf', ${JSON.stringify(style)}, 'Style')`);
    await sj.evaluate('SteamClient.Browser.RestartJSContext(), true');
  } catch (e) { /* context restarts */ }
  sj.close();
  await sleep(9000);
  const sj2 = await connect(/^SharedJSContext$/);
  try { await sj2.evaluate("SteamUIStore.Navigate('/library/home'), 1"); } catch (e) { /* ignore */ }
  sj2.close();
  await sleep(6000);
  const p = await visibleSteam();
  if (!p) { console.log(style, ': no visible Steam window'); continue; }
  const info = await p.ev(`JSON.stringify({
    layoutVar: getComputedStyle(document.documentElement).getPropertyValue('--rf-layout').trim(),
    rendered: document.querySelector('#rfs') ? document.querySelector('#rfs').dataset.layout : null,
    on: !!document.querySelector('#rfs.on'),
    nodes: document.querySelectorAll('#rfs *').length,
    font: getComputedStyle(document.body).fontFamily.slice(0, 60),
    moduleCss: !!document.querySelector('link[data-rfs-layout]'),
  })`);
  const shot = await p.send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(outDir, style.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.png');
  writeFileSync(file, Buffer.from(shot.data, 'base64'));
  console.log(style.padEnd(16), info, '→', file);
  p.ws.close();
}
process.exit(0);
