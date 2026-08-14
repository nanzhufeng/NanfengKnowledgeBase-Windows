param(
    [int]$ObservationSeconds = 8,
    [string]$ProbeRoot
)

$ErrorActionPreference = "Stop"

$projectDirectory = Split-Path -Parent $PSScriptRoot
$application = Join-Path $projectDirectory ".runtime-qa\current-acceptance-app\release\nanfeng-knowledge-base.exe"
if ([string]::IsNullOrWhiteSpace($ProbeRoot)) {
    $ProbeRoot = Join-Path $projectDirectory ".runtime-qa\startup-probe"
}
$probeRoot = [System.IO.Path]::GetFullPath($ProbeRoot)
$stdoutPath = Join-Path $probeRoot "stdout.log"
$stderrPath = Join-Path $probeRoot "stderr.log"

if (-not (Test-Path -LiteralPath $application -PathType Leaf)) {
    throw "Current acceptance application was not found: $application"
}

New-Item -ItemType Directory -Force -Path $probeRoot | Out-Null
Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue

$previousPrimaryDataDir = $env:NANFENG_KNOWLEDGE_BASE_DATA_DIR
$previousLegacyDataDir = $env:NANFENG_INTELLIGENCE_DATA_DIR
$env:NANFENG_KNOWLEDGE_BASE_DATA_DIR = $probeRoot
$env:NANFENG_INTELLIGENCE_DATA_DIR = ""

try {
    $process = Start-Process -FilePath $application -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
    $exited = $process.WaitForExit($ObservationSeconds * 1000)

    if ($exited) {
        Write-Output "STATUS=EXITED"
        Write-Output "EXIT_CODE=$($process.ExitCode)"
    }
    else {
        Write-Output "STATUS=RUNNING"
        Write-Output "PID=$($process.Id)"
        Stop-Process -Id $process.Id -Force
        $process.WaitForExit()
        Write-Output "PROBE_PROCESS_STOPPED=true"
    }
}
finally {
    $env:NANFENG_KNOWLEDGE_BASE_DATA_DIR = $previousPrimaryDataDir
    $env:NANFENG_INTELLIGENCE_DATA_DIR = $previousLegacyDataDir
}

if (Test-Path -LiteralPath $stdoutPath) {
    Write-Output "--- stdout ---"
    Get-Content -LiteralPath $stdoutPath
}
if (Test-Path -LiteralPath $stderrPath) {
    Write-Output "--- stderr ---"
    Get-Content -LiteralPath $stderrPath
}

$probeLog = Join-Path $probeRoot "logs\nanfeng-knowledge-base.log"
if (Test-Path -LiteralPath $probeLog) {
    Write-Output "--- application log ---"
    Get-Content -LiteralPath $probeLog -Tail 80
}
