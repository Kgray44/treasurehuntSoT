param(
    [Parameter(Position = 0)]
    [ValidateSet("start", "status", "stop")]
    [string]$Action = "status",
    [Parameter(Mandatory = $true, Position = 1)]
    [string]$TaskRoot,
    [string]$DatabasePath,
    [int]$Port = 3000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).ProviderPath
$allowedRoot = Join-Path $env:LOCALAPPDATA "ProjectHomeport"
$resolvedTaskRoot = [IO.Path]::GetFullPath($TaskRoot)
if (-not $resolvedTaskRoot.StartsWith($allowedRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "HOMEPORT_STAGING_ORIGIN_TASK_ROOT_REFUSED:$resolvedTaskRoot"
}
if (-not $DatabasePath) {
    $DatabasePath = Join-Path $resolvedTaskRoot "owner-rereview-database\homeport-phase7-owner-correction-round3-rereview.db"
}
$resolvedDatabasePath = [IO.Path]::GetFullPath($DatabasePath)
if (-not $resolvedDatabasePath.StartsWith($resolvedTaskRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "HOMEPORT_STAGING_ORIGIN_DATABASE_REFUSED:$resolvedDatabasePath"
}

$statePath = Join-Path $resolvedTaskRoot "leases\staging-origin-runtime.json"

function Get-PortOwner {
    $connection = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($connection) { return [int]$connection.OwningProcess }
    return $null
}

function Test-ProcessAlive([int]$ProcessId) {
    return $null -ne (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)
}

function Test-Descendant([int]$ChildId, [int]$AncestorId) {
    $current = $ChildId
    for ($depth = 0; $depth -lt 12 -and $current -gt 0; $depth++) {
        if ($current -eq $AncestorId) { return $true }
        $process = Get-CimInstance Win32_Process -Filter "ProcessId = $current" -ErrorAction SilentlyContinue
        if (-not $process) { return $false }
        $current = [int]$process.ParentProcessId
    }
    return $false
}

function Read-State {
    if (-not (Test-Path -LiteralPath $statePath)) { return $null }
    return Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json
}

function Get-Health {
    try {
        $response = Invoke-WebRequest -Uri ("http://127.0.0.1:{0}/" -f $Port) -UseBasicParsing -TimeoutSec 3
        return @{ ok = $response.StatusCode -ge 200 -and $response.StatusCode -lt 400; status = $response.StatusCode }
    } catch {
        return @{ ok = $false; status = $null }
    }
}

function Report-Status {
    $state = Read-State
    $processAlive = $false
    if ($state -and $state.pid) { $processAlive = Test-ProcessAlive -ProcessId ([int]$state.pid) }
    $portOwner = Get-PortOwner
    $ownedPort = $false
    if ($state -and $portOwner) { $ownedPort = Test-Descendant -ChildId $portOwner -AncestorId ([int]$state.pid) }
    $health = Get-Health
    return [ordered]@{
        status = if ($processAlive -and $ownedPort -and $health.ok) { "HOMEPORT_STAGING_ORIGIN_HEALTHY" } else { "HOMEPORT_STAGING_ORIGIN_STOPPED" }
        processAlive = $processAlive
        port = $Port
        portOwnerPid = $portOwner
        ownedPort = $ownedPort
        health = $health
        statePath = $statePath
        taskRoot = $resolvedTaskRoot
        databasePath = $resolvedDatabasePath
        source = if ($state) { $state.source } else { $null }
        branch = if ($state) { $state.branch } else { $null }
        stagingUrl = "https://staging.absoluterelativesystems.com"
        lanUrl = if ($state) { $state.lanUrl } else { $null }
    }
}

if ($Action -eq "status") {
    Report-Status | ConvertTo-Json -Depth 5
    exit 0
}

if ($Action -eq "stop") {
    $state = Read-State
    if (-not $state -or -not $state.pid) {
        @{ status = "HOMEPORT_STAGING_ORIGIN_ALREADY_STOPPED"; statePath = $statePath } | ConvertTo-Json
        exit 0
    }
    $pidToStop = [int]$state.pid
    $portOwner = Get-PortOwner
    if ($portOwner -and -not (Test-Descendant -ChildId $portOwner -AncestorId $pidToStop)) {
        throw "HOMEPORT_STAGING_ORIGIN_REFUSES_UNRELATED_PORT_OWNER:$portOwner"
    }
    if (Test-ProcessAlive -ProcessId $pidToStop) {
        & taskkill.exe /PID $pidToStop /T /F | Out-Null
        if ($LASTEXITCODE -ne 0 -and (Test-ProcessAlive -ProcessId $pidToStop)) {
            throw "HOMEPORT_STAGING_ORIGIN_STOP_FAILED:$pidToStop"
        }
    }
    Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
    @{ status = "HOMEPORT_STAGING_ORIGIN_STOPPED"; pid = $pidToStop; port = $Port } | ConvertTo-Json
    exit 0
}

if (-not (Test-Path -LiteralPath $resolvedDatabasePath)) { throw "HOMEPORT_STAGING_ORIGIN_DATABASE_MISSING" }
if ((Get-Item -LiteralPath $resolvedDatabasePath).Length -lt 1) { throw "HOMEPORT_STAGING_ORIGIN_DATABASE_EMPTY" }
if (Get-PortOwner) { throw "HOMEPORT_STAGING_ORIGIN_PORT_BUSY:$Port" }

. (Join-Path $repositoryRoot "scripts\dev-common.ps1")
Import-ForeverEnvironment -Path (Join-Path $repositoryRoot ".env")
$localEnvironment = Join-Path $repositoryRoot ".env.local"
if (Test-Path -LiteralPath $localEnvironment) { Import-ForeverEnvironment -Path $localEnvironment }

$lanAddress = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.AddressState -eq "Preferred" } |
    Sort-Object InterfaceMetric |
    Select-Object -First 1 -ExpandProperty IPAddress
if (-not $lanAddress) { throw "HOMEPORT_STAGING_ORIGIN_LAN_ADDRESS_MISSING" }

$env:DATABASE_URL = "file:" + $resolvedDatabasePath.Replace("\", "/")
$env:HOMEPORT_ALLOWED_DEV_ORIGINS = "127.0.0.1,staging.absoluterelativesystems.com,$lanAddress"
$env:HOMEPORT_ORIGIN_DIAGNOSTICS = "1"
$env:HOMEPORT_PUBLIC_APP_ORIGIN = "https://staging.absoluterelativesystems.com"
$env:HOMEPORT_PHASE7_TASK_ROOT = $resolvedTaskRoot
$env:HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER = "SYNTHETIC_OUTBOX"
$env:HOMEPORT_SYNTHETIC_EMAIL_ADAPTER = "TASK_OWNED_TEST"
$env:HOMEPORT_SYNTHETIC_OUTBOX_PATH = Join-Path $resolvedTaskRoot "synthetic-outbox\owner-correction-round3-email.jsonl"
[Environment]::SetEnvironmentVariable("RESEND_API_KEY", $null, "Process")
[Environment]::SetEnvironmentVariable("RESEND_LIVE_TEST_RECIPIENT", $null, "Process")
[Environment]::SetEnvironmentVariable("POSTMARK_SERVER_TOKEN", $null, "Process")
$env:PROFILE_MEDIA_ROOT = Join-Path $resolvedTaskRoot "synthetic-media\profile"
$env:PRIVATE_CONTENT_ROOT = Join-Path $resolvedTaskRoot "synthetic-media\private"
$env:NEXT_DIST_DIR = ".next"

$logRoot = Join-Path $resolvedTaskRoot "logs"
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$stdoutPath = Join-Path $logRoot "staging-origin-dev.stdout.log"
$stderrPath = Join-Path $logRoot "staging-origin-dev.stderr.log"
$process = Start-Process -FilePath (Get-ForeverNode) -ArgumentList @(
    "node_modules/next/dist/bin/next", "dev", "-H", "0.0.0.0", "-p", [string]$Port
) -WorkingDirectory $repositoryRoot -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru

$deadline = (Get-Date).AddSeconds(60)
$health = Get-Health
while (-not $health.ok -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 500
    if ($process.HasExited) { throw "HOMEPORT_STAGING_ORIGIN_EXITED_EARLY:$($process.ExitCode)" }
    $health = Get-Health
}
if (-not $health.ok) {
    & taskkill.exe /PID $process.Id /T /F | Out-Null
    throw "HOMEPORT_STAGING_ORIGIN_HEALTH_TIMEOUT"
}

$portOwner = Get-PortOwner
if (-not $portOwner -or -not (Test-Descendant -ChildId $portOwner -AncestorId $process.Id)) {
    & taskkill.exe /PID $process.Id /T /F | Out-Null
    throw "HOMEPORT_STAGING_ORIGIN_PORT_OWNERSHIP_FAILED"
}

New-Item -ItemType Directory -Path (Split-Path $statePath) -Force | Out-Null
$state = [ordered]@{
    schemaVersion = "1.0.0"
    owner = "homeport-staging-origin-acceptance"
    pid = $process.Id
    initialListenerPid = $portOwner
    port = $Port
    loopbackUrl = "http://127.0.0.1:$Port"
    lanUrl = "http://${lanAddress}:$Port"
    stagingUrl = "https://staging.absoluterelativesystems.com"
    taskRoot = $resolvedTaskRoot
    databasePath = $resolvedDatabasePath
    source = (& git -C $repositoryRoot rev-parse HEAD).Trim()
    branch = (& git -C $repositoryRoot branch --show-current).Trim()
    startedAt = (Get-Date).ToString("o")
    stdout = $stdoutPath
    stderr = $stderrPath
    retainedIntentionally = $true
}
$state | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $statePath -Encoding UTF8
Report-Status | ConvertTo-Json -Depth 5
