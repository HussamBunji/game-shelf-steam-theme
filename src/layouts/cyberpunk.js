/* ═══ Cyberpunk (سايبربنك) — library home design ═══
   A netrunner HUD. Top: a wide angular "featured target" panel for the game you played last (its hero art, once,
   the logo or title, a strip of mono readouts — hours / last run / size / status — the brass JACK IN slab and a
   ghost DETAILS slab, HUD brackets, tick marks and a static reticle). Then the filter strip as one angular HUD bar,
   then every game as an angular "data shard" in two sections (ONLINE / INSTALLED, ARCHIVE) — all reachable by
   scrolling down, or with the arrow keys.
   Opening a game: a "dossier" panel (banner, title, command row, a grid of stat readouts, genres, briefing).
   Rules followed (docs/THEME-KIT.md): 4 elements per tile (the ID tag is a pseudo-element), one shared play button,
   art painted by api.lazy with the small header image, transforms only on the hovered / focused tile,
   no animation at rest, DOM writes only in render() and on input. */
(function () {
  'use strict';
  const api = window.__rfsLayoutApi;
  if (!api) return;
  const { T, esc, div, $, ic, cssUrl, first, lazy, fmtPlaytime, fmtAgo, fmtSize, NUM } = api;
  const LTR = api.LTR;
  const EASE = 'cubic-bezier(.2,.7,.2,1)';

  /** "N games" with natural plurals in both languages */
  const countGames = n => T(
    n === 1 ? 'لعبة وحدة' : n === 2 ? 'لعبتين' : n >= 3 && n <= 10 ? `${NUM.format(n)} ألعاب` : `${NUM.format(n)} لعبة`,
    `${NUM.format(n)} ${n === 1 ? 'game' : 'games'}`);
  const pad = (n, w) => String(n).padStart(w, '0');

  /** the small mono line under a tile */
  function subLine(g, run) {
    if (run) return T('شغّالة الحين', 'RUNNING');
    const t = g.playtimeMin ? fmtPlaytime(g.playtimeMin) : T('ما انلعبت', 'NO DATA');
    return g.installed ? t : `${t} · ${T('غير مثبتة', 'OFFLINE')}`;
  }

  /** one data shard: 4 elements (tile, art, title, line); the ID tag is .h::before, the play button is shared */
  function tileHTML(g, i, run) {
    return `<div class="cp-t${run ? ' running' : ''}${g.installed ? '' : ' ni'}" data-appid="${g.appid}" data-i="${i}"><div class="art"></div><div class="t" dir="auto" title="${esc(g.name)}">${esc(g.name)}</div><div class="h" data-n="${pad(i + 1, 4)}">${esc(subLine(g, run))}</div></div>`;
  }
  function paintTile(t, g) {
    const u = cssUrl(first(g.images.header) || first(g.images.capsule));
    if (t._img !== u) { t._img = u; t.style.setProperty('--img', u); }
  }

  /** a static reticle (no animation): rings, a crosshair with a gap and four ticks */
  const RETICLE = `<svg class="cp-ret" viewBox="0 0 120 120" aria-hidden="true" fill="none" stroke="currentColor">
    <circle cx="60" cy="60" r="44" stroke-width="1" stroke-dasharray="2 5"/>
    <circle cx="60" cy="60" r="30" stroke-width="1"/>
    <circle cx="60" cy="60" r="3" stroke-width="1.4"/>
    <path d="M60 4v18M60 98v18M4 60h18M98 60h18" stroke-width="1.4"/>
    <path d="M36 60h14M70 60h14M60 36v14M60 70v14" stroke-width="1" opacity=".7"/>
    <path d="M22 22l6 6M98 22l-6 6M22 98l6-6M98 98l-6-6" stroke-width="1"/>
  </svg>`;

  /** a mono readout: tiny label above, value below */
  const ro = (k, v, cls) => `<div class="cp-ro${cls ? ' ' + cls : ''}"><small>${esc(k)}</small><b dir="auto">${esc(v)}</b></div>`;

  /** achievements as a HUD readout: TROPHIES · 12/50 · 24% over a segmented meter (filled in by paintHero) */
  function achRo(g) {
    const a = api.gameAch ? api.gameAch(g) : null;
    if (!a) return '';
    const label = T(`الإنجازات: ${NUM.format(a.got)} من ${NUM.format(a.total)} (${a.pct}%)`, `Achievements: ${NUM.format(a.got)} of ${NUM.format(a.total)} (${a.pct}%)`);
    return `<div class="cp-ro cp-ach${a.got >= a.total ? ' done' : ''}" data-k="${a.got}/${a.total}" title="${esc(label)}"><small>${esc(T('الإنجازات', 'TROPHIES'))}</small>`
      + `<b dir="ltr">${NUM.format(a.got)}<span>/${NUM.format(a.total)}</span> <em>${a.pct}%</em></b><i class="cp-meter"><i style="width:${a.pct}%"></i></i></div>`;
  }
  /** the dossier's achievements plate: the fact text plus the same segmented meter */
  function achCell(g, idx) {
    const a = api.gameAch ? api.gameAch(g) : null;
    if (!a) return '';
    const v = T(`${NUM.format(a.got)} من ${NUM.format(a.total)} (${a.pct}%)`, `${NUM.format(a.got)} / ${NUM.format(a.total)} (${a.pct}%)`);
    return `<div class="cp-stat ach${a.got >= a.total ? ' done' : ''}"><small><i>${pad(idx, 2)}</i>${esc(T('الإنجازات', 'Achievements'))}</small><b dir="auto" title="${esc(v)}">${esc(v)}</b><i class="cp-meter"><i style="width:${a.pct}%"></i></i></div>`;
  }
  /** the featured target panel */
  function heroHTML(g, run) {
    const status = run ? ['st-run', T('شغّالة', 'RUNNING')] : g.installed ? ['st-ok', T('مثبتة', 'INSTALLED')] : ['st-off', T('غير مثبتة', 'NOT INSTALLED')];
    const strip = [
      ro(T('الساعات', 'HOURS'), g.playtimeMin ? fmtPlaytime(g.playtimeMin) : '—'),
      ro(T('آخر تشغيل', 'LAST RUN'), g.lastPlayed ? fmtAgo(g.lastPlayed) : '—'),
      ro(T('الحجم', 'SIZE'), g.installed && g.sizeOnDisk ? fmtSize(g.sizeOnDisk) : '—'),
      achRo(g),
      ro(T('الحالة', 'STATUS'), status[1], status[0]),
    ].join('');
    const kick = run ? T('الهدف شغّال الحين', 'TARGET ACTIVE') : g.lastPlayed ? T('آخر هدف', 'FEATURED TARGET') : T('من مكتبتك', 'FROM YOUR LIBRARY');
    const play = run ? ic('pulse') + esc(T('شغّالة', 'RUNNING'))
      : !g.installed ? ic('download') + esc(T('تثبيت', 'INSTALL'))
      : ic('play') + esc(T('تشغيل', 'JACK IN'));
    return `<section class="cp-hero${run ? ' running' : ''}" data-appid="${g.appid}">
      <div class="cp-hero-art" data-act="open"></div>
      <div class="cp-hud" aria-hidden="true">
        <span class="cp-tag">SYS://TGT.LOCK</span>
        <span class="cp-coord">ID ${esc(String(g.appid))}</span>
        ${RETICLE}
      </div>
      <div class="cp-hero-in">
        <span class="cp-kick">${esc(kick)}</span>
        <div class="cp-hero-logo"><h2 dir="auto">${esc(g.name)}</h2></div>
        <div class="cp-strip">${strip}</div>
        <div class="cp-btns">
          <button class="cp-btn amber" type="button" data-act="play">${play}</button>
          <button class="cp-btn ghost" type="button" data-act="open">${ic('info')}${esc(T('التفاصيل', 'DETAILS'))}</button>
        </div>
      </div>
    </section>`;
  }
  function paintHero(hero, g) {
    // achievements: exact once the details arrive — swap only that readout, and only if the numbers changed
    const A = api.gameAch ? api.gameAch(g) : null, key = A ? `${A.got}/${A.total}` : '';
    const cur = $('.cp-ach', hero);
    if (key !== (cur ? cur.dataset.k : '')) {
      const h = achRo(g);
      if (cur) { if (h) cur.outerHTML = h; else cur.remove(); }
      else if (h) { const st = $('.cp-strip > .cp-ro:last-child', hero); if (st) st.insertAdjacentHTML('beforebegin', h); }
    }
    const big = first(g.images.hero) || first(g.images.header); // the page's one big image
    const art = $('.cp-hero-art', hero);
    if (big && art && hero._bg !== big) { hero._bg = big; art.style.backgroundImage = cssUrl(big); }
    const slot = $('.cp-hero-logo', hero);
    if (slot && g.images.logo && g.images.logo.length && !hero._logo) {
      hero._logo = true;
      const im = api.imgWithFallback(g.images.logo, 'cp-logo', x => { x.remove(); slot.classList.toggle('has-logo', false); });
      im.alt = g.name;
      slot.prepend(im);
      slot.classList.toggle('has-logo', true);
    }
  }

  /** a HUD section header: index, title, count, a ruled line with ticks */
  const headHTML = (n, title, count) => `<header class="cp-sec-h"><span class="cp-idx">${pad(n, 2)}</span><h3>${esc(title)}</h3><span class="cp-cnt">${esc(count)}</span></header>`;
  function sectionHTML(key, n, title, list, start, running) {
    const tiles = list.map((g, k) => tileHTML(g, start + k, running.has(g.appid))).join('');
    return `<section class="cp-sec" data-sec="${key}">${headHTML(n, title, countGames(list.length))}<div class="cp-grid">${tiles}</div></section>`;
  }

  /** a tile's on-screen rect, if visible (the dossier grows from it) */
  function onScreen(src) {
    if (!src || !src.el || !src.el.isConnected) return null;
    const r = src.el.getBoundingClientRect();
    return r.width > 4 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth ? r : null;
  }

  const Layout = {
    fixedHeight: false,
    dockInside: true,
    games: [], items: [], secs: [], grid: null,
    cur: -1, curId: '', kf: null, hov: null, pl: null, srcKind: '',

    render(games, w) {
      this.games = []; this.hov = null;
      const keepRing = !!this.kf;
      this.kf = null;
      const running = api.running();
      const all = api.state.games || [];
      const filtered = !!(api.state.query || api.state.genre);

      // the featured target: the running game, else the one played last
      let heroG = null;
      for (const g of all) {
        const r = running.has(g.appid), hr = !!heroG && running.has(heroG.appid);
        if (!heroG || (r && !hr) || (r === hr && (g.lastPlayed || 0) > (heroG.lastPlayed || 0))) heroG = g;
      }

      // the two sections keep the strip's sort order
      const here = [], rest = [];
      for (const g of games) (g.installed ? here : rest).push(g);
      this.games = here.concat(rest);

      const el = div('cp' + (w < 980 ? ' narrow' : '') + (w < 720 ? ' tiny' : ''));
      let html = '<div class="cp-in">';
      html += heroG ? heroHTML(heroG, running.has(heroG.appid)) : '';
      html += '<div class="rf-dock" data-rfs-dock></div>';
      html += '<div class="cp-lib">';
      const secs = [];
      if (!games.length) {
        html += `<div class="rf-empty"><b>${esc(filtered ? T('ما في نتائج', 'NO MATCH') : T('المكتبة فاضية', 'NO DATA'))}</b><span>${esc(filtered ? T('جرّب كلمة ثانية أو شيل الفلتر', 'Try a different search or clear the filter') : T('ما في ألعاب هنا', 'No games here'))}</span></div>`;
      } else {
        let n = 0;
        if (here.length) { html += sectionHTML('here', ++n, T('متصلة / مثبتة', 'ONLINE / INSTALLED'), here, 0, running); secs.push({ start: 0, len: here.length }); }
        if (rest.length) { html += sectionHTML('lib', ++n, T('الأرشيف', 'ARCHIVE'), rest, here.length, running); secs.push({ start: here.length, len: rest.length }); }
      }
      html += '</div></div>';
      el.innerHTML = html;

      const lib = $('.cp-lib', el);
      this.secs = secs;
      this.grid = $('.cp-grid', lib);
      this.items = Array.from(lib.getElementsByClassName('cp-t'));
      for (const t of this.items) lazy(t, g => paintTile(t, g));

      // ONE play button for every tile: it moves to the tile under the mouse / the keyboard ring
      const pl = document.createElement('button');
      pl.type = 'button'; pl.className = 'pl'; pl.tabIndex = -1;
      this.pl = pl;

      // keep the keyboard place across re-renders (search, sort, a game starting)
      this.cur = -1;
      if (this.curId) {
        const i = this.games.findIndex(g => String(g.appid) === this.curId);
        if (i >= 0) {
          this.cur = i;
          if (keepRing) { this.kf = this.items[i]; this.kf.classList.toggle('kf', true); this.attachPlay(this.kf); }
        }
      }

      if (heroG) {
        const hero = $('.cp-hero', el);
        paintHero(hero, heroG);
        if (!heroG.detailed && api.Data && api.Data.ensureDetails) api.Data.ensureDetails(heroG).then(g => { if (hero.isConnected) paintHero(hero, g || heroG); });
        hero.addEventListener('click', e => {
          const b = e.target.closest('[data-act]');
          if (!b) return;
          if (b.dataset.act === 'play') { api.launch(heroG); return; }
          this.srcKind = 'hero';
          api.openGame(heroG, this.source(heroG.appid));
        });
      }

      el.addEventListener('pointerover', e => {
        const t = e.target.closest('.cp-t');
        if (t === this.hov) return;
        this.hov = t;
        if (t) this.attachPlay(t);
      });
      el.addEventListener('pointerleave', () => { this.hov = null; });
      el.addEventListener('click', e => this.onClick(e));

      api.stage.replaceChildren(el);
    },

    /** a click opens the game at once; only the small brass button on the art plays */
    onClick(e) {
      const t = e.target.closest('.cp-t');
      if (!t) return;
      const g = api.byId(t.dataset.appid);
      if (!g) return;
      if (e.detail > 1) return;                       // the rest of a double-click: already handled
      if (e.target.closest('.pl')) { api.launch(g); return; }
      this.srcKind = '';
      if (this.kf && this.kf !== t) { this.kf.classList.toggle('kf', false); this.kf = null; }
      this.cur = +t.dataset.i; this.curId = t.dataset.appid;
      api.openGame(g, this.source(g.appid));
    },

    /** the element the dossier grows from */
    source(appid) {
      const id = String(appid);
      const pick = el => (el ? { el, slot: el.parentElement, isSpine: false } : null);
      if (this.srcKind === 'hero') { const h = api.stage.querySelector(`.cp-hero[data-appid="${id}"] .cp-hero-art`); if (h) return pick(h); }
      return pick(api.stage.querySelector(`.cp-t[data-appid="${id}"] .art`))
        || pick(api.stage.querySelector(`.cp-hero[data-appid="${id}"] .cp-hero-art`));
    },

    /** arrows move the focus ring (reading direction follows the language), Enter opens, Space / Ctrl+Enter plays */
    key(e) {
      const n = this.items.length;
      if (!n || e.altKey || e.metaKey) return false;
      const k = e.key;
      if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
        const g = this.kf && this.games[this.cur];
        if (!g) return false;
        if (k !== 'Enter' || e.ctrlKey) api.launch(g);
        else { this.srcKind = ''; api.openGame(g, this.source(g.appid)); }
        return true;
      }
      if (e.ctrlKey) return false;
      const fwd = LTR ? 'ArrowRight' : 'ArrowLeft', back = LTR ? 'ArrowLeft' : 'ArrowRight';
      if (k !== fwd && k !== back && k !== 'ArrowUp' && k !== 'ArrowDown') return false;
      let i;
      if (!this.kf) i = this.cur >= 0 && this.visible(this.items[this.cur]) ? this.cur : this.firstVisible(); // first press: show the ring
      else if (k === fwd) i = this.cur + 1;
      else if (k === back) i = this.cur - 1;
      else {
        i = this.vert(k === 'ArrowDown' ? 1 : -1);
        if (i < 0) { // already on the top row: bring the featured target back into view
          const top = api.stage.querySelector('.cp-hero');
          if (top) top.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          return true;
        }
      }
      this.focus(Math.max(0, Math.min(n - 1, i)));
      return true;
    },
    focus(i) {
      const t = this.items[i];
      if (!t) return;
      if (this.kf !== t) {
        if (this.kf) this.kf.classList.toggle('kf', false);
        t.classList.toggle('kf', true);
        this.kf = t;
        api.sfx('tick');
      }
      this.cur = i; this.curId = t.dataset.appid;
      this.attachPlay(t);
      t.scrollIntoView({ block: 'nearest' });
    },
    /** up / down: the tile in the same column one row away, across the two sections; -1 = above the first row */
    vert(dir) {
      const cols = this.cols(), i = this.cur;
      const s = this.secs.findIndex(x => i >= x.start && i < x.start + x.len);
      if (s < 0) return i;
      const sec = this.secs[s], pos = i - sec.start, col = pos % cols;
      if (dir > 0) {
        if (pos + cols < sec.len) return i + cols;
        const lastRow = Math.floor((sec.len - 1) / cols);
        if (Math.floor(pos / cols) < lastRow) return sec.start + sec.len - 1;    // a short last row
        const nx = this.secs[s + 1];
        return nx ? nx.start + Math.min(col, nx.len - 1) : i;
      }
      if (pos - cols >= 0) return i - cols;
      const pv = this.secs[s - 1];
      if (!pv) return -1;
      const rows = Math.ceil(pv.len / cols);
      return pv.start + Math.min((rows - 1) * cols + col, pv.len - 1);
    },
    cols() {
      const s = this.grid ? getComputedStyle(this.grid).gridTemplateColumns : '';
      return Math.max(1, s.split(' ').filter(Boolean).length);
    },
    visible(t) {
      if (!t) return false;
      const r = t.getBoundingClientRect();
      return r.bottom > 90 && r.top < window.innerHeight;
    },
    firstVisible() {
      const H = window.innerHeight;
      for (let i = 0; i < this.items.length; i++) {
        const r = this.items[i].getBoundingClientRect();
        if (r.bottom > 90 && r.top < H) return i;
        if (r.top >= H) break;
      }
      return 0;
    },
    attachPlay(t) {
      const pl = this.pl, art = t && t.firstElementChild;
      if (!pl || !art) return;
      if (pl.parentElement !== art) art.appendChild(pl);
      const g = api.byId(t.dataset.appid);
      const mode = g && !g.installed ? 'download' : 'play';
      if (pl.dataset.m !== mode) {
        pl.dataset.m = mode;
        pl.innerHTML = ic(mode);
        pl.title = mode === 'play' ? T('تشغيل', 'Play') : T('تثبيت', 'Install');
        pl.setAttribute('aria-label', pl.title);
      }
    },

    /** the dossier: an angular card that loads in like a data readout (≤ 400 ms) */
    async open(g, sheet, src) {
      const run = api.running().has(g.appid);
      const facts = api.gameFacts(g);
      const desc = api.gameDesc(g);
      const genres = (g.genres || []).slice(0, 6);
      const kick = run ? T('شغّالة الحين', 'RUNNING NOW') : g.installed ? T('متصلة / مثبتة', 'ONLINE / INSTALLED') : T('الأرشيف', 'ARCHIVE');
      const ACH = T('الإنجازات', 'Achievements');
      const cells = facts.map(([k, v], i) => k === ACH ? achCell(g, i + 1) : `<div class="cp-stat"><small><i>${pad(i + 1, 2)}</i>${esc(k)}</small><b dir="auto" title="${esc(v)}">${esc(v)}</b></div>`).join('');
      const tags = genres.map(x => `<span class="cp-chip" dir="auto">${esc(x)}</span>`).join('');
      const lbl = (n, text) => `<h4 class="cp-label"><i>${pad(n, 2)}</i>${esc(text)}</h4>`;
      let n = 0;
      sheet.innerHTML = `<div class="cp-dim"></div>
        <div class="cp-wrap">
          <div class="cp-card${run ? ' running' : ''}" tabindex="-1" role="dialog" aria-label="${esc(g.name)}">
            <div class="cp-scroll">
              <div class="cp-ban">
                <div class="cp-ban-art"></div>
                <span class="cp-ban-tag" aria-hidden="true">${esc(T('ملف', 'DOSSIER'))} // ID ${esc(String(g.appid))}</span>
                <div class="cp-ban-in">
                  <span class="cp-kick">${esc(kick)}</span>
                  <div class="cp-ban-logo"><h2 dir="auto">${esc(g.name)}</h2></div>
                </div>
              </div>
              <div class="cp-body">
                <div class="cp-acts-slot"></div>
                ${lbl(++n, T('البيانات', 'DATA'))}
                <div class="cp-stats">${cells}</div>
                ${tags ? `${lbl(++n, T('التصنيف', 'GENRES'))}<div class="cp-chips">${tags}</div>` : ''}
                ${desc ? `${lbl(++n, T('عن اللعبة', 'BRIEFING'))}<p class="cp-desc" dir="auto">${esc(desc)}</p>` : ''}
              </div>
            </div>
            <button class="cp-x" type="button" data-close title="${esc(T('إغلاق (Esc)', 'Close (Esc)'))}" aria-label="${esc(T('إغلاق', 'Close'))}">${ic('x')}</button>
          </div>
        </div>`;
      const card = $('.cp-card', sheet);
      $('.cp-acts-slot', card).replaceWith(api.gameActions(g));
      // details still on the way: add / correct the achievements plate when they land (this dossier only)
      if (!g.detailed && api.Data && api.Data.ensureDetails) api.Data.ensureDetails(g).then(() => {
        if (!card.isConnected) return;
        const old = $('.cp-stat.ach', card), box = $('.cp-stats', card);
        if (old) { const h = achCell(g, +old.querySelector('small i').textContent || 3); if (h) old.outerHTML = h; }
        else if (box) { const h = achCell(g, box.children.length + 1); if (h) box.insertAdjacentHTML('beforeend', h); }
      });
      const art = $('.cp-ban-art', card);
      const big = first(g.images.hero) || first(g.images.header);
      if (big) art.style.backgroundImage = cssUrl(big);
      if (g.images.logo && g.images.logo.length) {
        const slot = $('.cp-ban-logo', card);
        const im = api.imgWithFallback(g.images.logo, 'cp-logo', x => { x.remove(); slot.classList.toggle('has-logo', false); });
        im.alt = g.name;
        slot.prepend(im);
        slot.classList.toggle('has-logo', true);
      }

      // grow from the tile it came from; the content then "loads" top-down
      const from = onScreen(src);
      if (from) {
        const r = card.getBoundingClientRect();
        card.style.transformOrigin = `${(from.left + from.width / 2 - r.left).toFixed(0)}px ${(from.top + from.height / 2 - r.top).toFixed(0)}px`;
      }
      api.sfx('slide');
      const dim = $('.cp-dim', sheet), scroll = $('.cp-scroll', card);
      await Promise.all([
        dim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' }),
        card.animate([
          { opacity: 0, transform: 'translateY(10px) scale(.965)' },
          { opacity: 1, transform: 'none' },
        ], { duration: 280, easing: EASE, fill: 'backwards' }),
        scroll.animate([
          { clipPath: 'inset(0 0 100% 0)' },
          { clipPath: 'inset(0 0 0% 0)' },
        ], { duration: 340, delay: 40, easing: 'cubic-bezier(.3,.6,.2,1)', fill: 'backwards' }),
      ].map(a => a.finished.catch(() => null)));
      if (card.isConnected) { card.classList.toggle('ready', true); card.focus({ preventScroll: true }); }
    },

    /** the card drops back and fades (≤ 250 ms) */
    async close(sheet) {
      const card = $('.cp-card', sheet), dim = $('.cp-dim', sheet);
      if (!card) return;
      card.classList.toggle('ready', false);
      api.sfx('close');
      const f = { fill: 'forwards' };
      await Promise.all([
        card.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(6px) scale(.975)' }], { duration: 190, easing: 'cubic-bezier(.4,0,.6,1)', ...f }),
        dim ? dim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-in', ...f }) : null,
      ].filter(Boolean).map(a => a.finished.catch(() => null)));
    },
  };

  api.register('cyberpunk', Layout);
})();
