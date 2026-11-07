/* ═══ خزنة المغامر (Adventurer's Vault) — library home design ═══
   Your library as an RPG inventory screen, two framed windows side by side:
     • the CHARACTER window (sticky): level medallion from your total hours (floor of the square root) with an XP bar,
       a "paper doll" — the game you have equipped (the last one you played) in a big ornate socket on an arcane
       circle, flanked by six quick slots (the next games you played, keys 1–7) — your attributes, and the
       collection by rarity with the rule of each tier
     • the INVENTORY window: the one filter strip with the rarity chips in the same panel (they filter the bag here,
       no re-render), then the bag — portrait item slots framed by rarity = your hours in that game (common, uncommon,
       rare, epic, legendary), a gem = installed, a stack count = hours, empty sockets after the last item
     • ONE reused item tooltip that follows the cursor or the keyboard ring and stays inside the window
   Click = inspect at once (the item rises out of its slot into an item card: open() / close()), Ctrl+click = use,
   arrows + Enter (Ctrl+Enter = use) from the keyboard.
   Performance (docs/THEME-KIT.md): each slot is ONE element (art, rarity tint, gem, glow are its own background
   layers and box-shadows; the corner trim and the stack count are its two pseudo-elements), painted lazily; no
   animation, filter or transform at rest (only the hovered slot lifts); the DOM is written only in render() and on
   user input; the tooltip follows the mouse on the next animation frame. */
