// Runs the REAL shelf.js + a style's home design in a hidden Chromium with a stand-in Steam (60 real games, art from
// Steam's public CDN) and screenshots it. It NEVER touches the Steam client: no port 8080, no theme switch, no restart.
//
//   node tools/layoutshot.mjs --style arcade [--lang en|ar] [--out shots] [--w 1600 --h 1000]
//        [--hover 3]                 hover the 4th game: shots right after (60 ms) and later (400 ms) — hover must be instant
//        [--open 0]                  click the 1st game: shots at 120 / 350 / 800 / 1500 ms (the theme's open animation),
//                                    then Esc and a shot 600 ms later
//        [--search "elden"]          type into the one search box
//        [--key ArrowDown,ArrowDown,Enter]   press keys (after the other steps)
//        [--eval "js"]               print a value from the page
//
// Page errors / console errors are printed — fix every one. Shots: <out>/<id>-<lang>-<step>.png
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, openSync, closeSync, statSync, unlinkSync } from 'node:fs';
import { tmpdir, homedir, setPriority, constants as osc } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = { style: 'arcade', lang: 'en', out: path.join(ROOT, 'shots'), w: 1600, h: 1000, hover: '', open: '', search: '', key: '', eval: '' };
for (let i = 0; i < args.length; i++) { const k = args[i].replace(/^--/, ''); opt[k] = ['w', 'h'].includes(k) ? +args[++i] : args[++i]; }
const NAMES = { classic: 'Classic Shelf', neon: 'Neon Coverflow', glass: 'Glass Gallery', terminal: 'Terminal', vault: 'RPG Vault', vinyl: 'Vinyl Records', cork: 'Corkboard', arcade: 'Retro Arcade', magazine: 'Magazine' };
if (!NAMES[opt.style]) { console.log('style id, one of:', Object.keys(NAMES).join(', ')); process.exit(1); }
mkdirSync(opt.out, { recursive: true });

