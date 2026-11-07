/* Game Shelf landing page. One small script, no frameworks. */

/* ===== Change these when the release asset or repo name changes ===== */
// The direct download of the installer from the LATEST GitHub release.
// "releases/latest/download/<asset name>" always points at the newest release, so only the FILE NAME
// at the end has to match the asset uploaded to the release. If you rename the .exe, change it here only.
const DOWNLOAD_URL = 'https://github.com/yousf612-alwazzan/game-shelf-steam-theme/releases/latest/download/GameShelf-Installer-Setup.exe';
const REPO_URL = 'https://github.com/yousf612-alwazzan/game-shelf-steam-theme';
const RELEASES_URL = REPO_URL + '/releases';
const LICENSE_URL = REPO_URL + '/blob/main/LICENSE';

/* ===== Themes. lib / store = is a preview image in site/img/ ===== */
const THEMES = [
  { id: 'classic', en: 'Classic Shelf', ar: 'الرف الكلاسيكي', den: 'A 3D wooden bookcase; cases open like CDs', dar: 'رف خشب ثلاثي الأبعاد، والعلب تنفتح مثل CD', lib: 1, store: 1 },
  { id: 'glass', en: 'Glass Gallery', ar: 'المعرض الزجاجي', den: 'A practical dashboard with glass cards', dar: 'لوحة عملية: كمّل اللعب وكروت زجاجية', lib: 1, store: 1 },
  { id: 'neon', en: 'Neon Coverflow', ar: 'نيون كوفر فلو', den: 'A 3D carousel with neon lighting', dar: 'دوّار ثلاثي الأبعاد بإضاءة نيون', lib: 1, store: 1 },
  { id: 'terminal', en: 'Terminal', ar: 'الطرفية', den: 'Your library as a green-on-black command table', dar: 'مكتبتك كجدول أوامر أخضر على أسود', lib: 1, store: 1 },
  { id: 'vault', en: "Adventurer's Vault", ar: 'خزنة المغامر', den: 'Your games as rarity-framed loot', dar: 'ألعابك أغراض نادرة في حقيبة', lib: 1, store: 1 },
  { id: 'vinyl', en: 'Vinyl Records', ar: 'متجر الأسطوانات', den: 'A 70s record store with a turntable', dar: 'جو السبعينات: أسطوانات ومشغّل', lib: 1, store: 1 },
  { id: 'cork', en: 'Corkboard', ar: 'لوحة الذكريات', den: 'Polaroids pinned to a cork board', dar: 'صور بولارويد على لوح فلين', lib: 1, store: 1 },
  { id: 'arcade', en: 'Retro Arcade', ar: 'الأركيد', den: 'A Select-your-game arcade screen', dar: 'شاشة اختر لعبتك مثل الأركيد', lib: 1, store: 1 },
  { id: 'magazine', en: 'Magazine', ar: 'المجلة', den: 'An editorial magazine layout', dar: 'غلاف مجلة وأعمدة', lib: 1, store: 1 },
  { id: 'cupertino', en: 'Cupertino Dark', ar: 'كوبرتينو الداكن', den: 'The dark Mac / TV-app look', dar: 'أسلوب الماك الداكن وزر تشغيل أبيض', lib: 1, store: 1 },
  { id: 'cyberpunk', en: 'Cyberpunk', ar: 'سايبربنك', den: 'Cyberpunk atmosphere in eye-friendly tones', dar: 'أجواء سايبربنك بألوان مريحة للعين', lib: 0, store: 1 },
  { id: 'shelter', en: 'Shelter OS', ar: 'الملجأ', den: 'A green shelter terminal with a raise-to-view wrist computer', dar: 'ملجأ أخضر وجهاز ذراع ترفعه بيدك', lib: 0, store: 0 },
  { id: 'original', en: 'Steam Original', ar: 'ستيم الأصلي', den: 'Stock Steam plus the Themes button and store panels', dar: 'ستيم مثل ما هو، مع زر الثيمات ولوحات المتجر', lib: 0, store: 1 },
  { id: 'space', en: 'SpaceTheme', ar: 'SpaceTheme', den: 'The popular dark community theme (MIT)', dar: 'ثيم المجتمع المشهور، داكن ومرتب (MIT)', lib: 1, store: 1, extra: 1 },
  { id: 'material', en: 'Material You', ar: 'Material You', den: "Google's Material 3 design (MIT)", dar: 'تصميم Material 3 من Google (MIT)', lib: 0, store: 0, extra: 1 },
];
const HERO_IDS = ['classic', 'neon', 'vinyl', 'arcade', 'glass', 'cork'];

