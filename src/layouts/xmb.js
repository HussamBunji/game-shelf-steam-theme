/* ═══ Crossbar (الكونسول) — library home design ═══
   A console cross-media bar. A row of CATEGORY icons across the upper third (Search, Recent, Installed, All games,
   Most played, Genres, Options); the chosen one sits in the focus column with its label, and ← / → slide the row (one
   transform). Under it, the cross: a vertical column of that category's entries — the focused one large and glowing at
   a fixed focus position just under the icon, the ones before it fading upward above the row, the rest below. ↑ / ↓,
   PgUp / PgDn, Home / End, the mouse wheel and clicks move it; every game is reachable (All games = the whole filtered
   library). Search is a console field: the Search icon (or Ctrl+K, or simply typing a letter) shows one large rounded
   field over the wave with an on-screen key row, and the column shows the matches live. It drives the core's real
   search box (#rfs-bar .tb-q), which lives in that field; the rest of the strip (library, sort, genre, sound, What's
   New, background colour, theme designs) is reached as console Options: the Options icon (or F2) lists them, and Enter
   opens a console option menu from the end edge (↑ / ↓, Enter, Esc). The header is only the clock and the date.
   Behind everything: a deep gradient (a preset or the month's colour) and ONE SVG of luminous ribbons whose shape keeps
   flowing (≤ 30 fps, paused while hidden, while a game is open or off the home page; still with reduced motion).
   The focused game's art cross-fades faintly behind the waves. Opening a game: an "options" panel from the end edge.
   Rules followed (docs/THEME-KIT.md): only a window of ~20 rows exists in the DOM (4 elements each), images via
   api.lazy with the small header art, the hero image once (the faded backdrop), transforms only on those rows and the
   category row, the waves are the one large animation, DOM writes only in render() and on input (plus the wave frames
   and the clock's text once a minute).
   Nothing leaves the console (2026-11): Friends is a column of your friends (in a game first, then online, then
   offline; Enter = message / profile), Store is a column of shelves (Specials, Top sellers, New, Coming soon, Most
   played) that open like console folders into games with their price — read from Steam's public store services —
   and on every other page (store, community, a game page, downloads) Steam's top bar is replaced by a slim console
   bar: back to the Crossbar, back / forward, the page's name, the clock (Chrome, below). */
