/* ═══ Cupertino Dark (كوبرتينو الداكن) — library home design ═══
   A desktop "Games" tab in dark mode with liquid-glass materials on the few singular surfaces.
   Top: a cinematic hero banner for the game you played last (its hero art, once, with a slow Ken Burns drift),
   a large logo, metadata chips and the white Play pill + glass pills on a small glass plate. Then the floating
   filter strip (a glass capsule), a Recently Played row of large lockups with round glass arrows, and every game
   as a 16:9 lockup in two sections (On This PC, In Your Library) — all reachable by scrolling down.
   Opening a game: a product-page sheet (banner + logo, pills, a stat strip of big numbers, a grouped inset list).
   Rules followed (docs/THEME-KIT.md): 4 elements per tile, one shared play button, art painted by api.lazy with
   the small header image, transforms only on the hovered / focused tile, DOM writes only in render() and on input. */
(function () {
  'use strict';
  const api = window.__rfsLayoutApi;
  if (!api) return;
  const { T, esc, div, $, ic, cssUrl, first, lazy, fmtPlaytime, fmtAgo, fmtSize, NUM } = api;
  const LTR = api.LTR;
  const RECENT_MAX = 12;
  const EASE = 'cubic-bezier(.2,.8,.2,1)';

  /** "N games" with natural plurals in both languages */
  const countGames = n => T(
    n === 1 ? 'لعبة وحدة' : n === 2 ? 'لعبتين' : n >= 3 && n <= 10 ? `${NUM.format(n)} ألعاب` : `${NUM.format(n)} لعبة`,
    `${NUM.format(n)} ${n === 1 ? 'game' : 'games'}`);

  /** the small secondary line under a tile */
  function subLine(g, run) {
    if (run) return T('شغّالة الحين', 'Running now');
    if (!g.installed) return g.playtimeMin ? `${fmtPlaytime(g.playtimeMin)} · ${T('غير مثبتة', 'Not installed')}` : T('غير مثبتة', 'Not installed');
    return g.playtimeMin ? fmtPlaytime(g.playtimeMin) : T('ما انلعبت', 'Never played');
  }

  /** one lockup: 4 elements (tile, art, title, line); the sheen is .art::after, the play button is shared */
  function tileHTML(g, i, run, extra) {
    return `<div class="cu-t${extra || ''}${run ? ' running' : ''}${g.installed ? '' : ' ni'}" data-appid="${g.appid}"${i >= 0 ? ` data-i="${i}"` : ''}><div class="art"></div><div class="t" dir="auto" title="${esc(g.name)}">${esc(g.name)}</div><div class="h">${esc(subLine(g, run))}</div></div>`;
  }
  function paintTile(t, g) {
    const u = cssUrl(first(g.images.header) || first(g.images.capsule));
    if (t._img !== u) { t._img = u; t.style.setProperty('--img', u); }
  }

  const chip = (icon, text, cls) => `<span class="cu-chip${cls ? ' ' + cls : ''}">${icon ? ic(icon) : ''}<bdi>${esc(text)}</bdi></span>`;

  /** achievements as an Apple-style chip: a thin progress ring, "12/50" and the % (filled in by paintHero) */
  function achChip(g) {
    const a = api.gameAch ? api.gameAch(g) : null;
    if (!a) return '';
    const done = a.got >= a.total;
    const label = T(`الإنجازات: ${NUM.format(a.got)} من ${NUM.format(a.total)} (${a.pct}%)`, `Achievements: ${NUM.format(a.got)} of ${NUM.format(a.total)} (${a.pct}%)`);
    return `<span class="cu-chip cu-achc${done ? ' done' : ''}" data-k="${a.got}/${a.total}" title="${esc(label)}" aria-label="${esc(label)}"><i class="cu-ring" style="--p:${a.pct}"></i>`
      + `<bdi>${NUM.format(a.got)}<small>/${NUM.format(a.total)}</small></bdi><em>${a.pct}%</em></span>`;
  }
  /** achievements in the sheet's stat strip: big "12/50", a hairline bar, caption with the % */
  function achStat(g) {
    const a = api.gameAch ? api.gameAch(g) : null;
    if (!a) return '';
    return `<div class="cu-stat ach${a.got >= a.total ? ' done' : ''}"><b dir="ltr">${NUM.format(a.got)}<span>/${NUM.format(a.total)}</span></b>`
      + `<i class="cu-bar"><i style="width:${Math.max(a.pct, a.got ? 2 : 0)}%"></i></i><small>${esc(T('الإنجازات', 'Achievements'))} · <bdi dir="ltr">${a.pct}%</bdi></small></div>`;
  }
  /** the hero banner */
  function heroHTML(g, run) {
    const kick = run ? T('شغّالة الحين', 'Now running') : g.lastPlayed ? T('كمّل من وين وقفت', 'Continue playing') : T('من مكتبتك', 'From your library');
    const chips = [
      run ? chip('pulse', T('شغّالة', 'Running'), 'on') : g.installed ? chip('check', T('مثبتة', 'Installed')) : chip('download', T('غير مثبتة', 'Not installed')),
      g.playtimeMin ? chip('clock', fmtPlaytime(g.playtimeMin)) : '',
      g.lastPlayed ? chip('calendar', fmtAgo(g.lastPlayed)) : '',
      achChip(g),
      (g.genres || []).length ? chip('', g.genres[0], 'cu-genre') : '',
    ].join('');
    const play = run ? ic('pulse') + esc(T('شغّالة', 'Running'))
      : !g.installed ? ic('download') + esc(T('ثبّت', 'Install'))
      : g.playtimeMin ? ic('play') + esc(T('كمّل', 'Resume')) : ic('play') + esc(T('شغّل', 'Play'));
    return `<section class="cu-hero${run ? ' running' : ''}" data-appid="${g.appid}">
      <div class="cu-hero-art" data-act="open"></div>
      <div class="cu-hero-in">
        <span class="cu-eyebrow">${esc(kick)}</span>
        <div class="cu-hero-logo"><h2 dir="auto">${esc(g.name)}</h2></div>
        <div class="cu-chips">${chips}</div>
        <div class="cu-plate">
          <button class="cu-pill white" type="button" data-act="play">${play}</button>
          <button class="cu-pill glass" type="button" data-act="open">${ic('info')}${esc(T('التفاصيل', 'Details'))}</button>
        </div>
      </div>
    </section>`;
  }
  function paintHero(hero, g) {
    // achievements: exact once the details arrive — swap only the chip, and only if the numbers changed
    const A = api.gameAch ? api.gameAch(g) : null, key = A ? `${A.got}/${A.total}` : '';
    const cur = $('.cu-achc', hero);
    if (key !== (cur ? cur.dataset.k : '')) {
      const ah = achChip(g);
      if (cur) { if (ah) cur.outerHTML = ah; else cur.remove(); }
      else if (ah) { const gen = $('.cu-chips > .cu-genre', hero); if (gen) gen.insertAdjacentHTML('beforebegin', ah); else { const c = $('.cu-chips', hero); if (c) c.insertAdjacentHTML('beforeend', ah); } }
    }
    const big = first(g.images.hero) || first(g.images.header); // the page's one big image
    const art = $('.cu-hero-art', hero);
    if (big && art && hero._bg !== big) { hero._bg = big; art.style.backgroundImage = cssUrl(big); }
    const slot = $('.cu-hero-logo', hero);
    if (slot && g.images.logo && g.images.logo.length && !hero._logo) {
      hero._logo = true;
      const im = api.imgWithFallback(g.images.logo, 'cu-logo', x => { x.remove(); slot.classList.toggle('has-logo', false); });
      im.alt = g.name;
      slot.prepend(im);
      slot.classList.toggle('has-logo', true);
    }
  }

  /** a section header: large title, trailing count in the link colour */
  const headHTML = (title, trail) => `<header class="cu-sec-h"><h3>${esc(title)}</h3>${trail ? `<span class="cu-trail">${esc(trail)}</span>` : ''}</header>`;
  function sectionHTML(key, title, list, start, running) {
    const tiles = list.map((g, k) => tileHTML(g, start + k, running.has(g.appid))).join('');
    return `<section class="cu-sec" data-sec="${key}">${headHTML(title, countGames(list.length))}<div class="cu-grid">${tiles}</div></section>`;
  }

  /** a tile's on-screen rect, if visible (the sheet grows from it) */
  function onScreen(src) {
    if (!src || !src.el || !src.el.isConnected) return null;
    const r = src.el.getBoundingClientRect();
    return r.width > 4 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth ? r : null;
  }

  const Layout = {
    fixedHeight: false,
    dockInside: true,
    games: [], items: [], secs: [], grid: null, row: null,
    cur: -1, curId: '', kf: null, hov: null, pl: null, srcKind: '',

    render(games, w) {
      this.games = []; this.hov = null;
      const keepRing = !!this.kf;
      this.kf = null;
      const running = api.running();
      const all = api.state.games || [];
      const filtered = !!(api.state.query || api.state.genre);

      // the hero: the running game, else the one played last
      let heroG = null;
      for (const g of all) {
        const r = running.has(g.appid), hr = !!heroG && running.has(heroG.appid);
        if (!heroG || (r && !hr) || (r === hr && (g.lastPlayed || 0) > (heroG.lastPlayed || 0))) heroG = g;
      }
      // the row: up to 12 played games, newest first (the hero's game is already above); hidden while filtering
      const recent = filtered ? [] : all.filter(g => g.lastPlayed && g !== heroG)
        .sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0)).slice(0, RECENT_MAX);

      // the two sections keep the strip's sort order
      const here = [], rest = [];
      for (const g of games) (g.installed ? here : rest).push(g);
      this.games = here.concat(rest);

      const el = div('cu' + (w < 980 ? ' narrow' : '') + (w < 720 ? ' tiny' : ''));
      const prevL = T('السابق', 'Previous'), nextL = T('التالي', 'Next');
      let html = '<div class="cu-in">';
      html += heroG ? heroHTML(heroG, running.has(heroG.appid)) : '';
      html += '<div class="rf-dock" data-rfs-dock></div>';
      if (recent.length) {
        html += `<section class="cu-recent">
          ${headHTML(T('لعبتها مؤخرًا', 'Recently Played'), countGames(recent.length))}
          <div class="cu-rowwrap">
            <button class="cu-arrow l" type="button" data-scroll="-1" tabindex="-1" title="${esc(LTR ? prevL : nextL)}" aria-label="${esc(LTR ? prevL : nextL)}">${ic('chevL')}</button>
            <div class="cu-row">${recent.map(g => tileHTML(g, -1, running.has(g.appid), ' cu-r')).join('')}</div>
            <button class="cu-arrow r" type="button" data-scroll="1" tabindex="-1" title="${esc(LTR ? nextL : prevL)}" aria-label="${esc(LTR ? nextL : prevL)}">${ic('chevR')}</button>
          </div>
        </section>`;
      }
      html += '<div class="cu-lib">';
      const secs = [];
      if (!games.length) {
        html += `<div class="rf-empty"><b>${esc(filtered ? T('ما في نتائج', 'No Results') : T('المكتبة فاضية', 'No Games'))}</b><span>${esc(filtered ? T('جرّب كلمة ثانية أو شيل الفلتر', 'Try a different search or clear the filter') : T('ما في ألعاب هنا', 'No games here'))}</span></div>`;
      } else {
        if (here.length) { html += sectionHTML('here', T('على هذا الجهاز', 'On This PC'), here, 0, running); secs.push({ start: 0, len: here.length }); }
        if (rest.length) { html += sectionHTML('lib', T('في مكتبتك', 'In Your Library'), rest, here.length, running); secs.push({ start: here.length, len: rest.length }); }
      }
      html += '</div></div>';
      el.innerHTML = html;

      const lib = $('.cu-lib', el);
      this.secs = secs;
      this.grid = $('.cu-grid', lib);
      this.items = Array.from(lib.getElementsByClassName('cu-t'));
      this.row = $('.cu-row', el);
      for (const t of el.getElementsByClassName('cu-t')) lazy(t, g => paintTile(t, g));

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
        const hero = $('.cu-hero', el);
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

      if (this.row) {
        const wrap = this.row.parentElement;
        wrap.addEventListener('click', e => {
          const a = e.target.closest('.cu-arrow');
          if (!a) return;
          e.stopPropagation();
          // visual direction: the left arrow always moves the row to the left, in both languages
          this.row.scrollBy({ left: +a.dataset.scroll * Math.max(300, this.row.clientWidth * 0.8), behavior: 'smooth' });
          api.sfx('tick');
        });
        let raf = 0;
        this.row.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; this.arrows(); }); }, { passive: true });
      }

      el.addEventListener('pointerover', e => {
        const t = e.target.closest('.cu-t');
        if (t === this.hov) return;
        this.hov = t;
        if (t) this.attachPlay(t);
      });
      el.addEventListener('pointerleave', () => { this.hov = null; });
      el.addEventListener('click', e => this.onClick(e));

      api.stage.replaceChildren(el);
      this.arrows();
    },

    /** the row's arrows only show where there is more to see (scrollLeft runs negative in right-to-left rows) */
    arrows() {
      const r = this.row;
      if (!r || !r.isConnected) return;
      const max = r.scrollWidth - r.clientWidth, x = r.scrollLeft, rtl = getComputedStyle(r).direction === 'rtl';
      const lo = rtl ? -max : 0, hi = rtl ? 0 : max;
      const wrap = r.parentElement;
      wrap.classList.toggle('can-l', x > lo + 2);
      wrap.classList.toggle('can-r', x < hi - 2);
    },

    /** a click opens the game at once; only the round button on the tile plays */
    onClick(e) {
      const t = e.target.closest('.cu-t');
      if (!t) return;
      const g = api.byId(t.dataset.appid);
      if (!g) return;
      if (e.detail > 1) return;                       // the rest of a double-click: already handled
      if (e.target.closest('.pl')) { api.launch(g); return; }
      if (t.classList.contains('cu-r')) this.srcKind = 'recent';
      else {
        this.srcKind = '';
        if (this.kf && this.kf !== t) { this.kf.classList.toggle('kf', false); this.kf = null; }
        this.cur = +t.dataset.i; this.curId = t.dataset.appid;
      }
      api.openGame(g, this.source(g.appid));
    },

    /** the tile art the sheet grows from (and shrinks back to) */
    source(appid) {
      const id = String(appid);
      const pick = el => (el ? { el, slot: el.parentElement, isSpine: false } : null);
      if (this.srcKind === 'hero') { const h = api.stage.querySelector(`.cu-hero[data-appid="${id}"] .cu-hero-art`); if (h) return pick(h); }
      if (this.srcKind === 'recent') { const r = api.stage.querySelector(`.cu-r[data-appid="${id}"] .art`); if (r) return pick(r); }
      return pick(api.stage.querySelector(`.cu-lib .cu-t[data-appid="${id}"] .art`))
        || pick(api.stage.querySelector(`.cu-t[data-appid="${id}"] .art`))
        || pick(api.stage.querySelector(`.cu-hero[data-appid="${id}"] .cu-hero-art`));
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
        if (i < 0) { // already on the top row: bring the hero and the row back into view
          const top = api.stage.querySelector('.cu-recent') || api.stage.querySelector('.cu-hero');
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
        pl.title = mode === 'play' ? T('شغّل', 'Play') : T('ثبّت', 'Install');
        pl.setAttribute('aria-label', pl.title);
      }
    },

    /** the sheet: a product page in a card that springs in (≤ 400 ms) */
    async open(g, sheet, src) {
      const run = api.running().has(g.appid);
      const facts = api.gameFacts(g);
      const desc = api.gameDesc(g);
      const genres = (g.genres || []).slice(0, 4);
      const eyebrow = run ? T('شغّالة الحين', 'Running now') : g.installed ? T('على هذا الجهاز', 'On this PC') : T('في مكتبتك', 'In your library');
      // the stat strip: big numbers with a small caption
      const stats = [
        [g.playtimeMin ? fmtPlaytime(g.playtimeMin) : '0', T('وقت اللعب', 'Play time')],
        [g.lastPlayed ? fmtAgo(g.lastPlayed) : '—', T('آخر مرة', 'Last played')],
        g.playtime2wksMin ? [fmtPlaytime(g.playtime2wksMin), T('آخر أسبوعين', 'Past 2 weeks')] : null,
        [g.installed && g.sizeOnDisk ? fmtSize(g.sizeOnDisk) : (g.needBytes ? fmtSize(g.needBytes) : T('غير مثبتة', 'Not installed')), g.installed ? T('الحجم', 'Size') : T('حجم التحميل', 'Download size')],
      ].filter(Boolean);
      const statHTML = stats.map(([v, k]) => `<div class="cu-stat"><b dir="auto">${esc(v)}</b><small>${esc(k)}</small></div>`).join('') + achStat(g);
      // the grouped list: developer + release (the last two facts; time and size are in the stat strip), genres
      const rowsData = facts.slice(-2);
      if (genres.length) rowsData.push([T('التصنيف', 'Genres'), genres.join(T('، ', ', '))]);
      const rows = rowsData.map(([k, v]) => `<div class="cu-fr"><span>${esc(k)}</span><b dir="auto" title="${esc(v)}">${esc(v)}</b></div>`).join('');
      sheet.innerHTML = `<div class="cu-dim"></div>
        <div class="cu-wrap">
          <div class="cu-card${run ? ' running' : ''}" tabindex="-1" role="dialog" aria-label="${esc(g.name)}">
            <button class="cu-x" type="button" data-close title="${esc(T('إغلاق (Esc)', 'Close (Esc)'))}" aria-label="${esc(T('إغلاق', 'Close'))}">${ic('x')}</button>
            <div class="cu-ban">
              <div class="cu-ban-art"></div>
              <div class="cu-ban-in">
                <span class="cu-eyebrow">${esc(eyebrow)}</span>
                <div class="cu-ban-logo"><h2 dir="auto">${esc(g.name)}</h2></div>
                <div class="cu-acts-slot"></div>
              </div>
            </div>
            <div class="cu-body">
              <div class="cu-stats">${statHTML}</div>
              <h4 class="cu-label">${esc(T('المعلومات', 'Information'))}</h4>
              <div class="cu-group">${rows}</div>
              ${desc ? `<h4 class="cu-label">${esc(T('عن اللعبة', 'About'))}</h4><p class="cu-desc" dir="auto">${esc(desc)}</p>` : ''}
            </div>
          </div>
        </div>`;
      const card = $('.cu-card', sheet);
      $('.cu-acts-slot', card).replaceWith(api.gameActions(g));
      // details still on the way: add / correct the achievements stat when they land (this sheet only)
      if (!g.detailed && api.Data && api.Data.ensureDetails) api.Data.ensureDetails(g).then(() => {
        if (!card.isConnected) return;
        const box = $('.cu-stats', card), old = $('.cu-stat.ach', card), h = achStat(g);
        if (old) { if (h) old.outerHTML = h; } else if (h && box) box.insertAdjacentHTML('beforeend', h);
      });
      const art = $('.cu-ban-art', card);
      const big = first(g.images.hero) || first(g.images.header);
      if (big) art.style.backgroundImage = cssUrl(big);
      if (g.images.logo && g.images.logo.length) {
        const slot = $('.cu-ban-logo', card);
        const im = api.imgWithFallback(g.images.logo, 'cu-logo', x => { x.remove(); slot.classList.toggle('has-logo', false); });
        im.alt = g.name;
        slot.prepend(im);
        slot.classList.toggle('has-logo', true);
      }

      // grow from the tile it came from, with a soft spring
      const from = onScreen(src);
      if (from) {
        const r = card.getBoundingClientRect();
        card.style.transformOrigin = `${(from.left + from.width / 2 - r.left).toFixed(0)}px ${(from.top + from.height / 2 - r.top).toFixed(0)}px`;
      }
      api.sfx('slide');
      const dim = $('.cu-dim', sheet);
      await Promise.all([
        dim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' }),
        card.animate([
          { opacity: 0, transform: 'translateY(12px) scale(.94)' },
          { opacity: 1, transform: 'translateY(-1px) scale(1.006)', offset: 0.72 },
          { opacity: 1, transform: 'none' },
        ], { duration: 380, easing: EASE, fill: 'backwards' }),
      ].map(a => a.finished.catch(() => null)));
      if (card.isConnected) { card.classList.toggle('ready', true); card.focus({ preventScroll: true }); }
    },

    /** the card settles back and fades (≤ 250 ms) */
    async close(sheet) {
      const card = $('.cu-card', sheet), dim = $('.cu-dim', sheet);
      if (!card) return;
      card.classList.toggle('ready', false);
      api.sfx('close');
      const f = { fill: 'forwards' };
      await Promise.all([
        card.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(8px) scale(.96)' }], { duration: 210, easing: 'cubic-bezier(.4,0,.6,1)', ...f }),
        dim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'ease-in', ...f }),
      ].map(a => a.finished.catch(() => null)));
    },
  };

  api.register('cupertino', Layout);
})();
