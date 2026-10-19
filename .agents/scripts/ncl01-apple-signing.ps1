#requires -Version 7.2
# Windows-only, owner-local credential preparation. Never prints signing material.
[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidateSet('PrepareCsr', 'InstallSecrets', 'Status')][string]$Action,
  [string]$CertificatePath,
  [string]$ProfilePath,
  [string]$ApiKeyPath,
  [ValidatePattern('^[A-Z0-9]{10}$')][string]$ApiKeyId,
  [ValidatePattern('^[a-fA-F0-9-]{36}$')][string]$IssuerId,
  [ValidatePattern('^[0-9]+$')][string]$AppId
)
$ErrorActionPreference = 'Stop'
$TeamId = 'X2JZ9N65V2'
$Repository = 'Kgray44/treasurehuntSoT'
$EnvironmentName = 'ncl01-testflight'
$PrivateDirectory = 'D:\CodexTemp\ncl01-apple-signing'
$OwnerFile = Join-Path $PrivateDirectory 'owner.json'
$ProtectedKeyFile = Join-Path $PrivateDirectory 'distribution-rsa.dpapi'
$CsrFile = Join-Path $PrivateDirectory 'VoyageWright-Landfall-Distribution.certSigningRequest'
$Purpose = 'NCL01_APPLE_DISTRIBUTION_V1'
$Entropy = [Text.Encoding]::UTF8.GetBytes($Purpose)
if (-not $IsWindows) { throw 'Run this helper on the owner Windows laptop.' }

function Assert-PrivateDirectory {
  $item = Get-Item -LiteralPath $PrivateDirectory
  if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw 'Signing directory must be an ordinary owned directory.'
  }
  $acl = Get-Acl -LiteralPath $PrivateDirectory
  $current = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  if (-not $acl.AreAccessRulesProtected -or $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $current) {
    throw 'Signing directory ownership or inheritance is unexpected.'
  }
  foreach ($rule in $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
    if ($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -notin @($current, 'S-1-5-18')) {
      throw 'Signing directory grants access beyond this owner and SYSTEM.'
    }
  }
  $owner = Get-Content -Raw -LiteralPath $OwnerFile | ConvertFrom-Json
  if ($owner.purpose -ne $Purpose -or $owner.teamId -ne $TeamId -or $owner.bundleId -ne 'com.voyagewright.landfall') {
    throw 'Signing directory has different ownership metadata.'
  }
}

function Invoke-GhInput([string[]]$Arguments, [string]$InputText) {
  $processInfo = [Diagnostics.ProcessStartInfo]::new('gh')
  $processInfo.UseShellExecute = $false
  $processInfo.RedirectStandardInput = $true
  $processInfo.RedirectStandardOutput = $true
  $processInfo.RedirectStandardError = $true
  foreach ($argument in $Arguments) { $processInfo.ArgumentList.Add($argument) }
  $process = [Diagnostics.Process]::Start($processInfo)
  $outputTask = $process.StandardOutput.ReadToEndAsync()
  $errorTask = $process.StandardError.ReadToEndAsync()
  $process.StandardInput.Write($InputText)
  $process.StandardInput.Close()
  $process.WaitForExit()
  $null = $outputTask.GetAwaiter().GetResult()
  $null = $errorTask.GetAwaiter().GetResult()
  $code = $process.ExitCode
  $process.Dispose()
  if ($code -ne 0) { throw 'GitHub credential configuration failed; no credential output was printed. Check gh authentication and environment permissions.' }
}

function Get-VerifiedRsa {
  $rsa = [Security.Cryptography.RSA]::Create()
  try {
    $bytes = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($ProtectedKeyFile), $Entropy, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    try { $read = 0; $rsa.ImportPkcs8PrivateKey($bytes, [ref]$read) }
    finally { [Security.Cryptography.CryptographicOperations]::ZeroMemory($bytes) }
    $request = [Security.Cryptography.X509Certificates.CertificateRequest]::LoadSigningRequestPem(
      [IO.File]::ReadAllText($CsrFile), [Security.Cryptography.HashAlgorithmName]::SHA256,
      [Security.Cryptography.X509Certificates.CertificateRequestLoadOptions]::Default,
      [Security.Cryptography.RSASignaturePadding]::Pkcs1)
    if (-not [Security.Cryptography.CryptographicOperations]::FixedTimeEquals($rsa.ExportSubjectPublicKeyInfo(), $request.PublicKey.ExportSubjectPublicKeyInfo())) {
      throw 'Retained CSR and protected key do not match.'
    }
    return $rsa
  } catch { $rsa.Dispose(); throw 'Retained signing preparation failed its key and CSR integrity check; nothing was replaced.' }
}

function Get-PlistValue($Dictionary, [string]$Name) {
  $key = $Dictionary.SelectSingleNode("key[.='$Name']")
  if ($key) { return $key.NextSibling }
  return $null
}

