/* Game Shelf landing page. One small script, no frameworks. */

/* ===== Change these when the release asset or repo name changes ===== */
// The direct download of the installer from the LATEST GitHub release.
// "releases/latest/download/<asset name>" always points at the newest release, so only the FILE NAME
// at the end has to match the asset uploaded to the release. If you rename the .exe, change it here only.
const DOWNLOAD_URL = 'https://github.com/yousf612-alwazzan/game-shelf-steam-theme/releases/latest/download/GameShelf-Installer-Setup.exe';
const REPO_URL = 'https://github.com/yousf612-alwazzan/game-shelf-steam-theme';
const RELEASES_URL = REPO_URL + '/releases';
const LICENSE_URL = REPO_URL + '/blob/main/LICENSE';

/* ===== Themes. lib / store = has a preview image in site/img/ (and site/img/thumb/). c = the theme's own colour ===== */
const THEMES = [
  { id: 'classic', en: 'Classic Shelf', ar: 'الرف الكلاسيكي', den: 'A 3D wooden bookcase; cases open like CDs.', dar: 'رف خشب ثلاثي الأبعاد، والعلب تنفتح مثل الـCD.', c: '#d49a5a', lib: 1, store: 1 },
  { id: 'glass', en: 'Glass Gallery', ar: 'المعرض الزجاجي', den: 'A practical dashboard of frosted-glass cards.', dar: 'لوحة عملية: كمّل اللعب وكروت زجاجية.', c: '#8fc2ff', lib: 1, store: 1 },
  { id: 'neon', en: 'Neon Coverflow', ar: 'نيون كوفر فلو', den: 'A 3D carousel under neon light.', dar: 'دوّار ثلاثي الأبعاد بإضاءة نيون.', c: '#3fe0f0', lib: 1, store: 1 },
  { id: 'terminal', en: 'Terminal', ar: 'الطرفية', den: 'Your library as a green-on-black command table.', dar: 'مكتبتك كجدول أوامر أخضر على أسود.', c: '#4cff8f', lib: 1, store: 1 },
  { id: 'vault', en: "Adventurer's Vault", ar: 'خزنة المغامر', den: 'Your games as rarity-framed loot.', dar: 'ألعابك أغراض نادرة في حقيبة مغامر.', c: '#c79bff', lib: 1, store: 1 },
  { id: 'vinyl', en: 'Vinyl Records', ar: 'متجر الأسطوانات', den: 'A 70s record store with a turntable.', dar: 'جو السبعينات: أسطوانات ومشغّل.', c: '#ff8c42', lib: 1, store: 1 },
  { id: 'cork', en: 'Corkboard', ar: 'لوحة الذكريات', den: 'Polaroids pinned to a cork board.', dar: 'صور بولارويد مثبّتة على لوح فلين.', c: '#e8c27a', lib: 1, store: 1 },
  { id: 'arcade', en: 'Retro Arcade', ar: 'الأركيد', den: 'A Select-your-game arcade screen.', dar: 'شاشة "اختر لعبتك" مثل صالات الأركيد.', c: '#ff4f8b', lib: 1, store: 1 },
  { id: 'magazine', en: 'Magazine', ar: 'المجلة', den: 'An editorial cover and columns.', dar: 'غلاف مجلة وأعمدة تحريرية.', c: '#f1ece2', lib: 1, store: 1 },
  { id: 'cupertino', en: 'Cupertino Dark', ar: 'كوبرتينو الداكن', den: 'The dark Mac and TV-app look.', dar: 'أسلوب الماك الداكن وزر تشغيل أبيض.', c: '#d8dbe2', lib: 1, store: 1 },
  { id: 'cyberpunk', en: 'Cyberpunk', ar: 'سايبربنك', den: 'Cyberpunk atmosphere in eye-friendly tones.', dar: 'أجواء سايبربنك بألوان مريحة للعين.', c: '#f3e600', lib: 0, store: 1 },
  { id: 'shelter', en: 'Shelter OS', ar: 'الملجأ', den: 'A green shelter terminal with a raise-to-view wrist computer.', dar: 'ملجأ أخضر وجهاز ذراع ترفعه بيدك.', c: '#a6e86a', lib: 1, store: 1 },
  { id: 'xmb', en: 'Crossbar', ar: 'الكونسول', den: 'A console menu over a flowing wave.', dar: 'قائمة كونسول فوق موجة متحركة.', c: '#7cb8ff', lib: 1, store: 1 },
  { id: 'original', en: 'Steam Original', ar: 'ستيم الأصلي', den: 'Stock Steam, plus the Themes button and store panels.', dar: 'ستيم مثل ما هو، مع زر الثيمات ولوحات المتجر.', c: '#66c0f4', lib: 0, store: 1, extra: 1 },
  { id: 'space', en: 'SpaceTheme', ar: 'SpaceTheme', den: 'The popular dark community theme (MIT).', dar: 'ثيم المجتمع المشهور، داكن ومرتّب (MIT).', c: '#9aa8ff', lib: 1, store: 1, extra: 1 },
  { id: 'material', en: 'Material You', ar: 'Material You', den: "Google's Material 3 design (MIT).", dar: 'تصميم Material 3 من Google (MIT).', c: '#a8c7fa', lib: 1, store: 0, extra: 1 },
];
// the themes that take turns being "featured" on the hero wall
const HERO_IDS = ['classic', 'neon', 'vinyl', 'arcade', 'glass', 'cork', 'vault', 'terminal'];

