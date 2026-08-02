[CmdletBinding()]
param(
    [switch]$Verify,
    [switch]$Rebuild
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding

$projectDirectory = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$targetDirectory = Join-Path $projectDirectory ".runtime-qa\core-workspace-three-entry-v1-build"
$applicationPath = Join-Path $targetDirectory "release\nanfeng-knowledge-base.exe"
$logDirectory = Join-Path $projectDirectory ".runtime-qa\core-workspace-three-entry-v1-launcher"
$launchLog = Join-Path $logDirectory "latest.log"

function Write-LaunchLog {
    param([string]$Message)

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    Add-Content -LiteralPath $launchLog -Value "[$timestamp] $Message" -Encoding UTF8
}

function Get-RunningKnowledgeApp {
    Get-Process -ErrorAction SilentlyContinue |
        Where-Object { $_.ProcessName -in @("nanfeng-knowledge-base", "nanfeng-intelligence") }
}

try {
    $Host.UI.RawUI.WindowTitle = "南枫知识库 - 三入口新框架验收"
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    Set-Content -LiteralPath $launchLog -Value "[$(Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff")] 启动三入口新框架验收版" -Encoding UTF8
    Write-LaunchLog "项目目录：$projectDirectory"
    Write-LaunchLog "程序路径：$applicationPath"

    if ($Verify) {
        if (-not (Test-Path -LiteralPath $applicationPath -PathType Leaf)) {
            throw "未找到三入口验收程序：$applicationPath"
        }
        Write-LaunchLog "仅验证启动器与程序路径；未启动程序"
        Write-Host "[通过] 启动器和验收程序路径有效。" -ForegroundColor Green
        Write-Host "未启动程序，也未打开任何数据。" -ForegroundColor Green
        exit 0
    }

    $runningApplication = @(Get-RunningKnowledgeApp)
    if ($runningApplication.Count -gt 0) {
        throw "检测到南枫知识库或旧版程序仍在运行。请先关闭现有窗口，避免不同版本同时读写数据。"
    }

    if ($Rebuild -or -not (Test-Path -LiteralPath $applicationPath -PathType Leaf)) {
        if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
            throw "未找到 npm，无法生成知识视图验收程序。"
        }
        Write-Host "[准备] 正在生成三入口新框架验收程序，不会创建或安装安装包……" -ForegroundColor Cyan
        Write-LaunchLog "开始重新生成验收程序"
        $env:CARGO_TARGET_DIR = $targetDirectory
        & npm.cmd run tauri:build -- --no-bundle
        if ($LASTEXITCODE -ne 0) {
            throw "验收程序生成失败，退出码：$LASTEXITCODE"
        }
    }

    if (-not (Test-Path -LiteralPath $applicationPath -PathType Leaf)) {
        throw "未找到三入口验收程序：$applicationPath"
    }

    # 南烛枫明确要求新验收 BAT 默认进入正式数据，不再显示 1/2 或 YES 确认。
    Remove-Item Env:NANFENG_KNOWLEDGE_BASE_DATA_DIR -ErrorAction SilentlyContinue
    Remove-Item Env:NANFENG_INTELLIGENCE_DATA_DIR -ErrorAction SilentlyContinue
    $dataMode = "正式数据"

    Write-Host "[启动] 南枫知识库三入口新框架验收版（$dataMode）" -ForegroundColor Cyan
    Write-LaunchLog "数据模式：$dataMode"
    $application = Start-Process -FilePath $applicationPath -WorkingDirectory $projectDirectory -PassThru
    Start-Sleep -Seconds 2
    if ($application.HasExited) {
        throw "程序启动后立即退出，未能打开主界面。"
    }

    Write-LaunchLog "程序已成功启动；进程 ID：$($application.Id)"
    Write-Host "程序已启动。关闭应用窗口即可结束本次验收。" -ForegroundColor Green
    exit 0
}
catch {
    try {
        if (Test-Path -LiteralPath $logDirectory) {
            Write-LaunchLog "失败：$($_.Exception.Message)"
        }
    }
    catch {
        # 日志失败不覆盖原始启动错误。
    }
    if ($Verify) {
        Write-Host ""
        Write-Host "[失败] $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "启动日志：$launchLog"
    }
    else {
        Add-Type -AssemblyName System.Windows.Forms
        [void][System.Windows.Forms.MessageBox]::Show(
            "$($_.Exception.Message)`r`n`r`n启动日志：$launchLog",
            "南枫知识库启动失败",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
    }
    exit 1
}
