"""
Installs the "Game Shelf" (رف الألعاب) Millennium theme and makes it the active theme.

    python install_theme.py            close Steam, install, start Steam
    python install_theme.py --dev      same, but start Steam in developer mode (for fixing things after Steam updates)
    python install_theme.py --remove   remove the theme and return Steam to its default look

The theme is copied to  <Steam>\\millennium\\themes\\rf-shelf
"""

import json
import shutil
import subprocess
import sys
import time
import winreg
from pathlib import Path

HERE = Path(__file__).resolve().parent
THEME_ID = "rf-shelf"
FILES = ["skin.json", "src"]


def steam_root() -> Path:
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam") as k:
            return Path(winreg.QueryValueEx(k, "SteamPath")[0])
    except OSError:
        return Path(r"C:\Program Files (x86)\Steam")


def game_running() -> bool:
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam") as k:
            return int(winreg.QueryValueEx(k, "RunningAppID")[0] or 0) != 0
    except OSError:
        return False


def steam_running() -> bool:
    r = subprocess.run(["tasklist", "/FI", "IMAGENAME eq steam.exe", "/NH"], capture_output=True, text=True)
    return "steam.exe" in r.stdout.lower()


def close_steam(root: Path):
    if not steam_running():
        return
    print("Closing Steam… / أسكّر ستيم…")
    subprocess.run([str(root / "steam.exe"), "-shutdown"])
    for _ in range(90):
        if not steam_running():
            time.sleep(2)
            return
        time.sleep(1)
    sys.exit("Steam did not close. Quit it yourself (Steam > Exit) and run this again.\nستيم ما تسكّر. سكّره يدويًا (Steam > Exit) وعيد تشغيل السكربت.")


def set_active_theme(root: Path, name: str):
    cfg = root / "millennium" / "config" / "config.json"
    # Millennium may save config.json with a UTF-8 BOM
    data = json.loads(cfg.read_text(encoding="utf-8-sig")) if cfg.exists() else {}
    themes = data.setdefault("themes", {})
    themes["activeTheme"] = name
    if name == THEME_ID:
        # keep the user's choices, but drop values that no longer exist (e.g. the removed "Ebony Museum")
        cond = themes.setdefault("conditions", {}).setdefault(THEME_ID, {})
        # the valid styles are the ones skin.json declares (a hard-coded list here reset every newer style to Classic)
        styles = json.loads((Path(__file__).resolve().parent / "skin.json").read_text(encoding="utf-8"))["Conditions"]["Style"]["values"]
        if cond.get("Style") not in styles:
            cond["Style"] = "Classic Shelf"
        if cond.get("Language") not in ("Arabic", "English"):
            cond["Language"] = "English"
    themes["allowedScripts"] = True
    themes["allowedStyles"] = True
    general = data.setdefault("general", {})
    general["injectCSS"] = True
    general["injectJavascript"] = True
    cfg.parent.mkdir(parents=True, exist_ok=True)
    cfg.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    root = steam_root()
    if not (root / "millennium").exists():
        sys.exit("Millennium is not installed in Steam. Get it from https://steambrew.app first.\nMillennium مو مثبت في ستيم — ثبّته من https://steambrew.app أول.")
    remove = "--remove" in sys.argv
    dev = "--dev" in sys.argv

    if game_running():
        sys.exit("A game is running — quit it first, then run this again.\nفي لعبة شغّالة — سكّرها أول وبعدين شغّل السكربت.")
    close_steam(root)
    dest = root / "millennium" / "themes" / THEME_ID
    if dest.exists():
        shutil.rmtree(dest)
    if remove:
        set_active_theme(root, "default")
        print("Theme removed — Steam is back to its default look. / شلت الثيم ورجّعت ستيم لشكله الأصلي.")
    else:
        dest.mkdir(parents=True)
        for f in FILES:
            src = HERE / f
            if src.is_dir():
                shutil.copytree(src, dest / f)
            else:
                shutil.copy2(src, dest / f)
        set_active_theme(root, THEME_ID)
        print(f"Installed to / ركّبت الثيم في: {dest}")

    args = [str(root / "steam.exe")] + (["-dev"] if dev else [])
    subprocess.Popen(args, close_fds=True)
    print("Starting Steam" + (" (developer mode)" if dev else "") + "… / شغّلت ستيم.")


if __name__ == "__main__":
    main()
