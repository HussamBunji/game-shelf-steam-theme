/* ═══ Corkboard — لوحة الذكريات ═══
   Library home design: every game is a polaroid pinned to a warm cork board, one board per group. The groups follow
   the strip's sort: last played → this week / this month / this year / older / never played, name → first letter,
   most played → hour bands, size → size bands. Plain vertical scrolling reaches every game; kraft index tabs jump
   to a board; arrow keys move a focus ring, Enter opens the details viewer, Ctrl+Enter plays.
   Performance (docs/THEME-KIT.md): a polaroid is 4 small elements + an icon, its tilt is a static 2D rotate,
   tape and pins are pseudo-elements, images are the small header art painted lazily, and only the hovered or
   keyboard-focused polaroid moves or casts a shadow. DOM writes happen in render() and on user input only. */
(function () {
  'use strict';
  const api = window.__rfsLayoutApi;
  if (!api) return;
  const { T, esc, NUM, ic, icT, cssUrl, first, lazy, rand, fmtPlaytime, fmtAgo, fmtSize } = api;

  const DAY = 86400, GB = 1024 ** 3;

  /** "N games" with natural Arabic plurals */
  const fmtCount = n => T(
    n === 1 ? 'لعبة وحدة' : n === 2 ? 'لعبتين' : n <= 10 ? `${NUM.format(n)} ألعاب` : `${NUM.format(n)} لعبة`,
    `${NUM.format(n)} ${n === 1 ? 'game' : 'games'}`);

  /* ---------- groups ---------- */
  /** fixed bands, kept in their own order; games keep the sort order inside each band */
  function bands(games, defs, idx) {
    const out = defs.map(d => Object.assign({ games: [] }, d));
    for (const g of games) out[idx(g)].games.push(g);
    return out.filter(b => b.games.length);
  }
  /** first letter for the name sort: A–Z, Arabic letters (alef forms folded), "#" for digits/symbols, "*" for other scripts */
  function letterOf(g) {
    const s = String(g.sortAs || g.name || '').trim();
    const ch = (([...s][0] || '').normalize('NFD').charAt(0) || '').toUpperCase();
    if (/[A-Z]/.test(ch)) return ch;
    if (!ch || /[0-9]/.test(ch) || !/\p{L}/u.test(ch)) return '#';
    if (/[؀-ۿ]/.test(ch)) return ch.replace(/[آأإ]/, 'ا');
    return '*';
  }
  function groupGames(games) {
    const sort = api.state.sort;
    if (sort === 'name') {
      const map = new Map();
      for (const g of games) {
        const k = letterOf(g);
        let b = map.get(k);
        if (!b) {
          b = k === '#' ? { t: '#', tab: '#', hint: T('أرقام ورموز', 'Numbers & symbols'), icon: 'tag', games: [] }
            : k === '*' ? { t: T('حروف أخرى', 'Other letters'), tab: T('أخرى', 'Other'), icon: 'globe', games: [] }
            : { t: k, tab: k, icon: 'library', games: [] };
          map.set(k, b);
        }
        b.games.push(g);
      }
      return [...map.values()];
    }
    if (sort === 'playtime') {
      return bands(games, [
        { t: T('أكثر من 100 ساعة', '100+ hours'), icon: 'trophy' },
        { t: T('من 25 إلى 100 ساعة', '25 – 100 hours'), icon: 'medal' },
        { t: T('من 5 إلى 25 ساعة', '5 – 25 hours'), icon: 'hourglass' },
        { t: T('من ساعة إلى 5 ساعات', '1 – 5 hours'), icon: 'clock' },
        { t: T('أقل من ساعة', 'Under an hour'), icon: 'timer' },
        { t: T('ما لعبتها بعد', 'Not played yet'), icon: 'sparkle' },
      ], g => {
        const m = g.playtimeMin || 0;
        return m >= 6000 ? 0 : m >= 1500 ? 1 : m >= 300 ? 2 : m >= 60 ? 3 : m > 0 ? 4 : 5;
      });
    }
    if (sort === 'size') {
      return bands(games, [
        { t: T('أكبر من 100 GB', 'Over 100 GB'), icon: 'drive' },
        { t: T('من 50 إلى 100 GB', '50 – 100 GB'), icon: 'drive' },
        { t: T('من 20 إلى 50 GB', '20 – 50 GB'), icon: 'drive' },
        { t: T('من 5 إلى 20 GB', '5 – 20 GB'), icon: 'drive' },
        { t: T('من 1 إلى 5 GB', '1 – 5 GB'), icon: 'drive' },
        { t: T('أقل من 1 GB', 'Under 1 GB'), icon: 'drive' },
        { t: T('حجمها غير معروف', 'Size unknown'), icon: 'info' },
        { t: T('غير مثبتة', 'Not installed'), icon: 'download' },
      ], g => {
        const b = g.sizeOnDisk || 0;
        if (!b) return g.installed ? 6 : 7;
        return b >= 100 * GB ? 0 : b >= 50 * GB ? 1 : b >= 20 * GB ? 2 : b >= 5 * GB ? 3 : b >= GB ? 4 : 5;
      });
    }
    // recent (default)
    const now = Date.now() / 1000;
    return bands(games, [
      { t: T('هذا الأسبوع', 'This week'), icon: 'fire' },
      { t: T('هذا الشهر', 'This month'), icon: 'calendar' },
      { t: T('هذي السنة', 'This year'), icon: 'calendar' },
      { t: T('من زمان', 'Older'), icon: 'clock' },
      { t: T('ما لعبتها بعد', 'Never played'), icon: 'sparkle' },
    ], g => {
      const ts = g.lastPlayed || 0;
      if (!ts) return 4;
      const d = now - ts;
      return d < 7 * DAY ? 0 : d < 30 * DAY ? 1 : d < 365 * DAY ? 2 : 3;
    });
  }

  /* ---------- one polaroid: frame > photo + caption + hours line + play sticker (tape / pin = ::before / ::after) ---------- */
  function card(g, i, running, sort) {
    const tilt = ((rand(g.appid) * 2 - 1) * 2.6).toFixed(2);          // deterministic, within ±3deg
    const d = Math.floor(rand(g.appid + 7919) * 8);                     // 4 washi tapes + 4 push pins
    const deco = d < 4 ? 't' + d : 'p' + (d - 4);
    const run = running.has(g.appid);
    const parts = [run ? T('شغّالة الحين', 'Running now') : fmtPlaytime(g.playtimeMin)];
    if (sort === 'size') { if (g.sizeOnDisk) parts.push(fmtSize(g.sizeOnDisk)); }
    else if (g.lastPlayed && !run) parts.push(fmtAgo(g.lastPlayed));
    const act = g.installed ? T('تشغيل', 'Play') : T('تثبيت', 'Install');
    // no title attribute: its native tooltip pops up late; a cut-off caption shows in full on hover instead (.full)
    return `<div class="ck-p ${deco}${run ? ' run' : ''}${g.installed ? '' : ' ni'}" data-appid="${g.appid}" data-i="${i}" style="--r:${tilt}deg">`
      + '<div class="art"></div>'
      + `<div class="cap" dir="auto">${esc(g.name)}</div>`
      + `<div class="sub">${esc(parts.join(' · '))}</div>`
      + `<button class="go play" type="button" tabindex="-1" title="${act}" aria-label="${act}">${ic(g.installed ? 'play' : 'download')}</button>`
      + '</div>';
  }
  /** a caption cut off by "…" shows the whole name while hovered / focused: a slightly smaller hand if that fits on
      one line (.fit, --fs), else two lines in place of the hours line (.full). One layout read, on user input only. */
  function fullCap(c) {
    if (c.dataset.fc) return;
    c.dataset.fc = '1';
    const cap = c.children[1];
    if (!cap || cap.scrollWidth <= cap.clientWidth + 1) return;
    const fs = 20 * (cap.clientWidth - 9) / Math.max(1, cap.scrollWidth - 8);  // 8 = the caption's side padding
    if (fs >= 15) { c.style.setProperty('--fs', fs.toFixed(1) + 'px'); c.classList.toggle('fit', true); }
    else c.classList.toggle('full', true);
  }

  /* ---------- the opened game: the polaroid comes off the board, turns over, and its back is written on ----------
     One element (.ckv-card) does everything with 2D transforms: it flies from its spot on the board to the middle
     (lifting as it comes), then turns over (scaleX 1 → 0, swap to the back, 0 → 1). Closing turns it to the front and
     pins it back in its spot. The pin or tape stays on the board while the photo is away (.ck-out). */
  const OPEN = { node: null, mo: null };
  /** the photo goes back on the board (and the watcher stops) */
  function putBack() {
    if (OPEN.node) OPEN.node.classList.toggle('ck-out', false);
    OPEN.node = null;
    if (OPEN.mo) { OPEN.mo.disconnect(); OPEN.mo = null; }
  }
  /** transform that puts the (front-side) card exactly over polaroid `node`; rc = the card's own box, untransformed */
  function overNode(node, rc) {
    const r = node.getBoundingClientRect();
    const lifted = node.matches(':hover') || node.classList.contains('kf');
    const s = (node.offsetWidth * (lifted ? 1.04 : 1)) / Math.max(1, rc.width);
    const rot = lifted ? 0 : parseFloat(node.style.getPropertyValue('--r')) || 0;
    const dx = r.left + r.width / 2 - (rc.left + rc.width / 2), dy = r.top + r.height / 2 - (rc.top + rc.height / 2);
    return { dx, dy, s, rot, t: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) rotate(${rot}deg) scale(${s.toFixed(4)})` };
  }
  /** achievements as a kraft price tag: trophy · 12/50 · 24% (or '' when the game has none) */
  function achTag(g) {
    const a = api.gameAch ? api.gameAch(g) : null;
    if (!a) return '';
    const label = T(`الإنجازات: ${NUM.format(a.got)} من ${NUM.format(a.total)} (${a.pct}%)`, `Achievements: ${NUM.format(a.got)} of ${NUM.format(a.total)} (${a.pct}%)`);
    return { done: a.got >= a.total, label, sig: `${a.got}/${a.total}`, a,
      html: `${ic('trophy')}<b>${NUM.format(a.got)}<small>/${NUM.format(a.total)}</small></b><em>${NUM.format(a.pct)}%</em>` };
  }
  /** the polaroid's back: the achievements written on the snapshot's caption strip, with a pencil-drawn bar */
  function snapAch(snap, g) {
    const t = achTag(g);
    let box = snap.querySelector('.ckv-ach');
    if (!t) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement('div'); box.className = 'ckv-ach'; snap.append(box); }
    if (box.dataset.sig === t.sig) return;
    box.dataset.sig = t.sig;
    box.classList.toggle('done', t.done);
    box.title = t.label;
    box.innerHTML = `${ic('trophy')}<b>${NUM.format(t.a.got)}<small>/${NUM.format(t.a.total)}</small></b><span class="ckv-ach-bar"><i style="width:${Math.max(t.a.pct, t.a.got ? 2 : 0)}%"></i></span><em>${NUM.format(t.a.pct)}%</em>`;
  }
  const FRONT_SCALE = 1.55; // the front side, held up in the middle before it turns over
  const FRONT_REST = `rotate(-1.5deg) scale(${FRONT_SCALE})`;

  const Layout = {
    fixedHeight: false,
    dockInside: true,
    list: [], nodes: [], starts: [], lens: [], boardOf: [],
    cur: -1, curId: 0, ring: null, hov: null, sp: null, byKey: false, tagEl: null,

    render(games) {
      const L = Layout;
      const keepId = L.ring ? L.curId : 0;
      L.ring = null; L.cur = -1; L.curId = 0; L.hov = null; L.tagEl = null;
      const groups = groupGames(games);
      const running = api.running();
      const sort = api.state.sort;
      const list = [], starts = [], lens = [], boardOf = [];
      const boards = groups.map((gr, b) => {
        starts.push(list.length); lens.push(gr.games.length);
        let mins = 0, cards = '';
        for (const g of gr.games) {
          mins += g.playtimeMin || 0;
          boardOf.push(b);
          cards += card(g, list.length, running, sort);
          list.push(g);
        }
        const meta = [gr.hint, fmtCount(gr.games.length), mins ? fmtPlaytime(mins) : ''].filter(Boolean).join(' · ');
        return `<section class="ck-board" data-b="${b}">`
          + `<header class="ck-head"><div class="ck-note n${b % 4}">${icT(gr.icon)}<h3 dir="auto">${esc(gr.t)}</h3><small>${esc(meta)}</small></div><i class="ck-twine"></i></header>`
          + `<div class="ck-grid">${cards}</div></section>`;
      }).join('');
      const index = groups.length > 1
        ? `<nav class="ck-index" aria-label="${T('اللوحات', 'Boards')}"><span class="ck-idx-lbl">${ic('jump')}${T('انتقل إلى', 'Jump to')}</span>`
          + groups.map((gr, b) => `<button class="ck-tab" type="button" data-b="${b}" dir="auto">${esc(gr.tab || gr.t)}<b>${NUM.format(gr.games.length)}</b></button>`).join('')
          + '</nav>'
        : '';
      const searching = !!(api.state.query || api.state.genre);
      const empty = `<div class="ck-empty"><div class="ck-note n1">${icT('search')}`
        + `<h3>${searching ? T('ما لقيت شي يطابق بحثك', 'Nothing matches your search') : T('ما في ألعاب هنا', 'No games here')}</h3>`
        + `<small>${searching ? T('جرّب كلمة ثانية أو امسح الفلتر', 'Try another word or clear the filter') : T('اختر مجموعة ثانية من الشريط فوق', 'Pick another collection in the strip above')}</small></div></div>`;

      const el = document.createElement('div');
      el.className = 'ck';
      el.innerHTML = `<div class="rf-dock" data-rfs-dock></div>${list.length ? index + boards : empty}`;

      const nodes = [...el.querySelectorAll('.ck-p')];
      for (const n of nodes) {
        const art = n.firstElementChild;
        lazy(n, g => {
          const h = first(g.images.header);
          art.style.setProperty('--img', cssUrl(h || first(g.images.capsule)));
          n.classList.toggle('cp', !h); // a portrait capsule is cropped a little higher until the header art arrives
        });
      }

      el.addEventListener('click', e => {
        const tab = e.target.closest('.ck-tab');
        if (tab) {
          const sec = el.querySelector(`.ck-board[data-b="${tab.dataset.b}"]`);
          if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
          api.sfx('tick');
          return;
        }
        const c = e.target.closest('.ck-p');
        if (!c) return;
        const i = +c.dataset.i, g = L.list[i];
        if (!g) return;
        if (L.ring && L.ring !== c) L.focus(-1, false); // the mouse takes over from the keyboard ring
        L.cur = i;
        if (e.target.closest('.go')) { api.launch(g); return; }
        api.openGame(g, L.source(g.appid));
      });
      // hover: the lift is plain CSS :hover (instant). Here only: a cut-off caption gets room for its full name, and the
      // game's details are fetched now so a click opens at once.
      el.addEventListener('pointerover', e => {
        const c = e.target.closest('.ck-p');
        if (!c || c === L.hov) return;
        L.hov = c;
        fullCap(c);
        const g = L.list[+c.dataset.i];
        L.tag(c, g);
        if (g && !g.detailed && api.Data) api.Data.ensureDetails(g).then(() => { if (L.hov === c || L.ring === c) L.tag(c, g); });
        api.sfx('tick');
      });

      api.stage.replaceChildren(el);
      L.list = list; L.nodes = nodes; L.starts = starts; L.lens = lens; L.boardOf = boardOf;
      if (keepId) {
        const j = list.findIndex(g => g.appid === keepId);
        if (j >= 0) L.focus(j, false);
      }
    },

    /** ONE paper tag for the whole board: it is tied to the hovered / keyboard-focused polaroid (shown by CSS there)
        and only rewritten when it moves to another game or the numbers change */
    tag(c, g) {
      const L = Layout;
      const t = g ? achTag(g) : '';
      if (!t) { if (L.tagEl && L.tagEl.parentElement === c) L.tagEl.remove(); return; }
      let el = L.tagEl;
      if (!el) { el = L.tagEl = document.createElement('span'); el.className = 'ck-ach'; el.setAttribute('aria-hidden', 'true'); }
      const sig = g.appid + ':' + t.sig;
      if (el.dataset.sig !== sig) { el.dataset.sig = sig; el.innerHTML = t.html; el.classList.toggle('done', t.done); el.title = t.label; }
      if (el.parentElement !== c) c.append(el);
    },

    source(appid) {
      const c = api.stage.querySelector(`.ck-p[data-appid="${appid}"] .art`);
      return c ? { el: c, slot: c.parentElement, isSpine: false } : null;
    },

    /** the game panel: the polaroid's back, written by hand — name, a lined page for the description, a sticky note
        with the facts, and paper-tag buttons. ≈ 550 ms in: fly + lift (270), turn (120 + 160). */
    async open(g, sheet, src) {
      putBack();
      const node = (src && src.slot && src.slot.isConnected && src.slot.classList.contains('ck-p') ? src.slot : null)
        || api.stage.querySelector(`.ck-p[data-appid="${g.appid}"]`);
      const run = api.running().has(g.appid);
      const deco = node ? ([...node.classList].find(c => /^[tp][0-3]$/.test(c)) || 't0') : 't0';
      const sub = [run ? T('شغّالة الحين', 'Running now') : fmtPlaytime(g.playtimeMin)];
      if (g.lastPlayed && !run) sub.push(fmtAgo(g.lastPlayed));
      const facts = api.gameFacts(g);
      const desc = api.gameDesc(g);
      const genres = (g.genres || []).slice(0, 5);
      const img = first(g.images.header) || first(g.images.capsule);
      const close = T('رجّعها للوحة (Esc)', 'Pin it back (Esc)');
      sheet.innerHTML = '<div class="ckv-dim" data-close></div><div class="ckv">'
        + `<div class="ckv-card ${deco}${run ? ' run' : ''}" role="dialog" aria-label="${esc(g.name)}" style="--w:${node ? node.offsetWidth : 196}px">`
        + `<div class="ckv-front" aria-hidden="true"><div class="art"></div><div class="cap" dir="auto">${esc(g.name)}</div><div class="sub">${esc(sub.join(' · '))}</div></div>`
        + '<div class="ckv-back">'
        + `<button class="ckv-x" type="button" data-close title="${close}" aria-label="${close}">${ic('x')}</button>`
        + '<div class="ckv-snap" aria-hidden="true"><div class="art"></div></div>'
        + `<header class="ckv-head"><h2 dir="auto">${esc(g.name)}</h2>`
        + (genres.length ? `<p class="ckv-tags" dir="auto">${genres.map(esc).join('<i></i>')}</p>` : '')
        + '</header>'
        + `<div class="ckv-lined"><p dir="auto"${desc ? '' : ' class="none"'}>${desc ? esc(desc) : T('ما في وصف لهاللعبة بعد.', 'No description for this game yet.')}</p></div>`
        + `<div class="ckv-note"><b>${T('ملاحظاتي', 'My notes')}</b><dl>`
        + facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd dir="auto">${esc(v)}</dd></div>`).join('')
        + '</dl></div><div class="ckv-foot"></div></div></div></div>';
      const card = sheet.querySelector('.ckv-card'), dim = sheet.firstElementChild;
      for (const a of card.querySelectorAll('.art')) a.style.setProperty('--img', cssUrl(img));
      const snap = sheet.querySelector('.ckv-snap');
      snapAch(snap, g);
      if (!g.detailed && api.Data) api.Data.ensureDetails(g).then(() => { if (snap.isConnected) snapAch(snap, g); });
      const acts = api.gameActions(g);
      sheet.querySelector('.ckv-foot').append(acts);

      // the photo leaves the board (its pin / tape stays); put it back however the panel closes
      if (node) {
        node.classList.toggle('ck-out', true);
        OPEN.node = node;
        OPEN.mo = new MutationObserver(() => { if (!sheet.classList.contains('on') || !sheet.firstElementChild) putBack(); });
        OPEN.mo.observe(sheet, { attributes: true, attributeFilter: ['class'], childList: true });
      }
      // opened with the keyboard (Enter): Play gets the focus, so Enter again plays and Tab walks the tags
      const byKey = Layout.byKey; Layout.byKey = false;
      const focusPlay = () => { const p = byKey && acts.querySelector('[data-act="play"]'); if (p) p.focus({ preventScroll: true }); };

      api.sfx('open');
      dim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
      const rc = card.getBoundingClientRect();
      let fly;
      if (node) {
        const o = overNode(node, rc);
        // lifted off the board: up a little and bigger, half-way turned straight
        const mid = `translate(${(o.dx * 0.5).toFixed(1)}px, ${(o.dy * 0.5 - 28).toFixed(1)}px) rotate(${(o.rot * 0.4 - 3).toFixed(2)}deg) scale(${((o.s + FRONT_SCALE) / 2 + 0.08).toFixed(3)})`;
        fly = card.animate([{ transform: o.t }, { transform: mid, offset: 0.45 }, { transform: FRONT_REST }],
          { duration: 270, easing: 'cubic-bezier(.25,.7,.3,1)', fill: 'forwards' });
      } else {
        fly = card.animate([{ transform: 'translateY(40px) rotate(-6deg) scale(.7)', opacity: 0 }, { transform: FRONT_REST, opacity: 1 }],
          { duration: 270, easing: 'cubic-bezier(.25,.7,.3,1)', fill: 'forwards' });
      }
      await fly.finished;
      const turn = card.animate([{ transform: FRONT_REST }, { transform: `rotate(-.8deg) scale(${FRONT_SCALE}) scaleX(0)` }],
        { duration: 120, easing: 'cubic-bezier(.55,0,1,.45)', fill: 'forwards' });
      await turn.finished;
      card.classList.toggle('flip', true);   // the back: its own size, at scale 1 (crisp text)
      fly.cancel(); turn.cancel();
      await card.animate([{ transform: 'scaleX(0)' }, { transform: 'none' }], { duration: 160, easing: 'cubic-bezier(.15,.6,.3,1)' }).finished;
      focusPlay();
    },

    /** ≈ 360 ms out: turn to the front (80), then fly back to its spot and pin it (280) */
    async close(sheet) {
      const card = sheet.querySelector('.ckv-card'), dim = sheet.querySelector('.ckv-dim');
      if (!card) { putBack(); return; }
      api.sfx('close');
      if (dim) dim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, easing: 'ease-in', fill: 'forwards' });
      const t1 = card.animate([{ transform: 'none' }, { transform: 'scaleX(0)' }], { duration: 80, easing: 'cubic-bezier(.55,0,1,.45)', fill: 'forwards' });
      await t1.finished;
      card.classList.toggle('flip', false);
      t1.cancel();
      const node = OPEN.node && OPEN.node.isConnected ? OPEN.node : null;
      const rc = card.getBoundingClientRect();
      const home = node ? overNode(node, rc).t : 'translateY(40px) rotate(-6deg) scale(.7)';
      const back = card.animate([
        { transform: `rotate(-.8deg) scale(${FRONT_SCALE}) scaleX(0)`, opacity: 1, easing: 'cubic-bezier(.15,.6,.3,1)' },
        { transform: FRONT_REST, opacity: 1, offset: 0.3, easing: 'cubic-bezier(.5,0,.25,1)' },
        { transform: home, opacity: node ? 1 : 0 },
      ], { duration: 280, fill: 'forwards' });
      await back.finished;
      putBack();
      if (node) api.sfx('tick');
    },

    /** move the keyboard ring (j < 0 removes it) */
    focus(j, scroll) {
      const L = Layout;
      if (L.ring) L.ring.classList.toggle('kf', false);
      L.ring = j >= 0 ? L.nodes[j] || null : null;
      L.cur = L.ring ? j : -1;
      L.curId = L.ring ? L.list[j].appid : 0;
      if (!L.ring) return;
      L.ring.classList.toggle('kf', true);
      fullCap(L.ring);
      const g = L.list[j];
      L.tag(L.ring, g);
      if (g && !g.detailed && api.Data) { const c = L.ring; api.Data.ensureDetails(g).then(() => { if (L.ring === c) L.tag(c, g); }); }
      if (scroll) L.ring.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },
    /** columns of the polaroid grid (every board has the same width, so one grid tells) */
    cols() {
      const n = Layout.nodes[0];
      const t = n && n.parentElement ? getComputedStyle(n.parentElement).gridTemplateColumns : '';
      return Math.max(1, t && t !== 'none' ? t.split(' ').filter(Boolean).length : 1);
    },
    /** top edge of the visible area (the nearest scrolling ancestor of the home design) */
    viewTop() {
      const L = Layout;
      let p = L.sp;
      if (!p || !p.isConnected || !p.contains(api.root)) {
        p = api.root;
        while (p && p !== document.body && p !== document.documentElement) {
          const o = getComputedStyle(p).overflowY;
          if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) break;
          p = p.parentElement;
        }
        L.sp = p && p !== document.body && p !== document.documentElement ? p : null;
        p = L.sp;
      }
      return p ? Math.max(0, p.getBoundingClientRect().top) : 0;
    },
    /** first polaroid on screen (binary search: the boards run top to bottom) */
    firstVisible() {
      const nodes = Layout.nodes, top = Layout.viewTop() + 8;
      let lo = 0, hi = nodes.length - 1, ans = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (nodes[mid].getBoundingClientRect().bottom > top) { ans = mid; hi = mid - 1; } else lo = mid + 1;
      }
      return ans;
    },

    key(e) {
      const L = Layout, n = L.nodes.length;
      if (!n || e.altKey || e.metaKey) return false;
      // leave Steam's own lists alone when they have the keyboard focus
      const a = document.activeElement;
      if (a && a !== document.body && !api.root.contains(a) && !a.contains(api.root)) return false;
      const k = e.key;
      if (k === 'Enter') {
        if (!L.ring) return false;
        const g = L.list[L.cur];
        if (e.ctrlKey) api.launch(g); else { L.byKey = true; api.openGame(g, L.source(g.appid)); }
        return true;
      }
      if (e.ctrlKey || e.shiftKey) return false;
      if (k === 'Escape') { if (!L.ring) return false; L.focus(-1, false); return true; }
      const arrow = k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown';
      if (!L.ring) {
        if (!arrow) return false;
        // first press: show the ring where you are (the last clicked polaroid if it's on screen, else the first visible one)
        let start = L.cur;
        if (start >= 0 && L.nodes[start]) {
          const r = L.nodes[start].getBoundingClientRect();
          if (r.bottom < L.viewTop() || r.top > innerHeight) start = -1;
        }
        L.focus(start >= 0 ? start : L.firstVisible(), true);
        api.sfx('tick');
        return true;
      }
      const i = L.cur, cols = L.cols();
      const b = L.boardOf[i], s = L.starts[b], len = L.lens[b], li = i - s, col = li % cols;
      let j = i;
      if (k === 'ArrowRight') j = i + (api.LTR ? 1 : -1);
      else if (k === 'ArrowLeft') j = i + (api.LTR ? -1 : 1);
      else if (k === 'ArrowDown') {
        if (li + cols < len) j = i + cols;
        else if (Math.floor(li / cols) < Math.floor((len - 1) / cols)) j = s + len - 1; // shorter last row
        else if (b + 1 < L.starts.length) j = L.starts[b + 1] + Math.min(col, L.lens[b + 1] - 1);
      } else if (k === 'ArrowUp') {
        if (li - cols >= 0) j = i - cols;
        else if (b > 0) {
          const ps = L.starts[b - 1], pl = L.lens[b - 1];
          j = ps + Math.min(Math.floor((pl - 1) / cols) * cols + col, pl - 1);
        }
      } else if (k === 'Home') j = 0;
      else if (k === 'End') j = n - 1;
      else return false;
      j = Math.max(0, Math.min(n - 1, j));
      if (j !== i) { L.focus(j, true); api.sfx('tick'); }
      return true;
    },
  };

  api.register('cork', Layout);
})();
