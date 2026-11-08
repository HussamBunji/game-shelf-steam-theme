# QA report: layout check

## 2026-11-08: every style × every page, English and Arabic (desktop; Big Picture not opened)

### How it was checked
- **Tool:** `node tools/qa-overlap.mjs run <outDir> "<Style>" … [--only=home,panel,picker,app,menus,downloads,install,friends,settings,web|store|…]`
  (new). It drives Steam through SharedJSContext. Steam's popup manager knows which windows are real and visible;
  `/json` keeps stale copies of every window after a UI reload. The tool opens each page below, runs an in-page
  checker and saves `<page>.json` + `<page>.png`.
  To check one window by hand: `node tools/qa-overlap.mjs check "<title or URL regex>" <outBase>`.
- **What the checker reports.** It looks at the visible controls: `a`, `button`, `[role=button]`, inputs,
  `.DialogButton`, `[class*=Button]`, and our `.tb-btn`, `.rf-act`, `.tp-card` and `.rr-*`. When a top layer is open
  (Steam dialog, theme picker, game panel, right-click menu), it checks only inside that layer.

  | code | finding |
  |---|---|
  | O | sticks out: cut by a box that doesn't scroll that way, or off the window sideways |
  | X | two controls overlap by > 4 px both ways (neither inside the other) |
  | T | a no-wrap label is wider than its control (`…` included) |
  | L | the text colour is almost the background colour (contrast < 1.35) |
  | C | the control's centre is covered by another element, so it can't be clicked |
  | U | text is drawn under or through a control it doesn't belong to |
  | K | words are cut off sideways by a box (no ellipsis, not a scroller) |
  | E | (info only) one of our own labels is cut with an ellipsis |

  Known false positives are filtered out:
  - content scrolled under a fixed or sticky header
  - links that wrap over two lines
  - click-anywhere overlay links
  - items scrolled out of view, or off-screen in a carousel
  - transparent text that a pseudo-element draws instead
- **Pages per style:**
  - **Library:** home (our design), a game's panel on the home, theme picker pages 1 and 2, a game page, the game
    list's right-click menu, notifications menu, account menu, Downloads.
  - **Install dialog** of a game that isn't installed (`steam://install/282800`). It was **cancelled** each time.
  - **Friends list** and **a chat window.** The chat was opened only; nothing was typed or sent.
  - **Steam Settings.** Opened, then closed again.
  - **Store:** home, a game page (at the top, and scrolled down to the buy boxes), search, wishlist.
  - **Community:** home, profile, badges, games list.
- **Safety:**
  - Nothing was launched, installed, bought or sent.
  - `RunningAppID` was 0 throughout. The tool waits whenever a game is running.
  - Steam settings were not touched. Only the theme's own Style / Language conditions were switched.
