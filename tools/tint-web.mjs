// Generates src/css/tint-web/ — how the tint styles (src/styles/steam-*.css) recolour the store and
// community pages' LEGACY style sheets: one part per Valve sheet. src/js/tint.js links a part right after the
// sheet it recolours, only on pages that have that sheet (so the part sits at the sheet's own place in the cascade).
//
//   node tools/tint-web.mjs [--dry]        (needs the internet: it reads Valve's public CSS)
//
// Why a generated file: the legacy sheets (store.css, game.css, shared_global.css, globalv2.css …) are served
// without CORS, so a script cannot read or re-tone them the way src/js/tint.js does for Steam's own windows and for
// the React bundles. But their class names are stable, so the recolour can be written down once:
//   • every rule of a sheet that paints with Steam's blue family is repeated in its part with the SAME selector
//     (same specificity — the part comes right after the sheet, so it wins by order and nothing else changes),
//     holding only the colour declarations, each colour replaced by a palette slot: rgb(var(--twN, <Valve's>));
//   • a later Valve rule of equal weight that sets the same kind of property WITHOUT a blue colour is repeated
//     too, unchanged, so it keeps winning exactly as before (e.g. ".x:hover { background: none }");
//   • each palette is one block of slots:  html[data-rfs-tint="<id>"] { --tw0: r, g, b; … }
// The colours come from the same maths as tint.js (its CORE block is evaluated here) and from the --tint-* numbers
// in the style files, so Steam's windows and the store always agree. No hashed class names end up in the file:
// the React bundles (…/applications/…, …/ssr/…) are skipped — tint.js re-tones those at run time.
// Run it again when Valve restyles the store, or after changing / adding a palette.
import { readFileSync, writeFileSync, readdirSync, rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');
const Core = new Function(/\/\*CORE-BEGIN[\s\S]*?\*\/([\s\S]*?)\/\*CORE-END\*\//.exec(readFileSync(path.join(ROOT, 'src/js/tint.js'), 'utf8'))[1] + '; return Core;')();

/* ---- the palettes: every src/styles/*.css that declares --tint-id */
const palettes = [];
for (const f of readdirSync(path.join(ROOT, 'src/styles')).sort()) {
  const css = readFileSync(path.join(ROOT, 'src/styles', f), 'utf8');
  const get = n => (new RegExp(n.replace(/[-]/g, '\\-') + '\\s*:\\s*([^;]+);').exec(css) || [])[1] || '';
  if (get('--tint-id')) palettes.push(Core.palette(get));
}
if (!palettes.length) { console.log('no tint styles found'); process.exit(1); }

/* ---- the pages whose sheets are collected (public pages; logged-out is enough to see which CSS they link) */
const PAGES = [
  'https://store.steampowered.com/', 'https://store.steampowered.com/app/1245620/', 'https://store.steampowered.com/app/730/',
  'https://store.steampowered.com/search/?term=elden', 'https://store.steampowered.com/wishlist/', 'https://store.steampowered.com/cart/',
  'https://store.steampowered.com/explore/', 'https://store.steampowered.com/genre/Free%20to%20Play/', 'https://store.steampowered.com/specials/',
  'https://store.steampowered.com/sub/1/', 'https://store.steampowered.com/bundle/232/', 'https://store.steampowered.com/dlc/1245620/',
  'https://store.steampowered.com/news/', 'https://store.steampowered.com/charts/', 'https://store.steampowered.com/points/shop/',
  'https://store.steampowered.com/login/', 'https://store.steampowered.com/account/', 'https://store.steampowered.com/about/',
  'https://store.steampowered.com/curators/', 'https://store.steampowered.com/tag/browse/', 'https://store.steampowered.com/stats/',
  'https://store.steampowered.com/publisher/Valve', 'https://store.steampowered.com/steamdeck', 'https://store.steampowered.com/recommended/',
  'https://store.steampowered.com/account/preferences/', 'https://store.steampowered.com/labs/', 'https://store.steampowered.com/reviews/',
  'https://steamcommunity.com/', 'https://steamcommunity.com/app/1245620', 'https://steamcommunity.com/app/1245620/discussions/',
  'https://steamcommunity.com/app/1245620/guides/', 'https://steamcommunity.com/app/1245620/reviews/', 'https://steamcommunity.com/app/1245620/screenshots/',
  'https://steamcommunity.com/app/1245620/allnews/', 'https://steamcommunity.com/app/730/workshop/', 'https://steamcommunity.com/workshop/',
  'https://steamcommunity.com/market/', 'https://steamcommunity.com/market/search?appid=730', 'https://steamcommunity.com/discussions/',
  'https://steamcommunity.com/id/gabelogannewell', 'https://steamcommunity.com/id/gabelogannewell/games/?tab=all', 'https://steamcommunity.com/id/gabelogannewell/friends/',
  'https://steamcommunity.com/id/gabelogannewell/badges/', 'https://steamcommunity.com/id/gabelogannewell/inventory/', 'https://steamcommunity.com/id/gabelogannewell/screenshots/',
  'https://steamcommunity.com/id/gabelogannewell/recommended/', 'https://steamcommunity.com/id/gabelogannewell/groups/', 'https://steamcommunity.com/id/gabelogannewell/allcomments',
  'https://steamcommunity.com/groups/Valve', 'https://steamcommunity.com/search/users/', 'https://steamcommunity.com/login/home/',
  'https://steamcommunity.com/sharedfiles/filedetails/?id=2805860256', 'https://steamcommunity.com/stats/1245620/achievements', 'https://steamcommunity.com/my/edit/info',
  'https://help.steampowered.com/en/', 'https://checkout.steampowered.com/checkout/', 'https://steamcommunity.com/chat/',
];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Valve Steam Client/default/1792618285) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.183 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, lang = 'english') {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', Cookie: `Steam_Language=${lang}; birthtime=470703601; lastagecheckage=1-0-1985; wants_mature_content=1` }, redirect: 'follow' });
      if (r.ok) return await r.text();
      if (r.status === 404 || r.status === 403) return '';
    } catch (e) { /* retry */ }
    await sleep(800);
  }
  return '';
}

