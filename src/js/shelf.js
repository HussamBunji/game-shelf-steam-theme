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
      return !!(c && c.appStore && c.collectionStore && c.appDetailsStore && c.SteamClient && c.SteamUIStore);
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
    route() { try { return this.ctx().MainWindowBrowserManager.m_lastLocation.pathname || ''; } catch (e) { return ''; } },
    isLibraryHome() { return /^\/library\/home/.test(this.route()); },
    onBrowserRoute() { return /^\/browser/.test(this.route()); },
    /** the store/community page is a native browser layer drawn ABOVE our DOM — hide it while a panel of ours is open */
    setBrowserVisible(v) { try { const b = this.ctx().MainWindowBrowserManager.m_browser; if (b && b.SetVisible) b.SetVisible(!!v); } catch (e) { /* ignore */ } },
    rightPanel() {
      let best = null, bestArea = 0;
      document.querySelectorAll('[class*="RightPanel"]').forEach(el => {
        const r = el.getBoundingClientRect(), a = r.width * r.height;
        if (a > bestArea) { best = el; bestArea = a; }
      });
      return bestArea > 40000 ? best : null;
    },
    updatesBlock() { return this.el('UpdatesContainer'); },
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
    description(appid) { try { const d = this.ctx().appDetailsStore.GetDescriptions(appid); return (d && d.strSnippet) || ''; } catch (e) { return ''; } },
    tags(ov, n = 4) {
      const a = this.ctx().appStore;
      try { return [...(ov.m_setStoreTags || [])].slice(0, n).map(t => a.GetLocalizationForStoreTag(t)).filter(Boolean); } catch (e) { return []; }
    },
    releaseYear(ov) { try { return ov.GetCanonicalReleaseYear() || ''; } catch (e) { return ''; } },
    runningIds() { try { return new Set((this.ctx().SteamUIStore.RunningApps || []).map(a => a.appid)); } catch (e) { return new Set(); } },
    run(ov) { this.ctx().SteamClient.Apps.RunGame(ov.GetGameID(), '', -1, 100); },
    navigate(path) { this.ctx().SteamUIStore.Navigate(path); },
    openDetails(appid) { this.navigate('/library/app/' + appid); },
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
    enabled: store.get('enabled', '1') === '1',
    sort: store.get('sort', 'recent'),
    view: store.get('view', 'spines'),
    sound: store.get('sound', '1') === '1',
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
    size: (a, b) => (b.sizeOnDisk || 0) - (a.sizeOnDisk || 0),
  };
  if (!SORTS[state.sort]) state.sort = 'recent';
  const FEATURE = { recent: T('آخر ما لعبت', 'Recently played'), playtime: T('الأكثر لعبًا', 'Most played'), size: T('الأكبر حجمًا', 'Largest') };
  const STYLES = [
    { value: 'Classic Shelf', layout: 'shelf', name: T('الرف الكلاسيكي', 'Classic Shelf'), desc: T('رف خشب ثلاثي الأبعاد — تتمشى بين الرفوف والعلب تنفتح مثل CD', 'A 3D wooden bookcase — walk along the shelves and open each case like a CD') },
    { value: 'Neon Coverflow', layout: 'coverflow', name: T('نيون كوفر فلو', 'Neon Coverflow'), desc: T('دوّار ثلاثي الأبعاد بانعكاسات وإضاءة نيون', 'A 3D carousel with reflections and neon lighting') },
    { value: 'Glass Gallery', layout: 'gallery', name: T('المعرض الزجاجي', 'Glass Gallery'), desc: T('لوحة عملية: كمّل اللعب + كروت زجاجية + فلاتر', 'A practical dashboard: continue playing, glass cards and filters') },
    { value: 'Steam Original', layout: 'original', name: T('ستيم الأصلي', 'Steam Original'), desc: T('ستيم مثل ما هو بدون أي تعديل — يبقى زر الثيمات ولوحة الأرقام بالمتجر', 'Steam exactly as Valve ships it — only the Themes button and the store stats panel stay') },
    { value: 'SpaceTheme', layout: 'space', name: 'SpaceTheme', desc: T('ثيم المجتمع المشهور (SpaceTheme، رخصة MIT) — داكن ومرتب، مع لوحات الأرقام والأيقونات حقتنا', 'The popular community theme (SpaceTheme, MIT) — dark and modular, plus our stats panels and icons') },
    { value: 'Material You', layout: 'material', name: 'Material You', desc: T('تصميم Material 3 من Google (Material Theme، رخصة MIT) — أسطح ناعمة وزوايا دائرية', 'Google\'s Material 3 design (Material Theme, MIT) — soft tonal surfaces and round corners') },
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
    queue: [], active: 0,
    ensureDetails(g) {
      if (g.detailed) return Promise.resolve(g);
      if (g._p) return g._p;
      g._p = new Promise(resolve => { this.queue.push({ g, resolve }); this.pump(); });
      return g._p;
    },
    pump() {
      while (this.active < 6 && this.queue.length) {
        const { g, resolve } = this.queue.shift();
        this.active++;
        (async () => {
          try {
            await SteamAPI.requestDetails(g.appid);
            const d = SteamAPI.details(g.appid);
            const img = SteamAPI.images(g.ov);
            g.images.hero = img.hero; g.images.logo = img.logo; g.images.header = img.header;
            if (d) {
              g.developers = d.strDeveloperName ? [d.strDeveloperName] : [];
              const f = d.strInstallFolder || '';
              g.drive = /^[A-Za-z]:/.test(f) ? f.slice(0, 2).toUpperCase() : '';
              if (!g.sizeOnDisk && d.lDiskUsageBytes) g.sizeOnDisk = Number(d.lDiskUsageBytes);
            }
            g.description = SteamAPI.description(g.appid);
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
  let ac = null, noiseBuf = null, gestured = false, lastTick = 0;
  const onFirstGesture = () => { gestured = true; };
  window.addEventListener('pointerdown', onFirstGesture, { once: true, capture: true });
  function sfx(kind) {
    if (!state.sound || !gestured) return;
    try {
      if (!ac) {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        const len = ac.sampleRate * 0.6;
        noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ac.state === 'suspended') ac.resume();
      const a = ac, t = a.currentTime;
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
      if (kind === 'tick') { const n = performance.now(); if (n - lastTick < 55) return; lastTick = n; noise(0.022, 'bandpass', 3400, 2800, 0.035, 2.2); }
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

  /* ONE toolbar for everything, in Steam's top navigation row (next to Store / Library / Community).
     It holds the only search box: it filters the home design AND Steam's left game list,
     and drops down quick results from the whole library + commands. */
  const bar = div(); bar.id = 'rfs-bar';
  const SORT_NAMES = { recent: T('آخر لعب', 'Last played'), name: T('الاسم', 'Name'), playtime: T('الأكثر لعبًا', 'Most played'), size: T('الحجم', 'Size') };
  bar.innerHTML = `
    <div class="tb-search">
      <span class="tb-ico">${ic('search')}</span>
      <input class="tb-q" type="text" placeholder="${T('ابحث في ألعابك أو اكتب أمر…', 'Search your games or type a command…')}" spellcheck="false" autocomplete="off">
      <kbd class="tb-kbd">Ctrl K</kbd>
      <div class="tb-results"><div class="pl-list"></div>
        <div class="pl-foot"><span><kbd>Enter</kbd> ${T('صفحة اللعبة', 'Game page')}</span><span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> ${T('تشغيل / تثبيت', 'Play / Install')}</span><span><kbd>↑</kbd><kbd>↓</kbd> ${T('تنقل', 'Navigate')}</span><span><kbd>Esc</kbd> ${T('مسح', 'Clear')}</span></div>
      </div>
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
      <button class="tb-btn tb-off" title="${T('ارجع لصفحة Home الأصلية لستيم', 'Back to Steam\'s original Home page')}">${ic('undo')}<span class="tb-lbl">${T('الواجهة الأصلية', 'Original home')}</span></button>
      <button class="tb-btn tb-on" title="${T('رجّع تصميم الثيم للصفحة الرئيسية', 'Bring the theme design back to the home page')}">${ic('library')}<span class="tb-lbl">${T('رجّع الرف', 'Restore shelf')}</span></button>
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

  const picker = div(); picker.id = 'rfs-themes';
  picker.innerHTML = `
    <div class="tp-back"></div>
    <div class="tp-box">
      <div class="tp-head">
        <h2>${ic('palette')}${T('اختر تصميم الثيم', 'Choose a theme design')}</h2>
        <div class="tp-lang" role="group" aria-label="${T('لغة الواجهة', 'Interface language')}">${ic('globe')}<button data-lang="ar" lang="ar" class="${LTR ? '' : 'on'}" aria-pressed="${!LTR}">العربية</button><button data-lang="en" lang="en" class="${LTR ? 'on' : ''}" aria-pressed="${LTR}">English</button></div>
        <p>${T('كل تصميم يغيّر الصفحة الرئيسية وشكل ستيم كله والمتجر. التطبيق ياخذ ثواني (ستيم يعيد تحميل الواجهة).', 'Each design changes the home page, the look of all of Steam, and the store. Applying takes a few seconds (Steam reloads its interface).')}</p>
      </div>
      <div class="tp-grid">
        ${STYLES.map(s => `
          <button class="tp-card" data-value="${esc(s.value)}" data-layout="${s.layout}">
            <div class="tp-prev tp-${s.layout}">${previewArt(s.layout)}</div>
            <div class="tp-meta"><b>${esc(s.name)}</b><span>${esc(s.desc)}</span></div>
            <i class="tp-cur">${ic('check')}${T('الحالي', 'Current')}</i>
          </button>`).join('')}
      </div>
      <button class="tp-close">${T('إغلاق', 'Close')}</button>
    </div>`;
  function previewArt(layout) {
    if (layout === 'shelf') return '<i class="pv-shelf"></i><i class="pv-shelf b"></i>' + Array.from({ length: 14 }, (_, i) => `<i class="pv-spine" style="--i:${i}"></i>`).join('');
    if (layout === 'coverflow') return '<i class="pv-floor"></i>' + [-3, -2, -1, 0, 1, 2, 3].map(k => `<i class="pv-cf" style="--k:${k}"></i>`).join('');
    if (layout === 'gallery') return '<i class="pv-hero"></i>' + Array.from({ length: 8 }, (_, i) => `<i class="pv-tile" style="--i:${i}"></i>`).join('');
    if (layout === 'space') return '<i class="pv-xside"></i><i class="pv-xhero"></i>' + Array.from({ length: 5 }, (_, i) => `<i class="pv-xcard" style="--i:${i}"></i>`).join('');
    if (layout === 'material') return '<i class="pv-mbar"></i><i class="pv-mhero"></i>' + Array.from({ length: 3 }, (_, i) => `<i class="pv-mchip" style="--i:${i}"></i>`).join('') + Array.from({ length: 4 }, (_, i) => `<i class="pv-mcard" style="--i:${i}"></i>`).join('');
    return '<i class="pv-snav"></i><i class="pv-slist"></i><i class="pv-shero"></i>' + Array.from({ length: 6 }, (_, i) => `<i class="pv-scap" style="--i:${i}"></i>`).join('');
  }

  function mount() {
    for (const el of [toastEl, viewer, picker, bar]) if (!el.isConnected) document.body.appendChild(el);
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
      if (g) { const r = slot.getBoundingClientRect(); showTip(g, r.left + r.width / 2, r.top); }
      sfx('tick');
    },
    source(appid) {
      const slot = stage.querySelector(`.slot[data-appid="${appid}"]`);
      if (!slot) return null;
      const isSpine = slot.classList.contains('is-spine');
      return { slot, el: slot.querySelector(isSpine ? '.face.spine' : '.face.cover') || slot, isSpine };
    },
  };

  /* ---------- 3b. neon coverflow (virtualised — only ~20 covers exist in the DOM) ---------- */
  const CoverflowLayout = {
    fixedHeight: false,
    cur: 0,
    render(games, w, hFull) {
      this.games = games;
      if (this.cur >= games.length) this.cur = 0;
      // the carousel takes ~3/4 of the screen; the full library grid peeks underneath (scroll down to browse)
      const h = Math.round(Math.max(460, hFull * 0.74));
      const cardH = Math.round(Math.min(h * 0.56, 500)), cardW = Math.round(cardH * 2 / 3);
      this.cardW = cardW;
      const wrap = div('cf-wrap');
      const el = div('cf');
      el.style.height = h + 'px';
      el.style.setProperty('--cw', cardW + 'px');
      el.style.setProperty('--ch', cardH + 'px');
      el.innerHTML = `
        <div class="cf-bg"><div class="cf-bg-img"></div><div class="cf-bg-img b"></div></div>
        <div class="cf-floor"></div>
        <div class="cf-track"></div>
        <button class="cf-nav prev" title="${T('السابق', 'Previous')}">${ic(LTR ? 'chevL' : 'chevR')}</button><button class="cf-nav next" title="${T('التالي', 'Next')}">${ic(LTR ? 'chevR' : 'chevL')}</button>
        <input class="cf-range" type="range" min="0" max="${Math.max(0, games.length - 1)}" value="${this.cur}" title="${T('اسحب للتنقل السريع', 'Drag to browse quickly')}">
        <div class="cf-info">
          <h2 class="cf-name" dir="auto"></h2>
          <div class="cf-meta"></div>
          <div class="cf-actions">
            <button class="cf-btn play" data-act="play">${ic('play')}${T('تشغيل', 'Play')}</button>
            <button class="cf-btn" data-act="open">${ic('disc')}${T('افتح العلبة', 'Open case')}</button>
            <button class="cf-btn" data-act="details">${T('صفحة اللعبة', 'Game page')}</button>
          </div>
        </div>
        <div class="cf-count"></div>
        <button class="cf-browse">${ic('grid')}${T('تصفّح كل الألعاب', 'Browse all games')}</button>`;
      this.el = el; this.track = $('.cf-track', el); this.nodes = new Map(); this.bgFlip = false;
      if (!games.length) this.track.innerHTML = `<div class="rf-empty">${T('ما لقيت شي يطابق بحثك', 'Nothing matches your search')}</div>`;
      // full library grid (same browsing comfort as the Glass Gallery)
      const gridHead = div('cf-grid-head', `<b>${T('كل الألعاب', 'All games')}</b><span>${fmtGames(games.length)} — ${T('اضغط أي لعبة تطلع في الدوّار', 'click any game to bring it to the carousel')}</span>`);
      const grid = div('cf-grid');
      const frag = document.createDocumentFragment();
      games.forEach((g, i) => {
        const c = div('nf-card' + (g.installed ? '' : ' ni'));
        c.dataset.appid = g.appid; c.dataset.i = i;
        c.innerHTML = `<div class="nf-art"></div><div class="nf-name" dir="auto">${esc(g.name)}</div>`;
        frag.append(c);
        lazy(c, gg => c.style.setProperty('--cap', cssUrl(first(gg.images.capsule))));
      });
      grid.append(frag);
      wrap.append(el, gridHead, grid);
      stage.replaceChildren(wrap);
      this.grid = grid;
      grid.addEventListener('click', e => {
        const c = e.target.closest('.nf-card'); if (!c) return;
        this.go(+c.dataset.i);
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      $('.cf-browse', el).addEventListener('click', () => gridHead.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      this.update(true);
      this.track.addEventListener('click', e => {
        const it = e.target.closest('.cf-item'); if (!it) return;
        const i = +it.dataset.i;
        if (i === this.cur) openGame(this.games[i], this.source(this.games[i].appid));
        else this.go(i);
      });
      // Arabic keeps its original wiring; in English (left-to-right) «prev» steps back, «next» steps forward
      $('.prev', el).addEventListener('click', () => this.go(this.cur + (LTR ? -1 : 1)));
      $('.next', el).addEventListener('click', () => this.go(this.cur + (LTR ? 1 : -1)));
      $('.cf-range', el).addEventListener('input', e => this.go(+e.target.value, true));
      // vertical wheel scrolls the page normally (to reach the grid); sideways wheel / Shift+wheel flips covers
      this.track.parentElement.addEventListener('wheel', e => {
        const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey;
        if (!sideways) return;
        e.preventDefault();
        const now = performance.now();
        if (now - (this.lastWheel || 0) < 90) return;
        this.lastWheel = now;
        const d = e.shiftKey ? e.deltaY : e.deltaX;
        this.go(this.cur + (d > 0 ? 1 : -1));
      }, { passive: false });
      $('.cf-actions', el).addEventListener('click', e => {
        const b = e.target.closest('[data-act]'); const g = this.games[this.cur];
        if (!b || !g) return;
        if (b.dataset.act === 'play') launch(g);
        else if (b.dataset.act === 'open') openGame(g, this.source(g.appid));
        else SteamAPI.openDetails(g.appid);
      });
    },
    go(i, quiet) {
      if (!this.games.length) return;
      const n = Math.max(0, Math.min(this.games.length - 1, i));
      if (n === this.cur) return;
      this.cur = n; if (!quiet) sfx('swish'); this.update();
    },
    key(e) {
      // the strip runs in reading direction: Arabic → leftwards, English → rightwards
      if (e.key === (LTR ? 'ArrowRight' : 'ArrowLeft')) { this.go(this.cur + 1); return true; }
      if (e.key === (LTR ? 'ArrowLeft' : 'ArrowRight')) { this.go(this.cur - 1); return true; }
      if (e.key === 'Enter' && this.games[this.cur]) { openGame(this.games[this.cur], this.source(this.games[this.cur].appid)); return true; }
      return false;
    },
    node(i) {
      let it = this.nodes.get(i);
      if (it) return it;
      const g = this.games[i];
      it = div('cf-item', '<div class="cf-cover"></div>');
      it.dataset.i = i; it.dataset.appid = g.appid;
      it.style.transition = 'none';
      this.track.append(it);
      this.nodes.set(i, it);
      const paint = gg => it.style.setProperty('--cap', cssUrl(first(gg.images.capsule)));
      paint(g);
      return it;
    },
    update(instant) {
      if (!this.games.length) return;
      const lo = Math.max(0, this.cur - 9), hi = Math.min(this.games.length - 1, this.cur + 9);
      for (const [i, it] of this.nodes) if (i < lo || i > hi) { it.remove(); this.nodes.delete(i); }
      const cw = this.cardW;
      for (let i = lo; i <= hi; i++) {
        const it = this.node(i);
        const k = i - this.cur, a = Math.abs(k), s = LTR ? Math.sign(k) : -Math.sign(k); // later games sit on the reading-forward side
        it.style.transform = k === 0 ? 'translateX(-50%) translateZ(140px)'
          : `translateX(calc(-50% + ${s * (cw * 0.64 + (a - 1) * cw * 0.32)}px)) translateZ(${-a * 70}px) rotateY(${-s * 58}deg)`;
        it.style.zIndex = String(100 - a);
        it.style.opacity = a > 7 ? '0' : '1';
        it.classList.toggle('center', k === 0);
      }
      requestAnimationFrame(() => { for (const it of this.nodes.values()) it.style.transition = ''; });
      const g = this.games[this.cur];
      $('.cf-range', this.el).value = this.cur;
      if (this.grid) {
        const prev = this.grid.querySelector('.nf-card.cur'); if (prev) prev.classList.remove('cur');
        const c = this.grid.querySelector(`.nf-card[data-i="${this.cur}"]`); if (c) c.classList.add('cur');
      }
      const fill = () => {
        const run = SteamAPI.runningIds().has(g.appid);
        $('.cf-name', this.el).textContent = g.name;
        $('.cf-meta', this.el).innerHTML = `<span>${ic('clock')}${esc(fmtPlaytime(g.playtimeMin))}</span><span>${ic('calendar')}${esc(fmtAgo(g.lastPlayed))}</span>${g.sizeOnDisk ? `<span>${ic('drive')}${esc(fmtSize(g.sizeOnDisk))}</span>` : ''}${g.installed ? '' : `<span>${ic('download')}${T('غير مثبتة', 'Not installed')}</span>`}${g.genres[0] ? `<span>${ic('tag')}${esc(g.genres[0])}</span>` : ''}`;
        $('.cf-btn.play', this.el).innerHTML = run ? ic('pulse') + T('شغّالة', 'Running') : g.installed ? ic('play') + T('تشغيل', 'Play') : ic('download') + T('تثبيت', 'Install');
        $('.cf-count', this.el).textContent = `${NUM.format(this.cur + 1)} / ${NUM.format(this.games.length)}`;
        const bgs = this.el.querySelectorAll('.cf-bg-img');
        this.bgFlip = !this.bgFlip;
        const on = bgs[this.bgFlip ? 1 : 0], off = bgs[this.bgFlip ? 0 : 1];
        on.style.backgroundImage = cssUrl(first(g.images.hero) || first(g.images.header) || first(g.images.capsule));
        on.style.opacity = '1'; off.style.opacity = '0';
      };
      fill();
      if (!g.detailed) Data.ensureDetails(g).then(() => { if (this.games[this.cur] === g) fill(); });
    },
    source(appid) {
      const it = this.track && this.track.querySelector(`.cf-item[data-appid="${appid}"] .cf-cover`);
      return it ? { el: it, slot: it.parentElement, isSpine: false } : null;
    },
  };

  /* ---------- 3c. glass gallery (dashboard) ---------- */
  const GalleryLayout = {
    fixedHeight: false,
    dockInside: true, // the filter strip goes into [data-rfs-dock], right above the chips and the grid
    render(games) {
      const recent = [...state.games].sort(SORTS.recent)[0];
      const genreCount = new Map();
      state.games.forEach(g => g.genres.forEach(t => genreCount.set(t, (genreCount.get(t) || 0) + 1)));
      const genres = [...genreCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => x[0]);
      const running = SteamAPI.runningIds();
      const el = div('gl');
      el.innerHTML = `
        ${recent ? `<div class="gl-hero" data-appid="${recent.appid}">
            <div class="gl-hero-bg"></div>
            <div class="gl-hero-body">
              <div class="gl-kicker">${T('كمّل من وين وقفت', 'Continue where you left off')}</div>
              <div class="gl-hero-logo"><h2 dir="auto">${esc(recent.name)}</h2></div>
              <div class="gl-hero-meta"><span>${ic('clock')}${esc(fmtPlaytime(recent.playtimeMin))}</span><span>${ic('calendar')}${esc(fmtAgo(recent.lastPlayed))}</span>${recent.playtime2wksMin ? `<span>${ic('fire')}${esc(fmtPlaytime(recent.playtime2wksMin))} ${T('آخر أسبوعين', 'past 2 weeks')}</span>` : ''}</div>
              <div class="gl-hero-actions">
                <button class="gl-btn play" data-act="play">${running.has(recent.appid) ? ic('pulse') + T('شغّالة الحين', 'Running now') : recent.installed ? ic('play') + T('كمّل اللعب', 'Continue playing') : ic('download') + T('تثبيت', 'Install')}</button>
                <button class="gl-btn" data-act="open">${ic('disc')}${T('التفاصيل', 'Details')}</button>
                <button class="gl-btn" data-act="details">${T('صفحة اللعبة', 'Game page')}</button>
              </div>
            </div>
          </div>` : ''}
        <div class="rf-dock" data-rfs-dock></div>
        <div class="gl-chips">
          <button class="gl-chip${state.genre ? '' : ' on'}" data-genre="">${T('الكل', 'All')} <b>${NUM.format(state.games.length)}</b></button>
          ${genres.map(t => `<button class="gl-chip${state.genre === t ? ' on' : ''}" data-genre="${esc(t)}" dir="auto">${esc(t)} <b>${NUM.format(genreCount.get(t))}</b></button>`).join('')}
        </div>
        <div class="gl-grid"></div>`;
      if (recent) {
        const paintHero = g => {
          $('.gl-hero-bg', el).style.backgroundImage = cssUrl(first(g.images.hero) || first(g.images.header) || first(g.images.capsule));
          const lg = $('.gl-hero-logo', el);
          if (g.images.logo.length && !lg.querySelector('img')) lg.replaceChildren(imgWithFallback(g.images.logo, '', im => im.replaceWith(Object.assign(document.createElement('h2'), { textContent: g.name }))));
        };
        paintHero(recent);
        Data.ensureDetails(recent).then(paintHero);
        $('.gl-hero-actions', el).addEventListener('click', e => {
          const b = e.target.closest('[data-act]'); if (!b) return;
          if (b.dataset.act === 'play') launch(recent);
          else if (b.dataset.act === 'open') openGame(recent, { el: $('.gl-hero-logo', el), isSpine: false });
          else SteamAPI.openDetails(recent.appid);
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
      $('.gl-chips', el).addEventListener('click', e => {
        const b = e.target.closest('.gl-chip'); if (!b) return;
        state.genre = b.dataset.genre; sfx('tick'); render();
      });
      grid.addEventListener('click', e => {
        const c = e.target.closest('.gl-card'); if (!c) return;
        const g = byId(c.dataset.appid);
        if (e.target.closest('.gl-quick')) { launch(g); return; }
        openGame(g, this.source(g.appid));
      });
      grid.addEventListener('pointermove', e => {
        const c = e.target.closest('.gl-card');
        if (c !== this.hov) { if (this.hov) { this.hov.style.removeProperty('--tx'); this.hov.style.removeProperty('--ty'); } this.hov = c; if (c) sfx('tick'); }
        if (!c) return;
        const r = c.getBoundingClientRect();
        c.style.setProperty('--tx', clamp(((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
        c.style.setProperty('--ty', clamp(((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
      });
      grid.addEventListener('pointerleave', () => { if (this.hov) { this.hov.style.removeProperty('--tx'); this.hov.style.removeProperty('--ty'); this.hov = null; } });
    },
    source(appid) {
      const c = stage.querySelector(`.gl-card[data-appid="${appid}"] .gl-art`);
      return c ? { el: c, slot: c.parentElement, isSpine: false } : null;
    },
  };

  const LAYOUTS = { shelf: ShelfLayout, coverflow: CoverflowLayout, gallery: GalleryLayout };
  const L = () => LAYOUTS[state.layout] || ShelfLayout;

  /* ---- render */
  function render() {
    hoverSlot = null; hideTip(); resetLazy();
    const lay = L();
    root.dataset.layout = state.layout;
    const w = root.clientWidth || 900;
    const keep = keepSearchFocus();
    if (!lay.dockInside) dockBar(); // strip on top of the design, measured before sizing it
    const barH = bar.parentElement === root ? bar.offsetHeight + 22 : 0;
    const h = Math.max(420, (placement.height || 760) - barH);
    root.style.height = lay.fixedHeight ? (h + barH) + 'px' : 'auto';
    lay.render(visibleGames(), w, h);
    if (lay.dockInside) dockBar();
    keep();
    updateBar();
  }
  /** the filter strip (search · source · sort · view …) lives inside the home design, right above the games */
  function dockBar() {
    const slot = stage.querySelector('[data-rfs-dock]');
    if (slot) { if (bar.parentElement !== slot) slot.appendChild(bar); }
    else if (bar.parentElement !== root || bar.nextElementSibling !== stage) root.insertBefore(bar, stage);
    bar.classList.add('inhome');
    bar.classList.remove('float');
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
    $('.tb-genre', bar).style.display = state.layout === 'gallery' ? 'none' : ''; // the gallery has its own chips
    $('.tb-genre-name', bar).textContent = state.genre || T('كل الأنواع', 'All genres');
    $('.tb-genre .rf-dd-btn', bar).classList.toggle('on', !!state.genre);
    $('.tb-snd', bar).innerHTML = state.sound ? ic('volume') : ic('mute');
    $('.tb-news', bar).classList.toggle('on', state.news);
  }

  /* ---- toolbar controls */
  $('.tb-view', bar).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.view = b.dataset.v; store.set('view', state.view); sfx('tick'); render();
  });
  $('.tb-snd', bar).addEventListener('click', () => { state.sound = !state.sound; store.set('sound', state.sound ? '1' : '0'); updateBar(); });
  $('.tb-off', bar).addEventListener('click', () => setEnabled(false));
  $('.tb-on', bar).addEventListener('click', () => setEnabled(true));
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
    if (!e.target.closest('.tb-search')) Search.closeResults();
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
  function fillJewel(g) {
    ShelfLayout.paintCase(jewel, g);
    const sp = ShelfLayout.spineArt(g); ShelfLayout.paintSpine(sp, g);
    $('.j-spine', jewel).replaceChildren(sp);
    $('.j-back', jewel).style.backgroundImage = `linear-gradient(rgba(8,9,12,.5), rgba(8,9,12,.85)), ${cssUrl(first(g.images.header) || first(g.images.capsule))}`;
    discArt.replaceChildren();
    if (g.images.logo.length) discArt.append(imgWithFallback(g.images.logo, 'disc-logo', im => im.remove()));
    const running = SteamAPI.runningIds().has(g.appid);
    const stats = [[T('وقت اللعب', 'Play time'), fmtPlaytime(g.playtimeMin)], [T('آخر مرة لعبت', 'Last played'), fmtAgo(g.lastPlayed)]];
    if (g.playtime2wksMin) stats.push([T('آخر أسبوعين', 'Past 2 weeks'), fmtPlaytime(g.playtime2wksMin)]);
    stats.push([T('الحجم', 'Size'), g.installed ? `${fmtSize(g.sizeOnDisk)}${g.drive ? ` · ${g.drive}` : ''}` : T('غير مثبتة', 'Not installed')], [T('المطوّر', 'Developer'), (g.developers || []).join(T('، ', ', ')) || '—'], [T('الإصدار', 'Released'), g.releaseDate || '—']);
    const desc = g.description || SteamAPI.description(g.appid);
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
  async function openGame(g, src) {
    if (!g || busy || current) return;
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
     5. Search — the ONE search box (toolbar). Ctrl+K focuses it.
        • filters the home design live
        • mirrors into Steam's left game list (its own box is hidden)
        • drops down quick results from the whole library + commands
     ================================================================= */
  /* panels of ours (theme picker, search results) must be visible on store pages too */
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
    input: $('.tb-q', bar), list: $('.tb-results .pl-list', bar), box: $('.tb-search', bar), items: [], sel: 0, owned: [],
    // "words" holds Arabic AND English keywords (and both names), so a command is found in either language
    commands: [
      { ico: 'home', name: T('رف الألعاب (الصفحة الرئيسية)', 'Game Shelf (home page)'), words: 'home shelf game shelf library رف الألعاب رئيسية الصفحة الرئيسية مكتبة', run: () => SteamAPI.navigate('/library/home') },
      { ico: 'palette', name: T('تغيير تصميم الثيم', 'Change theme design'), words: 'theme style design look skin ثيم ستايل تصميم شكل تغيير', run: () => Themes.open() },
      { ico: 'globe', name: T('غيّر اللغة إلى English', 'Switch language to العربية'), words: 'language lang english arabic switch لغة اللغة عربي العربية انجليزي إنجليزي الإنجليزية English العربية', run: () => Lang.toggle() },
      { ico: 'cart', name: T('المتجر', 'Store'), words: 'store shop buy متجر المتجر شراء', run: () => SteamAPI.steamUrl('steam://store') },
      { ico: 'star', name: T('قائمة الأمنيات', 'Wishlist'), words: 'wishlist wish list امنيات أمنيات قائمة الأمنيات', run: () => SteamAPI.steamUrl('steam://openurl/https://store.steampowered.com/wishlist/') },
      { ico: 'download', name: T('التنزيلات', 'Downloads'), words: 'downloads download updates تنزيل التنزيلات تحميل تحديثات', run: () => SteamAPI.steamUrl('steam://open/downloads') },
      { ico: 'users', name: T('الأصدقاء والدردشة', 'Friends & Chat'), words: 'friends chat اصدقاء أصدقاء الأصدقاء دردشة الدردشة', run: () => SteamAPI.steamUrl('steam://open/friends') },
      { ico: 'image', name: T('لقطات الشاشة', 'Screenshots'), words: 'screenshots screenshot images photos صور لقطات لقطات الشاشة', run: () => SteamAPI.steamUrl('steam://open/screenshots') },
      { ico: 'sliders', name: T('إعدادات ستيم', 'Steam Settings'), words: 'settings steam settings preferences options اعدادات إعدادات إعدادات ستيم', run: () => SteamAPI.steamUrl('steam://open/settings') },
      { ico: 'refresh', name: T('تحديث بيانات الرف', 'Refresh shelf data'), words: 'refresh reload update تحديث بيانات الرف', run: () => { Data.load(); render(); toast(T('تم تحديث الرف', 'Shelf refreshed')); } },
    ],
    focus() {
      if (!bar.classList.contains('inhome') || !bar.classList.contains('on')) { bar.classList.add('float', 'on'); }
      this.input.focus(); this.input.select(); this.openResults();
    },
    openResults() {
      if (!SteamAPI.ready()) return;
      try { this.owned = SteamAPI.sources()[0].apps(); } catch (e) { this.owned = []; }
      this.box.classList.add('open');
      Overlay.push('search');
      this.search(this.input.value);
    },
    closeResults() {
      bar.classList.remove('float');
      if (!this.box.classList.contains('open')) return;
      this.box.classList.remove('open'); Overlay.pop('search');
    },
    isOpen() { return this.box.classList.contains('open'); },
    /** typed text → filter the design + Steam's own list */
    apply(q) {
      clearTimeout(this._t);
      this._t = setTimeout(() => {
        state.query = q; CoverflowLayout.cur = 0;
        if (root.classList.contains('on')) render();
        this.mirror(q);
      }, 140);
    },
    steamInput() {
      const left = SteamAPI.el('LeftListSizableContainer');
      return left ? left.querySelector('input.DialogInput, input[type="text"]') : null;
    },
    mirror(q) {
      const inp = this.steamInput();
      if (!inp || inp.value === q) return;
      try {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        set.call(inp, q);
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (e) { /* Steam's list just won't follow */ }
    },
    clear() { this.input.value = ''; this.apply(''); this.closeResults(); this.input.blur(); },
    score(name, q) {
      const n = name.toLowerCase();
      if (n === q) return 100;
      if (n.startsWith(q)) return 80;
      if (n.split(/[\s:\-–—]+/).some(w => w.startsWith(q))) return 60;
      if (n.includes(q)) return 40;
      let i = 0; for (const ch of n) if (ch === q[i]) i++;
      return i === q.length ? 10 : 0;
    },
    search(q) {
      q = q.trim().toLowerCase();
      const out = [];
      const cmds = this.commands.filter(c => !q || (c.name + ' ' + c.words).toLowerCase().includes(q));
      let games;
      if (!q) {
        games = [...this.owned].sort((a, b) => (b.rt_last_time_played || 0) - (a.rt_last_time_played || 0)).slice(0, 8);
        if (games.length) out.push({ sec: T('آخر ما لعبت', 'Recently played') });
      } else {
        let scored = this.owned.map(o => [o, this.score(o.display_name || '', q)]).filter(x => x[1] > 0);
        if (scored.some(x => x[1] > 10)) scored = scored.filter(x => x[1] > 10);
        games = scored.sort((a, b) => b[1] - a[1] || (b[0].rt_last_time_played || 0) - (a[0].rt_last_time_played || 0)).slice(0, 30).map(x => x[0]);
        if (games.length) out.push({ sec: T(`ألعاب (${NUM.format(games.length)})`, `Games (${NUM.format(games.length)})`) });
      }
      games.forEach(o => out.push({ game: o }));
      if (cmds.length) { out.push({ sec: T('أوامر', 'Commands') }); cmds.forEach(c => out.push({ cmd: c })); }
      this.items = out;
      this.sel = out.findIndex(x => !x.sec);
      this.draw();
    },
    draw() {
      this.list.innerHTML = this.items.map((x, i) => {
        if (x.sec) return `<div class="pl-sec">${esc(x.sec)}</div>`;
        if (x.cmd) return `<div class="pl-item${i === this.sel ? ' sel' : ''}" data-i="${i}">${icT(x.cmd.ico, 'pl-ico')}<span class="pl-name">${esc(x.cmd.name)}</span></div>`;
        const o = x.game, inst = !!o.installed, icon = SteamAPI.icon(o);
        return `<div class="pl-item${i === this.sel ? ' sel' : ''}" data-i="${i}">
          ${icon ? `<img src="${esc(icon)}" alt="">` : icT('gamepad', 'pl-ico')}
          <span class="pl-name" dir="auto">${esc(o.display_name)}</span>
          <span class="pl-meta">${esc(fmtPlaytime(o.minutes_playtime_forever))}</span>
          <span class="pl-tag${inst ? '' : ' dim'}">${inst ? T('مثبتة', 'Installed') : T('غير مثبتة', 'Not installed')}</span></div>`;
      }).join('') || `<div class="pl-sec">${T('ما لقيت شي', 'No results')}</div>`;
      const s = this.list.querySelector('.sel'); if (s) s.scrollIntoView({ block: 'nearest' });
    },
    move(d) {
      if (!this.items.length) return;
      let i = this.sel;
      do { i = (i + d + this.items.length) % this.items.length; } while (this.items[i].sec && i !== this.sel);
      this.sel = i; this.draw();
    },
    exec(i, play) {
      const x = this.items[i]; if (!x || x.sec) return;
      this.closeResults();
      if (x.cmd) { x.cmd.run(); return; }
      const o = x.game;
      if (play) { try { SteamAPI.run(o); toast(o.installed ? T(`جاري تشغيل ${o.display_name}…`, `Launching ${o.display_name}…`) : T(`يفتح تثبيت ${o.display_name}…`, `Opening install for ${o.display_name}…`)); } catch (e) { toast(T('ما قدرت أشغّلها', 'Couldn\'t launch it')); } }
      else SteamAPI.openDetails(o.appid);
    },
  };
  const Palette = Search; // old name kept for dev helpers
  Search.input.addEventListener('focus', () => Search.openResults());
  Search.input.addEventListener('input', () => { Search.openResults(); Search.apply(Search.input.value); });
  Search.input.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'ArrowDown') { e.preventDefault(); Search.openResults(); Search.move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); Search.move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); Search.exec(Search.sel, e.ctrlKey || e.shiftKey); }
    else if (e.key === 'Escape') { e.preventDefault(); Search.clear(); }
  });
  Search.list.addEventListener('click', e => { const it = e.target.closest('.pl-item'); if (it) Search.exec(+it.dataset.i, e.ctrlKey); });

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
  const curLayout = () => themeVar('--rf-style-id', '') || (state.original ? 'original' : state.layout);
  const Themes = {
    open() {
      picker.querySelectorAll('.tp-card').forEach(c => c.classList.toggle('cur', c.dataset.layout === curLayout()));
      Search.closeResults();
      picker.classList.add('on');
      Overlay.push('themes');
      sfx('tick');
    },
    close() { if (!picker.classList.contains('on')) return; picker.classList.remove('on'); picker.classList.remove('busy'); Overlay.pop('themes'); },
    isOpen() { return picker.classList.contains('on'); },
    async apply(value) {
      const st = STYLES.find(s => s.value === value);
      if (st && st.layout === curLayout()) { this.close(); return; }
      pickerBusy();
      const nm = st ? st.name : value;
      toast(T(`جاري تطبيق «${nm}»… ستيم بيعيد تحميل الواجهة`, `Applying “${nm}”… Steam will reload its interface`), 6000);
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

  picker.addEventListener('click', e => {
    const lb = e.target.closest('.tp-lang button');
    if (lb) { if (!lb.classList.contains('on')) Lang.set(lb.dataset.lang); return; }
    const card = e.target.closest('.tp-card');
    if (card) { Themes.apply(card.dataset.value); return; }
    if (e.target.closest('.tp-close') || e.target.classList.contains('tp-back')) Themes.close();
  });

  const onKey = e => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK')) {
      e.preventDefault(); e.stopPropagation();
      Search.focus();
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
  let loaded = false, lastSigCheck = 0, lastLayoutCheck = 0;
  function place(panel) {
    const upd = SteamAPI.updatesBlock();
    const pr = panel.getBoundingClientRect();
    if (upd && upd.parentElement && upd.parentElement.parentElement) {
      const wrapper = upd.parentElement, inner = wrapper.parentElement;
      upd.setAttribute('data-rfs-upd', '');
      inner.setAttribute('data-rfs-home', '');
      if (root.parentElement !== inner || root.previousElementSibling !== wrapper) wrapper.after(root);
      root.classList.remove('overlay');
      Object.assign(root.style, { left: '', top: '', width: '' });
      placement.mode = 'embed';
      placement.height = Math.max(520, Math.round(pr.height - wrapper.offsetHeight));
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
  let navCheckAt = 0, navOk = false;
  function placeBar(onHome, panel) {
    // the nav row rarely changes: re-place THEMES once a second (or at once if Steam re-rendered the row)
    const nowT = Date.now();
    if (!navWrap.isConnected || nowT - navCheckAt > 1000) { navCheckAt = nowT; navOk = placeNavTheme(); }
    else navTheme.classList.toggle('rfs-open', Themes.isOpen());
    bar.classList.toggle('has-nav', navOk);
    bar.classList.toggle('home', !!onHome);
    bar.classList.toggle('shelf-off', !!panel && !state.enabled);
    bar.classList.toggle('original', !!state.original);
    const inHome = !!onHome && !!panel && state.enabled && !state.original;
    // Steam's own left-list search box is replaced by the strip's search while the home design is on screen
    const sin = Search.steamInput();
    const siSel = SteamAPI.sel('SearchInput');
    const box = sin && ((siSel && sin.closest(siSel)) || sin.closest('.DialogInput_Wrapper') || sin.parentElement);
    if (box) {
      if (!inHome) box.removeAttribute('data-rfs-hide');
      else if (!box.hasAttribute('data-rfs-hide')) box.setAttribute('data-rfs-hide', '');
    }
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
    if (bar.classList.contains('float')) { setStyles(bar, { top: '', right: '', left: '', maxWidth: '' }); return; }
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
    if (force || now - lastLayoutCheck > 800) {
      lastLayoutCheck = now;
      const lay = themeVar('--rf-layout', 'shelf');
      const orig = lay === 'original'; // "Steam Original": leave Steam's home exactly as it is
      if (orig !== !!state.original) { state.original = orig; placement.key = ''; }
      document.documentElement.toggleAttribute('data-rfs-native', orig); // stock Steam / community theme is in charge
      if (LAYOUTS[lay] && lay !== state.layout) { state.layout = lay; placement.key = ''; }
      // language changed behind our back (Millennium settings) → reload the UI once in the new language
      const lang = normLang(themeVar('--rf-lang', ''));
      if (lang && lang !== LANG) Lang.follow(lang);
    }
    const panel = SteamAPI.isLibraryHome() ? SteamAPI.rightPanel() : null;
    const show = !!panel && state.enabled && !state.original;
    document.documentElement.classList.toggle('rfs-home-on', show);
    // the community theme's styling for Steam's own home is costly (page-wide :has() checks on every change) and
    // pointless while our design covers that page — switch it off then, back on for Steam's own home
    for (const l of document.querySelectorAll('link[data-rfs-part="home"]')) { const m = show ? 'not all' : ''; if (l.media !== m) l.media = m; }
    document.documentElement.classList.toggle('rfs-show-news', state.news);
    placeBar(SteamAPI.isLibraryHome(), panel);
    if (panel && show) {
      const pr = panel.getBoundingClientRect();
      const key = [Math.round(pr.width), Math.round(pr.height), state.layout, state.news].join(',');
      const misplaced = !root.isConnected || (placement.mode === 'embed' && !root.parentElement.hasAttribute('data-rfs-home'));
      if (key !== placement.key || force || misplaced) {
        const changed = key !== placement.key;
        placement.key = key;
        place(panel);
        if (loaded && (changed || force)) render();
      }
    }
    if (show && !root.classList.contains('on')) {
      root.classList.add('on');
      if (!loaded) { try { Data.load(); loaded = true; } catch (err) { LOG('load failed', err); } }
      render();
    } else if (!show && root.classList.contains('on')) {
      root.classList.remove('on'); hideTip();
    }
    if (show && loaded && now - lastSigCheck > 5000 && !current) {
      lastSigCheck = now;
      if (Data.sig() !== state.sig) { Data.load(); render(); }
    }
  }
  /* ---- Arabic for the whole Steam client. Steam ships no Arabic interface, so when the theme language is Arabic we
     replace Steam's own interface strings (LocalizationManager tokens, in SharedJSContext) with our translation in
     src/lang/steam-ar.js. Steam re-renders with them; strings we haven't translated simply stay English. */
  (function steamArabic() {
    if (LANG !== 'ar') return;
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

  const tickTimer = setInterval(() => { if (!document.hidden) tick(false); }, 300); // nothing to do while Steam is hidden

  /* ---- dev helpers */
  window.__rfsShelf = {
    version: VERSION, SteamAPI, Data, state, Palette, Themes, Lang, lang: LANG,
    reload: () => { Data.load(); render(); },
    destroy() {
      clearInterval(tickTimer);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onFirstGesture, true);
      document.removeEventListener('click', onDocClick);
      resetLazy();
      document.documentElement.classList.remove('rfs-home-on');
      delete document.documentElement.dataset.rfsLang;
      document.querySelectorAll('[data-rfs-hide]').forEach(el => el.removeAttribute('data-rfs-hide'));
      [root, toastEl, viewer, picker, bar, navWrap].forEach(el => el.remove());
    },
  };
  LOG('loaded v' + VERSION);
})();
