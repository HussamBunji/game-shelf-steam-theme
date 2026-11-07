/* ═══ Crossbar (الكونسول) — library home design ═══
   A console cross-media bar. A row of CATEGORY icons across the upper third (Recent, Installed, All games, Most
   played, Genres); the chosen one sits in the focus column with its label, and ← / → slide the row (one transform).
   Under it, the cross: a vertical column of that category's games — the focused one large and glowing at a fixed
   focus position just under the icon, the ones before it fading upward above the row, the rest below. ↑ / ↓,
   PgUp / PgDn, Home / End, the mouse wheel and clicks move it; every game is reachable (All games = the whole
   filtered library, and the search fills it). Behind everything: a deep gradient (a preset or the month's colour,
   picked with the swatches in the header) and ONE slowly animated SVG of luminous ribbon waves; the focused game's
   art cross-fades faintly behind the waves. The end side shows the focused game's info and the key hints; the top
   end a clock with the date. Opening a game: an "options" panel slides in from the end edge.
   Rules followed (docs/THEME-KIT.md): only a window of ~20 rows exists in the DOM (4 elements each), images via
   api.lazy with the small header art, the hero image once (the faded backdrop), transforms only on those rows and the
   category row, the waves are the one large animation (paused while the window is hidden, off with reduced motion),
   DOM writes only in render() and on input (plus the clock's text once a minute). */
