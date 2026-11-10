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
  const HEAD = 'html:is([data-rfs-style="glass"], [data-rfs-style="magazine"], [data-rfs-style="vault"], [data-rfs-style="cork"], [data-rfs-style="neon"], [data-rfs-style="space"], [data-rfs-style="cupertino"], [data-rfs-style="xmb"])';
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
  /* Store · Library · Community … clickable in a window that isn't maximized. SpaceTheme centres this row in the
     title bar with transform: translate(-50%, -50%), but Chromium places the -webkit-app-region areas WITHOUT the
     transform: the row's "no-drag" holes landed 318 px to the right and 23 px down, the visible buttons stayed inside
     the title bar's drag area, and Windows swallowed their clicks (and covered half of the account / notification /
     update buttons and, in narrower windows, the maximize button). Same centring with margins — no transform.
     (≤ 1188 px SpaceTheme drops the transform itself and moves the row under the title bar.) */
  urule`@media (min-width: 1189px) { ${U} ${C('SuperNavBar')} { top: 0 !important; left: 0 !important; right: 0 !important; margin: 0 auto !important; transform: none !important; } }`;
  /* Steam's bottom bar (download progress) floated over the home designs' corner: the Downloads button next to the
     user name replaces it (shelf.js paintDownloads) */
  /* Hidden, but never display: none. Steam's window resize corner (.window_resize_grip) lives inside this bar, and
     Steam sizes the native corner from where that element sits whenever the window is restored (not maximized):
     Window.SetResizeGrip(innerWidth - left, innerHeight - top). Under display: none it measured 0,0, so the WHOLE
     restored window became the bottom-right resize corner — clicks on Store / Library / Themes / account / maximize
     started a resize instead, and dragging the left edge resized from the bottom-right. Laid out, invisible,
     click-through: the grip stays a 16 × 16 corner at the bottom right. */
  urule`${U} ${C('BottomBarContainer')} { position: absolute !important; height: 0 !important; min-height: 0 !important;
    opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }`;
  urule`${U} ${C('BottomBarContainer')} * { visibility: hidden !important; pointer-events: none !important; }`;
  // the bar itself is a window-drag strip in Steam's CSS: an invisible one must not drag the window from under a design
  urule`${U} ${C('BottomBar', 'BottomBarContainer')} { -webkit-app-region: no-drag !important; }`;
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
  urule`${U} ${C('TitleBarControls')} .userpanel-buttoncontainer > :not(#rfs-family):not(#rfs-dl), ${U} ${C('TitleBarControls')} .userpanel-buttoncontainer :is(button, [class*="Button"]) {
    width: 32px !important; min-width: 32px !important; height: 32px !important; padding: 0 !important; }`;
  /* SpaceTheme builds the settings button itself: its inner box was 28 px and top-aligned — the same 32 px as the rest */
  urule`${U} ${C('TitleBarControls')} .userpanel-buttoncontainer .st-steam-settings > * {
    width: 32px !important; height: 32px !important; display: flex !important; align-items: center !important; justify-content: center !important; }`;
  urule`${U} ${C('TitleBarControls')} .userpanel-buttoncontainer :is(button, [class*="Button"], .st-steam-settings > *) {
    border-radius: var(--rf-user-radius, var(--rf-radius)) !important; }`;
  /* the sidebar no longer needs the empty space it kept at the bottom for the box */
  urule`${U} ._3x1HklzyDs4TEjACrRO2tB ._1ijTaXJJA5YWl_fW2IxcaT { margin-bottom: 12px !important; }`;

  /* ---------------- Downloads page, install / settings dialogs, toggles, sliders, checkboxes ----------------
     Steam paints these in its own blue (#1a9fff, #47bfff → #1a44c2) and green (#59bf40); SpaceTheme leaves most of
     them alone. urule = active under the SpaceTheme base too. Everything comes from the style's variables; a style
     reshapes them through --rf-dl-* hooks (styles/*.css) where it needs its own shape. */
  const DLP = k => C(k, 'DownloadsPage', 'RemoveAllButton');   // downloads page
  const DLG = k => C(k, 'DownloadGraphWrapper', 'GraphBarDownload'); // downloads header: hero + graph
  const BTN = `background: var(--rf-dl-btn-bg, ${A}.12)) !important; color: var(--rf-dl-btn-ink, var(--rf-text)) !important;
    border: var(--rf-dl-btn-border, 1px solid ${A}.32)) !important; border-radius: var(--rf-dl-btn-radius, var(--rf-radius)) !important;
    box-shadow: var(--rf-dl-btn-shadow, none) !important; transition: background .15s, border-color .15s, color .15s !important;`;
  const BTN_HI = `background: var(--rf-dl-btn-bg-hover, ${A}.24)) !important; border-color: ${A}.6) !important; color: var(--rf-dl-btn-ink-hover, var(--rf-text)) !important;`;
  const PRI = `background: var(--rf-dl-pri-bg, linear-gradient(135deg, var(--rf-accent), var(--rf-accent-2))) !important; color: var(--rf-accent-ink) !important;
    border: var(--rf-dl-pri-border, 0) !important; border-radius: var(--rf-dl-btn-radius, var(--rf-radius)) !important; box-shadow: var(--rf-dl-pri-shadow, 0 4px 16px ${A}.28)) !important; clip-path: var(--rf-dl-clip, none);`;
  // page + header: the hero band keeps the game art, our panel colours instead of the blue wash
  urule`${U} ${DLP('DownloadsPage')} { background: transparent !important; }`;
  urule`${U} ${DLP('TopSection')} { background: var(--rf-dl-head-bg, linear-gradient(180deg, var(--rf-panel-2), var(--rf-panel))) !important;
    border-bottom: 1px solid var(--rf-border) !important; border-radius: var(--rf-dl-head-radius, 0) !important; }`;
  urule`${U} ${DLG('HeroAndLogo')}${DLG('Empty')} { background: var(--rf-dl-hero-empty, linear-gradient(to right, ${A}.34) 0%, ${A}.08) 100%)) !important; }`;
  urule`${U} ${DLG('HeroAndLogo')} ${DLG('HeroGradient')} { background: linear-gradient(to right, transparent 15%, var(--rf-panel) 92%) !important; }`;
  urule`${U} ${DLG('DownloadGraph')} ${DLG('Gradient')} { background-image: linear-gradient(to right, var(--rf-panel) 0%, var(--rf-panel) 35%, transparent 55%) !important; }`;
  urule`${U} ${DLG('DownloadGraph')} :is(${DLG('GraphBarWrapper')}, ${DLG('GraphBarDownload')}) { color: ${A}.55) !important; }`;
  urule`${U} ${DLG('DownloadGraph')} ${DLG('GraphBarWrapper')}:hover ${DLG('GraphBar')} { color: var(--rf-accent) !important; }`;
  urule`${U} ${DLG('DownloadGraph')} ${DLG('GraphLine')} { stroke: var(--rf-accent-2) !important; }`;
  urule`${U} :is(${DLG('LegendRow')}, ${DLG('DownloadGraphLegend')}) ${DLG('Network')} svg { color: var(--rf-accent) !important; }`;
  urule`${U} :is(${DLG('LegendRow')}, ${DLG('DownloadGraphLegend')}) ${DLG('Disk')} { background-color: var(--rf-accent-2) !important; }`;
  urule`${U} ${DLG('Stat')}, ${U} ${DLG('Label')} { color: var(--rf-text-dim) !important; }`;
  urule`${U} ${DLG('Figure')} { color: var(--rf-text) !important; }`;
  urule`${U} ${DLG('LanPeer')}:hover ${DLG('LanPeerHostName')} { color: var(--rf-accent) !important; }`;
  urule`:where(${U} ${DLG('SettingsButton')}, ${U} ${DLP('SettingsButton')}) { ${BTN} }`;
  urule`:where(${U} ${DLG('SettingsButton')}:hover, ${U} ${DLP('SettingsButton')}:hover) { ${BTN_HI} }`;
  // section headings + rules
  urule`${U} ${DLP('SectionTitle')} ${DLP('Title')} { color: var(--rf-text) !important; font-family: var(--rf-heading-font) !important;
    text-transform: var(--rf-heading-case) !important; letter-spacing: var(--rf-heading-spacing) !important; }`;
  urule`${U} ${DLP('SectionTitle')} ${DLP('Count')} { color: var(--rf-accent) !important; }`;
  urule`${U} ${DLP('SectionTitle')} ${DLP('Rule')} { background: var(--rf-dl-rule, linear-gradient(to right, ${A}.55), ${A}.06))) !important; height: 1px !important; }`;
  urule`${U} ${DLP('SectionDivider')} { background-color: var(--rf-border) !important; }`;
  // rows
  urule`${U} ${DLP('SectionItem')} { border-radius: var(--rf-radius) !important; transition: background-color .15s !important; }`;
  urule`${U} ${DLP('SectionItem')}:hover, ${U} ${DLP('SectionItem')}${DLP('Dragging')} { background-color: ${A}.08) !important; }`;
  urule`${U} ${DLP('SectionItem')}${DLP('Active')} { background-color: var(--rf-card) !important; box-shadow: inset 3px 0 0 var(--rf-accent) !important; }`;
  urule`${U} ${DLP('Section')}${DLP('Active')}${DLP('Empty')}, ${U} ${DLP('Section')}${DLP('Active')}${DLP('Empty')} ${DLP('RightSection')} { background-color: transparent !important; }`;
  urule`${U} ${DLP('SectionItem')} :is(${DLP('PatchNotes')}, ${DLP('PatchNotes')} *) { color: var(--rf-accent) !important; fill: currentColor; }`;
  urule`${U} ${DLP('SectionItem')} ${DLP('PatchNotes')}:hover { color: var(--rf-text) !important; }`;
  urule`${U} ${DLP('AutoUpdateHours')}${DLP('IsViewingLocalClient')}:hover :is(${DLP('UpdateHours')}), ${U} ${DLP('AutoUpdateHours')}${DLP('IsViewingLocalClient')}:hover${DLP('NoHours')},
    ${U} ${DLP('Throttle')}:hover ${DLP('ThrottleValue')}, ${U} ${DLP('ManagingRemoteClientName')} { color: var(--rf-accent) !important; }`;
  urule`${U} ${DLP('ContentType')} ${DLP('Check')} { color: var(--rf-accent) !important; }`;
  // progress bars (row + active item)
  urule`${U} ${DLP('SectionItemStatus')} ${DLP('ProgressBar')} { background-color: ${A}.14) !important; border-radius: 99px !important; overflow: hidden !important; }`;
  urule`${U} ${DLP('SectionItemStatus')} ${DLP('ProgressBar')} div { background: linear-gradient(90deg, var(--rf-accent), var(--rf-accent-2)) !important; }`;
  urule`${U} ${DLP('SectionItemStatus')} ${DLP('ProgressBar')}${DLP('Network')} div { background: ${A}.5) !important; }`;
  urule`${U} ${DLP('SectionItemStatus')} ${DLP('ProgressBar')}${DLP('Disk')} div { background: var(--rf-accent-2) !important; }`;
  urule`${U} ${DLP('SectionItemStatus')} ${DLP('ProgressBar')}${DLP('NotActive')} div { background: var(--rf-text-dim) !important; opacity: .5; }`;
  urule`${U} ${DLP('LocalNetworkTransferBar')} { background: var(--rf-accent) !important; color: var(--rf-accent-ink) !important; }`;
  // buttons: row icon buttons, Clear All, pause/resume, remote-client switch, Play
  urule`:where(${U} ${DLP('SectionItem')} ${DLP('Button')}.DialogButton, ${U} ${DLP('SectionItem')} ${DLP('Button')}.DialogButton:enabled) { ${BTN} }`;
  urule`:where(${U} ${DLP('SectionItem')} ${DLP('Button')}.DialogButton:enabled:hover, ${U} ${DLP('SectionItem')}:hover ${DLP('Button')}.DialogButton:enabled:hover) { ${BTN_HI} }`;
  urule`${U} ${DLP('SectionItem')} ${DLP('Button')}.DialogButton svg { color: currentColor !important; }`;
  urule`:where(${U} ${DLP('SectionItem')}${DLP('Active')} ${DLP('Button')}.DialogButton:enabled:not(${DLP('RemoveFromQueue')}), ${U} ${DLP('SectionItem')}${DLP('Active')} ${DLP('Button')}.DialogButton:enabled:not(${DLP('RemoveFromQueue')}):hover) { ${PRI} }`;
  urule`:where(${U} ${DLP('RemoveAllButton')}${DLP('RemoveAllButton')}.DialogButton, ${U} ${DLP('RemoveAllButton')}${DLP('RemoveAllButton')}.DialogButton:enabled) { ${BTN} }`;
  urule`:where(${U} ${DLP('RemoveAllButton')}${DLP('RemoveAllButton')}.DialogButton:enabled:hover) { ${BTN_HI} }`;
  urule`:where(${U} ${DLP('PauseResumeButton')}, ${U} ${DLP('PauseResumeButton')}:enabled) { ${BTN} }`;
  urule`:where(${U} ${DLP('PauseResumeButton')}:enabled:hover) { ${BTN_HI} }`;
  urule`:where(${U} ${DLP('RemoteClientDownloadsSelector')} ${DLP('RemoteClientDropDownContainer')}, ${U} ${DLP('RemoteClientDownloadsSelector')}${DLP('Green')} ${DLP('RemoteClientDropDownContainer')}) { ${PRI} }`;
  urule`${U} ${DLP('SectionItem')} ${DLP('PlayButton')}, ${U} ${DLP('SectionItem')} ${DLP('PlayButton')}.DialogButton:enabled {
    background: var(--rf-dl-play-bg, linear-gradient(135deg, var(--rf-play-1), var(--rf-play-2))) !important; color: var(--rf-play-ink) !important;
    border: 0 !important; border-radius: var(--rf-dl-btn-radius, var(--rf-radius)) !important; box-shadow: 0 4px 16px rgba(var(--rf-glow), .3) !important; clip-path: var(--rf-dl-clip, none); }`;
  urule`${U} ${DLP('SectionItem')} ${DLP('PlayButton')} :is(svg, svg *) { color: var(--rf-play-ink) !important; fill: var(--rf-play-ink) !important; }`;
  urule`${U} ${DLP('SectionItem')} ${DLP('PlayButton')}:hover { filter: brightness(1.08) !important; }`;
  // the library-style Play button Steam reuses on the completed rows
  urule`${U} ${DLP('SectionItem')} ${C('PlayButtonContainer', 'PlayButton')}, ${U} ${DLP('SectionItem')} ${C('PlayButton', 'PlayButtonContainer')} {
    background: var(--rf-dl-play-bg, linear-gradient(135deg, var(--rf-play-1), var(--rf-play-2))) !important; color: var(--rf-play-ink) !important;
    border-radius: var(--rf-dl-btn-radius, var(--rf-radius)) !important; box-shadow: none !important; }`;
  urule`${U} ${DLP('SectionItem')} ${C('PlayButton', 'PlayButtonContainer')} :is(svg, svg *, ${C('ButtonText', 'PlayButton')}) { color: var(--rf-play-ink) !important; fill: var(--rf-play-ink) !important; }`;

  // left game list: "42%" label + the progress ring on the app icon (Steam: #74d1ff)
  const GL = k => C(k, 'GameListEntryContainer', 'DownloadProgress');
  urule`${U} ${GL('GameListEntryContainer')} ${GL('DownloadProgress')} { color: var(--rf-accent) !important; }`;
  urule`${U} ${GL('Running')} ${GL('DownloadProgress')} { color: var(--rf-play-1) !important; }`;
  urule`${U} ${GL('AppIconDownloading')} svg${GL('DownloadProgressSVG')}${GL('DownloadProgressSVG')}${GL('DownloadProgressSVG')} circle { stroke: var(--rf-accent) !important; }`;

  /* install dialog: the drive list (Steam: selected row #1a9fff, focus white) */
  const FS = k => C(k, 'FolderSelector', 'FolderOption');
  urule`${U} ${FS('FolderOption')} { background: var(--rf-card) !important; color: var(--rf-text) !important; border: 1px solid var(--rf-border) !important;
    border-radius: var(--rf-dl-btn-radius, var(--rf-radius)) !important; transition: background .12s, border-color .12s !important; clip-path: var(--rf-dl-clip, none); }`;
  urule`${U} ${FS('FolderOption')}:hover { background: ${A}.12) !important; border-color: ${A}.4) !important; color: var(--rf-text) !important; }`;
  urule`${U} ${FS('FolderOption')}${FS('Focused')} { background: ${A}.16) !important; color: var(--rf-text) !important; outline: 1px solid ${A}.6) !important; }`;
  urule`${U} ${FS('FolderOption')}${FS('Active')}, ${U} ${FS('FolderOption')}${FS('Active')}:hover {
    background: var(--rf-dl-sel-bg, linear-gradient(90deg, ${A}.30), ${A}.12))) !important; color: var(--rf-text) !important;
    border-color: var(--rf-accent) !important; box-shadow: inset 3px 0 0 var(--rf-accent), 0 0 0 1px ${A}.25) !important; }`;
  urule`${U} ${FS('FolderOption')}${FS('Active')} ${FS('FreeSpace')}, ${U} ${FS('FolderOption')}${FS('Active')} ${FS('FolderFlagStar')} { color: var(--rf-accent) !important; }`;
  urule`${U} ${FS('FolderOption')} ${FS('FolderName')}${FS('NoSpace')} { color: var(--rf-text-dim) !important; }`;
  urule`${U} ${FS('Header')}, ${U} ${FS('DiskSpace')} { color: var(--rf-text-dim) !important; }`;
  urule`${U} ${FS('AppToInstall')} { background: var(--rf-card) !important; border-radius: var(--rf-radius) !important; }`;

  /* settings windows (Steam Settings, game Properties): page list, title, toggles, sliders, radio + checkboxes */
  const PS = k => C(k, 'PagedSettingsDialog_PageListItem', 'PageListItem_Title');
  urule`${U} ${PS('PagedSettingsDialog_Title')} { color: var(--rf-accent) !important; font-family: var(--rf-heading-font) !important;
    text-transform: var(--rf-heading-case) !important; letter-spacing: var(--rf-heading-spacing) !important; }`;
  urule`${U} ${PS('PagedSettingsDialog_PageListItem')} { border-radius: var(--rf-radius) !important; transition: background .12s, color .12s !important; }`;
  urule`${U} ${PS('PagedSettingsDialog_PageListItem')}:hover:not(${PS('Active')}), ${U} ${PS('PagedSettingsDialog_PageListItem')}:hover:not(${PS('Active')}) ${PS('PageListItem_Icon')} {
    color: var(--rf-text) !important; background: ${A}.08) !important; }`;
  urule`${U} ${PS('PagedSettingsDialog_PageListItem')}${PS('Active')}, ${U} ${PS('PagedSettingsDialog_PageListItem')}:focus {
    background: var(--rf-dl-sel-bg, linear-gradient(90deg, ${A}.26), ${A}.04))) !important; color: var(--rf-accent) !important;
    border-left: 0 !important; box-shadow: inset 3px 0 0 var(--rf-accent) !important; }`;
  urule`${U} ${PS('PagedSettingsDialog_PageListItem')}${PS('Active')} ${PS('PageListItem_Icon')} { color: var(--rf-accent) !important; }`;
  urule`${U} ${PS('PageListSeparator')} { background: var(--rf-border) !important; }`;
  urule`${U} ${C('ToggleRail', 'ToggleSwitch', 'Field')}::before { background: linear-gradient(90deg, var(--rf-accent), var(--rf-accent-2)) !important; }`;
  urule`${U} ${C('ToggleSwitch', 'ToggleRow')}${C('On', 'ToggleRow')} { background: var(--rf-accent) !important; background-image: none !important; }`;
  urule`${U} ${C('ToggleRail', 'ToggleRow')}${C('Highlight', 'ToggleRow')} { background-color: ${A}.35) !important; }`;
  urule`${U} ${C('SliderTrack', 'SliderHandle')} { --left-track-color: var(--rf-accent) !important; }`;
  urule`${U} ${C('SliderNotchTick', 'SliderHandle')}${C('TickActive', 'SliderHandle')} { background-color: var(--rf-accent) !important; }`;
  urule`${U} ${C('CompoundSliderSubSliderLabelInternal')} { color: var(--rf-accent) !important; }`;
  urule`${U} ${C('Active', 'RadioButton')} ${C('RadioButton', 'Active')} { box-shadow: inset 0 0 0 5px var(--rf-accent) !important; }`;
  urule`${U} .AppProperties .DialogBody ${C('BlueHighlight')} { color: var(--rf-accent) !important; }`;
  /* stable global controls (unhashed): checkbox, ON/OFF toggle field, round checkbox, primary button — in :where(), so a style's own .DialogCheckbox / .DialogButton look still wins */
  urules.push(`
    :where(${U} .DialogCheckbox) { background-color: rgba(0, 0, 0, .3) !important; box-shadow: inset 0 0 0 1px ${A}.35) !important; border-radius: var(--rf-dl-check-radius, 4px) !important; }
    :where(${U} .DialogCheckbox_Container:hover .DialogCheckbox:not(.Disabled), ${U} .DialogCheckbox:hover:not(.Disabled)) { box-shadow: inset 0 0 0 1px ${A}.75) !important; background-color: ${A}.1) !important; }
    ${U} .DialogCheckbox.Active { background: var(--rf-accent) !important; box-shadow: 0 0 0 1px var(--rf-accent), 0 0 10px ${A}.35) !important; }
    ${U} .DialogCheckbox .SVGIcon_DialogCheck path { stroke: var(--rf-accent-ink) !important; }
    ${U} .DialogCheckbox .SVGIcon_DialogCheck stop { stop-color: var(--rf-accent-ink) !important; }
    :where(${U} .DialogToggleField_Control) { background: rgba(0, 0, 0, .3) !important; border: 1px solid var(--rf-border) !important; border-radius: var(--rf-radius) !important; }
    :where(${U} .DialogToggleField_Option:hover:not(.Active)) { background: ${A}.14) !important; }
    :where(${U} .DialogToggleField_Option.Active:not(.Off)) { background: var(--rf-accent) !important; color: var(--rf-accent-ink) !important; }
    :where(${U} .DialogToggleField_Option.Off.Active) { background: var(--rf-panel-3, var(--rf-panel-2)) !important; color: var(--rf-text) !important; }
    :where(${U} .DialogRoundCheckboxField_Control .DialogRoundCheckboxField_InnerCircle) { background: var(--rf-accent) !important; box-shadow: 0 0 8px ${A}.5) !important; }
    :where(${U} button.DialogButton.Primary, ${U} button.DialogButton.Primary:enabled) { background: var(--rf-dl-pri-bg, linear-gradient(135deg, var(--rf-accent), var(--rf-accent-2))) !important;
      background-size: auto !important; color: var(--rf-accent-ink) !important; border-radius: var(--rf-dl-btn-radius, var(--rf-radius)) !important; }
    :where(${U} button.DialogButton.Primary:enabled:hover) { filter: brightness(1.1) !important; color: var(--rf-accent-ink) !important; }
  `);
  /* context menus (incl. the Downloads row menu): Steam's focused row is a near-white bar, its update rows blue */
  urule`${U} ${C('contextMenuItem')}:hover, ${U} ${C('contextMenuItem')}${C('active', 'contextMenuItem')}, ${U} ${C('contextMenuItem')}${C('Focused', 'contextMenuItem')} {
    background: ${A}.2) !important; color: var(--rf-text) !important; box-shadow: inset 3px 0 0 var(--rf-accent) !important; }`;

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
    const STYLE_IDS = { 'Classic Shelf': 'classic', 'Neon Coverflow': 'neon', 'Glass Gallery': 'glass', 'Steam Original': 'original', 'SpaceTheme': 'space', 'Material You': 'material', 'Terminal': 'terminal', 'RPG Vault': 'vault', 'Vinyl Records': 'vinyl', 'Corkboard': 'cork', 'Retro Arcade': 'arcade', 'Magazine': 'magazine', 'Cupertino Dark': 'cupertino', 'Cyberpunk': 'cyberpunk', 'Shelter OS': 'shelter', 'Crossbar': 'xmb',
      'Steam OLED Black': 'steam-oled', 'Steam Graphite': 'steam-graphite', 'Steam Midnight': 'steam-midnight', 'Steam Forest': 'steam-forest', 'Steam Wine': 'steam-wine', 'Steam Royal Purple': 'steam-royal', 'Steam Coffee': 'steam-coffee', 'Steam Ocean': 'steam-ocean' };
    const api = ctx.MILLENNIUM_API;
    if (!api || !api.ffi) return;
    let busy = false;
    async function check() {
      if (busy || document.hidden) return;
      const links = document.querySelectorAll('link[href*="/src/styles/"]');
      const link = links[0];
      if (!link || links.length > 1) return; // a swap is already under way here (shelf.js Themes.live): leave it alone
      busy = true;
      try {
        let cfg = await api.ffi('core', 'Core_GetBackendConfig')();
        if (typeof cfg === 'string') cfg = JSON.parse(cfg);
        const th = cfg && cfg.themes;
        const c = th && th.conditions && th.conditions[th.activeTheme || 'rf-shelf'];
        const sid = c && STYLE_IDS[c.Style];
        if (sid && !link.href.includes(`/src/styles/${sid}.css`) && link.isConnected && document.querySelectorAll('link[href*="/src/styles/"]').length === 1) {
          const nl = document.createElement('link');
          nl.rel = 'stylesheet'; nl.id = link.id; nl.href = link.href.replace(/\/src\/styles\/[^/?#]+\.css/, `/src/styles/${sid}.css`);
          nl.onload = () => { link.remove(); restyleHooks.forEach(f => { try { f(); } catch (e) { /* keep going */ } }); };
          link.after(nl);
        }
      } catch (e) { /* Millennium not ready */ }
      busy = false;
    }
    addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    setInterval(check, 4000);
  })();
  /* menu windows keep the right size. Steam gives every menu (the Store / Library / Community hover menus, the
     Steam / View / Friends / Games / Help menus, the account and notification menus, right-click menus) its own small
     window and sizes that window from the menu's measured box. Those windows live hidden between uses, and when the
     look of the menu changes while one is hidden — a live theme switch, or the style's web font arriving after the
     first measurement — Steam's stored box is updated but the window is not: the menu then shows cut off at its end
     edge with square corners (the rounded border falls outside the window). Here each menu window checks itself
     when it is shown, after a style switch and when its fonts are in: if the window is not the size Steam itself
     measured for the menu, Steam's own positioning is run again. Nothing is polled. */
  (function menuFit() {
    if (!/steamloopback\.host$/.test(location.host)) return;
    const menu = () => {
      const el = document.querySelector('.contextMenu');
      if (!el) return null;
      try {
        const k = Object.keys(el).find(x => x.startsWith('__reactFiber'));
        for (let f = k && el[k], i = 0; f && i < 8; f = f.return, i++) { const n = f.stateNode; if (n && typeof n.PositionMenu === 'function' && typeof n.PositionPopupWindow === 'function') return n; }
      } catch (e) { /* Steam changed its menu: nothing to fix here */ }
      return null;
    };
    function fit(remeasure) {
      const m = menu();
      if (!m || !m.state) return;
      try {
        if (remeasure) m.PositionMenu(true);
        const w = m.state.menuWidth, h = m.state.menuHeight;
        if (w == null || h == null) return;
        if (Math.abs(innerWidth - w) > 1.5 || Math.abs(innerHeight - h) > 1.5) m.PositionPopupWindow();
      } catch (e) { /* leave the menu as Steam drew it */ }
    }
    const soon = remeasure => { fit(remeasure); setTimeout(fit, 120); setTimeout(fit, 450); };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) soon(false); });
    restyleHooks.push(() => setTimeout(() => soon(true), 60));
    try { document.fonts.addEventListener('loadingdone', () => { if (document.querySelector('.contextMenu')) soon(true); }); } catch (e) { /* no font events */ }
  })();
  /* ---- tint styles (src/styles/steam-*.css: Steam Original in another colour). The style names its palette with
     --tint-id; src/js/tint.js then re-tones Steam's own style sheets in this window. It is loaded only while such a
     style is active, and asked again after every live theme switch (restyleHooks) — nothing is cached here. */
  (function tintLoader() {
    const me = document.querySelector('script[src*="/src/js/skin.js"]');
    const BASE = me ? me.src.replace(/src\/js\/skin\.js.*$/, '') : 'https://millennium.host/v1/themes/rf-shelf/';
    function check() {
      if (window.__rfsTint) { window.__rfsTint.sync(); return; }
      if (!document.head || document.querySelector('script[data-rfs-tint-js]')) return;
      if (!getComputedStyle(document.documentElement).getPropertyValue('--tint-id').trim()) return;
      const s = document.createElement('script');
      s.src = BASE + 'src/js/tint.js'; s.dataset.rfsTintJs = '1';
      document.head.appendChild(s);
    }
    check();
    restyleHooks.push(check);
    // the style's own sheet may still be arriving in a window that just opened — look a few times, then stop
    [300, 1000, 2500, 6000].forEach(ms => setTimeout(check, ms));
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