/* ===== Text ===== */
const T = {
  en: {
    docTitle: 'Game Shelf: 14 new looks for your Steam library',
    docDesc: 'Give your Steam library and store a new look. Download the free installer, run it, pick your themes. Windows 10/11, Arabic and English.',
    skip: 'Skip to content', brand: 'Game Shelf', navLabel: 'Main', navHow: 'How it works', navThemes: 'Themes', navFaq: 'Questions',
    langSwitch: 'التبديل إلى العربية', langOther: 'العربية',
    dlShort: 'Download', dlAria: 'Download the Game Shelf installer for Windows',
    eyebrow: 'A theme pack for Steam',
    heroTitle: 'Give your Steam library <em>a new look</em>',
    heroLead: 'Turn your games into a wooden bookcase, a neon carousel, a record store or an arcade screen. 14 looks for the library and the store, in Arabic and English.',
    dlBig: 'Download for Windows', dlSub: 'Free installer, takes about a minute', allReleases: 'All releases',
    factsLabel: 'Requirements', fWin: 'Windows 10/11', fFree: 'Free', fSteam: 'Needs Steam',
    previewLabel: 'Preview', showPreview: 'Show {name}',
    howKicker: 'Three steps', howTitle: 'How it works',
    s1t: 'Download', s1p: 'Click the big button above. You get one small installer file.',
    s2t: 'Run the installer', s2p: "Open the file. If you don't have Millennium (the free, open-source theme loader for Steam), it installs it for you, then restarts Steam.",
    s3t: 'Choose your themes', s3p: 'Tick the looks you like. Switch between them any time from the THEMES button in Steam.',
    thKicker: 'The gallery', thTitle: 'Pick your look',
    thLead: '12 Game Shelf themes plus 2 extra community themes. Click any card to see the library and the store.',
    extraLabel: 'Extra community themes', extra: 'Extra', soon: 'Preview coming soon',
    library: 'Library', store: 'Store', tabLib: 'Library', tabStore: 'Store', open: 'Open preview of {name}',
    altLib: '{name} theme: the Steam library', altStore: '{name} theme: the Steam store',
    close: 'Close', prev: 'Previous theme', next: 'Next theme', keys: 'Use the arrow keys to browse, Esc to close', count: '{i} of {n}',
    faqKicker: 'Good to know', faqTitle: 'Questions',
    faq: [
      ['Windows says "Windows protected your PC". What do I do?', 'Click <strong>More info</strong>, then <strong>Run anyway</strong>. Windows shows this for new apps that are not code-signed yet. The installer is open source and you can read every line on GitHub.'],
      ['What is Millennium?', 'Millennium is a free, open-source loader that lets Steam use custom themes. The installer downloads it from its official GitHub page for you, so you don\'t need to set anything up.'],
      ['Can I add or remove themes later?', 'Yes. Press <strong>THEMES</strong> in Steam\'s top bar to switch looks or turn them on and off. To remove everything, run the installer again and choose Uninstall.'],
      ['Is it safe? Does it touch my account?', 'It never reads or changes your account, password or games. It only adds the theme folder and Millennium\'s theme settings on your PC.'],
      ['Arabic or English?', 'Both. The installer and every theme work in Arabic and English, and you can switch any time.'],
    ],
    endTitle: 'Ready for a new look?', endLead: "Download, run, pick your themes. That's it.",
    footNote: 'Not affiliated with Valve. Steam is a trademark of Valve Corporation.',
    footGithub: 'Source on GitHub', footLicense: 'MIT license',
    credits: 'Includes <a href="https://github.com/SpaceTheme/Steam" rel="noopener">SpaceTheme</a> and <a href="https://github.com/kuska1/Material-Theme" rel="noopener">Material Theme</a>, both MIT licensed. Theme loader: <a href="https://github.com/SteamClientHomebrew/Millennium" rel="noopener">Millennium</a>.',
  },
  ar: {
    docTitle: 'رف الألعاب: 14 شكلًا جديدًا لمكتبة ستيم',
    docDesc: 'غيّر شكل مكتبة ستيم والمتجر. حمّل المثبّت المجاني، شغّله، واختر ثيماتك. ويندوز 10/11، بالعربي والإنجليزي.',
    skip: 'انتقل إلى المحتوى', brand: 'رف الألعاب', navLabel: 'القائمة', navHow: 'طريقة التثبيت', navThemes: 'الثيمات', navFaq: 'أسئلة',
    langSwitch: 'Switch to English', langOther: 'English',
    dlShort: 'تحميل', dlAria: 'تحميل مثبّت رف الألعاب لويندوز',
    eyebrow: 'حزمة ثيمات لستيم',
    heroTitle: 'أعطِ مكتبة ستيم <em>شكلًا جديدًا</em>',
    heroLead: 'حوّل ألعابك إلى رف خشب، أو دوّار نيون، أو متجر أسطوانات، أو شاشة أركيد. 14 شكلًا للمكتبة والمتجر، بالعربي والإنجليزي.',
    dlBig: 'تحميل لويندوز', dlSub: 'مثبّت مجاني، يأخذ دقيقة تقريبًا', allReleases: 'كل الإصدارات',
    factsLabel: 'المتطلبات', fWin: 'ويندوز 10/11', fFree: 'مجاني', fSteam: 'يحتاج ستيم',
    previewLabel: 'معاينة', showPreview: 'اعرض {name}',
    howKicker: 'ثلاث خطوات', howTitle: 'طريقة التثبيت',
    s1t: 'حمّل', s1p: 'اضغط الزر الكبير فوق. ينزل عندك ملف مثبّت صغير واحد.',
    s2t: 'شغّل المثبّت', s2p: 'افتح الملف. إذا ما عندك Millennium (أداة مجانية مفتوحة المصدر لتشغيل ثيمات ستيم) يثبّته لك، وبعدها يعيد تشغيل ستيم.',
    s3t: 'اختر ثيماتك', s3p: 'علّم على الأشكال اللي تعجبك. وتقدر تبدّل بينها أي وقت من زر الثيمات داخل ستيم.',
    thKicker: 'المعرض', thTitle: 'اختر شكلك',
    thLead: '12 ثيم من رف الألعاب و2 ثيمات إضافية من المجتمع. اضغط على أي بطاقة لتشوف المكتبة والمتجر.',
    extraLabel: 'ثيمات إضافية من المجتمع', extra: 'إضافي', soon: 'المعاينة قريبًا',
    library: 'المكتبة', store: 'المتجر', tabLib: 'المكتبة', tabStore: 'المتجر', open: 'افتح معاينة {name}',
    altLib: 'ثيم {name}: مكتبة ستيم', altStore: 'ثيم {name}: متجر ستيم',
    close: 'إغلاق', prev: 'الثيم السابق', next: 'الثيم التالي', keys: 'استخدم الأسهم للتنقل و Esc للإغلاق', count: '{i} من {n}',
    faqKicker: 'معلومات مفيدة', faqTitle: 'أسئلة',
    faq: [
      ['ويندوز يقول "Windows protected your PC"، وش أسوي؟', 'اضغط <strong>More info</strong> (مزيد من المعلومات) ثم <strong>Run anyway</strong> (تشغيل على أي حال). ويندوز يعرض هذي الرسالة للبرامج الجديدة اللي ما عندها توقيع رقمي بعد. المثبّت مفتوح المصدر وكل سطر فيه موجود على GitHub.'],
      ['وش هو Millennium؟', 'Millennium أداة مجانية ومفتوحة المصدر تخلّي ستيم يقبل الثيمات. المثبّت يحمّله لك من صفحته الرسمية على GitHub، فما تحتاج تسوي شي بنفسك.'],
      ['أقدر أضيف أو أشيل ثيمات بعدين؟', 'أكيد. اضغط زر <strong>الثيمات</strong> في الشريط العلوي لستيم وبدّل بينها أو شغّلها وطفّها. ولحذف كل شي شغّل المثبّت مرة ثانية واختر إزالة التثبيت.'],
      ['هل هو آمن؟ هل يلمس حسابي؟', 'ما يقرأ ولا يغيّر حسابك أو كلمة المرور أو ألعابك. كل اللي يسويه أنه يضيف مجلد الثيم وإعدادات الثيم في Millennium على جهازك.'],
      ['عربي ولا إنجليزي؟', 'الاثنين. المثبّت وكل الثيمات تشتغل بالعربي والإنجليزي، وتقدر تبدّل أي وقت.'],
    ],
    endTitle: 'جاهز للشكل الجديد؟', endLead: 'حمّل، شغّل، اختر ثيماتك. بس كذا.',
    footNote: 'غير تابع لشركة Valve. ستيم علامة تجارية لشركة Valve.',
    footGithub: 'الكود على GitHub', footLicense: 'رخصة MIT',
    credits: 'يتضمن <a href="https://github.com/SpaceTheme/Steam" rel="noopener">SpaceTheme</a> و<a href="https://github.com/kuska1/Material-Theme" rel="noopener">Material Theme</a>، وكلاهما برخصة MIT. أداة تشغيل الثيمات: <a href="https://github.com/SteamClientHomebrew/Millennium" rel="noopener">Millennium</a>.',
  },
};

