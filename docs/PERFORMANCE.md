# Performance log

How fast the themes are on a live Steam, measured. Steam runs with `-dev`, CDP at `http://127.0.0.1:8080`.

## 2026-11-10 — the store felt heavy, even under "Steam Original"

Measured in a hidden Chromium (Steam's user agent, software rendering, warm cache; medians of 2-3 runs, ms of
main-thread time; the script and raw results are not in the repo). "Scroll" = 30 wheel steps down and back.

| Page · style | Load before → after | Scroll before → after | No theme at all (load · scroll) |
|---|---|---|---|
| Store home · Steam Original | 1219 → **459** | 773 → **198** | 461 · 196 |
| Store home · Glass Gallery | 2250 → **1020** | 684 → **211** | |
| Store home · Steam Wine | 1438 → **710** | 949 → **261** | |
| Game page · Steam Original | 1408 → **616** | 1654 → **373** | 740 · 351 |
| Game page · Glass Gallery | 1836 → **1101** | 2272 → **388** | |
| Game page · Steam Wine | 1964 → **1038** | 2095 → **581** | |

### What was slow
1. **Every style's store rules in one file.** `webkit.css` imported `webkit-styles.css` (all 24 styles, 1.2 MB, each
   rule scoped `html[data-rfs-style="…"]`). Parsing was cheap (13 ms); matching was not: selectors are matched right
   to left, so ~3,000 selectors of the other styles were tried against every element on every style pass before the
   `html` test failed — 92 % of all selector-matching time, 26× the cost of one style pass, under every style.
   **Fix:** `tools/build.mjs` writes `src/css/web-styles/<id>.css`; `webkit.js` (`styleCss`) links only the active
   one and swaps it on a live switch. `webkit-styles.css` is now a stub.
2. **`markDiscounts` wrote an attribute, then read the next element's computed style** — one page-wide style pass
   per element (one call: 713 ms on a game page under Glass), every 1.2 s. Now: reads first, writes after; only
   after the page changed (an observer raises a flag); not at all for Original / SpaceTheme / Material.
3. **Quick links re-measured on every scroll frame** (three `elementFromPoint` + forced layouts). Now the place is
   worked out once and the button follows the search box with one measurement per frame.
4. **The page-wide font rule under Steam Original in English** (120-150 ms of style work for Steam's own font).
   Not injected there any more; Arabic keeps it.
5. `syncStyle` (every 3 s) re-ran the tint sync and re-read the style's variables when nothing had changed.

## 2026-11-10 — theme switching (the owner's main complaint: "3-4 seconds until Steam takes the change")

Measured on the owner's PC, 908 games, window on screen, by calling `__rfsShelf.Themes.apply()` and reading
`__rfsShelf.Themes.perf` (ms from the click: `ready` sheet loaded + choice saved, `styled` sheets flipped,
`built` new home design in the DOM, `painted` second frame after that).

| Switch | Before (new design visible) | After (painted) |
|---|---|---|
| Glass → RPG Vault | ~1830 | ~500 |
| Vault → Glass | ~1540 | ~410 |
| Glass → Shelter OS | ~1550 | 810–1020 |
| Shelter / Crossbar → Glass | ~1310 | 510–710 |
| Glass → Crossbar | — | ~300 |

### What was slow
1. **The old home design was restyled for a sheet it would never be shown with.** Glass kept ~9,180 elements in the
   page (two thirds of the whole window). The switch added the new sheet next to the old one, removed the old one and
   rewrote `html[data-rfs-style]`: two or three page-wide style passes over 13,600 elements (~1.1 s main thread).
   **Fix (`shelf.js` `Themes.live`):** the new sheet loads switched off, then ONE step empties the old design,
   flips the sheets, names the style, runs the window's restyle hooks and builds the new design.
2. **Flipping a sheet with the `media` attribute is not immediate.** Chromium fetches the file again and swaps the
   result in later, so for a frame the window had no theme sheet at all (drawn once unstyled, once styled, and the
   first build picked the wrong home design). **Fix:** `sheetOn(link, on)` writes `link.sheet.media.mediaText`,
   which applies in the same task. Used for the theme sheet, the design sheets and SpaceTheme's "home" part.
3. **A new design's CSS was switched on while the old design was still in the page** (one more full pass). It now
   loads off (`loadLayout(id, true)`) and is turned on in the same step.
4. **The ~25 hidden menu windows were restyled right after the main window**, 16 ms apart, on the same thread as
   the new design's first frames. Visible ones follow at once; hidden ones one per idle callback.
5. **Glass built 10 elements per game for the whole library.** A card's light rim and quick-play button are now
   added when the card comes near the screen: 9,182 → ~5,600 elements. Every page-wide style pass in Glass is
   cheaper (the picker opening, a switch to or from it).
6. Fonts: the target style's web fonts are fetched when its card is pointed at (`warmFonts`), so they are in the
   browser cache when the style arrives instead of re-laying the window out a second later.

### Still slow / not done
- Switching between a designed style and the Steam Original family still reloads Steam's interface (SpaceTheme's
  JS rewrites parts of the title bar and cannot be unloaded). Switches inside each family are live.