/* ===== Text ===== */
const T = {
  en: {
    docTitle: 'Game Shelf: 16 new looks for your Steam library',
    docDesc: 'Sixteen themes for the Steam library and store: a wooden bookcase, a neon carousel, a record store, an arcade cabinet and more. Free for Windows, Steam Deck and Linux. Arabic and English.',
    skip: 'Skip to content', brand: 'Game Shelf', navLabel: 'Main', navThemes: 'Themes', navFeatures: 'Features', navInstall: 'Install', navFaq: 'FAQ',
    langSwitch: 'التبديل إلى العربية', langOther: 'العربية',
    dlShort: 'Download', dlAria: 'Download the Game Shelf installer for Windows',
    over: 'Themes for Steam', overCount: '16 looks',
    heroTitle: 'Every game you own,<br>on a better shelf.',
    heroLead: 'Hand-built themes for the Steam library and store: a wooden bookcase, a neon carousel, a 70s record shop, an arcade cabinet. Switch looks in one click. Arabic and English.',
    platLabel: 'Platform', tabLx: 'Steam Deck / Linux',
    dlBig: 'Download for Windows', dlSub: 'Free installer · about a minute', allReleases: 'All releases',
    lxText: 'In Desktop Mode, open Konsole (or any terminal) and paste this one line:', lxCopy: 'Copy', lxCopied: 'Copied',
    lxNote: 'Needs Millennium installed first (the free theme loader, from steambrew.app). No sudo, nothing outside your home folder. Theme files only: GameShelf-Theme.zip in the releases.',
    factsLabel: 'Requirements', fWin: 'Windows 10/11', fDeck: 'Steam Deck', fLinux: 'Linux', fFree: 'Free', fSteam: 'Needs Steam',
    nowLabel: 'On the wall', nowAria: 'See {name} in the collection',
    thKicker: 'The collection', thTitle: 'Sixteen looks.<br><em>One click apart.</em>',
    thLead: 'Thirteen Game Shelf originals plus three favourites from the community. Every one dresses the library and the store.',
    groupCore: 'Game Shelf themes', groupExtra: 'Also included', railLabel: 'All themes',
    viewLabel: 'View', tabLib: 'Library', tabStore: 'Store', soon: 'Preview coming soon', soonSub: 'Included in the installer',
    altLib: '{name} theme: the Steam library', altStore: '{name} theme: the Steam store',
    prev: 'Previous theme', next: 'Next theme', keys: 'to browse', show: 'Show {name}',
    ftKicker: 'Inside Steam', ftTitle: 'Built into Steam,<br><em>not bolted on.</em>',
    fa1: 'Your library, your style.', fa2: "Press THEMES in Steam's top bar and pick another look. It switches instantly, in every open window. No restart, no reinstall.",
    altSwitch: 'The Neon Coverflow theme in the Steam library', pickerH: 'THEMES',
    fb1: 'Achievements, everywhere.', fb2: 'Your progress sits next to every game, on the home screen and in the game panels. One shared readout, dressed by each theme in its own colours.',
    fc1: 'The whole client, dressed.', fc2: 'Not just the home screen. The store, your wishlist, profiles, the friends list and chat all follow the theme you pick.',
    tg1: 'Store', tg2: 'Wishlist', tg3: 'Profiles', tg4: 'Friends & chat', tg5: 'Game pages', altStoreFan: 'The Steam store wearing the Glass Gallery theme',
    fd1: 'Arabic & English.', fd2: 'Every theme and the installer read right-to-left properly, with real Arabic type. Switch language any time.',
    altInstaller: 'The Game Shelf installer, theme picker step',
    fe1: 'Big Picture & Steam Deck.', fe2: 'Install on the Deck from Desktop Mode with one command. Your themes come with you.',
    inKicker: 'Install', inTitle: 'About a minute,<br><em>start to finish.</em>',
    s1t: 'Download', s1p: 'One small installer file. Free, no account, no sign-up.',
    s2t: 'Run it', s2p: "If you don't have Millennium (the free, open-source theme loader for Steam), it installs it for you, then restarts Steam.",
    s3t: 'Pick your themes', s3p: 'Tick the looks you like. Change your mind any time from the THEMES button inside Steam.',
    tipT: 'If Windows shows "Windows protected your PC"',
    tipP: "Click <strong>More info</strong>, then <strong>Run anyway</strong>. Windows shows this for new apps that aren't code-signed yet. The installer is open source; you can read every line on GitHub.",
    inDeck: 'On Steam Deck or Linux?', inDeckLink: 'Get the one-line command',
    faqKicker: 'Good to know', faqTitle: 'Questions',
    faq: [
      ['Windows says "Windows protected your PC". What do I do?', 'Click <strong>More info</strong>, then <strong>Run anyway</strong>. Windows shows this for new apps that are not code-signed yet. The installer is open source and you can read every line on GitHub.'],
      ['What is Millennium?', 'Millennium is a free, open-source loader that lets Steam use custom themes. The installer downloads it from its official GitHub page for you, so you don\'t need to set anything up.'],
      ['Can I add or remove themes later?', 'Yes. Press <strong>THEMES</strong> in Steam\'s top bar to switch looks or turn them on and off. To remove everything, run the installer again and choose Uninstall.'],
      ['Is it safe? Does it touch my account?', 'It never reads or changes your account, password or games. It only adds the theme folder and Millennium\'s theme settings on your PC.'],
      ['Does it work on Steam Deck and Linux?', 'Yes. Install <strong>Millennium</strong> first (steambrew.app), then in Desktop Mode paste the one-line command from the top of this page into Konsole. No sudo needed.'],
      ['Arabic or English?', 'Both. The installer and every theme work in Arabic and English, and you can switch any time.'],
    ],
    endTitle: 'Make Steam <em>yours.</em>', endLx: 'Steam Deck / Linux',
    faqMore: 'Something else?', faqMoreLink: 'Ask on GitHub',
    footLabel: 'Links', footNote: 'Not affiliated with Valve. Steam is a trademark of Valve Corporation.',
    footGithub: 'Source on GitHub', footLicense: 'MIT license',
    credits: 'Includes <a href="https://github.com/SpaceTheme/Steam" rel="noopener">SpaceTheme</a> and <a href="https://github.com/kuska1/Material-Theme" rel="noopener">Material Theme</a>, both MIT licensed. Theme loader: <a href="https://github.com/SteamClientHomebrew/Millennium" rel="noopener">Millennium</a>.',
  },
  ar: {
    docTitle: 'رف الألعاب: 16 شكلًا جديدًا لمكتبة ستيم',
    docDesc: 'ستة عشر ثيم لمكتبة ستيم والمتجر: رف خشب، دوّار نيون، متجر أسطوانات، شاشة أركيد وغيرها. مجاني لويندوز وستيم ديك ولينكس، بالعربي والإنجليزي.',
    skip: 'انتقل إلى المحتوى', brand: 'رف الألعاب', navLabel: 'القائمة', navThemes: 'الثيمات', navFeatures: 'المميزات', navInstall: 'التثبيت', navFaq: 'أسئلة',
    langSwitch: 'Switch to English', langOther: 'English',
    dlShort: 'تحميل', dlAria: 'تحميل مثبّت رف الألعاب لويندوز',
    over: 'ثيمات لستيم', overCount: '16 شكلًا',
    heroTitle: 'كل ألعابك،<br>على رفٍّ يليق بها.',
    heroLead: 'ثيمات مصنوعة بعناية لمكتبة ستيم والمتجر: رف خشب، دوّار نيون، متجر أسطوانات من السبعينات، شاشة أركيد. بدّل الشكل بضغطة وحدة. بالعربي والإنجليزي.',
    platLabel: 'النظام', tabLx: 'ستيم ديك / لينكس',
    dlBig: 'تحميل لويندوز', dlSub: 'مثبّت مجاني · دقيقة تقريبًا', allReleases: 'كل الإصدارات',
    lxText: 'في وضع سطح المكتب، افتح Konsole (أو أي طرفية) والصق هالسطر:', lxCopy: 'نسخ', lxCopied: 'تم النسخ',
    lxNote: 'يحتاج Millennium مثبّت قبل (محمّل الثيمات المجاني من steambrew.app). بدون sudo، وما يلمس شي برا مجلدك. ملفات الثيم بس: GameShelf-Theme.zip في صفحة الإصدارات.',
    factsLabel: 'المتطلبات', fWin: 'ويندوز 10/11', fDeck: 'ستيم ديك', fLinux: 'لينكس', fFree: 'مجاني', fSteam: 'يحتاج ستيم',
    nowLabel: 'على الجدار الآن', nowAria: 'اعرض {name} في المعرض',
    thKicker: 'المجموعة', thTitle: 'ستة عشر شكلًا.<br><em>بينها ضغطة وحدة.</em>',
    thLead: 'ثلاثة عشر ثيم أصلي من رف الألعاب، وثلاثة ثيمات محبوبة من المجتمع. كلها تلبّس المكتبة والمتجر.',
    groupCore: 'ثيمات رف الألعاب', groupExtra: 'مضمّنة أيضًا', railLabel: 'كل الثيمات',
    viewLabel: 'العرض', tabLib: 'المكتبة', tabStore: 'المتجر', soon: 'المعاينة قريبًا', soonSub: 'موجود في المثبّت',
    altLib: 'ثيم {name}: مكتبة ستيم', altStore: 'ثيم {name}: متجر ستيم',
    prev: 'الثيم السابق', next: 'الثيم التالي', keys: 'للتنقل', show: 'اعرض {name}',
    ftKicker: 'داخل ستيم', ftTitle: 'جزء من ستيم،<br><em>مو قشرة فوقه.</em>',
    fa1: 'مكتبتك، بذوقك.', fa2: 'اضغط زر الثيمات في الشريط العلوي لستيم واختر شكل ثاني. يتبدّل فورًا في كل النوافذ المفتوحة، بدون إعادة تشغيل ولا إعادة تثبيت.',
    altSwitch: 'ثيم نيون كوفر فلو في مكتبة ستيم', pickerH: 'الثيمات',
    fb1: 'الإنجازات، في كل مكان.', fb2: 'تقدّمك يظهر جنب كل لعبة، في الصفحة الرئيسية ولوحات الألعاب. نفس العدّاد، وكل ثيم يلبّسه ألوانه.',
    fc1: 'ستيم كامل، بنفس الستايل.', fc2: 'مو بس الصفحة الرئيسية. المتجر وقائمة الأمنيات والملفات الشخصية وقائمة الأصدقاء والدردشة، كلها تمشي مع الثيم اللي تختاره.',
    tg1: 'المتجر', tg2: 'قائمة الأمنيات', tg3: 'الملفات الشخصية', tg4: 'الأصدقاء والدردشة', tg5: 'صفحات الألعاب', altStoreFan: 'متجر ستيم بثيم المعرض الزجاجي',
    fd1: 'عربي وإنجليزي.', fd2: 'كل الثيمات والمثبّت تنقرا من اليمين لليسار صح، بخط عربي حقيقي. وتبدّل اللغة أي وقت.',
    altInstaller: 'مثبّت رف الألعاب، خطوة اختيار الثيمات',
    fe1: 'Big Picture وستيم ديك.', fe2: 'ثبّته على الديك من وضع سطح المكتب بسطر واحد. وثيماتك تمشي معك.',
    inKicker: 'التثبيت', inTitle: 'دقيقة تقريبًا،<br><em>من البداية للنهاية.</em>',
    s1t: 'حمّل', s1p: 'ملف مثبّت صغير واحد. مجاني، بدون حساب ولا تسجيل.',
    s2t: 'شغّله', s2p: 'إذا ما عندك Millennium (أداة مجانية مفتوحة المصدر لتشغيل ثيمات ستيم) يثبّته لك، وبعدها يعيد تشغيل ستيم.',
    s3t: 'اختر ثيماتك', s3p: 'علّم على الأشكال اللي تعجبك. وتقدر تغيّر رأيك أي وقت من زر الثيمات داخل ستيم.',
    tipT: 'إذا ويندوز قال "Windows protected your PC"',
    tipP: 'اضغط <strong>More info</strong> (مزيد من المعلومات) ثم <strong>Run anyway</strong> (تشغيل على أي حال). ويندوز يعرض هذي الرسالة للبرامج الجديدة اللي ما عندها توقيع رقمي بعد. المثبّت مفتوح المصدر وكل سطر فيه على GitHub.',
    inDeck: 'عندك ستيم ديك أو لينكس؟', inDeckLink: 'خذ أمر التثبيت',
    faqKicker: 'معلومات مفيدة', faqTitle: 'أسئلة',
    faq: [
      ['ويندوز يقول "Windows protected your PC"، وش أسوي؟', 'اضغط <strong>More info</strong> (مزيد من المعلومات) ثم <strong>Run anyway</strong> (تشغيل على أي حال). ويندوز يعرض هذي الرسالة للبرامج الجديدة اللي ما عندها توقيع رقمي بعد. المثبّت مفتوح المصدر وكل سطر فيه موجود على GitHub.'],
      ['وش هو Millennium؟', 'Millennium أداة مجانية ومفتوحة المصدر تخلّي ستيم يقبل الثيمات. المثبّت يحمّله لك من صفحته الرسمية على GitHub، فما تحتاج تسوي شي بنفسك.'],
      ['أقدر أضيف أو أشيل ثيمات بعدين؟', 'أكيد. اضغط زر <strong>الثيمات</strong> في الشريط العلوي لستيم وبدّل بينها أو شغّلها وطفّها. ولحذف كل شي شغّل المثبّت مرة ثانية واختر إزالة التثبيت.'],
      ['هل هو آمن؟ هل يلمس حسابي؟', 'ما يقرأ ولا يغيّر حسابك أو كلمة المرور أو ألعابك. كل اللي يسويه أنه يضيف مجلد الثيم وإعدادات الثيم في Millennium على جهازك.'],
      ['يشتغل على ستيم ديك ولينكس؟', 'إي نعم. ثبّت <strong>Millennium</strong> أول (من steambrew.app)، وبعدها في وضع سطح المكتب الصق أمر التثبيت اللي فوق في Konsole. ما يحتاج sudo.'],
      ['عربي ولا إنجليزي؟', 'الاثنين. المثبّت وكل الثيمات تشتغل بالعربي والإنجليزي، وتقدر تبدّل أي وقت.'],
    ],
    endTitle: 'خلّ ستيم <em>على ذوقك.</em>', endLx: 'ستيم ديك / لينكس',
    faqMore: 'عندك سؤال ثاني؟', faqMoreLink: 'اسأل على GitHub',
    footLabel: 'روابط', footNote: 'غير تابع لشركة Valve. ستيم علامة تجارية لشركة Valve.',
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
const byId = (id) => THEMES.find((x) => x.id === id);
const rtl = () => document.documentElement.dir === 'rtl';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const pad = (n) => String(n).padStart(2, '0');

/* ===== links ===== */
$$('.js-dl').forEach((a) => { a.href = DOWNLOAD_URL; });
$$('.js-releases').forEach((a) => { a.href = RELEASES_URL; });
$$('.js-repo').forEach((a) => { a.href = REPO_URL; });
$$('.js-issues').forEach((a) => { a.href = REPO_URL + '/issues'; });
$$('.js-license').forEach((a) => { a.href = LICENSE_URL; });

/* ===== platform switch: Windows | Steam Deck / Linux ===== */
const tabs = [$('#tabWin'), $('#tabLx')];
function setPlatform(i, focus) {
  tabs.forEach((tb, k) => {
    const on = k === i;
    tb.setAttribute('aria-selected', String(on)); tb.tabIndex = on ? 0 : -1;
    $('#' + tb.getAttribute('aria-controls')).hidden = !on;
  });
  $('.seg').dataset.on = String(i);
  if (focus) tabs[i].focus();
}
tabs.forEach((tb, i) => {
  tb.addEventListener('click', () => setPlatform(i));
  tb.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault(); setPlatform(i === 0 ? 1 : 0, true);
  });
});
// Linux / Steam Deck visitors start on their own tab
if (/Linux/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent)) setPlatform(1);
['#toLinux', '#toLinux2'].forEach((s) => $(s).addEventListener('click', () => setPlatform(1)));

