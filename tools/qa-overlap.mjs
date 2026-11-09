// Layout QA: finds buttons that stick out, overlap, overflow their text, have no contrast or can't be clicked.
// Steam must run with -dev (CDP on 127.0.0.1:8080). Read-only: it never clicks anything by itself.
//   node tools/qa-overlap.mjs check <targetRegex> <outBase>      one window/page (regex on title or URL) → .json + .png
//   node tools/qa-overlap.mjs list                               open CDP targets
//   node tools/qa-overlap.mjs run <outDir> <Style> [<Style>...] [--only=home,panel,picker,app,menus,downloads,install,friends,settings,web|store|...]
//   node tools/qa-overlap.mjs bpm <outBase>                     the open Big Picture window (zoom-aware; screen capture)
// The in-page check (CHECK) reports, for the visible interactive elements (a, button, [role=button], input, select,
// .DialogButton, [class*="Button"], our .tb-btn / .rf-act …):
//   overflow  – sticks out of its clipping container (overflow hidden/clip, or the non-scrolling axis of a scroller)
//               or out of the viewport horizontally
//   overlap   – two controls whose boxes overlap by > 4 px both ways, neither containing the other
//   text      – a nowrap label wider than its box (scrollWidth > clientWidth + 2); ellipsis:true = truncated on purpose
//   contrast  – text whose colour is almost its background (ratio < 1.35)
//   covered   – a control whose centre point hits another element (not itself / a descendant): unclickable
// Results are grouped (same issue on many similar elements → one line with a count) to keep the output readable.
import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

