# Theme Kit — adding a new look to Game Shelf

A theme is **four files** plus one line in the registries (the maintainer does the registries):

| File | What it is |
|---|---|
| `src/styles/<id>.css` | The style's variables, its palette for the SpaceTheme base, its fonts, and every rule that dresses Steam, the store and our panels. Millennium loads it in every Steam window while the style is active. `tools/build.mjs` also copies it into the store pages. |
| `src/layouts/<id>.js` | The library **home design**: a layout module that registers itself. |
| `src/layouts/<id>.css` | CSS for that home design only. It loads in the main window while the style is active. |
| `src/layouts/<id>.preview.css` | The small card art in the THEMES picker (always loaded). |

`<id>` is lowercase letters, digits and dashes, and it is the same in all four files and in `--rf-style-id` / `--rf-layout`.

Reference implementations: `src/styles/glass.css` (variables), `src/styles/classic.css`, and the Gallery / Coverflow layouts inside `src/js/shelf.js` (`GalleryLayout`, `CoverflowLayout`).

---

## 1. `src/styles/<id>.css`

```css
/* ═══ Theme N — <Name> (<Arabic name>) ═══  one line: the idea */
:root {
  --rf-vendor: space;                    /* layout base: SpaceTheme (sidebar, search, centred store) */
  --rf-vendor-skip: options/fonts/;      /* we bring our own fonts */
  --rf-style-id: <id>;
  --rf-layout: <id>;                     /* which home design: src/layouts/<id>.js */

  /* fonts: Latin first, Arabic second (each script picks its own). Google Fonts only. */
  --rf-font-ui: 'Some Latin', 'Some Arabic', 'Segoe UI', sans-serif;
  --rf-font-gf: "family=Some+Latin:wght@400;600;700&family=Some+Arabic:wght@400;600;700";
  --rf-heading-font: 'Display Latin', 'Display Arabic', var(--rf-font-ui);  /* optional display pair, also in --rf-font-gf */

  /* every variable that glass.css defines must be defined here too (--rf-bg, --rf-panel…, --rf-accent…,
     --rf-play-*, --rf-radius…, --rf-card…, --rf-ic-*, --rf-ict-*, --rf-led-rgb, --rf-plate-*) */
}
/* SpaceTheme's colour slots (r, g, b triplets). :root:root beats SpaceTheme's own root.css */
:root:root {
  --st-accent-1: r, g, b;  --st-accent-2: r, g, b;  --st-background: r, g, b;
  --st-color-1 … --st-color-6: r, g, b;   /* 1 sidebar, 2 inputs/buttons, 3 cards, 4 raised, 5/6 borders */
  --st-border-radius: 8px;
}
/* Everything else MUST be scoped, because the store pages carry every style at once: */
html[data-rfs-style="<id>"] .DialogButton { … }
```

Things the style file dresses, always scoped with `html[data-rfs-style="<id>"]`:
- **Steam windows.** Use stable class names only: `.DialogButton`, `.DialogInput`, `.DialogDropDown`, `.DialogCheckbox`, scrollbars (`::-webkit-scrollbar*`), `::selection`. Steam's other class names are hashed and change, so don't target them. Palette, radius and font do the rest through SpaceTheme.
- **Store and community pages:**
  - `.btn_green_steamui`, `.btn_blue_steamui`, `.btnv6_blue_hoverfade`
  - `.store_nav .tab`, `#store_nav_search_term`
  - `.discount_pct`, `.discount_final_price`, `.app_tag`
- **Our own pieces, so they match the theme:**
  - the library filter strip `#rfs-bar.inhome` (`.tb-btn`, `.tb-search`, `.rf-dd-menu`)
  - the store side panels `#rfs-rail` and `#rfs-data`:
    - each panel is made of `section` blocks with an `h4` heading
    - `#rfs-rail` uses `.rr-link`, `.rr-btn`, `.rr-btn.go` and `.rr-app`
    - `#rfs-data` uses `.rd-live` (with `b`, `small` and `.rd-dot`), `.rd-row` (with `.rd-cc`, `.rd-name`, `.rd-kwd`, `.rd-loc`, `.rd-diff`, `.rd-tag`), `.rd-row.home`, `.rd-row.best`, `.rd-fact`, `.rd-link`
  - the header **Quick links** `#rfs-qbtn` / `#rfs-qmenu .ql`
  - the icon tiles via `--rf-ict-*` vars
- Each theme must look and feel **different**, not like a colour swap: different button shapes, borders, heading treatment and panel style.

## 2. `src/layouts/<id>.js`