function Assert-AppStoreProfile([byte[]]$ProfileBytes, $Certificate) {
  Add-Type -AssemblyName System.Security.Cryptography.Pkcs
  $cms = [Security.Cryptography.Pkcs.SignedCms]::new()
  $cms.Decode($ProfileBytes)
  $cms.CheckSignature($true)
  $settings = [Xml.XmlReaderSettings]::new()
  $settings.DtdProcessing = [Xml.DtdProcessing]::Ignore
  $settings.XmlResolver = $null
  $reader = [Xml.XmlReader]::Create([IO.StringReader]::new([Text.Encoding]::UTF8.GetString($cms.ContentInfo.Content)), $settings)
  $plist = [Xml.XmlDocument]::new()
  $plist.XmlResolver = $null
  try { $plist.Load($reader) } finally { $reader.Dispose() }
  $root = $plist.SelectSingleNode('/plist/dict')
  if (-not $root) { throw 'The profile has no plist dictionary.' }
  $entitlements = Get-PlistValue $root 'Entitlements'
  $team = Get-PlistValue $root 'TeamIdentifier'
  $expiry = Get-PlistValue $root 'ExpirationDate'
  $certificates = Get-PlistValue $root 'DeveloperCertificates'
  $certificateHash = [Security.Cryptography.SHA256]::HashData($Certificate.RawData)
  if (-not $entitlements -or -not $team -or $team.ChildNodes.Count -ne 1 -or $team.FirstChild.InnerText -ne $TeamId -or
      -not $expiry -or [DateTimeOffset]::Parse($expiry.InnerText).UtcDateTime -le [DateTime]::UtcNow -or
      (Get-PlistValue $entitlements 'application-identifier').InnerText -ne "$TeamId.com.voyagewright.landfall" -or
      (Get-PlistValue $entitlements 'com.apple.developer.team-identifier').InnerText -ne $TeamId -or
      (Get-PlistValue $entitlements 'get-task-allow').Name -ne 'false' -or
      (Get-PlistValue $entitlements 'beta-reports-active').Name -ne 'true' -or
      (Get-PlistValue $root 'ProvisionedDevices') -or (Get-PlistValue $root 'ProvisionsAllDevices') -or
      -not $certificates -or $certificates.ChildNodes.Count -ne 1 -or
      -not [Security.Cryptography.CryptographicOperations]::FixedTimeEquals($certificateHash, [Security.Cryptography.SHA256]::HashData([Convert]::FromBase64String($certificates.FirstChild.InnerText)))) {
    throw 'The profile is not a current matching App Store Connect distribution profile for this team, app and certificate.'
  }
  $nfc = Get-PlistValue $entitlements 'com.apple.developer.nfc.readersession.formats'
  if (-not $nfc -or 'NDEF' -notin @($nfc.ChildNodes | ForEach-Object InnerText)) {
    throw 'Enable NFC Tag Reading on the App ID and regenerate its App Store Connect profile.'
  }
}