export const CHECK = String.raw`(() => {
  const W = innerWidth, H = innerHeight;
  const SEL = 'a[href], button, [role=button], [role=tab], [role=menuitem], [role=checkbox], [role=link], input:not([type=hidden]), select, textarea, .DialogButton, [class*="Button"], .tb-btn, .rf-act, .tp-card, .tp-pg, .rr-btn, .rr-link, .ql, [data-act], [tabindex="0"]';
  const desc = el => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const cls = typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '';
    if (cls) s += '.' + cls.trim().split(/\s+/).slice(0, 3).join('.');
    const t = (el.getAttribute('aria-label') || el.innerText || el.value || el.title || '').trim().replace(/\s+/g, ' ').slice(0, 28);
    return t ? s + ' "' + t + '"' : s;
  };
  const path = el => { const p = []; for (let e = el; e && e !== document.body && p.length < 4; e = e.parentElement) p.unshift(desc(e).split(' "')[0]); return p.join(' > '); };
  const R = el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  // visible part of an element: its box cut by the viewport and every clipping ancestor (null = nothing shows)
  const VR = new Map();
  // rect r (of el, or of a text inside el when self=true) cut by the viewport and the clipping ancestors
  const clipRect = (el, r, self, cuts) => {
    let v = { l: Math.max(0, r.left), t: Math.max(0, r.top), r: Math.min(W, r.right), b: Math.min(H, r.bottom) };
    if (v.r - v.l < 2 || v.b - v.t < 2) return null;
    // clipping follows the containing-block chain: an absolute box escapes overflow of static ancestors, a fixed one all
    let pos = self ? 'static' : getComputedStyle(el).position;
    for (let a = self ? el : el.parentElement; a && a !== document.documentElement && v; a = a.parentElement) {
      const ac = getComputedStyle(a);
      if (+ac.opacity < 0.05 || ac.visibility === 'hidden' || ac.display === 'none') return null;
      const cb = ac.position !== 'static' || ac.transform !== 'none' || ac.filter !== 'none' || ac.contain.includes('paint') || ac.willChange.includes('transform');
      const skip = (pos === 'absolute' && !cb) || (pos === 'fixed' && !(ac.transform !== 'none' || ac.filter !== 'none' || ac.willChange.includes('transform')));
      if (!skip) pos = ac.position;
      if (!skip && (ac.overflowX !== 'visible' || ac.overflowY !== 'visible' || ac.clipPath !== 'none')) {
        const ar = a.getBoundingClientRect();
        if (cuts) {
          const ox = Math.max(ar.left - r.left, r.right - ar.right), oy = Math.max(ar.top - r.top, r.bottom - ar.bottom);
          const sx = /auto|scroll/.test(ac.overflowX) && a.scrollWidth > a.clientWidth + 1, sy = /auto|scroll/.test(ac.overflowY) && a.scrollHeight > a.clientHeight + 1;
          if (ac.overflowX !== 'visible' && ox > 2) cuts.push({ a, axis: 'x', by: ox, scroll: sx });
          if (ac.overflowY !== 'visible' && oy > 2) cuts.push({ a, axis: 'y', by: oy, scroll: sy });
        }
        if (ac.overflowX !== 'visible') { v.l = Math.max(v.l, ar.left); v.r = Math.min(v.r, ar.right); }
        if (ac.overflowY !== 'visible') { v.t = Math.max(v.t, ar.top); v.b = Math.min(v.b, ar.bottom); }
      }
      if (v.r - v.l < 2 || v.b - v.t < 2) return null;
    }
    return v;
  };
  const visRect = el => {
    if (VR.has(el)) return VR.get(el);
    const r = el.getBoundingClientRect();
    const v = r.width >= 3 && r.height >= 3 ? clipRect(el, r, false) : null;
    VR.set(el, v);
    return v;
  };
  const visible = el => {
    if (el instanceof SVGElement) return false;
    if (!visRect(el)) return false;
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity < 0.05) return false;
    return true;
  };
  // a control, not a whole panel that happens to be focusable
  const control = el => {
    const r = el.getBoundingClientRect();
    const big = r.width * r.height > 0.2 * W * H || (r.width > 500 && r.height > 160);
    if (/^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return true;
    if (big) return false; // a whole clickable panel, not a button
    return true;
  };
  // a scrolled page slides under its fixed / sticky header: those overlaps are by design
  const scrolled = (document.scrollingElement && document.scrollingElement.scrollTop > 0);
  const FX = new Map();
  const fixedCtx = el => { if (FX.has(el)) return FX.get(el); let f = null; for (let a = el; a && a !== document.documentElement; a = a.parentElement) { const p = getComputedStyle(a).position; if (p === 'fixed' || p === 'sticky') { f = a; break; } } FX.set(el, f); return f; };
  const underHeader = (a, b) => scrolled && fixedCtx(a) !== fixedCtx(b);
  const wrapped = el => getComputedStyle(el).display === 'inline' && el.getClientRects().length > 1;
  // a modal layer on top (Steam dialog, our picker / game panel): only check what is inside it
  const SCOPE = window.__qaScope || '.ModalPosition, #rfs-themes.on, #rfs-sheet.on, #rfs-viewer.on, .contextMenu';
  const layer = [...document.querySelectorAll(SCOPE)].filter(e => { const r = e.getBoundingClientRect(); return r.width > 50 && r.height > 50 && getComputedStyle(e).visibility !== 'hidden'; }).pop() || null;
  const inScope = el => !layer || layer.contains(el);
  const all = [...new Set(document.querySelectorAll(SEL))].filter(el => inScope(el) && visible(el) && control(el));
  // innermost-only pairs: drop an element whose only interactive child fills it (same box)
  const els = all;
  const out = { url: location.href, title: document.title, W, H, dir: document.documentElement.dir || getComputedStyle(document.body).direction,
    style: document.documentElement.getAttribute('data-rfs-style') || getComputedStyle(document.documentElement).getPropertyValue('--rf-style-id').trim(),
    layer: layer ? desc(layer).slice(0, 60) : null, n: els.length, ellipsis: [], clipText: [], overflow: [], overlap: [], text: [], contrast: [], covered: [] };

  // (a) sticking out
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.left < -2 || r.right > W + 2) {
      out.overflow.push({ el: desc(el), path: path(el), r: R(el), why: 'viewport', by: Math.round(Math.max(-r.left, r.right - W)) });
      continue;
    }
    const cuts = [];
    clipRect(el, r, false, cuts);
    // cut by a box that doesn't scroll that way (a scroller's own axis is fine: the rest is reachable by scrolling);
    // anything inside a scroller (carousel, list) that is cut on the scroll axis is fine too
    const scrollers = cuts.filter(c => c.scroll);
    const bad = cuts.find(c => !c.scroll && !scrollers.some(s => s.axis === c.axis));
    // …or anything between the element and that box scrolls on the cut axis (the clipped part scrolls into view)
    const scrolls = (a, ax) => { const c = getComputedStyle(a); return ax === 'x' ? /auto|scroll/.test(c.overflowX) && a.scrollWidth > a.clientWidth + 1 : /auto|scroll/.test(c.overflowY) && a.scrollHeight > a.clientHeight + 1; };
    if (bad) { let sc = false; for (let a = el.parentElement; a && a !== bad.a; a = a.parentElement) if (scrolls(a, bad.axis)) { sc = true; break; } if (sc) continue; }
    if (bad) out.overflow.push({ el: desc(el), path: path(el), r: R(el), why: 'clipped-' + bad.axis + ' by ' + desc(bad.a).split(' "')[0], by: Math.round(bad.by) });
  }

  // (b) overlaps (sweep by x)
  const boxes = els.map(el => { const v = visRect(el); return { el, r: { left: v.l, right: v.r, top: v.t, bottom: v.b } }; }).sort((p, q) => p.r.left - q.r.left);
  for (let i = 0; i < boxes.length; i++) {
    const A = boxes[i];
    for (let j = i + 1; j < boxes.length && boxes[j].r.left < A.r.right - 4; j++) {
      const B = boxes[j];
      if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
      if (underHeader(A.el, B.el)) continue;
      if (wrapped(A.el) || wrapped(B.el)) continue; // a link wrapped over two lines: its box is the union of both lines
      const ix = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left);
      const iy = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
      if (ix > 4 && iy > 4) {
        const cx = (Math.max(A.r.left, B.r.left) + Math.min(A.r.right, B.r.right)) / 2, cy = (Math.max(A.r.top, B.r.top) + Math.min(A.r.bottom, B.r.bottom)) / 2;
        const hit = document.elementFromPoint(cx, cy);
        const top = hit ? (A.el.contains(hit) ? 'A' : B.el.contains(hit) ? 'B' : desc(hit).slice(0, 60)) : null;
        out.overlap.push({ a: desc(A.el), b: desc(B.el), pa: path(A.el), pb: path(B.el), ra: R(A.el), rb: R(B.el), ix: Math.round(ix), iy: Math.round(iy), top });
      }
    }
  }

  // (c) text overflowing its control
  for (const el of els) {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) continue;
    const cands = [el, ...el.querySelectorAll('span, div, b, small, strong, em')].slice(0, 8);
    for (const c of cands) {
      const cs = getComputedStyle(c);
      if (cs.whiteSpace !== 'nowrap' && cs.whiteSpace !== 'pre') continue;
      if (!c.innerText || !c.innerText.trim()) continue;
      if (c.scrollWidth > c.clientWidth + 2 && c.clientWidth > 0 && cs.overflowX !== 'visible') {
        out.text.push({ el: desc(el), part: c === el ? '' : desc(c).split(' "')[0], path: path(el), r: R(c), sw: c.scrollWidth, cw: c.clientWidth, ellipsis: cs.textOverflow === 'ellipsis' });
        break;
      }
      // overflow:visible but the text runs out of the control's own box
      if (c === el && cs.overflowX === 'visible' && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
        out.text.push({ el: desc(el), part: '(overflow:visible)', path: path(el), r: R(el), sw: el.scrollWidth, cw: el.clientWidth, ellipsis: false });
        break;
      }
    }
  }

  // (d) contrast: text nodes vs effective background
  const parse = c => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const bgOf = el => {
    let acc = null;
    for (let a = el; a; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.backgroundImage !== 'none' || cs.backdropFilter && cs.backdropFilter !== 'none') return null; // image / gradient: unknown
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0.9) return c;
      if (c && c.a > 0.3) acc = acc || c;
    }
    return acc;
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set(), TXT = [], VM = new Map(); let tn, count = 0;
  while ((tn = walker.nextNode()) && count < 6000) {
    if (!tn.nodeValue.trim()) continue;
    const el = tn.parentElement;
    if (!el || !inScope(el)) continue;
    if (!VM.has(el)) VM.set(el, visible(el));
    const VIS = VM.get(el);
    let TV = null;
    try {
      const rg = document.createRange(); rg.selectNodeContents(tn); const tr = rg.getBoundingClientRect();
      const cuts = [];
      const ink = parse(getComputedStyle(el).color);
      if (tr.width > 3 && tr.height > 3 && (!ink || ink.a >= 0.05) && (!el.checkVisibility || el.checkVisibility({ opacityProperty: true, visibilityProperty: true }))) TV = clipRect(el, tr, true, cuts); // transparent text (drawn by a ::before / ::after instead) is not checked
      // words cut off sideways by a box that doesn't scroll (ellipsis = cut on purpose, a scroller = reachable)
      const cx = TV && cuts.find(c => c.axis === 'x' && !c.scroll && c.by > 3);
      if (cx && !cuts.some(c => c.axis === 'x' && c.scroll)) {
        let ell = false;
        for (let a = el; a && a !== cx.a.parentElement; a = a.parentElement) if (getComputedStyle(a).textOverflow === 'ellipsis') { ell = true; break; }
        if (!ell) out.clipText.push({ el: desc(el), path: path(el), r: R(el), by: Math.round(cx.by), clip: desc(cx.a).split(' "')[0] });
      }
      if (TV && TV.r - TV.l > 3 && TV.b - TV.t > 3) {
        // one box per line: a wrapped text's bounding box covers whatever sits beside its first / last line
        const lines = [...rg.getClientRects()].filter(q => q.width > 3 && q.height > 3);
        for (const q of lines.length > 1 ? lines : [tr]) {
          const l = Math.max(q.left, TV.l), r2 = Math.min(q.right, TV.r), t = Math.max(q.top, TV.t), b = Math.min(q.bottom, TV.b);
          if (r2 - l > 3 && b - t > 3) TXT.push({ el, r: { left: l, right: r2, top: t, bottom: b } });
        }
      }
    } catch (e) { /* ignore */ }
    if (seen.has(el)) continue;
    seen.add(el); count++;
    if (!VIS && !TV) continue;
    const cs = getComputedStyle(el);
    // (info) our own labels cut with an ellipsis — fine for long game names, worth a look for facts / buttons
    if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1 && el.closest('[id^="rfs"]')) out.ellipsis.push({ el: desc(el), path: path(el), r: R(el), sw: el.scrollWidth, cw: el.clientWidth });
    const fg = parse(cs.color);
    if (!fg || fg.a < 0.05) { if (fg && fg.a < 0.05 && !cs.webkitTextFillColor?.includes('0)') && cs.webkitBackgroundClip !== 'text' && cs.backgroundClip !== 'text') out.contrast.push({ el: desc(el), path: path(el), r: R(el), ratio: 0, why: 'transparent text' }); continue; }
    if (cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text' || +cs.opacity < 0.05) continue;
    const bg = bgOf(el);
    if (!bg) continue;
    const L1 = lum(fg), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (ratio < 1.35 && fg.a > 0.3) out.contrast.push({ el: desc(el), path: path(el), r: R(el), ratio: +ratio.toFixed(2), fg: cs.color, bg: 'rgb(' + bg.r + ',' + bg.g + ',' + bg.b + ')' });
  }

  // (f) text drawn under / through a control it doesn't belong to (a label hidden behind a button)
  out.textUnder = [];
  for (const t of TXT) {
    if (t.r.right - t.r.left < 3 || t.r.bottom - t.r.top < 3) continue;
    for (const b of boxes) {
      if (b.el.contains(t.el) || t.el.contains(b.el)) continue;
      if (underHeader(b.el, t.el)) continue;
      if (wrapped(b.el)) continue;
      // an empty link laid over a whole card (click-anywhere overlay) is not a button on top of text
      if (!(b.el.innerText || '').trim() && b.r.left <= t.r.left + 1 && b.r.right >= t.r.right - 1 && b.r.top <= t.r.top + 1 && b.r.bottom >= t.r.bottom - 1 && (b.el.getBoundingClientRect().width * b.el.getBoundingClientRect().height) > 4000) continue;
      const ix = Math.min(t.r.right, b.r.right) - Math.max(t.r.left, b.r.left);
      const iy = Math.min(t.r.bottom, b.r.bottom) - Math.max(t.r.top, b.r.top);
      if (ix > 4 && iy > 4) {
        const hit = document.elementFromPoint((Math.max(t.r.left, b.r.left) + Math.min(t.r.right, b.r.right)) / 2, (Math.max(t.r.top, b.r.top) + Math.min(t.r.bottom, b.r.bottom)) / 2);
        const onTop = hit ? (t.el.contains(hit) || hit.contains(t.el) && !hit.contains(b.el) ? 'text' : b.el.contains(hit) ? 'control' : 'other') : null;
        out.textUnder.push({ text: desc(t.el), control: desc(b.el), pt: path(t.el), pc: path(b.el), rt: { x: Math.round(t.r.left), y: Math.round(t.r.top), w: Math.round(t.r.right - t.r.left), h: Math.round(t.r.bottom - t.r.top) }, rc: R(b.el), ix: Math.round(ix), iy: Math.round(iy), onTop });
        break;
      }
    }
  }

  // (e) covered controls
  for (const el of els) {
    const r = el.getBoundingClientRect(), v = visRect(el);
    if ((v.r - v.l) * (v.b - v.t) < 0.5 * r.width * r.height) continue; // mostly scrolled / clipped away
    const cx = (v.l + v.r) / 2, cy = (v.t + v.b) / 2;
    const hit = document.elementFromPoint(cx, cy);
    if (!hit || el === hit || el.contains(hit)) continue;
    if (underHeader(el, hit)) continue;
    if (wrapped(el)) continue;
    if (getComputedStyle(el).pointerEvents === 'none') continue; // decorative / disabled on purpose
    if (hit.contains(el)) {
      // the point lands on an ancestor: el doesn't cover its own centre (e.g. pointer-events:none child chain, or a hole)
      out.covered.push({ el: desc(el), path: path(el), r: R(el), by: '(ancestor) ' + desc(hit).slice(0, 70) });
      continue;
    }
    out.covered.push({ el: desc(el), path: path(el), r: R(el), by: desc(hit).slice(0, 70), byPath: path(hit) });
  }

  // group similar findings
  const group = (list, key) => {
    const m = new Map();
    for (const it of list) { const k = key(it); const g = m.get(k); if (g) g.count++; else m.set(k, Object.assign({ count: 1 }, it)); }
    return [...m.values()].sort((a, b) => b.count - a.count);
  };
  const shape = s => (s || '').replace(/ ".*$/, '');
  out.overflow = group(out.overflow, i => shape(i.el) + '|' + i.why);
  out.overlap = group(out.overlap, i => shape(i.a) + '|' + shape(i.b));
  out.text = group(out.text, i => shape(i.el) + '|' + i.part + '|' + i.ellipsis);
  out.contrast = group(out.contrast, i => i.path + '|' + i.fg);
  out.ellipsis = group(out.ellipsis, i => i.path);
  out.clipText = group(out.clipText, i => i.path + '|' + i.clip);
  out.textUnder = group(out.textUnder, i => shape(i.text) + '|' + shape(i.control));
  out.covered = group(out.covered, i => shape(i.el) + '|' + shape(i.by));
  return out;
})()`;

