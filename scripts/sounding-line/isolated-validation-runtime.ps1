# .SYNOPSIS
# Runs the internal isolated browser runtime selected by Sounding Line.
#
# .DESCRIPTION
# When a dedicated worktree has no canonical prisma/dev.db, provide an
# existing absolute baseline path. The baseline is fingerprinted before and
# after the run and is never used as the mutable validation database.
param(
    [switch]$SkipBrowserInstall,
    [string]$BaselineDatabasePath,
    [switch]$BrowserOnly,
    [switch]$SkipBrowser,
    [string]$BrowserTestPath,
    [string[]]$BrowserArgs = @(),
    [string]$BrowserArgsBase64 = "",
    [string]$BrowserSelectionsBase64 = "",
    [string]$ExpectMutation = "true",
    [string]$BrowserGrep = "",
    [switch]$SkipProductionPerformance,
    [string]$SoundingLineLane = "",
    [int]$SoundingLinePort = 0
)
$ErrorActionPreference = "Stop"
if ($env:SOUNDING_LINE_INTERNAL_RUNTIME -ne "1") {
    throw "This runtime can only be launched by a Sounding Line adapter."
}
if ($BrowserArgsBase64 -and $BrowserSelectionsBase64) { throw "BrowserArgsBase64 and BrowserSelectionsBase64 cannot be combined." }
if ($BrowserArgsBase64) {
    if ($BrowserArgs.Count -gt 0) { throw "BrowserArgs and BrowserArgsBase64 cannot be combined." }
    try {
        $decodedBrowserArgs = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($BrowserArgsBase64)) | ConvertFrom-Json
    } catch {
        throw "BrowserArgsBase64 is not valid UTF-8 JSON."
    }
    if ($decodedBrowserArgs -isnot [System.Array] -or @($decodedBrowserArgs | Where-Object { $_ -isnot [string] }).Count -gt 0) {
        throw "BrowserArgsBase64 must decode to a JSON array of strings."
    }
    $BrowserArgs = [string[]]$decodedBrowserArgs
}
$BrowserSelections = @()
if ($BrowserSelectionsBase64) {
    if ($BrowserArgs.Count -gt 0) { throw "BrowserArgs and BrowserSelectionsBase64 cannot be combined." }
    try {
        $decodedBrowserSelections = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($BrowserSelectionsBase64)) | ConvertFrom-Json
    } catch {
        throw "BrowserSelectionsBase64 is not valid UTF-8 JSON."
    }
    $BrowserSelections = @($decodedBrowserSelections)
    if ($BrowserSelections.Count -eq 0) { throw "BrowserSelectionsBase64 must decode to a non-empty JSON array." }
    foreach ($selection in $BrowserSelections) {
        if ($null -eq $selection -or
            $selection.project -isnot [string] -or $selection.project -notmatch '^[a-z][a-z0-9-]{0,80}$' -or
            @($selection.files).Count -eq 0 -or
            @($selection.files | Where-Object { $_ -isnot [string] -or $_.Replace('\\', '/') -notmatch '^tests/e2e/[A-Za-z0-9._/-]+\.(?:spec|setup)\.ts$' }).Count -gt 0 -or
            $selection.grep -isnot [string] -or [string]::IsNullOrWhiteSpace($selection.grep) -or
            ([string]$selection.caseCount) -notmatch '^[1-9][0-9]*$') {
            throw "BrowserSelectionsBase64 contains an invalid governed browser selection."
        }
    }
}
if ($ExpectMutation -notin @("true", "false")) { throw "ExpectMutation must be true or false." }
if (-not $SoundingLineLane) {
    throw "This internal runtime only supports named Sounding Line browser lanes."
}

