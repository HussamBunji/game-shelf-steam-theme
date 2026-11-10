'use strict';
/* The styles this installer offers. `value` is the key in skin.json → Conditions.Style.values.
   group: 'core' (Game Shelf themes, selected by default), 'tints' (Steam Original in another colour, selected by default)
   or 'community' (extra MIT community themes, not selected by default). */
const STYLES = [
  { id: 'classic', value: 'Classic Shelf', ar: 'الرف الكلاسيكي', en: 'Classic Shelf',
    descAr: 'رف خشب ثلاثي الأبعاد، والعلب تنفتح مثل CD', descEn: 'A 3D wooden bookcase; cases open like CDs' },
  { id: 'glass', value: 'Glass Gallery', ar: 'المعرض الزجاجي', en: 'Glass Gallery',
    descAr: 'لوحة عملية: كمّل اللعب وكروت زجاجية', descEn: 'A practical dashboard with glass cards' },
  { id: 'neon', value: 'Neon Coverflow', ar: 'نيون كوفر فلو', en: 'Neon Coverflow',
    descAr: 'دوّار ثلاثي الأبعاد بإضاءة نيون', descEn: 'A 3D carousel with neon lighting' },
  { id: 'terminal', value: 'Terminal', ar: 'الطرفية', en: 'Terminal',
    descAr: 'مكتبتك كجدول أوامر أخضر على أسود', descEn: 'Your library as a green-on-black command table' },
  { id: 'vault', value: 'RPG Vault', ar: 'خزنة المغامر', en: "Adventurer's Vault",
    descAr: 'ألعابك أغراض نادرة في حقيبة', descEn: 'Your games as rarity-framed loot' },
  { id: 'vinyl', value: 'Vinyl Records', ar: 'متجر الأسطوانات', en: 'Vinyl Records',
    descAr: 'جو السبعينات: أسطوانات ومشغّل', descEn: 'A 70s record store with a turntable' },
  { id: 'cork', value: 'Corkboard', ar: 'لوحة الذكريات', en: 'Corkboard',
    descAr: 'صور بولارويد على لوح فلين', descEn: 'Polaroids pinned to a cork board' },
  { id: 'arcade', value: 'Retro Arcade', ar: 'الأركيد', en: 'Retro Arcade',
    descAr: 'شاشة «اختر لعبتك» مثل الأركيد', descEn: 'A "Select your game" arcade screen' },
  { id: 'magazine', value: 'Magazine', ar: 'المجلة', en: 'Magazine',
    descAr: 'غلاف مجلة وأعمدة', descEn: 'An editorial magazine layout' },
  { id: 'cupertino', value: 'Cupertino Dark', ar: 'كوبرتينو الداكن', en: 'Cupertino Dark',
    descAr: 'أسلوب الماك الداكن وزر تشغيل أبيض', descEn: 'The dark Mac / TV-app look' },
  { id: 'cyberpunk', value: 'Cyberpunk', ar: 'سايبربنك', en: 'Cyberpunk',
    descAr: 'أجواء سايبربنك بألوان مريحة للعين وزوايا مقصوصة', descEn: 'Cyberpunk atmosphere in eye-friendly tones, angular HUD panels' },
  { id: 'shelter', value: 'Shelter OS', ar: 'الملجأ', en: 'Shelter OS',
    descAr: 'ملجأ أخضر وجهاز ذراع ترفعه بيدك', descEn: 'A green shelter terminal with a raise-to-view wrist computer' },
  { id: 'xmb', value: 'Crossbar', ar: 'الكونسول', en: 'Crossbar',
    descAr: 'قائمة كونسول فوق موجة متحركة', descEn: 'A console menu over a flowing wave' },
  { id: 'original', value: 'Steam Original', ar: 'ستيم الأصلي', en: 'Steam Original',
    descAr: 'ستيم مثل ما هو، مع زر الثيمات ولوحات المتجر', descEn: 'Stock Steam plus the Themes button and store panels' },
  /* Steam Original in another colour (src/styles/steam-*.css) */
  { group: 'tints', id: 'steam-oled', value: 'Steam OLED Black', ar: 'ستيم الأسود', en: 'Steam OLED Black',
    descAr: 'ستيم الأصلي بخلفية سوداء صافية — مريح للعين ولشاشات OLED', descEn: 'Stock Steam on true black — easy on the eyes and on OLED screens' },
  { group: 'tints', id: 'steam-graphite', value: 'Steam Graphite', ar: 'ستيم الرمادي', en: 'Steam Graphite',
    descAr: 'ستيم الأصلي برمادي داكن محايد بدون الزرقة', descEn: 'Stock Steam in neutral dark grey, without the blue cast' },
  { group: 'tints', id: 'steam-midnight', value: 'Steam Midnight', ar: 'ستيم الكحلي', en: 'Steam Midnight',
    descAr: 'ستيم الأصلي بلون كحلي غامق', descEn: 'Stock Steam in a deep midnight navy' },
  { group: 'tints', id: 'steam-forest', value: 'Steam Forest', ar: 'ستيم الأخضر', en: 'Steam Forest',
    descAr: 'ستيم الأصلي بأخضر الغابات الداكن', descEn: 'Stock Steam in dark forest green' },
  { group: 'tints', id: 'steam-wine', value: 'Steam Wine', ar: 'ستيم العنابي', en: 'Steam Wine',
    descAr: 'ستيم الأصلي بلون عنابي غامق', descEn: 'Stock Steam in deep wine red' },
  { group: 'tints', id: 'steam-royal', value: 'Steam Royal Purple', ar: 'ستيم البنفسجي', en: 'Steam Royal Purple',
    descAr: 'ستيم الأصلي بالبنفسجي الملكي', descEn: 'Stock Steam in royal purple' },
  { group: 'tints', id: 'steam-coffee', value: 'Steam Coffee', ar: 'ستيم القهوة', en: 'Steam Coffee',
    descAr: 'ستيم الأصلي ببني القهوة الدافئ ولمسات كهرمانية', descEn: 'Stock Steam in warm coffee brown with amber highlights' },
  { group: 'tints', id: 'steam-ocean', value: 'Steam Ocean', ar: 'ستيم المحيط', en: 'Steam Ocean',
    descAr: 'ستيم الأصلي بأزرق المحيط المخضر', descEn: 'Stock Steam in deep ocean teal' },
  /* extra community themes (MIT), not selected by default */
  { group: 'community', id: 'space', value: 'SpaceTheme', ar: 'SpaceTheme', en: 'SpaceTheme',
    descAr: 'ثيم المجتمع المشهور، داكن ومرتب (رخصة MIT)', descEn: 'The popular dark community theme (MIT)', credit: 'SpaceTheme authors' },
  { group: 'community', id: 'material', value: 'Material You', ar: 'Material You', en: 'Material You',
    descAr: 'تصميم Material 3 من Google (رخصة MIT)', descEn: "Google's Material 3 design (MIT)" },
];

for (const st of STYLES) if (!st.group) st.group = 'core';

module.exports = { STYLES };