export async function targets() { return (await fetch('http://127.0.0.1:8080/json')).json(); }

export async function open(t) {
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; setTimeout(() => j(new Error('ws timeout')), 4000); });
  let id = 0;
  const send = (method, params = {}, ms = 30000) => new Promise((resolve, reject) => {
    const my = ++id;
    const timer = setTimeout(() => { ws.removeEventListener('message', h); reject(new Error('timeout ' + method)); }, ms);
    const h = ev => { const m = JSON.parse(ev.data); if (m.id === my) { clearTimeout(timer); ws.removeEventListener('message', h); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); } };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: my, method, params }));
  });
  const evaluate = async (expression, ms) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, ms);
    if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description || JSON.stringify(r.exceptionDetails)).slice(0, 400));
    return r && r.result ? r.result.value : undefined;
  };
  return { t, ws, send, evaluate, close: () => { try { ws.close(); } catch (e) { /* closed */ } } };
}

/** first target whose title or URL matches and (for duplicated titles) whose document is visible */
export async function find(re, { visibleOnly = true } = {}) {
  const list = (await targets()).filter(x => x.webSocketDebuggerUrl && (re.test(x.title) || re.test(x.url)));
  let fallback = null;
  for (const t of list) {
    let p;
    try { p = await open(t); } catch (e) { continue; }
    try {
      const v = await p.evaluate('document.visibilityState + "|" + innerWidth + "|" + innerHeight', 3000);
      const [vis, w, h] = v.split('|');
      if (vis === 'visible' && +w > 50 && +h > 50) { if (fallback) fallback.close(); return p; }
      if (!fallback && !visibleOnly) { fallback = p; continue; }
    } catch (e) { /* dead target */ }
    p.close();
  }
  return fallback;
}

