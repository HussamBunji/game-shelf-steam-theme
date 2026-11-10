/* ===================================================================
   رف الألعاب — tint styles: "Steam Original" in another colour  (src/styles/steam-*.css)

   A tint style keeps stock Steam exactly as Valve ships it — same layout, same sizes, same class names —
   and only moves Steam's own blue-grey palette to another hue. To every rule of the theme a tint style IS
   "Steam Original" (html[data-rfs-style="original"]); the palette is named by html[data-rfs-tint="<id>"].

   Stock Steam hard-codes its colours (thousands of rules, hashed class names, almost no custom properties),
   so nothing is restyled by selector here. Instead Steam's OWN style sheets are re-toned:
     • Steam windows (steamloopback.host): each of Steam's sheets (sp.css, library.css …) is fetched once, every
       colour of the blue family is replaced with the palette's tone, and the result is linked in place of the
       original (a blob: URL owned by SharedJSContext, shared by every window; the original <link> is only
       disabled). The cascade is identical because it is the same sheet — only colour tokens differ.
     • Store / community pages: the React bundles' sheets (hashed class names, readable through CORS) are
       re-toned in place through the CSSOM. The legacy sheets (stable class names, not readable) each get their
       generated part from src/css/tint-web/ (tools/tint-web.mjs), linked right after them.
   Nothing here names a Steam class, so a Steam update cannot break it. Nothing runs at rest: no timers, no
   polling — only a childList observer on <head> for sheets Steam adds later.

   The palette comes from the active style file:  --tint-id, --tint-hue, --tint-chroma, --tint-chroma-max,
   --tint-black, --tint-accent-hue, --tint-accent-chroma, --tint-accent-light.

   Loaded by skin.js (Steam windows) and webkit.js (web pages) only while a tint style is active.
   =================================================================== */
