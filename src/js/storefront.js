/* ═══ Slate store front (store.steampowered.com/ home page only) ═══
   Built from docs/mockup/Store front page@1x.png: a featured hero with a five-game side list, Special offers,
   Coming soon and More featured, plus a "Games you own: Show · Dim · Hide" switch.
   Loaded by webkit.js only while Slate is the style and the page is the store's home; styled by src/css/storefront.css.
   Data comes from Steam itself, never from a third party:
     · the home page's own "Featured & Recommended" carousel (its games and Steam's reason for each)
     · /dynamicstore/userdata (what you own, your wishlist, "not interested", Steam's picks for you)
     · /api/featuredcategories (today's specials) and /search/results?json=1 (top sellers, new, free, upcoming)
     · IStoreBrowseService/GetItems (names, SAR prices, discounts and end dates, reviews, art, tags, release dates)
   Steam's native home page stays in the page, hidden; "Show Steam's full store page" at the bottom brings it back. */
(function () {
  'use strict';
  if (window.__slateFront) return;
  window.__slateFront = true;
  const html = document.documentElement;
  const AR = html.getAttribute('data-rfs-lang') === 'ar';
  const T = (ar, en) => (AR ? ar : en);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CC = (() => { try { return JSON.parse(document.getElementById('application_config').dataset.config).COUNTRY || 'SA'; } catch (e) { return 'SA'; } })();
  const ASSET = 'https://shared.akamai.steamstatic.com/store_item_assets/';
  const FAMILY = getComputedStyle(html).getPropertyValue('--rf-family').trim() !== 'off';
  const ADULT = new Set([3, 4]);

  /* ---------- small helpers ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('sf.' + k); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('sf.' + k, v); } catch (e) { /* ignore */ } },
  };
  const money = cents => (cents == null ? '' : (Number(cents) / 100).toFixed(2) + ' ' + T('ر.س', 'SAR'));
  const plain = cents => (cents == null ? '' : (Number(cents) / 100).toFixed(2)); // the crossed-out old price: the new one beside it carries the currency
  const DAY = 86400;
  const weekday = t => new Date(t * 1000).toLocaleDateString(AR ? 'ar' : 'en', { weekday: 'short' });
  const shortDate = t => new Date(t * 1000).toLocaleDateString(AR ? 'ar' : 'en', { month: 'short', day: 'numeric' });
  const endsText = t => {
    if (!t) return '';
    const left = t - Date.now() / 1000;
    if (left <= 0) return '';
    return left < 6 * DAY ? T(`ينتهي ${weekday(t)}`, `Ends ${weekday(t)}`) : T(`ينتهي ${shortDate(t)}`, `Ends ${shortDate(t)}`);
  };
  const leftText = t => {
    const s = Math.max(0, t - Date.now() / 1000), d = Math.floor(s / DAY), h = Math.floor(s % DAY / 3600);
    return d ? T(`${d}ي ${h}س`, `${d}d ${h}h`) : T(`${h}س`, `${h}h`);
  };
  const appUrl = id => `https://store.steampowered.com/app/${id}/`;
  const icon = {
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 0 1 19.4 13z"/></svg>',
  };

  /* ---------- data ---------- */
  let user = { owned: new Set(), wish: new Set(), ignored: 0, picks: [] };
  async function loadUser() {
    try {
      const u = await (await fetch('/dynamicstore/userdata/', { credentials: 'include' })).json();
      const ign = u.rgIgnoredApps;
      user = {
        owned: new Set(u.rgOwnedApps || []),
        wish: new Set(u.rgWishlist || []),
        ignored: Array.isArray(ign) ? ign.length : Object.keys(ign || {}).length,
        picks: u.rgRecommendedApps || [],
      };
    } catch (e) { /* signed out: everything still works, nothing is marked */ }
  }
  /* GetItems, cached per game for 15 minutes in this tab (sessionStorage) */
  const ITEMS = new Map();
  const CACHE_MS = 15 * 60 * 1000;
  try { const c = JSON.parse(sessionStorage.getItem('sf.items2') || '{}'); if (Date.now() - (c.t || 0) < CACHE_MS) for (const [k, v] of Object.entries(c.m || {})) ITEMS.set(+k, v); } catch (e) { /* ignore */ }
  const saveItems = () => { try { sessionStorage.setItem('sf.items2', JSON.stringify({ t: Date.now(), m: Object.fromEntries(ITEMS) })); } catch (e) { /* full: skip */ } };
  async function items(ids) {
    ids = [...new Set(ids.map(Number).filter(Boolean))];
    const need = ids.filter(id => !ITEMS.has(id));
    for (let i = 0; i < need.length; i += 50) {
      const input = {
        ids: need.slice(i, i + 50).map(appid => ({ appid })),
        context: { language: AR ? 'arabic' : 'english', country_code: CC },
        data_request: { include_reviews: true, include_release: true, include_assets: true, include_tag_count: 4, include_ratings: true },
      };
      try {
        const r = await (await fetch('https://api.steampowered.com/IStoreBrowseService/GetItems/v1?input_json=' + encodeURIComponent(JSON.stringify(input)))).json();
        for (const x of (r.response && r.response.store_items) || []) {
          if (!x || x.success !== 1 || !x.visible) continue;
          const b = x.best_purchase_option || {};
          const a = x.assets || {}, fmt = a.asset_url_format || '';
          const art = f => (f && fmt ? ASSET + fmt.replace('${FILENAME}', f) : '');
          const rel = x.release || {};
          ITEMS.set(x.appid, {
            id: x.appid, name: x.name, free: !!x.is_free, early: !!(x.is_early_access || rel.is_early_access),
            adult: (x.content_descriptorids || []).some(d => ADULT.has(+d)),
            review: (x.reviews && x.reviews.summary_filtered && x.reviews.summary_filtered.review_score_label) || '',
            tags: x.tagids || [],
            price: b.final_price_in_cents != null ? +b.final_price_in_cents : null,
            was: b.original_price_in_cents != null ? +b.original_price_in_cents : null,
            pct: b.discount_pct || 0,
            ends: (b.active_discounts && b.active_discounts[0] && b.active_discounts[0].discount_end_date) || 0,
            release: rel.steam_release_date || 0, comingSoon: !!rel.is_coming_soon, releaseText: rel.custom_release_date_message || '',
            releaseKind: rel.coming_soon_display || (rel.steam_release_date ? 'date_full' : 'text_tba'),
            preorder: !!(rel.is_coming_soon && b.packageid),
            cap: art(a.main_capsule), hero: art(a.library_hero) || art(a.page_background) || art(a.main_capsule_2x),
            port: art(a.library_capsule_2x) || art(a.library_capsule), head: art(a.header),
          });
        }
      } catch (e) { /* offline or blocked: those games just don't show */ }
    }
    saveItems();
    return ids.map(id => ITEMS.get(id)).filter(g => g && !(FAMILY && g.adult));
  }
  let TAGS = null;
  async function tagNames() {
    if (TAGS) return TAGS;
    TAGS = new Map();
    try { for (const t of await (await fetch(`/tagdata/populartags/${AR ? 'arabic' : 'english'}`)).json()) TAGS.set(t.tagid, t.name); } catch (e) { /* no tag names */ }
    return TAGS;
  }
  const tagList = (g, n) => g.tags.slice(0, n).map(id => TAGS && TAGS.get(id)).filter(Boolean);
  async function searchIds(params, n) {
    try {
      const r = await (await fetch(`/search/results/?json=1&count=${n}&cc=${CC}&${params}`, { credentials: 'include' })).json();
      return (r.items || []).map(it => +((it.logo || '').match(/\/apps\/(\d+)\//) || [])[1]).filter(Boolean);
    } catch (e) { return []; }
  }
  async function specialIds() {
    try { const r = await (await fetch(`/api/featuredcategories?cc=${CC}&l=english`)).json(); return ((r.specials && r.specials.items) || []).map(i => i.id); } catch (e) { return []; }
  }
  /* the home page's own Featured & Recommended carousel: its games, in order, and Steam's reason for each */
  function featuredFromPage() {
    const box = document.getElementById('home_maincap_v7');
    const out = new Map();
    if (!box) return [];
    for (const a of box.querySelectorAll('a[href*="/app/"]')) {
      const m = a.href.match(/\/app\/(\d+)/); if (!m || out.has(+m[1])) continue;
      const text = a.innerText || a.textContent || '';
      let reason = '', short = '';
      const rec = text.match(/Recommended because you played[^\n]*\n?([^\n]*)/i);
      if (rec) {
        const tagsLine = [...a.querySelectorAll('*')].filter(e => e.childElementCount === 0 && e.closest('a') === a)
          .map(e => e.textContent.trim()).filter(t => t && t.length < 30 && !/review|recommended|seller|ranked|%|SR|SAR|free/i.test(t));
        const tags = tagsLine.slice(-3);
        reason = T('مقترحة لأنك لعبت ألعابًا من نوع ', 'Recommended because you played games tagged with ') + tags.join(', ');
        short = tags[0] || T('مقترحة لك', 'Recommended');
      } else if (/Top Seller/i.test(text)) { reason = T('من الأكثر مبيعًا', 'Top seller'); short = reason; }
      else if (/\bLive\b/.test(text)) { reason = T('بث مباشر الحين', 'Live now'); short = reason; }
      else if (/Free to Play/i.test(text)) { reason = T('مجانية', 'Free to play'); short = reason; }
      else { reason = T('مميزة', 'Featured'); short = reason; }
      out.set(+m[1], { reason, short });
    }
    return [...out].map(([id, r]) => ({ id, ...r }));
  }

  /* ---------- wishlist (Steam's own store endpoints, only when you click) ---------- */
  async function setWish(id, on) {
    const body = new URLSearchParams({ sessionid: window.g_sessionID || '', appid: String(id) });
    try {
      const r = await (await fetch(on ? '/api/addtowishlist' : '/api/removefromwishlist', { method: 'POST', credentials: 'include', body })).json();
      if (r && r.success) { if (on) user.wish.add(id); else user.wish.delete(id); return true; }
    } catch (e) { /* fall through */ }
    return false;
  }

  /* ---------- view ---------- */
  const root = document.createElement('div');
  root.id = 'sl-front';
  const state = { hero: [], heroAt: 0, deals: 'all', soon: 'you', more: 'you', lists: {} };
  const ownedMode = () => store.get('owned', 'dim'); // show | dim | hide
  const isOwned = g => user.owned.has(g.id);
  const keep = list => (ownedMode() === 'hide' ? list.filter(g => !isOwned(g)) : list);
  const cls = g => (isOwned(g) && ownedMode() === 'dim' ? ' is-owned' : '');
  const heart = g => (user.wish.has(g.id) ? `<i class="sf-heart" title="${esc(T('في قائمة أمنياتك', 'On your wishlist'))}">${icon.heart}</i>` : '');
  const ownTag = g => (isOwned(g) ? `<span class="sf-own">${esc(T('في مكتبتك', 'In library'))}</span>` : '');
  const priceHTML = g => {
    if (g.free) return `<b class="sf-price">${esc(T('مجانية', 'Free to play'))}</b>`;
    if (g.price == null) return '';
    return (g.pct && g.was ? `<s>${esc(plain(g.was))}</s>` : '') + `<b class="sf-price">${esc(money(g.price))}</b>`;
  };
  const chips = (key, opts) => opts.map(([v, label]) => `<button type="button" class="sf-chip${state[key] === v ? ' on' : ''}" data-chip="${key}" data-v="${v}">${esc(label)}</button>`).join('');

  function topHTML() {
    const m = ownedMode();
    const seg = [['show', T('إظهار', 'Show')], ['dim', T('تعتيم', 'Dim')], ['hide', T('إخفاء', 'Hide')]]
      .map(([v, l]) => `<button type="button" data-owned="${v}"${m === v ? ' class="on"' : ''}>${esc(l)}</button>`).join('');
    return `<div class="sf-top">
        <span class="sf-crumb">${esc(T('الرئيسية', 'Store home'))}</span>
        <div class="sf-own-ctl"><span>${esc(T('الألعاب اللي تملكها', 'Games you own'))}</span><div class="sf-seg">${seg}</div>
          <a class="sf-link" href="https://store.steampowered.com/account/notinterested/">${esc(T(`غير مهتم (${user.ignored})`, `Not interested (${user.ignored})`))}</a></div>
      </div>`;
  }
  function heroHTML() {
    const list = state.hero;
    if (!list.length) return '';
    const g = list[state.heroAt] || list[0];
    const tags = tagList(g, 3).map(t => `<span>${esc(t)}</span>`).join('');
    const buy = g.free ? `<b class="sf-hprice">${esc(T('مجانية', 'Free to play'))}</b>`
      : g.price == null ? '' : (g.pct ? `<span class="sf-pct">-${g.pct}%</span><s>${esc(money(g.was))}</s>` : '') + `<b class="sf-hprice">${esc(money(g.price))}</b>`;
    const wished = user.wish.has(g.id), owned = isOwned(g);
    return `<section class="sf-hero">
        <div class="sf-hmain" data-href="${appUrl(g.id)}" style="--art:url('${esc(g.hero)}')">
          <div class="sf-hbody">
            <div class="sf-kicker">${esc(T('مميزة ومقترحة', 'Featured & recommended'))}</div>
            <h2 dir="auto">${esc(g.name)}</h2>
            <p>${esc(g.reason || '')}</p>
            <div class="sf-tags">${tags}</div>
            <div class="sf-buy">${buy}<a class="sf-btn play" href="${appUrl(g.id)}">${esc(owned ? T('في مكتبتك · اعرضها', 'In library · View') : T('اعرض اللعبة', 'View game'))}</a></div>
            ${owned ? '' : `<button type="button" class="sf-btn ghost" data-wish="${g.id}">${wished ? icon.heart + esc(T('في قائمة أمنياتك', 'On your wishlist')) : esc(T('أضف لقائمة الأمنيات', 'Add to wishlist'))}</button>`}
          </div>
        </div>
        <div class="sf-hlist">${list.map((x, i) => `<button type="button" class="sf-hitem${i === state.heroAt ? ' on' : ''}" data-hero="${i}" title="${esc(x.name)}">
            <img src="${esc(x.cap)}" alt="" loading="lazy"><span><b dir="auto">${esc(x.name)}</b><small>${esc(x.short || '')}</small></span></button>`).join('')}</div>
      </section>`;
  }
  function headHTML(title, chipKey, opts, meta, link) {
    return `<div class="sf-head"><h3>${esc(title)}</h3>${chipKey ? chips(chipKey, opts) : ''}${meta ? `<span class="sf-meta">${esc(meta)}</span>` : ''}${link ? `<a class="sf-link sf-end" href="${esc(link[0])}">${esc(link[1])}</a>` : ''}</div>`;
  }
  function dealsHTML() {
    const list = keep(state.lists['deals.' + state.deals] || []);
    const soon = list.map(g => g.ends).filter(Boolean).sort((a, b) => a - b)[0];
    const meta = soon ? T(`أقرب عرض ينتهي بعد ${leftText(soon)}`, `Next deal ends in ${leftText(soon)}`) : '';
    const cards = list.map(g => `<a class="sf-deal${cls(g)}" href="${appUrl(g.id)}">
        <div class="sf-art"><img src="${esc(g.cap)}" alt="" loading="lazy">${g.pct ? `<span class="sf-pct">-${g.pct}%</span>` : ''}${ownTag(g)}</div>
        <div class="sf-body"><b class="sf-name" dir="auto" title="${esc(g.name)}">${heart(g)}${esc(g.name)}</b><small>${esc(g.review)}</small>
          <div class="sf-prow">${priceHTML(g)}<small class="sf-ends">${esc(endsText(g.ends))}</small></div></div></a>`).join('');
    return `<section class="sf-sec">${headHTML(T('عروض خاصة', 'Special offers'), 'deals', [['all', T('كل العروض', 'All deals')], ['wish', T('من قائمة أمنياتك', 'On your wishlist')]], meta, ['https://store.steampowered.com/specials', T('كل العروض', 'See all deals')])}
        <div class="sf-grid sf-deals">${cards || `<p class="sf-empty">${esc(state.deals === 'wish' ? T('ما فيه خصومات على قائمة أمنياتك الحين', 'Nothing on your wishlist is on sale right now') : T('ما فيه عروض الحين', 'No deals right now'))}</p>`}</div></section>`;
  }
  /* the date block says only as much as Steam knows: a day, a month, a quarter, a year, or "TBA" */
  function dateBlock(g) {
    const d = g.release ? new Date(g.release * 1000) : null;
    const month = d && d.toLocaleDateString(AR ? 'ar' : 'en', { month: 'short' });
    let top = '', big = '', wide = false;
    switch (d ? g.releaseKind : 'text') {
      case 'date_full': top = month; big = String(d.getDate()); break;
      case 'date_month': top = String(d.getFullYear()); big = month; wide = true; break;
      case 'date_quarter': top = String(d.getFullYear()); big = 'Q' + (Math.floor(d.getMonth() / 3) + 1); wide = true; break;
      case 'date_year': top = T('سنة', 'Year'); big = String(d.getFullYear()); wide = true; break;
      default: top = T('الموعد', 'Date'); big = /soon/i.test(g.releaseText) ? T('قريبًا', 'Soon') : T('لاحقًا', 'TBA'); wide = true;
    }
    return `<span class="sf-date${wide ? ' wide' : ''}"><small>${esc(top)}</small><b>${esc(big)}</b></span>`;
  }
  function soonHTML() {
    const list = keep(state.lists['soon.' + state.soon] || []).slice(0, 4);
    const cal = (document.querySelector('.personal_calendar_ctn a[href*="calendar"], .personal_calendar_ctn a[href*="upcoming"]') || {}).href || 'https://store.steampowered.com/explore/upcoming/';
    const cards = list.map(g => {
      const why = [user.wish.has(g.id) ? T('في قائمة أمنياتك', 'On your wishlist') : '', g.preorder ? T('الطلب المسبق متاح', 'Pre-order available') : ''].filter(Boolean).join(' · ');
      const on = user.wish.has(g.id);
      return `<div class="sf-soon${cls(g)}"><img class="sf-sbg" src="${esc(g.head || g.cap)}" alt="" loading="lazy">${dateBlock(g)}
          <a class="sf-sbody" href="${appUrl(g.id)}" title="${esc(g.name)}"><b dir="auto">${esc(g.name)}</b><small>${esc(tagList(g, 2).join(' · '))}</small>${why ? `<small class="sf-why">${esc(why)}</small>` : ''}</a>
          ${isOwned(g) ? '' : `<button type="button" class="sf-wish${on ? ' on' : ''}" data-wish="${g.id}" title="${esc(on ? T('شيل من قائمة الأمنيات', 'Remove from wishlist') : T('أضف لقائمة الأمنيات', 'Add to wishlist'))}">${icon.heart}</button>`}</div>`;
    }).join('');
    return `<section class="sf-sec">${headHTML(T('قريبًا', 'Coming soon'), 'soon', [['you', T('لك · من قائمة أمنياتك', 'For you · your wishlist')], ['popular', T('القادمة الأشهر', 'Popular upcoming')]], state.soon === 'you' ? T('أقرب مواعيد الإصدار', 'Soonest release dates first') : '', [cal, T('افتح تقويم الإصدارات', 'Open release calendar')])}
        <div class="sf-grid sf-soons">${cards || `<p class="sf-empty">${esc(T('ما فيه ألعاب قادمة في قائمة أمنياتك', 'No upcoming games on your wishlist'))}</p>`}</div></section>`;
  }
  function moreHTML() {
    const list = keep(state.lists['more.' + state.more] || []).slice(0, 14);
    const cards = list.map(g => `<a class="sf-cap${cls(g)}" href="${appUrl(g.id)}">
        <div class="sf-art"><img src="${esc(g.port || g.cap)}" alt="" loading="lazy">${ownTag(g)}</div>
        <div class="sf-body"><b class="sf-name" dir="auto" title="${esc(g.name)}">${heart(g)}${esc(g.name)}</b><small class="sf-rev">${esc(g.review)}</small>
          <div class="sf-prow">${g.pct && !g.free ? `<span class="sf-pct sm">-${g.pct}%</span>` : ''}${g.free ? `<b class="sf-price">${esc(T('مجانية', 'Free to play'))}</b>` : g.price != null ? `<b class="sf-price">${esc(money(g.price))}</b>` : ''}</div></div></a>`).join('');
    return `<section class="sf-sec">${headHTML(T('مزيد من المميز', 'More featured'), 'more', [['you', T('لك', 'For you')], ['top', T('الأكثر مبيعًا', 'Top sellers')], ['new', T('جديد ورائج', 'New & trending')], ['free', T('مجانية', 'Free to play')]], '', null)}
        <div class="sf-grid sf-caps">${cards || '<p class="sf-empty">…</p>'}</div></section>`;
  }
  function render() {
    root.innerHTML = topHTML() + heroHTML() + dealsHTML() + soonHTML() + moreHTML()
      + `<div class="sf-foot"><button type="button" class="sf-link" data-native="1">${esc(T('اعرض صفحة المتجر الكاملة من Steam', 'Show Steam\'s full store page'))}</button></div>`;
  }
  function paintSection(sel, fn) {
    const old = root.querySelector(sel); if (!old) { render(); return; }
    const t = document.createElement('div'); t.innerHTML = fn(); old.replaceWith(t.firstElementChild);
  }

  /* ---------- lists (each tab loads once, when first shown) ---------- */
  const LOADERS = {
    'deals.all': async () => items(await specialIds()),
    'deals.wish': async () => (await items([...user.wish])).filter(g => g.pct > 0).sort((a, b) => b.pct - a.pct),
    'soon.you': async () => (await items([...user.wish])).filter(g => g.comingSoon).sort((a, b) => (a.release || 9e9) - (b.release || 9e9)),
    'soon.popular': async () => (await items(await searchIds('filter=popularcomingsoon', 12))).filter(g => g.comingSoon),
    'more.you': async () => items(user.picks.filter(id => !user.owned.has(id)).slice(0, 14)),
    'more.top': async () => items(await searchIds('filter=topsellers', 14)),
    'more.new': async () => items(await searchIds('filter=popularnew', 14)),
    'more.free': async () => items(await searchIds('maxprice=free&filter=topsellers', 14)),
  };
  async function ensure(key) {
    if (state.lists[key]) return;
    state.lists[key] = [];
    state.lists[key] = await LOADERS[key]();
  }

  /* ---------- events ---------- */
  root.addEventListener('click', async e => {
    const t = e.target.closest('button');
    if (!t) { const h = !e.target.closest('a') && e.target.closest('.sf-hmain[data-href]'); if (h) location.href = h.dataset.href; return; }
    e.preventDefault(); e.stopPropagation();
    if (t.dataset.owned) { store.set('owned', t.dataset.owned); render(); return; }
    if (t.dataset.hero != null) { state.heroAt = +t.dataset.hero; paintSection('.sf-hero', heroHTML); return; }
    if (t.dataset.native) { html.setAttribute('data-rfs-front', 'off'); document.querySelector('.main_content_ctn')?.scrollIntoView(); return; }
    if (t.dataset.chip) {
      const key = t.dataset.chip; state[key] = t.dataset.v;
      await ensure(key === 'deals' ? 'deals.' + state.deals : key === 'soon' ? 'soon.' + state.soon : 'more.' + state.more);
      render(); return;
    }
    if (t.dataset.wish) {
      const id = +t.dataset.wish, on = !user.wish.has(id);
      t.disabled = true;
      const ok = await setWish(id, on);
      t.disabled = false;
      if (ok) render(); else t.classList.add('sf-err');
    }
  });

  /* ---------- start ---------- */
  async function start() {
    const body = document.querySelector('.home_page_body_ctn');
    if (!body || document.getElementById('sl-front')) return;
    const feat = featuredFromPage();          // read before the native page is hidden (innerText needs layout)
    body.prepend(root);
    html.setAttribute('data-rfs-front', 'on');
    root.innerHTML = `<div class="sf-loading">${esc(T('يجهّز المتجر…', 'Setting up the store…'))}</div>`;
    await Promise.all([loadUser(), tagNames()]);
    const heroItems = await items(feat.slice(0, 8).map(f => f.id));
    state.hero = heroItems.slice(0, 5).map(g => Object.assign({}, g, feat.find(f => f.id === g.id)));
    await Promise.all([ensure('deals.all'), ensure('soon.you'), ensure('more.you')]);
    if (!state.lists['soon.you'].length) { state.soon = 'popular'; await ensure('soon.popular'); }
    render();
    // the other tabs load quietly in the background so switching is instant
    setTimeout(() => { for (const k of ['deals.wish', 'soon.popular', 'more.top', 'more.new', 'more.free']) ensure(k); }, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
