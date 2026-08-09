[CmdletBinding()]
param(
    [switch]$Verify,
    [switch]$Prepare
)

$ErrorActionPreference = "Stop"

$projectDirectory = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$buildDirectory = Join-Path $projectDirectory ".runtime-qa\knowledge-base-build"
$targetDirectory = Join-Path $projectDirectory ".runtime-qa\virtual-list-webview-stability-v76-app"
$compiledApplicationPath = Join-Path $buildDirectory "release\nanfeng-knowledge-base.exe"
$applicationPath = Join-Path $targetDirectory "release\nanfeng-knowledge-base.exe"
$logDirectory = Join-Path $projectDirectory ".runtime-qa\virtual-list-webview-stability-v76-launcher"
$launchLog = Join-Path $logDirectory "latest.log"

function Write-LaunchLog {
    param([string]$Message)
    Add-Content -LiteralPath $launchLog -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff')] $Message" -Encoding UTF8
}

function Get-RunningKnowledgeApp {
    Get-Process -ErrorAction SilentlyContinue |
        Where-Object { $_.ProcessName -in @("nanfeng-knowledge-base", "nanfeng-intelligence") }
}

function Get-Sha256 {
    param([string]$Path)
    $stream = [System.IO.File]::OpenRead($Path)
    try {
        $sha256 = [System.Security.Cryptography.SHA256]::Create()
        try { return ([System.BitConverter]::ToString($sha256.ComputeHash($stream))).Replace("-", "") }
        finally { $sha256.Dispose() }
    }
    finally { $stream.Dispose() }
}

try {
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    Set-Content -LiteralPath $launchLog -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff')] launcher started" -Encoding UTF8

    if ($Prepare) {
        if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
            throw "npm.cmd was not found, so the isolated QA build cannot be generated."
        }
        Write-LaunchLog "Building isolated v76 QA executable without opening the application."
        $env:CARGO_TARGET_DIR = $buildDirectory
        $env:CARGO_BUILD_JOBS = "2"
        & npm.cmd run tauri -- build --no-bundle
        if ($LASTEXITCODE -ne 0) { throw "QA build failed with exit code $LASTEXITCODE." }
        if (-not (Test-Path -LiteralPath $compiledApplicationPath -PathType Leaf)) {
            throw "Compiled QA application was not found: $compiledApplicationPath"
        }
        New-Item -ItemType Directory -Path (Split-Path -Parent $applicationPath) -Force | Out-Null
        Copy-Item -LiteralPath $compiledApplicationPath -Destination $applicationPath -Force
        Write-LaunchLog "Prepare completed; application and formal data were not opened."
        Write-Host "[PASS] Isolated v76 QA application generated." -ForegroundColor Green
        Write-Host "The application and formal data were not opened." -ForegroundColor Green
        exit 0
    }

    if ($Verify) {
        if (-not (Test-Path -LiteralPath $applicationPath -PathType Leaf)) {
            throw "QA application was not found: $applicationPath"
        }
        $hash = Get-Sha256 -Path $applicationPath
        Write-LaunchLog "Verify only; application was not started. SHA256: $hash"
        Write-Host "[PASS] v76 launcher and isolated QA application are available." -ForegroundColor Green
        Write-Host "Application: $applicationPath"
        Write-Host "SHA256: $hash"
        Write-Host "The application and formal data were not opened." -ForegroundColor Green
        exit 0
    }

    if (@(Get-RunningKnowledgeApp).Count -gt 0) {
        throw "A Nanfeng Knowledge process is already running. Close it before starting this QA build."
    }
    if (-not (Test-Path -LiteralPath $applicationPath -PathType Leaf)) {
        throw "QA application was not found. Run this BAT once with --prepare first."
    }

    # 只有南烛枫双击才使用默认正式数据目录；Codex只执行 Prepare / Verify。
    Remove-Item Env:NANFENG_KNOWLEDGE_BASE_DATA_DIR -ErrorAction SilentlyContinue
    Remove-Item Env:NANFENG_INTELLIGENCE_DATA_DIR -ErrorAction SilentlyContinue
    Write-LaunchLog "Data mode: default formal data location."
    $application = Start-Process -FilePath $applicationPath -WorkingDirectory $projectDirectory -PassThru
    Start-Sleep -Seconds 2
    if ($application.HasExited) { throw "The application exited immediately after launch." }
    Write-LaunchLog "Application started. Process ID: $($application.Id)"
}
catch {
    try { Write-LaunchLog "Failure: $($_.Exception.Message)" } catch {}
    if ($Verify -or $Prepare) {
        Write-Host "[FAIL] $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Launcher log: $launchLog"
    }
    else {
        Add-Type -AssemblyName System.Windows.Forms
        [void][System.Windows.Forms.MessageBox]::Show(
            "$($_.Exception.Message)`r`n`r`nLauncher log: $launchLog",
            "Nanfeng Knowledge launch failed",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
    }
    exit 1
}