export async function checkPage(p, outBase) {
  const res = await p.evaluate(CHECK, 60000);
  let shot = null;
  try { shot = await p.send('Page.captureScreenshot', { format: 'png' }, 8000); }
  catch (e) {
    // a window behind others may not paint: bring it forward once and retry
    try { await p.evaluate('try { SteamClient.Window.BringToFront() } catch (e) {} ; 1', 3000); } catch (e2) { /* no SteamClient here */ }
    try { await p.send('Page.bringToFront', {}, 3000); } catch (e2) { /* ignore */ }
    await new Promise(r => setTimeout(r, 600));
    try { shot = await p.send('Page.captureScreenshot', { format: 'png' }, 10000); } catch (e3) { res.shotError = String(e3.message || e3); }
  }
  if (outBase) {
    writeFileSync(outBase + '.json', JSON.stringify(res, null, 1));
    if (shot) writeFileSync(outBase + '.png', Buffer.from(shot.data, 'base64'));
  }
  return res;
}

export function summary(res) {
  const n = k => (res[k] || []).reduce((a, b) => a + b.count, 0);
  return `n=${res.n} overflow=${n('overflow')} overlap=${n('overlap')} text=${n('text')} contrast=${n('contrast')} covered=${n('covered')} textUnder=${n('textUnder')} clipText=${n('clipText')} ellipsis=${n('ellipsis')}`;
}

