'use strict';
/* Install logic for the Game Shelf theme. Pure Node module (no Electron imports) so main.js and the test share it.
   Mirrors install_theme.py at the repo root.

   Env:
     GS_STEAM_ROOT   use this folder as the Steam root instead of the one in the registry
     GS_FAKE=1       never start/close real processes or read the real registry; log instead
                     (GS_FAKE_STEAM_RUNNING=1 / GS_FAKE_GAME=1 simulate a running Steam / game)

   The only programs this module ever starts: <Steam>\steam.exe, tasklist.exe and reg.exe (read-only query). */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');
const { STYLES } = require('./styles');

const THEME_ID = 'rf-shelf';
const MILLENNIUM_API = 'https://api.github.com/repos/SteamClientHomebrew/Millennium/releases/latest';
const DEFAULT_STEAM = 'C:\\Program Files (x86)\\Steam';
const STYLE_VALUES = STYLES.map((s) => s.value);
const LANGS = ['Arabic', 'English'];

const isFake = () => process.env.GS_FAKE === '1';
const fakeState = {
  steamRunning: process.env.GS_FAKE_STEAM_RUNNING === '1',
  game: process.env.GS_FAKE_GAME === '1',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const noop = () => {};

function run(file, args) {
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true, encoding: 'utf8', timeout: 20000 }, (err, stdout) =>
      resolve({ ok: !err, stdout: stdout || '' }));
  });
}

/* ---------- registry (HKCU\Software\Valve\Steam) ---------- */
async function regValue(name) {
  if (process.platform !== 'win32') return null;
  const sysRoot = process.env.SystemRoot || 'C:\\Windows';
  const r = await run(path.join(sysRoot, 'System32', 'reg.exe'), ['query', 'HKCU\\Software\\Valve\\Steam', '/v', name]);
  if (!r.ok) return null;
  const m = r.stdout.match(new RegExp(name + '\\s+REG_\\w+\\s+(.*)', 'i'));
  return m ? m[1].trim() : null;
}

async function findSteamRoot() {
  if (process.env.GS_STEAM_ROOT) return path.resolve(process.env.GS_STEAM_ROOT);
  if (isFake()) return path.join(os.tmpdir(), 'gs-fake-steam'); // fake mode never points at the real Steam
  {
    const p = await regValue('SteamPath');
    if (p) return path.normalize(p);
  }
  return DEFAULT_STEAM;
}

async function gameRunning() {
  if (isFake()) return fakeState.game;
  const v = await regValue('RunningAppID');
  if (!v) return false;
  return (v.startsWith('0x') ? parseInt(v, 16) : parseInt(v, 10)) !== 0;
}

async function steamRunning() {
  if (isFake()) return fakeState.steamRunning;
  const sysRoot = process.env.SystemRoot || 'C:\\Windows';
  const r = await run(path.join(sysRoot, 'System32', 'tasklist.exe'), ['/FI', 'IMAGENAME eq steam.exe', '/NH']);
  return r.stdout.toLowerCase().includes('steam.exe');
}

function millenniumInstalled(root) {
  return fs.existsSync(path.join(root, 'millennium')) && fs.existsSync(path.join(root, 'wsock32.dll'));
}

async function detect() {
  const root = await findSteamRoot();
  const steamFound = fs.existsSync(path.join(root, 'steam.exe'));
  return {
    root,
    steamFound,
    millennium: steamFound && millenniumInstalled(root),
    steamRunning: await steamRunning(),
    gameRunning: await gameRunning(),
    themeInstalled: fs.existsSync(path.join(root, 'millennium', 'themes', THEME_ID, 'skin.json')),
    fake: isFake(),
  };
}