```js
(function () {
  'use strict';
  const api = window.__rfsLayoutApi;      // provided by shelf.js
  if (!api) return;
  const { T, esc, div, $, ic, icT, cssUrl, first, lazy, fmtPlaytime, fmtAgo, fmtSize, NUM } = api;

  const Layout = {
    fixedHeight: false,       // true → the page doesn't scroll; you get the exact height in render(games, w, h)
    dockInside: true,         // put <div class="rf-dock" data-rfs-dock></div> where the filter strip should sit (right above the games)
    render(games, w, h) {     // games = the filtered + sorted list (ALL owned games, often 900+)
      const el = div('xx');   // build, then api.stage.replaceChildren(el)
      …
      api.stage.replaceChildren(el);
    },
    source(appid) {           // element the CD-case viewer flies from: { el, slot, isSpine: false } or null
      const c = api.stage.querySelector(`[data-appid="${appid}"] .art`);
      return c ? { el: c, slot: c.parentElement, isSpine: false } : null;
    },
    key(e) { return false; }, // optional keyboard nav; return true if handled (arrows, Enter)
    // the theme's OWN way of opening a game (a record on a turntable, a cartridge in a cabinet, a magazine spread…).
    // Without open(), the game opens in the Classic CD-case viewer, which doesn't fit other themes, so every
    // plug-in theme must have one.
    async open(g, sheet, src) {   // sheet = an empty fixed panel exactly over the home design (#rfs-sheet[data-layout="<id>"])
      sheet.innerHTML = `<div class="xx-view">…</div>`;   // a click on the sheet's own background closes it
      $('.xx-view', sheet).append(api.gameActions(g));   // Play / Game page / News / Store / Options, already wired
      // animate in: Web Animations or a CSS class, ≤ 600 ms; src = Layout.source(appid) if it opened from an item
    },
    async close(sheet, g) { /* optional exit animation (≤ 400 ms); the core empties the sheet afterwards */ },
  };
  api.register('<id>', Layout);
})();
```

**Game objects (`g`)** have these fields:
- `appid`, `name`, `installed`, `playtimeMin`, `playtime2wksMin`, `lastPlayed` (unix seconds), `sizeOnDisk` (bytes), `genres` (array of tag names), `releaseDate`
- `images.capsule[]` (600×900 portrait), `images.header[]` (460×215, small), `images.hero[]` (1920 px, huge), `images.logo[]`

The images arrive lazily, so paint them inside `lazy()`:
```js
el.dataset.appid = g.appid;            // required by lazy()
lazy(el, g => el.style.setProperty('--img', cssUrl(first(g.images.header) || first(g.images.capsule))));
```

**Actions:**
- `api.openGame(g, Layout.source(g.appid))` opens the game: your `open(g, sheet, src)` if you have one (you should), otherwise the CD-case viewer. Open on a **single click**, with no waiting for a possible double click.
- Inside your panel: `api.gameFacts(g)` gives `[label, value]` pairs (play time, last played, size, developer, release), `api.gameDesc(g)` the short description, `api.gameActions(g)` a `<div class="rf-acts">` with wired `button.rf-act[data-act=play|details|news|store|more]` (`more` = the game menu) (style them in your layout CSS under `#rfs-sheet[data-layout="<id>"]`), and `api.closeGame()` closes the panel. Esc and a click on the empty background close it too. Put `data-close` on your own close button.
- `api.launch(g)` plays the game, or installs it.
- `api.openDetails(appid)` opens **our game page** (src/js/hub.js: overview, news + reader, achievements, friends, DLC, community links, trading cards — loaded on first use, dressed per style in src/css/hub.css). `api.openHub(g, tab)` opens it on a tab (`overview|news|ach|friends|dlc`); `api.openSteamPage(appid)` still opens Steam's own page; `api.openStore(appid)` opens the store page.
- **Game menu:** a right-click on any element with `data-appid` (in your home design or your game panel), the Menu key / Shift+F10, or the `more` button opens Steam's game options (favourites, collections, manage, properties). Its panels are `.rf-dd-menu` inside `#rfs-gmenu`, so your style's dropdown rules apply when written as `:is(#rfs-bar, #rfs-gmenu) .rf-dd-menu …`. Give every game element `data-appid`.
- `api.running()` returns a `Set` of the appids that are running.
- `api.showTip(g, x, y)` / `api.hideTip()` show and hide the hover card.
- `api.sfx('tick')` plays a sound.
- `api.toast(text)` shows a toast message.

**Fonts:** skin.js forces the theme's UI font on every element with `!important`, so any display or heading font in your layout CSS needs `!important` too.

