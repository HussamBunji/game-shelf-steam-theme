/* ═══ Shelter OS (الملجأ) — library home design ═══
   A post-apocalyptic shelter terminal in green phosphor, with the iconic wrist computer on your forearm:
     • HOME: a normal, usable library page — the INVENTORY header, the one filter strip, then every game as a tile
       (READY = installed, STORAGE = the rest) with green-tinted art that shows its colour on hover; all games reachable
       by scrolling down or with the arrow keys. A slim status bar sits at the bottom (HRS · LEVEL + XP · GAMES).
     • THE ARM: a forearm in a jumpsuit sleeve with the chunky wrist computer strapped on, resting "lowered" in the
       bottom-end corner — only the device's top rim and screen peek up. Clicking it (OPEN TERMINAL) raises it with the
       library's STAT (level, totals, most used) and DATA (missions = games played last).
     • OPENING A GAME (open / close): the arm RAISES the device into view (≈ 520 ms), the CRT powers on and shows that
       game — ITEM (green picture + the weapon-card table: hours, last played, size, trophies, status, and the keys),
       DATA (description + every fact), STAT (rank, share of your hours, usage) — over the three-part status bar.
       Esc, a click outside or the close key LOWERS it again (≤ 300 ms).
   Keys: arrows move on the home grid, Enter opens, Ctrl+Enter plays; in the device ← → switch its tabs.
   Rules (docs/THEME-KIT.md): 4 elements per tile, art painted by api.lazy with the small header image, the tint is a
   plain overlay (no filters on tiles), transforms only on the hovered / focused tile, DOM writes only in render() and
   on input; one picture element on the device screen. Generic retro-futurism only, no trademarked names or art. */