/* ---- 60 real games (names, tags, years) — art comes from Steam's public CDN by appid */
const GAMES = [
  [1245620, 'ELDEN RING', 'Souls-like,Open World,RPG', 2022, 'FromSoftware'], [2246340, 'Monster Hunter Wilds', 'Action,Co-op,Hunting', 2025, 'CAPCOM'],
  [1086940, "Baldur's Gate 3", 'RPG,Story Rich,Turn-Based', 2023, 'Larian Studios'], [292030, 'The Witcher 3: Wild Hunt', 'RPG,Open World,Story Rich', 2015, 'CD PROJEKT RED'],
  [1091500, 'Cyberpunk 2077', 'RPG,Open World,Sci-fi', 2020, 'CD PROJEKT RED'], [570, 'Dota 2', 'MOBA,Strategy,Free to Play', 2013, 'Valve'],
  [730, 'Counter-Strike 2', 'FPS,Shooter,Competitive', 2023, 'Valve'], [413150, 'Stardew Valley', 'Farming Sim,Cozy,Pixel Graphics', 2016, 'ConcernedApe'],
  [1145360, 'Hades', 'Roguelike,Action,Mythology', 2020, 'Supergiant Games'], [367520, 'Hollow Knight', 'Metroidvania,Souls-like,2D', 2017, 'Team Cherry'],
  [1174180, 'Red Dead Redemption 2', 'Open World,Western,Story Rich', 2019, 'Rockstar Games'], [271590, 'Grand Theft Auto V', 'Open World,Action,Crime', 2015, 'Rockstar North'],
  [814380, 'Sekiro: Shadows Die Twice', 'Souls-like,Action,Ninja', 2019, 'FromSoftware'], [374320, 'DARK SOULS III', 'Souls-like,RPG,Dark Fantasy', 2016, 'FromSoftware'],
  [1593500, 'God of War', 'Action,Mythology,Story Rich', 2022, 'Santa Monica Studio'], [2050650, 'Resident Evil 4', 'Survival Horror,Action,Remake', 2023, 'CAPCOM'],
  [582010, 'Monster Hunter: World', 'Action,Co-op,Hunting', 2018, 'CAPCOM'], [1716740, 'Starfield', 'RPG,Space,Open World', 2023, 'Bethesda Game Studios'],
  [489830, 'The Elder Scrolls V: Skyrim Special Edition', 'RPG,Open World,Fantasy', 2016, 'Bethesda Game Studios'], [377160, 'Fallout 4', 'RPG,Post-apocalyptic,Open World', 2015, 'Bethesda Game Studios'],
  [1938090, 'Call of Duty', 'FPS,Shooter,Multiplayer', 2022, 'Infinity Ward'], [252490, 'Rust', 'Survival,Open World,Crafting', 2018, 'Facepunch Studios'],
  [105600, 'Terraria', 'Sandbox,Crafting,2D', 2011, 'Re-Logic'], [431960, 'Wallpaper Engine', 'Utilities,Design', 2018, 'Wallpaper Engine Team'],
  [1172470, 'Apex Legends', 'Battle Royale,FPS,Free to Play', 2020, 'Respawn'], [578080, 'PUBG: BATTLEGROUNDS', 'Battle Royale,Shooter', 2017, 'KRAFTON'],
  [1203220, 'NARAKA: BLADEPOINT', 'Battle Royale,Martial Arts', 2021, '24 Entertainment'], [945360, 'Among Us', 'Social Deduction,Multiplayer', 2018, 'Innersloth'],
  [1517290, 'Battlefield 2042', 'FPS,Shooter,Multiplayer', 2021, 'DICE'], [2358720, 'Black Myth: Wukong', 'Action,Mythology,Souls-like', 2024, 'Game Science'],
  [1623730, 'Palworld', 'Open World,Survival,Creature Collector', 2024, 'Pocketpair'], [553850, 'HELLDIVERS 2', 'Co-op,Shooter,Sci-fi', 2024, 'Arrowhead'],
  [1868140, 'DAVE THE DIVER', 'Adventure,Pixel Graphics,Management', 2023, 'MINTROCKET'], [2379780, 'Balatro', 'Roguelike,Card Game,Deckbuilder', 2024, 'LocalThunk'],
  [1966720, 'Lethal Company', 'Horror,Co-op,Online Co-Op', 2023, 'Zeekerss'], [892970, 'Valheim', 'Survival,Open World,Viking', 2021, 'Iron Gate AB'],
  [1063730, 'New World: Aeternum', 'MMORPG,Open World', 2021, 'Amazon Games'], [1326470, 'Sons Of The Forest', 'Survival,Horror,Open World', 2024, 'Endnight Games'],
  [550, 'Left 4 Dead 2', 'Zombies,Co-op,FPS', 2009, 'Valve'], [620, 'Portal 2', 'Puzzle,Co-op,Sci-fi', 2011, 'Valve'],
  [400, 'Portal', 'Puzzle,First-Person,Sci-fi', 2007, 'Valve'], [220, 'Half-Life 2', 'FPS,Classic,Sci-fi', 2004, 'Valve'],
  [546560, 'Half-Life: Alyx', 'VR,FPS,Sci-fi', 2020, 'Valve'], [1449850, 'Yu-Gi-Oh! Master Duel', 'Card Game,Free to Play', 2022, 'KONAMI'],
  [2215430, 'Ghost of Tsushima', 'Open World,Samurai,Action', 2024, 'Sucker Punch'], [1817070, "Marvel's Spider-Man Remastered", 'Superhero,Open World,Action', 2022, 'Insomniac Games'],
  [1888930, 'The Last of Us Part I', 'Story Rich,Survival,Action', 2023, 'Naughty Dog'], [2195250, 'EA SPORTS FC 24', 'Football,Sports', 2023, 'EA Canada'],
  [990080, 'Hogwarts Legacy', 'Open World,Magic,RPG', 2023, 'Avalanche Software'], [1151640, 'Horizon Zero Dawn', 'Open World,Action,Robots', 2020, 'Guerrilla'],
  [601150, 'Devil May Cry 5', 'Action,Hack and Slash', 2019, 'CAPCOM'], [1196590, 'Resident Evil Village', 'Survival Horror,Action', 2021, 'CAPCOM'],
  [1687950, 'Persona 5 Royal', 'JRPG,Turn-Based,Anime', 2022, 'ATLUS'], [1113560, 'NieR Replicant', 'Action RPG,Story Rich', 2021, 'Toylogic'],
  [524220, 'NieR:Automata', 'Action RPG,Story Rich', 2017, 'PlatinumGames'], [1551360, 'Forza Horizon 5', 'Racing,Open World,Driving', 2021, 'Playground Games'],
  [271440, 'Need for Speed Payback', 'Racing,Action', 2017, 'Ghost Games'], [1240440, 'Halo Infinite', 'FPS,Sci-fi,Multiplayer', 2021, '343 Industries'],
  [2399830, 'ARK: Survival Ascended', 'Survival,Dinosaurs,Open World', 2023, 'Studio Wildcard'], [1222670, 'The Sims 4', 'Life Sim,Simulation', 2014, 'Maxis'],
];
const now = Math.floor(Date.now() / 1000);

