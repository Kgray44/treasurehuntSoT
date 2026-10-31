[CmdletBinding()]
param(
  [string]$RuntimeFile = 'tmp/parallax-a1/owner-studio-preview/runtime.json',
  [switch]$EnableOwnerPhotoDevelopment,
  [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'This local preview launcher requires Windows.' }
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Set-Location -LiteralPath $taskRoot
$taskRuntimePath = [IO.Path]::GetFullPath((Join-Path $taskRoot $RuntimeFile))
if (-not $taskRuntimePath.StartsWith((Join-Path $taskRoot 'tmp/'), [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Use an owned preview runtime record under tmp.'
}
$taskRuntime = Get-Content -LiteralPath $taskRuntimePath -Raw | ConvertFrom-Json
if ($taskRuntime.worktree -ne $taskRoot -or $taskRuntime.port -ne 3130 -or -not $taskRuntime.database.StartsWith('file:')) {
  throw 'Preview worktree, port or database binding is invalid.'
}
$taskDatabase = [IO.Path]::GetFullPath($taskRuntime.database.Substring(5))
$taskDatabasePrefix = Join-Path $taskRoot 'artifacts/sounding-line/generic-owner-studio-'
if (-not $taskDatabase.StartsWith($taskDatabasePrefix, [StringComparison]::OrdinalIgnoreCase) -or
    [IO.Path]::GetExtension($taskDatabase) -ne '.db' -or -not (Test-Path -LiteralPath $taskDatabase -PathType Leaf)) {
  throw 'The existing owned preview database was not found. This launcher never creates or resets it.'
}
if (-not $CheckOnly -and (Get-NetTCPConnection -LocalPort 3130 -State Listen -ErrorAction SilentlyContinue)) {
  throw 'Port 3130 is occupied. Stop only the verified owned preview before resuming it.'
}
$env:DATABASE_URL = $taskRuntime.database
$env:FOREVER_VALIDATION_ISOLATION = '1'
$env:SOUNDING_LINE_SUITE_PROFILE = 'generic'
$env:SEALED_HOLD_SINGLE_FORK = '1'
$env:COMMUNITY_WORKER_ENABLED = 'false'
$env:HOMEPORT_PUBLIC_APP_ORIGIN = 'http://127.0.0.1:3130'
$env:NEXT_DIST_DIR = '.next-parallax-studio-owner-resumed'
$env:NODE_PATH = Join-Path $taskRoot 'node_modules'
$env:NEXT_TELEMETRY_DISABLED = '1'
$env:OPENAI_API_KEY = [Environment]::GetEnvironmentVariable('OPENAI_API_KEY', 'User')
Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue
Remove-Item Env:PARALLAX_A1_SYNTHETIC_PROVIDER -ErrorAction SilentlyContinue
if ($EnableOwnerPhotoDevelopment) {
  # Persist local media configuration outside every checkout; protect key material with Windows CurrentUser DPAPI.
  $taskHash = [Security.Cryptography.SHA256]::Create()
  try { $taskScope = ([BitConverter]::ToString($taskHash.ComputeHash([Text.Encoding]::UTF8.GetBytes($taskDatabase.ToLowerInvariant())))).Replace('-', '').Substring(0, 16).ToLowerInvariant() }
  finally { $taskHash.Dispose() }
  $taskPrivate = Join-Path $env:LOCALAPPDATA ('Voyagewright/Parallax/LocalPhotoDevelopment/' + $taskScope)
  New-Item -ItemType Directory -Force -Path $taskPrivate | Out-Null
  # Construct only the discretionary ACL; copying an existing descriptor can require SeSecurityPrivilege.
  $taskAcl = New-Object Security.AccessControl.DirectorySecurity
  $taskAcl.SetAccessRuleProtection($true, $false)
  $taskSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $taskRule = New-Object Security.AccessControl.FileSystemAccessRule($taskSid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
  $taskAcl.SetAccessRule($taskRule)
  (New-Object IO.DirectoryInfo($taskPrivate)).SetAccessControl($taskAcl)
  $taskKeyFile = Join-Path $taskPrivate 'master-key.dpapi'
  if (-not (Test-Path -LiteralPath $taskKeyFile)) {
    $taskBytes = New-Object byte[] 32
    $taskRandom = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $taskRandom.GetBytes($taskBytes) } finally { $taskRandom.Dispose() }
    $taskKey = ([BitConverter]::ToString($taskBytes)).Replace('-', '').ToLowerInvariant()
    ConvertFrom-SecureString (ConvertTo-SecureString $taskKey -AsPlainText -Force) | Set-Content -LiteralPath $taskKeyFile
    [Array]::Clear($taskBytes, 0, $taskBytes.Length)
    $taskKey = $null
  }
  $taskSecureKey = ConvertTo-SecureString (Get-Content -LiteralPath $taskKeyFile -Raw).Trim()
  $taskPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecureKey)
  try { $env:PRIVATE_CONTENT_LOCAL_MASTER_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPointer); $taskSecureKey.Dispose() }
  $env:PRIVATE_CONTENT_PROVIDER_ROOT = Join-Path $taskPrivate 'storage'
  New-Item -ItemType Directory -Force -Path $env:PRIVATE_CONTENT_PROVIDER_ROOT | Out-Null
  $env:PRIVATE_CONTENT_ENABLED = 'true'
  $env:PRIVATE_CONTENT_STORAGE_PROVIDER = 'local'
  $env:PRIVATE_CONTENT_KEY_PROVIDER = 'local'
  $env:PRIVATE_CONTENT_SCANNER_PROVIDER = 'synthetic'
  $env:PARALLAX_ROOM_PHOTO_RUNTIME = 'OWNER_AUTHORIZED_LIVE_DEVELOPMENT'
} else {
  $env:PARALLAX_ROOM_PHOTO_RUNTIME = 'SYNTHETIC_DEVELOPMENT'
}
$taskDiagnostic = @{ existingDatabasePreserved = $true; port = 3130; openAIConfigured = -not [string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY); localPhotoDevelopment = [bool]$EnableOwnerPhotoDevelopment; productionScannerCertified = $false; automaticPaidCalls = 0 }
$taskDiagnostic | ConvertTo-Json -Compress | Write-Output
if ($CheckOnly) { exit 0 }
try { & node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3130 }
finally { Remove-Item Env:PRIVATE_CONTENT_LOCAL_MASTER_KEY, Env:OPENAI_API_KEY -ErrorAction SilentlyContinue }
