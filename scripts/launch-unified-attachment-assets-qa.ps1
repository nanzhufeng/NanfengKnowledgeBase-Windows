[CmdletBinding()]
param([switch]$Verify, [switch]$Prepare)

$ErrorActionPreference = "Stop"
$projectDirectory = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$buildDirectory = Join-Path $projectDirectory ".runtime-qa\attachment-file-location-v92-build"
$targetDirectory = Join-Path $projectDirectory ".runtime-qa\attachment-file-location-v92-app"
$compiledApplicationPath = Join-Path $buildDirectory "release\nanfeng-knowledge-base.exe"
$applicationPath = Join-Path $targetDirectory "release\nanfeng-knowledge-base.exe"

function Get-Sha256([string]$Path) {
  $hash = [System.Security.Cryptography.SHA256]::Create()
  try {
    $stream = [System.IO.File]::OpenRead($Path)
    try { return ([System.BitConverter]::ToString($hash.ComputeHash($stream))).Replace("-", "") }
    finally { $stream.Dispose() }
  } finally { $hash.Dispose() }
}

if ($Prepare) {
  $env:CARGO_TARGET_DIR = $buildDirectory; $env:CARGO_BUILD_JOBS = "2"
  & npm.cmd run tauri -- build --no-bundle
  if ($LASTEXITCODE -ne 0) { throw "Isolated attachment QA build failed: $LASTEXITCODE" }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $applicationPath) | Out-Null
  Copy-Item -LiteralPath $compiledApplicationPath -Destination $applicationPath -Force
  Write-Host "[PASS] Isolated attachment file location QA application generated; app and formal data were not opened." -ForegroundColor Green
  exit 0
}
if ($Verify) {
  if (-not (Test-Path -LiteralPath $applicationPath -PathType Leaf)) { throw "Isolated QA application not found: $applicationPath" }
  Write-Host "[PASS] Isolated attachment file location QA application is available." -ForegroundColor Green
  Write-Host "Application: $applicationPath"
  Write-Host "SHA256: $(Get-Sha256 $applicationPath)"
  Write-Host "App and formal data were not opened."
  exit 0
}
if (Get-Process -Name "nanfeng-knowledge-base", "nanfeng-intelligence" -ErrorAction SilentlyContinue) { throw "A Nanfeng Knowledge process is already running. Close it before starting this QA application." }
if (-not (Test-Path -LiteralPath $applicationPath -PathType Leaf)) { throw "Run this QA entry with --prepare first." }
Remove-Item Env:NANFENG_KNOWLEDGE_BASE_DATA_DIR -ErrorAction SilentlyContinue
Remove-Item Env:NANFENG_INTELLIGENCE_DATA_DIR -ErrorAction SilentlyContinue
Start-Process -FilePath $applicationPath -WorkingDirectory $projectDirectory