/* ---- the test page: theme CSS + a stand-in Steam (window.appStore … ) + the real shelf.js */
function harness() {
  const games = GAMES.map(([appid, name, tags, year, dev], i) => ({
    appid, name, tags: tags.split(','), year, dev,
    installed: i % 3 !== 2, size: (i % 3 !== 2) ? Math.round((8 + (i * 37) % 140) * 1024 ** 3) : 0,
    last: i < 40 ? now - Math.round(i * i * 9000 + i * 3600) : 0, play: i < 45 ? Math.round(6000 / (i + 1) + (i * 53) % 400) : 0,
  }));
  return `<!doctype html><html lang="${opt.lang}"><head><meta charset="utf-8">
<link rel="stylesheet" href="/src/lang/${opt.lang}.css"><link rel="stylesheet" href="/src/styles/${opt.style}.css">
<link rel="stylesheet" href="/src/css/shelf.css"><link rel="stylesheet" href="/src/css/layouts.css">
<style>html,body{margin:0;height:100%;background:#101216;color:#ddd;overflow:hidden}
#fake-nav{position:fixed;left:0;right:0;top:0;height:44px;background:#171a21;border-bottom:1px solid #000;display:flex;align-items:center;gap:22px;padding:0 18px;font:600 13px 'Segoe UI';letter-spacing:.05em;color:#bbb}
#fake-panel{position:fixed;left:0;right:0;top:44px;bottom:0;overflow:auto}</style>
<script>
(() => {
  const CDN = 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/';
  const G = ${JSON.stringify(games)};
  const ov = G.map(g => ({ appid: g.appid, display_name: g.name, sort_as: g.name, installed: g.installed, size_on_disk: String(g.size),
    rt_last_time_played: g.last, rt_last_time_locally_played: 0, minutes_playtime_forever: g.play, minutes_playtime_last_two_weeks: g.last > ${now} - 14 * 86400 ? Math.min(g.play, 600) : 0,
    app_type: 1, BIsShortcut: () => false, m_setStoreTags: new Set(g.tags), GetCanonicalReleaseYear: () => g.year, GetGameID: () => String(g.appid) }));
  const by = Object.fromEntries(G.map(g => [g.appid, g]));
  window.__harnessLog = [];
  window.appStore = { GetCachedVerticalCapsuleURL: o => [CDN + o.appid + '/library_600x900.jpg'], GetVerticalCapsuleURLForApp: o => CDN + o.appid + '/library_600x900_2x.jpg',
    GetIconURLForApp: () => '', GetLocalizationForStoreTag: t => t };
  window.collectionStore = { allGamesCollection: { allApps: ov }, localGamesCollection: { allApps: ov.filter(o => o.installed) }, userCollections: [] };
  window.appDetailsStore = {
    GetAppDetails: id => ({ strDeveloperName: by[id] ? by[id].dev : '', strInstallFolder: 'D:\\\\SteamLibrary\\\\' + id, lDiskUsageBytes: by[id] ? by[id].size : 0 }),
    RequestAppDetails: () => Promise.resolve(), GetHeroImages: o => [CDN + o.appid + '/library_hero.jpg'], GetLogoImages: o => [CDN + o.appid + '/logo.png'],
    GetHeaderImages: o => [CDN + o.appid + '/header.jpg'],
    GetDescriptions: id => ({ strSnippet: (by[id] ? by[id].name : 'This game') + ' — a stand-in description for the test page, about two lines long so the panel shows how real text wraps.' }) };
  window.SteamClient = { Apps: { RunGame: id => __harnessLog.push('RunGame ' + id) }, URL: { ExecuteSteamURL: u => __harnessLog.push('URL ' + u) }, Browser: { RestartJSContext() {} } };
  window.MainWindowBrowserManager = { m_lastLocation: { pathname: '/library/home' }, m_browser: null };
  window.SteamUIStore = { RunningApps: [], Navigate: p => { MainWindowBrowserManager.m_lastLocation.pathname = p; __harnessLog.push('Navigate ' + p); } };
  window.MILLENNIUM_API = { classMapList: [], ffi: () => async () => ({ success: true }) };
  try { localStorage.setItem('rfs.lang', ${JSON.stringify(opt.lang)}); localStorage.setItem('rfs.sound', '0'); } catch (e) {}
})();
</script></head><body>
<div id="fake-nav"><span>STORE</span><span style="color:#fff">LIBRARY</span><span>COMMUNITY</span></div>
<div id="fake-panel" class="fakeRightPanel"></div>
<script>
// skin.js's font loader, as in Steam
(() => { const gf = getComputedStyle(document.documentElement).getPropertyValue('--rf-font-gf').replace(/^["']|["']$/g, '').trim();
  if (gf) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?' + gf + '&display=swap'; document.head.appendChild(l); }
  const st = document.createElement('style'); st.textContent = ':where(body, body *:not(svg, svg *)) { font-family: var(--rf-font-ui) !important; }'; document.head.appendChild(st); })();
</script>
<script src="/src/js/shelf.js"></script>
</body></html>`;
}
const TYPES = { '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/' || u.pathname === '/__harness.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(harness()); return; }
  const f = path.join(ROOT, decodeURIComponent(u.pathname));
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': (TYPES[path.extname(f)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const HTTP = `http://127.0.0.1:${server.address().port}`;

/* ---- gentle on the PC: one screenshot browser at a time (shared lock with webshot.mjs), low priority, no GPU */
try { setPriority(osc.priority.PRIORITY_BELOW_NORMAL); } catch (e) { /* fine */ }
const SLOTS = 2; // at most two screenshot browsers at once, across every caller
let LOCK = null;
for (let i = 0; !LOCK; i++) {
  for (let s = 0; s < SLOTS && !LOCK; s++) {
    const f = path.join(tmpdir(), `rfs-webshot.${s}.lock`);
    try { closeSync(openSync(f, 'wx')); LOCK = f; } catch (e) { try { if (Date.now() - statSync(f).mtimeMs > 600000) unlinkSync(f); } catch (er) { /* raced */ } }
  }
  if (!LOCK) { if (i % 20 === 0) console.log('waiting for another screenshot run to finish…'); await new Promise(r => setTimeout(r, 1500)); }
}
process.on('exit', () => { try { unlinkSync(LOCK); } catch (e) { /* gone */ } });
process.on('SIGINT', () => process.exit(130));
const exe = [path.join(homedir(), 'AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe'), 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const port = 9400 + Math.floor(Math.random() * 400);
const profile = path.join(tmpdir(), 'rfs-layoutshot-' + process.pid);
const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--mute-audio', '--disable-extensions', '--disable-gpu', `--window-size=${opt.w},${opt.h}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ver = null;
for (let i = 0; i < 60 && !ver; i++) { await sleep(250); try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch (e) { /* starting */ } }
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let nid = 0; const pending = new Map(); const handlers = [];
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } else if (m.method) handlers.forEach(h => h(m)); };
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++nid; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });

