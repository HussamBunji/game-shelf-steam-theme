/* ===================================================================
   رف الألعاب — Store / Community recolour (runs inside store & community pages)

   Steam's store uses hashed class names that change all the time, so this script
   looks at *colours* instead: every element painted in Steam's blue family is
   classified by lightness (deep background → panels → raised controls → bright
   accent), green buy-buttons become the theme's play colour, blue text becomes
   the theme accent. webkit.css paints the tags with the active theme style.
   =================================================================== */
(function () {
  'use strict';
  if (window.__rfsWebkit) return;
  window.__rfsWebkit = true;

  /* ---- which theme style + language are active?  Millennium only injects the default style into web
     pages, so ask Millennium for the user's choices and switch the variable set / texts ourselves. */
  const STYLE_IDS = { 'Classic Shelf': 'classic', 'Neon Coverflow': 'neon', 'Glass Gallery': 'glass', 'Steam Original': 'original', 'SpaceTheme': 'space', 'Material You': 'material', 'Terminal': 'terminal', 'RPG Vault': 'vault', 'Vinyl Records': 'vinyl', 'Corkboard': 'cork', 'Retro Arcade': 'arcade', 'Magazine': 'magazine', 'Cupertino Dark': 'cupertino', 'Cyberpunk': 'cyberpunk', 'Shelter OS': 'shelter', 'Crossbar': 'xmb', 'Slate': 'slate',
    'Steam OLED Black': 'steam-oled', 'Steam Graphite': 'steam-graphite', 'Steam Midnight': 'steam-midnight', 'Steam Forest': 'steam-forest', 'Steam Wine': 'steam-wine', 'Steam Royal Purple': 'steam-royal', 'Steam Coffee': 'steam-coffee', 'Steam Ocean': 'steam-ocean' };
  // styles that do not use our own store recolour (stock Steam, or a bundled community theme)
  // every style now leaves the store to stock Steam or a community theme base (SpaceTheme / Material);
  // the old colour-classifying recolour below stays in the code but is switched off
  const NATIVE = new Set(['classic', 'neon', 'glass', 'original', 'space', 'material', 'terminal', 'vault', 'vinyl', 'cork', 'arcade', 'magazine', 'slate']);
  const html = document.documentElement;
  /* "Remove Game Shelf" (the Themes window, shelf.js Themes.removeAll): right before the theme is deleted Steam opens
     one store page and one community page with ?rfsclean=1. Each forgets what the theme kept for its site — its
     saved choices and caches, and the store-language cookie it set for Arabic (Steam then uses its own language
     again) — and does nothing else. */
  if (/[?&]rfsclean=1(?:&|$)/.test(location.search)) {
    for (const st of [() => localStorage, () => sessionStorage]) {
      try { const box = st(); for (const k of Object.keys(box)) if (k.startsWith('rfs.')) box.removeItem(k); } catch (e) { /* storage blocked */ }
    }
    try { if (/(?:^|;\s*)Steam_Language=arabic(?:;|$)/.test(document.cookie)) document.cookie = 'Steam_Language=; path=/; max-age=0; secure; samesite=None'; } catch (e) { /* cookies blocked */ }
    return;
  }
  /* tint styles (src/styles/steam-*.css) are Steam Original in another colour: to every rule they ARE "original"
     (so each exception written for Original holds), and the palette is named by html[data-rfs-tint].
     src/js/tint.js recolours the page; it is loaded only while a tint style is on. */
  /* ONE style's rules per page. Until 2026-11 webkit.css imported webkit-styles.css — every style's store rules in one
     1.2 MB file, each scoped html[data-rfs-style="…"]. The browser matches selectors right to left, so on every style
     pass it tried ~3,000 selectors of the OTHER styles against every element before the html test failed: 92 % of all
     selector-matching time on a store page, even under "Steam Original" (measured: home load 1.2 s of main thread
     against 0.44 s without the theme, a scroll pass 0.77 s against 0.19 s). Now tools/build.mjs writes
     src/css/web-styles/<id>.css and only the active one is linked; a switch loads the new one and drops the old. */
  const me0 = document.querySelector('script[src*="/src/js/webkit.js"]');
  const BASE0 = me0 ? me0.src.replace(/src\/js\/webkit\.js.*$/, '') : 'https://millennium.host/v1/themes/rf-shelf/';
  let afterStyle = () => {}; // set below: what reads the style's variables (community base, fonts)
  const styleReady = () => { const all = html.querySelectorAll('link[data-rfs-style-css]'), l = all[all.length - 1]; return !!(l && l.sheet); };
  function styleCss(sid) {
    const links = [...html.querySelectorAll('link[data-rfs-style-css]')], cur = links[links.length - 1];
    if (cur && cur.dataset.rfsStyleCss === sid) return;
    const nl = document.createElement('link');
    nl.rel = 'stylesheet'; nl.href = BASE0 + 'src/css/web-styles/' + sid + '.css'; nl.dataset.rfsStyleCss = sid;
    // the old style's sheet goes only when the new one is in (no unstyled moment on a live switch)
    const done = () => { for (const l of html.querySelectorAll('link[data-rfs-style-css]')) if (l !== nl && l.compareDocumentPosition(nl) & 4) l.remove(); afterStyle(); };
    nl.onload = done; nl.onerror = done;
    (document.head || html).appendChild(nl);
  }
  /* Millennium links this theme's web files several times over on a store page — measured in Steam 2026-11:
     webkit.css ×8, family-on.css ×8, lang/en.css ×4, and the DEFAULT style's whole file (src/styles/classic.css) ×8,
     whatever style is chosen. Each copy is matched against every element on every style pass: with them a store page
     spent 620-1050 ms of style work per scroll pass and froze for 120-400 ms each time the floating store bar slid
     in or out (a change of scroll direction); without them 135-165 ms and no freeze. One copy of each file stays;
     the default style's raw file goes entirely (the chosen style's rules come from web-styles/<id>.css above). */
  function trimSheets() {
    const seen = new Set();
    for (const l of document.querySelectorAll('link[rel="stylesheet"]')) {
      const u = l.href || '';
      if (!u.startsWith(BASE0)) continue;
      const k = u.replace(/[?#].*$/, '');
      if (/\/src\/styles\/[^/]+\.css$/.test(k) || seen.has(k)) l.remove(); else seen.add(k);
    }
  }
  trimSheets();
  document.addEventListener('DOMContentLoaded', trimSheets);
  addEventListener('load', trimSheets);
  [150, 600, 1500].forEach(ms => setTimeout(trimSheets, ms));
  const setStyle = id => {
    const tint = /^steam-/.test(id) ? id : '';
    const sid = tint ? 'original' : id;
    styleCss(sid);
    if (html.getAttribute('data-rfs-style') !== sid) html.setAttribute('data-rfs-style', sid);
    const tintWas = html.getAttribute('data-rfs-tint') || '';
    if (tintWas !== tint) { if (tint) html.setAttribute('data-rfs-tint', tint); else html.removeAttribute('data-rfs-tint'); }
    if (window.__rfsTint) { if (tintWas !== tint) window.__rfsTint.sync(); } // only on a change: this runs every 3 s
    else if (tint && !document.querySelector('script[data-rfs-tint-js]')) {
      const s = document.querySelector('script[src*="/src/js/webkit.js"]');
      const js = document.createElement('script');
      js.src = (s ? s.src.replace(/src\/js\/webkit\.js.*$/, '') : 'https://millennium.host/v1/themes/rf-shelf/') + 'src/js/tint.js';
      js.dataset.rfsTintJs = '1';
      html.appendChild(js);
    }
  };
  let LANG = 'en'; // English by default
  try {
    const c = localStorage.getItem('rfs.style'); if (c) setStyle(c);
    LANG = localStorage.getItem('rfs.lang') || 'en';
  } catch (e) { /* ignore */ }
  html.setAttribute('data-rfs-lang', LANG);
  /** pick the Arabic or English text */
  const T = (ar, en) => (LANG === 'en' ? en : ar);
  const isOriginal = () => NATIVE.has(html.getAttribute('data-rfs-style'));
  const parse = r => (typeof r === 'string' ? JSON.parse(r) : r);
  async function readConditions(api) {
    // 1) live backend config (changes the moment you pick a theme)
    try {
      const cfg = parse(await api.ffi('core', 'Core_GetBackendConfig')());
      const th = cfg && cfg.themes;
      const c = th && th.conditions && th.conditions[th.activeTheme || 'rf-shelf'];
      if (c && c.Style) return c;
    } catch (e) { /* fall through */ }
    // 2) config Millennium started with
    const cfg = parse(await api.ffi('core', 'Core_GetStartConfig')());
    const conds = (cfg && cfg.conditions) || {};
    const act = cfg && cfg.active_theme;
    return conds[(act && act.native) || act] || conds['rf-shelf'] || {};
  }
  /* bundled community theme (src/vendor, MIT): load its store/community files, mapped like its own skin.json */
  const me = document.querySelector('script[src*="/src/js/webkit.js"]');
  const BASE = me ? me.src.replace(/src\/js\/webkit\.js.*$/, '') : 'https://millennium.host/v1/themes/rf-shelf/';
  let vendorOn = '';
  function vendorWeb() {
    // which community theme this style builds on — read from the style's own variables (webkit-styles.css)
    const cs = getComputedStyle(html);
    let id = cs.getPropertyValue('--rf-vendor').trim();
    if (id === 'none') id = '';
    const skip = cs.getPropertyValue('--rf-vendor-skip').trim().split(',').map(x => x.trim()).filter(x => x && x !== 'none');
    const key = id + '|' + skip.join(',');
    if (key === vendorOn) return;
    document.querySelectorAll('link[data-rfs-vendor]').forEach(n => n.remove());
    vendorOn = key;
    if (!id) return;
    const go = () => {
      const man = window.__rfsVendors && window.__rfsVendors[id];
      if (!man || vendorOn !== key) return;
      for (const e of man.web) {
        if (!e.m.some(rx => { try { return new RegExp(rx).test(location.href); } catch (err) { return false; } })) continue;
        if (skip.some(x => ((e.css || '') + '|' + (e.js || '')).includes(x))) continue;
        const base = BASE + 'src/vendor/' + id + '/';
        if (e.css) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = base + e.css; l.dataset.rfsVendor = id; document.head.appendChild(l); }
        if (e.js && !document.querySelector(`script[data-rfs-vendor][src="${base + e.js}"]`)) {
          const sc = document.createElement('script'); sc.type = 'module'; sc.src = base + e.js; sc.dataset.rfsVendor = id; document.head.appendChild(sc);
        }
      }
    };
    if (window.__rfsVendors && window.__rfsVendors[id]) go();
    else { const sc = document.createElement('script'); sc.src = BASE + 'src/vendor/' + id + '/rfs-manifest.js'; sc.onload = go; document.head.appendChild(sc); }
  }

  /* ---- the style's font pair (Latin + Arabic) for every Steam window: --rf-font-ui / --rf-font-gf come from the
     style file. Steam's own fonts have no Arabic letters, so this is what makes an Arabic Steam look right. */
  function applyFonts(getVar) {
    const gf = getVar('--rf-font-gf').replace(/^["']|["']$/g, '').trim();
    if (!gf || !document.head) return;
    // Steam Original (and its colour variants) in English: Steam's own font is already the style's font, and the
    // page-wide font rule below costs a style pass over every element (120-150 ms on a store page) for nothing.
    // In Arabic it stays: Steam's font has no Arabic letters.
    if (html.getAttribute('data-rfs-style') === 'original' && LANG === 'en') {
      for (const id of ['rfs-fonts', 'rfs-font-rule']) { const n = document.getElementById(id); if (n) n.remove(); }
      return;
    }
    let link = document.getElementById('rfs-fonts');
    const href = 'https://fonts.googleapis.com/css2?' + gf + '&display=swap';
    if (!link) { link = document.createElement('link'); link.id = 'rfs-fonts'; link.rel = 'stylesheet'; document.head.appendChild(link); }
    if (link.href !== href) link.href = href;
    if (!document.getElementById('rfs-font-rule')) {
      const st = document.createElement('style');
      st.id = 'rfs-font-rule';
      // :where() keeps this at zero specificity, so icon-font rules (more specific + !important) still win
      st.textContent = ':where(body, body *:not(svg, svg *)) { font-family: var(--rf-font-ui) !important; }';
      document.head.appendChild(st);
    }
  }
  /* the store and community have an official Arabic version — follow the theme language (once per page, never loops) */
  function storeLanguage() {
    const cur = (/(?:^|; )Steam_Language=([^;]+)/.exec(document.cookie) || [])[1] || '';
    const want = LANG === 'ar' ? 'arabic' : (cur === 'arabic' ? 'english' : '');
    if (!want || cur === want) return;
    const flag = 'rfs.storeLang.' + want + '.' + location.pathname;
    try { if (sessionStorage.getItem(flag)) return; sessionStorage.setItem(flag, '1'); } catch (e) { return; }
    // set the store's own language cookie and reload *this* page (Steam's ChangeLanguage() jumps to the account page)
    document.cookie = `Steam_Language=${want}; path=/; max-age=31536000; secure; samesite=None`;
    location.reload();
  }
  let onLangChange = () => {}, syncedOnce = false;
  afterStyle = () => { vendorWeb(); applyFonts(n => getComputedStyle(html).getPropertyValue(n)); };
  async function syncStyle() {
    const api = window.MILLENNIUM_API;
    if (!api || !api.ffi) return false;
    try {
      trimSheets();
      const c = await readConditions(api);
      const id = STYLE_IDS[c.Style] || 'classic';
      const lang = c.Language === 'Arabic' ? 'ar' : 'en';
      const was = html.getAttribute('data-rfs-style');
      setStyle(id);
      const langWas = LANG;
      if (lang !== LANG) { LANG = lang; html.setAttribute('data-rfs-lang', lang); }
      // the community base and the fonts come from the style's variables: read now if its sheet is in, else when it
      // arrives (afterStyle); and only when the style or the language changed, not on every 3 s look
      if (styleReady() && (was !== html.getAttribute('data-rfs-style') || langWas !== lang || !syncedOnce)) { syncedOnce = true; afterStyle(); }
      storeLanguage();
      if (langWas !== lang) onLangChange();
      const fam = c.Family !== 'Off'; // Family mode: the button next to the user name sets it (shelf.js)
      if (fam !== safeOn) { safeOn = fam; filterAdult(); }
      try { localStorage.setItem('rfs.style', id); localStorage.setItem('rfs.lang', lang); } catch (e) { /* ignore */ }
      return true;
    } catch (e) { return false; }
  }
  // Millennium's bridge isn't always ready when the page starts — retry quickly until it answers
  (async () => { for (let i = 0; i < 40; i++) { if (await syncStyle()) break; await new Promise(r => setTimeout(r, 500)); } })();
  // pages that stay open (store, wishlist…) follow a theme / language switch without a reload
  setInterval(syncStyle, 3000); // a Family mode / theme switch from the user box shows here within 3 s, no reload
  document.addEventListener('visibilitychange', syncStyle);
  window.addEventListener('focus', syncStyle);

  function rgba(s) {
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(s || '');
    return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : null;
  }
  function hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  }
  const isBlue = (h, s) => h >= 185 && h <= 235 && s >= 0.08;
  const isGreen = (h, s, l) => h >= 65 && h <= 135 && s >= 0.35 && l >= 0.18 && l <= 0.62;

  /** classify a background colour → tag (or '') */
  function bgTag(c) {
    if (!c || c[3] < 0.05) return '';
    const [h, s, l] = hsl(c[0], c[1], c[2]);
    if (isGreen(h, s, l)) return 'go';
    if (!isBlue(h, s)) return '';
    if (c[3] < 0.6) return 'tint';
    if (s > 0.5 && l > 0.38 && l < 0.75) return 'acc';
    if (l < 0.105) return 'bg0';
    if (l < 0.16) return 'bg1';
    if (l < 0.24) return 'bg2';
    if (l < 0.5) return 'bg3';
    return 'tint';
  }

  const seen = new WeakSet();
  function tag(el) {
    if (el.nodeType !== 1 || seen.has(el) || isOriginal()) return; // "Steam Original": leave the store's colours alone
    seen.add(el);
    const tn = el.tagName;
    if (tn === 'IMG' || tn === 'VIDEO' || tn === 'svg' || tn === 'path' || tn === 'SCRIPT' || tn === 'STYLE') return;
    if (el.closest('#rfs-rail, #rfs-data, #rfs-qmenu, #rfs-qbtn, #rfs-ic-defs')) return; // our own panels are styled by webkit.css already
    const cs = getComputedStyle(el);
    let t = bgTag(rgba(cs.backgroundColor));
    const img = cs.backgroundImage;
    if (!t && img && img !== 'none' && !img.includes('url(') && /gradient/.test(img)) {
      const c = rgba(img);
      const bt = bgTag(c);
      if (bt === 'go') t = 'go';
      else if (bt) t = c[3] < 0.7 ? 'cardT' : 'card';
    }
    if (t) {
      el.setAttribute('data-rfs', t);
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.width < innerWidth * 0.85 && r.height < 420 && t !== 'bg0') el.setAttribute('data-rfs-r', '');
    }
    const fc = rgba(cs.color);
    if (fc) { const [h, s, l] = hsl(fc[0], fc[1], fc[2]); if (isBlue(h, s) && s > 0.3 && l > 0.5) el.setAttribute('data-rfs-c', 'acc'); }
    const bc = rgba(cs.borderTopColor);
    if (bc && bc[3] > 0.2 && cs.borderTopWidth !== '0px') { const [h, s] = hsl(bc[0], bc[1], bc[2]); if (isBlue(h, s)) el.setAttribute('data-rfs-b', ''); }
  }

  let queue = [], scheduled = false;
  function flush(deadline) {
    scheduled = false;
    const t0 = performance.now();
    while (queue.length && (deadline && deadline.timeRemaining ? deadline.timeRemaining() > 2 : performance.now() - t0 < 12)) {
      const n = queue.shift();
      if (!n.isConnected) continue;
      tag(n);
      const all = n.getElementsByTagName('*');
      for (let i = 0; i < all.length; i++) tag(all[i]);
    }
    if (queue.length) schedule();
  }
  function retag() { queue.push(document.body); schedule(); }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    (window.requestIdleCallback || (f => setTimeout(f, 30)))(flush, { timeout: 300 });
  }
  /* ---- usability: keep the store navigation bar (Browse · Recommendations · search · Wishlist) on screen */
  function stickyNav() {
    const search = document.querySelector('input[name="term"][role="combobox"], input[placeholder*="Search the store" i], #store_nav_search_term');
    if (!search) return;
    let bar = search, best = null;
    while (bar && bar !== document.body) {
      const r = bar.getBoundingClientRect();
      if (r.width > innerWidth * 0.6 && r.height < 120) best = bar;
      bar = bar.parentElement;
    }
    if (best && !best.hasAttribute('data-rfs-sticky')) best.setAttribute('data-rfs-sticky', '');
  }

  /* ---- side rail: uses the empty space beside the store's centre column (normal PC sizes, never zoom).
     Quick links that Steam hides inside dropdowns + on game pages: price / buy / play / wishlist and
     jump links to the page's sections. Only shown when there is real free space, so it never covers content. */
  /* ---- theme icon set (inline SVG, 24px grid; no emoji anywhere).  Colours come from icons.css:
     strokes use the theme's gradient (#rfs-ic-grad), class "f" = soft duotone fill, class "s" = solid part.
     KEEP IN SYNC: the same map lives in shelf.js and webkit.js. */
  const IC = {
    search: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21"/>',
    library: '<path class="f" d="M4 19V5a1 1 0 0 1 1-1h3v16H5a1 1 0 0 1-1-1Z"/><path d="M8 4h4v16H8"/><path class="f" d="m14.6 5.2 3.4-.9 3 14.6-3.4.9Z"/>',
    sort: '<path d="M7 20V4M3 8l4-4 4 4"/><path d="M17 4v16M13 16l4 4 4-4"/>',
    tag: '<path class="f" d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9Z"/><circle class="s" cx="7.5" cy="7.5" r="1.5"/>',
    spines: '<path class="f" d="M5 4h3v16H5zM10 4h3v16h-3z"/><path class="f" d="m15.5 5 2.8-.8 3.2 15-2.8.8Z"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/>',
    rows: '<rect x="3.5" y="4.5" width="17" height="4" rx="1"/><rect x="3.5" y="10" width="17" height="4" rx="1"/><rect x="3.5" y="15.5" width="17" height="4" rx="1"/>',
    news: '<path class="f" d="M4 5h13v14H6a2 2 0 0 1-2-2Z"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M7.5 9h6M7.5 12.5h6M7.5 16h4"/>',
    volume: '<path class="f" d="M4 10v4h4l5 4V6l-5 4Z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/>',
    mute: '<path class="f" d="M4 10v4h4l5 4V6l-5 4Z"/><path d="m17 9.5 5 5M22 9.5l-5 5"/>',
    palette: '<path class="f" d="M12 3a9 9 0 1 0 0 18c1.2 0 1.6-.8 1.6-1.6 0-1.3-1.1-1.6-1.1-2.9 0-1 .8-1.6 1.9-1.6H17a4 4 0 0 0 4-4c0-4.4-4-7.9-9-7.9Z"/><circle class="s" cx="7.5" cy="11" r="1.3"/><circle class="s" cx="10" cy="7" r="1.3"/><circle class="s" cx="15" cy="7.2" r="1.3"/>',
    undo: '<path d="M4 5v5h5"/><path d="M4.6 15A8 8 0 1 0 6.3 7L4 10"/>',
    play: '<path class="s" d="M7.5 4.8v14.4L19 12Z"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    disc: '<circle cx="12" cy="12" r="9"/><circle class="s" cx="12" cy="12" r="2.4"/><path d="M12 5.5A6.5 6.5 0 0 1 18.5 12"/>',
    cart: '<path class="f" d="M3 4h2.2l2.1 11.2h11L20 7H6.3"/><circle class="s" cx="9" cy="19.5" r="1.4"/><circle class="s" cx="17" cy="19.5" r="1.4"/>',
    star: '<path class="f" d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>',
    starOn: '<path class="s" d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6.3 6.5-6.3s6.5 2.7 6.5 6.3"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.3 14c1.9.8 3.2 2.9 3.2 6"/>',
    online: '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20c0-3.6 2.9-6.3 6.5-6.3 1.6 0 3 .5 4.2 1.4"/><circle class="s" cx="18" cy="17.5" r="3"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle class="s" cx="8.5" cy="10" r="1.6"/><path d="m21 16-5-5-8.5 8"/>',
    sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.4L4 8"/><path d="M4 3.5V8h4.5"/><path d="M4 13a8 8 0 0 0 14.6 4.4L20 16"/><path d="M20 20.5V16h-4.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
    drive: '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M6.5 12h6"/><circle class="s" cx="17" cy="12" r="1"/>',
    fire: '<path class="f" d="M12 21c-3.9 0-7-2.8-7-6.6 0-3.1 2.2-5 3.4-7.4.4 1.6 1.4 2.6 2.4 3C11.2 6.8 13 4.4 15.2 3c-.3 2.3.5 4 1.8 5.7 1.3 1.6 2 3.3 2 5.7 0 3.8-3.1 6.6-7 6.6Z"/><path d="M12 18c-1.4 0-2.5-1-2.5-2.4 0-1.2.9-2 1.6-3 .6 1 2.1 1.6 2.9 3 .6 1.2-.4 2.4-2 2.4Z"/>',
    pulse: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    owned: '<circle cx="12" cy="12" r="9"/><path d="m7.8 12.3 2.9 2.9 5.5-6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    chevL: '<path d="m15 5-7 7 7 7"/>',
    chevR: '<path d="m9 5 7 7-7 7"/>',
    chevD: '<path d="m6 9 6 6 6-6"/>',
    home: '<path d="M4 11 12 4l8 7"/><path class="f" d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>',
    gamepad: '<path class="f" d="M7 8h10a5 5 0 0 1 5 5v1.5a3 3 0 0 1-5.4 1.8L15.3 15H8.7l-1.3 1.3A3 3 0 0 1 2 14.5V13a5 5 0 0 1 5-5Z"/><path d="M8 10.8v3.4M6.3 12.5h3.4"/><circle class="s" cx="15.5" cy="11.8" r="1"/><circle class="s" cx="17.8" cy="13.6" r="1"/>',
    percent: '<path class="f" d="m12 2.8 2.3 1.7 2.8-.1.9 2.7 2.3 1.6-.9 2.7.9 2.7-2.3 1.6-.9 2.7-2.8-.1L12 21.2l-2.3-1.7-2.8.1-.9-2.7-2.3-1.6.9-2.7-.9-2.7 2.3-1.6.9-2.7 2.8.1Z"/><path d="m9 15 6-6"/><circle class="s" cx="9.4" cy="9.4" r="1.1"/><circle class="s" cx="14.6" cy="14.6" r="1.1"/>',
    trend: '<path d="M3 17.5 9 11.5l4 4 8-8"/><path d="M15 7.5h6v6"/>',
    sparkle: '<path class="f" d="M11 3c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7Z"/><path d="M19 15.5v5M16.5 18h5"/>',
    hourglass: '<path d="M6.5 3h11M6.5 21h11"/><path class="f" d="M8 3c0 4.2 4 5 4 9s-4 4.8-4 9h8c0-4.2-4-5-4-9s4-4.8 4-9"/>',
    ticket: '<path class="f" d="M3 8.5A2.5 2.5 0 0 0 5.5 6h13A2.5 2.5 0 0 0 21 8.5v7a2.5 2.5 0 0 0-2.5 2.5h-13A2.5 2.5 0 0 0 3 15.5Z"/><path d="M14.5 6.5v1.6M14.5 11.2v1.6M14.5 15.9v1.6"/>',
    filter: '<path class="f" d="M4 5h16l-6.2 7.6V19l-3.6 1.6v-8Z"/>',
    shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6Z"/><path d="m8.5 12 2.4 2.4 4.6-4.8"/>',
    gift: '<rect x="3.5" y="8" width="17" height="4.2" rx="1"/><path d="M5 12.2V20h14v-7.8M12 8v12"/><path d="M12 8C10.6 4.6 6.5 4 6.5 6.4 6.5 7.6 8.6 8 12 8Zm0 0c1.4-3.4 5.5-4 5.5-1.6 0 1.2-2.1 1.6-5.5 1.6Z"/>',
    receipt: '<path class="f" d="M6 3h12v18l-3-2-3 2-3-2-3 2Z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"/>',
    chart: '<path d="M4 20h16"/><rect x="5.5" y="11" width="3" height="6.5" rx=".6"/><rect x="10.5" y="5.5" width="3" height="12" rx=".6"/><rect x="15.5" y="13.5" width="3" height="4" rx=".6"/>',
    db: '<ellipse cx="12" cy="6" rx="7.5" ry="2.8"/><path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6"/><path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
    coins: '<ellipse cx="9" cy="7" rx="5.5" ry="2.5"/><path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5M3.5 11v4c0 1.4 2.5 2.5 5.5 2.5"/><ellipse cx="15" cy="13.5" rx="5.5" ry="2.5"/><path d="M9.5 13.5v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.8M9.5 2.8h5M18.6 6.4l-1.3 1.3"/>',
    trophy: '<path class="f" d="M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v3M8.5 20.5h7M9.5 20.5c0-2 1-3.5 2.5-3.5s2.5 1.5 2.5 3.5"/>',
    jump: '<path d="M19 4v7a3 3 0 0 1-3 3H5"/><path d="m9 10-4 4 4 4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle class="s" cx="12" cy="7.8" r="1.1"/>',
    puzzle: '<path class="f" d="M5 5h4a2 2 0 1 1 4 0h4v4a2 2 0 1 1 0 4v4h-4a2 2 0 1 0-4 0H5v-4a2 2 0 1 0 0-4Z"/>',
    cpu: '<rect x="6" y="6" width="12" height="12" rx="1.5"/><path d="M9.5 9.5h5v5h-5zM9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
    msg: '<path class="f" d="M4 5h16v11H9.5L4 20Z"/><path d="M8 9.5h8M8 12.5h5"/>',
    layers: '<path class="f" d="m12 3 9 5-9 5-9-5Z"/><path d="m3 12.5 9 5 9-5"/><path d="m3 16.5 9 5 9-5" opacity=".55"/>',
    medal: '<circle cx="12" cy="14.5" r="5.5"/><path d="M8.5 10 6 3h4l2 4.5L14 3h4l-2.5 7"/><path class="s" d="m12 11.8.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3Z"/>',
    more: '<circle class="s" cx="5" cy="12" r="1.7"/><circle class="s" cx="12" cy="12" r="1.7"/><circle class="s" cx="19" cy="12" r="1.7"/>',
    folder: '<path class="f" d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.2h7.5A2.5 2.5 0 0 1 21 9.7v7.8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5Z"/><path d="M3 10h18"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7"/><path class="f" d="m6 7 1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M10 11v6M14 11v6"/>',
    eye: '<path class="f" d="M2 12c1.2-2.8 5-7 10-7s8.8 4.2 10 7c-1.2 2.8-5 7-10 7S3.2 14.8 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1Q11.3 5 12 5c5 0 8.8 4.2 10 7a13 13 0 0 1-3.1 4.3M6.6 6.6C4.4 8 2.8 10.2 2 12c1.2 2.8 5 7 10 7a10 10 0 0 0 4.4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    monitor: '<rect class="f" x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
  };
  const ic = (n, cls = '') => `<svg class="rf-ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ''}</svg>`;
  /** icon inside a themed tile (brass medallion / neon frame / frosted glass / gilded frame) */
  const icT = (n, cls = '') => `<span class="rf-ict${cls ? ' ' + cls : ''}">${ic(n)}</span>`;
  /** one hidden <defs> per document: the gradients every icon stroke points at (colours = theme variables) */
  function iconDefs() {
    if (document.getElementById('rfs-ic-defs') || !document.body) return;
    const d = document.createElement('div');
    d.id = 'rfs-ic-defs';
    d.setAttribute('aria-hidden', 'true');
    d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
    d.innerHTML = '<svg width="0" height="0"><defs>'
      + '<linearGradient id="rfs-ic-grad" gradientUnits="userSpaceOnUse" x1="3" y1="3" x2="21" y2="21"><stop offset="0" class="a"/><stop offset="1" class="b"/></linearGradient>'
      + '<linearGradient id="rfs-ict-grad" gradientUnits="userSpaceOnUse" x1="3" y1="3" x2="21" y2="21"><stop offset="0" class="a"/><stop offset="1" class="b"/></linearGradient>'
      + '</defs></svg>';
    document.body.appendChild(d);
  }

  const S = 'https://store.steampowered.com';
  const LINKS = () => [
    [T('تصفح', 'Browse'), [['percent', T('العروض والخصومات', 'Specials'), S + '/specials'], ['trend', T('الأكثر مبيعًا', 'Top Sellers'), S + '/charts/topselling/global'], ['sparkle', T('الجديد والرائج', 'New & Trending'), S + '/explore/new/'],
      ['hourglass', T('قادم قريبًا', 'Upcoming'), S + '/explore/upcoming/'], ['ticket', T('ألعاب مجانية', 'Free to Play'), S + '/genre/Free%20to%20Play/'], ['filter', T('البحث المتقدم', 'Advanced Search'), S + '/search/']]],
    [T('حسابي', 'My Account'), [['star', T('قائمة الأمنيات', 'Wishlist'), S + '/wishlist/'], ['cart', T('السلة', 'Cart'), S + '/cart/'], ['receipt', T('سجل المشتريات', 'Purchase History'), S + '/account/history/'],
      ['gift', T('متجر النقاط', 'Points Shop'), S + '/points/shop/'], ['gift', T('بطاقات الهدايا', 'Gift Cards'), S + '/digitalgiftcards/'],
      ['shield', T('إعدادات المحتوى في ستيم', 'Steam content settings'), S + '/account/preferences/']]],
  ];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const qs = s => document.querySelector(s);
  /** write a style only when it changes (each write is a DOM change that re-runs page-wide :has() rules) */
  const setStyles = (el, props) => { for (const k in props) if (el.style[k] !== props[k]) el.style[k] = props[k]; };
  let rail = null, column = null;
  function findColumn() {
    const W = innerWidth;
    let best = null;
    for (const el of document.querySelectorAll('#game_highlights, .page_content, .home_page_content, .personal_calendar_ctn, .page_content_ctn, .responsive_page_template_content > div, body > div div')) {
      const r = el.getBoundingClientRect();
      if (r.height < 300 || r.width < 600 || r.width > W * 0.85) continue;
      if (Math.abs((r.left + r.right) / 2 - W / 2) > 40) continue;
      if (!best || r.width > best.getBoundingClientRect().width) best = el;
    }
    return best;
  }
  function appContext() {
    const m = /\/app\/(\d+)/.exec(location.pathname);
    if (!m || !/store\.steampowered\.com/.test(location.host)) return null;
    const id = m[1];
    const name = (qs('#appHubAppName, .apphub_AppName') || {}).textContent || '';
    const img = (qs('.game_header_image_full') || {}).src || '';
    const owned = !!qs('.game_area_already_owned');
    const firstBuy = qs('#game_area_purchase .game_area_purchase_game');
    const price = firstBuy ? ((firstBuy.querySelector('.discount_final_price, .game_purchase_price') || {}).textContent || '').trim() : '';
    const disc = firstBuy ? ((firstBuy.querySelector('.discount_pct') || {}).textContent || '').trim() : '';
    const sections = [
      [T('عن اللعبة', 'About'), '#game_area_description, #aboutThisGame', 'info'],
      [T('الشراء', 'Buy'), '#game_area_purchase', 'cart'],
      [T('المحتوى الإضافي', 'DLC'), '#gameAreaDLCSection', 'puzzle'],
      [T('متطلبات التشغيل', 'System Requirements'), '.sysreq_section, #game_area_sys_req', 'cpu'],
      [T('التقييمات', 'Reviews'), '#app_reviews_hash, #userReviews', 'msg'],
      [T('ألعاب مشابهة', 'More Like This'), '#recommended_block, .recommendation_area_ctn', 'layers'],
    ].filter(([, s]) => qs(s));
    return { id, name: name.trim(), img, owned, price, disc, sections };
  }
  function renderRail() {
    const app = appContext();
    let html = '';
    if (app) {
      const wl = qs('#add_to_wishlist_area_success');
      const inWishlist = wl && wl.offsetParent !== null;
      html += `<section class="rr-app">
        ${app.img ? `<img src="${esc(app.img)}" alt="">` : ''}
        <b dir="auto">${esc(app.name)}</b>
        ${app.owned ? `<span class="rr-own rf-mono">${ic('owned')}${T('موجودة في مكتبتك', 'In your library')}</span>` : app.price ? `<span class="rr-price">${app.disc ? `<i>${esc(app.disc)}</i>` : ''}${esc(app.price)}</span>` : ''}
        <div class="rr-acts">
          ${app.owned
            ? `<a class="rr-btn go" href="steam://run/${app.id}">${ic('play')}${T('شغّل', 'Play')}</a><a class="rr-btn" href="steam://nav/games/details/${app.id}">${ic('library')}${T('في مكتبتي', 'Open in Library')}</a>`
            : `<button class="rr-btn go" data-act="cart">${ic('cart')}${T('أضف للسلة', 'Add to Cart')}</button>`}
          ${app.owned ? '' : `<button class="rr-btn${inWishlist ? ' on' : ''}" data-act="wish">${inWishlist ? ic('starOn') + T('في الأمنيات', 'On Wishlist') : ic('star') + T('أضف للأمنيات', 'Add to Wishlist')}</button>`}
          <a class="rr-btn" href="https://steamcommunity.com/app/${app.id}">${ic('users')}${T('المجتمع', 'Community Hub')}</a>
        </div>
      </section>`;
      if (app.sections.length) {
        html += `<section><h4>${T('انتقل إلى', 'Jump to')}</h4>${app.sections.map(([t, s, n]) => `<button class="rr-link" data-jump="${esc(s)}">${icT(n)}${esc(t)}</button>`).join('')}</section>`;
      }
    }
    rail.innerHTML = html; // game pages only — Browse / My account live in the header's Quick links menu
  }
  function placeRail() {
    if (!document.body) return;
    if (!column || !column.isConnected) column = findColumn();
    const free = column ? column.getBoundingClientRect().left : 0;
    // below the store's top bar (the sticky wrapper itself can be 0px tall, so also measure the search box in it)
    const navBits = [qs('[data-rfs-sticky]'), qs('input[name="term"][role="combobox"], input[placeholder*="Search the store" i], #store_nav_search_term')].filter(Boolean);
    const navBottom = navBits.length ? Math.max(...navBits.map(e => e.getBoundingClientRect().bottom)) : 0;
    const top = navBottom > 0 ? Math.round(navBottom + 16) : 70;
    const fits = free >= 300;
    if (!rail) {
      rail = document.createElement('aside');
      rail.id = 'rfs-rail';
      rail.addEventListener('click', e => {
        const j = e.target.closest('[data-jump]');
        if (j) {
          const t = qs(j.dataset.jump);
          if (t) { const y = t.getBoundingClientRect().top + scrollY - top - 10; window.scrollTo({ top: y, behavior: 'smooth' }); }
          return;
        }
        const a = e.target.closest('[data-act]');
        if (!a) return;
        if (a.dataset.act === 'cart') {
          const btn = qs('#game_area_purchase .btn_addtocart a, #game_area_purchase .btn_addtocart, #game_area_purchase a.btn_green_steamui');
          if (btn) btn.click(); else { const t = qs('#game_area_purchase'); if (t) t.scrollIntoView({ behavior: 'smooth' }); }
        } else if (a.dataset.act === 'wish') {
          const b = qs('#add_to_wishlist_area a, #add_to_wishlist_area_success a, .queue_btn_wishlist');
          if (b) { b.click(); setTimeout(renderRail, 900); }
        }
      });
      document.body.appendChild(rail);
      renderRail();
    }
    setStyles(rail, { top: top + 'px' });
    // docked right next to the store column (not at the window edge), so the eye doesn't travel
    setStyles(rail, { left: Math.max(12, Math.round(free - 236 - 18)) + 'px' });
    rail.classList.toggle('on', fits && !!rail.firstElementChild);
    placeData(top);
    placeQuick();
  }

  /* ---- Quick links: one button in the store header, left of the search, opens Browse / My account —
     nothing floats over the page and the page gets no taller */
  let qbtn = null, qmenu = null, qLang = '';
  function renderQuick() {
    qmenu.innerHTML = LINKS().map(([title, items]) => `<section><h4>${esc(title)}</h4>${items.map(([n, t, href]) =>
      `<a class="ql${location.href.startsWith(href) ? ' cur' : ''}" href="${esc(href)}">${icT(n)}<span>${esc(t)}</span></a>`).join('')}</section>`).join('');
  }
  /* where the button sits relative to the search box, worked out once (three hit tests + a few forced layouts):
     while the page scrolls the box only moves up and down, so the button follows it with one measurement a frame */
  let qPlace = null;
  function placeQuick(follow) {
    if (!/store\.steampowered\.com/.test(location.host) || !document.body) return;
    if (follow === true && qPlace && qbtn && qPlace.box.isConnected && qLang === LANG && !qmenu.classList.contains('on')) {
      const r = qPlace.box.getBoundingClientRect();
      if (Math.abs(r.left - qPlace.left) < 1 && Math.abs(r.width - qPlace.width) < 1) {
        if (!r.width || r.bottom < 0 || r.top > innerHeight) { qbtn.classList.toggle('on', false); return; }
        qbtn.classList.toggle('on', true);
        setStyles(qbtn, { top: Math.round(r.top + qPlace.dy) + 'px', left: qPlace.x + 'px' });
        return;
      }
    }
    if (!qbtn) {
      qbtn = document.createElement('button');
      qbtn.id = 'rfs-qbtn'; qbtn.type = 'button';
      qmenu = document.createElement('div');
      qmenu.id = 'rfs-qmenu';
      qbtn.addEventListener('click', e => { e.stopPropagation(); if (!qmenu.classList.contains('on')) renderQuick(); qmenu.classList.toggle('on'); placeQuick(); });
      document.addEventListener('click', e => { if (qmenu.classList.contains('on') && !qmenu.contains(e.target)) qmenu.classList.remove('on'); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') qmenu.classList.remove('on'); });
      // scrolling: at most once per frame, and only the cheap follow (see qPlace below)
      let qFrame = 0;
      addEventListener('scroll', () => { if (qFrame) return; qFrame = requestAnimationFrame(() => { qFrame = 0; placeQuick(true); }); }, { passive: true });
      addEventListener('resize', () => { qPlace = null; }, { passive: true });
      document.body.append(qbtn, qmenu);
    }
    if (qLang !== LANG) {
      qLang = LANG;
      qbtn.innerHTML = `${ic('grid')}<span>${T('روابط سريعة', 'Quick links')}</span>${ic('chevD', 'dd')}`;
      qbtn.title = T('العروض، الأكثر مبيعًا، الأمنيات، السلة…', 'Specials, top sellers, wishlist, cart…');
      qmenu.dir = LANG === 'ar' ? 'rtl' : 'ltr';
    }
    const search = qs('input[name="term"][role="combobox"], input[placeholder*="Search the store" i], #store_nav_search_term');
    const box = search && (search.parentElement || search);
    const r = box && box.getBoundingClientRect();
    if (!r || !r.width || r.bottom < 0 || r.top > innerHeight) { qbtn.classList.toggle('on', false); qmenu.classList.toggle('on', false); return; }
    // on the search box's outer side: left of it in English; in the Arabic (RTL) store the box sits at the bar's left
    // end next to the wishlist button, so the button goes to its right instead
    const rtl = getComputedStyle(box).direction === 'rtl';
    // measured while shown: a hidden button is 0 px wide, which put it right on top of the search box's text
    qbtn.classList.toggle('on', true);
    const w = qbtn.offsetWidth || 130;
    let top = Math.round(r.top + (r.height - 30) / 2), left = Math.round(rtl ? r.right + 10 : r.left - w - 10);
    // the new React store bar (wishlist, sales…) puts its menus right up to the search: if the spot is taken by a
    // menu, the button goes just outside the bar's end on the same line (or, with no room there, just under the bar)
    const cy = top + 15;
    qbtn.style.pointerEvents = 'none'; // elementFromPoint looks through it
    const taken = [left + 4, left + w / 2, left + w - 4].some(x => {
      const el = document.elementFromPoint(x, cy);
      return el && !qbtn.contains(el) && !!el.closest('a, button, [role="button"], [role="menuitem"], .tab, .pulldown') && el.textContent.trim().length > 1;
    });
    qbtn.style.pointerEvents = '';
    if (taken) {
      const bar = box.closest('nav, [role="navigation"], .store_nav, #store_nav_area') || box;
      let br = bar.getBoundingClientRect();
      // the framed bar can be a wrapper or two around the nav: take the outermost box that is still just this row
      for (let a = bar.parentElement; a && a !== document.body; a = a.parentElement) {
        const ar = a.getBoundingClientRect();
        if (ar.height > br.height + 24 || ar.width > innerWidth - 40) break;
        br = ar;
      }
      const outside = rtl ? br.left - w - 10 : br.right + 10;
      if (outside >= 8 && outside + w <= innerWidth - 8) left = Math.round(outside);
      else { top = Math.round(br.bottom + 8); left = Math.round(rtl ? r.left : r.right - w); }
    }
    setStyles(qbtn, { top: top + 'px', left: left + 'px' });
    qPlace = { box, left: r.left, width: r.width, dy: top - r.top, x: left };
    qbtn.classList.toggle('on', true);
    const b = qbtn.getBoundingClientRect();
    setStyles(qmenu, { top: Math.round(b.bottom + 8) + 'px', left: Math.round(rtl ? Math.min(innerWidth - qmenu.offsetWidth - 12, b.left) : Math.max(12, b.right - qmenu.offsetWidth)) + 'px' });
  }

  /* ---- Family mode (button next to the user name, shelf.js; saved as the theme condition "Family"). On (the default), adult games disappear from every store
     page: an item is adult when Steam tags it with content descriptor 3 (adult only sexual content) or 4 (frequent
     nudity or sexual content) — read from the page's own data-ds-descids and from the store's item cache, which the
     newer React carousels fill. Steam's own account setting (Quick links → "Steam mature content setting") also
     removes them on Steam's side; this works even when that setting is open. */
  const ADULT = new Set([3, 4]);
  const adultIds = new Set();
  let safeOn = getComputedStyle(document.documentElement).getPropertyValue('--rf-family').trim() !== 'off';
  function learnAdult() {
    for (const el of document.querySelectorAll('[data-ds-descids][data-ds-appid]')) {
      let d = []; try { d = JSON.parse(el.getAttribute('data-ds-descids') || '[]'); } catch (e) { /* ignore */ }
      if (d.some(x => ADULT.has(+x))) String(el.getAttribute('data-ds-appid')).split(',').forEach(id => adultIds.add(+id));
    }
    try {
      const m = window.StoreItemCache && window.StoreItemCache.m_mapApps;
      if (m) for (const [id, it] of m) if (it && (it.m_ContentDescriptorIDs || []).some(x => ADULT.has(+x))) adultIds.add(+id);
    } catch (e) { /* cache not there */ }
  }
  /** the box of one item: climb from its link while the parent still holds only this game, and stays card-sized */
  function itemBox(a, id) {
    let el = a;
    for (let i = 0; i < 6; i++) {
      const p = el.parentElement;
      if (!p || p === document.body) break;
      const r = p.getBoundingClientRect();
      if (r.width > 760 || r.height > 620) break;
      const others = [...p.querySelectorAll('a[href*="/app/"]')].some(x => { const m = /\/app\/(\d+)/.exec(x.href); return m && +m[1] !== id; });
      if (others) break;
      el = p;
    }
    return el;
  }
  function filterAdult() {
    if (!/store\.steampowered\.com/.test(location.host) || !document.body) return;
    document.documentElement.classList.toggle('rfs-safe', safeOn);
    if (!safeOn) { document.querySelectorAll('[data-rfs-adult]').forEach(e => e.removeAttribute('data-rfs-adult')); return; }
    learnAdult();
    if (!adultIds.size) return;
    for (const el of document.querySelectorAll('[data-ds-appid]')) if (String(el.getAttribute('data-ds-appid')).split(',').some(id => adultIds.has(+id))) el.setAttribute('data-rfs-adult', '');
    for (const a of document.querySelectorAll('a[href*="/app/"]')) {
      const m = /\/app\/(\d+)/.exec(a.href);
      if (m && adultIds.has(+m[1]) && !a.closest('[data-rfs-adult]')) itemBox(a, +m[1]).setAttribute('data-rfs-adult', '');
    }
  }


  /* ---- right data panel (store game pages): the SteamDB-style numbers people scroll for, beside the page.
     Live players (Steam Web API), the same game's price in other Steam regions converted to SAR
     (store appdetails + open.er-api.com rates), quick facts and trusted price-history trackers.
     Everything is cached (players 5 min, prices 6 h, rates 12 h) so the store API is not hammered. */
  const HOME_CC = 'sa', HOME_CUR = 'SAR'; // your store region and the currency every price is converted to
  const REGIONS = [['sa', 'السعودية', 'Saudi Arabia'], ['ae', 'الإمارات', 'United Arab Emirates'], ['kw', 'الكويت', 'Kuwait'], ['us', 'أمريكا', 'United States'],
    ['de', 'منطقة اليورو', 'Euro area'], ['gb', 'بريطانيا', 'United Kingdom']];
  const regionName = cc => { const r = REGIONS.find(x => x[0] === cc); return r ? T(r[1], r[2]) : cc.toUpperCase(); };
  const memo = {
    get(k, maxAge) { try { const v = JSON.parse(localStorage.getItem('rfs.' + k)); if (v && Date.now() - v.t < maxAge) return v.d; } catch (e) { /* ignore */ } return undefined; },
    set(k, d) { try { localStorage.setItem('rfs.' + k, JSON.stringify({ t: Date.now(), d })); } catch (e) { /* ignore */ } },
  };
  const getJSON = async url => { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
  async function cached(key, maxAge, fn) {
    const hit = memo.get(key, maxAge);
    if (hit !== undefined) return hit;
    const d = await fn();
    memo.set(key, d);
    return d;
  }
  const livePlayers = id => cached('pl.' + id, 5 * 60e3, async () => {
    const j = await getJSON('https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=' + id);
    return j && j.response && j.response.result === 1 ? j.response.player_count : null;
  });
  const fxRates = () => cached('fx', 12 * 3600e3, async () => (await getJSON('https://open.er-api.com/v6/latest/USD')).rates);
  const regionPrices = id => cached('px3.' + id, 6 * 3600e3, () => Promise.all(REGIONS.map(async ([cc, name]) => {
    try {
      const e = (await getJSON(`/api/appdetails?appids=${id}&cc=${cc}&filters=price_overview`))[id];
      if (!e || !e.success) return { cc, name, na: true };
      const p = e.data && e.data.price_overview;
      if (!p) return { cc, name, free: true };
      return { cc, name, cur: p.currency, final: p.final / 100, initial: p.initial / 100, pct: p.discount_percent, fmt: p.final_formatted };
    } catch (err) { return { cc, name, na: true }; }
  })));
  const appFacts = id => cached('fa.' + id, 24 * 3600e3, async () => {
    const e = (await getJSON(`/api/appdetails?appids=${id}&cc=${HOME_CC}&l=english`))[id];
    const d = e && e.success && e.data;
    if (!d) return null;
    return {
      free: !!d.is_free, ach: d.achievements && d.achievements.total, dlc: (d.dlc || []).length,
      meta: d.metacritic && d.metacritic.score, recs: d.recommendations && d.recommendations.total,
      ctrl: d.controller_support || '', release: d.release_date && d.release_date.date,
    };
  });
  const num = n => Number(n).toLocaleString('en-US');
  const money = v => v.toFixed(2) + ' ' + HOME_CUR;

  let dataEl = null, dataFor = '';
  function placeData(top) {
    const m = /\/app\/(\d+)/.exec(location.pathname);
    const onApp = m && /store\.steampowered\.com/.test(location.host);
    const freeR = column ? innerWidth - column.getBoundingClientRect().right : 0;
    if (!onApp) { if (dataEl) dataEl.classList.remove('on'); return; }
    if (!dataEl) {
      dataEl = document.createElement('aside');
      dataEl.id = 'rfs-data';
      dataEl.addEventListener('click', e => {
        const a = e.target.closest('[data-ext]');
        if (!a) return;
        e.preventDefault();
        // trackers open in the normal web browser, so the store page stays where it is
        location.href = 'steam://openurl_external/' + a.dataset.ext;
      });
      document.body.appendChild(dataEl);
    }
    setStyles(dataEl, { top: top + 'px' });
    if (column) setStyles(dataEl, { left: Math.round(column.getBoundingClientRect().right + 18) + 'px', right: 'auto' });
    dataEl.classList.toggle('on', freeR >= 380);
    if (dataFor !== m[1]) { dataFor = m[1]; renderData(m[1]); }
  }

  async function renderData(id) {
    const name = ((qs('#appHubAppName, .apphub_AppName') || {}).textContent || '').trim();
    const q = encodeURIComponent(name);
    const links = [
      ['db', 'SteamDB', T('تاريخ السعر والتحديثات', 'Price & update history'), `https://steamdb.info/app/${id}/`],
      ['chart', 'SteamCharts', T('سجل عدد اللاعبين', 'Player count history'), `https://steamcharts.com/app/${id}`],
      ['coins', 'IsThereAnyDeal', T('أرخص سعر بالمتاجر', 'Cheapest store price'), `https://isthereanydeal.com/search/?q=${q}`],
      ['percent', 'GG.deals', T('عروض ومفاتيح', 'Deals & keys'), `https://gg.deals/search/?title=${q}`],
      ['timer', 'HowLongToBeat', T('كم تاخذ وقت', 'Time to beat'), `https://howlongtobeat.com/?q=${q}`],
      ['sliders', 'PCGamingWiki', T('إصلاحات وإعدادات', 'Fixes & settings'), `https://www.pcgamingwiki.com/api/appid.php?appid=${id}`],
    ];
    const skel = '<div class="rd-skel"></div><div class="rd-skel" style="width:70%"></div>';
    dataEl.innerHTML = `
      <section class="rd-live">${icT('online', 'lg')}<span><b class="rd-n">…</b><small>${T('يلعبونها الحين', 'playing right now')}</small></span><i class="rd-dot"></i></section>
      <section class="rd-px"><h4>${ic('globe')}${T('السعر حول العالم', 'Price around the world')}<small>${T('بالريال السعودي', 'in Saudi riyal')}</small></h4><div class="rd-rows">${skel}${skel}</div></section>
      <section class="rd-fx"><h4>${ic('info')}${T('معلومات سريعة', 'Quick facts')}</h4><div class="rd-grid rd-facts">${skel}</div></section>
      <section><h4>${ic('trend')}${T('تتبّع وتاريخ الأسعار', 'Price trackers')}</h4><div class="rd-grid">${links.map(([n, t, s, u]) =>
        `<a class="rd-link" href="${esc(u)}" data-ext="${esc(u)}" title="${esc(u)}">${icT(n)}<span><b dir="ltr">${esc(t)}</b><small>${esc(s)}</small></span></a>`).join('')}</div></section>`;
    const mine = () => dataFor === id && dataEl.isConnected;

    livePlayers(id).then(n => {
      if (!mine()) return;
      const live = dataEl.querySelector('.rd-live');
      if (n == null) live.querySelector('.rd-n').textContent = '—';
      else live.querySelector('.rd-n').textContent = num(n);
    }).catch(() => { if (mine()) dataEl.querySelector('.rd-n').textContent = '—'; });

    Promise.all([regionPrices(id), fxRates()]).then(([rows, fx]) => {
      if (!mine()) return;
      const box = dataEl.querySelector('.rd-rows');
      if (rows.every(r => r.free || r.na)) {
        box.innerHTML = `<div class="rd-note">${rows.some(r => r.free) ? T('اللعبة مجانية في كل المناطق.', 'Free to play in every region.') : T('ما في سعر متوفر لهذي اللعبة حاليًا.', 'No price is available for this game right now.')}</div>`;
        return;
      }
      for (const r of rows) if (r.final != null && fx[r.cur] && fx[HOME_CUR]) r.conv = r.final / fx[r.cur] * fx[HOME_CUR];
      const priced = rows.filter(r => r.conv != null).sort((a, b) => a.conv - b.conv);
      const home = rows.find(r => r.cc === HOME_CC && r.conv != null);
      const best = priced[0];
      const line = r => {
        if (r.conv == null) return `<div class="rd-row na"><span class="rd-cc">${r.cc.toUpperCase()}</span><span class="rd-name">${esc(regionName(r.cc))}</span><b class="rd-kwd">—</b><span class="rd-loc">${r.free ? T('مجانية', 'Free') : T('غير متوفرة', 'Not sold')}</span><span class="rd-diff"></span></div>`;
        const diff = home && r !== home ? Math.round((r.conv / home.conv - 1) * 100) : null;
        const cls = [r === home ? 'home' : '', r === best && priced.length > 1 ? 'best' : ''].filter(Boolean).join(' ');
        const tag = r === best && priced.length > 1 ? `<i class="rd-tag">${T('الأرخص', 'Cheapest')}</i>` : r === home ? `<i class="rd-tag">${T('منطقتك', 'Your region')}</i>` : '';
        return `<div class="rd-row ${cls}"><span class="rd-cc">${r.cc.toUpperCase()}</span><span class="rd-name">${esc(regionName(r.cc))}${tag}</span><b class="rd-kwd">${money(r.conv)}</b>`
          + `<span class="rd-loc">${esc(r.fmt)}${r.pct ? ` · -${r.pct}%` : ''}</span><span class="rd-diff${diff == null ? '' : diff < 0 ? ' lo' : diff > 0 ? ' hi' : ''}">${diff == null ? '' : (diff > 0 ? '+' : '') + diff + '%'}</span></div>`;
      };
      box.innerHTML = priced.concat(rows.filter(r => r.conv == null)).map(line).join('')
        + `<div class="rd-note">${T('تقريبية حسب سعر الصرف اليوم. النسبة مقارنةً بسعر منطقتك.', 'Approximate, at today\'s exchange rate. % is compared with your region.')}</div>`;
    }).catch(() => { if (mine()) dataEl.querySelector('.rd-rows').innerHTML = `<div class="rd-note">${T('تعذّر جلب الأسعار الحين.', 'Could not load prices right now.')}</div>`; });

    appFacts(id).then(f => {
      if (!mine()) return;
      const box = dataEl.querySelector('.rd-facts');
      if (!f) { box.closest('section').remove(); return; }
      const ctrl = { full: T('دعم كامل', 'Full'), partial: T('دعم جزئي', 'Partial') }[f.ctrl] || T('بدون', 'None');
      const facts = [
        ['medal', f.ach ? num(f.ach) : '—', T('إنجازات', 'Achievements')],
        ['puzzle', f.dlc ? num(f.dlc) : '—', T('محتوى إضافي', 'DLC')],
        ['msg', f.recs ? num(f.recs) : '—', T('مراجعات', 'Reviews')],
        ['gamepad', ctrl, T('يد التحكم', 'Controller')],
      ];
      if (f.meta) facts.push(['trophy', String(f.meta), 'Metacritic']);
      if (f.release) facts.push(['calendar', f.release, T('الإصدار', 'Released')]);
      box.innerHTML = facts.map(([n, v, l]) => `<div class="rd-fact">${icT(n)}<span><b dir="auto">${esc(v)}</b><small>${esc(l)}</small></span></div>`).join('');
    }).catch(() => { if (mine()) dataEl.querySelector('.rd-facts').closest('section').remove(); });
  }

  /* every "-NN%" discount on the page gets one stable class (.rfs-pct, its box .rfs-price): Steam's React carousels
     draw theirs with hashed class names, so a style can't reach them otherwise. Leaves only; each one marked once. */
  /* Runs after the page changed, never on a timer alone, and not at all under Steam Original / SpaceTheme / Material
     (they have no rule for these classes). Reads first, writes after: the old loop wrote an attribute and then asked
     for the next element's computed style, which made the browser redo the page's styles once per element — one call
     took 0.7 s on a game page. */
  let pageDirty = true;
  const DRESSED = () => { const s = html.getAttribute('data-rfs-style'); return !!s && s !== 'original' && s !== 'space' && s !== 'material'; };
  function markDiscounts() {
    if (!document.body || !DRESSED()) return;
    for (const d of document.querySelectorAll('div:not(.rfs-pct):not([data-rfs-np]):not(.bundle_base_discount)')) {
      if (d.firstElementChild || d.textContent.length > 16) continue;
      // "-30%", and the sale tiles' "Up to -50%" / «حتى -50%»
      if (/^[^\d%]{0,10}-\d{1,3}%$/.test(d.textContent.trim())) { d.classList.add('rfs-pct'); if (d.parentElement) d.parentElement.classList.add('rfs-price'); }
    }
    // the React rows' "See More" links are light-gray boxes with hashed classes: one class for the styles to dress
    const skip = [], ask = [];
    for (const a of document.querySelectorAll(':is(a, button, div):not(.rfs-btn2):not([data-rfs-nb])')) {
      if (a.firstElementChild || a.textContent.length > 40 || (a.tagName === 'DIV' && !a.textContent.trim())) skip.push(a); else ask.push(a);
    }
    const pill = [];
    for (const a of ask) {
      // light-gray boxes ("See More") and outlined ghost links ("See all updates", "View All") → one secondary pill
      const cs = getComputedStyle(a);
      const ghost = cs.borderTopStyle === 'solid' && parseFloat(cs.borderTopWidth) >= 1 && cs.backgroundColor === 'rgba(0, 0, 0, 0)' && a.textContent.trim().length > 2;
      (cs.backgroundColor === 'rgb(204, 204, 204)' || ghost ? pill : skip).push(a);
    }
    for (const a of skip) a.setAttribute('data-rfs-nb', '');
    for (const a of pill) a.classList.add('rfs-btn2');
  }
  /* ---- wishlist (React, hashed classes, a measuring virtual list): tag its parts with stable hooks so every style
     can dress them, and lay the rows out as a card grid.  The list measures each row's box (data-index wrapper), so in
     card mode every wrapper is exactly 1/k of a card row tall and its card is shifted into column (index mod k) by CSS:
     the list's total height and scroll window stay true, nothing is re-ordered, sorting / drag / remove keep working.
     Tags: data-rfs-wl = list | row | art | title | meta | buy | added | rank | empty, data-rfs-chip;  tags = .app_tag, the buy button =
     .btn_green_steamui, Options / Sort = .btnv6_blue_hoverfade (each style already dresses those classes). */
  const IS_WL = /store\.steampowered\.com$/.test(location.host) && /^\/wishlist\//.test(location.pathname);
  const setA = (el, k, v) => { if (el && el.getAttribute(k) !== v) el.setAttribute(k, v); };
  const addC = (el, c) => { if (el && !el.classList.contains(c)) el.classList.add(c); };
  let wlBox = null, wlObs = null, wlBtn = null;
  function wlView() {
    let v = ''; try { v = localStorage.getItem('rfs.wlView') || ''; } catch (e) { /* ignore */ }
    if (v !== 'cards' && v !== 'list') v = getComputedStyle(html).getPropertyValue('--rf-wl-view').trim() === 'list' ? 'list' : 'cards';
    setA(html, 'data-rfs-wlview', v);
    if (wlBtn) for (const b of wlBtn.children) b.classList.toggle('on', b.dataset.v === v);
  }
  function wlTagRow(w) {
    const row = w.querySelector(':scope > div > [role="button"]') || w.querySelector('[role="button"]');
    if (!row) return;
    const i = +w.getAttribute('data-index') || 0;
    setA(w, 'data-rfs-m3', String(i % 3)); setA(w, 'data-rfs-m2', String(i % 2));
    setA(row, 'data-rfs-wl', 'row');
    for (const c of row.children) {
      let k = '';
      if (c.tagName === 'A' && c.querySelector('img')) k = 'art';
      // "Added on … ✕ remove" (last row): its remove button is a button with a span too, so it is told apart by its
      // icon and by having no link — taken for the buy row, it pushed the card past its fixed height into the next row
      else if (c === row.lastElementChild && c.querySelector('button svg') && !c.querySelector('a') && c.textContent.trim()) k = 'added';
      else if (c.querySelector('button span, a[href*="/cart"]')) k = 'buy';
      // the rank / drag handle is the block with the drag hook; everything else with text is a meta line (an item with
      // no tags and no reviews, like hardware, has a meta line with neither buttons nor titles)
      else if (c.querySelector('[data-rfd-drag-handle-draggable-id], [data-rfd-drag-handle-context-id], input')) k = 'rank';
      else if (c.querySelector('button, [title]')) k = 'meta';
      else if (c.querySelector(':scope > a') && !c.querySelector('img')) k = 'title';
      else if (c === row.lastElementChild && c.textContent.trim()) k = 'added';
      else if (!c.textContent.trim() && !c.querySelector('svg, img, button, input')) k = 'empty';
      else if (c.textContent.trim()) k = 'meta';
      else k = 'rank';
      setA(c, 'data-rfs-wl', k);
    }
    const buy = row.querySelector(':scope > [data-rfs-wl="buy"]');
    if (buy) for (const a of buy.querySelectorAll('a')) if (/\d/.test(a.textContent)) setA(a, 'data-rfs-price', '');
    for (const b of row.querySelectorAll('button')) {
      if (b.closest('[data-rfs-wl="buy"]')) { if (b.querySelector('span')) addC(b, 'btn_green_steamui'); }
      else if (!b.firstElementChild && b.textContent.trim()) addC(b, 'app_tag');
    }
    // chips ("Early Access", "Demo Available"…): spans / links in the tag line that are not tags, the tag label or a review
    for (const s of row.querySelectorAll('[data-rfs-wl="meta"] > div:not(:first-child) :is(span, a)')) {
      if (s.hasAttribute('title') || s.closest('button') || s.parentElement.querySelector(':scope > .app_tag')) continue;
      setA(s, 'data-rfs-chip', '');
    }
  }
  function wlTag() {
    if (!document.body) return;
    const first = document.querySelector('[data-index] [role="button"].Panel');
    if (!first) return;
    const box = first.closest('[data-index]').parentElement.parentElement;
    if (box !== wlBox) {
      wlBox = box; setA(box, 'data-rfs-wl', 'list');
      if (wlObs) wlObs.disconnect();
      wlObs = new MutationObserver(() => wlTag());
      wlObs.observe(box, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-index'] });
    }
    for (const w of box.querySelectorAll('[data-index]')) wlTagRow(w);
    // the header: Options / Sort by are secondary buttons; the cards / list switch sits after them
    const search = document.querySelector('input[placeholder].Focusable:not([name="term"])');
    const bar = search && search.parentElement;
    if (bar && bar.querySelector('button[aria-expanded]')) {
      setA(bar, 'data-rfs-wl', 'bar');
      const gift = document.querySelector('a[href*="digitalgiftcards"]');
      if (gift && gift.querySelector('img')) setA(gift, 'data-rfs-wl', 'gift');
      for (const b of bar.querySelectorAll(':scope > div > button[aria-expanded], :scope > button[aria-expanded]')) addC(b, 'btnv6_blue_hoverfade');
      if (!wlBtn || !wlBtn.isConnected) {
        wlBtn = document.createElement('div');
        wlBtn.id = 'rfs-wlview';
        wlBtn.innerHTML = `<button type="button" data-v="cards">${ic('grid')}</button><button type="button" data-v="list">${ic('rows')}</button>`;
        wlBtn.addEventListener('click', e => {
          const b = e.target.closest('button'); if (!b) return;
          try { localStorage.setItem('rfs.wlView', b.dataset.v); } catch (er) { /* ignore */ }
          wlView();
        });
        bar.append(wlBtn);
      }
      setA(wlBtn.children[0], 'title', T('بطاقات', 'Cards')); setA(wlBtn.children[1], 'title', T('قائمة', 'List'));
      wlView();
    }
  }
  /* Badges page in Arabic (steamcommunity.com/…/badges): Steam's Arabic page leaves the XP box unclosed, so the badge
     list, its header and paging end up INSIDE .profile_xp_block, which SpaceTheme lays out as one flex row: the whole
     list was squeezed into a ~300 px column of 145 px cards with their text cut. Move them back after the box. */
  function fixBadgesNesting() {
    const xp = qs('.profile_xp_block');
    const sheet = xp && xp.querySelector(':scope > .badges_sheet');
    if (!sheet) return;
    const first = xp.querySelector(':scope > .badge_details_set_favorite, :scope > .profile_badges_header, :scope > .profile_paging') || sheet;
    const move = [];
    for (let n = first; n; n = n.nextSibling) move.push(n);
    xp.after(...move);
  }
  function start() {
    iconDefs();
    fixBadgesNesting();
    if (IS_WL) { setA(html, 'data-rfs-page', 'wishlist'); wlView(); wlTag(); setInterval(wlTag, 1200); }
    onLangChange = () => { if (rail) renderRail(); if (dataEl && dataFor) renderData(dataFor); if (qbtn) placeQuick(); };
    placeRail();
    setInterval(placeRail, 1500);
    filterAdult(); markDiscounts(); pageDirty = false;
    // carousels and infinite lists keep adding items: look again 1.2 s at most after the page changed — and not at
    // all while it is still (the observer only raises a flag; our own class / attribute writes don't raise it)
    try { new MutationObserver(() => { pageDirty = true; }).observe(document.body, { childList: true, subtree: true }); } catch (e) { pageDirty = true; }
    setInterval(() => { if (!pageDirty || document.hidden) return; pageDirty = false; filterAdult(); markDiscounts(); }, 1200);
    // resizing fires dozens of events a second: place the side panels at most once per frame
    let railFrame = 0;
    addEventListener('resize', () => { if (railFrame) return; railFrame = requestAnimationFrame(() => { railFrame = 0; column = null; placeRail(); }); }, { passive: true });
    setTimeout(() => rail && renderRail(), 2500); // purchase / wishlist blocks may load late
    // the old colour-classifying recolour is off for every style (they all build on stock Steam or a community
    // theme), so its page-wide MutationObserver — which walked every node the store added — no longer runs
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
