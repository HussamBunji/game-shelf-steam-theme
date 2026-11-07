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

  /** the same, for rules that must stay on under a community base too (the rfs-skin sheet is switched off then) */
  const urules = [];
  function urule(strings, ...vals) {
    if (vals.some(v => !v)) return;
    urules.push(String.raw({ raw: strings }, ...vals));
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

  /* ---------------- the user box (account + its buttons) ----------------
     The community base (SpaceTheme) parks it at the bottom of the left sidebar. Our home designs hide that sidebar,
     so it ended up floating alone in the corner, over the designs' own buttons. Each style now gives it a place of
     its own, the same on the store, the library and every game page:
       • a footer bar along the bottom of the window (Arcade = the cabinet's control panel, Terminal = the status
         line, Vinyl, Classic) — Steam's frame is shortened by its height, so nothing is ever under it;
       • or the title bar, just before the window buttons and never over them (Glass, Magazine, Vault, Cork, Neon,
         SpaceTheme).
     Colours come from --rf-footer-* / --rf-user-* in styles/*.css. Material You keeps its own toolbar; Steam
     Original keeps Valve's. */
  const U = 'html:not([data-rfs-style="material"]):not([data-rfs-style="original"])';
  const FOOT = 'html:is([data-rfs-style="arcade"], [data-rfs-style="terminal"], [data-rfs-style="vinyl"], [data-rfs-style="classic"], [data-rfs-style="cyberpunk"], [data-rfs-style="shelter"])';
  const HEAD = 'html:is([data-rfs-style="glass"], [data-rfs-style="magazine"], [data-rfs-style="vault"], [data-rfs-style="cork"], [data-rfs-style="neon"], [data-rfs-style="space"], [data-rfs-style="cupertino"])';
  urule`${FOOT} ${C('TitleBarControls')} {
    position: fixed !important; inset: auto 0 0 0 !important; z-index: 900; display: flex !important;
    flex-direction: row !important; align-items: center !important; justify-content: flex-start !important;
    width: auto !important; max-width: none !important; height: 46px !important; gap: 8px !important; margin: 0 !important; padding: 0 16px !important;
    background: var(--rf-footer-bg, var(--rf-sidebar, #0e141c)) !important; border: 0 !important;
    border-top: var(--rf-footer-line, 1px solid ${A}.22)) !important; border-radius: 0 !important; box-shadow: 0 -6px 18px rgba(0, 0, 0, .25) !important;
    -webkit-app-region: no-drag; }`;
  urule`${FOOT} ${C('OuterFrame')} { padding-bottom: 46px !important; box-sizing: border-box !important; }`;
  urule`${HEAD} ${C('TitleBarControls')} {
    position: relative !important; inset: auto !important; z-index: 5; display: flex !important;
    flex-direction: row !important; align-items: center !important; flex: 0 0 auto !important;
    width: auto !important; max-width: none !important; height: 100% !important; gap: 6px !important; margin: 0 28px 0 0 !important; padding: 0 !important;
    background: none !important; border: 0 !important; box-shadow: none !important; -webkit-app-region: no-drag; }`;
  urule`${U} ${C('TitleBarControls')} > * { flex: 0 0 auto !important; width: auto !important; }`;
  /* SpaceTheme hides the box on pages without its game list (body:not(:has(list)) → visibility: hidden): we took the
     list off the store and the home design, which made the user name vanish there — it shows on every page */
  urule`${U} ${C('TitleBarControls')} { visibility: visible !important; }`;
  urule`${U} ${C('TitleBarControls')} .userpanel-buttoncontainer { display: flex !important; flex-direction: row !important; gap: 4px !important; width: auto !important; }`;
  urule`${U} ${C('TitleBarControls')} ${C('AccountMenu')} {
    height: 32px !important; max-height: 32px !important; padding: 0 12px 0 4px !important; gap: 8px !important;
    font: var(--rf-user-font, 600 13px var(--rf-font-ui, inherit)) !important; color: var(--rf-user-ink, var(--rf-text)) !important;
    background: var(--rf-user-bg, ${A}.10)) !important; border: var(--rf-user-border, 1px solid ${A}.28)) !important;
    border-radius: var(--rf-user-radius, var(--rf-radius)) !important; box-shadow: var(--rf-user-shadow, none) !important; }`;
  urule`${U} ${C('TitleBarControls')} ${C('AccountMenu')}:hover { background: var(--rf-user-bg-hover, ${A}.2)) !important; }`;
  urule`${U} ${C('TitleBarControls')} ${C('AccountMenu')} .avatarHolder { margin: 0 !important; }`;
  urule`${U} ${C('TitleBarControls')} .userpanel-buttoncontainer > :not(#rfs-family), ${U} ${C('TitleBarControls')} .userpanel-buttoncontainer :is(button, [class*="Button"]) {
    width: 32px !important; min-width: 32px !important; height: 32px !important; padding: 0 !important; }`;
  /* SpaceTheme builds the settings button itself: its inner box was 28 px and top-aligned — the same 32 px as the rest */
  urule`${U} ${C('TitleBarControls')} .userpanel-buttoncontainer .st-steam-settings > * {
    width: 32px !important; height: 32px !important; display: flex !important; align-items: center !important; justify-content: center !important; }`;
  urule`${U} ${C('TitleBarControls')} .userpanel-buttoncontainer :is(button, [class*="Button"], .st-steam-settings > *) {
    border-radius: var(--rf-user-radius, var(--rf-radius)) !important; }`;
  /* the sidebar no longer needs the empty space it kept at the bottom for the box */
  urule`${U} ._3x1HklzyDs4TEjACrRO2tB ._1ijTaXJJA5YWl_fW2IxcaT { margin-bottom: 12px !important; }`;

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

  /* a style switched live (shelf.js swaps the style sheet in every window without reloading Steam) re-runs these */
  const restyleHooks = [];
  function inject() {
    if (!document.head) return void setTimeout(inject, 50);
    let s = document.getElementById('rfs-skin');
    if (!s) { s = document.createElement('style'); s.id = 'rfs-skin'; document.head.appendChild(s); }
    s.textContent = rules.join('\n');
    let us = document.getElementById('rfs-skin-user');
    if (!us) { us = document.createElement('style'); us.id = 'rfs-skin-user'; document.head.appendChild(us); }
    us.textContent = urules.join('\n');
    // "Steam Original" style: keep Steam exactly as Valve ships it (the style sheet stays, switched off)
    // off when Steam is styled by someone else: "Steam Original" (stock) or a community theme base (--rf-vendor)
    const sync = () => {
      const cs = getComputedStyle(document.documentElement);
      const v = cs.getPropertyValue('--rf-vendor').trim();
      s.media = cs.getPropertyValue('--rf-layout').trim() === 'original' || (v && v !== 'none') ? 'not all' : '';
      const id = cs.getPropertyValue('--rf-style-id').trim(); // lets flair.css / panels target the style in every window
      if (id && document.documentElement.dataset.rfsStyle !== id) document.documentElement.dataset.rfsStyle = id;
    };
    // a style / language change reloads every Steam window (RestartJSContext), so there is nothing to poll for:
    // just re-check a few times while the window's own CSS is still arriving, then stop (~25 hidden windows run this)
    sync();
    [300, 1000, 2500, 6000].forEach(ms => setTimeout(sync, ms));
    restyleHooks.push(sync);
  }

  /* ---- the style's font pair (Latin + Arabic) for every Steam window: --rf-font-ui / --rf-font-gf come from the
     style file. Steam's own fonts have no Arabic letters, so this is what makes an Arabic Steam look right. */
  function applyFonts(getVar) {
    const gf = getVar('--rf-font-gf').replace(/^["']|["']$/g, '').trim();
    if (!gf || !document.head) return;
    let link = document.getElementById('rfs-fonts');
    const href = 'https://fonts.googleapis.com/css2?' + gf + '&display=swap';
    if (!link) { link = document.createElement('link'); link.id = 'rfs-fonts'; link.rel = 'stylesheet'; document.head.appendChild(link); }
    if (link.href !== href) link.href = href;
    if (!document.getElementById('rfs-font-rule')) {
      const st = document.createElement('style');
      st.id = 'rfs-font-rule';
      // :where() keeps this at zero specificity, so icon-font rules (more specific + !important) still win
      st.textContent = ':where(body, body *:not(svg, svg *)) { font-family: var(--rf-font-ui) !important; }';
      document.head.appendChild(st);
    }
  }
  inject();
  { const v = n => getComputedStyle(document.documentElement).getPropertyValue(n); [0, 300, 1500, 5000].forEach(ms => setTimeout(() => applyFonts(v), ms)); }
  restyleHooks.push(() => applyFonts(n => getComputedStyle(document.documentElement).getPropertyValue(n)));
  /* every Steam window follows a theme switch on its own: the live switch (shelf.js Themes.live) reaches the main
     window and its popups, but separate windows — the friends list, chats — kept the old style until Steam restarted.
     Here each window compares Millennium's saved Style with the style sheet it was given, when it gains focus or
     becomes visible (and every few seconds while visible), and swaps the sheet if they differ. */
  (function followStyle() {
    if (!/steamloopback\.host$/.test(location.host)) return;
    const STYLE_IDS = { 'Classic Shelf': 'classic', 'Neon Coverflow': 'neon', 'Glass Gallery': 'glass', 'Steam Original': 'original', 'SpaceTheme': 'space', 'Material You': 'material', 'Terminal': 'terminal', 'RPG Vault': 'vault', 'Vinyl Records': 'vinyl', 'Corkboard': 'cork', 'Retro Arcade': 'arcade', 'Magazine': 'magazine', 'Cupertino Dark': 'cupertino', 'Cyberpunk': 'cyberpunk', 'Shelter OS': 'shelter' };
    const api = ctx.MILLENNIUM_API;
    if (!api || !api.ffi) return;
    let busy = false;
    async function check() {
      if (busy || document.hidden) return;
      const link = document.querySelector('link[href*="/src/styles/"]');
      if (!link) return;
      busy = true;
      try {
        let cfg = await api.ffi('core', 'Core_GetBackendConfig')();
        if (typeof cfg === 'string') cfg = JSON.parse(cfg);
        const th = cfg && cfg.themes;
        const c = th && th.conditions && th.conditions[th.activeTheme || 'rf-shelf'];
        const sid = c && STYLE_IDS[c.Style];
        if (sid && !link.href.includes(`/src/styles/${sid}.css`)) {
          const nl = document.createElement('link');
          nl.rel = 'stylesheet'; nl.id = link.id; nl.href = link.href.replace(/\/src\/styles\/[^/?#]+\.css/, `/src/styles/${sid}.css`);
          nl.onload = () => { document.querySelectorAll('link[href*="/src/styles/"]').forEach(l => { if (l !== nl) l.remove(); }); restyleHooks.forEach(f => { try { f(); } catch (e) { /* keep going */ } }); };
          link.after(nl);
        }
      } catch (e) { /* Millennium not ready */ }
      busy = false;
    }
    addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    setInterval(check, 4000);
  })();
  window.__rfsSkin = { rules: rules.length, missing: [...new Set(missing)], restyle: () => restyleHooks.forEach(f => { try { f(); } catch (e) { /* keep going */ } }) };

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
          if (e.part) l.dataset.rfsPart = e.part; // e.g. "home": only needed while Steam's own home is on screen
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
      // friends list + chat windows: our shared layer over SpaceTheme's (src/css/friends.css; it skips Original / Material / Shelter)
      if (!document.getElementById('rfs-friends-css') && document.querySelector('.friendsui-container')) {
        const l = document.createElement('link');
        l.rel = 'stylesheet'; l.id = 'rfs-friends-css'; l.href = BASE + 'src/css/friends.css';
        document.head.appendChild(l);
      }
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
    restyleHooks.push(check);
    // dialogs / friends windows get their matching class a moment after they open — re-check a few times, then stop
    [300, 1000, 2500, 6000, 15000].forEach(ms => setTimeout(check, ms));
  })();
})();
