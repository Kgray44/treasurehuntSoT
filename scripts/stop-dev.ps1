$ErrorActionPreference = "Stop"
$statePath = Join-Path $env:LOCALAPPDATA "ForeverTreasureCompanion\dev-state.json"
if (-not (Test-Path -LiteralPath $statePath)) { Write-Host "Forever Treasure Companion is not recorded as running."; exit 0 }
$state = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json
$process = Get-CimInstance Win32_Process -Filter "ProcessId = $($state.pid)" -ErrorAction SilentlyContinue
if ($process) {
    if ($process.Name -ne "node.exe" -or $process.CommandLine -notlike "*next*dev*") { throw "Refusing to stop PID $($state.pid): it is not the recorded Next.js development process." }
    Stop-Process -Id $state.pid
    Start-Sleep -Milliseconds 600
    if (Get-Process -Id $state.pid -ErrorAction SilentlyContinue) { Stop-Process -Id $state.pid -Force }
}
Remove-Item -LiteralPath $statePath -Force
Write-Host "Forever Treasure Companion has stopped." -ForegroundColor Green