if ($Action -eq 'PrepareCsr') {
  if (Test-Path -LiteralPath $PrivateDirectory) {
    Assert-PrivateDirectory
    if (-not (Test-Path -LiteralPath $CsrFile) -or -not (Test-Path -LiteralPath $ProtectedKeyFile)) {
      throw 'Existing signing preparation is incomplete; nothing was overwritten.'
    }
    $verifiedRsa = Get-VerifiedRsa
    $verifiedRsa.Dispose()
    Write-Output "Reuse the existing PUBLIC certificate request: $CsrFile"
    exit 0
  }
  $null = New-Item -ItemType Directory -Path $PrivateDirectory
  $directoryAcl = [Security.AccessControl.DirectorySecurity]::new()
  $directoryAcl.SetAccessRuleProtection($true, $false)
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $directoryAcl.SetOwner($sid)
  foreach ($allowed in @($sid, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
    $directoryAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($allowed, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
  }
  Set-Acl -LiteralPath $PrivateDirectory -AclObject $directoryAcl
  @{ purpose = $Purpose; teamId = $TeamId; bundleId = 'com.voyagewright.landfall'; createdAt = [DateTimeOffset]::UtcNow.ToString('o') } |
    ConvertTo-Json | Set-Content -LiteralPath $OwnerFile -Encoding utf8NoBOM
  $rsa = [Security.Cryptography.RSA]::Create(2048)
  try {
    $request = [Security.Cryptography.X509Certificates.CertificateRequest]::new(
      'CN=VoyageWright Landfall Distribution', $rsa, [Security.Cryptography.HashAlgorithmName]::SHA256,
      [Security.Cryptography.RSASignaturePadding]::Pkcs1)
    $privateBytes = $rsa.ExportPkcs8PrivateKey()
    try {
      $protected = [Security.Cryptography.ProtectedData]::Protect($privateBytes, $Entropy, [Security.Cryptography.DataProtectionScope]::CurrentUser)
      [IO.File]::WriteAllBytes($ProtectedKeyFile, $protected)
    } finally { [Security.Cryptography.CryptographicOperations]::ZeroMemory($privateBytes) }
    [IO.File]::WriteAllText($CsrFile, $request.CreateSigningRequestPem(), [Text.UTF8Encoding]::new($false))
  } finally { $rsa.Dispose() }
  Assert-PrivateDirectory
  Write-Output "Created PUBLIC certificate request: $CsrFile"
  Write-Output 'The private key is protected for this Windows user and has not been sent anywhere.'
  exit 0
}

if ($Action -eq 'Status') {
  if (-not (Test-Path -LiteralPath $PrivateDirectory)) { Write-Output 'Signing preparation: not created'; exit 0 }
  Assert-PrivateDirectory
  $verifiedRsa = Get-VerifiedRsa
  $verifiedRsa.Dispose()
  Write-Output "Team: $TeamId; bundle: com.voyagewright.landfall"
  Write-Output "Public CSR: $CsrFile"
  Write-Output "Protected key exists: $(Test-Path -LiteralPath $ProtectedKeyFile)"
  exit 0
}

Assert-PrivateDirectory
foreach ($path in @($CertificatePath, $ProfilePath, $ApiKeyPath)) {
  if (-not $path -or -not (Test-Path -LiteralPath $path -PathType Leaf)) { throw 'Provide the downloaded .cer, .mobileprovision and .p8 paths.' }
}
if (-not $ApiKeyId -or -not $IssuerId -or -not $AppId) { throw 'Provide non-secret API Key ID, Issuer ID and numeric App Store Connect Apple ID.' }
$certificate = [Security.Cryptography.X509Certificates.X509Certificate2]::new([IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $CertificatePath)))
if ($certificate.Subject -notmatch '(^|,\s*)OU=X2JZ9N65V2(,|$)' -or
    $certificate.GetNameInfo([Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false) -notlike 'Apple Distribution:*' -or
    $certificate.NotAfter.ToUniversalTime() -le [DateTime]::UtcNow -or $certificate.NotBefore.ToUniversalTime() -gt [DateTime]::UtcNow) {
  $certificate.Dispose()
  throw 'The downloaded certificate is not a current Apple Distribution certificate for this team.'
}
$rsa = Get-VerifiedRsa
try {
  # CopyWithPrivateKey rejects a certificate that does not match the retained CSR.
  $signingCertificate = [Security.Cryptography.X509Certificates.RSACertificateExtensions]::CopyWithPrivateKey($certificate, $rsa)
  $password = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
  try { $p12 = $signingCertificate.Export([Security.Cryptography.X509Certificates.X509ContentType]::Pkcs12, $password) }
  finally { $signingCertificate.Dispose() }
  $profileBytes = [IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $ProfilePath))
  Assert-AppStoreProfile -ProfileBytes $profileBytes -Certificate $certificate
  $profileBase64 = [Convert]::ToBase64String($profileBytes)
  $apiKey = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $ApiKeyPath))
  if ($apiKey -notmatch '^-----BEGIN PRIVATE KEY-----' -or $apiKey -notmatch '-----END PRIVATE KEY-----\s*$') {
    throw 'The API key must be the downloaded Apple .p8 private key.'
  }
  $apiIdentity = [Security.Cryptography.ECDsa]::Create()
  try {
    $apiIdentity.ImportFromPem($apiKey)
    if ($apiIdentity.KeySize -ne 256 -or $apiIdentity.ExportParameters($false).Curve.Oid.Value -ne '1.2.840.10045.3.1.7') {
      throw 'The App Store Connect key must use the P-256 curve.'
    }
  } finally { $apiIdentity.Dispose() }
  # The deployment setup prepares this environment and restricts it to owned beta branches.
  # Do not overwrite an existing environment's protections while installing credentials.
  foreach ($entry in @(
    @('NCL01_DISTRIBUTION_P12_BASE64', [Convert]::ToBase64String($p12)),
    @('NCL01_DISTRIBUTION_P12_PASSWORD', $password),
    @('NCL01_APPSTORE_PROFILE_BASE64', $profileBase64),
    @('NCL01_ASC_PRIVATE_KEY_P8', $apiKey)
  )) {
    Invoke-GhInput -Arguments @('secret', 'set', $entry[0], '--repo', $Repository, '--env', $EnvironmentName) -InputText $entry[1]
    Write-Output "Configured environment secret: $($entry[0])"
  }
  foreach ($entry in @(@('NCL01_ASC_KEY_ID', $ApiKeyId), @('NCL01_ASC_ISSUER_ID', $IssuerId), @('NCL01_ASC_APP_ID', $AppId))) {
    Invoke-GhInput -Arguments @('variable', 'set', $entry[0], '--repo', $Repository, '--env', $EnvironmentName) -InputText $entry[1]
  }
  Write-Output 'Signing material configured in the dedicated GitHub environment; runner verification will check the profile before signing.'
} finally {
  if ($p12) { [Security.Cryptography.CryptographicOperations]::ZeroMemory($p12) }
  $password = $null; $profileBase64 = $null; $apiKey = $null
  $rsa.Dispose(); $certificate.Dispose()
}