/* ======================================================================================================
   Driver: walks every page of one style in the current language.
     node tools/qa-overlap.mjs run <outDir> <Style> [<Style>…] [--only=home,panel,…]
   Everything goes through SharedJSContext: Steam's popup manager knows which windows are real and visible (/json
   lists stale copies of every window after a UI reload). It opens windows and menus but never acts in them: the
   install dialog is CANCELLED, the settings window is closed again, nothing is typed into a chat.
   ====================================================================================================== */
const sleep = ms => new Promise(r => setTimeout(r, ms));
export const SID = { 'Classic Shelf': 'classic', 'Glass Gallery': 'glass', 'Neon Coverflow': 'neon', 'Terminal': 'terminal', 'RPG Vault': 'vault', 'Vinyl Records': 'vinyl', 'Corkboard': 'cork', 'Retro Arcade': 'arcade', 'Magazine': 'magazine', 'Cupertino Dark': 'cupertino', 'Cyberpunk': 'cyberpunk', 'Shelter OS': 'shelter', 'Crossbar': 'xmb', 'Steam Original': 'original', 'SpaceTheme': 'space', 'Material You': 'material' };
const NATIVE_HOME = new Set(['original', 'space', 'material']);
const WEB = [
  ['store', 'https://store.steampowered.com/'],
  ['store-app', 'https://store.steampowered.com/app/1091500/'],
  ['store-search', 'https://store.steampowered.com/search/?term=portal'],
  ['wishlist', 'https://store.steampowered.com/wishlist/'],
  ['community', 'https://steamcommunity.com/'],
  ['profile', 'https://steamcommunity.com/my/'],
  ['badges', 'https://steamcommunity.com/my/badges/'],
  ['games', 'https://steamcommunity.com/my/games/?tab=all'],
];
const NOT_INSTALLED = 282800; // install dialog only — always cancelled

function gameRunning() {
  try { const o = execSync('reg query HKCU\\Software\\Valve\\Steam /v RunningAppID', { encoding: 'utf8' }); const m = /0x([0-9a-f]+)/i.exec(o); return m ? parseInt(m[1], 16) : 0; } catch (e) { return 0; }
}
async function waitNoGame() {
  for (let n = 0; gameRunning(); n++) { if (n % 12 === 0) console.log('a game is running — waiting'); await sleep(10000); }
}

export async function sharedJS(tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const p = await find(/^SharedJSContext$/, { visibleOnly: false });
      if (p) { const ok = await p.evaluate('typeof g_PopupManager !== "undefined" && typeof SteamUIStore !== "undefined"', 4000); if (ok) return p; p.close(); }
    } catch (e) { /* restarting */ }
    await sleep(1000);
  }
  throw new Error('SharedJSContext not available');
}
const POP = re => `([...g_PopupManager.GetPopups()].find(p => p.m_popup && ${re}.test(p.m_strName + '|' + p.m_popup.document.title) && p.m_popup && !p.m_popup.closed && p.m_popup.document.visibilityState === 'visible') || {}).m_popup`;
const MAIN = POP('/^SP Desktop/');

/** CDP target of a popup: give it a unique title for a moment and look it up in /json */
async function popupTarget(sj, re) {
  const marker = 'QA-' + Math.random().toString(36).slice(2, 9);
  const ok = await sj.evaluate(`(() => { const w = ${POP(re)}; if (!w) return false; w.__qaTitle = w.document.title; w.document.title = ${JSON.stringify(marker)}; return true; })()`);
  if (!ok) return null;
  let t = null;
  for (let i = 0; i < 20 && !t; i++) { await sleep(150); t = (await targets()).find(x => x.title === marker); }
  // restore by the marker itself: the window no longer matches `re` while it carries the marker as its title
  await sj.evaluate(`(() => { for (const p of g_PopupManager.GetPopups()) { const w = p.m_popup; if (w && w.document.title === ${JSON.stringify(marker)}) w.document.title = w.__qaTitle; } return 1; })()`);
  return t ? open(t) : null;
}

async function waitPopup(sj, re, ms = 8000) {
  for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(300)) if (await sj.evaluate(`!!${POP(re)}`)) { await sleep(900); return true; }
  return false;
}
async function checkPopup(sj, re, outBase) {
  const res = await sj.evaluate(`(() => { const w = ${POP(re)}; if (!w) return null; return w.eval(${JSON.stringify(CHECK)}); })()`, 60000);
  if (!res) return null;
  const t = await popupTarget(sj, re);
  if (t) {
    try {
      const shot = await t.send('Page.captureScreenshot', { format: 'png' }, 10000);
      writeFileSync(outBase + '.png', Buffer.from(shot.data, 'base64'));
    } catch (e) { res.shotError = String(e.message || e); }
    t.close();
  } else res.shotError = 'no CDP target';
  writeFileSync(outBase + '.json', JSON.stringify(res, null, 1));
  return res;
}

async function webTarget(prefix, sid, lang, ms = 25000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const t = (await targets()).find(x => x.webSocketDebuggerUrl && x.url.startsWith(prefix));
    if (t) {
      try {
        const p = await open(t);
        const st = await p.evaluate(`document.readyState + '|' + document.documentElement.getAttribute('data-rfs-style') + '|' + document.documentElement.getAttribute('data-rfs-lang')`, 4000);
        const [rs, s, l] = st.split('|');
        if (rs === 'complete' && s === sid && (!lang || l === lang)) return p;
        p.close();
      } catch (e) { /* navigating */ }
    }
    await sleep(700);
  }
  return null;
}

async function mouse(p, x, y, button = 'left') {
  await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  for (const type of ['mousePressed', 'mouseReleased']) await p.send('Input.dispatchMouseEvent', { type, x, y, button, clickCount: 1 });
}
async function key(p, k) {
  await p.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code: k, windowsVirtualKeyCode: 27 });
  await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: 27 });
}

