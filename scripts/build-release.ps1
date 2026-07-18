param(
    [ValidateSet("development", "creator-preview", "stable")]
    [string]$Channel = "development",
    [switch]$SkipValidation,
    [string]$RollbackTarget = "0.7.0-b5"
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).ProviderPath
$package = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "package.json") | ConvertFrom-Json
$releaseRoot = Join-Path $projectRoot "dist\release\$($package.version)"
New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null

if (-not $SkipValidation) {
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "test-all.ps1") -SkipBrowserInstall
    if ($LASTEXITCODE -ne 0) { throw "Validation failed with exit code $LASTEXITCODE." }
}

$hasPfx = $env:WINDOWS_SIGNING_PFX_PATH -and $env:WINDOWS_SIGNING_PFX_PASSWORD
if ($hasPfx) {
    if (-not (Test-Path -LiteralPath $env:WINDOWS_SIGNING_PFX_PATH)) { throw "The configured signing PFX does not exist." }
    $env:CSC_LINK = (Resolve-Path -LiteralPath $env:WINDOWS_SIGNING_PFX_PATH).ProviderPath
    $env:CSC_KEY_PASSWORD = $env:WINDOWS_SIGNING_PFX_PASSWORD
} elseif ($Channel -ne "development") {
    throw "$Channel requires WINDOWS_SIGNING_PFX_PATH and WINDOWS_SIGNING_PFX_PASSWORD."
} else {
    $env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
}

Push-Location $projectRoot
try {
    & npm.cmd run desktop:build
    if ($LASTEXITCODE -ne 0) { throw "Desktop release build failed with exit code $LASTEXITCODE." }
    $installer = Get-ChildItem -LiteralPath (Join-Path $projectRoot "dist") -File |
        Where-Object { $_.Name -like "*$($package.version)*.exe" } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    $application = Get-Item -LiteralPath (Join-Path $projectRoot "dist\win-unpacked\The Forever Treasure Companion.exe")
    if (-not $installer) { throw "The NSIS installer was not produced." }
    $signatureReport = Join-Path $releaseRoot "authenticode.json"
    & (Join-Path $PSScriptRoot "verify-release-signatures.ps1") -ArtifactPath @($installer.FullName, $application.FullName) -OutputPath $signatureReport -RequireSigned:($Channel -ne "development")
    if ($LASTEXITCODE -ne 0) { throw "Release signature verification failed." }
    $provenance = Join-Path $releaseRoot "provenance.json"
    & node (Join-Path $PSScriptRoot "create-release-provenance.cjs") --channel $Channel --artifact $installer.FullName --artifact $application.FullName --signature-report $signatureReport --rollback-target $RollbackTarget --output $provenance
    if ($LASTEXITCODE -ne 0) { throw "Release provenance generation failed." }
    $manifest = Join-Path $releaseRoot "release-manifest.json"
    & node (Join-Path $PSScriptRoot "create-release-manifest.cjs") --channel $Channel --provenance $provenance --rollback-target $RollbackTarget --output $manifest
    if ($LASTEXITCODE -ne 0) { throw "Release manifest generation failed." }
    $checksums = @($installer.FullName, $application.FullName, $provenance, $manifest) | ForEach-Object {
        $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $_
        "$($hash.Hash.ToLowerInvariant())  $([System.IO.Path]::GetFileName($_))"
    }
    [System.IO.File]::WriteAllLines((Join-Path $releaseRoot "SHA256SUMS.txt"), $checksums, [System.Text.UTF8Encoding]::new($false))
    [ordered]@{
        version = $package.version
        channel = $Channel
        installer = $installer.FullName
        application = $application.FullName
        releaseMetadata = $releaseRoot
        signed = [bool]$hasPfx
    } | ConvertTo-Json -Depth 4
} finally {
    Pop-Location
    Remove-Item Env:CSC_LINK -ErrorAction SilentlyContinue
    Remove-Item Env:CSC_KEY_PASSWORD -ErrorAction SilentlyContinue
}
