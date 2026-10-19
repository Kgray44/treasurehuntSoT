#requires -Version 7.2
# Synthetic credential-validation checks only: no real signing storage or GitHub calls.
$ErrorActionPreference = 'Stop'
$TeamId = 'X2JZ9N65V2'
$helperPath = Join-Path $PSScriptRoot 'ncl01-apple-signing.ps1'
$tokens = $null
$parseErrors = $null
$helperAst = [Management.Automation.Language.Parser]::ParseFile($helperPath, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw 'Signing helper has parser errors.' }
foreach ($name in @('Get-PlistValue', 'Assert-AppStoreProfile')) {
  $functions = @($helperAst.FindAll({
    param($node)
    $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name
  }, $true))
  if ($functions.Count -ne 1) { throw "Expected one trusted validation function: $name" }
  . ([scriptblock]::Create($functions[0].Extent.Text))
}
$apiShapeAst = @($helperAst.FindAll({
  param($node)
  $node -is [Management.Automation.Language.IfStatementAst] -and
    $node.Extent.Text.Contains('The API key must be the downloaded Apple .p8 private key.')
}, $true))
$apiCurveAst = @($helperAst.FindAll({
  param($node)
  $node -is [Management.Automation.Language.TryStatementAst] -and
    $node.Extent.Text.StartsWith('try {') -and
    $node.Extent.Text.Contains('$apiIdentity.ImportFromPem($apiKey)') -and
    -not $node.Extent.Text.Contains('Invoke-GhInput')
}, $true))
if ($apiShapeAst.Count -ne 1 -or $apiCurveAst.Count -ne 1) { throw 'Expected one trusted API-key validation block.' }
$script:apiShapeValidation = [scriptblock]::Create($apiShapeAst[0].Extent.Text)
$script:apiCurveValidation = [scriptblock]::Create($apiCurveAst[0].Extent.Text)
Add-Type -AssemblyName System.Security.Cryptography.Pkcs
$script:passed = 0

function Assert-Accepted([string]$Name, [scriptblock]$Check) {
  & $Check
  $script:passed++
  Write-Output "PASS $Name"
}

function Assert-Rejected([string]$Name, [scriptblock]$Check) {
  $rejected = $false
  try { & $Check } catch { $rejected = $true }
  if (-not $rejected) { throw "Expected credential rejection: $Name" }
  $script:passed++
  Write-Output "PASS $Name"
}

function Assert-SyntheticApiKey([string]$apiKey) {
  & $script:apiShapeValidation
  $apiIdentity = [Security.Cryptography.ECDsa]::Create()
  # The extracted production try/finally performs the parser, curve check and disposal.
  & $script:apiCurveValidation
}

function New-SyntheticCertificate([Security.Cryptography.RSA]$Key, [string]$CommonName) {
  $request = [Security.Cryptography.X509Certificates.CertificateRequest]::new(
    "CN=$CommonName, OU=$TeamId", $Key, [Security.Cryptography.HashAlgorithmName]::SHA256,
    [Security.Cryptography.RSASignaturePadding]::Pkcs1)
  return $request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddMinutes(-5), [DateTimeOffset]::UtcNow.AddDays(2))
}