/** switch the style from the library window; waits through a UI reload when the base changes */
export async function setStyle(value, log = console.log) {
  const sid = SID[value];
  let sj = await sharedJS();
  const cur = await sj.evaluate(`(() => { const w = ${MAIN}; return w ? getComputedStyle(w.document.documentElement).getPropertyValue('--rf-style-id').trim() : ''; })()`);
  if (cur === sid) { sj.close(); return true; }
  try { await sj.evaluate(`(() => { const w = ${MAIN}; w.__rfsShelf.Themes.apply(${JSON.stringify(value)}); return 1; })()`, 8000); } catch (e) { /* the context restarts */ }
  sj.close();
  for (let i = 0; i < 120; i++) {
    await sleep(1000);
    try {
      sj = await sharedJS(5);
      const v = await sj.evaluate(`(() => { const w = ${MAIN}; if (!w || !w.__rfsShelf) return ''; return getComputedStyle(w.document.documentElement).getPropertyValue('--rf-style-id').trim() + '|' + (w.__rfsShelf.state.games || []).length; })()`, 4000);
      sj.close();
      const [s, n] = (v || '').split('|');
      // Steam Original / SpaceTheme / Material You keep Steam's own home: the shelf has no game list there
      if (s === sid && (+n > 0 || NATIVE_HOME.has(sid))) { await sleep(NATIVE_HOME.has(sid) ? 5000 : 2500); return true; }
      // after a UI reload on a store page the game list loads only once the library home is shown
      if (s === sid && !(+n > 0) && i % 5 === 4) { try { const sj2 = await sharedJS(3); await sj2.evaluate(`SteamUIStore.Navigate('/library/home'), 1`); sj2.close(); } catch (e) { /* not ready */ } }
    } catch (e) { /* not back yet */ }
  }
  log('style switch to', value, 'timed out');
  return false;
}

