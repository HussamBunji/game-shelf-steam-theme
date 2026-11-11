# AGENTS.md — installing Game Shelf for a user

Instructions for coding agents (Claude Code, Codex, …) asked to "install this Steam theme".
Work step by step, explain each step to the user in their language, and **ask before anything that closes Steam
or installs software**.

## 0. Requirements
- Windows with Steam installed. (Millennium also exists for Linux. This repo's installer script is Windows-only;
  on Linux copy the files by hand, as in step 4b.)
- Python 3.9+ for `install_theme.py`. If Python is missing, use the manual copy in step 4b instead of installing it.

## 1. Find Steam
- Read `HKCU\Software\Valve\Steam` → `SteamPath`. Fall back to `C:\Program Files (x86)\Steam`.
- Confirm `<Steam>\steam.exe` exists.

## 2. Check Millennium (the Steam homebrew loader this theme runs on)
- Millennium is installed when the `<Steam>\millennium` folder exists.
- If it is missing, **stop and ask the user**. It must come from the official source only:
  https://steambrew.app (or https://github.com/SteamClientHomebrew/Millennium/releases).
  - Let the user download and run the official installer themselves.
  - Do not fetch installers from anywhere else.
  - Do not disable antivirus.

## 3. Make it safe to restart Steam
- A game must not be running. Check that `HKCU\Software\Valve\Steam` → `RunningAppID` is `0`. If it isn't, ask the user to quit the game.
- Tell the user Steam will close and reopen, and wait for their OK.

## 4a. Install (script)
```
python install_theme.py
```
The script:
1. Closes Steam cleanly (`steam.exe -shutdown`).
2. Copies `skin.json` and `src/` to `<Steam>\millennium\themes\rf-shelf`.
3. Sets `themes.activeTheme = "rf-shelf"` in `<Steam>\millennium\config\config.json`, keeping the user's other Millennium settings.
4. Starts Steam again.

Defaults: style **Classic Shelf**, language **English**.

## 4b. Install (manual, no Python)
1. Close Steam (Steam → Exit).
2. Copy `skin.json` and the whole `src` folder into `<Steam>\millennium\themes\rf-shelf\`.
3. Start Steam → Settings → Millennium → Themes → pick **Game Shelf — رف الألعاب**.
4. Steam reloads its interface.

## 5. Verify with the user
- A **THEMES** item appears in Steam's top navigation, after STORE · LIBRARY · COMMUNITY · <name> · CONSOLE.
- Clicking it opens the style picker with 25 styles: Slate, Classic Shelf, Glass Gallery, Neon Coverflow, Terminal, RPG Vault, Vinyl Records, Corkboard, Retro Arcade, Magazine, Cupertino Dark, Cyberpunk, Shelter OS, Crossbar, Steam Original and its eight colour variants (OLED Black, Graphite, Midnight, Forest, Wine, Royal Purple, Coffee, Ocean), SpaceTheme and Material You. It also has the English / العربية switch.
- On a store game page, side panels show live players and regional prices, if the window is wide enough.

## Uninstall
The easy way, for the user: **THEMES → Remove Game Shelf** (bottom of the picker). It asks once, then switches Millennium
back to its default theme, forgets the theme's saved choices, deletes the theme folder and reloads Steam's interface.
Millennium itself stays installed.

From a terminal:
```
python install_theme.py --remove
```
This removes the theme folder and sets Millennium back to its default theme.

## Rules
- Only touch two things:
  - `<Steam>\millennium\themes\rf-shelf`
  - the `themes` keys of `millennium\config\config.json`
- Never edit other Steam files, and never touch the user's account, login or payment settings.
- Never close Steam without asking. Never install software without the user's consent.
- The theme makes these network calls from the Steam store page, and sends no personal data:
  - `api.steampowered.com` for player counts
  - `store.steampowered.com/api/appdetails` for regional prices
  - `open.er-api.com` for exchange rates

## For maintainers (after a Steam update breaks something)
See the "After a Steam update" section of README.md (tools/diagnose.mjs, tools/sync.mjs; run Steam with `-dev`).