**Helpers:**
- `api.T(arabic, english)` returns the text for the current language. Never hard-code one language.
- `api.LTR` is true in English.
- Format with `api.fmtPlaytime(min)`, `api.fmtAgo(ts)`, `api.fmtSize(bytes)` and `api.NUM.format(n)`.

**Icons:** `api.ic(name)` gives an inline SVG; `api.icT(name)` gives the same inside the theme's icon tile. The names are:
search, library, sort, tag, spines, grid, news, volume, mute, palette, undo, play, download, disc, cart, star, starOn, users,
online, image, sliders, refresh, clock, calendar, drive, fire, pulse, check, owned, x, chevL, chevR, chevD, home, gamepad,
percent, trend, sparkle, hourglass, ticket, filter, gift, receipt, external, globe, chart, db, coins, timer, trophy, jump,
info, puzzle, cpu, msg, layers, medal.
**Never use emoji.**

## 3. `src/layouts/<id>.css`

Scope every rule under `#rfs[data-layout="<id>"]` (shelf.js sets `data-layout` on `#rfs`), and the game panel under `#rfs-sheet[data-layout="<id>"]` (it lives outside `#rfs`).
- Use `var(--font)` / `var(--rf-heading-font)` and the theme's `--rf-*` colours.
- Use logical properties (`margin-inline-start`, `inset-inline-end`, `text-align: start`), because the UI is RTL in Arabic and LTR in English (`html[data-rfs-lang="en"]`).

## 4. `src/layouts/<id>.preview.css`

The picker card is 150 px tall. It contains `<div class="tp-prev tp-<id>">` holding `<i class="pv-a">`, `<i class="pv-b">`, `<i class="pv-c">` and twelve `<i class="pv-i" style="--i:0…11">`, all `position:absolute`. Draw a miniature of the home design with plain CSS shapes and gradients, no images. Scope under `#rfs-themes .tp-<id>`.

---

## Performance rules (measured — breaking them made Steam crawl)

1. **No per-item 3D.** No `perspective` or `preserve-3d` on grids, and no `transform` on every card at rest. Transform only the hovered item.
2. **No `backdrop-filter`** on repeated or fixed elements. Use semi-opaque colours.
3. **No `content-visibility: auto`.** Re-styling on scroll-in cost more than it saved.
4. **No infinite animations on large areas.** A small element animating `opacity` or `transform` is fine.
5. **Small images for small things.** Use `header` for anything under ~250 px, `capsule` for portrait covers, and `hero` at most once (a banner).
6. **Keep each item to ~6 elements or fewer.** Libraries have 900+ games.
7. **Write to the DOM only in `render()` / on user input.** Never in timers. `classList.add` on a class that is already there still counts as a DOM change, so use `classList.toggle(x, bool)`.
8. **No filters (`filter: blur/drop-shadow/saturate`) on repeated elements.**
9. **Don't load fonts or libraries yourself.** The style file's `--rf-font-gf` does it.
10. **Anything you redraw every frame goes in a shadow root.** The community base has page-wide `:has()` rules (one even
    matches an SVG path's `d`), so a DOM change in the page re-checks them up to `<html>` and restyles every icon:
    the Crossbar waves cost ~9 ms a frame in the page and ~0.2 ms in a shadow root (see `xmb.js` `waveHost`).
11. **No `html:has(…)` / `body:has(…)` rules of your own.** Put a class on `<html>` from JS instead.
12. **Your `render()` is skipped when nothing changed.** Coming back to the library home re-attaches the design you
    built last time. Don't count on `render()` running on each visit (timers check `api.root.classList.contains('on')`).

## UX rules (the owner's)

- **Built for a PC desktop.** Normal sizes, nothing oversized, no zoom. Easy navigation, with arrow keys where they make sense.
- **Every owned game must be reachable** by vertical scrolling or keyboard. Never force the user to walk sideways through hundreds of games.
- **One list, one search, one filter row.** On the home page the design IS the game list (Steam's own left list is hidden there), and the strip in `data-rfs-dock` is the only search. If your design has its own chips (genres, rarity…), put them in the same panel: `<div class="rf-dock rf-merge" data-rfs-dock><div class="xx-chips">…</div></div>`. Never a second bar.
- **Hover is instant.** Highlight with CSS `:hover`. If hovering updates a preview, do it on the next animation frame (no timers over ~40 ms) and use the small `header` image so it appears at once.
- **No emoji anywhere.** Use the themed icons.
- **Arabic and English both work,** with text from `api.T`.
- **The look must be premium and the design distinct**: a different layout and different buttons, not a colour swap.
