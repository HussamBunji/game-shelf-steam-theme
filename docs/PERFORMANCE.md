# Performance log

How fast the themes are on a live Steam, measured. Steam runs with `-dev`, CDP at `http://127.0.0.1:8080`.

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
