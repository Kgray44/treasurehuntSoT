param(
  [string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'Voyagewright\Workspaces'),
  [switch]$InstallHooks
)
$ErrorActionPreference = 'Stop'
function Write-HooksConfig([string]$Path, $Configuration) {
  # Windows PowerShell's Set-Content -Encoding UTF8 adds a BOM that Codex rejects.
  $text = ($Configuration | ConvertTo-Json -Depth 30) + [Environment]::NewLine
  [System.IO.File]::WriteAllText($Path, $text, (New-Object System.Text.UTF8Encoding -ArgumentList $false))
}
$StateRoot = [System.IO.Path]::GetFullPath($StateRoot)
$sourceRoot = $PSScriptRoot
$guard = Join-Path $env:LOCALAPPDATA 'AeroStorageWatch\ReserveGuard.ps1'
& powershell.exe -NoProfile -File $guard -EstimatedCBytes 8388608 -EstimatedDBytes 0
if ($LASTEXITCODE -ne 0) { throw 'Storage reserve denied installation' }
$state = Get-Content -LiteralPath (Join-Path $StateRoot 'registry.json') -Raw | ConvertFrom-Json
if ($state.version -ne 1) { throw 'Initialize the lifecycle registry first' }
Add-Type -Namespace Voyagewright -Name NativePaths -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("kernel32.dll", CharSet=System.Runtime.InteropServices.CharSet.Unicode, SetLastError=true)]
public static extern uint GetFinalPathNameByHandleW(System.IntPtr handle, System.Text.StringBuilder path, uint length, uint flags);
'@
function Get-PhysicalFilePath([string]$file) {
  $reader = [System.IO.File]::Open($file, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
  try {
    $buffer = New-Object System.Text.StringBuilder 32768
    $length = [Voyagewright.NativePaths]::GetFinalPathNameByHandleW($reader.SafeFileHandle.DangerousGetHandle(), $buffer, $buffer.Capacity, 0)
    if ($length -eq 0 -or $length -ge $buffer.Capacity) { throw 'Cannot resolve physical host file path' }
    $value = $buffer.ToString()
    if ($value.StartsWith('\\?\')) { $value = $value.Substring(4) }
    return $value
  } finally { $reader.Dispose() }
}
$physicalStateRoot = Split-Path -Parent (Get-PhysicalFilePath (Join-Path $StateRoot 'registry.json'))
$physicalGuard = Get-PhysicalFilePath $guard
& node.exe (Join-Path $sourceRoot 'cli.mjs') host-bind --state $StateRoot --physical-root $physicalStateRoot
if ($LASTEXITCODE -ne 0) { throw 'Cannot bind scheduled worker to the same physical registry' }
$installRoot = [System.IO.Path]::GetFullPath((Join-Path $StateRoot ('installed\' + [guid]::NewGuid().ToString('N'))))
$physicalInstallRoot = Join-Path $physicalStateRoot ('installed\' + (Split-Path -Leaf $installRoot))
New-Item -ItemType Directory -Path $installRoot | Out-Null
$files = @('lifecycle.mjs', 'cli.mjs', 'hook.mjs', 'worker.mjs')
$manifest = @()
foreach ($name in $files) {
  $source = Join-Path $sourceRoot $name
  $target = Join-Path $installRoot $name
  Copy-Item -LiteralPath $source -Destination $target -ErrorAction Stop
  $manifest += [pscustomobject]@{ name = $name; sha256 = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() }
}
$hostTools = @('git.exe', 'gh.exe', 'powershell.exe') | ForEach-Object { Split-Path -Parent ([System.IO.Path]::GetFullPath((Get-Command $_).Source)) }
@{ paths = @($hostTools); reserveGuard = $physicalGuard } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $installRoot 'host-path.json') -Encoding UTF8
$manifest += [pscustomobject]@{ name = 'host-path.json'; sha256 = (Get-FileHash -LiteralPath (Join-Path $installRoot 'host-path.json') -Algorithm SHA256).Hash.ToLowerInvariant() }
$manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $installRoot 'manifest.json') -Encoding UTF8
$nodePath = [System.IO.Path]::GetFullPath((Get-Command node.exe).Source)
$launcher = @'
param([string]$StateRoot)
$ErrorActionPreference = 'Stop'
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw | ConvertFrom-Json
foreach ($entry in $manifest) {
  if ((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $entry.name) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) { throw 'Installed lifecycle source changed; reconcile through the installer' }
}
& '__NODE__' (Join-Path $PSScriptRoot 'cli.mjs') sweep --state $StateRoot --limit 4
exit $LASTEXITCODE
'@
$launcher.Replace('__NODE__', $nodePath.Replace("'", "''")) | Set-Content -LiteralPath (Join-Path $installRoot 'reconcile.ps1') -Encoding UTF8
$taskName = 'Voyagewright-Workspace-Reconciler'
$result = [ordered]@{ installedAt = [datetime]::UtcNow.ToString('o'); installRoot = $installRoot; physicalInstallRoot = $physicalInstallRoot; physicalStateRoot = $physicalStateRoot; taskName = $taskName; scheduler = 'NOT_INSTALLED'; hooks = 'NOT_REQUESTED'; sourceManifest = $manifest }
try {
  $quote = [char]34
  $arguments = $quote + (Join-Path $physicalInstallRoot 'worker.mjs') + $quote + ' ' + $quote + $physicalStateRoot + $quote
  $action = New-ScheduledTaskAction -Execute $nodePath -Argument $arguments
  $periodic = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 15)
  $login = New-ScheduledTaskTrigger -AtLogOn -User ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)
  $principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  # Reinstallation updates only this exact owned task; the receipt preserves the old definition.
  $existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  if ($existing) {
    if ($existing.Description -ne 'Voyagewright marker-owned workspace lifecycle v1') { throw 'Scheduled task name is owned by another definition' }
    Export-ScheduledTask -TaskName $taskName | Set-Content -LiteralPath (Join-Path $installRoot 'previous-task.xml') -Encoding UTF8
  }
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($periodic, $login) -Settings $settings -Principal $principal -Description 'Voyagewright marker-owned workspace lifecycle v1' -Force | Out-Null
  $result.scheduler = 'INSTALLED'
  Start-ScheduledTask -TaskName $taskName
  $result.test = 'START_REQUESTED_VERIFY_LAST_RESULT'
} catch { $result.scheduler = 'BLOCKED'; $result.schedulerError = $_.Exception.Message }
if ($InstallHooks) {
  $hooksPath = Join-Path $env:USERPROFILE '.codex\hooks.json'
  $hooks = if (Test-Path -LiteralPath $hooksPath) { Get-Content -LiteralPath $hooksPath -Raw | ConvertFrom-Json } else { [pscustomobject]@{ hooks = [pscustomobject]@{} } }
  if (Test-Path -LiteralPath $hooksPath) { Copy-Item -LiteralPath $hooksPath -Destination (Join-Path $installRoot 'previous-hooks.json') }
  if (-not $hooks.hooks) { throw 'Existing hooks file has no valid hooks object' }
  $quote = [char]34
  $command = $quote + $nodePath + $quote + ' ' + $quote + (Join-Path $physicalInstallRoot 'hook.mjs') + $quote
  foreach ($eventName in @('SessionStart', 'UserPromptSubmit', 'Stop', 'Interrupt', 'SessionEnd')) {
    $existingEntries = @($hooks.hooks.$eventName | Where-Object { $_ })
    # Replace this manager's prior version only, preserving every other hook.
    $existingEntries = @($existingEntries | Where-Object { -not ($_.hooks | Where-Object { $_.statusMessage -eq 'Reconciling Voyagewright workspaces' }) })
    $entry = [pscustomobject]@{ hooks = @([pscustomobject]@{ type = 'command'; command = $command; timeout = 3; statusMessage = 'Reconciling Voyagewright workspaces' }) }
    $hooks.hooks | Add-Member -MemberType NoteProperty -Name $eventName -Value @($existingEntries + $entry) -Force
  }
  Write-HooksConfig -Path $hooksPath -Configuration $hooks
  $result.hooks = 'INSTALLED_REQUIRES_CODEX_TRUST_REVIEW'
  $result.hooksPath = $hooksPath
}
$result | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $installRoot 'installation.json') -Encoding UTF8
$result | ConvertTo-Json -Depth 10
if ($result.scheduler -eq 'BLOCKED') { exit 2 }
