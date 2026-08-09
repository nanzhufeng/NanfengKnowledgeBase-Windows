@echo off
setlocal EnableExtensions EnableDelayedExpansion
set "LAUNCHER=%~dp0scripts\launch-current-acceptance.ps1"
if /I "%~1"=="--prepare" (powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%LAUNCHER%" -Prepare & exit /b !ERRORLEVEL!)
if /I "%~1"=="--verify" (powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%LAUNCHER%" -Verify & exit /b !ERRORLEVEL!)
start "" powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%LAUNCHER%"
