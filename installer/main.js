'use strict';
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const inst = require('./src/install');

const FAKE = process.env.GS_FAKE === '1';
const EXTERNAL_LINKS = new Set([
  'https://github.com/SteamClientHomebrew/Millennium',
  'https://github.com/SteamClientHomebrew/Millennium/releases',
  'https://steambrew.app',
]);

let win = null;
let busy = false;        // one install/uninstall action at a time
let downloaded = null;   // { zipPath, tag } of a verified Millennium download (never comes from the renderer)

const themeSrc = () => (app.isPackaged ? path.join(process.resourcesPath, 'theme') : path.join(__dirname, '..'));

function previewInfo() {
  const dir = path.join(__dirname, 'assets', 'previews');
  return inst.STYLES.map((s) => ({
    ...s,
    store: fs.existsSync(path.join(dir, `${s.id}-store.jpg`)) ? `../assets/previews/${s.id}-store.jpg` : null,
    library: fs.existsSync(path.join(dir, `${s.id}-library.jpg`)) ? `../assets/previews/${s.id}-library.jpg` : null,
  }));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 1040,
    minHeight: 680,
    frame: false,
    show: false,
    backgroundColor: '#0b0d12',
    title: 'Game Shelf Installer',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  // no navigation, no popups
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.on('maximize', () => send('window', { maximized: true }));
  win.on('unmaximize', () => send('window', { maximized: false }));
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send('gs:event', { channel, ...payload });
}
const log = (step) => (msg) => send('log', { step, msg: String(msg) });

/* every handler: only accepts calls from our own window, returns { ok, ... } or { ok:false, error } */
function handle(name, fn) {
  ipcMain.handle(name, async (event, arg) => {
    if (!win || event.sender !== win.webContents) return { ok: false, error: 'forbidden' };
    try { return { ok: true, ...(await fn(arg)) }; }
    catch (e) { return { ok: false, error: e && e.message ? e.message : String(e), code: e && e.code }; }
  });
}
async function exclusive(fn) {
  if (busy) throw new Error('Another step is still running');
  busy = true;
  try { return await fn(); } finally { busy = false; }
}

handle('gs:info', async () => ({ styles: previewInfo(), fake: FAKE, version: app.getVersion() }));
handle('gs:detect', async () => ({ state: await inst.detect() }));

handle('gs:installMillennium', (phase) => exclusive(async () => {
  const root = await inst.findSteamRoot();
  if (phase === 'download') {
    downloaded = null;
    let last = -1;
    const r = await inst.downloadMillennium({
      log: log('millennium'),
      onProgress: (p) => { const q = Math.floor(p * 100); if (q !== last) { last = q; send('progress', { step: 'millennium', value: p }); } },
    });
    downloaded = r;
    return { tag: r.tag, sha256: r.sha256 };
  }
  if (phase === 'extract') {
    if (!downloaded) throw new Error('Millennium has not been downloaded yet');
    if (await inst.steamRunning()) throw new Error('Steam is still running');
    if (!fs.existsSync(path.join(root, 'steam.exe'))) throw new Error('Steam was not found');
    inst.extractMillennium(downloaded.zipPath, root, { log: log('millennium') });
    try { fs.rmSync(path.dirname(downloaded.zipPath), { recursive: true, force: true }); } catch {}
    downloaded = null;
    return {};
  }
  throw new Error('Invalid phase');
}));

handle('gs:closeSteam', () => exclusive(async () => {
  const root = await inst.findSteamRoot();
  if (await inst.gameRunning()) { const e = new Error('A game is running'); e.code = 'GAME_RUNNING'; throw e; }
  const closed = await inst.closeSteam(root, { log: log('close') });
  if (!closed) { const e = new Error('Steam did not close'); e.code = 'STEAM_STUCK'; throw e; }
  return {};
}));

handle('gs:installTheme', (choice) => exclusive(async () => {
  if (!choice || typeof choice !== 'object') throw new Error('Invalid input');
  const clean = inst.validateChoice({ styles: choice.styles, defaultStyle: choice.defaultStyle, language: choice.language });
  const root = await inst.findSteamRoot();
  if (await inst.steamRunning()) throw new Error('Steam is still running');
  if (FAKE) await new Promise((r) => setTimeout(r, 700));
  const r = await inst.installTheme(root, clean, { themeSrc: themeSrc(), log: log('theme') });
  return { dest: r.dest, defaultStyle: r.defaultStyle };
}));

handle('gs:startSteam', () => exclusive(async () => {
  const root = await inst.findSteamRoot();
  if (await inst.steamRunning()) return { already: true };
  await inst.startSteam(root, { log: log('start') });
  return {};
}));

handle('gs:uninstall', () => exclusive(async () => {
  const root = await inst.findSteamRoot();
  if (FAKE) await new Promise((r) => setTimeout(r, 500));
  await inst.uninstallTheme(root, { log: log('uninstall') });
  return {};
}));

handle('gs:openExternal', async (url) => {
  if (typeof url !== 'string' || !EXTERNAL_LINKS.has(url)) throw new Error('Link not allowed');
  await shell.openExternal(url);
  return {};
});

handle('gs:window', async (action) => {
  if (action === 'minimize') win.minimize();
  else if (action === 'maximize') (win.isMaximized() ? win.unmaximize() : win.maximize());
  else if (action === 'close') win.close();
  else throw new Error('Invalid action');
  return {};
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('web-contents-created', (_e, wc) => {
  wc.on('will-attach-webview', (e) => e.preventDefault());
});