/* Steam Deck / Linux: copy the one-line install command */
(() => {
  const b = $('#lxCopy'), c = $('#lxCmd');
  b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(c.textContent.trim()); } catch (e) { const r = document.createRange(); r.selectNodeContents(c); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    b.textContent = t('lxCopied'); b.classList.add('is-done');
    setTimeout(() => { b.textContent = t('lxCopy'); b.classList.remove('is-done'); }, 1800);
  });
})();

/* ===== hero wall: columns of real screenshots drifting on a tilted plane ===== */
const wall = $('#wall'), hero = $('.hero');
const SHOTS = THEMES.flatMap((th) => views(th).map((v) => ({ id: th.id, v })))
  .filter((s) => s.id !== 'material' && s.id !== 'original'); // keep the wall to Game Shelf looks
let wallCols = 0;
function buildWall() {
  const w = innerWidth, cols = w < 700 ? 3 : w < 1200 ? 4 : 5;
  if (cols === wallCols) return; wallCols = cols;
  // deal the shots out so neighbours differ; each column is repeated once for a seamless loop
  const per = Math.ceil(SHOTS.length / cols) + 1;
  let html = '';
  for (let c = 0; c < cols; c++) {
    const list = [];
    for (let k = 0; k < per; k++) list.push(SHOTS[(c * 5 + k * 7) % SHOTS.length]);
    const frames = list.map((s, k) => `<figure class="frame" data-id="${s.id}"><img src="${img(s.id, s.v, 1)}" alt="" width="640" height="${s.v === 'library' ? 324 : 360}" decoding="async"${c > 1 && k > 1 ? ' loading="lazy"' : ''}></figure>`).join('');
    html += `<div class="col" style="--d:${46 + (c % 3) * 9}s;--o:${-(c * 7) % 23}s"><div class="col__track${c % 2 ? ' is-down' : ''}">${frames}${frames}</div></div>`;
  }
  wall.innerHTML = html;
  $$('img', wall).forEach((im) => { if (im.complete) im.classList.add('is-in'); else im.addEventListener('load', () => im.classList.add('is-in'), { once: true }); });
  markFeatured();
}
let featI = 0, featTimer = null;
const FEAT_MS = 6000;
function markFeatured() {
  const th = byId(HERO_IDS[featI]);
  hero.style.setProperty('--wash', th.c);
  $$('.frame', wall).forEach((f) => f.classList.toggle('is-feat', f.dataset.id === th.id));
  $('#nowName').textContent = nameOf(th);
  $('#now').setAttribute('aria-label', fmt(t('nowAria'), { name: nameOf(th) }));
  const bar = $('#nowBar'); bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
}
function feature(i) { featI = (i + HERO_IDS.length) % HERO_IDS.length; markFeatured(); }
function startFeature() {
  clearInterval(featTimer);
  hero.classList.toggle('is-still', reduced.matches);
  if (reduced.matches) return;
  featTimer = setInterval(() => { if (!document.hidden && !hero.classList.contains('is-paused')) feature(featI + 1); }, FEAT_MS);
}
$('#now').addEventListener('click', () => {
  select(THEMES.findIndex((x) => x.id === HERO_IDS[featI]));
  $('#themes').scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth' });
});
// pause the drift when the hero is off screen
if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => hero.classList.toggle('is-paused', !en.isIntersecting)).observe(hero);
let rsz; addEventListener('resize', () => { clearTimeout(rsz); rsz = setTimeout(buildWall, 200); });

