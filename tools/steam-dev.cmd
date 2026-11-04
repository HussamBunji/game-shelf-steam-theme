@echo off
rem Restart Steam in developer mode (opens the DevTools port 8080 used by the tools in this folder)
"C:\Program Files (x86)\Steam\steam.exe" -shutdown
timeout /t 6 /nobreak >nul
start "" "C:\Program Files (x86)\Steam\steam.exe" -dev
