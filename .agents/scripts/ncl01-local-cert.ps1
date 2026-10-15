#requires -Version 7.2
# NCL-01 owned laptop preview only. Creates files; never installs trust or starts listeners.
[CmdletBinding()]
param([string]$LanIp = '155.42.98.160')
$ErrorActionPreference = 'Stop'
$OpenSsl = 'C:\Users\kkids\AppData\Local\Programs\Git\usr\bin\openssl.exe'
$TlsDirectory = 'D:\CodexTemp\ncl01-preview\tls'
$OwnerPath = Join-Path $TlsDirectory 'owner.json'
$ConfigPath = Join-Path $TlsDirectory 'server.config.json'
$Purpose = 'NCL01_LAPTOP_PREVIEW_TLS_V1'

$parsedIp = $null
if (-not [Net.IPAddress]::TryParse($LanIp, [ref]$parsedIp) -or
    $parsedIp.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork -or
    [Net.IPAddress]::IsLoopback($parsedIp) -or $LanIp -ne $parsedIp.ToString()) {
  throw 'Use the current canonical laptop LAN IPv4 address.'
}
if (-not (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
  $_.IPAddress -eq $LanIp -and $_.AddressState -eq 'Preferred'
})) { throw 'The requested LAN IPv4 address is not currently assigned to this laptop.' }
if (-not (Test-Path -LiteralPath $OpenSsl -PathType Leaf)) { throw 'The configured Git OpenSSL executable is unavailable.' }

function Invoke-OwnedOpenSsl([string[]]$OpenSslArguments) {
  & $OpenSsl @OpenSslArguments 2>> (Join-Path $TlsDirectory 'openssl-operations.log') | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'An owned certificate operation failed. Inspect the private OpenSSL operations log.' }
}
function Assert-OwnedCertificates {
  Invoke-OwnedOpenSsl -OpenSslArguments @('x509', '-in', (Join-Path $TlsDirectory 'ca.pem'), '-checkend', '300', '-noout')
  Invoke-OwnedOpenSsl -OpenSslArguments @('x509', '-in', (Join-Path $TlsDirectory 'server.pem'), '-checkend', '300', '-noout')
  Invoke-OwnedOpenSsl -OpenSslArguments @('verify', '-CAfile', (Join-Path $TlsDirectory 'ca.pem'), '-purpose', 'sslserver', (Join-Path $TlsDirectory 'server.pem'))
  foreach ($ip in @($LanIp, '127.0.0.1')) {
    Invoke-OwnedOpenSsl -OpenSslArguments @('x509', '-in', (Join-Path $TlsDirectory 'server.pem'), '-checkip', $ip, '-noout')
  }
  Invoke-OwnedOpenSsl -OpenSslArguments @('x509', '-in', (Join-Path $TlsDirectory 'server.pem'), '-checkhost', 'localhost', '-noout')
  Invoke-OwnedOpenSsl -OpenSslArguments @('x509', '-in', (Join-Path $TlsDirectory 'ca.pem'), '-outform', 'DER', '-out', (Join-Path $TlsDirectory 'ca.verified.cer'))
  if ((Get-FileHash -LiteralPath (Join-Path $TlsDirectory 'ca.verified.cer')).Hash -ne
      (Get-FileHash -LiteralPath (Join-Path $TlsDirectory 'public-ca.cer')).Hash) {
    throw 'The exported public CA does not match the owned signing certificate.'
  }
  foreach ($kind in @('ca', 'server')) {
    $certificatePublic = Join-Path $TlsDirectory "$kind.certificate-public.pem"
    $keyPublic = Join-Path $TlsDirectory "$kind.key-public.pem"
    Invoke-OwnedOpenSsl -OpenSslArguments @('x509', '-in', (Join-Path $TlsDirectory "$kind.pem"), '-pubkey', '-noout', '-out', $certificatePublic)
    Invoke-OwnedOpenSsl -OpenSslArguments @('pkey', '-in', (Join-Path $TlsDirectory "$kind.key.pem"), '-pubout', '-out', $keyPublic)
    if ((Get-FileHash -LiteralPath $certificatePublic).Hash -ne (Get-FileHash -LiteralPath $keyPublic).Hash) {
      throw 'An owned certificate does not match its private key.'
    }
  }
}

