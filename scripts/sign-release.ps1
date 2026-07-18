param(
    [Parameter(Mandatory = $true)]
    [string[]]$ArtifactPath,
    [string]$TimestampUrl = "http://timestamp.digicert.com"
)

$ErrorActionPreference = "Stop"
$thumbprint = $env:WINDOWS_SIGNING_CERTIFICATE_SHA1
$pfxPath = $env:WINDOWS_SIGNING_PFX_PATH
$pfxPassword = $env:WINDOWS_SIGNING_PFX_PASSWORD
$signtool = $env:WINDOWS_SIGNTOOL_PATH
if (-not $signtool) {
    $command = Get-Command signtool.exe -ErrorAction SilentlyContinue
    if ($command) { $signtool = $command.Source }
}
if (-not $signtool) {
    $kits = Get-ChildItem -Path "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Filter signtool.exe -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match "\\x64\\signtool\.exe$" } |
        Sort-Object FullName -Descending
    $signtool = $kits | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $signtool -or -not (Test-Path -LiteralPath $signtool)) { throw "signtool.exe is unavailable." }
if (-not $thumbprint -and -not $pfxPath) {
    throw "Set WINDOWS_SIGNING_CERTIFICATE_SHA1 for a preinstalled certificate, or WINDOWS_SIGNING_PFX_PATH and WINDOWS_SIGNING_PFX_PASSWORD for a protected PFX."
}
if ($pfxPath -and (-not (Test-Path -LiteralPath $pfxPath) -or -not $pfxPassword)) {
    throw "The protected PFX path or password is unavailable."
}

foreach ($inputPath in $ArtifactPath) {
    $resolved = (Resolve-Path -LiteralPath $inputPath).ProviderPath
    $arguments = @("sign", "/fd", "SHA256", "/td", "SHA256", "/tr", $TimestampUrl)
    if ($thumbprint) {
        $arguments += @("/sha1", $thumbprint)
    } else {
        # The PFX fallback passes the secret only to signtool and never prints the argument list.
        $arguments += @("/f", (Resolve-Path -LiteralPath $pfxPath).ProviderPath, "/p", $pfxPassword)
    }
    $arguments += $resolved
    & $signtool @arguments | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "signtool failed for $resolved with exit code $LASTEXITCODE." }
}
& (Join-Path $PSScriptRoot "verify-release-signatures.ps1") -ArtifactPath $ArtifactPath -RequireSigned
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
