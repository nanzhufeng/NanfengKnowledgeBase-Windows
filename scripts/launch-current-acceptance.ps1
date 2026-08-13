[CmdletBinding()]
param([switch]$Verify, [switch]$Prepare)

$ErrorActionPreference = "Stop"
$projectDirectory = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$runtimeDirectory = [System.IO.Path]::GetFullPath((Join-Path $projectDirectory ".runtime-qa"))
$buildDirectory = Join-Path $runtimeDirectory "current-acceptance-build"
$targetDirectory = Join-Path $runtimeDirectory "current-acceptance-app"
$compiledApplicationPath = Join-Path $buildDirectory "release\nanfeng-knowledge-base.exe"
$applicationPath = Join-Path $targetDirectory "release\nanfeng-knowledge-base.exe"
$buildInfoPath = Join-Path $targetDirectory "build-info.json"
$buildLockPath = Join-Path $runtimeDirectory "current-acceptance-build.lock"
$buildLabel = "v147-prompt-cache-execution-contract"

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

function Get-SourceState {
  $sourceRoots = @(
    (Join-Path $projectDirectory "src"),
    (Join-Path $projectDirectory "src-tauri\src"),
    (Join-Path $projectDirectory "src-tauri\migrations")
  )
  $sourceFiles = @(
    (Join-Path $projectDirectory "package.json"),
    (Join-Path $projectDirectory "package-lock.json"),
    (Join-Path $projectDirectory "vite.config.ts"),
    (Join-Path $projectDirectory "tsconfig.json"),
    (Join-Path $projectDirectory "src-tauri\Cargo.toml"),
    (Join-Path $projectDirectory "src-tauri\Cargo.lock"),
    (Join-Path $projectDirectory "src-tauri\tauri.conf.json"),
    (Join-Path $projectDirectory "src-tauri\build.rs")
  )
  foreach ($sourceRoot in $sourceRoots) {
    $sourceFiles += Get-ChildItem -LiteralPath $sourceRoot -Recurse -File | Select-Object -ExpandProperty FullName
  }
  $sourceFiles = $sourceFiles |
    Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
    Sort-Object -Unique
  $manifestLines = foreach ($sourceFile in $sourceFiles) {
    $relativePath = $sourceFile.Substring($projectDirectory.Length).TrimStart("\").Replace("\", "/")
    "$relativePath`t$(Get-Sha256 $sourceFile)"
  }
  $manifestText = ($manifestLines -join "`n")
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($manifestText)
  $hash = [System.Security.Cryptography.SHA256]::Create()
  try {
    $fingerprint = ([System.BitConverter]::ToString($hash.ComputeHash($bytes))).Replace("-", "")
  } finally {
    $hash.Dispose()
  }
  return [pscustomobject]@{
    Fingerprint = $fingerprint
    FileCount = $sourceFiles.Count
  }
}

function Get-GitState {
  $head = (& git -C $projectDirectory rev-parse HEAD 2>$null)
  if ($LASTEXITCODE -ne 0) { throw "Unable to read the Git commit for the acceptance build." }
  $branch = (& git -C $projectDirectory branch --show-current 2>$null)
  $status = (& git -C $projectDirectory status --porcelain=v1 --untracked-files=all 2>$null)
  return [pscustomobject]@{
    Head = "$head".Trim()
    Branch = "$branch".Trim()
    Dirty = [bool]($status)
  }
}

function Get-RunningApplicationProcess {
  $normalizedApplicationPath = [System.IO.Path]::GetFullPath($applicationPath)
  return Get-CimInstance Win32_Process -ErrorAction Stop |
    Where-Object {
      $_.ExecutablePath -and
      [System.IO.Path]::GetFullPath($_.ExecutablePath) -eq $normalizedApplicationPath
    } |
    Select-Object -First 1
}

function Assert-CurrentApplicationStopped {
  $runningProcess = Get-RunningApplicationProcess
  if ($runningProcess) {
    throw "The current acceptance application is running (PID $($runningProcess.ProcessId)). Close it before preparing a replacement."
  }
}

function Write-BuildInfo([string]$Sha256, [Int64]$Size, $SourceState, $GitState) {
  $buildInfo = [ordered]@{
    BuildLabel = $buildLabel
    Application = $applicationPath
    Size = $Size
    SHA256 = $Sha256
    SourceFingerprintSHA256 = $SourceState.Fingerprint
    SourceFileCount = $SourceState.FileCount
    GitHead = $GitState.Head
    GitBranch = $GitState.Branch
    GitDirty = $GitState.Dirty
    PreparedAt = (Get-Date).ToString("o")
  }
  $buildInfo | ConvertTo-Json | Set-Content -LiteralPath $buildInfoPath -Encoding utf8
}

if ($Prepare) {
  $buildLock = Open-BuildLock
  try {
    Assert-CurrentApplicationStopped
    $env:CARGO_TARGET_DIR = $buildDirectory
    $env:CARGO_BUILD_JOBS = "2"
    $env:NF_BUILD_LABEL = $buildLabel
    & npm.cmd run tauri -- build --no-bundle
    if ($LASTEXITCODE -ne 0) { throw "The isolated current acceptance build failed: $LASTEXITCODE" }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $applicationPath) | Out-Null
    Copy-Item -LiteralPath $compiledApplicationPath -Destination $applicationPath -Force
    $size = (Get-Item -LiteralPath $applicationPath).Length
    $sha256 = Get-Sha256 $applicationPath
    $sourceState = Get-SourceState
    $gitState = Get-GitState
    Write-BuildInfo -Sha256 $sha256 -Size $size -SourceState $sourceState -GitState $gitState
    Write-Host "[PASS] $buildLabel acceptance app generated. App and formal data were not opened." -ForegroundColor Green
  } finally {
    $buildLock.Dispose()
  }
  exit 0
}

