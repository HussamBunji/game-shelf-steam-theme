/* Game Shelf — the game hub: our own game page, so nobody has to go to Steam's.
   Opened from "Game page" in any theme's game panel, the right-click menu, or the News / Achievements buttons.
   One page, every style: the layout is shared, the look comes from the style's variables and its block in
   src/css/hub.css (html[data-rfs-style="…"] #rfs-hub). Loaded on first use (shelf.js Hub.load), so it costs nothing
   until then. Tabs: Overview · News (+ a reader for one post) · Achievements · Friends · DLC.
   Data comes from Steam's own stores (the same calls Steam's game page makes) — every source is optional: a tab
   without data says so and offers Steam's own page instead. */
(() => {
  'use strict';
  if (window.__rfsHub) return;
  const A = window.__rfsLayoutApi;
  if (!A) return;
  const { T, esc, ic, NUM, fmtPlaytime, fmtAgo, fmtSize, imgWithFallback, first, cssUrl } = A;
  const LTR = () => A.LTR;
  const S = () => { try { return A.steam(); } catch (e) { return null; } };
  const LOG = (...a) => { try { console.log('%c[rfs-hub]', 'color:#7fd', ...a); } catch (e) { /* ignore */ } };
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const DAY = 86400;
  const fmtDate = sec => { try { return new Intl.DateTimeFormat(A.LANG === 'ar' ? 'ar-u-nu-latn' : 'en', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(sec * 1000)); } catch (e) { return ''; } };
  const fmtWhen = sec => { if (!sec) return ''; const d = Date.now() / 1000 - sec; return d < 30 * DAY ? fmtAgo(sec) : fmtDate(sec); };

  /* ================================================================ news text: Steam's BBCode → safe HTML
     Everything is escaped first; only the tags below become elements, links only http(s) / steam://, images only
     https. No scripts, no inline styles, no raw HTML from the post ever reaches the page. */
  const CLAN_IMG = 'https://clan.akamai.steamstatic.com/images/';
  const safeUrl = (u, img) => {
    u = String(u || '').replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/g, '\'').replace(/&amp;/g, '&').trim().replace(/^["']|["']$/g, '').replace(/\{STEAM_CLAN_IMAGE\}\/?/g, CLAN_IMG);
    if (img) return /^https:\/\//i.test(u) ? u : '';
    return /^(https?:\/\/|steam:\/\/)/i.test(u) ? u : '';
  };
  // a tag's attribute, from the escaped text: [img src="…"], [url="…"], [img=…]  (name '' = the [tag=…] form)
  const attr = (a, name) => {
    const re = name ? new RegExp(`\\b${name}=(?:&quot;([\\s\\S]*?)&quot;|([^\\s\\]]+))`, 'i') : /^=(?:&quot;([\s\S]*?)&quot;|(\S+))/;
    const m = re.exec(String(a || '').trim()); return m ? (m[1] != null ? m[1] : m[2]) : '';
  };
  const ATTRS = '(?:[= ][^\\]]*)?'; // "[p align=…]", "[url=…]", "[h2]"
  function bb(src) {
    let s = esc(String(src || '')).replace(/\r\n?/g, '\n');
    const rep = (re, fn) => { s = s.replace(re, fn); };
    rep(/\[img([= ][^\]]*)?\]([\s\S]*?)\[\/img\]/gi, (m, a, inner) => { const x = safeUrl(attr(a, 'src') || attr(a, '') || inner, true); return x ? `<img src="${esc(x)}" alt="" loading="lazy">` : ''; });
    rep(/\[img\s+src=[^\]]*\]/gi, m => { const x = safeUrl(attr(m.slice(4, -1), 'src'), true); return x ? `<img src="${esc(x)}" alt="" loading="lazy">` : ''; });
    rep(/\[previewyoutube=(?:&quot;)?([\w-]{6,20})[^\]]*\]\s*(?:\[\/previewyoutube\])?/gi, (m, id) => `<a class="hb-yt" href="#" data-url="https://www.youtube.com/watch?v=${id}"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy"></a>`);
    rep(/\[video[^\]]*\][\s\S]*?\[\/video\]/gi, '');
    rep(/\[url([= ][^\]]*)\]([\s\S]*?)\[\/url\]/gi, (m, a, t) => { const x = safeUrl(attr(a, '') || attr(a, 'href')); return x ? `<a href="#" data-url="${esc(x)}">${t}</a>` : t; });
    rep(/\[url\]([\s\S]*?)\[\/url\]/gi, (m, u) => { const x = safeUrl(u); return x ? `<a href="#" data-url="${esc(x)}">${esc(x)}</a>` : u; });
    rep(/\[dynamiclink([= ][^\]]*)\]\s*\[\/dynamiclink\]/gi, (m, a) => { const x = safeUrl(attr(a, 'href') || attr(a, '')); return x ? `<p><a href="#" data-url="${esc(x)}">${esc(x.replace(/^https?:\/\//, ''))}</a></p>` : ''; });
    const pairs = { b: 'b', i: 'i', u: 'u', strike: 's', h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h4', quote: 'blockquote', code: 'pre', p: 'p', spoiler: 'mark', table: 'table', tr: 'tr', td: 'td', th: 'th', list: 'ul', olist: 'ol' };
    for (const [k, t] of Object.entries(pairs)) {
      rep(new RegExp(`\\[${k}${ATTRS}\\]`, 'gi'), `<${t}>`);
      rep(new RegExp(`\\[\\/${k}\\]`, 'gi'), `</${t}>`);
    }
    rep(/\[\*\]/g, '<li>'); rep(/\[\/\*\]/g, '</li>');
    rep(/\[hr\]\s*\[\/hr\]|\[hr\]/gi, '<hr>');
    // any other Steam tag ([pc], [dynamiclink …], [carousel] …): dropped, its text kept. Only lowercase one-word names
    // with optional attributes, so "[good friends' rule]" written inside a post stays as text.
    rep(/\[\/?(?:pc|dynamiclink|carousel|center|expand|noparse|emoticon|color|size|font|align|sub|sup)(?:[= ][^\]]*)?\]/gi, '');
    rep(/\[\/?[a-z0-9]+(?:=[^\]\s]*)?\]/g, '');
    // blank lines → paragraphs, single line breaks → <br> (not inside lists / tables)
    s = s.split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map(p => /^<(h\d|ul|ol|table|blockquote|pre|hr|p)\b/.test(p) ? p : `<p>${p}</p>`).join('');
    return s.replace(/(<\/?(?:ul|ol|li|table|tr|td|th)>)\s*\n\s*/g, '$1').replace(/\n/g, '<br>');
  }
  /** plain text for a card: tags and links stripped, first ~200 characters */
  const plain = src => String(src || '').replace(/\[img[\s\S]*?\[\/img\]|\[previewyoutube[\s\S]*?\[\/previewyoutube\]/gi, ' ').replace(/\[[^\]]+\]/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220);
  /** first image of a post body, for its card */
  const firstImg = src => {
    const m = /\[img(?:\s+src="([^"]+)"[^\]]*|=([^\]]*))?\]([\s\S]*?)(?:\[\/img\]|$)/i.exec(String(src || ''));
    return m ? safeUrl(m[1] || m[2] || m[3], true) : '';
  };

  /* ================================================================ data: the same sources Steam's game page uses
     (read from steamui/sp.js). Each one is guarded: a Steam update that renames something empties one tab, never
     the page. */
  const ACC0 = 76561197960265728n;
  // Steam keeps a post's text per language in a MobX ObservableMap (not instanceof Map): English is key 0
  const val0 = m => {
    try {
      if (m == null || typeof m === 'string') return m || '';
      if (typeof m.get === 'function' && m.get(0)) return m.get(0);
      if (typeof m.values === 'function') return [...m.values()].find(v => typeof v === 'string' && v) || '';
      return '';
    } catch (e) { return ''; }
  };
  const evText = (ev, fn, field) => { try { const v = ev[fn] && ev[fn](0); if (typeof v === 'string' && v) return v; } catch (e) { /* older model */ } return val0(ev[field]); };
  const UPDATE_TYPES = new Set([12, 13, 14]); // Steam event types: small / regular / major update
  const Src = {
    async news(g, W) {
      const out = [];
      const fromModel = ev => {
        const body = evText(ev, 'GetDescriptionWithFallback', 'description');
        let image = '';
        try { image = ev.GetImageURL('capsule', 0) || ev.GetImageURL('spotlight', 0) || ''; } catch (e) { /* no art */ }
        let date = 0; try { date = ev.GetPostTimeAndDateUnixSeconds() || 0; } catch (e) { /* ignore */ }
        const tags = (() => { try { return [...(ev.vecTags || [])].map(String); } catch (e) { return []; } })();
        return { id: String(ev.GID || ev.AnnouncementGID), clan: ev.clanSteamID, title: evText(ev, 'GetNameWithFallback', 'name') || T('بدون عنوان', 'Untitled'), body,
          summary: plain(body), image: image || firstImg(body), date: date || ev.postTime || ev.startTime || 0,
          kind: (tags.includes('patchnotes') || UPDATE_TYPES.has(ev.type)) ? T('تحديث', 'Update') : '',
          url: `https://store.steampowered.com/news/app/${g.appid}/view/${ev.GID}` };
      };
      try {
        const list = await W.partnerEventStore.LoadAdjacentPartnerEvents(undefined, undefined, g.appid, 0, 24, undefined, undefined);
        for (const ev of list || []) { try { out.push(fromModel(ev)); } catch (e) { /* skip one */ } }
      } catch (e) { LOG('news via store failed', e); }
      if (!out.length) { // the same request Steam's library makes, without its store
        const r = await fetch(`https://store.steampowered.com/events/ajaxgetadjacentpartnerevents/?appid=${g.appid}&count_before=0&count_after=24&lang_list=0&origin=${encodeURIComponent(location.origin)}`);
        const j = r.ok ? await r.json() : null;
        for (const ev of (j && j.events) || []) {
          const b = ev.announcement_body || {};
          out.push({ id: String(ev.gid), title: ev.event_name || b.headline || T('بدون عنوان', 'Untitled'), body: b.body || '', summary: plain(b.body),
            image: firstImg(b.body), date: b.posttime || ev.rtime32_start_time || 0, kind: ((b.tags || []).includes('patchnotes') || UPDATE_TYPES.has(ev.event_type)) ? T('تحديث', 'Update') : '',
            url: `https://store.steampowered.com/news/app/${g.appid}/view/${ev.gid}` });
        }
      }
      const seen = new Set();
      return out.filter(n => n.id && !seen.has(n.id) && seen.add(n.id)).sort((a, b) => (b.date || 0) - (a.date || 0));
    },
    async postBody(g, p, W) {
      if (p.body) return bb(p.body);
      try {
        const l = await W.partnerEventStore.LoadAdjacentPartnerEvents(p.id, p.clan, g.appid, 0, 1, undefined, undefined);
        const ev = l && l[0]; if (ev) return bb(evText(ev, 'GetDescriptionWithFallback', 'description'));
      } catch (e) { /* the card's summary stays */ }
      return '';
    },
    async achievements(g, W) {
      const r = await W.SteamClient.Apps.GetMyAchievementsForApp(String(g.appid));
      const list = (r && r.data && r.data.rgAchievements) || [];
      const img = s => !s ? '' : /^https?:\/\//.test(s) ? s : `https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps/${g.appid}/${s}`;
      // how many players have each one: the local list leaves flAchieved at 0, so ask PlayerService.GetGameAchievements
      // (what Steam's own achievements page uses). Without it the percentage is simply not shown.
      const pct = new Map();
      try {
        const svc = playerService(W);
        if (svc && svc.GetGameAchievements && list.length) {
          const resp = await svc.GetGameAchievements(W.appInfoStore.CMInterface.GetServiceTransport(), { appid: g.appid, language: 'english' });
          const o = resp && resp.Body && resp.Body().toObject();
          for (const x of (o && o.achievements) || []) { const v = parseFloat(x.player_percent_unlocked); if (x.internal_name && isFinite(v)) pct.set(x.internal_name, v); }
        }
      } catch (e) { LOG('achievement percentages', e); }
      const glob = a => pct.has(a.strID) ? pct.get(a.strID) : (typeof a.flAchieved === 'number' && a.flAchieved > 0 ? a.flAchieved : null);
      return list.map(a => ({ id: a.strID, name: a.strName || a.strID, desc: a.strDescription || '', icon: img(a.strImage), unlocked: !!a.bAchieved,
        hidden: !!a.bHidden, time: a.rtUnlocked || 0, global: glob(a) }));
    },
    async friends(g, W) {
      const fs = W.friendStore, byId = new Map();
      const person = (acc, sid) => {
        let f = null; try { f = fs.GetFriendState ? fs.GetFriendState(acc) : null; } catch (e) { /* not a friend */ }
        const p = (f && (f.persona || f.m_persona)) || {};
        return { id: String(sid || acc), name: (f && f.nickname) || p.m_strPlayerName || p.name || '', avatar: p.avatar_url_medium || p.avatar_url || '', online: !!(p.is_online || p.m_ePersonaState > 0) };
      };
      try {
        for (const f of fs.GetFriendsInGame(g.appid) || []) {
          const p = f.persona || {};
          byId.set(String(f.steamid64 || f.accountid), { name: f.nickname || p.m_strPlayerName || '', avatar: p.avatar_url_medium || '', state: 'ingame', note: T('يلعبها الحين', 'Playing now') });
        }
      } catch (e) { LOG('friends in game', e); }
      // played recently / ever: Steam's PlayerService call (not on a global — found once in Steam's webpack modules)
      try {
        const svc = playerService(W);
        if (svc) {
          const r = await svc.GetFriendsGameplayInfo(W.appInfoStore.CMInterface.GetServiceTransport(), { appid: g.appid });
          const o = r && r.Body && r.Body().toObject();
          const add = (arr, kind) => (arr || []).forEach(x => {
            const sid = String(x.steamid); if (!sid || byId.has(sid)) return;
            let acc = 0; try { acc = Number(BigInt(sid) - ACC0); } catch (e) { return; }
            const p = person(acc, sid); if (!p.name) return;
            const mins = kind === 'recent' ? x.minutes_played : x.minutes_played_forever;
            byId.set(sid, { name: p.name, avatar: p.avatar, state: p.online ? 'online' : 'offline',
              note: mins ? (kind === 'recent' ? T(`${fmtPlaytime(mins)} آخر أسبوعين`, `${fmtPlaytime(mins)} past 2 weeks`) : fmtPlaytime(mins)) : (kind === 'own' ? T('عنده اللعبة', 'Owns it') : '') });
          });
          if (o) { add(o.played_recently, 'recent'); add(o.played_ever, 'ever'); add(o.owns, 'own'); }
        }
      } catch (e) { LOG('friends gameplay info', e); }
      return [...byId.values()].filter(f => f.name);
    },
    dlc(g, W) {
      const d = W.appDetailsStore.GetAppDetails(g.appid);
      return ((d && d.vecDLC) || []).map(x => ({
        appid: x.unAppID, name: x.strName || ('DLC ' + x.unAppID),
        owned: !!(x.rtPurchaseDate > 0 || (x.strState && x.strState !== 'notinstalled') || x.bEnabled),
        installed: x.strState ? x.strState === 'installed' : undefined,
        image: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${x.unAppID}/${x.strHeaderFilename || 'header.jpg'}`,
      })).sort((a, b) => (b.owned - a.owned) || a.name.localeCompare(b.name));
    },
  };
  /** Steam's PlayerService (friends who played a game): found once by a unique text in its module, then reused */
  function playerService(W) {
    if (window.__rfsPlayerSvc !== undefined) return window.__rfsPlayerSvc;
    let svc = null;
    try {
      let req; W.webpackChunksteamui.push([[Symbol('rfs')], {}, r => { req = r; }]);
      const id = req && Object.keys(req.m).find(k => { try { return req.m[k].toString().includes('Player.GetFriendsGameplayInfo#1'); } catch (e) { return false; } });
      if (id) svc = Object.values(req(id)).find(v => v && typeof v.GetFriendsGameplayInfo === 'function') || null;
    } catch (e) { LOG('player service not found', e); }
    window.__rfsPlayerSvc = svc;
    return svc;
  }
  /** what Steam's game page shows beside the play button: cloud, updates, Deck, controllers, reviews, publisher … */
  function moreFacts(g, W) {
    const out = [], id = g.appid;
    let d = null, ov = g.ov; try { d = W.appDetailsStore.GetAppDetails(id); } catch (e) { /* none */ }
    try {
      const a = W.appDetailsStore.GetAssociations(id);
      const pubs = (a && a.rgPublishers || []).map(x => x.strName).filter(Boolean);
      if (pubs.length) out.push([T('الناشر', 'Publisher'), pubs.join('، ')]);
    } catch (e) { /* optional */ }
    try {
      if (d && d.bCloudEnabledForApp && d.bCloudEnabledForAccount) {
        const CS = { 3: T('متزامنة', 'Up to date'), 4: T('يفحص…', 'Checking…'), 5: T('مو متزامنة', 'Out of sync'), 6: T('يرفع…', 'Uploading…'), 7: T('ينزّل…', 'Downloading…'), 8: T('فشل التزامن', 'Sync failed'), 9: T('فيه تعارض', 'Conflict'), 10: T('شغّالة بجهاز ثاني', 'In use elsewhere') };
        out.push([T('حفظ السحابة', 'Steam Cloud'), CS[d.eCloudStatus] || T('مفعّل', 'On')]);
      }
    } catch (e) { /* optional */ }
    try {
      const st = (ov.local_per_client_data && ov.local_per_client_data.display_status) || (d && d.eDisplayStatus);
      const pct = ov.local_per_client_data && ov.local_per_client_data.status_percentage;
      const US = { 6: T('يتحدّث', 'Updating'), 7: T('ينزّل', 'Downloading'), 18: T('التحديث موقّف', 'Update paused'), 19: T('التحديث بالطابور', 'Update queued'), 20: T('تحتاج تحديث', 'Update required'), 39: T('فشل التحديث', 'Update failed') };
      if (US[st]) out.push([T('التحديث', 'Update'), US[st] + (pct ? ` · ${pct}%` : '')]);
    } catch (e) { /* optional */ }
    try {
      const up = (W.partnerEventStore.GetAppImportantUpdate && W.partnerEventStore.GetAppImportantUpdate(id)) || null;
      const t = (up && up.date) || (d && d.rtLastUpdated);
      if (t) out.push([T('آخر تحديث للعبة', 'Last game update'), fmtWhen(t)]);
    } catch (e) { /* optional */ }
    try {
      const DK = { 1: T('غير مدعومة', 'Unsupported'), 2: T('قابلة للعب', 'Playable'), 3: T('متحقق منها', 'Verified') };
      if (DK[ov.steam_deck_compat_category]) out.push([T('ستيم ديك', 'Steam Deck'), DK[ov.steam_deck_compat_category]]);
    } catch (e) { /* optional */ }
    try {
      const CT = { 1: T('دعم جزئي', 'Partial'), 2: T('دعم كامل', 'Full') };
      if (CT[ov.xbox_controller_support]) out.push([T('اليد', 'Controller'), CT[ov.xbox_controller_support]]);
    } catch (e) { /* optional */ }
    try {
      if (ov.review_percentage > 0) out.push([T('التقييمات', 'Reviews'), T(`${ov.review_percentage}% إيجابية`, `${ov.review_percentage}% positive`)]);
      if (ov.metacritic_score > 0) out.push(['Metacritic', String(ov.metacritic_score)]);
    } catch (e) { /* optional */ }
    try { if (d && d.strSelectedBeta && d.strSelectedBeta !== 'public') out.push([T('النسخة التجريبية', 'Beta branch'), d.strSelectedBeta]); } catch (e) { /* optional */ }
    return out;
  }
  /** Steam's community pages for the game (steam://url/<name>/<appid>, the same links its game page lists) */
  function communityLinks(g, W) {
    let d = null; try { d = W.appDetailsStore.GetAppDetails(g.appid); } catch (e) { /* none */ }
    const has = f => { try { return !!f(); } catch (e) { return false; } };
    return [
      ['GameHub', 'globe', T('مركز المجتمع', 'Community hub')],
      ['GameHubDiscussions', 'msg', T('النقاشات', 'Discussions')],
      ['GameHubGuides', 'layers', T('الأدلة', 'Guides')],
      has(() => W.appDetailsStore.BIsWorkshopVisible(d)) && ['SteamWorkshopPage', 'puzzle', T('الورشة', 'Workshop')],
      ['CommunityScreenshots', 'image', T('لقطات الشاشة', 'Screenshots')],
      has(() => W.appDetailsStore.BHasMarketPresence(d)) && ['CommunityMarketApp', 'coins', T('السوق', 'Market')],
      ['HelpAppPage', 'info', T('الدعم', 'Support')],
    ].filter(Boolean).map(([k, icon, name]) => ({ url: `steam://url/${k}/${g.appid}`, icon, name }));
  }
  /** trading cards: the game's badge and how many of its cards you have (fills in a moment after the first ask) */
  async function badge(g, W) {
    const get = () => { try { return W.badgeStore.GetBadgeData(g.appid); } catch (e) { return null; } };
    let b = get();
    for (let i = 0; i < 6 && b && !b.rgCards && b.dtNextRetry !== undefined; i++) { await new Promise(r => setTimeout(r, 400)); b = get(); }
    if (!b || !Array.isArray(b.rgCards) || !b.rgCards.length) return null;
    return { name: b.strName || '', icon: b.strIconURL || '', level: b.nLevel || 0, max: b.nMaxLevel || 0, cards: b.rgCards.map(c => ({ name: c.strTitle || c.strName, img: c.strImgURL, owned: c.nOwned || 0 })) };
  }

  /* ================================================================ the page */
  const hub = el('div'); hub.id = 'rfs-hub'; hub.setAttribute('role', 'dialog'); hub.setAttribute('aria-modal', 'true');
  const TABS = [
    { id: 'overview', icon: 'home', name: () => T('نظرة عامة', 'Overview') },
    { id: 'news', icon: 'news', name: () => T('الأخبار', 'News') },
    { id: 'ach', icon: 'trophy', name: () => T('الإنجازات', 'Achievements') },
    { id: 'friends', icon: 'users', name: () => T('الأصدقاء', 'Friends') },
    { id: 'dlc', icon: 'puzzle', name: () => T('الإضافات', 'DLC') },
  ];
  const H = {
    g: null, tab: 'overview', post: null, cache: new Map(), token: 0,
    isOpen() { return hub.classList.contains('on'); },
    place() {
      const r = A.panelRect();
      Object.assign(hub.style, { left: Math.round(r.left) + 'px', top: Math.round(r.top) + 'px', width: Math.round(r.width) + 'px', height: Math.round(r.height) + 'px' });
    },
    async open(g, tab) {
      if (!g) return;
      if (!hub.isConnected) document.body.appendChild(hub);
      this.g = g; this.tab = TABS.some(t => t.id === tab) ? tab : 'overview'; this.post = null;
      const my = ++this.token;
      hub.dataset.style = document.documentElement.dataset.rfsStyle || '';
      this.place();
      this.frame();
      hub.classList.add('on'); document.documentElement.classList.add('rfs-hub-on');
      A.setBrowserVisible && A.setBrowserVisible(false);
      A.sfx('open');
      try { await A.Data.ensureDetails(g); } catch (e) { /* details are optional */ }
      if (my !== this.token) return;
      this.paintHead();
      this.show(this.tab);
      requestAnimationFrame(() => { const b = hub.querySelector('.hb-tab.on'); if (b) b.focus({ preventScroll: true }); });
    },
    close() {
      if (!this.isOpen()) return;
      this.token++;
      hub.classList.remove('on'); document.documentElement.classList.remove('rfs-hub-on');
      hub.replaceChildren(); this.g = null; this.post = null;
      A.sfx('close');
    },
    frame() {
      const g = this.g;
      hub.innerHTML = `
        <div class="hb-bg"></div>
        <header class="hb-head">
          <div class="hb-art"></div>
          <div class="hb-id">
            <div class="hb-logo"></div>
            <h1 class="hb-name" dir="auto">${esc(g.name)}</h1>
            <div class="hb-stats"></div>
          </div>
          <div class="hb-cta"></div>
          <div class="hb-tools">
            <button type="button" class="hb-tool" data-hb="steam" title="${T('افتح صفحة اللعبة في ستيم', 'Open Steam\'s own page for this game')}">${ic('external')}<span>${T('صفحة ستيم', 'Steam page')}</span></button>
            <button type="button" class="hb-tool hb-x" data-hb="close" title="${T('إغلاق (Esc)', 'Close (Esc)')}">${ic('x')}</button>
          </div>
        </header>
        <nav class="hb-tabs" role="tablist">${TABS.map(t => `<button type="button" role="tab" class="hb-tab" data-tab="${t.id}" aria-selected="false" tabindex="-1">${ic(t.icon)}<span>${esc(t.name())}</span><b class="hb-count"></b></button>`).join('')}</nav>
        <main class="hb-body" tabindex="-1"></main>`;
    },
    paintHead() {
      const g = this.g, $ = s => hub.querySelector(s);
      const img = first(g.images.hero) || first(g.images.header) || first(g.images.capsule);
      if (img) $('.hb-bg').style.backgroundImage = cssUrl(img);
      const art = first(g.images.capsule);
      if (art) $('.hb-art').append(imgWithFallback(g.images.capsule, 'hb-cover'));
      if (g.images.logo.length) {
        $('.hb-logo').append(imgWithFallback(g.images.logo, 'hb-logo-img', im => { im.remove(); $('.hb-name').classList.remove('has-logo'); }));
        $('.hb-name').classList.add('has-logo');
      }
      const ach = A.gameAch(g);
      const stats = [
        [ic('hourglass'), fmtPlaytime(g.playtimeMin) || T('ما لعبتها', 'Not played')],
        g.lastPlayed ? [ic('clock'), fmtAgo(g.lastPlayed)] : null,
        [ic(g.installed ? 'drive' : 'download'), A.sizeText(g) || (g.installed ? T('مثبتة', 'Installed') : T('غير مثبتة', 'Not installed'))],
        ach ? [ic('trophy'), `${NUM.format(ach.got)}/${NUM.format(ach.total)} · ${ach.pct}%`] : null,
      ].filter(Boolean);
      $('.hb-stats').innerHTML = stats.map(([i, v]) => `<span class="hb-stat">${i}<b dir="auto">${esc(v)}</b></span>`).join('');
      const acts = A.gameActions(g);
      // inside the hub, "Game page" is this page: that button would only re-open it
      acts.querySelectorAll('[data-act="details"], [data-act="news"]').forEach(x => x.remove()); // both are tabs right here
      $('.hb-cta').append(acts);
    },
    show(tab) {
      this.tab = tab; this.post = null;
      hub.querySelectorAll('.hb-tab').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
      if (document.activeElement && document.activeElement.classList.contains('hb-tab')) { const f = hub.querySelector('.hb-tab.on'); if (f) f.focus({ preventScroll: true }); }
      const body = hub.querySelector('.hb-body');
      body.scrollTop = 0;
      body.dataset.tab = tab;
      const my = this.token;
      const fn = this['tab_' + tab];
      body.innerHTML = `<div class="hb-loading">${ic('hourglass')}<span>${T('يحمّل…', 'Loading…')}</span></div>`;
      Promise.resolve().then(() => fn.call(this, body, my)).catch(err => {
        LOG('tab failed', tab, err);
        if (my === this.token) body.innerHTML = this.emptyHTML(T('ما قدرت أجيب هالقسم الحين', 'Couldn\'t load this part right now'), true);
      });
    },
    emptyHTML(msg, steamLink) {
      return `<div class="hb-empty">${ic('info')}<p>${esc(msg)}</p>${steamLink ? `<button type="button" class="hb-link" data-hb="steam">${ic('external')}${T('افتح صفحة ستيم', 'Open Steam\'s page')}</button>` : ''}</div>`;
    },
    count(tab, n) { const b = hub.querySelector(`.hb-tab[data-tab="${tab}"] .hb-count`); if (b) b.textContent = n ? NUM.format(n) : ''; },
    stale(my) { return my !== this.token || !this.isOpen(); },
  };

  /* ================================================================ tabs */
  H.tab_overview = async function (body, my) {
    const g = this.g, W = S();
    const facts = A.gameFacts(g).concat(W ? moreFacts(g, W) : []);
    const desc = A.gameDesc(g);
    const links = W ? communityLinks(g, W) : [];
    body.innerHTML = `
      <div class="hb-ov">
        <section class="hb-card hb-about">
          <h2>${T('عن اللعبة', 'About')}</h2>
          ${desc ? `<p class="hb-desc" dir="auto">${esc(desc)}</p>` : ''}
          ${g.genres.length ? `<div class="hb-chips">${g.genres.slice(0, 6).map(x => `<span class="hb-chip" dir="auto">${esc(x)}</span>`).join('')}</div>` : ''}
          <dl class="hb-facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd dir="auto">${esc(v)}</dd></div>`).join('')}</dl>
        </section>
        <section class="hb-card hb-ov-news" data-more="news"><h2>${ic('news')}${T('آخر الأخبار', 'Latest news')}</h2><div class="hb-slot"><div class="hb-loading">${ic('hourglass')}</div></div></section>
        <section class="hb-card hb-ov-ach" data-more="ach"><h2>${ic('trophy')}${T('الإنجازات', 'Achievements')}</h2><div class="hb-slot"><div class="hb-loading">${ic('hourglass')}</div></div></section>
        <section class="hb-card hb-ov-friends" data-more="friends"><h2>${ic('users')}${T('أصدقاء يلعبونها', 'Friends who play')}</h2><div class="hb-slot"><div class="hb-loading">${ic('hourglass')}</div></div></section>
        ${links.length ? `<section class="hb-card hb-ov-links"><h2>${ic('globe')}${T('المجتمع', 'Community')}</h2>
          <div class="hb-links">${links.map(l => `<button type="button" class="hb-lnk" data-url="${esc(l.url)}">${ic(l.icon)}<span>${esc(l.name)}</span></button>`).join('')}</div></section>` : ''}
        <section class="hb-card hb-ov-cards" hidden><h2>${ic('ticket')}${T('بطاقات التداول', 'Trading cards')}</h2><div class="hb-slot"></div></section>
      </div>`;
    const slot = s => body.querySelector(s + ' .hb-slot');
    const more = (tab, label) => `<button type="button" class="hb-more" data-goto="${tab}">${esc(label)}${ic(LTR() ? 'chevR' : 'chevL')}</button>`;
    // each card fills on its own: a slow source never holds up the others
    (async () => {
      const news = await getNews(g).catch(() => null);
      if (this.stale(my)) return;
      this.count('news', news && news.length);
      slot('.hb-ov-news').innerHTML = news && news.length
        ? `<div class="hb-news-mini">${news.slice(0, 3).map(newsCardHTML).join('')}</div>${more('news', T('كل الأخبار', 'All news'))}`
        : `<p class="hb-none">${T('ما في أخبار لهاللعبة', 'No news for this game')}</p>`;
    })();
    (async () => {
      const list = await getAch(g).catch(() => null);
      if (this.stale(my)) return;
      const box = slot('.hb-ov-ach');
      if (!list || !list.length) { box.innerHTML = `<p class="hb-none">${T('ما فيها إنجازات', 'No achievements')}</p>`; return; }
      const got = list.filter(a => a.unlocked);
      this.count('ach', list.length);
      const pct = Math.round(got.length / list.length * 100);
      const recent = got.slice().sort((a, b) => (b.time || 0) - (a.time || 0)).slice(0, 6);
      box.innerHTML = `<div class="hb-ach-sum"><b>${NUM.format(got.length)}<small>/${NUM.format(list.length)}</small></b><span class="hb-bar"><i style="width:${pct}%"></i></span><em>${pct}%</em></div>`
        + (recent.length ? `<div class="hb-ach-icons">${recent.map(a => `<img src="${esc(a.icon)}" alt="" title="${esc(a.name)}${a.time ? ' · ' + esc(fmtWhen(a.time)) : ''}" loading="lazy">`).join('')}</div>` : '')
        + more('ach', T('كل الإنجازات', 'All achievements'));
    })();
    (async () => {
      const fr = await getFriends(g).catch(() => null);
      if (this.stale(my)) return;
      const box = slot('.hb-ov-friends');
      this.count('friends', fr && fr.length);
      box.innerHTML = fr && fr.length
        ? `<div class="hb-faces">${fr.slice(0, 10).map(f => `<span class="hb-face ${f.state}" title="${esc(f.name)}${f.note ? ' · ' + esc(f.note) : ''}">${f.avatar ? `<img src="${esc(f.avatar)}" alt="" loading="lazy">` : ic('users')}</span>`).join('')}</div>${more('friends', T('كل الأصدقاء', 'All friends'))}`
        : `<p class="hb-none">${T('ما أحد من أصدقائك يلعبها', 'None of your friends play it')}</p>`;
    })();
    getDlc(g).then(d => { if (!this.stale(my)) this.count('dlc', d && d.length); }).catch(() => {});
    if (W) badge(g, W).then(b => {
      if (this.stale(my) || !b) return;
      const sec = body.querySelector('.hb-ov-cards'); if (!sec) return;
      const got = b.cards.filter(c => c.owned > 0).length;
      sec.hidden = false;
      sec.querySelector('.hb-slot').innerHTML = `<div class="hb-badge">${b.icon ? `<img src="${esc(b.icon)}" alt="">` : ''}<div><b dir="auto">${esc(b.name || T('شارة اللعبة', 'Game badge'))}</b>
          <small>${b.level ? T(`المستوى ${NUM.format(b.level)}`, `Level ${NUM.format(b.level)}`) : T('ما صنعتها للحين', 'Not crafted yet')}${b.max ? ` / ${NUM.format(b.max)}` : ''} · ${T(`عندك ${NUM.format(got)} من ${NUM.format(b.cards.length)} بطاقات`, `${NUM.format(got)} of ${NUM.format(b.cards.length)} cards`)}</small></div></div>
        <div class="hb-cards">${b.cards.map(c => `<span class="hb-tc${c.owned ? ' own' : ''}" title="${esc(c.name)}${c.owned > 1 ? ' ×' + c.owned : ''}">${c.img ? `<img src="${esc(c.img)}" alt="" loading="lazy">` : ''}${c.owned > 1 ? `<b>×${c.owned}</b>` : ''}</span>`).join('')}</div>
        <button type="button" class="hb-more" data-url="steam://url/SteamIDAppTradingCardsPage/${g.appid}">${T('بطاقاتي في ستيم', 'My cards on Steam')}${ic(LTR() ? 'chevR' : 'chevL')}</button>`;
    }).catch(() => {});
  };

  H.tab_news = async function (body, my) {
    const news = await getNews(this.g);
    if (this.stale(my)) return;
    this.count('news', news && news.length);
    if (!news || !news.length) { body.innerHTML = this.emptyHTML(T('ما في أخبار لهاللعبة', 'No news for this game'), true); return; }
    body.innerHTML = `<div class="hb-news">${news.map(newsCardHTML).join('')}</div>`;
  };
  H.openPost = async function (id) {
    const g = this.g, news = await getNews(g).catch(() => null);
    const p = news && news.find(n => String(n.id) === String(id));
    if (!p) return;
    this.post = p;
    const body = hub.querySelector('.hb-body'), my = this.token;
    body.scrollTop = 0; body.dataset.tab = 'post';
    body.innerHTML = `<article class="hb-post">
      <button type="button" class="hb-back" data-hb="back">${ic(LTR() ? 'chevL' : 'chevR')}${T('كل الأخبار', 'All news')}</button>
      ${p.image ? `<div class="hb-post-img" style="background-image:${esc(cssUrl(p.image))}"></div>` : ''}
      <div class="hb-post-meta">${p.kind ? `<span class="hb-kind">${esc(p.kind)}</span>` : ''}<time>${esc(fmtDate(p.date))}</time></div>
      <h2 class="hb-post-title" dir="auto">${esc(p.title)}</h2>
      <div class="hb-post-body" dir="auto"><div class="hb-loading">${ic('hourglass')}</div></div>
      ${p.url ? `<button type="button" class="hb-link" data-url="${esc(p.url)}">${ic('external')}${T('افتحها في ستيم', 'Open in Steam')}</button>` : ''}
    </article>`;
    const html = await postBody(g, p).catch(() => '');
    if (this.stale(my) || this.post !== p) return;
    body.querySelector('.hb-post-body').innerHTML = html || `<p>${esc(p.summary || '')}</p>`;
  };

  H.tab_ach = async function (body, my) {
    const list = await getAch(this.g);
    if (this.stale(my)) return;
    if (!list || !list.length) { body.innerHTML = this.emptyHTML(T('هاللعبة ما فيها إنجازات', 'This game has no achievements'), false); return; }
    this.count('ach', list.length);
    const got = list.filter(a => a.unlocked).length;
    const pct = Math.round(got / list.length * 100);
    const sorted = list.slice().sort((a, b) => (b.unlocked - a.unlocked) || (b.unlocked ? (b.time || 0) - (a.time || 0) : (b.global || 0) - (a.global || 0)));
    body.innerHTML = `
      <div class="hb-ach-top">
        <div class="hb-ach-sum big"><b>${NUM.format(got)}<small>/${NUM.format(list.length)}</small></b><span class="hb-bar"><i style="width:${pct}%"></i></span><em>${pct}%</em></div>
        <div class="hb-seg" role="group">
          <button type="button" class="on" data-af="all">${T('الكل', 'All')}</button><button type="button" data-af="got">${T('محققة', 'Unlocked')}</button><button type="button" data-af="left">${T('باقية', 'Locked')}</button>
        </div>
      </div>
      <div class="hb-ach">${sorted.map(a => `
        <div class="hb-a${a.unlocked ? ' got' : ''}" data-got="${a.unlocked ? 1 : 0}">
          <img src="${esc(a.unlocked ? a.icon : (a.iconGray || a.icon))}" alt="" loading="lazy">
          <div><b dir="auto">${esc(a.hidden && !a.unlocked ? T('إنجاز مخفي', 'Hidden achievement') : a.name)}</b>
            <p dir="auto">${esc(a.hidden && !a.unlocked ? T('يبين لك لما تحققه', 'Revealed when you unlock it') : a.desc || '')}</p></div>
          <span class="hb-a-side">${a.unlocked && a.time ? `<time>${esc(fmtWhen(a.time))}</time>` : ''}${a.global != null ? `<small title="${T('نسبة اللاعبين اللي حققوه', 'Players who have it')}">${(Math.round(a.global * 10) / 10)}%</small>` : ''}</span>
        </div>`).join('')}</div>`;
  };

  H.tab_friends = async function (body, my) {
    const fr = await getFriends(this.g);
    if (this.stale(my)) return;
    this.count('friends', fr && fr.length);
    if (!fr || !fr.length) { body.innerHTML = this.emptyHTML(T('ما أحد من أصدقائك يلعبها للحين', 'None of your friends play it yet'), false); return; }
    const group = (st, title) => { const l = fr.filter(f => f.state === st); return l.length ? `<h3>${esc(title)} <b>${NUM.format(l.length)}</b></h3><div class="hb-friends">${l.map(f => `
      <div class="hb-f ${f.state}">${f.avatar ? `<img src="${esc(f.avatar)}" alt="" loading="lazy">` : `<span class="hb-f-ph">${ic('users')}</span>`}<div><b dir="auto">${esc(f.name)}</b><small dir="auto">${esc(f.note || '')}</small></div></div>`).join('')}</div>` : ''; };
    body.innerHTML = group('ingame', T('يلعبونها الحين', 'Playing now')) + group('online', T('متصلين', 'Online')) + group('offline', T('لعبوها قبل', 'Have played'));
  };

  H.tab_dlc = async function (body, my) {
    const d = await getDlc(this.g);
    if (this.stale(my)) return;
    this.count('dlc', d && d.length);
    if (!d || !d.length) { body.innerHTML = this.emptyHTML(T('ما لهاللعبة إضافات', 'No DLC for this game'), false); return; }
    const owned = d.filter(x => x.owned).length;
    body.innerHTML = `<div class="hb-dlc-top"><p class="hb-sub">${T(`عندك ${NUM.format(owned)} من ${NUM.format(d.length)}`, `You own ${NUM.format(owned)} of ${NUM.format(d.length)}`)}</p>
      <button type="button" class="hb-link sm" data-url="steam://url/StoreDlcPage/${this.g.appid}">${ic('cart')}${T('كل الإضافات بالمتجر', 'All DLC in the store')}</button></div>
      <div class="hb-dlc">${d.map(x => `<div class="hb-d${x.owned ? ' own' : ''}" data-appid="${x.appid}">
        <div class="hb-d-art"${x.image ? ` style="background-image:${esc(cssUrl(x.image))}"` : ''}></div>
        <div><b dir="auto">${esc(x.name)}</b><small>${x.owned ? (x.installed === false ? T('عندك · مو مثبتة', 'Owned · not installed') : T('عندك', 'Owned')) : T('مو عندك', 'Not owned')}</small></div>
        ${x.owned ? '' : `<button type="button" class="hb-link sm" data-store="${x.appid}">${ic('cart')}${T('المتجر', 'Store')}</button>`}</div>`).join('')}</div>`;
  };

  /* ================================================================ shared bits */
  function newsCardHTML(n) {
    return `<button type="button" class="hb-n" data-post="${esc(String(n.id))}">
      <span class="hb-n-img"${n.image ? ` style="background-image:${esc(cssUrl(n.image))}"` : ''}>${n.image ? '' : ic('news')}</span>
      <span class="hb-n-txt"><span class="hb-n-meta">${n.kind ? `<i>${esc(n.kind)}</i>` : ''}<time>${esc(fmtWhen(n.date))}</time></span>
        <b dir="auto">${esc(n.title)}</b>${n.summary ? `<small dir="auto">${esc(n.summary)}</small>` : ''}</span></button>`;
  }
  // each source is fetched once per game while the hub is used
  const once = (key, fn) => g => { const k = key + g.appid; if (!H.cache.has(k)) H.cache.set(k, Promise.resolve().then(() => fn(g)).catch(err => { H.cache.delete(k); throw err; })); return H.cache.get(k); };
  const getNews = once('news', g => (Src.news ? Src.news(g, S()) : []));
  const getAch = once('ach', g => (Src.achievements ? Src.achievements(g, S()) : []));
  const getFriends = once('fr', g => (Src.friends ? Src.friends(g, S()) : []));
  const getDlc = once('dlc', g => (Src.dlc ? Src.dlc(g, S()) : []));
  const postBody = (g, p) => (Src.postBody ? Src.postBody(g, p, S()) : Promise.resolve(''));

  /* ================================================================ input */
  hub.addEventListener('click', e => {
    const t = e.target;
    const tab = t.closest('.hb-tab'); if (tab) { A.sfx('tick'); H.show(tab.dataset.tab); return; }
    const go = t.closest('[data-goto]'); if (go) { A.sfx('tick'); H.show(go.dataset.goto); return; }
    const post = t.closest('[data-post]'); if (post) { A.sfx('tick'); H.openPost(post.dataset.post); return; }
    const af = t.closest('[data-af]');
    if (af) { const f = af.dataset.af; af.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === af)); hub.querySelectorAll('.hb-a').forEach(a => { a.hidden = f !== 'all' && (f === 'got') !== (a.dataset.got === '1'); }); return; }
    const url = t.closest('[data-url]');
    if (url) { e.preventDefault(); const u = url.dataset.url; A.steamUrl(/^steam:\/\//i.test(u) ? u : 'steam://openurl/' + u); return; }
    if (t.closest('a[href="#"]')) e.preventDefault();
    const store = t.closest('[data-store]'); if (store) { A.openStore(store.dataset.store); return; }
    const b = t.closest('[data-hb]'); if (!b) return;
    const k = b.dataset.hb;
    if (k === 'close') H.close();
    else if (k === 'back') H.show('news');
    else if (k === 'steam') { const id = H.g && H.g.appid; H.close(); if (id) A.openSteamPage(id); }
  });
  hub.addEventListener('contextmenu', e => { if (H.g && !e.target.closest('input, textarea')) { e.preventDefault(); e.stopPropagation(); A.gameMenu(H.g, e.clientX, e.clientY); } });
  /** keys while the hub is open: Esc closes (or leaves a news post), ← / → switch tabs, ↑ / ↓ / PgUp / PgDn scroll */
  function key(e) {
    if (!H.isOpen()) return false;
    const body = hub.querySelector('.hb-body');
    if (e.key === 'Escape') { if (H.post) H.show('news'); else H.close(); return true; }
    const typing = e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName);
    if (typing) return false;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const i = TABS.findIndex(t => t.id === H.tab), fwd = e.key === (LTR() ? 'ArrowRight' : 'ArrowLeft');
      const n = TABS[(i + (fwd ? 1 : -1) + TABS.length) % TABS.length];
      A.sfx('tick'); H.show(n.id);
      const b = hub.querySelector(`.hb-tab[data-tab="${n.id}"]`); if (b) b.focus({ preventScroll: true });
      return true;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { body.scrollBy({ top: e.key === 'ArrowDown' ? 90 : -90 }); return true; }
    if (e.key === 'PageDown' || e.key === 'PageUp') { body.scrollBy({ top: (e.key === 'PageDown' ? 1 : -1) * body.clientHeight * 0.85 }); return true; }
    if (e.key === 'Home') { body.scrollTop = 0; return true; }
    if (e.key === 'End') { body.scrollTop = body.scrollHeight; return true; }
    return false;
  }
  addEventListener('resize', () => { if (H.isOpen()) H.place(); });

  window.__rfsHub = { open: (g, tab) => H.open(g, tab), close: () => H.close(), isOpen: () => H.isOpen(), key, get game() { return H.g; },
    // for tools/: check the data sources against a live Steam without opening the page
    probe: { ...Src, bb, moreFacts, communityLinks, badge, ctx: S } };
})();