/* ===== showcase viewer ===== */
const viewer = $('#viewer'), stage = $('#stage'), rail = $('#rail');
let cur = 0, view = 'library', front = 'a', drawId = 0;
function renderRail() {
  rail.setAttribute('aria-label', t('railLabel'));
  const item = (th) => {
    const i = THEMES.indexOf(th), v = views(th);
    const media = v.length
      ? `<img src="${img(th.id, v[0], 1)}" alt="" width="640" height="${v[0] === 'library' ? 324 : 360}" loading="lazy" decoding="async">`
      : `<span class="soonthumb"></span>`;
    return `<button type="button" class="rail__item" data-i="${i}" style="--c:${th.c}" aria-pressed="${i === cur}" aria-label="${fmt(t('show'), { name: nameOf(th) })}">
      <span class="rail__media">${media}</span><span class="rail__name"><i></i>${nameOf(th)}</span></button>`;
  };
  const core = THEMES.filter((x) => !x.extra), extra = THEMES.filter((x) => x.extra);
  rail.innerHTML = `<div class="rail__group"><p class="rail__label">${t('groupCore')}<span>${core.length}</span></p><div class="rail__row">${core.map(item).join('')}</div></div>
    <div class="rail__group rail__group--extra"><p class="rail__label">${t('groupExtra')}<span>${extra.length}</span></p><div class="rail__row">${extra.map(item).join('')}</div></div>`;
}
rail.addEventListener('click', (e) => { const b = e.target.closest('.rail__item'); if (b) select(+b.dataset.i); });

