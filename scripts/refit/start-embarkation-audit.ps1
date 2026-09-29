$ErrorActionPreference = 'Stop'
$auditRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$auditRuntime = Join-Path $auditRoot '.runtime/embarkation/audit-repair'
$auditFixture = Join-Path $auditRuntime 'fixture'
if (-not (Test-Path -LiteralPath (Join-Path $auditFixture 'muster.sqlite'))) { throw 'Run prepare-embarkation-audit.mjs first.' }
if (Get-NetTCPConnection -State Listen -LocalPort 3148 -ErrorAction SilentlyContinue) { throw 'Port 3148 is occupied; preserve its owner.' }
$env:DATABASE_URL = 'file:' + (Join-Path $auditFixture 'muster.sqlite').Replace('\','/')
$env:CHRONICLE_ASSET_ROOT = Join-Path $auditFixture 'chronicle-assets'
$env:PROFILE_MEDIA_ROOT = Join-Path $auditFixture 'profile-media'
$env:SESSION_SECRET = [Guid]::NewGuid().ToString() + [Guid]::NewGuid().ToString()
$env:NEXT_PUBLIC_APP_URL = 'http://127.0.0.1:3148'
$env:HOMEPORT_PUBLIC_APP_ORIGIN = 'http://127.0.0.1:3148'
$env:EMBARKATION_PREVIEW = '1'
$env:EMBARKATION_AUDIT_FIXTURE = '1'
$env:NEXT_DIST_DIR = '.next-embarkation-audit'
$env:NEXT_TELEMETRY_DISABLED = '1'
$auditNode = (Get-Command node).Source
$auditNext = Join-Path $auditRoot 'node_modules/next/dist/bin/next'
$auditProcess = Start-Process -FilePath $auditNode -ArgumentList @($auditNext,'dev','--hostname','127.0.0.1','--port','3148') -WorkingDirectory $auditRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $auditRuntime 'preview.stdout.log') -RedirectStandardError (Join-Path $auditRuntime 'preview.stderr.log') -PassThru
@{root=$auditRoot;pid=$auditProcess.Id;port=3148;url='http://127.0.0.1:3148/dev/embarkation';startedAt=(Get-Date).ToString('o')} | ConvertTo-Json | Set-Content (Join-Path $auditRuntime 'runtime.json')
Write-Output 'Audit fixture preview starting on http://127.0.0.1:3148/dev/embarkation'
