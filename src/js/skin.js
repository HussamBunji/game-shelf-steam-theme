/* ===================================================================
   رف الألعاب — Steam UI skin (runs in every Steam client window)

   Steam's CSS class names are hashed (e.g. "_3x1HklzyDs4TEjACrRO2tB") and change
   with Steam updates. Steam also ships the map  readable name → hashed name
   (e.g. TopBar → "_2Xx…"), which Millennium exposes as MILLENNIUM_API.classMapList.
   This script resolves readable names at runtime and generates the CSS, so the
   skin keeps working after most Steam updates without edits.

   Colours / shapes come from the active theme style (--rf-* variables).
   =================================================================== */
(function () {
  'use strict';
  const ctx = (() => {
    try { if (window.opener && window.opener.MILLENNIUM_API) return window.opener; } catch (e) { /* cross-origin */ }
    return window.MILLENNIUM_API ? window : null;
  })();
  if (!ctx) return; // store/community web pages are styled by webkit.css instead

  const maps = (ctx.MILLENNIUM_API && ctx.MILLENNIUM_API.classMapList) || [];
  const missing = [];

  /** C('Key', 'HintKey'...) → ".hashed" or ":is(.h1,.h2)" — the same readable name can live in
      several CSS modules, so every match (that also has the hint keys) is included */
  function C(key, ...hints) {
    const found = new Set();
    for (const m of maps) {
      if (typeof m[key] === 'string' && hints.every(h => h in m)) found.add(m[key].split(' ')[0]);
    }
    if (!found.size) { missing.push([key, ...hints].join('+')); return null; }
    const list = [...found];
    return list.length === 1 ? '.' + list[0] : `:is(${list.map(c => '.' + c).join(',')})`;
  }
  const rules = [];
  /** rule`${C('A')} ${C('B')} { … }` — dropped when any class can't be resolved */
  function rule(strings, ...vals) {
    if (vals.some(v => !v)) return;
    rules.push(String.raw({ raw: strings }, ...vals));
  }

  const A = 'rgba(var(--rf-accent-rgb), ';

  /* ---------------- window frame + top bar ---------------- */
  rule`${C('TopBar', 'TitleBar')} { background: var(--rf-topbar) !important; position: relative; }`;
  rule`${C('TopBar', 'TitleBar')}::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--rf-topbar-line); opacity: .9; pointer-events: none; }`;
  rule`${C('TitleBar', 'TopBar')}, ${C('SuperNavBar')} { background: transparent !important; }`;
  rule`${C('MenuButton', 'SuperNav')} {
    font-family: var(--rf-heading-font) !important; letter-spacing: var(--rf-heading-spacing) !important;
    text-transform: var(--rf-heading-case) !important; color: var(--rf-text-dim) !important;
    transition: color .2s, text-shadow .2s !important; }`;
  rule`${C('MenuButton', 'SuperNav')}:hover { color: var(--rf-text) !important; }`;
  rule`${C('MenuButton', 'SuperNav')}${C('Selected', 'SuperNav')} {
    color: var(--rf-accent) !important; text-shadow: 0 0 14px ${A}.55) !important;
    border-bottom-color: var(--rf-accent) !important; }`;
  rule`${C('ContentFrame')}, ${C('LocalContentContainer')} { background: var(--rf-bg-img), var(--rf-bg) !important; }`;
  rule`${C('URLBarReplacement')} { background: transparent !important; }`;

  /* ---------------- left game list ---------------- */
  rule`${C('LeftListSizableContainer')} {
    background: var(--rf-sidebar) !important; backdrop-filter: blur(var(--rf-blur));
    border-inline-end: 1px solid var(--rf-border) !important; }`;
  rule`${C('GameListHomeAndSearch')} { background: transparent !important; }`;
  // Steam paints its blue-grey gradients on these containers (sidebar list + home body share one class)
  rule`${C('Container', 'GameListHomeAndSearch')}, ${C('AppDetailsTransitionGroup')}, ${C('BottomBar', 'BottomBarContainer')} { background: transparent !important; }`;
  rule`${C('UpdatesContainer')} { background: linear-gradient(to bottom, ${A}.07), transparent 85%) !important; }`;
  rule`${C('CollapseIconParent')} { background: linear-gradient(to left, ${A}.10), transparent 70%) !important; }`;
  rule`${C('Bar', 'Label')} { border-radius: var(--rf-radius) !important; transition: background .2s !important; }`;
  rule`${C('Bar', 'Label')}:hover { background: ${A}.10) !important; }`;
  rule`${C('Bar', 'Label')}${C('Selected', 'Bar', 'Label')} { background: ${A}.18) !important; color: var(--rf-accent) !important; box-shadow: inset 3px 0 0 var(--rf-accent); }`;
  rule`${C('GameListEntryContainer')} { border-radius: var(--rf-radius) !important; transition: background .15s !important; }`;
  rule`${C('GameListEntryContainer')}:hover { background: ${A}.10) !important; }`;
  rule`${C('SectionName', 'SectionCount')} {
    color: var(--rf-accent) !important; font-family: var(--rf-heading-font) !important;
    text-transform: var(--rf-heading-case) !important; letter-spacing: var(--rf-heading-spacing) !important; }`;
  rule`${C('SectionCount', 'SectionName')} { color: var(--rf-text-dim) !important; }`;

  /* ---------------- bottom bar ---------------- */
  rule`${C('BottomBarContainer')} { background: var(--rf-topbar) !important; position: relative; }`;
  rule`${C('BottomBarContainer')}::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--rf-topbar-line); opacity: .7; pointer-events: none; }`;
  rule`${C('AddGameButton', 'BottomBarContainer')}:hover, ${C('FriendsButton', 'BottomBarContainer')}:hover, ${C('DownloadStatus', 'BottomBarContainer')}:hover { color: var(--rf-accent) !important; }`;
  rule`${C('ProgressBar', 'BottomBarContainer')} { background: linear-gradient(90deg, var(--rf-accent), var(--rf-accent-2)) !important; }`;

  /* ---------------- game page: play bar + overview ---------------- */
  rule`${C('PlayBar', 'Glassy')}${C('Glassy', 'PlayBar')} {
    background: var(--rf-panel-2) !important; backdrop-filter: blur(calc(var(--rf-blur) + 6px)) !important;
    border-block: 1px solid var(--rf-border) !important; }`;
  rule`${C('PlayButtonContainer', 'PlayButton')}${C('Green', 'PlayButton')} {
    background: linear-gradient(135deg, var(--rf-play-1), var(--rf-play-2)) !important;
    border-radius: var(--rf-radius) !important; box-shadow: 0 6px 22px rgba(var(--rf-glow), .35) !important; }`;
  rule`${C('Green', 'PlayButton')} ${C('PlayButton', 'PlayButtonContainer')} {
    background: linear-gradient(135deg, var(--rf-play-1), var(--rf-play-2)) !important;
    border-radius: var(--rf-radius) !important; color: var(--rf-play-ink) !important; }`;
  rule`${C('PlayButtonContainer', 'PlayButton')}${C('Green', 'PlayButton')} ${C('ButtonText', 'PlayButton')} { color: var(--rf-play-ink) !important; font-weight: 800 !important; }`;
  rule`${C('Green', 'PlayButton')} ${C('PlayButton', 'PlayButtonContainer')} svg { fill: var(--rf-play-ink) !important; color: var(--rf-play-ink) !important; }`;
  rule`${C('PlayButtonContainer', 'PlayButton')}:hover { filter: brightness(1.08) saturate(1.1); }`;
  rule`${C('PlayBarLabel')} { color: var(--rf-accent) !important; opacity: .85; text-transform: var(--rf-heading-case) !important; letter-spacing: var(--rf-heading-spacing) !important; }`;
  rule`${C('PlayBarDetailLabel')} { color: var(--rf-text) !important; }`;
  rule`${C('AppDetailsOverviewPanel')} { background: transparent !important; }`;
  rule`${C('BackdropGlass')} { background: linear-gradient(var(--rf-panel), var(--rf-bg)) !important; opacity: .92; }`;
  // (don't style InCollection: its hashed class is shared with the library grid capsules)

  /* ---------------- "What's New" / updates ---------------- */
  rule`${C('PageableContainer')} ${C('Name', 'PageableContainer')} {
    font-family: var(--rf-heading-font) !important; text-transform: var(--rf-heading-case) !important;
    letter-spacing: var(--rf-heading-spacing) !important; color: var(--rf-text) !important; }`;
  rule`${C('PartnerEventRowCapsule_Container')} {
    background: var(--rf-card) !important; border: var(--rf-card-border) !important;
    border-radius: var(--rf-radius-lg) !important; overflow: hidden !important;
    transition: transform .25s, box-shadow .25s !important; }`;
  rule`${C('PartnerEventRowCapsule_Container')}:hover { transform: translateY(-3px); box-shadow: var(--rf-card-hover-shadow) !important; }`;
  rule`${C('EventSummaryType')} { color: var(--rf-accent) !important; text-transform: var(--rf-heading-case) !important; letter-spacing: var(--rf-heading-spacing) !important; }`;
  rule`${C('EventTime')} { color: var(--rf-text-dim) !important; }`;
  rule`${C('PartnerEventRowCapsule_TextTitle')} { color: var(--rf-text) !important; }`;

  /* ---------------- title bar buttons (announcements, notifications, account, big picture) ---------------- */
  const TB = (k) => C(k, 'TitleBarControls');
  rule`${TB('AnnouncementsButton')}, ${TB('NotificationsButton')}, ${TB('GamepadUIToggle')}, ${TB('VRToggle')} {
    background: ${A}.10) !important; border: 1px solid ${A}.30) !important; border-radius: var(--rf-radius) !important;
    box-shadow: none !important; color: var(--rf-text) !important; transition: background .2s !important; }`;
  rule`${TB('AnnouncementsButton')}:hover, ${TB('NotificationsButton')}:hover, ${TB('GamepadUIToggle')}:hover, ${TB('VRToggle')}:hover { background: ${A}.24) !important; }`;
  rule`${TB('AnnouncementsButton')}${TB('Active')}, ${TB('NotificationsButton')}${TB('HasNew')} {
    background: linear-gradient(135deg, var(--rf-accent), var(--rf-accent-2)) !important; border-color: transparent !important;
    box-shadow: 0 0 14px rgba(var(--rf-glow), .45) !important; }`;
  rule`${TB('AnnouncementsButton')}${TB('Active')} svg *, ${TB('NotificationsButton')}${TB('HasNew')} svg * { fill: var(--rf-accent-ink) !important; }`;
  rule`${TB('AccountMenu')} { background: ${A}.08) !important; border: 1px solid ${A}.25) !important; border-radius: var(--rf-radius) !important; }`;
  rule`${TB('AccountMenu')}:hover { background: ${A}.18) !important; }`;
  rule`${TB('WalletBalance')} { color: var(--rf-accent) !important; }`;
  rule`${TB('NotificationsMenu')}, ${TB('AccountMenuPopup')} { background: var(--rf-panel) !important; border: var(--rf-card-border) !important; border-radius: var(--rf-radius-lg) !important; }`;
  rule`${TB('NotificationMenuItem')}:hover { background: ${A}.14) !important; }`;

  /* ---------------- in-client browser URL bar (store / community) ---------------- */
  rule`${C('URLBar')} { background: var(--rf-topbar) !important; border-bottom: 1px solid ${A}.18) !important; }`;
  rule`${C('URLBarText')}, ${C('URL', 'URLBar')} { color: var(--rf-text-dim) !important; }`;

  /* ---------------- context menus + dropdowns ---------------- */
  rule`${C('contextMenu')}, ${C('MenuPopup', 'SuperNav')}, ${C('BasicContextMenuContainer')} {
    background: var(--rf-panel) !important; border: var(--rf-card-border) !important;
    border-radius: var(--rf-radius-lg) !important; box-shadow: 0 18px 46px rgba(0,0,0,.65), 0 0 0 1px rgba(0,0,0,.4) !important;
    backdrop-filter: blur(calc(var(--rf-blur) + 6px)); padding: 5px !important; }`;
  rule`${C('contextMenuContents', 'contextMenuItem')} { background: transparent !important; }`;
  rule`${C('contextMenuItem')} {
    border-radius: var(--rf-radius) !important; margin: 1px 0 !important; padding-top: 7px !important; padding-bottom: 7px !important;
    color: var(--rf-text) !important; transition: background .12s, box-shadow .12s !important; }`;
  rule`${C('contextMenuItem')}:hover, ${C('contextMenuItem')}${C('Focused', 'contextMenuItem')}, ${C('contextMenuItem')}${C('active', 'contextMenuItem')} {
    background: ${A}.18) !important; box-shadow: inset 3px 0 0 var(--rf-accent) !important; color: var(--rf-text) !important; }`;
  rule`${C('contextMenuItem')}${C('Selected', 'contextMenuItem')} { color: var(--rf-accent) !important; }`;
  rule`${C('contextMenuItem')}${C('Destructive', 'contextMenuItem')} { color: #ff7a6b !important; }`;
  rule`${C('ContextMenuSeparator')} { background: ${A}.18) !important; }`;
  rule`${C('MenuSectionHeader', 'contextMenuItem')} { color: var(--rf-accent) !important; letter-spacing: var(--rf-heading-spacing) !important; text-transform: var(--rf-heading-case) !important; }`;

  /* ---------------- tabs (game page sections, settings…) ---------------- */
  rule`${C('Tab', 'TabRow')} { border-radius: var(--rf-radius) !important; transition: background .15s, color .15s !important; }`;
  rule`${C('Tab', 'TabRow')}:hover { background: ${A}.12) !important; color: var(--rf-text) !important; }`;
  rule`${C('Tab', 'TabRow')}${C('Selected', 'Tab', 'TabRow')} { background: ${A}.2) !important; color: var(--rf-accent) !important; }`;

  /* ---------------- dialogs ---------------- */
  rule`${C('ModalDialogContent')} { background: var(--rf-panel) !important; border: var(--rf-card-border) !important; border-radius: var(--rf-radius-lg) !important; }`;

  /* ---------------- generic Steam controls (stable global class names) ---------------- */
  rules.push(`
    .DialogButton:not(.Primary) { border-radius: var(--rf-radius) !important; }
    .DialogButton.Primary, .DialogButton.Green { background: linear-gradient(135deg, var(--rf-accent), var(--rf-accent-2)) !important; color: var(--rf-accent-ink) !important; border-radius: var(--rf-radius) !important; }
    .DialogInput { border-radius: var(--rf-radius) !important; border: 1px solid var(--rf-border) !important; background-color: rgba(0,0,0,.28) !important; color: var(--rf-text) !important; }
    .DialogInput:focus { border-color: ${A}.7) !important; box-shadow: 0 0 0 3px ${A}.18) !important; }
    .DialogHeader { font-family: var(--rf-heading-font) !important; letter-spacing: var(--rf-heading-spacing) !important; }
    ::selection { background: ${A}.35); }
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${A}.22); border-radius: 10px; border: 2px solid transparent; background-clip: padding-box; }
    ::-webkit-scrollbar-thumb:hover { background: ${A}.45); background-clip: padding-box; }
    button:focus-visible, [role="button"]:focus-visible, input:focus-visible { outline: 2px solid ${A}.85) !important; outline-offset: 2px; }
  `);

  function inject() {
    if (!document.head) return void setTimeout(inject, 50);
    let s = document.getElementById('rfs-skin');
    if (!s) { s = document.createElement('style'); s.id = 'rfs-skin'; document.head.appendChild(s); }
    s.textContent = rules.join('\n');
    // "Steam Original" style: keep Steam exactly as Valve ships it (the style sheet stays, switched off)
    // off when Steam is styled by someone else: "Steam Original" (stock) or a community theme base (--rf-vendor)
    const sync = () => {
      const cs = getComputedStyle(document.documentElement);
      const v = cs.getPropertyValue('--rf-vendor').trim();
      s.media = cs.getPropertyValue('--rf-layout').trim() === 'original' || (v && v !== 'none') ? 'not all' : '';
      const id = cs.getPropertyValue('--rf-style-id').trim(); // lets flair.css / panels target the style in every window
      if (id && document.documentElement.dataset.rfsStyle !== id) document.documentElement.dataset.rfsStyle = id;
    };
    sync();
    setInterval(sync, 1500);
  }
  inject();
  window.__rfsSkin = { rules: rules.length, missing: [...new Set(missing)] };

  /* ---- bundled community themes (src/vendor: SpaceTheme, Material — both MIT, see their LICENSE files) ----
     Their style file sets --rf-vendor; this loads that theme's own CSS/JS into this window, mapped exactly
     like its own skin.json does (tools/vendor.mjs writes the map). Store/community pages: webkit.js does it. */
  (function vendorLoader() {
    if (!/steamloopback\.host$/.test(location.host)) return;
    const me = document.querySelector('script[src*="/src/js/skin.js"]');
    const BASE = me ? me.src.replace(/src\/js\/skin\.js.*$/, '') : 'https://millennium.host/v1/themes/rf-shelf/';
    const done = new Set();
    let active = '', skipList = [];
    const matches = p => {
      // ".friendsui-container" / "[href=…]" are selectors; ".*", "^Steam$", "Menu$" are title regexes
      try { return /^(\.[A-Za-z_-]|\[)/.test(p) ? !!document.querySelector(p) : new RegExp(p).test(document.title); } catch (e) { return false; }
    };
    const url = (id, f) => BASE + 'src/vendor/' + id + '/' + f;
    function apply(man) {
      for (const e of man.win) {
        const key = (e.css || '') + '|' + (e.js || '');
        if (done.has(key) || !e.m.some(matches) || skipList.some(x => key.includes(x))) continue;
        done.add(key);
        if (e.css) {
          const l = document.createElement('link');
          l.rel = 'stylesheet'; l.href = url(man.id, e.css); l.dataset.rfsVendor = man.id;
          document.head.appendChild(l);
        }
        if (e.js) {
          const s = document.createElement('script');
          s.type = 'module'; s.src = url(man.id, e.js); s.dataset.rfsVendor = man.id;
          document.head.appendChild(s);
        }
      }
    }
    function check() {
      if (!document.head) return;
      const cs = getComputedStyle(document.documentElement);
      let v = cs.getPropertyValue('--rf-vendor').trim();
      if (v === 'none') v = '';
      const skip = cs.getPropertyValue('--rf-vendor-skip').trim().split(',').map(x => x.trim()).filter(x => x && x !== 'none');
      skipList = skip;
      if (v !== active) {
        document.querySelectorAll('link[data-rfs-vendor]').forEach(n => n.remove());
        done.clear();
        active = v;
      }
      if (!v) return;
      const man = window.__rfsVendors && window.__rfsVendors[v];
      if (man) { apply(man); return; }
      if (!document.querySelector(`script[data-rfs-man="${v}"]`)) {
        const s = document.createElement('script');
        s.src = url(v, 'rfs-manifest.js'); s.dataset.rfsMan = v; s.onload = check;
        document.head.appendChild(s);
      }
    }
    check();
    setInterval(check, 1500); // dialogs / friends windows get their matching class a moment later
  })();
})();