function soonHTML(th) {
  return `<div class="soon soon--${th.id}" style="--c:${th.c}"><div class="soon__art"></div>
    <div class="soon__txt"><p class="soon__k">${t('soon')}</p><p class="soon__n">${nameOf(th)}</p><p class="soon__s">${t('soonSub')}</p></div></div>`;
}
function drawStage(instant) {
  const th = THEMES[cur], v = views(th);
  if (!v.includes(view)) view = v[0] || 'library';
  const my = ++drawId;
  const back = front === 'a' ? 'b' : 'a';
  const layer = $(`[data-layer="${back}"]`, stage);
  const swap = () => {
    if (my !== drawId) return;
    $$('.stage__layer', stage).forEach((l) => l.classList.toggle('is-on', l === layer));
    front = back;
  };
  if (!v.length) { layer.innerHTML = soonHTML(th); swap(); return; }
  const src = img(th.id, view), alt = fmt(t(view === 'library' ? 'altLib' : 'altStore'), { name: nameOf(th) });
  layer.innerHTML = `<img class="stage__blur" src="${img(th.id, view, 1)}" alt="" aria-hidden="true"><img class="stage__img" src="${src}" alt="${alt}">`;
  const im = $('.stage__img', layer);
  (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(swap);
  if (instant) swap();
}
function drawInfo() {
  const th = THEMES[cur], v = views(th);
  viewer.style.setProperty('--vibe', th.c);
  $('#vIndex').textContent = `${pad(cur + 1)} / ${THEMES.length}`;
  $('#vGroup').textContent = th.extra ? t('groupExtra') : t('groupCore');
  $('#vName').textContent = nameOf(th);
  $('#vDesc').textContent = descOf(th);
  $$('.toggle__b', viewer).forEach((b) => {
    const has = v.includes(b.dataset.view);
    b.disabled = !has; b.setAttribute('aria-pressed', String(has && b.dataset.view === view));
  });
  $$('.rail__item', rail).forEach((b) => {
    const on = +b.dataset.i === cur;
    b.setAttribute('aria-pressed', String(on));
    if (on) {
      // bring the active item into view inside the rail only (never scroll the page)
      const row = b.parentElement, r = b.getBoundingClientRect(), rr = row.getBoundingClientRect();
      if (r.left < rr.left || r.right > rr.right) row.scrollBy({ left: (r.left + r.width / 2) - (rr.left + rr.width / 2), behavior: reduced.matches ? 'auto' : 'smooth' });
    }
  });
}
function select(i, instant) {
  cur = (i + THEMES.length) % THEMES.length;
  const v = views(THEMES[cur]); if (!v.includes(view)) view = v[0] || 'library';
  drawInfo(); drawStage(instant);
  // warm the neighbours
  [cur - 1, cur + 1].forEach((k) => { const n = THEMES[(k + THEMES.length) % THEMES.length]; const nv = views(n).includes(view) ? view : views(n)[0]; if (nv) new Image().src = img(n.id, nv); });
}
const step = (d) => select(cur + d);
$('#vPrev').addEventListener('click', () => step(-1));
$('#vNext').addEventListener('click', () => step(1));
$$('.toggle__b', viewer).forEach((b) => b.addEventListener('click', () => { view = b.dataset.view; drawInfo(); drawStage(); }));
// arrow keys browse while the viewer is on screen (and nothing else wants the keys)
let viewerVisible = false;
if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { viewerVisible = en.intersectionRatio > 0.4; }, { threshold: [0, 0.4, 0.8] }).observe(stage);
document.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const tg = e.target;
  if (tg.closest && (tg.closest('input, textarea, [role="tablist"]') || tg.isContentEditable)) return;
  if (!viewerVisible && !viewer.contains(tg)) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); step(rtl() ? -1 : 1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); step(rtl() ? 1 : -1); }
});
// swipe on touch screens
(() => {
  let x0 = null;
  stage.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') x0 = e.clientX; });
  stage.addEventListener('pointerup', (e) => {
    if (x0 == null) return; const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) step((dx < 0 ? 1 : -1) * (rtl() ? -1 : 1));
  });
})();

