param(
    [switch]$SkipBrowserInstall,
    [string[]]$BrowserArgs = @(),
    [string]$BrowserGrep = "",
    [switch]$SkipProductionPerformance
)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "dev-common.ps1")

$validationLockDirectory = Join-Path $env:LOCALAPPDATA "ForeverTreasureCompanion"
[System.IO.Directory]::CreateDirectory($validationLockDirectory) | Out-Null
$validationLockPath = Join-Path $validationLockDirectory "validation-runtime.lock"
try {
    # The validation runtime is intentionally shared so it can preserve the
    # canonical database boundary. Hold an exclusive OS lock for the entire
    # run so another checkout cannot mirror into it mid-validation.
    $validationRuntimeLock = [System.IO.File]::Open(
        $validationLockPath,
        [System.IO.FileMode]::OpenOrCreate,
        [System.IO.FileAccess]::ReadWrite,
        [System.IO.FileShare]::None
    )
} catch [System.IO.IOException] {
    throw "Another Forever Treasure validation run owns $validationLockPath. Wait for it to finish before starting a new run."
}

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$canonicalDatabase = Get-ForeverCanonicalDatabase

function Get-CanonicalDatabaseFamilyFingerprint {
    $members = @(
        foreach ($suffix in @("", "-wal", "-shm", "-journal")) {
            $memberPath = "$canonicalDatabase$suffix"
            if (Test-Path -LiteralPath $memberPath -PathType Leaf) {
                $memberItem = Get-Item -LiteralPath $memberPath
                [pscustomobject]@{
                    fileName = [System.IO.Path]::GetFileName($memberPath)
                    present = $true
                    sha256 = (Get-FileHash -LiteralPath $memberPath -Algorithm SHA256).Hash.ToLowerInvariant()
                    size = [long]$memberItem.Length
                    mtimeIso = $memberItem.LastWriteTimeUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ", [System.Globalization.CultureInfo]::InvariantCulture)
                }
            } else {
                [pscustomobject]@{
                    fileName = [System.IO.Path]::GetFileName($memberPath)
                    present = $false
                }
            }
        }
    )
    return [pscustomobject]@{
        members = $members
        stableKey = ($members | ConvertTo-Json -Compress)
    }
}

$canonicalSamples = @(1..3 | ForEach-Object {
    $sample = Get-CanonicalDatabaseFamilyFingerprint
    if ($_ -lt 3) { Start-Sleep -Milliseconds 500 }
    $sample
})
$canonicalFingerprintKeys = @($canonicalSamples | ForEach-Object { $_.stableKey } | Select-Object -Unique)
if ($canonicalFingerprintKeys.Count -ne 1) {
    throw "Canonical SQLite file family was not stable during validation preflight. Stop its owning process and retry."
}
$canonicalMainFingerprint = $canonicalSamples[0].members[0]
if (-not $canonicalMainFingerprint.present) { throw "Canonical prisma/dev.db is missing." }
$canonicalSha256 = [string]$canonicalMainFingerprint.sha256
$canonicalSize = [long]$canonicalMainFingerprint.size
$canonicalMtimeIso = [string]$canonicalMainFingerprint.mtimeIso
$canonicalFamilyJson = [string]($canonicalSamples[0].members | ConvertTo-Json -Compress)
$canonicalFamilyBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($canonicalFamilyJson))

$runtimeRoot = Initialize-ForeverRuntime -Mode validation -ResetDatabase
$resolvedRuntime = [System.IO.Path]::GetFullPath($runtimeRoot)
$runtimePrefix = $resolvedRuntime.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar

function Assert-ValidationChildPath {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$Label)
    $resolvedPath = [System.IO.Path]::GetFullPath($Path)
    if (-not $resolvedPath.StartsWith($runtimePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "$Label is outside the validated runtime."
    }
    return $resolvedPath
}

$nextCache = Join-Path $runtimeRoot ".next"
if (Test-Path -LiteralPath $nextCache) {
    $resolvedCache = Assert-ValidationChildPath -Path $nextCache -Label "Validation cache"
    Remove-Item -LiteralPath $resolvedCache -Recurse -Force
}
$validationArtifacts = Join-Path $runtimeRoot "artifacts\validation"
if (Test-Path -LiteralPath $validationArtifacts) {
    $resolvedArtifacts = Assert-ValidationChildPath -Path $validationArtifacts -Label "Validation artifacts"
    Remove-Item -LiteralPath $resolvedArtifacts -Recurse -Force
}
New-Item -ItemType Directory -Path $validationArtifacts -Force | Out-Null

