/* ═══ Terminal (الطرفية) — library home design ═══
   A terminal window that fills the home panel:
     title bar  ·  a prompt that echoes the current view as a command  ·  the filter strip (dock)
     a table of every game (line no. · status · name · hours · size · last played)  |  "cat <game>.info" for the cursor row
     a status line with the keys and the position
   The cursor (inverse-video row) follows the mouse and the arrow keys; the info pane follows the cursor on the next
   animation frame (no debounce). A click or Enter opens the game as a "man page" printed into the terminal (open()).
   One row element + 5 spans per game (the line number is a CSS counter), no images in the rows; the one picture
   (the cursor game's small header image) is painted in the info pane. Registers itself with shelf.js — docs/THEME-KIT.md. */
(function () {
  'use strict';
  const api = window.__rfsLayoutApi;
  if (!api) return;
  const { T, esc, div, $, cssUrl, first, fmtPlaytime, fmtAgo, fmtSize, NUM } = api;

  const PROMPT_USER = 'player';                                            // the prompt reads  player@steam:~$
  const SORT_COL = { name: 'nm', playtime: 'hr', size: 'sz', recent: 'lp' }; // which column shows the sort mark
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

  /* ---------- formatting ---------- */
  const pad2 = n => String(n).padStart(2, '0');
  const isoDate = ts => {
    if (!ts) return '—';
    const d = new Date(ts * 1000);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };
  /** hours as a bare column figure: "0.4", "12.5", "1,204" */
  const hours = min => {
    if (!min) return '—';
    const h = Math.max(0.1, min / 60);
    return NUM.format(h >= 100 ? Math.round(h) : Math.round(h * 10) / 10);
  };
  /** "20 GB" as one left-to-right run — inside Arabic text it would otherwise read "GB 20" */
  const size = b => '⁦' + fmtSize(b) + '⁩';
  /** shell-quote a value for the prompt line */
  const shq = v => (/^[\w.:@%+-]+$/.test(v) ? v : `"${String(v).replace(/(["\\$`])/g, '\\$1')}"`);
  /** "ELDEN RING" → "elden_ring" (non-Latin names fall back to the app id) */
  const slug = g => {
    const s = String(g.name || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 28).replace(/_+$/, '');
    return s || 'app_' + g.appid;
  };
  const infoFile = g => slug(g) + '.info';

  /** the current view as a command, e.g.  ls games --installed --sort=playtime --tag="RPG" | grep -i "souls"
      (always English: it is a command, not interface text) */
  function commandHTML(s) {
    const tok = (cls, t) => `<span class="${cls}">${esc(t)}</span>`;
    const flag = (k, v) => ' ' + tok('tm-f', '--' + k + (v == null ? '' : '=')) + (v == null ? '' : tok('tm-v', shq(v)));
    let h = tok('tm-k', 'ls') + ' ' + tok('tm-w', 'games');
    if (s.source === 'installed') h += flag('installed');
    else if (s.source === 'favorite') h += flag('favorites');
    else if (s.source && s.source !== 'all') h += flag('collection', String(s.source));
    h += flag('sort', s.sort || 'recent');
    if (s.genre) h += flag('tag', String(s.genre));
    const q = String(s.query || '').trim();
    if (q) h += ' ' + tok('tm-f', '|') + ' ' + tok('tm-k', 'grep') + ' ' + tok('tm-f', '-i') + ' ' + tok('tm-v', shq(q));
    return h;
  }

  /** column-header sort: goes through the filter strip's own sort menu, so the choice is saved like any other */
  function setSort(v) {
    if (!v || api.state.sort === v) return;
    const b = document.querySelector(`#rfs-bar .tb-sort .rf-dd-menu button[data-v="${v}"]`);
    if (b) b.click();
    else { api.state.sort = v; api.rerender(); }
  }

  const Layout = {
    fixedHeight: true,
    dockInside: true,
    games: [], rows: [], cur: 0, selId: 0, shownId: 0,
    el: null, list: null, info: null, frame: null, img: null, imgU: null, raf: 0, pf: 0,

    render(games, w, h) {
      const prevTop = this.list && this.list.isConnected ? this.list.scrollTop : 0;
      cancelAnimationFrame(this.raf); this.raf = 0;
      cancelAnimationFrame(this.pf); this.pf = 0;
      this.games = games;
      this.shownId = 0;
      // keep the cursor across re-renders (search, sort, resize, library refresh) when the game is still listed
      let sel = this.selId ? games.findIndex(g => g.appid === this.selId) : 0;
      if (sel < 0) sel = 0;
      this.cur = sel;
      this.selId = games[sel] ? games[sel].appid : 0;

      const s = api.state;
      const lib = s.games || [];
      let inst = 0, bytes = 0;
      for (const g of lib) if (g.installed) { inst++; bytes += g.sizeOnDisk || 0; }
      const running = api.running();

      // narrower windows drop the size column first, then the date
      const infoW = Math.round(Math.min(400, Math.max(290, w * 0.31)));
      const listW = w - 34 - infoW;
      const el = div('tm' + (listW < 560 ? ' nsz' : '') + (listW < 450 ? ' nlp' : ''));
      el.style.height = h + 'px';
      el.style.setProperty('--tm-info-w', infoW + 'px');
      el.style.setProperty('--tm-ln', String(Math.max(3, String(games.length).length)));

      const sc = SORT_COL[s.sort] || 'lp';
      const sortTip = esc(T('اضغط للترتيب حسب هذا العمود', 'Click to sort by this column'));
      const th = (k, label, sort) => `<span class="c-${k}${sc === k ? ' on' : ''}" data-sort="${sort}" title="${sortTip}">${esc(label)}</span>`;
      const meta = T(
        `${NUM.format(lib.length)} لعبة · ${NUM.format(inst)} مثبتة${bytes ? ' · ' + size(bytes) : ''}`,
        `${NUM.format(lib.length)} ${lib.length === 1 ? 'game' : 'games'} · ${NUM.format(inst)} installed${bytes ? ' · ' + size(bytes) : ''}`);
      const key = k => `<kbd>${k}</kbd>`;

      el.innerHTML = `
        <div class="tm-win">
          <div class="tm-title">
            <span class="tm-dots" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="tm-ttl" dir="ltr">~/library — steam</span>
            <span class="tm-meta">${esc(meta)}</span>
          </div>
          <div class="tm-head">
            <div class="tm-cmd" dir="ltr"><span class="tm-u">${esc(PROMPT_USER)}@steam</span><span class="tm-s">:</span><span class="tm-p">~</span><span class="tm-s">$ </span>${commandHTML(s)}<i class="tm-cur" aria-hidden="true"></i></div>
            <div class="rf-dock" data-rfs-dock></div>
          </div>
          <div class="tm-body">
            <div class="tm-list">
              <div class="tm-th"><span class="c-st" title="${esc(T('الحالة: مربع ممتلئ = مثبتة، إطار فاضي = غير مثبتة، نابض = شغّالة الحين', 'Status: filled = installed, outline = not installed, pulsing = running'))}"></span>${th('nm', T('الاسم', 'Name'), 'name')}${th('hr', T('الساعات', 'Hours'), 'playtime')}${th('sz', T('الحجم', 'Size'), 'size')}${th('lp', T('آخر لعب', 'Last played'), 'recent')}</div>
              <div class="tm-rows"></div>
            </div>
            <aside class="tm-info">
              <div class="tm-cat" dir="ltr"></div>
              <div class="tm-frame" title="${esc(T('افتح صفحة اللعبة', 'Open this game'))}"><div class="tm-img"></div></div>
              <h3 class="tm-name" dir="auto"></h3>
              <div class="tm-ach" hidden></div>
              <dl class="tm-kv"></dl>
              <div class="tm-about"><span class="tm-cmt">${esc(T('# نبذة', '# about'))}</span><p class="tm-desc" dir="auto"></p></div>
              <div class="tm-acts">
                <button class="tm-act go" data-act="play"></button>
                <button class="tm-act" data-act="open">${esc(T('افتح', 'Open'))}</button>
                <button class="tm-act" data-act="page">${esc(T('صفحة اللعبة', 'Game page'))}</button>
              </div>
            </aside>
          </div>
          <div class="tm-status">
            <span class="tm-mode">${esc(T('المكتبة', 'Library'))}</span>
            <span class="tm-keys"><span dir="ltr">${key('↑')}${key('↓')}</span> ${esc(T('تنقّل', 'move'))}<i>·</i><span dir="ltr">${key('PgUp')}${key('PgDn')}</span> ${esc(T('صفحة', 'page'))}<i>·</i><span dir="ltr">${key('Home')}${key('End')}</span> ${esc(T('الأول والأخير', 'first / last'))}<i>·</i><span dir="ltr">${key('Enter')}</span> ${esc(T('افتح', 'open'))}<i>·</i><span dir="ltr">${key('Ctrl')}+${key('Enter')}</span> ${esc(T('تشغيل', 'play'))}</span>
            <span class="tm-pos" dir="ltr"></span>
          </div>
        </div>`;

      // every game: one row element + five spans, built as one string (900+ games)
      const rowsEl = $('.tm-rows', el);
      if (games.length) {
        let html = '';
        for (let i = 0; i < games.length; i++) {
          const g = games[i];
          const cls = 'tm-r' + (g.installed ? '' : ' ni') + (running.has(g.appid) ? ' run' : '') + (i === sel ? ' sel' : '');
          html += `<div class="${cls}" data-i="${i}" data-appid="${g.appid}"><span class="c-st"></span><span class="c-nm" dir="auto">${esc(g.name)}</span><span class="c-hr">${hours(g.playtimeMin)}</span><span class="c-sz">${g.installed && g.sizeOnDisk ? esc(size(g.sizeOnDisk)) : '—'}</span><span class="c-lp">${isoDate(g.lastPlayed)}</span></div>`;
        }
        rowsEl.innerHTML = html;
        this.rows = rowsEl.children;
      } else {
        const filtered = String(s.query || '').trim() || s.genre;
        rowsEl.innerHTML = `<div class="tm-empty"><code dir="ltr">ls: ${filtered ? 'no match' : 'games: empty'}</code><span>${esc(filtered ? T('ما لقيت شي يطابق بحثك', 'Nothing matches your search') : T('ما في ألعاب هنا', 'No games here'))}</span></div>`;
        this.rows = [];
      }

      api.stage.replaceChildren(el);
      this.el = el;
      this.list = $('.tm-list', el);
      this.info = $('.tm-info', el);
      this.frame = $('.tm-frame', el);
      this.img = $('.tm-img', el);
      this.imgU = null;
      this.catEl = $('.tm-cat', el);
      this.nameEl = $('.tm-name', el);
      this.kv = $('.tm-kv', el);
      this.achEl = $('.tm-ach', el);
      this.desc = $('.tm-desc', el);
      this.playBtn = $('.tm-act.go', el);
      this.posEl = $('.tm-pos', el);

      // mouse: the cursor follows the pointer (CSS :hover lights the row at once, the pane follows next frame);
      // a single click opens the game straight away; column headers sort
      let px = NaN, py = NaN;
      rowsEl.addEventListener('mousemove', e => {
        if (e.screenX === px && e.screenY === py) return; // the list scrolled under a still pointer: not a real move
        px = e.screenX; py = e.screenY;
        const r = e.target.closest('.tm-r');
        if (r) this.select(+r.dataset.i, true);
      });
      this.list.addEventListener('click', e => {
        const hc = e.target.closest('.tm-th [data-sort]');
        if (hc) { setSort(hc.dataset.sort); return; }
        const r = e.target.closest('.tm-r');
        if (!r) return;
        this.select(+r.dataset.i, true);
        this.open1();
      });
      this.list.addEventListener('scroll', () => { if (!this.pf) this.pf = requestAnimationFrame(() => this.prefetch()); }, { passive: true });
      $('.tm-acts', el).addEventListener('click', e => {
        const b = e.target.closest('[data-act]');
        const g = this.games[this.cur];
        if (!b || !g) return;
        if (b.dataset.act === 'play') api.launch(g);
        else if (b.dataset.act === 'open') this.open1();
        else api.openDetails(g.appid);
      });
      this.frame.addEventListener('click', () => this.open1());

      if (games.length) this.showInfo(games[sel]);
      else {
        this.info.classList.add('none');
        this.catEl.innerHTML = '<span class="tm-s">$</span> cat <b>*.info</b>';
        this.nameEl.textContent = T('ما في لعبة محددة', 'No game selected');
        this.posEl.textContent = '0/0';
      }

      // keep the reading position, then make sure the cursor row is on screen (after the strip has docked)
      this.list.scrollTop = prevTop;
      requestAnimationFrame(() => { this.reveal(); this.prefetch(); });
    },

    /** move the cursor (index into the rendered list); hover = from the mouse (no scrolling, no tick) */
    select(i, hover) {
      const n = this.games.length;
      if (!n) return;
      i = Math.max(0, Math.min(n - 1, i));
      if (i === this.cur) { if (!hover) this.reveal(); return; }
      const old = this.rows[this.cur];
      if (old) old.classList.toggle('sel', false);
      this.cur = i;
      this.selId = this.games[i].appid;
      const r = this.rows[i];
      if (r) r.classList.toggle('sel', true);
      if (!hover) { this.reveal(); api.sfx('tick'); }
      // the pane follows on the next frame: a held arrow key or a fast sweep of the mouse paints it once per frame
      if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.showInfo(this.games[this.cur]); });
    },
    reveal() {
      const r = this.rows[this.cur];
      if (r && r.isConnected) r.scrollIntoView({ block: 'nearest' });
    },
    /** open the cursor game now (the pane catches up first, so the panel and the pane agree) */
    open1() {
      const g = this.games[this.cur];
      if (!g) return;
      if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; this.showInfo(g); }
      api.openGame(g, this.source(g.appid));
    },
    /** ask Steam for the details (header image, description) of the rows on screen, so hovering one shows them at once */
    prefetch() {
      this.pf = 0;
      const l = this.list;
      if (!l || !l.isConnected || !this.games.length) return;
      const D = api.Data;
      if (!D || typeof D.ensureDetails !== 'function' || (D.queue && D.queue.length > 24)) return;
      const rowH = (this.rows[0] && this.rows[0].offsetHeight) || 24;
      const a = Math.max(0, Math.floor(l.scrollTop / rowH) - 4);
      const b = Math.min(this.games.length, a + Math.ceil(l.clientHeight / rowH) + 10);
      for (let i = a; i < b; i++) {
        const g = this.games[i];
        if (g.detailed) this.warm(g);
        else D.ensureDetails(g).then(gg => this.warm(gg));
      }
    },
    /** load a row's small header image into the cache (no DOM), so hovering the row paints it in the same frame */
    warmed: new Set(),
    warm(g) {
      const u = first(g.images.header);
      if (!u || this.warmed.has(u) || this.warmed.size > 600) return;
      this.warmed.add(u);
      const im = new Image(); im.decoding = 'async'; im.src = u;
    },

    /** "cat <game>.info": everything Steam already has, at once; the header image + description as soon as they arrive */
    showInfo(g) {
      if (!g || !this.info) return;
      this.posEl.textContent = `${NUM.format(this.cur + 1)}/${NUM.format(this.games.length)}`;
      if (this.shownId === g.appid) return;
      this.shownId = g.appid;
      this.info.classList.toggle('none', false);
      this.catEl.innerHTML = `<span class="tm-s">$</span> cat <b>${esc(infoFile(g))}</b>`;
      this.nameEl.textContent = g.name;
      this.fillKv(g);
      this.fillAch(g);
      this.fillDesc(g);
      this.fillPlay(g);
      this.frame.dataset.appid = g.appid;
      this.paintImg(g);
      if (!g.detailed) {
        api.Data.ensureDetails(g).then(gg => {
          if (this.shownId !== gg.appid || !this.frame || !this.frame.isConnected) return;
          this.fillKv(gg); this.fillAch(gg); this.fillDesc(gg); this.paintImg(gg);
        });
      }
    },
    /** TROPHIES [#####.....] 12/50 52%  — a text gauge; it fills from the reading start (right in Arabic) */
    fillAch(g) {
      const a = api.gameAch(g), box = this.achEl;
      if (!box) return;
      box.hidden = !a;
      if (!a) { box.textContent = ''; return; }
      const W = 10, k = Math.max(a.got ? 1 : 0, Math.min(W, Math.round(a.pct / 10)));
      const fill = `<b>${'#'.repeat(k)}</b>`, rest = `<i>${'.'.repeat(W - k)}</i>`;
      box.classList.toggle('done', a.got >= a.total);
      box.title = T(`الإنجازات: ${NUM.format(a.got)} من ${NUM.format(a.total)}`, `Achievements: ${NUM.format(a.got)} of ${NUM.format(a.total)}`);
      box.innerHTML = `<span class="tm-ach-k">${esc(T('الإنجازات', 'TROPHIES'))}</span>`
        + `<span class="tm-ach-g" dir="ltr">[${api.LTR ? fill + rest : rest + fill}]</span>`
        + `<span class="tm-ach-n" dir="ltr">${NUM.format(a.got)}/${NUM.format(a.total)}</span>`
        + `<span class="tm-ach-p" dir="ltr">${a.pct}%</span>`;
    },
    fillKv(g) {
      const run = api.running().has(g.appid);
      const dim = t => `<i class="tm-dim">${esc(t)}</i>`;
      const rows = [[T('وقت اللعب', 'playtime'), esc(fmtPlaytime(g.playtimeMin))]];
      if (g.playtime2wksMin) rows.push([T('آخر أسبوعين', 'past_2_weeks'), esc(fmtPlaytime(g.playtime2wksMin))]);
      rows.push([T('آخر مرة لعبت', 'last_played'), g.lastPlayed ? `${esc(fmtAgo(g.lastPlayed))} ${dim(isoDate(g.lastPlayed))}` : esc(T('ما لعبتها بعد', 'never'))]);
      rows.push([T('الحجم', 'size'), g.installed && g.sizeOnDisk ? esc(size(g.sizeOnDisk)) + (g.drive ? ' ' + dim(g.drive) : '') : '—']);
      rows.push([T('مثبتة', 'installed'), (g.installed ? `<b class="ok">${esc(T('نعم', 'yes'))}</b>` : `<b class="no">${esc(T('لا', 'no'))}</b>`)
        + (run ? ` <b class="run">${esc(T('· شغّالة الحين', '· running'))}</b>` : '')]);
      rows.push([T('الأنواع', 'genres'), g.genres && g.genres.length ? `<span dir="auto">${esc(g.genres.join(T('، ', ', ')))}</span>` : '—']);
      if (g.releaseDate) rows.push([T('سنة الإصدار', 'released'), esc(g.releaseDate)]);
      rows.push([T('رقم التطبيق', 'appid'), dim(g.appid)]);
      this.kv.innerHTML = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('');
    },
    fillDesc(g) {
      const text = g.detailed ? (g.description || T('ما في وصف لهذي اللعبة.', 'No description available.')) : T('جاري القراءة…', 'reading…');
      this.desc.textContent = text;
      this.desc.classList.toggle('dim', !g.detailed || !g.description);
    },
    fillPlay(g) {
      const run = api.running().has(g.appid);
      this.playBtn.textContent = run ? T('شغّالة', 'Running') : g.installed ? T('تشغيل', 'Play') : T('تثبيت', 'Install');
      this.playBtn.classList.toggle('run', run);
    },
    /** the small header image (460×215) — at once when Steam already has it; the portrait capsule only if there is no header */
    paintImg(g) {
      if (!g || g.appid !== this.shownId || !this.frame) return;
      this.setImg(first(g.images.header) || (g.detailed ? first(g.images.capsule) : ''));
    },
    setImg(u) {
      if (u === this.imgU) return;
      this.imgU = u;
      this.img.style.setProperty('--img', cssUrl(u));
      this.frame.classList.toggle('noimg', !u);
    },

    /** the panel opens out of the picture in the info pane */
    source(appid) {
      const f = this.frame;
      if (f && f.isConnected && String(this.selId) === String(appid)) return { el: this.img, slot: f, isSpine: false };
      return null;
    },

    /* ---------- the game, opened: `$ open "<game>"` prints its manual page into the terminal ---------- */
    async open(g, sheet) {
      sheet.getAnimations().forEach(a => a.cancel()); // the last close() left its fade-out filled in
      const facts = api.gameFacts(g);
      const desc = api.gameDesc(g);
      const run = api.running().has(g.appid);
      const name = slug(g);
      const manId = `${name.toUpperCase()}(6)`;
      const pic = first(g.images.header) || first(g.images.capsule) || '';
      const verb = run ? 'status' : g.installed ? 'run' : 'install';
      const tags = (g.genres || []).slice(0, 4);
      const lead = tags.length ? ` — ${tags.join(T('، ', ', '))}` : '';
      const kv = facts.map(([k, v]) => `<div class="mp-kv"><span class="k">${esc(k)}</span><i aria-hidden="true"></i><span class="v" dir="auto">${esc(v)}</span></div>`).join('');
      sheet.innerHTML = `
        <div class="tmv" role="dialog" aria-label="${esc(g.name)}">
          <div class="tmv-title">
            <span class="tm-dots" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="tmv-ttl" dir="ltr">man 6 ${esc(name)} — steam</span>
            <button class="tmv-x" data-close title="${esc(T('إغلاق (Esc)', 'Close (Esc)'))}"><span dir="ltr">Esc</span></button>
          </div>
          <div class="tmv-body">
            <div class="tmv-cmd" dir="ltr"><span class="tm-u">${esc(PROMPT_USER)}@steam</span><span class="tm-s">:</span><span class="tm-p">~</span><span class="tm-s">$ </span><span class="tmv-typed"><span class="tm-k">open</span> <span class="tm-v">${esc(shq(g.name))}</span></span><i class="tm-cur" aria-hidden="true"></i></div>
            <div class="mp-head ln" dir="ltr"><span>${esc(manId)}</span><span class="c">${esc(T('دليل ألعاب ستيم', 'Steam Games Manual'))}</span><span>${esc(manId)}</span></div>
            <div class="mp-cols">
              <div class="mp-side">
                <div class="mp-frame ln${pic ? '' : ' noimg'}"><div class="mp-img" style="--img:${esc(cssUrl(pic))}"></div></div>
                <div class="mp-acts ln"></div>
                ${tags.length ? `<div class="mp-tags ln">${tags.map(t => `<span dir="auto">${esc(t)}</span>`).join('')}</div>` : ''}
              </div>
              <div class="mp-main">
                <section class="ln"><h4>${esc(T('الاسم', 'NAME'))}</h4><p class="mp-name" dir="auto"><b>${esc(g.name)}</b>${esc(lead)}</p></section>
                <section class="ln"><h4>${esc(T('طريقة التشغيل', 'SYNOPSIS'))}</h4><p dir="ltr" class="mp-syn"><span class="tm-k">steam</span> <span class="tm-w">${verb}</span> <span class="tm-v">${esc(String(g.appid))}</span></p></section>
                <section class="ln"><h4>${esc(T('المعلومات', 'FACTS'))}</h4><div class="mp-facts">${kv}</div></section>
                <section class="ln"><h4>${esc(T('الوصف', 'DESCRIPTION'))}</h4><p class="mp-desc${desc ? '' : ' dim'}" dir="auto">${esc(desc || T('ما في وصف لهذي اللعبة.', 'No description available.'))}</p></section>
              </div>
            </div>
          </div>
          <div class="tmv-status">
            <span class="tm-mode">${esc(T('دليل', 'Man'))}</span>
            <span class="tmv-where" dir="ltr">Manual page ${esc(name)}(6) line 1 (END)</span>
            <span class="tmv-keys"><span dir="ltr"><kbd>Enter</kbd></span> ${esc(T('تشغيل', 'run'))}<i>·</i><span dir="ltr"><kbd>←</kbd><kbd>→</kbd></span> ${esc(T('الأزرار', 'buttons'))}<i>·</i><span dir="ltr"><kbd>Esc</kbd></span> ${esc(T('رجوع', 'back'))}</span>
          </div>
        </div>`;

      // the wired buttons, relabelled  [ RUN ]  [ INFO ]  [ STORE ]  (their clicks stay Steam's own)
      const acts = api.gameActions(g);
      const label = { play: run ? T('شغّالة', 'Running') : g.installed ? T('تشغيل', 'Run') : T('تثبيت', 'Install'), details: T('معلومات', 'Info'), store: T('المتجر', 'Store') };
      for (const b of acts.querySelectorAll('button[data-act]')) if (label[b.dataset.act]) b.textContent = label[b.dataset.act];
      $('.mp-acts', sheet).append(acts);
      const btns = [...acts.querySelectorAll('button[data-act]')];

      // keyboard inside the panel: Enter presses the focused button (RUN first), arrows walk the buttons;
      // a held Enter (auto-repeat from opening it) never launches a game
      const box = $('.tmv', sheet);
      box.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.repeat) { e.preventDefault(); return; }
        const i = btns.indexOf(document.activeElement);
        if (i < 0) return;
        const fwd = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!fwd) return;
        e.preventDefault(); e.stopPropagation();
        const step = (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !api.LTR ? -fwd : fwd; // right-to-left in Arabic
        btns[(i + step + btns.length) % btns.length].focus({ preventScroll: true });
      });

      const focusRun = () => { if (btns[0] && btns[0].isConnected) btns[0].focus({ preventScroll: true }); };
      // 1) the window switches on like a CRT (a bright line opens to full height)  2) the command types itself
      // 3) the page prints in, block by block (CSS, staggered)  — all done by ~560 ms.
      // With Windows' animation effects off (prefers-reduced-motion) nothing moves or scales: the window fades in and
      // the terminal still types and prints (opacity only).
      const calm = reduced();
      const typed = $('.tmv-typed', sheet);
      const n = Math.max(6, Math.min(28, typed.textContent.length));
      const tw = typed.scrollWidth;
      sheet.animate([{ backgroundColor: 'rgba(2, 5, 4, 0)' }, { backgroundColor: 'rgba(2, 5, 4, .86)' }], { duration: 160, easing: 'ease-out' });
      if (calm) box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'ease-out' });
      else {
        box.animate([
          { transform: 'scale(1, .004)', opacity: .9, filter: 'brightness(2.2)' },
          { transform: 'scale(1, .004)', opacity: 1, filter: 'brightness(2.2)', offset: .25 },
          { transform: 'none', opacity: 1, filter: 'none' },
        ], { duration: 220, easing: 'cubic-bezier(.2, .9, .3, 1)' });
      }
      typed.animate([{ maxWidth: '0px' }, { maxWidth: tw + 'px' }], { duration: 200, delay: 140, easing: `steps(${n}, end)`, fill: 'backwards' });
      box.classList.add('shown');
      setTimeout(focusRun, 330); // RUN takes the keyboard once it has printed (Esc works from the first frame)
    },
    async close(sheet) {
      const box = $('.tmv', sheet);
      if (!box) return;
      sheet.animate([{ backgroundColor: 'rgba(2, 5, 4, .86)' }, { backgroundColor: 'rgba(2, 5, 4, 0)' }], { duration: 260, easing: 'ease-in', fill: 'forwards' });
      if (reduced()) { await box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-in', fill: 'forwards' }).finished; return; }
      // the CRT switches off: the picture collapses to a bright line, then to a dot
      await box.animate([
        { transform: 'none', opacity: 1, filter: 'none' },
        { transform: 'scale(1, .004)', opacity: 1, filter: 'brightness(2.4)', offset: .55 },
        { transform: 'scale(0, .004)', opacity: 0, filter: 'brightness(2.4)' },
      ], { duration: 280, easing: 'cubic-bezier(.5, 0, .7, .4)', fill: 'forwards' }).finished;
    },

    /** ↑ ↓ · PgUp PgDn · Home End · Enter (open) · Ctrl/Shift+Enter (play) */
    key(e) {
      if (!this.list || !this.list.isConnected || e.altKey || e.metaKey) return false;
      const t = e.target;
      const outside = t && t !== document.body && t !== document.documentElement && !api.root.contains(t);
      // a Steam control that has keyboard focus keeps its own keys
      if (outside && t.closest && t.closest('button, a[href], select, [role="button"], [role="option"], [role="menuitem"], [role="treeitem"], [role="tab"]')) return false;
      const n = this.games.length;
      if (!n) return false;
      const rowH = (this.rows[0] && this.rows[0].offsetHeight) || 24;
      const page = Math.max(1, Math.floor((this.list.clientHeight - rowH) / rowH) - 1);
      switch (e.key) {
        case 'ArrowDown': this.select(this.cur + 1); return true;
        case 'ArrowUp': this.select(this.cur - 1); return true;
        case 'PageDown': this.select(this.cur + page); return true;
        case 'PageUp': this.select(this.cur - page); return true;
        case 'Home': this.select(0); return true;
        case 'End': this.select(n - 1); return true;
        case 'Enter': {
          // a focused button of ours (e.g. [ PLAY ] right after a click) answers its own Enter
          if (t && t !== document.body && t.closest && t.closest('button, a[href]')) return false;
          if (e.repeat) return true;
          const g = this.games[this.cur];
          if (!g) return false;
          if (e.ctrlKey || e.shiftKey) api.launch(g);
          else this.open1();
          return true;
        }
        default: return false;
      }
    },
  };

  api.register('terminal', Layout);
})();
