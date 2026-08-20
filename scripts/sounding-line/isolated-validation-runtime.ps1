# .SYNOPSIS
# Runs the internal isolated browser runtime selected by Sounding Line.
#
# .DESCRIPTION
# When a dedicated worktree has no canonical prisma/dev.db, provide an
# existing absolute baseline path. The baseline is fingerprinted before and
# after the run and is never used as the mutable validation database. Hosted
# Sounding Line workers instead bind the freshly seeded task-owned validation
# database as their immutable witness before cloning it for browser execution.
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
    [string]$SkipLegacyProjectionFixture = "false",
    [int]$BrowserWorkers = 1,
    [string]$BrowserGrep = "",
    [switch]$SkipProductionPerformance,
    [switch]$CertifiedBaseline,
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
if ($SkipLegacyProjectionFixture -notin @("true", "false")) { throw "SkipLegacyProjectionFixture must be true or false." }
if ($BrowserWorkers -lt 1 -or $BrowserWorkers -gt 3) { throw "BrowserWorkers must be between 1 and 3." }
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
    if ($BrowserWorkers -gt 1 -and ($SoundingLineLane -ne "browser-family" -or $SkipLegacyProjectionFixture -ne "true" -or $ExpectMutation -ne "false")) {
        throw "Parallel browser execution is limited to the read-only browser-family sentinel fixture."
    }
    if ($BrowserWorkers -gt 1 -and $BrowserSelections.Count -gt 0 -and (($BrowserSelections | ForEach-Object { [int]$_.caseCount } | Measure-Object -Sum).Sum -lt $BrowserWorkers)) {
        throw "BrowserWorkers cannot exceed the governed browser case count."
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
if ($CertifiedBaseline -and -not $BaselineDatabasePath) {
    throw "CertifiedBaseline requires an explicit immutable baseline database."
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
$hostedRuntimeGeneratedBaseline = $false
if ($BaselineDatabasePath) {
    if (-not ($BaselineDatabasePath -match '^[A-Za-z]:[\\/]' -or $BaselineDatabasePath.StartsWith('\\'))) {
        throw "BaselineDatabasePath must be an absolute database file path."
    }
    $canonicalDatabase = [System.IO.Path]::GetFullPath($BaselineDatabasePath)
    if (-not (Test-Path -LiteralPath $canonicalDatabase)) {
        if ($env:GITHUB_ACTIONS -ne "true") {
            throw "BaselineDatabasePath must identify an existing database file."
        }
        # A hosted worker has no user-owned development database in its clean
        # checkout. Initialize-ForeverRuntime creates the candidate-bound,
        # migrated and seeded validation database below; that owned seed then
        # becomes the immutable witness for the nonce-bound isolated copy.
        $canonicalDatabase = $null
        $baselineSource = "hosted-runtime-generated"
        $hostedRuntimeGeneratedBaseline = $true
    }
    elseif ((Get-Item -LiteralPath $canonicalDatabase).PSIsContainer) {
        throw "BaselineDatabasePath must identify a file, not a directory."
    }
    else {
        $baselineSource = "explicit-external"
    }
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

$runtimeRoot = $null
if ($hostedRuntimeGeneratedBaseline) {
    $runtimeRoot = Initialize-ForeverRuntime -Mode validation -ResetDatabase
    $canonicalDatabase = Join-Path $runtimeRoot "prisma\validation.db"
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

if (-not $runtimeRoot) {
    if ($CertifiedBaseline) {
        $runtimeRoot = Initialize-ForeverRuntime -Mode validation -ResetDatabase -CertifiedBaselinePath $canonicalDatabase
    } else {
        $runtimeRoot = Initialize-ForeverRuntime -Mode validation -ResetDatabase
    }
}
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
# Initialize-ForeverRuntime has already created a task-owned seed and proved
# generation, migration, and seeding against the candidate source. The caller
# baseline is an immutable identity/invariance witness only: copying an older
# non-empty baseline into the seed would erase its migration provenance and
# make Prisma correctly reject the resulting clone with P3005. Preserve that
# boundary and clone only the migrated task-owned seed below.

function Invoke-ValidationStep {
    param([Parameter(Mandatory)][string]$Name, [Parameter(Mandatory)][string[]]$Arguments)
    Write-Host "`n==> $Name" -ForegroundColor Cyan
    Invoke-ForeverNode -WorkingDirectory $runtimeRoot -Arguments $Arguments
}

function Repair-FocusedBrowserStudioFixture {
    # The focused BrowserOnly copy starts from the current development seed but
    # must also satisfy the current Studio block contract before legacy and
    # Player journeys consume it. Keep this normalization inside the
    # nonce-bound disposable database; production and the canonical baseline
    # are never opened or modified here.
    $normalizer = @'
import { DatabaseSync } from "node:sqlite";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.startsWith("file:")) throw new Error("FOCUSED_BROWSER_FIXTURE_DATABASE_URL_INVALID");
const database = new DatabaseSync(decodeURIComponent(databaseUrl.slice("file:".length)));
const fixtureSlug = "development-studio-voyage";
const defaultsByBlockType = new Map([
  ["riddle", { hints: [] }],
  ["chapterComplete", { nextChapterBehavior: "continue", returnToMap: false }],
  ["travelDirection", { destinationVisibility: "named" }],
  ["confirmation", { confirmationStyle: "standard" }],
]);
const applyDefaults = (blockType, configuration) => {
  const defaults = defaultsByBlockType.get(blockType);
  if (!defaults) return false;
  let changed = false;
  for (const [key, value] of Object.entries(defaults)) {
    if (!Object.hasOwn(configuration, key)) {
      configuration[key] = value;
      changed = true;
    }
  }
  return changed;
};

try {
  const tale = database.prepare('SELECT "id" FROM "Chronicle" WHERE "slug" = ?').get(fixtureSlug);
  if (!tale?.id) throw new Error("FOCUSED_BROWSER_STUDIO_FIXTURE_TALE_MISSING");
  const blocks = database
    .prepare(
      'SELECT "id", "blockType", "configuration" FROM "StoryBlock" WHERE "chapterId" IN (SELECT "id" FROM "TaleChapter" WHERE "draftRevisionId" IN (SELECT "id" FROM "TaleDraft" WHERE "taleId" = ?))',
    )
    .all(tale.id);
  const expectedTypes = [...defaultsByBlockType.keys()];
  if (expectedTypes.some((blockType) => blocks.filter((block) => block.blockType === blockType).length !== 1))
    throw new Error("FOCUSED_BROWSER_STUDIO_FIXTURE_BLOCK_SHAPE_INVALID");
  const updateBlock = database.prepare('UPDATE "StoryBlock" SET "configuration" = ? WHERE "id" = ?');
  let draftBlocksNormalized = 0;
  for (const block of blocks) {
    let configuration;
    try {
      configuration = JSON.parse(block.configuration);
    } catch {
      throw new Error("FOCUSED_BROWSER_STUDIO_FIXTURE_CONFIGURATION_INVALID");
    }
    if (applyDefaults(block.blockType, configuration)) {
      updateBlock.run(JSON.stringify(configuration), block.id);
      draftBlocksNormalized += 1;
    }
  }

  const versions = database
    .prepare('SELECT "id", "contentSnapshot" FROM "PublishedTaleVersion" WHERE "taleId" = ? AND "isCurrent" = 1')
    .all(tale.id);
  if (versions.length !== 1) throw new Error("FOCUSED_BROWSER_STUDIO_FIXTURE_VERSION_SHAPE_INVALID");
  let snapshot;
  try {
    snapshot = JSON.parse(versions[0].contentSnapshot);
  } catch {
    throw new Error("FOCUSED_BROWSER_STUDIO_FIXTURE_SNAPSHOT_INVALID");
  }
  const snapshotBlocks = snapshot?.chapters?.flatMap((chapter) => chapter?.blocks ?? []);
  if (!Array.isArray(snapshotBlocks) || expectedTypes.some((blockType) => snapshotBlocks.filter((block) => block?.blockType === blockType).length !== 1))
    throw new Error("FOCUSED_BROWSER_STUDIO_FIXTURE_SNAPSHOT_SHAPE_INVALID");
  let snapshotBlocksNormalized = 0;
  for (const block of snapshotBlocks) {
    if (!block?.configuration || typeof block.configuration !== "object" || Array.isArray(block.configuration))
      throw new Error("FOCUSED_BROWSER_STUDIO_FIXTURE_SNAPSHOT_CONFIGURATION_INVALID");
    if (applyDefaults(block.blockType, block.configuration)) snapshotBlocksNormalized += 1;
  }
  if (snapshotBlocksNormalized) {
    database
      .prepare('UPDATE "PublishedTaleVersion" SET "contentSnapshot" = ? WHERE "id" = ?')
      .run(JSON.stringify(snapshot), versions[0].id);
  }
  console.log(
    JSON.stringify({
      status: "FOCUSED_BROWSER_STUDIO_FIXTURE_CURRENT",
      draftBlocksNormalized,
      snapshotBlocksNormalized,
    }),
  );
} finally {
  database.close();
}
'@
    Invoke-ValidationStep -Name "Normalizing focused Studio browser fixture contract" -Arguments @(
        "--experimental-sqlite",
        "--input-type=module",
        "--eval",
        $normalizer
    )
}

function Get-BrowserSelectionDiscoveryCount {
    param([Parameter(Mandatory)]$Selection)
    $arguments = @("node_modules/@playwright/test/cli.js", "test", "--list", "--project=$($Selection.project)", "--grep", [string]$Selection.grep) + @($Selection.files | ForEach-Object { ([string]$_).Replace('\\', '/') })
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
    return @($listing | Where-Object { $_ -match $projectPattern }).Count
}

function Assert-BrowserSelectionDiscovery {
    param([Parameter(Mandatory)]$Selection)
    $discoveredCases = Get-BrowserSelectionDiscoveryCount -Selection $Selection
    if ($discoveredCases -ne [int]$Selection.caseCount) {
        throw "GOVERNED_BROWSER_DISCOVERY_MISMATCH:$($Selection.project):expected=$($Selection.caseCount):actual=$discoveredCases"
    }
}

function Copy-TaskOwnedDatabaseWithSidecars {
    param(
        [Parameter(Mandatory)][string]$SourceDatabase,
        [Parameter(Mandatory)][string]$DestinationDatabase,
        [Parameter(Mandatory)][string]$FailureCode
    )
    if (-not (Test-Path -LiteralPath $SourceDatabase -PathType Leaf)) {
        throw "$FailureCode:SOURCE_MISSING:$SourceDatabase"
    }
    $destinationDirectory = Split-Path -Parent $DestinationDatabase
    New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    Copy-Item -LiteralPath $SourceDatabase -Destination $DestinationDatabase -Force
    foreach ($suffix in @("-wal", "-shm")) {
        $destinationSidecar = "$DestinationDatabase$suffix"
        Remove-Item -LiteralPath $destinationSidecar -Force -ErrorAction SilentlyContinue
        $sourceSidecar = "$SourceDatabase$suffix"
        if (Test-Path -LiteralPath $sourceSidecar -PathType Leaf) {
            Copy-Item -LiteralPath $sourceSidecar -Destination $destinationSidecar -Force
        }
    }
    if (-not (Test-Path -LiteralPath $DestinationDatabase -PathType Leaf)) {
        throw "$FailureCode:DESTINATION_MISSING:$DestinationDatabase"
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
            if (-not $identity) {
                # A short-lived descendant may naturally exit between the CIM
                # snapshot and identity read. The launcher remains fail-closed
                # and already-recorded identities remain eligible for cleanup.
                if ([int]$processId -eq [int]$LauncherIdentity.ProcessId) {
                    throw "Owned launcher exited while its identity was being recorded."
                }
                continue
            }
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
                $response = $_.Exception.PSObject.Properties["Response"]
                $statusCode = if ($response -and $response.Value) { [int]$response.Value.StatusCode } else { "unavailable" }
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
            StdoutPath = $stdout
            StderrPath = $stderr
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

function Get-OwnedValidationServerDiagnostics {
    param([Parameter(Mandatory)]$ServerOwnership)
    $launcherAlive = Test-ProcessIdentityMatches -ExpectedIdentity $ServerOwnership.LauncherIdentity
    $stderrTail = if (Test-Path -LiteralPath $ServerOwnership.StderrPath) {
        ((Get-Content -LiteralPath $ServerOwnership.StderrPath -Tail 48 -ErrorAction SilentlyContinue) -join "`n").Trim()
    } else { "stderr-unavailable" }
    return "launcherAlive=$launcherAlive; port=$($ServerOwnership.Port); stderrTail=$stderrTail"
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
$tideglassTaskRoot = $null
$shipwrightTaskRoot = $null
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
            Invoke-ValidationStep -Name "Installing Playwright browsers" -Arguments @("node_modules/@playwright/test/cli.js", "install", "chromium", "webkit")
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
        # The externally supplied canonical baseline is immutable and may
        # predate the development Chronicle required by the legacy projection.
        # Establish that fixture only in the nonce-bound disposable copy before
        # migrating it. This preserves the baseline boundary while giving every
        # selected browser family the same seeded One Voyage contract as the
        # full governed runtime.
        Invoke-ValidationStep -Name "Seeding focused browser development fixture" -Arguments @("node_modules/tsx/dist/cli.mjs", "prisma/seed.ts")
        Repair-FocusedBrowserStudioFixture
        if ($SkipLegacyProjectionFixture -ne "true") {
            # Focused browser families normally require canonical migration provenance
            # and the migrated Voyage fixture. The read-only access sentinel has its
            # own exact fixture contract and may bypass this unrelated projection.
            Invoke-ValidationStep -Name "Migrating focused browser legacy compatibility projection" -Arguments @("node_modules/tsx/dist/cli.mjs", "scripts/migrate-legacy-companion.ts")
            Invoke-ValidationStep -Name "Verifying focused browser legacy compatibility projection" -Arguments @("node_modules/tsx/dist/cli.mjs", "scripts/migrate-legacy-companion.ts", "--verify")
            Invoke-ValidationStep -Name "Preparing focused browser legacy playthrough fixture" -Arguments @("node_modules/tsx/dist/cli.mjs", "scripts/verify-platform-backfill.ts", "--prepare")
            Invoke-ValidationStep -Name "Seeding focused browser legacy playthrough fixture" -Arguments @("node_modules/tsx/dist/cli.mjs", "prisma/seed.ts", "--ensure")
            Invoke-ValidationStep -Name "Verifying focused browser legacy playthrough fixture" -Arguments @("node_modules/tsx/dist/cli.mjs", "scripts/verify-platform-backfill.ts", "--verify")
        }
    }

    if (-not $SkipBrowser) {
        $selectedBrowserFiles = @(
            $BrowserSelections |
                ForEach-Object { @($_.files) } |
                ForEach-Object { ([string]$_).Replace('\', '/') } |
                Where-Object { $_ -match '^tests/e2e/.+\.spec\.ts$' }
            $BrowserArgs |
                ForEach-Object { ([string]$_).Replace('\', '/') } |
                Where-Object { $_ -match '^tests/e2e/.+\.spec\.ts$' } |
                Sort-Object -Unique
        )
        $tideglassBrowserFile = "tests/e2e/tideglass-phase3.spec.ts"
        $tideglassSetupFile = "tests/e2e/phase3-readonly-setup.setup.ts"
        $shipwrightBrowserFile = "tests/e2e/project-shipwright-phase2.spec.ts"
        $tideglassBrowserSelections = @()
        $shipwrightBrowserSelections = @()
        $ordinaryBrowserSelections = @()
        $ordinaryBrowserSnapshot = $null
        if ($BrowserSelections.Count -gt 0) {
            foreach ($selection in $BrowserSelections) {
                $selectionFiles = @($selection.files | ForEach-Object { ([string]$_).Replace('\', '/') })
                $hasTideglass = $selectionFiles -contains $tideglassBrowserFile
                $hasShipwright = $selectionFiles -contains $shipwrightBrowserFile
                if (-not $hasTideglass -and -not $hasShipwright) {
                    $ordinaryBrowserSelections += $selection
                    continue
                }
                # Playwright's Tideglass setup file is a dependency of this fixture, not
                # an ordinary browser target. Keep it with the Tideglass batch so a
                # selection containing only that dependency is not split into an empty
                # ordinary test command.
                $tideglassFiles = if ($hasTideglass) {
                    @($selectionFiles | Where-Object { $_ -in @($tideglassBrowserFile, $tideglassSetupFile) })
                } else {
                    @()
                }
                $shipwrightFiles = if ($hasShipwright) {
                    @($selectionFiles | Where-Object { $_ -eq $shipwrightBrowserFile })
                } else {
                    @()
                }
                $ordinaryExcludedFiles = @($tideglassFiles + $shipwrightFiles)
                $ordinaryFiles = @($selectionFiles | Where-Object { $_ -notin $ordinaryExcludedFiles })
                $partitions = @()
                foreach ($partition in @(
                    [pscustomobject]@{ Name = "Tideglass"; Files = $tideglassFiles },
                    [pscustomobject]@{ Name = "Shipwright"; Files = $shipwrightFiles },
                    [pscustomobject]@{ Name = "ordinary"; Files = $ordinaryFiles }
                )) {
                    # Normalize an empty, singleton, or array-valued property before
                    # counting it.  Under StrictMode a PSCustomObject can otherwise
                    # expose a scalar Files value without a Count member.
                    if (@($partition.Files).Count -eq 0) { continue }
                    $partitionSelection = [pscustomobject]@{
                        project = [string]$selection.project
                        files = @($partition.Files)
                        grep = [string]$selection.grep
                        caseCount = 0
                    }
                    $partitionSelection.caseCount = Get-BrowserSelectionDiscoveryCount -Selection $partitionSelection
                    if ($partitionSelection.caseCount -lt 1) {
                        throw "GOVERNED_BROWSER_SELECTION_PARTITION_EMPTY:$($partition.Name):$($selection.project)"
                    }
                    $partitions += [pscustomobject]@{ Name = $partition.Name; Selection = $partitionSelection }
                }
                $partitionCaseCount = @($partitions | ForEach-Object { [int]$_.Selection.caseCount } | Measure-Object -Sum).Sum
                if ($partitionCaseCount -ne [int]$selection.caseCount) {
                    throw "GOVERNED_BROWSER_SELECTION_PARTITION_MISMATCH:$($selection.project):expected=$($selection.caseCount):actual=$partitionCaseCount"
                }
                foreach ($partition in $partitions) {
                    switch ($partition.Name) {
                        "Tideglass" { $tideglassBrowserSelections += $partition.Selection; break }
                        "Shipwright" { $shipwrightBrowserSelections += $partition.Selection; break }
                        "ordinary" { $ordinaryBrowserSelections += $partition.Selection; break }
                        default { throw "GOVERNED_BROWSER_SELECTION_PARTITION_UNKNOWN:$($partition.Name)" }
                    }
                }
            }
        }
        if ($BrowserSelections.Count -eq 0 -and $selectedBrowserFiles -contains $tideglassBrowserFile) {
            $unexpectedFiles = @($selectedBrowserFiles | Where-Object { $_ -notin @($tideglassBrowserFile, "tests/e2e/phase3-readonly-setup.setup.ts") })
            if ($unexpectedFiles.Count -gt 0) {
                throw "GOVERNED_TIDEGLASS_BROWSER_ARGS_MIXED:$($unexpectedFiles -join ',')"
            }
        }
        if ($shipwrightBrowserSelections.Count -gt 0) {
            # Shipwright's mutable Creator journey owns a purpose-built synthetic
            # account and a dynamic loopback server. It cannot borrow the generic
            # development account or the ordinary browser database.
            $shipwrightParent = [System.IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA "ProjectShipwright\SoundingLine"))
            $shipwrightTaskRoot = [System.IO.Path]::GetFullPath(
                (Join-Path $shipwrightParent ("validation-" + $isolation.nonceHash.Substring(0, 16)))
            )
            $shipwrightPrefix = $shipwrightParent.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
            if (-not $shipwrightTaskRoot.StartsWith($shipwrightPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                throw "GOVERNED_SHIPWRIGHT_TASK_ROOT_ESCAPED:$shipwrightTaskRoot"
            }
            if (Test-Path -LiteralPath $shipwrightTaskRoot) {
                throw "GOVERNED_SHIPWRIGHT_TASK_ROOT_ALREADY_EXISTS:$shipwrightTaskRoot"
            }
            $env:SHIPWRIGHT_PHASE2_TASK_ROOT = $shipwrightTaskRoot
        }
        if ($tideglassBrowserSelections.Count -gt 0 -or ($BrowserSelections.Count -eq 0 -and $selectedBrowserFiles -contains $tideglassBrowserFile)) {
            $tideglassParent = [System.IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA "ProjectTideglass\SoundingLine"))
            $tideglassTaskRoot = [System.IO.Path]::GetFullPath(
                (Join-Path $tideglassParent ("validation-" + $isolation.nonceHash.Substring(0, 16)))
            )
            $tideglassPrefix = $tideglassParent.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
            if (-not $tideglassTaskRoot.StartsWith($tideglassPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                throw "GOVERNED_TIDEGLASS_TASK_ROOT_ESCAPED:$tideglassTaskRoot"
            }
            if (Test-Path -LiteralPath $tideglassTaskRoot) {
                throw "GOVERNED_TIDEGLASS_TASK_ROOT_ALREADY_EXISTS:$tideglassTaskRoot"
            }
            if ($tideglassBrowserSelections.Count -gt 0 -and $ordinaryBrowserSelections.Count -gt 0) {
                $ordinaryBrowserSnapshot = Join-Path $tideglassTaskRoot "ordinary-browser-fixture\validation.db"
                Copy-TaskOwnedDatabaseWithSidecars -SourceDatabase $isolatedDatabase -DestinationDatabase $ordinaryBrowserSnapshot -FailureCode "GOVERNED_TIDEGLASS_ORDINARY_FIXTURE_SNAPSHOT_FAILED"
            }
            $env:TIDEGLASS_PHASE3_TASK_ROOT = $tideglassTaskRoot
            $env:TIDEGLASS_PHASE3_SOURCE_SHA = (& git -C $projectRoot rev-parse HEAD).Trim()
            if ($env:TIDEGLASS_PHASE3_SOURCE_SHA -notmatch '^[0-9a-f]{40}$') {
                throw "GOVERNED_TIDEGLASS_SOURCE_SHA_INVALID"
            }
            Write-Host "`n==> Preparing task-owned Tideglass browser fixture" -ForegroundColor Cyan
            Invoke-ValidationStep -Name "Preparing task-owned Tideglass browser fixture" -Arguments @(
                "scripts/tideglass/prepare-phase3-fixture.mjs"
            )
            $tideglassFixtureReceipt = Get-Content -Raw -LiteralPath (Join-Path $tideglassTaskRoot "reports\fixture-receipt.json") | ConvertFrom-Json
            if ($tideglassFixtureReceipt.status -ne "TIDEGLASS_PHASE3_FIXTURE_READY" -or
                [string]::IsNullOrWhiteSpace([string]$tideglassFixtureReceipt.fixtureChecksum) -or
                [string]::IsNullOrWhiteSpace([string]$tideglassFixtureReceipt.databasePath)) {
                throw "GOVERNED_TIDEGLASS_FIXTURE_RECEIPT_INVALID"
            }
            $tideglassDatabase = [System.IO.Path]::GetFullPath([string]$tideglassFixtureReceipt.databasePath)
            $tideglassDatabasePrefix = $tideglassTaskRoot.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
            if (-not $tideglassDatabase.StartsWith($tideglassDatabasePrefix, [System.StringComparison]::OrdinalIgnoreCase) -or
                -not (Test-Path -LiteralPath $tideglassDatabase -PathType Leaf)) {
                throw "GOVERNED_TIDEGLASS_FIXTURE_DATABASE_REFUSED:$tideglassDatabase"
            }
            # Playwright's shared Phase 3 fixtures deliberately accept only the
            # nonce-bound database copy created by this harness. Tideglass gets
            # its synthetic data in a disposable project root, then materializes
            # that data into the already-authorized isolated copy. When the
            # sealed selection also contains ordinary cases, their prepared
            # fixture was snapshotted above and is restored only after the
            # Tideglass-owned server has fully stopped.
            Copy-TaskOwnedDatabaseWithSidecars -SourceDatabase $tideglassDatabase -DestinationDatabase $isolatedDatabase -FailureCode "GOVERNED_TIDEGLASS_FIXTURE_MATERIALIZATION_FAILED"
            $env:TIDEGLASS_PHASE3_FIXTURE_CHECKSUM = [string]$tideglassFixtureReceipt.fixtureChecksum
            $env:DATABASE_URL = $expectedDatabaseUrl
            # The Phase 3 read-only setup is shared infrastructure and signs in
            # as the harness Captain. Add that standard development identity to
            # the Tideglass-only synthetic database without replacing its data.
            Invoke-ValidationStep -Name "Seeding shared Captain contract for Tideglass browser fixture" -Arguments @(
                "node_modules/tsx/dist/cli.mjs",
                "prisma/seed.ts",
                "--ensure"
            )
            # /api/gm/status is part of that shared setup and resolves the
            # legacy projection only from the task-owned copy. Keep this
            # preparatory bridge narrow and re-verify its migration evidence.
            Invoke-ValidationStep -Name "Migrating shared Captain contract for Tideglass browser fixture" -Arguments @(
                "node_modules/tsx/dist/cli.mjs",
                "scripts/migrate-legacy-companion.ts"
            )
            Invoke-ValidationStep -Name "Verifying shared Captain contract for Tideglass browser fixture" -Arguments @(
                "node_modules/tsx/dist/cli.mjs",
                "scripts/migrate-legacy-companion.ts",
                "--verify"
            )
            Invoke-ValidationStep -Name "Preparing shared Captain playthrough contract for Tideglass browser fixture" -Arguments @(
                "node_modules/tsx/dist/cli.mjs",
                "scripts/verify-platform-backfill.ts",
                "--prepare"
            )
            Invoke-ValidationStep -Name "Seeding shared Captain playthrough contract for Tideglass browser fixture" -Arguments @(
                "node_modules/tsx/dist/cli.mjs",
                "prisma/seed.ts",
                "--ensure"
            )
            Invoke-ValidationStep -Name "Verifying shared Captain playthrough contract for Tideglass browser fixture" -Arguments @(
                "node_modules/tsx/dist/cli.mjs",
                "scripts/verify-platform-backfill.ts",
                "--verify"
            )
        }
        $playwrightInvoked = $true
        if ($BrowserSelections.Count -gt 0) {
            $browserSelectionBatches = @()
            if ($tideglassBrowserSelections.Count -gt 0) {
                $browserSelectionBatches += [pscustomobject]@{
                    Name = "Tideglass"
                    Selections = @($tideglassBrowserSelections)
                    RestoreOrdinaryFixture = $false
                }
            }
            if ($shipwrightBrowserSelections.Count -gt 0) {
                $browserSelectionBatches += [pscustomobject]@{
                    Name = "Shipwright"
                    Selections = @($shipwrightBrowserSelections)
                    RestoreOrdinaryFixture = $false
                }
            }
            if ($ordinaryBrowserSelections.Count -gt 0) {
                $browserSelectionBatches += [pscustomobject]@{
                    Name = "ordinary"
                    Selections = @($ordinaryBrowserSelections)
                    RestoreOrdinaryFixture = $null -ne $ordinaryBrowserSnapshot
                }
            }
            if ($browserSelectionBatches.Count -eq 0) {
                throw "GOVERNED_BROWSER_SELECTION_BATCHES_EMPTY"
            }
            foreach ($batch in $browserSelectionBatches) {
                if ($batch.Name -eq "Shipwright") {
                    foreach ($selection in $batch.Selections) {
                        Assert-BrowserSelectionDiscovery -Selection $selection
                        if (@($selection.files).Count -ne 1 -or
                            [string]$selection.files[0] -ne $shipwrightBrowserFile -or
                            [int]$selection.caseCount -ne 1) {
                            throw "GOVERNED_SHIPWRIGHT_BROWSER_SELECTION_INVALID:$($selection.project):cases=$($selection.caseCount)"
                        }
                        # This runner materializes only Shipwright's synthetic Creator
                        # fixture, hands its private credential directly to Playwright,
                        # and owns a separate dynamic loopback port.
                        Invoke-ValidationStep -Name "Running exact governed Shipwright Phase 2 browser acceptance" -Arguments @(
                            "scripts/shipwright/run-phase2-journeys.mjs"
                        )
                    }
                    continue
                }
                if ($batch.RestoreOrdinaryFixture) {
                    Write-Host "`n==> Restoring ordinary browser fixture after Tideglass partition" -ForegroundColor Cyan
                    Copy-TaskOwnedDatabaseWithSidecars -SourceDatabase $ordinaryBrowserSnapshot -DestinationDatabase $isolatedDatabase -FailureCode "GOVERNED_TIDEGLASS_ORDINARY_FIXTURE_RESTORE_FAILED"
                    $env:DATABASE_URL = $expectedDatabaseUrl
                }
                Write-Host "`n==> Starting owned isolated validation server for $($batch.Name) browser selection" -ForegroundColor Cyan
                $ownedValidationServer = Start-OwnedValidationServer
                foreach ($selection in $batch.Selections) {
                    Assert-BrowserSelectionDiscovery -Selection $selection
                    $browserCommand = @("node_modules/@playwright/test/cli.js", "test", "--project=$($selection.project)", "--grep", [string]$selection.grep) + @($selection.files | ForEach-Object { ([string]$_).Replace('\', '/') })
                    if ($BrowserWorkers -gt 1) { $browserCommand += @("--workers=$BrowserWorkers", "--fully-parallel") }
                    if ($isSoundingLineLane) { $browserCommand += "--global-timeout=$browserGlobalTimeoutMs" }
                    try {
                        Invoke-ValidationStep -Name "Running exact governed $($batch.Name) browser acceptance tests for $($selection.project)" -Arguments $browserCommand
                    } catch {
                        throw "GOVERNED_BROWSER_SERVER_OR_TEST_FAILURE:$($_.Exception.Message)`n$(Get-OwnedValidationServerDiagnostics -ServerOwnership $ownedValidationServer)"
                    }
                }
                Stop-OwnedValidationServer -ServerOwnership $ownedValidationServer
                $ownedValidationServer = $null
                Assert-TcpPortAvailable -Port $validationServerPort
            }
        } else {
            Write-Host "`n==> Starting owned isolated validation server" -ForegroundColor Cyan
            $ownedValidationServer = Start-OwnedValidationServer
            $browserCommand = @("node_modules/@playwright/test/cli.js", "test") + $BrowserArgs
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
            Stop-OwnedValidationServer -ServerOwnership $ownedValidationServer
            $ownedValidationServer = $null
            Assert-TcpPortAvailable -Port $validationServerPort
        }
        if ($tideglassTaskRoot) { $env:DATABASE_URL = $expectedDatabaseUrl }
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
                "node_modules/@playwright/test/cli.js",
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
    if ($tideglassTaskRoot) {
        try {
            $tideglassParent = [System.IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA "ProjectTideglass\SoundingLine"))
            $tideglassPrefix = $tideglassParent.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
            $resolvedTideglassTaskRoot = [System.IO.Path]::GetFullPath($tideglassTaskRoot)
            if (-not $resolvedTideglassTaskRoot.StartsWith($tideglassPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                throw "GOVERNED_TIDEGLASS_TASK_ROOT_CLEANUP_REFUSED:$resolvedTideglassTaskRoot"
            }
            if (-not (Test-Path -LiteralPath $resolvedTideglassTaskRoot -PathType Container)) {
                throw "GOVERNED_TIDEGLASS_TASK_ROOT_CLEANUP_MISSING:$resolvedTideglassTaskRoot"
            }
            Remove-Item -LiteralPath $resolvedTideglassTaskRoot -Recurse -Force
            if (Test-Path -LiteralPath $resolvedTideglassTaskRoot) {
                throw "GOVERNED_TIDEGLASS_TASK_ROOT_CLEANUP_INCOMPLETE:$resolvedTideglassTaskRoot"
            }
            @{ status = "CLEAN"; resource = "tideglass-phase3-task-root"; taskRoot = $resolvedTideglassTaskRoot } |
                ConvertTo-Json -Compress |
                Set-Content -LiteralPath (Join-Path $validationArtifacts "tideglass-task-root-cleanup.json") -Encoding utf8
        } catch {
            $finalizationFailures += "Tideglass task-root cleanup failed: $($_.Exception.Message)"
        }
    }
    if ($shipwrightTaskRoot -and (Test-Path -LiteralPath $shipwrightTaskRoot -PathType Container)) {
        try {
            $shipwrightParent = [System.IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA "ProjectShipwright\SoundingLine"))
            $shipwrightPrefix = $shipwrightParent.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
            $resolvedShipwrightTaskRoot = [System.IO.Path]::GetFullPath($shipwrightTaskRoot)
            if (-not $resolvedShipwrightTaskRoot.StartsWith($shipwrightPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                throw "GOVERNED_SHIPWRIGHT_TASK_ROOT_CLEANUP_REFUSED:$resolvedShipwrightTaskRoot"
            }
            Remove-Item -LiteralPath $resolvedShipwrightTaskRoot -Recurse -Force
            if (Test-Path -LiteralPath $resolvedShipwrightTaskRoot) {
                throw "GOVERNED_SHIPWRIGHT_TASK_ROOT_CLEANUP_INCOMPLETE:$resolvedShipwrightTaskRoot"
            }
            @{ status = "CLEAN"; resource = "shipwright-phase2-task-root"; taskRoot = $resolvedShipwrightTaskRoot } |
                ConvertTo-Json -Compress |
                Set-Content -LiteralPath (Join-Path $validationArtifacts "shipwright-task-root-cleanup.json") -Encoding utf8
        } catch {
            $finalizationFailures += "Shipwright task-root cleanup failed: $($_.Exception.Message)"
        }
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
    if ($runtimeRoot -and $finalizationFailures.Count -eq 0) {
        try {
            Clear-ForeverValidationRuntimeTransientState -RuntimeRoot $runtimeRoot
        } catch {
            $finalizationFailures += "Validation transient cleanup failed: $($_.Exception.Message)"
        }
    }
}

if ($validationFailure -and $finalizationFailures.Count -gt 0) {
    throw [System.InvalidOperationException]::new("Validation failed: $($validationFailure.Message) Finalization also failed: $($finalizationFailures -join '; ')", $validationFailure)
}
if ($validationFailure) { throw $validationFailure }
if ($finalizationFailures.Count -gt 0) { throw "Validation finalization failed: $($finalizationFailures -join '; ')" }
Write-Host "`nFull validation passed. Reports and screenshots: $env:VALIDATION_ARTIFACTS" -ForegroundColor Green
