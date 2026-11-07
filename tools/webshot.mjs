// Screenshots real Steam store / community pages wearing our theme — in a hidden Chromium of its own.
// It NEVER touches the Steam client: no port 8080, no theme switch, no restart. Use it to design and check how every
// style dresses the web pages (store, wishlist, cart, checkout/login, community, profile …).
//
//   node tools/webshot.mjs --style "Retro Arcade" [--lang en|ar] [--out shots] [--w 1600 --h 1000] [--full]
//                          [--scroll 900] [--wait 4500] [--eval "js expression"] URL [URL …]
//
// How it works: like Millennium inside Steam, every page gets webkit.css + lang/<xx>.css + styles/classic.css and
// webkit.js from https://millennium.host/v1/themes/rf-shelf/… — those requests are answered from THIS folder
// (webkit-styles.css is generated on the fly from src/styles/*.css, so an edit shows without running build.mjs).
// MILLENNIUM_API is a stand-in that reports the chosen style + language. The browser sends Steam's own user agent,
// so the store lays out exactly like the client's store window. Not logged in: account pages show Steam's login page.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = { style: 'Classic Shelf', lang: 'en', out: path.join(ROOT, 'shots'), w: 1600, h: 1000, wait: 4500, full: false, scroll: 0, eval: '' };
const urls = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--full') opt.full = true;
  else if (a.startsWith('--')) { const k = a.slice(2); const v = args[++i]; opt[k] = ['w', 'h', 'wait', 'scroll'].includes(k) ? +v : v; }
  else urls.push(a);
}
if (!urls.length) { console.log('usage: node tools/webshot.mjs --style "Retro Arcade" [--lang ar] URL …'); process.exit(1); }
const STYLE_IDS = { 'Classic Shelf': 'classic', 'Neon Coverflow': 'neon', 'Glass Gallery': 'glass', 'Steam Original': 'original', 'SpaceTheme': 'space', 'Material You': 'material', 'Terminal': 'terminal', 'RPG Vault': 'vault', 'Vinyl Records': 'vinyl', 'Corkboard': 'cork', 'Retro Arcade': 'arcade', 'Magazine': 'magazine', 'Cupertino Dark': 'cupertino', 'Cyberpunk': 'cyberpunk', 'Shelter OS': 'shelter' };
// accept the id too ("arcade")
const byId = Object.fromEntries(Object.entries(STYLE_IDS).map(([v, id]) => [id, v]));
if (byId[opt.style]) opt.style = byId[opt.style];
if (!STYLE_IDS[opt.style]) { console.log('unknown style', opt.style, '— one of:', Object.keys(STYLE_IDS).join(', ')); process.exit(1); }
const sid = STYLE_IDS[opt.style];
const LANG = opt.lang === 'ar' ? 'Arabic' : 'English';
mkdirSync(opt.out, { recursive: true });