(function () {
  'use strict';
  const api = window.__rfsLayoutApi;
  if (!api) return;
  const { T, esc, div, $, ic, cssUrl, first, lazy, fmtPlaytime, fmtAgo, fmtSize, NUM } = api;
  const LTR = api.LTR;
  const EASE = 'cubic-bezier(.22,.7,.2,1)';
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

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

  /* ---- the ribbon waves: one SVG, three ribbons (a translucent band + a bright line + thin strands), each a seamless
     repeat that drifts sideways; the drift's phase follows the clock, so a re-render never makes the waves jump */
  const VW = 1440, VH = 900;
  function ribbon(P, base, a1, a2, p1, p2, th, t1, p3) {
    const k = 2 * Math.PI / P, W = VW * 2, step = 16, top = [], bot = [];
    for (let x = 0; x <= W; x += step) {
      const y = base + a1 * Math.sin(k * x + p1) + a2 * Math.sin(2 * k * x + p2);
      top.push([x, y]); bot.push([x, y + th + t1 * Math.sin(k * x + p3)]);
    }
    const line = (pts, dy = 0) => pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + (p[1] + dy).toFixed(1)).join('');
    const mid = top.map((p, i) => [p[0], (p[1] + bot[i][1]) / 2]);
    const band = line(top) + bot.slice().reverse().map(p => 'L' + p[0] + ' ' + p[1].toFixed(1)).join('') + 'Z';
    return { band, top: line(top), bot: line(bot), mid: line(mid) };
  }
  const RIBBONS = [
    { r: ribbon(1440, 520, 62, 18, 0.4, 1.3, 70, 34, 2.1), dur: 96, rev: false, bob: 17 },
    { r: ribbon(720, 590, 40, 12, 2.2, 0.2, 46, 22, 0.9), dur: 132, rev: true, bob: 23 },
    { r: ribbon(1440, 650, 48, 22, 4.1, 2.6, 30, 16, 1.7), dur: 168, rev: false, bob: 29 },
  ];
  function waveSVG() {
    const now = performance.now() / 1000;
    const g = RIBBONS.map((w, i) => `<g class="xb-wb" style="animation-duration:${w.bob}s;animation-delay:-${(now % (w.bob * 2)).toFixed(2)}s">`
      + `<g class="xb-wd${w.rev ? ' rev' : ''}" style="animation-duration:${w.dur}s;animation-delay:-${(now % w.dur).toFixed(2)}s">`
      + `<path class="band b${i}" d="${w.r.band}"/>`
      + `<path class="glow" d="${w.r.top}"/>`
      + `<path class="line" d="${w.r.top}"/>`
      + `<path class="strand" d="${w.r.mid}"/>`
      + `<path class="strand dim" d="${w.r.bot}"/>`
      + '</g></g>').join('');
    return `<svg class="xb-wave${document.hidden ? ' paused' : ''}" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="none" aria-hidden="true" focusable="false">`
      + '<defs><linearGradient id="xbw-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/>'
      + '<stop offset=".5" stop-color="#fff" stop-opacity=".11"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>'
      + g + '</svg>';
  }
  // the one wave pauses while Steam's window is hidden (Steam keeps the page alive in the tray)
  document.addEventListener('visibilitychange', () => {
    const s = document.querySelector('#rfs .xb-wave');
    if (s) s.classList.toggle('paused', document.hidden);
  });

  /* ---- clock + date at the top end (the only timer: one text write a minute, skipped while hidden) */
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
  /** the signed-in name, best effort (Steam has no stable API for it; hidden when unknown) */
  function userName() {
    const ctxs = [];
    try { if (window.opener) ctxs.push(window.opener); } catch (e) { /* cross-origin */ }
    ctxs.push(window);
    for (const c of ctxs) {
      try {
        const n = (c.friendStore && c.friendStore.self && c.friendStore.self.persona && c.friendStore.self.persona.m_strPlayerName)
          || (c.App && c.App.m_CurrentUser && (c.App.m_CurrentUser.strPersonaName || c.App.m_CurrentUser.strAccountName));
        if (n) return String(n);
      } catch (e) { /* not there */ }
    }
    return '';
  }

  /* ---- the categories */
  const CATS = [
    { id: 'recent', icon: 'clock', name: T('الأخيرة', 'Recent') },
    { id: 'installed', icon: 'drive', name: T('المثبتة', 'Installed') },
    { id: 'all', icon: 'library', name: T('كل الألعاب', 'All games') },
    { id: 'top', icon: 'fire', name: T('الأكثر لعباً', 'Most played') },
    { id: 'genres', icon: 'tag', name: T('الأنواع', 'Genres') },
  ];
  const countGames = n => T(
    n === 1 ? 'لعبة وحدة' : n === 2 ? 'لعبتين' : n >= 3 && n <= 10 ? `${NUM.format(n)} ألعاب` : `${NUM.format(n)} لعبة`,
    `${NUM.format(n)} ${n === 1 ? 'game' : 'games'}`);

  /** the thin second line of a row: hours · last played (· not installed) */
  function subLine(g, run) {
    if (run) return T('شغّالة الحين', 'Running now');
    const bits = [g.playtimeMin ? fmtPlaytime(g.playtimeMin) : T('ما انلعبت', 'Never played')];
    if (g.lastPlayed) bits.push(fmtAgo(g.lastPlayed));
    if (!g.installed) bits.push(T('غير مثبتة', 'Not installed'));
    return bits.join(' · ');
  }

  const Layout = {
    fixedHeight: true,
    dockInside: true,
    el: null, list: null, row: null, info: null, art: null, clock: null,
    lists: {}, cat: 'recent', sel: 0, selBy: {}, pool: new Map(), G: null,
    lastQ: '', lastGenre: '', wheelAcc: 0, wheelT: 0, artUrl: '', artTok: 0, settle: 0,

    render(games, w, h) {
      this.pool = new Map();
      const running = api.running();
      const st = api.state;
      const q = (st.query || '').trim().toLowerCase();

      // the category lists (all follow the strip's search + genre; Genres counts ignore the genre filter)
      const recent = games.filter(g => g.lastPlayed > 0).sort((a, b) => b.lastPlayed - a.lastPlayed).slice(0, 40);
      const top = games.filter(g => g.playtimeMin > 0).sort((a, b) => b.playtimeMin - a.playtimeMin).slice(0, 100);
      const counts = new Map();
      for (const g of st.games || []) {
        if (q && !g.name.toLowerCase().includes(q)) continue;
        for (const t of g.genres || []) counts.set(t, (counts.get(t) || 0) + 1);
      }
      const genres = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([t, n]) => ({ genre: t, n }));
      if (st.genre) genres.unshift({ genre: '', n: (st.games || []).length, clear: true });
      this.lists = {
        recent: recent.map(g => ({ g })), installed: games.filter(g => g.installed).map(g => ({ g })),
        all: games.map(g => ({ g })), top: top.map(g => ({ g })), genres,
      };
      // a new search (or genre) shows its matches in All games, from the first one
      if ((q && q !== this.lastQ) || (st.genre && st.genre !== this.lastGenre)) { this.cat = 'all'; this.selBy.all = null; }
      this.lastQ = q; this.lastGenre = st.genre || '';
      if (!this.lists[this.cat]) this.cat = 'recent';
      if (this.cat === 'recent' && !recent.length && !q) this.cat = 'all';

      // geometry: the focus column, the category row in the upper third, the focus row just under its label
      const narrow = w < 1100, tiny = w < 860;
      const pitch = narrow ? 112 : 128;
      const fx = Math.round(Math.min(300, Math.max(150, w * (narrow ? .19 : .17))));
      const catY = Math.max(150, Math.round(h * .27));
      const G = this.G = { w, h, pitch, fx, catY, focusY: catY + 118, above: catY - 14, rowH: 62, selH: 84, gap: 20 };
      G.below = Math.max(3, Math.ceil((h - G.focusY - G.selH) / G.rowH) + 1);
      const iw = tiny ? 0 : Math.round(Math.min(420, Math.max(290, w * .27)));
      const lw = Math.max(260, (tiny ? w - 32 : w - iw - 56 - 40) - (fx - 88));

      const tid = tintId();
      const el = div('xb' + (narrow ? ' narrow' : '') + (tiny ? ' tiny' : ''));
      el.style.height = h + 'px';
      el.style.setProperty('--fx', fx + 'px'); el.style.setProperty('--pitch', pitch + 'px'); el.style.setProperty('--cat-y', catY + 'px');
      el.style.setProperty('--focus-y', G.focusY + 'px'); el.style.setProperty('--iw', iw + 'px'); el.style.setProperty('--lw', lw + 'px');
      applyTint(el, tid);
      const sw = ['month', ...Object.keys(TINTS)].map(id => `<button type="button" class="xb-swb${id === tid ? ' on' : ''}" data-tint="${id}" title="${esc(TINT_NAMES[id])}" aria-label="${esc(TINT_NAMES[id])}" aria-pressed="${id === tid}" style="--c:${tintOf(id)[0]}">${id === 'month' ? ic('calendar') : ''}</button>`).join('');
      const [ct, cd] = clockText();
      const who = userName();
      const cats = CATS.map((c, i) => {
        const n = this.lists[c.id].filter(x => !x.clear).length;
        return `<button type="button" class="xb-cat" data-c="${c.id}" data-k="${i}" aria-label="${esc(c.name)}"><span class="ico">${ic(c.icon)}</span><span class="lb">${esc(c.name)}</span><small>${esc(c.id === 'genres' ? NUM.format(n) : countGames(n))}</small></button>`;
      }).join('');
      el.innerHTML = `<div class="xb-bg" aria-hidden="true"><div class="xb-art"></div>${waveSVG()}</div>
        <header class="xb-top">
          <div class="rf-dock" data-rfs-dock></div>
          <div class="xb-sys">
            <div class="xb-sw" role="group" aria-label="${esc(T('لون الخلفية', 'Background colour'))}">${sw}</div>
            ${who ? `<span class="xb-user" dir="auto" title="${esc(who)}">${ic('users')}<b>${esc(who)}</b></span>` : ''}
            <div class="xb-clock" aria-label="${esc(T('الساعة', 'Clock'))}"><b dir="ltr">${esc(ct)}</b><span>${esc(cd)}</span></div>
          </div>
        </header>
        <nav class="xb-cats" aria-label="${esc(T('الفئات', 'Categories'))}"><div class="xb-row">${cats}</div></nav>
        <div class="xb-list" role="listbox" aria-label="${esc(T('الألعاب', 'Games'))}"></div>
        ${iw ? '<aside class="xb-info" aria-live="polite"></aside>' : ''}`;

      this.el = el;
      this.list = $('.xb-list', el);
      this.row = $('.xb-row', el);
      this.info = $('.xb-info', el);
      this.art = $('.xb-art', el);
      this.clock = $('.xb-clock', el);
      // keep the backdrop art across re-renders (no flash while typing a search)
      if (this.artUrl) { this.art.style.backgroundImage = cssUrl(this.artUrl); this.art.style.opacity = ''; this.art.classList.toggle('on', true); }

      // restore the place in this category
      this.sel = this.indexOf(this.cat, this.selBy[this.cat]);
      this.paintCats(false);
      this.place();
      this.focusChanged(false);

      el.addEventListener('click', e => this.onClick(e));
      el.addEventListener('wheel', e => this.onWheel(e), { passive: false });

      api.stage.replaceChildren(el);
      if (!clockTimer) clockTimer = setInterval(paintClock, 15000);
    },

    /* ---------- state helpers ---------- */
    cur() { return this.lists[this.cat] || []; },
    indexOf(cat, key) {
      const L = this.lists[cat] || [];
      if (key == null) return 0;
      const i = L.findIndex(x => (x.g ? String(x.g.appid) : 'g:' + x.genre) === key);
      return i < 0 ? 0 : i;
    },
    keyOf(x) { return x ? (x.g ? String(x.g.appid) : 'g:' + x.genre) : null; },

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
      this.selBy[this.cat] = this.keyOf(this.cur()[this.sel]);
      this.cat = id;
      this.sel = this.indexOf(id, this.selBy[id]);
      api.sfx('tick');
      this.paintCats(true);
      // the column is rebuilt for the new category and drops in softly
      this.list.replaceChildren(); this.pool = new Map();
      this.place();
      if (!reduced()) this.list.animate([{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASE });
      this.focusChanged(true);
    },

    /* ---------- the column: only a window of rows around the focus exists ---------- */
    yOf(i) {
      const G = this.G, s = this.sel;
      if (i === s) return G.focusY;
      if (i > s) return G.focusY + G.selH + G.gap + (i - s - 1) * G.rowH;
      return G.above - (s - i) * G.rowH;
    },
    makeRow(i, x) {
      const r = document.createElement('div');
      r.className = 'xb-it' + (x.g ? '' : ' gen') + (x.g && api.running().has(x.g.appid) ? ' running' : '') + (x.g && !x.g.installed ? ' ni' : '');
      r.dataset.i = i;
      r.setAttribute('role', 'option');
      if (x.g) {
        const g = x.g;
        r.dataset.appid = g.appid;
        const ach = api.achHTML ? api.achHTML(g, 'mini') : '';
        r.innerHTML = `<div class="art"></div><div class="tx"><b class="t" dir="auto" title="${esc(g.name)}">${esc(g.name)}</b><span class="h">${esc(subLine(g, api.running().has(g.appid)))}${ach}</span></div>`;
        const art = r.firstElementChild;
        lazy(r, gg => { const u = cssUrl(first(gg.images.header) || first(gg.images.capsule)); if (art._u !== u) { art._u = u; art.style.setProperty('--img', u); } });
      } else {
        const on = !x.clear && api.state.genre === x.genre;
        r.classList.toggle('on', on);
        r.innerHTML = `<div class="art">${ic(x.clear ? 'layers' : 'tag')}</div><div class="tx"><b class="t" dir="auto">${esc(x.clear ? T('كل الأنواع', 'All genres') : x.genre)}</b><span class="h">${esc(x.clear ? T('شيل فلتر النوع', 'Clear the genre filter') : countGames(x.n))}</span></div>`;
      }
      return r;
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
      if (i === this.sel) return;
      this.sel = i;
      this.selBy[this.cat] = this.keyOf(this.cur()[i]);
      if (sound) api.sfx('tick');
      this.place();
      this.focusChanged(true);
    },

    /* ---------- the focused game: info at the end side, its art faded behind the waves ---------- */
    focusChanged(soon) {
      const x = this.cur()[this.sel];
      this.paintInfo(x);
      clearTimeout(this.settle);
      if (!x || !x.g) { this.setArt(''); return; }
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
      const L = this.cur(), catName = (CATS.find(c => c.id === this.cat) || CATS[0]).name;
      const pos = L.length ? `${NUM.format(this.sel + 1)} / ${NUM.format(L.length)}` : '';
      const kick = `<span class="xb-kick">${esc(catName)}${pos ? `<i dir="ltr">${esc(pos)}</i>` : ''}</span>`;
      const kbd = k => `<kbd>${esc(k)}</kbd>`;
      if (!x) { box.innerHTML = kick; return; }
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

    /* ---------- input ---------- */
    activate(x, play) {
      if (!x) return;
      if (!x.g) {
        api.state.genre = x.clear ? '' : x.genre;
        if (!x.clear) { this.cat = 'all'; this.selBy.all = null; }
        api.sfx('tick');
        api.rerender();
        return;
      }
      if (play) { api.launch(x.g); return; }
      api.openGame(x.g, this.source(x.g.appid));
    },
    onClick(e) {
      if (e.target.closest('#rfs-bar')) return;
      const sw = e.target.closest('.xb-swb');
      if (sw) {
        const id = sw.dataset.tint;
        try { localStorage.setItem(TINT_KEY, id); } catch (err) { /* private */ }
        applyTint(this.el, id);
        for (const b of sw.parentElement.children) { const on = b === sw; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
        api.sfx('tick');
        return;
      }
      const c = e.target.closest('.xb-cat');
      if (c) { this.setCat(c.dataset.c); return; }
      const r = e.target.closest('.xb-it');
      if (!r || e.detail > 1) return;
      const i = +r.dataset.i;
      if (i !== this.sel) this.go(i, false);
      this.activate(this.cur()[i], false);
    },
    onWheel(e) {
      if (e.target.closest('#rfs-bar, .xb-info, .rf-dd-menu')) return;
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
      if (horiz) { const k = CATS.findIndex(c => c.id === this.cat) + dir; if (CATS[k]) this.setCat(CATS[k].id); }
      else this.go(this.sel + dir);
    },
    /** ← / → categories (visual direction: in Arabic the next one is on the left), ↑ / ↓ PgUp / PgDn Home / End the
        column, Enter opens, Ctrl+Enter / Space plays */
    key(e) {
      if (e.altKey || e.metaKey || !this.el || !this.el.isConnected) return false;
      const k = e.key, L = this.cur();
      if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
        const x = L[this.sel];
        if (!x) return false;
        this.activate(x, k !== 'Enter' || e.ctrlKey);
        return true;
      }
      if (e.ctrlKey) return false;
      const fwd = LTR ? 'ArrowRight' : 'ArrowLeft', back = LTR ? 'ArrowLeft' : 'ArrowRight';
      if (k === fwd || k === back) {
        const i = CATS.findIndex(c => c.id === this.cat) + (k === fwd ? 1 : -1);
        if (CATS[i]) this.setCat(CATS[i].id);
        return true;
      }
      const page = Math.max(3, this.G.below - 1);
      const to = { ArrowDown: this.sel + 1, ArrowUp: this.sel - 1, PageDown: this.sel + page, PageUp: this.sel - page, Home: 0, End: L.length - 1 }[k];
      if (to == null) return false;
      this.go(to);
      return true;
    },

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
        if (n) { e.preventDefault(); e.stopPropagation(); n.focus(); api.sfx('tick'); }
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
      api.sfx('slide');
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
      api.sfx('close');
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
