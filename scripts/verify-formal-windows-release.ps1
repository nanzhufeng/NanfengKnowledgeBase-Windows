[CmdletBinding()]
param(
    [switch]$VerifyOnly
)

$ErrorActionPreference = "Stop"

$projectDirectory = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$packageJsonPath = Join-Path $projectDirectory "package.json"
$tauriConfigPath = Join-Path $projectDirectory "src-tauri\tauri.conf.json"
$readmePath = Join-Path $projectDirectory "README.md"
$previewPath = Join-Path $projectDirectory "docs\screenshots\nanfeng-knowledge-base-windows.png"
$releaseDirectory = Join-Path $projectDirectory ".release-build\release-assets"
$expectedProductName = -join ([char]0x5357, [char]0x67AB, [char]0x77E5, [char]0x8BC6, [char]0x5E93)

function Assert-ReleaseContract {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

try {
    $package = Get-Content -LiteralPath $packageJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $tauri = Get-Content -LiteralPath $tauriConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $readme = Get-Content -LiteralPath $readmePath -Raw -Encoding UTF8
    $version = [string]$tauri.version
    $expectedInstallerName = "Nanfeng-Knowledge-Base-Windows-v$version-Setup.exe"
    $installerPath = Join-Path $releaseDirectory $expectedInstallerName

    Assert-ReleaseContract ($package.version -eq $version) "package.json and Tauri versions do not match."
    Assert-ReleaseContract ($tauri.productName -eq $expectedProductName) "The Tauri product name is incorrect."
    Assert-ReleaseContract ($tauri.bundle.targets -contains "nsis") "The Tauri NSIS target is not enabled."
    Assert-ReleaseContract ($readme.Contains($expectedProductName)) "README does not contain the current product name."
    Assert-ReleaseContract ($readme -match "Windows") "README does not identify the Windows platform."
    Assert-ReleaseContract ($readme -match "nanfeng-knowledge-base-windows\.png") "README does not reference the current preview image."
    Assert-ReleaseContract (Test-Path -LiteralPath $previewPath -PathType Leaf) "The current preview image is missing."
    Assert-ReleaseContract (Test-Path -LiteralPath $installerPath -PathType Leaf) "The formal installer is missing: $expectedInstallerName"

    $installer = Get-Item -LiteralPath $installerPath
    Assert-ReleaseContract ($installer.Length -gt 1MB) "The formal installer size is invalid."
    $stream = [System.IO.File]::OpenRead($installerPath)
    try {
        $first = $stream.ReadByte()
        $second = $stream.ReadByte()
        Assert-ReleaseContract ($first -eq 0x4D -and $second -eq 0x5A) "The installer is not a valid Windows PE file."
    }
    finally {
        $stream.Dispose()
    }

    $hashStream = [System.IO.File]::OpenRead($installerPath)
    try {
        $sha256 = [System.Security.Cryptography.SHA256]::Create()
        try {
            $hash = ([System.BitConverter]::ToString($sha256.ComputeHash($hashStream))).Replace("-", "")
        }
        finally {
            $sha256.Dispose()
        }
    }
    finally {
        $hashStream.Dispose()
    }
    Write-Host "[PASS] $expectedProductName Windows v$version formal installer contract passed." -ForegroundColor Green
    Write-Host "Installer: $installerPath"
    Write-Host "Size: $($installer.Length) bytes"
    Write-Host "SHA-256: $hash"
    Write-Host "Signature: not checked by this local contract"

    if (-not $VerifyOnly) {
        Start-Process explorer.exe -ArgumentList "/select,`"$installerPath`""
    }
}
catch {
    Write-Host "[FAIL] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
