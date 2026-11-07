/* ===================================================================
   رف الألعاب v3 — library home designs, CD viewer, Ctrl+K search, theme picker
   Injected by Millennium into the main "Steam" window.

     1. SteamAPI   — the ONLY place that touches Steam internals.
                     After a Steam update run tools/diagnose.mjs and fix here.
     2. Data       — every owned game (lite), details loaded lazily when visible
     3. Layouts    — shelf · coverflow · gallery   (chosen by --rf-layout; "original" = Steam untouched)
     4. Viewer     — a game case that opens like a CD
     5. Palette    — Ctrl+K quick search / launcher
     6. Themes     — picker that switches the Millennium style in-app
   =================================================================== */
(function () {
  'use strict';
  if (window.__rfsShelf) { try { window.__rfsShelf.destroy(); } catch (e) { /* re-inject during dev */ } }

  const VERSION = '4.0.0';
  const LOG = (...a) => console.log('%c[رف الألعاب]', 'color:#ffb36b', ...a);
  /* Big Picture: bigpicture.js loads this same engine into the "Steam Big Picture Mode" window, so a theme's home design
     replaces Big Picture's home too (TV size, gamepad input — see "Big Picture host" near the end). Everything else
     here (nav THEMES button, filter strip, family / downloads buttons, picker, Arabic tokens) is desktop-only. */
  const BPM = window.__rfsBpmHost === true || document.title === 'Steam Big Picture Mode';
  /* the home designs that have a Big Picture version (bigpicture.js STYLES modes 'both'); the rest keep Valve's home */
  const BPM_LAYOUTS = new Set(['gallery', 'coverflow', 'terminal', 'vault', 'vinyl', 'arcade', 'cupertino', 'cyberpunk', 'shelter', 'xmb']);

  /* =================================================================
     1. SteamAPI
     ================================================================= */
  const SteamAPI = {
    ctx() {
      try { if (window.opener && window.opener.appStore) return window.opener; } catch (e) { /* cross-origin */ }
      return window.appStore ? window : null;
    },
    ready() {
      const c = this.ctx();
      // collectionStore exists before Steam has read the collections from cloud storage: touching one of its computed
      // lists then (userCollections …) made MobX keep the error, and Steam's own library page crashed with it
      // ("Cannot read properties of undefined (reading 'values')") until Steam was restarted — wait for the data
      return !!(c && c.appStore && c.collectionStore && c.collectionStore.collectionsFromStorage && c.appDetailsStore && c.SteamClient && c.SteamUIStore);
    },
    /** every hashed class Steam uses for a readable name (the same name can live in several CSS modules) */
    clsAll(key, ...hints) {
      const c = this.ctx();
      const maps = (c && c.MILLENNIUM_API && c.MILLENNIUM_API.classMapList) || [];
      const out = new Set();
      for (const m of maps) if (typeof m[key] === 'string' && hints.every(h => h in m)) out.add(m[key].split(' ')[0]);
      return [...out];
    },
    cls(key, ...hints) { return this.clsAll(key, ...hints)[0] || null; },
    sel(key, ...hints) { const a = this.clsAll(key, ...hints); return a.length ? a.map(k => '.' + k).join(',') : null; },
    el(key, ...hints) { const s = this.sel(key, ...hints); return s ? document.querySelector(s) : null; },
    route() {
      try {
        if (BPM) return this.ctx().SteamUIStore.WindowStore.GamepadUIMainWindowInstance.m_history.location.pathname || '';
        return this.ctx().MainWindowBrowserManager.m_lastLocation.pathname || '';
      } catch (e) { return ''; }
    },
    isLibraryHome() { return /^\/library\/home/.test(this.route()); },
    onBrowserRoute() { return /^\/browser/.test(this.route()); },
    /** the store/community page is a native browser layer drawn ABOVE our DOM — hide it while a panel of ours is open */
    setBrowserVisible(v) { try { const b = this.ctx().MainWindowBrowserManager.m_browser; if (b && b.SetVisible) b.SetVisible(!!v); } catch (e) { /* ignore */ } },
    rightPanel() {
      if (BPM) return this.bpmPanel();
      let best = null, bestArea = 0;
      document.querySelectorAll('[class*="RightPanel"]').forEach(el => {
        const r = el.getBoundingClientRect(), a = r.width * r.height;
        if (a > bestArea) { best = el; bestArea = a; }
      });
      return bestArea > 40000 ? best : null;
    },
    updatesBlock() { return this.el('UpdatesContainer'); },
    /** Big Picture home: the area between Steam's top bar (search · clock · avatar) and its footer (button hints) */
    bpmPanel() {
      const hd = this.el('Header', 'HeaderItem') || this.el('SearchAndTitleContainer');
      const ft = this.el('BasicFooter');
      const top = hd ? Math.max(0, Math.round(hd.getBoundingClientRect().bottom)) : 40;
      const fr = ft ? ft.getBoundingClientRect() : null;
      const bottom = fr && fr.height ? Math.round(fr.top) : innerHeight;
      const r = { left: 0, top, width: innerWidth, height: Math.max(200, bottom - top), right: innerWidth, bottom };
      return { getBoundingClientRect: () => r };
    },
    titleControls() { return this.el('TitleBarControls'); },
    isGame(a) { try { return a.app_type === 1 && !a.BIsShortcut(); } catch (e) { return false; } },
    /** library sources for the picker: all / installed / favourites / user collections */
    sources() {
      const cs = this.ctx().collectionStore;
      const games = list => (list || []).filter(a => this.isGame(a));
      const out = [
        { id: 'all', name: T('كل ألعابي', 'All games'), apps: () => games(cs.allGamesCollection && cs.allGamesCollection.allApps) },
        { id: 'installed', name: T('المثبتة', 'Installed'), apps: () => games(cs.localGamesCollection && cs.localGamesCollection.allApps) },
      ];
      try {
        for (const c of cs.userCollections || []) {
          if (!c || !c.id || /^type-/.test(c.id)) continue;
          const name = c.id === 'favorite' ? T('المفضلة', 'Favorites') : String(c.displayName || '').trim();
          if (name) out.push({ id: c.id, name, apps: () => games(c.allApps) });
        }
      } catch (e) { /* collections are optional */ }
      return out;
    },
    async requestDetails(appid) {
      const s = this.ctx().appDetailsStore;
      try { if (!s.GetAppDetails(appid)) await s.RequestAppDetails(appid); } catch (e) { /* ignore */ }
    },
    details(appid) { try { return this.ctx().appDetailsStore.GetAppDetails(appid) || null; } catch (e) { return null; } },
    _list(x) {
      if (!x) return [];
      if (Array.isArray(x)) return x.filter(Boolean);
      return (x.rgHeroImages || x.rgLogoImages || x.rgHeaderImages || x.rgImages || []).filter(Boolean);
    },
    capsules(ov) {
      const a = this.ctx().appStore, safe = f => { try { return f(); } catch (e) { return []; } };
      return [...this._list(safe(() => a.GetCachedVerticalCapsuleURL(ov))), ...this._list(safe(() => [a.GetVerticalCapsuleURLForApp(ov)]))];
    },
    images(ov) {
      const s = this.ctx().appDetailsStore, safe = f => { try { return f(); } catch (e) { return []; } };
      return {
        hero: this._list(safe(() => s.GetHeroImages(ov))),
        logo: this._list(safe(() => s.GetLogoImages(ov))),
        header: this._list(safe(() => s.GetHeaderImages(ov))),
      };
    },
    icon(ov) { try { return this.ctx().appStore.GetIconURLForApp(ov) || ''; } catch (e) { return ''; } },
    /** achievements: { got, total, pct } or null (no achievements). The game's details carry exact counts;
        until they arrive, Steam's own progress cache (filled by the library) often has them. */
    achievements(appid) {
      const c = this.ctx();
      try {
        const d = c.appDetailsStore.GetAppDetails(appid);
        const a = d && d.achievements;
        if (a && a.nTotal > 0) return { got: a.nAchieved || 0, total: a.nTotal, pct: Math.round(((a.nAchieved || 0) / a.nTotal) * 100) };
      } catch (e) { /* not loaded */ }
      try {
        const m = c.appAchievementProgressCache && c.appAchievementProgressCache.m_achievementProgress && c.appAchievementProgressCache.m_achievementProgress.mapCache;
        const e = m && m.get(Number(appid));
        if (e && e.total > 0) return { got: e.unlocked || 0, total: e.total, pct: Math.round(e.percentage != null ? e.percentage : (e.unlocked / e.total) * 100) };
      } catch (e) { /* no cache */ }
      return null;
    },
    description(appid) { try { const d = this.ctx().appDetailsStore.GetDescriptions(appid); return (d && d.strSnippet) || ''; } catch (e) { return ''; } },
    tags(ov, n = 4) {
      const a = this.ctx().appStore;
      try { return [...(ov.m_setStoreTags || [])].slice(0, n).map(t => a.GetLocalizationForStoreTag(t)).filter(Boolean); } catch (e) { return []; }
    },
    releaseYear(ov) { try { return ov.GetCanonicalReleaseYear() || ''; } catch (e) { return ''; } },
    runningIds() { try { return new Set((this.ctx().SteamUIStore.RunningApps || []).map(a => a.appid)); } catch (e) { return new Set(); } },
    run(ov) { this.ctx().SteamClient.Apps.RunGame(ov.GetGameID(), '', -1, 100); },
    navigate(path) { this.ctx().SteamUIStore.Navigate(path); },
    openDetails(appid) {
      if (BPM) { try { this.ctx().SteamUIStore.WindowStore.GamepadUIMainWindowInstance.m_Navigator.App(appid); return; } catch (e) { /* fall back */ } }
      this.navigate('/library/app/' + appid);
    },
    steamUrl(url) { this.ctx().SteamClient.URL.ExecuteSteamURL(url); },
    /* Millennium theme conditions ("Style", "Language") */
    ffi(name) { const c = this.ctx(); return c && c.MILLENNIUM_API && c.MILLENNIUM_API.ffi ? c.MILLENNIUM_API.ffi('core', name) : null; },
    async themeNative() {
      try { const r = await this.ffi('Core_GetActiveTheme')(); const o = typeof r === 'string' ? JSON.parse(r) : r; return (o && o.native) || 'rf-shelf'; } catch (e) { return 'rf-shelf'; }
    },
    /** reload Steam's UI so Millennium re-injects the theme with the new condition values */
    restartUI() { this.ctx().SteamClient.Browser.RestartJSContext(); },
    async setCondition(name, value) {
      const set = this.ffi('Core_ChangeCondition');
      if (!set) throw new Error('no ffi');
      const native = await this.themeNative();
      const r = await set(native, value, name);
      if (r && r.success === false) throw new Error('rejected');
      setTimeout(() => this.restartUI(), 350);
    },
    setStyle(value) { return this.setCondition('Style', value); },
  };

  /* =================================================================
     helpers
     ================================================================= */
  const $ = (s, r = document) => r.querySelector(s);
  const div = (cls, html) => { const e = document.createElement('div'); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  // absolute URLs: Millennium serves our CSS from another origin, so "/assets/…" inside a CSS var would 404
  const absUrl = u => { try { return new URL(u, location.href).href; } catch (e) { return u; } };
  const cssUrl = u => (u ? `url("${absUrl(String(u)).replace(/"/g, '%22')}")` : 'none');
  const first = list => (list && list[0]) || '';
  const rand = seed => { let t = (seed + 0x6D2B79F5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  /* localStorage, namespaced "rfs.*" */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('rfs.' + k); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('rfs.' + k, v); } catch (e) { /* ignore */ } },
  };

  /* ---- interface language (Millennium condition "Language" → --rf-lang: ar | en).
     The CSS var wins; until Millennium has injected it we use the last language we saw. */
  const normLang = v => { v = String(v || '').replace(/["'\s]/g, '').toLowerCase(); return v === 'en' || v === 'ar' ? v : ''; };
  const CSS_LANG = normLang(themeVar('--rf-lang', ''));
  const LANG = CSS_LANG || normLang(store.get('lang', 'en')) || 'en'; // English by default
  if (CSS_LANG && store.get('lang', '') !== CSS_LANG) store.set('lang', CSS_LANG);
  /** pick the Arabic or English text (third arg: a language other than the current one) */
  const T = (ar, en, lang = LANG) => (lang === 'en' ? en : ar);
  const LTR = LANG === 'en';
  document.documentElement.dataset.rfsLang = LANG; // → html[data-rfs-lang="en"] flips our CSS to left-to-right

  const LOCALE = T('ar-u-nu-latn', 'en-US');
  const NUM = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
  const RTF = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
  function fmtPlaytime(min) {
    if (!min) return T('ما لعبتها بعد', 'Not played yet');
    if (min < 60) return T(`${NUM.format(min)} دقيقة`, `${NUM.format(min)} ${min === 1 ? 'minute' : 'minutes'}`);
    const h = min / 60, v = h >= 100 ? Math.round(h) : Math.round(h * 10) / 10;
    return T(`${NUM.format(v)} ساعة`, `${NUM.format(v)} ${v === 1 ? 'hour' : 'hours'}`);
  }
  function fmtAgo(ts) {
    if (!ts) return '—';
    const diff = ts * 1000 - Date.now(), abs = Math.abs(diff) / 1000;
    for (const [u, s] of [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]]) {
      if (abs >= s) return RTF.format(Math.round(diff / 1000 / s), u);
    }
    return T('قبل لحظات', 'just now');
  }
  /** "N games" with the right plural */
  const fmtGames = n => T(`${NUM.format(n)} لعبة`, `${NUM.format(n)} ${n === 1 ? 'game' : 'games'}`);
  function fmtSize(b) {
    if (!b) return '—';
    const gb = b / 1024 ** 3;
    if (gb >= 1000) return `${NUM.format(Math.round(gb / 102.4) / 10)} TB`;
    return gb >= 1 ? `${NUM.format(Math.round(gb * 10) / 10)} GB` : `${NUM.format(Math.round(b / 1024 ** 2))} MB`;
  }
  function imgWithFallback(list, cls, onAllFail) {
    const im = new Image();
    im.alt = ''; im.draggable = false; im.decoding = 'async';
    if (cls) im.className = cls;
    let i = 0;
    const next = () => { if (i < list.length) im.src = absUrl(list[i++]); else if (onAllFail) onAllFail(im); };
    im.onerror = next;
    next();
    return im;
  }
  /* ---- theme icon set (inline SVG, 24px grid; no emoji anywhere).  Colours come from icons.css:
     strokes use the theme's gradient (#rfs-ic-grad), class "f" = soft duotone fill, class "s" = solid part.
     KEEP IN SYNC: the same map lives in shelf.js and webkit.js. */
  const IC = {
    search: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21"/>',
    library: '<path class="f" d="M4 19V5a1 1 0 0 1 1-1h3v16H5a1 1 0 0 1-1-1Z"/><path d="M8 4h4v16H8"/><path class="f" d="m14.6 5.2 3.4-.9 3 14.6-3.4.9Z"/>',
    sort: '<path d="M7 20V4M3 8l4-4 4 4"/><path d="M17 4v16M13 16l4 4 4-4"/>',
    shield: '<path class="f" d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6Z"/><path d="m8.5 12 2.4 2.4 4.6-4.8"/>',
    tag: '<path class="f" d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9Z"/><circle class="s" cx="7.5" cy="7.5" r="1.5"/>',
    spines: '<path class="f" d="M5 4h3v16H5zM10 4h3v16h-3z"/><path class="f" d="m15.5 5 2.8-.8 3.2 15-2.8.8Z"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/>',
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
    waves: '<path d="M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
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

  function themeVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  /* =================================================================
     state   (store = localStorage wrapper, defined with the helpers above)
     ================================================================= */
  const state = {
    // the home design is always on: the old "Original home" switch left people without the design (and looking for
    // the Themes button); Steam's own look is the "Steam Original" style in the picker instead
    enabled: true,
    sort: store.get('sort', 'recent'),
    view: store.get('view', 'spines'),
    sound: store.get('sound', '0') === '1', // off until the user turns it on (a saved choice is kept)
    amb: store.get('amb', '0') === '1', //      the theme's background ambience: off by default too
    news: store.get('news', '0') === '1',
    source: store.get('source', 'all'),
    genre: '',
    query: '',
    games: [],
    sig: '',
    layout: 'shelf',
  };
  const SORTS = {
    recent: (a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0) || String(a.sortAs).localeCompare(String(b.sortAs)),
    name: (a, b) => String(a.sortAs).localeCompare(String(b.sortAs), 'en', { sensitivity: 'base' }),
    playtime: (a, b) => (b.playtimeMin || 0) - (a.playtimeMin || 0),
    size: (a, b) => (b.installed ? b.sizeOnDisk || 0 : b.needBytes || 0) - (a.installed ? a.sizeOnDisk || 0 : a.needBytes || 0),
  };
  if (!SORTS[state.sort]) state.sort = 'recent';
  const FEATURE = { recent: T('آخر ما لعبت', 'Recently played'), playtime: T('الأكثر لعبًا', 'Most played'), size: T('الأكبر حجمًا', 'Largest') };
  const STYLES = [
    // the core set: page 1 of the picker (12 = one 3 x 4 page)
    { value: 'Classic Shelf', sid: 'classic', layout: 'shelf', name: T('الرف الكلاسيكي', 'Classic Shelf'), desc: T('رف خشب ثلاثي الأبعاد — تتمشى بين الرفوف والعلب تنفتح مثل CD', 'A 3D wooden bookcase — walk along the shelves and open each case like a CD') },
    { value: 'Glass Gallery', sid: 'glass', layout: 'gallery', name: T('المعرض الزجاجي', 'Glass Gallery'), desc: T('لوحة عملية: كمّل اللعب + كروت زجاجية + فلاتر', 'A practical dashboard: continue playing, glass cards and filters') },
    { value: 'Neon Coverflow', sid: 'neon', layout: 'coverflow', name: T('نيون كوفر فلو', 'Neon Coverflow'), desc: T('دوّار ثلاثي الأبعاد بانعكاسات وإضاءة نيون', 'A 3D carousel with reflections and neon lighting') },
    { value: 'Terminal', sid: 'terminal', layout: 'terminal', name: T('الطرفية', 'Terminal'), desc: T('مكتبتك كجدول أوامر بالأسود والأخضر — تتنقل بالأسهم وتفتح بـ Enter', 'Your library as a green-on-black command table — arrow keys to move, Enter to open') },
    { value: 'RPG Vault', sid: 'vault', layout: 'vault', name: T('خزنة المغامر', 'Adventurer\'s Vault'), desc: T('ألعابك أغراض في حقيبة — إطار كل لعبة حسب ساعاتك: عادي، نادر، أسطوري', 'Your games as inventory loot — each frame shows its rarity by your hours played') },
    { value: 'Vinyl Records', sid: 'vinyl', layout: 'vinyl', name: T('متجر الأسطوانات', 'Vinyl Records'), desc: T('جو السبعينات: أغلفة أسطوانات ومشغّل "يشتغل الحين" لآخر لعبة', '70s record store: album sleeves and a "Now Playing" turntable for your last game') },
    { value: 'Corkboard', sid: 'cork', layout: 'cork', name: T('لوحة الذكريات', 'Corkboard'), desc: T('صور بولارويد مثبّتة على لوح فلين، مقسّمة حسب الوقت', 'Polaroids pinned to a cork board, grouped by when you played') },
    { value: 'Retro Arcade', sid: 'arcade', layout: 'arcade', name: T('الأركيد', 'Retro Arcade'), desc: T('شاشة "اختر لعبتك" مثل آلات الأركيد — قائمة بالأسهم وصورة كبيرة', 'A "Select your game" arcade screen — arrow-key list and a big preview') },
    { value: 'Magazine', sid: 'magazine', layout: 'magazine', name: T('المجلة', 'Magazine'), desc: T('غلاف مجلة: آخر لعبة قصة الغلاف، والباقي أعمدة وقوائم بأرقام كبيرة', 'An editorial magazine: your last game is the cover story, the rest are columns and charts') },
    { value: 'Cupertino Dark', sid: 'cupertino', layout: 'cupertino', name: T('كوبرتينو الداكن', 'Cupertino Dark'), desc: T('أسلوب الماك والتلفزيون الداكن: زجاج معتم، زوايا ناعمة وزر تشغيل أبيض', 'The dark Mac / TV-app look: dark glass, soft corners and a white Play button') },
    { value: 'Cyberpunk', sid: 'cyberpunk', layout: 'cyberpunk', name: T('سايبربنك', 'Cyberpunk'), desc: T('أجواء سايبربنك بألوان مريحة للعين وزوايا مقصوصة', 'Cyberpunk atmosphere in eye-friendly tones, angular HUD panels') },
    { value: 'Shelter OS', sid: 'shelter', layout: 'shelter', name: T('الملجأ', 'Shelter OS'), desc: T('ملجأ أخضر وجهاز ذراع ترفعه بيدك لما تفتح لعبة', 'A green shelter terminal with a wrist computer you raise to open a game') },
    { value: 'Crossbar', sid: 'xmb', layout: 'xmb', name: T('الكونسول', 'Crossbar'), desc: T('قائمة كونسول بأيقونات أفقية وقائمة ألعاب عمودية فوق موجة متحركة', 'A console menu: a row of categories, a column of games, over a flowing wave') },
    // page 2: Steam as Valve ships it, then the extra community themes (MIT) — optional in the installer
    { value: 'Steam Original', sid: 'original', layout: 'original', name: T('ستيم الأصلي', 'Steam Original'), desc: T('ستيم مثل ما هو بدون أي تعديل — يبقى زر الثيمات ولوحة الأرقام بالمتجر', 'Steam exactly as Valve ships it — only the Themes button and the store stats panel stay') },
    { value: 'SpaceTheme', sid: 'space', layout: 'space', name: 'SpaceTheme', desc: T('ثيم المجتمع المشهور (SpaceTheme، رخصة MIT) — داكن ومرتب، مع لوحات الأرقام والأيقونات حقتنا', 'The popular community theme (SpaceTheme, MIT) — dark and modular, plus our stats panels and icons') },
    { value: 'Material You', sid: 'material', layout: 'material', name: 'Material You', desc: T('تصميم Material 3 من Google (Material Theme، رخصة MIT) — أسطح ناعمة وزوايا دائرية', 'Google\'s Material 3 design (Material Theme, MIT) — soft tonal surfaces and round corners') },
  ];
  function visibleGames() {
    const q = state.query.trim().toLowerCase();
    return state.games
      .filter(g => (!q || g.name.toLowerCase().includes(q)) && (!state.genre || g.genres.includes(state.genre)))
      .sort(SORTS[state.sort]);
  }

  /* =================================================================
     2. Data — lite records for every game, details on demand
     ================================================================= */
  const Data = {
    cache: new Map(),
    game(ov) {
      let g = this.cache.get(ov.appid);
      if (!g) {
        g = { appid: ov.appid, ov, detailed: false, images: { capsule: [], hero: [], logo: [], header: [] }, developers: [], description: '', drive: '' };
        g.genres = SteamAPI.tags(ov);
        g.releaseDate = SteamAPI.releaseYear(ov);
        this.cache.set(ov.appid, g);
      }
      g.ov = ov;
      g.name = ov.display_name;
      g.sortAs = ov.sort_as || ov.display_name;
      g.installed = !!ov.installed;
      g.sizeOnDisk = Number(ov.size_on_disk || 0);
      g.lastPlayed = Math.max(ov.rt_last_time_played || 0, ov.rt_last_time_locally_played || 0);
      g.playtimeMin = ov.minutes_playtime_forever || 0;
      g.playtime2wksMin = ov.minutes_playtime_last_two_weeks || 0;
      if (!g.images.capsule.length) g.images.capsule = SteamAPI.capsules(ov);
      return g;
    },
    /* details (hero, logo, header, size …) load 6 at a time. Newest request first: the game you just pointed at or
       scrolled to jumps the line — first-come-first-served made a hovered game wait behind every row scrolled past
       (over a minute with 900 games). Each request gets 5 s at most: Steam never answers for some apps, and those
       used to hold a slot forever — 6 of them and no picture loaded again. Requests nobody waits for any more
       (rows long scrolled past) are dropped; they come back if the row is shown again. */
    queue: [], active: 0, QMAX: 120,
    ensureDetails(g) {
      if (g.detailed) return Promise.resolve(g);
      if (g._p) {
        const i = this.queue.findIndex(q => q.g === g);
        if (i >= 0 && i !== this.queue.length - 1) this.queue.push(this.queue.splice(i, 1)[0]); // asked again → to the front
        return g._p;
      }
      g._p = new Promise(resolve => {
        this.queue.push({ g, resolve });
        while (this.queue.length > this.QMAX) { const old = this.queue.shift(); old.g._p = null; old.resolve(old.g); }
        this.pump();
      });
      return g._p;
    },
    pump() {
      while (this.active < 6 && this.queue.length) {
        const { g, resolve } = this.queue.pop();
        this.active++;
        (async () => {
          try {
            await Promise.race([SteamAPI.requestDetails(g.appid), new Promise(r => setTimeout(r, 5000))]);
            const d = SteamAPI.details(g.appid);
            const img = SteamAPI.images(g.ov);
            g.images.hero = img.hero; g.images.logo = img.logo; g.images.header = img.header;
            if (d) {
              g.developers = d.strDeveloperName ? [d.strDeveloperName] : [];
              const f = d.strInstallFolder || '';
              g.drive = /^[A-Za-z]:/.test(f) ? f.slice(0, 2).toUpperCase() : '';
              if (!g.sizeOnDisk && d.lDiskUsageBytes) g.sizeOnDisk = Number(d.lDiskUsageBytes);
              g.needBytes = Number(d.lDiskSpaceRequiredBytes || 0); // what an install needs (Steam's install dialog shows the same)
            }
            g.description = SteamAPI.description(g.appid);
            g.ach = SteamAPI.achievements(g.appid);
            // the details often carry 0/0 for achievements; Steam's achievement-progress cache has the real numbers but
            // only for games it has fetched — ask it for this game and wait briefly (≤ 1.6 s) for the answer
            if (!g.ach) {
              try {
                const pc = SteamAPI.ctx().appAchievementProgressCache;
                if (pc && pc.BGameHasAchievements && pc.BGameHasAchievements(g.appid)) {
                  pc.QueueCacheUpdate(g.appid);
                  const req = pc.RequestCacheUpdate();
                  for (let k = 0; !g.ach && k < 8; k++) { await Promise.race([req, new Promise(r => setTimeout(r, 200))]); g.ach = SteamAPI.achievements(g.appid); }
                }
              } catch (e) { /* no cache API */ }
            }
            try { const pc = SteamAPI.ctx().appAchievementProgressCache; g.achKnown = !!g.ach || !!(pc && pc.BGameHasAchievements && !pc.BGameHasAchievements(g.appid)); } catch (e) { g.achKnown = !!g.ach; }
          } catch (e) { /* keep lite data */ }
          g.detailed = true;
          this.active--;
          resolve(g);
          this.pump();
        })();
      }
    },
    load() {
      const src = SteamAPI.sources().find(s => s.id === state.source) || SteamAPI.sources()[0];
      state.source = src.id;
      state.games = src.apps().map(ov => this.game(ov));
      state.sig = this.sig();
    },
    sig() {
      try {
        const src = SteamAPI.sources().find(s => s.id === state.source);
        const apps = src ? src.apps() : [];
        let h = apps.length;
        for (const a of apps) h = (h * 31 + (a.rt_last_time_played || 0) + (a.installed ? 7 : 0)) | 0;
        return String(h);
      } catch (e) { return state.sig; }
    },
  };

  /* lazy painting: elements paint themselves when they scroll into view */
  let lazyIO = null;
  function lazy(el, paint) {
    el._rfsPaint = paint;
    if (!lazyIO) {
      lazyIO = new IntersectionObserver(entries => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          const t = en.target;
          lazyIO.unobserve(t);
          const g = Data.cache.get(+t.dataset.appid);
          if (!g || !t._rfsPaint) continue;
          t._rfsPaint(g);
          if (!g.detailed) Data.ensureDetails(g).then(() => { if (t.isConnected) t._rfsPaint(g); });
        }
      }, { rootMargin: '700px 700px' });
    }
    lazyIO.observe(el);
  }
  function resetLazy() { if (lazyIO) { lazyIO.disconnect(); lazyIO = null; } }

  /* =================================================================
     sound (synthesised)
     ================================================================= */
  let ac = null, noiseBuf = null, gestured = false, lastTick = 0, voices = [];
  const onFirstGesture = () => { gestured = true; };
  window.addEventListener('pointerdown', onFirstGesture, { once: true, capture: true });
  function audio() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const len = ac.sampleRate * 0.6;
      noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  /* each style can bring its own sound pack (--rf-sfx in its style file → src/js/sfx-packs.js) and, if the pack has
     one, a soft background ambience (its own strip button, off by default). Styles without a pack keep the sounds
     below. Desktop only: Big Picture keeps Steam's own interface sounds. */
  const SFX_KIND = { tick: 'tick', swish: 'swish', slide: 'open', open: 'open', snap: 'snap', case: 'open', close: 'close', spin: 'play', play: 'play', error: 'error' };
  const Sfx = {
    id: '', out: null, amb: null, home: false, asked: false,
    load() {
      if (BPM || this.asked || window.__rfsSfxPacks) return;
      this.asked = true;
      const s = document.createElement('script');
      s.src = themeBase + 'src/js/sfx-packs.js';
      s.onload = () => { try { updateBar(); } catch (e) { /* strip not built yet */ } };
      s.onerror = () => LOG('sound packs missing');
      document.head.appendChild(s);
    },
    pack() { const P = window.__rfsSfxPacks; return (P && this.id && P[this.id]) || null; },
    hasAmbience() { const p = this.pack(); return !!(p && p.ambience); },
    style(id) { // read once per style change
      if (id === this.id) return;
      this.id = id; this.load(); this.stopAmb();
      try { updateBar(); } catch (e) { /* strip not built yet */ }
    },
    output(a) { // a gentle top cut: nothing harsh gets through
      if (!this.out) { const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000; lp.Q.value = 0.5; const g = a.createGain(); g.gain.value = 0.9; lp.connect(g).connect(a.destination); this.out = lp; }
      return this.out;
    },
    play(kind, a) {
      const p = this.pack(), k = SFX_KIND[kind] || kind;
      const fn = p && (p[k] || (k === 'snap' ? p.tick : null));
      if (typeof fn !== 'function' || !window.__rfsSfxHelpers) return false;
      fn(a, this.output(a), window.__rfsSfxHelpers(a));
      return true;
    },
    /* the ambience plays only while it is switched on, the library home is on screen, Steam's window is visible and
       no game is running; it fades in and out over 1.5 s */
    sync(show) {
      if (show !== undefined) this.home = !!show;
      let want = false;
      try { want = state.amb && this.home && !BPM && gestured && !document.hidden && this.hasAmbience() && SteamAPI.runningIds().size === 0; } catch (e) { want = false; }
      if (want && !this.amb) {
        try {
          const a = audio(), bus = a.createGain();
          bus.gain.value = 0.0001; bus.connect(this.output(a));
          const src = this.pack().ambience(a, bus, window.__rfsSfxHelpers(a));
          const t = a.currentTime; bus.gain.setValueAtTime(0.0001, t); bus.gain.exponentialRampToValueAtTime(1, t + 1.5);
          this.amb = { bus, src };
        } catch (e) { LOG('ambience failed', e); }
      } else if (!want && this.amb) this.stopAmb();
    },
    stopAmb() {
      const m = this.amb; if (!m) return;
      this.amb = null;
      try {
        const t = ac.currentTime, g = m.bus.gain;
        g.cancelScheduledValues(t); g.setValueAtTime(Math.max(0.0001, g.value), t); g.exponentialRampToValueAtTime(0.0001, t + 1.5);
        if (m.src && m.src.stop) m.src.stop(t + 1.6);
      } catch (e) { /* ignore */ }
      setTimeout(() => { try { m.bus.disconnect(); } catch (e) { /* ignore */ } }, 1800);
    },
  };
  document.addEventListener('visibilitychange', () => Sfx.sync());
  function sfx(kind) {
    if (!state.sound || !gestured || BPM) return; // Big Picture keeps its own interface sounds
    try {
      const a = audio(), t = a.currentTime, n = performance.now();
      if (kind === 'tick') { if (n - lastTick < (Sfx.pack() ? 35 : 55)) return; lastTick = n; }
      voices = voices.filter(v => n - v < 150);
      if (voices.length >= 4) return; // never more than a few sounds on top of each other
      voices.push(n);
      if (Sfx.play(kind, a)) return;
      kind = { open: 'slide', case: 'slide', play: 'spin', error: 'close' }[kind] || kind; // the newer names, built-in
      const noise = (dur, type, f0, f1, gain, q = 1) => {
        const s = a.createBufferSource(); s.buffer = noiseBuf;
        const f = a.createBiquadFilter(); f.type = type; f.Q.value = q;
        f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
        const g = a.createGain(); g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f).connect(g).connect(a.destination); s.start(t); s.stop(t + dur + 0.03);
      };
      const tone = (dur, f0, f1, gain, type = 'sine') => {
        const o = a.createOscillator(); o.type = type;
        o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
        const g = a.createGain(); g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.03);
      };
      if (kind === 'tick') noise(0.022, 'bandpass', 3400, 2800, 0.035, 2.2);
      else if (kind === 'swish') noise(0.12, 'bandpass', 900, 2600, 0.05, 0.8);
      else if (kind === 'slide') noise(0.34, 'bandpass', 600, 2300, 0.07, 0.7);
      else if (kind === 'snap') { noise(0.05, 'bandpass', 2600, 1700, 0.32, 1.3); tone(0.08, 170, 70, 0.16); }
      else if (kind === 'close') { noise(0.04, 'bandpass', 1900, 1300, 0.3, 1.3); tone(0.07, 130, 60, 0.18); }
      else if (kind === 'spin') { tone(1.4, 70, 320, 0.05, 'triangle'); noise(1.2, 'bandpass', 300, 1800, 0.03, 0.6); }
    } catch (e) { /* audio is optional */ }
  }

  /* =================================================================
     root UI
     ================================================================= */
  const root = div(); root.id = 'rfs';
  root.innerHTML = '<div class="rf-stage"></div><div class="rf-tip"></div>';
  const stage = $('.rf-stage', root);
  const tip = $('.rf-tip', root);
  const toastEl = div(); toastEl.id = 'rfs-toast';

  /* ONE filter strip, right above the games of the home design. It holds the ONLY search box on the home page:
     typing filters the design's games in place (no pop-up results). Steam's own left game list is hidden while
     the design is on screen, so there is one list and one search. */
  const bar = div(); bar.id = 'rfs-bar';
  const SORT_NAMES = { recent: T('آخر لعب', 'Last played'), name: T('الاسم', 'Name'), playtime: T('الأكثر لعبًا', 'Most played'), size: T('الحجم', 'Size') };
  bar.innerHTML = `
    <div class="tb-search">
      <span class="tb-ico">${ic('search')}</span>
      <input class="tb-q" type="text" placeholder="${T('ابحث في ألعابك…', 'Search your games…')}" title="${T('Enter يفتح أول لعبة · Ctrl+Enter يشغّلها · Esc يمسح', 'Enter opens the first game · Ctrl+Enter plays it · Esc clears')}" spellcheck="false" autocomplete="off">
      <button class="tb-clear" title="${T('مسح البحث (Esc)', 'Clear search (Esc)')}">${ic('x')}</button>
      <kbd class="tb-kbd">Ctrl K</kbd>
    </div>
    <div class="tb-home">
      <div class="rf-dd tb-src"><button class="tb-btn rf-dd-btn" title="${T('أي ألعاب تطلع في الصفحة الرئيسية', 'Which games show on the home page')}">${ic('library')}<span class="tb-src-name">${T('كل ألعابي', 'All games')}</span>${ic('chevD', 'dd')}</button><div class="rf-dd-menu"></div></div>
      <div class="rf-dd tb-sort"><button class="tb-btn rf-dd-btn" title="${T('الترتيب', 'Sort by')}">${ic('sort')}<span class="tb-sort-name">${SORT_NAMES.recent}</span>${ic('chevD', 'dd')}</button><div class="rf-dd-menu">
        ${Object.entries(SORT_NAMES).map(([v, n]) => `<button data-v="${v}">${n}</button>`).join('')}
      </div></div>
      <div class="rf-dd tb-genre"><button class="tb-btn rf-dd-btn" title="${T('فلتر حسب نوع اللعبة', 'Filter by genre')}">${ic('tag')}<span class="tb-genre-name">${T('كل الأنواع', 'All genres')}</span>${ic('chevD', 'dd')}</button><div class="rf-dd-menu"></div></div>
      <div class="tb-seg tb-view"><button data-v="spines" title="${T('ظهور العلب', 'Case spines')}">${ic('spines')}<span class="tb-lbl">${T('ظهور', 'Spines')}</span></button><button data-v="covers" title="${T('أغلفة', 'Covers')}">${ic('grid')}<span class="tb-lbl">${T('أغلفة', 'Covers')}</span></button></div>
      <button class="tb-btn tb-news" title="${T('أظهر / أخفِ آخر تحديثات ألعابك (What\'s New)', 'Show / hide the latest updates for your games (What\'s New)')}">${ic('news')}</button>
      <button class="tb-btn tb-snd" title="${T('الصوت', 'Sound')}"></button>
      <button class="tb-btn tb-amb" title="${T('صوت الخلفية', 'Background ambience')}">${ic('waves')}</button>
    </div>
    <button class="tb-btn tb-theme" title="${T('غيّر تصميم الثيم', 'Change the theme design')}">${ic('palette')}<span class="tb-lbl">${T('الثيمات', 'Themes')}</span></button>`;

  const viewer = div(); viewer.id = 'rfs-viewer';
  viewer.innerHTML = `
    <div class="backdrop"></div>
    <button class="close" title="${T('إغلاق (Esc)', 'Close (Esc)')}">${ic('x')}</button>
    <div class="stage"><div class="fly"><div class="shift"><div class="tilt"><div class="jewel">
      <div class="jf j-back"></div><div class="jf j-spine"></div><div class="jf j-edge"></div>
      <div class="jf j-top"></div><div class="jf j-bottom"></div>
      <div class="tray"><div class="disc-shadow"></div><div class="hub"></div>
        <div class="disc"><div class="disc-art"></div></div></div>
      <div class="lid"><div class="lid-out"></div><div class="lid-in"><div class="info-bg"></div><div class="info"></div></div></div>
    </div></div></div></div></div>`;
  /* plug-in themes open a game in their OWN way (a record on a turntable, a cartridge, a magazine spread …):
     the layout's open(g, sheet, src) fills this panel, which sits over the home design (docs/THEME-KIT.md) */
  const sheet = div(); sheet.id = 'rfs-sheet';

  const picker = div(); picker.id = 'rfs-themes';
  picker.innerHTML = `
    <div class="tp-back"></div>
    <div class="tp-box">
      <div class="tp-head">
        <h2>${ic('palette')}${T('اختر تصميم الثيم', 'Choose a theme design')}</h2>
        <div class="tp-lang tp-snd" role="group" aria-label="${T('أصوات الثيم', 'Theme sounds')}">${ic('volume')}<button data-snd="off" type="button">${T('الأصوات: مطفأة', 'Sounds: off')}</button><button data-snd="on" type="button">${T('شغّالة', 'On')}</button></div>
        <div class="tp-lang" role="group" aria-label="${T('لغة الواجهة', 'Interface language')}">${ic('globe')}<button data-lang="ar" lang="ar" class="${LTR ? '' : 'on'}" aria-pressed="${!LTR}">العربية</button><button data-lang="en" lang="en" class="${LTR ? 'on' : ''}" aria-pressed="${LTR}">English</button></div>
        <p>${T('كل تصميم يغيّر الصفحة الرئيسية وشكل ستيم كله والمتجر. التطبيق ياخذ ثواني (ستيم يعيد تحميل الواجهة).', 'Each design changes the home page, the look of all of Steam, and the store. Applying takes a few seconds (Steam reloads its interface).')}</p>
      </div>
      <div class="tp-upd" hidden>
        <span class="tp-upd-ic">${ic('download')}</span>
        <div class="tp-upd-t"><b></b><span>${T('فيه ثيمات وإصلاحات جديدة. حمّل التحديث وشغّله، وتنحفظ اختياراتك.', 'New themes and fixes are out. Download the update and run it; your choices are kept.')}</span></div>
        <button class="tp-upd-go" type="button">${T('حمّل التحديث', 'Get the update')}</button>
      </div>
      <div class="tp-grid">
        ${STYLES.map(s => `
          <button class="tp-card" data-value="${esc(s.value)}" data-layout="${s.layout}" data-sid="${s.sid}">
            <div class="tp-prev tp-${s.layout}">${previewArt(s.layout)}</div>
            <div class="tp-meta"><b>${esc(s.name)}</b><span>${esc(s.desc)}</span></div>
            <i class="tp-cur">${ic('check')}${T('الحالي', 'Current')}</i>
          </button>`).join('')}
      </div>
      <div class="tp-foot">
        <div class="tp-pager">
          <button class="tp-pg prev" type="button" aria-label="${T('الصفحة السابقة', 'Previous page')}">${ic(LTR ? 'chevL' : 'chevR')}</button>
          <span class="tp-pgn"></span>
          <button class="tp-pg next" type="button" aria-label="${T('الصفحة التالية', 'Next page')}">${ic(LTR ? 'chevR' : 'chevL')}</button>
        </div>
        <button class="tp-close">${T('إغلاق', 'Close')}</button>
      </div>
    </div>`;
  function previewArt(layout) {
    if (layout === 'shelf') return '<i class="pv-shelf"></i><i class="pv-shelf b"></i>' + Array.from({ length: 14 }, (_, i) => `<i class="pv-spine" style="--i:${i}"></i>`).join('');
    if (layout === 'coverflow') return '<i class="pv-floor"></i>' + [-3, -2, -1, 0, 1, 2, 3].map(k => `<i class="pv-cf" style="--k:${k}"></i>`).join('');
    if (layout === 'gallery') return '<i class="pv-hero"></i>' + Array.from({ length: 8 }, (_, i) => `<i class="pv-tile" style="--i:${i}"></i>`).join('');
    if (layout === 'space') return '<i class="pv-xside"></i><i class="pv-xhero"></i>' + Array.from({ length: 5 }, (_, i) => `<i class="pv-xcard" style="--i:${i}"></i>`).join('');
    if (layout === 'material') return '<i class="pv-mbar"></i><i class="pv-mhero"></i>' + Array.from({ length: 3 }, (_, i) => `<i class="pv-mchip" style="--i:${i}"></i>`).join('') + Array.from({ length: 4 }, (_, i) => `<i class="pv-mcard" style="--i:${i}"></i>`).join('');
    if (layout === 'original') return '<i class="pv-snav"></i><i class="pv-slist"></i><i class="pv-shero"></i>' + Array.from({ length: 6 }, (_, i) => `<i class="pv-scap" style="--i:${i}"></i>`).join('');
    return '<i class="pv-a"></i><i class="pv-b"></i><i class="pv-c"></i>' + Array.from({ length: 12 }, (_, i) => `<i class="pv-i" style="--i:${i}"></i>`).join('');
  }

  function mount() {
    for (const el of BPM ? [toastEl, sheet] : [toastEl, viewer, sheet, picker, bar]) if (!el.isConnected) document.body.appendChild(el);
    iconDefs();
  }

  let toastTimer = 0;
  function toast(msg, ms = 3200) {
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('on'), ms);
  }

  /* =================================================================
     3. Layouts
     ================================================================= */
  let hoverSlot = null;
  const byId = id => Data.cache.get(+id);
  function hideTip() { tip.classList.remove('on'); }
  function showTip(g, x, y) {
    tip.innerHTML = `<b dir="auto">${esc(g.name)}</b><span>${esc(fmtPlaytime(g.playtimeMin))}${g.installed ? '' : ' · ' + T('غير مثبتة', 'Not installed')}</span>`;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
    tip.classList.add('on');
  }

  /* ---------- 3a. classic 3D bookcase (full width, one vanishing point per shelf) ---------- */
  const ShelfLayout = {
    fixedHeight: false,
    POST: 30, PAD: 26, HEAD: 30, BOARD: 24, CROWN: 30, PLINTH: 34,
    buildRows(games, faceCap, spineCap) {
      const rows = [];
      if (!games.length) return [{ type: 'spine', label: state.query || state.genre ? T('ما لقيت شي يطابق بحثك', 'Nothing matches your search') : T('ما في ألعاب هنا', 'No games here'), games: [] }];
      if (state.view === 'covers') {
        for (let i = 0; i < games.length; i += faceCap) rows.push({ type: 'face', games: games.slice(i, i + faceCap) });
      } else {
        let rest = games;
        const feat = FEATURE[state.sort];
        if (feat && !state.query && rest.length > 6) {
          const n = Math.min(faceCap, 8, rest.length);
          rows.push({ type: 'face', featured: true, label: feat, games: rest.slice(0, n) });
          rest = rest.slice(n);
        }
        for (let i = 0; i < rest.length; i += spineCap) rows.push({ type: 'spine', games: rest.slice(i, i + spineCap) });
      }
      let n = 0;
      rows.forEach(r => {
        if (!r.label && r.games.length) {
          if (state.sort === 'name') {
            const ch = g => (String(g.sortAs || g.name).trim()[0] || '#').toUpperCase();
            const a = ch(r.games[0]), b = ch(r.games[r.games.length - 1]);
            r.label = a === b ? a : `${a} — ${b}`;
          } else r.label = T(`الرف ${NUM.format(n + 1)}`, `Shelf ${NUM.format(n + 1)}`);
        }
        if (!r.featured) n++;
      });
      return rows;
    },
    layout(games, w, h) {
      const bw = Math.max(480, Math.round(w));
      const inner = bw - 2 * this.POST - 2 * this.PAD;
      const Hmin = Math.round(clamp(h * 0.34, 220, 330));
      const calc = H => {
        const W = Math.round(H * 0.16), DC = Math.round(H * 2 / 3);
        const faceCap = Math.max(1, Math.floor((inner + 22) / (DC + 22)));
        const spineCap = Math.max(1, Math.floor((inner - 40) / (W + 3)));
        const rows = this.buildRows(games, faceCap, spineCap);
        return { H, W, DC, bw, rows, total: this.CROWN + rows.length * (this.HEAD + H + this.BOARD) + this.PLINTH };
      };
      for (let H = 460; H >= Hmin; H -= 4) { const L = calc(H); if (L.total <= h) return L; }
      return calc(Hmin); // more games than one screen → you walk (scroll) along the shelves
    },
    spineArt(g) {
      const sp = div('sp', '<span class="sp-pc">PC</span><span class="sp-logo"></span><span class="sp-mini"></span>');
      return sp;
    },
    paintSpine(sp, g) {
      const holder = sp.querySelector('.sp-logo');
      if (!holder) return;
      const name = () => { holder.innerHTML = `<span class="sp-name" dir="auto">${esc(g.name)}</span>`; };
      if (g.images.logo.length) {
        if (holder.dataset.logo !== '1') { holder.dataset.logo = '1'; holder.replaceChildren(imgWithFallback(g.images.logo, '', name)); }
      } else if (!holder.firstChild) name();
    },
    paintCase(c, g) {
      c.style.setProperty('--cap', cssUrl(first(g.images.capsule)));
      c.style.setProperty('--hero', cssUrl(first(g.images.hero) || first(g.images.header) || first(g.images.capsule)));
      // spines are ~40 px wide: paint them from Steam's small header image (460×215) instead of the 1920 px hero
      c.style.setProperty('--spine', cssUrl(first(g.images.header) || first(g.images.capsule) || first(g.images.hero)));
      const sp = c.querySelector('.sp'); if (sp) this.paintSpine(sp, g);
    },
    slot(g, type, running) {
      const slot = div(`slot is-${type}${running ? ' running' : ''}${g.installed ? '' : ' ni'}`);
      slot.dataset.appid = g.appid;
      const c = div('case');
      c.style.setProperty('--jz', ((rand(g.appid) - 0.5) * 7).toFixed(1) + 'px');
      c.style.setProperty('--lean', ((rand(g.appid * 7 + 3) - 0.5) * 1.2).toFixed(2) + 'deg');
      const spine = div('face spine'); spine.append(this.spineArt(g));
      c.append(spine, div('face cover'), div('face top'));
      slot.append(c);
      lazy(slot, gg => this.paintCase(c, gg));
      return slot;
    },
    render(games, w, h) {
      const L = this.layout(games, w, h);
      for (const [k, v] of [['--H', L.H], ['--W', L.W], ['--DC', L.DC], ['--DS', L.DC + 34], ['--bw', L.bw]]) root.style.setProperty(k, v + 'px');
      const running = SteamAPI.runningIds();
      const bc = div('bc');
      bc.append(div('crown', '<div class="front"></div>'));
      for (const row of L.rows) {
        const shelf = div('shelf is-' + row.type);
        const s3 = div('s3d');
        const rowEl = div('row' + (row.featured ? ' featured' : ''));
        for (const g of row.games) rowEl.append(this.slot(g, row.type, running.has(g.appid)));
        if (row.type === 'spine' && row.games.length) rowEl.append(div('bookend', '<div class="case"><div class="face spine"></div><div class="face cover"></div><div class="face top"></div></div>'));
        const front = div('board-front');
        if (row.label) front.innerHTML = `<span class="plate">${esc(row.label)}</span>`;
        s3.append(div('back'), div('ceil'), div('board-top'), div('wall il'), div('wall ir'), rowEl, front);
        shelf.append(s3);
        bc.append(shelf);
      }
      bc.append(div('plinth', '<div class="front"></div>'), div('post l'), div('post r'));
      stage.replaceChildren(bc);
      this.bc = bc;

      bc.addEventListener('pointermove', e => {
        const slot = e.target.closest('.slot');
        this.setHover(slot);
        if (slot) {
          const r = slot.getBoundingClientRect(), c = slot.firstElementChild;
          c.style.setProperty('--ry', clamp(((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
          c.style.setProperty('--rx', clamp(((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
          tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px';
        }
      });
      bc.addEventListener('pointerleave', () => this.setHover(null));
      bc.addEventListener('click', e => {
        const slot = e.target.closest('.slot');
        if (slot) openGame(byId(slot.dataset.appid), this.source(slot.dataset.appid));
      });
    },
    setHover(slot) {
      if (slot === hoverSlot) return;
      if (hoverSlot) hoverSlot.classList.remove('hover');
      hoverSlot = slot;
      if (!slot) { hideTip(); return; }
      slot.classList.add('hover');
      const g = byId(slot.dataset.appid);
      if (g) {
        const r = slot.getBoundingClientRect();
        showTip(g, r.left + r.width / 2, r.top);
        tip.insertAdjacentHTML('beforeend', achHTML(g, 'mini'));
        // exact counts come with the details: refill the tip once if this case is still the one under the mouse
        if (!g.detailed) Data.ensureDetails(g).then(() => {
          if (hoverSlot !== slot) return;
          const old = tip.querySelector('.rf-ach'), h = achHTML(g, 'mini');
          if ((old ? old.outerHTML : '') !== h) { if (old) old.remove(); if (h) tip.insertAdjacentHTML('beforeend', h); }
        });
      }
      sfx('tick');
    },
    source(appid) {
      const slot = stage.querySelector(`.slot[data-appid="${appid}"]`);
      if (!slot) return null;
      const isSpine = slot.classList.contains('is-spine');
      return { slot, el: slot.querySelector(isSpine ? '.face.spine' : '.face.cover') || slot, isSpine };
    },
  };

  /* ---------- 3b. neon coverflow — two views of the same list, one cursor:
       FLOW: a 3D coverflow (virtualised: only the ~15 covers around the focused one exist) with the focused game's deck
             (state · play time · last played · size / download · achievements · PLAY / Details / Game page / Store) under it
       GRID: the whole library as a dense neon grid, cut into the same sections
     A section rail (letters when sorted by name, time / hours / size bands otherwise) jumps anywhere in one click,
     PageUp / PageDown (LB / RB) or ↑ / ↓. The focused game is kept when switching views (G, the toggle, LT in Big Picture).
     Big Picture: D-pad ←/→ browses, ↓ goes into the deck's buttons (host "edge escape"), ↑ goes on to Steam's top bar,
     A opens, X plays, LB/RB sections, LT switches view, B leaves the grid. ---------- */
  const CoverflowLayout = {
    cur: 0, curId: 0, gi: -1,
    view: store.get('neonView', 'flow') === 'grid' ? 'grid' : 'flow',
    get fixedHeight() { return this.view === 'flow'; }, // the coverflow fills the panel exactly; the grid scrolls
    dockInside: true, // the filter strip goes into [data-rfs-dock], in the same top panel as the view toggle + section rail
    get padAuxLabel() { return this.view === 'grid' ? T('العرض الدوّار', 'Coverflow') : T('شبكة الألعاب', 'Grid view'); },
    /** sections of the sorted list: contiguous runs with the same key (letter / time band / hours band / size band) */
    sectionsOf(games) {
      const now = Date.now() / 1000, D = 86400, GB = 1024 ** 3;
      const band = (v, list) => list.find(b => v >= b[0]) || list[list.length - 1];
      const KEY = {
        name: g => {
          const c = String(g.sortAs || g.name || '').trim().normalize('NFD').charAt(0).toUpperCase();
          return /[A-Z]/.test(c) ? [c, c] : /[0-9]/.test(c) || !c ? ['#', '#'] : ['~', T('أخرى', 'Other')];
        },
        recent: g => {
          if (!g.lastPlayed) return ['n', T('ما انلعبت', 'Never played')];
          const b = band(now - g.lastPlayed <= D ? 5 : now - g.lastPlayed <= 7 * D ? 4 : now - g.lastPlayed <= 31 * D ? 3 : now - g.lastPlayed <= 365 * D ? 2 : 1,
            [[5, T('اليوم', 'Today')], [4, T('هالأسبوع', 'This week')], [3, T('هالشهر', 'This month')], [2, T('هالسنة', 'This year')], [1, T('أقدم', 'Earlier')]]);
          return ['r' + b[0], b[1]];
        },
        playtime: g => {
          const h = (g.playtimeMin || 0) / 60;
          const b = band(h, [[100, T('+١٠٠ ساعة', '100 h+')], [20, T('٢٠–١٠٠ ساعة', '20–100 h')], [5, T('٥–٢٠ ساعة', '5–20 h')], [1, T('١–٥ ساعات', '1–5 h')], [0.0001, T('أقل من ساعة', '< 1 h')], [0, T('ما انلعبت', 'Not played')]]);
          return ['p' + b[0], b[1]];
        },
        size: g => {
          const s = gameBytes(g) / GB;
          const b = band(s, [[100, '100 GB+'], [50, '50–100 GB'], [20, '20–50 GB'], [5, '5–20 GB'], [0.0001, T('أقل من ٥ GB', '< 5 GB')], [0, T('حجم غير معروف', 'Unknown size')]]);
          return ['s' + b[0], b[1]];
        },
      };
      const keyOf = KEY[state.sort] || KEY.recent;
      const out = [];
      let last = null;
      games.forEach((g, i) => {
        const [id, label] = keyOf(g);
        if (!last || last.id !== id) { last = { id, label, start: i, count: 0 }; out.push(last); }
        last.count++;
      });
      return out;
    },
    secAt(i) { const S = this.secs || []; let k = 0; for (let j = 0; j < S.length; j++) if (S[j].start <= i) k = j; else break; return k; },
    render(games, w, h) {
      this.games = games;
      if (this.cur >= games.length) this.cur = 0;
      // the same game stays focused when the list re-renders (a game was played, Steam updated the library …)
      if (this.cur > 0 && this.curId && games[this.cur] && games[this.cur].appid !== this.curId) {
        const j = games.findIndex(g => g.appid === this.curId);
        if (j >= 0) this.cur = j;
      }
      this.curId = games[this.cur] ? games[this.cur].appid : 0;
      this.secs = this.sectionsOf(games);
      this.nodes = new Map(); this.bgFlip = false; this.bgG = null; this.gi = -1; this.scrollSec = -1;
      this.track = null; this.grid = null; this.cards = []; this.drag = null; clearTimeout(this.bgT);
      if (this.io) { this.io.disconnect(); this.io = null; }
      const grid = this.view === 'grid';
      const byName = state.sort === 'name';
      const pad = b => (BPM ? `<i class="cf-pad">${b}</i>` : ''); // Big Picture: the button that works this control
      const wrap = div('cf-wrap ' + (grid ? 'is-grid' : 'is-flow'));
      if (!grid) wrap.style.height = h + 'px'; // the coverflow fills the panel exactly (fixedHeight)
      wrap.innerHTML = `${grid ? '' : '<div class="cf-bg"><div class="cf-bg-img"></div><div class="cf-bg-img"></div><div class="cf-floor"></div></div>'}
        <div class="cf-top">
          <div class="rf-dock cf-dock" data-rfs-dock></div>
          <div class="cf-rail">${pad('LT')}
            <div class="cf-views" role="tablist" aria-label="${T('طريقة العرض', 'View')}">
              <button class="cf-view${grid ? '' : ' on'}" data-view="flow" data-nopad role="tab" aria-selected="${!grid}" title="${T('العرض الدوّار', 'Coverflow')} (G)">${ic('layers')}<span>${T('دوّار', 'Coverflow')}</span></button>
              <button class="cf-view${grid ? ' on' : ''}" data-view="grid" data-nopad role="tab" aria-selected="${grid}" title="${T('شبكة كل الألعاب', 'All games as a grid')} (G)">${ic('grid')}<span>${T('شبكة', 'Grid')}</span></button>
            </div>${pad('LB')}
            <div class="cf-secs${byName ? ' abc' : ''}" aria-label="${T('انتقل إلى قسم', 'Jump to a section')}">${this.secs.map((s, k) =>
              `<button class="cf-sec" data-s="${k}" data-nopad title="${esc(s.label)} — ${esc(fmtGames(s.count))}"><span dir="auto">${esc(s.label)}</span>${byName ? '' : `<b>${NUM.format(s.count)}</b>`}</button>`).join('')}</div>${pad('RB')}
            <div class="cf-count" dir="ltr"></div>
          </div>
        </div>
        ${grid ? '<div class="cf-grid"></div>' : `
        <div class="cf-stage">
          <div class="cf-track"></div>
          <button class="cf-nav prev" tabindex="-1" title="${T('السابق', 'Previous')}">${ic(LTR ? 'chevL' : 'chevR')}</button>
          <button class="cf-nav next" tabindex="-1" title="${T('التالي', 'Next')}">${ic(LTR ? 'chevR' : 'chevL')}</button>
        </div>
        <div class="cf-deck">
          <div class="cf-state"></div>
          <h2 class="cf-name" dir="auto"></h2>
          <div class="cf-meta"></div>
          <div class="cf-actions">
            <button class="cf-btn play" data-act="play"></button>
            <button class="cf-btn" data-act="open">${ic('info')}<span>${T('التفاصيل', 'Details')}</span></button>
            <button class="cf-btn" data-act="details">${ic('library')}<span>${T('صفحة اللعبة', 'Game page')}</span></button>
            <button class="cf-btn store" data-act="store">${ic('cart')}<span>${T('المتجر', 'Store')}</span></button>
          </div>
        </div>
        <div class="cf-keys">${[[['←', '→'], T('تصفّح', 'Browse')], [['↑', '↓'], T('الأقسام', 'Sections')], [['Enter'], T('التفاصيل', 'Details')], [['Ctrl', 'Enter'], T('تشغيل', 'Play')], [['G'], T('الشبكة', 'Grid')]]
          .map(([k, t]) => `<span>${k.map(x => `<kbd>${x}</kbd>`).join('')}${t}</span>`).join('')}</div>`}`;
      this.el = wrap;
      this.rail = $('.cf-secs', wrap);
      $('.cf-views', wrap).addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) this.setView(b.dataset.view); });
      this.rail.addEventListener('click', e => { const b = e.target.closest('.cf-sec'); if (b) this.jumpTo(+b.dataset.s); });
      if (grid) this.buildGrid(wrap, games); else this.buildFlow(wrap, games);
      stage.replaceChildren(wrap);
      if (grid) this.afterGrid();
      this.paintRail();
    },
    /* ---- FLOW ---- */
    buildFlow(wrap, games) {
      const st = $('.cf-stage', wrap);
      this.track = $('.cf-track', st); this.stageEl = st;
      if (!games.length) {
        this.track.innerHTML = `<div class="rf-empty">${T('ما لقيت شي يطابق بحثك', 'Nothing matches your search')}</div>`;
        wrap.classList.add('is-empty'); // no deck, no arrows: just the message
        return;
      }
      // later games sit on the reading-forward side: «next» is on the right in English, on the left in Arabic
      $('.prev', st).addEventListener('click', () => this.go(this.cur - 1));
      $('.next', st).addEventListener('click', () => this.go(this.cur + 1));
      this.track.addEventListener('click', e => {
        if (this.dragged) { this.dragged = false; return; }
        const it = e.target.closest('.cf-item'); if (!it) return;
        const i = +it.dataset.i;
        if (i === this.cur) openGame(this.games[i], this.source(this.games[i].appid));
        else this.go(i);
      });
      // wheel: one notch = one cover (a trackpad adds up its small steps); sideways swipes follow the reading direction
      const onWheel = e => {
        if (e.ctrlKey) return;
        e.preventDefault();
        const side = Math.abs(e.deltaX) > Math.abs(e.deltaY);
        let d = side ? e.deltaX * (LTR ? 1 : -1) : e.deltaY;
        if (e.deltaMode === 1) d *= 40;
        if (Math.abs(d) >= 50) { this.wheelAcc = 0; this.go(this.cur + Math.sign(d) * Math.min(5, Math.max(1, Math.round(Math.abs(d) / 100)))); return; }
        this.wheelAcc = (this.wheelAcc || 0) + d;
        if (Math.abs(this.wheelAcc) >= 60) { this.go(this.cur + Math.sign(this.wheelAcc)); this.wheelAcc = 0; }
      };
      st.addEventListener('wheel', onWheel, { passive: false });
      $('.cf-deck', wrap).addEventListener('wheel', onWheel, { passive: false });
      // drag the covers like a strip (pointer capture once it really moves, so a plain click still clicks)
      st.addEventListener('pointerdown', e => {
        if (e.button !== 0 || e.target.closest('button')) return;
        const c = this.track.querySelector('.cf-item.center');
        this.drag = { x: e.clientX, base: this.cur, id: e.pointerId, moved: false, step: Math.max(40, (c ? c.offsetWidth : 200) * 0.3) };
        this.dragged = false;
      });
      st.addEventListener('pointermove', e => {
        const d = this.drag; if (!d || e.pointerId !== d.id) return;
        const dx = e.clientX - d.x;
        if (!d.moved) {
          if (Math.abs(dx) < 6) return;
          d.moved = true; st.classList.add('dragging');
          try { st.setPointerCapture(d.id); } catch (err) { /* fine */ }
        }
        this.go(d.base + Math.round((-dx / d.step) * (LTR ? 1 : -1)), true);
      });
      const end = () => { if (this.drag && this.drag.moved) { this.dragged = true; st.classList.remove('dragging'); } this.drag = null; };
      st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
      $('.cf-actions', wrap).addEventListener('click', e => {
        const b = e.target.closest('[data-act]'); const g = this.games[this.cur];
        if (!b || !g) return;
        const a = b.dataset.act;
        if (a === 'play') launch(g);
        else if (a === 'open') openGame(g, this.source(g.appid));
        else if (a === 'details') { sfx('tick'); SteamAPI.openDetails(g.appid); }
        else { sfx('tick'); try { SteamAPI.steamUrl('steam://store/' + g.appid); } catch (err) { toast(T('ما قدرت أفتح المتجر', 'Couldn\'t open the Store')); } }
      });
      this.update(true);
    },
    go(i, quiet) {
      if (!this.games || !this.games.length) return;
      const n = Math.max(0, Math.min(this.games.length - 1, i));
      if (n === this.cur) return;
            this.cur = n; this.curId = this.games[n].appid;
      if (!quiet) sfx('swish');
      if (this.view === 'grid') this.gridGo(n, true); else this.update();
      this.paintRail();
    },
    node(i) {
      let it = this.nodes.get(i);
      if (it) return it;
      const g = this.games[i];
      it = div('cf-item' + (g.installed ? '' : ' ni'), '<div class="cf-cover"></div>');
      it.dataset.i = i; it.dataset.appid = g.appid;
      it.style.transition = 'none';
      it.firstChild.style.setProperty('--cap', cssUrl(first(g.images.capsule)));
      this.track.append(it);
      this.nodes.set(i, it);
      return it;
    },
    /** place the ~15 covers around the focused one (transform + opacity only) and fill the deck */
    update(instant) {
      if (!this.games.length || !this.track) return;
      const R = 7, lo = Math.max(0, this.cur - R), hi = Math.min(this.games.length - 1, this.cur + R);
      for (const [i, it] of this.nodes) if (i < lo || i > hi) { it.remove(); this.nodes.delete(i); }
      const fresh = [];
      for (let i = lo; i <= hi; i++) {
        const isNew = !this.nodes.has(i);
        const it = this.node(i);
        if (isNew && !instant) fresh.push(it);
        const k = i - this.cur, a = Math.abs(k), s = (LTR ? 1 : -1) * Math.sign(k);
        const tf = k === 0 ? 'translate3d(-50%, 0, calc(var(--cw) * .42))'
          : `translate3d(calc(-50% + ${(s * (0.66 + (a - 1) * 0.27)).toFixed(3)} * var(--cw)), 0, calc(var(--cw) * ${(-0.16 - a * 0.1).toFixed(2)})) rotateY(${-s * 52}deg)`;
        if (it._tf !== tf) { it._tf = tf; it.style.transform = tf; }
        const z = String(100 - a);
        if (it.style.zIndex !== z) it.style.zIndex = z;
        const op = a >= R ? '0' : '1';
        if (it.style.opacity !== op && !(isNew && !instant)) it.style.opacity = op;
        if (isNew && !instant) it.style.opacity = '0';
        it.classList.toggle('center', k === 0);
      }
      requestAnimationFrame(() => {
        for (const it of this.nodes.values()) if (it.style.transition) it.style.transition = '';
        for (const it of fresh) if (it.isConnected) it.style.opacity = Math.abs(+it.dataset.i - this.cur) >= R ? '0' : '1';
      });
      this.fill();
    },
    /** the deck under the focused cover */
    fill() {
      const g = this.games[this.cur], el = this.el;
      if (!g || !el || !this.track) return;
      const run = SteamAPI.runningIds().has(g.appid);
      const st = run ? ['run', T('شغّالة الحين', 'Running now')] : g.installed ? ['in', T('مثبتة', 'Installed')] : ['out', T('غير مثبتة', 'Not installed')];
      const size = g.installed ? (g.sizeOnDisk ? `${fmtSize(g.sizeOnDisk)}${g.drive ? ' · ' + g.drive : ''}` : '')
        : g.needBytes ? T(`${fmtSize(g.needBytes)} للتحميل`, `${fmtSize(g.needBytes)} download`) : '';
      const html = (id, h) => { const n = $(id, el); if (n && n.innerHTML !== h) n.innerHTML = h; };
      html('.cf-state', `<i class="${st[0]}"></i><span>${st[1]}</span>${size ? `<span class="sz">${ic(g.installed ? 'drive' : 'download')}${esc(size)}</span>` : ''}${g.genres[0] ? `<span class="gn" dir="auto">${esc(g.genres.slice(0, 2).join(' · '))}</span>` : ''}`);
      const nm = $('.cf-name', el); if (nm.textContent !== g.name) { nm.textContent = g.name; nm.title = g.name; }
      html('.cf-meta', `<span title="${T('وقت اللعب', 'Play time')}">${ic('hourglass')}${esc(fmtPlaytime(g.playtimeMin))}</span>`
        + `<span title="${T('آخر مرة لعبت', 'Last played')}">${ic('clock')}${esc(g.lastPlayed ? fmtAgo(g.lastPlayed) : T('ما لعبتها بعد', 'Never played'))}</span>`
        + (achHTML(g) || (g.achKnown ? `<span class="dim">${ic('trophy')}${T('بدون إنجازات', 'No achievements')}</span>` : '')));
      html('.cf-btn.play', run ? ic('pulse') + `<span>${T('شغّالة', 'Running')}</span>`
        : g.installed ? ic('play') + `<span>${T('تشغيل', 'Play')}</span>`
          : ic('download') + `<span>${T('تثبيت', 'Install')}</span>${g.needBytes ? `<small>${esc(fmtSize(g.needBytes))}</small>` : ''}`);
      $('.cf-btn.play', el).classList.toggle('is-running', run);
      // the backdrop follows once you stop on a game (a blurred layer is too costly to swap 30 times a second)
      clearTimeout(this.bgT);
      this.bgT = setTimeout(() => this.paintBg(g), this.bgG ? 140 : 0);
      if (!g.detailed) {
        // the neighbours first, the focused game last = first in line (the details queue is newest-first)
        for (const j of [this.cur + 2, this.cur - 1, this.cur + 1]) if (this.games[j] && !this.games[j].detailed) Data.ensureDetails(this.games[j]);
        Data.ensureDetails(g).then(() => { if (this.games[this.cur] === g && this.view === 'flow') this.fill(); });
      }
    },
    paintBg(g) {
      if (this.view !== 'flow' || this.games[this.cur] !== g || this.bgG === g) return;
      const bgs = this.el && this.el.querySelectorAll('.cf-bg-img');
      if (!bgs || bgs.length < 2) return;
      this.bgG = g; this.bgFlip = !this.bgFlip;
      const on = bgs[this.bgFlip ? 1 : 0], off = bgs[this.bgFlip ? 0 : 1];
      on.style.backgroundImage = cssUrl(first(g.images.header) || first(g.images.capsule));
      on.style.opacity = '1'; off.style.opacity = '0';
    },
    /* ---- GRID ---- */
    buildGrid(wrap, games) {
      const grid = $('.cf-grid', wrap);
      this.grid = grid; this.cards = [];
      if (!games.length) { grid.innerHTML = `<div class="rf-empty">${T('ما لقيت شي يطابق بحثك', 'Nothing matches your search')}</div>`; return; }
      const running = SteamAPI.runningIds();
      const sub = g => state.sort === 'recent' ? (g.lastPlayed ? fmtAgo(g.lastPlayed) : T('ما انلعبت', 'Never played'))
        : state.sort === 'size' ? sizeText(g)
          : state.sort === 'playtime' || g.installed ? fmtPlaytime(g.playtimeMin) : sizeText(g);
      const frag = document.createDocumentFragment();
      this.secs.forEach((s, k) => {
        const h = div('cf-gh', `<b dir="auto">${esc(s.label)}</b><span>${esc(fmtGames(s.count))}</span>`);
        h.dataset.s = k;
        frag.append(h);
        for (let i = s.start; i < s.start + s.count; i++) {
          const g = games[i];
          const c = div('nf-card' + (g.installed ? '' : ' ni') + (running.has(g.appid) ? ' run' : ''));
          c.dataset.appid = g.appid; c.dataset.i = i;
          c.innerHTML = `<div class="nf-art"><button class="nf-play" tabindex="-1" title="${g.installed ? T('تشغيل', 'Play') : T('تثبيت', 'Install')}">${ic(g.installed ? 'play' : 'download')}</button></div><div class="nf-name" dir="auto">${esc(g.name)}</div><div class="nf-sub"></div>`;
          const sb = c.lastChild;
          lazy(c, gg => { c.style.setProperty('--cap', cssUrl(first(gg.images.capsule))); const t = sub(gg); if (sb.textContent !== t) sb.textContent = t; });
          this.cards[i] = c;
          frag.append(c);
        }
      });
      grid.append(frag);
      grid.addEventListener('click', e => {
        const c = e.target.closest('.nf-card'); if (!c) return;
        const i = +c.dataset.i, g = this.games[i];
        this.go(i, true);
        if (e.target.closest('.nf-play')) { launch(g); return; }
        openGame(g, this.source(g.appid));
      });
    },
    afterGrid() {
      if (!this.grid || !this.games.length) return;
      this.gridGo(this.cur, false);
      // keep the cursor's card in view (centred) when the grid opens
      const c = this.cards[this.cur];
      if (c && this.cur > 0) requestAnimationFrame(() => this.reveal(c, true));
      // the rail lights the section you are scrolling through
      const heads = [...this.grid.querySelectorAll('.cf-gh')];
      this.io = new IntersectionObserver(() => {
        const lim = (this.el.querySelector('.cf-top').getBoundingClientRect().bottom || 0) + 40;
        let k = 0;
        for (const h of heads) { if (h.getBoundingClientRect().top <= lim) k = +h.dataset.s; else break; }
        if (k !== this.scrollSec) { this.scrollSec = k; this.paintRail(k); }
      }, { rootMargin: '0px 0px -60% 0px', threshold: [0, 1] });
      heads.forEach(h => this.io.observe(h));
    },
    /** the grid cursor (the same game the coverflow shows) */
    gridGo(i, show) {
      const old = this.gi >= 0 && this.cards[this.gi];
      if (old) old.classList.remove('kf');
      this.gi = i;
      const c = this.cards && this.cards[i];
      if (!c) return;
      c.classList.add('kf');
      if (show) this.reveal(c, false);
    },
    /** scroll the card into view below the sticky top panel (works inside Big Picture's zoomed box too);
        centre: true = centred, 'top' = right under the panel */
    reveal(el, centre) {
      let p = this.el && this.el.parentElement;
      for (; p; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 1) break; }
      if (!p) return;
      const er = el.getBoundingClientRect(), pr = p.getBoundingClientRect();
      const top = Math.max(pr.top, $('.cf-top', this.el).getBoundingClientRect().bottom) + 12, bot = pr.bottom - 14;
      if (centre === 'top') { p.scrollTop += er.top - top; return; }
      if (centre) { p.scrollTop += er.top - (top + bot - er.height) / 2; return; }
      if (er.top < top) p.scrollTop -= top - er.top;
      else if (er.bottom > bot) p.scrollTop += er.bottom - bot;
    },
    cols() {
      if (!this.grid) return 1;
      if (this.colsW !== this.grid.clientWidth) { this.colsW = this.grid.clientWidth; this.colsN = Math.max(1, getComputedStyle(this.grid).gridTemplateColumns.split(' ').filter(Boolean).length); }
      return this.colsN;
    },
    /** ↑ / ↓ in the grid: the same column one row up / down; rows never cross a section header sideways */
    gridRow(i, dir) {
      const C = this.cols(), S = this.secs, k = this.secAt(i), s = S[k];
      const col = (i - s.start) % C, row = Math.floor((i - s.start) / C), rows = Math.ceil(s.count / C);
      if (dir > 0) {
        if (row + 1 < rows) return Math.min(s.start + s.count - 1, i + C);
        const n = S[k + 1]; return n ? n.start + Math.min(col, n.count - 1) : i;
      }
      if (row > 0) return i - C;
      const p = S[k - 1]; if (!p) return -1;
      const lastRow = Math.floor((p.count - 1) / C);
      return p.start + Math.min(p.count - 1, lastRow * C + col);
    },
    /* ---- shared navigation ---- */
    setView(v) {
      if (v !== 'grid') v = 'flow';
      if (v === this.view) return;
      this.view = v; store.set('neonView', v);
      sfx('swish');
      render();
    },
    /** go to section k (rail click, LB / RB) */
    jumpTo(k) {
      const s = this.secs && this.secs[k]; if (!s) return;
      if (this.view === 'grid') {
        this.go(s.start, true); sfx('swish');
        const h = this.grid.querySelector(`.cf-gh[data-s="${k}"]`);
        if (h) this.reveal(h, 'top'); // the section's title right under the top panel
        this.scrollSec = k; this.paintRail(k);
        return;
      }
      this.go(s.start);
    },
    /** PageDown / RB: the next section; PageUp / LB: the start of this section, or the one before */
    jump(dir) {
      const k = this.secAt(this.cur), s = this.secs[k];
      if (dir > 0) { if (k + 1 < this.secs.length) this.jumpTo(k + 1); else if (this.cur !== this.games.length - 1) this.go(this.games.length - 1); return; }
      this.jumpTo(this.cur > s.start ? k : Math.max(0, k - 1));
    },
    paintRail(k = this.secAt(this.cur)) {
      if (!this.rail) return;
      for (const b of this.rail.children) b.classList.toggle('on', +b.dataset.s === k);
      const cnt = this.el && $('.cf-count', this.el);
      if (cnt) { const t = this.games.length ? `${NUM.format(this.cur + 1)} / ${NUM.format(this.games.length)}` : fmtGames(0); if (cnt.textContent !== t) cnt.textContent = t; }
      // a long rail keeps its lit chip in view
      const on = this.rail.children[k];
      if (on && this.rail.scrollWidth > this.rail.clientWidth + 2) {
        const r = on.getBoundingClientRect(), R = this.rail.getBoundingClientRect();
        if (r.left < R.left + 8) this.rail.scrollLeft -= R.left + 8 - r.left;
        else if (r.right > R.right - 8) this.rail.scrollLeft += r.right - R.right + 8;
      }
    },
    key(e) {
      const n = this.games ? this.games.length : 0, k = e.key;
      if (!n || !this.el || !this.el.isConnected) return false;
      const fwd = LTR ? 'ArrowRight' : 'ArrowLeft', back = LTR ? 'ArrowLeft' : 'ArrowRight';
      if ((k === 'g' || k === 'G') && !e.ctrlKey && !e.altKey && !e.metaKey) { this.setView(this.view === 'grid' ? 'flow' : 'grid'); return true; }
      if (k === 'PageDown' || k === 'PageUp') { this.jump(k === 'PageDown' ? 1 : -1); return true; }
      if (k === 'Home' || k === 'End') { this.go(k === 'Home' ? 0 : n - 1); return true; }
      if (k === 'Enter') {
        const g = this.games[this.cur];
        if (g && !e.repeat) { if (e.ctrlKey || e.shiftKey) launch(g); else openGame(g, this.source(g.appid)); }
        return true;
      }
      if (this.view === 'grid') {
        let i = this.cur;
        if (k === fwd) i = Math.min(n - 1, i + 1);
        else if (k === back) i = Math.max(0, i - 1);
        else if (k === 'ArrowDown') i = this.gridRow(i, 1);
        else if (k === 'ArrowUp') { i = this.gridRow(i, -1); if (i < 0) return true; } // top row: Big Picture goes on to Steam's top bar
        else if (k === 'Escape' && BPM) { this.setView('flow'); return true; } // B: back to the coverflow
        else return false;
        if (i !== this.cur) { this.go(i, true); sfx('tick'); }
        return true;
      }
      if (k === fwd) { this.go(this.cur + 1, e.repeat); return true; }
      if (k === back) { this.go(this.cur - 1, e.repeat); return true; }
      // Big Picture: ↓ goes down into PLAY / Details / Game page / Store, ↑ on to Steam's top bar (the host does both)
      if (k === 'ArrowDown' || k === 'ArrowUp') { if (BPM) return false; this.jump(k === 'ArrowDown' ? 1 : -1); return true; }
      return false;
    },
    /** Big Picture: X plays this one */
    padGame() { return (this.games && this.games[this.cur]) || null; },
    /** Big Picture: the element the controller's cursor is on */
    padEl() {
      if (this.view === 'grid') return (this.cards && this.cards[this.cur]) || null;
      return (this.track && this.track.querySelector('.cf-item.center')) || null;
    },
    /** Big Picture LT: switch Coverflow ⇄ Grid (the legend shows padAuxLabel) */
    padAux() { this.setView(this.view === 'grid' ? 'flow' : 'grid'); },
    padEdge() { return false; }, // past the deck's buttons: back to the covers
    source(appid) {
      if (this.view === 'grid') {
        const c = this.grid && this.grid.querySelector(`.nf-card[data-appid="${appid}"] .nf-art`);
        return c ? { el: c, slot: c.parentElement, isSpine: false } : null;
      }
      const it = this.track && this.track.querySelector(`.cf-item[data-appid="${appid}"] .cf-cover`);
      return it ? { el: it, slot: it.parentElement, isSpine: false } : null;
    },
    /** an element's box if it is on screen (inside the panel area), else null */
    seen(el, sheet) {
      if (!el || !el.isConnected) return null;
      const r = el.getBoundingClientRect(), S = sheet.getBoundingClientRect();
      return r.width > 4 && r.bottom > S.top && r.top < S.bottom && r.right > S.left && r.left < S.right ? r : null;
    },
    /** the game opens like a neon sign: the cover flies forward out of the carousel, then the sign's tubes flicker on
        (styles: src/css/sheets.css, #rfs-sheet[data-layout="coverflow"]) */
    async open(g, sheet, src) {
      const run = SteamAPI.runningIds().has(g.appid), facts = gameFacts(g), desc = gameDesc(g);
      const i = this.games ? this.games.indexOf(g) : -1;
      const st = run ? ['run', T('شغّالة الحين', 'Running now')] : g.installed ? ['in', T('مثبتة وجاهزة', 'Installed')] : ['out', T('غير مثبتة', 'Not installed')];
      sheet.innerHTML = `
        <div class="ns-scrim"></div>
        <button class="ns-x" data-close title="${T('إغلاق (Esc)', 'Close (Esc)')}">${ic('x')}</button>
        <div class="ns-view"><div class="ns-stage" role="dialog" aria-label="${esc(g.name)}">
          <div class="ns-art"></div>
          <div class="ns-sign">
            <i class="ns-plate"></i><i class="ns-frame c"></i><i class="ns-frame m"></i>
            <div class="ns-kicker"><span class="ns-dot ${st[0]}"></span><span>${st[1]}</span>${i >= 0 ? `<span class="ns-no">${NUM.format(i + 1)} / ${NUM.format(this.games.length)}</span>` : ''}</div>
            <h2 class="ns-title${g.name.length > 24 ? ' long' : ''}" dir="auto">${esc(g.name)}</h2>
            ${g.genres.length ? `<div class="ns-tags">${g.genres.slice(0, 5).map(t => `<span dir="auto">${esc(t)}</span>`).join('')}</div>` : ''}
            <dl class="ns-facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd dir="auto" title="${esc(v)}">${esc(v)}</dd></div>`).join('')}</dl>
            ${desc ? `<p class="ns-desc" dir="auto">${esc(desc)}</p>` : ''}
          </div>
        </div></div>`;
      const art = $('.ns-art', sheet), sign = $('.ns-sign', sheet);
      art.style.backgroundImage = cssUrl(first(g.images.capsule) || first(g.images.header));
      sign.append(gameActions(g));
      this.from = src && src.el;
      sfx('swish');
      const r = this.seen(this.from, sheet), A = art.getBoundingClientRect();
      const ease = 'cubic-bezier(.2,.85,.25,1)';
      const anims = [$('.ns-scrim', sheet).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' })];
      // 1. the card flies forward (FLIP from the carousel cover / grid card into its place, a small lift at the end)
      anims.push(r
        ? art.animate([{ transform: `translate(${r.left - A.left}px, ${r.top - A.top}px) scale(${r.width / A.width}, ${r.height / A.height})` },
          { transform: 'translate(0, -10px) scale(1.035)', offset: .72 }, { transform: 'none' }], { duration: 560, easing: ease })
        : art.animate([{ opacity: 0, transform: 'translateY(34px) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 460, easing: ease }));
      // 2. the sign lights up: plate fades in, the cyan and magenta tubes flicker on, then the title
      const FLICK = [{ opacity: 0 }, { opacity: .9, offset: .1 }, { opacity: .12, offset: .18 }, { opacity: 1, offset: .3 }, { opacity: .3, offset: .38 }, { opacity: 1, offset: .52 }, { opacity: .75, offset: .7 }, { opacity: 1 }];
      anims.push($('.ns-plate', sheet).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: 60, fill: 'backwards' }));
      anims.push($('.ns-frame.c', sheet).animate(FLICK, { duration: 440, delay: 90, fill: 'backwards' }));
      anims.push($('.ns-frame.m', sheet).animate(FLICK, { duration: 400, delay: 170, fill: 'backwards' }));
      anims.push($('.ns-title', sheet).animate(FLICK, { duration: 380, delay: 220, fill: 'backwards' }));
      [...sign.querySelectorAll(':scope > :not(i):not(.ns-title)'), $('.ns-x', sheet)].forEach((e, k) => anims.push(
        e.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 240, delay: 190 + k * 28, easing: 'ease-out', fill: 'backwards' })));
      await Promise.all(anims.map(a => a.finished)).catch(() => {});
    },
    async close(sheet, g) {
      const art = $('.ns-art', sheet), sign = $('.ns-sign', sheet);
      if (!art || !sign) return;
      sfx('close');
      const fwd = { fill: 'forwards' };
      const anims = [
        $('.ns-scrim', sheet).animate([{ opacity: 1 }, { opacity: 0 }], { ...fwd, duration: 340, easing: 'ease-in' }),
        // the tubes flicker off
        sign.animate([{ opacity: 1 }, { opacity: .2, offset: .25 }, { opacity: .75, offset: .4 }, { opacity: 0 }], { ...fwd, duration: 240 }),
        $('.ns-x', sheet).animate([{ opacity: 1 }, { opacity: 0 }], { ...fwd, duration: 160 }),
      ];
      // the cover flies back to where it came from (or to the carousel), else it sinks away
      const s = this.source(g.appid);
      const r = this.seen(this.from, sheet) || this.seen(s && s.el, sheet), A = art.getBoundingClientRect();
      anims.push(r
        ? art.animate([{ transform: 'none' }, { transform: `translate(${r.left - A.left}px, ${r.top - A.top}px) scale(${r.width / A.width}, ${r.height / A.height})` }], { ...fwd, duration: 330, easing: 'cubic-bezier(.45,0,.2,1)' })
        : art.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(24px) scale(.92)' }], { ...fwd, duration: 260, easing: 'ease-in' }));
      await Promise.all(anims.map(a => a.finished)).catch(() => {});
      this.from = null;
    },
  };

  /* ---------- 3c. glass gallery (dashboard) ---------- */
  const GalleryLayout = {
    fixedHeight: false,
    dockInside: true, // the filter strip goes into [data-rfs-dock]: search, source, sort and genres in one row
    kb: -1, // keyboard cursor (index into this.games), -1 = none yet
    render(games) {
      this.games = games; this.kb = -1; this.hov = null; this.hovR = null;
      const recent = [...state.games].sort(SORTS.recent)[0];
      const running = SteamAPI.runningIds();
      const el = div('gl');
      el.innerHTML = `
        ${recent ? `<div class="gl-hero" data-appid="${recent.appid}">
            <div class="gl-hero-bg"></div>
            <div class="gl-hero-body">
              <div class="gl-kicker">${T('كمّل من وين وقفت', 'Continue where you left off')}</div>
              <div class="gl-hero-logo"><h2 dir="auto">${esc(recent.name)}</h2></div>
              <div class="gl-hero-meta"><span>${ic('clock')}${esc(fmtPlaytime(recent.playtimeMin))}</span><span>${ic('calendar')}${esc(fmtAgo(recent.lastPlayed))}</span>${recent.playtime2wksMin ? `<span>${ic('fire')}${esc(fmtPlaytime(recent.playtime2wksMin))} ${T('آخر أسبوعين', 'past 2 weeks')}</span>` : ''}${achHTML(recent)}</div>
              <div class="gl-hero-actions">
                <button class="gl-btn play" data-act="play">${running.has(recent.appid) ? ic('pulse') + T('شغّالة الحين', 'Running now') : recent.installed ? ic('play') + T('كمّل اللعب', 'Continue playing') : ic('download') + T('تثبيت', 'Install')}</button>
                <button class="gl-btn" data-act="open">${ic('info')}${T('التفاصيل', 'Details')}</button>
                <button class="gl-btn" data-act="details">${T('صفحة اللعبة', 'Game page')}</button>
              </div>
            </div>
          </div>` : ''}
        <div class="rf-dock rf-merge" data-rfs-dock></div>
        <div class="gl-grid"></div>`;
      if (recent) {
        const paintHero = g => {
          $('.gl-hero-bg', el).style.backgroundImage = cssUrl(first(g.images.hero) || first(g.images.header) || first(g.images.capsule));
          const lg = $('.gl-hero-logo', el);
          if (g.images.logo.length && !lg.querySelector('img')) lg.replaceChildren(imgWithFallback(g.images.logo, '', im => im.replaceWith(Object.assign(document.createElement('h2'), { textContent: g.name }))));
          // achievements chip: only this chip is swapped, and only when the numbers changed (details bring exact counts)
          const meta = $('.gl-hero-meta', el), old = meta.querySelector('.rf-ach'), html = achHTML(g);
          if ((old ? old.outerHTML : '') !== html) { if (old) old.remove(); if (html) meta.insertAdjacentHTML('beforeend', html); }
        };
        paintHero(recent);
        Data.ensureDetails(recent).then(paintHero);
        // the whole banner opens the game (its glass panel grows out of the banner); its buttons do their own thing
        const hero = $('.gl-hero', el);
        hero.addEventListener('click', e => {
          const b = e.target.closest('[data-act]');
          if (b && b.dataset.act === 'play') launch(recent);
          else if (b && b.dataset.act === 'details') SteamAPI.openDetails(recent.appid);
          else openGame(recent, { el: hero, slot: hero, isSpine: false });
        });
      }
      const grid = $('.gl-grid', el);
      if (!games.length) grid.innerHTML = `<div class="rf-empty">${T('ما لقيت شي يطابق بحثك', 'Nothing matches your search')}</div>`;
      const frag = document.createDocumentFragment();
      games.forEach(g => {
        const c = div('gl-card' + (running.has(g.appid) ? ' running' : '') + (g.installed ? '' : ' ni'));
        c.dataset.appid = g.appid;
        c.innerHTML = `
          <div class="gl-art"><div class="gl-shine"></div>${running.has(g.appid) ? `<span class="gl-badge">${T('شغّالة', 'Running')}</span>` : g.installed ? '' : `<span class="gl-badge dim">${T('غير مثبتة', 'Not installed')}</span>`}
            <button class="gl-quick" title="${g.installed ? T('تشغيل', 'Play') : T('تثبيت', 'Install')}">${g.installed ? ic('play') : ic('download')}</button></div>
          <div class="gl-cap"><div class="gl-title" dir="auto">${esc(g.name)}</div><div class="gl-sub">${esc(fmtPlaytime(g.playtimeMin))}</div></div>`;
        frag.append(c);
        lazy(c, gg => c.style.setProperty('--cap', cssUrl(first(gg.images.capsule))));
      });
      grid.append(frag);
      stage.replaceChildren(el);
      this.grid = grid;
      grid.addEventListener('click', e => {
        const c = e.target.closest('.gl-card'); if (!c) return;
        const g = byId(c.dataset.appid);
        if (e.target.closest('.gl-quick')) { launch(g); return; }
        this.setKb(this.games.indexOf(g), false); // the arrow keys carry on from the game you clicked
        openGame(g, this.source(g.appid));
      });
      // highlight is pure CSS :hover (instant); the light spot follows the cursor once per frame, with the card's box
      // read once per card (reading it on every move after a style write forced a layout each time)
      grid.addEventListener('pointermove', e => {
        const c = e.target.closest('.gl-card');
        if (c !== this.hov) {
          if (this.hov) { this.hov.style.removeProperty('--tx'); this.hov.style.removeProperty('--ty'); }
          this.hov = c; this.hovR = null;
          if (c) sfx('tick');
        }
        if (!c) return;
        this.px = e.clientX; this.py = e.clientY;
        if (!this.raf) this.raf = requestAnimationFrame(() => {
          this.raf = 0;
          const h = this.hov; if (!h) return;
          const r = this.hovR || (this.hovR = h.getBoundingClientRect());
          h.style.setProperty('--tx', clamp(((this.px - r.left) / r.width) * 2 - 1).toFixed(3));
          h.style.setProperty('--ty', clamp(((this.py - r.top) / r.height) * 2 - 1).toFixed(3));
        });
      });
      grid.addEventListener('pointerleave', () => { if (this.hov) { this.hov.style.removeProperty('--tx'); this.hov.style.removeProperty('--ty'); this.hov = null; } });
    },
    /** arrow keys walk the cards (reading direction follows the language), Enter opens the one under the cursor */
    /** Big Picture: the game X plays (the card under the controller cursor) */
    padGame() { const c = this.grid && this.grid.querySelector('.gl-card.kb'); return (c && byId(c.dataset.appid)) || null; },
    key(e) {
      const n = this.games ? this.games.length : 0;
      if (!n || !this.grid || !this.grid.isConnected) return false;
      if (e.key === 'Enter') {
        const c = this.grid.querySelector('.gl-card.kb'); // only a cursor you can see
        const g = c && byId(c.dataset.appid);
        if (!g) return false;
        openGame(g, this.source(g.appid));
        return true;
      }
      const cols = Math.max(1, getComputedStyle(this.grid).gridTemplateColumns.split(' ').length);
      const d = { [LTR ? 'ArrowRight' : 'ArrowLeft']: 1, [LTR ? 'ArrowLeft' : 'ArrowRight']: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
      if (!d) return false;
      let i;
      if (this.kb < 0) {
        // start on the first card that is on screen, not at the top of the list
        const cards = this.grid.children;
        i = 0;
        for (let k = 0; k < cards.length; k++) { if (cards[k].getBoundingClientRect().top >= 40) { i = k; break; } }
      } else {
        const j = this.kb + d;
        i = j < 0 ? this.kb : Math.min(n - 1, j);
      }
      this.setKb(i, true);
      sfx('tick');
      return true;
    },
    setKb(i, show) {
      const old = this.grid && this.grid.querySelector('.gl-card.kb');
      if (old) old.classList.remove('kb');
      this.kb = i;
      if (!show || i < 0) return;
      const c = this.grid.children[i];
      if (c) { c.classList.add('kb'); c.scrollIntoView({ block: 'nearest' }); }
    },
    source(appid) {
      const c = stage.querySelector(`.gl-card[data-appid="${appid}"] .gl-art`);
      return c ? { el: c, slot: c.parentElement, isSpine: false } : null;
    },
    /** an element's box if it is on screen (inside the panel area), else null */
    seen(el, sheet) {
      if (!el || !el.isConnected) return null;
      const r = el.getBoundingClientRect(), S = sheet.getBoundingClientRect();
      return r.width > 4 && r.bottom > S.top && r.top < S.bottom && r.right > S.left && r.left < S.right ? r : null;
    },
    /** clip-path that shows only the part of the panel P lying over the box r (slid inside P when r is outside it) */
    clipAt(P, r) {
      const w = Math.min(r.width, P.width), h = Math.min(r.height, P.height);
      const x = Math.max(P.left, Math.min(P.right - w, r.left)), y = Math.max(P.top, Math.min(P.bottom - h, r.top));
      const t = y - P.top, l = x - P.left;
      return `inset(${t.toFixed(1)}px ${(P.width - l - w).toFixed(1)}px ${(P.height - t - h).toFixed(1)}px ${l.toFixed(1)}px round 14px)`;
    },
    flip: (C, r) => `translate(${r.left - C.left}px, ${r.top - C.top}px) scale(${r.width / C.width}, ${r.height / C.height})`,
    /** the game opens in a frosted-glass panel that grows out of the clicked card: the glass widens from the card's
        box while the cover glides into its place (styles: src/css/sheets.css, #rfs-sheet[data-layout="gallery"]) */
    async open(g, sheet, src) {
      const run = SteamAPI.runningIds().has(g.appid), facts = gameFacts(g), desc = gameDesc(g);
      const FI = { [T('وقت اللعب', 'Play time')]: 'hourglass', [T('آخر مرة لعبت', 'Last played')]: 'clock', [T('آخر أسبوعين', 'Past 2 weeks')]: 'fire', [T('الإنجازات', 'Achievements')]: 'trophy',
        [T('الحجم', 'Size')]: 'drive', [T('المطوّر', 'Developer')]: 'users', [T('الإصدار', 'Released')]: 'calendar' };
      const st = run ? ['run', T('شغّالة الحين', 'Running now')] : g.installed ? ['in', T('مثبتة وجاهزة', 'Installed')] : ['out', T('غير مثبتة', 'Not installed')];
      const hasLogo = g.images.logo.length > 0;
      sheet.innerHTML = `
        <div class="gs-scrim"></div>
        <div class="gs-view">
          <article class="gs-panel${hasLogo ? ' has-logo' : ''}" role="dialog" aria-label="${esc(g.name)}">
            <div class="gs-shadow"></div>
            <div class="gs-glass"><div class="gs-hero"></div></div>
            <button class="gs-x" data-close title="${T('إغلاق (Esc)', 'Close (Esc)')}">${ic('x')}</button>
            <div class="gs-body">
              <div class="gs-cover"></div>
              <div class="gs-main">
                ${hasLogo ? '<div class="gs-logo"></div>' : ''}
                <div class="gs-state ${st[0]}"><i></i>${st[1]}</div>
                <h2 class="gs-name" dir="auto">${esc(g.name)}</h2>
                ${g.genres.length ? `<div class="gs-chips">${g.genres.slice(0, 6).map(t => `<span dir="auto">${esc(t)}</span>`).join('')}</div>` : ''}
                ${desc ? `<p class="gs-desc" dir="auto">${esc(desc)}</p>` : ''}
              </div>
            </div>
            <dl class="gs-facts">${facts.map(([k, v]) => `<div class="gs-fact">${icT(FI[k] || 'info')}<dt>${esc(k)}</dt><dd dir="auto" title="${esc(v)}">${esc(v)}</dd></div>`).join('')}</dl>
          </article>
        </div>`;
      const panel = $('.gs-panel', sheet), glass = $('.gs-glass', sheet), cover = $('.gs-cover', sheet), main = $('.gs-main', sheet);
      // hero art on top, the small header right under it: something shows at once and the hero covers it when loaded
      $('.gs-hero', sheet).style.backgroundImage = [first(g.images.hero), first(g.images.header), first(g.images.capsule)].filter(Boolean).map(cssUrl).join(', ') || 'none';
      cover.style.backgroundImage = cssUrl(first(g.images.capsule) || first(g.images.header));
      if (hasLogo) $('.gs-logo', sheet).append(imgWithFallback(g.images.logo, '', im => im.remove()));
      main.append(gameActions(g));
      this.from = src && src.el;
      sfx('swish');
      const ease = 'cubic-bezier(.2,.8,.2,1)';
      const r = this.seen(this.from, sheet), P = panel.getBoundingClientRect();
      const anims = [$('.gs-scrim', sheet).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' }),
        $('.gs-shadow', sheet).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 220, fill: 'backwards' })];
      if (r) {
        anims.push(glass.animate([{ clipPath: this.clipAt(P, r), opacity: .7 }, { clipPath: `inset(0px 0px 0px 0px round 22px)`, opacity: 1 }], { duration: 540, easing: ease }));
        // a portrait card glides into the cover slot; from the wide banner the cover just fades in
        if (Math.abs(r.width / r.height - 2 / 3) < .12) anims.push(cover.animate([{ transform: this.flip(cover.getBoundingClientRect(), r) }, { transform: 'none' }], { duration: 540, easing: ease }));
        else anims.push(cover.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: 160, easing: 'ease-out', fill: 'backwards' }));
      } else {
        anims.push(panel.animate([{ opacity: 0, transform: 'translateY(28px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 440, easing: ease }));
      }
      [...main.children, $('.gs-facts', sheet), $('.gs-x', sheet)].forEach((e, k) => anims.push(
        e.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: 140 + k * 28, easing: 'ease-out', fill: 'backwards' })));
      await Promise.all(anims.map(a => a.finished)).catch(() => {});
    },
    async close(sheet, g) {
      const panel = $('.gs-panel', sheet);
      if (!panel) return;
      sfx('close');
      const glass = $('.gs-glass', sheet), cover = $('.gs-cover', sheet);
      const fwd = { fill: 'forwards' }, ease = 'cubic-bezier(.45,0,.2,1)';
      const s = this.source(g.appid);
      const r = this.seen(this.from, sheet) || this.seen(s && s.el, sheet), P = panel.getBoundingClientRect();
      const anims = [
        $('.gs-scrim', sheet).animate([{ opacity: 1 }, { opacity: 0 }], { ...fwd, duration: 330, easing: 'ease-in' }),
        $('.gs-shadow', sheet).animate([{ opacity: 1 }, { opacity: 0 }], { ...fwd, duration: 140 }),
        ...[$('.gs-x', sheet), $('.gs-main', sheet), $('.gs-facts', sheet)].map(e => e.animate([{ opacity: 1 }, { opacity: 0 }], { ...fwd, duration: 140 })),
      ];
      if (r) {
        // the glass shrinks back into the card and the cover lands on it
        anims.push(glass.animate([{ clipPath: 'inset(0px 0px 0px 0px round 22px)', opacity: 1 }, { opacity: 1, offset: .55 }, { clipPath: this.clipAt(P, r), opacity: 0 }], { ...fwd, duration: 330, easing: ease }));
        if (Math.abs(r.width / r.height - 2 / 3) < .12) anims.push(cover.animate([{ transform: 'none' }, { transform: this.flip(cover.getBoundingClientRect(), r) }], { ...fwd, duration: 330, easing: ease }));
        else anims.push(cover.animate([{ opacity: 1 }, { opacity: 0 }], { ...fwd, duration: 160 }));
      } else {
        anims.push(panel.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(20px) scale(.97)' }], { ...fwd, duration: 280, easing: 'ease-in' }));
      }
      await Promise.all(anims.map(a => a.finished)).catch(() => {});
      this.from = null;
    },
  };

  const LAYOUTS = { shelf: ShelfLayout, coverflow: CoverflowLayout, gallery: GalleryLayout };
  /* ---- plug-in home designs: each newer theme ships its own layout as src/layouts/<id>.js + .css, loaded only when
     that theme is chosen. A module calls window.__rfsLayoutApi.register(id, layout) — see docs/THEME-KIT.md. */
  const EXT = {};
  const extLoading = {};
  const themeBase = (() => {
    const me = document.querySelector('script[src*="/src/js/shelf.js"]');
    return me ? me.src.replace(/src\/js\/shelf\.js.*$/, '') : 'https://millennium.host/v1/themes/rf-shelf/';
  })();
  function loadLayout(id) {
    if (EXT[id] || extLoading[id] || !/^[a-z0-9-]+$/.test(id)) return;
    extLoading[id] = true;
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = themeBase + 'src/layouts/' + id + '.css'; css.dataset.rfsLayout = id;
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = themeBase + 'src/layouts/' + id + '.js';
    s.onerror = () => LOG('layout module missing:', id);
    document.head.appendChild(s);
  }
  const L = () => LAYOUTS[state.layout] || EXT[state.layout] || ShelfLayout;

  /* ---- render */
  function render() {
    hoverSlot = null; hideTip(); resetLazy();
    const lay = L();
    root.dataset.layout = state.layout;
    const w = root.clientWidth || 900;
    const keep = keepSearchFocus();
    if (!lay.dockInside && !BPM) dockBar(); // strip on top of the design, measured before sizing it
    const barH = bar.parentElement === root ? bar.offsetHeight + 22 : 0;
    const h = Math.max(420, (placement.height || 760) - barH);
    // overlay mode (no "What's New" block to sit under): #rfs is a fixed box that scrolls itself, so it keeps the
    // panel's height — 'auto' made it as tall as the whole list and nothing could scroll
    root.style.height = lay.fixedHeight ? (h + barH) + 'px' : placement.mode === 'overlay' ? placement.height + 'px' : 'auto';
    lay.render(visibleGames(), w, h);
    if (lay.dockInside && !BPM) dockBar(); // Big Picture: no filter strip (a controller can't type into it)
    keep();
    updateBar();
    renderedFor = renderKey();
  }
  /** the filter strip (search · source · sort · view …) lives inside the home design, right above the games */
  function dockBar() {
    const slot = stage.querySelector('[data-rfs-dock]');
    // first in its slot: a design may put its own chips in the same slot (.rf-merge) → strip + chips = one filter row
    if (slot) { if (slot.firstElementChild !== bar) slot.prepend(bar); }
    else if (bar.parentElement !== root || bar.nextElementSibling !== stage) root.insertBefore(bar, stage);
    bar.classList.toggle('inhome', true);
  }
  /** moving / re-rendering the strip must not kick the cursor out of the search box */
  function keepSearchFocus() {
    const inp = Search.input;
    if (document.activeElement !== inp) return () => {};
    const a = inp.selectionStart, b = inp.selectionEnd;
    return () => { if (document.activeElement !== inp) { inp.focus({ preventScroll: true }); try { inp.setSelectionRange(a, b); } catch (e) { /* ignore */ } } };
  }

  /* ---- toolbar state */
  function updateBar() {
    const src = SteamAPI.sources().find(s => s.id === state.source);
    $('.tb-src-name', bar).textContent = `${src ? src.name : T('كل ألعابي', 'All games')} (${NUM.format(state.games.length)})`;
    $('.tb-sort-name', bar).textContent = SORT_NAMES[state.sort];
    bar.querySelectorAll('.tb-sort .rf-dd-menu button').forEach(b => b.classList.toggle('on', b.dataset.v === state.sort));
    bar.querySelectorAll('.tb-view button').forEach(b => b.classList.toggle('on', b.dataset.v === state.view));
    $('.tb-view', bar).style.display = state.layout === 'shelf' ? '' : 'none';
    $('.tb-genre', bar).style.display = ''; // genres are one dropdown button in every design (the gallery's chip row took a whole line)
    $('.tb-genre-name', bar).textContent = state.genre || T('كل الأنواع', 'All genres');
    $('.tb-genre .rf-dd-btn', bar).classList.toggle('on', !!state.genre);
    $('.tb-snd', bar).innerHTML = state.sound ? ic('volume') : ic('mute');
    $('.tb-amb', bar).classList.toggle('on', state.amb);
    $('.tb-amb', bar).style.display = Sfx.hasAmbience() ? '' : 'none';
    $('.tb-news', bar).classList.toggle('on', state.news);
    // the strip only shows what the current design uses (no "spines / covers" outside the shelf, no genre menu
    // where the design already has genre chips) — layouts.css
    if (bar.dataset.layout !== state.layout) bar.dataset.layout = state.layout;
  }

  /* ---- toolbar controls */
  $('.tb-view', bar).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.view = b.dataset.v; store.set('view', state.view); sfx('tick'); render();
  });
  /* one master switch for every theme sound (clicks, moves, opens) AND the background ambience: off = total silence */
  function setSound(on) {
    state.sound = !!on; store.set('sound', on ? '1' : '0');
    if (!on && state.amb) { state.amb = false; store.set('amb', '0'); }
    Sfx.load(); updateBar(); try { Sfx.sync(); } catch (e) { /* ambience engine not ready */ }
    paintSoundSwitch(); if (on) sfx('tick');
  }
  function paintSoundSwitch() {
    picker.querySelectorAll('.tp-snd button').forEach(b => { const on = (b.dataset.snd === 'on') === !!state.sound; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    const off = picker.querySelector('.tp-snd button[data-snd="off"]'); if (off) off.textContent = T('الأصوات: مطفأة', 'Sounds: off');
  }
  $('.tb-snd', bar).addEventListener('click', () => setSound(!state.sound));
  $('.tb-amb', bar).addEventListener('click', () => { state.amb = !state.amb; store.set('amb', state.amb ? '1' : '0'); Sfx.load(); updateBar(); Sfx.sync(); });
  $('.tb-theme', bar).addEventListener('click', () => Themes.open());
  $('.tb-news', bar).addEventListener('click', () => { state.news = !state.news; store.set('news', state.news ? '1' : '0'); sfx('tick'); placement.key = ''; tick(true); });
  const dds = [...bar.querySelectorAll('.rf-dd')];
  const srcDD = $('.tb-src', bar), sortDD = $('.tb-sort', bar), genreDD = $('.tb-genre', bar);
  function genreMenu() {
    const count = new Map();
    state.games.forEach(g => g.genres.forEach(t => count.set(t, (count.get(t) || 0) + 1)));
    const top = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18);
    return `<button data-g="" class="${state.genre ? '' : 'on'}">${T('كل الأنواع', 'All genres')} <b>${NUM.format(state.games.length)}</b></button>` +
      top.map(([t, n]) => `<button data-g="${esc(t)}" class="${state.genre === t ? 'on' : ''}" dir="auto">${esc(t)} <b>${NUM.format(n)}</b></button>`).join('');
  }
  $('.rf-dd-menu', genreDD).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    genreDD.classList.remove('open');
    state.genre = b.dataset.g; CoverflowLayout.cur = 0; sfx('tick'); render();
  });
  for (const d of dds) {
    $('.rf-dd-btn', d).addEventListener('click', e => {
      e.stopPropagation();
      const open = !d.classList.contains('open');
      dds.forEach(x => x.classList.remove('open'));
      if (!open) return;
      d.classList.add('open');
      if (d === srcDD) {
        $('.rf-dd-menu', d).innerHTML = SteamAPI.sources().map(s => `<button data-id="${esc(s.id)}" class="${s.id === state.source ? 'on' : ''}" dir="auto">${esc(s.name)} <b>${NUM.format(s.apps().length)}</b></button>`).join('');
      } else if (d === genreDD) {
        $('.rf-dd-menu', d).innerHTML = genreMenu();
      }
    });
  }
  $('.rf-dd-menu', srcDD).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    srcDD.classList.remove('open');
    state.source = b.dataset.id; store.set('source', state.source); state.genre = ''; CoverflowLayout.cur = 0;
    Data.load(); sfx('tick'); render();
  });
  $('.rf-dd-menu', sortDD).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    sortDD.classList.remove('open');
    state.sort = b.dataset.v; store.set('sort', state.sort); CoverflowLayout.cur = 0; sfx('tick'); render();
  });
  const onDocClick = e => {
    dds.forEach(d => { if (!d.contains(e.target)) d.classList.remove('open'); });
  };
  document.addEventListener('click', onDocClick);
  function setEnabled(on) { state.enabled = on; store.set('enabled', on ? '1' : '0'); sfx('tick'); tick(true); }

  /* =================================================================
     4. Viewer — the case opens like a CD
     ================================================================= */
  const fly = $('.fly', viewer), tilt = $('.tilt', viewer), jewel = $('.jewel', viewer);
  const info = $('.info', viewer), discArt = $('.disc-art', viewer);
  let current = null, busy = false, spin = null, J = { jh: 600, jw: 400, jt: 96 };
  function sizeJewel() {
    const jh = Math.round(Math.min(innerHeight * 0.76, 700, innerWidth * 0.86 * 0.75));
    const jw = Math.round(jh * 2 / 3), jt = Math.round(jw * 0.24);
    J = { jh, jw, jt };
    viewer.style.setProperty('--jh', jh + 'px'); viewer.style.setProperty('--jw', jw + 'px'); viewer.style.setProperty('--jt', jt + 'px');
  }
  /** [label, value] pairs for a game's details (play time, last played, size, developer, release) */
  function gameFacts(g) {
    const stats = [[T('وقت اللعب', 'Play time'), fmtPlaytime(g.playtimeMin)], [T('آخر مرة لعبت', 'Last played'), fmtAgo(g.lastPlayed)]];
    if (g.playtime2wksMin) stats.push([T('آخر أسبوعين', 'Past 2 weeks'), fmtPlaytime(g.playtime2wksMin)]);
    const a = gameAch(g);
    if (a) stats.push([T('الإنجازات', 'Achievements'), T(`${NUM.format(a.got)} من ${NUM.format(a.total)} (${a.pct}%)`, `${NUM.format(a.got)} / ${NUM.format(a.total)} (${a.pct}%)`)]);
    stats.push([T('الحجم', 'Size'), sizeText(g, true)], [T('المطوّر', 'Developer'), (g.developers || []).join(T('، ', ', ')) || '—'], [T('الإصدار', 'Released'), g.releaseDate || '—']);
    return stats;
  }
  const gameDesc = g => g.description || SteamAPI.description(g.appid) || '';
  /** a game's size for every design: on disk when installed, else the download / install size Steam reports
      (lDiskSpaceRequiredBytes, the number its install dialog shows) — so players see it before they press Install.
      Not-installed sizes arrive with the game's details (api.Data.ensureDetails). */
  /** the player's real Steam level (and XP progress to the next level) from their community profile — cached 6 h.
      steamLevelNow() returns the cached value at once (or null); steamLevel() fetches when needed. */
  let lvlP = null;
  function steamLevelNow() { try { const c = JSON.parse(store.get('steamLevel', 'null')); return c && c.v ? c.v : null; } catch (e) { return null; } }
  function steamLevel() {
    try { const c = JSON.parse(store.get('steamLevel', 'null')); if (c && c.v && Date.now() - c.t < 6 * 3600e3) return Promise.resolve(c.v); } catch (e) { /* refetch */ }
    if (lvlP) return lvlP;
    lvlP = (async () => {
      try {
        const id = SteamAPI.ctx().App.m_CurrentUser.strSteamID;
        const acc = (BigInt(id) - 76561197960265728n).toString();
        const mp = await (await fetch(`https://steamcommunity.com/miniprofile/${acc}/json`)).json();
        const v = { level: Number(mp.level) || 0, xp: 0, pct: 0 };
        try { // XP progress inside the current level (Steam: each block of 10 levels costs 100 XP more per level)
          const html = await (await fetch(`https://steamcommunity.com/profiles/${id}/badges/`)).text();
          const xp = Number(((/profile_xp_block_xp">\s*XP\s*([\d,.]+)/.exec(html) || [])[1] || '0').replace(/[^\d]/g, ''));
          if (xp) {
            let start = 0; for (let n = 0; n < v.level; n++) start += 100 * (Math.floor(n / 10) + 1);
            const need = 100 * (Math.floor(v.level / 10) + 1);
            v.xp = xp; v.pct = Math.max(0, Math.min(100, Math.round(((xp - start) / need) * 100)));
          }
        } catch (e) { /* level only */ }
        if (v.level) store.set('steamLevel', JSON.stringify({ t: Date.now(), v }));
        return v.level ? v : null;
      } catch (e) { return steamLevelNow(); } finally { lvlP = null; }
    })();
    return lvlP;
  }
  function gameBytes(g) { return g ? (g.installed ? (g.sizeOnDisk || 0) : (g.needBytes || 0)) : 0; }
  function sizeText(g, long) {
    if (!g) return '—';
    if (g.installed) return g.sizeOnDisk ? `${fmtSize(g.sizeOnDisk)}${long && g.drive ? ` · ${g.drive}` : ''}` : '—';
    if (g.needBytes) return long ? T(`${fmtSize(g.needBytes)} للتحميل · غير مثبتة`, `${fmtSize(g.needBytes)} to download · not installed`) : T(`${fmtSize(g.needBytes)} تحميل`, `${fmtSize(g.needBytes)} download`);
    return long ? T('غير مثبتة', 'Not installed') : '—';
  }
  /** achievement progress { got, total, pct } or null — from the loaded details, else Steam's progress cache */
  function gameAch(g) {
    if (!g) return null;
    if (g.ach) return g.ach;
    const a = SteamAPI.achievements(g.appid);
    if (a && g.detailed) g.ach = a;
    return a;
  }
  /** the shared achievements readout every design can drop in: a trophy, "12 / 50", a progress bar and the % —
      each style dresses .rf-ach with its own colours/shape (variables --ach-fg / --ach-track / --ach-fill / --ach-radius).
      kind: '' (full) | 'mini' (trophy + 12/50 only). Returns '' when the game has no achievements. */
  function achHTML(g, kind = '') {
    const a = gameAch(g);
    if (!a) return '';
    const done = a.got >= a.total;
    const label = T(`الإنجازات: ${NUM.format(a.got)} من ${NUM.format(a.total)}`, `Achievements: ${NUM.format(a.got)} of ${NUM.format(a.total)}`);
    if (kind === 'mini') return `<span class="rf-ach mini${done ? ' done' : ''}" title="${esc(label)} (${a.pct}%)">${ic('trophy')}<b>${NUM.format(a.got)}/${NUM.format(a.total)}</b></span>`;
    return `<div class="rf-ach${done ? ' done' : ''}" title="${esc(label)}" role="group" aria-label="${esc(label)} (${a.pct}%)">${ic('trophy')}`
      + `<b>${NUM.format(a.got)}<small>/${NUM.format(a.total)}</small></b>`
      + `<span class="rf-ach-bar"><i style="width:${Math.max(a.pct, a.got ? 2 : 0)}%"></i></span><em>${a.pct}%</em></div>`;
  }
  /** Play / Game page / Store buttons, already wired. Plug-in themes style them (.rf-acts button[data-act]). */
  function gameActions(g) {
    const box = div('rf-acts');
    const running = SteamAPI.runningIds().has(g.appid);
    box.innerHTML = `
      <button class="rf-act play${running ? ' is-running' : ''}" data-act="play">${running ? ic('pulse') + T('شغّالة الحين', 'Running now') : g.installed ? ic('play') + T('تشغيل', 'Play') : ic('download') + T('تثبيت', 'Install')}</button>
      <button class="rf-act" data-act="details">${ic('info')}${T('صفحة اللعبة', 'Game page')}</button>
      <button class="rf-act" data-act="store">${ic('cart')}${T('المتجر', 'Store')}</button>`;
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      e.stopPropagation();
      if (b.dataset.act === 'play') launch(g);
      else if (b.dataset.act === 'details') { sfx('tick'); closeViewer(true).then(() => SteamAPI.openDetails(g.appid)); }
      else { sfx('tick'); try { SteamAPI.steamUrl('steam://store/' + g.appid); } catch (err) { toast(T('ما قدرت أفتح المتجر', 'Couldn\'t open the Store')); } }
    });
    return box;
  }
  function fillJewel(g) {
    ShelfLayout.paintCase(jewel, g);
    const sp = ShelfLayout.spineArt(g); ShelfLayout.paintSpine(sp, g);
    $('.j-spine', jewel).replaceChildren(sp);
    $('.j-back', jewel).style.backgroundImage = `linear-gradient(rgba(8,9,12,.5), rgba(8,9,12,.85)), ${cssUrl(first(g.images.header) || first(g.images.capsule))}`;
    discArt.replaceChildren();
    if (g.images.logo.length) discArt.append(imgWithFallback(g.images.logo, 'disc-logo', im => im.remove()));
    const running = SteamAPI.runningIds().has(g.appid);
    const stats = gameFacts(g);
    const desc = gameDesc(g);
    info.innerHTML = [
      '<div class="info-logo-wrap" style="display:flex;justify-content:center"></div>',
      `<h2 class="info-name" dir="auto">${esc(g.name)}</h2>`,
      g.genres.length ? `<div class="chips">${g.genres.map(x => `<span class="chip" dir="auto">${esc(x)}</span>`).join('')}</div>` : '',
      `<dl class="stats">${stats.map(([k, v]) => `<div class="stat"><dt>${esc(k)}</dt><dd dir="auto" title="${esc(v)}">${esc(v)}</dd></div>`).join('')}</dl>`,
      desc ? `<p class="desc" dir="auto">${esc(desc)}</p>` : '',
      `<div class="actions">
         <button class="btn play${running ? ' is-running' : ''}" data-act="play">${running ? ic('pulse') + T('شغّالة الحين', 'Running now') : g.installed ? ic('play') + T('تشغيل', 'Play') : ic('download') + T('تثبيت', 'Install')}</button>
         <button class="btn" data-act="details">${T('صفحة اللعبة', 'Game page')}</button>
         <button class="btn" data-act="store">${T('المتجر', 'Store')}</button>
       </div>`,
    ].filter(Boolean).join('');
    if (g.images.logo.length) $('.info-logo-wrap', info).append(imgWithFallback(g.images.logo, 'info-logo', im => im.remove()));
    [...info.children].forEach((c, i) => c.style.setProperty('--i', i));
  }
  info.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b || !current) return;
    const g = current.g;
    if (b.dataset.act === 'play') launch(g);
    else if (b.dataset.act === 'details') { sfx('tick'); closeViewer(true).then(() => SteamAPI.openDetails(g.appid)); }
    else if (b.dataset.act === 'store') { sfx('tick'); try { SteamAPI.steamUrl('steam://store/' + g.appid); } catch (err) { toast(T('ما قدرت أفتح المتجر', 'Couldn\'t open the Store')); } }
  });
  function flyFrom(src) {
    const r = src.el.getBoundingClientRect();
    const cx = r.left + r.width / 2 - innerWidth / 2, cy = r.top + r.height / 2 - innerHeight / 2;
    const s = Math.max(0.05, (src.isSpine ? r.height : Math.max(r.height, r.width * 1.5)) / J.jh);
    if (src.isSpine) return `translate3d(${cx}px, ${cy}px, ${-s * J.jw / 2}px) scale3d(${s}, ${s}, ${s}) rotateY(90deg)`;
    return `translate3d(${cx}px, ${cy}px, ${-s * J.jt / 2}px) scale3d(${s}, ${s}, ${s})`;
  }
  /** the themed panel covers the home design only — Steam's own navigation stays usable above it */
  function placeSheet() {
    if (BPM) { Bpm.placeSheet(); return; }
    const p = (root.isConnected && root.classList.contains('on') && SteamAPI.rightPanel()) || null;
    const r = p ? p.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
    setStyles(sheet, { left: Math.round(r.left) + 'px', top: Math.round(r.top) + 'px', width: Math.round(r.width) + 'px', height: Math.round(r.height) + 'px' });
  }
  async function openSheet(lay, g, src) {
    busy = true;
    current = { g, appid: String(g.appid), sheet: true };
    hideTip();
    await Promise.race([Data.ensureDetails(g), wait(700)]);
    sheet.dataset.layout = state.layout;
    sheet.replaceChildren();
    placeSheet();
    sheet.classList.add('on');
    document.documentElement.classList.add('rfs-sheet-on'); // for the designs' CSS (an html:has(#rfs-sheet.on) rule re-checked the page on every change)
    try { await lay.open(g, sheet, src || null); } catch (err) { LOG('layout open failed', err); }
    busy = false;
  }
  async function closeSheet(fast) {
    busy = true;
    const lay = L();
    try { if (!fast && typeof lay.close === 'function') await Promise.race([lay.close(sheet, current.g), wait(1500)]); } catch (err) { LOG('layout close failed', err); }
    sheet.classList.remove('on');
    document.documentElement.classList.remove('rfs-sheet-on');
    sheet.replaceChildren();
    current = null; busy = false;
  }
  // a click on the panel's own background (outside the theme's content) or on [data-close] closes it
  sheet.addEventListener('click', e => { if (current && current.sheet && (e.target === sheet || e.target.closest('[data-close]'))) closeViewer(); });
  window.addEventListener('resize', () => { if (current && current.sheet) placeSheet(); });
  async function openGame(g, src) {
    if (!g || busy || current) return;
    const lay = L();
    if (typeof lay.open === 'function') return openSheet(lay, g, src);
    busy = true;
    current = { g, appid: String(g.appid) };
    hideTip(); sizeJewel();
    await Promise.race([Data.ensureDetails(g), wait(700)]);
    fillJewel(g);
    const from = src ? flyFrom(src) : 'translate3d(0, 40px, -400px) scale3d(.6,.6,.6)';
    if (L() === ShelfLayout) ShelfLayout.setHover(null);
    if (src && src.slot) src.slot.classList.add('taken');
    viewer.classList.add('show'); void viewer.offsetWidth; viewer.classList.add('on');
    sfx('slide');
    await fly.animate([{ transform: from, opacity: src ? 1 : 0 }, { transform: 'none', opacity: 1 }], { duration: 780, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }).finished;
    viewer.classList.add('open');
    sfx('snap');
    spin = discArt.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 9000, iterations: Infinity });
    busy = false;
  }
  async function closeViewer(fast) {
    if (!current || busy) return;
    if (current.sheet) return closeSheet(fast);
    busy = true;
    viewer.classList.remove('open');
    if (!fast) { await wait(160); sfx('close'); await wait(880); }
    if (spin) { spin.cancel(); spin = null; }
    const src = L().source(current.appid);
    viewer.classList.remove('on');
    if (src && !fast && root.classList.contains('on')) {
      await fly.animate([{ transform: 'none' }, { transform: flyFrom(src) }], { duration: 640, easing: 'cubic-bezier(.55,0,.3,1)', fill: 'forwards' }).finished;
    } else await wait(fast ? 0 : 300);
    stage.querySelectorAll('.taken').forEach(s => s.classList.remove('taken'));
    viewer.classList.remove('show');
    fly.getAnimations().forEach(a => a.cancel());
    current = null; busy = false;
  }
  function launch(g) {
    if (!g) return;
    sfx('spin');
    if (spin) { spin.updatePlaybackRate(14); setTimeout(() => spin && spin.updatePlaybackRate(1), 2600); }
    try { SteamAPI.run(g.ov); toast(g.installed ? T(`جاري تشغيل ${g.name}…`, `Launching ${g.name}…`) : T(`يفتح تثبيت ${g.name}…`, `Opening install for ${g.name}…`)); }
    catch (err) { LOG('RunGame failed', err); toast(T('ما قدرت أشغّل اللعبة — الثيم يحتاج تحديث', 'Couldn\'t launch the game — the theme needs an update')); }
  }
  viewer.addEventListener('click', e => { if (e.target.closest('.close') || !e.target.closest('.jewel')) closeViewer(); });
  // the opened case tilts gently toward the cursor (the shelf itself never moves)
  const onViewerMove = e => {
    if (!current) return;
    const mx = (e.clientX / innerWidth) * 2 - 1, my = (e.clientY / innerHeight) * 2 - 1;
    tilt.style.transform = `rotateY(${(mx * 6).toFixed(2)}deg) rotateX(${(-my * 4).toFixed(2)}deg)`;
    jewel.style.setProperty('--gx', mx.toFixed(3));
  };
  viewer.addEventListener('pointermove', onViewerMove);

  /* =================================================================
     5. Search — the ONE search box (filter strip of the home page). Ctrl+K focuses it.
        It filters the home design in place; nothing pops up over the page.
     ================================================================= */
  /* panels of ours (theme picker) must be visible on store pages too */
  const Overlay = {
    open: new Set(), hidBrowser: false,
    push(name) {
      this.open.add(name);
      if (!this.hidBrowser && SteamAPI.onBrowserRoute()) { SteamAPI.setBrowserVisible(false); this.hidBrowser = true; }
    },
    pop(name) {
      this.open.delete(name);
      if (!this.open.size && this.hidBrowser) { this.hidBrowser = false; if (SteamAPI.onBrowserRoute()) SteamAPI.setBrowserVisible(true); }
    },
  };
  const Search = {
    input: $('.tb-q', bar), box: $('.tb-search', bar), pendingFocus: false,
    /** Ctrl+K: the box on the home page is the only search — from anywhere else, go home and focus it */
    focus() {
      if (bar.classList.contains('inhome') && bar.classList.contains('on') && root.classList.contains('on')) {
        this.input.focus({ preventScroll: true }); this.input.select(); return;
      }
      this.pendingFocus = true;
      SteamAPI.navigate('/library/home');
      tick(true);
    },
    /** called by tick once the strip is on screen again */
    focusIfPending() {
      if (!this.pendingFocus || !bar.classList.contains('inhome') || !root.classList.contains('on')) return;
      this.pendingFocus = false;
      this.input.focus({ preventScroll: true }); this.input.select();
    },
    /** typed text → filter the home design in place */
    apply(q) {
      clearTimeout(this._t);
      this.box.classList.toggle('has-q', !!q);
      this._t = setTimeout(() => {
        if (state.query === q) return;
        state.query = q; CoverflowLayout.cur = 0;
        if (root.classList.contains('on')) render();
      }, 90);
    },
    clear() { this.input.value = ''; this.apply(''); },
    /** Enter → open the first game the filter left (Ctrl+Enter plays it) */
    exec(play) {
      clearTimeout(this._t);
      if (state.query !== this.input.value) { state.query = this.input.value; CoverflowLayout.cur = 0; render(); }
      const g = visibleGames()[0];
      if (!g) { toast(T('ما لقيت لعبة بهالاسم', 'No game matches that')); return; }
      if (play) { launch(g); return; }
      this.input.blur();
      openGame(g, L().source(g.appid));
    },
  };
  const Palette = Search; // old name kept for dev helpers
  Search.input.addEventListener('input', () => Search.apply(Search.input.value));
  Search.input.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); Search.exec(e.ctrlKey || e.shiftKey); }
    else if (e.key === 'Escape') { e.preventDefault(); if (Search.input.value) Search.clear(); else Search.input.blur(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      // arrows leave the box and move through the games of the design
      e.preventDefault(); Search.input.blur();
      if (!current && L().key) L().key(e);
    }
  });
  $('.tb-clear', bar).addEventListener('click', e => { e.stopPropagation(); Search.clear(); Search.input.focus({ preventScroll: true }); });

  /* =================================================================
     6. Themes — picker (switches the Millennium "Style" condition)
     ================================================================= */
  // which picker card is current: original / community styles name themselves with --rf-style-id
  /** the theme window waits for Steam to reload; if Millennium never answers, don't leave it frozen */
  let busyT = 0;
  function pickerBusy() {
    picker.classList.add('busy');
    clearTimeout(busyT);
    busyT = setTimeout(() => {
      if (!picker.classList.contains('busy')) return;
      picker.classList.remove('busy');
      Lang.switching = false;
      toast(T('ستيم ما رد — جرّب مرة ثانية', 'Steam did not respond — please try again'), 5000);
    }, 8000);
  }
  const curStyle = () => themeVar('--rf-style-id', '') || (state.original ? 'original' : ({ shelf: 'classic', coverflow: 'neon', gallery: 'glass' })[state.layout] || state.layout);
  /* which styles the user has: the installer writes src/installed.json ({"installed": [style values], …}); styles
     added later from this picker are remembered here. The rest show dimmed with a "Download" badge — their files are
     already on disk, so adding one is instant. No installed.json (an older install or a dev copy) → everything is in. */
  let installedChecked = false;
  const added = () => { try { return JSON.parse(store.get('addedStyles', '[]')) || []; } catch (e) { return []; } };
  async function installedStyles() {
    if (installedChecked) return;
    installedChecked = true;
    let list = null;
    try {
      const r = await fetch(themeBase + 'src/installed.json', { cache: 'no-store' });
      if (r.ok) { const j = await r.json(); if (j && Array.isArray(j.installed)) list = j.installed; }
    } catch (e) { /* no file */ }
    if (!list) return;
    const have = new Set([...list, ...added()]);
    picker.querySelectorAll('.tp-card').forEach(c => markLocked(c, !have.has(c.dataset.value)));
  }
  function markLocked(card, locked) {
    card.classList.toggle('tp-locked', locked);
    let b = card.querySelector('.tp-get');
    if (locked && !b) {
      b = document.createElement('i'); b.className = 'tp-get';
      b.innerHTML = `${ic('download')}<span>${T('تحميل', 'Download')}</span>`;
      card.appendChild(b);
    }
    card.title = locked ? T('هذا الثيم مو محمّل — اضغط لتحميله وتشغيله', 'Not installed — click to add it and switch to it') : '';
  }
  /** a dimmed style was clicked: add it (a short progress fill on the card), then switch to it */
  async function addStyle(card) {
    if (card.classList.contains('tp-adding')) return;
    card.classList.add('tp-adding');
    sfx('tick');
    await new Promise(r => setTimeout(r, 650));
    const list = added();
    if (!list.includes(card.dataset.value)) { list.push(card.dataset.value); store.set('addedStyles', JSON.stringify(list)); }
    card.classList.remove('tp-adding');
    markLocked(card, false);
    toast(T('تم تحميل الثيم', 'Theme added'), 1800);
    Themes.apply(card.dataset.value);
  }
  /* update notice: twice a day the theme asks GitHub for the latest release and compares it with its own version
     (skin.json "version" = the release tag). Newer → a dot on THEMES in Steam's top bar and a banner in this picker
     whose button opens the download page in the browser. */
  const REPO = 'yousf612-alwazzan/game-shelf-steam-theme';
  const DOWNLOAD_PAGE = 'https://yousf612-alwazzan.github.io/game-shelf-steam-theme/';
  const Updater = {
    cur: '', latest: '',
    newer() {
      const p = v => String(v || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
      const a = p(this.latest), b = p(this.cur);
      if (!this.latest || !this.cur) return false;
      for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); }
      return false;
    },
    async check() {
      try {
        const sk = await (await fetch(themeBase + 'skin.json', { cache: 'no-store' })).json();
        this.cur = String((sk && sk.version) || '');
        let c = null;
        try { c = JSON.parse(store.get('update', 'null')); } catch (e) { c = null; }
        if (c && c.v && Date.now() - c.t < 12 * 3600e3) this.latest = c.v;
        else {
          const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
          if (r.ok) {
            const j = await r.json();
            this.latest = String(j.tag_name || '').replace(/^v/i, '');
            store.set('update', JSON.stringify({ t: Date.now(), v: this.latest }));
          }
        }
      } catch (e) { /* offline: try again next start */ }
      this.paint();
    },
    paint() {
      const on = this.newer();
      if (on) navTheme.dataset.upd = '1'; else delete navTheme.dataset.upd;
      navTheme.title = on ? T(`فيه تحديث جديد (${this.latest})`, `Update available (${this.latest})`) : T('غيّر تصميم الثيم', 'Change the theme design');
      const b = picker.querySelector('.tp-upd');
      b.hidden = !on;
      if (on) b.querySelector('b').textContent = T(`تحديث جديد متوفر: ${this.latest} (عندك ${this.cur})`, `Update available: ${this.latest} (you have ${this.cur})`);
    },
    open() { try { SteamAPI.steamUrl('steam://openurl_external/' + DOWNLOAD_PAGE); } catch (e) { /* ignore */ } },
  };
  if (!BPM) setTimeout(() => Updater.check(), 8000);

  /* pages: 12 cards (3 rows x 4) per page; more installed themes → arrows + "1 / 2" (and ← → keys) */
  const Pager = {
    page: 0, SIZE: 12,
    cards() { return [...picker.querySelectorAll('.tp-card')]; },
    pages() { return Math.max(1, Math.ceil(this.cards().length / this.SIZE)); },
    show(p) {
      const n = this.pages();
      this.page = Math.max(0, Math.min(n - 1, p));
      this.cards().forEach((c, i) => c.classList.toggle('pg-off', Math.floor(i / this.SIZE) !== this.page));
      const pager = picker.querySelector('.tp-pager');
      pager.hidden = n < 2;
      picker.querySelector('.tp-pgn').textContent = `${this.page + 1} / ${n}`;
      picker.querySelector('.tp-pg.prev').disabled = this.page === 0;
      picker.querySelector('.tp-pg.next').disabled = this.page === n - 1;
    },
    toCurrent() {
      const i = this.cards().findIndex(c => c.classList.contains('cur'));
      this.show(i < 0 ? 0 : Math.floor(i / this.SIZE));
    },
    step(d) { if (this.pages() > 1) { this.show(this.page + d); sfx('tick'); } },
  };
  const Themes = {
    open() {
      picker.querySelectorAll('.tp-card').forEach(c => c.classList.toggle('cur', c.dataset.sid === curStyle()));
      Pager.toCurrent();
      paintSoundSwitch();
      installedStyles().then(() => Pager.toCurrent());
      Updater.paint();
      picker.classList.add('on');
      Overlay.push('themes');
      sfx('tick');
    },
    close() { if (!picker.classList.contains('on')) return; picker.classList.remove('on'); picker.classList.remove('busy'); Overlay.pop('themes'); },
    isOpen() { return picker.classList.contains('on'); },
    /** Switch WITHOUT reloading Steam when both styles sit on the same community base (SpaceTheme: every style but
        Material You and Steam Original). A reload rebuilds all of Steam's data (900+ games) before the window even
        comes back — 15-30 s. Here the style sheet Millennium injected is swapped in every open Steam window, the
        choice is saved for the next start, and the home design follows within a frame. */
    async live(st) {
      const base = sid => sid === 'material' ? 'material' : sid === 'original' ? 'none' : 'space';
      if (!st || base(st.sid) !== 'space' || base(curStyle()) !== 'space') return false;
      const set = SteamAPI.ffi('Core_ChangeCondition');
      if (!set) return false;
      const docs = [document];
      try {
        const c = SteamAPI.ctx(), pm = c && c.g_PopupManager;
        for (const p of pm ? pm.GetPopups() : []) { const d = p.m_popup && p.m_popup.document; if (d && !docs.includes(d)) docs.push(d); }
      } catch (e) { /* popups keep their style until the next start */ }
      const mine = document.querySelector('link[href*="/src/styles/"]');
      if (!mine) return false;
      const href = mine.href.replace(/\/src\/styles\/[^/?#]+\.css/, `/src/styles/${st.sid}.css`);
      // the new design's own module (JS + CSS) starts loading now, alongside the style sheet — it used to wait until
      // the sheet was in and the next tick read --rf-layout (≈ 0.7 s more before the new home design appeared)
      if (st.layout && !['original', 'space', 'material'].includes(st.layout) && !LAYOUTS[st.layout] && (!BPM || BPM_LAYOUTS.has(st.layout))) loadLayout(st.layout);
      const r = await set(await SteamAPI.themeNative(), st.value, 'Style'); // remembered for the next start
      if (r && r.success === false) return false;
      try { localStorage.setItem('rfs.style', st.sid); } catch (e) { /* the store reads it */ }
      const swap = d => new Promise(done => {
        const old = d.querySelector('link[href*="/src/styles/"]');
        if (!old) { done(); return; }
        const nl = d.createElement('link');
        nl.rel = 'stylesheet'; nl.href = href; nl.id = old.id;
        // the old sheet goes only once the new one is in: no unstyled frame in between
        // only the sheets that were there before go: removing "every other one" raced with skin.js followStyle (its own
        // swap in the same window) — each removed the other's new sheet and the window was left with no style at all
        const olds = [...d.querySelectorAll('link[href*="/src/styles/"]')];
        let finished = false;
        const fin = () => { if (finished) return; finished = true; for (const l of olds) l.remove(); try { const w = d.defaultView; if (w && w.__rfsSkin && w.__rfsSkin.restyle) w.__rfsSkin.restyle(); } catch (e) { /* ignore */ } done(); };
        nl.onload = fin; nl.onerror = fin;
        old.after(nl);
        setTimeout(fin, 4000);
      });
      // the main window first; the ~25 popup windows (menus, mostly hidden) share its main thread, so they follow one
      // at a time once it is done instead of all restyling in the same moment as the main window
      await Promise.race([swap(document), new Promise(r => setTimeout(r, 4000))]);
      (async () => { for (const d of docs.slice(1)) { await new Promise(r => setTimeout(r, 16)); try { await swap(d); } catch (e) { /* closed meanwhile */ } } })();
      lastLayoutCheck = 0; placement.key = ''; tick(true);
      picker.classList.remove('busy'); clearTimeout(busyT);
      this.close();
      toast(T(`صار الثيم «${st.name}»`, `Theme is now “${st.name}”`), 2500);
      return true;
    },
    async apply(value) {
      const st = STYLES.find(s => s.value === value);
      if (st && st.sid === curStyle()) { this.close(); return; }
      pickerBusy();
      const nm = st ? st.name : value;
      toast(T(`جاري تطبيق «${nm}»… ستيم بيعيد تحميل الواجهة`, `Applying “${nm}”… Steam will reload its interface`), 6000);
      try { if (await this.live(st)) return; } catch (e) { LOG('live switch failed, reloading', e); }
      try { await SteamAPI.setStyle(value); }
      catch (e) {
        picker.classList.remove('busy');
        toast(T('ما قدرت أغيّر الثيم تلقائيًا — غيّره من: إعدادات ستيم ← Millennium ← Themes', 'Couldn\'t change the theme automatically — change it in Steam Settings → Millennium → Themes'), 6000);
      }
    },
  };

  /* ---- interface language (Millennium condition "Language": Arabic | English) */
  const Lang = {
    switching: false, // a switch / restart is already under way in this UI context — never start a second one
    /** the user picked a language here (picker switch or Ctrl+K) */
    async set(lang) {
      lang = normLang(lang);
      if (!lang || lang === LANG || this.switching) return;
      this.switching = true;
      store.set('lang', lang);
      pickerBusy();
      toast(T('جاري التحويل إلى العربية… ستيم بيعيد تحميل الواجهة', 'Switching to English… Steam will reload its interface', lang), 6000);
      try { await SteamAPI.setCondition('Language', lang === 'en' ? 'English' : 'Arabic'); }
      catch (e) {
        this.switching = false;
        store.set('lang', LANG);
        picker.classList.remove('busy');
        toast(T('ما قدرت أغيّر اللغة تلقائيًا — غيّرها من: إعدادات ستيم ← Millennium ← Themes', 'Couldn\'t switch the language automatically — change it in Steam Settings → Millennium → Themes'), 6000);
      }
    },
    toggle() { this.set(LTR ? 'ar' : 'en'); },
    /** Millennium's own settings changed the language (--rf-lang no longer matches): remember it and reload the UI once */
    follow(lang) {
      if (this.switching) return;
      this.switching = true;
      store.set('lang', lang);
      // loop guards: only restart if the new language was really saved (else the next start would come back here),
      // and never twice within 20 s
      const last = +store.get('langRestart', '0') || 0;
      if (store.get('lang', '') !== lang || Date.now() - last < 20000) { LOG('language is now', lang, '— not restarting the UI (loop guard)'); return; }
      store.set('langRestart', String(Date.now()));
      toast(T('تغيّرت اللغة — ستيم بيعيد تحميل الواجهة', 'Language changed — Steam is reloading its interface', lang), 4000);
      setTimeout(() => { try { SteamAPI.restartUI(); } catch (e) { LOG('restart failed', e); } }, 600);
    },
  };

  /* pointing at (or arrowing to) a style in the picker fetches its style sheet and its design module ahead of the
     click, so the switch itself only has to apply them: a first switch to a style waited ~0.5-1 s for its files */
  const prefetched = new Set();
  function prefetchStyle(value) {
    const st = STYLES.find(s => s.value === value);
    const mine = document.querySelector('link[href*="/src/styles/"]');
    if (!st || !mine || prefetched.has(st.sid)) return;
    prefetched.add(st.sid);
    const pre = (href, as) => { const l = document.createElement('link'); l.rel = 'preload'; l.as = as; l.href = href; l.dataset.rfsPre = st.sid; document.head.appendChild(l); };
    pre(mine.href.replace(/\/src\/styles\/[^/?#]+\.css/, `/src/styles/${st.sid}.css`), 'style');
    if (st.layout && !['original', 'space', 'material'].includes(st.layout) && !LAYOUTS[st.layout] && !EXT[st.layout] && (!BPM || BPM_LAYOUTS.has(st.layout))) {
      pre(themeBase + 'src/layouts/' + st.layout + '.css', 'style');
      pre(themeBase + 'src/layouts/' + st.layout + '.js', 'script');
    }
  }
  const onCardIntent = e => { const c = e.target.closest && e.target.closest('.tp-card'); if (c && !c.classList.contains('tp-locked')) prefetchStyle(c.dataset.value); };
  picker.addEventListener('pointerover', onCardIntent);
  picker.addEventListener('focusin', onCardIntent);
  picker.addEventListener('click', e => {
    const sb = e.target.closest('.tp-snd button');
    if (sb) { setSound(sb.dataset.snd === 'on'); return; }
    const lb = e.target.closest('.tp-lang:not(.tp-snd) button');
    if (lb) { if (!lb.classList.contains('on')) Lang.set(lb.dataset.lang); return; }
    if (e.target.closest('.tp-upd-go')) { Updater.open(); return; }
    const pg = e.target.closest('.tp-pg');
    if (pg) { Pager.step(pg.classList.contains('next') ? 1 : -1); return; }
    const card = e.target.closest('.tp-card');
    if (card) { if (card.classList.contains('tp-locked')) addStyle(card); else Themes.apply(card.dataset.value); return; }
    if (e.target.closest('.tp-close') || e.target.classList.contains('tp-back')) Themes.close();
  });

  const onKey = e => {
    if (BPM) { Bpm.key(e); return; } // Big Picture: Steam turns every key into its gamepad events, handled there
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK')) {
      e.preventDefault(); e.stopPropagation();
      Search.focus();
      return;
    }
    // theme picker pages: ← / → (the visual direction: in Arabic the next page is on the left)
    if (Themes.isOpen() && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault(); e.stopPropagation();
      const fwd = e.key === (LTR ? 'ArrowRight' : 'ArrowLeft');
      Pager.step(fwd ? 1 : -1);
      return;
    }
    if (e.key === 'Escape') {
      if (Themes.isOpen()) { e.stopPropagation(); Themes.close(); return; }
      if (current) { e.stopPropagation(); closeViewer(); return; }
    }
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (!typing && !current && !Themes.isOpen() && root.classList.contains('on') && L().key && L().key(e)) { e.preventDefault(); e.stopPropagation(); }
  };
  window.addEventListener('keydown', onKey, true);

  /* =================================================================
     placement: fills the whole library home panel
     ================================================================= */
  const placement = { mode: '', height: 0, key: '' };
  /* what the design on the stage was last built for: coming back to the library home with the same size, design and
     games, the built design is put back as it was instead of rebuilding 900+ games (docs/PERFORMANCE.md) */
  let renderedFor = '', routeChangedAt = 0, lastTickAt = 0;
  const renderKey = () => [placement.key, state.layout, state.sig, state.source, state.sort, state.genre, state.query, state.view, LANG].join('|');
  let loaded = false, lastSigCheck = 0, lastLayoutCheck = 0;
  function place(panel) {
    const upd = SteamAPI.updatesBlock();
    const pr = panel.getBoundingClientRect();
    if (upd && upd.parentElement && upd.parentElement.parentElement) {
      const wrapper = upd.parentElement, inner = wrapper.parentElement;
      // the What's New block is hidden while the design shows (unless the user turned it on): it takes no height then
      const wrapH = state.news ? wrapper.offsetHeight : 0; // read before any write (one layout instead of two)
      if (!upd.hasAttribute('data-rfs-upd')) upd.setAttribute('data-rfs-upd', '');
      if (!inner.hasAttribute('data-rfs-home')) inner.setAttribute('data-rfs-home', '');
      if (root.parentElement !== inner || root.previousElementSibling !== wrapper) wrapper.after(root);
      root.classList.remove('overlay');
      Object.assign(root.style, { left: '', top: '', width: '' });
      placement.mode = 'embed';
      placement.height = Math.max(520, Math.round(pr.height - wrapH));
      root.style.minHeight = placement.height + 'px';
    } else {
      if (root.parentElement !== document.body) document.body.appendChild(root);
      root.classList.add('overlay');
      placement.mode = 'overlay';
      placement.height = Math.round(pr.height);
      Object.assign(root.style, { left: pr.left + 'px', top: pr.top + 'px', width: pr.width + 'px', minHeight: '' });
      root.style.height = pr.height + 'px';
    }
  }
  /** smaller windows: drop the button labels first, then the dropdown names (icons + tooltips stay) */
  let fitKey = '';
  function fitBar(maxW) {
    // inside the home design the strip simply wraps onto a second line when space runs out
    if (bar.classList.contains('inhome')) { bar.classList.toggle('compact', false); bar.classList.toggle('tight', false); fitKey = ''; return; }
    const key = [maxW, bar.className.replace(/ ?(compact|tight)/g, ''), state.layout, state.games.length, state.genre, state.sort].join('|');
    if (key === fitKey) return;
    fitKey = key;
    bar.classList.remove('compact', 'tight');
    if (bar.scrollWidth > maxW) bar.classList.add('compact');
    if (bar.scrollWidth > maxW) bar.classList.add('tight');
  }
  /** the toolbar sits in Steam's navigation row, right of "Store · Library · Community …" */
  /* "Themes" sits in Steam's own navigation row — STORE · LIBRARY · COMMUNITY · <you> · CONSOLE · THEMES —
     and borrows a nav button's classes, so every theme (ours, SpaceTheme, Material, stock) styles it like the rest */
  const navTheme = document.createElement('div');
  navTheme.id = 'rfs-navtheme';
  navTheme.setAttribute('role', 'button');
  navTheme.tabIndex = 0;
  navTheme.title = T('غيّر تصميم الثيم', 'Change the theme design');
  navTheme.addEventListener('click', e => { e.stopPropagation(); Themes.isOpen() ? Themes.close() : Themes.open(); });
  navTheme.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); Themes.open(); } });
  const navWrap = document.createElement('div'); // mirrors Steam's per-item "MenuWrapper"
  navWrap.id = 'rfs-navwrap';
  navWrap.appendChild(navTheme);
  function placeNavTheme() {
    const sel = SteamAPI.sel('MenuButton', 'SuperNav');
    const btns = sel ? [...document.querySelectorAll(sel)].filter(b => b !== navTheme && b.getBoundingClientRect().width) : [];
    if (!btns.length) { navWrap.remove(); return false; }
    const last = btns[btns.length - 1];
    // each nav item lives in its own wrapper inside the nav row: add ours as the next wrapper
    const wrap = last.parentElement;
    const inRow = wrap && wrap.parentElement && wrap.parentElement.children.length > 2;
    if (inRow) {
      if (navWrap.previousElementSibling !== wrap) wrap.after(navWrap);
      if (navWrap.className !== wrap.className) navWrap.className = wrap.className;
    } else if (navWrap.previousElementSibling !== last) last.after(navWrap);
    // look like an unselected nav button (the one with the fewest classes)
    const plain = btns.reduce((a, b) => (b.classList.length < a.classList.length ? b : a));
    if (navTheme.dataset.cls !== plain.className) { navTheme.className = plain.className; navTheme.dataset.cls = plain.className; }
    const label = T('الثيمات', 'Themes');
    if (navTheme.textContent !== label) navTheme.textContent = label;
    navTheme.classList.toggle('rfs-open', Themes.isOpen());
    return true;
  }
  /** only write a style when it really changes — every write is a DOM change, and the community theme's page-wide
      :has() rules re-check the whole page on each one (this alone cost ~1.5 s of style work per 4 s of scrolling) */
  function setStyles(el, props) { for (const k in props) if (el.style[k] !== props[k]) el.style[k] = props[k]; }
  /** while the home design is on screen it is the ONLY game list, and our strip the only search and filter row:
      Steam's own left list (a second copy of every game, its search box, its filter funnel) goes. Anywhere else it comes back. */
  let leftHidden = [];
  function hideLeftFilters(inHome) {
    const want = [];
    let park = null; // the left list itself: parked off-screen, not display: none (see layouts.css)
    if (inHome) {
      // one list: the home design already shows every game, so Steam's whole left game list (with its search,
      // filters and the drag divider next to it) steps aside and the design gets the full width — the same
      // two elements Material You's own "hide left sidebar" option hides. Game pages keep Steam's list.
      const left = SteamAPI.el('LeftListSizableContainer');
      if (left) { want.push(left); park = left; }
      const dvSel = SteamAPI.sel('LibraryWindowDivider');
      const dv = dvSel && left && left.parentElement && [...left.parentElement.children].find(c => c.matches(dvSel));
      if (dv) want.push(dv);
    }
    for (const el of leftHidden) if (!want.includes(el)) el.removeAttribute('data-rfs-hide');
    for (const el of want) {
      const v = el === park ? 'park' : '';
      if (el.getAttribute('data-rfs-hide') !== v) el.setAttribute('data-rfs-hide', v);
    }
    leftHidden = want;
  }
  let navCheckAt = 0, navOk = false;
  /* ---- Family mode: a button that lives with the user name (footer or title bar, as the style puts it) and hides
     games not suitable for the family from the store. Saved as the theme condition "Family" (skin.json) — the store
     page reads it (webkit.js, within 3 s) and it survives restarts. */
  const famBtn = document.createElement('div');
  famBtn.id = 'rfs-family'; famBtn.setAttribute('role', 'button'); famBtn.tabIndex = 0;
  let famOn = themeVar('--rf-family', 'on') !== 'off', famKey = '';
  function paintFamily() {
    const key = LANG + famOn;
    if (famKey === key) return;
    famKey = key;
    famBtn.classList.toggle('on', famOn);
    famBtn.innerHTML = `${ic('shield')}<span class="lbl">${T('وضع العائلة', 'Family mode')}</span><i class="dot"></i>`;
    famBtn.title = famOn ? T('وضع العائلة شغّال: الألعاب غير المناسبة للعائلة مخفية من المتجر. اضغط لإطفائه', 'Family mode is on: games not suitable for the family are hidden from the store. Click to turn it off')
      : T('وضع العائلة مطفأ. اضغط لإخفاء الألعاب غير المناسبة للعائلة من المتجر', 'Family mode is off. Click to hide games not suitable for the family from the store');
  }
  async function toggleFamily() {
    famOn = !famOn; paintFamily(); sfx('tick');
    toast(famOn ? T('وضع العائلة شغّال', 'Family mode on') : T('وضع العائلة مطفأ', 'Family mode off'), 2200);
    try { const set = SteamAPI.ffi('Core_ChangeCondition'); if (set) await set(await SteamAPI.themeNative(), famOn ? 'On' : 'Off', 'Family'); }
    catch (e) { LOG('family mode not saved', e); }
  }
  famBtn.addEventListener('click', e => { e.stopPropagation(); toggleFamily(); });
  famBtn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleFamily(); } });
  /* ---- Downloads: a button next to the user name in every theme. The home designs hide Steam's left list and its
     bottom bar (where the download progress lived), so this is the way to the Downloads page — with live progress. */
  const dlBtn = document.createElement('div');
  dlBtn.id = 'rfs-dl'; dlBtn.setAttribute('role', 'button'); dlBtn.tabIndex = 0;
  dlBtn.innerHTML = `${ic('download')}<span class="lbl"></span><b class="pct"></b><i class="bar"><i></i></i>`;
  const openDownloads = () => { sfx('tick'); try { SteamAPI.navigate('/library/downloads'); } catch (e) { /* ignore */ } };
  dlBtn.addEventListener('click', e => { e.stopPropagation(); openDownloads(); });
  dlBtn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDownloads(); } });
  let dlKey = '';
  function paintDownloads() {
    let pct = -1, state = '', queued = 0;
    try {
      const ds = SteamAPI.ctx().downloadsStore;
      const ov = ds && (typeof ds.LocalDownloadOverview === 'function' ? ds.LocalDownloadOverview() : ds.LocalDownloadOverview);
      const q = ds && (typeof ds.QueuedTransfers === 'function' ? ds.QueuedTransfers() : ds.QueuedTransfers);
      queued = (q && q.length) || 0;
      if (ov && ov.update_appid && ov.update_state && ov.update_state !== 'None') { pct = ov.overall_percent_complete || 0; state = ov.paused ? 'paused' : 'active'; }
    } catch (e) { /* store not ready */ }
    const on = /^\/library\/downloads/.test(SteamAPI.route());
    const key = [LANG, pct, state, queued, on].join('|');
    if (key === dlKey) return;
    dlKey = key;
    dlBtn.classList.toggle('busy', pct >= 0);
    dlBtn.classList.toggle('paused', state === 'paused');
    dlBtn.classList.toggle('on', on);
    dlBtn.querySelector('.lbl').textContent = T('التنزيلات', 'Downloads');
    dlBtn.querySelector('.pct').textContent = pct >= 0 ? pct + '%' : (queued ? NUM.format(queued) : '');
    dlBtn.querySelector('.bar > i').style.width = (pct >= 0 ? pct : 0) + '%';
    dlBtn.title = pct >= 0 ? T(`جاري التنزيل ${pct}% — افتح صفحة التنزيلات`, `Downloading ${pct}% — open Downloads`) : T('صفحة التنزيلات والتحديثات', 'Downloads and updates');
  }
  function placeFamily() {
    const tb = SteamAPI.titleControls();
    if (!tb) return;
    const box = tb.querySelector('.userpanel-buttoncontainer') || tb;
    if (dlBtn.parentElement !== box) box.appendChild(dlBtn);
    if (famBtn.parentElement !== box) box.appendChild(famBtn);
    paintFamily();
    paintDownloads();
  }
  function placeBar(onHome, panel) {
    // the nav row rarely changes: re-place THEMES once a second (or at once if Steam re-rendered the row)
    const nowT = Date.now();
    // (not in the first half second after a page change: its size reads would force an extra full restyle then)
    if (!navWrap.isConnected || (nowT - navCheckAt > 1000 && nowT - routeChangedAt > 500)) { navCheckAt = nowT; navOk = placeNavTheme(); }
    else navTheme.classList.toggle('rfs-open', Themes.isOpen());
    bar.classList.toggle('has-nav', navOk);
    bar.classList.toggle('home', !!onHome);
    bar.classList.toggle('shelf-off', !!panel && !state.enabled);
    bar.classList.toggle('original', !!state.original);
    const inHome = !!onHome && !!panel && state.enabled && !state.original;
    hideLeftFilters(inHome);
    if (inHome) {
      if (!bar.classList.contains('inhome') || !root.contains(bar)) { if (root.classList.contains('on')) dockBar(); }
      if (root.contains(bar)) {
        setStyles(bar, { top: '', right: '', left: '', maxWidth: '' });
        bar.classList.toggle('on', true);
        fitBar(Math.round((bar.parentElement || root).clientWidth) - 8);
        return;
      }
    }
    if (root.contains(bar)) { document.body.appendChild(bar); }
    bar.classList.toggle('inhome', false);
    // home page with the design switched off: only "restore shelf" — in the nav row, clear of the window buttons
    if (!(onHome && panel && !state.enabled && !state.original)) { bar.classList.toggle('on', false); return; }
    const nav = SteamAPI.el('SuperNavBar') || SteamAPI.el('SuperNav');
    if (!nav) { bar.classList.toggle('on', false); return; }
    const nr = nav.getBoundingClientRect();
    const top = Math.round(nr.top + (nr.height - 30) / 2);
    let right = 14;
    for (const tc of [SteamAPI.titleControls(), document.querySelector('.title-bar-actions, .window-controls')]) {
      if (!tc) continue;
      const r = tc.getBoundingClientRect();
      if (r.width && r.bottom > top + 4 && r.top < top + 26) right = Math.max(right, Math.round(innerWidth - r.left + 12));
    }
    setStyles(bar, { top: top + 'px', right: right + 'px', left: '', maxWidth: '' });
    bar.classList.toggle('on', true);
  }
  async function tick(force) {
    if (!SteamAPI.ready() || !document.body) return;
    mount();
    const now = Date.now();
    lastTickAt = now;
    if (force || now - lastLayoutCheck > 800) {
      lastLayoutCheck = now;
      const lay = themeVar('--rf-layout', 'shelf');
      if (!BPM) Sfx.style(themeVar('--rf-sfx', '')); // the style's own sound pack (src/js/sfx-packs.js)
      const orig = lay === 'original'; // "Steam Original": leave Steam's home exactly as it is
      if (orig !== !!state.original) { state.original = orig; placement.key = ''; }
      document.documentElement.toggleAttribute('data-rfs-native', orig); // stock Steam / community theme is in charge
      if (lay !== state.layout && lay !== 'original') {
        if (LAYOUTS[lay] || EXT[lay]) { state.layout = lay; placement.key = ''; }
        else if (!BPM || BPM_LAYOUTS.has(lay)) loadLayout(lay); // a plug-in theme: its module registers itself, then the next tick switches to it
      }
      // only the chosen design's stylesheet stays on: every loaded one was matched against the whole page on each
      // style recalc (5 designs loaded after a few switches = ~20 % more style work on every change)
      for (const l of document.querySelectorAll('link[data-rfs-layout]')) { const m = l.dataset.rfsLayout === lay ? '' : 'not all'; if (l.media !== m) l.media = m; }
      // language changed behind our back (Millennium settings) → reload the UI once in the new language
      const lang = normLang(themeVar('--rf-lang', ''));
      if (!BPM && lang && lang !== LANG) Lang.follow(lang);
    }
    const panel = SteamAPI.isLibraryHome() ? SteamAPI.rightPanel() : null;
    const want = themeVar('--rf-layout', 'shelf');
    const ready = state.original || want === state.layout || !(want in EXT || extLoading[want]); // don't flash another design while a plug-in loads
    const show = !!panel && state.enabled && !state.original && ready &&
      (!BPM || (want === state.layout && BPM_LAYOUTS.has(state.layout) && document.documentElement.dataset.rfsBpm === 'on'));
    document.documentElement.classList.toggle('rfs-home-on', show);
    // the community theme's styling for Steam's own home is costly (page-wide :has() checks on every change) and
    // pointless while our design covers that page — switch it off then, back on for Steam's own home
    for (const l of document.querySelectorAll('link[data-rfs-part="home"]')) { const m = show ? 'not all' : ''; if (l.media !== m) l.media = m; }
    document.documentElement.classList.toggle('rfs-show-news', state.news);
    if (!BPM) { placeBar(SteamAPI.isLibraryHome(), panel); placeFamily(); }
    if (panel && show) {
      const pr = panel.getBoundingClientRect();
      const key = [Math.round(pr.width), Math.round(pr.height), state.layout, state.news].join(',');
      const misplaced = !root.isConnected || (placement.mode === 'embed' && !root.parentElement.hasAttribute('data-rfs-home')) || Bpm.misplaced();
      if (key !== placement.key || force || misplaced) {
        const changed = key !== placement.key;
        placement.key = key;
        if (BPM) Bpm.place(panel); else place(panel);
        // never rebuild for the size the design already has; and coming back to the home page, the design built
        // last time is re-attached first (just below) — Steam's home settles its size over a few frames
        const back = !BPM && !root.classList.contains('on') && !!stage.firstElementChild;
        if (loaded && (force || (changed && !back && renderedFor !== renderKey()))) render();
      }
    }
    if (show && !root.classList.contains('on')) {
      root.classList.add('on');
      if (!loaded) { try { Data.load(); loaded = true; } catch (err) { LOG('load failed', err); } }
      // back from a game page / the store with nothing changed: the design built last time is already in #rfs
      // (place() re-attached it) — keep it instead of rebuilding it (Big Picture always rebuilds: its pad focus lives there)
      const rk = renderKey(), sameButSize = renderedFor.split('|').slice(1).join('|') === rk.split('|').slice(1).join('|');
      if (BPM || !stage.firstElementChild || (renderedFor !== rk && !sameButSize)) render();
      else {
        dockBar(); updateBar(); // the filter strip went to <body> while away: back into its slot
        // only the size differs (often a frame of Steam's own transition): look again shortly and rebuild only if it stays
        if (renderedFor !== rk) { placement.key = '?'; setTimeout(() => tick(false), 120); }
      }
    } else if (!show && root.classList.contains('on')) {
      root.classList.remove('on'); hideTip();
      if (BPM) Bpm.off();
      if (current && current.sheet) closeViewer(true); // a theme's own game panel leaves with the home page
    }
    if (show && !BPM) Search.focusIfPending();
    if (BPM) Bpm.tick(show, panel); else Sfx.sync(show);
    if (show && loaded && now - lastSigCheck > 5000 && !current) {
      lastSigCheck = now;
      if (Data.sig() !== state.sig) { Data.load(); render(); }
    }
  }
  /* ---- plug-in layout API (docs/THEME-KIT.md). Everything a home design needs, nothing it could break. */
  window.__rfsLayoutApi = {
    version: 1,
    register(id, layout) {
      if (!id || !layout || typeof layout.render !== 'function') return;
      EXT[id] = layout;
      LOG('layout registered:', id);
      if (themeVar('--rf-layout', '') === id) { lastLayoutCheck = 0; placement.key = ''; tick(true); }
    },
    // where things are
    root, stage, state, get layoutId() { return state.layout; },
    // text + formatting (Arabic / English)
    T, get LANG() { return LANG; }, get LTR() { return LTR; }, NUM, fmtPlaytime, fmtAgo, fmtSize,
    // DOM helpers
    esc, div, $, clamp, rand, first, cssUrl, absUrl, ic, icT, imgWithFallback,
    // games
    visibleGames, byId, Data, SORTS, lazy, running: () => SteamAPI.runningIds(),
    // actions
    openGame, launch, openDetails: appid => SteamAPI.openDetails(appid), rerender: () => render(),
    // a theme's own game panel (layout.open(g, sheet, src) / layout.close(sheet, g)): facts, text and wired buttons
    gameFacts, gameDesc, gameActions, gameBytes, sizeText, steamLevel, steamLevelNow, gameAch, achHTML, closeGame: () => closeViewer(), get openId() { return current ? current.appid : null; },
    openStore: appid => SteamAPI.steamUrl('steam://store/' + appid), steamUrl: url => SteamAPI.steamUrl(url),
    showTip, hideTip, sfx, toast,
  };

  /* ---- Arabic for the whole Steam client. Steam ships no Arabic interface, so when the theme language is Arabic we
     replace Steam's own interface strings (LocalizationManager tokens, in SharedJSContext) with our translation in
     src/lang/steam-ar.js. Steam re-renders with them; strings we haven't translated simply stay English. */
  (function steamArabic() {
    if (LANG !== 'ar' || BPM) return; // Big Picture shares the desktop's LocalizationManager: already Arabic
    const me = document.querySelector('script[src*="/src/js/shelf.js"]');
    const base = me ? me.src.replace(/src\/js\/shelf\.js.*$/, '') : 'https://millennium.host/v1/themes/rf-shelf/';
    const apply = () => {
      let lm = null;
      try { lm = SteamAPI.ctx() && SteamAPI.ctx().LocalizationManager; } catch (e) { /* not ready */ }
      const tokens = window.__rfsSteamAr;
      if (!lm || !tokens || !lm.m_mapTokens || lm.m_mapTokens.size < 1000) return false;
      // dates, numbers and lists ("Games and Software" → "ألعاب وبرامج") follow Arabic, keeping Western digits
      try { lm.SetPreferredLocales(['ar-u-nu-latn', 'en']); } catch (e) { /* older Steam */ }
      lm.AddTokens(tokens);
      // re-render the page on screen so it picks the Arabic strings up at once
      try { const p = SteamAPI.route(); if (/^\/library/.test(p)) SteamAPI.navigate(p); } catch (e) { /* ignore */ }
      LOG('Steam interface in Arabic:', Object.keys(tokens).length, 'strings');
      return true;
    };
    const s = document.createElement('script');
    s.src = base + 'src/lang/steam-ar.js';
    s.onload = () => { let n = 0; const t = setInterval(() => { if (apply() || ++n > 60) clearInterval(t); }, 250); };
    document.head.appendChild(s);
  })();

  /* =================================================================
     Big Picture host — the theme's home design over Big Picture's home (/library/home), sized for a TV and driven by
     a controller. Steam's gamepad UI sends no arrow keys: it fires 'vgp_onbuttondown' (detail.button, .is_repeat,
     .source: 1 gamepad, 2 keyboard) on the element its own focus system has focused. While our design owns the
     input (Steam's focus sits in the home content we cover), each press becomes the key the layouts already
     understand (arrows / Enter / Esc / PageUp / PageDown / Ctrl+Enter) and is eaten, so Steam's focus stays put
     underneath. A direction the design doesn't use moves to the nearest button of the design that way (PLAY, INFO,
     STORE …), and in a game panel the D-pad walks its buttons. Up at the top of a design and B go on to Steam: its top
     bar (search, avatar, Themes), side menu and the rest of Big Picture work as before. X plays, Menu (≡ / F9) opens
     Steam's game page with its options, View (F8) opens friends & chat, Y (F4) the Themes picker. The Steam button
     (side menu) and quick access never come through here. Big Picture's own interface sounds play for every move.
     ================================================================= */
  const Bpm = (() => {
    const noop = () => {};
    if (!BPM) return { place: noop, off: noop, tick: noop, placeSheet: noop, key: noop, destroy: noop, misplaced: () => false };
    const P = { OK: 1, CANCEL: 2, X: 3, Y: 4, LB: 5, RB: 6, LT: 7, RT: 8, UP: 9, DOWN: 10, LEFT: 11, RIGHT: 12, SELECT: 13, START: 14 };
    const KEY = { [P.UP]: 'ArrowUp', [P.DOWN]: 'ArrowDown', [P.LEFT]: 'ArrowLeft', [P.RIGHT]: 'ArrowRight', [P.OK]: 'Enter', [P.CANCEL]: 'Escape',
      [P.LB]: 'PageUp', [P.RB]: 'PageDown', [P.LT]: 'Home', [P.RT]: 'End' };
    const DIR = { [P.UP]: [0, -1], [P.DOWN]: [0, 1], [P.LEFT]: [-1, 0], [P.RIGHT]: [1, 0] };
    const NAV_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'PageUp', 'PageDown', 'Home', 'End', ' ']);
    const html = document.documentElement;
    let Z = 1.3, rect = null, padF = null, legendKey = '', zone = 'list', kbd = false, selectDown = 0;
    const legend = div(); legend.id = 'rfs-bpm-legend';
    const eat = e => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); };
    const zoomOf = () => { const v = parseFloat(getComputedStyle(root).getPropertyValue('--rfs-bpm-zoom')); return v >= 0.6 && v <= 3 ? v : 1.3; };
    const pickerOpen = () => { try { return !!(window.__rfsBpm && window.__rfsBpm.isOpen && window.__rfsBpm.isOpen()); } catch (e) { return false; } };
    const gpWin = () => { try { return SteamAPI.ctx().SteamUIStore.WindowStore.GamepadUIMainWindowInstance; } catch (e) { return null; } };

    /* Big Picture's own interface sounds (the theme's synthesised sounds stay off here): the same calls Steam makes
       when its focus moves. EUIComposition-independent enum from steamui: 24 BasicNav, 25 FailedNav, 21 DefaultOk,
       15 PagedNavigation, 13 IntoGameDetail, 14 OutOfGameDetail */
    const SND = { move: 24, fail: 25, ok: 21, page: 15, into: 13, out: 14 };
    function snd(kind) {
      try { const a = SteamAPI.ctx().SteamUIStore.m_GamepadUIAudioStore; if (a && a.PlayNavSound) a.PlayNavSound(SND[kind]); } catch (e) { /* no sound */ }
    }

    /** our design has the controller: on screen, no picker, nothing of Steam's on top of it (dialog, menu, chat,
        on-screen keyboard), and Steam's own focus sits in the home content we cover (not in its top bar) */
    function active() {
      if (!root.classList.contains('on') || !rect || pickerOpen()) return false;
      try { if (gpWin().m_MenuStore.IsAnySideMenuVisible()) return false; } catch (e) { /* older Steam */ } // main menu / quick access
      const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      if (top && !root.contains(top) && !sheet.contains(top)) return false;
      const f = document.activeElement;
      if (!f || f === document.body || f === html || root.contains(f) || sheet.contains(f)) return true;
      const home = SteamAPI.el('BasicHome');
      if (home && !home.contains(f)) return false;
      const r = f.getBoundingClientRect();
      return r.top + r.height / 2 >= rect.top;
    }
    /** a key for the layout's own key(e) handler (the same one the desktop keyboard uses) */
    function send(key, mods = {}, rep = false) {
      const lay = L();
      if (!lay.key) return false;
      const ev = { type: 'keydown', key, code: key, ctrlKey: !!mods.ctrl, shiftKey: !!mods.shift, altKey: false, metaKey: false, repeat: !!rep,
        target: root, currentTarget: root, preventDefault: noop, stopPropagation: noop, stopImmediatePropagation: noop };
      try { return !!lay.key(ev); } catch (err) { LOG('pad key failed', err); return false; }
    }
    const visible = el => { const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(el).visibility !== 'hidden'; };
    /** the layout's selected game: its element (cursor classes the layouts use) and the game */
    function selEl() {
      const lay = L();
      if (typeof lay.padEl === 'function') { const el = lay.padEl(); if (el) return el; }
      const list = [...root.querySelectorAll('[data-appid]:is(.kf, .sel, .kb, .cur, .hi)')].filter(visible);
      return list[0] || null;
    }
    function selGame() {
      const lay = L();
      if (typeof lay.padGame === 'function') { const g = lay.padGame(); if (g) return g; }
      const el = selEl();
      return el ? byId(el.dataset.appid) : null;
    }
    /** X: play the game under the cursor (a layout may say which one; otherwise its own Ctrl / Shift + Enter) */
    function play() {
      const lay = L();
      if (typeof lay.padGame === 'function') { const g = lay.padGame(); if (g) { snd('ok'); launch(g); } else snd('fail'); return; }
      if (send('Enter', { ctrl: true }) || send('Enter', { shift: true })) { snd('ok'); return; }
      snd('fail');
    }

    /* ---- spatial focus over buttons (the theme's game panel, and the buttons around a design's game list:
       PLAY / DETAILS / STORE …). The D-pad goes to the nearest one in that direction; A presses it. */
    /** scroll every scrolling box between el and box so el is fully in view. scrollIntoView() gets this wrong inside
        a CSS-zoomed box (it measures the unzoomed size), so the designs' own calls left the cursor half off screen. */
    function reveal(el, box) {
      if (!el || !el.isConnected || !box.contains(el)) return;
      const m = 14;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const cs = getComputedStyle(p);
        const sy = /(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 1;
        const sx = /(auto|scroll)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 1;
        if (sy || sx) {
          const er = el.getBoundingClientRect(), pr = p.getBoundingClientRect();
          if (sy) {
            if (er.top < pr.top + m || er.height > pr.height - 2 * m) p.scrollTop -= pr.top + m - er.top;
            else if (er.bottom > pr.bottom - m) p.scrollTop += er.bottom - pr.bottom + m;
          }
          if (sx) {
            if (er.left < pr.left + m) p.scrollLeft -= pr.left + m - er.left;
            else if (er.right > pr.right - m) p.scrollLeft += er.right - pr.right + m;
          }
        }
        if (p === box) break;
      }
    }
    /** the panel the D-pad walks button by button: the theme's game panel, or a panel a design raises over its own
        home (layout.padScope(), e.g. Shelter OS's wrist terminal with its STAT / DATA tabs) */
    function panelEl() {
      if (current && current.sheet) return sheet;
      const lay = L();
      if (current || typeof lay.padScope !== 'function') return null;
      try { const s = lay.padScope(); return s && s.isConnected && root.contains(s) ? s : null; } catch (e) { return null; }
    }
    const revealSoon = () => requestAnimationFrame(() => {
      const ps = panelEl();
      if (ps) reveal(padF, ps === sheet ? sheet : root);
      else reveal(zone === 'acts' ? padF : selEl(), root);
    });
    function setPadF(el) {
      if (padF === el) return;
      if (padF) padF.classList.remove('rfs-padf');
      padF = el || null;
      if (!padF) return;
      padF.classList.add('rfs-padf');
      // inside a panel the cursor is also the real focus: no second (:focus) ring left on the button it came from
      if (panelEl() && padF.focus) { try { padF.focus({ preventScroll: true }); } catch (e) { /* not focusable */ } }
      revealSoon();
    }
    const BTN = 'button, a[href], [data-act], [data-close], [role="button"]';
    /** buttons of the panel, or of the design outside its game tiles (a tile repeated in a list is the layout's job) */
    function btns(scope) {
      // [data-nopad]: a duplicate the D-pad skips (Shelter OS's dial labels repeat its tabs)
      const all = [...scope.querySelectorAll(BTN)].filter(b => !b.disabled && !b.hasAttribute('data-nopad') && visible(b) && !b.closest('.rf-dock, [hidden]'));
      const own = all.filter(b => !all.some(o => o !== b && o.contains(b)));
      const sr = scope.getBoundingClientRect();
      // a panel: everything but its click-outside backdrop (a [data-close] veil the size of the panel)
      if (scope !== root) return own.filter(b => { const r = b.getBoundingClientRect(); return r.width * r.height < sr.width * sr.height * 0.5; });
      const big = sr.width * sr.height * 0.2;
      return own.filter(b => {
        if (b.hasAttribute('data-appid') || b.getAttribute('tabindex') === '-1') return false; // tiles, and helper arrows the design keeps out of tab order
        const r = b.getBoundingClientRect();
        if (r.width * r.height > big) return false; // a clickable backdrop (hero art), not a button
        const it = b.closest('[data-appid]');
        return !(it && it.parentElement && it.parentElement.querySelectorAll(':scope > [data-appid]').length > 2);
      });
    }
    function nearest(list, from, dx, dy) {
      const ax = from.left + from.width / 2, ay = from.top + from.height / 2;
      let best = null, bs = Infinity;
      for (const b of list) {
        if (b === padF) continue;
        const r = b.getBoundingClientRect(), x = r.left + r.width / 2 - ax, y = r.top + r.height / 2 - ay;
        const main = dx ? x * dx : y * dy, side = dx ? Math.abs(y) : Math.abs(x);
        if (main <= 4) continue;
        const sc = main + side * 2.5;
        if (sc < bs) { bs = sc; best = b; }
      }
      return best;
    }
    function sheetDefault(ps = sheet) {
      const list = btns(ps);
      setPadF(list.find(b => b.matches('[data-act="play"]')) || list.find(b => b.matches('.sel:not([role="tab"])'))
        || list.find(b => !b.matches('[data-close], [role="tab"]')) || list[0]);
    }
    /** LB / RB: the panel's previous / next tab (ITEM · DATA · STAT …) */
    function panelTab(ps, step) {
      const tabs = [...ps.querySelectorAll('[role="tab"]')].filter(t => !t.hasAttribute('data-nopad') && visible(t));
      if (tabs.length < 2) { snd('fail'); return; }
      const at = Math.max(0, tabs.findIndex(t => t.getAttribute('aria-selected') === 'true' || t.classList.contains('on')));
      const nx = tabs[at + step];
      if (!nx) { snd('fail'); return; }
      const onTab = padF && padF.matches('[role="tab"]');
      nx.click(); snd('page');
      if (onTab) setPadF(nx);
      else requestAnimationFrame(() => { if (!padF || !padF.isConnected || !visible(padF)) sheetDefault(ps); });
    }
    function sheetPad(b, ps = sheet) {
      const d = DIR[b];
      if (d) {
        const list = btns(ps);
        if (!padF || !padF.isConnected || !list.includes(padF)) { sheetDefault(ps); snd('move'); return; }
        const n = nearest(list, padF.getBoundingClientRect(), d[0], d[1]);
        if (n) { setPadF(n); snd('move'); } else snd('fail');
        return;
      }
      switch (b) {
        case P.OK: if (!padF || !padF.isConnected || !ps.contains(padF)) sheetDefault(ps); if (padF) { snd('ok'); padF.click(); } break;
        case P.CANCEL: snd('out'); if (ps === sheet) closeViewer(); else { send('Escape'); setPadF(null); } break;
        case P.LB: panelTab(ps, -1); break;
        case P.RB: panelTab(ps, 1); break;
        case P.X: {
          const g = padF && padF.isConnected && padF.dataset.appid ? byId(padF.dataset.appid) : null; // a game row of the panel
          const pb = ps.querySelector('[data-act="play"]');
          if (g) { snd('ok'); launch(g); } else if (pb && visible(pb)) { snd('ok'); pb.click(); } else snd('fail');
          break;
        }
        case P.START: if (ps === sheet) options(); break;
        default: break;
      }
    }
    /** a direction the design's list didn't use: on to the nearest button of the design that way (zone 'acts') */
    function enterActs(dx, dy) {
      const list = btns(root);
      if (!list.length) return false;
      const from = selEl();
      const rr = root.getBoundingClientRect();
      const fr = from ? from.getBoundingClientRect() : { left: rr.left + rr.width / 2, top: rr.top + rr.height / 2, width: 0, height: 0 };
      let n = nearest(list, fr, dx, dy);
      if (!n) return false;
      // the first row of buttons that way: start on its PLAY button when it has one
      const ax = fr.left + fr.width / 2, ay = fr.top + fr.height / 2;
      const mainOf = el => { const r = el.getBoundingClientRect(); return dx ? (r.left + r.width / 2 - ax) * dx : (r.top + r.height / 2 - ay) * dy; };
      const m0 = mainOf(n);
      const play = list.find(el => el.matches('[data-act="play"], .play, [class*="play"]') && Math.abs(mainOf(el) - m0) < 30);
      if (play) n = play;
      zone = 'acts'; setPadF(n); snd('move');
      return true;
    }
    function actsPad(b) {
      const d = DIR[b];
      if (d) {
        const list = btns(root);
        const n = padF && padF.isConnected ? nearest(list, padF.getBoundingClientRect(), d[0], d[1]) : null;
        if (n) { setPadF(n); snd('move'); return; }
        // nothing further that way: a design may take the cursor on from there (Neon Coverflow: down into its
        // "All games" grid), otherwise back to the games
        const lay = L();
        const on = typeof lay.padEdge === 'function' && lay.padEdge(d[0], d[1]);
        leaveActs(); snd('move');
        if (on) revealSoon();
        return;
      }
      if (b === P.OK) {
        if (!padF || !padF.isConnected) { leaveActs(); return; }
        const before = selEl();
        snd('ok'); padF.click();
        if (selEl() !== before) { leaveActs(); revealSoon(); } // the button moved the design's own cursor (e.g. "Browse all games")
        return;
      }
      if (b === P.CANCEL) { leaveActs(); snd('out'); return; }
      if (b === P.X) { const g = selGame(); if (g) { snd('ok'); launch(g); } else snd('fail'); }
    }
    function leaveActs() { zone = 'list'; setPadF(null); }

    /** ≡ Options: Steam's own game page for the selected game (its full options: properties, manage, achievements …) */
    function options() {
      const g = selGame();
      if (!g) { snd('fail'); return; }
      snd('into');
      try { gpWin().m_Navigator.App(g.appid); } catch (e) { SteamAPI.openDetails(g.appid); }
    }
    /** View: Big Picture's friends & chat */
    function friends() { snd('into'); try { gpWin().m_Navigator.Chat(); } catch (e) { /* older Steam */ } }

    function onPad(e) {
      const d = e.detail || {}, b = d.button;
      if (!active()) return;
      if (d.source) kbd = d.source === 2;
      const rep = !!d.is_repeat;
      if (b === P.SELECT) { eat(e); if (!rep) selectDown = Date.now(); return; } // View: on release (View + Y stays the picker)
      if (selectDown) selectDown = -1; // another button while View is held: not "Friends"
      if (b === P.Y) { eat(e); if (!rep && d.source !== 2) { try { window.__rfsBpm.open(); } catch (err) { /* no picker */ } } return; } // keyboard F4: bigpicture.js
      const ps = panelEl();
      if (ps) { eat(e); if (!busy && (!rep || DIR[b])) sheetPad(b, ps); return; }
      if (current) { eat(e); if (b === P.CANCEL) closeViewer(); return; }
      // LT: a design's extra panel (Shelter OS: raise the wrist terminal with the library STAT / DATA)
      if (b === P.LT && typeof L().padAux === 'function') { eat(e); if (!rep) { leaveActs(); snd('into'); try { L().padAux(); } catch (err) { LOG('pad aux failed', err); } } return; }
      if (b === P.X) { eat(e); if (!rep) play(); return; }
      if (b === P.START) { eat(e); if (!rep) options(); return; }
      if (zone === 'acts') {
        if (padF && padF.isConnected && root.contains(padF)) { eat(e); actsPad(b); return; }
        leaveActs();
      }
      const k = KEY[b];
      if (!k) return;
      if (b === P.OK) {
        const g = selGame(), lay = L();
        // A always OPENS (a layout whose Enter plays says how to open instead); X is the one that plays
        if (rep) { eat(e); return; }
        if (typeof lay.padOk === 'function' ? lay.padOk() : send(k, {}, rep)) { eat(e); snd(g ? 'into' : 'ok'); return; }
      } else {
        const before = DIR[b] ? selEl() : null;
        if (send(k, {}, rep)) {
          // the design used the press but its cursor didn't move (the edge of a row, the top of a grid): on to the
          // buttons that way — the hero's PLAY / DETAILS, a side panel's START / INFO …
          if (before && selEl() === before) {
            if (enterActs(...DIR[b])) { eat(e); return; }
            if (b === P.UP) return; // the top of the design: Up goes on to Steam's top bar (search, avatar, Themes)
          }
          eat(e);
          snd(b === P.LB || b === P.RB || b === P.LT || b === P.RT ? 'page' : b === P.CANCEL ? 'out' : 'move');
          revealSoon();
          return;
        }
      }
      if (DIR[b] && enterActs(...DIR[b])) { eat(e); return; }
      if (b === P.UP || b === P.CANCEL) return; // top of the design → Steam's top bar (search, avatar, Themes); B → Steam
      eat(e); snd('fail'); // everything else stays with us, so Steam's hidden focus never wanders
    }
    function onPadUp(e) {
      const d = e.detail || {};
      if (d.button !== P.SELECT || !selectDown) return;
      const was = selectDown; selectDown = 0;
      if (!active()) return;
      eat(e);
      if (was > 0 && Date.now() - was < 800) friends();
    }
    window.addEventListener('vgp_onbuttondown', onPad, true);
    window.addEventListener('vgp_onbuttonup', onPadUp, true);

    /* footer hints: controller glyphs, or Steam's keyboard keys when the last press came from the keyboard */
    const CAP = {
      pad: { a: 'A', b: 'B', x: 'X', y: 'Y', lb: 'LB', rb: 'RB', st: '≡', vw: '⧉' },
      kbd: { a: 'Enter', b: 'Esc', x: 'F3', y: 'F4', lb: 'F6', rb: 'F7', st: 'F9', vw: 'F8' },
    };
    function paintLegend(show, act) {
      const ps = panelEl();
      const mode = ps ? 's' : zone === 'acts' ? 'a' : 'h';
      const tabs = !!(ps && ps.querySelector('[role="tab"]'));
      const aux = mode === 'h' && !kbd && typeof L().padAux === 'function' ? String(L().padAuxLabel || '') : '';
      const k = !show || !act ? '' : [mode, LANG, kbd ? 'k' : 'p', tabs, aux].join();
      if (k === legendKey) return;
      legendKey = k;
      legend.classList.toggle('on', !!k);
      if (!k) return;
      const c = CAP[kbd ? 'kbd' : 'pad'];
      const h = (cls, cap, txt) => `<span class="lg"><kbd class="${cls}${kbd ? ' key' : ''}">${cap}</kbd>${txt ? `<span>${esc(txt)}</span>` : ''}</span>`;
      legend.dir = LTR ? 'ltr' : 'rtl';
      legend.innerHTML = mode === 's'
        ? `${tabs ? h('bump', c.lb, '') + h('bump', c.rb, T('الأقسام', 'Tabs')) : ''}<span class="sp"></span>${h('a', c.a, T('اختيار', 'Select'))}${h('x', c.x, T('تشغيل', 'Play'))}${h('y', c.y, T('الثيمات', 'Themes'))}${h('b', c.b, T('رجوع', 'Back'))}`
        : mode === 'a'
          ? `<span class="sp"></span>${h('a', c.a, T('اختيار', 'Select'))}${h('b', c.b, T('رجوع للألعاب', 'Back to games'))}`
          : `${h('bump', c.lb, '')}${h('bump', c.rb, T('صفحة', 'Page'))}${aux ? h('bump', 'LT', aux) : ''}${h('menu', c.vw, T('الأصدقاء', 'Friends'))}<span class="sp"></span>${h('a', c.a, T('فتح', 'Open'))}${h('x', c.x, T('تشغيل', 'Play'))}${h('menu', c.st, T('خيارات', 'Options'))}${h('y', c.y, T('الثيمات', 'Themes'))}`;
    }

    return {
      host() { return SteamAPI.el('BasicHome') || document.body; },
      misplaced() { return root.parentElement !== this.host() || (sheet.isConnected && sheet.parentElement !== this.host()); },
      place(panel) {
        root.dataset.layout = state.layout;
        // inside Steam's own home (not <body>): Steam's dialogs, menus and on-screen keyboard still open above us
        const host = this.host();
        if (root.parentElement !== host) host.appendChild(root);
        if (sheet.parentElement !== host) host.appendChild(sheet);
        root.classList.add('overlay');
        Z = zoomOf();
        const r = panel.getBoundingClientRect();
        rect = r;
        placement.mode = 'overlay';
        placement.height = Math.round(r.height / Z);
        setStyles(root, { zoom: String(Z), left: '0px', top: (r.top / Z).toFixed(2) + 'px', width: (r.width / Z).toFixed(2) + 'px', height: placement.height + 'px', minHeight: '' });
        // the button hints sit inside Big Picture's footer (absolute, inset 0): it paints above its siblings
        const ft = SteamAPI.el('BasicFooter');
        if (ft && legend.parentElement !== ft) ft.appendChild(legend);
        else if (!ft) legend.remove();
        if (current && current.sheet) this.placeSheet();
      },
      placeSheet() {
        if (!rect) return;
        setStyles(sheet, { zoom: String(Z), left: '0px', top: (rect.top / Z).toFixed(2) + 'px', width: (rect.width / Z).toFixed(2) + 'px', height: (rect.height / Z).toFixed(2) + 'px' });
      },
      tick(show) {
        const act = show && active();
        html.classList.toggle('rfs-bpm-home', show);
        root.classList.toggle('pad-idle', show && !act);
        const ps = panelEl();
        if (ps) { zone = 'list'; if ((!padF || !padF.isConnected || !ps.contains(padF) || !visible(padF)) && !busy) sheetDefault(ps); }
        else if (zone === 'acts' && (!padF || !padF.isConnected)) leaveActs();
        else if (zone !== 'acts' && padF) setPadF(null);
        paintLegend(show, act);
      },
      off() { html.classList.remove('rfs-bpm-home'); paintLegend(false, false); leaveActs(); },
      /** keyboard in Big Picture: Steam already sends each key as a gamepad event (source 2) — don't act twice */
      key(e) {
        if (NAV_KEYS.has(e.key) && active()) { e.preventDefault(); e.stopPropagation(); }
      },
      destroy() {
        window.removeEventListener('vgp_onbuttondown', onPad, true);
        window.removeEventListener('vgp_onbuttonup', onPadUp, true);
        legend.remove(); html.classList.remove('rfs-bpm-home');
      },
    };
  })();

  const tickTimer = setInterval(() => { if (!document.hidden && Date.now() - lastTickAt > 150) tick(false); }, 300); // nothing to do while Steam is hidden (or just ticked for a page change)
  /* a page change is acted on in the next frame instead of at the next 300 ms tick (on average 150 ms sooner home
     design / Steam page). The route is one string read — no DOM work — so checking it often costs nothing. Coming
     back to the library home, the tick waits for Steam's own home to be in the DOM (our design sits right under it). */
  let lastRoute = '', routeRaf = 0, routeTries = 0; // routeChangedAt: declared with the tick state
  const routeKick = () => {
    routeRaf = 0;
    if (document.hidden) return;
    if (!BPM && SteamAPI.isLibraryHome() && !SteamAPI.updatesBlock() && ++routeTries < 30) { routeRaf = requestAnimationFrame(routeKick); return; }
    // the 300 ms tick already handled this page (each tick forces a restyle, so never two in a row for nothing)
    if (lastTickAt >= routeChangedAt && (!SteamAPI.isLibraryHome() || root.classList.contains('on') || BPM)) return;
    tick(false);
  };
  const routeTimer = setInterval(() => {
    if (document.hidden) return;
    const r = SteamAPI.route();
    if (r === lastRoute) return;
    lastRoute = r; routeTries = 0; routeChangedAt = Date.now();
    if (!routeRaf) routeRaf = requestAnimationFrame(routeKick);
  }, 40);

  /* ---- dev helpers */
  window.__rfsShelf = {
    version: VERSION, SteamAPI, Data, state, Palette, Themes, Lang, lang: LANG,
    reload: () => { Data.load(); render(); }, get renderCache() { return { renderedFor, now: renderKey() }; }, // dev: why the home design was (not) rebuilt
    destroy() {
      clearInterval(tickTimer); clearInterval(routeTimer); cancelAnimationFrame(routeRaf);
      Sfx.stopAmb();
      Bpm.destroy();
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onFirstGesture, true);
      document.removeEventListener('click', onDocClick);
      resetLazy();
      document.documentElement.classList.remove('rfs-home-on');
      delete document.documentElement.dataset.rfsLang;
      document.querySelectorAll('[data-rfs-hide]').forEach(el => el.removeAttribute('data-rfs-hide'));
      [root, toastEl, viewer, sheet, picker, bar, navWrap].forEach(el => el.remove());
    },
  };
  LOG('loaded v' + VERSION);
})();
