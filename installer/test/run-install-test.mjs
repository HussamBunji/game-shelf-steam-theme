// Headless test of the install logic against a fake Steam folder. Never touches the real Steam.
//   node test/run-install-test.mjs            full test (downloads Millennium from GitHub into a fake folder)
//   node test/run-install-test.mjs --offline  skip the network part
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const root = path.join(os.tmpdir(), 'gs-fake-steam');
process.env.GS_STEAM_ROOT = root;
process.env.GS_FAKE = '1';
process.env.GS_FAKE_STEAM_RUNNING = '1';

const require = createRequire(import.meta.url);
const inst = require('../src/install.js');
const offline = process.argv.includes('--offline');

let passed = 0, failed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  PASS', name); }
  catch (e) { failed++; console.log('  FAIL', name, '\n      ', (e && e.stack) || e); }
}

function makeFakeSteam(dir, { millennium = true } = {}) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'steam.exe'), '');
  if (!millennium) return;
  fs.mkdirSync(path.join(dir, 'millennium', 'config'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'wsock32.dll'), '');
  fs.writeFileSync(path.join(dir, 'millennium', 'config', 'config.json'),
    '\uFEFF' + JSON.stringify({ general: { x: 1 }, themes: { activeTheme: 'default' } }));
}
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));

console.log('Fake Steam root:', root);
makeFakeSteam(root);

await t('safety: fake root is a temp folder, not the real Steam', () => {
  assert.notEqual(path.resolve(root).toLowerCase(), path.resolve('C:/Program Files (x86)/Steam').toLowerCase());
  assert.ok(root.toLowerCase().startsWith(os.tmpdir().toLowerCase()));
});

await t('config.json starts with a UTF-8 BOM (fixture)', () => {
  const b = fs.readFileSync(path.join(root, 'millennium', 'config', 'config.json'));
  assert.deepEqual([...b.subarray(0, 3)], [0xEF, 0xBB, 0xBF]);
});

await t('detect() finds fake Steam + Millennium, Steam "running", no game', async () => {
  const d = await inst.detect();
  assert.equal(d.root, root);
  assert.equal(d.steamFound, true);
  assert.equal(d.millennium, true);
  assert.equal(d.steamRunning, true);
  assert.equal(d.gameRunning, false);
  assert.equal(d.fake, true);
});

await t('validateChoice rejects bad input', () => {
  assert.throws(() => inst.validateChoice({ styles: [], defaultStyle: 'Terminal', language: 'English' }));
  assert.throws(() => inst.validateChoice({ styles: ['Terminal'], defaultStyle: 'Magazine', language: 'English' }));
  assert.throws(() => inst.validateChoice({ styles: ['Ebony Museum'], defaultStyle: 'Ebony Museum', language: 'English' }));
  assert.throws(() => inst.validateChoice({ styles: ['Terminal'], defaultStyle: 'Terminal', language: 'French' }));
  assert.throws(() => inst.validateChoice({ styles: ['../x'], defaultStyle: '../x', language: 'English' }));
  assert.throws(() => inst.validateChoice({ styles: 'Terminal', defaultStyle: 'Terminal', language: 'English' }));
});

await t('closeSteam (fake) logs instead of closing', async () => {
  const logs = [];
  assert.equal(await inst.closeSteam(root, { log: (m) => logs.push(m) }), true);
  assert.ok(logs.some((l) => l.includes('-shutdown')));
  assert.equal(await inst.steamRunning(), false);
});

const chosen = ['Classic Shelf', 'Terminal', 'Retro Arcade', 'Cupertino Dark', 'Material You'];
await t('installTheme copies files, keeps every style, writes installed.json, updates config.json', async () => {
  const old = path.join(inst.themeDir(root), 'stale.txt'); // must disappear: old folder is removed first
  fs.mkdirSync(path.dirname(old), { recursive: true }); fs.writeFileSync(old, 'x');
  await inst.installTheme(root, { styles: chosen, defaultStyle: 'Terminal', language: 'Arabic' }, { themeSrc: repo });
  const dest = inst.themeDir(root);
  assert.equal(fs.existsSync(old), false, 'old folder removed');
  assert.ok(fs.existsSync(path.join(dest, 'skin.json')));
  assert.ok(fs.existsSync(path.join(dest, 'src', 'js', 'shelf.js')));
  assert.equal(fs.readdirSync(path.join(dest, 'src', 'styles')).length, fs.readdirSync(path.join(repo, 'src', 'styles')).length);
  const raw = fs.readFileSync(path.join(dest, 'skin.json'));
  assert.notEqual(raw[0], 0xEF, 'skin.json has no BOM');
  assert.ok(raw.toString('utf8').startsWith('{\n  "name"'), '2-space indent');
  const skin = JSON.parse(raw.toString('utf8'));
  const repoSkin = readJson(path.join(repo, 'skin.json'));
  assert.deepEqual(Object.keys(skin.Conditions.Style.values), Object.keys(repoSkin.Conditions.Style.values), 'every style kept');
  assert.equal(skin.Conditions.Style.default, 'Terminal');
  const instRaw = fs.readFileSync(path.join(dest, 'src', 'installed.json'));
  assert.notEqual(instRaw[0], 0xEF, 'installed.json has no BOM');
  assert.deepEqual(JSON.parse(instRaw.toString('utf8')), { installed: chosen, default: 'Terminal' });
  assert.ok(skin.Conditions.Language && skin.Conditions.Family, 'other conditions kept');
  assert.equal(skin.name, readJson(path.join(repo, 'skin.json')).name, 'Arabic text intact');
  assert.ok(Object.keys(readJson(path.join(repo, 'skin.json')).Conditions.Style.values).length >= 12, 'repo skin.json untouched');

  const cfgRaw = fs.readFileSync(path.join(root, 'millennium', 'config', 'config.json'));
  assert.notEqual(cfgRaw[0], 0xEF, 'config.json written without BOM');
  const cfg = JSON.parse(cfgRaw.toString('utf8'));
  assert.equal(cfg.general.x, 1, 'user key kept');
  assert.equal(cfg.general.injectCSS, true);
  assert.equal(cfg.general.injectJavascript, true);
  assert.equal(cfg.themes.activeTheme, 'rf-shelf');
  assert.equal(cfg.themes.allowedScripts, true);
  assert.equal(cfg.themes.allowedStyles, true);
  assert.deepEqual(cfg.themes.conditions['rf-shelf'], { Style: 'Terminal', Language: 'Arabic', Family: 'On' });
});

