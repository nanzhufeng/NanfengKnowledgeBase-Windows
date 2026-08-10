[CmdletBinding()]
param([switch]$Verify, [switch]$Prepare)

$ErrorActionPreference = "Stop"
$projectDirectory = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$runtimeDirectory = [System.IO.Path]::GetFullPath((Join-Path $projectDirectory ".runtime-qa"))
$buildDirectory = Join-Path $runtimeDirectory "current-acceptance-v101-build"
$targetDirectory = Join-Path $runtimeDirectory "current-acceptance-v101-app"
$compiledApplicationPath = Join-Path $buildDirectory "release\nanfeng-knowledge-base.exe"
$applicationPath = Join-Path $targetDirectory "release\nanfeng-knowledge-base.exe"
$buildLockPath = Join-Path $runtimeDirectory "current-acceptance-build.lock"

function Get-Sha256([string]$Path) {
  $hash = [System.Security.Cryptography.SHA256]::Create()
  try {
    $stream = [System.IO.File]::OpenRead($Path)
    try { return ([System.BitConverter]::ToString($hash.ComputeHash($stream))).Replace("-", "") }
    finally { $stream.Dispose() }
  } finally { $hash.Dispose() }
}

function Open-BuildLock {
  New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null
  try {
    return [System.IO.File]::Open($buildLockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
  } catch {
    throw "The current acceptance build is already locked by another process. Retry after it finishes."
  }
}

if ($Prepare) {
  $buildLock = Open-BuildLock
  try {
    $env:CARGO_TARGET_DIR = $buildDirectory
    $env:CARGO_BUILD_JOBS = "2"
    $env:NF_BUILD_LABEL = "v101-ai-batch-live-progress"
    & npm.cmd run tauri -- build --no-bundle
    if ($LASTEXITCODE -ne 0) { throw "The isolated current acceptance build failed: $LASTEXITCODE" }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $applicationPath) | Out-Null
    Copy-Item -LiteralPath $compiledApplicationPath -Destination $applicationPath -Force
    Write-Host "[PASS] v101 AI batch live progress acceptance app generated. App and formal data were not opened." -ForegroundColor Green
  } finally {
    $buildLock.Dispose()
  }
  exit 0
}

if ($Verify) {
  if (-not (Test-Path -LiteralPath $applicationPath -PathType Leaf)) { throw "Current acceptance app not found: $applicationPath" }
  $size = (Get-Item -LiteralPath $applicationPath).Length
  $sha256 = Get-Sha256 $applicationPath
  Write-Host "[PASS] v101 AI batch live progress acceptance app is available." -ForegroundColor Green
  Write-Host "Application: $applicationPath"
  Write-Host "Build label: v101-ai-batch-live-progress"
  Write-Host "Size: $size"
  Write-Host "SHA256: $sha256"
  Write-Host "App and formal data were not opened."
  exit 0
}

if (Get-Process -Name "nanfeng-knowledge-base", "nanfeng-intelligence" -ErrorAction SilentlyContinue) {
  throw "A Nanfeng Knowledge process is already running. Close it before launching the current acceptance app."
}
if (-not (Test-Path -LiteralPath $applicationPath -PathType Leaf)) {
  throw "The current acceptance app is not prepared. Run the BAT with --prepare first."
}
Remove-Item Env:NANFENG_KNOWLEDGE_BASE_DATA_DIR -ErrorAction SilentlyContinue
Remove-Item Env:NANFENG_INTELLIGENCE_DATA_DIR -ErrorAction SilentlyContinue
Start-Process -FilePath $applicationPath -WorkingDirectory $projectDirectory