(function () {
  'use strict';
  if (window.__rfsTint) { window.__rfsTint.sync(); return; }

  /*CORE-BEGIN — pure colour maths, no DOM (tools/tint-web.mjs evaluates this block too) */
  const Core = (() => {
    const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const gam = x => 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
    /** sRGB 0-255 → OKLCH [L 0-1, C, H deg] */
    function toLch(r, g, b) {
      const R = lin(r), G = lin(g), B = lin(b);
      const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
      const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
      const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
      const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
      const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
      const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
      let H = Math.atan2(Bb, A) * 180 / Math.PI; if (H < 0) H += 360;
      return [L, Math.hypot(A, Bb), H];
    }
    function lchLin(L, C, H) {
      const a = C * Math.cos(H * Math.PI / 180), b = C * Math.sin(H * Math.PI / 180);
      const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
      const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
      const s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
      return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
    }
    /** OKLCH → sRGB 0-255 (chroma is reduced until the colour fits sRGB, lightness and hue are kept) */
    function fromLch(L, C, H) {
      L = Math.min(1, Math.max(0, L));
      const fits = c => lchLin(L, c, H).every(v => v >= -0.0005 && v <= 1.0005);
      if (!fits(C)) { let lo = 0, hi = C; for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; } C = lo; }
      return lchLin(L, C, H).map(v => Math.round(Math.min(255, Math.max(0, gam(Math.min(1, Math.max(0, v)))))));
    }
    const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
    const PIVOT = 0.62;       // lightness above this is never darkened (text stays as bright as in stock Steam)
    const ANCHOR = 250;       // OKLCH hue of Steam's accent blue (#1a9fff)

    /** palette from the style's custom properties: get('--tint-hue') → string */
    function palette(get) {
      const num = (n, d) => { const v = parseFloat(String(get(n) || '').trim()); return isFinite(v) ? v : d; };
      const P = {
        id: String(get('--tint-id') || '').trim().replace(/["']/g, ''),
        hue: num('--tint-hue', 255),               // hue of the neutral surfaces (OKLCH degrees)
        chroma: num('--tint-chroma', 1),           // × Steam's own (faint) chroma: 0 = pure grey
        chromaMax: num('--tint-chroma-max', 0.06), // ceiling, so mid-tones never turn garish
        black: num('--tint-black', 0),             // lightness that becomes pure black (0 = Steam's own depth)
        aHue: num('--tint-accent-hue', ANCHOR),    // hue Steam's accent blue moves to
        aChroma: num('--tint-accent-chroma', 1),
        aLight: num('--tint-accent-light', 1),
      };
      P.key = [P.id, P.hue, P.chroma, P.chromaMax, P.black, P.aHue, P.aChroma, P.aLight].join('_');
      return P;
    }

    /** P → map(r, g, b) → [r, g, b], or null when the colour is not part of Steam's blue family (left alone) */
    function mapper(P) {
      const cache = new Map();
      const dark = L => (L >= PIVOT || !P.black ? L : Math.max(0, (L - P.black) * PIVOT / (PIVOT - P.black)));
      const sameAccent = P.aHue === ANCHOR && P.aChroma === 1 && P.aLight === 1; // the palette keeps Steam's own blue
      function calc(r, g, b) {
        const [L, C, H] = toLch(r, g, b);
        // Steam's blue family: hue 222-292, plus its faint teal-greys (198-222, e.g. the profile header). Greys, whites,
        // every other hue and the vivid teals (friends' "online" colour) stay Valve's
        if (C < 0.007 || H > 292 || H < 198 || (H < 222 && C >= 0.06)) return null;
        // how much of an accent it is: vivid and not too dark → accent; faint or dark → surface
        const wC = clamp01((C - 0.07) / 0.05), wL = clamp01((L - 0.35) / 0.12);
        const w = Math.max(wC * wL, clamp01((C - 0.10) / 0.03));
        // surfaces take the palette's hue and a stronger chroma; light colours (text) keep Steam's own faint chroma
        const k = P.chroma <= 1 || L <= 0.5 ? P.chroma : L >= 0.8 ? 1 : P.chroma + (1 - P.chroma) * (L - 0.5) / 0.3;
        const n = w < 1 ? fromLch(dark(L), Math.min(C * k, Math.max(P.chromaMax, 0)), P.hue) : null;
        const a = w <= 0 ? null : sameAccent ? [r, g, b] : fromLch(L * P.aLight, C * P.aChroma, P.aHue + (H - ANCHOR) * 0.5);
        const out = !a ? n : !n ? a : n.map((v, i) => Math.round(v + (a[i] - v) * w));
        return out[0] === r && out[1] === g && out[2] === b ? null : out;
      }
      return (r, g, b) => {
        const k = (r << 16) | (g << 8) | b;
        let v = cache.get(k);
        if (v === undefined) { v = calc(r, g, b); cache.set(k, v); }
        return v;
      };
    }

    const hex2 = n => (n < 16 ? '0' : '') + n.toString(16);
    // #rgb / #rrggbb(aa) · rgb()/rgba() · hsl()/hsla()  (commas or spaces, optional alpha)
    const TOKEN = /#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z_-])|rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)|hsla?\(\s*(-?[\d.]+)(?:deg)?\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%\s*(?:[,/]\s*([\d.]+%?)\s*)?\)/gi;
    function hslRgb(h, s, l) {
      h = ((h % 360) + 360) % 360; s = Math.min(1, s / 100); l = Math.min(1, l / 100);
      const f = n => { const k = (n + h / 30) % 12; return Math.round(255 * (l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
      return [f(0), f(8), f(4)];
    }
    /** re-tone every colour token of a declaration value / block. onColor(original token, [r,g,b], alpha text) may
        return its own replacement (tools/tint-web.mjs writes var(--twN) there). */
    function retone(text, map, onColor) {
      return text.replace(TOKEN, (tok, hex, r, g, b, a, hh, hs, hl, ha) => {
        let alpha = '';
        if (hex) {
          if (hex.length < 6) hex = hex.replace(/./g, '$&$&');
          r = parseInt(hex.slice(0, 2), 16); g = parseInt(hex.slice(2, 4), 16); b = parseInt(hex.slice(4, 6), 16);
          if (hex.length === 8) alpha = String(Math.round(parseInt(hex.slice(6, 8), 16) / 255 * 1000) / 1000);
        } else if (hh !== undefined) { [r, g, b] = hslRgb(+hh, +hs, +hl); alpha = ha || ''; }
        else { r = Math.round(+r); g = Math.round(+g); b = Math.round(+b); alpha = a || ''; }
        if (r > 255 || g > 255 || b > 255) return tok;
        const out = map(r, g, b);
        if (!out) return tok;
        if (onColor) return onColor(tok, [r, g, b], alpha, out);
        return alpha && alpha !== '1' ? `rgba(${out[0]}, ${out[1]}, ${out[2]}, ${alpha})` : '#' + hex2(out[0]) + hex2(out[1]) + hex2(out[2]);
      });
    }
    /** a whole style sheet as text: only declaration blocks are touched, never selectors (an id like #bed is not a colour) */
    function retoneSheet(css, map) {
      return css.replace(/\{([^{}]*)\}/g, (m, body) => (body.indexOf('#') < 0 && body.indexOf('rgb') < 0 && body.indexOf('hsl') < 0 ? m : '{' + retone(body, map) + '}'));
    }
    return { toLch, fromLch, palette, mapper, retone, retoneSheet };
  })();
  /*CORE-END*/

  const html = document.documentElement;
  const CLIENT = /(^|\.)steamloopback\.host$/.test(location.hostname);
  // SharedJSContext outlives every Steam window: the re-toned sheets live there and are shared by all of them
  const ctx = (() => { try { if (CLIENT && window.opener && window.opener.MILLENNIUM_API && window.opener.URL) return window.opener; } catch (e) { /* cross-origin */ } return window; })();
  const me = document.currentScript || document.querySelector('script[src*="/src/js/tint.js"]');
  const BASE = me && me.src ? me.src.replace(/src\/js\/tint\.js.*$/, '') : 'https://millennium.host/v1/themes/rf-shelf/';

  let P = null;          // active palette (null = no tint style)
  let map = null;

  /* =================================================================
     Steam windows — swap each of Steam's sheets for its re-toned copy
     ================================================================= */
  const store = ctx.__rfsTintStore || (ctx.__rfsTintStore = { blobs: {}, order: [] });
  /** url(/images/x.png) would resolve against the blob: URL — make every relative url() absolute first */
  function rebase(css, href) {
    return css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (m, q, u) => {
      if (/^(data:|blob:|https?:|#|about:)/i.test(u)) return m;
      try { return `url(${q}${new URL(u, href).href}${q})`; } catch (e) { return m; }
    });
  }
  /** the "barely there" button polish, written into Steam's own dialog-button rules so its special cases (split
      buttons, square list buttons) still win exactly as before: a 3px corner instead of 2px, and the hover colour
      fades both ways instead of snapping back */
  function polish(css) {
    return css.replace(/([^{}]*\.DialogButton[^{}]*)\{([^{}]*)\}/g, (m, sel, body) => {
      const b = body.replace(/(^|;)\s*border-radius\s*:\s*2px\s*(?=;|$)/, '$1border-radius:3px').replace(/(^|;)\s*transition\s*:\s*none\s*(?=;|$)/, '$1transition:background-color .12s ease-out,color .12s ease-out');
      return b === body ? m : sel + '{' + b + '}';
    });
  }
  function tonedUrl(href) {
    const key = P.key + '|' + href;
    if (!store.blobs[key]) {
      const pal = P, m = map;
      store.blobs[key] = ctx.fetch(href, { cache: 'force-cache' }).then(r => (r.ok ? r.text() : Promise.reject(new Error('http ' + r.status)))).then(css => {
        const url = ctx.URL.createObjectURL(new ctx.Blob([polish(Core.retoneSheet(rebase(css, href), m))], { type: 'text/css' }));
        store.order.push([pal.key, key, url]);
        // copies made for a palette that is no longer in use are dropped (after every window had time to switch)
        ctx.setTimeout(() => {
          const cur = ctx.__rfsTintStore.current;
          store.order = store.order.filter(([pk, k, u]) => { if (pk === cur) return true; try { ctx.URL.revokeObjectURL(u); } catch (e) { /* gone */ } delete store.blobs[k]; return false; });
        }, 30000);
        return url;
      });
      store.blobs[key].catch(() => { delete store.blobs[key]; });
    }
    return store.blobs[key];
  }
  const swapped = new Map(); // Steam's <link> → { key, clone }
  const steamLinks = () => [...document.querySelectorAll('link[rel~="stylesheet"][href]')].filter(l => {
    if (l.dataset.rfsTint) return false;
    try { const u = new URL(l.href); return u.origin === location.origin && /\.css$/i.test(u.pathname) && !/\/src\/(styles|css|lang|layouts)\//.test(u.pathname); } catch (e) { return false; }
  });
  function unswap(link) {
    const s = swapped.get(link);
    if (!s) return;
    swapped.delete(link);
    link.disabled = false;
    if (s.clone) s.clone.remove();
    if (s.next) s.next.remove();
  }
  function syncClient() {
    // a window whose <head> was copied from an already tinted one: copies that are not ours go, Steam's sheets come back on
    const ours = new Set();
    for (const s of swapped.values()) { if (s.clone) ours.add(s.clone); if (s.next) ours.add(s.next); }
    for (const l of document.querySelectorAll('link[data-rfs-tint]')) if (!/^(ui|part|cors)$/.test(l.dataset.rfsTint) && !ours.has(l)) l.remove();
    for (const l of steamLinks()) if (l.disabled && !swapped.has(l)) l.disabled = false;
    if (!P) { for (const l of [...swapped.keys()]) unswap(l); return; }
    store.current = P.key;
    for (const l of [...swapped.keys()]) if (!l.isConnected) { const s = swapped.get(l); swapped.delete(l); if (s.clone) s.clone.remove(); }
    for (const link of steamLinks()) {
      const had = swapped.get(link);
      if (had && had.key === P.key) continue;
      const key = P.key, state = { key, clone: had ? had.clone : null };
      swapped.set(link, state);
      tonedUrl(link.href).then(url => {
        if (swapped.get(link) !== state || !link.isConnected) return; // palette changed / tint switched off meanwhile
        const nl = document.createElement('link');
        nl.rel = 'stylesheet'; nl.href = url; nl.dataset.rfsTint = key;
        // Steam's own sheet stays in the page and is only switched off once the copy is in: never an unstyled frame
        nl.onload = () => {
          state.next = null;
          if (swapped.get(link) !== state) { nl.remove(); return; }
          const old = state.clone; state.clone = nl;
          link.disabled = true;
          if (old && old !== nl) old.remove();
        };
        nl.onerror = () => { state.next = null; nl.remove(); if (swapped.get(link) === state && !state.clone) { swapped.delete(link); link.disabled = false; } };
        state.next = nl;
        (state.clone || link).after(nl);
      }).catch(() => { if (swapped.get(link) === state && !state.clone) swapped.delete(link); });
    }
  }

  /* =================================================================
     Store / community pages
       • legacy sheets (stable class names, not readable): the matching part of src/css/tint-web/ is linked right
         after each one — same selectors, same weight, later in the page, so only the colours change;
       • React sheets (hashed class names, readable through CORS): re-toned in place.
     ================================================================= */
  /*PARTS-BEGIN — GENERATED by tools/tint-web.mjs: Valve's sheets that have a part in src/css/tint-web/ */
  const PARTS = new Set(["checkout/public/css/styles_storev5.css","checkout/public/shared/css/buttons.css","checkout/public/shared/css/login.css","checkout/public/shared/css/shared_global.css","checkout/public/shared/css/shared_responsive.css","community/public/css/globalv2.css","community/public/css/skin_1/apphub_guides.css","community/public/css/skin_1/apphub_home.css","community/public/css/skin_1/apphub_workshop.css","community/public/css/skin_1/apphubs.css","community/public/css/skin_1/calendar.css","community/public/css/skin_1/communityhome.css","community/public/css/skin_1/discussions.css","community/public/css/skin_1/economy.css","community/public/css/skin_1/economy_market.css","community/public/css/skin_1/forums.css","community/public/css/skin_1/groupv2.css","community/public/css/skin_1/header.css","community/public/css/skin_1/modalContent.css","community/public/css/skin_1/profilev2.css","community/public/css/skin_1/search.css","community/public/css/skin_1/workshop.css","community/public/css/skin_1/workshop_browse_menu.css","community/public/css/skin_1/workshop_home.css","community/public/shared/css/apphub.css","community/public/shared/css/buttons.css","community/public/shared/css/login.css","community/public/shared/css/shared_global.css","community/public/shared/css/shared_responsive.css","help/public/css/help.css","help/public/shared/css/buttons.css","help/public/shared/css/shared_global.css","help/public/shared/css/shared_responsive.css","help/public/shared/css/store_game_shared.css","store/public/css/home.css","store/public/css/labs.css","store/public/css/promo/autumn2024_nominations.css","store/public/css/promo/newstore2016.css","store/public/css/promo/styles_reviews.css","store/public/css/promo/winter2020_steamawards.css","store/public/css/promo/winter2022_steamawards.css","store/public/css/styles_about.css","store/public/css/styles_storev5.css","store/public/css/v6/browse.css","store/public/css/v6/curator_recommendations.css","store/public/css/v6/curators_common.css","store/public/css/v6/curators_home.css","store/public/css/v6/game.css","store/public/css/v6/game_mob.css","store/public/css/v6/promo/sale_n_section.css","store/public/css/v6/recommended.css","store/public/css/v6/sale.css","store/public/css/v6/search.css","store/public/css/v6/store.css","store/public/css/v6/tags.css","store/public/css/v6/user_reviews_rewards.css","store/public/shared/css/apphub.css","store/public/shared/css/buttons.css","store/public/shared/css/login.css","store/public/shared/css/shared_global.css","store/public/shared/css/shared_responsive.css","store/public/shared/css/store_background_shared.css","store/public/shared/css/store_game_shared.css","store/public/shared/css/user_reviews.css"]);
  /*PARTS-END*/
  const parts = new Map(); // Valve's <link> → our part
  function syncParts() {
    for (const [l, p] of parts) if (!P || !l.isConnected) { p.remove(); parts.delete(l); }
    if (!P) return;
    for (const l of document.querySelectorAll('link[rel~="stylesheet"][href]')) {
      if (parts.has(l) || l.dataset.rfsTint) continue;
      let key = '';
      try { const u = new URL(l.href); key = u.hostname.split('.')[0] + u.pathname; } catch (e) { continue; }
      if (!PARTS.has(key)) continue;
      const p = document.createElement('link');
      p.rel = 'stylesheet'; p.href = BASE + 'src/css/tint-web/' + key.replace(/[^\w.-]+/g, '__'); p.dataset.rfsTint = 'part';
      if (l.media) p.media = l.media;
      parts.set(l, p);
      l.after(p);
    }
  }
  const done = new WeakMap();   // CSSStyleSheet → { key: palette, list: [[rule style, its original declarations], …] }
  const asked = new WeakSet();  // <link>s we already re-requested with CORS
  const OURS = /millennium\.host|fonts\.googleapis|fonts\.gstatic/;
  /** the colours of every rule, re-toned. A rule's declaration block is read once (cssText) and — only when a colour
      of the family is in it — written back once. That covers a shorthand written with var()
      ("background: var(--x, #1b2838)", which has no readable longhands) and costs one string per rule. */
  function toneRules(rules, rec) {
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i], st = r.style;
      if (st && r.type !== 5 /* @font-face */) {
        const txt = st.cssText;
        if (txt.indexOf('rgb') >= 0 || txt.indexOf('#') >= 0 || txt.indexOf('hsl') >= 0) {
          const nt = Core.retone(txt, map);
          if (nt !== txt) { rec.push([st, txt]); st.cssText = nt; }
        }
      }
      if (r.cssRules && r.cssRules.length) toneRules(r.cssRules, rec); // groups (@media, @layer …) and nested rules
    }
  }
  function untone(sheet) {
    const rec = done.get(sheet);
    if (!rec) return;
    for (const [st, txt] of rec.list) { try { st.cssText = txt; } catch (e) { /* rule gone */ } }
    done.delete(sheet);
  }
  function toneSheet(sheet) {
    const had = done.get(sheet);
    if (had && P && had.key === P.key) return;
    if (had) untone(sheet);
    if (!P) return;
    let rules;
    try { rules = sheet.cssRules; } catch (e) { return void corsCopy(sheet.ownerNode); }
    const rec = { key: P.key, list: [] };
    done.set(sheet, rec);
    try { toneRules(rules, rec.list); } catch (e) { /* keep what was done */ }
  }
  /** a React bundle sheet linked without CORS (…/applications/…/main.css): the CDN allows CORS for these, so ask
      for it again as a CORS sheet (from the HTTP cache), re-tone that one and switch the unreadable one off */
  function corsCopy(link) {
    if (!link || link.tagName !== 'LINK' || asked.has(link) || !/\/applications\/[^?]*\.css/i.test(link.href || '')) return;
    asked.add(link);
    const nl = document.createElement('link');
    nl.rel = 'stylesheet'; nl.crossOrigin = 'anonymous'; nl.href = link.href; nl.dataset.rfsTint = 'cors';
    if (link.media) nl.media = link.media;
    nl.onload = () => { link.disabled = true; if (nl.sheet) toneSheet(nl.sheet); };
    nl.onerror = () => nl.remove();
    link.after(nl);
  }
  /** the React store writes its page colour on <html style="--store-body-background:#0f1924">: the two root
      elements' own style attributes are re-toned too (never the page's content) */
  const inline = new Map(); // element → { key, orig, toned }
  function toneInline(el) {
    if (!el) return;
    const had = inline.get(el);
    if (had) {
      if (el.style.cssText !== had.toned) inline.delete(el);          // the page rewrote it: start again from that
      else if (P && had.key === P.key) return;
      else { el.style.cssText = had.orig; inline.delete(el); }
    }
    const orig = el.style.cssText;
    if (!P || !orig || (orig.indexOf('#') < 0 && orig.indexOf('rgb') < 0 && orig.indexOf('hsl') < 0)) return;
    const toned = Core.retone(orig, map);
    if (toned === orig) return;
    el.style.cssText = toned;
    inline.set(el, { key: P.key, orig, toned: el.style.cssText });
  }
  function syncWeb() {
    syncParts();
    for (const sheet of document.styleSheets) {
      const node = sheet.ownerNode;
      if (!node || sheet.disabled) continue;
      if (node.tagName === 'LINK' ? OURS.test(node.href || '') || node.dataset.rfsTint === 'part' : /^(rfs-|Millennium)/.test(node.id || '')) continue;
      toneSheet(sheet);
    }
    toneInline(html); toneInline(document.body);
  }

  /* =================================================================
     which palette is on + when to look again
     ================================================================= */
  function sync() {
    const cs = getComputedStyle(html);
    const pal = Core.palette(n => cs.getPropertyValue(n));
    const on = !!pal.id;
    if (on && (!P || P.key !== pal.key)) { P = pal; map = Core.mapper(P); }
    else if (!on) { P = null; map = null; }
    if (CLIENT) {
      // the same attribute webkit.js sets on store pages: shared rules are written html[data-rfs-tint] …
      if ((html.dataset.rfsTint || '') !== (on ? pal.id : '')) { if (on) html.dataset.rfsTint = pal.id; else delete html.dataset.rfsTint; }
      let css = document.getElementById('rfs-tint-css');
      if (on && !css && document.head) { css = document.createElement('link'); css.id = 'rfs-tint-css'; css.rel = 'stylesheet'; css.href = BASE + 'src/css/tint.css'; css.dataset.rfsTint = 'ui'; document.head.appendChild(css); }
      syncClient();
    } else syncWeb();
  }
  let queued = false;
  const later = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; sync(); }); };
  // Steam / the store add style sheets after start-up (popups get theirs a moment after they open; webpack adds a
  // sheet per lazy chunk): one observer on <head>'s own children — it does not see the page's content at all
  function watch() {
    if (!document.head) return void setTimeout(watch, 50);
    new MutationObserver(list => {
      for (const m of list) for (const n of m.addedNodes) {
        if (n.nodeType !== 1 || (n.dataset && n.dataset.rfsTint)) continue;
        if (n.tagName === 'LINK' && /stylesheet/i.test(n.rel || '')) { if (n.sheet) later(); else n.addEventListener('load', later, { once: true }); }
        else if (n.tagName === 'STYLE') later();
      }
    }).observe(document.head, { childList: true });
    sync();
    // the style's own sheet (the palette) may still be arriving in a window that just opened
    [300, 1000, 2500, 6000].forEach(ms => setTimeout(sync, ms));
    if (document.readyState !== 'complete') addEventListener('load', sync, { once: true });
  }
  window.__rfsTint = { sync, Core, get palette() { return P; } };
  watch();
})();
