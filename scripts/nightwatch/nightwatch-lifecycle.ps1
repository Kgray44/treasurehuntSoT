[CmdletBinding()]
param(
  [ValidateSet("start", "stop", "status", "restart")]
  [string]$Action = "status",
  [string]$DatabasePath = "",
  [ValidateRange(5000, 300000)]
  [int]$IntervalMs = 15000
)

$ErrorActionPreference = "Stop"
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$daemonPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "nightwatchd.ts"))
$healthProbePath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "controller-health.mjs"))
$tsxCliPath = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot "node_modules\tsx\dist\cli.mjs"))
$runtimeDirectory = Join-Path $repositoryRoot ".nightwatch"
$statePath = Join-Path $runtimeDirectory "nightwatch-runtime.json"

function Read-NightwatchState {
  if (!(Test-Path -LiteralPath $statePath)) { return $null }
  try { return Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json } catch { throw "Nightwatch runtime state is unreadable: $statePath" }
}

function Get-OwnedProcess([object]$state) {
  if ($null -eq $state) { return $null }
  if ($state.RepositoryRoot -ne $repositoryRoot -or $state.DaemonPath -ne $daemonPath) {
    throw "Nightwatch runtime state does not belong to this workspace. Refusing to act on it."
  }
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$state.Pid)" -ErrorAction SilentlyContinue
  if ($null -eq $process) { return $null }
  if ($null -eq $process.CommandLine -or !$process.CommandLine.Contains($daemonPath)) {
    throw "Recorded PID $($state.Pid) is not this Nightwatch controller. Refusing to stop it."
  }
  return $process
}

function Read-NightwatchHealth {
  if (!(Test-Path -LiteralPath $env:NIGHTWATCH_DB_PATH)) { return [pscustomobject]@{ State = "DOWN"; Detail = "Nightwatch ledger has not been created." } }
  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($null -eq $node) { return [pscustomobject]@{ State = "UNKNOWN"; Detail = "Node.js is not available to inspect controller health." } }
  try { return (& $node.Source $healthProbePath 2>$null | ConvertFrom-Json) } catch { return [pscustomobject]@{ State = "DEGRADED"; Detail = "Nightwatch health record is unreadable." } }
}

function Write-NightwatchState([System.Diagnostics.Process]$process) {
  New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
  [ordered]@{
    Pid = $process.Id
    RepositoryRoot = $repositoryRoot
    DaemonPath = $daemonPath
    DatabasePath = $env:NIGHTWATCH_DB_PATH
    StartedAt = (Get-Date).ToUniversalTime().ToString("o")
  } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8
}

function Stop-OwnedNightwatch {
  $state = Read-NightwatchState
  $owned = Get-OwnedProcess $state
  if ($null -eq $owned) {
    if ($state) { Remove-Item -LiteralPath $statePath -Force }
    return [pscustomobject]@{ State = "NOT_RUNNING"; Pid = $null }
  }
  $taskkill = Join-Path $env:SystemRoot "System32\taskkill.exe"
  & $taskkill /PID ([int]$owned.ProcessId) /T /F | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Nightwatch controller process tree could not be stopped (exit $LASTEXITCODE)." }
  $deadline = (Get-Date).AddSeconds(10)
  while ((Get-Date) -lt $deadline -and (Get-Process -Id ([int]$owned.ProcessId) -ErrorAction SilentlyContinue)) { Start-Sleep -Milliseconds 200 }
  if (Get-Process -Id ([int]$owned.ProcessId) -ErrorAction SilentlyContinue) { throw "Nightwatch controller did not stop within 10 seconds." }
  Remove-Item -LiteralPath $statePath -Force
  return [pscustomobject]@{ State = "STOPPED"; Pid = [int]$owned.ProcessId }
}

function Start-OwnedNightwatch {
  if (!(Test-Path -LiteralPath $tsxCliPath)) { throw "Nightwatch runtime dependency is missing. Run npm ci first." }
  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($null -eq $node) { throw "Node.js is required before starting Nightwatch." }
  if (!$env:NIGHTWATCH_REPOSITORY) { throw "NIGHTWATCH_REPOSITORY must be configured before starting Nightwatch." }
  $state = Read-NightwatchState
  $owned = Get-OwnedProcess $state
  if ($owned) { return [pscustomobject]@{ State = "ALREADY_RUNNING"; Pid = [int]$owned.ProcessId; Health = (Read-NightwatchHealth) } }
  if ($state) { Remove-Item -LiteralPath $statePath -Force }
  $env:NIGHTWATCH_DB_PATH = if ($DatabasePath) { [System.IO.Path]::GetFullPath($DatabasePath) } else { Join-Path $runtimeDirectory "nightwatch.sqlite" }
  $env:NIGHTWATCH_INTERVAL_MS = "$IntervalMs"
  $started = Start-Process -FilePath $node.Source -ArgumentList @($tsxCliPath, $daemonPath) -WorkingDirectory $repositoryRoot -WindowStyle Hidden -PassThru
  Write-NightwatchState $started
  $deadline = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $deadline) {
    if ($started.HasExited) { break }
    $health = Read-NightwatchHealth
    if ($health.State -eq "LIVE") { return [pscustomobject]@{ State = "HEALTHY"; Pid = $started.Id; DatabasePath = $env:NIGHTWATCH_DB_PATH } }
    Start-Sleep -Milliseconds 300
  }
  if (!$started.HasExited) {
    $taskkill = Join-Path $env:SystemRoot "System32\taskkill.exe"
    & $taskkill /PID $started.Id /T /F | Out-Null
  }
  Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
  throw "Nightwatch did not become healthy. The owned process was stopped; inspect local configuration before retrying."
}

switch ($Action) {
  "status" {
    if (!$env:NIGHTWATCH_DB_PATH) { $env:NIGHTWATCH_DB_PATH = if ($DatabasePath) { [System.IO.Path]::GetFullPath($DatabasePath) } else { Join-Path $runtimeDirectory "nightwatch.sqlite" } }
    $state = Read-NightwatchState
    $owned = Get-OwnedProcess $state
    [pscustomobject]@{ State = if ($owned) { "RUNNING" } else { "NOT_RUNNING" }; Pid = if ($owned) { [int]$owned.ProcessId } else { $null }; Health = (Read-NightwatchHealth); StatePath = $statePath }
  }
  "start" { Start-OwnedNightwatch }
  "stop" { Stop-OwnedNightwatch }
  "restart" { Stop-OwnedNightwatch | Out-Null; Start-OwnedNightwatch }
}
