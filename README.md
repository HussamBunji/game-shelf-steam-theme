# Game Shelf — a Millennium theme for Steam · رف الألعاب

Six looks for the Steam desktop client, switchable from a **THEMES** item in Steam's own top navigation.
English by default, with a full Arabic interface one click away.

| Style | Library home | Rest of Steam |
|---|---|---|
| **Classic Shelf** | A 3D wooden bookcase; open any game like a CD case | SpaceTheme's layout in walnut and brass |
| **Glass Gallery** | A "continue playing" hero, genre chips, and a card grid | SpaceTheme's layout in Steam navy with frosted glass |
| **Slate** | Your last-played game on top, every game below it, most recent first | SpaceTheme's layout in calm blue-slate with one teal accent; all colours in one palette block in `src/styles/slate.css` |
| **Neon Coverflow** | A 3D carousel, with your whole library as a grid below it | SpaceTheme's layout in ink violet with cyan glow |
| **Steam Original** | Steam's own home | Stock Steam; only THEMES and the store panels remain |
| **SpaceTheme** | Steam's own home | The community theme [SpaceTheme](https://github.com/SpaceTheme/Steam), unmodified |
| **Material You** | Steam's own home | The community theme [Material Theme](https://github.com/kuska1/Material-Theme), unmodified |

### Features
- **The whole library on the home page** (all games, installed, favourites or any collection), with **one filter strip right above the games**: search, source, sort and view.
- **Ctrl + K** anywhere opens the search. Type a game to open it (Enter) or play it (Ctrl + Enter), or type a command such as store, downloads or settings.
- **Store game pages use the empty space beside the page.** Each style draws these panels in its own look:
  - live player count
  - the game's price in 6 Steam regions (Saudi Arabia, UAE, Kuwait, US, Euro area, UK), converted to SAR, with the cheapest highlighted
  - quick facts
  - one-click links to SteamDB, SteamCharts, IsThereAnyDeal, GG.deals, HowLongToBeat and PCGamingWiki
- A **Quick links** menu in the store header: Specials, Top Sellers, Wishlist, Cart, and more.
- Icons are hand-made SVGs that each style dresses differently. There are no emoji.
- **Arabic for the whole of Steam.** Steam itself ships no Arabic interface, so when you pick العربية:
  - the theme swaps in its own Arabic translation of about 3,200 of Steam's interface strings, covering the library, game pages, downloads, menus, friends, notifications and properties;
  - the store and community switch to Valve's official Arabic version;
  - strings that aren't translated yet stay in English.
- **Each style has its own font pair (Latin + Arabic)**, loaded from Google Fonts:

| Style | Latin font | Arabic font |
|---|---|---|
| Classic Shelf | Lora | Noto Naskh Arabic |
| Glass Gallery | Plus Jakarta Sans | IBM Plex Sans Arabic |
| Neon Coverflow | Exo 2 | Reem Kufi |
| Steam Original | Motiva Sans | Noto Sans Arabic |
| SpaceTheme | Be Vietnam Pro | Readex Pro |
| Material You | Roboto | Rubik |

- **Light and smooth.** Scrolling the library home was measured with `tools/perf.mjs`:

| Style | Before | After |
|---|---|---|
| Classic Shelf | ~10 FPS | ~95 FPS |
| Glass Gallery | ~24 FPS | ~135 FPS |

  Background CPU use while idle dropped about 3×. The changes behind this:
  - the shelves are drawn flat with painted depth instead of ~900 3D layers;
  - spines use small images;
  - there is no blur on every card;
  - the community theme's styling for Steam's *own* home page is switched off while our home design covers it;
  - nothing touches the page while it's idle.

## Install

**Ask an AI agent.** Open this folder in Claude Code or Codex and say *"install this Steam theme"*. It follows [AGENTS.md](AGENTS.md).