(function () {
  'use strict';
  const api = window.__rfsLayoutApi; // provided by shelf.js
  if (!api) return;
  const { T, esc, div, $, ic, cssUrl, first, lazy, fmtPlaytime, fmtAgo, fmtSize, NUM, absUrl, imgWithFallback } = api;

  const pad = (n, w) => String(n).padStart(w, '0');
  /** 0.4 · 7.5 · 12 · 1,204 */
  const hrs = min => { const h = (min || 0) / 60; return h >= 10 ? Math.round(h) : Math.max(0.1, Math.round(h * 10) / 10); };
  const kbd = k => `<kbd>${k}</kbd>`;
  /** a device date: 2026.11.05 */
  const ymd = ts => { const d = new Date(ts * 1000); return `${d.getFullYear()}.${pad(d.getMonth() + 1, 2)}.${pad(d.getDate(), 2)}`; };
  /** level from total hours: level L needs 12.5·L·(L−1) hours (25 h for L2, 75 h for L3 …) */
  function levelOf(h) {
    const L = Math.max(1, Math.floor((1 + Math.sqrt(1 + 8 * h / 25)) / 2));
    const at = 12.5 * L * (L - 1), next = 12.5 * (L + 1) * L;
    return { L, at, next, frac: Math.max(0, Math.min(1, (h - at) / (next - at))) };
  }
  const achOf = g => (typeof api.gameAch === 'function' ? api.gameAch(g) : null);
  const achHTML = (g, kind) => (typeof api.achHTML === 'function' ? api.achHTML(g, kind) : '');
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  /** "N games" with natural plurals in both languages */
  const countItems = n => T(
    n === 1 ? 'غرض واحد' : n === 2 ? 'غرضين' : n >= 3 && n <= 10 ? `${NUM.format(n)} أغراض` : `${NUM.format(n)} غرض`,
    `${NUM.format(n)} ${n === 1 ? 'ITEM' : 'ITEMS'}`);
  const stOf = (g, run) => (run ? 'run' : g.installed ? 'ok' : 'ni');
  const stTxt = st => (st === 'run' ? T('قيد التشغيل', 'RUNNING') : st === 'ok' ? T('جاهزة', 'READY') : T('غير مثبتة', 'NOT INSTALLED'));
  /** a mission's status: running → in progress, played in the last two weeks → active, older → complete */
  function mission(g, run) {
    if (run) return ['run', T('قيد التنفيذ', 'IN PROGRESS')];
    if (g.playtime2wksMin || (g.lastPlayed && Date.now() / 1000 - g.lastPlayed < 14 * 86400)) return ['act', T('نشطة', 'ACTIVE')];
    return ['done', T('مكتملة', 'COMPLETE')];
  }
  const libGames = fallback => (api.state.games && api.state.games.length ? api.state.games : fallback || []);
  /** library totals (the whole source, not just what the search shows) */
  function libStats(all) {
    let min = 0, inst = 0, played = 0, bytes = 0;
    for (const g of all) {
      min += g.playtimeMin || 0;
      if (g.installed) { inst++; bytes += g.sizeOnDisk || 0; }
      if (g.playtimeMin) played++;
    }
    const ranked = all.filter(g => g.playtimeMin).sort((a, b) => b.playtimeMin - a.playtimeMin);
    const recent = all.filter(g => g.lastPlayed).sort((a, b) => b.lastPlayed - a.lastPlayed).slice(0, 10);
    const hours = min / 60;
    // LEVEL = the player's real Steam level (fetched once, cached); until it arrives, a level from play time
    let lv = levelOf(hours);
    const sl = api.steamLevelNow && api.steamLevelNow();
    if (sl && sl.level) lv = { L: sl.level, frac: (sl.pct || 0) / 100, next: lv.next, steam: true, xp: sl.xp };
    else if (api.steamLevel && !Layout._lvlAsked) { Layout._lvlAsked = true; api.steamLevel().then(v => { if (v) api.rerender(); }); }
    return { n: all.length, min, hours, lv, inst, played, bytes, ranked, top: ranked.slice(0, 5), recent, maxMin: ranked[0] ? ranked[0].playtimeMin : 1 };
  }

  /* ---- the small picture for the device screen: header (wide), else the cover (tall) ---- */
  const loList = g => (g.images.header && g.images.header.length) ? { list: g.images.header, tall: false } : { list: g.images.capsule || [], tall: true };

  /* ═══ the wrist computer (shared by the lowered arm on the home page and the raised one in the game panel) ═══ */
  /** the three-part status bar: HRS (like health) · LEVEL + XP · GAMES (like action points) */
  function bar3(L) {
    return `<div class="sh-b3">
      <div class="b3 s"><small>${T('ساعات', 'HRS')}</small><b>${NUM.format(Math.round(L.hours))}</b></div>
      <div class="b3 c"><small>${T('المستوى', 'LEVEL')}</small><b>${NUM.format(L.lv.L)}</b><i class="b3-xp" title="${esc(L.lv.steam ? T(`مستوى ستيم ${NUM.format(L.lv.L)} · ${Math.round(L.lv.frac * 100)}% للمستوى التالي`, `Steam level ${NUM.format(L.lv.L)} · ${Math.round(L.lv.frac * 100)}% to the next level`) : T(`باقي ${NUM.format(Math.max(0, Math.ceil(L.lv.next - L.hours)))} ساعة للمستوى التالي`, `${NUM.format(Math.max(0, Math.ceil(L.lv.next - L.hours)))} h to the next level`))}"><i style="width:${Math.round(L.lv.frac * 100)}%"></i></i></div>
      <div class="b3 e"><small>${T('ألعاب', 'GAMES')}</small><b>${NUM.format(L.n)}</b></div>
    </div>`;
  }
  /** the iconic tab line: the active tab sits in a notch with two posts rising from the line */
  function tabLine(tabs, cur, attr) {
    return `<nav class="sh-tl" role="tablist"><i class="sh-ln"></i>${tabs.map(([id, label]) =>
      `<button class="sh-tab" type="button" role="tab" ${attr}="${id}" aria-selected="${id === cur}">${label}</button><i class="sh-ln"></i>`).join('')}<i class="sh-ln g"></i></nav>`;
  }
  /** the device around a screen; dial = [[id, label] …] labels around the big selector */
  function deviceHTML(screen, dial, cur, attr, extra) {
    const n = dial.length;
    const labels = dial.map(([id, label], k) => {
      const a = n === 1 ? 0 : -60 + k * (120 / (n - 1));
      return `<button class="sh-dl" type="button" tabindex="-1" data-nopad ${attr}="${id}" style="--a:${a.toFixed(1)}deg">${label}</button>`;
    }).join('');
    const k = Math.max(0, dial.findIndex(d => d[0] === cur));
    const rot = n === 1 ? 0 : -60 + k * (120 / (n - 1));
    return `
      <i class="sh-arm" aria-hidden="true"></i>
      <i class="sh-strap" aria-hidden="true"></i>
      <div class="sh-dev${extra ? ' ' + extra : ''}">
        <i class="sh-clamp t" aria-hidden="true"></i><i class="sh-clamp b" aria-hidden="true"></i>
        <i class="sh-hose" aria-hidden="true"></i>
        <div class="sh-bezel"><div class="sh-scr">${screen}</div></div>
        <aside class="sh-side">
          <div class="sh-dialbox">${labels}<i class="sh-dial" style="--rot:${rot.toFixed(1)}deg" aria-hidden="true"></i></div>
          <div class="sh-row2" aria-hidden="true"><i class="sh-knob"></i><span class="sh-lights"><i class="on"></i><i class="${api.running().size ? 'on' : ''}"></i><i></i></span></div>
          <div class="sh-tuner" aria-hidden="true"><i class="sh-needle"></i></div>
          <i class="sh-grille" aria-hidden="true"></i>
        </aside>
      </div>`;
  }
  /** turn the big selector to the tab that is showing */
  function turnDial(root, attr, cur) {
    const labels = [...root.querySelectorAll(`.sh-dl[${attr}]`)];
    labels.forEach(b => b.classList.toggle('on', b.getAttribute(attr) === cur));
    const n = labels.length, k = labels.findIndex(b => b.getAttribute(attr) === cur);
    const dial = root.querySelector('.sh-dial');
    if (dial && k >= 0) dial.style.setProperty('--rot', (n === 1 ? 0 : -60 + k * (120 / (n - 1))).toFixed(1) + 'deg');
    root.querySelectorAll(`.sh-tab[${attr}]`).forEach(b => b.setAttribute('aria-selected', String(b.getAttribute(attr) === cur)));
  }

  /* ---- home tiles ---- */
  function subLine(g, run) {
    if (run) return T('شغّالة الحين', 'RUNNING');
    // each part is a bidi isolate, so "19 س · 127 GB" keeps its order in Arabic
    const iso = x => '⁨' + x + '⁩';
    const t = g.playtimeMin ? iso(`${NUM.format(hrs(g.playtimeMin))} ${T('س', 'H')}`) : T('ما انلعبت', 'UNUSED');
    return g.installed ? (g.sizeOnDisk ? `${t} · ${iso(fmtSize(g.sizeOnDisk))}` : t) : `${t} · ${T('في المخزن', 'STORED')}`;
  }
  function tileHTML(g, i, run) {
    return `<div class="sh-t${run ? ' run' : ''}${g.installed ? '' : ' ni'}" data-appid="${g.appid}" data-i="${i}"><div class="art"></div><div class="t" dir="auto" title="${esc(g.name)}">${esc(g.name)}</div><div class="h">${esc(subLine(g, run))}</div></div>`;
  }
  function paintTile(t, g) {
    const u = cssUrl(first(g.images.header) || first(g.images.capsule));
    if (t._img !== u) { t._img = u; t.style.setProperty('--img', u); }
  }
  /** a section header on the notch line: ──┘ READY └────── 40 ITEMS */
  const secHead = (title, count) => `<header class="sh-sec-h"><i class="sh-ln"></i><h3>${esc(title)}</h3><i class="sh-ln g"></i><span class="sh-cnt">${esc(count)}</span></header>`;

  const Layout = {
    fixedHeight: false,
    dockInside: true,
    games: [], items: [], secs: [], grid: null,
    cur: -1, curId: '', kf: null,
    term: false, ttab: 'stat', pk: { stat: 0, data: 0 },
    r: null, lib: null,

    render(games, w) {
      const all = libGames(games);
      const L = this.lib = libStats(all);
      const running = api.running();
      const keepRing = !!this.kf;
      this.kf = null;
      const here = [], rest = [];
      for (const g of games) (g.installed ? here : rest).push(g);
      this.games = here.concat(rest);
      const filtered = !!(api.state.query || api.state.genre);

      const el = div('sh' + (w < 980 ? ' narrow' : '') + (w < 720 ? ' tiny' : ''));
      let html = `
        <header class="sh-hd">
          <div class="sh-hd-l">
            <span class="sh-kick">SHELTER OS · ${T('الجهاز الشخصي', 'PERSONAL TERMINAL')}</span>
            <h2 class="sh-h1">${T('المخزن', 'INVENTORY')}</h2>
          </div>
          <div class="sh-hd-r">
            <span><small>${T('الأغراض', 'ITEMS')}</small><b>${NUM.format(all.length)}</b></span>
            <span><small>${T('جاهزة', 'READY')}</small><b>${NUM.format(L.inst)}</b></span>
            <span><small>${T('الوزن', 'WEIGHT')}</small><b dir="ltr">${L.bytes ? esc(fmtSize(L.bytes)) : '—'}</b></span>
            <button class="sh-termbtn" type="button" data-act="term"><i aria-hidden="true"></i>${T('افتح الجهاز', 'OPEN TERMINAL')}</button>
          </div>
        </header>
        <div class="rf-dock sh-dock" data-rfs-dock></div>
        <div class="sh-lib">`;
      const secs = [];
      if (!games.length) {
        html += `<div class="rf-empty"><b>${esc(filtered ? T('ما في نتائج', 'NO MATCH') : T('المخزن فاضي', 'INVENTORY EMPTY'))}</b><span>${esc(filtered ? T('جرّب كلمة ثانية أو شيل الفلتر', 'Try a different search or clear the filter') : T('ما في ألعاب هنا', 'No games here'))}</span></div>`;
      } else {
        if (here.length) {
          html += `<section class="sh-sec" data-sec="ready">${secHead(T('جاهزة للاستخدام', 'READY'), countItems(here.length))}<div class="sh-grid">${here.map((g, k) => tileHTML(g, k, running.has(g.appid))).join('')}</div></section>`;
          secs.push({ start: 0, len: here.length });
        }
        if (rest.length) {
          html += `<section class="sh-sec" data-sec="stored">${secHead(T('في المخزن', 'STORAGE'), countItems(rest.length))}<div class="sh-grid">${rest.map((g, k) => tileHTML(g, here.length + k, running.has(g.appid))).join('')}</div></section>`;
          secs.push({ start: here.length, len: rest.length });
        }
      }
      html += `</div>
        <div class="sh-foot">
          ${bar3(L)}
          <div class="sh-peek">
            <i class="sh-veil" data-act="lower"></i>
            <div class="sh-rig low${this.term ? '' : ''}" role="button" tabindex="0" aria-label="${esc(T('افتح الجهاز', 'Open terminal'))}">
              ${deviceHTML(this.termScreen(L, running), [['stat', T('الحالة', 'STAT')], ['data', T('البيانات', 'DATA')]], this.ttab, 'data-ttab')}
            </div>
          </div>
        </div>`;
      el.innerHTML = html;

      const lib = $('.sh-lib', el);
      this.secs = secs;
      this.grid = $('.sh-grid', lib);
      this.items = Array.from(lib.getElementsByClassName('sh-t'));
      for (const t of this.items) lazy(t, g => paintTile(t, g));
      this.r = { el, rig: $('.sh-peek .sh-rig', el) };

      // keep the keyboard place across re-renders (search, sort, a game starting)
      this.cur = -1;
      if (this.curId) {
        const i = this.games.findIndex(g => String(g.appid) === this.curId);
        if (i >= 0) { this.cur = i; if (keepRing) { this.kf = this.items[i]; this.kf.classList.toggle('kf', true); } }
      }
      el.addEventListener('click', e => this.onClick(e));
      // the terminal's highlighted entry follows the focus (Tab, or the controller in Big Picture)
      el.addEventListener('focusin', e => {
        const pk = this.term && e.target.closest && e.target.closest('.sh-pick');
        if (pk && !pk.classList.contains('sel')) this.pick(pk.dataset.pick, +pk.dataset.k);
      });
      api.stage.replaceChildren(el);
      if (this.term) this.raiseTerm(true);
      this.paintTerm();
      this.missionsAch();
    },

    /* ---- the terminal screen (library STAT + DATA), shown when the arm is raised from the home page ---- */
    termScreen(L, running) {
      return `
        <div class="sh-crt">
          <div class="sh-standby" aria-hidden="true">
            <span class="sh-sb-k">SHELTER OS</span>
            <b>${T('افتح الجهاز', 'OPEN TERMINAL')}</b>
            <i class="sh-sb-ar"></i>
          </div>
          <div class="sh-ui">
            ${tabLine([['stat', T('الحالة', 'STAT')], ['data', T('البيانات', 'DATA')]], this.ttab, 'data-ttab')}
            <div class="sh-panes">
              <section class="sh-pane" data-pane="stat">${this.statHTML(L)}</section>
              <section class="sh-pane" data-pane="data">${this.dataHTML(L, running)}</section>
            </div>
            ${bar3(L)}
            <button class="sh-x" type="button" data-act="lower" title="${esc(T('أنزل الجهاز (Esc)', 'Lower (Esc)'))}">${ic('x')}${kbd('Esc')}</button>
          </div>
        </div>`;
    },
    statHTML(L) {
      const pctPlayed = L.n ? Math.round(L.played / L.n * 100) : 0;
      const toNext = Math.max(0, Math.ceil(L.lv.next - L.hours));
      const cnt = (k, v) => `<div class="sh-cn"><small>${k}</small><b dir="auto">${v}</b></div>`;
      const bars = L.top.map((g, k) => {
        const p = Math.max(3, Math.round(g.playtimeMin / L.maxMin * 100));
        return `<button class="sh-bar sh-pick${k === this.pk.stat ? ' sel' : ''}" type="button" data-pick="stat" data-k="${k}" data-appid="${g.appid}">`
          + `<span class="sh-bn" dir="auto">${esc(g.name)}</span><i class="sh-bt"><i style="width:${p}%"></i></i><span class="sh-bv">${NUM.format(hrs(g.playtimeMin))}<small>${T('س', 'H')}</small></span></button>`;
      }).join('');
      return `<div class="sh-stat">
        <div class="sh-col">
          <section class="sh-card sh-lv">
            <h4 class="sh-h">${T('المستوى', 'LEVEL')}</h4>
            <div class="sh-lvrow"><b class="sh-lvn">${NUM.format(L.lv.L)}</b>
              <div class="sh-lvt"><span>${L.lv.steam ? `${T('خبرة ستيم', 'STEAM XP')} <b>${NUM.format(L.lv.xp || 0)}</b> · ${Math.round(L.lv.frac * 100)}%` : `${T('خبرة', 'XP')} <b>${NUM.format(Math.floor(L.hours))}</b> / ${NUM.format(L.lv.next)} ${T('ساعة', 'H')}`}</span>
                <span class="sh-xp" style="--seg:${Math.round(L.lv.frac * 20)}"><i></i></span>
                <small>${T(`المستوى التالي بعد ${NUM.format(toNext)} ساعة لعب`, `NEXT LEVEL IN ${NUM.format(toNext)} H OF PLAY`)}</small></div></div>
          </section>
          <section class="sh-card sh-gauge">
            <div class="sh-ring" style="--p:${pctPlayed}"><b>${pctPlayed}<small>%</small></b></div>
            <p class="sh-gtxt"><b>${T('نسبة المكتبة الملعوبة', 'LIBRARY PLAYED')}</b><br>${T(`لعبت ${NUM.format(L.played)} من ${NUM.format(L.n)} لعبة`, `${NUM.format(L.played)} OF ${NUM.format(L.n)} ITEMS USED`)}</p>
          </section>
        </div>
        <div class="sh-col">
          <section class="sh-card">
            <div class="sh-cns">
              ${cnt(T('الألعاب', 'GAMES'), NUM.format(L.n))}${cnt(T('المثبتة', 'INSTALLED'), NUM.format(L.inst))}${cnt(T('الملعوبة', 'PLAYED'), NUM.format(L.played))}
              ${cnt(T('الساعات', 'HOURS'), NUM.format(Math.round(L.hours)))}${cnt(T('التخزين', 'STORAGE'), L.bytes ? esc(fmtSize(L.bytes)) : '—')}<div class="sh-cn sh-tro"></div>
            </div>
          </section>
          <section class="sh-card sh-topc">
            <h4 class="sh-h">${T('الأكثر استخداماً', 'MOST USED')}</h4>
            <div class="sh-bars">${bars || `<p class="sh-none">${T('ما فيه ساعات لعب للحين', 'NO PLAYTIME ON RECORD')}</p>`}</div>
          </section>
        </div>
      </div>`;
    },
    dataHTML(L, running) {
      const rows = L.recent.map((g, k) => {
        const [st, txt] = mission(g, running.has(g.appid));
        return `<button class="sh-ms sh-pick${k === this.pk.data ? ' sel' : ''}" type="button" data-pick="data" data-k="${k}" data-appid="${g.appid}" data-st="${st}">`
          + `<i class="sh-box" aria-hidden="true"></i><span class="sh-md">${ymd(g.lastPlayed)}</span>`
          + `<span class="sh-mt"><b dir="auto">${esc(g.name)}</b><small>${esc(T('آخر تشغيل', 'LAST RUN'))} ${esc(fmtAgo(g.lastPlayed))}<span class="sh-mach"></span></small></span>`
          + `<span class="sh-mh">${g.playtimeMin ? esc(fmtPlaytime(g.playtimeMin)) : '—'}</span><span class="sh-mst">${esc(txt)}</span></button>`;
      }).join('');
      return `<section class="sh-card sh-log">
        <h4 class="sh-h">${T('المهمات', 'MISSIONS')}<small>${T(`${NUM.format(L.recent.length)} سجلات`, `${NUM.format(L.recent.length)} ENTRIES`)}</small></h4>
        <div class="sh-ms-list">${rows || `<p class="sh-none">${T('ما فيه مهمات مسجّلة', 'NO MISSIONS ON RECORD')}</p>`}</div>
      </section>`;
    },
    /** total trophies — only from games whose details are already loaded (no fetching 900 games) */
    statAch() {
      const box = this.r && $('.sh-tro', this.r.el); if (!box) return;
      let got = 0, total = 0, n = 0;
      for (const g of libGames(this.games)) {
        if (!g.detailed) continue;
        const a = achOf(g);
        if (a) { got += a.got; total += a.total; n++; }
      }
      const html = `<small>${T('الإنجازات', 'TROPHIES')}</small><b dir="ltr">${total ? `${NUM.format(got)}<i>/${NUM.format(total)}</i>` : '—'}</b>`
        + `<em>${n ? T(`من ${NUM.format(n)} لعبة محمّلة`, `FROM ${NUM.format(n)} LOADED`) : T('تظهر مع تفاصيل الألعاب', 'LOADS WITH GAME DATA')}</em>`;
      if (box._h !== html) { box._h = html; box.innerHTML = html; }
    },
    /** a TROPHIES line in each mission entry, once that game's details are known */
    missionsAch() {
      const r = this.r; if (!r || !this.lib) return;
      const el = r.el;
      this.lib.recent.forEach((g, k) => {
        const put = () => {
          if (!el.isConnected) return;
          const slot = el.querySelector(`.sh-ms[data-k="${k}"] .sh-mach`);
          const m = achHTML(g, 'mini');
          if (slot && m && slot._h !== m) { slot._h = m; slot.innerHTML = `<i class="sh-sep">·</i>${T('الإنجازات', 'TROPHIES')} ${m}`; }
          this.statAch();
        };
        if (g.detailed) put(); else api.Data.ensureDetails(g).then(put);
      });
      this.statAch();
    },
    paintTerm() {
      const r = this.r; if (!r) return;
      const scr = $('.sh-scr', r.rig);
      scr.dataset.tab = this.ttab;
      turnDial(r.rig, 'data-ttab', this.ttab);
    },
    setTermTab(id) {
      if (id === this.ttab || !['stat', 'data'].includes(id)) return;
      this.ttab = id; api.sfx('tick'); this.paintTerm();
      if (id === 'stat') this.statAch();
    },
    /** OPEN TERMINAL: the arm comes up on the home page itself (no game) */
    raiseTerm(now) {
      const r = this.r; if (!r) return;
      this.term = true;
      r.el.classList.toggle('term', true);
      const rig = r.rig, scr = $('.sh-scr', rig);
      rig.classList.toggle('down', false);
      if (now || reduced()) rig.classList.toggle('still', true);
      rig.classList.toggle('low', false);
      if (!now) { scr.classList.toggle('boot', false); void scr.offsetWidth; scr.classList.toggle('boot', true); api.sfx('slide'); }
      requestAnimationFrame(() => { rig.classList.toggle('still', false); const b = $('.sh-pick.sel', $(`.sh-pane[data-pane="${this.ttab}"]`, rig)) || $('.sh-x', rig); if (b) b.focus({ preventScroll: true }); });
      this.statAch();
    },
    lowerTerm() {
      const r = this.r; if (!r || !this.term) return;
      this.term = false;
      r.el.classList.toggle('term', false);
      r.rig.classList.toggle('still', reduced());
      r.rig.classList.toggle('down', true);
      r.rig.classList.toggle('low', true);
      api.sfx('close');
    },

    onClick(e) {
      const r = this.r;
      const act = e.target.closest('[data-act]');
      if (act && act.dataset.act === 'lower') { this.lowerTerm(); return; }
      if (act && act.dataset.act === 'term') { if (!this.term) this.raiseTerm(); return; }
      const tt = e.target.closest('[data-ttab]');
      if (tt && this.term) { this.setTermTab(tt.dataset.ttab); return; }
      const pk = e.target.closest('.sh-pick');
      if (pk && this.term) {
        const g = api.byId(pk.dataset.appid);
        this.pick(pk.dataset.pick, +pk.dataset.k, true);
        if (g) this.openFromTerm(g, pk);
        return;
      }
      if (r && e.target.closest('.sh-peek .sh-rig') && !this.term) { this.raiseTerm(); return; }
      const t = e.target.closest('.sh-t');
      if (!t) return;
      const g = api.byId(t.dataset.appid);
      if (!g || e.detail > 1) return;
      if (e.ctrlKey) { api.launch(g); return; }
      if (this.kf && this.kf !== t) { this.kf.classList.toggle('kf', false); this.kf = null; }
      this.cur = +t.dataset.i; this.curId = t.dataset.appid;
      api.openGame(g, this.source(g.appid));
    },
    /** a game picked on the raised terminal: the terminal drops out of the way, the game panel raises the arm again */
    openFromTerm(g, el) {
      const r = this.r;
      this.term = false;
      r.el.classList.toggle('term', false);
      r.rig.classList.toggle('still', true);
      r.rig.classList.toggle('low', true);
      requestAnimationFrame(() => r.rig.classList.toggle('still', false));
      api.openGame(g, { el, slot: null, isSpine: false });
    },
    pick(kind, k, quiet) {
      const r = this.r; if (!r) return;
      const items = r.rig.querySelectorAll(`.sh-pick[data-pick="${kind}"]`);
      if (!items.length) return;
      k = Math.max(0, Math.min(items.length - 1, k));
      if (k !== this.pk[kind] && !quiet) api.sfx('tick');
      this.pk[kind] = k;
      items.forEach((b, j) => b.classList.toggle('sel', j === k));
      items[k].scrollIntoView({ block: 'nearest' });
      items[k].focus({ preventScroll: true });
    },

    /* ---- Big Picture (src/js/shelf.js host): the raised terminal is a panel the D-pad walks (tabs, entries,
       close); LT raises it from the home */
    padScope() { return this.term && this.r ? this.r.rig : null; },
    padAux() { if (!this.term) this.raiseTerm(); },
    /** the controller's cursor moved onto an entry: it becomes the terminal's selected entry too (one highlight, not two) */
    padFocus(el) { if (el && el.matches && el.matches('.sh-pick') && !el.classList.contains('sel')) this.pick(el.dataset.pick, +el.dataset.k, true); },
    get padAuxLabel() { return T('الجهاز', 'Terminal'); },
    /** the element the device "looks at" when it opens a game */
    source(appid) {
      const t = api.stage.querySelector(`.sh-t[data-appid="${appid}"] .art`);
      return t ? { el: t, slot: t.parentElement, isSpine: false } : null;
    },

    /* ---- keyboard ---- */
    key(e) {
      const r = this.r;
      if (!r || !r.el.isConnected || e.altKey || e.metaKey) return false;
      const k = e.key;
      if (this.term) { // the raised terminal has the keys
        if (k === 'Escape') { this.lowerTerm(); return true; }
        if (k === 'ArrowLeft' || k === 'ArrowRight') {
          const fwd = k === (api.LTR ? 'ArrowRight' : 'ArrowLeft');
          this.setTermTab(fwd ? 'data' : 'stat');
          return true;
        }
        const kind = this.ttab, list = kind === 'stat' ? this.lib.top : this.lib.recent;
        if (!list.length) return false;
        if (k === 'ArrowDown' || k === 'ArrowUp') { this.pick(kind, this.pk[kind] + (k === 'ArrowDown' ? 1 : -1), e.repeat); return true; }
        if (k === 'Enter') {
          const g = list[this.pk[kind]]; if (!g || e.repeat) return true;
          if (e.ctrlKey) api.launch(g); else this.openFromTerm(g, r.rig.querySelector(`.sh-pick[data-pick="${kind}"][data-k="${this.pk[kind]}"]`));
          return true;
        }
        return false;
      }
      const n = this.items.length;
      if (!n) return false;
      if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
        const t = e.target && e.target.nodeType === 1 ? e.target : null;
        if (t && t.closest && t.closest('.sh-peek .sh-rig') && k !== ' ') { this.raiseTerm(); return true; }
        const g = this.kf && this.games[this.cur];
        if (!g) return false;
        if (k !== 'Enter' || e.ctrlKey) api.launch(g);
        else api.openGame(g, this.source(g.appid));
        return true;
      }
      if (e.ctrlKey) return false;
      const fwd = api.LTR ? 'ArrowRight' : 'ArrowLeft', back = api.LTR ? 'ArrowLeft' : 'ArrowRight';
      if (k !== fwd && k !== back && k !== 'ArrowUp' && k !== 'ArrowDown') return false;
      let i;
      if (!this.kf) i = this.cur >= 0 && this.visible(this.items[this.cur]) ? this.cur : this.firstVisible();
      else if (k === fwd) i = this.cur + 1;
      else if (k === back) i = this.cur - 1;
      else {
        i = this.vert(k === 'ArrowDown' ? 1 : -1);
        if (i < 0) { const top = api.stage.querySelector('.sh-hd'); if (top) top.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return true; }
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
        if (Math.floor(pos / cols) < lastRow) return sec.start + sec.len - 1;
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
      const b = t.getBoundingClientRect();
      return b.bottom > 90 && b.top < window.innerHeight - 60;
    },
    firstVisible() {
      const H = window.innerHeight;
      for (let i = 0; i < this.items.length; i++) {
        const b = this.items[i].getBoundingClientRect();
        if (b.bottom > 90 && b.top < H) return i;
        if (b.top >= H) break;
      }
      return 0;
    },

    /* ═══ a game on the wrist computer (#rfs-sheet): the arm RAISES the device, the CRT powers on ═══ */
    async open(g, sheet) {
      const all = libGames(this.games);
      const L = this.lib || libStats(all);
      const run = api.running().has(g.appid);
      const st = stOf(g, run);
      const a = achOf(g);
      const lo = loList(g);
      const facts = api.gameFacts(g);
      const desc = api.gameDesc(g);
      const rank = L.ranked.indexOf(g);
      const share = L.min ? Math.round((g.playtimeMin || 0) / L.min * 1000) / 10 : 0;
      const usage = g.playtimeMin ? Math.max(2, Math.round(g.playtimeMin / L.maxMin * 100)) : 0;
      const row = (k, v, extra) => `<div class="shv-r"><span class="k">${k}</span><span class="v" dir="auto">${v}</span>${extra || ''}</div>`;
      const achRow = a
        ? row(T('الإنجازات', 'TROPHIES'), `${NUM.format(a.got)}/${NUM.format(a.total)}`, `<i class="shv-mb${a.got >= a.total ? ' done' : ''}"><i style="width:${Math.max(a.pct, a.got ? 2 : 0)}%"></i></i><em>${a.pct}%</em>`)
        : row(T('الإنجازات', 'TROPHIES'), '—');
      const tabs = [['item', T('الغرض', 'ITEM')], ['data', T('البيانات', 'DATA')], ['stat', T('الحالة', 'STAT')]];
      const screen = `
        <div class="sh-crt">
          <div class="sh-ui">
            ${tabLine(tabs, 'item', 'data-gtab')}
            <div class="sh-panes">
              <section class="sh-pane" data-pane="item">
                <div class="shv-item">
                  <div class="shv-l">
                    <div class="shv-pic${lo.tall ? ' tall' : ''}"></div>
                    <h2 class="shv-name" dir="auto">${esc(g.name)}</h2>
                    ${g.genres && g.genres.length ? `<div class="shv-tags">${g.genres.slice(0, 4).map(x => `<span dir="auto">${esc(x)}</span>`).join('')}</div>` : ''}
                    ${desc ? `<p class="shv-blurb" dir="auto">${esc(desc)}</p>` : ''}
                  </div>
                  <div class="shv-card">
                    ${row(T('ساعات اللعب', 'HOURS'), g.playtimeMin ? esc(fmtPlaytime(g.playtimeMin)) : T('ولا دقيقة', 'NONE'))}
                    ${row(T('آخر لعب', 'LAST PLAYED'), g.lastPlayed ? esc(fmtAgo(g.lastPlayed)) : T('ولا مرة', 'NEVER'))}
                    ${row(T('الحجم', 'SIZE'), g.installed && g.sizeOnDisk ? esc(fmtSize(g.sizeOnDisk)) : '—')}
                    ${achRow}
                    ${row(T('الحالة', 'STATUS'), `<span class="shv-st" data-st="${st}">${esc(stTxt(st))}</span>`)}
                    ${row(T('الاستخدام', 'USAGE'), '', `<i class="shv-mb wide"><i style="width:${usage}%"></i></i>`)}
                    ${row(T('آخر أسبوعين', 'LAST 14 DAYS'), g.playtime2wksMin ? esc(fmtPlaytime(g.playtime2wksMin)) : '—')}
                  </div>
                </div>
              </section>
              <section class="sh-pane" data-pane="data">
                <div class="shv-data">
                  <p class="shv-desc${desc ? '' : ' none'}" dir="auto">${esc(desc || T('ما فيه وصف لهذي اللعبة. افتح صفحتها في المتجر للمزيد.', 'NO DESCRIPTION ON FILE. OPEN THE STORE PAGE FOR MORE.'))}</p>
                  <div class="shv-card">${facts.map(([k, v]) => row(esc(k), esc(v))).join('')}</div>
                </div>
              </section>
              <section class="sh-pane" data-pane="stat">
                <div class="shv-stat">
                  <div class="sh-cn big"><small>${T('الترتيب بالساعات', 'RANK BY HOURS')}</small><b dir="ltr">${rank >= 0 ? `#${NUM.format(rank + 1)}<i>/${NUM.format(L.n)}</i>` : '—'}</b></div>
                  <div class="sh-cn big"><small>${T('حصتها من وقتك', 'SHARE OF YOUR TIME')}</small><b dir="ltr">${NUM.format(share)}<i>%</i></b></div>
                  <div class="sh-cn big"><small>${T('آخر أسبوعين', 'LAST 14 DAYS')}</small><b dir="auto">${g.playtime2wksMin ? esc(fmtPlaytime(g.playtime2wksMin)) : '—'}</b></div>
                  <div class="shv-use"><small>${T('الاستخدام مقارنة بأكثر لعبة', 'USAGE VS YOUR MOST USED')}</small><i class="shv-mb"><i style="width:${usage}%"></i></i></div>
                  ${a ? `<div class="shv-ach">${achHTML(g)}</div>` : ''}
                </div>
              </section>
            </div>
            <div class="shv-keys"><span class="shv-acts-slot"></span><button class="sh-x" type="button" data-close title="${esc(T('أنزل الجهاز (Esc)', 'Lower (Esc)'))}">${ic('x')}${kbd('Esc')}</button></div>
            ${bar3(L)}
          </div>
        </div>`;
      sheet.innerHTML = `<div class="shv"><i class="sh-veil" data-close></i><div class="sh-rig low game" role="dialog" aria-label="${esc(g.name)}" tabindex="-1">${deviceHTML(screen, tabs, 'item', 'data-gtab', '')}</div></div>`;
      const rig = $('.sh-rig', sheet), scr = $('.sh-scr', rig);
      scr.dataset.tab = 'item';
      turnDial(rig, 'data-gtab', 'item');
      $('.shv-acts-slot', rig).replaceWith(api.gameActions(g));
      const pic = $('.shv-pic', rig);
      if (lo.list.length) pic.append(imgWithFallback(lo.list, 'shv-img', x => x.remove()));

      const setTab = id => { if (scr.dataset.tab === id) return; scr.dataset.tab = id; turnDial(rig, 'data-gtab', id); api.sfx('tick'); };
      rig.addEventListener('click', e => { const b = e.target.closest('[data-gtab]'); if (b) { e.stopPropagation(); setTab(b.dataset.gtab); } });
      const order = tabs.map(t => t[0]);
      rig.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const fwd = e.key === (api.LTR ? 'ArrowRight' : 'ArrowLeft');
          const i = order.indexOf(scr.dataset.tab) + (fwd ? 1 : -1);
          if (i >= 0 && i < order.length) setTab(order[i]);
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const list = [...rig.querySelectorAll('.rf-act, .sh-x')].filter(b => !b.disabled);
          const at = list.indexOf(document.activeElement), d = e.key === 'ArrowDown' ? 1 : -1;
          const next = list[(at < 0 ? 0 : at + d + list.length) % list.length];
          if (next) { next.focus({ preventScroll: true }); api.sfx('tick'); }
        }
      });

      // the lowered arm on the home page hides while this one is up (they are the same arm)
      if (this.r && this.r.el.isConnected) this.r.el.classList.toggle('raised', true);
      api.sfx('slide');
      const veil = $('.sh-veil', sheet);
      if (reduced()) {
        rig.classList.toggle('still', true);
        rig.classList.toggle('low', false);
        if (veil.animate) await veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 }).finished.catch(() => null);
      } else {
        void rig.offsetWidth;          // the lowered pose is on screen first …
        rig.classList.toggle('low', false); // … then the arm comes up (CSS transition, 340 ms)
        scr.classList.toggle('boot', true); // the CRT powers on as it arrives
        if (veil.animate) veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'cubic-bezier(.2,.7,.2,1)' });
        await wait(350);
      }
      if (rig.isConnected) {
        rig.classList.toggle('ready', true);
        const play = $('.rf-act.play', rig);
        (play || rig).focus({ preventScroll: true });
      }
    },

    /** the arm lowers again (250 ms) */
    async close(sheet) {
      const rig = $('.sh-rig', sheet), veil = $('.sh-veil', sheet);
      const done = () => { if (this.r && this.r.el.isConnected) this.r.el.classList.toggle('raised', false); };
      if (!rig) { done(); return; }
      rig.classList.toggle('ready', false);
      api.sfx('close');
      if (reduced()) {
        if (veil && veil.animate) await rig.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' }).finished.catch(() => null);
      } else {
        rig.classList.toggle('down', true);
        rig.classList.toggle('low', true);
        if (veil && veil.animate) veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'ease-in', fill: 'forwards' });
        await wait(250);
      }
      done();
    },
  };

  api.register('shelter', Layout);
})();
