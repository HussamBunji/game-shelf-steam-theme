/* ═══ Slate (سليت): library home + window chrome ═══
   Home:   a "continue where you left off" hero (always your most recently played game), the filter strip right
           above the games, a "Your library · most recent first" header and one grid of portrait cards
           (cover, name, hours · last played, a thin achievement bar). Every owned game is reachable by scrolling.
   Chrome: a left icon rail (Store · Library · Collections · Community · Market · Points Shop · Activity … Downloads) and a search
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
      if (Rest.on) { Rest.paint(); return; }   // resting while a game runs: a tiny panel instead of 400+ cards
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

    /* ---------- the game popup: Play + hours, the details grid, then achievements ----------
       Achievements load only when the popup opens (hub.js data, cached per game). A hidden achievement that isn't
       unlocked shows a placeholder: its real name and description enter the page only after "click to reveal". */
    async open(g, sheet) {
      const run = api.running().has(g.appid);
      const meta = [(g.developers || [])[0], (g.genres || [])[0]].filter(Boolean).join(' · ');
      const fav = isFav(g);
      const playLabel = run ? ic('pulse') + esc(T('شغّالة', 'Running')) : g.installed ? ic('play') + esc(T('تشغيل', 'Play')) : ic('download') + esc(T('تثبيت', 'Install'));
      const sub = [g.playtime2wksMin ? `${hoursShort(g.playtime2wksMin)} ${T('آخر أسبوعين', 'in the last 2 weeks')}` : '', g.lastPlayed ? `${T('آخر لعب', 'last played')} ${fmtAgo(g.lastPlayed)}` : ''].filter(Boolean).join(' · ');
      sheet.innerHTML = `
        <div class="sp-dim"></div>
        <div class="sp-wrap">
          <article class="sp-panel" role="dialog" aria-label="${esc(g.name)}">
            <button class="sp-x" type="button" data-close title="${esc(T('إغلاق (Esc)', 'Close (Esc)'))}">${ic('x')}</button>
            <div class="sp-ban"><div class="sp-ban-art"></div>
              <div class="sp-ban-in"><h2 dir="auto">${esc(g.name)}</h2>${meta ? `<p dir="auto">${esc(meta)}</p>` : ''}</div>
            </div>
            <div class="sp-row">
              <button class="sp-play play" type="button" data-do="play">${playLabel}</button>
              <div class="sp-hours"><b>${esc(g.playtimeMin ? fmtPlaytime(g.playtimeMin) : T('ما لعبتها بعد', 'Not played yet'))}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>
              <div class="sp-tools">
                <button class="sp-tool txt" type="button" data-do="store">${esc(T('صفحة المتجر', 'Store page'))}</button>
                <button class="sp-tool${fav ? ' on' : ''}" type="button" data-do="fav" title="${esc(T('المفضلة', 'Favorite'))}" aria-pressed="${fav}">${ic(fav ? 'starOn' : 'star')}</button>
                <button class="sp-tool" type="button" data-do="more" title="${esc(T('خيارات اللعبة', 'Game options'))}">${ic('sliders')}</button>
              </div>
            </div>
            <dl class="sp-facts">${detailFacts(g).map(factHTML).join('')}</dl>
            <section class="sa" hidden></section>
          </article>
        </div>`;
      $('.sp-ban-art', sheet).style.backgroundImage = [first(g.images.hero), first(g.images.header)].filter(Boolean).map(cssUrl).join(', ') || 'none';
      const panel = $('.sp-panel', sheet);
      panel.addEventListener('click', e => this.onPanelClick(e, g, panel));
      api.sfx('open');
      // slower sources fill in on their own: friends, cloud status, then the achievements
      this.fillLater(g, panel);
      await Promise.all([
        $('.sp-dim', sheet).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' }).finished,
        panel.animate([{ opacity: 0, transform: 'translateY(14px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' }).finished,
      ]).catch(() => {});
    },

    onPanelClick(e, g, panel) {
      const b = e.target.closest('[data-do]');
      if (b) {
        const act = b.dataset.do;
        if (act === 'play') { api.launch(g); return; }               // launch() plays its own sound
        api.sfx('tick');
        if (act === 'store') api.openStore(g.appid);
        else if (act === 'more') { const r = b.getBoundingClientRect(); api.gameMenu(g, r.left, r.bottom + 6, b); }
        else if (act === 'fav') {
          const on = !isFav(g);
          try { api.steam().collectionStore.SetAppsAsFavorite([g.appid], on); } catch (err) { api.toast(T('ما قدرت أغيّر المفضلة', "Couldn't change Favorites")); return; }
          b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.innerHTML = ic(on ? 'starOn' : 'star');
          api.toast(on ? T('انضافت للمفضلة', 'Added to Favorites') : T('انشالت من المفضلة', 'Removed from Favorites'));
        }
        return;
      }
      const sa = panel.querySelector('.sa');
      if (sa && sa.contains(e.target)) Ach.onClick(e, sa);
    },

    async fillLater(g, panel) {
      let H = null;
      try { H = await api.hub(); } catch (err) { /* no hub: the grid keeps what it has, no achievements section */ }
      if (!panel.isConnected) return;
      const data = H && H.data;
      if (data) {
        // friends: "3 friends own it" / "2 playing now"
        data.friends(g).then(list => {
          if (!panel.isConnected || !list) return;
          const playing = list.filter(f => f.state === 'ingame').length;
          const text = playing ? T(`${NUM.format(playing)} يلعبونها الحين`, `${NUM.format(playing)} playing now`)
            : list.length ? T(`${NUM.format(list.length)} من أصدقائك عندهم اللعبة`, `${NUM.format(list.length)} ${list.length === 1 ? 'friend owns' : 'friends own'} it`) : T('ولا أحد من أصدقائك', 'None of your friends');
          setFact(panel, 'friends', text);
        }).catch(() => setFact(panel, 'friends', '—'));
        try { const cloud = (data.moreFacts(g) || []).find(([k]) => k === T('حفظ السحابة', 'Steam Cloud')); if (cloud) setFact(panel, 'cloud', cloud[1]); } catch (err) { /* keep the first guess */ }
      }
      // achievements: skip the request when Steam already says the game has none
      if (g.achKnown && !api.gameAch(g)) return;
      const sa = panel.querySelector('.sa');
      if (!sa) return;
      sa.hidden = false;
      sa.innerHTML = `<div class="sa-head"><h3>${esc(T('الإنجازات', 'Achievements'))}</h3><span class="sa-count">${esc(T('يحمّل…', 'Loading…'))}</span></div>`;
      let list = null;
      try { list = data ? await data.achievements(g) : null; } catch (err) { list = null; }
      if (!panel.isConnected) return;
      if (!list || !list.length) { sa.remove(); return; }       // no achievements: no section at all
      Ach.mount(sa, list);
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

  /* ---------- popup helpers ---------- */
  function isFav(g) { try { return !!api.steam().collectionStore.BIsFavorite(g.appid); } catch (e) { return false; } }
  const LOCALE = () => (api.LANG === 'ar' ? 'ar-u-nu-latn' : 'en-GB');
  const fmtDate = (sec, opts) => { try { return new Intl.DateTimeFormat(LOCALE(), opts).format(new Date(sec * 1000)); } catch (e) { return ''; } };
  /** "Today, 21:40" · "Yesterday, 18:02" · "3 Nov 2026" */
  function lastPlayedText(sec) {
    if (!sec) return T('ما انلعبت', 'Never');
    const d = new Date(sec * 1000), now = new Date(), day = 86400000;
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const time = fmtDate(sec, { hour: '2-digit', minute: '2-digit', hour12: false });
    if (d.getTime() >= startToday) return T(`اليوم، ${time}`, `Today, ${time}`);
    if (d.getTime() >= startToday - day) return T(`أمس، ${time}`, `Yesterday, ${time}`);
    return fmtDate(sec, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const REVIEW = { 9: ['إيجابية للغاية', 'Overwhelmingly Positive'], 8: ['إيجابية جدًا', 'Very Positive'], 7: ['إيجابية', 'Positive'], 6: ['إيجابية غالبًا', 'Mostly Positive'], 5: ['متباينة', 'Mixed'], 4: ['سلبية غالبًا', 'Mostly Negative'], 3: ['سلبية', 'Negative'], 2: ['سلبية جدًا', 'Very Negative'], 1: ['سلبية للغاية', 'Overwhelmingly Negative'] };
  /** the details grid: [key, label, value]; "friends" and "cloud" are refined when slower sources answer */
  function detailFacts(g) {
    const ov = g.ov || {};
    let d = null; try { d = api.steam().appDetailsStore.GetAppDetails(g.appid); } catch (e) { /* not loaded */ }
    const out = [];
    out.push(['last', T('آخر لعب', 'Last played'), lastPlayedText(g.lastPlayed)]);
    // Steam keeps no "first played" date; the date the game joined your library is the closest it has
    const added = ov.rt_purchased_time || (d && d.rtPurchased);
    out.push(['since', T('في مكتبتك من', 'In library since'), added ? fmtDate(added, { month: 'long', year: 'numeric' }) : '—']);
    out.push(['2wk', T('آخر أسبوعين', 'Past 2 weeks'), g.playtime2wksMin ? fmtPlaytime(g.playtime2wksMin) : T('ما لعبت', 'Not played')]);
    out.push(['size', g.installed ? T('حجم التثبيت', 'Install size') : T('حجم التحميل', 'Download size'), api.sizeText(g) || '—']);
    let cloud = '—';
    try { if (d) cloud = !d.bCloudEnabledForApp ? T('غير مدعوم', 'Not supported') : !d.bCloudEnabledForAccount ? T('مطفأ', 'Off') : T('مفعّل', 'On'); } catch (e) { /* keep the dash */ }
    out.push(['cloud', T('حفظ السحابة', 'Cloud saves'), cloud]);
    const rel = ov.rt_steam_release_date || ov.rt_original_release_date;
    out.push(['release', T('تاريخ الإصدار', 'Release date'), rel ? fmtDate(rel, { day: 'numeric', month: 'short', year: 'numeric' }) : (g.releaseDate || '—')]);
    out.push(['dev', T('المطوّر', 'Developer'), (g.developers || []).join(T('، ', ', ')) || '—']);
    const rs = ov.review_score_without_bombs || ov.review_score_with_bombs, rp = ov.review_percentage_without_bombs || ov.review_percentage;
    out.push(['reviews', T('التقييمات', 'Reviews'), REVIEW[rs] ? `${T(REVIEW[rs][0], REVIEW[rs][1])}${rp ? ` · ${rp}%` : ''}` : (rp ? `${rp}%` : '—')]);
    out.push(['genre', T('النوع', 'Genre'), (g.genres || []).slice(0, 2).join(T('، ', ', ')) || '—']);
    const CT = { 1: T('دعم جزئي', 'Partial support'), 2: T('دعم كامل', 'Full support') };
    out.push(['ctrl', T('اليد', 'Controller'), CT[ov.xbox_controller_support] || T('بدون', 'None')]);
    out.push(['friends', T('الأصدقاء', 'Friends'), '…']);
    let drive = g.drive || '';
    try { const f = (d && d.strInstallFolder) || ''; const m = /^([A-Za-z]:)\\([^\\]+)/.exec(f); if (m) drive = `${m[1].toUpperCase()} ${m[2]}`; } catch (e) { /* keep */ }
    out.push(['drive', T('القرص', 'Drive'), g.installed ? (drive || '—') : T('غير مثبتة', 'Not installed')]);
    const DK = { 1: T('غير مدعومة', 'Unsupported'), 2: T('قابلة للعب', 'Playable'), 3: T('متحقق منها', 'Verified') };
    if (DK[ov.steam_deck_compat_category]) out.push(['deck', T('ستيم ديك', 'Steam Deck'), DK[ov.steam_deck_compat_category]]);
    return out;
  }
  const factHTML = ([k, label, v]) => `<div data-f="${k}"><dt>${esc(label)}</dt><dd dir="auto" title="${esc(v)}">${esc(v)}</dd></div>`;
  function setFact(panel, key, value) {
    const dd = panel.querySelector(`.sp-facts [data-f="${key}"] dd`);
    if (dd && dd.textContent !== value) { dd.textContent = value; dd.title = value; }
  }

  /* ---------- achievements: progress, Remaining / Unlocked tabs, sort, hover details, reveal, recent strip ---------- */
  const LOCK = '<svg class="rf-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  const rarity = p => (p == null ? '' : p <= 5 ? T('نادر جدًا', 'Ultra rare') : p <= 10 ? T('نادر', 'Rare') : p <= 35 ? T('غير شائع', 'Uncommon') : T('شائع', 'Common'));
  const pctText = p => (p == null ? '' : T(`${NUM.format(Math.round(p * 10) / 10)}% من اللاعبين`, `${NUM.format(Math.round(p * 10) / 10)}% of players`));
  const statLine = a => [pctText(a.global), rarity(a.global)].filter(Boolean).join(' · ');
  const SORTS_A = {
    rare: [T('الأندر أولًا', 'Rarest first'), (a, b) => (a.global ?? 101) - (b.global ?? 101)],
    common: [T('الأشيع أولًا', 'Most common first'), (a, b) => (b.global ?? -1) - (a.global ?? -1)],
    recent: [T('آخر ما فتحت', 'Recently unlocked'), (a, b) => (b.time || 0) - (a.time || 0)],
    name: [T('أبجديًا', 'A to Z'), (a, b) => String(a.name).localeCompare(String(b.name))],
  };
  const Ach = {
    mount(sa, list) {
      const got = list.filter(a => a.unlocked), left = list.filter(a => !a.unlocked);
      const pct = Math.round((got.length / list.length) * 100);
      sa._list = list; sa._revealed = new Set();
      sa._tab = left.length ? 'remaining' : 'unlocked';
      sa._sort = { remaining: 'rare', unlocked: 'recent' };
      const recent = got.filter(a => a.time).sort(SORTS_A.recent[1]).slice(0, 5);
      sa.innerHTML = `
        <div class="sa-head">
          <h3>${esc(T('الإنجازات', 'Achievements'))}</h3>
          <span class="sa-count"><b>${NUM.format(got.length)}</b> ${esc(T('من', 'of'))} ${NUM.format(list.length)} · ${pct}%</span>
          <i class="sa-bar" style="--p:${pct}%"></i>
        </div>
        <div class="sa-tools">
          <div class="sa-tabs" role="tablist">
            <button type="button" role="tab" data-tab="remaining">${esc(T('المتبقية', 'Remaining'))} (${NUM.format(left.length)})</button>
            <button type="button" role="tab" data-tab="unlocked">${esc(T('المفتوحة', 'Unlocked'))} (${NUM.format(got.length)})</button>
          </div>
          <div class="sa-sort"><button type="button" class="sa-sort-btn" data-sortmenu></button><div class="sa-sort-menu" hidden></div></div>
        </div>
        <div class="sa-grid"></div>
        ${recent.length ? `<div class="sa-recent"><h4>${esc(T('آخر ما فتحت', 'Recently unlocked'))}</h4><div class="sa-chips">${recent.map(a => `<span class="sa-chip" title="${esc(a.time ? fmtDate(a.time, { day: 'numeric', month: 'short', year: 'numeric' }) : '')}">${a.icon ? `<img src="${esc(a.icon)}" alt="" loading="lazy">` : '<i></i>'}<b dir="auto">${esc(a.name)}</b></span>`).join('')}</div></div>` : ''}`;
      this.paint(sa);
    },
    paint(sa) {
      const tab = sa._tab, key = sa._sort[tab];
      sa.querySelectorAll('[data-tab]').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
      sa.querySelector('.sa-sort-btn').innerHTML = `${esc(T('الترتيب:', 'Sort:'))} ${esc(SORTS_A[key][0])} ${ic('chevD')}`;
      const keys = tab === 'remaining' ? ['rare', 'common', 'name'] : ['recent', 'rare', 'common', 'name'];
      sa.querySelector('.sa-sort-menu').innerHTML = keys.map(k => `<button type="button" data-sort="${k}"${k === key ? ' class="on"' : ''}>${esc(SORTS_A[k][0])}</button>`).join('');
      const items = sa._list.filter(a => (tab === 'unlocked') === a.unlocked).sort(SORTS_A[key][1]);
      sa.querySelector('.sa-grid').innerHTML = items.length ? items.map(a => this.itemHTML(a, sa)).join('')
        : `<p class="sa-none">${esc(tab === 'remaining' ? T('فتحت كل الإنجازات!', "You've unlocked them all!") : T('ما فتحت شي بعد', 'Nothing unlocked yet'))}</p>`;
    },
    itemHTML(a, sa) {
      const idx = sa._list.indexOf(a);
      const secret = a.hidden && !a.unlocked && !sa._revealed.has(idx);
      const stat = statLine(a);
      const icon = a.unlocked && a.icon ? `<img class="sa-ico" src="${esc(a.icon)}" alt="" loading="lazy">` : `<i class="sa-ico lock">${LOCK}</i>`;
      if (secret) {
        // placeholder blocks, not the real name blurred: the real text isn't in the page until it's revealed
        return `<div class="sa-item secret" data-i="${idx}">${icon}
          <div class="sa-txt"><i class="sa-redact" aria-hidden="true"></i><button type="button" class="sa-reveal" data-reveal="${idx}">${esc(T('مخفي · اضغط للكشف', 'Hidden · click to reveal'))}</button></div>
          <div class="sa-tip" role="tooltip"><p>${esc(T('إنجاز مخفي', 'Hidden achievement'))}</p>${stat ? `<small>${esc(stat)}</small>` : ''}</div></div>`;
      }
      const when = a.unlocked && a.time ? T(`فتحته ${fmtDate(a.time, { day: 'numeric', month: 'short', year: 'numeric' })}`, `Unlocked ${fmtDate(a.time, { day: 'numeric', month: 'short', year: 'numeric' })}`) : '';
      return `<div class="sa-item${a.unlocked ? ' done' : ''}" data-i="${idx}">${icon}
        <div class="sa-txt"><b dir="auto">${esc(a.name)}</b>${stat ? `<small>${esc(stat)}</small>` : ''}</div>
        <div class="sa-tip" role="tooltip"><p dir="auto">${esc(a.desc || T('بدون وصف', 'No description'))}</p><small>${esc([stat, when].filter(Boolean).join(' · '))}</small></div></div>`;
    },
    onClick(e, sa) {
      const tab = e.target.closest('[data-tab]');
      if (tab) { api.sfx('tick'); sa._tab = tab.dataset.tab; this.paint(sa); return; }
      const menu = sa.querySelector('.sa-sort-menu');
      if (e.target.closest('[data-sortmenu]')) { api.sfx('tick'); menu.hidden = !menu.hidden; return; }
      const s = e.target.closest('[data-sort]');
      if (s) { api.sfx('tick'); sa._sort[sa._tab] = s.dataset.sort; menu.hidden = true; this.paint(sa); return; }
      const r = e.target.closest('[data-reveal]');
      if (r) {
        api.sfx('tick');
        const idx = +r.dataset.reveal; sa._revealed.add(idx);
        const tmp = document.createElement('div'); tmp.innerHTML = this.itemHTML(sa._list[idx], sa);
        r.closest('.sa-item').replaceWith(tmp.firstElementChild);
        return;
      }
      if (menu && !menu.hidden && !e.target.closest('.sa-sort')) menu.hidden = true;
    },
  };

  /* ═════════ resting while you play ═════════
     When a game has been running for 20 s, Slate lets the main window rest: a web page in it (store, community) is
     closed by going to the library, the library grid (400+ cards and their cover art) is replaced by one small
     "Now playing" panel, and the main window is minimized, so Chromium drops its painted tiles and lowers its
     priority. Steam's Friends list is a separate window and is never touched: invites keep working there and in the
     overlay. When the last game closes, the library comes back (the window stays where you left it). "Wake up" brings
     it back early; the switch lives in the Sound ▾ popover (saved as rfs.rest, on by default). */
  const Rest = {
    on: false, armed: 0, woke: false, appid: 0,
    get enabled() { try { return localStorage.getItem('rfs.rest') !== '0'; } catch (e) { return true; } },
    set enabled(v) { try { localStorage.setItem('rfs.rest', v ? '1' : '0'); } catch (e) { /* ignore */ } if (!v && this.on) this.wake(); },
    /** the running GAMES: Steam also lists apps and tools it runs (Wallpaper Engine is app type 2, SteamVR and the
        runtimes type 4), which run for hours and must not put the client to rest. Games are type 1, demos 8. */
    games() {
      const out = new Set();
      for (const id of api.running()) {
        let t = 0; try { const o = api.steam().appStore.GetAppOverviewByAppID(id); t = o ? o.app_type : 0; } catch (e) { /* unknown */ }
        if (t === 1 || t === 8) out.add(id);
      }
      return out;
    },
    watch() {
      if (!isSlate()) return;
      const run = this.games();
      if (!run.size) { this.armed = 0; this.woke = false; if (this.on) this.wake(); return; }
      if (this.on || this.woke || !this.enabled) return;
      if (!this.armed) { this.armed = Date.now(); return; }
      if (Date.now() - this.armed >= 20000) this.sleep([...run][0]);
    },
    sleep(appid) {
      this.on = true; this.appid = appid;
      const w = api.where();
      if (/^\/browser/.test(w.route || '')) api.navigate('/library/home');   // closes the store / community page
      else if (/^\/library\/home/.test(w.route || '')) this.paint();
      try { SteamClient.Window.Minimize(); } catch (e) { /* older Steam */ }
    },
    wake(byUser) {
      if (!this.on) return;
      this.on = false;
      if (byUser) this.woke = true;            // stay awake for the rest of this game
      api.rerender();
    },
    paint() {
      const g = api.byId(this.appid);
      const el = div('sl sl-rest');
      el.innerHTML = `<section class="sl-restcard">
          <div class="sl-kicker">${esc(T('تلعب الحين', 'Now playing'))}</div>
          <h2 dir="auto">${esc(g ? g.name : T('لعبة', 'A game'))}</h2>
          <p>${esc(T('Steam مرتاح عشان يوفّر الذاكرة لين تخلص. قائمة الأصدقاء تشتغل عادي للدعوات.', 'Steam is resting to save memory until you finish. The Friends list still works for invites.'))}</p>
          <div class="sl-acts">
            <button class="sl-btn play" data-act="wake">${ic('refresh')}${esc(T('صحّه الحين', 'Wake up now'))}</button>
            <button class="sl-btn" data-act="off">${esc(T('لا ترتاح أثناء اللعب', 'Don\'t rest while gaming'))}</button>
          </div>
        </section>`;
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        api.sfx('tick');
        if (b.dataset.act === 'off') { this.enabled = false; api.toast(T('ما راح يرتاح أثناء اللعب. تقدر ترجعها من قائمة الصوت ▾', 'Resting is off. Turn it back on from the Sound ▾ menu.')); }
        else this.wake(true);
      });
      api.stage.replaceChildren(el);
    },
  };

  window.__slateRest = Rest; // for tools and tests (read its state, Rest.games())

  api.register('slate', Layout);

  /* ═════════ window chrome: icon rail + title-bar search (only visible while Slate is the style, via CSS) ═════════ */
  const RAIL = [
    { id: 'store', icon: 'cart', label: () => T('المتجر', 'Store'), go: () => api.steamUrl('steam://store') },
    { id: 'library', icon: 'library', label: () => T('المكتبة', 'Library'), go: () => api.navigate('/library/home') },
    { id: 'collections', icon: 'grid', label: () => T('المجموعات', 'Collections'), go: () => api.navigate('/library/collections') },
    { id: 'community', icon: 'users', label: () => T('المجتمع', 'Community'), go: () => api.steamUrl('steam://openurl/https://steamcommunity.com/') },
    { id: 'market', icon: 'tag', label: () => T('السوق', 'Market'), go: () => api.steamUrl('steam://openurl/https://steamcommunity.com/market/') },
    { id: 'points', icon: 'coins', label: () => T('متجر النقاط', 'Points Shop'), go: () => api.steamUrl('steam://openurl/https://store.steampowered.com/points/shop/') },
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
      if (/store\.steampowered\.com\/points/.test(u)) return 'points';
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
      // hold the clicked item until the page arrives: a web page keeps reporting the OLD address for a second or two
      // while it loads, which made the highlight jump back and then forward again
      pending = { id: it.id, until: Date.now() + 6000 };
      paintActive(it.id);
      // navigate after the highlight has started moving: drawing the library can hold the page for ~0.4 s, and the
      // slide (a compositor transform) then carries on smoothly instead of waiting for it
      requestAnimationFrame(() => setTimeout(() => {
        try { it.go(); } catch (err) { pending = null; api.toast(T('ما قدرت أفتحها', 'Couldn\'t open that')); }
      }, 0));
    });
    rail.insertAdjacentHTML('afterbegin', '<i class="sl-ind" aria-hidden="true"></i>');
    document.body.appendChild(rail);

    const search = document.createElement('button');
    search.id = 'slate-search';
    search.type = 'button';
    search.innerHTML = `${ic('search')}<span>${esc(T('ابحث في المكتبة والمتجر والإعدادات…', 'Search library, store, settings…'))}</span><kbd>Ctrl K</kbd>`;
    search.addEventListener('click', () => { api.sfx('tick'); api.focusSearch(); });
    document.body.appendChild(search);
  }

  let lastActive = null, pending = null;
  /** where the rail should point: the item just clicked until navigation reaches it (or 6 s pass), then the truth */
  function railTarget() {
    const cur = activeId();
    if (pending && (cur === pending.id || Date.now() > pending.until)) pending = null;
    return pending ? pending.id : cur;
  }
  function paintActive(id) {
    if (id === lastActive) return;          // write only when it really changes
    lastActive = id;
    const rail = document.getElementById('slate-rail'); if (!rail) return;
    let on = null;
    rail.querySelectorAll('[data-go]').forEach(b => { const hit = b.dataset.go === id; b.classList.toggle('on', hit); if (hit) on = b; });
    // one highlight that slides between items (transform only, so it stays on the compositor)
    const ind = rail.querySelector('.sl-ind'); if (!ind) return;
    if (!on) { ind.classList.remove('show'); return; }
    const jump = !ind.classList.contains('show');   // appearing: no slide in from the top
    if (jump) ind.style.transition = 'none';
    ind.style.transform = `translateY(${on.offsetTop}px)`;
    ind.style.height = on.offsetHeight + 'px';
    ind.classList.add('show');
    if (jump) { void ind.offsetHeight; ind.style.transition = ''; }
  }

  /* ---------- volume: a small ▾ beside the Sound pill opens a slider (the pill itself still toggles on / off) ---------- */
  function buildVolume() {
    const wrap = document.getElementById('rfs-navwrap');
    if (!wrap || !api.sound || document.getElementById('slate-vol')) return;
    const btn = document.createElement('button');
    btn.id = 'slate-vol'; btn.type = 'button'; btn.className = 'rfs-tb';
    btn.title = T('مستوى الصوت', 'Volume'); btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = ic('chevD');
    const pop = document.createElement('div');
    pop.id = 'slate-volpop'; pop.hidden = true;
    pop.innerHTML = `<label><span>${esc(T('مستوى الصوت', 'Volume'))}</span><b></b></label><input type="range" min="0" max="100" step="5">`
      + `<label class="sl-restopt"><input type="checkbox"><span>${esc(T('ريّح Steam أثناء اللعب (يوفّر الذاكرة)', 'Rest Steam while gaming (saves memory)'))}</span></label>`;
    const restBox = pop.querySelector('.sl-restopt input');
    restBox.addEventListener('change', () => { Rest.enabled = restBox.checked; api.sfx('tick'); });
    const range = pop.querySelector('input'), out = pop.querySelector('b');
    const paint = () => { const v = Math.round(api.sound.volume * 100); range.value = v; out.textContent = v + '%'; restBox.checked = Rest.enabled; };
    const place = () => { const r = btn.getBoundingClientRect(); pop.style.top = Math.round(r.bottom + 8) + 'px'; pop.style.left = Math.round(Math.max(8, r.right - 240)) + 'px'; };
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const open = pop.hidden;
      pop.hidden = !open; btn.setAttribute('aria-expanded', String(open));
      if (open) { paint(); place(); }
    });
    range.addEventListener('input', () => { api.sound.setVolume(range.value / 100); out.textContent = range.value + '%'; });
    // a soft preview at the new level when the slider is let go (a click sound, never on hover)
    range.addEventListener('change', () => { if (!api.sound.on && +range.value > 0) api.sound.setOn(true); api.sfx('tick'); });
    document.addEventListener('pointerdown', e => { if (!pop.hidden && !pop.contains(e.target) && e.target !== btn && !btn.contains(e.target)) { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); } }, true);
    wrap.appendChild(btn);
    document.body.appendChild(pop);
  }

  /* ---------- next Steam sale: a countdown pill in the title bar ----------
     The dates are Valve's own published schedule (Steamworks "Upcoming events", announced July 2026), written here by
     hand: nothing is fetched, and SteamDB is never read (its FAQ forbids scraping); the pill only LINKS to its sale
     calendar. Times are Valve's 10 am Pacific start / end, in UTC. Add the next dates when Valve announces them; after
     the last one ends the pill hides itself. */
  const SALES = [
    { name: ['التخفيضات الشتوية', 'Winter Sale'], start: '2026-12-17T18:00:00Z', end: '2027-01-04T18:00:00Z' },
    { name: ['تخفيضات الربيع', 'Spring Sale'], start: '2027-03-18T17:00:00Z', end: '2027-03-25T17:00:00Z' },
    { name: ['التخفيضات الصيفية', 'Summer Sale'], start: '2027-06-24T17:00:00Z', end: '2027-07-08T17:00:00Z' },
  ];
  const STEAMDB_SALES = 'https://steamdb.info/sales/history/';
  function nextSale(now = Date.now()) {
    for (const s of SALES) {
      const a = Date.parse(s.start), b = Date.parse(s.end);
      if (now < b) return { name: T(s.name[0], s.name[1]), live: now >= a, ms: (now >= a ? b : a) - now, a, b };
    }
    return null;
  }
  const span = ms => {
    const m = Math.max(0, Math.floor(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60), mm = m % 60;
    return d ? T(`${d}ي ${h}س`, `${d}d ${h}h`) : h ? T(`${h}س ${mm}د`, `${h}h ${mm}m`) : T(`${mm}د`, `${mm}m`);
  };
  let saleKey = '';
  function paintSale() {
    const wrap = document.getElementById('rfs-navwrap'); if (!wrap) return;
    let pill = document.getElementById('slate-sale');
    const s = nextSale();
    const key = s ? `${s.name}|${s.live}|${span(s.ms)}` : 'none';
    if (pill && key === saleKey) return;     // write only when the shown text changes (once a minute at most)
    saleKey = key;
    if (!s) { if (pill) pill.remove(); return; }
    if (!pill) {
      pill = document.createElement('button');
      pill.id = 'slate-sale'; pill.type = 'button'; pill.className = 'rfs-tb';
      pill.innerHTML = `${ic('timer')}<span></span>`;
      pill.addEventListener('click', () => { api.sfx('tick'); try { api.steamUrl('steam://openurl/' + STEAMDB_SALES); } catch (e) { api.toast(T('ما قدرت أفتحها', 'Couldn\'t open that')); } });
      wrap.prepend(pill);
    }
    pill.classList.toggle('live', s.live);
    pill.querySelector('span').textContent = s.live ? T(`${s.name} · ينتهي بعد ${span(s.ms)}`, `${s.name} · ends in ${span(s.ms)}`) : T(`${s.name} بعد ${span(s.ms)}`, `${s.name} in ${span(s.ms)}`);
    const day = t => new Date(t).toLocaleDateString(T('ar', 'en'), { month: 'short', day: 'numeric' });
    pill.title = T(`${s.name}: ${day(s.a)} – ${day(s.b)} (جدول Valve). اضغط لتقويم التخفيضات في SteamDB.`, `${s.name}: ${day(s.a)} – ${day(s.b)} (Valve's schedule). Click for SteamDB's sale calendar.`);
  }

  buildChrome();
  // the active item follows navigation done anywhere (links, Steam's own buttons): checked twice a second, and the
  // DOM is touched only when the answer changes. The volume button and sale countdown join the title-bar pills once
  // they exist.
  // the game watch runs even while the window is hidden or minimized (that is when it matters); it reads one list
  setInterval(() => Rest.watch(), 2000);
  setInterval(() => { if (isSlate() && !document.hidden) { paintActive(railTarget()); if (!document.getElementById('slate-vol')) buildVolume(); paintSale(); } }, 500);
})();
