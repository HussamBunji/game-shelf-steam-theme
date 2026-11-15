/* ═══ Slate (سليت): library home + window chrome ═══
   Home:   a "continue where you left off" hero (always your most recently played game), the filter strip right
           above the games, a "Your library · most recent first" header and one grid of portrait cards
           (cover, name, hours · last played, a thin achievement bar). Every owned game is reachable by scrolling.
   Chrome: a left icon rail (Store · Library · Collections · Community · Market · Activity … Downloads) and a search
           box in the middle of the title bar that opens the theme's Ctrl+K search. THEMES and the sound switch move
           to the title bar (shelf.js, --rf-nav-place: titlebar). Steam's nav row and the collapsed game list at the
           left edge are styled in skin.js (they need Steam's runtime class names).
   Rules: no sounds on hover (clicks, Play and opening / closing a game only); hover is CSS; at most 5 elements per
   card; DOM writes only in render(), on input, or when the rail's active item really changes. */
(function () {
  'use strict';
  const api = window.__rfsLayoutApi;
  if (!api) return;
  const { T, esc, div, $, ic, cssUrl, first, lazy, fmtPlaytime, fmtAgo, NUM } = api;

  const isSlate = () => document.documentElement.dataset.rfsStyle === 'slate';

  /* ---------- small formatters (the card line is short: "142.6 h · Today") ---------- */
  const hoursShort = min => {
    if (!min) return T('ما انلعبت', 'Not played');
    if (min < 60) return T(`${NUM.format(min)} د`, `${NUM.format(min)} min`);
    const h = min / 60;
    return T(`${NUM.format(h >= 100 ? Math.round(h) : Math.round(h * 10) / 10)} س`, `${NUM.format(h >= 100 ? Math.round(h) : Math.round(h * 10) / 10)} h`);
  };
  const agoShort = ts => (ts ? fmtAgo(ts) : T('أبدًا', 'Never'));
  const achChip = a => T(`${NUM.format(a.got)} / ${NUM.format(a.total)} إنجاز`, `${NUM.format(a.got)} / ${NUM.format(a.total)} achievements`);
  const SORT_HEAD = () => ({
    recent: T('الأحدث أولًا', 'Most recent first'),
    name: T('أبجديًا', 'A to Z'),
    playtime: T('الأكثر لعبًا', 'Most played first'),
    size: T('الأكبر حجمًا', 'Largest first'),
  }[api.state.sort] || T('الأحدث أولًا', 'Most recent first'));

  /* ---------- the home design ---------- */
  const Layout = {
    fixedHeight: false,
    dockInside: true,
    kb: -1,

    render(games) {
      this.games = games; this.kb = -1;
      const recent = [...api.state.games].sort(api.SORTS.recent)[0];   // the hero is always the most recent game
      const running = api.running();
      const el = div('sl');
      el.innerHTML = `
        ${recent ? this.heroHTML(recent, running.has(recent.appid)) : ''}
        <div class="rf-dock" data-rfs-dock></div>
        <div class="sl-head"><h3>${esc(T('مكتبتك', 'Your library'))} <span>· ${esc(SORT_HEAD())}</span></h3><small>${esc(T('اضغط على لعبة للتفاصيل', 'Click a game for details'))}</small></div>
        <div class="sl-grid"></div>`;

      if (recent) this.wireHero(el, recent);

      const grid = $('.sl-grid', el);
      if (!games.length) grid.innerHTML = `<div class="rf-empty">${esc(T('ما لقيت شي يطابق بحثك', 'Nothing matches your search'))}</div>`;
      const frag = document.createDocumentFragment();
      for (const g of games) {
        // 5 elements: card · art · cap · name · sub. The "Not installed" tag and the achievement bar are CSS.
        const c = div('sl-card' + (running.has(g.appid) ? ' running' : ''));
        c.dataset.appid = g.appid;
        c.tabIndex = -1;
        c.innerHTML = `<div class="sl-art"${running.has(g.appid) ? ` data-tag="${esc(T('شغّالة', 'Running'))}"` : g.installed ? '' : ` data-tag="${esc(T('غير مثبتة', 'Not installed'))}"`}></div>`
          + `<div class="sl-cap"><div class="sl-name" dir="auto">${esc(g.name)}</div><div class="sl-sub">${esc(hoursShort(g.playtimeMin))} · ${esc(agoShort(g.lastPlayed))}</div></div>`;
        frag.append(c);
        lazy(c, gg => {
          c.firstElementChild.style.setProperty('--cap', cssUrl(first(gg.images.capsule) || first(gg.images.header)));
          const a = api.gameAch(gg);
          const cap = c.lastElementChild;
          if (a) { if (cap.style.getPropertyValue('--p') !== a.pct + '%') cap.style.setProperty('--p', a.pct + '%'); cap.classList.toggle('has-ach', true); }
        });
      }
      grid.append(frag);
      api.stage.replaceChildren(el);
      this.grid = grid;

      grid.addEventListener('click', e => {
        const c = e.target.closest('.sl-card'); if (!c) return;
        const g = api.byId(c.dataset.appid); if (!g) return;
        this.setKb(this.games.indexOf(g), false);
        api.sfx('tick');
        api.openGame(g, this.source(g.appid));
      });
    },

    heroHTML(g, run) {
      const a = api.gameAch(g);
      const chips = [
        `${hoursShort(g.playtimeMin)} ${T('إجمالي', 'total')}`,
        g.lastPlayed ? `${T('آخر لعب', 'Last played')} ${fmtAgo(g.lastPlayed)}` : '',
        g.playtime2wksMin ? `${hoursShort(g.playtime2wksMin)} ${T('آخر أسبوعين', 'past 2 weeks')}` : '',
      ].filter(Boolean).map(t => `<span>${esc(t)}</span>`).join('') + (a ? `<span data-ach>${esc(achChip(a))}</span>` : '');
      const playLabel = run ? ic('pulse') + esc(T('شغّالة الحين', 'Running now')) : g.installed ? ic('play') + esc(T('تشغيل', 'Play')) : ic('download') + esc(T('تثبيت', 'Install'));
      return `<section class="sl-hero" data-appid="${g.appid}">
          <div class="sl-hero-art"></div>
          <div class="sl-hero-body">
            <div class="sl-kicker">${esc(T('كمّل من وين وقفت', 'Continue where you left off'))}</div>
            <div class="sl-hero-title"><h2 dir="auto">${esc(g.name)}</h2></div>
            <div class="sl-chips">${chips}</div>
            <div class="sl-acts">
              <button class="sl-btn play" data-act="play">${playLabel}</button>
              <button class="sl-btn" data-act="open">${esc(T('التفاصيل', 'Details'))}</button>
              <button class="sl-btn" data-act="store">${esc(T('صفحة المتجر', 'Store page'))}</button>
            </div>
          </div>
        </section>`;
    },

    wireHero(el, g) {
      const hero = $('.sl-hero', el);
      const paint = gg => {
        $('.sl-hero-art', hero).style.backgroundImage = cssUrl(first(gg.images.hero) || first(gg.images.header) || first(gg.images.capsule));
        // the achievements chip appears once the details bring exact counts
        const a = api.gameAch(gg); if (!a) return;
        const chips = $('.sl-chips', hero), old = chips.querySelector('[data-ach]'), text = achChip(a);
        if (!old) chips.insertAdjacentHTML('beforeend', `<span data-ach>${esc(text)}</span>`);
        else if (old.textContent !== text) old.textContent = text;
      };
      paint(g);
      api.Data.ensureDetails(g).then(paint);
      hero.addEventListener('click', e => {
        const b = e.target.closest('[data-act]');
        const act = b ? b.dataset.act : 'open';
        if (act === 'play') { api.launch(g); return; }          // launch() plays its own sound
        api.sfx('tick');
        if (act === 'store') api.openStore(g.appid);
        else api.openGame(g, { el: hero, slot: hero, isSpine: false });
      });
    },

    source(appid) {
      const c = api.stage.querySelector(`.sl-card[data-appid="${appid}"] .sl-art`);
      return c ? { el: c, slot: c.parentElement, isSpine: false } : null;
    },

    /* arrows walk the grid (reading direction follows the language), Enter opens */
    key(e) {
      const n = this.games ? this.games.length : 0;
      if (!n || !this.grid || !this.grid.isConnected) return false;
      if (e.key === 'Enter') {
        const c = this.grid.querySelector('.sl-card.kb'); const g = c && api.byId(c.dataset.appid);
        if (!g) return false;
        api.openGame(g, this.source(g.appid)); return true;
      }
      const cols = Math.max(1, getComputedStyle(this.grid).gridTemplateColumns.split(' ').length);
      const d = { [api.LTR ? 'ArrowRight' : 'ArrowLeft']: 1, [api.LTR ? 'ArrowLeft' : 'ArrowRight']: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
      if (!d) return false;
      let i;
      if (this.kb < 0) {
        const cards = this.grid.children; i = 0;
        for (let k = 0; k < cards.length; k++) if (cards[k].getBoundingClientRect().top >= 40) { i = k; break; }
      } else { const j = this.kb + d; i = j < 0 ? this.kb : Math.min(n - 1, j); }
      this.setKb(i, true);
      return true;
    },
    setKb(i, show) {
      const old = this.grid && this.grid.querySelector('.sl-card.kb');
      if (old) old.classList.remove('kb');
      this.kb = i;
      if (!show || i < 0) return;
      const c = this.grid.children[i];
      if (c) { c.classList.add('kb'); c.scrollIntoView({ block: 'nearest' }); }
    },

    /* ---------- the game panel (Phase 3 turns this into the achievements popup) ---------- */
    async open(g, sheet) {
      const facts = api.gameFacts(g);
      const meta = [(g.developers || []).join(T('، ', ', ')), (g.genres || [])[0]].filter(Boolean).join(' · ');
      sheet.innerHTML = `
        <div class="sp-dim"></div>
        <div class="sp-wrap">
          <article class="sp-panel" role="dialog" aria-label="${esc(g.name)}">
            <button class="sp-x" type="button" data-close title="${esc(T('إغلاق (Esc)', 'Close (Esc)'))}">${ic('x')}</button>
            <div class="sp-ban"><div class="sp-ban-art"></div>
              <div class="sp-ban-in"><h2 dir="auto">${esc(g.name)}</h2>${meta ? `<p dir="auto">${esc(meta)}</p>` : ''}</div>
            </div>
            <div class="sp-row">
              <div class="sp-acts"></div>
              <div class="sp-hours"><b>${esc(g.playtimeMin ? fmtPlaytime(g.playtimeMin) : T('ما لعبتها بعد', 'Not played yet'))}</b>
                <small>${esc([g.playtime2wksMin ? `${hoursShort(g.playtime2wksMin)} ${T('آخر أسبوعين', 'in the last 2 weeks')}` : '', g.lastPlayed ? `${T('آخر لعب', 'last played')} ${fmtAgo(g.lastPlayed)}` : ''].filter(Boolean).join(' · '))}</small></div>
            </div>
            <dl class="sp-facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd dir="auto" title="${esc(v)}">${esc(v)}</dd></div>`).join('')}</dl>
          </article>
        </div>`;
      $('.sp-ban-art', sheet).style.backgroundImage = [first(g.images.hero), first(g.images.header)].filter(Boolean).map(cssUrl).join(', ') || 'none';
      $('.sp-acts', sheet).append(api.gameActions(g));
      api.sfx('open');
      const panel = $('.sp-panel', sheet);
      await Promise.all([
        $('.sp-dim', sheet).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' }).finished,
        panel.animate([{ opacity: 0, transform: 'translateY(14px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' }).finished,
      ]).catch(() => {});
    },
    async close(sheet) {
      const panel = $('.sp-panel', sheet); if (!panel) return;
      api.sfx('close');
      const fwd = { fill: 'forwards' };
      await Promise.all([
        $('.sp-dim', sheet).animate([{ opacity: 1 }, { opacity: 0 }], { ...fwd, duration: 180 }).finished,
        panel.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(10px) scale(.985)' }], { ...fwd, duration: 180, easing: 'ease-in' }).finished,
      ]).catch(() => {});
    },
  };
  api.register('slate', Layout);

  /* ═════════ window chrome: icon rail + title-bar search (only visible while Slate is the style, via CSS) ═════════ */
  const RAIL = [
    { id: 'store', icon: 'cart', label: () => T('المتجر', 'Store'), go: () => api.steamUrl('steam://store') },
    { id: 'library', icon: 'library', label: () => T('المكتبة', 'Library'), go: () => api.navigate('/library/home') },
    { id: 'collections', icon: 'grid', label: () => T('المجموعات', 'Collections'), go: () => api.navigate('/library/collections') },
    { id: 'community', icon: 'users', label: () => T('المجتمع', 'Community'), go: () => api.steamUrl('steam://openurl/https://steamcommunity.com/') },
    { id: 'market', icon: 'tag', label: () => T('السوق', 'Market'), go: () => api.steamUrl('steam://openurl/https://steamcommunity.com/market/') },
    { id: 'activity', icon: 'pulse', label: () => T('النشاط', 'Activity'), go: () => api.steamUrl('steam://openurl/https://steamcommunity.com/my/home/') },
    { id: 'downloads', icon: 'download', label: () => T('التنزيلات', 'Downloads'), go: () => api.navigate('/library/downloads'), bottom: true },
  ];
  /** which rail item matches where the main window is */
  function activeId() {
    const w = api.where();
    const r = w.route || '';
    if (/^\/browser/.test(r)) {
      const u = w.url || '';
      if (/steamcommunity\.com\/market/.test(u)) return 'market';
      if (/steamcommunity\.com\/(id|profiles)\/[^/]+\/home|steamcommunity\.com\/my\/home/.test(u)) return 'activity';
      if (/steamcommunity\.com/.test(u)) return 'community';
      if (/steampowered\.com/.test(u)) return 'store';
      return w.tab === 'community' ? 'community' : w.tab === 'store' ? 'store' : '';
    }
    if (/^\/library\/downloads/.test(r)) return 'downloads';
    if (/^\/library\/collection/.test(r)) return 'collections';
    if (/^\/library/.test(r)) return 'library';
    return '';
  }

  function buildChrome() {
    if (document.getElementById('slate-rail')) return;
    const rail = document.createElement('nav');
    rail.id = 'slate-rail';
    rail.setAttribute('aria-label', T('التنقل', 'Navigation'));
    rail.innerHTML = RAIL.map(it => `<button type="button" data-go="${it.id}"${it.bottom ? ' class="bottom"' : ''} title="${esc(it.label())}">${ic(it.icon)}<span>${esc(it.label())}</span></button>`).join('');
    rail.addEventListener('click', e => {
      const b = e.target.closest('[data-go]'); if (!b) return;
      const it = RAIL.find(x => x.id === b.dataset.go); if (!it) return;
      api.sfx('tick');
      try { it.go(); } catch (err) { api.toast(T('ما قدرت أفتحها', 'Couldn\'t open that')); }
      paintActive(it.id);
    });
    document.body.appendChild(rail);

    const search = document.createElement('button');
    search.id = 'slate-search';
    search.type = 'button';
    search.innerHTML = `${ic('search')}<span>${esc(T('ابحث في المكتبة والمتجر والإعدادات…', 'Search library, store, settings…'))}</span><kbd>Ctrl K</kbd>`;
    search.addEventListener('click', () => { api.sfx('tick'); api.focusSearch(); });
    document.body.appendChild(search);
  }

  let lastActive = null;
  function paintActive(id) {
    if (id === lastActive) return;          // write only when it really changes
    lastActive = id;
    const rail = document.getElementById('slate-rail'); if (!rail) return;
    rail.querySelectorAll('[data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === id));
  }

  buildChrome();
  // the active item follows navigation done anywhere (links, Steam's own buttons): checked twice a second, and the
  // DOM is touched only when the answer changes
  setInterval(() => { if (isSlate() && !document.hidden) paintActive(activeId()); }, 500);
})();
