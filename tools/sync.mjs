// Copies the theme into Steam's Millennium folder and reloads Steam's UI (Steam must run with -dev).
//   node tools/sync.mjs [classic|neon|glass|original|space|material]
import { cpSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from './cdp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEST = 'C:/Program Files (x86)/Steam/millennium/themes/rf-shelf';
const STYLE = { classic: 'Classic Shelf', neon: 'Neon Coverflow', glass: 'Glass Gallery', original: 'Steam Original', space: 'SpaceTheme', material: 'Material You', terminal: 'Terminal', vault: 'RPG Vault', vinyl: 'Vinyl Records', cork: 'Corkboard', arcade: 'Retro Arcade', magazine: 'Magazine', cupertino: 'Cupertino Dark', cyberpunk: 'Cyberpunk', shelter: 'Shelter OS', xmb: 'Crossbar' }[process.argv[2] || ''];

await import('./build.mjs');
rmSync(path.join(DEST, 'src'), { recursive: true, force: true });
cpSync(path.join(ROOT, 'src'), path.join(DEST, 'src'), { recursive: true });
cpSync(path.join(ROOT, 'skin.json'), path.join(DEST, 'skin.json'));
console.log('copied theme →', DEST);

const sj = await connect(/^SharedJSContext$/);
try {
  if (STYLE) {
    const r = await sj.evaluate(`window.MILLENNIUM_API.ffi('core','Core_ChangeCondition')('rf-shelf', ${JSON.stringify(STYLE)}, 'Style')`);
    console.log('style →', STYLE, JSON.stringify(r));
  }
  await sj.evaluate('SteamClient.Browser.RestartJSContext(), true');
} catch (e) { /* the context dies while restarting */ }
sj.close();
// wait for the main window to come back
for (let i = 0; i < 40; i++) {
  await new Promise(r => setTimeout(r, 1000));
  try {
    const list = await (await fetch('http://127.0.0.1:8080/json')).json();
    if (list.some(t => t.title === 'Steam')) { await new Promise(r => setTimeout(r, 3500)); console.log('Steam UI reloaded'); break; }
  } catch (e) { /* not up yet */ }
}
