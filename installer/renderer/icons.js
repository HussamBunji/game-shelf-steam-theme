/* Inline SVG icon set (24x24, stroke based). No emoji anywhere. */
(function () {
  const s = (body, extra = '') =>
    `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" ${extra}>${body}</svg>`;
  const ICONS = {
    logo: `<svg viewBox="0 0 32 32" width="1em" height="1em" aria-hidden="true" focusable="false"><rect x="3" y="5" width="5" height="20" rx="1.2" fill="currentColor" opacity=".55"/><rect x="9.5" y="3" width="5" height="22" rx="1.2" fill="currentColor" opacity=".8"/><rect x="16" y="6" width="5" height="19" rx="1.2" fill="currentColor"/><rect x="22.6" y="4.5" width="5" height="20.5" rx="1.2" transform="rotate(8 25 15)" fill="currentColor" opacity=".7"/><rect x="2" y="26" width="28" height="3" rx="1.2" fill="currentColor"/></svg>`,
    chev: s('<path d="M9 5l7 7-7 7"/>', 'stroke-width="2"'),
    star: s('<path d="M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8L12 3.8z"/>', 'stroke-width="1.7"'),
    x: s('<path d="M6 6l12 12M18 6L6 18"/>'),
    minimize: s('<path d="M6 12h12"/>'),
    check: s('<path d="M5 12.5l4.2 4.2L19 7"/>', 'stroke-width="2.4"'),
    checkBig: s('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'stroke-width="2.4"'),
    checkAll: s('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 12.2l2.8 2.8L16.2 9.4"/>'),
    square: s('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/>'),
    arrowRight: s('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    arrowLeft: s('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
    chevronLeft: s('<path d="M15 5l-7 7 7 7"/>', 'stroke-width="2.2"'),
    chevronRight: s('<path d="M9 5l7 7-7 7"/>', 'stroke-width="2.2"'),
    chevronDown: s('<path d="M6 9l6 6 6-6"/>', 'stroke-width="2"'),
    globe: s('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>'),
    layers: s('<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>'),
    chart: s('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    sparkle: s('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z"/>'),
    shield: s('<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'),
    trash: s('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3"/>'),
    refresh: s('<path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 4v7h-7"/>'),
    download: s('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
    play: s('<path d="M7 4.5v15l12-7.5-12-7.5z" fill="currentColor"/>'),
    terminal: s('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9l3 3-3 3M12.5 15H17"/>'),
    lightbulb: s('<path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0012 3z"/>'),
    grid: s('<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>'),
    bag: s('<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 016 0v2"/>'),
    image: s('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'),
    expand: s('<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>'),
    steam: s('<circle cx="12" cy="12" r="9"/><circle cx="15.5" cy="9.5" r="2.5"/><circle cx="8.8" cy="15.2" r="1.6"/><path d="M3.5 13.5l4 1.6M10.3 14.4l3.4-3"/>'),
    plug: s('<path d="M9 3v5M15 3v5M7 8h10v3a5 5 0 01-10 0V8zM12 16v5"/>'),
    power: s('<path d="M12 3v8M6.3 6.8a8 8 0 1011.4 0"/>'),
    gamepad: s('<path d="M7 8h10a4 4 0 014 4.5l-.6 3.6A2.6 2.6 0 0115.9 17L14 15h-4l-1.9 2a2.6 2.6 0 01-4.5-.9L3 12.5A4 4 0 017 8z"/><path d="M8 11v3M6.5 12.5h3M15.5 11.5h.01M17.5 13h.01"/>'),
    alert: s('<path d="M12 4l9.5 16h-19L12 4z"/><path d="M12 10v4M12 17h.01"/>'),
    info: s('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
    external: s('<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4"/>'),
    github: `<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2a10 10 0 00-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.4 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5a3.9 3.9 0 011-2.7c-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 015 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7a3.9 3.9 0 011 2.7c0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0012 2z"/></svg>`,
    folder: s('<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>'),
    spinner: `<svg viewBox="0 0 24 24" width="1em" height="1em" class="spin" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-opacity=".22" stroke-width="2.4"/><path d="M21 12a9 9 0 00-9-9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
    dot: `<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>`,
  };
  window.ICONS = ICONS;
  window.icon = (name) => ICONS[name] || '';
  window.paintIcons = (root = document) => {
    root.querySelectorAll('[data-icon]').forEach((el) => {
      const n = el.getAttribute('data-icon');
      if (el.dataset.painted === n) return;
      el.innerHTML = ICONS[n] || '';
      el.dataset.painted = n;
      el.classList.add('ic');
    });
  };
})();
