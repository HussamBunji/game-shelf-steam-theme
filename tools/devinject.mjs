// Injects the current theme files into the running Steam client (no restart needed).
// Requires Steam started with -dev.
//   node tools/devinject.mjs [classic|neon|glass|original]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from './cdp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(path.join(ROOT, p), 'utf8');
const style = process.argv[2] || 'classic';
const css = [read(`src/styles/${style}.css`), read('src/css/shelf.css'), read('src/css/layouts.css')].join('\n');

const steam = await connect(/^Steam$/);
try {
  await steam.evaluate(`(() => {
    let s = document.getElementById('rfs-dev-css');
    if (!s) { s = document.createElement('style'); s.id = 'rfs-dev-css'; document.head.appendChild(s); }
    s.textContent = ${JSON.stringify(css)};
    return true;
  })()`);
  await steam.evaluate(read('src/js/skin.js'));
  await steam.evaluate(read('src/js/shelf.js'));
  const info = await steam.evaluate('JSON.stringify({ shelf: window.__rfsShelf && window.__rfsShelf.version, skinRules: window.__rfsSkin && window.__rfsSkin.rules, missing: window.__rfsSkin && window.__rfsSkin.missing })');
  console.log(`style=${style}`, info);
} finally {
  steam.close();
}
