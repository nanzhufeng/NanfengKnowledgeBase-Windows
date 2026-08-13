[CmdletBinding(SupportsShouldProcess)]
param(
  [switch]$Apply
)

$ErrorActionPreference = "Stop"
$projectRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$runtimeRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot ".runtime-qa"))
$separator = [System.IO.Path]::DirectorySeparatorChar
$projectPrefix = $projectRoot.TrimEnd($separator) + $separator
$runtimePrefix = $runtimeRoot.TrimEnd($separator) + $separator
if (-not $runtimeRoot.StartsWith($projectPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Runtime path escaped the project root."
}

$runningExecutablePaths = @(Get-CimInstance Win32_Process -ErrorAction Stop |
  Where-Object { $_.ExecutablePath } |
  ForEach-Object { [System.IO.Path]::GetFullPath($_.ExecutablePath) })

$runtimeTargets = Get-ChildItem -LiteralPath $runtimeRoot -Directory -ErrorAction Stop |
  Where-Object {
    $_.Name -match "^current-acceptance-v\d+-(app|build)$"
  }

foreach ($runtimeTarget in $runtimeTargets) {
  $resolved = [System.IO.Path]::GetFullPath($runtimeTarget.FullName)
  if (-not $resolved.StartsWith($runtimePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Runtime target escaped the runtime root: $resolved"
  }
}

$runningTargets = @($runtimeTargets | Where-Object {
  $candidatePrefix = [System.IO.Path]::GetFullPath($_.FullName).TrimEnd($separator) + $separator
  $runningExecutablePaths | Where-Object { $_.StartsWith($candidatePrefix, [System.StringComparison]::OrdinalIgnoreCase) }
})

$deletableTargets = @($runtimeTargets | Where-Object { $_.FullName -notin $runningTargets.FullName })

$summary = [pscustomobject]@{
  Mode = if ($Apply) { "Apply" } else { "Preview" }
  CandidateDirectories = $runtimeTargets.FullName
  RunningDirectories = $runningTargets.FullName
  DeletableDirectories = $deletableTargets.FullName
  ProtectedDirectories = @("current-acceptance-app", "current-acceptance-build", "knowledge-final-layout-evidence", "build-logs")
}

if (-not $Apply) {
  $summary
  Write-Host "Preview only. Re-run with -Apply after reviewing the candidate list." -ForegroundColor Yellow
  exit 0
}

foreach ($runtimeTarget in $deletableTargets) {
  if ($PSCmdlet.ShouldProcess($runtimeTarget.FullName, "Delete historical acceptance artifact")) {
    Remove-Item -LiteralPath $runtimeTarget.FullName -Recurse -Force
  }
}

$summary
