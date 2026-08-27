param([int]$Port = 3000, [switch]$Lan)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "dev-common.ps1")

$runtimeRoot = Initialize-ForeverRuntime -Mode development
$statePath = Join-Path $env:LOCALAPPDATA "ForeverTreasureCompanion\dev-state.json"
$playerUrl = "http://127.0.0.1:$Port/tale/development-forever-treasure"
$gmUrl = "http://127.0.0.1:$Port/quartermaster"
$bindAddress = if ($Lan) { "0.0.0.0" } else { "127.0.0.1" }
$lanAddress = if ($Lan) { Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } | Sort-Object InterfaceMetric | Select-Object -First 1 -ExpandProperty IPAddress } else { $null }
if ($lanAddress) {
    $configuredDevOrigins = if ($env:HOMEPORT_ALLOWED_DEV_ORIGINS) { @($env:HOMEPORT_ALLOWED_DEV_ORIGINS -split ",") } else { @() }
    $env:HOMEPORT_ALLOWED_DEV_ORIGINS = (@($configuredDevOrigins) + @($lanAddress) | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Select-Object -Unique) -join ","
}

if (Test-Path $statePath) {
    $state = Get-Content -Raw $statePath | ConvertFrom-Json
    $existing = Get-Process -Id $state.pid -ErrorAction SilentlyContinue
    if ($existing) {
        try { Wait-ForeverHttp -Url "http://127.0.0.1:$Port" -Seconds 3; Write-Host "Forever Treasure Companion is already running." -ForegroundColor Green; Write-Host "`nPlayer Companion:`n$playerUrl`n`nGame Master Dashboard:`n$gmUrl`n"; exit 0 } catch { throw "Port $Port belongs to an existing recorded process that is not healthy. Run .\scripts\stop-dev.ps1 and retry." }
    }
}
try { $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop; if ($listener) { throw "Port $Port is already in use. Stop that application or run .\scripts\start-dev.ps1 -Port 3001." } } catch [Microsoft.PowerShell.Cmdletization.Cim.CimJobException] { }

$logDirectory = Join-Path $runtimeRoot ".forever\logs"
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$stdout = Join-Path $logDirectory "dev.out.log"
$stderr = Join-Path $logDirectory "dev.err.log"
$node = Get-ForeverNode
$process = Start-Process -FilePath $node -ArgumentList "node_modules/next/dist/bin/next", "dev", "-H", $bindAddress, "-p", "$Port" -WorkingDirectory $runtimeRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
@{ pid = $process.Id; port = $Port; runtimeRoot = $runtimeRoot; startedAt = (Get-Date).ToString("o"); runtimeStatePid = $null; communityWorkerPid = $null; operationalProjectionPid = $null } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
try { Wait-ForeverHttp -Url "http://127.0.0.1:$Port" -Seconds 60 } catch { if (Test-Path $stderr) { Get-Content $stderr -Tail 30 }; throw }
$runtimeStateWriter = Join-Path $PSScriptRoot "bridgewatch\write-runtime-state.mjs"
& $node $runtimeStateWriter --state RUNNING --port "$Port" --source-root $runtimeRoot
if ($LASTEXITCODE -ne 0) { throw "Unable to write the sanitized Bridgewatch runtime state." }
$runtimeStateOut = Join-Path $logDirectory "bridgewatch-runtime-state.out.log"
$runtimeStateErr = Join-Path $logDirectory "bridgewatch-runtime-state.err.log"
$runtimeState = Start-Process -FilePath $node -ArgumentList $runtimeStateWriter, "--watch", "--interval-ms", "30000", "--state", "RUNNING", "--port", "$Port", "--source-root", $runtimeRoot -WorkingDirectory $runtimeRoot -WindowStyle Hidden -RedirectStandardOutput $runtimeStateOut -RedirectStandardError $runtimeStateErr -PassThru
$tsx = Join-Path $runtimeRoot "node_modules\tsx\dist\cli.mjs"
if (!(Test-Path -LiteralPath $tsx)) { throw "The task-owned runtime is missing tsx for Harborlight operational projections." }
$state = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json
$state.runtimeStatePid = $runtimeState.Id
if ($env:COMMUNITY_WORKER_ENABLED -eq "true") {
    $workerOut = Join-Path $logDirectory "community-worker.out.log"
    $workerErr = Join-Path $logDirectory "community-worker.err.log"
    $worker = Start-Process -FilePath $node -ArgumentList $tsx, "scripts/community/worker.ts" -WorkingDirectory $runtimeRoot -WindowStyle Hidden -RedirectStandardOutput $workerOut -RedirectStandardError $workerErr -PassThru
    $state.communityWorkerPid = $worker.Id
}
$projectionOut = Join-Path $logDirectory "bridgewatch-projection.out.log"
$projectionErr = Join-Path $logDirectory "bridgewatch-projection.err.log"
$projection = Start-Process -FilePath $node -ArgumentList $tsx, "scripts/bridgewatch/operational-projection.ts" -WorkingDirectory $runtimeRoot -WindowStyle Hidden -RedirectStandardOutput $projectionOut -RedirectStandardError $projectionErr -PassThru
$state.operationalProjectionPid = $projection.Id
$state | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8

Write-Host "`nForever Treasure Companion is running." -ForegroundColor Green
Write-Host "`nPlayer Companion:`n$playerUrl"
Write-Host "Access phrase: development-moonwake"
Write-Host "`nGame Master Dashboard:`n$gmUrl"
Write-Host "Development login: kato / development-captain-only"
if ($lanAddress) { Write-Host "`nLAN player URL:`nhttp://${lanAddress}:$Port/tale/development-forever-treasure"; Write-Host "LAN GM URL:`nhttp://${lanAddress}:$Port/quartermaster" }
Write-Host "`nStop with: .\scripts\stop-dev.ps1`n"
