param([switch]$Build)
$ErrorActionPreference = 'Stop'
$productionRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$productionRuntime = Join-Path $productionRoot '.runtime/embarkation/audit-repair'
$productionFixture = Join-Path $productionRuntime 'production-fixture'
if (-not (Test-Path -LiteralPath (Join-Path $productionFixture 'muster.sqlite'))) { throw 'Run prepare-embarkation-audit.mjs --production first.' }
if (Get-NetTCPConnection -State Listen -LocalPort 3158 -ErrorAction SilentlyContinue) { throw 'Port 3158 is occupied; preserve its owner.' }
$env:DATABASE_URL = 'file:' + (Join-Path $productionFixture 'muster.sqlite').Replace('\','/')
$env:CHRONICLE_ASSET_ROOT = Join-Path $productionFixture 'chronicle-assets'
$env:PROFILE_MEDIA_ROOT = Join-Path $productionFixture 'profile-media'
$env:SESSION_SECRET = [Guid]::NewGuid().ToString() + [Guid]::NewGuid().ToString()
$env:NEXT_PUBLIC_APP_URL = 'http://localhost:3158'
$env:HOMEPORT_PUBLIC_APP_ORIGIN = 'http://localhost:3158'
$env:NEXT_DIST_DIR = '.next-embarkation-production-audit'
$env:NEXT_TELEMETRY_DISABLED = '1'
$env:NODE_ENV = 'production'
# Qualify the ordinary production branch, including its disabled developer routes.
foreach ($productionFlag in @('EMBARKATION_PREVIEW','EMBARKATION_AUDIT_FIXTURE','SOUNDING_LINE_TASK_OWNED_HTTP','SOUNDING_LINE_SUITE_PROFILE','NEXT_PUBLIC_ENABLE_ANIMATION_LAB')) {
  [Environment]::SetEnvironmentVariable($productionFlag, $null, 'Process')
}
$productionNode = (Get-Command node).Source
$productionNext = Join-Path $productionRoot 'node_modules/next/dist/bin/next'
if ($Build) {
  Push-Location $productionRoot
  try { & $productionNode $productionNext build; if ($LASTEXITCODE -ne 0) { throw "Production build failed: $LASTEXITCODE" } }
  finally { Pop-Location }
}
if (-not (Test-Path -LiteralPath (Join-Path $productionRoot '.next-embarkation-production-audit/BUILD_ID'))) { throw 'Build this isolated output with -Build first.' }
$productionProcess = Start-Process -FilePath $productionNode -ArgumentList @($productionNext,'start','--hostname','127.0.0.1','--port','3158') -WorkingDirectory $productionRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $productionRuntime 'production.stdout.log') -RedirectStandardError (Join-Path $productionRuntime 'production.stderr.log') -PassThru
@{root=$productionRoot;pid=$productionProcess.Id;port=3158;url='http://localhost:3158';fixture=$productionFixture;buildId=(Get-Content (Join-Path $productionRoot '.next-embarkation-production-audit/BUILD_ID') -Raw).Trim();startedAt=(Get-Date).ToString('o')} | ConvertTo-Json | Set-Content (Join-Path $productionRuntime 'production-runtime.json')
Write-Output 'Isolated production audit starting on http://localhost:3158'