if (Test-Path -LiteralPath $TlsDirectory) {
  $directoryItem = Get-Item -LiteralPath $TlsDirectory
  if (-not $directoryItem.PSIsContainer -or ($directoryItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw 'The owned TLS target must be an ordinary directory.'
  }
  if (-not (Test-Path -LiteralPath $OwnerPath -PathType Leaf) -or -not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) {
    throw 'Existing TLS files lack complete NCL-01 ownership metadata; nothing was overwritten.'
  }
  $owner = Get-Content -Raw -LiteralPath $OwnerPath | ConvertFrom-Json
  $configuration = Get-Content -Raw -LiteralPath $ConfigPath | ConvertFrom-Json
  if ($owner.purpose -ne $Purpose -or $owner.lanIp -ne $LanIp -or
      $configuration.owner -ne $Purpose -or $configuration.configId -ne $owner.configId -or
      $configuration.bindHost -ne $LanIp -or $configuration.httpsPort -ne 8449 -or
      $configuration.bootstrapPort -ne 8448 -or $configuration.upstreamOrigin -ne 'http://127.0.0.1:3149') {
    throw 'Existing TLS configuration does not match this owned laptop preview; nothing was overwritten.'
  }
  Assert-OwnedCertificates
  if ((Get-FileHash -LiteralPath (Join-Path $TlsDirectory 'public-ca.cer')).Hash.ToLowerInvariant() -ne $configuration.caSha256) {
    throw 'The exported public CA no longer matches the owned configuration.'
  }
  Write-Output "Reused owned seven-day preview certificates. Config: $ConfigPath"
  exit 0
}

New-Item -ItemType Directory -Path $TlsDirectory | Out-Null
# Restrict only this newly created task directory. No global certificate store or trust changes.
$directoryAcl = [Security.AccessControl.DirectorySecurity]::new()
$directoryAcl.SetAccessRuleProtection($true, $false)
$currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$directoryAcl.SetOwner($currentSid)
foreach ($sid in @($currentSid, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
  $rule = [Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
  $directoryAcl.AddAccessRule($rule)
}
Set-Acl -LiteralPath $TlsDirectory -AclObject $directoryAcl
$configId = [Guid]::NewGuid().ToString()
@{ purpose = $Purpose; configId = $configId; lanIp = $LanIp; createdAt = [DateTimeOffset]::UtcNow.ToString('o') } |
  ConvertTo-Json | Set-Content -LiteralPath $OwnerPath -Encoding utf8NoBOM

Invoke-OwnedOpenSsl -OpenSslArguments @('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '7',
  '-keyout', (Join-Path $TlsDirectory 'ca.key.pem'), '-out', (Join-Path $TlsDirectory 'ca.pem'),
  '-subj', "/CN=NCL-01 Laptop Preview CA $($configId.Substring(0,8))",
  '-addext', 'basicConstraints=critical,CA:TRUE,pathlen:0', '-addext', 'keyUsage=critical,keyCertSign,cRLSign',
  '-addext', 'subjectKeyIdentifier=hash')
Invoke-OwnedOpenSsl -OpenSslArguments @('req', '-new', '-newkey', 'rsa:2048', '-nodes', '-sha256',
  '-keyout', (Join-Path $TlsDirectory 'server.key.pem'), '-out', (Join-Path $TlsDirectory 'server.csr.pem'), '-subj', "/CN=$LanIp")
@"
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=IP:$LanIp,DNS:localhost,IP:127.0.0.1
authorityKeyIdentifier=keyid,issuer
subjectKeyIdentifier=hash
"@ | Set-Content -LiteralPath (Join-Path $TlsDirectory 'server.extensions.cnf') -Encoding ascii
$serial = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(16))
Invoke-OwnedOpenSsl -OpenSslArguments @('x509', '-req', '-in', (Join-Path $TlsDirectory 'server.csr.pem'),
  '-CA', (Join-Path $TlsDirectory 'ca.pem'), '-CAkey', (Join-Path $TlsDirectory 'ca.key.pem'),
  '-set_serial', "0x$serial", '-days', '7', '-sha256', '-extfile', (Join-Path $TlsDirectory 'server.extensions.cnf'),
  '-out', (Join-Path $TlsDirectory 'server.pem'))
Invoke-OwnedOpenSsl -OpenSslArguments @('x509', '-in', (Join-Path $TlsDirectory 'ca.pem'), '-outform', 'DER', '-out', (Join-Path $TlsDirectory 'public-ca.cer'))
Assert-OwnedCertificates

$publicCaBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $TlsDirectory 'public-ca.cer')))
$payloadUuid = [Guid]::NewGuid().ToString()
@"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>PayloadType</key><string>Configuration</string><key>PayloadVersion</key><integer>1</integer>
<key>PayloadIdentifier</key><string>com.voyagewright.ncl01.preview.$configId</string>
<key>PayloadUUID</key><string>$configId</string><key>PayloadDisplayName</key><string>NCL-01 Laptop Preview CA</string>
<key>PayloadDescription</key><string>Seven-day test CA for this laptop preview. Manual installation and explicit certificate trust are separate owner actions. Remove the profile after testing.</string>
<key>PayloadRemovalDisallowed</key><false/><key>PayloadContent</key><array><dict>
<key>PayloadType</key><string>com.apple.security.root</string><key>PayloadVersion</key><integer>1</integer>
<key>PayloadIdentifier</key><string>com.voyagewright.ncl01.preview.$configId.ca</string>
<key>PayloadUUID</key><string>$payloadUuid</string><key>PayloadDisplayName</key><string>NCL-01 Laptop Preview CA</string>
<key>PayloadCertificateFileName</key><string>public-ca.cer</string><key>PayloadContent</key><data>$publicCaBase64</data>
</dict></array></dict></plist>
"@ | Set-Content -LiteralPath (Join-Path $TlsDirectory 'public-ca.mobileconfig') -Encoding utf8NoBOM

$configuration = @{
  owner = $Purpose; configId = $configId; bindHost = $LanIp; httpsPort = 8449; bootstrapPort = 8448
  upstreamOrigin = 'http://127.0.0.1:3149'; publicOrigin = "https://${LanIp}:8449"
  caSha256 = (Get-FileHash -LiteralPath (Join-Path $TlsDirectory 'public-ca.cer')).Hash.ToLowerInvariant()
  createdAt = [DateTimeOffset]::UtcNow.ToString('o')
}
$configuration | ConvertTo-Json | Set-Content -LiteralPath $ConfigPath -Encoding utf8NoBOM
Write-Output "Created owned seven-day preview certificates. Config: $ConfigPath"
Write-Output 'No certificate was installed or trusted. No network listener was started.'
