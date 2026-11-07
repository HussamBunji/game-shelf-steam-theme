/* ===================================================================
   Game Shelf — Big Picture Mode (runs in the "Steam Big Picture Mode" window; see src/css/bigpicture.css)

   1. Theme: Big Picture follows the active style's --rf-* variables.
      - <style id="rfs-bpm">: rules on Steam's hashed class names, resolved from readable names through
        MILLENNIUM_API.classMapList (same C('Readable', 'Hint') helper as skin.js), so most Steam updates need no edit.
      - <style id="rfs-bpm-tint">: Big Picture's own CSS is scanned once (≈0.1 s) and every Steam-blue colour
        (focus, badges, toggles, sliders, progress) is re-declared with the theme accent, and the white focus rings
        with the accent + glow. Same selectors, no !important, placed after Steam's sheets: Steam's own cascade
        (hover / focus / disabled order) stays intact.
      - The side menu (guide / F1) and the quick access menu are separate windows Millennium doesn't inject:
        they get the same sheets from here.
   2. Themes picker: a "Themes" button in the top bar (gamepad: move right past the avatar, A), an entry at the end of
      the main menu, the hotkey F4 (keyboard) / View + Y (controller). Full-screen cards, D-pad / arrows, A / Enter
      applies, B / Esc closes, LB / RB / PageUp / PageDown change page.
   3. Modes: each style says where it works ('both' | 'desktop' | 'bpm'), exported as window.__rfsModes. A desktop-only
      style that is active when Big Picture opens still gets a neutral skin in its colours.
   =================================================================== */
