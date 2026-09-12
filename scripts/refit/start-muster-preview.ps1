$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$taskRoot = Join-Path $repoRoot '.runtime/muster'
if (-not (Test-Path -LiteralPath (Join-Path $taskRoot 'fixture.json'))) { throw 'Prepare the task-owned Muster fixture first.' }
$listener = Get-NetTCPConnection -State Listen -LocalPort 3128 -ErrorAction SilentlyContinue
if ($listener) {
  $running = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener[0].OwningProcess)"
  if ($running.CommandLine -and $running.CommandLine.Contains($repoRoot)) {
    Write-Output 'Owned Muster preview already running at http://127.0.0.1:3128/'
    exit 0
  }
  throw 'Port 3128 belongs to another process. Preserve it.'
}
$env:DATABASE_URL = 'file:' + (Join-Path $taskRoot 'muster.sqlite').Replace('\', '/')
$env:CHRONICLE_ASSET_ROOT = Join-Path $taskRoot 'chronicle-assets'
$env:PROFILE_MEDIA_ROOT = Join-Path $taskRoot 'profile-media'
$env:SESSION_SECRET = [Guid]::NewGuid().ToString() + [Guid]::NewGuid().ToString()
$env:NEXT_PUBLIC_APP_URL = 'http://127.0.0.1:3128'
$env:HOMEPORT_PUBLIC_APP_ORIGIN = 'http://127.0.0.1:3128'
$env:NEXT_TELEMETRY_DISABLED = '1'
$node = (Get-Command node).Source
$next = Join-Path $repoRoot 'node_modules/next/dist/bin/next'
$process = Start-Process -FilePath $node -ArgumentList @($next, 'dev', '--hostname', '127.0.0.1', '--port', '3128') -WorkingDirectory $repoRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskRoot 'preview.stdout.log') -RedirectStandardError (Join-Path $taskRoot 'preview.stderr.log') -PassThru
@{ root = $repoRoot; taskRoot = $taskRoot; launcherPid = $process.Id; port = 3128; url = 'http://127.0.0.1:3128/captain/voyages/muster-all-ready/muster'; startedAt = (Get-Date).ToString('o') } | ConvertTo-Json | Set-Content (Join-Path $taskRoot 'runtime.json')
Write-Output "Muster preview starting at http://127.0.0.1:3128/ (owned PID $($process.Id))."
