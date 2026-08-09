@echo off
setlocal EnableExtensions

set "LAUNCHER=%~dp0scripts\launch-interaction-performance-architecture.ps1"

if /I "%~1"=="--verify" (
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%LAUNCHER%" -Verify
  exit /b %ERRORLEVEL%
)

if /I "%~1"=="--prepare" (
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%LAUNCHER%" -Prepare
  exit /b %ERRORLEVEL%
)

start "" powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%LAUNCHER%"
exit /b 0
