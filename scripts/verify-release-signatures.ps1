param(
    [Parameter(Mandatory = $true)]
    [string[]]$ArtifactPath,
    [switch]$RequireSigned,
    [string]$OutputPath
)

$ErrorActionPreference = "Stop"
$results = @()
foreach ($inputPath in $ArtifactPath) {
    $resolved = (Resolve-Path -LiteralPath $inputPath).ProviderPath
    $signature = Get-AuthenticodeSignature -LiteralPath $resolved
    $results += [ordered]@{
        path = $resolved
        status = [string]$signature.Status
        statusMessage = [string]$signature.StatusMessage
        signerSubject = if ($signature.SignerCertificate) { $signature.SignerCertificate.Subject } else { $null }
        signerThumbprint = if ($signature.SignerCertificate) { $signature.SignerCertificate.Thumbprint } else { $null }
        timestampSubject = if ($signature.TimeStamperCertificate) { $signature.TimeStamperCertificate.Subject } else { $null }
        timestamped = [bool]$signature.TimeStamperCertificate
    }
}
$report = [ordered]@{
    schemaVersion = 1
    generatedAt = [DateTimeOffset]::UtcNow.ToString("o")
    artifacts = $results
}
$json = $report | ConvertTo-Json -Depth 6
if ($OutputPath) {
    $parent = Split-Path -Parent $OutputPath
    if ($parent) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    [System.IO.File]::WriteAllText([System.IO.Path]::GetFullPath($OutputPath), "$json`r`n", [System.Text.UTF8Encoding]::new($false))
}
$json
if ($RequireSigned -and ($results | Where-Object { $_.status -ne "Valid" -or -not $_.timestamped })) {
    Write-Error "One or more release artifacts lack a valid timestamped Authenticode signature."
    exit 1
}