/* ===== helpers ===== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fmt = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k]);
let lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
const t = (k) => T[lang][k];
const nameOf = (th) => th[lang];
const descOf = (th) => (lang === 'ar' ? th.dar : th.den);
const img = (id, view, thumb) => `site/img/${thumb ? 'thumb/' : ''}${id}-${view}.jpg`;
const views = (th) => [th.lib && 'library', th.store && 'store'].filter(Boolean);
const icon = (n) => `<svg aria-hidden="true"><use href="#i-${n}"/></svg>`;

/* ===== links ===== */
$$('.js-dl').forEach((a) => { a.href = DOWNLOAD_URL; });
$$('.js-releases').forEach((a) => { a.href = RELEASES_URL; });
$$('.js-repo').forEach((a) => { a.href = REPO_URL; });
$$('.js-license').forEach((a) => { a.href = LICENSE_URL; });

/* ===== gallery ===== */
function renderGrid() {
  const ul = $('#grid');
  const card = (th) => {
    const v = views(th);
    const media = v.length
      ? `<img src="${img(th.id, v[0], 1)}" width="640" height="${v[0] === 'library' ? 324 : 360}" loading="lazy" decoding="async" alt="${fmt(t(v[0] === 'library' ? 'altLib' : 'altStore'), { name: nameOf(th) })}">`
      : `<span class="ph ph--${th.id}">${icon('image')}<span>${t('soon')}</span></span>`;
    const chips = v.map((x) => `<span class="chip">${t(x)}</span>`).join('');
    return `<li><button type="button" class="card reveal" data-id="${th.id}" aria-label="${fmt(t('open'), { name: nameOf(th) })}">
      <span class="card__media">${media}${v.length ? `<span class="card__zoom">${icon('expand')}</span>` : ''}</span>
      <span class="card__body">
        <span class="card__name">${nameOf(th)}${th.extra ? ` <span class="badge">${t('extra')}</span>` : ''}</span>
        <span class="card__desc">${descOf(th)}</span>
        ${chips ? `<span class="card__chips">${chips}</span>` : ''}
      </span></button></li>`;
  };
  const core = THEMES.filter((x) => !x.extra), extra = THEMES.filter((x) => x.extra);
  ul.innerHTML = core.map(card).join('') + `<li class="grid__label" aria-hidden="true">${t('extraLabel')}</li>` + extra.map(card).join('');
  // a placeholder badge duplicates the media text; hide the inner one from screen readers
  $$('.ph span', ul).forEach((s) => s.setAttribute('aria-hidden', 'true'));
  observeReveal();
}
$('#grid').addEventListener('click', (e) => {
  const b = e.target.closest('.card'); if (b) openLb(THEMES.findIndex((x) => x.id === b.dataset.id), b);
});

