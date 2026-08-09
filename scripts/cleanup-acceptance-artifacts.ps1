[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$projectRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$archiveRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot "docs\archive\acceptance-entrypoints"))
$runtimeRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot ".runtime-qa"))
$separator = [System.IO.Path]::DirectorySeparatorChar
$projectPrefix = $projectRoot.TrimEnd($separator) + $separator
$runtimePrefix = $runtimeRoot.TrimEnd($separator) + $separator
$currentBat = "启动南枫知识库-当前验收.bat"
$preservedRuntimeDirectories = @("current-acceptance-v93-app")
$legacyRunningDirectory = "attachment-default-load-v89-app"
$legacyRunningPath = [System.IO.Path]::GetFullPath((Join-Path $runtimeRoot $legacyRunningDirectory))
try {
  $legacyIsRunning = Get-CimInstance Win32_Process -ErrorAction Stop |
    Where-Object {
      $_.ExecutablePath -and
      [System.IO.Path]::GetFullPath($_.ExecutablePath).StartsWith(
        $legacyRunningPath + $separator,
        [System.StringComparison]::OrdinalIgnoreCase
      )
    } |
    Select-Object -First 1
  if ($legacyIsRunning) {
    $preservedRuntimeDirectories += $legacyRunningDirectory
  }
} catch {
  # 进程枚举失败时宁可保留旧运行包，也不冒险删除正在执行的文件。
  $preservedRuntimeDirectories += $legacyRunningDirectory
}

if (-not $archiveRoot.StartsWith($projectPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Archive path escaped the project root."
}
if (-not $runtimeRoot.StartsWith($projectPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Runtime path escaped the project root."
}

$batFiles = Get-ChildItem -LiteralPath $projectRoot -File -Filter "*.bat" |
  Where-Object Name -ne $currentBat

foreach ($batFile in $batFiles) {
  $destination = Join-Path $archiveRoot ($batFile.Name + ".archived")
  if (Test-Path -LiteralPath $destination) {
    throw "Archive collision: $destination"
  }
}

$runtimeTargets = Get-ChildItem -LiteralPath $runtimeRoot -Directory |
  Where-Object {
    $_.Name -match "(-app|-build)$" -and
    $_.Name -notin $preservedRuntimeDirectories
  }

foreach ($runtimeTarget in $runtimeTargets) {
  $resolved = [System.IO.Path]::GetFullPath($runtimeTarget.FullName)
  if (-not $resolved.StartsWith($runtimePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Runtime target escaped the runtime root: $resolved"
  }
}

foreach ($batFile in $batFiles) {
  $destination = Join-Path $archiveRoot ($batFile.Name + ".archived")
  [System.IO.File]::Move($batFile.FullName, $destination)
}

foreach ($runtimeTarget in $runtimeTargets) {
  [System.IO.Directory]::Delete($runtimeTarget.FullName, $true)
}

[pscustomobject]@{
  ArchivedBatCount = $batFiles.Count
  DeletedRuntimeDirectoryCount = $runtimeTargets.Count
  RemainingRootBatCount = (Get-ChildItem -LiteralPath $projectRoot -File -Filter "*.bat").Count
  CurrentAppExists = Test-Path -LiteralPath (Join-Path $runtimeRoot "current-acceptance-v93-app\release\nanfeng-knowledge-base.exe")
  RunningV89Preserved = Test-Path -LiteralPath (Join-Path $runtimeRoot "attachment-default-load-v89-app\release\nanfeng-knowledge-base.exe")
}
