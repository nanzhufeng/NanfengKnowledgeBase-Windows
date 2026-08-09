@echo off
setlocal EnableExtensions

set "VERIFY_SCRIPT=%~dp0scripts\verify-formal-windows-release.ps1"

if /I "%~1"=="--verify" (
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%VERIFY_SCRIPT%" -VerifyOnly
  exit /b %ERRORLEVEL%
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%VERIFY_SCRIPT%"
if errorlevel 1 pause
exit /b %ERRORLEVEL%