/* ===== lightbox ===== */
const lb = $('#lb');
let cur = 0, view = 'library', opener = null;
function drawLb() {
  const th = THEMES[cur], v = views(th);
  if (!v.includes(view)) view = v[0] || 'library';
  $('#lbTitle').innerHTML = nameOf(th) + (th.extra ? ` <span class="badge">${t('extra')}</span>` : '');
  $('#lbDesc').textContent = descOf(th);
  [['#tabLib', 'library'], ['#tabStore', 'store']].forEach(([s, k]) => {
    const tb = $(s); tb.disabled = !v.includes(k); tb.setAttribute('aria-selected', String(v.includes(k) && view === k)); tb.tabIndex = view === k ? 0 : -1;
  });
  $('#lbFig').innerHTML = v.length
    ? `<img src="${img(th.id, view)}" alt="${fmt(t(view === 'library' ? 'altLib' : 'altStore'), { name: nameOf(th) })}">`
    : `<div class="ph ph--${th.id}">${icon('image')}<span>${t('soon')}</span></div>`;
  $('#lbCount').textContent = fmt(t('count'), { i: cur + 1, n: THEMES.length });
  // warm the neighbours
  [cur - 1, cur + 1].forEach((i) => { const n = THEMES[(i + THEMES.length) % THEMES.length]; const nv = views(n)[0]; if (nv) new Image().src = img(n.id, nv); });
}
function openLb(i, from) {
  cur = i; view = 'library'; opener = from || null;
  lb.hidden = false; document.body.classList.add('is-locked'); drawLb();
  $('.lb__head [data-close]').focus();
}
function closeLb() { lb.hidden = true; document.body.classList.remove('is-locked'); if (opener) opener.focus(); }
const step = (d) => { cur = (cur + d + THEMES.length) % THEMES.length; drawLb(); };
$('#lbPrev').addEventListener('click', () => step(-1));
$('#lbNext').addEventListener('click', () => step(1));
$$('[data-close]', lb).forEach((el) => el.addEventListener('click', closeLb));
$$('.tab', lb).forEach((tb) => tb.addEventListener('click', () => { view = tb.dataset.view; drawLb(); }));
document.addEventListener('keydown', (e) => {
  if (lb.hidden) return;
  const rtl = document.documentElement.dir === 'rtl';
  if (e.key === 'Escape') { e.preventDefault(); closeLb(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); step(rtl ? -1 : 1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); step(rtl ? 1 : -1); }
  else if (e.key === 'Tab') { // keep focus inside the dialog
    const f = $$('button:not([disabled]), a[href]', lb).filter((x) => x.offsetParent);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
});

/* ===== FAQ ===== */
function renderFaq() {
  const open = $$('.qa.is-open').map((q) => q.dataset.i);
  $('#faqList').innerHTML = t('faq').map(([q, a], i) => `
    <div class="qa${open.includes(String(i)) ? ' is-open' : ''}" data-i="${i}">
      <h3><button type="button" class="qa__q" id="q${i}" aria-expanded="${open.includes(String(i))}" aria-controls="a${i}">
        <span>${q}</span><span class="qa__plus">${icon('plus')}</span></button></h3>
      <div class="qa__a" id="a${i}" role="region" aria-labelledby="q${i}"><div><p>${a}</p></div></div>
    </div>`).join('');
}
$('#faqList').addEventListener('click', (e) => {
  const b = e.target.closest('.qa__q'); if (!b) return;
  const q = b.closest('.qa'), on = !q.classList.contains('is-open');
  q.classList.toggle('is-open', on); b.setAttribute('aria-expanded', String(on));
});

/* ===== hero preview ===== */
const heroImg = $('#heroImg'), heroDots = $('#heroDots');
let heroI = 0, heroTimer = null;
function heroShow(i) {
  heroI = i; const th = THEMES.find((x) => x.id === HERO_IDS[i]);
  heroImg.classList.add('is-fading');
  const src = img(th.id, 'library'), pre = new Image(); pre.src = src;
  pre.decode().catch(() => {}).then(() => setTimeout(() => {
    heroImg.src = src; heroImg.alt = fmt(t('altLib'), { name: nameOf(th) }); $('#heroName').textContent = nameOf(th);
    heroImg.classList.remove('is-fading');
  }, 220));
  $$('button', heroDots).forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
}
function renderHeroDots() {
  heroDots.setAttribute('aria-label', t('previewLabel'));
  heroDots.innerHTML = HERO_IDS.map((id, k) => `<button type="button" aria-pressed="${k === heroI}" aria-label="${fmt(t('showPreview'), { name: nameOf(THEMES.find((x) => x.id === id)) })}"></button>`).join('');
  $$('button', heroDots).forEach((b, k) => b.addEventListener('click', () => { heroShow(k); restartHero(); }));
  const th = THEMES.find((x) => x.id === HERO_IDS[heroI]);
  heroImg.alt = fmt(t('altLib'), { name: nameOf(th) }); $('#heroName').textContent = nameOf(th);
}
function restartHero() {
  clearInterval(heroTimer);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  heroTimer = setInterval(() => { if (!document.hidden) heroShow((heroI + 1) % HERO_IDS.length); }, 4200);
}
$('#heroScreen').addEventListener('click', () => openLb(THEMES.findIndex((x) => x.id === HERO_IDS[heroI]), null));
$('#heroScreen').style.cursor = 'zoom-in';

/* ===== language ===== */
function applyLang(l, save) {
  lang = l;
  const html = document.documentElement;
  html.lang = l; html.dir = l === 'ar' ? 'rtl' : 'ltr';
  if (save) { try { localStorage.setItem('gs-lang', l); } catch (e) { /* private mode */ } }
  document.title = t('docTitle');
  $('meta[name="description"]').content = t('docDesc');
  $$('[data-i18n]').forEach((el) => { const v = t(el.dataset.i18n); if (v != null) el.textContent = v; });
  $$('[data-i18n-html]').forEach((el) => { const v = t(el.dataset.i18nHtml); if (v != null) el.innerHTML = v; });
  $$('[data-i18n-aria]').forEach((el) => { const v = t(el.dataset.i18nAria); if (v != null) el.setAttribute('aria-label', v); });
  $('#langLabel').textContent = t('langOther');
  $('#langBtn').setAttribute('aria-label', t('langSwitch'));
  $('.brand').setAttribute('aria-label', t('brand'));
  $('#langLabel').lang = l === 'ar' ? 'en' : 'ar';
  renderGrid(); renderFaq(); renderHeroDots();
  if (!lb.hidden) drawLb();
}
$('#langBtn').addEventListener('click', () => applyLang(lang === 'ar' ? 'en' : 'ar', true));

/* ===== small motion ===== */
let io = null;
function observeReveal() {
  const els = $$('.reveal:not(.is-in)');
  if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('is-in')); return; }
  io = io || new IntersectionObserver((ents) => ents.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
  }), { rootMargin: '0px 0px -40px 0px' });
  els.forEach((e, i) => { e.style.transitionDelay = (i % 4) * 60 + 'ms'; io.observe(e); });
}
const topBar = $('.top');
addEventListener('scroll', () => topBar.classList.toggle('is-scrolled', scrollY > 8), { passive: true });

applyLang(lang, false);
$$('.step').forEach((s) => s.classList.add('reveal'));
observeReveal();
restartHero();