export async function runStyle(outRoot, value, only, log = console.log) {
  await waitNoGame();
  const sid = SID[value];
  if (!(await setStyle(value, log))) return [];
  const sj = await sharedJS();
  const lang = await sj.evaluate(`(() => { const w = ${MAIN}; return w.document.documentElement.dataset.rfsLang || 'en'; })()`);
  const dir = path.join(outRoot, lang, sid);
  mkdirSync(dir, { recursive: true });
  const rows = [];
  const want = n => !only || only.includes(n);
  const rec = async (name, res) => {
    if (!res) { rows.push({ style: sid, lang, page: name, missing: true }); log(`${sid.padEnd(10)} ${lang} ${name.padEnd(13)} (not open)`); return; }
    rows.push({ style: sid, lang, page: name, sum: summary(res), file: path.join(dir, name) });
    log(`${sid.padEnd(10)} ${lang} ${name.padEnd(13)} ${summary(res)}`);
  };
  const M = code => sj.evaluate(`(async () => { const w = ${MAIN}; ${code} })()`, 30000);
  const games = await M(`const g = w.__rfsShelf.state.games || []; if (g.length) { const i = g.find(x => x.installed) || g[0]; return { inst: i.appid, first: g[0].appid }; }
    const a = collectionStore.localGamesCollection.allApps; return { inst: a[0].appid, first: a[0].appid };`);

  // library home + a game's panel
  await M(`SteamUIStore.Navigate('/library/home'); return 1;`);
  await sleep(2500);
  if (want('home')) await rec('home', await checkPopup(sj, '/^SP Desktop/', path.join(dir, 'home')));
  if (want('panel') && !NATIVE_HOME.has(sid)) {
    await M(`const A = w.__rfsLayoutApi; const g = A.byId(${games.first}) || w.__rfsShelf.state.games[0]; A.openGame(g, null); return 1;`);
    await sleep(1800);
    await rec('panel', await checkPopup(sj, '/^SP Desktop/', path.join(dir, 'panel')));
    await M(`w.__rfsLayoutApi.closeGame(); return 1;`);
    await sleep(1500);
  }
  // theme picker, both pages
  if (want('picker')) {
    await M(`w.__rfsShelf.Themes.open(); return 1;`);
    await sleep(900);
    await rec('picker1', await checkPopup(sj, '/^SP Desktop/', path.join(dir, 'picker1')));
    await M(`const b = w.document.querySelector('#rfs-themes .tp-pg.next'); if (b && !b.disabled) b.click(); return 1;`);
    await sleep(600);
    await rec('picker2', await checkPopup(sj, '/^SP Desktop/', path.join(dir, 'picker2')));
    await M(`w.__rfsShelf.Themes.close(); return 1;`);
    await sleep(500);
  }
  // game page in the library + right-click menu on the game list + title bar menus
  if (want('app')) {
    await M(`SteamUIStore.Navigate('/library/app/${games.inst}'); return 1;`);
    await sleep(3000);
    await rec('app', await checkPopup(sj, '/^SP Desktop/', path.join(dir, 'app')));
  }
  if (want('menus')) {
    if (!want('app')) { await M(`SteamUIStore.Navigate('/library/app/${games.inst}'); return 1;`); await sleep(3000); }
    const pt = await M(`const e = [...w.document.querySelectorAll('.GameListEntryContainer')].find(e => { const r = e.getBoundingClientRect(); return r.width > 50 && r.top > 150 && r.bottom < w.innerHeight - 20; }); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + Math.min(60, r.width / 2), y: r.top + r.height / 2 };`);
    const mt = await popupTarget(sj, '/^SP Desktop/');
    if (mt) {
      // the library's right-click menu is drawn inside the library window (.contextMenu); Escape closes it
      if (pt) {
        await mouse(mt, pt.x, pt.y, 'right');
        await sleep(1000);
        const open1 = await M(`return !!w.document.querySelector('.contextMenu');`);
        await rec('ctxmenu', open1 ? await checkPopup(sj, '/^SP Desktop/', path.join(dir, 'ctxmenu')) : null);
        for (let i = 0; i < 3 && await M(`return !!w.document.querySelector('.contextMenu');`); i++) { await key(mt, 'Escape'); await sleep(300); }
      } else await rec('ctxmenu', null);
      // title bar menus are popup windows of their own
      for (const [name, sel, re] of [['notifications', '.NotificationsButton', '/Notifications Menu|contextmenu_8/'], ['account', '.AccountMenu', '/Account Menu|contextmenu_9/']]) {
        const ok = await M(`const e = w.document.querySelector('${sel}'); if (!e) return false; e.click(); return true;`);
        await sleep(1200);
        const res = ok ? await checkPopup(sj, '/^contextmenu/', path.join(dir, name)) : null;
        await rec(name, res);
        const m2 = await popupTarget(sj, '/^contextmenu/');
        if (m2) { await key(m2, 'Escape'); m2.close(); await sleep(400); }
        await sj.evaluate(`(() => { const w = ${POP('/^contextmenu/')}; if (w) w.SteamClient.Window.HideWindow(); return 1; })()`);
        await sleep(400);
      }
      mt.close();
    }
  }
  if (want('downloads')) {
    await M(`SteamUIStore.Navigate('/library/downloads'); return 1;`);
    await sleep(2500);
    await rec('downloads', await checkPopup(sj, '/^SP Desktop/', path.join(dir, 'downloads')));
  }
  // install dialog of a game that isn't installed — inspected, then CANCELLED
  if (want('install')) {
    await M(`SteamUIStore.Navigate('/library/home'); return 1;`);
    await sleep(1500);
    await sj.evaluate(`SteamClient.URL.ExecuteSteamURL('steam://install/${NOT_INSTALLED}'), 1`);
    await sleep(2500);
    await rec('install', await checkPopup(sj, '/^SP Desktop/', path.join(dir, 'install')));
    const c = await M(`const m = w.document.querySelector('.ModalPosition'); if (!m) return 'none'; const b = [...m.querySelectorAll('.DialogButton')].find(b => /^(Cancel|إلغاء|الغاء)$/.test(b.textContent.trim())) || m.querySelector('.DialogButton.Secondary'); if (b) { b.click(); return 'cancelled'; } const x = m.querySelector('.closeButton'); if (x) { x.click(); return 'closed'; } return 'stuck';`);
    if (c === 'stuck') log('!! install dialog could not be cancelled');
    await sleep(800);
  }
  // friends list, a chat window, settings
  if (want('friends')) {
    await sj.evaluate(`SteamClient.URL.ExecuteSteamURL('steam://open/friends'), 1`);
    await waitPopup(sj, '/^friendslist/');
    await rec('friends', await checkPopup(sj, '/^friendslist/', path.join(dir, 'friends')));
    const fid = await sj.evaluate(`(() => { try { const fs = g_FriendsUIApp.FriendStore; const a = [...fs.m_setFriendAccountIDs][0]; return a ? (76561197960265728n + BigInt(a)).toString() : null; } catch (e) { return null; } })()`);
    if (fid) {
      await sj.evaluate(`SteamClient.URL.ExecuteSteamURL('steam://friends/message/${fid}'), 1`);
      await waitPopup(sj, '/^chat_/');
      await sleep(800);
      await rec('chat', await checkPopup(sj, '/^chat_/', path.join(dir, 'chat')));
    }
  }
  if (want('settings')) {
    await sj.evaluate(`SteamClient.URL.ExecuteSteamURL('steam://open/settings'), 1`);
    await waitPopup(sj, '/Settings|إعدادات/', 10000);
    await rec('settings', await checkPopup(sj, '/Settings|إعدادات/', path.join(dir, 'settings')));
    await sj.evaluate(`(() => { const w = ${POP('/Settings|إعدادات/')}; const b = w && w.document.querySelector('.title-area-icon.closeButton'); if (b) b.click(); return 1; })()`);
    await sleep(800);
  }
  // store / community pages in the library window's browser
  for (const [name, url] of WEB) {
    if (!want(name) && !want('web')) continue;
    await sj.evaluate(`SteamClient.URL.ExecuteSteamURL(${JSON.stringify('steam://openurl/' + url)}), 1`);
    await sleep(1500);
    const host = /^https:\/\/[^/]+\//.exec(url)[0];
    const pre = url.includes('/my/') ? host : url.replace(/\?.*$/, '');
    const p = await webTarget(pre, sid, lang);
    if (!p) { await rec(name, null); continue; }
    await sleep(2500);
    let res = null;
    try { res = await checkPage(p, path.join(dir, name)); }
    catch (e) { await sleep(3000); try { res = await checkPage(p, path.join(dir, name)); } catch (e2) { log(`${sid} ${lang} ${name}: ${String(e2.message).slice(0, 120)}`); } } // the page was still loading
    await rec(name, res);
    if (name === 'store-app') { // the purchase area is below the fold
      await p.evaluate('window.scrollTo(0, innerHeight * 0.9), 1');
      await sleep(900);
      await rec('store-app-2', await checkPage(p, path.join(dir, 'store-app-2')));
    }
    p.close();
  }
  await M(`SteamUIStore.Navigate('/library/home'); return 1;`);
  sj.close();
  return rows;
}

/* ======================================================================================================
   Big Picture:  node tools/qa-overlap.mjs bpm <outBase>
   - The home designs are CSS-zoomed there; this Chromium returns getBoundingClientRect() unzoomed inside a zoomed box
     while elementFromPoint() works in real pixels, so every rect is scaled by its ancestors' zoom while checking.
   - Steam's own home lies under our design (#rfs.on) on purpose: it is hidden for the check.
   - CDP screenshots of the Big Picture window come back black: the screen itself is captured (PowerShell).
   - Steam's screensaver (after 5 idle minutes) is dismissed first.
   ====================================================================================================== */
