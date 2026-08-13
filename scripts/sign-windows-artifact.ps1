[CmdletBinding(DefaultParameterSetName = "Verify")]
param(
  [Parameter(Mandatory, ParameterSetName = "Sign")]
  [ValidatePattern("^[A-Fa-f0-9]{40}$")]
  [string]$CertificateThumbprint,

  [Parameter(Mandatory)]
  [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
  [string]$InputFile,

  [Parameter(Mandatory, ParameterSetName = "Sign")]
  [ValidatePattern("^https://")]
  [string]$TimestampUrl,

  [Parameter(ParameterSetName = "Verify")]
  [switch]$Verify
)

$ErrorActionPreference = "Stop"
$resolvedFile = (Resolve-Path -LiteralPath $InputFile).Path
$sdkSignTool = "${env:ProgramFiles(x86)}\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe"
$signTool = if (Test-Path -LiteralPath $sdkSignTool -PathType Leaf) {
  $sdkSignTool
} else {
  (Get-Command signtool.exe -ErrorAction Stop).Source
}

function Assert-ValidSignature([string]$FilePath) {
  & $signTool verify /pa /all $FilePath
  if ($LASTEXITCODE -ne 0) {
    throw "Authenticode verification failed: $FilePath"
  }

  $signature = Get-AuthenticodeSignature -LiteralPath $FilePath
  if ($signature.Status -ne "Valid") {
    throw "Authenticode status is $($signature.Status): $($signature.StatusMessage)"
  }
  return $signature
}

if ($PSCmdlet.ParameterSetName -eq "Sign") {
  $certificate = Get-ChildItem -Path "Cert:\CurrentUser\My\$CertificateThumbprint", "Cert:\LocalMachine\My\$CertificateThumbprint" -ErrorAction SilentlyContinue |
    Where-Object {
      $_.HasPrivateKey -and @($_.EnhancedKeyUsageList | ForEach-Object Value) -contains "1.3.6.1.5.5.7.3.3"
    } |
    Select-Object -First 1
  if ($null -eq $certificate) {
    throw "No usable code-signing certificate with private key was found for thumbprint $CertificateThumbprint. Self-signed certificates are not accepted."
  }

  & $signTool sign /sha1 $certificate.Thumbprint /fd SHA256 /tr $TimestampUrl /td SHA256 $resolvedFile
  if ($LASTEXITCODE -ne 0) {
    throw "Signing failed: $resolvedFile"
  }
}

$verifiedSignature = Assert-ValidSignature $resolvedFile
$sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedFile).Hash
Write-Host "[PASS] Authenticode signature is valid."
Write-Host "Signer: $($verifiedSignature.SignerCertificate.Subject)"
Write-Host "File: $resolvedFile"
Write-Host "SHA256: $sha256"