/* ===== feature A: the little THEMES picker ===== */
function renderPicker() {
  const ids = ['classic', 'glass', 'neon', 'vinyl', 'arcade', 'cork'];
  $('#pickerList').innerHTML = ids.map((id) => { const th = byId(id); return `<li class="${id === 'neon' ? 'is-on' : ''}" style="--c:${th.c}"><i></i>${nameOf(th)}${id === 'neon' ? '<svg><use href="#i-check"/></svg>' : ''}</li>`; }).join('');
}

/* ===== closing strip ===== */
function buildStrip() {
  const ids = ['vinyl-library', 'arcade-store', 'cork-library', 'terminal-library', 'magazine-store', 'vault-library', 'cupertino-store', 'neon-store'];
  const row = (list) => { const one = list.map((s) => `<img src="site/img/thumb/${s}.jpg" alt="" width="640" height="340" loading="lazy" decoding="async">`).join(''); return one + one; };
  const tracks = $$('.end__track');
  tracks[0].innerHTML = row(ids);
  tracks[1].innerHTML = row(['glass-library', 'vinyl-store', 'classic-library', 'space-library', 'arcade-library', 'cork-store', 'magazine-library', 'cyberpunk-store']);
}

/* ===== FAQ ===== */
function renderFaq() {
  const open = $$('.qa.is-open').map((q) => q.dataset.i);
  $('#faqList').innerHTML = t('faq').map(([q, a], i) => `
    <div class="qa${open.includes(String(i)) ? ' is-open' : ''}" data-i="${i}">
      <h3><button type="button" class="qa__q" id="q${i}" aria-expanded="${open.includes(String(i))}" aria-controls="a${i}">
        <span>${q}</span><span class="qa__plus" aria-hidden="true"><svg><use href="#i-plus"/></svg></span></button></h3>
      <div class="qa__a" id="a${i}" role="region" aria-labelledby="q${i}"><div><p>${a}</p></div></div>
    </div>`).join('');
}
$('#faqList').addEventListener('click', (e) => {
  const b = e.target.closest('.qa__q'); if (!b) return;
  const q = b.closest('.qa'), on = !q.classList.contains('is-open');
  q.classList.toggle('is-open', on); b.setAttribute('aria-expanded', String(on));
});

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
  $$('[data-i18n-alt]').forEach((el) => { const v = t(el.dataset.i18nAlt); if (v != null) el.alt = v; });
  $('#langLabel').textContent = t('langOther');
  $('#langLabel').lang = l === 'ar' ? 'en' : 'ar';
  $('#langBtn').setAttribute('aria-label', t('langSwitch'));
  $('.brand').setAttribute('aria-label', t('brand'));
  // the language tile shows the installer in the page's own language
  $('#langShot').src = `site/img/installer-${l === 'ar' ? 'ar' : 'en'}.jpg`;
  renderRail(); renderFaq(); renderPicker();
  drawInfo(); drawStage(true); markFeatured();
}
$('#langBtn').addEventListener('click', () => applyLang(lang === 'ar' ? 'en' : 'ar', true));

/* ===== reveal on scroll ===== */
function observeReveal() {
  const els = $$('.reveal:not(.is-in)');
  if (!('IntersectionObserver' in window) || reduced.matches) { els.forEach((e) => e.classList.add('is-in')); return; }
  const io = new IntersectionObserver((ents) => ents.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach((e) => io.observe(e));
}
const nav = $('#nav');
const onScroll = () => nav.classList.toggle('is-solid', scrollY > 24);
addEventListener('scroll', onScroll, { passive: true }); onScroll();

buildWall();
buildStrip();
applyLang(lang, false);
observeReveal();
startFeature();
reduced.addEventListener?.('change', startFeature);
