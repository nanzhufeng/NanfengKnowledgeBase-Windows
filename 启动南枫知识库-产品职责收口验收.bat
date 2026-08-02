@echo off
setlocal EnableDelayedExpansion

set "LAUNCHER=%~dp0scripts\launch-knowledge-ownership-closure.ps1"

if /I "%~1"=="--verify" (
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%LAUNCHER%" -Verify
  exit /b !ERRORLEVEL!
)

if /I "%~1"=="--rebuild" (
  start "" powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%LAUNCHER%" -Rebuild
  exit /b 0
)

start "" powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%LAUNCHER%"
exit /b 0
