$ErrorActionPreference = "Stop"
$statePath = Join-Path $env:LOCALAPPDATA "ForeverTreasureCompanion\dev-state.json"
if (-not (Test-Path -LiteralPath $statePath)) { Write-Host "Forever Treasure Companion is not recorded as running."; exit 0 }
$state = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json
$sidecars = @(
    @{ Name = "Bridgewatch runtime-state refresher"; Pid = $state.runtimeStatePid; Marker = "write-runtime-state.mjs" },
    @{ Name = "community worker"; Pid = $state.communityWorkerPid; Marker = "scripts/community/worker.ts" },
    @{ Name = "Bridgewatch operational projection"; Pid = $state.operationalProjectionPid; Marker = "scripts/bridgewatch/operational-projection.ts" }
)
foreach ($sidecar in $sidecars) {
    if ($null -eq $sidecar.Pid) { continue }
    $sidecarProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$sidecar.Pid)" -ErrorAction SilentlyContinue
    if ($sidecarProcess) {
        if ($sidecarProcess.Name -ne "node.exe" -or $sidecarProcess.CommandLine -notlike "*$($sidecar.Marker)*") {
            throw "Refusing to stop PID $($sidecar.Pid): it is not the recorded $($sidecar.Name)."
        }
        Stop-Process -Id ([int]$sidecar.Pid)
        Start-Sleep -Milliseconds 300
        if (Get-Process -Id ([int]$sidecar.Pid) -ErrorAction SilentlyContinue) { Stop-Process -Id ([int]$sidecar.Pid) -Force }
    }
}
$process = Get-CimInstance Win32_Process -Filter "ProcessId = $($state.pid)" -ErrorAction SilentlyContinue
if ($process) {
    if ($process.Name -ne "node.exe" -or $process.CommandLine -notlike "*next*dev*") { throw "Refusing to stop PID $($state.pid): it is not the recorded Next.js development process." }
    Stop-Process -Id $state.pid
    Start-Sleep -Milliseconds 600
    if (Get-Process -Id $state.pid -ErrorAction SilentlyContinue) { Stop-Process -Id $state.pid -Force }
}
$runtimeStateWriter = Join-Path $PSScriptRoot "bridgewatch\write-runtime-state.mjs"
$node = (Get-Command node -ErrorAction Stop).Source
& $node $runtimeStateWriter --state STOPPED --port "$($state.port)" --source-root $PSScriptRoot\..
if ($LASTEXITCODE -ne 0) { throw "Unable to update the sanitized Bridgewatch runtime state." }
Remove-Item -LiteralPath $statePath -Force
Write-Host "Forever Treasure Companion has stopped." -ForegroundColor Green
