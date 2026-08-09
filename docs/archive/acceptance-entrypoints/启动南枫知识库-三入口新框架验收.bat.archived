@echo off
setlocal

set "LAUNCHER=%~dp0scripts\launch-core-workspace-three-entry.ps1"
set "LAUNCHER_ARGS="

if /I "%~1"=="--verify" set "LAUNCHER_ARGS=-Verify"
if /I "%~1"=="--rebuild" set "LAUNCHER_ARGS=-Rebuild"

if /I "%~1"=="--verify" (
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%LAUNCHER%" -Verify
  exit /b %ERRORLEVEL%
)

start "" powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%LAUNCHER%" %LAUNCHER_ARGS%
exit /b 0
