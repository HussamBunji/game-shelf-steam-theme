# Third-party themes bundled in Game Shelf

Game Shelf ships two community Millennium themes under `src/vendor/`. They are copied unmodified by
`tools/vendor.mjs`; each folder keeps its original `LICENSE` file. Game Shelf only loads their files and
sets their colour variables.

| Folder | Theme | Author | Source | License |
|---|---|---|---|---|
| `src/vendor/space` | SpaceTheme for Steam | SpaceTheme | https://github.com/SpaceTheme/Steam | MIT |
| `src/vendor/material` | Material Theme | kuska1 | https://github.com/kuska1/Material-Theme | MIT |

How they are used:
- **SpaceTheme** and **Material You** styles run each theme as its author made it, with its default settings.
  Game Shelf adds only the Themes nav item, the store side panels and its icons.
- **Classic Shelf, Glass Gallery and Neon Coverflow** use SpaceTheme's layout as their base. Each style fills
  SpaceTheme's colour variables (`--st-*`) with its own palette and adds its own home design and touches (`src/css/flair.css`).

To update them, run `git pull` inside `third_party/<name>` (or re-clone), then `node tools/vendor.mjs`.
