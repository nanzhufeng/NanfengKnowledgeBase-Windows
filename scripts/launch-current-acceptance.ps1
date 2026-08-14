[CmdletBinding()]
param(
  [switch]$Verify,
  [switch]$Prepare,
  [switch]$Launch,
  [string]$DataDirectory
)

$ErrorActionPreference = "Stop"
$projectDirectory = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$runtimeDirectory = [System.IO.Path]::GetFullPath((Join-Path $projectDirectory ".runtime-qa"))
$buildDirectory = Join-Path $runtimeDirectory "current-acceptance-build"
$targetDirectory = Join-Path $runtimeDirectory "current-acceptance-app"
$compiledApplicationPath = Join-Path $buildDirectory "release\nanfeng-knowledge-base.exe"
$applicationPath = Join-Path $targetDirectory "release\nanfeng-knowledge-base.exe"
$buildInfoPath = Join-Path $targetDirectory "build-info.json"
$buildLockPath = Join-Path $runtimeDirectory "current-acceptance-build.lock"
$launchLogPath = Join-Path $runtimeDirectory "current-acceptance-launch.log"
$launcherBatPath = Join-Path $projectDirectory "启动南枫知识库-当前验收.bat"
$buildLabel = "v156-key-field-and-model-curation"

function Get-Sha256([string]$Path) {
  $hash = [System.Security.Cryptography.SHA256]::Create()
  try {
    $stream = [System.IO.File]::OpenRead($Path)
    try { return ([System.BitConverter]::ToString($hash.ComputeHash($stream))).Replace("-", "") }
    finally { $stream.Dispose() }
  } finally { $hash.Dispose() }
}

function Assert-LauncherBatCompatible {
  if (-not (Test-Path -LiteralPath $launcherBatPath -PathType Leaf)) {
    throw "Root launcher BAT not found: $launcherBatPath"
  }
  $bytes = [System.IO.File]::ReadAllBytes($launcherBatPath)
  if ($bytes | Where-Object { $_ -gt 127 } | Select-Object -First 1) {
    throw "Root launcher BAT must remain ASCII-only so cmd.exe can read it consistently."
  }
  for ($index = 0; $index -lt $bytes.Length; $index += 1) {
    if ($bytes[$index] -eq 10 -and ($index -eq 0 -or $bytes[$index - 1] -ne 13)) {
      throw "Root launcher BAT contains LF-only line endings. Normalize it to Windows CRLF before building."
    }
  }

  $scriptBytes = [System.IO.File]::ReadAllBytes($PSCommandPath)
  if ($scriptBytes.Length -lt 3 -or
      $scriptBytes[0] -ne 0xEF -or
      $scriptBytes[1] -ne 0xBB -or
      $scriptBytes[2] -ne 0xBF) {
    throw "The PowerShell launcher must use UTF-8 with BOM for Windows PowerShell 5.1 compatibility."
  }
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
    (Join-Path $projectDirectory "src-tauri\build.rs"),
    (Join-Path $projectDirectory "scripts\launch-current-acceptance.ps1"),
    (Join-Path $projectDirectory "scripts\probe-current-acceptance-startup.ps1"),
    (Join-Path $projectDirectory "启动南枫知识库-当前验收.bat")
  )
  foreach ($sourceRoot in $sourceRoots) {
    $sourceFiles += Get-ChildItem -LiteralPath $sourceRoot -Recurse -File | Select-Object -ExpandProperty FullName
  }
  $sourceFiles = [string[]]@(
    $sourceFiles | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf }
  )
  # Sort-Object follows the host PowerShell culture and produced different manifests
  # between Windows PowerShell 5.1 and PowerShell 7. Use ordinal ordering instead.
  [System.Array]::Sort($sourceFiles, [System.StringComparer]::Ordinal)
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

function Write-LaunchLog([string]$Status, [string]$Detail) {
  New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null
  $line = "$(Get-Date -Format o)`t$Status`t$Detail"
  Add-Content -LiteralPath $launchLogPath -Value $line -Encoding utf8
}