- **Screenshots:** `C:\Users\yalwa\AppData\Local\Temp\gs\qa\`
  - First pass: `en\<style>\` and `ar\<style>\`.
  - After the fixes: `final\en\<style>\` and `final\ar\<style>\`.
  - Each page has `<page>.png` and `<page>.json`.
  - Style folders: classic, glass, neon, terminal, vault, vinyl, cork, arcade, magazine, cupertino, cyberpunk,
    shelter, xmb (Crossbar), original, space, material.

### Fixed (in this pass)
| # | Where | What was wrong | Fix (file) |
|---|---|---|---|
| 1 | Theme picker, every style, both languages | Each card's description ran 28 px past the card and was cut on the right ("…a colum", "…stats pane"). | `.tp-meta` is now `box-sizing: border-box` (`src/css/layouts.css`) |
| 2 | Game panels: Classic CD case, Neon, Glass, Terminal, Arcade… | The size fact "2.2 GB to download · not installed" was cut with "…". The status line already says "not installed". | Long form is now "2.2 GB to download" (`src/js/shelf.js` `sizeText`) |
| 3 | Library sidebar search (Terminal, Cupertino Dark, Crossbar) | The field was 6 px wider than its box and cut on the right. | `border-box` / 100 % (`src/css/shelf.css`) |
| 4 | Library game list (Arabic, wide fonts) | Long names were cut dead mid-letter ("…SKIES UNKNOW"). | Ellipsis (`src/css/shelf.css`) |
| 5 | Classic Shelf CD-case viewer | The close button sat in Steam's title bar. In Arabic it was under the "Steam" menu and couldn't be clicked; in English it sat over the window buttons. | Moved below the title bar (`src/css/shelf.css`) |
| 6 | Chat window, every SpaceTheme-based style | The date pill sat under Steam's "add a friend" button, so the date was cut. | Centred (`src/css/friends.css`) |
| 7 | Friends list, empty favourites strip | "Got it!" was drawn across the hint's dashed frame. | The strip keeps a line for it (`src/css/friends.css`) |
| 8 | Store home, Steam Original | "Quick links" was drawn on top of the search box text. It was measured while hidden (0 px wide). | Measured while shown (`src/js/webkit.js` `placeQuick`) |
| 9 | Wishlist, every style | "Quick links" dropped under the nav bar into the page header. | Now sits just outside the bar's end on the same line (falls back to under the bar only when there is no room) (`src/js/webkit.js`) |
| 10 | Wishlist cards, every style | Two things went wrong. (a) The "Added on … ✕ remove" row was taken for the buy row, so priced cards grew 60 px past their fixed height and covered the next row's art; the date chip was missing. (b) A hardware item (Steam Controller) had its meta line taken for the rank, so it floated over the art. | Tags fixed (`src/js/webkit.js` `wlTagRow`). Card height is explicit, body 176 px (`src/css/webkit.css`) |
| 11 | Community home, every SpaceTheme-based style | Steam's small sticky footer became a full-width filled bar floating over the cards and covering their links. | Kept compact and transparent (`src/css/webkit.css`) |
| 12 | Store game page, bundle box (Crossbar, Cyberpunk, Shelter OS, Cupertino Dark) | "Bundle info" / "Purchase as a gift" covered the bundle's title and item list; the Windows/Mac icons covered the item list. | Those boxes get a button row under the text (`src/css/webkit.css`) |
| 13 | Store side rail (Crossbar, Shelter OS) | "About / Buy / DLC / Reviews" links were 6 px wider than the rail and cut. | `-webkit-fill-available` (`src/css/webkit.css`) |
| 14 | Store data panel, price trackers (Crossbar, Cupertino, Cyberpunk, Shelter, Terminal) | "IsThereAnyDeal", "HowLongToBeat" and "Price & update history" were cut. | Inset moved from each cell to the grid (`src/styles/{xmb,cupertino,cyberpunk,shelter}.css`); subtitles may take 2 lines (`src/css/webkit.css`) |
| 15 | Corkboard badges page | Inside each paper card, a dark panel held dark ink, so the badge name and "4 of 6 cards collected" were invisible (contrast 1.04). "Sort by" was also unreadable on the cork. | Panel is now a faint pencil box; label is light (`src/styles/cork.css`) |
| 16 | Corkboard store search | The "Sort by: Relevance" picker had dark ink on a dark field. | Paper field (`src/styles/cork.css`) |
| 17 | Terminal store game page | The "Bundle info" label was green on its green fill, so it was invisible. | Ink label (`src/styles/terminal.css`) |
| 18 | Arabic store game page, every SpaceTheme-based style | Two things were pinned to the right edge, where Arabic text starts. (a) Follow / Ignore buttons sat on top of the game's name. (b) Each edition's price covered "شراء …" and its item list, away from its own button. | Mirrored to the left (`src/css/webkit.css`) |
| 19 | Arabic badges page, every SpaceTheme-based style | Steam's Arabic page leaves the XP box unclosed, so the badge list landed inside a flex row. All 150 badges were squeezed into 145 px cards with their text cut. | List moved back after the box (`src/js/webkit.js` `fixBadgesNesting`); RTL play-time offset (`src/css/webkit.css`) |
| 20 | Store "Content for this game" (DLC), every SpaceTheme-based style | Three problems. (a) The 26 px "in library" badge covered the first letters of each DLC row ("berpunk 2077…"). (b) The DLC total ("9.99 KD") was hidden behind the rows. (c) In Vinyl Records, "Add all DLC to Cart" was lifted 12 px onto the last row. | Smaller centred badge with room for it, total placed beside its button (`src/css/webkit.css`); Vinyl fix (`src/styles/vinyl.css`) |

| 21 | Community home, review cards (every style but Steam Original) | Steam's comment count ("59") sat on top of a long game name, and the name was cut dead (whole words lost in Terminal's wide font). | The name keeps clear of the count and ends with "…"; in Arabic it still loses its end (`src/css/webkit.css`) |

`src/css/webkit-styles.css` was regenerated with `node tools/build.mjs`, and everything was copied to
`C:\Program Files (x86)\Steam\millennium\themes\rf-shelf\`. Nothing is committed.

### Result after the fixes: English (`final\en\`)
| style | home | panel | picker1 | picker2 | app | ctxmenu | notifications | account | downloads | install | friends | chat | settings | store | store-app | store-app-2 | store-search | wishlist | community | profile | badges | games |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| classic | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T2 | X27 | U1 | ok | K5 | ok |
| glass | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T2 | X27 | U1 | ok | K5 | ok |
| neon | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T2 | X27 | U1 | ok | K5 | ok |
| terminal | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T2 | ok | O1 U1 | ok | K5 | ok |
| vault | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T2 | X27 | ok | ok | K5 | ok |
| vinyl | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T2 | X27 | U1 | ok | K5 | ok |
| cork | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T2 | X27 | ok | ok | K5 | ok |
| arcade | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T2 | X27 T2 | O1 U1 | ok | K5 | ok |
| magazine | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T2 | X27 | ok | ok | K5 | ok |
| cupertino | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T2 | X27 | O1 U1 | ok | K5 | ok |
| cyberpunk | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T2 | X27 | U1 | ok | K5 | ok |
| shelter | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T2 | ok | O1 U1 | ok | K5 | ok |
| xmb | O1 | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T2 | X27 | ok | ok | K5 | ok |
| original | O1 U6 | – | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T3 | ok | ok | U1 | ok | ok | ok |
| space | O2 U2 | – | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T2 | X27 | O1 U1 | ok | K5 | ok |
| material | O2 U9 | – | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T3 | O1 | ok | ok | ok | ok | ok |

The store game page and the community home were checked again after fixes 20 and 21 (Vinyl, Terminal, Crossbar): `ok`.

### Result after the fixes: Arabic (`final\ar\`)
| style | home | panel | picker1 | picker2 | app | ctxmenu | notifications | account | downloads | install | friends | chat | settings | store | store-app | store-app-2 | store-search | wishlist | community | profile | badges | games |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| classic | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T3 | X27 | C1 U1 | ok | ok | ok |
| glass | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T3 | X27 | C1 U1 | ok | ok | ok |
| neon | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T3 | X27 | C1 U1 | ok | ok | ok |
| terminal | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T5 | ok | C1 | ok | ok | ok |
| vault | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | X27 | C1 | ok | ok | ok |
| vinyl | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T3 | X27 | C1 U1 | ok | ok | ok |
| cork | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T3 | X27 | C1 | ok | ok | ok |
| arcade | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T3 | X27 T2 | O1 C1 U1 | ok | ok | ok |
| magazine | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | X27 | C1 | ok | ok | ok |
| cupertino | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T3 | X27 | O1 C1 U1 | ok | ok | ok |
| cyberpunk | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T2 | X27 | C1 U1 | ok | ok | ok |
| shelter | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T3 | ok | O1 C1 U1 | ok | ok | ok |
| xmb | O1 | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | X27 | C1 | ok | ok | ok |
| original | O1 U6 | – | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T3 | ok | ok | X3 C1 U4 | ok | ok | ok |
| space | O2 U2 | – | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T4 | X27 | O1 C1 U1 | ok | ok | ok |
| material | O2 U9 | – | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | T3 | K1 | ok | X3 C1 U3 | ok | ok | ok |

The store game page (`store-app`, `store-app-2`) was checked again in Arabic for every SpaceTheme-based style after fix 20: all `ok`.

`ok` = nothing found. `–` = the page doesn't exist for that style: Steam Original, SpaceTheme and Material You keep
Steam's own home, so they have no game panel.

### Remaining findings (checked by eye; not theme bugs, or by design)
These were all looked at in the screenshots. None is a broken button.
- **Wishlist, X27 (every style that shows cards):** the "Added on … ✕ remove" chip, the rank number and the drag handle
  sit on the cover art on purpose. All three can be clicked (C = 0).
- **Store search, T2–T5:** long names in the result grid end with "…" on purpose.
- **Badges, K5 (English):** SpaceTheme pulls the play time 6 px left to hide a leading space; the "cut" part is that
  space. The text reads in full (`final\en\vinyl\badges.png`).
- **Community home, C1 (Arabic):** "اتفاقية مشتركي Steam" wraps onto two lines in Steam's footer. Its centre falls
  between the lines; the link itself is clickable.
- **Community home, U1 / O1 (English final pass):** this was the comment count over a long game name. It was fixed
  afterwards (fix 21), re-checked `ok` on Crossbar, and checked by eye in Arabic. It also happens in Steam Original:
  Steam's own card markup, left stock there.
- **Steam Original / SpaceTheme / Material You home (O1–O2, U2–U9):** this is Steam's own home page, unchanged by us.
  The "What's New" carousel runs off the right edge, and Steam's date / "new" badges sit on the capsules.
- **Crossbar home, O1:** the category row is a carousel. The "Search" icon at the far end is a few px off-screen until
  you move to it.
- **Steam Original, Arabic community home:** Steam's own compact footer floats over the review cards in right-to-left
  layout. It is left stock, because "Steam Original" must stay exactly as Valve ships it.
- **Material You, store search, O1:** Steam's collapsed "Narrow by…" filter block hides its last row until it is
  opened (vendor theme, stock behaviour).
- Minor, not changed: Corkboard's "You reviewed this game" box on a store page keeps a dark frame around the paper card.
  Cupertino Dark shows Steam's bundle discount twice ("-8%" grey and the "-8%" pill), as Steam's own markup does.

### Not covered here
- Big Picture (a separate pass).
- Cart / checkout / login pages, the market, workshop and discussion pages, and group chats.
- Only one friend's chat was opened, and only one not-installed game's install dialog.
