@echo off
chcp 65001 >nul
setlocal

set "PROJECT_DIR=%~dp0"
set "TEST_TARGET_DIR=%PROJECT_DIR%.runtime-qa\test-build"
set "APP_EXE=%TEST_TARGET_DIR%\release\nanfeng-intelligence.exe"

title 南枫情报台 - 测试版启动器
pushd "%PROJECT_DIR%" || (
  echo [失败] 无法进入项目目录：
  echo %PROJECT_DIR%
  pause
  exit /b 1
)

if /I "%~1"=="--rebuild" goto rebuild
if exist "%APP_EXE%" goto launch

:rebuild
where npm >nul 2>nul
if errorlevel 1 (
  echo [失败] 未找到 npm，无法生成本地测试程序。
  echo 请先安装项目开发环境，或联系 Codex 重新准备测试版。
  pause
  popd
  exit /b 1
)

echo [准备] 正在生成本地测试程序，不会创建或安装安装包……
set "CARGO_TARGET_DIR=%TEST_TARGET_DIR%"
call npm run tauri:build -- --no-bundle
if errorlevel 1 (
  echo.
  echo [失败] 测试程序生成失败，请保留本窗口中的错误信息。
  pause
  popd
  exit /b 1
)

:launch
if not exist "%APP_EXE%" (
  echo [失败] 未找到测试程序：
  echo %APP_EXE%
  pause
  popd
  exit /b 1
)

tasklist /FI "IMAGENAME eq nanfeng-intelligence.exe" 2>nul | find /I "nanfeng-intelligence.exe" >nul
if not errorlevel 1 (
  echo [请先关闭] 检测到南枫情报台仍在运行。
  echo 为避免旧版和测试版同时读写数据，请关闭现有窗口后再双击本文件。
  pause
  popd
  exit /b 2
)

echo [启动] 南枫情报台测试版
start "" "%APP_EXE%"
if errorlevel 1 (
  echo [失败] 程序启动失败。
  pause
  popd
  exit /b 1
)

popd
exit /b 0