$node = Get-ForeverNode
$nodeDirectory = Split-Path $node
$env:PATH = "$nodeDirectory;$env:PATH"
if ($env:PLAYWRIGHT_BASE_URL -and $env:PLAYWRIGHT_BASE_URL -ne "http://127.0.0.1:3100") {
    throw "Validation requires PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100."
}
if ($env:FOREVER_VALIDATION_PRODUCTION_PORT -and [int]$env:FOREVER_VALIDATION_PRODUCTION_PORT -ne 3200) {
    throw "Production restart validation is serialized on port 3200."
}
if ($env:FOREVER_PHASE3_PERFORMANCE_BASE_URL -and $env:FOREVER_PHASE3_PERFORMANCE_BASE_URL -ne "http://127.0.0.1:3200") {
    throw "Phase 3 production performance requires http://127.0.0.1:3200."
}
if ($env:PHASE3_BASE_URL -and $env:PHASE3_BASE_URL -notin @("http://127.0.0.1:3100", "http://127.0.0.1:3200")) {
    throw "Phase 3 validation base URL must use the harness-owned port 3100 or 3200."
}
$env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3100"
$env:PHASE3_BASE_URL = "http://127.0.0.1:3100"
$env:FOREVER_PLAYWRIGHT_EXTERNAL_SERVER = "1"
$env:FOREVER_PHASE3_PERFORMANCE_BASE_URL = "http://127.0.0.1:3200"
$productionPort = 3200
if (-not $env:GM_USERNAME) { $env:GM_USERNAME = "kato" }
if (-not $env:GM_PASSWORD) { $env:GM_PASSWORD = "development-captain-only" }
if (-not $env:PLAYER_ACCESS_CODE) { $env:PLAYER_ACCESS_CODE = "development-moonwake" }
$env:VALIDATION_ARTIFACTS = Join-Path $runtimeRoot "artifacts\validation"