/* ---------- Steam process ---------- */
async function closeSteam(root, { log = noop, timeoutSec = 90 } = {}) {
  if (!(await steamRunning())) { log('steam-not-running'); return true; }
  if (isFake()) {
    log(`[fake] would run: "${path.join(root, 'steam.exe')}" -shutdown`);
    await sleep(600);
    fakeState.steamRunning = false;
    return true;
  }
  const exe = path.join(root, 'steam.exe');
  spawn(exe, ['-shutdown'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  for (let i = 0; i < timeoutSec; i++) {
    await sleep(1000);
    if (!(await steamRunning())) { await sleep(2000); return true; }
  }
  return false;
}

async function startSteam(root, { log = noop } = {}) {
  const exe = path.join(root, 'steam.exe');
  if (isFake()) { log(`[fake] would start: "${exe}"`); fakeState.steamRunning = true; return true; }
  if (!fs.existsSync(exe)) throw new Error('steam.exe not found');
  spawn(exe, [], { detached: true, stdio: 'ignore' }).unref();
  return true;
}

/* ---------- Millennium download / verify / extract ---------- */
const UA = { 'User-Agent': 'GameShelf-Installer/1.0', Accept: 'application/vnd.github+json' };

async function fetchMillenniumRelease() {
  const res = await fetch(MILLENNIUM_API, { headers: UA, redirect: 'follow' });
  if (!res.ok) throw new Error(`GitHub API: HTTP ${res.status}`);
  const rel = await res.json();
  const zip = (rel.assets || []).find((a) => /^millennium-v?[\w.\-]+-windows-x86_64\.zip$/i.test(a.name));
  if (!zip) throw new Error('No Windows build found in the latest Millennium release');
  const base = zip.name.replace(/\.zip$/i, '');
  const sha = rel.assets.find((a) => a.name === base + '.sha256' || a.name === zip.name + '.sha256');
  if (!sha) throw new Error('The release has no .sha256 checksum file');
  const okHost = (u) => /^https:\/\/github\.com\/SteamClientHomebrew\/Millennium\/releases\/download\//.test(u);
  if (!okHost(zip.browser_download_url) || !okHost(sha.browser_download_url)) throw new Error('Unexpected download URL');
  return { tag: rel.tag_name, zip, sha };
}

async function download(url, dest, onProgress = noop) {
  const res = await fetch(url, { headers: { 'User-Agent': UA['User-Agent'] }, redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  const out = fs.createWriteStream(dest);
  const hash = crypto.createHash('sha256');
  let got = 0;
  try {
    for await (const chunk of res.body) {
      hash.update(chunk);
      got += chunk.length;
      if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
      onProgress(total ? got / total : 0, got, total);
    }
  } finally {
    await new Promise((r) => out.end(r));
  }
  return hash.digest('hex');
}

/* Downloads the latest Windows Millennium zip + checksum into a fresh temp folder and verifies it.
   Returns { zipPath, tag, sha256 }. Throws on mismatch (and deletes the bad file). */
async function downloadMillennium({ log = noop, onProgress = noop, tmpDir } = {}) {
  log('millennium-fetch-release');
  const { tag, zip, sha } = await fetchMillenniumRelease();
  log(`Millennium ${tag}: ${zip.name} (${(zip.size / 1048576).toFixed(1)} MB)`);
  const dir = tmpDir || (await fsp.mkdtemp(path.join(os.tmpdir(), 'gs-millennium-')));
  const shaRes = await fetch(sha.browser_download_url, { headers: { 'User-Agent': UA['User-Agent'] }, redirect: 'follow' });
  if (!shaRes.ok) throw new Error(`Checksum download failed: HTTP ${shaRes.status}`);
  const shaText = (await shaRes.text()).trim();
  const expected = (shaText.split(/\s+/)[0] || '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expected)) throw new Error('The checksum file is not valid');
  const zipPath = path.join(dir, zip.name);
  const actual = await download(zip.browser_download_url, zipPath, onProgress);
  if (actual !== expected) {
    await fsp.rm(zipPath, { force: true });
    const e = new Error(`SHA-256 mismatch: expected ${expected}, got ${actual}`);
    e.code = 'SHA_MISMATCH';
    throw e;
  }
  log(`SHA-256 OK ${actual}`);
  return { zipPath, tag, sha256: actual };
}

/* Extracts the Millennium zip (millennium/..., wsock32.dll, ...) into the Steam root, overwriting. */
function extractMillennium(zipPath, root, { log = noop } = {}) {
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(zipPath);
  const rootAbs = path.resolve(root);
  let n = 0;
  for (const e of zip.getEntries()) {
    const target = path.resolve(rootAbs, e.entryName);
    if (target !== rootAbs && !target.startsWith(rootAbs + path.sep)) throw new Error(`Unsafe path in zip: ${e.entryName}`);
    if (e.isDirectory) { fs.mkdirSync(target, { recursive: true }); continue; }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, e.getData());
    n++;
  }
  log(`extracted ${n} files`);
  if (!millenniumInstalled(root)) throw new Error('Millennium files are missing after extraction');
  return n;
}

/* ---------- theme ---------- */
function validateChoice({ styles, defaultStyle, language }) {
  if (!Array.isArray(styles) || styles.length === 0) throw new Error('Select at least one style');
  const uniq = [...new Set(styles)];
  for (const s of uniq) if (!STYLE_VALUES.includes(s)) throw new Error(`Unknown style: ${s}`);
  if (!uniq.includes(defaultStyle)) throw new Error('The default style must be one of the selected styles');
  if (!LANGS.includes(language)) throw new Error(`Unknown language: ${language}`);
  return { styles: uniq, defaultStyle, language };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8' }); // no BOM
}

function setActiveTheme(root, name, cond) {
  const cfg = path.join(root, 'millennium', 'config', 'config.json');
  let data = {};
  if (fs.existsSync(cfg)) {
    try { data = readJson(cfg); } catch { throw new Error('millennium/config/config.json is not valid JSON'); }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
  const themes = (data.themes && typeof data.themes === 'object') ? data.themes : (data.themes = {});
  themes.activeTheme = name;
  if (name === THEME_ID && cond) {
    if (!themes.conditions || typeof themes.conditions !== 'object') themes.conditions = {};
    const c = (themes.conditions[THEME_ID] && typeof themes.conditions[THEME_ID] === 'object') ? themes.conditions[THEME_ID] : {};
    c.Style = cond.style;
    c.Language = cond.language;
    if (!('Family' in c)) c.Family = 'On';
    themes.conditions[THEME_ID] = c;
  }
  themes.allowedScripts = true;
  themes.allowedStyles = true;
  const general = (data.general && typeof data.general === 'object') ? data.general : (data.general = {});
  general.injectCSS = true;
  general.injectJavascript = true;
  writeJson(cfg, data);
  return cfg;
}

function themeDir(root) { return path.join(root, 'millennium', 'themes', THEME_ID); }

async function installTheme(root, choice, { themeSrc, log = noop } = {}) {
  const { styles, defaultStyle, language } = validateChoice(choice);
  if (!themeSrc || !fs.existsSync(path.join(themeSrc, 'skin.json')) || !fs.existsSync(path.join(themeSrc, 'src')))
    throw new Error('Theme files are missing from the installer');
  if (!fs.existsSync(path.join(root, 'millennium'))) throw new Error('Millennium is not installed');
  const dest = themeDir(root);
  if (fs.existsSync(dest)) { log('remove-old'); await fsp.rm(dest, { recursive: true, force: true }); }
  await fsp.mkdir(dest, { recursive: true });
  await fsp.copyFile(path.join(themeSrc, 'skin.json'), path.join(dest, 'skin.json'));
  await fsp.cp(path.join(themeSrc, 'src'), path.join(dest, 'src'), { recursive: true });
  log('copied');

  const skinPath = path.join(dest, 'skin.json');
  const skin = readJson(skinPath);
  const st = skin.Conditions && skin.Conditions.Style;
  if (!st || !st.values) throw new Error('skin.json has no Style condition');
  // every style stays in skin.json; the user's choice goes to src/installed.json, which the theme's picker reads
  // (installed styles show normally, the rest are dimmed with a "Download" badge and can be added later)
  const all = Object.keys(st.values);
  for (const v of styles) if (!all.includes(v)) log(`style "${v}" is not in this theme build; skipped`);
  const kept = styles.filter((v) => all.includes(v));
  if (!kept.length) throw new Error('None of the selected styles are in this theme build');
  const effDefault = kept.includes(defaultStyle) ? defaultStyle : kept[0];
  st.default = effDefault;
  writeJson(skinPath, skin);
  writeJson(path.join(dest, 'src', 'installed.json'), { installed: kept, default: effDefault });

  const cfg = setActiveTheme(root, THEME_ID, { style: effDefault, language });
  log('config-updated');
  return { dest, config: cfg, defaultStyle: effDefault, styles: kept };
}

async function uninstallTheme(root, { log = noop } = {}) {
  const dest = themeDir(root);
  if (fs.existsSync(dest)) await fsp.rm(dest, { recursive: true, force: true });
  log('theme-removed');
  if (fs.existsSync(path.join(root, 'millennium'))) setActiveTheme(root, 'default');
  log('config-updated');
  return true;
}

module.exports = {
  THEME_ID, STYLES, STYLE_VALUES,
  findSteamRoot, detect, steamRunning, gameRunning, millenniumInstalled,
  closeSteam, startSteam,
  fetchMillenniumRelease, downloadMillennium, extractMillennium,
  validateChoice, installTheme, uninstallTheme, setActiveTheme, themeDir,
};
