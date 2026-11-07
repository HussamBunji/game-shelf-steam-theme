/* ═══ Vinyl Records (متجر الأسطوانات) — library home design ═══
   Top: a "Now Playing" deck for your last game: a CSS turntable whose record turns (the only animation),
   the album sleeve and the track info (hours, last played, a "side A" bar), Play / Details / Store page.
   Below: the filter strip, then the crates — every game as a square album sleeve, with record-store dividers
   (letters when sorted by name, time / hour / size bands otherwise). Hovering a sleeve, or reaching it with the
   arrow keys, slides that one record half out. A click opens the game at once; only the round button plays.
   Opening a game (open / close below): the sleeve flies out of the crate, the record slides out of it onto a
   turntable, the tonearm swings in and the label turns; the liner notes beside it hold the facts and the buttons.
   Rules followed (docs/THEME-KIT.md): 4 elements per game, one shared play button, art painted by api.lazy,
   transforms only on the hovered / focused sleeve, DOM writes only in render() and on user input. */
(function () {
  'use strict';
  const api = window.__rfsLayoutApi;
  if (!api) return;
  const { T, esc, div, $, ic, icT, cssUrl, first, lazy, fmtPlaytime, fmtAgo, fmtSize, NUM } = api;
  const LTR = api.LTR;
  const DAY = 86400;

  /** "N games" with natural plurals in both languages */
  const countGames = n => T(
    n === 1 ? 'لعبة وحدة' : n === 2 ? 'لعبتين' : n >= 3 && n <= 10 ? `${NUM.format(n)} ألعاب` : `${NUM.format(n)} لعبة`,
    `${NUM.format(n)} ${n === 1 ? 'game' : 'games'}`);
  const SORT_BY = {
    recent: T('آخر لعب', 'last played'),
    name: T('الاسم', 'name'),
    playtime: T('ساعات اللعب', 'hours played'),
    size: T('الحجم', 'size'),
  };

  /** crate dividers: how the sorted list splits into sections ({ kick, key(g), label(k) }, or null for none) */
  function grouper(sort) {
    if (sort === 'name') return {
      kick: T('حرف', 'Letter'),
      key(g) {
        const s = String(g.sortAs || g.name || '').trim();
        const cp = s.codePointAt(0);
        if (cp == null) return '#';
        // É → E, أ / إ / آ → ا: strip accents and Arabic marks so each letter gets one divider
        const ch = [...String.fromCodePoint(cp).normalize('NFD').replace(/[̀-ًͯ-ٰٟ]/g, '').toUpperCase()][0] || '';
        return /\p{L}/u.test(ch) ? ch : '#';
      },
      label: k => k,
    };
    if (sort === 'recent') {
      const now = Date.now() / 1000;
      const names = { week: T('هالأسبوع', 'This week'), month: T('هالشهر', 'This month'), year: T('هالسنة', 'This year'), older: T('أقدم', 'Older'), never: T('ما انلعبت', 'Never played') };
      return {
        kick: T('آخر لعب', 'Last played'),
        key(g) {
          if (!g.lastPlayed) return 'never';
          const d = (now - g.lastPlayed) / DAY;
          return d < 7 ? 'week' : d < 30 ? 'month' : d < 365 ? 'year' : 'older';
        },
        label: k => names[k],
      };
    }
    if (sort === 'playtime') {
      const bands = [[6000, '100+'], [3000, '50–100'], [1200, '20–50'], [300, '5–20'], [60, '1–5'], [1, '<1']];
      return {
        kick: T('ساعات اللعب', 'Hours played'),
        key(g) { const m = g.playtimeMin || 0; for (const [min, k] of bands) if (m >= min) return k; return '0'; },
        label: k => (k === '0' ? T('ما انلعبت', 'Never played') : k),
      };
    }
    if (sort === 'size') {
      const GB = 1024 ** 3;
      const bands = [[100 * GB, '100+'], [50 * GB, '50–100'], [20 * GB, '20–50'], [5 * GB, '5–20'], [1, '<5']];
      return {
        kick: T('الحجم بالجيجا', 'Size in GB'),
        key(g) { const b = g.sizeOnDisk || 0; for (const [min, k] of bands) if (b >= min) return k; return '0'; },
        label: k => (k === '0' ? T('مو على الجهاز', 'Not on disk') : k),
      };
    }
    return null;
  }

  /** a crate divider card: 3 elements (the tab and the stripes are pseudo-elements) */
  function dividerHTML(grp, k, n) {
    const label = String(grp.label(k));
    const len = [...label].length;
    const size = len <= 2 ? 'big' : len <= 6 ? 'mid' : 'word';
    const num = /^[<\d]/.test(label); // "50–100", "<1": keep the range reading left to right
    return `<div class="vy-div" aria-hidden="true"><b class="${size}" data-kick="${esc(grp.kick)}"${num ? ' dir="ltr"' : ''}>${esc(label)}</b><small>${esc(countGames(n))}</small></div>`;
  }

  /** one album sleeve: 4 elements (the record is .art::before, the printed sleeve is .art::after) */
  function itemHTML(g, i, run) {
    const sub = run ? T('شغّالة الحين', 'Running now')
      : fmtPlaytime(g.playtimeMin) + (g.installed ? '' : T(' · غير مثبتة', ' · not installed'));
    return `<div class="vy-it${run ? ' running' : ''}${g.installed ? '' : ' ni'}" data-appid="${g.appid}" data-i="${i}"><div class="art"></div><div class="t" title="${esc(g.name)}">${esc(g.name)}</div><div class="h">${esc(sub)}</div></div>`;
  }

  function paintItem(it, g) {
    const u = cssUrl(first(g.images.capsule) || first(g.images.header));
    if (it._img !== u) { it._img = u; it.style.setProperty('--img', u); }
  }

  /** the "Now Playing" deck */
  function deckHTML(g, run, maxMin) {
    const mins = g.playtimeMin || 0;
    const pct = maxMin && mins ? Math.max(3, Math.min(100, Math.round(mins / maxMin * 100))) : 0;
    const isTop = mins > 0 && mins >= maxMin;
    const side = !mins ? T('ما بدأ بعد — حط الإبرة وابدأ', 'not started yet: drop the needle')
      : isTop ? T('أكثر لعبة لعبتها', 'Your most-played record')
      : T(`${NUM.format(pct)}% من وقت أكثر لعبة لعبتها`, `${NUM.format(pct)}% of your most-played`);
    // the tonearm follows side A: outer groove at the start, inner groove at your most-played; parked if never played
    const arm = mins ? (25 + 19 * pct / 100).toFixed(1) : '4';
    // <bdi>: "100 GB" keeps its order inside the Arabic (right-to-left) row
    const tag = (icon, text) => `<span>${ic(icon)}<bdi>${esc(text)}</bdi></span>`;
    const meta = [
      tag('clock', fmtPlaytime(mins)),
      g.lastPlayed ? tag('calendar', fmtAgo(g.lastPlayed)) : '',
      g.playtime2wksMin ? tag('fire', T(`${fmtPlaytime(g.playtime2wksMin)} آخر أسبوعين`, `${fmtPlaytime(g.playtime2wksMin)} past 2 weeks`)) : '',
      g.installed && g.sizeOnDisk ? tag('drive', fmtSize(g.sizeOnDisk)) : '',
      g.installed ? '' : tag('download', T('غير مثبتة', 'Not installed')),
    ].join('');
    const chip = run ? `<em class="vy-onair on">${esc(T('شغّالة الحين', 'Running now'))}</em>`
      : g.lastPlayed ? `<em class="vy-onair">${esc(T('آخر لعبة لعبتها', 'Last played'))}</em>` : '';
    const play = run ? ic('pulse') + esc(T('شغّالة', 'Running'))
      : g.installed ? ic('play') + esc(T('شغّل', 'Play')) : ic('download') + esc(T('ثبّت', 'Install'));
    const details = esc(T('التفاصيل', 'Details'));
    return `<section class="vy-deck${run ? ' running' : ''}" data-appid="${g.appid}" style="--arm:${arm}deg">
      <div class="vy-deck-bg"></div>
      <div class="vy-tt" data-act="open" title="${details}">
        <div class="vy-platter"><div class="vy-disc"><div class="vy-label"></div></div></div>
        <i class="vy-arm"></i>
        <i class="vy-led"></i>
        <div class="vy-knobs"><i>${NUM.format(33)}</i><i>${NUM.format(45)}</i></div>
      </div>
      <div class="vy-sleeve" data-act="open" title="${details}"></div>
      <div class="vy-info">
        <div class="vy-kicker">${ic('disc')}<span>${esc(T('على المشغّل', 'Now playing'))}</span>${chip}</div>
        <h2 class="vy-title" dir="auto">${esc(g.name)}</h2>
        <div class="vy-meta">${meta}</div>
        <div class="vy-side">
          <div class="vy-side-head"><b>${esc(T('الوجه أ', 'Side A'))}</b><span>${esc(side)}</span></div>
          <div class="vy-bar"><i style="width:${pct}%"></i></div>
        </div>
        <div class="vy-trk" hidden></div>
        <div class="vy-acts">
          <button class="vy-btn play" data-act="play">${play}</button>
          <button class="vy-btn" data-act="open">${ic('disc')}${details}</button>
          <button class="vy-btn" data-act="store">${ic('cart')}${esc(T('صفحة المتجر', 'Store page'))}</button>
        </div>
      </div>
    </section>`;
  }

  function paintDeck(deck, g) {
    const cap = cssUrl(first(g.images.capsule) || first(g.images.header));
    if (deck._cap !== cap) { deck._cap = cap; deck.style.setProperty('--cap', cap); }
    const big = first(g.images.hero) || first(g.images.header); // the page's one big image (a faint backdrop)
    const bg = $('.vy-deck-bg', deck);
    if (big && bg && deck._bg !== big) { deck._bg = big; bg.style.backgroundImage = cssUrl(big); }
    paintTracks(deck, g);
  }

  /** the deck's achievements, as a tracklist: "12 of 50 tracks completed", one groove segment per track (≤ 40).
      Only this box is rewritten, and only when the numbers change (the details often bring the exact count). */
  function paintTracks(deck, g) {
    const box = $('.vy-trk', deck);
    if (!box) return;
    const a = api.gameAch ? api.gameAch(g) : null;
    const sig = a ? `${a.got}/${a.total}` : '';
    if (box._sig === sig) return;
    box._sig = sig;
    box.hidden = !a;
    if (!a) { box.textContent = ''; return; }
    const done = a.got >= a.total;
    const got = NUM.format(a.got), total = NUM.format(a.total);
    const label = done ? T(`اكتملت كل المقاطع: ${total} من ${total}`, `All ${total} tracks completed`)
      : T(`${got} من ${total} مقطع مكتمل`, `${got} of ${total} tracks completed`);
    box.classList.toggle('done', done);
    box.title = T(`الإنجازات: ${got} من ${total} (${a.pct}%)`, `Achievements: ${got} of ${total} (${a.pct}%)`);
    box.innerHTML = `<div class="vy-trk-head">${ic('trophy')}<b>${esc(T('قائمة المقاطع', 'Tracklist'))}</b><span>${esc(label)}</span><em><bdi>${NUM.format(a.pct)}%</bdi></em></div>`
      + `<div class="vy-trk-bar" style="--n:${Math.max(1, Math.min(a.total, 40))}"><i style="width:${Math.max(a.pct, a.got ? 2 : 0)}%"></i></div>`;
  }

  /** the game's Store page (the layout API has no store helper yet, so ask the Steam client directly) */
  function openStore(appid) {
    if (typeof api.openStore === 'function') { api.openStore(appid); return; }
    try {
      let c = window;
      try { if (!c.SteamClient && window.opener && window.opener.SteamClient) c = window.opener; } catch (e) { /* cross-origin */ }
      c.SteamClient.URL.ExecuteSteamURL('steam://store/' + appid);
    } catch (e) { api.toast(T('ما قدرت أفتح صفحة المتجر', 'Couldn\'t open the Store page')); }
  }

  /* ═════════════ opening a game: the record comes out of its sleeve onto the turntable ═════════════
     The booth (a picture, drawn left-to-right in both languages): the album sleeve, then the turntable. Every size
     follows --D, the record's diameter, so the tonearm lands on the outer groove at any size. Beside the booth sit
     the liner notes: a cream insert with the facts as a track list, the description and the wired buttons. */
  // NOTE: no prefers-reduced-motion gate here: Windows reports "reduce" whenever its animation effects are off (they
  // are on the owner's PC), and this short entrance is the thing he asked for. It stays under 600 / 400 ms.
  const ARM_REST = 'rotate(3deg)', ARM_PLAY = 'rotate(30deg)';
  const EASE = 'cubic-bezier(.2,.8,.2,1)', EASE_IO = 'cubic-bezier(.6,0,.3,1)';

  function viewHTML(g, run) {
    const facts = api.gameFacts(g);
    const desc = api.gameDesc(g);
    const side = T('أ', 'A');
    const tracks = facts.map(([k, v], i) => `<li><i>${esc(side + NUM.format(i + 1))}</i><span>${esc(k)}</span><em></em><b dir="auto" title="${esc(v)}">${esc(v)}</b></li>`).join('');
    const genres = (g.genres || []).slice(0, 4).map(x => `<span dir="auto">${esc(x)}</span>`).join('');
    const status = run ? `<em class="vy-n-st on">${esc(T('شغّالة الحين', 'Now playing'))}</em>`
      : g.installed ? '' : `<em class="vy-n-st">${esc(T('مغلّفة · غير مثبتة', 'Sealed · not installed'))}</em>`;
    return `<div class="vy-scrim"></div>
      <div class="vy-view" tabindex="-1">
        <button class="vy-x" type="button" data-close title="${esc(T('إغلاق (Esc)', 'Close (Esc)'))}" aria-label="${esc(T('إغلاق', 'Close'))}">${ic('x')}</button>
        <div class="vy-booth">
          <div class="vy-sl"></div>
          <div class="vy-plinth${run ? ' running' : ''}">
            <div class="vy-platter"></div>
            <div class="vy-rec"><div class="vy-rec-label"><b class="vy-rec-name" dir="auto">${esc(g.name)}</b><small>${esc(T('الوجه أ · ٣٣ لفة', 'Side A · 33\u2153 rpm'))}</small></div></div>
            <i class="vy-tarm"></i><i class="vy-pivot"></i>
            <i class="vy-led"></i>
            <div class="vy-speed"><i class="on">${NUM.format(33)}</i><i>${NUM.format(45)}</i></div>
            <b class="vy-brand">${esc(T('ستيريو', 'Stereo'))}</b>
          </div>
        </div>
        <article class="vy-notes">
          <div class="vy-n-kick">${ic('disc')}<span>${esc(T('أسطوانة · الوجه أ', 'LP · Side A'))}</span>${status}<span class="vy-n-cat">${esc(T('رقم', 'Cat. no.'))} <bdi>${esc(String(g.appid))}</bdi></span></div>
          <h2 class="vy-n-title" dir="auto">${esc(g.name)}</h2>
          ${genres ? `<div class="vy-n-genres">${genres}</div>` : ''}
          <ol class="vy-tracks">${tracks}</ol>
          ${desc ? `<p class="vy-n-desc" dir="auto">${esc(desc)}</p>` : ''}
        </article>
      </div>`;
  }

  /** a rect's centre */
  const mid = r => [r.left + r.width / 2, r.top + r.height / 2];
  /** where the crate (or deck) sleeve is now, if it is on screen */
  function onScreen(src) {
    if (!src || !src.el || !src.el.isConnected) return null;
    const r = src.el.getBoundingClientRect();
    return r.width > 4 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth ? r : null;
  }

  const Layout = {
    fixedHeight: false,
    dockInside: true,
    games: [], items: [], cells: [], itemCell: [],
    cur: -1, curId: '', kf: null, hov: null, srcDeck: '', grid: null, pl: null, spin: null, openSrc: null,

    render(games, w) {
      this.games = games; this.hov = null;
      const keepRing = !!this.kf;
      this.kf = null;
      const running = api.running();
      const all = api.state.games || [];
      // the deck plays the running game, else the one you played last
      let deckG = null, maxMin = 0;
      for (const g of all) {
        const m = g.playtimeMin || 0;
        if (m > maxMin) maxMin = m;
        const r = running.has(g.appid), dr = !!deckG && running.has(deckG.appid);
        if (!deckG || (r && !dr) || (r === dr && (g.lastPlayed || 0) > (deckG.lastPlayed || 0))) deckG = g;
      }
      const sort = api.state.sort;
      const sortBy = SORT_BY[sort] || SORT_BY.recent;
      const el = div('vy' + (w < 1060 ? ' narrow' : '') + (w < 780 ? ' tiny' : ''));
      el.innerHTML = (deckG ? deckHTML(deckG, running.has(deckG.appid), maxMin) : '') + `
        <div class="rf-dock" data-rfs-dock></div>
        <div class="vy-head">
          <h3>${icT('disc')}<span>${esc(T('صناديق الأسطوانات', 'The record crates'))}</span></h3>
          <span class="vy-count">${esc(T(`${countGames(games.length)} · مرتّبة حسب ${sortBy}`, `${countGames(games.length)} · sorted by ${sortBy}`))}</span>
          <span class="vy-keys"><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd>${esc(T('تنقّل', 'browse'))}<i></i><kbd>Enter</kbd>${esc(T('افتح الأسطوانة', 'open the record'))}<i></i><kbd>Shift</kbd><kbd>Enter</kbd>${esc(T('شغّل', 'play'))}</span>
        </div>
        <div class="vy-crates"></div>`;

      // the crates: dividers + sleeves, built as one string (900+ games)
      const grid = $('.vy-crates', el);
      const cells = [], itemCell = [];
      if (!games.length) {
        grid.innerHTML = `<div class="rf-empty">${esc(api.state.query || api.state.genre ? T('ما لقيت شي يطابق بحثك', 'Nothing matches your search') : T('ما في ألعاب هنا', 'No games here'))}</div>`;
      } else {
        const grp = grouper(sort);
        const keys = grp ? games.map(g => grp.key(g)) : null;
        const counts = new Map();
        if (keys) for (const k of keys) counts.set(k, (counts.get(k) || 0) + 1);
        const parts = [];
        let prev;
        games.forEach((g, i) => {
          if (keys && keys[i] !== prev) { prev = keys[i]; parts.push(dividerHTML(grp, prev, counts.get(prev))); cells.push(-1); }
          itemCell.push(cells.length); cells.push(i);
          parts.push(itemHTML(g, i, running.has(g.appid)));
        });
        grid.innerHTML = parts.join('');
      }
      this.grid = grid; this.cells = cells; this.itemCell = itemCell;
      this.items = Array.from(grid.getElementsByClassName('vy-it'));
      for (const it of this.items) lazy(it, g => paintItem(it, g));

      // ONE play button for the whole crate: it moves to the sleeve under the mouse / keyboard ring
      const pl = document.createElement('button');
      pl.type = 'button'; pl.className = 'pl'; pl.tabIndex = -1;
      this.pl = pl;

      // keep the keyboard place across re-renders (search, sort, a game starting)
      this.cur = -1;
      if (this.curId) {
        const i = games.findIndex(g => String(g.appid) === this.curId);
        if (i >= 0) {
          this.cur = i;
          if (keepRing) { this.kf = this.items[i]; this.kf.classList.add('kf'); this.attachPlay(this.kf); }
        }
      }

      if (deckG) {
        const deck = $('.vy-deck', el);
        paintDeck(deck, deckG);
        if (!deckG.detailed && api.Data && api.Data.ensureDetails) api.Data.ensureDetails(deckG).then(g => { if (deck.isConnected) paintDeck(deck, g); });
        deck.addEventListener('click', e => {
          const b = e.target.closest('[data-act]');
          if (!b) return;
          const act = b.dataset.act;
          if (act === 'play') api.launch(deckG);
          else if (act === 'store') { api.sfx('tick'); openStore(deckG.appid); }
          else { this.srcDeck = String(deckG.appid); api.openGame(deckG, this.source(deckG.appid)); }
        });
      }

      grid.addEventListener('pointerover', e => {
        const it = e.target.closest('.vy-it');
        if (it === this.hov) return;
        this.hov = it;
        if (!it) return;
        this.flip(it); this.attachPlay(it); api.sfx('tick');
      });
      grid.addEventListener('pointerleave', () => { this.hov = null; });
      grid.addEventListener('click', e => this.onClick(e));

      api.stage.replaceChildren(el);
      if (this.kf) this.flip(this.kf);
    },

    /** a click opens the record at once; only the round button on the sleeve plays */
    onClick(e) {
      const it = e.target.closest('.vy-it');
      if (!it) return;
      const g = api.byId(it.dataset.appid);
      if (!g) return;
      if (this.kf && this.kf !== it) { this.kf.classList.toggle('kf', false); this.kf = null; }
      this.cur = +it.dataset.i; this.curId = it.dataset.appid;
      if (e.detail > 1) return;                                      // the rest of a double-click: already handled
      if (e.target.closest('.pl')) { api.launch(g); return; }
      this.srcDeck = '';
      api.openGame(g, this.source(g.appid));
    },

    /** where the record sleeve flies from (and back to) */
    source(appid) {
      const id = String(appid);
      const fromDeck = () => {
        const deck = api.stage.querySelector(`.vy-deck[data-appid="${id}"]`);
        if (!deck) return null;
        const s = deck.querySelector('.vy-sleeve');
        const el = s && s.offsetWidth ? s : deck.querySelector('.vy-platter'); // narrow windows hide the sleeve
        return el ? { el, slot: el, isSpine: false } : null;
      };
      if (this.srcDeck === id) { const d = fromDeck(); if (d) return d; }
      const a = api.stage.querySelector(`.vy-it[data-appid="${id}"] .art`);
      return a ? { el: a, slot: a.parentElement, isSpine: false } : fromDeck();
    },

    /** arrows move the ring (reading direction follows the language), Enter opens, Shift+Enter plays */
    key(e) {
      const n = this.items.length;
      if (!n || e.altKey || e.ctrlKey || e.metaKey) return false;
      const k = e.key;
      if (k === 'Enter') {
        const g = this.kf && this.games[this.cur];
        if (!g) return false;
        if (e.shiftKey) api.launch(g);
        else { this.srcDeck = ''; api.openGame(g, this.source(g.appid)); }
        return true;
      }
      const fwd = LTR ? 'ArrowRight' : 'ArrowLeft', back = LTR ? 'ArrowLeft' : 'ArrowRight';
      if (k !== fwd && k !== back && k !== 'ArrowUp' && k !== 'ArrowDown') return false;
      let i;
      if (!this.kf) i = this.cur >= 0 && this.visible(this.items[this.cur]) ? this.cur : this.firstVisible(); // first press: show the ring
      else if (k === fwd) i = this.cur + 1;
      else if (k === back) i = this.cur - 1;
      else i = this.vert(k === 'ArrowDown' ? 1 : -1);
      if (this.kf && k === 'ArrowUp' && i === this.cur) { // already on the top row: bring the deck into view
        const deck = api.stage.querySelector('.vy-deck');
        if (deck) deck.scrollIntoView({ block: 'nearest' });
        return true;
      }
      this.focus(Math.max(0, Math.min(n - 1, i)));
      return true;
    },
    focus(i) {
      const it = this.items[i];
      if (!it) return;
      if (this.kf !== it) {
        if (this.kf) this.kf.classList.toggle('kf', false);
        it.classList.toggle('kf', true);
        this.kf = it;
        api.sfx('tick');
      }
      this.cur = i; this.curId = it.dataset.appid;
      this.flip(it); this.attachPlay(it);
      it.scrollIntoView({ block: 'nearest' });
    },
    /** up / down: the sleeve in the same column one row away (dividers take a cell too) */
    vert(dir) {
      const cols = this.cols(), cells = this.cells, c = this.itemCell[this.cur];
      if (c == null) return this.cur;
      const t = c + dir * cols;
      if (t < 0) return this.cur;
      if (t >= cells.length) return dir > 0 ? this.items.length - 1 : this.cur;
      for (let d = 0; d < cols; d++) {
        for (const x of d ? [t + d, t - d] : [t]) {
          if (x >= 0 && x < cells.length && cells[x] >= 0 && (dir > 0 ? x > c : x < c)) return cells[x];
        }
      }
      return this.cur + dir;
    },
    cols() {
      const s = this.grid ? getComputedStyle(this.grid).gridTemplateColumns : '';
      return Math.max(1, s.split(' ').filter(Boolean).length);
    },
    visible(it) {
      if (!it) return false;
      const r = it.getBoundingClientRect();
      return r.bottom > 90 && r.top < window.innerHeight;
    },
    firstVisible() {
      const H = window.innerHeight;
      for (let i = 0; i < this.items.length; i++) {
        const r = this.items[i].getBoundingClientRect();
        if (r.bottom > 90 && r.top < H) return i;
        if (r.top >= H) break; // below the window already: start from the first sleeve
      }
      return 0;
    },
    /** the record slides toward the reading end; near the crate's edge it slides the other way */
    flip(it) {
      if (!this.grid) return;
      const r = it.getBoundingClientRect(), b = this.grid.getBoundingClientRect();
      const reach = r.width * 0.5;
      it.classList.toggle('flip', LTR ? r.right + reach > b.right + 16 : r.left - reach < b.left - 16);
    },
    attachPlay(it) {
      const pl = this.pl, art = it && it.firstElementChild;
      if (!pl || !art) return;
      if (pl.parentElement !== art) art.appendChild(pl);
      const g = api.byId(it.dataset.appid);
      const mode = g && !g.installed ? 'download' : 'play';
      if (pl.dataset.m !== mode) {
        pl.dataset.m = mode;
        pl.innerHTML = ic(mode);
        pl.title = mode === 'play' ? T('شغّل', 'Play') : T('ثبّت', 'Install');
        pl.setAttribute('aria-label', pl.title);
      }
    },

    /** the record slides out of its sleeve onto the turntable (≤ 600 ms) */
    async open(g, sheet, src) {
      this.stopSpin();
      api.stage.querySelectorAll('.taken').forEach(n => n.classList.toggle('taken', false)); // a quick close skips close()
      const run = api.running().has(g.appid);
      sheet.innerHTML = viewHTML(g, run);
      const view = $('.vy-view', sheet);
      // sizes from the panel: the notes keep a readable width, the record takes what is left (never oversized)
      const W = sheet.clientWidth, H = sheet.clientHeight;
      const NW = Math.round(Math.max(340, Math.min(450, W * 0.31)));
      const D = Math.round(Math.max(170, Math.min(360, (W - 132 - NW) / 2.32, H * 0.5)));
      view.style.setProperty('--D', D + 'px');
      view.style.setProperty('--NW', NW + 'px');
      // the label: the game's logo (its name stays if there is none)
      const label = $('.vy-rec-label', view);
      if (g.images.logo.length) {
        const im = api.imgWithFallback(g.images.logo, 'vy-rec-logo', x => { x.remove(); label.classList.toggle('logo', false); });
        label.prepend(im);
        label.classList.toggle('logo', true);
      }
      $('.vy-notes', view).append(api.gameActions(g));
      const sl = $('.vy-sl', view);
      const cap = first(g.images.capsule) || first(g.images.header);
      if (cap) sl.style.setProperty('--img', cssUrl(cap));

      this.openSrc = src && src.slot ? src.slot : null;
      if (this.openSrc) this.openSrc.classList.toggle('taken', true);
      const scrim = $('.vy-scrim', sheet), plinth = $('.vy-plinth', view), rec = $('.vy-rec', view);
      const arm = $('.vy-tarm', view), notes = $('.vy-notes', view);
      const dir = LTR ? 1 : -1;
      // measure the resting places (nothing is transformed yet)
      const rs = sl.getBoundingClientRect(), rr = rec.getBoundingClientRect();
      const [scx, scy] = mid(rs), [rcx, rcy] = mid(rr);
      const inSleeve = `translate(${(scx - rcx).toFixed(1)}px, ${(scy - rcy).toFixed(1)}px) scale(${(rs.width * 0.9 / rr.width).toFixed(3)})`;
      const from = onScreen(src);
      let slFrom = 'translateY(26px) scale(.86)', slOp = 0;
      if (from) {
        const [fx, fy] = mid(from);
        slFrom = `translate(${(fx - scx).toFixed(1)}px, ${(fy - scy).toFixed(1)}px) scale(${(from.width / rs.width).toFixed(3)})`;
        slOp = 1;
      }
      api.sfx('slide');
      const anims = [
        scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' }),
        plinth.animate([{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: EASE, fill: 'backwards' }),
        // 1. the sleeve leaves the crate
        sl.animate([{ transform: slFrom, opacity: slOp }, { transform: 'none', opacity: 1 }], { duration: 300, easing: EASE, fill: 'backwards' }),
        // 2. the record slides out of it onto the platter (hidden until the sleeve is in place)
        rec.animate([{ transform: inSleeve, opacity: 0 }, { transform: inSleeve, opacity: 1, offset: 0.01 }, { transform: 'none', opacity: 1 }],
          { duration: 300, delay: 240, easing: EASE_IO, fill: 'backwards' }),
        // 3. the tonearm swings in
        arm.animate([{ transform: ARM_REST }, { transform: ARM_PLAY }], { duration: 200, delay: 380, easing: 'ease-in-out', fill: 'both' }),
        notes.animate([{ opacity: 0, transform: `translateX(${28 * dir}px)` }, { opacity: 1, transform: 'none' }], { duration: 320, delay: 110, easing: EASE, fill: 'backwards' }),
      ];
      // 4. the label turns once the record is down (33 1/3 rpm; the grooves are round, so only the small label moves)
      this.spin = label.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 1800, delay: 540, iterations: Infinity });
      await Promise.all(anims.map(a => a.finished.catch(() => null)));
      if (view.isConnected) { view.classList.toggle('ready', true); view.focus({ preventScroll: true }); api.sfx('snap'); }
    },

    /** the arm lifts, the record slides back into its sleeve and the sleeve returns to the crate (≤ 400 ms) */
    async close(sheet, g) {
      const view = $('.vy-view', sheet);
      const done = () => { this.stopSpin(); if (this.openSrc) this.openSrc.classList.toggle('taken', false); this.openSrc = null; };
      if (!view) { done(); return; }
      view.classList.toggle('ready', false);
      if (this.spin) this.spin.pause(); // the label stops where it is
      const scrim = $('.vy-scrim', sheet), plinth = $('.vy-plinth', view), rec = $('.vy-rec', view);
      const arm = $('.vy-tarm', view), notes = $('.vy-notes', view), sl = $('.vy-sl', view);
      const dir = LTR ? 1 : -1;
      const rs = sl.getBoundingClientRect(), rr = rec.getBoundingClientRect();
      const [scx, scy] = mid(rs), [rcx, rcy] = mid(rr);
      const inSleeve = `translate(${(scx - rcx).toFixed(1)}px, ${(scy - rcy).toFixed(1)}px) scale(${(rs.width * 0.9 / rr.width).toFixed(3)})`;
      const to = onScreen(this.source(g.appid));
      let slTo = { transform: 'translateY(20px) scale(.86)', opacity: 0 };
      if (to) {
        const [tx, ty] = mid(to);
        slTo = { transform: `translate(${(tx - scx).toFixed(1)}px, ${(ty - scy).toFixed(1)}px) scale(${(to.width / rs.width).toFixed(3)})`, opacity: 1 };
      }
      api.sfx('close');
      const f = { fill: 'forwards' };
      await Promise.all([
        notes.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${20 * dir}px)` }], { duration: 180, easing: 'ease-in', ...f }),
        arm.animate([{ transform: ARM_PLAY }, { transform: ARM_REST }], { duration: 150, easing: 'ease-in-out', ...f }),
        rec.animate([{ transform: 'none', opacity: 1 }, { transform: inSleeve, opacity: 1, offset: 0.97 }, { transform: inSleeve, opacity: 0 }],
          { duration: 230, delay: 60, easing: EASE_IO, ...f }),
        sl.animate([{ transform: 'none', opacity: 1 }, slTo], { duration: 170, delay: 220, easing: 'cubic-bezier(.5,0,.6,1)', ...f }),
        plinth.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(14px)' }], { duration: 170, delay: 200, easing: 'ease-in', ...f }),
        scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 190, delay: 200, ...f }),
      ].map(a => a.finished.catch(() => null)));
      done();
    },
    stopSpin() { if (this.spin) { try { this.spin.cancel(); } catch (e) { /* gone */ } this.spin = null; } },
  };

  api.register('vinyl', Layout);
})();
