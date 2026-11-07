/* Game Shelf Installer — renderer. Talks to the main process only through window.gs (preload). */
(function () {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const SCREENS = ['welcome', 'check', 'themes', 'install', 'done'];
  const STEP_KEYS = ['stepWelcome', 'stepCheck', 'stepThemes', 'stepInstall', 'stepDone'];
  const GITHUB = 'https://github.com/SteamClientHomebrew/Millennium';

  const S = {
    lang: 'ar',
    screen: 'welcome',
    maxStep: 0,
    det: null,           // detect() result
    detecting: false,
    consent: false,
    styles: [],
    selected: new Set(),
    defaultStyle: 'Classic Shelf',
    themeLang: 'Arabic',
    themeLangTouched: false,
    openSteam: true,
    mode: 'install',     // 'install' | 'uninstall'
    tasks: [],
    running: false,
    failedAt: -1,
    lb: { open: false, i: 0, tab: 'library', returnFocus: null },
  };

  const t = (key, vars) => {
    let s = (I18N[S.lang] && I18N[S.lang][key]) ?? I18N.en[key] ?? key;
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  };
  const styleName = (st) => (S.lang === 'ar' ? st.ar : st.en);
  const styleDesc = (st) => (S.lang === 'ar' ? st.descAr : st.descEn);
  const byValue = (v) => S.styles.find((s) => s.value === v);

  /* ---------------- language ---------------- */
  function applyLang(lang) {
    S.lang = lang;
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-label]').forEach((el) => {
      const v = t(el.dataset.i18nLabel);
      el.setAttribute('aria-label', v);
      el.setAttribute('title', v);
    });
    $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    if (!S.themeLangTouched) S.themeLang = lang === 'ar' ? 'Arabic' : 'English';
    document.title = t('appTitle');
    renderSteps();
    renderChecks();
    renderGallery();
    renderOptions();
    renderTasks();
    renderInstallHead();
    renderDone();
    if (S.lb.open) renderLightbox();
  }

  /* ---------------- step rail + navigation ---------------- */
  function renderSteps() {
    const cur = SCREENS.indexOf(S.screen);
    $('#steps').innerHTML = STEP_KEYS.map((k, i) => {
      const state = i < cur ? 'done' : i === cur ? 'current' : 'todo';
      const clickable = !S.running && i <= S.maxStep && i < 3 && cur < 3 && i !== cur;
      return `<li class="step is-${state}">
        <button type="button" class="step-btn" data-step="${i}" ${clickable ? '' : 'tabindex="-1" aria-disabled="true"'} ${state === 'current' ? 'aria-current="step"' : ''}>
          <span class="step-dot">${state === 'done' ? icon('check') : `<span>${i + 1}</span>`}</span>
          <span class="step-label">${esc(t(k))}</span>
        </button></li>`;
    }).join('');
  }

  function go(screen) {
    const idx = SCREENS.indexOf(screen);
    if (idx < 0) return;
    S.screen = screen;
    S.maxStep = Math.max(S.maxStep, idx);
    $$('.screen').forEach((el) => el.classList.toggle('is-active', el.dataset.screen === screen));
    renderSteps();
    const active = $(`.screen[data-screen="${screen}"]`);
    const body = active.querySelector('.screen-body');
    if (body) body.scrollTop = 0;
    if (screen === 'check') runDetect();
    if (screen === 'themes') renderOptions();
    // move focus to the screen heading for keyboard / screen-reader users
    const h = active.querySelector('h1, h2');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  /* ---------------- system check ---------------- */
  async function runDetect() {
    S.detecting = true;
    renderChecks();
    const [r] = await Promise.all([gs.detect(), new Promise((res) => setTimeout(res, 450))]);
    S.detecting = false;
    S.det = r.ok ? r.state : null;
    renderChecks();
  }

  function row(iconName, title, detail, state, pathText) {
    const pill = { ok: t('stOk'), info: t('stInfo'), warn: t('stWarn'), err: t('stErr'), busy: '' }[state];
    const stIcon = { ok: 'check', info: 'info', warn: 'alert', err: 'x', busy: 'spinner' }[state];
    return `<div class="check-row st-${state}">
      <span class="check-ic">${icon(iconName)}</span>
      <div class="check-text"><div class="check-title">${esc(title)}</div>
        <div class="check-detail">${esc(detail)}${pathText ? ` <span class="path">${esc(pathText)}</span>` : ''}</div></div>
      <span class="state-pill">${state === 'busy' ? '' : `<span class="state-text">${esc(pill)}</span>`}<span class="state-ic">${icon(stIcon)}</span></span>
    </div>`;
  }

  function renderChecks() {
    const list = $('#checkList');
    const notice = $('#checkNotice');
    const d = S.det;
    if (S.detecting || !d) {
      list.innerHTML = [['steam', 'chkSteam'], ['plug', 'chkMill'], ['power', 'chkRunning'], ['gamepad', 'chkGame']]
        .map(([ic, k]) => row(ic, t(k), t('checking'), 'busy')).join('');
      notice.hidden = true;
      $('#checkNext').disabled = true;
      return;
    }
    list.innerHTML = [
      row('steam', t('chkSteam'), d.steamFound ? t('chkSteamOk') : t('chkSteamNo'), d.steamFound ? 'ok' : 'err', d.root),
      row('plug', t('chkMill'), d.millennium ? t('chkMillOk') : t('chkMillNo'), d.millennium ? 'ok' : 'warn'),
      row('power', t('chkRunning'), d.steamRunning ? t('chkRunningYes') : t('chkRunningNo'), d.steamRunning ? 'info' : 'ok'),
      row('gamepad', t('chkGame'), d.gameRunning ? t('chkGameYes') : t('chkGameNo'), d.gameRunning ? 'err' : 'ok'),
    ].join('');

    let html = '';
    let kind = '';
    if (!d.steamFound) {
      kind = 'err';
      html = `<div class="notice-ic">${icon('alert')}</div><div><div class="notice-title">${esc(t('steamMissingTitle'))}</div><p>${esc(t('steamMissingText'))}</p></div>`;
    } else if (d.gameRunning) {
      kind = 'err';
      html = `<div class="notice-ic">${icon('gamepad')}</div><div><div class="notice-title">${esc(t('gameBlockTitle'))}</div><p>${esc(t('gameBlockText'))}</p></div>`;
    } else if (!d.millennium) {
      kind = 'mill';
      html = `<div class="notice-ic">${icon('plug')}</div><div class="notice-main">
        <div class="notice-title">${esc(t('millTitle'))}</div><p>${esc(t('millText'))}</p>
        <div class="notice-row">
          <label class="check-inline"><input type="checkbox" id="consentChk" ${S.consent ? 'checked' : ''}><span class="cbox">${icon('check')}</span><span>${esc(t('millConsent'))}</span></label>
          <button type="button" class="link-btn" id="ghLink">${icon('github')}<span>${esc(t('millLink'))}</span>${icon('external')}</button>
        </div></div>`;
    }
    notice.className = 'notice' + (kind ? ' notice-' + kind : '');
    notice.innerHTML = html;
    notice.hidden = !html;
    const c = $('#consentChk');
    if (c) c.addEventListener('change', () => { S.consent = c.checked; updateCheckNext(); });
    const gh = $('#ghLink');
    if (gh) gh.addEventListener('click', () => gs.openExternal(GITHUB));
    updateCheckNext();
  }

  function updateCheckNext() {
    const d = S.det;
    $('#checkNext').disabled = !(d && d.steamFound && !d.gameRunning && (d.millennium || S.consent));
  }

  /* ---------------- gallery ---------------- */
  function cardImage(st) { return st.library || st.store; }

  function renderGallery() {
    const grid = $('#grid');
    if (!S.styles.length) return;
    const card = (st, i) => {
      const sel = S.selected.has(st.value);
      const img = cardImage(st);
      return `<div class="card${sel ? ' is-selected' : ''}" data-i="${i}">
        <button type="button" class="card-media" data-preview="${i}" aria-label="${esc(t('preview') + ': ' + styleName(st))}">
          ${img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async">` : `<span class="ph">${icon('image')}<span>${esc(t('previewSoon'))}</span></span>`}
          <span class="media-zoom">${icon('expand')}</span>
          ${st.group === 'community' ? '<span class="tag-mit">MIT</span>' : ''}
          <span class="badge-check" aria-hidden="true">${icon('check')}</span>
        </button>
        <label class="card-body">
          <input type="checkbox" class="sr" data-sel="${i}" ${sel ? 'checked' : ''}>
          <span class="cbox">${icon('check')}</span>
          <span class="card-text"><span class="card-name">${esc(styleName(st))}</span><span class="card-desc">${esc(styleDesc(st))}</span></span>
        </label>
      </div>`;
    };
    const groups = [['core', 'groupCore', 'groupCoreSub', 'layers'], ['community', 'groupCommunity', 'groupCommunitySub', 'globe']];
    grid.innerHTML = groups.map(([g, title, sub, ic]) => {
      const items = S.styles.map((st, i) => [st, i]).filter(([st]) => st.group === g);
      if (!items.length) return '';
      return `<section class="group group-${g}">
        <header class="group-head"><span class="group-ic">${icon(ic)}</span>
          <div class="group-titles"><h3 class="group-title">${esc(t(title))}</h3><p class="group-sub">${esc(t(sub))}</p></div>
          <span class="group-count" data-group-count="${g}"></span></header>
        <div class="grid">${items.map(([st, i]) => card(st, i)).join('')}</div>
      </section>`;
    }).join('');
    $$('img', grid).forEach((im) => im.addEventListener('error', () => {
      im.replaceWith(Object.assign(document.createElement('span'), { className: 'ph', innerHTML: icon('image') }));
    }));
    updateSelectionUI();
  }

  function toggleStyle(i, on) {
    const st = S.styles[i];
    if (!st) return;
    if (on === undefined) on = !S.selected.has(st.value);
    if (on) S.selected.add(st.value); else S.selected.delete(st.value);
    const card = $(`.card[data-i="${i}"]`);
    if (card) { card.classList.toggle('is-selected', on); const cb = $('input', card); if (cb) cb.checked = on; }
    updateSelectionUI();
  }

  function updateSelectionUI() {
    const n = S.selected.size;
    $('#selCount').textContent = t('selCount', { n, total: S.styles.length });
    $('#installBtn').disabled = n === 0;
    $('#selHint').hidden = n !== 0;
    $('#selAll').disabled = n === S.styles.length;
    $('#selNone').disabled = n === 0;
    $$('[data-group-count]').forEach((el) => {
      const items = S.styles.filter((x) => x.group === el.dataset.groupCount);
      el.textContent = `${items.filter((x) => S.selected.has(x.value)).length} / ${items.length}`;
    });
    renderOptions();
    if (S.lb.open) syncLbSel();
  }

  function renderOptions() {
    const sel = $('#defaultSel');
    const chosen = S.styles.filter((s) => S.selected.has(s.value));
    if (!chosen.some((s) => s.value === S.defaultStyle)) S.defaultStyle = chosen[0] ? chosen[0].value : '';
    sel.innerHTML = chosen.map((s) => `<option value="${esc(s.value)}" ${s.value === S.defaultStyle ? 'selected' : ''}>${esc(styleName(s))}</option>`).join('');
    sel.disabled = chosen.length === 0;
    $$('[data-tlang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tlang === S.themeLang)));
  }

  /* ---------------- lightbox ---------------- */
  function openLightbox(i, opener) {
    S.lb.open = true;
    S.lb.i = i;
    S.lb.returnFocus = opener || document.activeElement;
    const st = S.styles[i];
    S.lb.tab = st.library ? 'library' : 'store';
    const lb = $('#lightbox');
    lb.hidden = false;
    requestAnimationFrame(() => lb.classList.add('is-open'));
    renderLightbox();
    $('#lbClose').focus();
  }
  function closeLightbox() {
    const lb = $('#lightbox');
    lb.classList.remove('is-open');
    S.lb.open = false;
    setTimeout(() => { if (!S.lb.open) lb.hidden = true; }, 220);
    if (S.lb.returnFocus && S.lb.returnFocus.focus) S.lb.returnFocus.focus();
  }
  function moveLightbox(delta) {
    const n = S.styles.length;
    S.lb.i = (S.lb.i + delta + n) % n;
    const st = S.styles[S.lb.i];
    if (S.lb.tab === 'library' && !st.library) S.lb.tab = 'store';
    else if (S.lb.tab === 'store' && st.library && S.lb.preferLibrary !== false) S.lb.tab = 'library';
    renderLightbox();
    // keep the matching card visible behind the overlay
    const card = $(`.card[data-i="${S.lb.i}"]`);
    if (card) card.scrollIntoView({ block: 'nearest' });
  }
  function renderLightbox() {
    const st = S.styles[S.lb.i];
    if (!st) return;
    $('#lbName').textContent = styleName(st);
    $('#lbDesc').textContent = styleDesc(st);
    $('#lbPos').textContent = `${S.lb.i + 1} / ${S.styles.length}`;
    $$('#lbTabs [data-tab]').forEach((b) => {
      const tab = b.dataset.tab;
      const disabled = tab === 'library' && !st.library;
      b.disabled = disabled;
      b.setAttribute('aria-selected', String(tab === S.lb.tab));
      b.setAttribute('aria-pressed', String(tab === S.lb.tab));
      b.title = disabled ? t('noLibrary') : '';
    });
    const src = S.lb.tab === 'library' ? st.library : st.store;
    const frame = $('#lbFrame');
    frame.classList.remove('is-in');
    frame.classList.toggle('is-lib', !!src && S.lb.tab === 'library');
    frame.innerHTML = src
      ? `<img src="${esc(src)}" alt="${esc(styleName(st))}">`
      : `<div class="ph ph-lg">${icon('image')}<span>${esc(t('noLibrary'))}</span></div>`;
    const img = $('img', frame);
    const show = () => requestAnimationFrame(() => frame.classList.add('is-in'));
    if (img && !img.complete) img.addEventListener('load', show, { once: true }); else show();
    if (img) img.addEventListener('error', () => { frame.innerHTML = `<div class="ph ph-lg">${icon('image')}<span>${esc(t('noImage'))}</span></div>`; show(); });
    $('#lbNote').textContent = !st.library ? t('noLibrary') : t('lbKeys');
    $('#lbNote').classList.toggle('is-warn', !st.library);
    syncLbSel();
  }
  function syncLbSel() {
    const st = S.styles[S.lb.i];
    $('#lbSel').checked = !!st && S.selected.has(st.value);
  }

  /* ---------------- modal ---------------- */
  function confirmModal({ title, text, ok, iconName = 'trash' }) {
    return new Promise((resolve) => {
      const m = $('#modal');
      $('#modalTitle').textContent = title;
      $('#modalText').textContent = text;
      $('#modalOk').textContent = ok;
      $('#modalIcon').innerHTML = icon(iconName);
      m.hidden = false;
      requestAnimationFrame(() => m.classList.add('is-open'));
      const prev = document.activeElement;
      $('#modalCancel').focus();
      const done = (v) => {
        m.classList.remove('is-open');
        setTimeout(() => { m.hidden = true; }, 200);
        $('#modalOk').onclick = $('#modalCancel').onclick = null;
        document.removeEventListener('keydown', onKey, true);
        if (prev && prev.focus) prev.focus();
        resolve(v);
      };
      const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
      document.addEventListener('keydown', onKey, true);
      $('#modalOk').onclick = () => done(true);
      $('#modalCancel').onclick = () => done(false);
    });
  }

  /* ---------------- install / uninstall runner ---------------- */
  const LOG_CODES = {
    'steam-not-running': 'logNotRunning', 'millennium-fetch-release': 'logDownloading',
    'theme-removed': 'logRemoved',
  };
  function logLine(msg, kind) {
    const el = $('#log');
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    const line = document.createElement('div');
    line.className = 'log-line' + (kind ? ' log-' + kind : '');
    line.innerHTML = `<span class="log-time">${time}</span><span class="log-msg"></span>`;
    line.lastChild.textContent = msg;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  }

  function buildTasks() {
    const d = S.det || {};
    if (S.mode === 'uninstall') {
      return [
        { id: 'check', key: 'taskCheck', w: 0.5 },
        { id: 'close', key: 'taskClose', w: 1 },
        { id: 'remove', key: 'taskRemove', w: 1 },
        { id: 'start', key: 'taskStart', w: 0.5 },
      ];
    }
    const list = [];
    if (!d.millennium) list.push({ id: 'download', key: 'taskDownload', w: 3 });
    list.push({ id: 'close', key: 'taskClose', w: 1 });
    if (!d.millennium) list.push({ id: 'extract', key: 'taskExtract', w: 1 });
    list.push({ id: 'theme', key: 'taskTheme', w: 1.5 });
    if (S.openSteam) list.push({ id: 'start', key: 'taskStart', w: 0.5 });
    return list.map((x) => ({ ...x, state: 'todo', sub: 0 }));
  }

  function renderTasks() {
    const ol = $('#taskList');
    if (!S.tasks.length) { ol.innerHTML = ''; return; }
    ol.innerHTML = S.tasks.map((tk) => {
      const ic = { todo: 'dot', run: 'spinner', done: 'check', err: 'x' }[tk.state];
      const pct = tk.id === 'download' && tk.state === 'run' && tk.sub > 0 ? `<span class="task-pct">${Math.round(tk.sub * 100)}%</span>` : '';
      return `<li class="task is-${tk.state}"><span class="task-ic">${icon(ic)}</span><span class="task-label">${esc(t(tk.key))}</span>${pct}</li>`;
    }).join('');
    renderProgress();
  }

  function renderProgress() {
    const total = S.tasks.reduce((a, x) => a + x.w, 0) || 1;
    const got = S.tasks.reduce((a, x) => a + (x.state === 'done' ? x.w : x.state === 'run' ? x.w * (x.sub || 0.15) : 0), 0);
    const p = Math.max(0, Math.min(1, got / total));
    $('#progFill').style.transform = `scaleX(${p})`;
    $('#progPct').textContent = Math.round(p * 100) + '%';
    const cur = S.tasks.find((x) => x.state === 'run') || S.tasks.find((x) => x.state === 'err');
    $('#progLabel').textContent = cur ? t(cur.key) : (p >= 1 ? t('progressDone') : '');
    $('.progress').classList.toggle('is-err', S.tasks.some((x) => x.state === 'err'));
  }

  function renderInstallHead() {
    const un = S.mode === 'uninstall';
    $('#installTitle').textContent = t(un ? 'uninstallTitle' : 'installTitle');
    $('#installSub').textContent = t(un ? 'uninstallSub' : 'installSub');
  }

  function renderDone() {
    const un = S.mode === 'uninstall';
    $('#doneTitle').textContent = t(un ? 'doneUninstallTitle' : 'doneTitle');
    const st = byValue(S.defaultStyle);
    $('#doneText').textContent = un ? t('doneUninstallText') : t('doneText', { style: st ? styleName(st) : S.defaultStyle });
    $('#doneTip').hidden = un;
  }

  function errorText(r) {
    if (r.code === 'GAME_RUNNING') return t('errGame');
    if (r.code === 'STEAM_STUCK') return t('errStuck');
    if (r.code === 'SHA_MISMATCH') return t('errSha');
    if (/fetch failed|ENOTFOUND|ECONN|network|GitHub API/i.test(r.error || '')) return t('errNet');
    return t('errGeneric') + ' ' + (r.error || '');
  }

  async function runTask(tk) {
    switch (tk.id) {
      case 'check': {
        const r = await gs.detect();
        if (!r.ok) return r;
        S.det = r.state;
        if (r.state.gameRunning) return { ok: false, code: 'GAME_RUNNING' };
        if (!r.state.steamFound) return { ok: false, error: t('steamMissingTitle') };
        return r;
      }
      case 'download': {
        logLine(t('logDownloading'));
        const r = await gs.installMillennium('download');
        if (r.ok) logLine(`${t('logVerified')} (Millennium ${r.tag})`, 'ok');
        return r;
      }
      case 'close': {
        logLine(t('logClosing'));
        const r = await gs.closeSteam();
        if (r.ok) logLine(t('logClosed'), 'ok');
        return r;
      }
      case 'extract': {
        const r = await gs.installMillennium('extract');
        if (r.ok) logLine(t('logExtracted'), 'ok');
        return r;
      }
      case 'theme': {
        logLine(t('logCopy'));
        const r = await gs.installTheme({ styles: [...S.selected], defaultStyle: S.defaultStyle, language: S.themeLang });
        if (r.ok) { if (r.defaultStyle) S.defaultStyle = r.defaultStyle; logLine(t('logCopied', { path: r.dest }), 'ok'); }
        return r;
      }
      case 'remove': {
        return gs.uninstall();
      }
      case 'start': {
        logLine(t('logStarting'));
        const r = await gs.startSteam();
        if (r.ok) logLine(r.already ? t('logAlreadyRunning') : t('logStarted'), 'ok');
        return r;
      }
    }
    return { ok: false, error: 'unknown task' };
  }

  async function runTasks(from = 0) {
    S.running = true;
    S.failedAt = -1;
    $('#installError').hidden = true;
    $('#retryBtn').hidden = true;
    $('#errBack').hidden = true;
    renderSteps();
    for (let i = from; i < S.tasks.length; i++) {
      const tk = S.tasks[i];
      tk.state = 'run'; tk.sub = 0;
      renderTasks();
      let r;
      try { r = await runTask(tk); } catch (e) { r = { ok: false, error: e.message }; }
      if (!r || !r.ok) {
        tk.state = 'err';
        S.failedAt = i;
        S.running = false;
        renderTasks();
        const msg = errorText(r || {});
        logLine(msg, 'err');
        const box = $('#installError');
        box.innerHTML = `<div class="notice-ic">${icon('alert')}</div><div><div class="notice-title">${esc(t('errTitle'))}</div><p></p></div>`;
        $('p', box).textContent = msg;
        box.hidden = false;
        $('#retryBtn').hidden = false;
        $('#errBack').hidden = false;
        renderSteps();
        $('#retryBtn').focus();
        return;
      }
      tk.state = 'done'; tk.sub = 1;
      renderTasks();
    }
    if (S.mode === 'install' && !S.openSteam) logLine(t('logSkipStart'));
    S.running = false;
    await new Promise((r) => setTimeout(r, 650));
    renderDone();
    go('done');
  }

  function startInstall(mode) {
    S.mode = mode;
    S.tasks = buildTasks();
    $('#log').innerHTML = '';
    renderInstallHead();
    renderTasks();
    go('install');
    runTasks(0);
  }

  /* ---------------- events ---------------- */
  function bind() {
    document.addEventListener('click', (e) => {
      const langBtn = e.target.closest('[data-lang]');
      if (langBtn) { applyLang(langBtn.dataset.lang); return; }
      const w = e.target.closest('[data-win]');
      if (w) { gs.window(w.dataset.win); return; }
      const g = e.target.closest('[data-go]');
      if (g && !S.running) { go(g.dataset.go); return; }
      const st = e.target.closest('.step-btn');
      if (st && st.getAttribute('aria-disabled') !== 'true') { go(SCREENS[+st.dataset.step]); return; }
      const pv = e.target.closest('[data-preview]');
      if (pv) { openLightbox(+pv.dataset.preview, pv); return; }
      const tl = e.target.closest('[data-tlang]');
      if (tl) { S.themeLang = tl.dataset.tlang; S.themeLangTouched = true; renderOptions(); return; }
      const tab = e.target.closest('#lbTabs [data-tab]');
      if (tab && !tab.disabled) { S.lb.tab = tab.dataset.tab; S.lb.preferLibrary = tab.dataset.tab === 'library'; renderLightbox(); return; }
    });
    $('#grid').addEventListener('change', (e) => {
      const cb = e.target.closest('[data-sel]');
      if (cb) toggleStyle(+cb.dataset.sel, cb.checked);
    });
    $('#startBtn').addEventListener('click', () => go('check'));
    $('#recheckBtn').addEventListener('click', runDetect);
    $('#checkNext').addEventListener('click', () => go('themes'));
    $('#selAll').addEventListener('click', () => { S.styles.forEach((s) => S.selected.add(s.value)); renderGallery(); });
    $('#selNone').addEventListener('click', () => { S.selected.clear(); renderGallery(); });
    $('#defaultSel').addEventListener('change', (e) => { S.defaultStyle = e.target.value; });
    $('#openSteamChk').addEventListener('change', (e) => { S.openSteam = e.target.checked; });
    $('#installBtn').addEventListener('click', () => { if (S.selected.size) startInstall('install'); });
    $('#retryBtn').addEventListener('click', () => { if (S.failedAt >= 0) runTasks(S.failedAt); });
    $('#errBack').addEventListener('click', () => {
      S.tasks = [];
      go(S.mode === 'uninstall' ? 'welcome' : 'check');
      S.maxStep = SCREENS.indexOf(S.screen);
      renderSteps();
    });
    $('#openSteamBtn').addEventListener('click', async () => {
      const b = $('#openSteamBtn');
      b.disabled = true;
      await gs.startSteam();
      setTimeout(() => { b.disabled = false; }, 1500);
    });
    $('#uninstallLink').addEventListener('click', async () => {
      const ok = await confirmModal({ title: t('confirmUninstallTitle'), text: t('confirmUninstallText'), ok: t('confirmUninstallOk') });
      if (ok) startInstall('uninstall');
    });

    // lightbox
    $('#lbClose').addEventListener('click', closeLightbox);
    $('#lbPrev').addEventListener('click', () => moveLightbox(-1));
    $('#lbNext').addEventListener('click', () => moveLightbox(1));
    $('#lbSel').addEventListener('change', (e) => toggleStyle(S.lb.i, e.target.checked));
    $('#lightbox').addEventListener('mousedown', (e) => { if (e.target.id === 'lightbox') closeLightbox(); });
    document.addEventListener('keydown', (e) => {
      if (!S.lb.open) return;
      const rtl = S.lang === 'ar';
      if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); moveLightbox(rtl ? -1 : 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); moveLightbox(rtl ? 1 : -1); }
      else if (e.key === 'Tab') { // keep focus inside the dialog
        const f = $$('#lightbox button:not([disabled]), #lightbox input').filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    // progress / log events from main
    gs.onEvent((ev) => {
      if (ev.channel === 'progress' && ev.step === 'millennium') {
        const tk = S.tasks.find((x) => x.id === 'download');
        if (tk && tk.state === 'run') { tk.sub = ev.value; renderTasks(); }
      } else if (ev.channel === 'log') {
        const key = LOG_CODES[ev.msg];
        if (key) { if (key !== 'logDownloading') logLine(t(key)); return; }
        if (/^(copied|config-updated|remove-old)$/.test(ev.msg)) return;
        logLine(ev.msg, 'dim');
      }
    });
  }

  function paintWelcomeArt() {
    const pick = ['neon', 'classic', 'vinyl'].map((id) => S.styles.find((s) => s.id === id)).filter(Boolean);
    $('#welcomeArt').innerHTML = pick.map((st, i) => {
      const src = cardImage(st);
      return `<div class="art-card art-${i}">${src ? `<img src="${esc(src)}" alt="">` : ''}<span class="art-label">${esc(st.en)}</span></div>`;
    }).join('') + '<div class="art-glow"></div>';
  }

  /* ---------------- boot ---------------- */
  async function boot() {
    paintIcons();
    bind();
    const info = await gs.info();
    if (info.ok) {
      S.styles = info.styles;
      S.styles.forEach((s) => { if (s.group === 'core') S.selected.add(s.value); });
      $('#fakeBadge').hidden = !info.fake;
    }
    paintWelcomeArt();
    applyLang('ar');
    go('welcome');
    paintIcons();
    document.body.classList.add('is-ready');
  }
  boot();
})();
