// Drives the real app (fake Steam folder, GS_FAKE=1) through every screen via the Chrome DevTools Protocol
// and saves screenshots to docs/screens/. Usage: node test/screenshots.mjs [ar|en ...]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, '..');
const outDir = path.join(appDir, 'docs', 'screens');
const require = createRequire(import.meta.url);
const electron = require('electron');
const PORT = 9555;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeFakeSteam(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'steam.exe'), ''); // no Millennium: the app will download it into this folder
}

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((x) => x.type === 'page' && x.url.includes('index.html'));
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('no CDP target');
}

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.method === 'Runtime.exceptionThrown') console.log('  [page error]', d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') console.log('  [console.error]', d.params.args.map((a) => a.value ?? a.description).join(' '));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') console.log('  [log]', d.params.entry.text, d.params.entry.url || '');
    if (d.id && pending.has(d.id)) { const { res, rej } = pending.get(d.id); pending.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); }
  };
  const ready = new Promise((r) => { ws.onopen = r; });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  return { ready, send, close: () => ws.close() };
}

async function runLang(lang) {
  const root = path.join(os.tmpdir(), `gs-fake-steam-ui-${lang}`);
  makeFakeSteam(root);
  const env = { ...process.env, GS_STEAM_ROOT: root, GS_FAKE: '1', GS_FAKE_STEAM_RUNNING: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  const proc = spawn(electron, ['.', `--remote-debugging-port=${PORT}`], { cwd: appDir, env, stdio: 'ignore' });
  try {
    const c = cdp(await connect());
    await c.ready;
    await c.send('Runtime.enable'); await c.send('Log.enable'); await c.send('Page.enable');
    await c.send('Page.reload');
    await sleep(500);
    const ev = async (expr) => {
      const r = await c.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + expr);
      return r.result.value;
    };
    const waitFor = async (expr, ms = 20000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { try { if (await ev(expr)) return; } catch {} await sleep(150); }
      throw new Error('timeout waiting for ' + expr);
    };
    const shot = async (name) => {
      await sleep(450);
      const r = await c.send('Page.captureScreenshot', { format: 'png' });
      const f = path.join(outDir, `${lang}-${name}.png`);
      fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
      console.log('  saved', path.relative(appDir, f));
    };
    const click = (sel) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) throw new Error('no ${sel.replace(/'/g, '')}'); el.click(); return true; })()`);
    const key = (k) => ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true }))`);

    const active = (name) => `document.querySelector('.screen[data-screen="${name}"]').classList.contains('is-active')`;
    const imgsReady = (sel) => ev(`Promise.all([...document.querySelectorAll(${JSON.stringify(sel)})].map(i => Promise.race([i.decode().catch(() => 0), new Promise(r => setTimeout(r, 3000))]))).then(() => true)`);

    await waitFor(`document.body.classList.contains('is-ready')`);
    await ev(`document.fonts.ready.then(() => true)`);
    if (lang === 'en') await click('#tbLang');
    await imgsReady('#wall img');
    await sleep(1200);
    await shot('1-welcome');

    await click('#startBtn');
    await waitFor(`!!document.querySelector('#consentChk')`);
    await sleep(500);
    await shot('2-check');

    await click('#consentChk');
    await click('#checkNext');
    await waitFor(active('themes'));
    await imgsReady('#grid img, #vstage img');
    await sleep(700);
    await shot('3-themes');

    // browse with the keyboard to Neon Coverflow, switch to the store view
    const fwd = lang === 'ar' ? 'ArrowLeft' : 'ArrowRight';
    await key(fwd); await key(fwd);
    await sleep(200);
    await click('#vTabs [data-tab="store"]');
    await imgsReady('#vstage img');
    await sleep(800);
    await shot('3b-themes-store');

    // the community group: SpaceTheme (not selected by default), then include it and make it the default
    const spaceI = await ev(`[...document.querySelectorAll('#grid .fitem')].findIndex(el => el.querySelector('.fname').textContent.includes('SpaceTheme'))`);
    await click(`#grid .fitem:nth-child(1) .fthumb`); // reset (first item)
    await click(`.fgroup-extra .fitem:nth-child(1) .fthumb`);
    await imgsReady('#vstage img');
    await sleep(900);
    await shot('3c-themes-community');
    console.log('  spaceTheme index', spaceI);

    // choose Cupertino Dark as the default, then install
    await ev(`(() => { const el = [...document.querySelectorAll('#grid .fitem')].find(x => x.querySelector('.fname').textContent.match(/Cupertino|كوبرتينو/)); el.querySelector('.fthumb').click(); return true; })()`);
    await sleep(300);
    await click('#vMakeDefault');
    await sleep(300);
    await click('#installBtn');
    try { await waitFor(`parseInt(document.querySelector('.task-pct')?.textContent || '0') >= 45 || document.querySelectorAll('.task.is-done').length > 0`, 60000); }
    catch (e) { await shot('debug'); console.log(await ev(`document.querySelector('#log').innerText + ' | ' + document.querySelector('#taskList').innerText`)); throw e; }
    await shot('4-install-progress');
    await click('#drawerBtn');
    await sleep(400);
    await shot('4b-install-details');
    await waitFor(active('done'), 90000);
    await imgsReady('#doneFrame img');
    await sleep(1400);
    await shot('5-done');

    // uninstall confirm (from welcome)
    await ev(`(() => { document.querySelector('.screen.is-active').classList.remove('is-active'); document.querySelector('.screen[data-screen="welcome"]').classList.add('is-active'); document.querySelector('#app').dataset.screen = 'welcome'; return true; })()`);
    await sleep(500);
    await click('#uninstallLink');
    await sleep(400);
    await shot('6-uninstall-confirm');
    c.close();

    // sanity: the fake folder now has Millennium + the theme
    const ok = fs.existsSync(path.join(root, 'wsock32.dll')) && fs.existsSync(path.join(root, 'millennium', 'themes', 'rf-shelf', 'src', 'installed.json'));
    console.log('  fake install complete:', ok);
  } finally {
    proc.kill();
    await sleep(800);
  }
}

fs.mkdirSync(outDir, { recursive: true });
const langs = process.argv.slice(2).length ? process.argv.slice(2) : ['ar', 'en'];
for (const l of langs) {
  console.log('lang', l);
  for (const f of fs.readdirSync(outDir)) if (f.startsWith(l + '-') && f.endsWith('.png')) fs.unlinkSync(path.join(outDir, f));
  await runLang(l);
}