const errors = [];
try {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => send(m, p, sessionId);
  handlers.push(m => {
    if (m.sessionId !== sessionId) return;
    if (m.method === 'Runtime.exceptionThrown') errors.push('EXCEPTION ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n').slice(0, 3).join(' | '));
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) errors.push(m.params.type.toUpperCase() + ' ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 300));
  });
  await S('Page.enable'); await S('Runtime.enable');
  await S('Emulation.setDeviceMetricsOverride', { width: opt.w, height: opt.h, deviceScaleFactor: 1, mobile: false });
  const ev = async e => { const r = await S('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed'); return r.result.value; };
  const shot = async step => { const s = await S('Page.captureScreenshot', { format: 'png' }); const f = path.join(opt.out, `${opt.style}-${opt.lang}-${step}.png`); writeFileSync(f, Buffer.from(s.data, 'base64')); console.log('→', f); };
  const mouse = async (type, x, y, extra = {}) => S('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: type === 'mouseMoved' ? 0 : 1, ...extra });
  await S('Page.navigate', { url: HTTP + '/__harness.html' });
  // wait for the design to render
  let ok = false;
  for (let i = 0; i < 60 && !ok; i++) { await sleep(250); try { ok = await ev(`!!document.querySelector('#rfs.on') && document.querySelector('#rfs').dataset.layout === ${JSON.stringify(opt.style === 'classic' ? 'shelf' : opt.style === 'neon' ? 'coverflow' : opt.style === 'glass' ? 'gallery' : opt.style)} && document.querySelectorAll('#rfs [data-appid]').length > 0`); } catch (e) { /* loading */ } }
  if (!ok) console.log('the design did not render — state:', await ev(`JSON.stringify({ on: !!document.querySelector('#rfs.on'), layout: document.querySelector('#rfs') && document.querySelector('#rfs').dataset.layout, items: document.querySelectorAll('#rfs [data-appid]').length, cssLayout: getComputedStyle(document.documentElement).getPropertyValue('--rf-layout') })`));
  await sleep(2500); // images + fonts
  await shot('home');
  const itemBox = async n => ev(`(() => { const all = [...document.querySelectorAll('#rfs [data-appid]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 8 && r.height > 8 && r.top >= 0 && r.bottom <= innerHeight; }); const e = all[${+n || 0}]; if (!e) return null; e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 30), appid: e.dataset.appid, n: all.length }; })()`);
  if (opt.search) {
    await ev(`(() => { const i = document.querySelector('#rfs-bar .tb-q'); i.focus(); return true; })()`);
    await S('Input.insertText', { text: opt.search });
    await sleep(500); await shot('search');
  }
  if (opt.hover !== '') {
    const b = await itemBox(opt.hover);
    if (!b) console.log('no visible game item #' + opt.hover);
    else { await mouse('mouseMoved', b.x, b.y); await sleep(60); await shot('hover-60ms'); await sleep(340); await shot('hover-400ms'); }
  }
  if (opt.open !== '') {
    const b = await itemBox(opt.open);
    if (!b) console.log('no visible game item #' + opt.open);
    else {
      await mouse('mouseMoved', b.x, b.y); await mouse('mousePressed', b.x, b.y); await mouse('mouseReleased', b.x, b.y);
      const t0 = Date.now();
      for (const t of [120, 350, 800, 1500]) { await sleep(Math.max(0, t - (Date.now() - t0))); await shot(`open-${t}ms`); }
      console.log('opened:', await ev(`JSON.stringify({ sheet: document.querySelector('#rfs-sheet.on') ? document.querySelector('#rfs-sheet').dataset.layout : null, cdViewer: !!document.querySelector('#rfs-viewer.show'), appid: ${JSON.stringify(b.appid)} })`));
      await S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await S('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await sleep(600); await shot('closed');
    }
  }
  if (opt.key) {
    for (const k of opt.key.split(',')) {
      const vk = { ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, Enter: 13, Escape: 27, Tab: 9 }[k] || 0;
      await S('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k, windowsVirtualKeyCode: vk });
      await S('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: vk });
      await sleep(180);
    }
    await sleep(700); await shot('keys');
  }
  if (opt.eval) console.log('eval:', JSON.stringify(await ev(opt.eval)).slice(0, 6000));
  console.log('steam calls:', JSON.stringify(await ev('__harnessLog')));
} catch (e) {
  console.log('layoutshot failed:', e.message);
} finally {
  console.log(errors.length ? 'PAGE ERRORS:\n  ' + [...new Set(errors)].join('\n  ') : 'no page errors');
  try { await send('Browser.close'); } catch (e) { /* closing */ }
  await sleep(400);
  try { chrome.kill(); } catch (e) { /* gone */ }
  server.close();
  try { rmSync(profile, { recursive: true, force: true }); } catch (e) { /* temp */ }
  process.exit(0);
}