- The floor is ~250 ms: one style pass over Steam's own ~4,500 elements against its 35,000 rules.

### Menu windows after a switch
Steam sizes each menu's popup window from the menu's measured box. After a live switch the stored box changed but
the hidden window kept its old size, so the menu showed cut off at the end edge with square corners.
`skin.js` `menuFit` re-runs Steam's own positioning when a menu window is shown, after a restyle and when its fonts
arrive. (`PositionPopupWindow()` only takes effect while Steam's main window is on screen.)

## 2026-11-08 — page changes, theme switching, idle cost

### How it was measured
- **Page changes:** `node tools/navperf.mjs [label] [rounds]`. It walks Library home → game page → home → Store → home →
  Downloads → home → game page → Downloads → Store → game page through `SteamUIStore.Navigate` / `steam://url/StoreFrontPage`.
  - **ready** = ms from the navigation call until the page is in the DOM and visible (for home: our design is on, or
    Steam's own home for SpaceTheme).
  - **paint** = ready plus the next painted frame. Median of 2 rounds.
  - **style ms** = `RecalcStyleDuration` over the change plus 1.2 s after it (`Performance.getMetrics`).
  - **long** = the longest long task (`PerformanceObserver('longtask')`).
- **Theme switch:** `window.__rfsShelf.Themes.apply('<Style>')` from the library home.
  - **sheet** = until `apply()` resolves (the new style sheet is in).
  - **design** = until the new home design is in the DOM.
- **Idle:** 5 s on the library home, nothing touched: main-thread ms per second.
- **Scroll:** `tools/perf.mjs` (4 s auto-scroll of the home). Crossbar and Retro Arcade don't scroll.
- Machine: the owner's PC (2560 × 1392 window), 908 games. Numbers vary ±20 % between runs. Compare within a column.

### Before → after

| Style | Home ← page (ready / paint) | Game page (ready / paint) | Store | Downloads | Theme switch (design / paint) | Idle on home (ms/s) | Scroll FPS (slow frames) |
|---|---|---|---|---|---|---|---|
| **SpaceTheme** (baseline) | 140/344 → 153/303 | 77/132 → 70/105 | 61 → 105 | 66 → 68 | 365/639 → 249/493 | 40 → 34 | 105 (12) → 103 (17) |
| Crossbar | 492/624 → **278–380 / 400–430** ¹ | 64/181 → 49/305 | 181 → 118 | 65 → 53 | 850/1123 → 726/817 | **342 → 10–80** ² | — |
| Cupertino Dark | 722/1061 → 643/767 | 101/224 → 77/160 | 120 → 155 | 93 → 79 | **1227/1502 → 528/902** | 67 → 59 | **39 (56) → 61 (25)** |
| Cyberpunk | 768/1117 → 736/875 | 84/115 → 74/217 | 207 → 144 | 94 → 86 | **1283/1565 → 520/787** | 44 → 11 | **45 (64) → 114 (5)** |
| Retro Arcade | 775/976 → 630/789 | 94/124 → 84/167 | 177 → 101 | 70 → 66 | 1578/1780 → 1172/1439 ³ | 34 → 34 | — |
| Shelter OS | 952/1500 → 861/1490 | 167/417 → 177/510 | 269 → 147 | 165 → 150 | 1480/1844 → 1006/1336 | 44 → 11 | 32 (32) → 35 (32) |

Main-thread work per change (style ms, median):

| Style | Home before → after | Game page before → after |
|---|---|---|
| Crossbar | 731 → 279–329 | 392 → 380 |
| Cupertino Dark | 795 → 401 | 363 → 351 |
| Cyberpunk | 774 → 485 | 350 → 344 |
| Retro Arcade | 567 → 403 | 399 → 387 |
| Shelter OS | 1535 → 1277 | 1094 → 1109 |

Longest task on a return to home:

| Style | Before → after (ms) |
|---|---|
| Cupertino Dark | 351 → 220 |
| Cyberpunk | 353 → 325 |
| Retro Arcade | 419 → 228 |
| Crossbar | 161–181 → 150–166 |

¹ The last row was measured after the final two changes (no double tick, no forced re-reads). Timed inside the page,
our design is switched on about 70 ms after Steam changes the route: ~230 ms after the click, against ~160 ms for
Steam's own home.

² Crossbar idle moves between 10 and 80 ms/s because the wave runs only while the home is on screen. Before, the wave
alone cost ~270 ms/s of style work.

³ The first switch to a style still fetches and parses its files. Pointing at a card in the picker now preloads them:
switching to Cupertino after a hover took 717 ms including the click, against 1502 ms before.

### What was slow (found with traces, not guessed)
1. **Crossbar's waves restyled the whole window 30 times a second.**
   - SpaceTheme's `menu.custom.css` has a `:has([d="M12.41…"])` rule, so any change to an SVG path's `d` attribute
     re-checks `:has()` on every ancestor up to `<html>`.
   - Rules such as `fluent.css` `*>:has(> svg)` then restyle every icon.
   - Cost: ~9 ms per frame, ~34 % of the main thread at rest.
   - **Fix:** the wave SVG lives in a shadow root (`xmb.js` `waveHost`, CSS moved into `WAVE_CSS`). Changes inside a
     shadow root don't reach the page's `:has()` rules. The drawing is identical. Style work went from 268 to ~4 ms/s.
2. **SpaceTheme's body-wide MutationObservers ran on every change inside our own designs.**
   - `syncUserPanelWidth` called `getComputedStyle()` synchronously after each batch: 8 forced full restyles
     (250 ms) on one return to Cupertino's home.
   - **Fix (vendor patch):**
     - `utils.js` `steamOnly()` skips batches that only touched `#rfs` / `#rfs-sheet` / `#rfs-bar` / the picker.
     - The width is read once per frame in rAF and written only when it changes.
     - The observers are only rebound when the elements really changed.
   - Files: `src/vendor/space/src/js/{utils,libraryroot.custom,regular}.js`. Re-running `tools/vendor.mjs` would undo
     this. Re-apply it the same way as the earlier downloads crash fix.
3. **Every design's stylesheet stayed loaded after a switch.** About 20 % of every restyle went to matching the other
   designs' rules. **Fix:** `tick()` turns off `link[data-rfs-layout]` sheets that are not the current design.
4. **The home design was rebuilt on every return to the library home, often twice.**
   - Steam's panel is 46 px shorter for a frame, so the size key changed and changed back.
   - **Fix:** the built design is kept and re-attached when nothing changed. The check covers size, design, games
     signature, source, sort, genre, search, view and language (`renderedFor` / `renderKey()`).
   - A size-only difference is checked again 120 ms later and rebuilt only if it stays.
   - Big Picture always rebuilds.
5. **Page changes waited for the 300 ms poll.**
   - **Fix:** a 40 ms check of the route string (no DOM work) runs `tick()` in the next frame. It waits for Steam's
     home to exist first.
   - Two ticks in a row are skipped, because each one forces a restyle.
   - `placeNavTheme()`'s size reads wait 0.5 s after a page change.
   - `place()` reads the wrapper height before writing.
6. **Theme switch was sequential.** Sheet, then the next tick, then the design module (JS + CSS), then render.
   - **Fixes:**
     - The design module starts loading together with the sheet.
     - Hovering or focusing a picker card preloads its files.
     - The main window is restyled first, and the ~25 popup windows follow one by one.
7. **`html:has(#rfs-sheet.on)` rules** (Cupertino, Cyberpunk, Vinyl) re-checked all game tiles on every change.
   They are now `html.rfs-sheet-on`, a class set by `shelf.js` when a game panel opens or closes.

### Bugs found on the way (fixed)
- **Library crash at start-up or after a UI reload: "An error occurred while rendering this content … reading 'values'".**
  - Cause: `shelf.js` read `collectionStore.userCollections` before Steam had loaded the collections.
  - MobX kept the thrown error, so Steam's own library page crashed until a full restart. It happened on every
    `RestartJSContext` during this work.
  - Fix: `SteamAPI.ready()` now waits for `collectionStore.collectionsFromStorage`.
- **Theme switch could leave a window with no style at all.**
  - Cause: `skin.js` `followStyle` (4 s check) and `Themes.live` each swapped the sheet, and each removed "every other"
    style link, including the other's new one.
  - Fix: both now remove only the links that existed before their own swap, and `followStyle` stays out while a swap
    is under way.

### What is left (and why)
- **Return to home is still about 100–150 ms behind SpaceTheme.** Most of that is Steam's own React render of the
  home (110–270 ms, the same in SpaceTheme) plus one full restyle of our design (4–8 k elements, ~12 µs each).
- **Bigger DOMs cost more per restyle.** Cupertino, Cyberpunk, Arcade and Shelter build ~3.5 k extra elements;
  Crossbar builds ~0.5 k. Rendering only the visible rows would help most. That is a design change per layout, so it
  was not done here.
- **`content-visibility` was not reintroduced.** THEME-KIT rule 3 still stands.
- **Shelter's game-page cost (~1.1 s of style work per visit) comes from `styles/shelter.css` restyling Steam's game
  page.** This needs a selector-level pass on that file.
- **Big Picture was not opened during this run.** BPM keeps its old paths: it always rebuilds on return, and the
  route tick doesn't wait for the desktop home.
