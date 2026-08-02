[CmdletBinding()]
param(
    [switch]$Verify,
    [switch]$Prepare
)

$ErrorActionPreference = "Stop"

$projectDirectory = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$targetDirectory = Join-Path $projectDirectory ".runtime-qa\knowledge-presentation-v13-build"
$applicationPath = Join-Path $targetDirectory "release\nanfeng-knowledge-base.exe"
$logDirectory = Join-Path $projectDirectory ".runtime-qa\knowledge-presentation-v13-launcher"
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
    $Host.UI.RawUI.WindowTitle = "Nanfeng Knowledge - Knowledge Presentation QA"
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    Set-Content -LiteralPath $launchLog -Value "[$(Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff")] launcher started" -Encoding UTF8
    Write-LaunchLog "Project: $projectDirectory"
    Write-LaunchLog "Application: $applicationPath"

    if ($Prepare) {
        if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
            throw "npm.cmd was not found, so the isolated QA build cannot be generated."
        }
        Write-LaunchLog "Building isolated QA executable without opening the application."
        $env:CARGO_TARGET_DIR = $targetDirectory
        $env:CARGO_BUILD_JOBS = "2"
        & npm.cmd run tauri -- build --no-bundle
        if ($LASTEXITCODE -ne 0) {
            throw "QA build failed with exit code $LASTEXITCODE."
        }
        if (-not (Test-Path -LiteralPath $applicationPath -PathType Leaf)) {
            throw "QA application was not found after build: $applicationPath"
        }
        Write-LaunchLog "Prepare completed; application and formal data were not opened."
        Write-Host "[PASS] Isolated QA application generated." -ForegroundColor Green
        Write-Host "The application and formal data were not opened." -ForegroundColor Green
        exit 0
    }

    if ($Verify) {
        if (-not (Test-Path -LiteralPath $applicationPath -PathType Leaf)) {
            throw "QA application was not found: $applicationPath"
        }
        Write-LaunchLog "Verify only; application was not started."
        Write-Host "[PASS] Launcher and isolated QA application are available." -ForegroundColor Green
        Write-Host "The application and formal data were not opened." -ForegroundColor Green
        exit 0
    }

    $runningApplication = @(Get-RunningKnowledgeApp)
    if ($runningApplication.Count -gt 0) {
        throw "A Nanfeng Knowledge process is already running. Close it before starting this QA build."
    }
    if (-not (Test-Path -LiteralPath $applicationPath -PathType Leaf)) {
        throw "QA application was not found. Run this BAT once with --prepare first."
    }

    # Visible user QA uses the default formal data path. Codex only runs Prepare or Verify.
    Remove-Item Env:NANFENG_KNOWLEDGE_BASE_DATA_DIR -ErrorAction SilentlyContinue
    Remove-Item Env:NANFENG_INTELLIGENCE_DATA_DIR -ErrorAction SilentlyContinue

    Write-LaunchLog "Data mode: default formal data location."
    $application = Start-Process -FilePath $applicationPath -WorkingDirectory $projectDirectory -PassThru
    Start-Sleep -Seconds 2
    if ($application.HasExited) {
        throw "The application exited immediately after launch."
    }
    Write-LaunchLog "Application started. Process ID: $($application.Id)"
    exit 0
}
catch {
    try {
        if (Test-Path -LiteralPath $logDirectory) {
            Write-LaunchLog "Failure: $($_.Exception.Message)"
        }
    }
    catch {
        # Logging errors must not hide the original failure.
    }

    if ($Verify -or $Prepare) {
        Write-Host ""
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