# Do not depend on Get-FileHash being imported into the runner's PowerShell
# session. The isolated boundary and its shared bootstrap must compute the
# same SHA-256 proof on both Windows PowerShell and PowerShell Core runners.
function Get-SoundingLineSha256 {
    param([Parameter(Mandatory)][string]$LiteralPath)
    $stream = [System.IO.File]::Open($LiteralPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
    try {
        $hasher = [System.Security.Cryptography.SHA256]::Create()
        try {
            return ([System.BitConverter]::ToString($hasher.ComputeHash($stream))).Replace("-", "").ToLowerInvariant()
        } finally {
            $hasher.Dispose()
        }
    } finally {
        $stream.Dispose()
    }
}
if (-not (Get-Command -Name Get-FileHash -ErrorAction SilentlyContinue)) {
    function Get-FileHash {
        param(
            [Parameter(Mandatory)][string]$LiteralPath,
            [string]$Algorithm = "SHA256"
        )
        if ($Algorithm -ne "SHA256") { throw "Only SHA256 is supported by the Sounding Line compatibility hash provider." }
        [pscustomobject]@{
            Algorithm = $Algorithm
            Hash = Get-SoundingLineSha256 -LiteralPath $LiteralPath
            Path = $LiteralPath
        }
    }
}
. (Join-Path $PSScriptRoot "..\dev-common.ps1")

# This opt-in is intentionally narrower than the legacy harness.  It exists
# only for the two, explicitly named, Sounding Line Harborlight browser lanes;
# every ordinary invocation keeps the historical global lock and port 3100.
$isSoundingLineLane = $SoundingLineLane -ne ""
$browserGlobalTimeoutMs = 420000
if ($isSoundingLineLane) {
    if ($SoundingLineLane -notin @("harborlight-a", "harborlight-b", "browser-family")) {
        throw "SoundingLineLane must be harborlight-a, harborlight-b, or browser-family."
    }
    if ($SoundingLineLane -in @("harborlight-a", "harborlight-b") -and
        (-not $BrowserOnly -or -not $BrowserTestPath -or $BrowserTestPath.Replace('\', '/') -ne "tests/e2e/harborlight-phase4.spec.ts")) {
        throw "Sounding Line lanes are limited to BrowserOnly Harborlight Phase 4 acceptance."
    }
    if ($SoundingLineLane -eq "browser-family") {
        if (-not $BrowserOnly -or $BrowserTestPath -or ($BrowserArgs.Count -eq 0 -and $BrowserSelections.Count -eq 0)) {
            throw "browser-family requires BrowserOnly and registry-selected browser arguments without BrowserTestPath."
        }
        foreach ($browserArgument in $BrowserArgs) {
            $normalizedArgument = $browserArgument.Replace('\', '/')
            if ($normalizedArgument -notmatch '^--project=[a-z][a-z0-9-]{0,80}$' -and
                $normalizedArgument -notmatch '^tests/e2e/[A-Za-z0-9._/-]+\.spec\.ts$') {
                throw "browser-family BrowserArgs must be a governed Playwright project or e2e spec path."
            }
        }
    }
    if (($SoundingLineLane -eq "browser-family" -and $SoundingLinePort -ne 3100) -or
        ($SoundingLineLane -ne "browser-family" -and ($SoundingLinePort -lt 3101 -or $SoundingLinePort -gt 3199))) {
        throw "browser-family must own loopback port 3100; named Harborlight lanes must own ports 3101 through 3199."
    }
    if ($env:SOUNDING_LINE_SUITE_HARD_BUDGET_MS) {
        $suiteHardBudgetMs = 0
        if (-not [int]::TryParse($env:SOUNDING_LINE_SUITE_HARD_BUDGET_MS, [ref]$suiteHardBudgetMs) -or $suiteHardBudgetMs -lt 180000) {
            throw "SOUNDING_LINE_SUITE_HARD_BUDGET_MS must be an integer of at least 180000."
        }
        # Retain two minutes for owned server teardown, isolation verification,
        # and receipt emission; the adapter remains the hard authority deadline.
        $browserGlobalTimeoutMs = [Math]::Max(60000, $suiteHardBudgetMs - 120000)
    }
} elseif ($SoundingLinePort -ne 0) {
    throw "SoundingLinePort requires a named SoundingLineLane."
}
$validationServerPort = if ($isSoundingLineLane) { $SoundingLinePort } else { 3100 }

if ($BrowserOnly -and $SkipBrowser) {
    throw "BrowserOnly and SkipBrowser cannot be used together."
}
if ($SkipBrowser -and ($BrowserTestPath -or $BrowserGrep -or $BrowserArgs.Count -gt 0 -or $BrowserSelections.Count -gt 0)) {
    throw "SkipBrowser cannot be combined with targeted browser selection."
}

$validationLockDirectory = Join-Path $env:LOCALAPPDATA "ForeverTreasureCompanion"
[System.IO.Directory]::CreateDirectory($validationLockDirectory) | Out-Null
$validationLockName = if ($SoundingLineLane -in @("harborlight-a", "harborlight-b")) { "validation-runtime-$SoundingLineLane.lock" } else { "validation-runtime.lock" }
$validationLockPath = Join-Path $validationLockDirectory $validationLockName
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

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
if ($BrowserTestPath) {
    $resolvedBrowserTestPath = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $BrowserTestPath))
    $e2eRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot "tests\e2e"))
    $e2ePrefix = $e2eRoot.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    if (-not $resolvedBrowserTestPath.StartsWith($e2ePrefix, [System.StringComparison]::OrdinalIgnoreCase) -or
        -not (Test-Path -LiteralPath $resolvedBrowserTestPath -PathType Leaf)) {
        throw "BrowserTestPath must identify an existing test file under tests/e2e."
    }
    $projectPrefix = $projectRoot.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    if (-not $resolvedBrowserTestPath.StartsWith($projectPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "BrowserTestPath must remain inside the active project root."
    }
    $runtimeRelativeBrowserTestPath = $resolvedBrowserTestPath.Substring($projectPrefix.Length)
    $browserTestProject = switch ([System.IO.Path]::GetFileName($runtimeRelativeBrowserTestPath)) {
        "harborlight-phase2.spec.ts" { "harborlight-phase2"; break }
        "harborlight-phase3.spec.ts" { "harborlight-phase3"; break }
        "harborlight-phase4.spec.ts" { "harborlight-phase4"; break }
        default { throw "BrowserTestPath must identify a governed Harborlight browser suite." }
    }
}
if ($BaselineDatabasePath) {
    if (-not ($BaselineDatabasePath -match '^[A-Za-z]:[\\/]' -or $BaselineDatabasePath.StartsWith('\\'))) {
        throw "BaselineDatabasePath must be an absolute database file path."
    }
    $canonicalDatabase = [System.IO.Path]::GetFullPath($BaselineDatabasePath)
    if (-not (Test-Path -LiteralPath $canonicalDatabase)) {
        throw "BaselineDatabasePath must identify an existing database file."
    }
    if ((Get-Item -LiteralPath $canonicalDatabase).PSIsContainer) {
        throw "BaselineDatabasePath must identify a file, not a directory."
    }
    $baselineSource = "explicit-external"
} else {
    $canonicalDatabase = Get-ForeverCanonicalDatabase
    $baselineSource = "auto-discovered"
}

function Get-CanonicalDatabaseFamilyFingerprint {
    $members = @(
        foreach ($suffix in @("", "-wal", "-shm", "-journal")) {
            $memberPath = "$canonicalDatabase$suffix"
            if (Test-Path -LiteralPath $memberPath -PathType Leaf) {
                $memberItem = Get-Item -LiteralPath $memberPath
                [pscustomobject]@{
                    fileName = [System.IO.Path]::GetFileName($memberPath)
                    present = $true
                    sha256 = Get-SoundingLineSha256 -LiteralPath $memberPath
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
if ($env:PLAYWRIGHT_BASE_URL -and $env:PLAYWRIGHT_BASE_URL -ne "http://127.0.0.1:$validationServerPort") {
    throw "Validation requires PLAYWRIGHT_BASE_URL=http://127.0.0.1:$validationServerPort."
}
if ($env:FOREVER_VALIDATION_PRODUCTION_PORT -and [int]$env:FOREVER_VALIDATION_PRODUCTION_PORT -ne 3200) {
    throw "Production restart validation is serialized on port 3200."
}
if ($env:FOREVER_PHASE3_PERFORMANCE_BASE_URL -and $env:FOREVER_PHASE3_PERFORMANCE_BASE_URL -ne "http://127.0.0.1:3200") {
    throw "Phase 3 production performance requires http://127.0.0.1:3200."
}
if ($env:PHASE3_BASE_URL -and $env:PHASE3_BASE_URL -notin @("http://127.0.0.1:$validationServerPort", "http://127.0.0.1:3200")) {
    throw "Phase 3 validation base URL must use the harness-owned port 3100 or 3200."
}
$env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:$validationServerPort"
$env:PHASE3_BASE_URL = "http://127.0.0.1:$validationServerPort"
$env:FOREVER_PLAYWRIGHT_EXTERNAL_SERVER = "1"
$env:FOREVER_SOUNDING_LINE_LANE = if ($isSoundingLineLane) { $SoundingLineLane } else { "" }
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
$runtimeBrowserTestPath = if ($BrowserTestPath) {
    Assert-ValidationChildPath -Path (Join-Path $runtimeRoot $runtimeRelativeBrowserTestPath) -Label "Runtime browser test"
}
if ($BrowserTestPath -and -not (Test-Path -LiteralPath $runtimeBrowserTestPath -PathType Leaf)) {
    throw "BrowserTestPath was not synchronized into the task-owned validation runtime."
}
if (Test-Path -LiteralPath $isolatedDatabase) { throw "Unique isolated validation database already exists." }
if ([System.StringComparer]::OrdinalIgnoreCase.Equals($canonicalDatabase, $isolatedDatabase)) {
    throw "BaselineDatabasePath must not identify the isolated mutation database."
}
# The runtime's bootstrap database proves migration/seed reproducibility, but
# browser families must begin from the stable, caller-approved canonical
# baseline (including its compatibility projection).  Only the task-owned
# seed file is replaced; the canonical source remains read-only and is
# fingerprinted again during finalization.
Remove-Item -LiteralPath $seedDatabase -Force
Copy-Item -LiteralPath $canonicalDatabase -Destination $seedDatabase -ErrorAction Stop

function Invoke-ValidationStep {
    param([Parameter(Mandatory)][string]$Name, [Parameter(Mandatory)][string[]]$Arguments)
    Write-Host "`n==> $Name" -ForegroundColor Cyan
    Invoke-ForeverNode -WorkingDirectory $runtimeRoot -Arguments $Arguments
}

function Assert-BrowserSelectionDiscovery {
    param([Parameter(Mandatory)]$Selection)
    $arguments = @("node_modules/playwright/cli.js", "test", "--list", "--project=$($Selection.project)", "--grep", [string]$Selection.grep) + @($Selection.files | ForEach-Object { ([string]$_).Replace('\\', '/') })
    Write-Host "`n==> Discovering exact governed browser selection for $($Selection.project)" -ForegroundColor Cyan
    Push-Location $runtimeRoot
    try {
        $listing = @(& (Get-ForeverNode) @arguments)
        $listing | Out-Host
        if ($LASTEXITCODE -ne 0) { throw "Playwright discovery failed with exit code $LASTEXITCODE." }
    } finally {
        Pop-Location
    }
    # Match only the project envelope. The report's visual separator is
    # runner/console encoded and is not a stable machine boundary.
    $projectPattern = '^\s*\[' + [regex]::Escape([string]$Selection.project) + '\]\s+'
    $discoveredCases = @($listing | Where-Object { $_ -match $projectPattern }).Count
    if ($discoveredCases -ne [int]$Selection.caseCount) {
        throw "GOVERNED_BROWSER_DISCOVERY_MISMATCH:$($Selection.project):expected=$($Selection.caseCount):actual=$discoveredCases"
    }
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
    # The identity snapshot above is the authoritative ownership boundary.
    # Do not infer descendants again from a terminated launcher PID: Windows
    # may recycle that PID, which would misclassify an unrelated process.
    Assert-TcpPortAvailable -Port ([int]$ServerOwnership.Port)
}

function Start-OwnedValidationServer {
    Assert-TcpPortAvailable -Port $validationServerPort
    $stdout = Join-Path $validationArtifacts "development-$validationServerPort.out.log"
    $stderr = Join-Path $validationArtifacts "development-$validationServerPort.err.log"
    # Keep the long-running cross-browser harness on Webpack. Next 16's default
    # Turbopack development server can invalidate chunks while WebKit is still
    # consuming them, which turns one transport failure into a matrix-wide cascade.
    $serverProcess = Start-Process -FilePath $node -ArgumentList "node_modules/next/dist/bin/next", "dev", "--webpack", "-H", "127.0.0.1", "-p", "$validationServerPort" -WorkingDirectory $runtimeRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    $launcherIdentity = Get-ProcessIdentity -ProcessId $serverProcess.Id
    if (-not $launcherIdentity) { throw "Owned validation launcher identity could not be recorded." }
    $listenerProcessId = $null
    $ownership = $null
    try {
        $deadline = [DateTime]::UtcNow.AddSeconds(120)
        $identity = $null
        $lastIdentityProbe = "no-response"
        while ([DateTime]::UtcNow -lt $deadline) {
            if ($serverProcess.HasExited) { throw "Owned validation server exited before identity verification." }
            try {
                $identity = Invoke-RestMethod -Uri "http://127.0.0.1:$validationServerPort/api/dev/validation/database-identity" -Method Get -TimeoutSec 3
                $lastIdentityProbe = "status=200; validationDatabase=$($identity.validationDatabase); nonceMatch=$($identity.nonceMatch)"
                if ($identity.validationDatabase -eq $true -and $identity.nonceMatch -eq $true) { break }
                $identity = $null
            } catch {
                $statusCode = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { "unavailable" }
                $lastIdentityProbe = "status=$statusCode"
                $identity = $null
            }
            Start-Sleep -Milliseconds 250
        }
        if (-not $identity) {
            $serverErrorTail = if (Test-Path -LiteralPath $stderr) {
                ((Get-Content -LiteralPath $stderr -Tail 24 -ErrorAction SilentlyContinue) -join "`n").Trim()
            } else { "server-stderr-unavailable" }
            throw "Owned validation server did not prove the isolated database identity. Last identity probe: $lastIdentityProbe. Server stderr tail: $serverErrorTail"
        }

        $ownerIds = @(Get-TcpPortOwnerIds -Port $validationServerPort)
        if ($ownerIds.Count -ne 1) {
            throw "Port $validationServerPort does not have exactly one listener owner."
        }
        $listenerProcessId = [int]$ownerIds[0]
        Assert-ProcessIdentityMatches -ExpectedIdentity $launcherIdentity -Label "Owned validation launcher"
        if (-not (Test-ProcessDescendsFrom -ChildProcessId $listenerProcessId -AncestorProcessId $serverProcess.Id)) {
            throw "Port $validationServerPort listener is not owned by the process tree started by validation."
        }
        $listenerIdentity = Get-ProcessIdentity -ProcessId $listenerProcessId
        if (-not $listenerIdentity) { throw "Port $validationServerPort listener identity could not be recorded." }
        $processIdentities = @(Get-OwnedProcessTreeSnapshot -LauncherIdentity $launcherIdentity)
        $recordedListener = @($processIdentities | Where-Object {
            [int]$_.ProcessId -eq [int]$listenerIdentity.ProcessId -and
            [long]$_.CreationTimeUtcTicks -eq [long]$listenerIdentity.CreationTimeUtcTicks
        })
        if ($recordedListener.Count -ne 1) { throw "Port $validationServerPort listener was not present in the recorded owned process tree." }
        $ownership = [pscustomobject]@{
            Port = $validationServerPort
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
            "--port", "$validationServerPort",
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
                Port = $validationServerPort
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
        "--baseline-source", $baselineSource,
        "--report", $isolationReport
    )
    if ($isolation.copyFileName -ne $copyFileName) { throw "Isolation helper returned an unexpected database filename." }
    if ($isolation.nonceHash -notmatch '^[a-f0-9]{64}$') { throw "Isolation helper returned an invalid nonce hash." }
    $expectedDatabaseUrl = "file:" + $isolatedDatabase.Replace('\', '/')
    if ([string]$isolation.databaseUrl -ne $expectedDatabaseUrl) { throw "Isolation helper did not return the exact absolute Prisma file URL." }
    $env:DATABASE_URL = [string]$isolation.databaseUrl
    $env:FOREVER_VALIDATION_ISOLATION = "1"
    $env:FOREVER_VALIDATION_NONCE_HASH = [string]$isolation.nonceHash
    # This provider can be selected only after the nonce-bound isolated copy has
    # been created. Production and ordinary development retain fail-closed
    # scanner behavior because neither marker is present there.
    $env:NODE_ENV = "test"
    $env:FOREVER_VALIDATION_NODE_ENV = "test"
    $env:COMMUNITY_BINARY_SCANNER_PROVIDER = "synthetic-test"
    # This ephemeral validation-only key permits the simulator fixture to
    # exercise encrypted provider-token storage. It is never used by ordinary
    # development or production servers and is removed before the build proof.
    $env:WAYFARER_PROVIDER_TOKEN_KEY = "validation-only-provider-token-key"
    # Project One Voyage's retained doorway needs a synthetic credential that
    # exists only in the nonce-bound validation process and database copy.
    $env:PHASE2_LEGACY_ACCESS_CODE = "phase2-validation-legacy-access-code"
    # Sealed Hold browser coverage uses a separate, task-owned provider root
    # and a fixed validation-only key. This prevents a local .env file from
    # selecting a relative or user-owned provider directory.
    $privateProviderParent = [System.IO.Path]::GetFullPath($validationLockDirectory)
    $privateProviderRoot = [System.IO.Path]::GetFullPath(
        (Join-Path $privateProviderParent ("validation-private-provider-" + $isolation.nonceHash.Substring(0, 16)))
    )
    $privateProviderPrefix = $privateProviderParent.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    if (-not $privateProviderRoot.StartsWith($privateProviderPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Private provider root escaped the validation parent."
    }
    New-Item -ItemType Directory -Path $privateProviderRoot -Force | Out-Null
    $env:PRIVATE_CONTENT_ENVIRONMENT_ID = "validation-isolated"
    $env:PRIVATE_CONTENT_ENABLED = "true"
    $env:PRIVATE_CONTENT_STORAGE_PROVIDER = "local"
    $env:PRIVATE_CONTENT_PROVIDER_ROOT = $privateProviderRoot
    $env:PRIVATE_CONTENT_SCANNER_PROVIDER = "synthetic"
    $env:PRIVATE_CONTENT_KEY_PROVIDER = "local"
    $env:PRIVATE_CONTENT_LOCAL_MASTER_KEY = "f21fc30ddbc49c5e4a31265525beb562e439bc82ce8d146d8e4df4325f517a50"
    $env:PRIVATE_CONTENT_WORKER_ENABLED = "true"
    $env:PRIVATE_CONTENT_REQUIRE_READY = "true"

    # BrowserOnly is a selected governed browser suite. Its caller has already
    # supplied the generated, migrated, seeded baseline; run only the
    # per-lane isolation and browser proof here. The broad static, unit, and
    # legacy-projection gates remain distinct plan nodes and must not be
    # silently repeated in each lane.
    if (-not $BrowserOnly) {
        if (-not $SkipBrowserInstall -and -not $SkipBrowser) {
            Invoke-ValidationStep -Name "Installing Playwright browsers" -Arguments @("node_modules/playwright/cli.js", "install", "chromium", "webkit")
        }
        Invoke-ValidationStep -Name "Validating documentation" -Arguments @("scripts/validate-documentation.mjs")
        Invoke-ValidationStep -Name "Checking formatting" -Arguments @("node_modules/prettier/bin/prettier.cjs", "--check", ".")
        Invoke-ValidationStep -Name "Linting" -Arguments @("node_modules/eslint/bin/eslint.js", ".")
        Invoke-ValidationStep -Name "Type checking" -Arguments @("node_modules/typescript/bin/tsc", "--noEmit")
        Invoke-ValidationStep -Name "Validating Voyagewright product language" -Arguments @("node_modules/tsx/dist/cli.mjs", "scripts/validate-user-facing-language.ts")
        Invoke-ValidationStep -Name "Validating completed Feature Catalog" -Arguments @("node_modules/tsx/dist/cli.mjs", "scripts/features/validate-feature-catalog.ts")
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
    }
    [void](Invoke-IsolationHelper -Arguments @("checkpoint", "--report", $isolationReport, "--copy-db", $isolatedDatabase))
    if ($BrowserOnly) {
        # Focused browser families still require canonical migration provenance
        # and the migrated Voyage fixture. Prepare both only in the disposable
        # copy before the owned server starts; this is fixture setup, not authority.
        Invoke-ValidationStep -Name "Migrating focused browser legacy compatibility projection" -Arguments @("node_modules/tsx/dist/cli.mjs", "scripts/migrate-legacy-companion.ts")
        Invoke-ValidationStep -Name "Verifying focused browser legacy compatibility projection" -Arguments @("node_modules/tsx/dist/cli.mjs", "scripts/migrate-legacy-companion.ts", "--verify")
        Invoke-ValidationStep -Name "Preparing focused browser legacy playthrough fixture" -Arguments @("node_modules/tsx/dist/cli.mjs", "scripts/verify-platform-backfill.ts", "--prepare")
        Invoke-ValidationStep -Name "Seeding focused browser legacy playthrough fixture" -Arguments @("node_modules/tsx/dist/cli.mjs", "prisma/seed.ts", "--ensure")
        Invoke-ValidationStep -Name "Verifying focused browser legacy playthrough fixture" -Arguments @("node_modules/tsx/dist/cli.mjs", "scripts/verify-platform-backfill.ts", "--verify")
    }

    if (-not $SkipBrowser) {
        Write-Host "`n==> Starting owned isolated validation server" -ForegroundColor Cyan
        $ownedValidationServer = Start-OwnedValidationServer
        $playwrightInvoked = $true
        if ($BrowserSelections.Count -gt 0) {
            foreach ($selection in $BrowserSelections) {
                Assert-BrowserSelectionDiscovery -Selection $selection
                $browserCommand = @("node_modules/playwright/cli.js", "test", "--project=$($selection.project)", "--grep", [string]$selection.grep) + @($selection.files | ForEach-Object { ([string]$_).Replace('\', '/') })
                if ($isSoundingLineLane) { $browserCommand += "--global-timeout=$browserGlobalTimeoutMs" }
                Invoke-ValidationStep -Name "Running exact governed browser acceptance tests for $($selection.project)" -Arguments $browserCommand
            }
        } else {
            $browserCommand = @("node_modules/playwright/cli.js", "test") + $BrowserArgs
            if ($BrowserGrep) { $browserCommand += @("--grep", $BrowserGrep) }
            if ($BrowserTestPath) {
                # Harborlight owns a dedicated browser project. Other targeted
                # acceptance files retain the routing declared by playwright.config.ts.
                if ($runtimeRelativeBrowserTestPath.Replace('\', '/') -eq 'tests/e2e/harborlight-phase2.spec.ts') {
                    $browserCommand += "--project=harborlight-phase2"
                }
                if ($runtimeRelativeBrowserTestPath.Replace('\', '/') -eq 'tests/e2e/harborlight-phase3.spec.ts') {
                    $browserCommand += "--project=harborlight-phase3"
                }
                if ($runtimeRelativeBrowserTestPath.Replace('\', '/') -eq 'tests/e2e/harborlight-phase4.spec.ts') {
                    $browserCommand += "--project=harborlight-phase4"
                }
                $browserCommand += $runtimeRelativeBrowserTestPath.Replace('\', '/')
            }
            # A named Sounding Line lane is a focused repair boundary. Its deadline
            # is enforced by Playwright so cleanup and receipt emission can run.
            if ($isSoundingLineLane) {
                $browserCommand += "--global-timeout=$browserGlobalTimeoutMs"
            }
            Invoke-ValidationStep -Name "Running browser acceptance tests" -Arguments $browserCommand
        }
        Stop-OwnedValidationServer -ServerOwnership $ownedValidationServer
        $ownedValidationServer = $null
        Assert-TcpPortAvailable -Port $validationServerPort
        $defaultBrowserSucceeded = $true
    } else {
        Write-Host "`n==> Browser acceptance tests skipped by explicit non-browser validation mode" -ForegroundColor Yellow
    }
    # The synthetic scanner is scoped to the owned browser server only. Do not
    # carry its selection into a later production build or restart proof.
    Remove-Item Env:COMMUNITY_BINARY_SCANNER_PROVIDER -ErrorAction SilentlyContinue
    Remove-Item Env:FOREVER_VALIDATION_NODE_ENV -ErrorAction SilentlyContinue
    Remove-Item Env:WAYFARER_PROVIDER_TOKEN_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:PHASE2_LEGACY_ACCESS_CODE -ErrorAction SilentlyContinue
    Remove-Item Env:PRIVATE_CONTENT_ENVIRONMENT_ID -ErrorAction SilentlyContinue
    Remove-Item Env:PRIVATE_CONTENT_ENABLED -ErrorAction SilentlyContinue
    Remove-Item Env:PRIVATE_CONTENT_STORAGE_PROVIDER -ErrorAction SilentlyContinue
    Remove-Item Env:PRIVATE_CONTENT_PROVIDER_ROOT -ErrorAction SilentlyContinue
    Remove-Item Env:PRIVATE_CONTENT_SCANNER_PROVIDER -ErrorAction SilentlyContinue
    Remove-Item Env:PRIVATE_CONTENT_KEY_PROVIDER -ErrorAction SilentlyContinue
    Remove-Item Env:PRIVATE_CONTENT_LOCAL_MASTER_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:PRIVATE_CONTENT_WORKER_ENABLED -ErrorAction SilentlyContinue
    Remove-Item Env:PRIVATE_CONTENT_REQUIRE_READY -ErrorAction SilentlyContinue
    $env:NODE_ENV = "production"

    if ($BrowserOnly) {
        $browserSucceeded = $defaultBrowserSucceeded
    } elseif ($SkipBrowser) {
        Invoke-ValidationStep -Name "Creating production build" -Arguments @("node_modules/next/dist/bin/next", "build")
        $browserSucceeded = $true
    } elseif ($SkipProductionPerformance) {
        $browserSucceeded = $defaultBrowserSucceeded
        Write-Host "`n==> Production performance and restart gates skipped for this focused browser repair run" -ForegroundColor Yellow
        return
    } else {
        if ($BrowserTestPath) {
            # A targeted project owns only its stated acceptance state.  The
            # generic acceptance verifier requires Phase 3's CHAPTER_PREPARED
            # fixture and is therefore not meaningful for Harborlight's
            # explicitly selected, isolated Exchange project.
            Write-Host "`n==> Targeted browser project: skipping Phase 3 acceptance-state assertions" -ForegroundColor DarkYellow
        } else {
            Invoke-ValidationStep -Name "Verifying accepted database state" -Arguments @("node_modules/tsx/dist/cli.mjs", "scripts/verify-database.ts", "--acceptance")
            Invoke-ValidationStep -Name "Proving launcher seed preserves accepted progress" -Arguments @("node_modules/tsx/dist/cli.mjs", "prisma/seed.ts", "--ensure")
            Invoke-ValidationStep -Name "Rechecking preserved database state" -Arguments @("node_modules/tsx/dist/cli.mjs", "scripts/verify-database.ts", "--acceptance")
        }
        Invoke-ValidationStep -Name "Creating production build" -Arguments @("node_modules/next/dist/bin/next", "build")

        $env:FOREVER_VALIDATION_PRODUCTION_IDENTITY = "1"
        if ($BrowserTestPath) {
            Write-Host "`n==> Proving targeted controlled production restarts" -ForegroundColor Cyan
            [void](Invoke-IsolationHelper -Arguments @(
                "verify-canonical",
                "--canonical-db", $canonicalDatabase,
                "--canonical-family-base64", $canonicalFamilyBase64
            ))
            Test-ProductionStart -Port $productionPort
            Test-ProductionStart -Port $productionPort
            [void](Invoke-IsolationHelper -Arguments @(
                "verify-canonical",
                "--canonical-db", $canonicalDatabase,
                "--canonical-family-base64", $canonicalFamilyBase64
            ))
            $browserSucceeded = $defaultBrowserSucceeded
        } else {
            Write-Host "`n==> Starting owned production performance server" -ForegroundColor Cyan
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
        }
    }
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
    $portsReleased = $true
    foreach ($port in @($validationServerPort, 3200) | Select-Object -Unique) {
        try { Assert-TcpPortAvailable -Port $port }
        catch {
            $portsReleased = $false
            $finalizationFailures += "Port $port release proof failed: $($_.Exception.Message)"
        }
    }
    try {
        Write-ForeverValidationRunEvent -RuntimeRoot $runtimeRoot -Event $(
            if ($portsReleased) { "ports-released" } else { "ports-release-failed" }
        )
    } catch {
        $finalizationFailures += "Validation port-release event recording failed: $($_.Exception.Message)"
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
                    "--expect-mutation", $ExpectMutation,
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