(function () {
  'use strict';
  if (window.__rfsBpm && window.__rfsBpm.destroy) { try { window.__rfsBpm.destroy(); } catch (e) { /* re-inject during dev */ } }

  const ctx = (() => {
    try { if (window.opener && window.opener.MILLENNIUM_API) return window.opener; } catch (e) { /* cross-origin */ }
    return window.MILLENNIUM_API ? window : null;
  })();
  if (!ctx || !/steamloopback\.host$/.test(location.host)) return;

  const html = document.documentElement;
  const maps = (ctx.MILLENNIUM_API && ctx.MILLENNIUM_API.classMapList) || [];
  const missing = [];
  const cleanup = [];
  const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); cleanup.push(() => t.removeEventListener(ev, fn, opt)); };

  /* ---------------- styles: names, modes, preview colours ----------------
     modes: 'both' = desktop + Big Picture, 'desktop' = desktop only, 'bpm' = Big Picture only.
     Desktop-only: Classic Shelf (its identity is the 3D wooden bookcase), Corkboard (handwritten Caveat headings are
     hard to read from a sofa), Magazine (editorial serif columns; nothing of it carries to a TV grid).
     c = [bg, panel, text, accent, accent-2, play, accent-ink, radius px] (from src/styles/<id>.css) */
  const STYLES = [
    { value: 'Classic Shelf', sid: 'classic', modes: 'desktop', ar: 'الرف الكلاسيكي', en: 'Classic Shelf', dar: 'رف خشب ثلاثي الأبعاد للمكتبة', den: 'A 3D wooden bookcase for your library', c: ['#110c08', '#1b130c', '#f4ece3', '#ffb36b', '#ff8a4c', '#7ee08f', '#2a1300', 8] },
    { value: 'Glass Gallery', sid: 'glass', modes: 'both', ar: 'المعرض الزجاجي', en: 'Glass Gallery', dar: 'زجاج أزرق هادئ وزوايا ناعمة', den: 'Calm blue glass and soft corners', c: ['#0c1420', '#152133', '#eef5fc', '#66c0f4', '#a28cff', '#75d97d', '#04192a', 12] },
    { value: 'Neon Coverflow', sid: 'neon', modes: 'both', ar: 'نيون كوفر فلو', en: 'Neon Coverflow', dar: 'إضاءة نيون سماوية ووردية', den: 'Cyan and pink neon lighting', c: ['#06050d', '#0b0918', '#ecf6ff', '#3ef0ff', '#ff3ea5', '#3ef0ff', '#001a1f', 2] },
    { value: 'Terminal', sid: 'terminal', modes: 'both', ar: 'الطرفية', en: 'Terminal', dar: 'أخضر على أسود بخط الأوامر', den: 'Green on black, command-line type', c: ['#06090a', '#080d0c', '#b6f0c9', '#39ff88', '#ffb000', '#39ff88', '#03140a', 0] },
    { value: 'RPG Vault', sid: 'vault', modes: 'both', ar: 'خزنة المغامر', en: 'Adventurer\'s Vault', dar: 'ذهب وجلد وعناوين ملحمية', den: 'Gold, leather and epic headings', c: ['#0f0c0a', '#1a1511', '#efe6d2', '#d9b066', '#a8742e', '#4fc574', '#1e1408', 3] },
    { value: 'Vinyl Records', sid: 'vinyl', modes: 'both', ar: 'متجر الأسطوانات', en: 'Vinyl Records', dar: 'برتقالي دافئ بروح السبعينات', den: 'Warm 70s orange and cream', c: ['#1a120c', '#241810', '#f3e6cf', '#e8742a', '#e3b23c', '#d2692a', '#2a1206', 10] },
    { value: 'Corkboard', sid: 'cork', modes: 'desktop', ar: 'لوحة الذكريات', en: 'Corkboard', dar: 'بولارويد على لوح فلين', den: 'Polaroids pinned to cork', c: ['#1b1916', '#24211d', '#f5efe4', '#ff8a6b', '#f4c35a', '#8fd17f', '#2b0f07', 4] },
    { value: 'Retro Arcade', sid: 'arcade', modes: 'both', ar: 'الأركيد', en: 'Retro Arcade', dar: 'أصفر وزهري وخط بكسل', den: 'Yellow, magenta and pixel type', c: ['#07061a', '#110e2e', '#f5f3ff', '#ffd400', '#ff3ddc', '#3dff6e', '#140e00', 0] },
    { value: 'Magazine', sid: 'magazine', modes: 'desktop', ar: 'المجلة', en: 'Magazine', dar: 'غلاف مجلة بأعمدة وعناوين', den: 'An editorial magazine layout', c: ['#131313', '#1a1a1a', '#efe6d6', '#e63b2e', '#c42d21', '#efe6d6', '#fff5ea', 0] },
    { value: 'Cupertino Dark', sid: 'cupertino', modes: 'both', ar: 'كوبرتينو الداكن', en: 'Cupertino Dark', dar: 'أسود عميق وأزرق وزر تشغيل أبيض', den: 'Deep black, blue and a white Play', c: ['#000000', '#1c1c1e', '#ffffff', '#0a84ff', '#64d2ff', '#ffffff', '#ffffff', 10] },
    { value: 'Cyberpunk', sid: 'cyberpunk', modes: 'both', ar: 'سايبربنك', en: 'Cyberpunk', dar: 'ذهبي وفيروزي بزوايا مقصوصة', den: 'Gold and teal, angular HUD', c: ['#0b0f16', '#121822', '#e6e1d6', '#d9b45a', '#5fc4c8', '#d9b45a', '#15120b', 0] },
    { value: 'Shelter OS', sid: 'shelter', modes: 'both', ar: 'الملجأ', en: 'Shelter OS', dar: 'شاشة ملجأ خضراء متوهجة', den: 'A glowing green shelter terminal', c: ['#020a05', '#04110a', '#8ff5b8', '#1bff80', '#18dc6e', '#4dff9c', '#021208', 4] },
    { value: 'Crossbar', sid: 'xmb', modes: 'both', ar: 'الكونسول', en: 'Crossbar', dar: 'قائمة كونسول فوق موجة متحركة', den: 'A console menu over a flowing wave', c: ['#06122e', '#0c1f4a', '#ffffff', '#8cc4ff', '#c6e2ff', '#ffffff', '#061636', 12] },
    { value: 'Steam Original', sid: 'original', modes: 'both', ar: 'ستيم الأصلي', en: 'Steam Original', dar: 'بيغ بكتشر مثل ما يجي من ستيم', den: 'Big Picture exactly as Valve ships it', c: ['#0e141b', '#1a1f27', '#dcdedf', '#1a9fff', '#66c0f4', '#70d61d', '#ffffff', 4] },
    { value: 'SpaceTheme', sid: 'space', modes: 'both', ar: 'SpaceTheme', en: 'SpaceTheme', dar: 'داكن ومرتب بلون بنفسجي', den: 'Dark and tidy with a violet accent', c: ['#0a0a0a', '#111111', '#ebebf0', '#878cff', '#666cff', '#27b964', '#ffffff', 8] },
    { value: 'Material You', sid: 'material', modes: 'both', ar: 'Material You', en: 'Material You', dar: 'أسطح ناعمة وزوايا دائرية', den: 'Soft tonal surfaces, round corners', c: ['#111318', '#1d2026', '#e2e2e9', '#aac7ff', '#d6e3ff', '#aac7ff', '#0a305f', 12] },
  ];
  const MODES = {};
  STYLES.forEach(s => { MODES[s.value] = s.modes; });
  window.__rfsModes = MODES;
  const inBpm = s => s.modes === 'both' || s.modes === 'bpm';

  /* ---------------- language (Millennium condition "Language" → --rf-lang) ---------------- */
  const cssVar = (n, d = '') => { const v = getComputedStyle(html).getPropertyValue(n).trim(); return v || d; };
  const normLang = v => { v = String(v || '').replace(/["'\s]/g, '').toLowerCase(); return v === 'en' || v === 'ar' ? v : ''; };
  const lang = () => normLang(cssVar('--rf-lang')) || normLang((() => { try { return localStorage.getItem('rfs.lang'); } catch (e) { return ''; } })()) || 'en';
  const T = (ar, en) => (lang() === 'ar' ? ar : en);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------------- readable → hashed class names ---------------- */
  function C(key, ...hints) {
    const found = new Set();
    for (const m of maps) if (typeof m[key] === 'string' && hints.every(h => h in m)) found.add(m[key].split(' ')[0]);
    if (!found.size) { missing.push([key, ...hints].join('+')); return null; }
    const list = [...found];
    return list.length === 1 ? '.' + list[0] : `:is(${list.map(c => '.' + c).join(',')})`;
  }
  const rules = [];
  function rule(strings, ...vals) { if (vals.some(v => !v)) return; rules.push(String.raw({ raw: strings }, ...vals)); }
  const R = 'html.rfs-bpm:not([data-rfs-bpm="off"])';
  const A = 'rgba(var(--bpm-acc-rgb), ';

  /* ---- frame: background, top bar, footer ---- */
  rule`${R} ${C('BasicUiRoot')}, ${R} ${C('BasicHome')}${C('OpaqueBackground', 'BasicHome')} { background: var(--bpm-bgimg), var(--bpm-bg) !important; }`;
  rule`${R} ${C('BackgroundGlass')} { background: linear-gradient(180deg, color-mix(in srgb, var(--bpm-bg) 70%, transparent), var(--bpm-bg)) !important; }`;
  rule`${R} ${C('Header', 'HeaderItem')} { background: linear-gradient(180deg, color-mix(in srgb, var(--bpm-bg) 88%, transparent), color-mix(in srgb, var(--bpm-bg) 30%, transparent)) !important; }`;
  rule`${R} ${C('HeaderItem')} { color: var(--bpm-text) !important; }`;
  // our home design is on screen (shelf.js sets .rfs-bpm-home): the top bar sits on the design's own background,
  // not on Steam's hidden home art
  rule`html.rfs-bpm.rfs-bpm-home:not([data-rfs-bpm="off"]) ${C('Header', 'HeaderItem')} { background: var(--bpm-bgimg), var(--bpm-bg) !important; border-bottom: 1px solid rgba(var(--bpm-acc-rgb), .18) !important; }`;
  rule`${R} ${C('HeaderItem')} svg { fill: currentColor; }`;
  rule`${R} ${C('HeaderItem')}.gpfocus, ${R} ${C('HeaderItem')}:hover { color: var(--bpm-acc) !important; filter: drop-shadow(0 0 8px rgba(var(--bpm-glow), .6)); }`;
  rule`${R} ${C('Clock', 'HeaderItem')} { font-family: var(--bpm-head) !important; letter-spacing: var(--bpm-spacing); }`;
  rule`${R} ${C('BasicFooter')} { background: var(--rf-footer-bg, color-mix(in srgb, var(--bpm-panel) 92%, #000)) !important; border-top: 1px solid ${A}.28) !important; }`;
  rule`${R} ${C('ActionButtonLabel')} { color: var(--bpm-text) !important; font-family: var(--bpm-head) !important; text-transform: var(--bpm-case) !important; letter-spacing: var(--bpm-spacing) !important; }`;
  rule`${R} ${C('BasicFooter')} ${C('KeyCap', 'KeyboardChordGlyph')} { background: var(--bpm-acc) !important; color: var(--bpm-ink) !important; border-color: transparent !important; border-radius: min(var(--bpm-r), 6px) !important; box-shadow: 0 0 10px rgba(var(--bpm-glow), .35) !important; }`;

  /* ---- section titles ---- */
  rule`${R} ${C('RecentGamesHeaderLabel')}, ${R} ${C('RecentGamesHeader')} {
    font-family: var(--bpm-head) !important; text-transform: var(--bpm-case) !important; letter-spacing: var(--bpm-spacing) !important; color: var(--bpm-text) !important; }`;
  rule`${R} ${C('TabTitle', 'TabRow')} { font-family: var(--bpm-head) !important; text-transform: var(--bpm-case) !important; letter-spacing: var(--bpm-spacing) !important; }`;

  /* ---- tabs (What's new / Friends / Recommended, library tabs…) ---- */
  rule`${R} ${C('Tab', 'TabRow')} { border-radius: var(--bpm-r) !important; color: var(--bpm-dim) !important; }`;
  rule`${R} ${C('Tab', 'TabRow')}${C('Selected', 'Tab', 'TabRow')} { background: ${A}.16) !important; color: var(--bpm-acc) !important; box-shadow: inset 0 -2px 0 var(--bpm-acc) !important; }`;
  rule`${R} ${C('Tab', 'TabRow')}.gpfocus, ${R} ${C('Tab', 'TabRow')}${C('Selected', 'Tab', 'TabRow')}.gpfocus {
    background: linear-gradient(135deg, var(--bpm-acc), var(--bpm-acc2)) !important; color: var(--bpm-ink) !important; box-shadow: 0 0 18px rgba(var(--bpm-glow), .5) !important; }`;
  rule`${R} ${C('Tab', 'TabRow')}.gpfocus ${C('TabTitle', 'TabRow')} { color: var(--bpm-ink) !important; }`;
  rule`${R} ${C('TabHeaderRowWrapper')} { background: transparent !important; }`;
  rule`${R} ${C('KeyCap', 'KeyboardChordGlyph')} { border-radius: min(var(--bpm-r), 6px) !important; }`;

  /* ---- game capsules: radius, border, focus ring in the accent ---- */
  rule`${R} ${C('LibraryItemBox')} { border-radius: var(--bpm-r) !important; }`;
  rule`${R} ${C('LibraryItemBox')} ${C('Container', 'GreyBackground')} { border-radius: var(--bpm-r) !important; background-color: var(--bpm-panel) !important; }`;
  rule`${R} ${C('LibraryItemBox')}.gpfocus, ${R} ${C('LibraryItemBox')}:focus {
    outline: 2px solid var(--bpm-acc) !important; outline-offset: 3px !important;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, .5), 0 0 26px rgba(var(--bpm-glow), .55), 0 16px 24px rgba(0, 0, 0, .5) !important; }`;
  rule`${R} ${C('BasicGameCarouselItem')} { border-radius: var(--bpm-r); }`;

  /* ---- side menu (guide / F1) ---- */
  const MI = C('Item', 'ItemOuter', 'ItemIcon', 'ItemLabel');
  rule`${R} ${C('Menu', 'ItemOuter', 'ItemIcon')} { background: var(--bpm-bgimg), color-mix(in srgb, var(--bpm-panel) 96%, #000) !important; border-inline-end: 1px solid ${A}.22) !important; }`;
  rule`${R} ${MI} { color: var(--bpm-dim) !important; border-radius: 0 !important; }`;
  rule`${R} ${MI} ${C('ItemLabel', 'ItemOuter')} { font-family: var(--bpm-head) !important; text-transform: var(--bpm-case) !important; letter-spacing: var(--bpm-spacing) !important; }`;
  rule`${R} ${MI}${C('Active', 'ItemOuter', 'ItemIcon')} { color: var(--bpm-acc) !important; background: linear-gradient(90deg, ${A}.2), ${A}.03)) !important; }`;
  rule`${R} ${MI}.gpfocus, ${R} ${MI}:hover { background: linear-gradient(90deg, ${A}.28), ${A}.06)) !important; color: var(--bpm-text) !important; box-shadow: inset 4px 0 0 var(--bpm-acc) !important; }`;
  rule`${R} ${MI} svg { fill: currentColor !important; }`;

  /* ---- quick access menu ---- */
  rule`${R} ${C('QuickAccessMenu')} { background: color-mix(in srgb, var(--bpm-panel) 96%, #000) !important; }`;
  rule`${R} ${C('Tabs', 'QuickAccessMenu')} { background: color-mix(in srgb, var(--bpm-bg) 90%, #000) !important; border-inline-start: 1px solid ${A}.22) !important; }`;
  rule`${R} ${C('Title', 'QuickAccessMenu')} { font-family: var(--bpm-head) !important; text-transform: var(--bpm-case) !important; letter-spacing: var(--bpm-spacing) !important; color: var(--bpm-acc) !important; }`;

  /* ---- gamepad dialogs, settings pages, fields ---- */
  rule`${R} ${C('GamepadDialogContent')} { background: var(--bpm-bgimg), var(--bpm-bg) !important; }`;
  rule`${R} ${C('ModalPosition', 'WithStandardPadding')} ${C('GamepadDialogContent')} { background: var(--bpm-panel) !important; border: var(--bpm-card-border) !important; border-radius: var(--bpm-rl) !important; }`;
  rule`${R} ${C('PagedSettingsDialog_Title')} { font-family: var(--bpm-head) !important; text-transform: var(--bpm-case) !important; letter-spacing: var(--bpm-spacing) !important; }`;
  rule`${R} ${C('PagedSettingsDialog_PageListItem')}.gpfocus, ${R} ${C('PagedSettingsDialog_PageListItem')}:focus { background: linear-gradient(90deg, ${A}.35), ${A}0)) !important; border-color: var(--bpm-acc) !important; }`;
  rule`${R} ${C('PagedSettingsDialog_PageListItem')}${C('Active', 'PagedSettingsDialog_PageListItem')} { color: var(--bpm-acc) !important; }`;
  rule`${R} ${C('Field', 'GamepadDialogContent')}.gpfocus { background: ${A}.14) !important; }`;
  rule`${R} ${C('ToggleRail')} { border-radius: 99px !important; }`;

  /* ---- game page ---- */
  rule`${R} ${C('AppDetailsRoot', 'PlaySection')} { background: linear-gradient(180deg, color-mix(in srgb, var(--bpm-bg) 35%, transparent), color-mix(in srgb, var(--bpm-bg) 82%, transparent) 420px) !important; }`;
  const PBC = C('PlayButtonContainer'), PB = C('PlayButton', 'PlayButtonContainer'), GREEN = C('Green', 'PlayButtonContainer');
  rule`${R} ${PBC}${GREEN} { background: linear-gradient(135deg, var(--bpm-play-1), var(--bpm-play-2)) !important; border-radius: var(--bpm-r) !important; box-shadow: 0 6px 22px rgba(var(--bpm-glow), .3) !important; }`;
  rule`${R} ${PBC}${GREEN} ${PB}, ${R} ${PBC}${GREEN} ${PB} * { color: var(--bpm-play-ink) !important; fill: var(--bpm-play-ink) !important; font-family: var(--bpm-head) !important; text-transform: var(--bpm-case) !important; letter-spacing: var(--bpm-spacing) !important; }`;
  rule`${R} ${PBC}${GREEN} ${PB}:focus, ${R} ${PBC}${GREEN} ${PB}.gpfocus { background: rgba(255, 255, 255, .16) !important; box-shadow: 0 0 0 2px var(--bpm-text), 0 0 26px rgba(var(--bpm-glow), .7) !important; }`;
  rule`${R} ${PBC}${GREEN} ${PB}:focus::after { opacity: .35 !important; }`;
  rule`${R} ${C('AppDetailsSectionContainer', 'RightColumnSection')} { background: var(--bpm-card) !important; border: var(--bpm-card-border) !important; border-radius: var(--bpm-rl) !important; }`;
  rule`${R} ${C('SectionHeader', 'PadLeft')}, ${R} ${C('GameStatsSection')} ${C('StatusNameContainer')} { font-family: var(--bpm-head) !important; text-transform: var(--bpm-case) !important; letter-spacing: var(--bpm-spacing) !important; }`;
  rule`${R} ${C('PlayBarGameName')} { font-family: var(--bpm-head) !important; }`;

  /* =================================================================
     Steam-blue → theme accent, white focus rings → accent (generated from Steam's own CSS)
     ================================================================= */
  const rev = {};
  maps.forEach(m => { for (const k in m) if (typeof m[k] === 'string') for (const h of m[k].split(' ')) (rev[h] = rev[h] || []).push(k); });
  const readable = sel => sel.replace(/\.([A-Za-z0-9_-]{5,})/g, (s, c) => (rev[c] ? '.' + rev[c][0] : s));
  const RGB = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/g;
  /** 1 = a bright Steam blue, 2 = a deep Steam blue, 0 = anything else */
  function blueKind(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (mx < 150 || d / mx < 0.5 || mx !== b) return 0;
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
    if (h < 194 || h > 232) return 0;
    return mx >= 215 && (g >= 120) ? 1 : 2;
  }
  const white = (r, g, b) => r > 225 && g > 225 && b > 225;
  const dark = (r, g, b) => r < 70 && g < 70 && b < 80;
  const green = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === g && mx > 120 && (mx - mn) / mx > 0.5 && r < g * 0.85; };
  const accentOf = (kind, a) => kind === 1 ? `rgba(var(--bpm-acc-rgb), ${a})` : `color-mix(in srgb, var(--bpm-acc2) ${Math.round(a * 100)}%, transparent)`;
  const COLOR_PROPS = /^(color|background-color|background-image|border(-(top|right|bottom|left))?-color|outline-color|box-shadow|fill|stroke|text-shadow|filter|caret-color|text-decoration-color|accent-color)$/;
  const tintCache = new Map(); // sheet href → css text
  function tintSheet(sheet) {
    let rs; try { rs = sheet.cssRules; } catch (e) { return ''; }
    const out = [];
    const walk = (list, wrap) => {
      for (const r of list) {
        if (r.cssRules && !r.style) { // @media / @supports
          if (r.type === 4 /* media */) { const inner = []; walk(r.cssRules, inner); if (inner.length) out.push(`@media ${r.conditionText || r.media.mediaText}{${inner.join('')}}`); }
          continue;
        }
        if (!r.style || !r.selectorText || r.style.length === 0) continue;
        const t = r.style.cssText;
        if (!t.includes('rgb')) continue;
        const sel = r.selectorText;
        if (/KeyTheme|Candy/.test(sel)) continue;
        const focusy = /gpfocus|:focus/.test(sel);
        let rsel = null;
        const decl = [];
        let tintedBg = false;
        for (let i = 0; i < r.style.length; i++) {
          const p = r.style[i];
          if (!COLOR_PROPS.test(p)) continue;
          const v = r.style.getPropertyValue(p);
          if (!v || !v.includes('rgb')) continue;
          let changed = false;
          const nv = v.replace(RGB, (m, R1, G1, B1, A1) => {
            const rr = +R1, gg = +G1, bb = +B1, a = A1 == null ? 1 : +A1;
            const k = blueKind(rr, gg, bb);
            if (k) { changed = true; if (/^background/.test(p)) tintedBg = true; return accentOf(k, a); }
            if (focusy && white(rr, gg, bb) && /^(outline-color|box-shadow|border.*-color)$/.test(p)) { changed = true; return `rgba(var(--bpm-acc-rgb), ${Math.max(a, 0.85)})`; }
            if (green(rr, gg, bb) && /^background/.test(p)) {
              if (rsel === null) rsel = readable(sel);
              if (/Play|Launch|Install/.test(rsel)) { changed = true; return a < 1 ? `color-mix(in srgb, var(--bpm-play-1) ${Math.round(a * 100)}%, transparent)` : 'var(--bpm-play-1)'; }
            }
            return m;
          });
          if (changed) decl.push(`${p}:${nv}${r.style.getPropertyPriority(p) ? ' !important' : ''}`);
        }
        // text sitting on a re-tinted badge / button: the accent's own ink colour
        if (tintedBg) { const c = r.style.getPropertyValue('color'); const m = c && /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c); if (m && white(+m[1], +m[2], +m[3])) decl.push('color:var(--bpm-ink)'); }
        if (decl.length) (wrap || out).push(`${sel}{${decl.join(';')}}`);
      }
    };
    walk(rs);
    return out.join('\n');
  }

  /* =================================================================
     sheets in a document (this window + the menu windows)
     ================================================================= */
  const me = document.querySelector('script[src*="/src/js/bigpicture.js"]');
  const BASE = me ? me.src.replace(/src\/js\/bigpicture\.js.*$/, '') : 'https://millennium.host/v1/themes/rf-shelf/';
  function steamSheets(doc) { return [...doc.styleSheets].filter(s => s.href && /steamloopback\.host\/css\//.test(s.href)); }
  function tintText(doc) {
    const parts = [];
    for (const s of steamSheets(doc)) {
      if (!tintCache.has(s.href)) tintCache.set(s.href, tintSheet(s));
      parts.push(tintCache.get(s.href));
    }
    return parts.join('\n');
  }
  function ensureStyle(doc, id, text) {
    let s = doc.getElementById(id);
    if (!s) { s = doc.createElement('style'); s.id = id; }
    if (s.textContent !== text) s.textContent = text;
    // keep it after Steam's own (lazily added) sheets, so equal-specificity rules still win
    const steam = doc.head.querySelectorAll('link[href*="steamloopback.host/css/"]');
    const lastSteam = steam[steam.length - 1];
    if (!s.isConnected || (lastSteam && (lastSteam.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_PRECEDING))) doc.head.appendChild(s);
    return s;
  }
  let lastSheetCount = -1;
  function paintDoc(doc) {
    if (!doc || !doc.head) return;
    const n = steamSheets(doc).length;
    if (doc === document && n === lastSheetCount && document.getElementById('rfs-bpm-tint')) {
      ensureStyle(doc, 'rfs-bpm', rules.join('\n'));
      return;
    }
    if (doc === document) lastSheetCount = n;
    ensureStyle(doc, 'rfs-bpm', rules.join('\n'));
    const tint = ensureStyle(doc, 'rfs-bpm-tint', tintText(doc));
    tint.media = html.dataset.rfsBpm === 'off' ? 'not all' : '';
  }

  /* ---- the side menu / quick access windows (Millennium doesn't inject them) ---- */
  function menuWindows() {
    const out = [];
    try {
      const src = ctx.SteamUIStore && ctx.SteamUIStore.m_GamepadNavigationManager && ctx.SteamUIStore.m_GamepadNavigationManager.m_rgGamepadInputSources;
      for (const s of src || []) {
        const w = s && s.m_targetWindow;
        if (w && w !== window && !out.includes(w)) { try { if (/^(MainMenu|QuickAccess|notificationtoasts)_uid/.test(w.document.title)) out.push(w); } catch (e) { /* closed */ } }
      }
    } catch (e) { /* Steam changed: the menus keep Valve's look */ }
    return out;
  }
  function paintMenu(w) {
    const d = w.document;
    if (!d || !d.head) return;
    const h = d.documentElement;
    h.classList.add('rfs-bpm');
    if (h.dataset.rfsBpm !== html.dataset.rfsBpm) h.dataset.rfsBpm = html.dataset.rfsBpm || 'on';
    const sid = html.dataset.rfsStyle || '';
    if (sid && h.dataset.rfsStyle !== sid) h.dataset.rfsStyle = sid;
    // the same theme sheets this window has (style, language, fonts) + ours
    const want = [...document.querySelectorAll('link[rel="stylesheet"]')].filter(l => /\/src\/(styles|lang)\/|fonts\.googleapis/.test(l.href)).map(l => l.href);
    want.push(BASE + 'src/css/bigpicture.css');
    const have = [...d.querySelectorAll('link[data-rfs-bpm]')];
    for (const l of have) if (!want.includes(l.href)) l.remove();
    for (const href of want) {
      if (have.some(l => l.href === href && l.isConnected)) continue;
      const l = d.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.dataset.rfsBpm = '1'; d.head.appendChild(l);
    }
    if (!d.getElementById('rfs-font-rule')) {
      const st = d.createElement('style'); st.id = 'rfs-font-rule';
      st.textContent = ':where(body, body *:not(svg, svg *)) { font-family: var(--rf-font-ui) !important; }';
      d.head.appendChild(st);
    }
    ensureStyle(d, 'rfs-bpm', rules.join('\n'));
    const t = ensureStyle(d, 'rfs-bpm-tint', tintText(d));
    t.media = html.dataset.rfsBpm === 'off' ? 'not all' : '';
    hookWindow(w);
    if (/^MainMenu_uid/.test(d.title)) addMenuItem(w);
  }

  /* =================================================================
     mode + style sync
     ================================================================= */
  const curSid = () => cssVar('--rf-style-id').replace(/["']/g, '');
  const curStyle = () => STYLES.find(s => s.sid === curSid()) || null;
  function sync() {
    const st = curStyle();
    const sid = curSid();
    const mode = sid === 'original' ? 'off' : (st && !inBpm(st)) || !st ? 'neutral' : 'on';
    if (html.dataset.rfsBpm !== mode) html.dataset.rfsBpm = mode;
    if (sid && html.dataset.rfsStyle !== sid) html.dataset.rfsStyle = sid;
    paintDoc(document);
    for (const w of menuWindows()) { try { paintMenu(w); } catch (e) { /* a menu window closing */ } }
    placeButton();
    if (picker && picker.classList.contains('on')) renderPicker();
  }

  /* =================================================================
     UI: icon, toast
     ================================================================= */
  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="c" d="M12 2a10 10 0 0 0 0 20c1.1 0 1.8-.9 1.8-1.9 0-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.2 0-1 .8-1.8 1.8-1.8H17a5 5 0 0 0 5-5C22 6 17.5 2 12 2z"/><circle class="a" cx="6.8" cy="11.2" r="1.7"/><circle class="b" cx="9.6" cy="6.9" r="1.7"/><circle class="a" cx="14.6" cy="6.9" r="1.7"/><circle class="b" cx="17.6" cy="10.9" r="1.7"/></svg>';
  const CHEV = '<svg viewBox="0 0 24 24"><path d="M15.4 4.6 8 12l7.4 7.4 1.4-1.4-6-6 6-6z"/></svg>';
  let toastT = 0;
  function toast(text, ms = 2600) {
    let t = document.getElementById('rfs-bpm-toast');
    if (!t) { t = document.createElement('div'); t.id = 'rfs-bpm-toast'; document.body.appendChild(t); }
    t.textContent = text; t.dir = lang() === 'ar' ? 'rtl' : 'ltr';
    t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms);
  }

  /* =================================================================
     top-bar button
     ================================================================= */
  let tbtn = null;
  function placeButton() {
    const hiSel = C('HeaderItem');
    if (!hiSel) return;
    const items = [...document.querySelectorAll(hiSel)].filter(e => e.id !== 'rfs-bpm-tbtn');
    if (!items.length) return;
    const row = items[items.length - 1].parentElement;
    if (!tbtn) {
      tbtn = document.createElement('div');
      tbtn.id = 'rfs-bpm-tbtn';
      tbtn.setAttribute('role', 'button');
      tbtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openPicker(); });
    }
    const label = T('الثيمات', 'Themes');
    if (tbtn.dataset.lbl !== label) { tbtn.innerHTML = ICON + `<span>${esc(label)}</span>`; tbtn.dataset.lbl = label; tbtn.title = label + ' (F4)'; }
    if (tbtn.parentElement !== row || row.lastElementChild !== tbtn) row.appendChild(tbtn);
  }
  /** the last real header item (the avatar): moving right from it lands on our button */
  function lastHeaderItem() {
    const hiSel = C('HeaderItem');
    if (!hiSel) return null;
    const items = [...document.querySelectorAll(hiSel)].filter(e => e.id !== 'rfs-bpm-tbtn' && e.getBoundingClientRect().width > 0);
    return items[items.length - 1] || null;
  }

  /* simulated focus for elements Steam's gamepad navigation doesn't know about (our button, our menu entry) */
  let ff = null; // { el, win, back(dir) }
  function setFF(el, win) {
    clearFF();
    if (!el) return;
    ff = { el, win };
    el.classList.add('rfs-ff');
    win.document.documentElement.classList.add('rfs-ff-on');
  }
  function clearFF() {
    if (!ff) return;
    ff.el.classList.remove('rfs-ff');
    try { ff.win.document.documentElement.classList.remove('rfs-ff-on'); } catch (e) { /* closed */ }
    ff = null;
  }

  /* =================================================================
     main menu entry (guide / F1 menu, its own window)
     ================================================================= */
  function addMenuItem(w) {
    const d = w.document;
    const menuSel = C('Menu', 'ItemOuter', 'ItemIcon');
    const menu = menuSel && d.querySelector(menuSel);
    if (!menu) return;
    const outers = C('ItemOuter') ? [...menu.querySelectorAll(C('ItemOuter'))].filter(o => o.id !== 'rfs-bpm-mitem') : [];
    const after = outers[outers.length - 1];
    let it = d.getElementById('rfs-bpm-mitem');
    const label = T('الثيمات', 'Themes');
    if (!it) {
      // a copy of Steam's own last entry (same size, font, icon box), with our icon + label: it looks native
      if (after) {
        it = after.cloneNode(true);
        it.querySelectorAll('[class]').forEach(n => { n.classList.remove('gpfocus', 'gpfocuswithin'); const act = C('Active', 'ItemOuter', 'ItemIcon'); if (act) n.classList.remove(act.slice(1)); });
        it.classList.add('rfs-bpm-mitem-native');
      } else {
        it = d.createElement('div');
        it.className = 'rfs-bpm-mitem';
      }
      it.id = 'rfs-bpm-mitem';
      it.addEventListener('click', () => { closeSideMenus(); openPicker(); });
    }
    if (it.dataset.lbl !== label) {
      const icon = C('ItemIcon') && it.querySelector(C('ItemIcon'));
      const lab = C('ItemLabel') && it.querySelector(C('ItemLabel'));
      if (icon && lab) { icon.innerHTML = ICON; lab.textContent = label; } else it.innerHTML = ICON + `<span>${esc(label)}</span>`;
      it.dataset.lbl = label;
    }
    it.dir = lang() === 'ar' ? 'rtl' : 'ltr';
    if (after && after.nextElementSibling !== it) after.after(it);
    else if (!after && it.parentElement !== menu) menu.appendChild(it);
  }
  function closeSideMenus() {
    try { ctx.SteamUIStore.CloseSideMenus(); } catch (e) { try { window.postMessage({ message: 'CloseSideMenus' }, 'https://steamloopback.host'); } catch (e2) { /* ignore */ } }
  }

  /* =================================================================
     picker
     ================================================================= */
  const PAGE = 8, COLS = 4;
  let picker = null, page = 0, sel = 0, busy = false;
  const list = () => STYLES;
  const pages = () => Math.ceil(list().length / PAGE);
  function buildPicker() {
    picker = document.createElement('div');
    picker.id = 'rfs-bpm-picker';
    picker.setAttribute('role', 'dialog');
    picker.addEventListener('click', e => {
      const card = e.target.closest('.bp-card');
      if (card) { sel = +card.dataset.i; renderSel(); applySel(); return; }
      const ar = e.target.closest('.bp-arrow');
      if (ar) { turn(ar.dataset.d === 'n' ? 1 : -1); return; }
      const h = e.target.closest('[data-act]');
      if (h) { if (h.dataset.act === 'close') closePicker(); else if (h.dataset.act === 'apply') applySel(); else turn(h.dataset.act === 'next' ? 1 : -1); }
    });
    picker.addEventListener('mousemove', e => {
      const card = e.target.closest('.bp-card');
      if (card && +card.dataset.i !== sel) { sel = +card.dataset.i; renderSel(); }
    });
    document.body.appendChild(picker);
  }
  function renderPicker() {
    const ar = lang() === 'ar';
    picker.dir = ar ? 'rtl' : 'ltr';
    picker.lang = ar ? 'ar' : 'en';
    const cur = curSid();
    const items = list().slice(page * PAGE, page * PAGE + PAGE);
    const n = pages();
    picker.innerHTML = `
      <div class="bp-head">
        <div class="bp-title">${ICON}<div><b>${T('الثيمات', 'Themes')}</b><small>${T('اختر شكل ستيم — يتغيّر هنا وعلى سطح المكتب', 'Choose how Steam looks — here and on the desktop')}</small></div></div>
        <div class="bp-pages">
          <span class="bp-arrow ${page ? '' : 'dis'}" data-d="p">${CHEV}</span>
          <span>${T(`صفحة ${page + 1} من ${n}`, `Page ${page + 1} of ${n}`)}</span>
          <span class="bp-dots">${Array.from({ length: n }, (_, i) => `<i class="${i === page ? 'on' : ''}"></i>`).join('')}</span>
          <span class="bp-arrow ${page < n - 1 ? '' : 'dis'}" data-d="n" style="transform:scaleX(-1)">${CHEV}</span>
        </div>
      </div>
      <div class="bp-grid">${items.map((s, k) => {
        const i = page * PAGE + k;
        const [bg, panel, text, acc, acc2, play, ink, r] = s.c;
        const isCur = s.sid === cur, dis = !inBpm(s);
        const tag = isCur ? `<span class="bp-tag cur">${T('الحالي', 'Current')}</span>` : dis ? `<span class="bp-tag desk">${T('لسطح المكتب فقط', 'Desktop only')}</span>` : '';
        return `<div class="bp-card${dis ? ' dis' : ''}${isCur ? ' cur' : ''}" data-i="${i}" data-sid="${s.sid}"
            style="--c-bg:${bg};--c-panel:${panel};--c-text:${text};--c-acc:${acc};--c-acc2:${acc2};--c-play:${play};--c-ink:${ink};--c-r:${Math.min(r, 10)}px">
          <div class="bp-prev"><i class="pv-glow"></i><i class="pv-top"></i><i class="pv-cap c1"></i><i class="pv-cap c2"></i><i class="pv-cap c3"></i><i class="pv-cap c4"></i><i class="pv-play"></i><i class="pv-tab t1"></i><i class="pv-tab t2"></i><i class="pv-tab t3"></i></div>
          <div class="bp-meta"><div class="bp-row"><b>${esc(ar ? s.ar : s.en)}</b>${tag}</div><p>${esc(ar ? s.dar : s.den)}</p>
            <div class="bp-sw"><i style="background:${bg};outline:1px solid rgba(255,255,255,.15)"></i><i style="background:${panel}"></i><i style="background:${acc}"></i><i style="background:${acc2}"></i><i style="background:${play}"></i></div></div>
        </div>`;
      }).join('')}</div>
      <div class="bp-foot">
        <span class="bp-hint" data-act="apply"><kbd class="pad a">A</kbd><kbd>Enter</kbd>${T('تطبيق', 'Apply')}</span>
        <span class="bp-hint" data-act="close"><kbd class="pad b">B</kbd><kbd>Esc</kbd>${T('إغلاق', 'Close')}</span>
        <span class="bp-hint" data-act="prev"><kbd class="bump">LB</kbd><kbd class="bump">RB</kbd><kbd>PgUp</kbd><kbd>PgDn</kbd>${T('الصفحات', 'Pages')}</span>
        <span class="sp"></span>
        <span class="bp-hint">${T('على سطح المكتب: زر الثيمات بالأعلى', 'On the desktop: the THEMES button at the top')}</span>
      </div>
      <div class="bp-busy"><div class="bp-spin"></div><div class="bp-busy-t"></div></div>`;
    renderSel();
  }
  function renderSel() {
    picker.querySelectorAll('.bp-card').forEach(c => c.classList.toggle('sel', +c.dataset.i === sel));
  }
  function turn(d) {
    const n = pages();
    const np = Math.max(0, Math.min(n - 1, page + d));
    if (np === page) return;
    const col = (sel - page * PAGE) % COLS, row = Math.floor((sel - page * PAGE) / COLS);
    page = np;
    sel = Math.min(list().length - 1, page * PAGE + row * COLS + col);
    renderPicker();
  }
  function move(dx, dy) {
    const rtl = picker.dir === 'rtl';
    if (rtl) dx = -dx;
    const L = list().length;
    const local = sel - page * PAGE;
    let col = local % COLS, row = Math.floor(local / COLS);
    const count = Math.min(PAGE, L - page * PAGE);
    const rows = Math.ceil(count / COLS);
    if (dx) {
      col += dx;
      if (col < 0) { if (page > 0) { page--; sel = page * PAGE + row * COLS + COLS - 1; renderPicker(); } return; }
      if (col >= COLS || page * PAGE + row * COLS + col >= L) {
        if (page < pages() - 1) { page++; sel = Math.min(L - 1, page * PAGE + row * COLS); renderPicker(); }
        return;
      }
    }
    if (dy) { row = Math.max(0, Math.min(rows - 1, row + dy)); }
    sel = Math.min(L - 1, page * PAGE + row * COLS + col);
    renderSel();
  }
  function openPicker() {
    if (busy) return;
    closeSideMenus();
    clearFF();
    if (!picker) buildPicker();
    const i = STYLES.findIndex(s => s.sid === curSid());
    sel = i < 0 ? 0 : i;
    page = Math.floor(sel / PAGE);
    renderPicker();
    picker.classList.add('on');
  }
  function closePicker() {
    if (!picker || busy) return;
    picker.classList.remove('on');
  }
  const isOpen = () => !!(picker && picker.classList.contains('on'));
  function setBusy(text) {
    busy = !!text;
    if (!picker) return;
    picker.classList.toggle('busy', busy);
    const t = picker.querySelector('.bp-busy-t'); if (t) t.textContent = text || '';
  }

  /* ---- applying: Millennium condition "Style" (saved for the next start), then live or a UI reload ---- */
  async function themeNative() {
    try { const r = await ctx.MILLENNIUM_API.ffi('core', 'Core_GetActiveTheme')(); const o = typeof r === 'string' ? JSON.parse(r) : r; return (o && o.native) || 'rf-shelf'; } catch (e) { return 'rf-shelf'; }
  }
  const base = sid => sid === 'material' ? 'material' : sid === 'original' ? 'none' : 'space';
  async function applySel() {
    const st = list()[sel];
    if (!st || busy) return;
    if (!inBpm(st)) { toast(T('هذا الثيم لسطح المكتب فقط — اختره من زر الثيمات في ستيم العادي', 'This theme is desktop only — pick it from the THEMES button in desktop Steam')); return; }
    const from = curSid();
    if (st.sid === from) { closePicker(); return; }
    const name = lang() === 'ar' ? st.ar : st.en;
    setBusy(T(`جاري تطبيق «${name}»…`, `Applying “${name}”…`));
    try {
      const set = ctx.MILLENNIUM_API.ffi('core', 'Core_ChangeCondition');
      const r = await set(await themeNative(), st.value, 'Style');
      if (r && r.success === false) throw new Error('rejected');
      try { localStorage.setItem('rfs.style', st.sid); } catch (e) { /* the store pages read it */ }
    } catch (e) {
      setBusy('');
      toast(T('ما قدرت أغيّر الثيم — غيّره من إعدادات ستيم ← Millennium ← Themes', 'Couldn\'t change the theme — use Steam Settings → Millennium → Themes'), 5000);
      return;
    }
    if (base(st.sid) === base(from) && await swapLive(st)) {
      setBusy('');
      closePicker();
      toast(T(`صار الثيم «${name}»`, `Theme is now “${name}”`));
      return;
    }
    // a different community base (Material You / Steam Original) needs Steam's UI rebuilt
    setBusy(T('ستيم يعيد تحميل الواجهة…', 'Steam is reloading its interface…'));
    setTimeout(() => { try { ctx.SteamClient.Browser.RestartJSContext(); } catch (e) { setBusy(''); } }, 400);
  }
  /** swap the style sheet in this window (and our menu windows) without reloading Steam;
      the desktop windows follow on their own (skin.js followStyle) */
  function swapLive(st) {
    const docs = [document, ...menuWindows().map(w => w.document)];
    const mine = document.querySelector('link[href*="/src/styles/"]');
    if (!mine) return Promise.resolve(false);
    const href = mine.href.replace(/\/src\/styles\/[^/?#]+\.css/, `/src/styles/${st.sid}.css`);
    const jobs = docs.map(d => new Promise(done => {
      const old = d.querySelector('link[href*="/src/styles/"]');
      if (!old) { done(); return; }
      const nl = d.createElement('link');
      nl.rel = 'stylesheet'; nl.href = href; if (old.id) nl.id = old.id; if (old.dataset.rfsBpm) nl.dataset.rfsBpm = '1';
      let fin = false;
      const end = () => { if (fin) return; fin = true; for (const l of d.querySelectorAll('link[href*="/src/styles/"]')) if (l !== nl) l.remove(); done(); };
      nl.onload = end; nl.onerror = end;
      old.after(nl);
      setTimeout(end, 4000);
    }));
    return Promise.race([jobs[0], new Promise(r => setTimeout(r, 4500))]).then(() => {
      try { if (window.__rfsSkin && window.__rfsSkin.restyle) window.__rfsSkin.restyle(); } catch (e) { /* ignore */ }
      sync();
      return true;
    });
  }

  /* =================================================================
     input: gamepad (Steam's vgp_* events), keyboard, simulated focus
     ================================================================= */
  const B = { OK: 1, CANCEL: 2, SECONDARY: 3, OPTIONS: 4, LB: 5, RB: 6, LT: 7, RT: 8, UP: 9, DOWN: 10, LEFT: 11, RIGHT: 12, SELECT: 13, START: 14 };
  let lastKey = 0, lastPad = 0, selectHeld = false;
  const eat = e => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); };
  function pickerButton(b) {
    switch (b) {
      case B.OK: applySel(); break;
      case B.CANCEL: closePicker(); break;
      case B.LEFT: move(-1, 0); break;
      case B.RIGHT: move(1, 0); break;
      case B.UP: move(0, -1); break;
      case B.DOWN: move(0, 1); break;
      case B.LB: case B.LT: turn(-1); break;
      case B.RB: case B.RT: turn(1); break;
      default: return false;
    }
    return true;
  }
  function onPad(e, win) {
    const d = e.detail || {};
    const b = d.button;
    if (isOpen()) {
      eat(e);
      // Steam turns keyboard presses into these events too: one key press = one action
      if (busy || Date.now() - lastKey < 120) return;
      lastPad = Date.now();
      pickerButton(b);
      return;
    }
    // View + Y opens the picker from anywhere
    if (b === B.SELECT) selectHeld = true;
    if (b === B.OPTIONS && selectHeld) { eat(e); openPicker(); return; }
    // simulated focus on our button / menu entry
    if (ff && ff.win === win) {
      if (b === B.OK) { eat(e); const w = ff.win; clearFF(); if (w !== window) closeSideMenus(); openPicker(); return; }
      if (ff.el.id === 'rfs-bpm-tbtn') {
        if (b === B.LEFT || b === B.CANCEL) { eat(e); clearFF(); return; } // back to the avatar (Steam's focus never left it)
        if (b === B.RIGHT || b === B.UP) { eat(e); return; }
        clearFF(); return; // down: Steam moves on from the avatar
      }
      if (ff.el.id === 'rfs-bpm-mitem') {
        if (b === B.UP) { eat(e); clearFF(); return; }
        if (b === B.DOWN) { eat(e); return; }
        clearFF(); return;
      }
    }
    if (win === window && b === B.RIGHT) {
      const last = lastHeaderItem();
      const t = e.target;
      if (last && t && t.nodeType === 1 && (t === last || last.contains(t)) && tbtn && tbtn.isConnected) { eat(e); setFF(tbtn, window); return; }
    }
    if (win !== window && b === B.DOWN) {
      const it = win.document.getElementById('rfs-bpm-mitem');
      const sel2 = C('ItemOuter');
      const outers = sel2 ? [...win.document.querySelectorAll(sel2)].filter(o => o.id !== 'rfs-bpm-mitem') : [];
      const last = outers[outers.length - 1];
      const t = e.target;
      if (it && last && t && t.nodeType === 1 && last.contains(t)) { eat(e); setFF(it, win); return; }
    }
  }
  function onPadUp(e) { const d = e.detail || {}; if (d.button === B.SELECT) selectHeld = false; if (isOpen()) eat(e); }
  function onKey(e, win) {
    if (e.key === 'F4' || (e.ctrlKey && e.shiftKey && (e.key === 'T' || e.key === 't'))) { eat(e); isOpen() ? closePicker() : openPicker(); return; }
    if (!isOpen()) {
      if (ff && ff.win === win && (e.key === 'Enter' || e.key === ' ')) { eat(e); const w = ff.win; clearFF(); if (w !== window) closeSideMenus(); openPicker(); }
      return;
    }
    const map = { Enter: B.OK, ' ': B.OK, Escape: B.CANCEL, Backspace: B.CANCEL, ArrowLeft: B.LEFT, ArrowRight: B.RIGHT, ArrowUp: B.UP, ArrowDown: B.DOWN, PageUp: B.LB, PageDown: B.RB };
    const b = map[e.key];
    eat(e);
    if (b == null || busy || Date.now() - lastPad < 120) return; // already handled as Steam's gamepad event
    lastKey = Date.now();
    pickerButton(b);
  }
  const hooked = new WeakSet();
  function hookWindow(w) {
    if (hooked.has(w)) return;
    hooked.add(w);
    on(w, 'vgp_onbuttondown', e => onPad(e, w), true);
    on(w, 'vgp_onbuttonup', onPadUp, true);
    on(w, 'keydown', e => onKey(e, w), true);
    on(w, 'keyup', e => { if (isOpen()) eat(e); }, true);
  }
  hookWindow(window);
  // a click anywhere else drops the simulated focus
  on(window, 'mousedown', e => { if (ff && !ff.el.contains(e.target)) clearFF(); }, true);

  /* =================================================================
     4. Home designs: the desktop engine (src/js/shelf.js + its CSS) runs in this window too. It sees
        window.__rfsBpmHost, and then only replaces Big Picture's home (/library/home) with the active style's home
        design, zoomed for a TV and driven by the controller (shelf.js "Big Picture host"). Styles without a Big
        Picture home (desktop-only ones, Steam Original, SpaceTheme, Material You) keep Valve's home.
     ================================================================= */
  function loadHomeEngine() {
    window.__rfsBpmHost = true;
    for (const f of ['src/css/shelf.css', 'src/css/layouts.css']) {
      if (document.querySelector(`link[data-rfs-engine="${f}"]`)) continue;
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = BASE + f; l.dataset.rfsEngine = f;
      document.head.appendChild(l);
    }
    if (window.__rfsShelf || document.querySelector('script[data-rfs-engine]')) return;
    const s = document.createElement('script'); s.src = BASE + 'src/js/shelf.js'; s.dataset.rfsEngine = '1';
    document.head.appendChild(s);
  }

  /* =================================================================
     start + keep up (React re-renders the header; menus open later; Steam adds chunk sheets on navigation)
     ================================================================= */
  html.classList.add('rfs-bpm');
  sync();
  loadHomeEngine();
  [300, 1000, 2500, 6000].forEach(ms => setTimeout(sync, ms));
  const iv = setInterval(() => {
    if (document.hidden) return;
    if (!tbtn || !tbtn.isConnected) placeButton();
    const n = steamSheets(document).length;
    if (n !== lastSheetCount) paintDoc(document);
    for (const w of menuWindows()) {
      try {
        const d = w.document;
        if (!d.getElementById('rfs-bpm-tint') || d.documentElement.dataset.rfsBpm !== html.dataset.rfsBpm) paintMenu(w);
        else if (/^MainMenu_uid/.test(d.title) && !d.getElementById('rfs-bpm-mitem')) addMenuItem(w);
      } catch (e) { /* closing */ }
    }
  }, 1500);
  cleanup.push(() => clearInterval(iv));
  // the style sheet swapped by skin.js followStyle (theme changed on the desktop) → re-sync
  const mo = new MutationObserver(muts => {
    for (const m of muts) for (const n of m.addedNodes) if (n.tagName === 'LINK' && /\/src\/styles\//.test(n.href)) { n.addEventListener('load', () => setTimeout(sync, 50), { once: true }); }
  });
  if (document.head) mo.observe(document.head, { childList: true });
  cleanup.push(() => mo.disconnect());

  window.__rfsBpm = {
    rules: rules.length, missing: [...new Set(missing)], modes: MODES, open: openPicker, close: closePicker, isOpen, sync,
    destroy() {
      cleanup.forEach(f => { try { f(); } catch (e) { /* keep going */ } });
      for (const id of ['rfs-bpm-tbtn', 'rfs-bpm-picker', 'rfs-bpm-toast', 'rfs-bpm', 'rfs-bpm-tint']) { const n = document.getElementById(id); if (n) n.remove(); }
      for (const w of menuWindows()) { try { const n = w.document.getElementById('rfs-bpm-mitem'); if (n) n.remove(); } catch (e) { /* ignore */ } }
    },
  };
})();