/* ---- the theme files, served as if from millennium.host */
const STYLES = ['classic', 'neon', 'glass', 'original', 'space', 'material', 'terminal', 'vault', 'vinyl', 'cork', 'arcade', 'magazine'];
function webkitStyles() { // same transformation as tools/build.mjs
  let out = '';
  for (const s of STYLES) {
    const f = path.join(ROOT, 'src/styles', s + '.css');
    if (!existsSync(f)) continue;
    out += '\n' + readFileSync(f, 'utf8').replace(/:root:root\s*\{/g, `html[data-rfs-style="${s}"][data-rfs-style] {`).replace(/(^|[^:]):root\s*\{/gm, `$1html[data-rfs-style="${s}"] {`) + '\n';
  }
  return out + '\n' + readFileSync(path.join(ROOT, 'src/css/icons.css'), 'utf8');
}
const TYPES = { css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', json: 'application/json', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf' };
function themeFile(url) {
  const rel = decodeURIComponent(new URL(url).pathname.replace(/^\/v1\/themes\/rf-shelf\//, ''));
  if (rel === 'src/css/webkit-styles.css') return { body: Buffer.from(webkitStyles()), type: TYPES.css };
  const f = path.join(ROOT, rel);
  if (!f.startsWith(ROOT) || !existsSync(f)) return null;
  return { body: readFileSync(f), type: TYPES[path.extname(f).slice(1)] || 'application/octet-stream' };
}

/* ---- be gentle with the PC (the owner may be playing): below-normal priority (Chromium inherits it), no GPU,
   and ONE screenshot browser at a time across every caller (a lock file; a stale lock is taken over after 3 min) */
import { setPriority, constants as osc } from 'node:os';
import { openSync, closeSync, statSync, unlinkSync } from 'node:fs';
try { setPriority(osc.priority.PRIORITY_BELOW_NORMAL); } catch (e) { /* not allowed — fine */ }
const SLOTS = 2; // at most two screenshot browsers at once, across every caller
let LOCK = null;
for (let i = 0; !LOCK; i++) {
  for (let s = 0; s < SLOTS && !LOCK; s++) {
    const f = path.join(tmpdir(), `rfs-webshot.${s}.lock`);
    try { closeSync(openSync(f, 'wx')); LOCK = f; } catch (e) { try { if (Date.now() - statSync(f).mtimeMs > 600000) unlinkSync(f); } catch (er) { /* raced */ } }
  }
  if (!LOCK) { if (i % 20 === 0) console.log('waiting for another screenshot run to finish…'); await new Promise(r => setTimeout(r, 1500)); }
}
const unlock = () => { try { unlinkSync(LOCK); } catch (e) { /* gone */ } };
process.on('exit', unlock);
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

/* ---- a private headless Chromium (Playwright's copy, or Chrome / Edge) */
const candidates = [
  path.join(homedir(), 'AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe'),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const exe = candidates.find(existsSync);
if (!exe) { console.log('no Chromium found'); process.exit(1); }
const port = 9400 + Math.floor(Math.random() * 400);
const profile = path.join(tmpdir(), 'rfs-webshot-' + process.pid);
const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--mute-audio', '--disable-extensions', '--disable-gpu', '--renderer-process-limit=2', `--window-size=${opt.w},${opt.h}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ver = null;
for (let i = 0; i < 60 && !ver; i++) { await sleep(250); try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch (e) { /* starting */ } }
if (!ver) { console.log('Chromium did not start'); chrome.kill(); process.exit(1); }

const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let nid = 0; const pending = new Map(); const handlers = [];
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
  else if (m.method) handlers.forEach(h => h(m));
};
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++nid; pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Valve Steam Client/default/1792618285) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.183 Safari/537.36';
const boot = `(() => {
  const STYLE = ${JSON.stringify(opt.style)}, LANG = ${JSON.stringify(LANG)};
  try { localStorage.setItem('rfs.style', ${JSON.stringify(sid)}); localStorage.setItem('rfs.lang', LANG === 'Arabic' ? 'ar' : 'en'); } catch (e) {}
  const conds = { 'rf-shelf': { Style: STYLE, Language: LANG } };
  window.MILLENNIUM_API = { ffi: (mod, fn) => async () => JSON.stringify(fn === 'Core_GetBackendConfig' ? { themes: { activeTheme: 'rf-shelf', conditions: conds } } : { conditions: conds, active_theme: 'rf-shelf' }) };
  const B = 'https://millennium.host/v1/themes/rf-shelf/';
  const add = () => {
    if (window.__rfsShot) return; window.__rfsShot = true;
    document.documentElement.classList.add('client', 'DesktopUI', 'MillenniumWindow_SteamBrowser');
    const h = document.head || document.documentElement;
    for (const f of ['src/css/webkit.css', 'src/lang/' + (LANG === 'Arabic' ? 'ar' : 'en') + '.css', 'src/styles/classic.css']) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = B + f; h.appendChild(l);
    }
    const s = document.createElement('script'); s.src = B + 'src/js/webkit.js'; h.appendChild(s);
  };
  if (document.readyState !== 'loading') add(); else document.addEventListener('DOMContentLoaded', add);
})();`;

const results = [];
try {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => send(m, p, sessionId);
  handlers.push(async m => {
    if (m.sessionId !== sessionId || m.method !== 'Fetch.requestPaused') return;
    const f = themeFile(m.params.request.url);
    try {
      if (!f) await S('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 404, body: '' });
      else await S('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200, body: f.body.toString('base64'),
        responseHeaders: [{ name: 'Content-Type', value: f.type }, { name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Cache-Control', value: 'no-store' }] });
    } catch (e) { /* page went away */ }
  });
  await S('Page.enable');
  await S('Page.setBypassCSP', { enabled: true }); // Millennium's files load past the store's CSP inside Steam too
  await S('Network.enable');
  await S('Network.setUserAgentOverride', { userAgent: UA, acceptLanguage: LANG === 'Arabic' ? 'ar,en;q=0.8' : 'en-US,en;q=0.9' });
  await S('Emulation.setDeviceMetricsOverride', { width: opt.w, height: opt.h, deviceScaleFactor: 1, mobile: false });
  for (const domain of ['.steampowered.com', 'steamcommunity.com', 'help.steampowered.com', 'checkout.steampowered.com']) {
    for (const [name, value] of [['Steam_Language', LANG === 'Arabic' ? 'arabic' : 'english'], ['birthtime', '470703601'], ['lastagecheckage', '1-0-1985'], ['wants_mature_content', '1']]) {
      await S('Network.setCookie', { name, value, domain, path: '/', secure: true, sameSite: 'None' });
    }
  }
  await S('Fetch.enable', { patterns: [{ urlPattern: 'https://millennium.host/*', requestStage: 'Request' }] });
  await S('Page.addScriptToEvaluateOnNewDocument', { source: boot });
  for (const url of urls) {
    const loaded = new Promise(r => { const h = m => { if (m.sessionId === sessionId && m.method === 'Page.loadEventFired') { handlers.splice(handlers.indexOf(h), 1); r(); } }; handlers.push(h); setTimeout(r, 25000); });
    await S('Page.navigate', { url });
    await loaded;
    await sleep(opt.wait);
    if (opt.scroll) { await S('Runtime.evaluate', { expression: `window.scrollTo(0, ${opt.scroll})` }); await sleep(800); }
    const slug = new URL(url).host.split('.')[0] + '-' + (new URL(url).pathname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40) || 'home');
    const file = path.join(opt.out, `${sid}-${opt.lang}-${slug}${opt.scroll ? '-y' + opt.scroll : ''}.png`);
    let shot;
    if (opt.full) {
      const mt = await S('Page.getLayoutMetrics');
      const H = Math.min(Math.ceil(mt.cssContentSize.height), 5000);
      shot = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: opt.w, height: H, scale: 1 } });
    } else shot = await S('Page.captureScreenshot', { format: 'png' });
    writeFileSync(file, Buffer.from(shot.data, 'base64'));
    const info = await S('Runtime.evaluate', { returnByValue: true, expression: `JSON.stringify({ final: location.href, title: document.title.slice(0, 60), style: document.documentElement.getAttribute('data-rfs-style'), lang: document.documentElement.getAttribute('data-rfs-lang'), vendor: document.querySelectorAll('link[data-rfs-vendor]').length, font: getComputedStyle(document.body).fontFamily.slice(0, 50) })` });
    let ev = '';
    if (opt.eval) { const r = await S('Runtime.evaluate', { expression: opt.eval, returnByValue: true, awaitPromise: true }); ev = r.exceptionDetails ? 'EVAL ERROR ' + (r.exceptionDetails.exception?.description || '') : JSON.stringify(r.result.value); }
    results.push(file);
    console.log('→', file, info.result.value, ev ? '\n  eval: ' + ev.slice(0, 6000) : '');
  }
} catch (e) {
  console.log('webshot failed:', e.message);
} finally {
  try { await send('Browser.close'); } catch (e) { /* already closing */ }
  await sleep(500);
  try { chrome.kill(); } catch (e) { /* gone */ }
  try { rmSync(profile, { recursive: true, force: true }); } catch (e) { /* locked for a moment — temp folder */ }
  process.exit(0);
}