function Get-ConflictingApplicationProcesses {
  return Get-CimInstance Win32_Process -ErrorAction Stop |
    Where-Object { $_.Name -in @("nanfeng-knowledge-base.exe", "nanfeng-intelligence.exe") }
}

function Show-ExistingApplicationWindow($ProcessInfo) {
  $process = Get-Process -Id $ProcessInfo.ProcessId -ErrorAction Stop
  if ($process.MainWindowHandle -eq 0) { return $false }

  if (-not ("NanfengLauncher.NativeWindow" -as [type])) {
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
namespace NanfengLauncher {
  public static class NativeWindow {
    [DllImport("user32.dll")]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
  }
}
"@
  }

  [void][NanfengLauncher.NativeWindow]::ShowWindowAsync($process.MainWindowHandle, 9)
  [void][NanfengLauncher.NativeWindow]::SetForegroundWindow($process.MainWindowHandle)
  return $true
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
  $json = $buildInfo | ConvertTo-Json
  [System.IO.File]::WriteAllText($buildInfoPath, $json, [System.Text.UTF8Encoding]::new($true))
}

function Assert-CurrentBuild {
  if (-not (Test-Path -LiteralPath $applicationPath -PathType Leaf)) { throw "Current acceptance app not found: $applicationPath" }
  if (-not (Test-Path -LiteralPath $buildInfoPath -PathType Leaf)) { throw "Current acceptance metadata not found: $buildInfoPath" }
  $size = (Get-Item -LiteralPath $applicationPath).Length
  $sha256 = Get-Sha256 $applicationPath
  $buildInfoJson = [System.IO.File]::ReadAllText($buildInfoPath, [System.Text.Encoding]::UTF8)
  $buildInfo = $buildInfoJson | ConvertFrom-Json
  $sourceState = Get-SourceState
  $mismatches = @()
  if ($buildInfo.BuildLabel -ne $buildLabel) { $mismatches += "build-label" }
  if ([System.IO.Path]::GetFullPath($buildInfo.Application) -ne [System.IO.Path]::GetFullPath($applicationPath)) { $mismatches += "application-path" }
  if ($buildInfo.Size -ne $size) { $mismatches += "size" }
  if ($buildInfo.SHA256 -ne $sha256) { $mismatches += "sha256" }
  if ($buildInfo.SourceFingerprintSHA256 -ne $sourceState.Fingerprint) {
    $mismatches += "source-fingerprint(expected=$($buildInfo.SourceFingerprintSHA256),actual=$($sourceState.Fingerprint))"
  }
  if ($buildInfo.SourceFileCount -ne $sourceState.FileCount) {
    $mismatches += "source-file-count(expected=$($buildInfo.SourceFileCount),actual=$($sourceState.FileCount))"
  }
  if ($mismatches.Count -gt 0) {
    throw "Current acceptance metadata does not match the application: $($mismatches -join ', '). Prepare a new isolated build before launching it."
  }
  return [pscustomobject]@{
    Size = $size
    Sha256 = $sha256
    BuildInfo = $buildInfo
    SourceState = $sourceState
  }
}

function Write-VerifiedBuild($VerifiedBuild) {
  Write-Host "[PASS] $buildLabel acceptance app is available." -ForegroundColor Green
  Write-Host "Application: $applicationPath"
  Write-Host "Build label: $buildLabel"
  Write-Host "Size: $($VerifiedBuild.Size)"
  Write-Host "SHA256: $($VerifiedBuild.Sha256)"
  Write-Host "Source fingerprint: $($VerifiedBuild.SourceState.Fingerprint) ($($VerifiedBuild.SourceState.FileCount) files)"
  Write-Host "Git: $($VerifiedBuild.BuildInfo.GitHead) branch=$($VerifiedBuild.BuildInfo.GitBranch) dirty=$($VerifiedBuild.BuildInfo.GitDirty)"
}

if ($Prepare) {
  Assert-LauncherBatCompatible
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
  Assert-LauncherBatCompatible
  $verifiedBuild = Assert-CurrentBuild
  Write-VerifiedBuild $verifiedBuild
  Write-Host "App and formal data were not opened."
  exit 0
}

