/* ===================================================================
   Magazine (المجلة) — library home design (plug-in layout, see docs/THEME-KIT.md)
   A premium print magazine at night:
     1. Masthead     — dateline, "GAME SHELF" nameplate between two ears (issue size · cover line), then the filter strip (dock)
     2. Cover story  — the last game played: the page's ONLY hero image + caption, headline, deck, three figures, actions
     3. In this issue — 3–4 genre sections, up to 6 article cards each, "+ N more" filters by that genre
     4. The big number + The Charts — top 10 by hours (big display numerals), recently added, by the numbers
     5. Index        — every game A–Z in newspaper columns, one element per game
   Search → a "results" spread; a genre filter → a "special issue" of that genre.
   Arrow keys move between article cards; Enter / a single click opens the game as a FEATURE SPREAD:
   the hero picture runs across two pages, the headline, standfirst and byline sit on the first, the fact file and
   editorial call-outs (Play / Game page / Store) on the second, which turns over from the fold (2D, ≤ 600 ms).
   =================================================================== */
(function () {
  'use strict';
  const api = window.__rfsLayoutApi;
  if (!api) return;
  const { T, esc, div, ic, cssUrl, first, lazy, fmtPlaytime, fmtAgo, fmtSize, NUM } = api;

  const PER_SECTION = 6;   // article cards per section column
  const RESULTS_MAX = 60;  // cards in the search-results spread (the rest live in the index)
  const FSI = '⁨', PDI = '⁩'; // bidi isolates: "Rocket League®" stays intact inside Arabic text
  const LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

  /* ---------------- text helpers ---------------- */
  /** Arabic counted noun: 1 / 2 have their own forms, 3–10 take the plural, 11+ the singular */
  function arCount(n, one, two, few, many) {
    if (n === 1) return one;
    if (n === 2) return two;
    const r = n % 100;
    return `${NUM.format(n)} ${r >= 3 && r <= 10 ? few : many}`;
  }
  /** compact hours for the index and charts: "42 h" / "42 س" */
  function shortHours(min) {
    if (!min) return '—';
    if (min < 60) return T(`${NUM.format(min)} د`, `${NUM.format(min)} min`);
    const h = min / 60, v = h >= 100 ? Math.round(h) : Math.round(h * 10) / 10;
    return T(`${NUM.format(v)} س`, `${NUM.format(v)} h`);
  }
  function issueDate() {
    try {
      return new Intl.DateTimeFormat(T('ar-u-nu-latn', 'en-US'), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
    } catch (e) { return ''; }
  }
  /** one-line standfirst for an article card, built from hours and last played */
  function standfirst(g, run) {
    if (run) return T('شغّالة الحين', 'Running right now');
    if (!g.playtimeMin) return g.installed ? T('ما لعبتها بعد — مثبّتة وتنتظرك', 'Not played yet — installed and waiting') : T('ما لعبتها بعد', 'Not played yet');
    const hrs = fmtPlaytime(g.playtimeMin);
    if (!g.lastPlayed) return T(`${hrs} لعب`, `${hrs} played`);
    const ago = fmtAgo(g.lastPlayed);
    return T(`${hrs} لعب · آخر مرة ${ago}`, `${hrs} played · last opened ${ago}`);
  }
  /** the short line under a small article: "11.5 h · 3 weeks ago" — fits a narrow column without an ellipsis */
  function brief(g, run) {
    if (run) return T('شغّالة الحين', 'Running right now');
    if (!g.playtimeMin) return g.installed ? T('مثبّتة · ما لعبتها بعد', 'Installed · not played yet') : T('ما لعبتها بعد', 'Not played yet');
    return g.lastPlayed ? `${shortHours(g.playtimeMin)} · ${fmtAgo(g.lastPlayed)}` : shortHours(g.playtimeMin);
  }
  /** "Vol. 2026 · No. 311": the year and the day of the year make every day a new issue */
  function issueNo() {
    const d = new Date(), n = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
    return T(`المجلد ${d.getFullYear()} · العدد ${NUM.format(n)}`, `Vol. ${d.getFullYear()} · No. ${NUM.format(n)}`);
  }
  function byline(g, dev) {
    const parts = [];
    if (dev) parts.push(T(`من تطوير ${FSI}${dev}${PDI}`, `By ${dev}`));
    parts.push(fmtPlaytime(g.playtimeMin));
    if (g.lastPlayed) parts.push(fmtAgo(g.lastPlayed));
    return parts.join(' · ');
  }
  function deckFallback(g) {
    return g.lastPlayed
      ? T('آخر لعبة شغّلتها — كمّل من وين ما وقفت.', 'The last game you played — pick up right where you left off.')
      : T('قصة هذا العدد، مباشرة من رفّك.', 'This issue’s lead story, straight from your shelf.');
  }
  const moreText = n => T(`+ ${arCount(n, 'لعبة أخرى', 'لعبتين ثانيتين', 'ألعاب أخرى', 'لعبة أخرى')}`, `+ ${NUM.format(n)} more`);
  const addedAt = g => { try { return (g.ov && Number(g.ov.rt_purchased_time)) || 0; } catch (e) { return 0; } };

  /* ---------------- picking the stories ---------------- */
  function pickCover(list) {
    let best = null;
    for (const g of list) if (g.lastPlayed && (!best || g.lastPlayed > best.lastPlayed)) best = g;
    if (!best) for (const g of list) if (!best || (g.playtimeMin || 0) > (best.playtimeMin || 0)) best = g;
    return best;
  }
  /** "In this issue": the most common genres, each game shown once across the whole spread */
  function buildSections(list, cover, max, exclude) {
    const used = new Set(cover ? [cover.appid] : []);
    const take = (src, pred) => {
      const items = [];
      for (const g of src) {
        if (items.length >= PER_SECTION) break;
        if (!used.has(g.appid) && pred(g)) items.push(g);
      }
      return items;
    };
    const count = new Map();
    for (const g of list) for (const t of g.genres || []) if (t && t !== exclude) count.set(t, (count.get(t) || 0) + 1);
    const tags = [...count.entries()].filter(e => e[1] >= 2).sort((a, b) => b[1] - a[1]).map(e => e[0]);
    const secs = [];
    for (const t of tags) {
      if (secs.length >= max) break;
      const items = take(list, g => g.genres.includes(t));
      if (items.length < 2) continue; // too thin for a column
      items.forEach(g => used.add(g.appid));
      secs.push({ label: t, genre: t, items, total: count.get(t) });
    }
    // not enough genres (tags not loaded, tiny library…): fill with editorial picks
    if (secs.length < max) {
      const byHours = list.filter(g => g.playtimeMin > 0).sort((a, b) => b.playtimeMin - a.playtimeMin);
      const picks = [
        [T('الأكثر لعبًا', 'Most played'), byHours, () => true],
        [T('تنتظرك على الرف', 'Waiting on the shelf'), list, g => !g.playtimeMin],
        [T('مثبّتة وجاهزة', 'Installed and ready'), list, g => g.installed],
        [T('من الأرشيف', 'From the archive'), list, () => true],
      ];
      for (const [label, src, pred] of picks) {
        if (secs.length >= max) break;
        const items = take(src, pred);
        if (!items.length) continue;
        items.forEach(g => used.add(g.appid));
        secs.push({ label, genre: '', items, total: 0 });
      }
    }
    return secs;
  }

  /* ---------------- markup ---------------- */
  function mastHTML(n, cover, played) {
    const date = issueDate();
    // the two "ears" beside the nameplate, as on a newspaper front page
    const left = `<div class="mg-ear"><small>${T('في هذا العدد', 'In this issue')}</small><b>${NUM.format(n)}</b><span>${T(n >= 3 && n <= 10 ? 'ألعاب' : 'لعبة', n === 1 ? 'game' : 'games')}${played ? ` · ${esc(T(`${NUM.format(played)} لعبتها`, `${NUM.format(played)} played`))}` : ''}</span></div>`;
    const right = cover
      ? `<div class="mg-ear end"><small>${T('على الغلاف', 'On the cover')}</small><b class="nm" dir="auto">${esc(cover.name)}</b><span>${esc(cover.playtimeMin ? T(`${shortHours(cover.playtimeMin)} لعب`, `${shortHours(cover.playtimeMin)} played`) : T('قصة الغلاف', 'Cover story'))}</span></div>`
      : '<div class="mg-ear end"></div>';
    return `<header class="mg-mast">
      <div class="mg-mast-line"><span>${esc(date)}</span><span class="mg-tag">${T('مجلة ألعابك الشخصية', 'Your personal games magazine')}</span><b>${esc(issueNo())}</b></div>
      <div class="mg-plate">${left}<h1 class="mg-title">${T('رف الألعاب', 'Game Shelf')}</h1>${right}</div>
      <div class="mg-mast-rule"></div>
    </header>`;
  }
  function artHTML(g, lead, running) {
    const run = running.has(g.appid);
    const cls = 'mg-art' + (lead ? ' lead' : '') + (run ? ' run' : '') + (g.installed ? '' : ' ni');
    const playT = g.installed ? T('شغّل', 'Play') : T('ثبّت', 'Install');
    return `<article class="${cls}" data-appid="${g.appid}" tabindex="0">`
      + `<div class="art"${run ? ` data-badge="${esc(T('شغّالة', 'Running'))}"` : ''}></div>`
      + `<h4 class="mg-art-t" dir="auto">${esc(g.name)}</h4>`
      + `<p class="mg-art-s">${esc(lead ? standfirst(g, run) : brief(g, run))}</p>`
      + `<button class="mg-play" type="button" tabindex="-1" title="${esc(playT)}" aria-label="${esc(playT)}">${ic(g.installed ? 'play' : 'download')}</button>`
      + '</article>';
  }
  function coverHTML(g, running) {
    const run = running.has(g.appid);
    const play = run ? `<button class="mg-btn play live" type="button" data-act="play">${ic('pulse')}${T('شغّالة الحين', 'Running now')}</button>`
      : g.installed ? `<button class="mg-btn play" type="button" data-act="play">${ic('play')}${T('كمّل اللعب', 'Continue playing')}</button>`
        : `<button class="mg-btn play" type="button" data-act="play">${ic('download')}${T('ثبّت اللعبة', 'Install')}</button>`;
    const tag = g.genres && g.genres[0] ? `<span dir="auto">${esc(g.genres[0])}</span>` : '';
    // three figures under the deck, set in the display face with hairline column rules
    const fig = (v, l) => `<div class="mg-fig"><b dir="auto">${esc(v)}</b><span>${l}</span></div>`;
    const hrs = g.playtimeMin ? shortHours(g.playtimeMin) : '—';
    const figs = fig(hrs, T('وقت اللعب', 'played'))
      + fig(run ? T('الحين', 'Now') : g.lastPlayed ? fmtAgo(g.lastPlayed) : '—', T('آخر مرة', 'last opened'))
      + fig(g.installed ? (g.sizeOnDisk ? fmtSize(g.sizeOnDisk) : T('مثبّتة', 'Installed')) : (g.needBytes ? fmtSize(g.needBytes) : T('غير مثبّتة', 'Not installed')), g.installed ? T('على جهازك', 'on this PC') : T('للتحميل', 'to download'));
    const cap = [g.name, ...(g.genres || []).slice(0, 3)].map(esc).join(' · ');
    return `<section class="mg-cover" data-appid="${g.appid}">
      <figure class="mg-cover-fig">
        <div class="mg-cover-img" role="img" aria-label="${esc(g.name)}"></div>
        <figcaption>${cap}</figcaption>
      </figure>
      <div class="mg-cover-txt">
        <div class="mg-kick">${T('قصة الغلاف', 'Cover story')}${tag}</div>
        <h2 class="mg-cover-h" dir="auto">${esc(g.name)}</h2>
        <p class="mg-deck" dir="auto">${esc(deckFallback(g))}</p>
        <div class="mg-by">${esc(byline(g, ''))}</div>
        <div class="mg-figs">${figs}</div>
        <div class="mg-ach"${api.gameAch(g) ? '' : ' hidden'}>${achFig(g)}</div>
        <div class="mg-acts">${play}<button class="mg-btn" type="button" data-act="open">${ic('news')}${T('اقرأ القصة', 'Read the story')}</button><button class="mg-btn" type="button" data-act="store">${ic('cart')}${T('صفحة المتجر', 'Store page')}</button></div>
      </div>
    </section>`;
  }
  function specialHTML(genre) {
    return `<div class="mg-special"><span class="mg-kick">${T('عدد خاص', 'Special issue')}</span><h2 dir="auto">${esc(genre)}</h2>`
      + `<button class="mg-btn mg-back" type="button">${ic(api.LTR ? 'chevL' : 'chevR')}${T('رجوع للعدد الكامل', 'Back to the full issue')}</button></div>`;
  }
  function issueHTML(secs, cols, running) {
    if (!secs.length) return '';
    const body = secs.map(s => {
      const rest = s.genre ? s.total - s.items.length : 0;
      return `<section class="mg-sec"><h3 class="mg-sec-h"><span dir="auto">${esc(s.label)}</span>${s.total ? `<small>${NUM.format(s.total)}</small>` : ''}</h3>`
        + s.items.map((g, i) => artHTML(g, i === 0, running)).join('')
        + (rest > 0 ? `<button class="mg-more" type="button" data-genre="${esc(s.genre)}">${esc(moreText(rest))}${ic(api.LTR ? 'chevR' : 'chevL')}</button>` : '')
        + '</section>';
    }).join('');
    const n = secs.length;
    return `<section class="mg-issue">
      <header class="mg-hd"><h2>${T('في هذا العدد', 'In this issue')}</h2><span>${esc(T(`${arCount(n, 'قسم واحد', 'قسمين', 'أقسام', 'قسمًا')} من رفّك`, `${n} ${n === 1 ? 'section' : 'sections'} from your shelf`))}</span></header>
      <div class="mg-cols" style="--n:${Math.min(cols, n)}">${body}</div>
    </section>`;
  }
  function pullHTML(list) {
    let min = 0;
    for (const g of list) min += g.playtimeMin || 0;
    const hrs = Math.round(min / 60);
    if (hrs < 1) return '';
    const days = Math.floor(hrs / 24);
    // "the big number": one huge red figure, the sentence it starts beside it
    const r = hrs % 100;
    const arH = hrs === 1 ? 'ساعة لعب واحدة' : hrs === 2 ? 'ساعتا لعب' : r >= 3 && r <= 10 ? 'ساعات لعب' : 'ساعة لعب';
    const text = days >= 1
      ? T(`${arH} على هذا الرف — يعني ${arCount(days, 'يومًا كاملًا', 'يومين كاملين', 'أيام كاملة', 'يومًا كاملًا')} من عمرك.`,
        `${hrs === 1 ? 'hour' : 'hours'} played on this shelf — that is ${NUM.format(days)} full ${days === 1 ? 'day' : 'days'} of your life.`)
      : T(`${arH} على هذا الرف، والقصة مستمرة.`, `${hrs === 1 ? 'hour' : 'hours'} played on this shelf, and the story goes on.`);
    return `<blockquote class="mg-pull"><b class="mg-pull-n">${NUM.format(hrs)}</b><div><p>${esc(text)}</p><cite>${T('رقم هذا العدد', 'The number of the issue')}</cite></div></blockquote>`;
  }
  function chartsHTML(list) {
    const top = list.filter(g => g.playtimeMin > 0).sort((a, b) => b.playtimeMin - a.playtimeMin).slice(0, 10);
    const max = top.length ? top[0].playtimeMin : 1;
    const two = top.length > 5;
    const rows = two ? Math.ceil(top.length / 2) : Math.max(1, top.length);
    const topHTML = top.length
      ? `<div class="mg-top" style="--r:${rows};--c:${two ? 2 : 1}">${top.map((g, i) => `<button type="button" class="mg-ch" data-appid="${g.appid}" style="--p:${(g.playtimeMin / max).toFixed(3)}"><b>${String(i + 1).padStart(2, '0')}</b><span dir="auto">${esc(g.name)}</span><i>${esc(shortHours(g.playtimeMin))}</i></button>`).join('')}</div>`
      : `<p class="mg-none">${T('ما فيه ساعات لعب مسجّلة بعد.', 'No hours on record yet.')}</p>`;

    // recently added (purchase date) — or, if Steam doesn't give one, the most recently played
    const stamp = new Map();
    for (const g of list) { const t = addedAt(g); if (t) stamp.set(g, t); }
    let recent, title, when;
    if (stamp.size) {
      recent = [...stamp.keys()].sort((a, b) => stamp.get(b) - stamp.get(a)).slice(0, 6);
      title = T('أُضيفت مؤخرًا', 'Recently added'); when = g => fmtAgo(stamp.get(g));
    } else {
      recent = list.filter(g => g.lastPlayed).sort((a, b) => b.lastPlayed - a.lastPlayed).slice(0, 6);
      title = T('آخر ما لعبت', 'Most recent'); when = g => fmtAgo(g.lastPlayed);
    }
    const recentHTML = recent.length
      ? `<div class="mg-box"><h4>${title}</h4>${recent.map(g => `<button type="button" class="mg-rc" data-appid="${g.appid}"><span dir="auto">${esc(g.name)}</span><i>${esc(when(g))}</i></button>`).join('')}</div>`
      : '';

    let mins = 0, played = 0, inst = 0;
    for (const g of list) { mins += g.playtimeMin || 0; if (g.playtimeMin) played++; if (g.installed) inst++; }
    const stat = (v, l) => `<div class="mg-stat"><b>${NUM.format(v)}</b><span>${l}</span></div>`;
    const statsHTML = `<div class="mg-box"><h4>${T('بالأرقام', 'By the numbers')}</h4><div class="mg-stats">`
      + stat(Math.round(mins / 60), T('ساعة لعب', 'hours played'))
      + stat(played, T('لعبة جرّبتها', 'games played'))
      + stat(inst, T('مثبّتة الحين', 'installed now'))
      + stat(list.length - played, T('ما لعبتها بعد', 'not played yet'))
      + '</div></div>';

    return `<section class="mg-charts">
      <header class="mg-hd"><h2>${T('القوائم', 'The Charts')}</h2><span>${T('الأكثر لعبًا حسب الساعات', 'Most played, by hours')}</span></header>
      <div class="mg-ch-grid">${topHTML}<aside class="mg-side">${recentHTML}${statsHTML}</aside></div>
    </section>`;
  }
  /** A–Z index of every game: text only, one element per game (hours come from data-h through CSS) */
  function indexHTML(list, sub) {
    const groups = new Map();
    for (const g of [...list].sort(api.SORTS.name)) {
      const c = String(g.sortAs || g.name || '').trim().normalize('NFD').charAt(0).toUpperCase();
      const k = c >= 'A' && c <= 'Z' ? c : '#';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(g);
    }
    const jump = LETTERS.map(k => `<button type="button" data-k="${k}"${groups.has(k) ? '' : ' disabled'}>${k}</button>`).join('');
    let cols = '';
    for (const k of LETTERS) {
      const arr = groups.get(k);
      if (!arr) continue;
      cols += `<h5 class="mg-ix-l" data-k="${k}">${k}</h5>`;
      for (const g of arr) {
        cols += `<button type="button" class="mg-ix${g.installed ? '' : ' ni'}" data-appid="${g.appid}" data-h="${esc(shortHours(g.playtimeMin))}">${FSI}${esc(g.name)}${PDI}</button>`;
      }
    }
    return `<section class="mg-index">
      <header class="mg-hd"><h2>${T('الفهرس', 'Index')}</h2><span>${esc(sub)}</span></header>
      <nav class="mg-jump" aria-label="${esc(T('انتقل لحرف', 'Jump to a letter'))}">${jump}</nav>
      <div class="mg-ix-cols">${cols}</div>
    </section>`;
  }
  function resultsHTML(list, q, running) {
    const n = list.length;
    const count = T(arCount(n, 'نتيجة واحدة', 'نتيجتين', 'نتائج', 'نتيجة'), `${NUM.format(n)} ${n === 1 ? 'result' : 'results'}`);
    const shown = list.slice(0, RESULTS_MAX);
    const note = n > RESULTS_MAX ? `<p class="mg-none">${esc(T(`أول ${NUM.format(RESULTS_MAX)} نتيجة هنا — الباقي في الفهرس تحت.`, `The first ${NUM.format(RESULTS_MAX)} are here — the rest are in the index below.`))}</p>` : '';
    return `<section class="mg-results">
      <header class="mg-hd"><h2>${T('نتائج البحث', 'Search results')}</h2><span>${esc(T(`«${q}» · ${count}`, `“${q}” · ${count}`))}</span></header>
      <div class="mg-grid">${shown.map(g => artHTML(g, false, running)).join('')}</div>${note}
    </section>`;
  }

  /** the foot of the spread's first page: the game's hours as one big display numeral */
  function numHTML(g, run) {
    const min = g.playtimeMin || 0;
    const h = min / 60;
    const big = !min ? '0' : h < 1 ? NUM.format(min) : NUM.format(h >= 100 ? Math.round(h) : Math.round(h * 10) / 10);
    const unit = !min ? T('ساعة', 'hours') : h < 1 ? T('دقيقة لعب', 'minutes played') : T('ساعة لعب', 'hours played');
    const sub = run ? T('وهي شغّالة الحين', 'and running right now')
      : !min ? T('القصة ما بدأت بعد', 'the story has not started yet')
        : g.lastPlayed ? T(`آخر مرة ${fmtAgo(g.lastPlayed)}`, `last opened ${fmtAgo(g.lastPlayed)}`) : '';
    return `<div class="mg-sp-num"><b>${esc(big)}</b><span>${esc(unit)}${sub ? `<i>${esc(sub)}</i>` : ''}</span></div>`;
  }
  /** the feature spread a game opens into: two pages, one picture across both, cream paper under it */
  function spreadHTML(g, page) {
    const run = api.running().has(g.appid);
    const desc = api.gameDesc(g) || deckFallback(g);
    const genres = (g.genres || []).slice(0, 4);
    const dev = g.developers && g.developers[0];
    const by = [dev ? T(`من تطوير ${FSI}${dev}${PDI}`, `By ${dev}`) : '', g.releaseDate ? T(`صدرت ${g.releaseDate}`, `Released ${g.releaseDate}`) : '',
      run ? T('شغّالة الحين', 'Running now') : g.installed ? T('مثبّتة على جهازك', 'Installed on this PC') : T('غير مثبّتة', 'Not installed')].filter(Boolean);
    const facts = api.gameFacts(g);
    const close = T('رجوع للعدد (Esc)', 'Back to the issue (Esc)');
    const kick = run ? T('مباشر', 'Live') : g.lastPlayed && g.playtimeMin ? T('تحقيق', 'Feature') : T('من الرف', 'From the shelf');
    const folio = (n, txt, end) => `<footer class="mg-folio${end ? ' end' : ''}"><b>${NUM.format(n)}</b><span>${txt}</span></footer>`;
    return '<div class="mg-sp-dim" data-close></div>'
      + `<article class="mg-sp" role="dialog" aria-modal="true" tabindex="-1" aria-label="${esc(g.name)}">`
      + '<section class="mg-pg a"><div class="mg-band"><i class="mg-band-img"></i></div>'
      + '<div class="mg-pg-body">'
      + `<div class="mg-sp-kick">${kick}${genres[0] ? `<span dir="auto">${esc(genres[0])}</span>` : ''}</div>`
      + `<h2 class="mg-sp-h" dir="auto">${esc(g.name)}</h2>`
      + `<p class="mg-sp-dek" dir="auto">${esc(desc)}</p>`
      + `<p class="mg-sp-by">${by.map(esc).join(' · ')}</p>`
      + numHTML(g, run)
      + '</div>' + folio(page, T('رف الألعاب · تحقيق العدد', 'Game Shelf · The feature')) + '</section>'
      + '<section class="mg-pg b"><div class="mg-band"><i class="mg-band-img"></i></div>'
      + `<button class="mg-sp-x" type="button" data-close title="${esc(close)}" aria-label="${esc(close)}">${ic('x')}</button>`
      + '<div class="mg-pg-body">'
      + (genres.length ? `<p class="mg-filed"><b>${T('تصنيف', 'Filed under')}</b>${genres.map(t => `<span dir="auto">${esc(t)}</span>`).join('<i>/</i>')}</p>` : '')
      + `<aside class="mg-facts"><h4>${T('بطاقة اللعبة', 'The fact file')}</h4><dl>`
      + facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd dir="auto" title="${esc(v)}">${esc(v)}</dd></div>`).join('')
      + '</dl></aside>'
      + `<div class="mg-cta"><h4>${T('اقلب الصفحة', 'Turn to')}</h4></div>`
      + '</div>' + folio(page + 1, esc(issueDate()), true)
      + '<i class="mg-shade"></i></section>'
      + '</article>';
  }

  /** the cover story's completion stat: "24%" in the display face, "12 of 50 achievements" and a hairline red rule
      that fills from the reading start ('' when the game has none / they are not known yet) */
  function achFig(g) {
    const a = api.gameAch(g);
    if (!a) return '';
    const done = a.got >= a.total;
    return `<b>${NUM.format(a.pct)}<small>%</small></b>`
      + `<span>${esc(T(`${NUM.format(a.got)} من ${NUM.format(a.total)} إنجاز مفتوح`, `${NUM.format(a.got)} of ${NUM.format(a.total)} achievements unlocked`))}`
      + `${done ? `<em>${T('مكتملة', 'Completed')}</em>` : ''}</span>`
      + `<i class="mg-ach-rule" aria-hidden="true"><i style="width:${Math.max(a.pct, a.got ? 2 : 0)}%"></i></i>`;
  }

  /* ---------------- painting (images arrive lazily) ---------------- */
  function paintArt(art, g) {
    const header = first(g.images.header);
    const u = header || (g.detailed ? first(g.images.capsule) : ''); // wait for the wide header before falling back to the portrait cover
    if (!u) return;
    const v = cssUrl(u);
    if (art._mgUrl === v) return;
    art._mgUrl = v;
    art.style.setProperty('--img', v);
    art.classList.toggle('cap', !header);
  }
  function paintCover(el, g) {
    const img = el.querySelector('.mg-cover-img'), deck = el.querySelector('.mg-deck'), by = el.querySelector('.mg-by'), ach = el.querySelector('.mg-ach');
    if (!img) return;
    const paint = () => {
      const u = first(g.images.hero) || (g.detailed ? first(g.images.header) || first(g.images.capsule) : '');
      if (u) { const v = cssUrl(u); if (img._mgUrl !== v) { img._mgUrl = v; img.style.setProperty('--hero', v); } }
      if (g.description && deck.dataset.full !== '1') { deck.dataset.full = '1'; deck.textContent = g.description; }
      const dev = g.developers && g.developers[0];
      if (dev && by.dataset.dev !== dev) { by.dataset.dev = dev; by.textContent = byline(g, dev); }
      const a = api.gameAch(g), key = a ? `${a.got}/${a.total}` : '';
      if (ach && ach.dataset.k !== key) { ach.dataset.k = key; ach.innerHTML = achFig(g); ach.hidden = !a; } // only the stat, once the exact counts arrive
    };
    paint();
    if (!g.detailed) api.Data.ensureDetails(g).then(() => { if (img.isConnected) paint(); });
  }

  /* ---------------- actions ---------------- */
  function openStore(g) {
    api.sfx('tick');
    const url = 'steam://store/' + g.appid;
    try {
      if (typeof api.steamUrl === 'function') { api.steamUrl(url); return; }
      const sc = window.SteamClient;
      if (sc && sc.URL && typeof sc.URL.ExecuteSteamURL === 'function') { sc.URL.ExecuteSteamURL(url); return; }
    } catch (e) { /* fall back to the game page below */ }
    api.openDetails(g.appid);
  }
  function toTop() {
    const m = api.stage.querySelector('.mg-mast');
    if (m) m.scrollIntoView({ block: 'start' });
  }
  /** the nearest article card in an arrow's direction (geometry, so it works the same in RTL and LTR) */
  function nearest(from, cards, dx, dy) {
    const a = from.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bestScore = Infinity;
    for (const c of cards) {
      if (c === from) continue;
      const r = c.getBoundingClientRect();
      if (!r.width) continue;
      if (dx > 0 && r.left < a.right - 4) continue;
      if (dx < 0 && r.right > a.left + 4) continue;
      if (dy > 0 && r.top < a.bottom - 4) continue;
      if (dy < 0 && r.bottom > a.top + 4) continue;
      const ox = Math.abs(r.left + r.width / 2 - ax), oy = Math.abs(r.top + r.height / 2 - ay);
      const score = dx ? ox + oy * 2 : oy + ox * 2;
      if (score < bestScore) { bestScore = score; best = c; }
    }
    return best;
  }

  const Layout = {
    fixedHeight: false,
    dockInside: true, // the filter strip sits right under the masthead
    srcEl: null,      // the element a game was opened from (the case flies back to it)
    hov: null,

    render(games, w) {
      const st = api.state;
      const q = String(st.query || '').trim();
      const genre = st.genre || '';
      const running = api.running();
      this.srcEl = null; this.hov = null; this.list = games;
      const el = div('mg' + (w < 1180 ? ' mg-mid' : '') + (w < 980 ? ' mg-narrow' : '') + (w < 760 ? ' mg-tiny' : ''));
      let played = 0;
      for (const g of games) if (g.playtimeMin) played++;
      let cover = q || !games.length ? null : pickCover(games);
      let html = mastHTML(games.length, cover, played) + '<div class="rf-dock" data-rfs-dock></div>';
      if (!games.length) {
        html += `<div class="mg-empty">${q || genre ? T('ما لقيت شي يطابق بحثك.', 'No stories match your search.') : T('ما فيه ألعاب في هذي المجموعة.', 'There are no games in this collection.')}</div>`;
      } else if (q) {
        html += resultsHTML(games, q, running);
        if (games.length > RESULTS_MAX) html += indexHTML(games, T(`كل النتائج من A إلى Z · ${NUM.format(games.length)}`, `Every result, A to Z · ${NUM.format(games.length)}`));
      } else {
        if (genre) html += specialHTML(genre);
        const cols = w >= 1240 ? 4 : 3;
        html += coverHTML(cover, running)
          + issueHTML(buildSections(games, cover, cols, genre), cols, running)
          + pullHTML(games)
          + chartsHTML(games)
          + indexHTML(games, T(`كل الألعاب من A إلى Z · ${NUM.format(games.length)}`, `Every game, A to Z · ${NUM.format(games.length)}`));
      }
      el.innerHTML = html;
      el.querySelectorAll('.mg-art').forEach(a => {
        const art = a.firstElementChild;
        lazy(a, g => paintArt(art, g));
      });
      if (cover) paintCover(el, cover);
      el.addEventListener('click', e => this.click(e));
      // hover: the highlight is pure CSS (instant); here we only fetch the game's details ahead of the click,
      // so the spread opens at once instead of waiting for Steam's data
      el.addEventListener('pointerover', e => {
        const c = e.target.closest('[data-appid]');
        if (c === this.hov) return;
        this.hov = c;
        if (!c) return;
        if (c.classList.contains('mg-art')) api.sfx('tick');
        const g = api.byId(c.dataset.appid);
        if (g && !g.detailed) api.Data.ensureDetails(g);
      });
      api.stage.replaceChildren(el);
    },

    click(e) {
      const t = e.target;
      if (t.closest('#rfs-bar')) return; // the docked filter strip handles its own clicks
      const more = t.closest('.mg-more');
      if (more) { api.sfx('tick'); api.state.genre = more.dataset.genre || ''; api.rerender(); toTop(); return; }
      if (t.closest('.mg-back')) { api.sfx('tick'); api.state.genre = ''; api.rerender(); toTop(); return; }
      const jb = t.closest('.mg-jump button');
      if (jb) {
        const h = api.stage.querySelector(`.mg-ix-l[data-k="${jb.dataset.k}"]`);
        if (h) { api.sfx('tick'); h.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
        return;
      }
      const host = t.closest('[data-appid]');
      if (!host) return;
      const g = api.byId(host.dataset.appid);
      if (!g) return;
      const act = t.closest('[data-act]');
      if (act) {
        if (act.dataset.act === 'play') api.launch(g);
        else if (act.dataset.act === 'open') this.go(g, host);
        else if (act.dataset.act === 'store') openStore(g);
        return;
      }
      if (t.closest('.mg-play')) { api.launch(g); return; }
      if (host.classList.contains('mg-cover') && !t.closest('.mg-cover-img, .mg-cover-h')) return; // only the photo + headline open the cover
      this.go(g, host);
    },

    /** open a game on a single click (no waiting for a double click): the core then calls open(g, sheet, src) */
    go(g, from) {
      this.srcEl = from || null;
      api.openGame(g, this.source(g.appid));
    },

    source(appid) {
      const id = String(appid);
      let host = this.srcEl && this.srcEl.isConnected && this.srcEl.dataset.appid === id ? this.srcEl : null;
      if (!host) host = api.stage.querySelector(`.mg-art[data-appid="${id}"]`) || api.stage.querySelector(`[data-appid="${id}"]`);
      if (!host) return null;
      const el = host.classList.contains('mg-cover') ? host.querySelector('.mg-cover-img') : host.querySelector('.art') || host;
      return el ? { el, slot: host, isSpine: false } : null;
    },

    /* ---------------- the feature spread ---------------- */
    async open(g, sheet, src) {
      const list = this.list || [];
      const i = list.indexOf(g);
      const page = 2 * (i >= 0 ? i : 0) + 4; // a left-hand page number, as in a real issue
      sheet.innerHTML = spreadHTML(g, page);
      const sp = sheet.querySelector('.mg-sp');
      const pa = sp.querySelector('.mg-pg.a'), pb = sp.querySelector('.mg-pg.b');
      // pictures: the small header shows at once, the wide hero replaces it as soon as it has loaded
      const head = first(g.images.header) || first(g.images.capsule);
      if (head) sp.style.setProperty('--head', cssUrl(head));
      const hero = first(g.images.hero);
      if (hero) {
        const im = new Image();
        // the logo is laid over the hero only: the small header fallback already has the title painted in
        const put = () => { if (sp.isConnected) { sp.style.setProperty('--hero', cssUrl(hero)); sp.classList.toggle('hero', true); } };
        im.onload = put;
        im.src = hero;
        if (im.complete && im.naturalWidth) put();
      }
      const logo = first(g.images.logo);
      if (logo) {
        const im = new Image();
        im.className = 'mg-sp-logo'; im.alt = ''; im.decoding = 'async';
        im.onerror = () => im.remove();
        im.src = logo;
        pa.querySelector('.mg-band').append(im);
      }
      sp.querySelector('.mg-cta').append(api.gameActions(g));
      // (no prefers-reduced-motion gate: Windows' "animation effects" switch turns it on for many PCs, and the owner
      //  asked for the themed opening; it is short, 2D and has no flashing)
      api.sfx('slide');
      // 1. the dim, 2. the first page grows out of the picture that was clicked, 3. the second page turns over from the fold
      const dim = sheet.querySelector('.mg-sp-dim'), shade = pb.querySelector('.mg-shade');
      let from = 'translateY(22px) scale(.96)';
      const r = src && src.el && src.el.isConnected ? src.el.getBoundingClientRect() : null;
      const p = pa.getBoundingClientRect();
      if (r && r.width > 4 && p.width > 4) {
        const s = Math.max(0.1, Math.min(1, r.width / p.width));
        from = `translate(${Math.round(r.left + r.width / 2 - (p.left + p.width / 2))}px, ${Math.round(r.top + r.height / 2 - (p.top + p.height / 2))}px) scale(${s.toFixed(3)})`;
      }
      // The whole opening is over in 350 ms (it used to take 570): the page starts to turn while the first one is still
      // settling, and the print "sets" a line at a time behind both. Transform and opacity only, all on the compositor.
      const EASE = 'cubic-bezier(.2,.8,.25,1)', TURN = 120;
      dim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
      const a = pa.animate([{ transform: from, opacity: 0.35 }, { transform: 'none', opacity: 1 }], { duration: 240, easing: EASE, fill: 'backwards' });
      const b = pb.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 220, delay: TURN, easing: EASE, fill: 'backwards' });
      shade.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 220, delay: TURN, easing: 'ease-out', fill: 'backwards' });
      // (only this extra setting of the lines is skipped under reduced motion; the short page turn stays, see above)
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const set = (els, t0, step) => els.forEach((e, k) => e.animate([{ opacity: 0, transform: 'translateY(7px)' }, { opacity: 1, transform: 'none' }],
          { duration: 130, delay: t0 + k * step, easing: 'ease-out', fill: 'backwards' }));
        set([...pa.querySelectorAll('.mg-pg-body > *')].slice(0, 6), 70, 24);
        set([...pb.querySelectorAll('.mg-pg-body > *')].slice(0, 4), TURN + 50, 16);
      }
      setTimeout(() => api.sfx('tick'), TURN); // the page turning (sound only, no DOM)
      try { await Promise.all([a.finished, b.finished]); } catch (e) { /* closed early */ }
      // the keyboard lands on the spread itself (Tab reaches the call-outs, Esc closes) — never straight on Play
      if (sp.isConnected) sp.focus({ preventScroll: true });
    },

    async close(sheet) {
      const sp = sheet.querySelector('.mg-sp');
      const back = this.srcEl && this.srcEl.isConnected && this.srcEl.classList.contains('mg-art') ? this.srcEl : null;
      if (sp) {
        const pa = sp.querySelector('.mg-pg.a'), pb = sp.querySelector('.mg-pg.b');
        const dim = sheet.querySelector('.mg-sp-dim'), shade = pb.querySelector('.mg-shade');
        api.sfx('close');
        // the second page folds back onto the first, then the closed issue drops away
        const b = pb.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: 180, easing: 'cubic-bezier(.55,0,.8,.45)', fill: 'forwards' });
        shade.animate([{ opacity: 0 }, { opacity: 0.9 }], { duration: 180, easing: 'ease-in', fill: 'forwards' });
        const a = pa.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(16px) scale(.97)', opacity: 0 }], { duration: 190, delay: 150, easing: 'ease-in', fill: 'forwards' });
        dim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 210, delay: 130, easing: 'ease-in', fill: 'forwards' });
        try { await Promise.all([a.finished, b.finished]); } catch (e) { /* gone */ }
      }
      if (back) back.focus({ preventScroll: true }); // the keyboard carries on from the story that was open
    },

    key(e) {
      const root = api.root;
      const ae = document.activeElement;
      // something else in Steam has the keyboard (its game list, a dialog…): leave the keys alone
      if (ae && !ae.contains(root) && !root.contains(ae)) return false;
      const onCard = ae && ae.classList && ae.classList.contains('mg-art') && api.stage.contains(ae) ? ae : null;
      if (e.key === 'Enter') {
        if (!onCard) return false; // a focused button (index entry, chart row…) handles Enter itself
        const g = api.byId(onCard.dataset.appid);
        if (g) this.go(g, onCard);
        return true;
      }
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return false;
      if (!onCard && ae && root.contains(ae)) return false; // focus is on another control of ours
      const cards = [...api.stage.querySelectorAll('.mg-art')];
      if (!cards.length) return false;
      let next;
      if (!onCard) {
        next = cards.find(c => { const r = c.getBoundingClientRect(); return r.width && r.bottom > 0 && r.top < innerHeight; });
      } else {
        next = nearest(onCard, cards, d[0], d[1]);
      }
      if (!next) return false; // nothing that way: let the page scroll on towards the charts and the index
      next.focus({ preventScroll: true });
      next.scrollIntoView({ block: 'nearest' });
      api.sfx('tick');
      return true;
    },
  };

  api.register('magazine', Layout);
})();