function Invoke-IsolationHelper {
    param([Parameter(Mandatory)][string[]]$Arguments)
    $nodeArguments = @("node_modules/tsx/dist/cli.mjs", "scripts/prepare-validation-isolation.ts") + $Arguments
    Push-Location $runtimeRoot
    try {
        $rawOutput = @(& $node @nodeArguments)
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    if ($exitCode -ne 0) {
        throw "Validation isolation helper failed with exit code $exitCode."
    }
    if ($rawOutput.Count -eq 0) { throw "Validation isolation helper returned no result." }
    return ($rawOutput[-1] | ConvertFrom-Json)
}

$seedDatabase = Assert-ValidationChildPath -Path (Join-Path $runtimeRoot "prisma\validation.db") -Label "Validation seed database"
$copyFileName = "validation-isolated-{0}-{1}.db" -f (Get-Date -Format "yyyyMMdd-HHmmssfff"), ([Guid]::NewGuid().ToString("N"))
$isolatedDatabase = Assert-ValidationChildPath -Path (Join-Path $runtimeRoot "prisma\$copyFileName") -Label "Isolated validation database"
$isolationReport = Assert-ValidationChildPath -Path (Join-Path $validationArtifacts "database-isolation-report.json") -Label "Isolation report"
if (Test-Path -LiteralPath $isolatedDatabase) { throw "Unique isolated validation database already exists." }

function Invoke-ValidationStep {
    param([Parameter(Mandatory)][string]$Name, [Parameter(Mandatory)][string[]]$Arguments)
    Write-Host "`n==> $Name" -ForegroundColor Cyan
    Invoke-ForeverNode -WorkingDirectory $runtimeRoot -Arguments $Arguments
}

function Assert-TcpPortAvailable {
    param([Parameter(Mandatory)][int]$Port)
    $listeners = @([System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object { $_.Port -eq $Port })
    if ($listeners.Count -gt 0) {
        throw "TCP port $Port already has a listener. Validation will not reuse or terminate it."
    }
}

function Get-TcpPortOwnerIds {
    param([Parameter(Mandatory)][int]$Port)
    $connections = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop)
    return @($connections | Select-Object -ExpandProperty OwningProcess -Unique)
}

function Get-ProcessIdentity {
    param([Parameter(Mandatory)][int]$ProcessId)
    $processInfo = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
    if (-not $processInfo) { return $null }
    $creationTime = if ($processInfo.CreationDate -is [DateTime]) {
        ([DateTime]$processInfo.CreationDate).ToUniversalTime()
    } else {
        try {
            [System.Management.ManagementDateTimeConverter]::ToDateTime([string]$processInfo.CreationDate).ToUniversalTime()
        } catch {
            [DateTime]::Parse([string]$processInfo.CreationDate, [System.Globalization.CultureInfo]::InvariantCulture).ToUniversalTime()
        }
    }
    return [pscustomobject]@{
        ProcessId = [int]$processInfo.ProcessId
        ParentProcessId = [int]$processInfo.ParentProcessId
        CreationTimeUtc = $creationTime.ToString("o", [System.Globalization.CultureInfo]::InvariantCulture)
        CreationTimeUtcTicks = [long]$creationTime.Ticks
        Depth = 0
    }
}

function Test-ProcessIdentityMatches {
    param([Parameter(Mandatory)]$ExpectedIdentity)
    $currentIdentity = Get-ProcessIdentity -ProcessId ([int]$ExpectedIdentity.ProcessId)
    return ($currentIdentity -and [long]$currentIdentity.CreationTimeUtcTicks -eq [long]$ExpectedIdentity.CreationTimeUtcTicks)
}

function Assert-ProcessIdentityMatches {
    param([Parameter(Mandatory)]$ExpectedIdentity, [Parameter(Mandatory)][string]$Label)
    if (-not (Test-ProcessIdentityMatches -ExpectedIdentity $ExpectedIdentity)) {
        throw "$Label process identity no longer matches its recorded PID and creation time."
    }
}

function Test-ProcessDescendsFrom {
    param([Parameter(Mandatory)][int]$ChildProcessId, [Parameter(Mandatory)][int]$AncestorProcessId)
    $currentProcessId = $ChildProcessId
    for ($depth = 0; $depth -lt 12; $depth++) {
        if ($currentProcessId -eq $AncestorProcessId) { return $true }
        $processInfo = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $currentProcessId" -ErrorAction SilentlyContinue
        if (-not $processInfo -or [int]$processInfo.ParentProcessId -le 0) { return $false }
        $currentProcessId = [int]$processInfo.ParentProcessId
    }
    return $false
}

function Get-OwnedProcessTreeSnapshot {
    param([Parameter(Mandatory)]$LauncherIdentity)
    Assert-ProcessIdentityMatches -ExpectedIdentity $LauncherIdentity -Label "Owned launcher"
    $allProcesses = @(Get-CimInstance -ClassName Win32_Process -ErrorAction Stop)
    $processesById = @{}
    foreach ($processInfo in $allProcesses) {
        $processesById[[int]$processInfo.ProcessId] = $processInfo
    }
    $depthById = @{}
    $depthById[[int]$LauncherIdentity.ProcessId] = 0
    for ($pass = 0; $pass -lt 24; $pass++) {
        $added = $false
        foreach ($processInfo in $allProcesses) {
            $processId = [int]$processInfo.ProcessId
            $parentProcessId = [int]$processInfo.ParentProcessId
            if (-not $depthById.ContainsKey($processId) -and $depthById.ContainsKey($parentProcessId)) {
                $depthById[$processId] = [int]$depthById[$parentProcessId] + 1
                $added = $true
            }
        }
        if (-not $added) { break }
    }

    return @(
        foreach ($processId in $depthById.Keys) {
            $identity = Get-ProcessIdentity -ProcessId ([int]$processId)
            if (-not $identity) { throw "Owned process $processId exited while its identity was being recorded." }
            $snapshotProcess = $processesById[[int]$processId]
            if (-not $snapshotProcess -or [int]$identity.ParentProcessId -ne [int]$snapshotProcess.ParentProcessId) {
                throw "Owned process $processId changed identity or ancestry while its tree was being recorded."
            }
            if ([int]$processId -eq [int]$LauncherIdentity.ProcessId) {
                Assert-ProcessIdentityMatches -ExpectedIdentity $LauncherIdentity -Label "Owned launcher"
            } elseif (-not (Test-ProcessDescendsFrom -ChildProcessId ([int]$processId) -AncestorProcessId ([int]$LauncherIdentity.ProcessId))) {
                throw "Owned process $processId no longer descends from its recorded launcher."
            }
            $identity.Depth = [int]$depthById[$processId]
            $identity
        }
    )
}

function Stop-OwnedProcessTree {
    param([Parameter(Mandatory)]$ServerOwnership)
    $recorded = @($ServerOwnership.ProcessIdentities)
    if (Test-ProcessIdentityMatches -ExpectedIdentity $ServerOwnership.LauncherIdentity) {
        $recorded += @(Get-OwnedProcessTreeSnapshot -LauncherIdentity $ServerOwnership.LauncherIdentity)
    }

    $unique = @{}
    foreach ($identity in $recorded) {
        $key = "$([int]$identity.ProcessId)|$([long]$identity.CreationTimeUtcTicks)"
        $unique[$key] = $identity
    }
    $ownedIdentities = @($unique.Values | Sort-Object -Property @{ Expression = { [int]$_.Depth }; Descending = $true })
    foreach ($identity in $ownedIdentities) {
        if (Test-ProcessIdentityMatches -ExpectedIdentity $identity) {
            try { Stop-Process -Id ([int]$identity.ProcessId) -Force -ErrorAction Stop }
            catch {
                if (Test-ProcessIdentityMatches -ExpectedIdentity $identity) { throw }
            }
        }
    }

    $deadline = [DateTime]::UtcNow.AddSeconds(10)
    do {
        $remaining = @($ownedIdentities | Where-Object { Test-ProcessIdentityMatches -ExpectedIdentity $_ })
        if ($remaining.Count -eq 0) { break }
        Start-Sleep -Milliseconds 200
    } while ([DateTime]::UtcNow -lt $deadline)
    if ($remaining.Count -gt 0) {
        $remainingIds = @($remaining | ForEach-Object { $_.ProcessId }) -join ", "
        throw "Explicitly owned process identities remained after termination: $remainingIds."
    }
    $allRemainingProcesses = @(Get-CimInstance -ClassName Win32_Process -ErrorAction Stop)
    $descendantIdSet = @{}
    $descendantIdSet[[int]$ServerOwnership.LauncherIdentity.ProcessId] = $true
    for ($pass = 0; $pass -lt 24; $pass++) {
        $added = $false
        foreach ($processInfo in $allRemainingProcesses) {
            $processId = [int]$processInfo.ProcessId
            if (-not $descendantIdSet.ContainsKey($processId) -and $descendantIdSet.ContainsKey([int]$processInfo.ParentProcessId)) {
                $descendantIdSet[$processId] = $true
                $added = $true
            }
        }
        if (-not $added) { break }
    }
    [void]$descendantIdSet.Remove([int]$ServerOwnership.LauncherIdentity.ProcessId)
    $remainingDescendantIds = @($descendantIdSet.Keys)
    if ($remainingDescendantIds.Count -gt 0) {
        # Next may spawn a worker between the startup snapshot and teardown.
        # These PIDs are still proven descendants of this exact launcher, so
        # terminate them before declaring cleanup incomplete.
        foreach ($processId in $remainingDescendantIds) {
            $identity = Get-ProcessIdentity -ProcessId ([int]$processId)
            if ($identity) {
                try { Stop-Process -Id ([int]$processId) -Force -ErrorAction Stop }
                catch {
                    if (Test-ProcessIdentityMatches -ExpectedIdentity $identity) { throw }
                }
            }
        }
        Start-Sleep -Milliseconds 400
        $stillRemaining = @($remainingDescendantIds | Where-Object {
            $identity = Get-ProcessIdentity -ProcessId ([int]$_)
            $null -ne $identity
        })
        if ($stillRemaining.Count -gt 0) {
            throw "Owned launcher descendants remained after termination: $($stillRemaining -join ', ')."
        }
    }
    Assert-TcpPortAvailable -Port ([int]$ServerOwnership.Port)
}

function Start-OwnedValidationServer {
    Assert-TcpPortAvailable -Port 3100
    $stdout = Join-Path $validationArtifacts "development-3100.out.log"
    $stderr = Join-Path $validationArtifacts "development-3100.err.log"
    # Keep the long-running cross-browser harness on Webpack. Next 16's default
    # Turbopack development server can invalidate chunks while WebKit is still
    # consuming them, which turns one transport failure into a matrix-wide cascade.
    $serverProcess = Start-Process -FilePath $node -ArgumentList "node_modules/next/dist/bin/next", "dev", "--webpack", "-H", "127.0.0.1", "-p", "3100" -WorkingDirectory $runtimeRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    $launcherIdentity = Get-ProcessIdentity -ProcessId $serverProcess.Id
    if (-not $launcherIdentity) { throw "Owned validation launcher identity could not be recorded." }
    $listenerProcessId = $null
    $ownership = $null
    try {
        $deadline = [DateTime]::UtcNow.AddSeconds(120)
        $identity = $null
        while ([DateTime]::UtcNow -lt $deadline) {
            if ($serverProcess.HasExited) { throw "Owned validation server exited before identity verification." }
            try {
                $identity = Invoke-RestMethod -Uri "http://127.0.0.1:3100/api/dev/validation/database-identity" -Method Get -TimeoutSec 3
                if ($identity.validationDatabase -eq $true -and $identity.nonceMatch -eq $true) { break }
                $identity = $null
            } catch {
                $identity = $null
            }
            Start-Sleep -Milliseconds 250
        }
        if (-not $identity) { throw "Owned validation server did not prove the isolated database identity." }

        $ownerIds = @(Get-TcpPortOwnerIds -Port 3100)
        if ($ownerIds.Count -ne 1) {
            throw "Port 3100 does not have exactly one listener owner."
        }
        $listenerProcessId = [int]$ownerIds[0]
        Assert-ProcessIdentityMatches -ExpectedIdentity $launcherIdentity -Label "Owned validation launcher"
        if (-not (Test-ProcessDescendsFrom -ChildProcessId $listenerProcessId -AncestorProcessId $serverProcess.Id)) {
            throw "Port 3100 listener is not owned by the process tree started by validation."
        }
        $listenerIdentity = Get-ProcessIdentity -ProcessId $listenerProcessId
        if (-not $listenerIdentity) { throw "Port 3100 listener identity could not be recorded." }
        $processIdentities = @(Get-OwnedProcessTreeSnapshot -LauncherIdentity $launcherIdentity)
        $recordedListener = @($processIdentities | Where-Object {
            [int]$_.ProcessId -eq [int]$listenerIdentity.ProcessId -and
            [long]$_.CreationTimeUtcTicks -eq [long]$listenerIdentity.CreationTimeUtcTicks
        })
        if ($recordedListener.Count -ne 1) { throw "Port 3100 listener was not present in the recorded owned process tree." }
        $ownership = [pscustomobject]@{
            Port = 3100
            LauncherIdentity = $launcherIdentity
            ListenerIdentity = $listenerIdentity
            ProcessIdentities = $processIdentities
        }

        [void](Invoke-IsolationHelper -Arguments @(
            "record-server",
            "--report", $isolationReport,
            "--copy-db", $isolatedDatabase,
            "--server-pid", "$listenerProcessId",
            "--launcher-pid", "$($launcherIdentity.ProcessId)",
            "--launcher-creation-utc", $launcherIdentity.CreationTimeUtc,
            "--listener-creation-utc", $listenerIdentity.CreationTimeUtc,
            "--ancestry-verified", "true",
            "--port", "3100",
            "--nonce-hash", $env:FOREVER_VALIDATION_NONCE_HASH
        ))
        [void](Invoke-IsolationHelper -Arguments @(
            "record-identity",
            "--report", $isolationReport,
            "--nonce-hash", $env:FOREVER_VALIDATION_NONCE_HASH
        ))
        return $ownership
    } catch {
        $startFailure = $_.Exception
        $partialOwnership = if ($ownership) { $ownership } else {
            [pscustomobject]@{
                Port = 3100
                LauncherIdentity = $launcherIdentity
                ListenerIdentity = $null
                ProcessIdentities = @($launcherIdentity)
            }
        }
        try { Stop-OwnedProcessTree -ServerOwnership $partialOwnership }
        catch { throw [System.InvalidOperationException]::new("Validation server start failed and owned-process cleanup also failed: $($_.Exception.Message)", $startFailure) }
        throw $startFailure
    }
}

function Stop-OwnedValidationServer {
    param([Parameter(Mandatory)]$ServerOwnership)
    $identityFailure = $null
    $cleanupFailure = $null
    try {
        $activeListeners = @([System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object { $_.Port -eq [int]$ServerOwnership.Port })
        if ($activeListeners.Count -gt 0) {
            $ownerIds = @(Get-TcpPortOwnerIds -Port ([int]$ServerOwnership.Port))
            if ($ownerIds.Count -ne 1 -or [int]$ownerIds[0] -ne [int]$ServerOwnership.ListenerIdentity.ProcessId) {
                throw "Validation port listener no longer matches the explicitly owned listener PID."
            }
            Assert-ProcessIdentityMatches -ExpectedIdentity $ServerOwnership.ListenerIdentity -Label "Owned validation listener"
            if (Test-ProcessIdentityMatches -ExpectedIdentity $ServerOwnership.LauncherIdentity) {
                if (-not (Test-ProcessDescendsFrom -ChildProcessId ([int]$ServerOwnership.ListenerIdentity.ProcessId) -AncestorProcessId ([int]$ServerOwnership.LauncherIdentity.ProcessId))) {
                    throw "Owned validation listener ancestry changed before termination."
                }
            } else {
                $recordedListener = @($ServerOwnership.ProcessIdentities | Where-Object {
                    [int]$_.ProcessId -eq [int]$ServerOwnership.ListenerIdentity.ProcessId -and
                    [long]$_.CreationTimeUtcTicks -eq [long]$ServerOwnership.ListenerIdentity.CreationTimeUtcTicks -and
                    [int]$_.Depth -gt 0
                })
                if ($recordedListener.Count -ne 1) { throw "Owned validation listener lacks an unambiguous recorded ancestry proof." }
            }
        }
    } catch {
        $identityFailure = $_.Exception
    }
    try { Stop-OwnedProcessTree -ServerOwnership $ServerOwnership }
    catch { $cleanupFailure = $_.Exception }
    if ($identityFailure -and $cleanupFailure) {
        throw [System.InvalidOperationException]::new("Validation listener identity proof failed and owned-process cleanup also failed: $($cleanupFailure.Message)", $identityFailure)
    }
    if ($identityFailure) { throw $identityFailure }
    if ($cleanupFailure) { throw $cleanupFailure }
}

function Start-OwnedProductionServer {
    param([int]$Port, [string]$ArtifactLabel = "restart")
    if ($ArtifactLabel -notmatch '^[a-z0-9-]+$') { throw "Production artifact label is invalid." }
    Assert-TcpPortAvailable -Port $Port
    $stdout = Join-Path $runtimeRoot "artifacts\validation\production-$Port-$ArtifactLabel.out.log"
    $stderr = Join-Path $runtimeRoot "artifacts\validation\production-$Port-$ArtifactLabel.err.log"
    New-Item -ItemType Directory -Path (Split-Path $stdout) -Force | Out-Null
    $launcherProcess = Start-Process -FilePath $node -ArgumentList "node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "$Port" -WorkingDirectory $runtimeRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    $launcherIdentity = Get-ProcessIdentity -ProcessId $launcherProcess.Id
    if (-not $launcherIdentity) { throw "Owned production launcher identity could not be recorded." }
    $ownership = [pscustomobject]@{
        Port = $Port
        LauncherIdentity = $launcherIdentity
        ListenerIdentity = $null
        ProcessIdentities = @($launcherIdentity)
    }
    try {
        $deadline = [DateTime]::UtcNow.AddSeconds(45)
        $databaseIdentity = $null
        while ([DateTime]::UtcNow -lt $deadline) {
            if ($launcherProcess.HasExited) { throw "Owned production server exited before identity verification." }
            try {
                $databaseIdentity = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/dev/validation/database-identity" -Method Get -TimeoutSec 3
                if ($databaseIdentity.validationDatabase -eq $true -and $databaseIdentity.nonceMatch -eq $true) { break }
                $databaseIdentity = $null
            } catch {
                $databaseIdentity = $null
            }
            Start-Sleep -Milliseconds 250
        }
        if (-not $databaseIdentity) { throw "Owned production server did not prove the isolated database identity." }

        Assert-ProcessIdentityMatches -ExpectedIdentity $launcherIdentity -Label "Owned production launcher"
        $ownerIds = @(Get-TcpPortOwnerIds -Port $Port)
        if ($ownerIds.Count -ne 1) { throw "Port $Port does not have exactly one listener owner." }
        $listenerProcessId = [int]$ownerIds[0]
        if (-not (Test-ProcessDescendsFrom -ChildProcessId $listenerProcessId -AncestorProcessId $launcherIdentity.ProcessId)) {
            throw "Port $Port listener is not owned by the production process tree started by validation."
        }
        $listenerIdentity = Get-ProcessIdentity -ProcessId $listenerProcessId
        if (-not $listenerIdentity) { throw "Port $Port listener identity could not be recorded." }
        $processIdentities = @(Get-OwnedProcessTreeSnapshot -LauncherIdentity $launcherIdentity)
        $recordedListener = @($processIdentities | Where-Object {
            [int]$_.ProcessId -eq [int]$listenerIdentity.ProcessId -and
            [long]$_.CreationTimeUtcTicks -eq [long]$listenerIdentity.CreationTimeUtcTicks
        })
        if ($recordedListener.Count -ne 1) { throw "Port $Port listener was not present in the recorded owned process tree." }
        $ownership.ListenerIdentity = $listenerIdentity
        $ownership.ProcessIdentities = $processIdentities

        $showcaseStatus = 0
        try {
            $showcaseResponse = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/dev/animations" -UseBasicParsing -TimeoutSec 10
            $showcaseStatus = [int]$showcaseResponse.StatusCode
        } catch {
            if ($_.Exception.Response) { $showcaseStatus = [int]$_.Exception.Response.StatusCode }
            else { throw }
        }
        if ($showcaseStatus -ne 404) { throw "Development animation showcase returned HTTP $showcaseStatus in production." }

        [void](Invoke-IsolationHelper -Arguments @(
            "verify-canonical",
            "--canonical-db", $canonicalDatabase,
            "--canonical-family-base64", $canonicalFamilyBase64
        ))
        return $ownership
    } catch {
        $startFailure = $_.Exception
        try { Stop-OwnedProcessTree -ServerOwnership $ownership }
        catch {
            throw [System.InvalidOperationException]::new("Production server start failed and owned-process cleanup also failed: $($_.Exception.Message)", $startFailure)
        }
        throw $startFailure
    }
}

function Test-ProductionStart {
    param([int]$Port)
    $ownership = Start-OwnedProductionServer -Port $Port
    $testFailure = $null
    try { Stop-OwnedValidationServer -ServerOwnership $ownership }
    catch { $testFailure = $_.Exception }
    if ($testFailure) { throw $testFailure }
    Assert-TcpPortAvailable -Port $Port
}

$prepareAttempted = $false
$validationFailure = $null
$finalizationFailures = @()
$ownedValidationServer = $null
$ownedProductionServer = $null
$playwrightInvoked = $false
$defaultBrowserSucceeded = $false
$productionPerformanceSucceeded = $false
$browserSucceeded = $false
try {
    Write-Host "`n==> Preparing isolated validation database" -ForegroundColor Cyan
    $prepareAttempted = $true
    $isolation = Invoke-IsolationHelper -Arguments @(
        "prepare",
        "--runtime-root", $runtimeRoot,
        "--seed-db", $seedDatabase,
        "--copy-db", $isolatedDatabase,
        "--canonical-db", $canonicalDatabase,
        "--canonical-sha256", $canonicalSha256,
        "--canonical-size", "$canonicalSize",
        "--canonical-mtime-iso", $canonicalMtimeIso,
        "--canonical-family-base64", $canonicalFamilyBase64,
        "--report", $isolationReport
    )
    if ($isolation.copyFileName -ne $copyFileName) { throw "Isolation helper returned an unexpected database filename." }
    if ($isolation.nonceHash -notmatch '^[a-f0-9]{64}$') { throw "Isolation helper returned an invalid nonce hash." }
    $expectedDatabaseUrl = "file:" + $isolatedDatabase.Replace('\', '/')
    if ([string]$isolation.databaseUrl -ne $expectedDatabaseUrl) { throw "Isolation helper did not return the exact absolute Prisma file URL." }
    $env:DATABASE_URL = [string]$isolation.databaseUrl
    $env:FOREVER_VALIDATION_ISOLATION = "1"
    $env:FOREVER_VALIDATION_NONCE_HASH = [string]$isolation.nonceHash

    if (-not $SkipBrowserInstall) {
        Invoke-ValidationStep -Name "Installing Playwright browsers" -Arguments @("node_modules/playwright/cli.js", "install", "chromium", "webkit")
    }
    Invoke-ValidationStep -Name "Checking formatting" -Arguments @("node_modules/prettier/bin/prettier.cjs", "--check", ".")
    Invoke-ValidationStep -Name "Linting" -Arguments @("node_modules/eslint/bin/eslint.js", ".")
    Invoke-ValidationStep -Name "Type checking" -Arguments @("node_modules/typescript/bin/tsc", "--noEmit")
    Invoke-ValidationStep -Name "Validating Voyagewright product language" -Arguments @("node_modules/tsx/dist/cli.mjs", "scripts/validate-user-facing-language.ts")
    Invoke-ValidationStep -Name "Running unit tests" -Arguments @("node_modules/vitest/vitest.mjs", "run")
    Invoke-ValidationStep -Name "Validating animation assets" -Arguments @("node_modules/tsx/dist/cli.mjs", "scripts/validate-animation-assets.ts")
    Invoke-ValidationStep -Name "Verifying seeded database" -Arguments @("node_modules/tsx/dist/cli.mjs", "scripts/verify-database.ts")
    Invoke-ValidationStep -Name "Migrating legacy Companion compatibility projection" -Arguments @(
        "node_modules/tsx/dist/cli.mjs",
        "scripts/migrate-legacy-companion.ts"
    )
    Invoke-ValidationStep -Name "Verifying legacy Companion compatibility projection" -Arguments @(
        "node_modules/tsx/dist/cli.mjs",
        "scripts/migrate-legacy-companion.ts",
        "--verify"
    )
    Invoke-ValidationStep -Name "Preparing legacy playthrough backfill proof" -Arguments @("node_modules/tsx/dist/cli.mjs", "scripts/verify-platform-backfill.ts", "--prepare")
    Invoke-ValidationStep -Name "Running additive platform backfill" -Arguments @("node_modules/tsx/dist/cli.mjs", "prisma/seed.ts", "--ensure")
    Invoke-ValidationStep -Name "Verifying additive platform backfill" -Arguments @("node_modules/tsx/dist/cli.mjs", "scripts/verify-platform-backfill.ts", "--verify")
    [void](Invoke-IsolationHelper -Arguments @("checkpoint", "--report", $isolationReport, "--copy-db", $isolatedDatabase))

    Write-Host "`n==> Starting owned isolated validation server" -ForegroundColor Cyan
    $ownedValidationServer = Start-OwnedValidationServer
    $playwrightInvoked = $true
    $browserCommand = @("node_modules/playwright/cli.js", "test") + $BrowserArgs
    if ($BrowserGrep) { $browserCommand += @("--grep", $BrowserGrep) }
    Invoke-ValidationStep -Name "Running browser acceptance tests" -Arguments $browserCommand
    Stop-OwnedValidationServer -ServerOwnership $ownedValidationServer
    $ownedValidationServer = $null
    Assert-TcpPortAvailable -Port 3100
    $defaultBrowserSucceeded = $true

    if ($SkipProductionPerformance) {
        $browserSucceeded = $defaultBrowserSucceeded
        Write-Host "`n==> Production performance and restart gates skipped for this focused browser repair run" -ForegroundColor Yellow
        return
    }

    Invoke-ValidationStep -Name "Verifying accepted database state" -Arguments @("node_modules/tsx/dist/cli.mjs", "scripts/verify-database.ts", "--acceptance")
    Invoke-ValidationStep -Name "Proving launcher seed preserves accepted progress" -Arguments @("node_modules/tsx/dist/cli.mjs", "prisma/seed.ts", "--ensure")
    Invoke-ValidationStep -Name "Rechecking preserved database state" -Arguments @("node_modules/tsx/dist/cli.mjs", "scripts/verify-database.ts", "--acceptance")
    Invoke-ValidationStep -Name "Creating production build" -Arguments @("node_modules/next/dist/bin/next", "build")

    Write-Host "`n==> Starting owned production performance server" -ForegroundColor Cyan
    $env:FOREVER_VALIDATION_PRODUCTION_IDENTITY = "1"
    $env:PHASE3_BASE_URL = "http://127.0.0.1:$productionPort"
    $ownedProductionServer = Start-OwnedProductionServer -Port $productionPort -ArtifactLabel "performance"
    Invoke-ValidationStep -Name "Running Chromium production performance gates" -Arguments @(
        "node_modules/playwright/cli.js",
        "test",
        "--config=playwright.phase3-performance.config.ts"
    )
    [void](Invoke-IsolationHelper -Arguments @(
        "verify-canonical",
        "--canonical-db", $canonicalDatabase,
        "--canonical-family-base64", $canonicalFamilyBase64
    ))
    Stop-OwnedValidationServer -ServerOwnership $ownedProductionServer
    $ownedProductionServer = $null
    Assert-TcpPortAvailable -Port $productionPort
    $productionPerformanceSucceeded = $true

    Write-Host "`n==> Proving the second production restart" -ForegroundColor Cyan
    Test-ProductionStart -Port $productionPort
    $browserSucceeded = $defaultBrowserSucceeded -and $productionPerformanceSucceeded
    if (-not $browserSucceeded) { throw "Browser validation success state is incomplete." }
} catch {
    $validationFailure = $_.Exception
} finally {
    if ($ownedValidationServer) {
        try { Stop-OwnedValidationServer -ServerOwnership $ownedValidationServer }
        catch { $finalizationFailures += "Owned validation server cleanup failed: $($_.Exception.Message)" }
    }
    if ($ownedProductionServer) {
        try { Stop-OwnedValidationServer -ServerOwnership $ownedProductionServer }
        catch { $finalizationFailures += "Owned production server cleanup failed: $($_.Exception.Message)" }
    }
    foreach ($port in @(3100, 3200)) {
        try { Assert-TcpPortAvailable -Port $port }
        catch { $finalizationFailures += "Port $port release proof failed: $($_.Exception.Message)" }
    }
    if ($prepareAttempted) {
        try {
            [void](Invoke-IsolationHelper -Arguments @(
                "verify-canonical",
                "--canonical-db", $canonicalDatabase,
                "--canonical-family-base64", $canonicalFamilyBase64
            ))
        } catch {
            $finalizationFailures += "Canonical SQLite family final verification failed: $($_.Exception.Message)"
        }
        if ((Test-Path -LiteralPath $isolationReport -PathType Leaf) -and (Test-Path -LiteralPath $isolatedDatabase -PathType Leaf)) {
            try {
                $reportedBrowserSucceeded = $browserSucceeded -and
                    ($null -eq $validationFailure) -and
                    ($finalizationFailures.Count -eq 0)
                [void](Invoke-IsolationHelper -Arguments @(
                    "verify",
                    "--report", $isolationReport,
                    "--copy-db", $isolatedDatabase,
                    "--canonical-db", $canonicalDatabase,
                    "--expect-mutation", $playwrightInvoked.ToString().ToLowerInvariant(),
                    "--browser-succeeded", $reportedBrowserSucceeded.ToString().ToLowerInvariant()
                ))
            } catch {
                $finalizationFailures += "Isolation report final verification failed: $($_.Exception.Message)"
            }
        }
    }
}

if ($validationFailure -and $finalizationFailures.Count -gt 0) {
    throw [System.InvalidOperationException]::new("Validation failed: $($validationFailure.Message) Finalization also failed: $($finalizationFailures -join '; ')", $validationFailure)
}
if ($validationFailure) { throw $validationFailure }
if ($finalizationFailures.Count -gt 0) { throw "Validation finalization failed: $($finalizationFailures -join '; ')" }
Write-Host "`nFull validation passed. Reports and screenshots: $env:VALIDATION_ARTIFACTS" -ForegroundColor Green
