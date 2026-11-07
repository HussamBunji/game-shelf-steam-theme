/* ═══ Retro Arcade (الأركيد) — library home design ═══
   A 1980s cabinet's "select your game" screen:
     • top: SELECT YOUR GAME · CREDITS (installed games) · HI-SCORE (most-played hours), then the filter strip
     • a CRT monitor with the selected game + stats + buttons
     • a high-score style list of every game (001, 002 …), driven by the mouse or the arrow keys
   Hover is instant: the row under the mouse IS the selection (next animation frame, no timers). The monitor shows the
   small header picture at once (pre-warmed for the rows on screen) and upgrades to the hero when that has loaded.
   A click (or INFO / Shift+Enter) opens the game the arcade way: a cartridge drops into the slot, the CRT powers on and
   shows the GAME INFO screen (open / close below).
   Registered through window.__rfsLayoutApi — see docs/THEME-KIT.md. */
(function () {
  'use strict';
  const api = window.__rfsLayoutApi; // provided by shelf.js
  if (!api) return;
  const { T, esc, div, $, ic, fmtPlaytime, fmtAgo, fmtSize, NUM, absUrl, first, imgWithFallback } = api;

  const SLOW = 1;      // (development: stretches the open / close animations to inspect them frame by frame)
  const HERO_MS = 110; // the 1920 px hero is fetched once the selection rests this long (the header is already on screen)

  const pad = (n, w) => String(n).padStart(w, '0');
  /** the score column: 0.4 · 7.5 · 12 · 1,204 */
  const hrs = min => { const h = (min || 0) / 60; return h >= 10 ? Math.round(h) : Math.max(0.1, Math.round(h * 10) / 10); };
  const kbd = k => `<kbd>${k}</kbd>`;

  /* ---- decoded pictures, kept ready: a warm picture goes on screen in the same frame (no black flash) ---- */
  const WARM = new Map(); // absolute url → decoded HTMLImageElement
  const PENDING = new Set(); // appids whose small picture is loading in the background
  function keepWarm(url, im) {
    WARM.delete(url); WARM.set(url, im);
    if (WARM.size > 160) WARM.delete(WARM.keys().next().value); // oldest out
  }
  function warmOf(list) {
    for (const u of list || []) { const im = WARM.get(absUrl(u)); if (im) return im; }
    return null;
  }
  /** loads the first picture of the list that works and decodes it. Resolves the image (or null); .cancel() aborts. */
  function loadPic(list) {
    let im = null, dead = false;
    const p = new Promise(resolve => {
      let k = 0;
      const next = () => {
        if (dead) return;
        if (!list || k >= list.length) { resolve(null); return; }
        const url = absUrl(list[k++]);
        const hit = WARM.get(url);
        if (hit) { resolve(hit); return; }
        im = new Image();
        im.alt = ''; im.draggable = false; im.decoding = 'async';
        im.onerror = next;
        im.onload = () => {
          const done = () => { if (dead) return; keepWarm(url, im); resolve(im); };
          if (im.decode) im.decode().then(done, done); else done();
        };
        im.src = url;
      };
      next();
    });
    p.cancel = () => { dead = true; if (im && !im.complete) { im.onload = im.onerror = null; im.removeAttribute('src'); } };
    return p;
  }
  /** the small picture for a game: header (wide), else the cover (tall) */
  const loList = g => (g.images.header && g.images.header.length) ? { list: g.images.header, tall: false } : { list: g.images.capsule || [], tall: true };

  /** Store button. Uses api.steamUrl when shelf.js offers it; otherwise the window's own SteamClient. */
  function openStore(appid) {
    if (typeof api.steamUrl === 'function') { api.steamUrl('steam://store/' + appid); return; }
    let c = window;
    try { if (window.opener && window.opener.SteamClient) c = window.opener; } catch (e) { /* cross-origin */ }
    c.SteamClient.URL.ExecuteSteamURL('steam://store/' + appid);
  }

  const RANKS_EN = ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH'];
  const RANKS_AR = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن'];

  const Layout = {
    fixedHeight: true,  // the cabinet fills the panel exactly; only the game list scrolls
    dockInside: true,   // the filter strip sits under the top bar, above the games
    games: [],
    cur: 0,
    selId: null,        // the appid the player picked — kept across re-renders (search, sort, resize, refresh)
    r: null,            // element refs of the current render

    render(games, w, h) {
      this.stop();
      const prev = this.r;
      // same list as before (a refresh, a resize) → keep where the list was scrolled to
      const sameList = !!(prev && prev.list.isConnected && games.length && this.games.length === games.length
        && this.games[0] === games[0] && this.games[games.length - 1] === games[games.length - 1]);
      const keepTop = sameList ? prev.list.scrollTop : null;
      this.games = games;
      if (this.selId == null && games[0]) this.selId = games[0].appid; // first visit: the top game, kept when re-sorting
      const at = games.findIndex(g => g.appid === this.selId);
      // the picked game was filtered out (a search) → the best match is selected; clearing the search brings it back
      this.cur = at < 0 ? 0 : at;

      // scoreboard: over the whole library source, not just what the search shows
      const all = api.state.games && api.state.games.length ? api.state.games : games;
      let credits = 0, top = null;
      for (const g of all) {
        if (g.installed) credits++;
        if ((g.playtimeMin || 0) > (top ? top.playtimeMin : 0)) top = g;
      }
      this.top = top;
      const nd = Math.max(3, String(games.length).length);
      this.nd = nd;
      const running = api.running();

      // fixedHeight: shelf.js sized #rfs for us; fill it (the strip moves into our dock right after this)
      const H = Math.max(h, Math.round(parseFloat(api.root.style.height) || 0));
      const el = div('ar' + (H < 640 ? ' short' : '') + (H < 540 ? ' tiny' : '') + (w < 1000 ? ' narrow' : ''));
      el.style.height = H + 'px';
      el.style.setProperty('--nw', (nd * 10 + 6) + 'px');
      const hiTitle = top
        ? T(`أكثر لعبة لعبتها: ${top.name} — اضغط للانتقال لها`, `Most played: ${top.name} — click to jump to it`)
        : T('ما فيه ساعات لعب للحين', 'No playtime yet');
      el.innerHTML = `
        <header class="ar-top">
          <div class="ar-brand"><span class="ar-sprite" aria-hidden="true"></span><h2 class="ar-h">${T('اختر لعبتك', 'SELECT YOUR GAME')}</h2></div>
          <div class="ar-scores">
            <div class="ar-score cr" title="${esc(T('عدد الألعاب المثبتة على جهازك', 'Games installed on this PC'))}">
              <span class="ar-lbl">${T('الرصيد', 'CREDITS')}</span><b class="ar-num">${pad(credits, 2)}</b></div>
            <button class="ar-score hi" data-act="hi" title="${esc(hiTitle)}">
              <span class="ar-lbl">${T('أعلى نتيجة', 'HI-SCORE')}</span><b class="ar-num">${top ? NUM.format(Math.round(top.playtimeMin / 60)) : '0'}<small>${T('س', 'H')}</small></b></button>
          </div>
        </header>
        <div class="ar-main">
          <section class="ar-mon">
            <div class="ar-cab">
              <div class="ar-screen">
                <img class="ar-shot" alt="" draggable="false">
                <img class="ar-hero" alt="" draggable="false">
                <div class="ar-logo"></div>
                <div class="ar-nosig"><span>${T('لا توجد إشارة', 'NO SIGNAL')}</span></div>
              </div>
            </div>
            <div class="ar-info">
              <div class="ar-tline"><span class="ar-rank"></span><h3 class="ar-title" dir="auto"></h3></div>
              <div class="ar-genre" dir="auto"></div>
              <div class="ar-stats">
                <div class="ar-stat s1"><span class="ar-lbl">${T('ساعات اللعب', 'HOURS')}</span><b class="ar-val" data-k="hours"></b></div>
                <div class="ar-stat s2"><span class="ar-lbl">${T('آخر لعب', 'LAST PLAYED')}</span><b class="ar-val" data-k="last"></b></div>
                <div class="ar-stat s3"><span class="ar-lbl">${T('الحجم', 'SIZE')}</span><b class="ar-val" data-k="size"></b></div>
                <div class="ar-stat s4"><span class="ar-lbl">${T('الحالة', 'STATUS')}</span><b class="ar-val" data-k="status"></b></div>
                <div class="ar-stat s5"><span class="ar-lbl">${T('الإنجازات', 'TROPHIES')}</span><b class="ar-val" data-k="ach"></b><i class="ar-achbar" aria-hidden="true"><i></i></i></div>
              </div>
              <div class="ar-acts">
                <button class="ar-btn start" data-act="start"></button>
                <button class="ar-btn info" data-act="info" title="${esc(T('شاشة معلومات اللعبة (Shift+Enter)', 'Game info screen (Shift+Enter)'))}">${ic('info')}<span>${T('التفاصيل', 'INFO')}</span></button>
                <button class="ar-btn store" data-act="store" title="${esc(T('صفحة اللعبة في المتجر', 'This game in the Store'))}">${ic('cart')}<span>${T('المتجر', 'STORE')}</span></button>
              </div>
            </div>
          </section>
          <section class="ar-side">
            <div class="rf-dock ar-dock" data-rfs-dock></div>
            <div class="ar-lhead"><span>${T('الرقم', 'RANK')}</span><span>${T('اللعبة', 'NAME')}</span><span>${T('ساعات', 'HOURS')}</span></div>
            <div class="ar-list" tabindex="-1" role="listbox" aria-label="${esc(T('كل ألعابك', 'All your games'))}"></div>
            <div class="ar-count"></div>
          </section>
        </div>
        <footer class="ar-foot">
          <span class="ar-blink">${T('اضغط Enter للبدء', 'PRESS ENTER TO START')}</span>
          <span class="ar-keys">
            <span>${kbd('↑')}${kbd('↓')} ${T('تنقّل', 'MOVE')}</span>
            <span>${kbd('PgUp')}${kbd('PgDn')} ${T('صفحة', 'PAGE')}</span>
            <span>${kbd('Home')}${kbd('End')} ${T('الأول / الأخير', 'FIRST / LAST')}</span>
            <span>${kbd('Enter')} ${T('ابدأ', 'START')}</span>
            <span>${kbd('Shift')}+${kbd('Enter')} ${T('المعلومات', 'INFO')}</span>
            <span>${T('نقرة = شاشة اللعبة', 'CLICK = GAME INFO')}</span>
          </span>
        </footer>`;

      const r = this.r = {
        el, list: $('.ar-list', el), screen: $('.ar-screen', el), shot: $('.ar-shot', el), hero: $('.ar-hero', el), logo: $('.ar-logo', el),
        rank: $('.ar-rank', el), title: $('.ar-title', el), genre: $('.ar-genre', el),
        hours: $('[data-k="hours"]', el), last: $('[data-k="last"]', el), size: $('[data-k="size"]', el), status: $('[data-k="status"]', el), ach: $('[data-k="ach"]', el), achBox: $('.ar-stat.s5', el),
        start: $('[data-act="start"]', el), info: $('[data-act="info"]', el), store: $('[data-act="store"]', el),
        count: $('.ar-count', el), loId: null, hiId: null,
      };
      // a re-render keeps the picture that is already on the monitor (typing a search re-renders on every key)
      if (prev && prev.loId != null && prev.shot.getAttribute('src')) {
        r.shot.replaceWith(prev.shot); r.shot = prev.shot; r.loId = prev.loId;
        r.screen.classList.toggle('tall', prev.screen.classList.contains('tall'));
        if (prev.hiId != null) { r.hero.replaceWith(prev.hero); r.hero = prev.hero; r.hiId = prev.hiId; r.screen.classList.toggle('hi', true); }
      } else r.screen.classList.toggle('tuning', true);

      // the list: one row + 3 children per game, built as one string (900+ games)
      let html = '';
      for (let k = 0; k < games.length; k++) {
        const g = games[k];
        const cls = 'ar-row' + (k === this.cur ? ' sel' : '') + (g.installed ? '' : ' ni') + (running.has(g.appid) ? ' run' : '');
        html += `<div class="${cls}" data-i="${k}" data-appid="${g.appid}" role="option"><b class="ar-n">${pad(k + 1, nd)}</b>`
          + `<span class="ar-name" dir="auto">${esc(g.name)}</span>`
          + `<span class="ar-hrs${g.playtimeMin ? '' : ' z'}">${g.playtimeMin ? NUM.format(hrs(g.playtimeMin)) : '—'}</span></div>`;
      }
      r.list.innerHTML = html || `<div class="ar-empty">${T('ما لقيت لعبة تطابق بحثك', 'NO MATCH — TRY ANOTHER SEARCH')}</div>`;
      api.stage.replaceChildren(el);

      const row = this.row(this.cur);
      if (keepTop != null) r.list.scrollTop = keepTop;
      else if (row) r.list.scrollTop = Math.max(0, row.offsetTop - (r.list.clientHeight - row.offsetHeight) / 2);

      // the rows on screen pre-load their details + small picture, so hovering them shows it in the same frame
      for (const it of r.list.children) if (it.dataset.appid) api.lazy(it, g => this.warm(g));

      el.addEventListener('click', e => {
        const b = e.target.closest('[data-act]');
        if (!b || b.disabled) return;
        const act = b.dataset.act;
        if (act === 'hi') this.jumpTop();
        else if (act === 'start') this.start();
        else if (act === 'info') this.info(b);
        else if (act === 'store') this.store();
      });
      // one click opens the game's INFO screen at once (the row is already the selection: hovering selected it)
      r.list.addEventListener('click', e => {
        const it = e.target.closest('.ar-row'); if (!it) return;
        this.unhover();
        this.select(+it.dataset.i, { quiet: true, scroll: false });
        this.info(it);
      });
      r.list.addEventListener('pointermove', e => this.hover(e));
      r.list.addEventListener('pointerleave', () => this.unhover());

      this.fill();
      this.pic();
      this.near(this.cur, 1);
    },

    /** the row under the mouse becomes the selection on the next animation frame — no timers, no waiting */
    hover(e) {
      if (e.pointerType && e.pointerType !== 'mouse') return; // pen / touch: a tap opens
      if (e.clientX === this.px && e.clientY === this.py) return; // the list scrolled under a resting pointer
      this.px = e.clientX; this.py = e.clientY;
      const it = e.target.closest('.ar-row');
      if (!it) return;
      this.hoverI = +it.dataset.i;
      if (this.raf) return;
      this.raf = requestAnimationFrame(() => {
        this.raf = 0;
        const i = this.hoverI; this.hoverI = -1;
        if (i >= 0 && i !== this.cur && this.r) this.select(i, { scroll: false, hover: true });
      });
    },
    unhover() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; this.hoverI = -1; },

    row(i) { return this.r && this.games.length ? this.r.list.children[i] || null : null; },

    select(i, o = {}) {
      const r = this.r, n = this.games.length;
      if (!r || !n) return;
      i = Math.max(0, Math.min(n - 1, i));
      if (i !== this.cur) {
        const step = i > this.cur ? 1 : -1;
        const was = this.row(this.cur);
        if (was) was.classList.toggle('sel', false);
        this.cur = i;
        const now = this.row(i);
        if (now) now.classList.toggle('sel', true);
        if (!o.quiet) api.sfx('tick');
        this.fill();
        this.pic();
        if (!o.hover) this.near(i, step); // keys travel: get the next rows ready before they arrive
      }
      this.selId = this.games[i].appid;
      if (o.scroll !== false) { const now = this.row(i); if (now) now.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    },

    /** the monitor's text: name, stats, button labels — written in the same frame as the selection */
    fill() {
      const r = this.r; if (!r) return;
      const g = this.games[this.cur];
      for (const b of [r.start, r.info, r.store]) b.disabled = !g;
      if (!g) {
        r.rank.textContent = '';
        r.title.textContent = T('ما فيه ألعاب', 'NO GAMES');
        r.genre.textContent = '';
        for (const k of ['hours', 'last', 'size', 'status', 'ach']) r[k].textContent = '—';
        this.ach(null);
        r.start.innerHTML = `${ic('play')}<span>${T('ابدأ', 'START')}</span>`;
        r.start.dataset.st = '';
        r.count.textContent = '';
        return;
      }
      const running = api.running().has(g.appid);
      r.rank.textContent = '#' + pad(this.cur + 1, this.nd);
      r.title.textContent = g.name;
      r.genre.textContent = (g.genres || []).slice(0, 3).join(' · ');
      r.hours.textContent = fmtPlaytime(g.playtimeMin);
      r.last.textContent = g.lastPlayed ? fmtAgo(g.lastPlayed) : T('ولا مرة', 'NEVER');
      r.size.textContent = g.sizeOnDisk ? fmtSize(g.sizeOnDisk) : '—';
      const st = running ? 'run' : g.installed ? 'ok' : 'ni';
      r.status.textContent = running ? T('شغّالة الحين', 'RUNNING') : g.installed ? T('جاهزة', 'READY') : T('غير مثبتة', 'NOT INSTALLED');
      if (r.status.dataset.st !== st) r.status.dataset.st = st;
      this.ach(g);
      if (r.start.dataset.st !== st) { // the START key only changes with the game's state
        r.start.dataset.st = st;
        r.start.classList.toggle('run', running);
        r.start.innerHTML = running
          ? `${ic('pulse')}<span>${T('شغّالة', 'RUNNING')}</span>`
          : `${ic(g.installed ? 'play' : 'download')}<span>${g.installed ? T('ابدأ', 'START') : T('ثبّت', 'INSTALL')}</span>${kbd('Enter')}`;
        r.start.title = g.installed ? T('شغّل اللعبة (Enter)', 'Play (Enter)') : T('ثبّت اللعبة (Enter)', 'Install (Enter)');
      }
      r.count.textContent = `${pad(this.cur + 1, this.nd)} / ${pad(this.games.length, this.nd)}`;
    },

    /** the TROPHIES box: "12/50" + a stepped pixel bar; exact once the details are in (fill() runs again then) */
    ach(g) {
      const r = this.r; if (!r || !r.ach) return;
      const a = g ? api.gameAch(g) : null;
      const key = a ? `${a.got}/${a.total}` : g && g.detailed ? 'x' : '';
      if (r.achBox.dataset.k === key) return;
      r.achBox.dataset.k = key;
      r.ach.innerHTML = a ? `${NUM.format(a.got)}<small>/${NUM.format(a.total)}</small>` : '—';
      r.achBox.style.setProperty('--p', a ? String(a.pct) : '0');
      r.achBox.classList.toggle('done', !!a && a.got >= a.total);
      r.achBox.classList.toggle('none', !a);
      r.achBox.title = a ? T(`الإنجازات: ${NUM.format(a.got)} من ${NUM.format(a.total)} (${a.pct}%)`, `Achievements: ${NUM.format(a.got)} of ${NUM.format(a.total)} (${a.pct}%)`)
        : (g && g.detailed ? T('ما فيها إنجازات', 'No achievements') : '');
    },

    /* ---- the CRT picture: the small header at once, the hero on top when it has loaded ---- */
    pic() {
      const r = this.r; if (!r) return;
      const g = this.games[this.cur];
      this.drop();
      const tok = this.tok = {};
      if (!g) { this.lo(null); return; }
      r.screen.classList.toggle('hi', r.hiId === g.appid); // another game's hero goes away at once
      if (r.hiId === g.appid) this.logo(g);
      if (!g.detailed) { // header / hero / logo come with the details (usually already there: rows pre-load them)
        if (r.loId !== g.appid) { const cap = warmOf(g.images.capsule); if (cap) this.lo(g, cap, true); else this.tune(true); }
        api.Data.ensureDetails(g).then(() => { if (this.tok === tok) { this.fill(); this.pic(); } });
        return;
      }
      const { list, tall } = loList(g);
      if (r.loId !== g.appid || r.screen.classList.contains('tall') !== tall) {
        const hit = warmOf(list);
        if (hit) this.lo(g, hit, tall);
        else {
          this.tune(true); // keep the last picture under a soft static until this one is ready (never a black frame)
          const p = this.loP = loadPic(list);
          p.then(im => { if (this.tok === tok) this.lo(g, im, tall); });
        }
      } else this.tune(false);
      if (r.hiId !== g.appid && g.images.hero && g.images.hero.length) {
        const hit = warmOf(g.images.hero);
        if (hit) this.hi(g, hit);
        else this.heroT = setTimeout(() => {
          const p = this.hiP = loadPic(g.images.hero);
          const lp = g.images.logo && g.images.logo.length ? loadPic(g.images.logo) : Promise.resolve(null);
          this.lgP = lp;
          Promise.all([p, lp]).then(([im]) => { if (this.tok === tok && im) this.hi(g, im); });
        }, HERO_MS);
      }
    },
    /** the small picture goes on screen (the decoded element itself — it paints in this frame) */
    lo(g, im, tall) {
      const r = this.r; if (!r) return;
      r.loId = g ? g.appid : null;
      if (im && im !== r.shot) { im.className = 'ar-shot'; r.shot.replaceWith(im); r.shot = im; }
      r.screen.classList.toggle('tall', !!im && !!tall);
      r.screen.classList.toggle('empty', !im && !(g && r.hiId === g.appid));
      this.tune(false);
    },
    /** the hero (1920 px) fades in over the small picture, the logo with it */
    hi(g, im) {
      const r = this.r; if (!r) return;
      if (im !== r.hero) { im.className = 'ar-hero'; r.hero.replaceWith(im); r.hero = im; }
      r.hiId = g.appid;
      this.logo(g);
      r.screen.classList.toggle('hi', true);
      r.screen.classList.toggle('empty', false);
    },
    tune(on) { if (this.r) this.r.screen.classList.toggle('tuning', on); },
    logo(g) {
      const box = this.r.logo;
      const id = g ? String(g.appid) : '';
      if (box.dataset.logo === id) return;
      box.dataset.logo = id;
      const list = g ? g.images.logo || [] : [];
      if (!list.length) { box.replaceChildren(); return; }
      const hit = warmOf(list);
      if (hit) { const im = hit.cloneNode(); im.className = 'ar-logo-img'; box.replaceChildren(im); return; }
      box.replaceChildren(imgWithFallback(list, 'ar-logo-img', im => im.remove()));
    },
    /** stop loading pictures for a game that is no longer selected */
    drop() {
      clearTimeout(this.heroT);
      for (const k of ['loP', 'hiP', 'lgP']) { if (this[k] && this[k].cancel) this[k].cancel(); this[k] = null; }
      this.tok = null;
    },
    /** a row came into view (or is next in line): its details + small picture get ready in the background */
    warm(g) {
      if (!g || !g.detailed || PENDING.has(g.appid)) return;
      const { list } = loList(g);
      if (!list.length || warmOf(list)) return;
      PENDING.add(g.appid);
      loadPic(list).then(() => PENDING.delete(g.appid));
    },
    near(i, step) {
      for (let k = 1; k <= 3; k++) {
        const g = this.games[i + k * step];
        if (g) { if (g.detailed) this.warm(g); else api.Data.ensureDetails(g).then(() => this.warm(g)); }
      }
    },

    start() {
      const g = this.games[this.cur]; if (!g) return;
      const b = this.r && this.r.start;
      if (b && b.animate) b.animate([{ transform: 'translateY(3px)' }, { transform: 'none' }], { duration: 180, easing: 'steps(2, end)' });
      api.launch(g);
    },
    /** the GAME INFO screen; from = the element the cartridge flies out of (the row or the INFO key) */
    info(from) {
      const g = this.games[this.cur]; if (!g) return;
      this.unhover();
      const el = from && from.isConnected ? from : this.row(this.cur) || (this.r && this.r.info);
      api.openGame(g, el ? { el, slot: null, isSpine: false } : this.source(g.appid));
    },
    store() {
      const g = this.games[this.cur]; if (!g) return;
      api.sfx('tick');
      try { openStore(g.appid); } catch (err) { api.toast(T('ما قدرت أفتح المتجر', 'Couldn\'t open the Store')); }
    },
    /** HI-SCORE: jump to the most-played game */
    jumpTop() {
      const t = this.top;
      if (!t || !t.playtimeMin) return;
      const i = this.games.indexOf(t);
      if (i < 0) { api.toast(T('أكثر لعبة لعبتها مخفية بالفلتر الحالي', 'Your most-played game is hidden by the current filter')); return; }
      this.unhover();
      this.select(i);
    },

    perPage() {
      const r = this.r, it = r && r.list.firstElementChild;
      const pitch = it ? it.offsetHeight + 4 : 32; // 4 = the list's row gap
      return Math.max(1, Math.floor(r.list.clientHeight / pitch));
    },

    /** Big Picture: the game X plays (the selected row) */
    padGame() { return (this.r && this.games && this.games[this.cur]) || null; },
    /** Big Picture: A opens GAME INFO (Enter is START = play here; on a controller X plays) */
    padOk() { if (!this.r || !this.games[this.cur]) return false; this.info(); return true; },
    /** keyboard: ↑ ↓ move · PgUp PgDn jump a page · Home End · Enter START · Shift+Enter INFO */
    key(e) {
      const r = this.r;
      if (!r || !r.el.isConnected || e.ctrlKey || e.altKey || e.metaKey) return false;
      const t = e.target && e.target.nodeType === 1 ? e.target : null, root = api.root;
      // only while the focus is on our design (or nothing in particular): Steam's own game list keeps its arrow keys
      const ours = !t || t === document.body || t === document.documentElement || root.contains(t) || t.contains(root);
      if (!ours) return false;
      // a focused button of ours (the strip, INFO, STORE…) presses itself with Enter
      if (e.key === 'Enter' && t && t !== r.list && root.contains(t) && t.closest('button, a, [role="button"]')) return false;
      const n = this.games.length;
      if (!n) return false;
      let to;
      switch (e.key) {
        case 'ArrowDown': to = this.cur + 1; break;
        case 'ArrowUp': to = this.cur - 1; break;
        case 'PageDown': to = this.cur + Math.max(1, this.perPage() - 1); break;
        case 'PageUp': to = this.cur - Math.max(1, this.perPage() - 1); break;
        case 'Home': to = 0; break;
        case 'End': to = n - 1; break;
        case 'Enter':
          if (!e.repeat) { if (e.shiftKey) this.info(); else this.start(); }
          return true;
        default: return false;
      }
      this.unhover();
      this.select(to, { quiet: e.repeat });
      return true;
    },

    stop() { this.unhover(); this.drop(); },

    /** where a game panel flies from: the game's row when it is on screen, else the INFO key */
    source(appid) {
      const r = this.r;
      if (!r || !r.el.isConnected) return null;
      const it = r.list.querySelector(`.ar-row[data-appid="${appid}"]`);
      if (it) {
        const a = it.getBoundingClientRect(), b = r.list.getBoundingClientRect();
        if (a.bottom > b.top && a.top < b.bottom) return { el: it, slot: null, isSpine: false };
      }
      const g = this.games[this.cur];
      if (g && String(g.appid) === String(appid)) return { el: r.info, slot: null, isSpine: false };
      return null;
    },

    /* ═══ the GAME INFO screen (#rfs-sheet): a cartridge drops into the slot, the CRT powers on ═══ */
    async open(g, sheet, src) {
      const i = this.games.indexOf(g);
      const running = api.running().has(g.appid);
      const facts = api.gameFacts(g);
      const desc = api.gameDesc(g);
      const lo = loList(g);
      const st = running ? 'run' : g.installed ? 'ok' : 'ni';
      const stTxt = running ? T('شغّالة الحين', 'RUNNING') : g.installed ? T('جاهزة للعب', 'READY') : T('غير مثبتة', 'NOT INSTALLED');
      const rows = facts.map(([k, v], n) => `
        <div class="arv-tr" style="--c:var(--arv-c${n % 6})"><b class="arv-rk">${T(RANKS_AR[n] || n + 1, RANKS_EN[n] || n + 1 + 'TH')}</b>`
        + `<span class="arv-k">${esc(k)}</span><i class="arv-dots" aria-hidden="true"></i><em class="arv-v" dir="auto" title="${esc(v)}">${esc(v)}</em></div>`).join('');
      sheet.innerHTML = `
        <div class="arv">
          <div class="arv-bg" data-close></div>
          <div class="arv-cab">
            <div class="arv-mon">
              <div class="arv-scr">
                <header class="arv-top">
                  <button class="arv-back" data-close title="${esc(T('رجوع (Esc)', 'Back (Esc)'))}">${ic(api.LTR ? 'chevL' : 'chevR')}<span>${T('رجوع', 'BACK')}</span>${kbd('Esc')}</button>
                  <h2 class="arv-h">${T('معلومات اللعبة', 'GAME INFO')}</h2>
                  <span class="arv-1up"><b>${T('لاعب ١', '1UP')}</b>${i >= 0 ? `<span>#${pad(i + 1, this.nd || 3)}</span>` : ''}</span>
                </header>
                <div class="arv-mq">
                  <div class="arv-art"></div>
                  <div class="arv-logo"><span class="arv-mqname" dir="auto">${esc(g.name)}</span></div>
                </div>
                <div class="arv-body">
                  <section class="arv-main">
                    <div class="arv-nline"><h3 class="arv-name" dir="auto">${esc(g.name)}</h3><span class="arv-st" data-st="${st}">${stTxt}</span></div>
                    ${g.genres && g.genres.length ? `<div class="arv-tags">${g.genres.slice(0, 5).map(x => `<span dir="auto">${esc(x)}</span>`).join('')}</div>` : ''}
                    <div class="arv-tbl" role="table">
                      <div class="arv-th" role="row"><span>${T('المركز', 'RANK')}</span><span>${T('السجل', 'RECORD')}</span><span>${T('النتيجة', 'SCORE')}</span></div>
                      ${rows}
                    </div>
                    <div class="arv-press"><span>${running ? T('اللعبة شغّالة', 'GAME IN PROGRESS') : g.installed ? T('اضغط Enter للعب', 'PRESS ENTER TO PLAY') : T('اضغط Enter للتثبيت', 'PRESS ENTER TO INSTALL')}</span></div>
                  </section>
                  <section class="arv-story">
                    <h4 class="arv-sh">${T('القصة', 'STORY')}</h4>
                    <p class="arv-desc${desc ? '' : ' none'}" dir="auto">${esc(desc || T('ما فيه وصف لهذي اللعبة. افتح صفحتها في المتجر للمزيد.', 'NO STORY ON FILE. OPEN THE STORE PAGE FOR MORE.'))}</p>
                  </section>
                </div>
                <i class="arv-flash" aria-hidden="true"></i>
              </div>
            </div>
            <footer class="arv-deck">
              <i class="arv-slot" aria-hidden="true"></i>
              <span class="arv-stick" aria-hidden="true"></span>
              <span class="arv-hint">${kbd(api.LTR ? '←' : '→')}${kbd(api.LTR ? '→' : '←')} ${T('اختر زر', 'CHOOSE')} · ${kbd('Enter')} ${T('اضغط', 'PRESS')} · ${kbd('Esc')} ${T('رجوع', 'BACK')}</span>
            </footer>
          </div>
          <div class="arv-cart" aria-hidden="true"><i class="arv-cart-lbl"></i></div>
        </div>`;
      const v = $('.arv', sheet);
      const acts = api.gameActions(g);
      $('.arv-stick', v).after(acts);
      // the marquee: the picture the monitor already has, the hero over it when ready
      const art = $('.arv-art', v);
      const small = warmOf(lo.list);
      if (small) { const im = small.cloneNode(); im.className = 'arv-pic lo' + (lo.tall ? ' tall' : ''); art.append(im); }
      else if (lo.list.length) art.append(imgWithFallback(lo.list, 'arv-pic lo' + (lo.tall ? ' tall' : '')));
      if (g.images.hero && g.images.hero.length) {
        const big = warmOf(g.images.hero);
        if (big) { const im = big.cloneNode(); im.className = 'arv-pic hi on'; art.append(im); }
        else { const im = imgWithFallback(g.images.hero, 'arv-pic hi'); im.addEventListener('load', () => im.classList.toggle('on', true), { once: true }); art.append(im); }
      }
      if (g.images.logo && g.images.logo.length) {
        const box = $('.arv-logo', v);
        const im = imgWithFallback(g.images.logo, 'arv-logo-img', x => { x.remove(); box.classList.toggle('named', true); });
        box.prepend(im);
      } else $('.arv-logo', v).classList.toggle('named', true);
      const lbl = $('.arv-cart-lbl', v);
      const cartPic = first(g.images.header) || first(g.images.capsule);
      if (cartPic) lbl.style.backgroundImage = api.cssUrl(cartPic);

      // keys inside the screen: ← → (and ↑ ↓) walk the buttons, Enter presses (native), Esc closes (shelf.js)
      const keys = () => [...v.querySelectorAll('.rf-act, .arv-back')].filter(b => !b.disabled);
      v.addEventListener('keydown', e => {
        const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!dir) return;
        e.preventDefault();
        const list = keys(), at = list.indexOf(document.activeElement);
        const step = (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !api.LTR ? -dir : dir;
        const next = list[(at < 0 ? 0 : at + step + list.length) % list.length];
        if (next) { next.focus({ preventScroll: true }); api.sfx('tick'); }
      });
      const play = $('.rf-act.play', v);
      if (play) play.focus({ preventScroll: true });
      api.sfx('tick');

      // (played even with the OS "reduce motion" switch: a short transition the player starts, the theme's signature)
      if (!v.animate) return;
      // ── the entrance (≤ 600 ms): cartridge flies in and drops into the slot → the CRT powers on → the score rows draw
      const scr = $('.arv-scr', v), flash = $('.arv-flash', v), cart = $('.arv-cart', v), slot = $('.arv-slot', v);
      const anims = [];
      anims.push(v.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140 * SLOW, easing: 'steps(4, end)' }));
      anims.push(scr.animate([
        { transform: 'scale(.012, .006)', offset: 0 },
        { transform: 'scale(.012, .006)', offset: .4, easing: 'cubic-bezier(.4,0,.2,1)' },
        { transform: 'scale(1, .006)', offset: .6, easing: 'cubic-bezier(.3,.6,.3,1)' },
        { transform: 'scale(1, 1)', offset: .86, easing: 'ease-out' },
        { transform: 'none', offset: 1 },
      ], { duration: 560 * SLOW, fill: 'backwards' }));
      anims.push(flash.animate([{ opacity: 1 }, { opacity: 1, offset: .62 }, { opacity: 0 }], { duration: 560 * SLOW, easing: 'linear', fill: 'backwards' }));
      // the cartridge: from the row / key the player clicked to just above the slot, then down into it
      cart.style.display = 'block';
      const sr = slot.getBoundingClientRect(), vr = v.getBoundingClientRect(), cw = cart.offsetWidth, ch = cart.offsetHeight;
      const tx = sr.left + sr.width / 2 - cw / 2 - vr.left, ty = sr.top - ch - vr.top;
      let from = `translate(${tx}px, ${ty - 46}px) scale(.9)`;
      const fe = src && src.el && src.el.isConnected ? src.el.getBoundingClientRect() : null;
      if (fe && fe.width) {
        const s = Math.max(.22, Math.min(1, fe.height / ch * 1.6));
        from = `translate(${fe.left + fe.width / 2 - cw / 2 - vr.left}px, ${fe.top + fe.height / 2 - ch / 2 - vr.top}px) scale(${s})`;
      }
      cart.style.transform = `translate(${tx}px, ${ty}px)`;
      anims.push(cart.animate([
        { transform: from, clipPath: 'inset(0 0 0 0)', opacity: 1, offset: 0, easing: 'cubic-bezier(.2,.7,.3,1)' },
        { transform: `translate(${tx}px, ${ty}px)`, clipPath: 'inset(0 0 0 0)', opacity: 1, offset: .5, easing: 'cubic-bezier(.5,0,.8,.6)' },
        { transform: `translate(${tx}px, ${ty + ch}px)`, clipPath: `inset(0 0 ${ch}px 0)`, opacity: 1, offset: .92 },
        { transform: `translate(${tx}px, ${ty + ch}px)`, clipPath: `inset(0 0 ${ch}px 0)`, opacity: 0, offset: 1 },
      ], { duration: 340 * SLOW, fill: 'forwards' }));
      anims.push(slot.animate([{ boxShadow: 'inset 0 0 0 2px #000, 0 0 0 0 rgba(255,212,0,0)' }, { boxShadow: 'inset 0 0 0 2px #000, 0 0 14px 2px rgba(255,212,0,.85)', offset: .5 }, { boxShadow: 'inset 0 0 0 2px #000, 0 0 0 0 rgba(255,212,0,0)' }], { duration: 300 * SLOW, delay: 240 * SLOW }));
      // the score table draws itself row by row, the buttons last
      const seq = [...v.querySelectorAll('.arv-nline, .arv-tags, .arv-th, .arv-tr, .arv-press, .arv-story, .rf-act, .arv-hint')];
      seq.forEach((n, k) => anims.push(n.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
        { duration: 110 * SLOW, delay: (380 + Math.min(k, 12) * 18) * SLOW, easing: 'steps(3, end)', fill: 'backwards' })));
      await Promise.all(anims.map(a => a.finished.catch(() => null)));
      cart.style.display = 'none';
    },

    /** the CRT switches off: the picture collapses to a line, then a dot, and the cabinet fades (≤ 400 ms) */
    async close(sheet) {
      const v = $('.arv', sheet);
      if (!v || !v.animate) return;
      const scr = $('.arv-scr', v), flash = $('.arv-flash', v);
      api.sfx('tick');
      const a = [
        flash.animate([{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 1 }], { duration: 300 * SLOW, fill: 'forwards' }),
        scr.animate([
          { transform: 'none', easing: 'cubic-bezier(.6,0,.9,.5)' },
          { transform: 'scale(1, .006)', offset: .45, easing: 'cubic-bezier(.6,0,.9,.5)' },
          { transform: 'scale(.012, .006)', offset: .8 },
          { transform: 'scale(0, 0)' },
        ], { duration: 300 * SLOW, fill: 'forwards' }),
        v.animate([{ opacity: 1 }, { opacity: 1, offset: .6 }, { opacity: 0 }], { duration: 380 * SLOW, easing: 'steps(4, end)', fill: 'forwards' }),
      ];
      await Promise.all(a.map(x => x.finished.catch(() => null)));
    },
  };

  api.register('arcade', Layout);
})();