if ($Launch) {
  try {
    Assert-LauncherBatCompatible
    $verifiedBuild = Assert-CurrentBuild
    Write-VerifiedBuild $verifiedBuild

    $conflicts = @(Get-ConflictingApplicationProcesses)
    if ($conflicts.Count -gt 0) {
      $currentApplication = $conflicts | Where-Object {
        $_.ExecutablePath -and
        [System.IO.Path]::GetFullPath($_.ExecutablePath) -eq [System.IO.Path]::GetFullPath($applicationPath)
      } | Select-Object -First 1
      if ($currentApplication -and (Show-ExistingApplicationWindow $currentApplication)) {
        $detail = "Restored existing current acceptance window. PID=$($currentApplication.ProcessId)"
        Write-LaunchLog "RESTORED" $detail
        Write-Host "[PASS] 南枫知识库已在运行，窗口已恢复到前台。" -ForegroundColor Green
        exit 0
      }

      $description = ($conflicts | ForEach-Object {
        "PID=$($_.ProcessId) Name=$($_.Name) Path=$($_.ExecutablePath)"
      }) -join "; "
      throw "检测到仍在运行的南枫知识库进程，但无法恢复其窗口。请在任务管理器结束旧进程后重试。$description"
    }

    $portOwner = Get-NetTCPConnection -LocalPort 47633 -ErrorAction SilentlyContinue |
      Where-Object { $_.State -eq "Listen" } |
      Select-Object -First 1
    if ($portOwner) {
      $ownerProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$($portOwner.OwningProcess)" -ErrorAction SilentlyContinue
      throw "南枫知识库启动端口 47633 已被占用。PID=$($portOwner.OwningProcess) Name=$($ownerProcess.Name) Path=$($ownerProcess.ExecutablePath)"
    }

    $previousPrimaryDataDir = [Environment]::GetEnvironmentVariable("NANFENG_KNOWLEDGE_BASE_DATA_DIR", "Process")
    $previousLegacyDataDir = [Environment]::GetEnvironmentVariable("NANFENG_INTELLIGENCE_DATA_DIR", "Process")
    try {
      if ([string]::IsNullOrWhiteSpace($DataDirectory)) {
        Remove-Item Env:NANFENG_KNOWLEDGE_BASE_DATA_DIR -ErrorAction SilentlyContinue
      }
      else {
        $resolvedDataDirectory = [System.IO.Path]::GetFullPath($DataDirectory)
        New-Item -ItemType Directory -Force -Path $resolvedDataDirectory | Out-Null
        $env:NANFENG_KNOWLEDGE_BASE_DATA_DIR = $resolvedDataDirectory
      }
      Remove-Item Env:NANFENG_INTELLIGENCE_DATA_DIR -ErrorAction SilentlyContinue

      $process = Start-Process -FilePath $applicationPath -WorkingDirectory (Split-Path -Parent $applicationPath) -PassThru
    }
    finally {
      if ($null -eq $previousPrimaryDataDir) { Remove-Item Env:NANFENG_KNOWLEDGE_BASE_DATA_DIR -ErrorAction SilentlyContinue }
      else { $env:NANFENG_KNOWLEDGE_BASE_DATA_DIR = $previousPrimaryDataDir }
      if ($null -eq $previousLegacyDataDir) { Remove-Item Env:NANFENG_INTELLIGENCE_DATA_DIR -ErrorAction SilentlyContinue }
      else { $env:NANFENG_INTELLIGENCE_DATA_DIR = $previousLegacyDataDir }
    }

    Start-Sleep -Milliseconds 3000
    $process.Refresh()
    if ($process.HasExited) {
      throw "南枫知识库启动后立即退出，退出码：$($process.ExitCode)。请把 $launchLogPath 交给维护者。"
    }

    $detail = "Started current acceptance app. PID=$($process.Id) DataDirectory=$DataDirectory"
    Write-LaunchLog "STARTED" $detail
    Write-Host "[PASS] 南枫知识库已启动，PID=$($process.Id)。" -ForegroundColor Green
    exit 0
  }
  catch {
    Write-LaunchLog "FAILED" $_.Exception.Message
    throw
  }
}

throw "Specify -Prepare, -Verify, or -Launch."
