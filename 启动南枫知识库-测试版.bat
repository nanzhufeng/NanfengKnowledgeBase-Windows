@echo off
chcp 65001 >nul
setlocal

set "PROJECT_DIR=%~dp0"
set "TEST_TARGET_DIR=%PROJECT_DIR%.runtime-qa\knowledge-base-build-v6"
set "APP_EXE=%TEST_TARGET_DIR%\release\nanfeng-knowledge-base.exe"
set "LOG_DIR=%PROJECT_DIR%.runtime-qa\launcher"
set "LAUNCH_LOG=%LOG_DIR%\latest.log"

title 南枫知识库 - 测试版启动器
pushd "%PROJECT_DIR%" || (
  echo [失败] 无法进入项目目录：
  echo %PROJECT_DIR%
  pause
  exit /b 1
)

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>nul
> "%LAUNCH_LOG%" echo [%date% %time%] 启动测试版
>> "%LAUNCH_LOG%" echo 项目目录：%PROJECT_DIR%
>> "%LAUNCH_LOG%" echo 程序路径：%APP_EXE%

if /I "%~1"=="--rebuild" (
  set "RUNNING_APP="
  rem tasklist 的 Image Name 列最多显示 25 个字符，长进程名会显示为 nanfeng-knowledge-base.ex。
  tasklist /FI "IMAGENAME eq nanfeng-knowledge-base.exe" /NH 2>nul | find /I "nanfeng-knowledge-base" >nul
  if not errorlevel 1 set "RUNNING_APP=1"
  tasklist /FI "IMAGENAME eq nanfeng-intelligence.exe" 2>nul | find /I "nanfeng-intelligence.exe" >nul
  if not errorlevel 1 set "RUNNING_APP=1"
  if defined RUNNING_APP (
    >> "%LAUNCH_LOG%" echo 重新生成前检测到程序已在运行
    echo [请先关闭] 南枫知识库或旧版南枫情报台仍在运行，无法覆盖测试程序。
    echo 关闭现有窗口后，再运行本文件并带上 --rebuild。
    pause
    popd
    exit /b 2
  )
  goto rebuild
)
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
>> "%LAUNCH_LOG%" echo 开始重新生成测试程序
set "CARGO_TARGET_DIR=%TEST_TARGET_DIR%"
call npm run tauri:build -- --no-bundle
if errorlevel 1 (
  >> "%LAUNCH_LOG%" echo 测试程序生成失败
  echo.
  echo [失败] 测试程序生成失败，请保留本窗口中的错误信息。
  echo 启动日志：%LAUNCH_LOG%
  pause
  popd
  exit /b 1
)

:launch
if not exist "%APP_EXE%" (
  >> "%LAUNCH_LOG%" echo 未找到测试程序
  echo [失败] 未找到测试程序：
  echo %APP_EXE%
  echo 启动日志：%LAUNCH_LOG%
  pause
  popd
  exit /b 1
)

set "RUNNING_APP="
tasklist /FI "IMAGENAME eq nanfeng-knowledge-base.exe" /NH 2>nul | find /I "nanfeng-knowledge-base" >nul
if not errorlevel 1 set "RUNNING_APP=1"
tasklist /FI "IMAGENAME eq nanfeng-intelligence.exe" 2>nul | find /I "nanfeng-intelligence.exe" >nul
if not errorlevel 1 set "RUNNING_APP=1"
if defined RUNNING_APP (
  >> "%LAUNCH_LOG%" echo 检测到程序已在运行
  echo [请先关闭] 检测到南枫知识库或旧版南枫情报台仍在运行。
  echo 为避免旧版和测试版同时读写数据，请关闭现有窗口后再双击本文件。
  pause
  popd
  exit /b 2
)

echo [启动] 南枫知识库测试版
>> "%LAUNCH_LOG%" echo 正在启动程序
start "" /D "%PROJECT_DIR%" "%APP_EXE%"

timeout /t 2 /nobreak >nul
tasklist /FI "IMAGENAME eq nanfeng-knowledge-base.exe" /NH 2>nul | find /I "nanfeng-knowledge-base" >nul
if errorlevel 1 (
  >> "%LAUNCH_LOG%" echo 程序启动后两秒内退出
  echo [失败] 程序启动后立即退出，未能打开主界面。
  echo 请把下面的日志文件发给 Codex：
  echo %LAUNCH_LOG%
  pause
  popd
  exit /b 1
)

>> "%LAUNCH_LOG%" echo 程序已成功启动
popd
exit /b 0