function New-SyntheticProfile([hashtable]$Options = @{}) {
  $profileTeam = if ($Options.ContainsKey('Team')) { $Options.Team } else { $TeamId }
  $bundle = if ($Options.ContainsKey('Bundle')) { $Options.Bundle } else { 'com.voyagewright.landfall' }
  $entitlementTeam = if ($Options.ContainsKey('EntitlementTeam')) { $Options.EntitlementTeam } else { $TeamId }
  $expiry = if ($Options.ContainsKey('Expiry')) { $Options.Expiry } else { [DateTimeOffset]::UtcNow.AddDays(1) }
  $profileCertificate = if ($Options.ContainsKey('Certificate')) { $Options.Certificate } else { $certificate }
  $debug = if ($Options.Debug) { '<true/>' } else { '<false/>' }
  $beta = if ($Options.NoBeta) { '' } else { '<key>beta-reports-active</key><true/>' }
  $nfc = if ($Options.NoNfc) { '' } else { '<key>com.apple.developer.nfc.readersession.formats</key><array><string>NDEF</string></array>' }
  $devices = if ($Options.Devices) { '<key>ProvisionedDevices</key><array><string>SYNTHETIC-DEVICE</string></array>' } else { '' }
  $allDevices = if ($Options.AllDevices) { '<key>ProvisionsAllDevices</key><true/>' } else { '' }
  $plistText = @"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>TeamIdentifier</key><array><string>$profileTeam</string></array>
<key>ExpirationDate</key><date>$($expiry.UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ssZ"))</date>
<key>DeveloperCertificates</key><array><data>$([Convert]::ToBase64String($profileCertificate.RawData))</data></array>
$devices $allDevices
<key>Entitlements</key><dict>
<key>application-identifier</key><string>$TeamId.$bundle</string>
<key>com.apple.developer.team-identifier</key><string>$entitlementTeam</string>
<key>get-task-allow</key>$debug
$beta $nfc
</dict></dict></plist>
"@
  $content = [Security.Cryptography.Pkcs.ContentInfo]::new([Text.Encoding]::UTF8.GetBytes($plistText))
  $cms = [Security.Cryptography.Pkcs.SignedCms]::new($content, $false)
  $signer = [Security.Cryptography.Pkcs.CmsSigner]::new($certificate)
  $cms.ComputeSignature($signer)
  return ,$cms.Encode()
}

$rsa = [Security.Cryptography.RSA]::Create(2048)
$otherRsa = [Security.Cryptography.RSA]::Create(2048)
$apiP256 = [Security.Cryptography.ECDsa]::Create([Security.Cryptography.ECCurve+NamedCurves]::nistP256)
$apiP384 = [Security.Cryptography.ECDsa]::Create([Security.Cryptography.ECCurve+NamedCurves]::nistP384)
$certificate = $null
$otherCertificate = $null
try {
  $certificate = New-SyntheticCertificate $rsa 'Synthetic Apple Distribution Fixture'
  $otherCertificate = New-SyntheticCertificate $otherRsa 'Different Synthetic Distribution Fixture'
  Assert-Accepted 'matching signed profile' { Assert-AppStoreProfile (New-SyntheticProfile) $certificate }
  Assert-Rejected 'wrong team' { Assert-AppStoreProfile (New-SyntheticProfile @{ Team = 'WRONGTEAM0' }) $certificate }
  Assert-Rejected 'wrong bundle' { Assert-AppStoreProfile (New-SyntheticProfile @{ Bundle = 'com.example.other' }) $certificate }
  Assert-Rejected 'wrong entitlement team' { Assert-AppStoreProfile (New-SyntheticProfile @{ EntitlementTeam = 'WRONGTEAM0' }) $certificate }
  Assert-Rejected 'development entitlement' { Assert-AppStoreProfile (New-SyntheticProfile @{ Debug = $true }) $certificate }
  Assert-Rejected 'certificate mismatch' { Assert-AppStoreProfile (New-SyntheticProfile @{ Certificate = $otherCertificate }) $certificate }
  Assert-Rejected 'missing NFC entitlement' { Assert-AppStoreProfile (New-SyntheticProfile @{ NoNfc = $true }) $certificate }
  Assert-Rejected 'expired profile' { Assert-AppStoreProfile (New-SyntheticProfile @{ Expiry = [DateTimeOffset]::UtcNow.AddMinutes(-1) }) $certificate }
  Assert-Rejected 'device-bound profile' { Assert-AppStoreProfile (New-SyntheticProfile @{ Devices = $true }) $certificate }
  Assert-Rejected 'enterprise profile' { Assert-AppStoreProfile (New-SyntheticProfile @{ AllDevices = $true }) $certificate }
  Assert-Rejected 'missing beta entitlement' { Assert-AppStoreProfile (New-SyntheticProfile @{ NoBeta = $true }) $certificate }
  Assert-Rejected 'invalid CMS bytes' { Assert-AppStoreProfile ([byte[]](1, 2, 3)) $certificate }
  $tampered = New-SyntheticProfile
  $needle = [Text.Encoding]::UTF8.GetBytes('com.voyagewright.landfall')
  $offset = -1
  for ($i = 0; $i -le $tampered.Length - $needle.Length; $i++) {
    $match = $true
    for ($j = 0; $j -lt $needle.Length; $j++) { if ($tampered[$i + $j] -ne $needle[$j]) { $match = $false; break } }
    if ($match) { $offset = $i; break }
  }
  if ($offset -lt 0) { throw 'Synthetic CMS fixture did not contain its content.' }
  $tampered[$offset] = [byte][char]'x'
  Assert-Rejected 'tampered CMS signature' { Assert-AppStoreProfile $tampered $certificate }
  Assert-Accepted 'P-256 private API key' { Assert-SyntheticApiKey $apiP256.ExportPkcs8PrivateKeyPem() }
  Assert-Rejected 'P-384 API key' { Assert-SyntheticApiKey $apiP384.ExportPkcs8PrivateKeyPem() }
  Assert-Rejected 'RSA API key' { Assert-SyntheticApiKey $rsa.ExportPkcs8PrivateKeyPem() }
  Assert-Rejected 'public-only API key' { Assert-SyntheticApiKey $apiP256.ExportSubjectPublicKeyInfoPem() }
  Assert-Rejected 'malformed private API key' { Assert-SyntheticApiKey "-----BEGIN PRIVATE KEY-----`ninvalid`n-----END PRIVATE KEY-----" }
  Write-Output "NCL01_APPLE_SIGNING_VALIDATION_PASS: $script:passed synthetic cases; no owner keys or GitHub writes."
} finally {
  if ($otherCertificate) { $otherCertificate.Dispose() }
  if ($certificate) { $certificate.Dispose() }
  $apiP384.Dispose()
  $apiP256.Dispose()
  $otherRsa.Dispose()
  $rsa.Dispose()
}