await t('re-install with one style keeps an existing Family choice', async () => {
  const f = path.join(root, 'millennium', 'config', 'config.json');
  const cfg = readJson(f); cfg.themes.conditions['rf-shelf'].Family = 'Off'; fs.writeFileSync(f, JSON.stringify(cfg));
  await inst.installTheme(root, { styles: ['Magazine'], defaultStyle: 'Magazine', language: 'English' }, { themeSrc: repo });
  assert.deepEqual(readJson(f).themes.conditions['rf-shelf'], { Style: 'Magazine', Language: 'English', Family: 'Off' });
  const skin = readJson(path.join(inst.themeDir(root), 'skin.json'));
  assert.equal(skin.Conditions.Style.default, 'Magazine');
  assert.deepEqual(readJson(path.join(inst.themeDir(root), 'src', 'installed.json')), { installed: ['Magazine'], default: 'Magazine' });
});

await t('a selected style missing from this theme build is skipped (default falls back)', async () => {
  const repoValues = Object.keys(readJson(path.join(repo, 'skin.json')).Conditions.Style.values);
  const r = await inst.installTheme(root, { styles: ['Cyberpunk', 'Terminal'], defaultStyle: 'Cyberpunk', language: 'English' }, { themeSrc: repo });
  const skin = readJson(path.join(inst.themeDir(root), 'skin.json'));
  const installed = readJson(path.join(inst.themeDir(root), 'src', 'installed.json'));
  const cfg = readJson(path.join(root, 'millennium', 'config', 'config.json'));
  if (repoValues.includes('Cyberpunk')) {
    assert.deepEqual(installed, { installed: ['Cyberpunk', 'Terminal'], default: 'Cyberpunk' });
    assert.equal(skin.Conditions.Style.default, 'Cyberpunk');
  } else {
    assert.deepEqual(installed, { installed: ['Terminal'], default: 'Terminal' });
    assert.equal(skin.Conditions.Style.default, 'Terminal');
  }
  assert.equal(cfg.themes.conditions['rf-shelf'].Style, r.defaultStyle);
});

await t('startSteam (fake) logs instead of starting', async () => {
  const logs = [];
  await inst.startSteam(root, { log: (m) => logs.push(m) });
  assert.ok(logs.some((l) => l.includes('would start')));
});

await t('uninstallTheme removes the folder and resets activeTheme', async () => {
  await inst.uninstallTheme(root);
  assert.equal(fs.existsSync(inst.themeDir(root)), false);
  const cfg = readJson(path.join(root, 'millennium', 'config', 'config.json'));
  assert.equal(cfg.themes.activeTheme, 'default');
  assert.equal(cfg.general.x, 1);
  assert.ok(fs.existsSync(path.join(root, 'millennium')), 'Millennium stays');
});

if (!offline) {
  const root2 = path.join(os.tmpdir(), 'gs-fake-steam-nomill');
  makeFakeSteam(root2, { millennium: false });
  await t('Millennium: download latest from GitHub, verify SHA-256, extract into a fake root, then install', async () => {
    assert.equal(inst.millenniumInstalled(root2), false);
    let last = 0;
    const r = await inst.downloadMillennium({ onProgress: (p) => { last = p; }, log: (m) => console.log('        ' + m) });
    assert.match(r.sha256, /^[0-9a-f]{64}$/);
    assert.ok(last > 0.99, 'progress reached 100%');
    inst.extractMillennium(r.zipPath, root2);
    assert.equal(inst.millenniumInstalled(root2), true);
    fs.rmSync(path.dirname(r.zipPath), { recursive: true, force: true });
    await inst.installTheme(root2, { styles: ['Glass Gallery'], defaultStyle: 'Glass Gallery', language: 'English' }, { themeSrc: repo });
    assert.equal(readJson(path.join(root2, 'millennium', 'config', 'config.json')).themes.activeTheme, 'rf-shelf');
  });
  await t('Millennium: a wrong checksum is rejected', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, opt) => (String(url).endsWith('.sha256')
      ? new Response('0'.repeat(64) + '  x.zip\n') : realFetch(url, opt));
    try { await assert.rejects(inst.downloadMillennium({}), (e) => e.code === 'SHA_MISMATCH'); }
    finally { globalThis.fetch = realFetch; }
  });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
