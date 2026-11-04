// Dumps the visible DOM of a Steam window with Steam's *readable* class names (hashed → Module.Key).
// Used to find what to style. Run via: node tools/eval.mjs tools/dumpui.js "^Steam$"
(async () => {
  const op = window.opener || window;
  const api = op.MILLENNIUM_API;
  const rev = new Map();
  const list = (api && api.classMapList) || [];
  for (const m of list) {
    const tag = (Object.keys(m).find(k => /^[A-Z]/.test(k)) || '?');
    for (const [k, v] of Object.entries(m)) {
      if (typeof v !== 'string') continue;
      for (const h of v.split(' ')) if (!rev.has(h)) rev.set(h, k + '@' + tag);
    }
  }
  const name = el => String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className)
    .split(' ').filter(Boolean).map(c => rev.get(c) || c).join(' ');
  const rows = [];
  const area = innerWidth * innerHeight;
  const walk = (el, d) => {
    if (d > 30 || rows.length > 260) return;
    for (const c of el.children) {
      if (c.id === 'rfs' || c.id === 'rfs-viewer' || c.id === 'rfs-toggle' || c.id === 'rfs-toast') continue;
      const r = c.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) { walk(c, d + 1); continue; }
      const a = r.width * r.height;
      const txt = c.children.length === 0 ? (c.textContent || '').trim().slice(0, 30) : '';
      if (a > area * 0.004 || txt) rows.push(`${d} ${c.tagName.toLowerCase()} {${name(c)}} [${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}]${txt ? ' "' + txt + '"' : ''}`);
      walk(c, d + 1);
    }
  };
  walk(document.body, 0);
  return `maps=${list.length} route=${op.MainWindowBrowserManager && op.MainWindowBrowserManager.m_lastLocation && op.MainWindowBrowserManager.m_lastLocation.pathname}\n` + rows.join('\n');
})()
