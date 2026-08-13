@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem Starts only the current acceptance EXE.
set "APPLICATION=%~dp0.runtime-qa\current-acceptance-app\release\nanfeng-knowledge-base.exe"
set "VERIFIER=%~dp0scripts\launch-current-acceptance.ps1"

if /I "%~1"=="--path" (
  echo Current acceptance application:
  echo %APPLICATION%
  if exist "%APPLICATION%" (exit /b 0) else (exit /b 2)
)

if /I "%~1"=="--verify" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%VERIFIER%" -Verify
  exit /b %errorlevel%
)

if not exist "%APPLICATION%" (
  echo Current acceptance application was not found:
  echo %APPLICATION%
  echo Ask the maintainer to prepare the current isolated build first.
  exit /b 2
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%VERIFIER%" -Verify
if errorlevel 1 (
  echo Current acceptance verification failed. The application was not started.
  exit /b 4
)

tasklist /FI "IMAGENAME eq nanfeng-knowledge-base.exe" /NH | find /I "nanfeng-knowledge-base.exe" >nul
if not errorlevel 1 (
  echo A Nanfeng Knowledge Base window is already running. Close it before starting the current acceptance app.
  exit /b 3
)

echo Starting Nanfeng Knowledge Base current acceptance application...
rem Do not allow a parent shell to redirect the app to a test or legacy data directory.
set "NANFENG_KNOWLEDGE_BASE_DATA_DIR="
set "NANFENG_INTELLIGENCE_DATA_DIR="
start "" "%APPLICATION%"
