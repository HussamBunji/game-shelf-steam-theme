#!/usr/bin/env bash
# Game Shelf (رف الألعاب) — installer for Linux and Steam Deck (SteamOS).
#
#   curl -fsSL https://raw.githubusercontent.com/yousf612-alwazzan/game-shelf-steam-theme/main/install-linux.sh | bash
#
# What it does (nothing outside your home folder, no sudo):
#   1. finds Steam (~/.steam/steam, ~/.local/share/Steam, or the Flatpak Steam folder)
#   2. checks that Millennium (the free open-source theme loader) is installed — if not, it tells you how to get it
#      from its official page and stops (Millennium itself needs a one-time install with its own official script)
#   3. downloads the latest theme release from GitHub, copies it to <Steam>/millennium/themes/rf-shelf
#   4. turns the theme on in Millennium's config (~/.config/millennium/config.json), keeping your other settings
#   5. asks Steam to restart so the theme loads
#
#   bash install-linux.sh --remove      removes the theme and switches Millennium back to its default theme
#   GS_STYLE="Cyberpunk" GS_LANG=Arabic bash install-linux.sh     pick the starting style / language
set -euo pipefail

REPO="yousf612-alwazzan/game-shelf-steam-theme"
THEME_ID="rf-shelf"
STYLE="${GS_STYLE:-Classic Shelf}"
LANGUAGE="${GS_LANG:-English}"
SRC_DIR="${GS_SOURCE:-}"   # dev/testing: copy from this folder instead of downloading

say()  { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }

PY=""
for c in python3 python; do command -v "$c" >/dev/null 2>&1 && "$c" -c "import json" >/dev/null 2>&1 && { PY="$c"; break; }; done
[ -n "$PY" ] || die "python3 is needed (it ships with SteamOS and most Linux distributions)."

# ---- 1. Steam
STEAM=""
for d in "${GS_STEAM_ROOT:-}" "$HOME/.steam/steam" "$HOME/.local/share/Steam" "$HOME/.var/app/com.valvesoftware.Steam/.local/share/Steam"; do
  [ -n "$d" ] && [ -d "$d" ] && { STEAM="$(cd "$d" && pwd -P)"; break; }
done
[ -n "$STEAM" ] || die "Steam was not found. Install Steam and open it once, then run this again."
say "Steam: $STEAM"

CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/millennium"
CONFIG="$CONFIG_DIR/config.json"
THEME_DIR="$STEAM/millennium/themes/$THEME_ID"

# ---- remove
if [ "${1:-}" = "--remove" ]; then
  rm -rf "$THEME_DIR"
  [ -f "$CONFIG" ] && "$PY" - "$CONFIG" <<'PYEOF'
import json, sys
p = sys.argv[1]
d = json.load(open(p, encoding="utf-8-sig"))
d.setdefault("themes", {})["activeTheme"] = "default"
json.dump(d, open(p, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
PYEOF
  say "Game Shelf removed. Restart Steam to see the default look."
  exit 0
fi

# ---- 2. Millennium
if [ ! -d /usr/lib/millennium ] && [ ! -d "$STEAM/millennium" ] && [ -z "${GS_SKIP_MILLENNIUM_CHECK:-}" ]; then
  warn "Millennium (the theme loader) is not installed yet."
  echo  "    Install it from its official page, then run this script again:"
  echo  "      https://steambrew.app   (or https://github.com/SteamClientHomebrew/Millennium)"
  echo  "    Steam Deck: switch to Desktop Mode and follow the Linux steps there."
  exit 1
fi

# ---- 3. theme files
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
if [ -n "$SRC_DIR" ]; then
  say "Using local files: $SRC_DIR"
  cp -r "$SRC_DIR/skin.json" "$SRC_DIR/src" "$TMP/"
else
  say "Downloading the latest Game Shelf release…"
  curl -fsSL "https://github.com/$REPO/releases/latest/download/GameShelf-Theme.zip" -o "$TMP/theme.zip" \
    || die "Download failed. Check your internet connection."
  "$PY" -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "$TMP/theme.zip" "$TMP"
  rm -f "$TMP/theme.zip"
fi
[ -f "$TMP/skin.json" ] && [ -d "$TMP/src" ] || die "The download looks incomplete (skin.json / src missing)."
mkdir -p "$STEAM/millennium/themes"
rm -rf "$THEME_DIR"
mkdir -p "$THEME_DIR"
cp -r "$TMP/skin.json" "$TMP/src" "$THEME_DIR/"
say "Theme copied to $THEME_DIR"

# ---- 4. Millennium config: activate the theme, keep everything else
mkdir -p "$CONFIG_DIR"
"$PY" - "$CONFIG" "$THEME_ID" "$STYLE" "$LANGUAGE" <<'PYEOF'
import json, os, sys
p, tid, style, lang = sys.argv[1:5]
d = json.load(open(p, encoding="utf-8-sig")) if os.path.exists(p) else {}
th = d.setdefault("themes", {})
th["activeTheme"] = tid
th["allowedScripts"] = True
th["allowedStyles"] = True
c = th.setdefault("conditions", {}).setdefault(tid, {})
c.setdefault("Style", style)
c["Language"] = lang if lang in ("Arabic", "English") else c.get("Language", "English")
c.setdefault("Family", "On")
g = d.setdefault("general", {})
g["injectCSS"] = True
g["injectJavascript"] = True
json.dump(d, open(p, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
PYEOF
say "Theme turned on ($STYLE, $LANGUAGE)."

# ---- 5. restart Steam
if [ -z "${GS_NO_RESTART:-}" ] && command -v steam >/dev/null 2>&1 && pgrep -x steam >/dev/null 2>&1; then
  say "Restarting Steam…"
  steam -shutdown >/dev/null 2>&1 || true
  for _ in $(seq 1 60); do pgrep -x steam >/dev/null 2>&1 || break; sleep 1; done
  (nohup steam >/dev/null 2>&1 &)
fi
say "Done. Open THEMES in Steam's top bar (or in Big Picture) to switch styles."
