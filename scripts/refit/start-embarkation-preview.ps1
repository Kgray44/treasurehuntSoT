$ErrorActionPreference = 'Stop'
$embarkationRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$embarkationRuntime = Join-Path $embarkationRoot '.runtime/embarkation'
if (-not (Test-Path -LiteralPath (Join-Path $embarkationRoot '.runtime/muster/fixture.json'))) { throw 'Prepare the isolated fixture first.' }
if (Get-NetTCPConnection -State Listen -LocalPort 3138 -ErrorAction SilentlyContinue) { throw 'Port 3138 is occupied; preserve its owner.' }
$env:DATABASE_URL = 'file:' + (Join-Path $embarkationRoot '.runtime/muster/muster.sqlite').Replace('\','/')
$env:CHRONICLE_ASSET_ROOT = Join-Path $embarkationRoot '.runtime/muster/chronicle-assets'
$env:PROFILE_MEDIA_ROOT = Join-Path $embarkationRoot '.runtime/muster/profile-media'
$env:SESSION_SECRET = [Guid]::NewGuid().ToString() + [Guid]::NewGuid().ToString()
$env:NEXT_PUBLIC_APP_URL = 'http://127.0.0.1:3138'
$env:HOMEPORT_PUBLIC_APP_ORIGIN = 'http://127.0.0.1:3138'
$env:EMBARKATION_PREVIEW = '1'
$env:NEXT_TELEMETRY_DISABLED = '1'
$embarkationNode = (Get-Command node).Source
$embarkationNext = Join-Path $embarkationRoot 'node_modules/next/dist/bin/next'
$embarkationProcess = Start-Process -FilePath $embarkationNode -ArgumentList @($embarkationNext,'dev','--hostname','127.0.0.1','--port','3138') -WorkingDirectory $embarkationRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $embarkationRuntime 'preview.stdout.log') -RedirectStandardError (Join-Path $embarkationRuntime 'preview.stderr.log') -PassThru
@{root=$embarkationRoot;pid=$embarkationProcess.Id;port=3138;url='http://127.0.0.1:3138/dev/embarkation';startedAt=(Get-Date).ToString('o')} | ConvertTo-Json | Set-Content (Join-Path $embarkationRuntime 'runtime.json')
Write-Output 'Embarkation preview starting at http://127.0.0.1:3138/dev/embarkation'
