'use strict';
/* The styles this installer offers. `value` is the key in skin.json → Conditions.Style.values.
   group: 'core' (Game Shelf themes, selected by default) or 'community' (extra MIT community themes, not selected by default). */
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
  /* extra community themes (MIT), not selected by default */
  { group: 'community', id: 'space', value: 'SpaceTheme', ar: 'SpaceTheme', en: 'SpaceTheme',
    descAr: 'ثيم المجتمع المشهور، داكن ومرتب (رخصة MIT)', descEn: 'The popular dark community theme (MIT)', credit: 'SpaceTheme authors' },
  { group: 'community', id: 'material', value: 'Material You', ar: 'Material You', en: 'Material You',
    descAr: 'تصميم Material 3 من Google (رخصة MIT)', descEn: "Google's Material 3 design (MIT)" },
];

for (const st of STYLES) if (!st.group) st.group = 'core';

module.exports = { STYLES };