(function () {
  'use strict';
  const api = window.__rfsLayoutApi;
  if (!api) return;
  const { T, esc, div, $, ic, cssUrl, first, lazy, fmtPlaytime, fmtAgo, fmtSize, NUM } = api;
  const LTR = api.LTR;
  const EASE = 'cubic-bezier(.22,.7,.2,1)';
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const bar = () => document.getElementById('rfs-bar');
  /** Big Picture (the TV window, driven by a controller: src/js/shelf.js "Big Picture host") */
  const isBpm = () => document.documentElement.classList.contains('rfs-bpm');
  /** Big Picture's own window navigator (friends & chat, downloads …) */
  const gpNav = () => { try { const c = window.opener && window.opener.SteamUIStore ? window.opener : window; return c.SteamUIStore.WindowStore.GamepadUIMainWindowInstance.m_Navigator; } catch (e) { return null; } };
  /* ---- sound: the engine lives in xmb-audio.js next to this file (ambience track + synthesised menu sounds, both
     off by default). Crossbar's own toggles are the authority for its sounds; the core's sfx() is not used here. */
  const AUDIO = ((document.currentScript && document.currentScript.src) || '').replace(/xmb\.js(\?.*)?$/, 'xmb-audio.js');
  if (AUDIO && /xmb-audio\.js/.test(AUDIO) && !document.querySelector('script[data-xmb-audio]')) {
    const s = document.createElement('script'); s.src = AUDIO; s.dataset.xmbAudio = '1'; document.head.appendChild(s);
  }
  const XA = () => window.__xmbAudio || null;
  const sfx = k => { const a = XA(); if (a) a.play(k); };

  /* ---- colour: six presets + "the month" (the console changed its colour each month). [top, middle, bottom, glow rgb] */
  const TINTS = {
    blue: ['#1d4fa6', '#0d2a66', '#040c24', '120, 175, 255'],
    teal: ['#137480', '#0a3f4c', '#03141b', '110, 220, 230'],
    violet: ['#5a3aa6', '#2c1c5e', '#0b0720', '185, 150, 255'],
    crimson: ['#a3263c', '#56101f', '#18040a', '255, 140, 160'],
    amber: ['#a8701e', '#5a3a0e', '#180f04', '255, 200, 120'],
    graphite: ['#4a5466', '#232a38', '#0a0d14', '200, 215, 240'],
  };
  const MONTHS = [
    ['#55607a', '#262d40', '#0b0e18', '205, 215, 240'], // Jan: silver
    ['#9a7a24', '#4d3b0e', '#161004', '255, 215, 120'], // Feb: gold
    ['#5f8a1e', '#2e450c', '#0c1404', '200, 240, 120'], // Mar: lime
    ['#a04a7e', '#521f40', '#170812', '255, 160, 210'], // Apr: pink
    ['#2a8a46', '#12451f', '#041408', '130, 235, 160'], // May: green
    ['#6a42a8', '#341d58', '#0e0719', '190, 155, 255'], // Jun: purple
    ['#178490', '#0a434c', '#031418', '110, 220, 230'], // Jul: teal
    ['#2470c4', '#103a70', '#040f22', '120, 185, 255'], // Aug: sky
    ['#4048b4', '#1f2360', '#07081c', '160, 165, 255'], // Sep: indigo
    ['#a6782a', '#56390f', '#170e04', '255, 205, 130'], // Oct: amber
    ['#94522c', '#4b2412', '#150904', '255, 170, 130'], // Nov: copper
    ['#a8283a', '#58111c', '#180408', '255, 140, 155'], // Dec: red
  ];
  const TINT_KEY = 'rfs.xmb.tint';
  const tintId = () => { try { const v = localStorage.getItem(TINT_KEY); return v && (v === 'month' || TINTS[v]) ? v : 'blue'; } catch (e) { return 'blue'; } };
  const tintOf = id => id === 'month' ? MONTHS[new Date().getMonth()] : TINTS[id] || TINTS.blue;
  function applyTint(el, id) {
    const p = tintOf(id);
    el.style.setProperty('--xb-1', p[0]); el.style.setProperty('--xb-2', p[1]);
    el.style.setProperty('--xb-3', p[2]); el.style.setProperty('--xb-g', p[3]);
  }
  const TINT_NAMES = {
    month: T('لون الشهر', 'Colour of the month'), blue: T('أزرق', 'Blue'), teal: T('فيروزي', 'Teal'), violet: T('بنفسجي', 'Violet'),
    crimson: T('عنابي', 'Crimson'), amber: T('كهرماني', 'Amber'), graphite: T('رمادي', 'Graphite'),
  };

  /* ---- the ribbon waves: ONE SVG, six paths (two ribbons, each a translucent band between two flowing edges, a bright
     edge line with one soft glow copy, plus two thin strands inside the front ribbon). Every edge is a sum of three
     travelling sine waves going different ways at different speeds, so the shape keeps morphing; the band's thickness
     is its own travelling wave, so the ribbon twists where it crosses zero. Time is the page clock, so a re-render
     never makes the waves jump. Drawn at ≤ 30 fps; idle (no frames) while hidden, a game is open or off the home page. */
  const VW = 1440, VH = 900, TAU = Math.PI * 2;
  const RIBBONS = [
    { base: 540, a: [64, 30, 14], k: [1, 2.3, 3.7], w: [.21, -.33, .17], p: [.4, 1.9, 3.1], th: 58, tk: 1.4, tw: -.26, tp: 2.0, to: .3 },
    { base: 612, a: [42, 22, 10], k: [.8, 1.9, 3.1], w: [-.13, .19, -.27], p: [2.2, .3, 1.1], th: 36, tk: 1.7, tw: .18, tp: .7, to: .55 },
  ];
  function edgeY(r, x, t) {
    const X = x * TAU / VW;
    return r.base + r.a[0] * Math.sin(r.k[0] * X + r.w[0] * t + r.p[0]) + r.a[1] * Math.sin(r.k[1] * X + r.w[1] * t + r.p[1])
      + r.a[2] * Math.sin(r.k[2] * X + r.w[2] * t + r.p[2]);
  }
  const thick = (r, x, t) => r.th * (Math.sin(r.tk * x * TAU / VW + r.tw * t + r.tp) + r.to);
  /** a smooth path through points (quadratic curves through the midpoints) */
  function smooth(pts, start) {
    let d = (start || 'M') + pts[0][0] + ' ' + pts[0][1].toFixed(1);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += 'Q' + pts[i][0] + ' ' + pts[i][1].toFixed(1) + ' ' + mx + ' ' + my.toFixed(1);
    }
    const l = pts[pts.length - 1];
    return d + 'L' + l[0] + ' ' + l[1].toFixed(1);
  }
  function waveFrame(t) {
    const out = {};
    RIBBONS.forEach((r, n) => {
      const top = [], bot = [], s1 = [], s2 = [];
      for (let x = -60; x <= VW + 60; x += 40) {
        const y = edgeY(r, x, t), d = thick(r, x, t);
        top.push([x, y]); bot.push([x, y + d]);
        if (!n) {
          s1.push([x, y + d * (.36 + .1 * Math.sin(x * TAU / VW * 2.2 + t * .41))]);
          s2.push([x, y + d * (.7 + .08 * Math.sin(x * TAU / VW * 1.6 - t * .29 + 1.3))]);
        }
      }
      out['b' + n] = smooth(top) + smooth(bot.slice().reverse(), 'L') + 'Z';
      out['l' + n] = smooth(top);
      if (!n) { out.s1 = smooth(s1); out.s2 = smooth(s2); }
    });
    return out;
  }
  function waveSVG() {
    const f = waveFrame(performance.now() / 1000);
    return `<svg class="xb-wave" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="none" aria-hidden="true" focusable="false">`
      + '<defs><linearGradient id="xbw-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".02"/>'
      + '<stop offset=".45" stop-color="#fff" stop-opacity=".15"/><stop offset="1" stop-color="#fff" stop-opacity=".01"/></linearGradient></defs>'
      + `<path class="band b1" data-w="b1" d="${f.b1}"/><path class="line l1" data-w="l1" d="${f.l1}"/>`
      + `<path class="band b0" data-w="b0" d="${f.b0}"/><use class="glow" href="#xbw-l0"/><path id="xbw-l0" class="line l0" data-w="l0" d="${f.l0}"/>`
      + `<path class="strand" data-w="s1" d="${f.s1}"/><path class="strand dim" data-w="s2" d="${f.s2}"/></svg>`;
  }
  /* the wave lives in its own shadow root: redrawing its paths 30 times a second used to restyle the whole Steam
     window — the community base has page-wide :has() rules (one matches on a path's "d" attribute), so every
     path change re-checked them from the path up to <html> and restyled every icon (≈ 9 ms a frame, ~30 % of the
     main thread at rest). Changes inside a shadow root never reach the page's :has() rules. Same drawing as before. */
  const WAVE_CSS = `:host { position: absolute; inset: 0; display: block; pointer-events: none; }
    .xb-wave { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    .band { fill: url(#xbw-fill); }
    .band.b1 { opacity: .6; }
    :is(.glow, .line, .strand) { fill: none; vector-effect: non-scaling-stroke; stroke-linecap: round; }
    .glow { stroke: rgba(var(--xb-g), .2); stroke-width: 10; }
    .line.l0 { stroke: rgba(255, 255, 255, .7); stroke-width: 1.4; }
    .line.l1 { stroke: rgba(255, 255, 255, .34); stroke-width: 1.1; }
    .strand { stroke: rgba(255, 255, 255, .3); stroke-width: 1; }
    .strand.dim { stroke: rgba(255, 255, 255, .17); }`;
  function waveHost(host) {
    if (!host) return null;
    const sr = host.shadowRoot || host.attachShadow({ mode: 'open' });
    sr.innerHTML = `<style>${WAVE_CSS}</style>${waveSVG()}`;
    return sr.querySelector('.xb-wave');
  }
  const Wave = {
    svg: null, paths: null, raf: 0, idle: 0, last: 0,
    attach(svg) {
      if (!svg) return;
      this.svg = svg; this.paths = {};
      for (const p of svg.querySelectorAll('[data-w]')) this.paths[p.dataset.w] = p;
      this.kick();
    },
    kick() { if (!this.raf && !this.idle && this.svg) this.raf = requestAnimationFrame(this.frame); },
    frame(ts) {
      const W = Wave;
      W.raf = 0;
      if (!W.svg || !W.svg.isConnected) { W.svg = null; return; }   // the design was replaced: stop
      if (reduced()) return;                                         // reduced motion: the still frame stays
      if (document.hidden || api.openId != null || !api.root.classList.contains('on')) {
        W.idle = setTimeout(() => { W.idle = 0; W.kick(); }, 700);   // idle: check again now and then, no frames
        return;
      }
      if (ts - W.last >= 33) {
        W.last = ts;
        const f = waveFrame(ts / 1000);
        for (const k in W.paths) W.paths[k].setAttribute('d', f[k]);
      }
      W.raf = requestAnimationFrame(W.frame);
    },
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) Wave.kick(); });

  /* ---- clock + date at the top end (one text write a minute, skipped while hidden) */
  const LOC = LTR ? 'en-US' : 'ar-u-nu-latn';
  const fmtT = (() => { try { return new Intl.DateTimeFormat(LOC, { hour: 'numeric', minute: '2-digit' }); } catch (e) { return null; } })();
  const fmtD = (() => { try { return new Intl.DateTimeFormat(LOC, { weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { return null; } })();
  const clockText = () => { const d = new Date(); return [fmtT ? fmtT.format(d) : d.toTimeString().slice(0, 5), fmtD ? fmtD.format(d) : d.toDateString()]; };
  let clockTimer = 0;
  function paintClock() {
    const c = Layout.clock;
    if (!c || !c.isConnected) { clearInterval(clockTimer); clockTimer = 0; return; }
    if (document.hidden) return;
    const [t, d] = clockText(), key = t + '|' + d;
    if (c._k === key) return;
    c._k = key;
    c.firstElementChild.textContent = t; c.lastElementChild.textContent = d;
  }

  /* ---- the categories */
  const CATS = [
    { id: 'search', icon: 'search', name: T('البحث', 'Search') },
    { id: 'profile', icon: 'users', name: T('الملف الشخصي', 'Profile') },
    { id: 'recent', icon: 'clock', name: T('الأخيرة', 'Recent') },
    { id: 'installed', icon: 'drive', name: T('المثبتة', 'Installed') },
    { id: 'all', icon: 'library', name: T('كل الألعاب', 'All games') },
    { id: 'top', icon: 'fire', name: T('الأكثر لعباً', 'Most played') },
    { id: 'genres', icon: 'tag', name: T('الأنواع', 'Genres') },
    { id: 'store', icon: 'cart', name: T('المتجر', 'Store') },
    { id: 'community', icon: 'globe', name: T('المجتمع', 'Community') },
    { id: 'friends', icon: 'msg', name: T('الأصدقاء', 'Friends') },
    { id: 'downloads', icon: 'download', name: T('التنزيلات', 'Downloads') },
    { id: 'options', icon: 'sliders', name: T('الخيارات', 'Options') },
    { id: 'power', icon: 'cpu', name: T('الطاقة', 'Power') },
  ];
  /* ---- Steam's own window: its class names (Millennium's readable → hashed map), the signed-in user, the window API */
  function steamClass(key, ...hints) {
    const maps = [];
    try { if (window.opener && window.opener.MILLENNIUM_API) maps.push(...(window.opener.MILLENNIUM_API.classMapList || [])); } catch (e) { /* cross-origin */ }
    try { if (window.MILLENNIUM_API) maps.push(...(window.MILLENNIUM_API.classMapList || [])); } catch (e) { /* none */ }
    for (const m of maps) if (m && typeof m[key] === 'string' && hints.every(h => h in m)) return m[key].split(' ')[0];
    return '';
  }
  /** the signed-in user as Steam's (hidden) account box shows it: avatar + name, best effort */
  function steamUser() {
    const c = steamClass('AccountMenu', 'TitleBarControls');
    const box = c && document.querySelector('.' + c);
    if (!box) return { name: '', avatar: '' };
    const img = box.querySelector('img');
    return { name: (box.textContent || '').trim().split('\n')[0].trim().slice(0, 40), avatar: img && img.src ? img.src : '' };
  }
  const win = () => { try { return window.SteamClient && window.SteamClient.Window ? window.SteamClient.Window : null; } catch (e) { return null; } };
  const dlInfo = () => { const d = document.getElementById('rfs-dl'), p = d && d.querySelector('.pct'); return { busy: !!d && d.classList.contains('busy'), pct: p ? p.textContent.trim() : '' }; };
  const url = u => { try { api.steamUrl(u); } catch (e) { api.toast(T('ما قدرت أفتحها', 'Couldn\'t open that')); } };
  /** Steam's shared context (its stores and services) */
  const CTX = () => { try { return api.steam() || window; } catch (e) { return window; } };
  const fmtDay = (() => { try { const f = new Intl.DateTimeFormat(LOC, { day: 'numeric', month: 'short', year: 'numeric' }); return sec => f.format(new Date(sec * 1000)); } catch (e) { return sec => new Date(sec * 1000).toDateString(); } })();

  /* ---- the store inside the cross: shelves that open like console folders. The lists come from the store's own
     public search (which games are on a shelf) and Steam's store service (name, art, price in the user's country,
     reviews) — both answer this window directly; nothing is scraped from a page. Kept 10 minutes. */
  const ASSET = 'https://shared.fastly.steamstatic.com/store_item_assets/';
  const SHOP = [
    { id: 'specials', icon: 'percent', name: T('العروض', 'Specials'), sub: T('ألعاب عليها خصم الحين', 'Games on sale right now'), q: 'specials=1' },
    { id: 'topsellers', icon: 'trend', name: T('الأكثر مبيعاً', 'Top sellers'), sub: T('اللي الناس تشتريه هالأيام', 'What people are buying'), q: 'filter=topsellers' },
    { id: 'popularnew', icon: 'sparkle', name: T('جديد ورائج', 'New & trending'), sub: T('إصدارات جديدة عليها إقبال', 'Fresh releases doing well'), q: 'filter=popularnew&sort_by=Released_DESC' },
    { id: 'comingsoon', icon: 'calendar', name: T('قريباً', 'Coming soon'), sub: T('ألعاب منتظرة', 'Popular upcoming games'), q: 'filter=comingsoon' },
    { id: 'mostplayed', icon: 'chart', name: T('الأكثر لعباً الحين', 'Most played'), sub: T('أعلى الألعاب بعدد اللاعبين', 'The biggest games by players'), charts: true },
  ];
  const Shop = {
    cc: null, cache: new Map(), TTL: 10 * 60e3,
    async country() {
      if (this.cc != null) return this.cc;
      try { const c = await CTX().SteamClient.User.GetIPCountry(); this.cc = /^[A-Z]{2}$/.test(c) ? c : ''; } catch (e) { this.cc = ''; }
      return this.cc;
    },
    async json(u) { const r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); },
    async ids(sec) {
      if (sec.charts) {
        const r = await this.json('https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/');
        return ((r.response && r.response.ranks) || []).slice(0, 40).map(x => x.appid);
      }
      const r = await this.json(`https://store.steampowered.com/search/results/?${sec.q}&json=1&count=40&l=${LTR ? 'english' : 'arabic'}`);
      const out = [];
      for (const i of r.items || []) { const m = /\/apps\/(\d+)\//.exec(i.logo || ''); if (m && !out.includes(+m[1])) out.push(+m[1]); }
      return out;
    },
    async items(ids) {
      const cc = await this.country();
      const context = { language: LTR ? 'english' : 'arabic' };
      if (cc) context.country_code = cc;
      const q = { ids: ids.map(appid => ({ appid })), context, data_request: { include_assets: true, include_basic_info: true, include_release: true, include_reviews: true } };
      const r = await this.json('https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=' + encodeURIComponent(JSON.stringify(q)));
      const by = new Map();
      for (const it of (r.response && r.response.store_items) || []) {
        if (!it || it.success !== 1 || !it.name || it.visible === false) continue;
        const a = it.assets || {}, f = a.asset_url_format || '', pic = n => (n && f ? ASSET + f.replace('${FILENAME}', n) : '');
        const b = it.best_purchase_option || {}, rv = it.reviews && it.reviews.summary_filtered, rel = it.release || {}, bi = it.basic_info || {};
        by.set(it.id, {
          appid: it.id, name: it.name, img: pic(a.header) || pic(a.main_capsule), hero: pic(a.library_hero) || pic(a.header),
          price: b.formatted_final_price || '', was: b.formatted_original_price || '', pct: b.discount_pct | 0, free: !!it.is_free,
          soon: !!rel.is_coming_soon, date: +rel.steam_release_date || 0,
          rev: rv && rv.review_count ? `${rv.review_score_label} · ${rv.percent_positive}%` : '',
          desc: (bi.short_description || '').replace(/\s+/g, ' ').trim(), dev: ((bi.developers || [])[0] || {}).name || '',
        });
      }
      return ids.map(i => by.get(i)).filter(Boolean);
    },
    async load(sec) {
      const c = this.cache.get(sec.id);
      if (c && Date.now() - c.t < this.TTL) return c.items;
      const ids = await this.ids(sec);
      const items = ids.length ? await this.items(ids) : [];
      this.cache.set(sec.id, { t: Date.now(), items });
      return items;
    },
  };
  /** the price line of a store game: "-25%  11.24 KD  14.99 KD" · Free to play · Coming soon · date */
  function priceHTML(s) {
    if (s.soon) return `<span class="pr soon">${esc(T('قريباً', 'Coming soon'))}${s.date ? ' · ' + esc(fmtDay(s.date)) : ''}</span>`;
    if (s.free) return `<span class="pr">${esc(T('مجانية', 'Free to play'))}</span>`;
    if (!s.price) return '';
    return (s.pct ? `<span class="pc" dir="ltr">-${s.pct}%</span>` : '') + `<span class="pr" dir="ltr">${esc(s.price)}</span>` + (s.pct && s.was ? `<s dir="ltr">${esc(s.was)}</s>` : '');
  }

  /* ---- friends, as the console lists them: in a game first, then online, away, offline (Steam's own friend store) */
  const PSTATE = [T('غير متصل', 'Offline'), T('متصل', 'Online'), T('مشغول', 'Busy'), T('بعيد', 'Away'), T('نايم', 'Snooze'), T('يبي يتبادل', 'Looking to trade'), T('يبي يلعب', 'Looking to play'), T('غير متصل', 'Offline')];
  function friendRows() {
    const out = [];
    try {
      const fs = CTX().friendStore;
      for (const fr of (fs && fs.allFriends) || []) {
        if (fr.efriendrelationship !== 3) continue; // friends only (not invites / blocked)
        const p = fr.persona || {};
        let name = ''; try { name = fr.display_name || ''; } catch (e) { /* not loaded */ }
        name = name || p.m_strPlayerName || '';
        if (!name) { try { if (fr.LoadIfNecessary) fr.LoadIfNecessary(); } catch (e) { /* later */ } continue; }
        const gid = p.m_gameid && String(p.m_gameid) !== '0' ? String(p.m_gameid) : '', st = p.m_ePersonaState | 0;
        let game = '', rp = '';
        if (gid) {
          try { game = fr.current_game_name || ''; } catch (e) { /* app info not ready */ }
          game = game || p.m_strGameExtraInfo || '';
          try { rp = fr.current_game_rich_presence || ''; } catch (e) { /* none */ }
        }
        out.push({
          id: fr.accountid, sid: fr.steamid64, name, avatar: p.avatar_url_full || p.avatar_url_medium || '', state: st,
          appid: gid ? +p.m_unGamePlayedAppID || 0 : 0, game, rp: typeof rp === 'string' ? rp : '', last: +p.m_rtLastSeenOnline || 0,
          rank: gid ? 0 : st === 1 || st === 5 || st === 6 ? 1 : st >= 2 && st <= 4 ? 2 : 3,
        });
      }
    } catch (e) { /* the friend store is not ready */ }
    return out.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  }
  const friendLine = f => f.rank === 0 ? (f.game ? T(`يلعب ${f.game}`, `Playing ${f.game}`) : T('داخل لعبة', 'In a game'))
    : f.rank === 3 ? (f.last ? `${PSTATE[0]} · ${fmtAgo(f.last)}` : PSTATE[0]) : PSTATE[f.state] || PSTATE[1];
  /** the slim console bar on every other page (an Option; on by default) */
  const BAR_KEY = 'rfs.xmb.bar';
  const barOn = () => { try { return localStorage.getItem(BAR_KEY) !== '0'; } catch (e) { return true; } };
  /* ---- the items of the categories that came from Steam's top bar (a console "settings column" each) */
  const ACTS = {
    profile: [
      { id: 'me', icon: 'users', name: T('ملفي الشخصي', 'My profile'), sub: () => steamUser().name || T('صفحتك في المجتمع', 'Your community page'), run: () => url('steam://url/SteamIDMyProfile') },
      { id: 'account', icon: 'receipt', name: T('تفاصيل الحساب', 'Account details'), sub: () => T('المحفظة والمشتريات والأمان', 'Wallet, purchases and security'), run: () => url('steam://url/StoreAccount') },
      { id: 'family', icon: 'users', name: T('العائلة', 'Family'), sub: () => T('إدارة عائلة ستيم', 'Manage your Steam Family'), run: () => url('steam://url/FamilyManagement') },
    ],
    store: [
      { id: 'wishlist', icon: 'star', name: T('قائمة الرغبات', 'Wishlist'), sub: () => T('الألعاب اللي ناوي عليها', 'The games you are waiting for'), run: () => url('steam://url/UserWishlist') },
      { id: 'storesearch', icon: 'search', name: T('البحث في المتجر', 'Search the store'), sub: () => T('كل ألعاب ستيم', 'Every game on Steam'), run: () => url('steam://url/StoreGameSearchPage') },
      { id: 'storehome', icon: 'cart', name: T('واجهة المتجر الكاملة', 'The full store'), sub: () => T('صفحة المتجر بثيم الكونسول', 'The store front, in the console look'), run: () => url('steam://url/StoreFrontPage') },
      { id: 'cart', icon: 'receipt', name: T('السلة', 'Cart'), sub: () => T('اللي اخترته للشراء', 'What you picked to buy'), run: () => url('steam://url/StoreCart') },
      { id: 'points', icon: 'medal', name: T('متجر النقاط', 'Points Shop'), sub: () => T('استبدل نقاطك', 'Spend your points'), run: () => url('steam://url/PointsShop') },
    ],
    community: [
      { id: 'commhome', icon: 'globe', name: T('صفحة المجتمع', 'Community home'), sub: () => T('النقاشات والصور والمحتوى', 'Discussions, artwork and more'), run: () => url('steam://url/CommunityFrontPage') },
      { id: 'help', icon: 'info', name: T('الدعم', 'Support'), sub: () => T('مساعدة ستيم', 'Steam Support'), run: () => url('steam://url/HelpFrontPage') },
    ],
    friends: [
      { id: 'chat', icon: 'msg', name: T('الأصدقاء والدردشة', 'Friends & chat'), sub: () => T('افتح قائمة الأصدقاء', 'Open the friends list'), run: () => url('steam://open/friends') },
      { id: 'addfriend', icon: 'users', name: T('إضافة صديق', 'Add a friend'), sub: () => T('بالاسم أو الرابط', 'By name or invite link'), run: () => url('steam://url/CommunityAddFriends') },
      { id: 'notes', icon: 'news', name: T('التنبيهات', 'Notifications'), sub: () => T('تنبيهات ستيم', 'Steam notifications'), run() { Chrome.peekNotifications(); } },
    ],
    downloads: [
      { id: 'dl', icon: 'download', name: T('التنزيلات', 'Downloads'), sub: () => { const d = dlInfo(); return d.busy ? T(`جاري التنزيل ${d.pct}`, `Downloading ${d.pct}`) : d.pct ? T(`${d.pct} في الطابور`, `${d.pct} queued`) : T('ما في تنزيلات', 'Nothing downloading'); }, run: () => { const d = document.getElementById('rfs-dl'); if (d) d.click(); } },
    ],
    power: [
      { id: 'min', icon: 'chevD', name: T('تصغير النافذة', 'Minimize'), sub: () => T('يبقى ستيم شغّال', 'Steam keeps running'), run: () => { const w = win(); if (w) w.Minimize(); } },
      { id: 'bpm', icon: 'gamepad', name: T('وضع الشاشة الكبيرة', 'Big Picture mode'), sub: () => T('للتلفزيون ويد التحكم', 'For the TV and a controller'), run: () => url('steam://open/bigpicture') },
      { id: 'close', icon: 'x', name: T('إغلاق النافذة', 'Close window'), sub: () => T('ستيم يبقى في شريط المهام', 'Steam stays in the tray'), run: () => { const w = win(); if (w) w.Close(); } },
      { id: 'exit', icon: 'external', name: T('الخروج من ستيم', 'Exit Steam'), sub: () => Layout.exitArm && Date.now() - Layout.exitArm < 4000 ? T('اضغط Enter مرة ثانية للخروج', 'Press Enter again to exit') : T('يقفل ستيم بالكامل', 'Quits Steam completely'), run() { if (Layout.exitArm && Date.now() - Layout.exitArm < 4000) { Layout.exitArm = 0; url('steam://exit'); } else { Layout.exitArm = Date.now(); Layout.refreshActs(); } } },
    ],
  };
  /* ---- Big Picture: the same columns, minus what only makes sense on the desktop (window buttons, the desktop's
     notification bell, "open Big Picture"); friends and downloads open Big Picture's own pages */
  function bpmActs() {
    const nav = (fn, u) => () => { const n = gpNav(); try { if (n && n[fn]) { n[fn](); return; } } catch (e) { /* older Steam */ } url(u); };
    return {
      ...ACTS,
      friends: [
        { id: 'chat', icon: 'msg', name: T('الأصدقاء والدردشة', 'Friends & chat'), sub: () => T('افتح قائمة الأصدقاء', 'Open the friends list'), run: nav('Chat', 'steam://open/friends') },
        ACTS.friends.find(a => a.id === 'addfriend'),
      ],
      downloads: [{ ...ACTS.downloads[0], run: nav('Downloads', 'steam://open/downloads') }],
      power: [
        { id: 'leavebpm', icon: 'gamepad', name: T('الخروج من الشاشة الكبيرة', 'Exit Big Picture'), sub: () => T('رجوع لستيم على سطح المكتب', 'Back to Steam on the desktop'), run: () => url('steam://close/bigpicture') },
        ACTS.power.find(a => a.id === 'exit'),
      ],
    };
  }
  /* ---- the desktop chrome. Steam's top bar never shows in this style:
       • on the Crossbar home it is gone (the design takes the full window; a thin drag strip + fade-in window buttons
         in the top-end corner keep the window usable);
       • on every other page (store, community, a game page, downloads …) a slim console bar takes its place: back to
         the Crossbar, back / forward, the page's name, shortcuts, the clock, the window buttons. Steam's bar keeps
         44 px of height, invisible, and the console bar sits exactly there — the store page is a native view placed
         under that height, so nothing may float over it. "Steam bar" shows the real bar for a moment (account menu,
         Steam / View / Help menus); the Option "Console bar on every page" turns the replacement off.
     Switching theme or Big Picture brings Steam's bar back at once. */
  const Chrome = {
    style: null, obs: null, nav: null, timer: 0, peekT: 0, peekMode: '', sig: '',
    top() { return steamClass('TopBar', 'OuterFrame', 'ContentFrame') || '_3Z7VQ1IMk4E3HsHvrkLNgo'; },
    css() {
      const top = this.top();
      return `html.xb-full:not(.rfs-bpm):not(.xb-peek) .${top} { display: none !important; }
html.xb-away:not(.rfs-bpm):not(.xb-peek) .${top} { flex: none !important; height: 44px !important; min-height: 44px !important; max-height: 44px !important; overflow: hidden !important; visibility: hidden !important; }`;
    },
    init() {
      if (this.obs) return;
      this.style = document.createElement('style'); this.style.id = 'xb-chrome'; this.style.textContent = this.css();
      document.head.appendChild(this.style);
      this.obs = new MutationObserver(() => this.sync());
      this.obs.observe(api.root, { attributes: true, attributeFilter: ['class', 'data-layout'] });
      this.obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-rfs-style'] });
      this.sync();
    },
    main() { try { return CTX().SteamUIStore.WindowStore.MainWindowInstance; } catch (e) { return null; } },
    route() { try { return this.main().m_history.location.pathname || ''; } catch (e) { return ''; } },
    sync() {
      const h = document.documentElement, r = api.root;
      const mine = h.dataset.rfsStyle === 'xmb' && !h.classList.contains('rfs-bpm');
      const on = mine && r.classList.contains('on') && r.dataset.layout === 'xmb';
      const away = mine && !on && barOn() && !/^\/library\/home/.test(this.route());
      if (h.classList.contains('xb-full') !== on) h.classList.toggle('xb-full', on);
      if (h.classList.contains('xb-away') !== away) h.classList.toggle('xb-away', away);
      if (h.classList.contains('xb-peek') && !(this.peekMode === 'home' ? on : away)) this.unpeek();
      if (away) this.showNav(); else this.hideNav();
    },
    /** Notifications live in Steam's bar: show it for a moment and press its bell (the bar hides again on the next move) */
    peekNotifications() {
      const h = document.documentElement;
      this.peekMode = 'home';
      h.classList.toggle('xb-peek', true);
      const c = steamClass('NotificationsButton', 'TitleBarControls');
      requestAnimationFrame(() => { const b = c && document.querySelector('.' + c); if (b) b.click(); });
    },
    /** away from home: Steam's real bar for a moment (it leaves again shortly after the pointer does) */
    peekAway() {
      const h = document.documentElement, tb = document.querySelector('.' + this.top());
      this.peekMode = 'away';
      h.classList.toggle('xb-peek', true);
      clearTimeout(this.peekT);
      const off = () => { if (tb) { tb.removeEventListener('mouseleave', leave); tb.removeEventListener('mouseenter', enter); } this.unpeek(); };
      const leave = () => { clearTimeout(this.peekT); this.peekT = setTimeout(off, 2500); };
      const enter = () => clearTimeout(this.peekT);
      if (tb) { tb.addEventListener('mouseleave', leave); tb.addEventListener('mouseenter', enter); }
      this.peekT = setTimeout(off, 9000);
    },
    unpeek() { clearTimeout(this.peekT); const h = document.documentElement; if (h.classList.contains('xb-peek')) h.classList.toggle('xb-peek', false); },

    /* ---------- the console bar ---------- */
    showNav() {
      if (this.nav && this.nav.isConnected) return;
      const n = this.nav = document.createElement('div');
      n.id = 'xb-nav'; n.dir = LTR ? 'ltr' : 'rtl'; n.setAttribute('role', 'navigation'); n.setAttribute('aria-label', T('شريط الكونسول', 'Console bar'));
      const b = (k, icon, label, cls) => `<button type="button" class="xn-b${cls ? ' ' + cls : ''}" data-n="${k}" title="${esc(label)}" aria-label="${esc(label)}">${ic(icon)}</button>`;
      n.innerHTML = `<button type="button" class="xn-home" data-n="home" title="${esc(T('رجوع لقائمة الكونسول', 'Back to the Crossbar'))}">${ic('grid')}<span>${esc(T('الكونسول', 'Crossbar'))}</span></button>
        ${b('back', LTR ? 'chevL' : 'chevR', T('رجوع', 'Back'))}${b('fwd', LTR ? 'chevR' : 'chevL', T('قدّام', 'Forward'))}
        <div class="xn-title"><small></small><b dir="auto"></b></div>
        <div class="xn-quick">${b('store', 'cart', T('المتجر', 'Store'))}${b('community', 'globe', T('المجتمع', 'Community'))}${b('friends', 'msg', T('الأصدقاء', 'Friends'))}${b('downloads', 'download', T('التنزيلات', 'Downloads'))}${b('steam', 'more', T('شريط ستيم (الحساب والقوائم)', 'Steam bar (account and menus)'))}</div>
        <div class="xn-clock" dir="ltr"></div>
        <div class="xn-win">
          <button type="button" data-n="min" title="${esc(T('تصغير', 'Minimize'))}" aria-label="${esc(T('تصغير', 'Minimize'))}"><i class="w-min"></i></button>
          <button type="button" data-n="max" title="${esc(T('تكبير / استعادة', 'Maximize / restore'))}" aria-label="${esc(T('تكبير', 'Maximize'))}"><i class="w-max"></i></button>
          <button type="button" data-n="close" class="w-x" title="${esc(T('إغلاق', 'Close'))}" aria-label="${esc(T('إغلاق', 'Close'))}">${ic('x')}</button>
        </div>`;
      applyTint(n, tintId());
      n.addEventListener('click', e => this.navClick(e));
      document.body.appendChild(n);
      this.sig = ''; this.paintNav();
      clearInterval(this.timer); this.timer = setInterval(() => this.paintNav(), 1000);
    },
    hideNav() {
      clearInterval(this.timer); this.timer = 0;
      if (this.nav) { this.nav.remove(); this.nav = null; }
    },
    /** where we are: the page's kind + name, and whether back / forward have somewhere to go */
    info() {
      const W = CTX(), lib = T('المكتبة', 'Library');
      let path = '', canB = false, canF = false, kind = '', title = '';
      try { const hh = this.main().m_history; path = hh.location.pathname || ''; canB = hh.index > 0; canF = hh.index < hh.length - 1; } catch (e) { /* older Steam */ }
      const app = /^\/library\/app\/(\d+)/.exec(path);
      if (app) { const g = api.byId(+app[1]); kind = lib; title = g ? g.name : ''; }
      else if (/^\/library\/downloads/.test(path)) { kind = lib; title = T('التنزيلات', 'Downloads'); }
      else if (/^\/library/.test(path)) { kind = lib; title = /collection/.test(path) ? T('المجموعات', 'Collections') : ''; }
      else {
        let u = '', t = '';
        try { const bm = W.MainWindowBrowserManager; u = bm.m_URL || ''; t = bm.m_strTitle || ''; } catch (e) { /* none */ }
        kind = /steamcommunity\.com/.test(u) ? T('المجتمع', 'Community') : /help\.steampowered/.test(u) ? T('الدعم', 'Support') : /steampowered\.com/.test(u) ? T('المتجر', 'Store') : 'Steam';
        title = /^(data:|https?:|about:)/.test(t) ? '' : t;
      }
      return { path, canB, canF, kind, title };
    },
    /** once a second while the bar is up: one read, a write only when something changed */
    paintNav() {
      const n = this.nav;
      if (!n || !n.isConnected) { this.hideNav(); return; }
      if (document.hidden) return;
      const i = this.info(), clock = clockText()[0];
      if (/^\/library\/home/.test(i.path) && api.root.classList.contains('on')) { this.sync(); return; }
      const sig = [i.kind, i.title, i.canB, i.canF, clock].join('\n');
      if (sig === this.sig) return;
      this.sig = sig;
      n.querySelector('.xn-title small').textContent = i.kind;
      n.querySelector('.xn-title b').textContent = i.title;
      n.querySelector('[data-n="back"]').disabled = !i.canB;
      n.querySelector('[data-n="fwd"]').disabled = !i.canF;
      n.querySelector('.xn-clock').textContent = clock;
    },
    navClick(e) {
      const k = e.target.closest('[data-n]');
      if (!k) return;
      const mw = this.main(), w = win();
      try {
        switch (k.dataset.n) {
          case 'home': CTX().SteamUIStore.Navigate('/library/home'); break;
          case 'back': if (mw.NavigateBack) mw.NavigateBack(); else mw.m_history.goBack(); break;
          case 'fwd': mw.m_history.goForward(); break;
          case 'store': url('steam://url/StoreFrontPage'); break;
          case 'community': url('steam://url/CommunityFrontPage'); break;
          case 'friends': url('steam://open/friends'); break;
          case 'downloads': url('steam://open/downloads'); break;
          case 'steam': this.peekAway(); break;
          case 'min': if (w) w.Minimize(); break;
          case 'max': if (w) w.ToggleMaximize(); break;
          case 'close': if (w) w.Close(); break;
        }
      } catch (err) { /* Steam changed something: the real bar is one click away ("Steam bar") */ }
      sfx('tick');
      setTimeout(() => this.paintNav(), 250);
    },
  };
  /* ---- the console Options (everything the old filter strip did) */
  const OPTS = [
    { id: 'source', icon: 'library', name: T('المكتبة', 'Library'), menu: true },
    { id: 'sort', icon: 'sort', name: T('الترتيب', 'Sort by'), menu: true },
    { id: 'genre', icon: 'tag', name: T('النوع', 'Genre'), menu: true },
    { id: 'tint', icon: 'palette', name: T('لون الخلفية', 'Background colour'), menu: true },
    { id: 'news', icon: 'news', name: T('آخر تحديثات ألعابك', 'What\'s New'), menu: false },
    { id: 'amb', icon: 'volume', name: T('أجواء الخلفية', 'Background ambience'), menu: false },
    { id: 'msfx', icon: 'pulse', name: T('أصوات القائمة', 'Menu sounds'), menu: false },
    { id: 'family', icon: 'owned', name: T('وضع العائلة', 'Family mode'), menu: false },
    { id: 'bar', icon: 'monitor', name: T('شريط الكونسول بكل الصفحات', 'Console bar on every page'), menu: false },
    { id: 'settings', icon: 'sliders', name: T('إعدادات ستيم', 'Steam settings'), menu: false },
    { id: 'themes', icon: 'sparkle', name: T('تصاميم الثيم', 'Theme designs'), menu: false },
  ];
  const ON = T('شغّال', 'On'), OFF = T('طافي', 'Off');
  const countGames = n => T(
    n === 1 ? 'لعبة وحدة' : n === 2 ? 'لعبتين' : n >= 3 && n <= 10 ? `${NUM.format(n)} ألعاب` : `${NUM.format(n)} لعبة`,
    `${NUM.format(n)} ${n === 1 ? 'game' : 'games'}`);
  const txt = sel => { const b = bar(), e = b && b.querySelector(sel); return e ? e.textContent.trim() : ''; };
  /** an option's current value, as the strip shows it */
  function optValue(id) {
    const st = api.state;
    if (id === 'sort') { const b = bar() && bar().querySelector(`.tb-sort .rf-dd-menu button[data-v="${st.sort}"]`); return b ? b.textContent.trim() : txt('.tb-sort-name'); }
    if (id === 'source') return txt('.tb-src-name');
    if (id === 'genre') return st.genre || T('كل الأنواع', 'All genres');
    if (id === 'tint') return TINT_NAMES[tintId()];
    if (id === 'news') return st.news ? ON : OFF;
    if (id === 'amb') return XA() && XA().amb ? ON : OFF;
    if (id === 'msfx') return XA() && XA().sfx ? ON : OFF;
    if (id === 'family') { const f = document.getElementById('rfs-family'); return f && f.classList.contains('on') ? ON : OFF; }
    if (id === 'bar') return barOn() ? ON : OFF;
    if (id === 'settings') return T('التنزيلات والحساب والواجهة', 'Downloads, account, interface');
    return T('اختر شكل ستيم كله', 'Choose the look of all of Steam');
  }
  /** the choices of a strip dropdown (opening it fills the menu; it is closed again at once) */
  function ddChoices(cls, attr) {
    const b = bar(), dd = b && b.querySelector('.' + cls);
    if (!dd) return [];
    if (cls !== 'tb-sort') { const btn = dd.querySelector('.rf-dd-btn'); if (btn) { btn.click(); dd.classList.remove('open'); } }
    return [...dd.querySelectorAll('.rf-dd-menu button')].map(x => {
      const n = x.querySelector('b');
      return { v: x.getAttribute(attr) || '', label: (x.firstChild && x.firstChild.nodeType === 3 ? x.firstChild.textContent : x.textContent).trim(), n: n ? n.textContent : '', on: x.classList.contains('on') };
    });
  }
  function ddPick(cls, attr, v) {
    const b = bar(), x = b && [...b.querySelectorAll(`.${cls} .rf-dd-menu button`)].find(y => (y.getAttribute(attr) || '') === v);
    if (x) x.click();
  }

  /** the thin second line of a row: hours · last played (· not installed) */
  function subLine(g, run) {
    if (run) return T('شغّالة الحين', 'Running now');
    const bits = [g.playtimeMin ? fmtPlaytime(g.playtimeMin) : T('ما انلعبت', 'Never played')];
    if (g.lastPlayed) bits.push(fmtAgo(g.lastPlayed));
    if (!g.installed) bits.push(T('غير مثبتة', 'Not installed'));
    return bits.join(' · ');
  }
  const OSK = 'abcdefghijklmnopqrstuvwxyz'.split('');

  const Layout = {
    fixedHeight: true,
    dockInside: true,
    el: null, list: null, row: null, info: null, art: null, clock: null, om: null,
    lists: {}, cat: 'recent', sel: 0, selBy: {}, pool: new Map(), G: null,
    acts: null, sub: null, frT: 0, // the Steam items of this mode · the open store shelf · the friends refresh timer
    lastQ: '', lastGenre: '', wheelAcc: 0, wheelT: 0, artUrl: '', artTok: 0, settle: 0,

    render(games, w, h) {
      this.pool = new Map(); this.om = null;
      const st = api.state;
      const q = (st.query || '').trim().toLowerCase();

      // the category lists (all follow the search + genre; Genres counts ignore the genre filter)
      const recent = games.filter(g => g.lastPlayed > 0).sort((a, b) => b.lastPlayed - a.lastPlayed).slice(0, 40);
      const top = games.filter(g => g.playtimeMin > 0).sort((a, b) => b.playtimeMin - a.playtimeMin).slice(0, 100);
      const counts = new Map();
      for (const g of st.games || []) {
        if (q && !g.name.toLowerCase().includes(q)) continue;
        for (const t of g.genres || []) counts.set(t, (counts.get(t) || 0) + 1);
      }
      const genres = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([t, n]) => ({ genre: t, n }));
      if (st.genre) genres.unshift({ genre: '', n: (st.games || []).length, clear: true });
      const all = games.map(g => ({ g }));
      const acts = isBpm() ? bpmActs() : ACTS, opts = isBpm() ? OPTS.filter(o => o.id !== 'amb' && o.id !== 'msfx' && o.id !== 'bar') : OPTS; // Big Picture keeps its own sounds
      this.lists = {
        search: all, recent: recent.map(g => ({ g })), installed: games.filter(g => g.installed).map(g => ({ g })),
        all, top: top.map(g => ({ g })), genres, options: opts.map(o => ({ opt: o })),
        ...Object.fromEntries(Object.entries(acts).map(([k, v]) => [k, v.map(a => ({ act: a }))])),
      };
      this.acts = acts;
      this.lists.store = this.storeList();
      this.lists.friends = this.friendList();
      // a new search shows its matches under Search; a new genre in All games — from the first one
      if (q && q !== this.lastQ) { this.cat = 'search'; this.selBy.search = null; }
      else if (st.genre && st.genre !== this.lastGenre) { this.cat = 'all'; this.selBy.all = null; }
      this.lastQ = q; this.lastGenre = st.genre || '';
      if (!this.lists[this.cat]) this.cat = 'recent';
      if (this.cat === 'recent' && !recent.length) this.cat = 'all';

      // geometry: the focus column, the category row in the upper third, the focus row just under its label
      const narrow = w < 1100, tiny = w < 860;
      const pitch = narrow ? 112 : 128;
      const fx = Math.round(Math.min(300, Math.max(150, w * (narrow ? .19 : .17))));
      const catY = Math.max(176, Math.round(h * .29));
      const G = this.G = { w, h, pitch, fx, catY, focusY: catY + 118, above: catY - 14, rowH: 62, selH: 84, gap: 20 };
      G.below = Math.max(3, Math.ceil((h - G.focusY - G.selH) / G.rowH) + 1);
      const iw = tiny ? 0 : Math.round(Math.min(420, Math.max(290, w * .27)));
      const lw = Math.max(260, (tiny ? w - 32 : w - iw - 56 - 40) - (fx - 88));

      const el = div('xb' + (narrow ? ' narrow' : '') + (tiny ? ' tiny' : ''));
      el.style.height = h + 'px';
      el.style.setProperty('--fx', fx + 'px'); el.style.setProperty('--pitch', pitch + 'px'); el.style.setProperty('--cat-y', catY + 'px');
      el.style.setProperty('--focus-y', G.focusY + 'px'); el.style.setProperty('--iw', iw + 'px'); el.style.setProperty('--lw', lw + 'px');
      applyTint(el, tintId());
      const [ct, cd] = clockText();
      const me = steamUser();
      const cats = CATS.map((c, i) => {
        const n = this.lists[c.id].filter(x => !x.clear).length;
        const sub = this.catSub(c.id, n, q, me);
        const icon = c.id === 'profile' && me.avatar ? `<img class="av" src="${esc(me.avatar)}" alt="">` : ic(c.icon);
        const name = c.id === 'profile' && me.name ? me.name : c.name;
        // data-nopad: in Big Picture ← / → are the categories already; ↑ past the column goes on to Steam's top bar
        return `<button type="button" class="xb-cat" data-c="${c.id}" data-k="${i}" data-nopad aria-label="${esc(name)}"><span class="ico">${icon}</span><span class="lb" dir="auto">${esc(name)}</span><small dir="auto">${esc(sub)}</small></button>`;
      }).join('');
      // [data-pad]: out of the desktop's Tab order, but the controller's to reach (Big Picture: ↑ from the first result)
      const keys = OSK.map(k => `<button type="button" class="xb-k" data-k="${k}" data-pad data-padid="xk-${k}" tabindex="-1">${k}</button>`).join('')
        + `<button type="button" class="xb-k wide" data-k=" " data-pad data-padid="xk-space" tabindex="-1">${esc(T('مسافة', 'Space'))}</button>`
        + `<button type="button" class="xb-k wide" data-k="back" data-pad data-padid="xk-back" tabindex="-1" aria-label="${esc(T('حذف', 'Delete'))}">${ic(LTR ? 'chevL' : 'chevR')}${esc(T('حذف', 'Delete'))}</button>`;
      // Big Picture has no visible search field (the strip stays hidden there): the typed text shows above the keys
      const qv = isBpm() ? `<div class="xb-qv" dir="auto">${q ? esc(st.query) : `<span>${esc(T('اكتب اسم اللعبة بالأزرار', 'Spell a game name with the keys'))}</span>`}</div>` : '';
      const kbd = k => `<kbd>${esc(k)}</kbd>`;
      el.innerHTML = `<div class="xb-bg" aria-hidden="true"><div class="xb-art"></div><div class="xb-wave-host"></div></div>
        <div class="xb-drag" aria-hidden="true"></div>
        <div class="xb-win" role="group" aria-label="${esc(T('النافذة', 'Window'))}">
          <button type="button" data-win="min" title="${esc(T('تصغير', 'Minimize'))}" aria-label="${esc(T('تصغير', 'Minimize'))}"><i class="w-min"></i></button>
          <button type="button" data-win="max" title="${esc(T('تكبير / استعادة', 'Maximize / restore'))}" aria-label="${esc(T('تكبير', 'Maximize'))}"><i class="w-max"></i></button>
          <button type="button" data-win="close" class="w-x" title="${esc(T('إغلاق', 'Close'))}" aria-label="${esc(T('إغلاق', 'Close'))}">${ic('x')}</button>
        </div>
        <header class="xb-top"><div class="xb-clock" aria-label="${esc(T('الساعة', 'Clock'))}"><b dir="ltr">${esc(ct)}</b><span>${esc(cd)}</span></div></header>
        <div class="xb-search" role="search" aria-label="${esc(T('البحث في ألعابك', 'Search your games'))}">
          <div class="rf-dock" data-rfs-dock></div>${qv}
          <div class="xb-osk" aria-hidden="true">${keys}</div>
          <div class="xb-hint"><span>${kbd('↓')}${esc(T('النتائج', 'Results'))}</span><span>${kbd('Enter')}${esc(T('فتح أول لعبة', 'Open the first'))}</span><span>${kbd('Esc')}${esc(T('مسح', 'Clear'))}</span></div>
        </div>
        <nav class="xb-cats" aria-label="${esc(T('الفئات', 'Categories'))}"><div class="xb-row">${cats}</div></nav>
        <div class="xb-list" role="listbox" aria-label="${esc(T('الألعاب', 'Games'))}"></div>
        ${iw ? '<aside class="xb-info" aria-live="polite"></aside>' : ''}
        <div class="xb-om" role="dialog" hidden></div>`;

      this.el = el;
      this.list = $('.xb-list', el);
      this.row = $('.xb-row', el);
      this.info = $('.xb-info', el);
      this.art = $('.xb-art', el);
      this.clock = $('.xb-clock', el);
      // keep the backdrop art across re-renders (no flash while typing a search)
      if (this.artUrl) { this.art.style.backgroundImage = cssUrl(this.artUrl); this.art.classList.toggle('on', true); }

      // restore the place in this category
      this.sel = this.indexOf(this.cat, this.selBy[this.cat]);
      el.classList.toggle('searching', this.cat === 'search');
      el.classList.toggle('in-sub', this.cat === 'store' && !!this.sub);
      this.paintCats(false);
      this.place();
      this.focusChanged(false);

      el.addEventListener('click', e => this.onClick(e));
      el.addEventListener('wheel', e => this.onWheel(e), { passive: false });
      // the real search box lives in the field: focusing it (Ctrl+K, Tab, a click) is choosing Search
      el.addEventListener('focusin', e => { if (e.target.matches && e.target.matches('.tb-q') && this.cat !== 'search') this.setCat('search'); });
      // the on-screen keys must not take the focus away from the field
      el.addEventListener('mousedown', e => { if (e.target.closest('.xb-k, .xb-omi')) e.preventDefault(); });

      api.stage.replaceChildren(el);
      Wave.attach(waveHost($('.xb-wave-host', el)));
      Chrome.init(); Chrome.sync();
      // the Downloads entry follows the core's live download button (an event, no polling)
      if (this.dlObs) this.dlObs.disconnect();
      const dl = document.getElementById('rfs-dl');
      if (dl) { this.dlObs = new MutationObserver(() => this.refreshActs()); this.dlObs.observe(dl, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] }); }
      if (!clockTimer) clockTimer = setInterval(paintClock, 15000);
      // the strip writes its labels right after this render: the Options rows read them then
      if (this.cat === 'options') Promise.resolve().then(() => this.refreshOpts());
      this.watchFriends();
    },

    /* ---------- the store shelves and the friends column ---------- */
    /** Store: the shelves + page links — or, inside a shelf, a way back and its games */
    storeList() {
      const acts = (this.acts && this.acts.store) || [], sub = this.sub;
      if (!sub) return [...SHOP.map(sec => ({ sec })), ...acts.map(a => ({ act: a }))];
      const rows = [{ up: sub.sec }];
      if (sub.err) rows.push({ note: 'err' });
      else if (!sub.items) rows.push({ note: 'load' });
      else if (!sub.items.length) rows.push({ note: 'empty' });
      else for (const it of sub.items) rows.push({ s: it });
      return rows;
    },
    /** Friends: "Friends & chat", then every friend, then the other Steam items */
    friendList() {
      const acts = (this.acts && this.acts.friends) || [];
      return [...acts.filter(a => a && a.id === 'chat').map(a => ({ act: a })), ...friendRows().map(f => ({ f })), ...acts.filter(a => a && a.id !== 'chat').map(a => ({ act: a }))];
    },
    /** a category's rows changed (a shelf opened or its games arrived, a friend came online): rebuild its column */
    reList(cat, sel, anim) {
      if (cat === 'store') this.lists.store = this.storeList();
      if (cat === 'friends') this.lists.friends = this.friendList();
      this.paintCatSub(cat);
      if (this.cat !== cat || !this.el || !this.el.isConnected) return;
      const L = this.cur();
      this.sel = Math.max(0, Math.min(L.length - 1, sel == null ? this.indexOf(cat, this.selBy[cat]) : sel));
      this.selBy[cat] = this.keyOf(L[this.sel]);
      this.el.classList.toggle('in-sub', cat === 'store' && !!this.sub);
      this.list.replaceChildren(); this.pool = new Map();
      this.place();
      if (anim && !reduced()) this.list.animate([{ opacity: 0, transform: `translateX(${(LTR ? 1 : -1) * (anim < 0 ? -22 : 22)}px)` }, { opacity: 1, transform: 'none' }], { duration: 240, easing: EASE });
      this.focusChanged(true);
    },
    enterSub(sec) {
      this.sub = { sec, items: null, err: false };
      sfx('confirm');
      this.reList('store', 1, 1);
      this.loadSub();
    },
    loadSub() {
      const sub = this.sub;
      if (!sub) return;
      const again = sub.err;
      sub.err = false; sub.items = null;
      if (again) this.reList('store', 1, 0);
      Shop.load(sub.sec).then(
        items => { if (this.sub === sub) { sub.items = items; this.reList('store', 1, 0); } },
        () => { if (this.sub === sub) { sub.err = true; this.reList('store', 1, 0); } });
    },
    leaveSub() {
      const sub = this.sub;
      if (!sub) return;
      this.sub = null;
      sfx('close');
      this.reList('store', Math.max(0, SHOP.indexOf(sub.sec)), -1);
    },
    /** while Friends is the open category: look again every 15 s, rebuild only when someone's state changed */
    watchFriends() {
      clearInterval(this.frT); this.frT = 0;
      if (this.cat !== 'friends') return;
      const sig = L => L.map(r => (r.f ? [r.f.id, r.f.rank, r.f.appid, r.f.name, r.f.state].join(':') : '')).join('|');
      this.frT = setInterval(() => {
        if (!this.el || !this.el.isConnected || this.cat !== 'friends') { clearInterval(this.frT); this.frT = 0; return; }
        if (document.hidden || this.om || api.openId != null) return;
        if (sig(this.friendList()) !== sig(this.lists.friends || [])) this.reList('friends', null, 0);
      }, 15000);
    },
    friendMenu(f) {
      const items = [{ v: 'msg', label: T('أرسل رسالة', 'Send a message') }, { v: 'profile', label: T('الملف الشخصي', 'View profile') }];
      if (f.appid) items.push({ v: 'game', label: T('اللعبة اللي يلعبها', 'The game they are playing') });
      this.showMenu({ id: 'friend', icon: 'users', name: f.name }, items, c => {
        sfx('confirm');
        if (c.v === 'msg') url('steam://friends/message/' + f.sid);
        else if (c.v === 'profile') url('steam://url/SteamIDPage/' + f.sid);
        else { const g = api.byId(f.appid); if (g && api.openHub) api.openHub(g); else api.openStore(f.appid); }
      });
    },

    /* ---------- state helpers ---------- */
    cur() { return this.lists[this.cat] || []; },
    keyOf(x) { return x ? (x.g ? String(x.g.appid) : x.opt ? 'o:' + x.opt.id : x.act ? 'a:' + x.act.id : x.s ? 's:' + x.s.appid : x.f ? 'u:' + x.f.id : x.sec ? 'f:' + x.sec.id : x.up ? 'up' : x.note ? 'note' : 'g:' + x.genre) : null; },
    /** the small line under a category's label */
    catSub(id, n, q, me) {
      if (id === 'options') return isBpm() ? '' : 'F2';
      if (id === 'genres') return NUM.format(n);
      if (id === 'search') return q ? countGames(n) : isBpm() ? '' : 'Ctrl K';
      if (id === 'profile') return me && me.name ? T('الملف الشخصي', 'Profile') : '';
      if (id === 'downloads') { const d = dlInfo(); return d.busy ? d.pct : d.pct ? T(`${d.pct} بالطابور`, `${d.pct} queued`) : ''; }
      if (id === 'store') return this.sub ? this.sub.sec.name : '';
      if (id === 'friends') { const k = (this.lists.friends || []).filter(x => x.f && x.f.rank < 3).length; return k ? T(`${NUM.format(k)} متصل`, `${NUM.format(k)} online`) : ''; }
      if (ACTS[id]) return '';
      return countGames(n);
    },
    paintCatSub(id) {
      const b = this.row && this.row.querySelector(`.xb-cat[data-c="${id}"] small`);
      if (b) { const t = this.catSub(id, 0, '', null); if (b.textContent !== t) b.textContent = t; }
    },
    /** live values of the Steam items (download %, the exit confirmation) */
    refreshActs() {
      if (!this.el || !this.el.isConnected) return;
      const b = this.row && this.row.querySelector('.xb-cat[data-c="downloads"] small');
      if (b) { const t = this.catSub('downloads'); if (b.textContent !== t) b.textContent = t; }
      if (!ACTS[this.cat]) return;
      for (const r of this.pool.values()) {
        const a = r.dataset.act && ACTS[this.cat].find(x => x.id === r.dataset.act), h = a && r.querySelector('.h');
        if (h) { const t = a.sub(); if (h.textContent !== t) h.textContent = t; }
      }
      this.paintInfo(this.cur()[this.sel]);
    },
    indexOf(cat, key) {
      const L = this.lists[cat] || [];
      if (key == null) return 0;
      const i = L.findIndex(x => this.keyOf(x) === key);
      return i < 0 ? 0 : i;
    },
    input() { const b = bar(); return b ? b.querySelector('.tb-q') : null; },
    setQuery(v) {
      const i = this.input();
      if (!i) return;
      i.value = v;
      i.dispatchEvent(new Event('input', { bubbles: true }));
    },
    focusSearch() {
      const i = this.input();
      if (!i) return;
      i.focus({ preventScroll: true });
      try { const n = i.value.length; i.setSelectionRange(n, n); } catch (e) { /* fine */ }
    },

    /* ---------- the category row ---------- */
    paintCats(anim) {
      const k = CATS.findIndex(c => c.id === this.cat);
      const dx = (LTR ? -1 : 1) * k * this.G.pitch;
      if (!anim) { this.row.style.transition = 'none'; this.row.style.transform = `translateX(${dx}px)`; void this.row.offsetWidth; this.row.style.transition = ''; }
      else this.row.style.transform = `translateX(${dx}px)`;
      for (const b of this.row.children) { const on = b.dataset.c === this.cat; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'true' : 'false'); }
    },
    setCat(id) {
      if (id === this.cat || !this.lists[id]) return;
      this.closeMenu();
      this.selBy[this.cat] = this.keyOf(this.cur()[this.sel]);
      // leaving Search leaves its text behind (the other categories show the whole library again)
      if (this.cat === 'search') { const i = this.input(); if (i && i.value) { this.setQuery(''); if (document.activeElement === i) i.blur(); } }
      this.cat = id;
      this.sel = this.indexOf(id, this.selBy[id]);
      sfx('cat');
      this.el.classList.toggle('searching', id === 'search');
      this.el.classList.toggle('in-sub', id === 'store' && !!this.sub);
      if (id === 'friends') { this.lists.friends = this.friendList(); this.sel = this.indexOf(id, this.selBy[id]); this.paintCatSub(id); }
      this.watchFriends();
      this.paintCats(true);
      // the column is rebuilt for the new category and drops in softly
      this.list.replaceChildren(); this.pool = new Map();
      this.place();
      if (!reduced()) this.list.animate([{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASE });
      this.focusChanged(true);
      if (id === 'options') this.refreshOpts();
    },
    stepCat(d) { const i = CATS.findIndex(c => c.id === this.cat) + d; if (CATS[i]) this.setCat(CATS[i].id); },

    /* ---------- the column: only a window of rows around the focus exists ---------- */
    yOf(i) {
      const G = this.G, s = this.sel;
      if (i === s) return G.focusY;
      if (i > s) return G.focusY + G.selH + G.gap + (i - s - 1) * G.rowH;
      return G.above - (s - i) * G.rowH;
    },
    makeRow(i, x) {
      const r = document.createElement('div');
      r.className = 'xb-it' + (x.g || x.s || x.f ? '' : ' gen') + (x.opt ? ' opt' : '') + (x.g && api.running().has(x.g.appid) ? ' running' : '') + (x.g && !x.g.installed ? ' ni' : '');
      r.dataset.i = i;
      r.setAttribute('role', 'option');
      if (x.g) {
        const g = x.g;
        r.dataset.appid = g.appid;
        const ach = api.achHTML ? api.achHTML(g, 'mini') : '';
        r.innerHTML = `<div class="art"></div><div class="tx"><b class="t" dir="auto" title="${esc(g.name)}">${esc(g.name)}</b><span class="h">${esc(subLine(g, api.running().has(g.appid)))}${ach}</span></div>`;
        const art = r.firstElementChild;
        lazy(r, gg => { const u = cssUrl(first(gg.images.header) || first(gg.images.capsule)); if (art._u !== u) { art._u = u; art.style.setProperty('--img', u); } });
      } else if (x.s) {
        const it = x.s, own = !!api.byId(it.appid);
        r.dataset.shop = it.appid;
        r.classList.add('shop');
        r.innerHTML = `<div class="art"></div><div class="tx"><b class="t" dir="auto" title="${esc(it.name)}">${esc(it.name)}</b><span class="h">${priceHTML(it)}${own ? `<i class="own">${esc(T('عندك بالمكتبة', 'In your library'))}</i>` : ''}</span></div>`;
        if (it.img) r.firstElementChild.style.setProperty('--img', cssUrl(it.img));
      } else if (x.f) {
        const f = x.f;
        r.dataset.friend = f.id;
        r.classList.add('fr', 'r' + f.rank);
        r.innerHTML = `<div class="art"></div><div class="tx"><b class="t" dir="auto">${esc(f.name)}</b><span class="h" dir="auto">${esc(friendLine(f))}</span></div>`;
        if (f.avatar) r.firstElementChild.style.setProperty('--img', cssUrl(f.avatar));
      } else if (x.sec) {
        r.dataset.sec = x.sec.id;
        r.classList.add('opt', 'dir');
        r.innerHTML = `<div class="art">${ic(x.sec.icon)}</div><div class="tx"><b class="t">${esc(x.sec.name)}</b><span class="h" dir="auto">${esc(x.sec.sub)}</span></div>`;
      } else if (x.up) {
        r.classList.add('opt', 'upr');
        r.innerHTML = `<div class="art">${ic(LTR ? 'chevL' : 'chevR')}</div><div class="tx"><b class="t">${esc(T('رجوع للمتجر', 'Back to Store'))}</b><span class="h" dir="auto">${esc(x.up.name)}</span></div>`;
      } else if (x.note) {
        r.classList.add('opt', 'note');
        const t = x.note === 'load' ? [T('جاري التحميل…', 'Loading…'), T('أجيب القائمة من متجر ستيم', 'Getting the list from the Steam store')]
          : x.note === 'err' ? [T('ما قدرت أوصل للمتجر', 'Couldn\'t reach the store'), T('اضغط Enter للمحاولة مرة ثانية', 'Press Enter to try again')]
            : [T('ما في شي هنا الحين', 'Nothing here right now'), ''];
        r.innerHTML = `<div class="art">${ic(x.note === 'err' ? 'refresh' : x.note === 'load' ? 'hourglass' : 'info')}</div><div class="tx"><b class="t">${esc(t[0])}</b><span class="h" dir="auto">${esc(t[1])}</span></div>`;
      } else if (x.act) {
        r.dataset.act = x.act.id;
        r.classList.add('opt');
        r.innerHTML = `<div class="art">${ic(x.act.icon)}</div><div class="tx"><b class="t">${esc(x.act.name)}</b><span class="h" dir="auto">${esc(x.act.sub())}</span></div>`;
      } else if (x.opt) {
        r.dataset.opt = x.opt.id;
        r.innerHTML = `<div class="art">${ic(x.opt.icon)}</div><div class="tx"><b class="t">${esc(x.opt.name)}</b><span class="h" dir="auto">${esc(optValue(x.opt.id))}</span></div>`;
      } else {
        const on = !x.clear && api.state.genre === x.genre;
        r.classList.toggle('on', on);
        r.innerHTML = `<div class="art">${ic(x.clear ? 'layers' : 'tag')}</div><div class="tx"><b class="t" dir="auto">${esc(x.clear ? T('كل الأنواع', 'All genres') : x.genre)}</b><span class="h">${esc(x.clear ? T('شيل فلتر النوع', 'Clear the genre filter') : countGames(x.n))}</span></div>`;
      }
      return r;
    },
    refreshOpts() {
      if (this.cat !== 'options' || !this.el || !this.el.isConnected) return;
      for (const r of this.pool.values()) { const h = r.dataset.opt && r.querySelector('.h'); if (h) h.textContent = optValue(r.dataset.opt); }
      this.paintInfo(this.cur()[this.sel]);
    },
    place() {
      const L = this.cur(), n = L.length, s = this.sel, G = this.G;
      if (!n) {
        const q = api.state.query || api.state.genre;
        this.list.innerHTML = `<div class="xb-empty" style="transform:translateY(${G.focusY}px)"><b>${esc(q ? T('ما في نتائج', 'No matches') : T('ما في ألعاب هنا', 'Nothing here yet'))}</b><span>${esc(q ? T('جرّب كلمة ثانية أو شيل الفلتر', 'Try a different search or clear the filter') : T('هذي الفئة فاضية', 'This category is empty'))}</span></div>`;
        return;
      }
      const empty = this.list.querySelector('.xb-empty');
      if (empty) empty.remove();
      const from = Math.max(0, s - 3), to = Math.min(n - 1, s + G.below);
      for (const [i, r] of this.pool) if (i < from || i > to) { r.remove(); this.pool.delete(i); }
      for (let i = from; i <= to; i++) {
        let r = this.pool.get(i);
        const y = `translateY(${this.yOf(i)}px)`;
        if (!r) {
          r = this.makeRow(i, L[i]);
          r.style.transform = y;
          this.list.appendChild(r);
          this.pool.set(i, r);
        } else if (r.style.transform !== y) r.style.transform = y;
        r.classList.toggle('sel', i === s);
        r.classList.toggle('up', i < s);
        r.setAttribute('aria-selected', i === s ? 'true' : 'false');
      }
    },
    go(i, sound = true) {
      const n = this.cur().length;
      if (!n) return;
      i = Math.max(0, Math.min(n - 1, i));
      if (i === this.sel) { if (sound) sfx('edge'); return; }
      this.sel = i;
      this.selBy[this.cat] = this.keyOf(this.cur()[i]);
      if (sound) sfx('tick');
      this.place();
      this.focusChanged(true);
    },

    /* ---------- the focused game: info at the end side, its art faded behind the waves ---------- */
    focusChanged(soon) {
      const x = this.cur()[this.sel];
      this.paintInfo(x);
      clearTimeout(this.settle);
      if (x && (x.s || x.f)) {
        const art = x.s ? x.s.hero : x.f.appid ? `${ASSET}steam/apps/${x.f.appid}/library_hero.jpg` : '';
        this.settle = setTimeout(() => { if (this.cur()[this.sel] === x) this.setArt(art); }, soon ? 140 : 0);
        return;
      }
      if (!x || !x.g) { if (!x || !(x.opt || x.act || x.sec || x.up || x.note)) this.setArt(''); return; }
      const g = x.g;
      // the big art + details only once the focus rests (holding ↓ must not load a hero image per row)
      this.settle = setTimeout(() => {
        if (this.cur()[this.sel] !== x) return;
        const pick = gg => first(gg.images.hero) || first(gg.images.header) || '';
        this.setArt(pick(g));
        if (!g.detailed && api.Data && api.Data.ensureDetails) api.Data.ensureDetails(g).then(() => {
          if (this.cur()[this.sel] !== x || !this.el || !this.el.isConnected) return;
          this.setArt(pick(g));
          this.paintInfo(x);
          const r = this.pool.get(this.sel), h = r && r.querySelector('.h');
          if (h && !h.querySelector('.rf-ach')) { const a = api.achHTML(g, 'mini'); if (a) h.insertAdjacentHTML('beforeend', a); }
        });
      }, soon ? 140 : 0);
    },
    setArt(url) {
      const art = this.art;
      if (!art || url === this.artUrl) return;
      this.artUrl = url;
      const tok = ++this.artTok;
      if (!url) { art.classList.toggle('on', false); return; }
      const im = new Image();
      im.onload = () => {
        if (tok !== this.artTok || !art.isConnected) return;
        const show = () => { art.style.backgroundImage = cssUrl(url); art.classList.toggle('on', true); };
        if (!art.classList.contains('on') || reduced()) { show(); return; }
        // cross-fade on the one element: out, swap, in
        const a = art.animate([{ opacity: getComputedStyle(art).opacity }, { opacity: 0 }], { duration: 160, easing: 'ease-in' });
        a.onfinish = () => {
          if (tok !== this.artTok || !art.isConnected) return;
          show();
          art.animate([{ opacity: 0 }, { opacity: getComputedStyle(art).opacity }], { duration: 520, easing: 'ease-out' });
        };
      };
      im.src = url;
    },
    paintInfo(x) {
      const box = this.info;
      if (!box) return;
      const L = this.cur(), inSub = this.cat === 'store' && this.sub;
      const catName = (CATS.find(c => c.id === this.cat) || CATS[0]).name + (inSub ? ' · ' + this.sub.sec.name : '');
      const games = inSub ? L.filter(r => r.s).length : L.length, at = inSub ? this.sel : this.sel + 1;
      const pos = games && at > 0 && (!inSub || (x && x.s)) ? `${NUM.format(at)} / ${NUM.format(games)}` : '';
      const kick = `<span class="xb-kick">${esc(catName)}${pos ? `<i dir="ltr">${esc(pos)}</i>` : ''}</span>`;
      const kbd = k => `<kbd>${esc(k)}</kbd>`;
      if (!x) { box.innerHTML = kick; return; }
      if (x.act) {
        const a = x.act;
        box.innerHTML = `${kick}<h2>${esc(a.name)}</h2>
          <p class="xb-sub" dir="auto">${esc(a.sub())}</p>
          <div class="xb-hint"><span>${kbd('Enter')}${esc(T('فتح', 'Open'))}</span></div>`;
        return;
      }
      if (x.sec || x.up || x.note) {
        const name = x.sec ? x.sec.name : x.up ? T('رجوع للمتجر', 'Back to Store') : x.note === 'load' ? T('جاري التحميل…', 'Loading…') : x.note === 'err' ? T('ما قدرت أوصل للمتجر', 'Couldn\'t reach the store') : T('ما في شي هنا الحين', 'Nothing here right now');
        const sub = x.sec ? x.sec.sub : x.up ? x.up.name : x.note === 'err' ? T('تأكد من الاتصال وجرّب مرة ثانية', 'Check the connection and try again') : '';
        const hint = x.note && x.note !== 'err' ? '' : `<div class="xb-hint"><span>${kbd('Enter')}${esc(x.sec ? T('فتح الرف', 'Open the shelf') : x.up ? T('رجوع', 'Back') : T('إعادة المحاولة', 'Try again'))}</span></div>`;
        box.innerHTML = `${kick}<h2>${esc(name)}</h2>${sub ? `<p class="xb-sub" dir="auto">${esc(sub)}</p>` : ''}${hint}`;
        return;
      }
      if (x.s) {
        const it = x.s, own = !!api.byId(it.appid);
        const facts = [];
        if (it.rev) facts.push(['star', T('التقييم', 'Reviews'), it.rev]);
        if (it.date && !it.soon) facts.push(['calendar', T('الإصدار', 'Released'), fmtDay(it.date)]);
        if (it.dev) facts.push(['users', T('المطوّر', 'Developer'), it.dev]);
        box.innerHTML = `${kick}<h2 dir="auto" title="${esc(it.name)}">${esc(it.name)}</h2>
          <div class="xb-price">${priceHTML(it) || `<span class="pr soon">${esc(T('السعر بصفحة المتجر', 'See the store page for the price'))}</span>`}</div>
          ${own ? `<span class="xb-run">${ic('owned')}${esc(T('عندك بالمكتبة', 'In your library'))}</span>` : ''}
          ${facts.length ? `<dl class="xb-facts">${facts.map(([i, k, v]) => `<div><dt>${ic(i)}${esc(k)}</dt><dd dir="auto" title="${esc(v)}">${esc(v)}</dd></div>`).join('')}</dl>` : ''}
          ${it.desc ? `<p class="xb-sub xb-clamp" dir="auto">${esc(it.desc)}</p>` : ''}
          <div class="xb-hint"><span>${kbd('Enter')}${esc(T('صفحة المتجر', 'Store page'))}</span><span>${kbd('Esc')}${esc(T('رجوع', 'Back'))}</span></div>`;
        return;
      }
      if (x.f) {
        const f = x.f;
        const facts = [];
        if (f.game) facts.push(['gamepad', T('يلعب', 'Playing'), f.game]);
        if (f.rp) facts.push(['info', T('الحالة باللعبة', 'In-game status'), f.rp]);
        if (f.rank === 3 && f.last) facts.push(['clock', T('آخر ظهور', 'Last online'), fmtAgo(f.last)]);
        box.innerHTML = `${kick}<div class="xb-fr"><i class="av"${f.avatar ? ` style="background-image:${esc(cssUrl(f.avatar))}"` : ''}></i><h2 dir="auto" title="${esc(f.name)}">${esc(f.name)}</h2></div>
          <span class="xb-run st r${f.rank}"><i class="dot"></i>${esc(f.rank === 0 ? T('داخل لعبة', 'In a game') : f.rank === 3 ? PSTATE[0] : PSTATE[f.state] || PSTATE[1])}</span>
          ${facts.length ? `<dl class="xb-facts">${facts.map(([i, k, v]) => `<div><dt>${ic(i)}${esc(k)}</dt><dd dir="auto" title="${esc(v)}">${esc(v)}</dd></div>`).join('')}</dl>` : ''}
          <div class="xb-hint"><span>${kbd('Enter')}${esc(T('رسالة · الملف الشخصي', 'Message · profile'))}</span></div>`;
        return;
      }
      if (x.opt) {
        const o = x.opt;
        box.innerHTML = `${kick}<h2>${esc(o.name)}</h2>
          <dl class="xb-facts"><div><dt>${ic(o.icon)}${esc(T('الحالي', 'Current'))}</dt><dd dir="auto">${esc(optValue(o.id))}</dd></div></dl>
          <div class="xb-hint"><span>${kbd('Enter')}${esc(o.menu ? T('اختيار', 'Choose') : o.id === 'themes' ? T('فتح', 'Open') : T('تبديل', 'Toggle'))}</span><span>${kbd('F2')}${esc(T('الخيارات', 'Options'))}</span></div>`;
        return;
      }
      if (!x.g) {
        const sum = (api.state.games || []).filter(g => x.clear || (g.genres || []).includes(x.genre)).reduce((m, g) => m + (g.playtimeMin || 0), 0);
        box.innerHTML = `${kick}<h2 dir="auto">${esc(x.clear ? T('كل الأنواع', 'All genres') : x.genre)}</h2>
          <dl class="xb-facts"><div><dt>${ic('layers')}${esc(T('الألعاب', 'Games'))}</dt><dd>${esc(countGames(x.n))}</dd></div>
          <div><dt>${ic('hourglass')}${esc(T('وقت اللعب', 'Play time'))}</dt><dd>${esc(sum ? fmtPlaytime(sum) : '—')}</dd></div></dl>
          <div class="xb-hint"><span>${kbd('Enter')}${esc(x.clear ? T('شيل الفلتر', 'Clear filter') : T('اعرض ألعاب النوع', 'Show these games'))}</span></div>`;
        return;
      }
      const g = x.g, run = api.running().has(g.appid);
      const facts = [
        ['hourglass', T('وقت اللعب', 'Play time'), g.playtimeMin ? fmtPlaytime(g.playtimeMin) : T('ما انلعبت', 'Never played')],
        ['clock', T('آخر مرة لعبت', 'Last played'), g.lastPlayed ? fmtAgo(g.lastPlayed) : '—'],
        ['drive', T('الحجم', 'Size'), g.installed ? (g.sizeOnDisk ? fmtSize(g.sizeOnDisk) : '—') : T('غير مثبتة', 'Not installed')],
      ];
      const tags = (g.genres || []).slice(0, 3);
      const ach = api.achHTML ? api.achHTML(g) : '';
      box.innerHTML = `${kick}<h2 dir="auto" title="${esc(g.name)}">${esc(g.name)}</h2>
        ${run ? `<span class="xb-run">${ic('pulse')}${esc(T('شغّالة الحين', 'Running now'))}</span>` : ''}
        <dl class="xb-facts">${facts.map(([i, k, v]) => `<div><dt>${ic(i)}${esc(k)}</dt><dd dir="auto">${esc(v)}</dd></div>`).join('')}</dl>
        ${ach ? `<div class="xb-ach">${ach}</div>` : ''}
        ${tags.length ? `<div class="xb-tags">${tags.map(t => `<span dir="auto">${esc(t)}</span>`).join('')}</div>` : ''}
        <div class="xb-hint"><span>${kbd('Enter')}${esc(T('فتح', 'Open'))}</span><span>${kbd('Ctrl')}<em>+</em>${kbd('Enter')}${esc(g.installed ? T('تشغيل', 'Play') : T('تثبيت', 'Install'))}</span></div>`;
    },

    /* ---------- the console option menu (from the end edge): ↑ / ↓, Enter, Esc ---------- */
    openMenu(id) {
      const o = OPTS.find(x => x.id === id);
      let items = [];
      if (id === 'sort') items = ddChoices('tb-sort', 'data-v').map(c => ({ ...c, on: c.v === api.state.sort, n: '' }));
      else if (id === 'source') items = ddChoices('tb-src', 'data-id');
      else if (id === 'genre') items = ddChoices('tb-genre', 'data-g');
      else if (id === 'tint') { const cur = tintId(); items = ['month', ...Object.keys(TINTS)].map(k => ({ v: k, label: TINT_NAMES[k], on: k === cur, c: tintOf(k)[0] })); }
      if (!o || !items.length) return;
      this.showMenu(o, items, null);
    },
    /** the end-edge menu itself: o = { id, icon, name }, items = [{ v, label, n?, on?, c? }], pick(item) for anything that is not an Option */
    showMenu(o, items, pick) {
      const id = o.id, box = $('.xb-om', this.el);
      const i0 = Math.max(0, items.findIndex(c => c.on));
      box.innerHTML = `<div class="xb-om-h">${ic(o.icon)}<b>${esc(o.name)}</b></div>
        <div class="xb-om-list">${items.map((c, i) => `<button type="button" class="xb-omi${c.on ? ' on' : ''}${i === i0 ? ' sel' : ''}" data-i="${i}" tabindex="-1">${c.c ? `<i class="sw" style="--c:${c.c}"></i>` : pick ? '' : '<i class="dot"></i>'}<span dir="auto">${esc(c.label)}</span>${c.n ? `<b>${esc(c.n)}</b>` : ''}</button>`).join('')}</div>
        <div class="xb-hint"><span><kbd>Enter</kbd>${esc(T('اختيار', 'Choose'))}</span><span><kbd>Esc</kbd>${esc(T('رجوع', 'Back'))}</span></div>`;
      box.hidden = false;
      this.om = { id, items, i: i0, box, pick };
      this.el.classList.toggle('om-on', true);
      sfx('slide');
      const sel = box.querySelector('.xb-omi.sel'); if (sel) sel.scrollIntoView({ block: 'nearest' });
      if (!reduced()) box.animate([{ transform: `translateX(${LTR ? 40 : -40}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: EASE });
    },
    closeMenu() {
      if (!this.om) return;
      const box = this.om.box;
      this.om = null;
      box.hidden = true; box.replaceChildren();
      this.el.classList.toggle('om-on', false);
    },
    menuGo(i) {
      const m = this.om;
      if (!m) return;
      i = Math.max(0, Math.min(m.items.length - 1, i));
      if (i === m.i) return;
      const bs = m.box.querySelectorAll('.xb-omi');
      bs[m.i].classList.toggle('sel', false); bs[i].classList.toggle('sel', true);
      m.i = i; bs[i].scrollIntoView({ block: 'nearest' });
      sfx('tick');
    },
    menuPick(i) {
      const m = this.om;
      if (!m) return;
      const c = m.items[i];
      this.closeMenu();
      if (!c) return;
      if (m.pick) { m.pick(c); return; }
      if (m.id === 'tint') {
        try { localStorage.setItem(TINT_KEY, c.v); } catch (e) { /* private */ }
        applyTint(this.el, c.v); sfx('confirm'); this.refreshOpts();
      } else if (m.id === 'sort') { sfx('confirm'); ddPick('tb-sort', 'data-v', c.v); }
      else if (m.id === 'source') { sfx('confirm'); ddPick('tb-src', 'data-id', c.v); }
      else if (m.id === 'genre') { sfx('confirm'); ddPick('tb-genre', 'data-g', c.v); }
    },
    menuKey(e) {
      const k = e.key, m = this.om;
      const back = LTR ? 'ArrowLeft' : 'ArrowRight';
      if (k === 'ArrowDown') this.menuGo(m.i + 1);
      else if (k === 'ArrowUp') this.menuGo(m.i - 1);
      else if (k === 'PageDown') this.menuGo(m.i + 8);
      else if (k === 'PageUp') this.menuGo(m.i - 8);
      else if (k === 'Home') this.menuGo(0);
      else if (k === 'End') this.menuGo(m.items.length - 1);
      else if (k === 'Enter' || k === ' ' || k === 'Spacebar') this.menuPick(m.i);
      else if (k === 'Escape' || k === 'Backspace' || k === back) { this.closeMenu(); sfx('close'); }
      else if (e.ctrlKey || e.altKey || e.metaKey) return false;
      return true;
    },
    optAct(id) {
      const o = OPTS.find(x => x.id === id);
      if (!o) return;
      if (o.menu) { this.openMenu(id); return; }
      if (id === 'family') { const f = document.getElementById('rfs-family'); if (f) f.click(); Promise.resolve().then(() => this.refreshOpts()); return; }
      if (id === 'settings') { url('steam://open/settings'); return; }
      if (id === 'bar') { try { localStorage.setItem(BAR_KEY, barOn() ? '0' : '1'); } catch (e) { /* private */ } sfx('confirm'); Chrome.sync(); this.refreshOpts(); return; }
      if (id === 'themes' && isBpm() && window.__rfsBpm && window.__rfsBpm.open) { window.__rfsBpm.open(); return; } // Big Picture's own picker
      if (id === 'amb' || id === 'msfx') { const a = XA(); if (a) { if (id === 'amb') a.setAmb(!a.amb); else a.setSfx(!a.sfx); } this.refreshOpts(); return; }
      const b = bar(), btn = b && b.querySelector(id === 'news' ? '.tb-news' : id === 'sound' ? '.tb-snd' : '.tb-theme');
      if (btn) btn.click();
      if (id !== 'themes') Promise.resolve().then(() => this.refreshOpts());
    },

    /* ---------- input ---------- */
    activate(x, play) {
      if (!x) return;
      if (x.opt) { this.optAct(x.opt.id); return; }
      if (x.act) { sfx('confirm'); x.act.run(); return; }
      if (x.sec) { this.enterSub(x.sec); return; }
      if (x.up) { this.leaveSub(); return; }
      if (x.note) { if (x.note === 'err') this.loadSub(); return; }
      if (x.s) { sfx('confirm'); api.openStore(x.s.appid); return; }
      if (x.f) { this.friendMenu(x.f); return; }
      if (!x.g) {
        api.state.genre = x.clear ? '' : x.genre;
        if (!x.clear) { this.cat = 'all'; this.selBy.all = null; }
        sfx('tick');
        api.rerender();
        return;
      }
      if (play) { api.launch(x.g); return; }
      api.openGame(x.g, this.source(x.g.appid));
    },
    type(k) {
      const i = this.input();
      if (!i) return;
      const v = k === 'back' ? i.value.slice(0, -1) : i.value + k;
      this.focusSearch();
      this.setQuery(v);
      sfx('tick');
    },
    onClick(e) {
      if (e.target.closest('#rfs-bar')) return;
      Chrome.unpeek();
      const wb = e.target.closest('[data-win]');
      if (wb) { const w = win(); if (w) { if (wb.dataset.win === 'min') w.Minimize(); else if (wb.dataset.win === 'max') w.ToggleMaximize(); else w.Close(); } return; }
      if (this.om) {
        const it = e.target.closest('.xb-omi');
        if (it) this.menuPick(+it.dataset.i);
        else if (!e.target.closest('.xb-om')) this.closeMenu();
        return;
      }
      const k = e.target.closest('.xb-k');
      if (k) { this.type(k.dataset.k); return; }
      const c = e.target.closest('.xb-cat');
      if (c) { if (c.dataset.c === 'store' && this.cat === 'store' && this.sub) this.leaveSub(); else this.setCat(c.dataset.c); if (c.dataset.c === 'search') this.focusSearch(); return; }
      const r = e.target.closest('.xb-it');
      if (!r || e.detail > 1) return;
      const i = +r.dataset.i;
      if (i !== this.sel) this.go(i, false);
      this.activate(this.cur()[i], false);
    },
    onWheel(e) {
      if (e.target.closest('#rfs-bar, .xb-info, .rf-dd-menu, .xb-search')) return;
      e.preventDefault();
      const horiz = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const d = horiz ? (e.deltaX || e.deltaY) : e.deltaY;
      const now = performance.now();
      if (now - this.wheelT > 220) this.wheelAcc = 0;
      this.wheelT = now;
      this.wheelAcc += e.deltaMode === 1 ? d * 40 : d;
      if (Math.abs(this.wheelAcc) < 48) return;
      const dir = this.wheelAcc > 0 ? 1 : -1;
      this.wheelAcc = 0;
      if (this.om) this.menuGo(this.om.i + dir);
      else if (horiz) this.stepCat(dir);
      else this.go(this.sel + dir);
    },
    /** ← / → categories (visual direction: in Arabic the next one is on the left), ↑ / ↓ PgUp / PgDn Home / End the
        column, Enter opens / chooses, Ctrl+Enter / Space plays, F2 = Options, any letter = Search */
    key(e) {
      if (e.altKey || e.metaKey || !this.el || !this.el.isConnected) return false;
      if (this.om) return this.menuKey(e);
      Chrome.unpeek();
      const k = e.key, L = this.cur();
      if (k === 'F2') { this.setCat('options'); return true; }
      // typing a name anywhere on the home page: the field opens and takes the letter (not handled → it types)
      if (!e.ctrlKey && k.length === 1 && k !== ' ' && /[\p{L}\p{N}]/u.test(k)) {
        if (this.cat !== 'search') this.setCat('search');
        this.focusSearch();
        return false;
      }
      if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
        const x = L[this.sel];
        if (!x) { if (this.cat === 'search') { this.focusSearch(); return true; } return false; }
        this.activate(x, x.g && (k !== 'Enter' || e.ctrlKey));
        return true;
      }
      if (e.ctrlKey) return false;
      if (k === 'Escape' && this.cat === 'search' && api.state.query) { this.setQuery(''); return true; }
      const fwd = LTR ? 'ArrowRight' : 'ArrowLeft', back = LTR ? 'ArrowLeft' : 'ArrowRight';
      // inside a store shelf the cross works like a console folder: back / Esc / Backspace leave it
      if (this.cat === 'store' && this.sub) {
        if (k === back || k === 'Escape' || k === 'Backspace') { this.leaveSub(); return true; }
        if (k === fwd) { sfx('edge'); return true; }
      }
      if (k === fwd || k === back) { this.stepCat(k === fwd ? 1 : -1); return true; }
      // ↑ on the first result goes back up into the field
      if (k === 'ArrowUp' && this.cat === 'search' && this.sel === 0) { this.focusSearch(); return true; }
      const page = Math.max(3, this.G.below - 1);
      const to = { ArrowDown: this.sel + 1, ArrowUp: this.sel - 1, PageDown: this.sel + page, PageUp: this.sel - page, Home: 0, End: L.length - 1 }[k];
      if (to == null) return false;
      this.go(to);
      return true;
    },

    /** Big Picture host: the focused row (games, Steam items and options alike) and its game, if it is one */
    padEl() { return (this.el && this.el.isConnected && this.pool.get(this.sel)) || null; },
    padGame() { const x = this.cur()[this.sel]; return (x && x.g) || null; },
    /** the element the options panel's art comes from */
    source(appid) {
      const r = api.stage.querySelector(`.xb-it[data-appid="${appid}"] .art`);
      return r ? { el: r, slot: r.parentElement, isSpine: false } : null;
    },

    /* ---------- opening a game: the side "options" panel slides in from the end edge (≤ 350 ms) ---------- */
    async open(g, sheet) {
      const run = api.running().has(g.appid);
      const ACH = T('الإنجازات', 'Achievements');
      const facts = api.gameFacts(g).filter(([k]) => k !== ACH);
      const desc = api.gameDesc(g);
      const tid = tintId();
      sheet.innerHTML = `<div class="xo">
          <div class="xo-shade"></div>
          <aside class="xo-panel${run ? ' running' : ''}" tabindex="-1" role="dialog" aria-label="${esc(g.name)}">
            <div class="xo-art"></div>
            <div class="xo-body">
              <span class="xo-kick">${ic('sliders')}${esc(T('الخيارات', 'Options'))}</span>
              <h2 dir="auto">${esc(g.name)}</h2>
              <div class="xo-acts-slot"></div>
              <div class="xo-ach">${api.achHTML(g)}</div>
              <dl class="xo-facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd dir="auto" title="${esc(v)}">${esc(v)}</dd></div>`).join('')}</dl>
              ${desc ? `<p class="xo-desc" dir="auto">${esc(desc)}</p>` : ''}
            </div>
            <button class="xo-x" type="button" data-close title="${esc(T('إغلاق (Esc)', 'Close (Esc)'))}" aria-label="${esc(T('إغلاق', 'Close'))}">${ic('x')}</button>
          </aside>
        </div>`;
      const wrap = $('.xo', sheet), panel = $('.xo-panel', sheet), shade = $('.xo-shade', sheet);
      applyTint(wrap, tid);
      const acts = api.gameActions(g);
      $('.xo-acts-slot', panel).replaceWith(acts);
      // the buttons are a vertical menu: ↑ / ↓ move between them
      panel.addEventListener('keydown', e => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        const bs = [...panel.querySelectorAll('.rf-act, .xo-x')];
        const i = bs.indexOf(document.activeElement);
        const n = bs[(i < 0 ? 0 : i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length];
        if (n) { e.preventDefault(); e.stopPropagation(); n.focus(); sfx('tick'); }
      });
      const artEl = $('.xo-art', panel);
      const paintArt = () => { const u = first(g.images.hero) || first(g.images.header) || first(g.images.capsule); if (u && artEl._u !== u) { artEl._u = u; artEl.style.backgroundImage = cssUrl(u); } };
      paintArt();
      if (!g.detailed && api.Data && api.Data.ensureDetails) api.Data.ensureDetails(g).then(() => {
        if (!panel.isConnected) return;
        paintArt();
        const a = $('.xo-ach', panel); if (a) a.innerHTML = api.achHTML(g);
        if (!$('.xo-desc', panel)) { const d = api.gameDesc(g); if (d) panel.querySelector('.xo-body').insertAdjacentHTML('beforeend', `<p class="xo-desc" dir="auto">${esc(d)}</p>`); }
      });
      sfx('slide');
      const off = LTR ? '100%' : '-100%';
      if (!reduced()) {
        await Promise.all([
          shade.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' }),
          panel.animate([{ transform: `translateX(${off})`, opacity: .4 }, { transform: 'none', opacity: 1 }], { duration: 330, easing: EASE, fill: 'backwards' }),
          $('.xo-body', panel).animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: 90, easing: EASE, fill: 'backwards' }),
        ].map(a => a.finished.catch(() => null)));
      }
      if (panel.isConnected) {
        panel.classList.toggle('ready', true);
        const b = acts.querySelector('.rf-act');
        (b || panel).focus({ preventScroll: true });
      }
    },
    /** the panel slides back out (≤ 250 ms) */
    async close(sheet) {
      const panel = $('.xo-panel', sheet), shade = $('.xo-shade', sheet);
      if (!panel) return;
      panel.classList.toggle('ready', false);
      sfx('close');
      if (reduced()) return;
      const off = LTR ? '100%' : '-100%', f = { fill: 'forwards' };
      await Promise.all([
        panel.animate([{ transform: 'none', opacity: 1 }, { transform: `translateX(${off})`, opacity: .3 }], { duration: 220, easing: 'cubic-bezier(.5,0,.75,0)', ...f }),
        shade ? shade.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-in', ...f }) : null,
      ].filter(Boolean).map(a => a.finished.catch(() => null)));
    },
  };

  api.register('xmb', Layout);
})();