(function () {
  'use strict';
  const api = window.__rfsLayoutApi;
  if (!api) return;
  const { T, esc, div, $, ic, icT, cssUrl, first, lazy, fmtPlaytime, fmtAgo, fmtSize, NUM } = api;

  /* rarity by your hours in the game */
  const TIERS = [
    ['مجهول', 'Unidentified', 'ما لعبتها', 'Never played'],
    ['شائع', 'Common', 'أقل من ساعتين', 'Under 2 h'],
    ['غير شائع', 'Uncommon', '٢–١٠ ساعات', '2–10 h'],
    ['نادر', 'Rare', '١٠–٥٠ ساعة', '10–50 h'],
    ['ملحمي', 'Epic', '٥٠–٢٠٠ ساعة', '50–200 h'],
    ['أسطوري', 'Legendary', '٢٠٠ ساعة وأكثر', '200 h and more'],
  ];
  const tierName = r => T(TIERS[r][0], TIERS[r][1]);
  const tierRule = r => T(TIERS[r][2], TIERS[r][3]);
  function rarity(min) {
    if (!min) return 0;
    const h = min / 60;
    return h < 2 ? 1 : h < 10 ? 2 : h < 50 ? 3 : h < 200 ? 4 : 5;
  }
  /* the character's title, by level */
  const RANKS = [[70, 'أسطورة حيّة', 'Living Legend'], [50, 'بطل المملكة', 'Hero of the Realm'], [30, 'فارس', 'Knight'],
    [15, 'محارب متمرّس', 'Veteran'], [5, 'مغامر', 'Adventurer'], [0, 'مبتدئ', 'Novice']];
  const items = n => T(`${NUM.format(n)} لعبة`, `${NUM.format(n)} ${n === 1 ? 'item' : 'items'}`);
  /** the slot's stack count: your hours in it */
  const stack = min => !min ? '' : min < 60 ? T(`${NUM.format(min)}د`, `${NUM.format(min)}m`)
    : T(`${NUM.format(Math.round(min / 60))}س`, `${NUM.format(Math.round(min / 60))}h`);
  const itemLevel = min => (min ? Math.max(1, Math.round(min / 60)) : 0);
  const useLabel = (g, running) => running ? ic('pulse') + T('شغّالة الحين', 'Running now')
    : g.installed ? ic('play') + T('تشغيل', 'Play') : ic('download') + T('تثبيت', 'Install');

  /** paint art once per URL (lazy() calls again after the details arrive) */
  function paintArt(el, g, kind) {
    const u = kind === 'head' ? first(g.images.header) || first(g.images.capsule) : first(g.images.capsule) || first(g.images.header);
    if (u && el._vtUrl !== u) { el._vtUrl = u; el.style.setProperty('--img', cssUrl(u)); }
  }

  const Layout = {
    fixedHeight: false,
    dockInside: true,
    rar: -1, //      rarity filter of the bag (-1 = everything) — kept across renders
    kfId: 0, //      appid under the keyboard ring — kept across renders
    armed: true, //  arrow keys belong to the vault until you click into another part of Steam (e.g. its game list)

    render(games, w) {
      const all = (api.state && api.state.games) || games;
      const running = api.running();
      this.games = games; this.hov = null; this.kf = null; this.from = null; this.taken = null;
      cancelAnimationFrame(this.raf); this.raf = 0;

      /* ---- the character: level, attributes, the equipped game + six quick slots (= the last seven played) ---- */
      let mins = 0, inst = 0, played = 0;
      const own = [0, 0, 0, 0, 0, 0], recent = [];
      for (const g of all) {
        mins += g.playtimeMin || 0;
        if (g.installed) inst++;
        if (g.playtimeMin) played++;
        own[rarity(g.playtimeMin)]++;
        if (!g.lastPlayed) continue;
        // keep the seven most recent (insertion into a short sorted list — no sort of 900 games)
        let k = recent.length;
        while (k > 0 && recent[k - 1].lastPlayed < g.lastPlayed) k--;
        if (k < 7) { recent.splice(k, 0, g); if (recent.length > 7) recent.pop(); }
      }
      if (!recent.length && all[0]) recent.push(all[0]);
      this.quick = recent;
      const eq = recent[0] || null;
      const hours = mins / 60;
      // the character's level = the player's real Steam level (cached); until it arrives, the square root of hours
      const sl = api.steamLevelNow && api.steamLevelNow();
      if (!sl && api.steamLevel && !this._lvlAsked) { this._lvlAsked = true; api.steamLevel().then(v => { if (v) api.rerender(); }); }
      const lvl = sl && sl.level ? sl.level : Math.floor(Math.sqrt(hours));
      const from = lvl * lvl, to = (lvl + 1) * (lvl + 1);
      const pct = sl && sl.level ? (sl.pct || 0) : Math.max(0, Math.min(100, ((hours - from) / (to - from)) * 100));
      const rank = RANKS.find(x => lvl >= x[0]);
      const xpText = sl && sl.level ? T(`مستوى ستيم · ${pct}% للمستوى ${NUM.format(lvl + 1)}`, `Steam level · ${pct}% to level ${NUM.format(lvl + 1)}`)
        : T(`${NUM.format(Math.floor(hours))} / ${NUM.format(to)} ساعة للمستوى ${NUM.format(lvl + 1)}`, `${NUM.format(Math.floor(hours))} / ${NUM.format(to)} h to level ${NUM.format(lvl + 1)}`);
      // the whole collection by rarity, one segmented bar (unidentified → legendary in reading direction)
      const tot = all.length || 1, stops = [];
      let acc = 0;
      for (let r = 0; r < 6; r++) {
        if (!own[r]) continue;
        const a = (acc / tot) * 100; acc += own[r];
        stops.push(`rgb(var(--vt-r${r})) ${a.toFixed(2)}% ${((acc / tot) * 100).toFixed(2)}%`);
      }
      const dist = stops.length ? `linear-gradient(to ${api.LTR ? 'right' : 'left'}, ${stops.join(', ')})` : 'none';

      const qslot = (g, k, big) => {
        if (!g) return `<div class="vt-q empty"><i class="vt-k">${NUM.format(k)}</i></div>`;
        const r = rarity(g.playtimeMin), run = running.has(g.appid);
        return `<div class="${big ? 'vt-eqslot' : 'vt-q'} r${r}${g.installed ? '' : ' ni'}${run ? ' run' : ''}" data-appid="${g.appid}" data-k="${k}" role="button" aria-label="${esc(g.name)}">`
          + `<i class="vt-k">${NUM.format(k)}</i>${run ? `<i class="vt-run">${ic('pulse')}</i>` : ''}</div>`;
      };
      const side = a => `<div class="vt-doll-col">${a.map(k => qslot(recent[k - 1], k)).join('')}</div>`;
      const er = eq ? rarity(eq.playtimeMin) : 0;
      const doll = `
        <div class="vt-doll">
          ${side([2, 3, 4])}
          <div class="vt-doll-mid r${er}">${eq ? qslot(eq, 1, true) : `<div class="vt-eqslot empty"></div>`}</div>
          ${side([5, 6, 7])}
        </div>`;
      const eqInfo = eq ? `
        <div class="vt-eq r${er}">
          <span class="vt-eq-kick">${T('المُجهَّز حاليًا · آخر ما لعبت', 'Equipped · last played')}</span>
          <b class="vt-eq-name" dir="auto">${esc(eq.name)}</b>
          <div class="vt-eq-meta"><span class="vt-tier">${tierName(er)}</span><span>${esc(fmtPlaytime(eq.playtimeMin))}</span>${eq.lastPlayed ? `<span>${esc(fmtAgo(eq.lastPlayed))}</span>` : ''}</div>
          <div class="vt-eq-ach">${api.achHTML(eq)}</div>
          <div class="vt-eq-acts">
            <button class="vt-btn play" data-act="play">${useLabel(eq, running.has(eq.appid))}</button>
            <button class="vt-btn" data-act="inspect">${ic('info')}${T('افحص', 'Inspect')}</button>
          </div>
        </div>` : `<div class="vt-eq none">${T('ما في شي مُجهَّز بعد', 'Nothing equipped yet')}</div>`;
      const attr = (icon, label, v, r) => `<div class="vt-attr${r == null ? '' : ' r' + r}">${ic(icon)}<span>${label}</span><i></i><b>${NUM.format(v)}</b></div>`;
      const legend = [5, 4, 3, 2, 1, 0].map(r => `<div class="vt-lg r${r}"><i></i><span><b>${tierName(r)}</b><small>${tierRule(r)}</small></span><em>${NUM.format(own[r])}</em></div>`).join('');

      /* ---- the bag: rarity chips + one slot per game ---- */
      const rs = games.map(g => rarity(g.playtimeMin));
      const cnt = [0, 0, 0, 0, 0, 0];
      for (const r of rs) cnt[r]++;
      const chips = `<button class="vt-chip all" data-r="-1">${T('كل الأغراض', 'All items')}<b>${NUM.format(games.length)}</b></button>`
        + [5, 4, 3, 2, 1, 0].map(r => `<button class="vt-chip r${r}" data-r="${r}"${cnt[r] || r === this.rar ? '' : ' disabled'}>${tierName(r)}<b>${NUM.format(cnt[r])}</b></button>`).join('');
      let slots = '';
      for (let i = 0; i < games.length; i++) {
        const g = games[i], run = running.has(g.appid), h = stack(g.playtimeMin);
        slots += `<div class="vt-slot r${rs[i]}${g.installed ? '' : ' ni'}${run ? ' run' : ''}${g.appid === this.kfId ? ' kf' : ''}" data-appid="${g.appid}" data-i="${i}"${h ? ` data-h="${h}"` : ''} aria-label="${esc(g.name)}">`
          + (run ? `<i class="vt-run">${ic('pulse')}</i>` : '') + '</div>';
      }

      const el = div('vt' + (w && w < 820 ? ' narrow' : ''));
      el.innerHTML = `
        <aside class="vt-hero vt-frame"><div class="vt-hero-in">
          <header class="vt-id">
            <div class="vt-lvl" title="${esc(T('مستوى حسابك في ستيم', 'Your Steam account level'))}"><small>${T('المستوى', 'Level')}</small><b>${NUM.format(lvl)}</b></div>
            <div class="vt-id-t">
              <span class="vt-kicker">${T('ورقة الشخصية', 'Character')}</span>
              <b class="vt-rank">${T(rank[1], rank[2])}</b>
              <div class="vt-xp" title="${esc(xpText)}"><i style="width:${pct.toFixed(1)}%"></i></div>
              <small class="vt-xp-t">${xpText}</small>
            </div>
          </header>
          ${doll}
          ${eqInfo}
          <div class="vt-sec"><span>${T('الصفات', 'Attributes')}</span></div>
          <div class="vt-attrs">
            ${attr('library', T('ألعابك', 'Games owned'), all.length)}
            ${attr('hourglass', T('ساعات اللعب', 'Hours played'), Math.round(hours))}
            ${attr('drive', T('مثبّتة', 'Installed'), inst)}
            ${attr('check', T('جرّبتها', 'Played'), played)}
          </div>
          <div class="vt-sec"><span>${T('الندرة = ساعاتك', 'Rarity = your hours')}</span></div>
          <i class="vt-dist" style="background:${dist}"></i>
          <div class="vt-legend">${legend}</div>
        </div></aside>
        <section class="vt-main">
          <div class="vt-win vt-frame">
            <div class="vt-title"><h3>${T('حقيبة الأغراض', 'Inventory')}</h3></div>
            <div class="rf-dock rf-merge" data-rfs-dock><div class="vt-chips">${chips}</div></div>
            <div class="vt-sub"><span class="vt-count"></span>
              <span class="vt-hint">${T('نقرة أو Enter: افحص · نقرة مع Ctrl: شغّل · الأسهم للتنقل · 1–7 للخانات السريعة', 'Click or Enter: inspect · Ctrl+click: use · Arrow keys to move · 1–7: quick slots')}</span></div>
            <div class="vt-grid">${slots}</div>
            <div class="vt-none"></div>
          </div>
        </section>
        <div class="vt-tip" aria-hidden="true"></div>`;
      api.stage.replaceChildren(el);

      this.el = el; this.rs = rs;
      this.grid = $('.vt-grid', el); this.win = $('.vt-win', el); this.tip = $('.vt-tip', el); this.doll = $('.vt-doll', el);
      this.slots = Array.from(this.grid.children);
      this.socks = [];
      for (const s of this.slots) lazy(s, g => paintArt(s, g));
      for (const q of el.querySelectorAll('.vt-doll [data-appid]')) lazy(q, g => paintArt(q, g));
      if (this.kfId) this.kf = this.slots.find(s => +s.dataset.appid === this.kfId) || null;
      this.applyFilter();

      /* ---- the equipped game: Play / Inspect ---- */
      const eqEl = $('.vt-eq', el);
      if (eqEl && eq) {
        eqEl.addEventListener('click', e => {
          const b = e.target.closest('[data-act]');
          if (!b) return;
          if (b.dataset.act === 'play') api.launch(eq);
          else this.inspect(eq, $('.vt-eqslot', el));
        });
        // achievements are exact once the details are in: repaint just that line
        const achEl = $('.vt-eq-ach', eqEl);
        const paintAch = () => { if (achEl.isConnected) { achEl.innerHTML = api.achHTML(eq); achEl.hidden = !achEl.firstChild; } };
        achEl.hidden = !achEl.firstChild;
        if (!eq.detailed && api.Data && api.Data.ensureDetails) api.Data.ensureDetails(eq).then(paintAch);
      }

      /* ---- rarity chips: filter the bag in place ---- */
      $('.vt-chips', el).addEventListener('click', e => {
        const b = e.target.closest('.vt-chip');
        if (!b || b.disabled) return;
        const r = +b.dataset.r;
        this.rar = r === this.rar ? -1 : r; // the lit tier again = everything
        api.sfx('tick');
        this.hideTip();
        this.applyFilter();
      });

      /* ---- items (bag + paper doll): tooltip on hover, click = inspect at once, Ctrl+click = use ---- */
      const onClick = e => {
        const s = e.target.closest('[data-appid]');
        if (!s) return;
        const g = this.gameOf(s);
        if (!g) return;
        if (s.classList.contains('vt-slot')) this.setRing(s);
        if (e.ctrlKey || e.shiftKey || e.metaKey) { this.hideTip(); api.launch(g); return; }
        this.inspect(g, s);
      };
      for (const box of [this.grid, this.doll]) {
        box.addEventListener('pointermove', e => this.onMove(e));
        box.addEventListener('pointerleave', () => this.hideTip());
        box.addEventListener('click', onClick);
      }
      el.addEventListener('wheel', () => this.hideTip(), { passive: true }); // the card would point at a slot that scrolled away
    },

    gameOf(s) {
      return s.dataset.i != null ? this.games[+s.dataset.i] : api.byId(+s.dataset.appid);
    },

    /* ---------- rarity filter (one attribute on the grid; CSS hides the rest) + the empty sockets after the last item ---------- */
    applyFilter() {
      const r = this.rar, grid = this.grid;
      if (r >= 0) grid.dataset.r = String(r); else grid.removeAttribute('data-r');
      this.el.querySelectorAll('.vt-chip').forEach(b => b.classList.toggle('on', +b.dataset.r === r));
      this.vis = r < 0 ? this.slots : this.slots.filter((s, i) => this.rs[i] === r);
      const n = this.vis.length;
      $('.vt-count', this.el).textContent = r < 0 ? items(n) : `${tierName(r)} · ${items(n)}`;
      this.win.classList.toggle('empty', !n);
      if (!n) {
        $('.vt-none', this.el).textContent = this.games.length
          ? T('ما في ألعاب بهالندرة هنا', 'No games of this rarity here')
          : T('ما لقيت شي يطابق بحثك', 'Nothing matches your search');
      }
      if (this.kf && r >= 0 && this.rs[+this.kf.dataset.i] !== r) { this.setRing(null); this.hideTip(); }
      this.sockets(n);
    },
    /** finish the last row with empty sockets, plus one free row — it reads as a bag with room left */
    sockets(n) {
      const cols = n ? this.cols() : 0;
      const want = cols ? (cols - (n % cols)) % cols + cols : 0;
      while (this.socks.length > want) this.socks.pop().remove();
      if (this.socks.length < want) {
        const f = document.createDocumentFragment();
        while (this.socks.length < want) { const s = document.createElement('i'); s.className = 'vt-sock'; this.socks.push(s); f.append(s); }
        this.grid.append(f);
      }
    },

    /* ---------- the item tooltip ---------- */
    onMove(e) {
      if (this.taken && api.openId == null) this.untake();
      this.mx = e.clientX; this.my = e.clientY; this.mt = e.target;
      if (!this.raf) this.raf = requestAnimationFrame(() => {
        this.raf = 0;
        const s = this.mt && this.mt.closest ? this.mt.closest('[data-appid]') : null;
        if (s && s !== this.hov) { this.hov = s; this.fill(s); api.sfx('tick'); }
        if (this.hov) this.placeAt(this.mx, this.my); // over the gaps the card keeps the last item and follows
      });
    },
    fill(s) {
      const g = this.gameOf(s);
      if (!g) return;
      const r = rarity(g.playtimeMin), run = api.running().has(g.appid);
      // dir="auto": "7 GB" stays "7 GB" inside the Arabic card, Arabic values stay right-to-left
      const row = (k, v) => `<div class="tt-row"><span>${k}</span><i></i><b dir="auto">${v}</b></div>`;
      const state = run ? `<div class="tt-state run">${ic('pulse')}${T('شغّالة الحين', 'Running now')}</div>`
        : g.installed ? `<div class="tt-state ok">${ic('check')}${T('مثبّتة وجاهزة للاستخدام', 'Installed, ready to use')}</div>`
          : `<div class="tt-state no">${ic('download')}${T('غير مثبّتة — نقرة مع Ctrl للتثبيت', 'Not installed — Ctrl+click to install')}</div>`;
      const ach = api.achHTML(g);
      const tip = this.tip;
      tip.className = 'vt-tip on r' + r;
      tip.innerHTML = `
        <b class="tt-name" dir="auto">${esc(g.name)}</b>
        <div class="tt-type"><span>${T(`غرض ${tierName(r)}`, `${tierName(r)} item`)}</span><span class="tt-il">${T('مستوى', 'Item level')} ${NUM.format(itemLevel(g.playtimeMin))}</span></div>
        ${g.genres && g.genres.length ? `<div class="tt-genre" dir="auto">${esc(g.genres.slice(0, 3).join(T('، ', ', ')))}</div>` : ''}
        <i class="tt-rule"></i>
        ${row(T('وقت اللعب', 'Play time'), esc(fmtPlaytime(g.playtimeMin)))}
        ${g.playtime2wksMin ? `<div class="tt-bonus">+${esc(fmtPlaytime(g.playtime2wksMin))} ${T('آخر أسبوعين', 'in the past two weeks')}</div>` : ''}
        ${row(T('آخر استخدام', 'Last used'), g.lastPlayed ? esc(fmtAgo(g.lastPlayed)) : T('ولا مرة', 'Never'))}
        ${row(T('الحجم', 'Size'), g.installed && g.sizeOnDisk ? esc(fmtSize(g.sizeOnDisk)) : esc((api.sizeText ? api.sizeText(g) : '—')))}
        ${ach ? `<div class="tt-ach">${ach}</div>` : ''}
        ${state}
        <div class="tt-foot">${T('نقرة: افحص · نقرة مع Ctrl: استخدم', 'Click: inspect · Ctrl+click: use')}</div>`;
      this.tw = tip.offsetWidth; this.th = tip.offsetHeight; // measured once per item, not per mouse move
      // the exact achievement count comes with the details: refill this card once, if it still shows this item
      if (!g.detailed && api.Data && api.Data.ensureDetails) {
        api.Data.ensureDetails(g).then(() => {
          if (tip.classList.contains('on') && (this.hov === s || (this.kf === s && !this.hov))) this.fill(s);
        });
      }
    },
    /** beside the cursor, on the reading-forward side, flipped / clamped so it never leaves the window */
    placeAt(x, y) {
      const W = innerWidth, H = innerHeight, w = this.tw || 280, h = this.th || 190, gap = 18;
      let left = api.LTR ? x + gap : x - gap - w;
      if (left + w > W - 8) left = x - gap - w;
      if (left < 8) left = x + gap;
      left = Math.max(8, Math.min(left, W - 8 - w));
      let top = y + gap;
      if (top + h > H - 8) top = y - gap - h;
      top = Math.max(8, Math.min(top, H - 8 - h));
      this.tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    },
    /** beside a slot (keyboard ring) */
    placeBy(rc) {
      const W = innerWidth, H = innerHeight, w = this.tw || 280, h = this.th || 190, gap = 12;
      const after = api.LTR ? rc.right + gap : rc.left - gap - w;
      const before = api.LTR ? rc.left - gap - w : rc.right + gap;
      let left = after >= 8 && after + w <= W - 8 ? after : before;
      left = Math.max(8, Math.min(left, W - 8 - w));
      const top = Math.max(8, Math.min(rc.top, H - 8 - h));
      this.tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    },
    hideTip() {
      this.hov = null;
      if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
      if (this.tip) this.tip.classList.toggle('on', false);
    },

    /* ---------- inspect = the core opens our item card (open() below) at once ---------- */
    inspect(g, el) {
      this.hideTip();
      this.from = el && el.isConnected ? { id: String(g.appid), el } : null;
      api.openGame(g, this.source(g.appid));
    },
    untake() {
      if (this.taken) this.taken.classList.toggle('taken', false);
      this.taken = null;
    },

    /* ---------- the item card: the item rises out of its slot, the card unfolds around it ---------- */
    async open(g, sheet, src) {
      this.hideTip();
      this.untake();
      const r = rarity(g.playtimeMin), run = api.running().has(g.appid);
      const facts = api.gameFacts(g), desc = api.gameDesc(g);
      const kick = this.quick && this.quick[0] && this.quick[0].appid === g.appid ? T('المُجهَّز حاليًا', 'Equipped') : T('فحص الغرض', 'Inspect item');
      const state = run ? `<span class="x-state run">${ic('pulse')}${T('شغّالة الحين', 'Running now')}</span>`
        : g.installed ? `<span class="x-state ok">${ic('check')}${T('مثبّتة وجاهزة', 'Installed, ready')}</span>`
          : `<span class="x-state no">${ic('download')}${T('غير مثبّتة', 'Not installed')}</span>`;
      sheet.innerHTML = `
        <div class="vx-dim"></div>
        <div class="vx-glow r${r}"></div>
        <article class="vx r${r}" role="dialog" aria-label="${esc(g.name)}">
          <div class="vx-frame"><div class="vx-hero"></div></div>
          <div class="vx-art"></div>
          <div class="vx-body">
            <span class="vx-kick">${kick}</span>
            <h2 class="vx-name" dir="auto">${esc(g.name)}</h2>
            <div class="vx-type"><span class="vx-tier">${T(`غرض ${tierName(r)}`, `${tierName(r)} item`)}</span><span class="vx-il">${T('مستوى الغرض', 'Item level')} ${NUM.format(itemLevel(g.playtimeMin))}</span></div>
            ${g.genres && g.genres.length ? `<div class="vx-genre" dir="auto">${esc(g.genres.slice(0, 4).join(T('، ', ' · ')))}</div>` : ''}
            <i class="vx-rule"></i>
            <dl class="vx-stats">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><i></i><dd dir="auto" title="${esc(v)}">${esc(v)}</dd></div>`).join('')}</dl>
            ${desc ? `<p class="vx-flav" dir="auto">${esc(desc)}</p>` : ''}
            <div class="vx-foot">${state}</div>
          </div>
          <button class="vx-close" data-close title="${esc(T('إغلاق (Esc)', 'Close (Esc)'))}">${ic('x')}</button>
        </article>`;
      const card = $('.vx', sheet), art = $('.vx-art', card), hero = $('.vx-hero', card), body = $('.vx-body', card);
      $('.vx-foot', body).append(api.gameActions(g));
      // art: the portrait at once; the hero band shows the small header first, the big hero over it when it arrives
      paintArt(art, g);
      const head = first(g.images.header), big = first(g.images.hero);
      hero.style.backgroundImage = [big && cssUrl(big), head && cssUrl(head)].filter(Boolean).join(', ') || 'none';

      // the slot it came from is left as an empty socket while the card is open
      const from = src && src.el && src.el.isConnected ? src.el : null;
      if (from && from.matches('.vt-slot, .vt-q, .vt-eqslot')) { from.classList.toggle('taken', true); this.taken = from; }
      this.openFrom = from;
      api.sfx('slide');
      const play = $('.rf-act.play', card);
      if (play) play.focus({ preventScroll: true });

      const anims = [];
      const A = (node, kf, o) => { const a = node.animate(kf, { fill: 'backwards', easing: 'cubic-bezier(.2,.8,.25,1)', ...o }); anims.push(a.finished.catch(() => {})); };
      A($('.vx-dim', sheet), [{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
      A($('.vx-glow', sheet), [{ opacity: 0, transform: 'scale(.55)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 60 });
      A($('.vx-frame', card), [{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 340, delay: 90 });
      A(body, [{ opacity: 0, transform: `translateX(${api.LTR ? -14 : 14}px)` }, { opacity: 1, transform: 'none' }], { duration: 330, delay: 230 });
      A($('.vx-close', card), [{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: 300 });
      A(art, this.flight(art, from), { duration: 470, easing: 'cubic-bezier(.22,.9,.3,1.04)' });
      await Promise.all(anims);
    },
    async close(sheet) {
      const card = $('.vx', sheet);
      if (!card) { this.untake(); return; }
      api.sfx('close');
      const art = $('.vx-art', card);
      const back = this.openFrom && this.openFrom.isConnected && this.openFrom.offsetParent !== null ? this.openFrom : null;
      const opt = { fill: 'forwards', easing: 'cubic-bezier(.5,0,.75,0)' };
      const anims = [
        $('.vx-body', card).animate([{ opacity: 1 }, { opacity: 0 }], { ...opt, duration: 140 }),
        $('.vx-close', card).animate([{ opacity: 1 }, { opacity: 0 }], { ...opt, duration: 120 }),
        $('.vx-frame', card).animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.94)' }], { ...opt, duration: 230, delay: 50 }),
        $('.vx-glow', sheet).animate([{ opacity: 1 }, { opacity: 0 }], { ...opt, duration: 220 }),
        $('.vx-dim', sheet).animate([{ opacity: 1 }, { opacity: 0 }], { ...opt, duration: 260, delay: 110 }),
        art.animate(this.flight(art, back).reverse(), { fill: 'forwards', duration: 330, easing: 'cubic-bezier(.45,0,.2,1)' }),
      ];
      await Promise.all(anims.map(a => a.finished.catch(() => {})));
      this.untake();
      this.openFrom = null;
    },
    /** keyframes that carry the card's art from the slot (or rise from below when the slot isn't on screen) */
    flight(art, from) {
      const b = art.getBoundingClientRect();
      const r = from ? from.getBoundingClientRect() : null;
      if (r && r.width > 4 && r.bottom > 0 && r.top < innerHeight && b.width > 4) {
        const sx = r.width / b.width, sy = r.height / b.height;
        return [
          { transformOrigin: '0 0', transform: `translate(${(r.left - b.left).toFixed(1)}px, ${(r.top - b.top).toFixed(1)}px) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`, opacity: 1 },
          { transformOrigin: '0 0', transform: 'none', opacity: 1 },
        ];
      }
      return [{ transformOrigin: '50% 50%', transform: 'translateY(40px) scale(.7)', opacity: 0 }, { transformOrigin: '50% 50%', transform: 'none', opacity: 1 }];
    },

    /* ---------- keyboard: a gold ring moves across the bag ---------- */
    setRing(s) {
      if (this.kf !== s) {
        if (this.kf) this.kf.classList.toggle('kf', false);
        this.kf = s || null;
        if (s) s.classList.toggle('kf', true);
      }
      this.kfId = s ? +s.dataset.appid : 0;
    },
    showRing() {
      const s = this.kf;
      if (!s) return;
      s.scrollIntoView({ block: 'nearest' });
      this.fill(s);
      this.hov = null; // the mouse takes the card back on its next move
      this.placeBy(s.getBoundingClientRect());
    },
    cols() {
      const t = getComputedStyle(this.grid).gridTemplateColumns || '';
      const n = /repeat|auto/.test(t) ? 0 : t.trim().split(/\s+/).filter(Boolean).length;
      if (n) return n;
      const a = this.vis[0];
      return a ? Math.max(1, Math.round(this.grid.clientWidth / (a.offsetWidth + 10))) : 1;
    },
    /** the first item you can see (so the ring starts where you are, not at the top of a long bag) */
    firstInView(vis) {
      const top = Math.max(0, this.grid.getBoundingClientRect().top);
      for (let i = 0; i < vis.length; i++) if (vis[i].getBoundingClientRect().bottom > top + 4) return i;
      return 0;
    },
    key(e) {
      if (!this.grid || !this.grid.isConnected || !this.armed) return false;
      const k = e.key;
      // 1–7: the paper doll's quick slots (1 = equipped)
      if (/^[1-7]$/.test(k) && !e.altKey && !e.ctrlKey && !e.metaKey) {
        const q = this.quick && this.quick[+k - 1];
        if (!q) return false;
        const el = this.doll && this.doll.querySelector(`[data-k="${k}"][data-appid]`);
        this.inspect(q, el);
        return true;
      }
      if (k === 'Enter') {
        const s = this.kf;
        if (!s || !s.isConnected || s.offsetParent === null) return false;
        const g = this.games[+s.dataset.i];
        if (!g) return false;
        if (e.ctrlKey || e.shiftKey) { this.hideTip(); api.launch(g); } else this.inspect(g, s);
        return true;
      }
      if (k === 'Escape') {
        if (!this.kf) return false;
        this.setRing(null); this.hideTip();
        return true;
      }
      const dx = k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0;
      const dy = k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : 0;
      if ((!dx && !dy) || e.altKey || e.ctrlKey || e.metaKey) return false;
      const vis = this.vis || [];
      if (!vis.length) return false;
      let i = this.kf ? vis.indexOf(this.kf) : -1;
      if (i < 0) i = this.firstInView(vis);
      else {
        const cols = this.cols(), last = vis.length - 1;
        const j = i + dy * cols + dx * (api.LTR ? 1 : -1); // the bag runs right-to-left in Arabic
        if (j < 0) i = dy ? i : 0; //                                       top row: stay
        else if (j > last) i = dy && Math.floor(i / cols) === Math.floor(last / cols) ? i : last; // bottom row: stay
        else i = j;
      }
      this.setRing(vis[i]);
      this.showRing();
      api.sfx('tick');
      return true;
    },

    source(appid) {
      const id = String(appid), f = this.from;
      if (f && f.id === id && f.el.isConnected && f.el.offsetParent !== null) return { el: f.el, slot: f.el, isSpine: false };
      const s = api.stage.querySelector(`.vt-slot[data-appid="${id}"]`);
      if (s && s.offsetParent !== null) return { el: s, slot: s, isSpine: false };
      const q = api.stage.querySelector(`.vt-doll [data-appid="${id}"]`);
      return q ? { el: q, slot: q, isSpine: false } : null;
    },
  };

  // arrow keys stay with Steam's own lists after you click into them; a click in the vault takes them back
  // (our own panels — the item card, the theme picker, the toast — don't count either way)
  document.addEventListener('pointerdown', e => {
    const t = e.target;
    if (!t || !t.closest || t.closest('#rfs-viewer, #rfs-sheet, #rfs-themes, #rfs-toast')) return;
    Layout.armed = !!(Layout.el && Layout.el.isConnected && Layout.el.contains(t));
  }, true);

  api.register('vault', Layout);
})();
