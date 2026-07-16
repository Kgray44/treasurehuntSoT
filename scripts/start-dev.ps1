param([int]$Port = 3000, [switch]$Lan)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "dev-common.ps1")

$runtimeRoot = Initialize-ForeverRuntime -Mode development
$statePath = Join-Path $env:LOCALAPPDATA "ForeverTreasureCompanion\dev-state.json"
$playerUrl = "http://127.0.0.1:$Port/tale/development-forever-treasure"
$gmUrl = "http://127.0.0.1:$Port/quartermaster"
$bindAddress = if ($Lan) { "0.0.0.0" } else { "127.0.0.1" }
$lanAddress = if ($Lan) { Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } | Sort-Object InterfaceMetric | Select-Object -First 1 -ExpandProperty IPAddress } else { $null }

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
@{ pid = $process.Id; port = $Port; runtimeRoot = $runtimeRoot; startedAt = (Get-Date).ToString("o") } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
try { Wait-ForeverHttp -Url "http://127.0.0.1:$Port" -Seconds 60 } catch { if (Test-Path $stderr) { Get-Content $stderr -Tail 30 }; throw }

Write-Host "`nForever Treasure Companion is running." -ForegroundColor Green
Write-Host "`nPlayer Companion:`n$playerUrl"
Write-Host "Access phrase: development-moonwake"
Write-Host "`nGame Master Dashboard:`n$gmUrl"
Write-Host "Development login: kato / development-captain-only"
if ($lanAddress) { Write-Host "`nLAN player URL:`nhttp://${lanAddress}:$Port/tale/development-forever-treasure"; Write-Host "LAN GM URL:`nhttp://${lanAddress}:$Port/quartermaster" }
Write-Host "`nStop with: .\scripts\stop-dev.ps1`n"
