[CmdletBinding()]
param(
  [ValidateSet("start", "stop", "status", "restart")]
  [string]$Action = "status",
  [ValidateSet("127.0.0.1", "localhost", "::1")]
  [string]$ListenHost = "127.0.0.1",
  [ValidateRange(1, 65535)]
  [int]$Port = 4318,
  [string]$DatabasePath = ""
)

$ErrorActionPreference = "Stop"
$packageRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$serverPath = [System.IO.Path]::GetFullPath((Join-Path $packageRoot "dist\lib\server.js"))
$runtimeDirectory = Join-Path $packageRoot "var"
$statePath = Join-Path $runtimeDirectory "bridgewatch-runtime.json"

function Read-BridgewatchState {
  if (!(Test-Path -LiteralPath $statePath)) { return $null }
  try { return Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json } catch { throw "Bridgewatch runtime state is unreadable: $statePath" }
}

function Get-OwnedProcess([object]$state) {
  if ($null -eq $state) { return $null }
  if ($state.PackageRoot -ne $packageRoot -or $state.ServerPath -ne $serverPath) {
    throw "Bridgewatch runtime state does not belong to this workspace. Refusing to act on it."
  }
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$state.Pid)" -ErrorAction SilentlyContinue
  if ($null -eq $process) { return $null }
  if ($null -eq $process.CommandLine -or !$process.CommandLine.Contains($serverPath)) {
    throw "Recorded PID $($state.Pid) is not this Bridgewatch server. Refusing to stop it."
  }
  return $process
}

function Get-PortOwner {
  $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
  return $listeners | Select-Object -First 1
}

function Write-BridgewatchState([System.Diagnostics.Process]$process) {
  New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
  [ordered]@{
    Pid = $process.Id
    PackageRoot = $packageRoot
    ServerPath = $serverPath
    ListenHost = $ListenHost
    Port = $Port
    DatabasePath = $env:BRIDGEWATCH_DB_PATH
    StartedAt = (Get-Date).ToUniversalTime().ToString("o")
  } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8
}

function Test-BridgewatchHealth {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri "http://127.0.0.1:$Port/healthz"
    return $response.StatusCode -eq 200
  } catch { return $false }
}

function Stop-OwnedBridgewatch {
  $state = Read-BridgewatchState
  $owned = Get-OwnedProcess $state
  if ($null -eq $owned) {
    if ($state) { Remove-Item -LiteralPath $statePath -Force }
    return [pscustomobject]@{ State = "NOT_RUNNING"; Pid = $null }
  }
  Stop-Process -Id ([int]$owned.ProcessId) -ErrorAction Stop
  $deadline = (Get-Date).AddSeconds(10)
  while ((Get-Date) -lt $deadline -and (Get-Process -Id ([int]$owned.ProcessId) -ErrorAction SilentlyContinue)) { Start-Sleep -Milliseconds 200 }
  if (Get-Process -Id ([int]$owned.ProcessId) -ErrorAction SilentlyContinue) { throw "Owned Bridgewatch process did not stop within 10 seconds." }
  Remove-Item -LiteralPath $statePath -Force
  return [pscustomobject]@{ State = "STOPPED"; Pid = [int]$owned.ProcessId }
}

function Start-OwnedBridgewatch {
  if (!(Test-Path -LiteralPath $serverPath)) { throw "Bridgewatch build is missing. Run npm run build from bridgewatch first." }
  if (!$env:BRIDGEWATCH_REPOSITORY) { throw "BRIDGEWATCH_REPOSITORY must be configured before starting Bridgewatch." }
  $state = Read-BridgewatchState
  $owned = Get-OwnedProcess $state
  if ($owned) { return [pscustomobject]@{ State = "ALREADY_RUNNING"; Pid = [int]$owned.ProcessId; Health = (Test-BridgewatchHealth) } }
  if ($state) { Remove-Item -LiteralPath $statePath -Force }
  $listener = Get-PortOwner
  if ($listener) { throw "Port $Port is already listening under PID $($listener.OwningProcess). Refusing to replace an unowned process." }
  $env:BRIDGEWATCH_HOST = $ListenHost
  $env:BRIDGEWATCH_PORT = "$Port"
  if ($DatabasePath) { $env:BRIDGEWATCH_DB_PATH = [System.IO.Path]::GetFullPath($DatabasePath) }
  elseif (!$env:BRIDGEWATCH_DB_PATH) { $env:BRIDGEWATCH_DB_PATH = Join-Path $runtimeDirectory "bridgewatch.sqlite" }
  $started = Start-Process -FilePath "node" -ArgumentList @($serverPath) -WorkingDirectory $packageRoot -WindowStyle Hidden -PassThru
  Write-BridgewatchState $started
  $deadline = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $deadline) {
    if (Test-BridgewatchHealth) { return [pscustomobject]@{ State = "HEALTHY"; Pid = $started.Id; Url = "http://127.0.0.1:$Port/" } }
    if ($started.HasExited) { break }
    Start-Sleep -Milliseconds 300
  }
  if (!$started.HasExited) { Stop-Process -Id $started.Id -ErrorAction SilentlyContinue }
  Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
  throw "Bridgewatch did not become healthy. The process started by this helper was stopped; inspect its local configuration before retrying."
}

switch ($Action) {
  "status" {
    $state = Read-BridgewatchState
    $owned = Get-OwnedProcess $state
    [pscustomobject]@{ State = if ($owned) { if (Test-BridgewatchHealth) { "HEALTHY" } else { "STARTING_OR_UNHEALTHY" } } else { "NOT_RUNNING" }; Pid = if ($owned) { [int]$owned.ProcessId } else { $null }; Port = $Port; StatePath = $statePath }
  }
  "start" { Start-OwnedBridgewatch }
  "stop" { Stop-OwnedBridgewatch }
  "restart" { Stop-OwnedBridgewatch | Out-Null; Start-OwnedBridgewatch }
}
