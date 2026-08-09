[CmdletBinding()]
param([switch]$Verify, [switch]$Prepare)

$ErrorActionPreference = "Stop"
$projectDirectory = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$buildDirectory = Join-Path $projectDirectory ".runtime-qa\unified-history-search-context-menu-build"
$targetDirectory = Join-Path $projectDirectory ".runtime-qa\unified-history-search-context-menu-v81-app"
$compiledApplicationPath = Join-Path $buildDirectory "release\nanfeng-knowledge-base.exe"
$applicationPath = Join-Path $targetDirectory "release\nanfeng-knowledge-base.exe"

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

if ($Prepare) {
  $env:CARGO_TARGET_DIR = $buildDirectory
  $env:CARGO_BUILD_JOBS = "2"
  & npm.cmd run tauri -- build --no-bundle
  if ($LASTEXITCODE -ne 0) { throw "Isolated unified history-search QA build failed: $LASTEXITCODE" }
  if (-not (Test-Path -LiteralPath $compiledApplicationPath -PathType Leaf)) {
    throw "Compiled QA application was not found."
  }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $applicationPath) | Out-Null
  Copy-Item -LiteralPath $compiledApplicationPath -Destination $applicationPath -Force
  Write-Host "[PASS] Unified history search and context-menu QA application generated." -ForegroundColor Green
  Write-Host "The application and formal data were not opened."
  exit 0
}

if ($Verify) {
  if (-not (Test-Path -LiteralPath $applicationPath -PathType Leaf)) {
    throw "Run this QA entry with --prepare first."
  }
  Write-Host "[PASS] Isolated QA application is available." -ForegroundColor Green
  Write-Host "Application: $applicationPath"
  Write-Host "SHA256: $(Get-Sha256 -Path $applicationPath)"
  Write-Host "The application and formal data were not opened."
  exit 0
}

if (Get-Process -Name "nanfeng-knowledge-base", "nanfeng-intelligence" -ErrorAction SilentlyContinue) {
  Add-Type -AssemblyName System.Windows.Forms
  [void][System.Windows.Forms.MessageBox]::Show(
    "Nanfeng Knowledge is already running. Close the current window before starting this QA build.",
    "Nanfeng Knowledge",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Information
  )
  exit 1
}

if (-not (Test-Path -LiteralPath $applicationPath -PathType Leaf)) {
  Add-Type -AssemblyName System.Windows.Forms
  [void][System.Windows.Forms.MessageBox]::Show(
    "The QA package is not ready. Run the BAT with --prepare first. Formal data was not opened or migrated.",
    "Nanfeng Knowledge",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Information
  )
  exit 1
}

Remove-Item Env:NANFENG_KNOWLEDGE_BASE_DATA_DIR -ErrorAction SilentlyContinue
Remove-Item Env:NANFENG_INTELLIGENCE_DATA_DIR -ErrorAction SilentlyContinue
Start-Process -FilePath $applicationPath -WorkingDirectory $projectDirectory
