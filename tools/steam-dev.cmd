@echo off
rem Restart Steam in developer mode (opens the DevTools port 8080 used by the tools in this folder)
"C:\Program Files (x86)\Steam\steam.exe" -shutdown
rem full path: Git's own "timeout" can shadow Windows' one on PATH and return at once
"%SystemRoot%\System32\timeout.exe" /t 8 /nobreak >nul
start "" "C:\Program Files (x86)\Steam\steam.exe" -dev