/* ---- a small CSS reader: rules with their at-rule chain */
function strip(css) { return css.replace(/\/\*[\s\S]*?\*\//g, ''); }
/** → [{ at: ['@media …'], sel, body } | { at, keyframes: '@keyframes x', text }] in source order */
function rules(css) {
  const out = [];
  let i = 0;
  const n = css.length;
  function block(at) {
    let start = i;
    while (i < n) {
      const c = css[i];
      if (c === '"' || c === "'") { i++; while (i < n && css[i] !== c) { if (css[i] === '\\') i++; i++; } i++; continue; }
      if (c === ';') { i++; start = i; continue; }       // a statement at-rule (@import, @charset) or stray
      if (c === '}') { i++; return; }
      if (c === '{') {
        const prelude = css.slice(start, i).trim();
        i++;
        if (/^@(-webkit-)?keyframes/i.test(prelude) || /^@font-face/i.test(prelude) || /^@page/i.test(prelude)) {
          const b0 = i; let depth = 1;
          while (i < n && depth) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; i++; }
          if (/keyframes/i.test(prelude)) out.push({ at, keyframes: prelude, text: css.slice(b0, i - 1) });
        } else if (prelude[0] === '@') { block(at.concat(prelude)); }
        else {
          const b0 = i; let depth = 1;
          while (i < n && depth) {
            const d = css[i];
            if (d === '"' || d === "'") { i++; while (i < n && css[i] !== d) { if (css[i] === '\\') i++; i++; } }
            else if (d === '{') depth++; else if (d === '}') depth--;
            i++;
          }
          out.push({ at, sel: prelude.replace(/\s+/g, ' '), body: css.slice(b0, i - 1) });
        }
        start = i;
        continue;
      }
      i++;
    }
  }
  block([]);
  return out;
}
/** "a: b; c: url(data:x;y)" → [[prop, value], …] */
function decls(body) {
  const out = [];
  let depth = 0, q = '', cur = '';
  for (let k = 0; k <= body.length; k++) {
    const c = body[k];
    if (k === body.length || (c === ';' && !depth && !q)) {
      const j = cur.indexOf(':');
      if (j > 0) out.push([cur.slice(0, j).trim().toLowerCase(), cur.slice(j + 1).trim()]);
      cur = '';
      continue;
    }
    if (q) { if (c === '\\') { cur += c + (body[++k] || ''); continue; } if (c === q) q = ''; }
    else if (c === '"' || c === "'") q = c;
    else if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    cur += c;
  }
  return out;
}
/** which kind of paint a property is (rules only compete inside a kind) */
function kind(p) {
  if (/^background(-color|-image)?$/.test(p)) return 'bg';
  if (p === 'color' || p === '-webkit-text-fill-color' || p === 'caret-color') return 'fg';
  if (/^(border|outline)(-(top|right|bottom|left|inline|block)(-(start|end))?)?(-color)?$/.test(p) || p === 'column-rule' || p === 'column-rule-color') return 'bd';
  if (p === 'box-shadow' || p === 'text-shadow') return 'sh';
  if (p === 'fill' || p === 'stroke') return 'svg';
  if (/^text-decoration(-color)?$/.test(p)) return 'td';
  return '';
}
/** specificity of one complex selector as a comparable number (ids, classes, tags) */
function spec(sel) {
  let s = sel.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, '').replace(/"[^"]*"|'[^']*'/g, '');
  const ids = (s.match(/#[\w-]+/g) || []).length;
  s = s.replace(/#[\w-]+/g, '');
  const cls = (s.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)(?!not\(|is\(|matches\()[\w-]+(\([^)]*\))?/g) || []).length;
  s = s.replace(/\.[\w-]+|\[[^\]]*\]|::?[\w-]+(\([^)]*\))?/g, ' ');
  const tags = (s.match(/(^|[\s>+~(,])[a-z][\w-]*/gi) || []).length + (sel.match(/::[\w-]+/g) || []).length;
  return ids * 10000 + cls * 100 + tags;
}
const splitSel = sel => { const out = []; let d = 0, cur = ''; for (const c of sel) { if (c === '(' || c === '[') d++; else if (c === ')' || c === ']') d--; if (c === ',' && !d) { out.push(cur.trim()); cur = ''; } else cur += c; } if (cur.trim()) out.push(cur.trim()); return out; };

/* ---- a colour of the blue family → its slot.  A probe palette that moves every family colour tells which are in. */
const probe = Core.mapper({ id: 'probe', hue: 20, chroma: 3, chromaMax: 0.2, black: 0.1, aHue: 20, aChroma: 1, aLight: 0.9 });
const slots = new Map(); // "r,g,b" → index
const slotList = [];     // index → [r, g, b]
let used = new Set();    // the slots of the part being written
const slotOf = rgb => { const k = rgb.join(','); if (!slots.has(k)) { slots.set(k, slots.size); slotList.push(rgb); } const i = slots.get(k); used.add(i); return i; };
/** value → [value with slots, how many family colours it had] */
function slotted(value) {
  let n = 0;
  const v = Core.retone(value, probe, (tok, rgb, alpha) => { n++; const i = slotOf(rgb); return alpha && alpha !== '1' ? `rgba(var(--tw${i},${rgb.join(',')}),${alpha})` : `rgb(var(--tw${i},${rgb.join(',')}))`; });
  return [v, n];
}
const absUrls = (value, base) => value.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (m, q, u) => { if (/^(data:|https?:|#|blob:)/i.test(u)) return m; try { return `url(${q}${new URL(u, base).href}${q})`; } catch (e) { return m; } });

/* ---- collect the sheets */
const sheets = new Map(); // key (host class + path) → { url, pages }
for (const page of PAGES) {
  for (const lang of page === PAGES[0] || /app\/1245620\/?$/.test(page) ? ['english', 'arabic'] : ['english']) {
    const htmlText = await get(page, lang);
    const links = [...htmlText.matchAll(/<link\b[^>]*>/gi)].map(m => m[0]).filter(l => /rel=["']?stylesheet/i.test(l)).map(l => (/href=["']([^"']+)["']/i.exec(l) || [])[1]).filter(Boolean).map(h => h.replace(/&amp;/g, '&'));
    let added = 0;
    for (const href of links) {
      let u; try { u = new URL(href, page); } catch (e) { continue; }
      if (!/steamstatic\.com$|steampowered\.com$|steamcommunity\.com$/.test(u.hostname)) continue;
      if (/\/(applications|ssr)\//.test(u.pathname) || /motiva_sans|jquery-ui/.test(u.pathname)) continue; // React bundles (hashed names, CORS-readable): tint.js at run time
      const key = u.hostname.split('.')[0].replace(/^(store|community|shared|cdn)$/, '$1') + u.pathname;
      if (!sheets.has(key)) { sheets.set(key, { url: u.href, pages: [] }); added++; }
      sheets.get(key).pages.push(page);
    }
    console.log(String(links.length).padStart(3), 'sheets,', added, 'new ←', page, lang === 'arabic' ? '(ar)' : '');
    await sleep(350);
  }
}

/* ---- build: one part per Valve sheet (tint.js links a part right after the sheet it recolours, on pages that have it) */
const OUT = path.join(ROOT, 'src/css/tint-web');
const fileOf = key => key.replace(/[^\w.-]+/g, '__');
const maps = palettes.map(P => [P, Core.mapper(P)]);
let nRules = 0, nKept = 0, nPolish = 0, total = 0;
const parts = [];
if (!DRY) { rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true }); }
for (const [key, sh] of sheets) {
  const css = strip(await get(sh.url));
  if (!css) { console.log('  could not read', key); continue; }
  const list = rules(css);
  const blueSpecs = { bg: new Set(), fg: new Set(), bd: new Set(), sh: new Set(), svg: new Set(), td: new Set() }; // weights of the blue rules so far, per kind
  used = new Set();
  let part = '', open = '', n0 = nRules;
  const emit = (at, text) => {
    const a = at.join('{');
    if (a !== open) { if (open) part += '}'.repeat(open.split('{').length) + '\n'; if (a) part += a + '{\n'; open = a; }
    part += text + '\n';
  };
  for (const r of list) {
    if (r.keyframes) {
      const [t, n] = slotted(r.text);
      if (n) { emit(r.at, `${r.keyframes}{${absUrls(t, sh.url).replace(/\s+/g, ' ').trim()}}`); nRules++; }
      continue;
    }
    if (!r.sel || /^\d|^from$|^to$/i.test(r.sel)) continue;
    const specs = splitSel(r.sel).map(spec);
    const keep = [];
    for (const [p, v] of decls(r.body)) {
      const k = kind(p);
      // the "barely there" button polish: Valve's 2px button corner becomes 3px, at the rule's own place in the cascade
      if (p === 'border-radius' && v === '2px' && /\.btn(v6)?_[\w-]+/.test(r.sel)) { keep.push('border-radius:3px'); nPolish++; continue; }
      if (!k && !p.startsWith('--')) continue;
      const [nv, n] = slotted(v);
      if (n) { keep.push(`${p}:${absUrls(nv, sh.url)}`); if (k) specs.forEach(s => blueSpecs[k].add(s)); }
      // not blue itself, but an earlier blue rule of the same weight paints the same kind: repeat it so it still wins
      else if (k && specs.some(s => blueSpecs[k].has(s))) { keep.push(`${p}:${absUrls(v, sh.url)}`); nKept++; }
    }
    if (!keep.length) continue;
    emit(r.at, `${r.sel}{${keep.join(';')}}`);
    nRules++;
  }
  if (open) part += '}'.repeat(open.split('{').length) + '\n';
  if (!used.size) continue;
  let head = `/* GENERATED by tools/tint-web.mjs — the tint styles' recolour of Valve's ${key} (${nRules - n0} rules). Do not edit. */\n`;
  for (const [P, map] of maps) {
    const t = [];
    for (const i of [...used].sort((a, b) => a - b)) { const o = map(...slotList[i]); if (o) t.push(`--tw${i}:${o.join(',')}`); }
    head += `html[data-rfs-tint="${P.id}"]{${t.join(';')}}\n`;
  }
  parts.push(key);
  total += head.length + part.length;
  if (!DRY) writeFileSync(path.join(OUT, fileOf(key)), head + part);
  await sleep(120);
}
console.log(`${parts.length} parts, ${nRules} rules (${nKept} declarations repeated unchanged, ${nPolish} button corners), ${slots.size} colours → ${(total / 1024).toFixed(0)} KB in src/css/tint-web/`);

/* ---- tint.js knows which sheets have a part (so it never asks for a file that is not there) */
if (!DRY) {
  const f = path.join(ROOT, 'src/js/tint.js');
  const js = readFileSync(f, 'utf8');
  const block = `/*PARTS-BEGIN — GENERATED by tools/tint-web.mjs: Valve's sheets that have a part in src/css/tint-web/ */\n  const PARTS = new Set(${JSON.stringify(parts.sort())});\n  /*PARTS-END*/`;
  if (!/\/\*PARTS-BEGIN[\s\S]*?\/\*PARTS-END\*\//.test(js)) { console.log('tint.js has no PARTS block — not updated'); process.exit(1); }
  writeFileSync(f, js.replace(/\/\*PARTS-BEGIN[\s\S]*?\/\*PARTS-END\*\//, () => block));
  console.log('updated the PARTS list in src/js/tint.js');
}
