/* Game Shelf Installer — renderer. Talks to the main process only through window.gs (preload). */
(function () {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');

  const SCREENS = ['welcome', 'check', 'themes', 'install', 'done'];
  const STEP_KEYS = ['stepWelcome', 'stepCheck', 'stepThemes', 'stepInstall', 'stepDone'];
  const GITHUB = 'https://github.com/SteamClientHomebrew/Millennium';
  // each theme's own colour (same as the website); used for small dots and the stage glow only
  const VIBE = {
    classic: '#d49a5a', glass: '#8fc2ff', neon: '#3fe0f0', terminal: '#4cff8f', vault: '#c79bff', vinyl: '#ff8c42',
    cork: '#e8c27a', arcade: '#ff4f8b', magazine: '#f1ece2', cupertino: '#d8dbe2', cyberpunk: '#f3e600', shelter: '#a6e86a',
    xmb: '#7cb8ff', original: '#66c0f4', space: '#9aa8ff', material: '#a8c7fa',
  };
  // the looks that take turns being lit on the welcome wall
  const HERO_IDS = ['classic', 'neon', 'vinyl', 'arcade', 'glass', 'cork', 'vault', 'terminal'];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

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
    version: '',
    view: { i: 0, tab: 'library', front: 'a', draw: 0 },
  };

  const t = (key, vars) => {
    let s = (I18N[S.lang] && I18N[S.lang][key]) ?? I18N.en[key] ?? key;
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  };
  const styleName = (st) => (S.lang === 'ar' ? st.ar : st.en);
  const styleDesc = (st) => (S.lang === 'ar' ? st.descAr : st.descEn);
  const byValue = (v) => S.styles.find((s) => s.value === v);
  const vibe = (st) => (st && VIBE[st.id]) || '#d49a5a';
  const thumbOf = (src) => (src ? src.replace('/previews/', '/previews/thumb/') : null);
  const views = (st) => [st.library && 'library', st.store && 'store'].filter(Boolean);
  const rtl = () => S.lang === 'ar';
  // CSP forbids inline style attributes, so custom properties travel as data-* and are set through the CSSOM
  const VARS = { c: '--c', d: '--d', o: '--o', p: '--p' };
  const applyVars = (root) => {
    for (const k in VARS) $$(`[data-${k}]`, root).forEach((el) => el.style.setProperty(VARS[k], el.dataset[k]));
  };

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
    const other = lang === 'ar' ? 'en' : 'ar';
    const lbl = $('#tbLangLabel');
    lbl.textContent = other === 'ar' ? 'العربية' : 'English';
    lbl.lang = other;
    $('#tbLang').dataset.lang = other;
    if (!S.themeLangTouched) S.themeLang = lang === 'ar' ? 'Arabic' : 'English';
    document.title = t('appTitle');
    renderSteps();
    renderChecks();
    renderGallery();
    renderViewer(true);
    renderOptions();
    renderTasks();
    renderInstallHead();
    renderDone();
    markFeatured();
  }

  /* ---------------- step progress (title bar) + navigation ---------------- */
  function renderSteps() {
    const cur = SCREENS.indexOf(S.screen);
    $('#steps').innerHTML = STEP_KEYS.map((k, i) => {
      if (i === 0) return '';
      const state = i < cur ? 'done' : i === cur ? 'current' : 'todo';
      const clickable = !S.running && i <= S.maxStep && i < 3 && cur < 3 && i !== cur;
      return `<li class="step is-${state}">
        <button type="button" class="step-btn" data-step="${i}" ${clickable ? '' : 'tabindex="-1" aria-disabled="true"'} ${state === 'current' ? 'aria-current="step"' : ''}>
          <span class="step-n">${pad(i)}</span><span class="step-label">${esc(t(k))}</span>
        </button></li>`;
    }).join('');
    renderStepsFill();
  }
  function renderStepsFill(p) {
    const cur = SCREENS.indexOf(S.screen);
    let f = cur <= 0 ? 0 : cur === 3 ? 0.5 + 0.25 * (p ?? installProgress()) : cur === 4 ? 1 : cur / 4;
    if (cur === 3 && S.mode === 'uninstall') f = 0.25 + 0.5 * (p ?? installProgress());
    $('#stepsFill').style.transform = `scaleX(${f})`;
  }

  function go(screen) {
    const idx = SCREENS.indexOf(screen);
    if (idx < 0) return;
    const prevIdx = SCREENS.indexOf(S.screen);
    const prevEl = $(`.screen[data-screen="${S.screen}"]`);
    const active = $(`.screen[data-screen="${screen}"]`);
    // slide direction: forward moves content toward the reading start, mirrored for Arabic
    const sign = (idx >= prevIdx ? 1 : -1) * (rtl() ? -1 : 1);
    const instant = reduced.matches || prevEl === active || !document.body.classList.contains('is-ready');
    if (prevEl && prevEl !== active) prevEl.style.setProperty('--leave', `${-24 * sign}px`);
    if (!instant) {
      active.classList.add('is-instant');
      active.style.transform = `translate3d(${24 * sign}px,0,0)`;
      void active.offsetWidth;
      active.classList.remove('is-instant');
      active.style.transform = '';
    }
    S.screen = screen;
    S.maxStep = Math.max(S.maxStep, idx);
    $('#app').dataset.screen = screen;
    $$('.screen').forEach((el) => el.classList.toggle('is-active', el === active));
    renderSteps();
    $$('.split, .inst', active).forEach((b) => { b.scrollTop = 0; });
    if (screen === 'check') runDetect();
    if (screen === 'themes') { renderOptions(); renderViewer(true); scrollFilm(true); }
    if (screen === 'welcome') markFeatured();
    // move focus to the screen heading for keyboard / screen-reader users
    const h = active.querySelector('h1, h2');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  /* ---------------- welcome: the drifting wall ---------------- */
  let featI = 0, featTimer = null;
  function buildWall() {
    const shots = S.styles.filter((st) => st.group === 'core' && st.id !== 'original')
      .flatMap((st) => views(st).map((v) => ({ id: st.id, v, src: thumbOf(st[v]), full: st[v] })));
    if (!shots.length) return;
    const cols = 4, per = Math.ceil(shots.length / cols) + 1;
    let html = '';
    for (let c = 0; c < cols; c++) {
      const list = [];
      for (let k = 0; k < per; k++) list.push(shots[(c * 5 + k * 7) % shots.length]);
      const frames = list.map((s) => `<figure class="frame" data-id="${s.id}"><img src="${esc(s.src)}" data-full="${esc(s.full)}" alt="" width="640" height="${s.v === 'library' ? 324 : 360}" decoding="async"></figure>`).join('');
      html += `<div class="col"><div class="col-track${c % 2 ? ' is-down' : ''}" data-d="${48 + (c % 3) * 9}s" data-o="${-(c * 7) % 23}s">${frames}${frames}</div></div>`;
    }
    const wall = $('#wall');
    wall.innerHTML = html;
    applyVars(wall);
    $$('img', wall).forEach((im) => {
      const on = () => im.classList.add('is-in');
      im.addEventListener('error', () => { if (im.dataset.full && im.src.indexOf('/thumb/') > -1) im.src = im.dataset.full; }, { once: true });
      if (im.complete && im.naturalWidth) on(); else im.addEventListener('load', on, { once: true });
    });
    markFeatured();
  }
  function markFeatured() {
    const st = S.styles.find((s) => s.id === HERO_IDS[featI]);
    if (!st) return;
    $('.screen-welcome').style.setProperty('--wash', vibe(st));
    $$('#wall .frame').forEach((f) => f.classList.toggle('is-feat', f.dataset.id === st.id));
    $('#nowName').textContent = styleName(st);
    const bar = $('#nowBar'); bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
  }
  function startFeature() {
    clearInterval(featTimer);
    if (reduced.matches) return;
    featTimer = setInterval(() => {
      if (document.hidden || S.screen !== 'welcome' || document.body.classList.contains('is-paused')) return;
      featI = (featI + 1) % HERO_IDS.length;
      markFeatured();
    }, 6000);
  }

  /* ---------------- system check ---------------- */
  async function runDetect() {
    S.detecting = true;
    renderChecks();
    const [r] = await Promise.all([gs.detect(), new Promise((res) => setTimeout(res, 450))]);
    S.detecting = false;
    S.det = r.ok ? r.state : null;
    renderChecks(true);
  }

  function row(title, detail, state, pathText) {
    const word = { ok: t('stOk'), info: t('stInfo'), warn: t('stWarn'), err: t('stErr'), busy: '' }[state];
    const mark = { ok: 'check', info: 'dot', warn: 'alertMini', err: 'x', busy: 'spinner' }[state];
    return `<div class="crow st-${state}">
      <span class="crow-mark">${mark === 'alertMini' ? '<b class="crow-bang">!</b>' : icon(mark)}</span>
      <div class="crow-text"><div class="crow-title">${esc(title)}</div>
        <div class="crow-detail">${esc(detail)}</div>${pathText ? `<span class="crow-path">${esc(pathText)}</span>` : ''}</div>
      <span class="crow-state">${esc(word)}</span>
    </div>`;
  }

  function renderChecks(animate) {
    const list = $('#checkList');
    const notice = $('#checkNotice');
    const d = S.det;
    list.classList.toggle('is-in', !!animate);
    if (S.detecting || !d) {
      list.innerHTML = ['chkSteam', 'chkMill', 'chkRunning', 'chkGame'].map((k) => row(t(k), t('checking'), 'busy')).join('');
      notice.hidden = true;
      $('#checkNext').disabled = true;
      return;
    }
    list.innerHTML = [
      row(t('chkSteam'), d.steamFound ? t('chkSteamOk') : t('chkSteamNo'), d.steamFound ? 'ok' : 'err', d.root),
      row(t('chkMill'), d.millennium ? t('chkMillOk') : t('chkMillNo'), d.millennium ? 'ok' : 'warn'),
      row(t('chkRunning'), d.steamRunning ? t('chkRunningYes') : t('chkRunningNo'), d.steamRunning ? 'info' : 'ok'),
      row(t('chkGame'), d.gameRunning ? t('chkGameYes') : t('chkGameNo'), d.gameRunning ? 'err' : 'ok'),
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
          <label class="cb"><input type="checkbox" class="sr" id="consentChk" ${S.consent ? 'checked' : ''}><span class="cb-box">${icon('check')}</span><span>${esc(t('millConsent'))}</span></label>
          <button type="button" class="ulink" id="ghLink">${icon('github')}<span>${esc(t('millLink'))}</span></button>
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

  /* ---------------- themes: filmstrip ---------------- */
  function renderGallery() {
    const grid = $('#grid');
    if (!S.styles.length) return;
    const item = (st, i) => {
      const src = thumbOf(st.library || st.store);
      return `<div class="fitem" data-i="${i}" data-c="${vibe(st)}">
        <button type="button" class="fthumb" data-view="${i}" aria-label="${esc(t('preview') + ': ' + styleName(st))}">
          ${src ? `<img src="${esc(src)}" data-full="${esc(st.library || st.store)}" alt="" loading="lazy" decoding="async">` : '<span class="soonthumb"></span>'}
        </button>
        <button type="button" class="fcheck" data-sel="${i}" role="checkbox" aria-checked="false" aria-label="${esc(t('includeStyle') + ': ' + styleName(st))}">${icon('check')}</button>
        <span class="fname"><i></i><span>${esc(styleName(st))}</span></span>
      </div>`;
    };
    const groups = [['core', 'groupCore'], ['community', 'groupCommunity']];
    grid.innerHTML = groups.map(([g, title]) => {
      const items = S.styles.map((st, i) => [st, i]).filter(([st]) => st.group === g);
      if (!items.length) return '';
      return `<div class="fgroup fgroup-${g === 'core' ? 'core' : 'extra'}">
        <p class="flabel">${esc(t(title))}<b data-group-count="${g}"></b></p>
        <div class="frow">${items.map(([st, i]) => item(st, i)).join('')}</div></div>`;
    }).join('');
    applyVars(grid);
    $$('img', grid).forEach((im) => im.addEventListener('error', () => {
      if (im.src.indexOf('/thumb/') > -1) im.src = im.dataset.full;
      else im.replaceWith(Object.assign(document.createElement('span'), { className: 'soonthumb' }));
    }));
    updateSelectionUI();
  }

  function toggleStyle(i, on) {
    const st = S.styles[i];
    if (!st) return;
    if (on === undefined) on = !S.selected.has(st.value);
    if (on) S.selected.add(st.value); else S.selected.delete(st.value);
    updateSelectionUI();
  }

  function updateSelectionUI() {
    const n = S.selected.size;
    $('#selCount').textContent = t('selCount', { n, total: S.styles.length });
    $('#installBtn').disabled = n === 0;
    $('#installCount').textContent = n ? String(n) : '';
    $('#selHint').hidden = n !== 0;
    $('#selAll').disabled = n === S.styles.length;
    $('#selNone').disabled = n === 0;
    $$('#grid .fitem').forEach((el) => {
      const st = S.styles[+el.dataset.i];
      const on = S.selected.has(st.value);
      el.classList.toggle('is-selected', on);
      $('.fcheck', el).setAttribute('aria-checked', String(on));
    });
    $$('[data-group-count]').forEach((el) => {
      const items = S.styles.filter((x) => x.group === el.dataset.groupCount);
      el.textContent = `${items.filter((x) => S.selected.has(x.value)).length}/${items.length}`;
    });
    renderOptions();
    renderViewerInfo();
  }

  function renderOptions() {
    const chosen = S.styles.filter((s) => S.selected.has(s.value));
    if (!chosen.some((s) => s.value === S.defaultStyle)) S.defaultStyle = chosen[0] ? chosen[0].value : '';
    const def = byValue(S.defaultStyle);
    $('#defaultName').innerHTML = def ? `<i data-c="${vibe(def)}"></i>${esc(styleName(def))}` : '<span class="opt-none">—</span>';
    applyVars($('#defaultName'));
    $$('[data-tlang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tlang === S.themeLang)));
    // a small star next to the default look in the filmstrip
    $$('#grid .fitem').forEach((el) => {
      const st = S.styles[+el.dataset.i];
      const name = $('.fname', el);
      const star = $('.ic', name);
      const isDef = st.value === S.defaultStyle;
      if (isDef && !star) name.insertAdjacentHTML('beforeend', `<span class="ic">${icon('star')}</span>`);
      if (!isDef && star) star.remove();
    });
    const cur = S.styles[S.view.i];
    if (cur) {
      const isDef = cur.value === S.defaultStyle;
      $('#vDefault').hidden = !isDef;
      const md = $('#vMakeDefault');
      md.disabled = isDef;
      $('span:last-child', md).textContent = t(isDef ? 'isDefault' : 'makeDefault');
    }
  }

  /* ---------------- themes: showcase stage ---------------- */
  function renderViewerInfo() {
    const st = S.styles[S.view.i];
    if (!st) return;
    const v = views(st);
    $('#viewer').style.setProperty('--vibe', vibe(st));
    $('.panel').style.setProperty('--vibe', vibe(st));
    $('#vIndex').textContent = `${pad(S.view.i + 1)} / ${pad(S.styles.length)}`;
    $('#vGroup').textContent = t(st.group === 'community' ? 'groupCommunity' : 'groupCore');
    $('#vName').textContent = styleName(st);
    $('#vDesc').textContent = styleDesc(st);
    $$('#vTabs [data-tab]').forEach((b) => {
      const has = v.includes(b.dataset.tab);
      b.disabled = !has;
      b.title = has ? '' : t(b.dataset.tab === 'library' ? 'noLibrary' : 'noImage');
      b.setAttribute('aria-pressed', String(has && b.dataset.tab === S.view.tab));
    });
    const on = S.selected.has(st.value);
    const inc = $('#vInclude');
    inc.setAttribute('aria-pressed', String(on));
    $('#vIncludeSub').textContent = t(on ? 'includedSub' : 'excludedSub');
    $$('#grid .fitem').forEach((el) => el.classList.toggle('is-current', +el.dataset.i === S.view.i));
    renderOptions();
  }

  function renderViewer(instant) {
    const st = S.styles[S.view.i];
    if (!st) return;
    const v = views(st);
    if (!v.includes(S.view.tab)) S.view.tab = v[0] || 'library';
    renderViewerInfo();
    const my = ++S.view.draw;
    const back = S.view.front === 'a' ? 'b' : 'a';
    const layer = $(`#vstage [data-layer="${back}"]`);
    const swap = () => {
      if (my !== S.view.draw) return;
      $$('#vstage .vlayer').forEach((l) => l.classList.toggle('is-on', l === layer));
      S.view.front = back;
    };
    if (!v.length) {
      layer.innerHTML = `<div class="soon"><div><p class="soon-k">${esc(t('previewSoon'))}</p><p class="soon-n">${esc(styleName(st))}</p></div></div>`;
      swap();
      return;
    }
    const src = st[S.view.tab];
    layer.innerHTML = `<img class="vblur" src="${esc(thumbOf(src))}" alt="" aria-hidden="true"><img class="vimg" src="${esc(src)}" alt="${esc(styleName(st))}">`;
    const blur = $('.vblur', layer);
    blur.addEventListener('error', () => { blur.src = src; }, { once: true });
    const im = $('.vimg', layer);
    im.addEventListener('error', () => { layer.innerHTML = `<div class="soon"><div><p class="soon-k">${esc(t('noImage'))}</p><p class="soon-n">${esc(styleName(st))}</p></div></div>`; swap(); }, { once: true });
    (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(swap);
    if (instant) swap();
    // warm the neighbours
    [S.view.i - 1, S.view.i + 1].forEach((k) => {
      const n = S.styles[(k + S.styles.length) % S.styles.length];
      const nv = n && (n[S.view.tab] || n.library || n.store);
      if (nv) new Image().src = nv;
    });
  }

  function viewTheme(i) {
    const n = S.styles.length;
    if (!n) return;
    S.view.i = (i + n) % n;
    renderViewer();
    scrollFilm();
    // keep keyboard focus on the matching thumbnail when browsing from the filmstrip
    const ae = document.activeElement;
    if (ae && ae.closest && ae.closest('#grid')) {
      const th = $(`#grid .fitem[data-i="${S.view.i}"] .fthumb`);
      if (th) th.focus({ preventScroll: true });
    }
  }
  function scrollFilm(instant) {
    const el = $(`#grid .fitem[data-i="${S.view.i}"]`);
    const film = $('#grid');
    if (!el || !film.clientWidth) return;
    const r = el.getBoundingClientRect(), fr = film.getBoundingClientRect();
    const margin = 60;
    if (r.left < fr.left + margin || r.right > fr.right - margin) {
      film.scrollBy({ left: (r.left + r.width / 2) - (fr.left + fr.width / 2), behavior: instant || reduced.matches ? 'auto' : 'smooth' });
    }
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
      document.body.classList.add('is-modal');
      requestAnimationFrame(() => m.classList.add('is-open'));
      const prev = document.activeElement;
      $('#modalCancel').focus();
      const done = (v) => {
        m.classList.remove('is-open');
        setTimeout(() => { m.hidden = true; document.body.classList.remove('is-modal'); }, 220);
        $('#modalOk').onclick = $('#modalCancel').onclick = null;
        document.removeEventListener('keydown', onKey, true);
        if (prev && prev.focus) prev.focus();
        resolve(v);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); done(false); }
        else if (e.key === 'Tab') { // keep focus inside the dialog
          const f = [$('#modalCancel'), $('#modalOk')];
          const i = f.indexOf(document.activeElement);
          e.preventDefault();
          f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
        }
      };
      document.addEventListener('keydown', onKey, true);
      $('#modalOk').onclick = () => done(true);
      $('#modalCancel').onclick = () => done(false);
      m.onmousedown = (e) => { if (e.target === m) done(false); };
    });
  }

  /* ---------------- install / uninstall runner ---------------- */
  const LOG_CODES = {
    'steam-not-running': 'logNotRunning', 'millennium-fetch-release': 'logDownloading',
    'theme-removed': 'logRemoved',
  };
  let logN = 0;
  function logLine(msg, kind) {
    const el = $('#log');
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    const line = document.createElement('div');
    line.className = 'log-line' + (kind ? ' log-' + kind : '');
    line.innerHTML = `<span class="log-time">${time}</span><span class="log-msg"></span>`;
    line.lastChild.textContent = msg;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
    logN++;
    $('#logCount').textContent = String(logN);
  }

  function buildTasks() {
    const d = S.det || {};
    if (S.mode === 'uninstall') {
      return [
        { id: 'check', key: 'taskCheck', w: 0.5 },
        { id: 'close', key: 'taskClose', w: 1 },
        { id: 'remove', key: 'taskRemove', w: 1 },
        { id: 'start', key: 'taskStart', w: 0.5 },
      ].map((x) => ({ ...x, state: 'todo', sub: 0 }));
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
    if (!S.tasks.length) { ol.innerHTML = ''; renderProgress(); return; }
    ol.innerHTML = S.tasks.map((tk, i) => {
      let state;
      if (tk.state === 'todo') state = esc(t('stWaiting'));
      else if (tk.state === 'run') {
        const pct = tk.id === 'download' && tk.sub > 0 ? ` <span class="task-pct">${Math.round(tk.sub * 100)}%</span>` : '';
        state = `${icon('spinner')}<span>${esc(t('stRunning'))}${pct}</span>`;
      } else if (tk.state === 'done') state = `${icon('check')}<span>${esc(t('stDone'))}</span>`;
      else state = `${icon('x')}<span>${esc(t('stFailed'))}</span>`;
      const p = tk.state === 'run' && tk.id === 'download' ? tk.sub : tk.state === 'done' ? 1 : 0;
      return `<li class="task is-${tk.state}" data-p="${p}"><span class="task-n">${i + 1}</span><span class="task-label">${esc(t(tk.key))}</span><span class="task-state">${state}</span></li>`;
    }).join('');
    applyVars(ol);
    renderProgress();
  }

  function installProgress() {
    const total = S.tasks.reduce((a, x) => a + x.w, 0) || 1;
    const got = S.tasks.reduce((a, x) => a + (x.state === 'done' ? x.w : x.state === 'run' ? x.w * (x.sub || 0.15) : 0), 0);
    return Math.max(0, Math.min(1, got / total));
  }

  function renderProgress() {
    const p = installProgress();
    $('#progFill').style.transform = `scaleX(${p})`;
    $('#progPct').textContent = String(Math.round(p * 100));
    const cur = S.tasks.find((x) => x.state === 'run') || S.tasks.find((x) => x.state === 'err');
    $('#progLabel').textContent = cur ? t(cur.key) : (p >= 1 ? t('progressDone') : '');
    const err = S.tasks.some((x) => x.state === 'err');
    $('#bar').classList.toggle('is-err', err);
    $('#bar').classList.toggle('is-run', !err && S.tasks.some((x) => x.state === 'run'));
    if (S.screen === 'install') renderStepsFill(p);
  }

  function renderInstallHead() {
    const un = S.mode === 'uninstall';
    $('#app').dataset.mode = S.mode;
    $('#installLabel').textContent = t(un ? 'uninstallLabel' : 'stepInstall');
    $('#installTitle').textContent = t(un ? 'uninstallTitle' : 'installTitle');
    $('#installAccent').textContent = t(un ? 'uninstallAccent' : 'installAccent');
    $('#installSub').textContent = t(un ? 'uninstallSub' : 'installSub');
  }

  function renderDone() {
    const un = S.mode === 'uninstall';
    $('#doneLabel').textContent = t('stepDone');
    $('#doneTitle').textContent = t(un ? 'doneUninstallTitle' : 'doneTitle');
    $('#doneAccent').textContent = t(un ? 'doneUninstallAccent' : 'doneAccent');
    const st = byValue(S.defaultStyle);
    $('#doneText').textContent = un ? t('doneUninstallText') : t('doneText', { style: st ? styleName(st) : S.defaultStyle });
    $('#doneTip').hidden = un;
    $('#doneStyle').textContent = st ? styleName(st) : '';
    const frame = $('#doneFrame');
    const src = st && (st.library || st.store);
    frame.style.setProperty('--vibe', vibe(st));
    $('#doneArt').style.setProperty('--vibe', vibe(st));
    if (frame.dataset.src !== (src || '')) {
      frame.dataset.src = src || '';
      frame.innerHTML = src ? `<img src="${esc(src)}" alt="${esc(st ? styleName(st) : '')}">` : `<div class="soon"><div><p class="soon-n">${esc(st ? styleName(st) : '')}</p></div></div>`;
    }
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
        if (r.ok) { if (r.defaultStyle) S.defaultStyle = r.defaultStyle; logLine(t('logCopied', { path: r.dest }) + ' ' + r.dest, 'ok'); }
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
    await new Promise((r) => setTimeout(r, 750));
    renderDone();
    go('done');
  }

  function startInstall(mode) {
    S.mode = mode;
    S.tasks = buildTasks();
    $('#log').innerHTML = '';
    logN = 0;
    $('#logCount').textContent = '';
    setDrawer(false);
    renderInstallHead();
    renderTasks();
    renderDone();
    go('install');
    runTasks(0);
  }

  function setDrawer(open) {
    $('#drawer').classList.toggle('is-open', open);
    $('#drawerBtn').setAttribute('aria-expanded', String(open));
    if (open) { const l = $('#log'); l.scrollTop = l.scrollHeight; }
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
      const tl = e.target.closest('[data-tlang]');
      if (tl) { S.themeLang = tl.dataset.tlang; S.themeLangTouched = true; renderOptions(); return; }
      const tab = e.target.closest('#vTabs [data-tab]');
      if (tab && !tab.disabled) { S.view.tab = tab.dataset.tab; renderViewer(); return; }
    });
    $('#grid').addEventListener('click', (e) => {
      const sel = e.target.closest('[data-sel]');
      if (sel) { toggleStyle(+sel.dataset.sel); return; }
      const v = e.target.closest('[data-view]');
      if (v) viewTheme(+v.dataset.view);
    });
    // a vertical mouse wheel scrolls the filmstrip sideways
    $('#grid').addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      $('#grid').scrollLeft += (rtl() ? -1 : 1) * e.deltaY;
    }, { passive: false });
    $('#vPrev').addEventListener('click', () => viewTheme(S.view.i - 1));
    $('#vNext').addEventListener('click', () => viewTheme(S.view.i + 1));
    $('#vInclude').addEventListener('click', () => toggleStyle(S.view.i));
    $('#vMakeDefault').addEventListener('click', () => {
      const st = S.styles[S.view.i];
      if (!st) return;
      S.selected.add(st.value);
      S.defaultStyle = st.value;
      updateSelectionUI();
    });
    $('#startBtn').addEventListener('click', () => go('check'));
    $('#recheckBtn').addEventListener('click', runDetect);
    $('#checkNext').addEventListener('click', () => go('themes'));
    $('#selAll').addEventListener('click', () => { S.styles.forEach((s) => S.selected.add(s.value)); updateSelectionUI(); });
    $('#selNone').addEventListener('click', () => { S.selected.clear(); updateSelectionUI(); });
    $('#openSteamChk').addEventListener('change', (e) => { S.openSteam = e.target.checked; });
    $('#installBtn').addEventListener('click', () => { if (S.selected.size) startInstall('install'); });
    $('#retryBtn').addEventListener('click', () => { if (S.failedAt >= 0) runTasks(S.failedAt); });
    $('#errBack').addEventListener('click', () => {
      S.tasks = [];
      go(S.mode === 'uninstall' ? 'welcome' : 'check');
      S.maxStep = SCREENS.indexOf(S.screen);
      renderSteps();
    });
    $('#drawerBtn').addEventListener('click', () => setDrawer(!$('#drawer').classList.contains('is-open')));
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

    // keyboard on the themes screen: arrows browse, Space toggles the current look
    document.addEventListener('keydown', (e) => {
      if (S.screen !== 'themes' || !$('#modal').hidden || e.altKey || e.ctrlKey || e.metaKey) return;
      const tg = e.target;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (tg.closest && tg.closest('.toggle')) return;
        e.preventDefault();
        const fwd = e.key === 'ArrowRight' ? 1 : -1;
        viewTheme(S.view.i + (rtl() ? -fwd : fwd));
      } else if (e.key === ' ' && !(tg.closest && tg.closest('button, input, label') && !tg.closest('.fthumb'))) {
        e.preventDefault();
        toggleStyle(S.view.i);
      }
    });

    // pause the wall when the window is hidden or blurred
    const pause = () => document.body.classList.toggle('is-paused', document.hidden || !document.hasFocus());
    document.addEventListener('visibilitychange', pause);
    window.addEventListener('blur', pause);
    window.addEventListener('focus', pause);

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

  /* ---------------- boot ---------------- */
  async function boot() {
    paintIcons();
    bind();
    const info = await gs.info();
    if (info.ok) {
      S.styles = info.styles;
      S.styles.forEach((s) => { if (s.group === 'core') S.selected.add(s.value); });
      $('#fakeBadge').hidden = !info.fake;
      if (info.version) $('#tbVer').textContent = 'Installer ' + info.version;
    }
    buildWall();
    applyLang('ar');
    go('welcome');
    paintIcons();
    startFeature();
    reduced.addEventListener?.('change', startFeature);
    requestAnimationFrame(() => document.body.classList.add('is-ready'));
  }
  boot();
})();