const ZOOM_ON = `(() => { if (window.__qaZoomOrig) return 1; const E = Element.prototype, Rg = Range.prototype;
  const o = window.__qaZoomOrig = { b: E.getBoundingClientRect, c: E.getClientRects, rb: Rg.getBoundingClientRect, rc: Rg.getClientRects };
  const zf = el => { let z = 1; for (let a = el; a && a.nodeType === 1; a = a.parentElement) { const v = parseFloat(getComputedStyle(a).zoom); if (v && v !== 1) z *= v; } return z; };
  const sc = (r, z) => z === 1 ? r : new DOMRect(r.x * z, r.y * z, r.width * z, r.height * z);
  const own = n => n.nodeType === 1 ? n : n.parentElement;
  E.getBoundingClientRect = function () { return sc(o.b.call(this), zf(this)); };
  E.getClientRects = function () { const z = zf(this); return [...o.c.call(this)].map(r => sc(r, z)); };
  Rg.getBoundingClientRect = function () { return sc(o.rb.call(this), zf(own(this.commonAncestorContainer))); };
  Rg.getClientRects = function () { const z = zf(own(this.commonAncestorContainer)); return [...o.rc.call(this)].map(r => sc(r, z)); };
  const R = document.getElementById('rfs'); window.__qaHid = [];
  if (R && R.classList.contains('on') && R.parentElement) for (const c of R.parentElement.children) if (c.id !== 'rfs' && c.id !== 'rfs-sheet') { window.__qaHid.push([c, c.style.visibility]); c.style.visibility = 'hidden'; }
  window.__qaScope = '#rfs-bpm-picker.on, .ModalPosition, #rfs-sheet.on, .contextMenu';
  const ss = document.querySelector('[class*=ScreensaverContainer]');
  if (ss) { try { const k = Object.keys(ss).find(k => k.startsWith('__reactFiber')); let f = ss[k]; for (let i = 0; i < 9; i++) f = f.return; f.memoizedState.queue.dispatch(false); } catch (e) { /* Steam changed */ } }
  return 1; })()`;
const ZOOM_OFF = `(() => { const o = window.__qaZoomOrig; if (o) { Element.prototype.getBoundingClientRect = o.b; Element.prototype.getClientRects = o.c; Range.prototype.getBoundingClientRect = o.rb; Range.prototype.getClientRects = o.rc; window.__qaZoomOrig = null; }
  for (const [c, v] of window.__qaHid || []) c.style.visibility = v; window.__qaHid = []; return 1; })()`;
export async function checkBpm(outBase) {
  const list = (await targets()).filter(t => t.title === 'Steam Big Picture Mode' && t.webSocketDebuggerUrl);
  let p = null;
  for (const t of list.reverse()) { try { const q = await open(t); if ((await q.evaluate('document.visibilityState', 3000)) === 'visible') { p = q; break; } q.close(); } catch (e) { /* stale */ } }
  if (!p) return null;
  let res;
  try { await p.evaluate(ZOOM_ON); await sleep(400); res = await p.evaluate(CHECK, 60000); }
  finally { try { await p.evaluate(ZOOM_OFF); } catch (e) { /* closed */ } p.close(); }
  if (outBase) {
    writeFileSync(outBase + '.json', JSON.stringify(res, null, 1));
    const ps = `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; Add-Type 'using System.Runtime.InteropServices; public class D { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); }'; [D]::SetProcessDPIAware() | Out-Null; $b=[System.Windows.Forms.SystemInformation]::VirtualScreen; $m=New-Object System.Drawing.Bitmap $b.Width,$b.Height; [System.Drawing.Graphics]::FromImage($m).CopyFromScreen($b.Left,$b.Top,0,0,$m.Size); $m.Save('${path.resolve(outBase + '.png').replace(/'/g, "''")}')`;
    try { execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, { stdio: 'ignore' }); } catch (e) { res.shotError = String(e.message || e).slice(0, 200); }
  }
  return res;
}

if (process.argv[1] && process.argv[1].endsWith('qa-overlap.mjs')) {
  const [mode, a, b] = process.argv.slice(2);
  if (mode === 'list') {
    for (const t of await targets()) if (!/Supernav|Root Menu|^Menu$|Account Menu|Notifications Menu/.test(t.title)) console.log(t.id, '|', t.title, '|', t.url.slice(0, 120));
  } else if (mode === 'check') {
    const p = await find(new RegExp(a), { visibleOnly: false });
    if (!p) { console.log('no target for', a); process.exit(1); }
    const res = await checkPage(p, b);
    console.log(summary(res));
    p.close();
  } else if (mode === 'run') {
    const rest = process.argv.slice(4);
    const onlyArg = rest.find(x => x.startsWith('--only='));
    const only = onlyArg ? onlyArg.slice(7).split(',') : null;
    const all = [];
    for (const st of rest.filter(x => !x.startsWith('--'))) { try { all.push(...await runStyle(a, st, only)); } catch (e) { console.log('!!', st, e.message); } }
    mkdirSync(a, { recursive: true });
    writeFileSync(path.join(a, 'run-' + Date.now() + '.json'), JSON.stringify(all, null, 1));
  } else if (mode === 'bpm') {
    const r = await checkBpm(a);
    console.log(r ? summary(r) : 'no visible Big Picture window');
  } else {
    console.log('usage: node tools/qa-overlap.mjs check <targetRegex> <outBase> | list | bpm <outBase>');
  }
  process.exit(0);
}