if ($Verify) {
  if (-not (Test-Path -LiteralPath $applicationPath -PathType Leaf)) { throw "Current acceptance app not found: $applicationPath" }
  if (-not (Test-Path -LiteralPath $buildInfoPath -PathType Leaf)) { throw "Current acceptance metadata not found: $buildInfoPath" }
  $size = (Get-Item -LiteralPath $applicationPath).Length
  $sha256 = Get-Sha256 $applicationPath
  $buildInfo = Get-Content -LiteralPath $buildInfoPath -Raw | ConvertFrom-Json
  $sourceState = Get-SourceState
  if ($buildInfo.BuildLabel -ne $buildLabel -or
      [System.IO.Path]::GetFullPath($buildInfo.Application) -ne [System.IO.Path]::GetFullPath($applicationPath) -or
      $buildInfo.Size -ne $size -or
      $buildInfo.SHA256 -ne $sha256 -or
      $buildInfo.SourceFingerprintSHA256 -ne $sourceState.Fingerprint -or
      $buildInfo.SourceFileCount -ne $sourceState.FileCount) {
    throw "Current acceptance metadata does not match the application. Prepare a new isolated build before launching it."
  }
  Write-Host "[PASS] $buildLabel acceptance app is available." -ForegroundColor Green
  Write-Host "Application: $applicationPath"
  Write-Host "Build label: $buildLabel"
  Write-Host "Size: $size"
  Write-Host "SHA256: $sha256"
  Write-Host "Source fingerprint: $($sourceState.Fingerprint) ($($sourceState.FileCount) files)"
  Write-Host "Git: $($buildInfo.GitHead) branch=$($buildInfo.GitBranch) dirty=$($buildInfo.GitDirty)"
  Write-Host "App and formal data were not opened."
  exit 0
}

throw "This maintenance script only prepares or verifies an isolated build. Use the root BAT to start the current acceptance application."
