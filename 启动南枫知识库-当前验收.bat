@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem Starts only the current acceptance EXE.
set "APPLICATION=%~dp0.runtime-qa\current-acceptance-app\release\nanfeng-knowledge-base.exe"
set "VERIFIER=%~dp0scripts\launch-current-acceptance.ps1"

if /I "%~1"=="--path" goto show_path
if /I "%~1"=="--verify" goto verify
goto launch

:show_path
echo Current acceptance application:
echo %APPLICATION%
if exist "%APPLICATION%" exit /b 0
exit /b 2

:verify
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%VERIFIER%" -Verify
exit /b %errorlevel%

:launch
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%VERIFIER%" -Launch
if not errorlevel 1 exit /b 0
echo.
echo Nanfeng Knowledge Base failed to start. Keep the message above and send a screenshot to the maintainer.
pause
exit /b 4