**By hand (Windows):**
1. Install **Millennium** from the official site, https://steambrew.app.
2. Download this repository (Code → Download ZIP) and unzip it.
3. Quit any running game. Then either:
   - run `python install_theme.py`, which closes Steam, installs the theme and reopens Steam, or
   - copy `skin.json` and the `src` folder into `Steam\millennium\themes\rf-shelf\`, then pick **Game Shelf** under Steam → Settings → Millennium → Themes.
4. Click **THEMES** in Steam's top bar to choose a style or switch to العربية.

To uninstall, run `python install_theme.py --remove`, or pick another theme in Millennium's settings.

> **Privacy:** the store panels only call `api.steampowered.com` (players), `store.steampowered.com/api/appdetails` (regional prices)
> and `open.er-api.com` (exchange rates). Results are cached locally, and no personal data is sent.

---

## بالعربي

ثيم لستيم (يحتاج Millennium) فيه 6 تصاميم تختارها من **THEMES** في شريط ستيم العلوي، والواجهة إنجليزي أو عربي بضغطة:
- **Classic / Glass / Neon**: تصاميمنا (رف خشب، معرض زجاجي، نيون) فوق ترتيب SpaceTheme العملي بألوان كل ثيم.
- **Steam Original**: ستيم الأصلي.
- **SpaceTheme** و **Material You**: ثيمات المجتمع الأصلية (رخصة MIT).

### المميزات
- كل ألعابك في الصفحة الرئيسية، مع شريط فلاتر فوق الألعاب مباشرة.
- **Ctrl + K** للبحث السريع من أي مكان.
- في صفحة اللعبة بالمتجر، على الجنب:
  - عدد اللاعبين الحين
  - السعر في 6 مناطق بالريال السعودي
  - معلومات سريعة
  - روابط SteamDB وغيره
- قائمة **Quick links** في هيدر المتجر.
- **ستيم كامل بالعربي** لما تختار العربية: الثيم يعرّب أكثر من 3,200 نص من واجهة ستيم، والمتجر ينتقل للنسخة العربية الرسمية.
- **لكل ثيم خط إنجليزي وخط عربي** يناسبونه (مثل Lora مع Noto Naskh للرف الكلاسيكي).
- **أخف وأنعم بكثير:** التمرير في الرف الخشبي صار تقريبًا 95 إطار بالثانية بدل 10.

### التركيب
1. ثبّت Millennium من https://steambrew.app.
2. نزّل المشروع (Code → Download ZIP) وفكّه.
3. سكّر أي لعبة شغالة، وبعدها شغّل `python install_theme.py`.
4. اضغط **THEMES** فوق واختر التصميم واللغة.

أو افتح المجلد في Claude Code / Codex وقول له: "ركّب هذا الثيم".

---

## Development

```
skin.json            theme manifest: Style + Language conditions, patches
src/styles/*.css     one variable set per style (--rf-*, plus SpaceTheme's --st-* slots for the styles built on it)
src/lang/*.css       interface language (--rf-lang)
src/lang/steam-ar.json  Arabic for Steam's own interface (token → text; edit this) → steam-ar.js via tools/build.mjs
src/js/skin.js       every Steam window: our chrome restyle when a style needs it, plus the community-theme loader
src/js/shelf.js      main window: home designs, CD-case viewer, filter strip, Ctrl+K, THEMES picker
src/js/webkit.js     store/community: style sync, side panels, Quick links
src/css/*.css        shelf / layouts / icons / flair / webkit
src/vendor/          bundled community themes (MIT) — rebuilt by tools/vendor.mjs from clones in third_party/
tools/               dev tools (Steam must run with -dev for the CDP ones)
```

### After a Steam update
1. Run `tools\steam-dev.cmd` to start Steam with `-dev` (this opens CDP on 127.0.0.1:8080).
2. Run `node tools/diagnose.mjs` to get an OK/FAIL list of everything the theme relies on.
3. Fix what failed. Most fixes are in `SteamAPI` at the top of `src/js/shelf.js`, or in the class keys in `src/js/skin.js`.
4. Run `node tools/sync.mjs <classic|glass|neon|original|space|material>` to copy the theme into Steam and reload its UI.
5. Run `python install_theme.py` to install for real and return Steam to normal mode.

### Updating the bundled community themes
1. Clone (or `git pull`) the theme into `third_party/spacetheme` or `third_party/material`.
2. Run `node tools/vendor.mjs` to rebuild `src/vendor/<id>` and its `rfs-manifest.js` file map from the theme's own `skin.json`.

### Notes
- Millennium injects only the *default* style into web pages. `webkit.js` reads the user's choice (`Core_GetBackendConfig`) and switches the variable set itself, using `webkit-styles.css`, which `node tools/build.mjs` generates.
- Changing a style or the language calls `Core_ChangeCondition` and then `SteamClient.Browser.RestartJSContext()`.
- Changes to `skin.json` need a full Steam restart.

## Credits & license
- MIT — see [LICENSE](LICENSE).
- Bundled: **SpaceTheme for Steam** (SpaceTheme, MIT) and **Material Theme** (kuska1, MIT). See [THIRD_PARTY.md](THIRD_PARTY.md).
- Built on [Millennium](https://steambrew.app).
- `src/lang/steam-ar.json` is an unofficial Arabic translation of Steam's interface text, made for this theme. Steam is a trademark of Valve; this project is not affiliated with Valve.
