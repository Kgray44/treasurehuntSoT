Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).ProviderPath
$script:RuntimeBase = Join-Path $env:LOCALAPPDATA "ForeverTreasureCompanion"
$script:ValidationRunParent = Join-Path $script:RuntimeBase "Validation_Runs"

function Get-ForeverNode {
    $command = Get-Command node -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $bundled = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
    if (Test-Path -LiteralPath $bundled) { return $bundled }
    throw "Node.js 22 or newer is required. Install Node.js from https://nodejs.org and try again."
}

function Get-ForeverNpmInvocation {
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $npm) { $npm = Get-Command npm -ErrorAction SilentlyContinue }
    if ($npm) { return @{ File = $npm.Source; Prefix = @() } }
    $pnpm = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\pnpm\bin\pnpm.cjs"
    if (Test-Path -LiteralPath $pnpm) {
        return @{ File = (Get-ForeverNode); Prefix = @($pnpm, "dlx", "npm@11.9.0") }
    }
    throw "npm 11 is required. Reinstall Node.js with npm included and try again."
}

function Invoke-ForeverNpm {
    param([Parameter(Mandatory)][string]$WorkingDirectory, [Parameter(ValueFromRemainingArguments)][string[]]$Arguments)
    $invocation = Get-ForeverNpmInvocation
    $previousPath = $env:PATH
    $env:PATH = "$(Split-Path (Get-ForeverNode));$env:PATH"
    Push-Location $WorkingDirectory
    try {
        & $invocation.File @($invocation.Prefix) @Arguments | Out-Host
        if ($LASTEXITCODE -ne 0) { throw "npm command failed with exit code ${LASTEXITCODE}: npm $($Arguments -join ' ')" }
    } finally { Pop-Location; $env:PATH = $previousPath }
}

function Ensure-ForeverEnvironment {
    $environmentPath = Join-Path $script:ProjectRoot ".env"
    if (-not (Test-Path -LiteralPath $environmentPath)) {
        $bytes = New-Object byte[] 48
        [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
        $secret = [Convert]::ToBase64String($bytes)
        @"
# Local disposable development configuration. Never use these credentials in production.
DATABASE_URL="file:./dev.db"
SESSION_SECRET="$secret"
GM_USERNAME="kato"
GM_PASSWORD="development-captain-only"
PLAYER_ACCESS_CODE="development-moonwake"
NEXT_PUBLIC_APP_URL="http://127.0.0.1:3000"
LOG_LEVEL="info"
"@ | Set-Content -LiteralPath $environmentPath -Encoding UTF8
        Write-Host "Created ignored local development configuration at $environmentPath" -ForegroundColor DarkGray
    }
    $required = "DATABASE_URL", "SESSION_SECRET", "GM_USERNAME", "GM_PASSWORD", "PLAYER_ACCESS_CODE"
    $contents = Get-Content -Raw -LiteralPath $environmentPath
    foreach ($name in $required) {
        if ($contents -notmatch "(?m)^$name=") { throw ".env exists but is missing $name. It was preserved; add the missing value and retry." }
    }
    return $environmentPath
}

function Import-ForeverEnvironment {
    param([Parameter(Mandatory)][string]$Path)
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
        $name, $value = $line -split '=', 2
        $value = $value.Trim().Trim('"').Trim("'")
        [Environment]::SetEnvironmentVariable($name.Trim(), $value, "Process")
    }
}

function Test-ForeverGitWorktree {
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) { return $false }
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $result = @(& git -C $Path rev-parse --is-inside-work-tree 2>$null)
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousPreference
    }
    return $exitCode -eq 0 -and ($result -join "").Trim() -eq "true"
}

function Assert-ForeverValidationRunParent {
    param([Parameter(Mandatory)][string]$RunParent)
    $resolvedParent = [System.IO.Path]::GetFullPath($RunParent)
    $historicalRoot = [System.IO.Path]::GetFullPath((Join-Path $script:RuntimeBase "validation"))
    if ([string]::Equals($resolvedParent, $historicalRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "The historical validation runtime path is permanently forbidden: $historicalRoot"
    }
    if (Test-ForeverGitWorktree -Path $resolvedParent) {
        throw "Validation runtime parent is inside a Git worktree: $resolvedParent"
    }
    return $resolvedParent
}

function Write-ForeverValidationRunEvent {
    param([Parameter(Mandatory)][string]$RuntimeRoot, [Parameter(Mandatory)][string]$Event)
    $eventPath = Join-Path $RuntimeRoot ".forever-validation-events.jsonl"
    $entry = [ordered]@{
        timestampUtc = [DateTime]::UtcNow.ToString("o", [System.Globalization.CultureInfo]::InvariantCulture)
        event = $Event
        runtimeRoot = [System.IO.Path]::GetFullPath($RuntimeRoot)
    } | ConvertTo-Json -Compress
    Add-Content -LiteralPath $eventPath -Value $entry -Encoding UTF8
}

function Assert-ForeverValidationRuntimeOwnership {
    param([Parameter(Mandatory)][string]$RuntimeRoot)
    $resolvedRoot = [System.IO.Path]::GetFullPath($RuntimeRoot)
    if (Test-ForeverGitWorktree -Path $resolvedRoot) {
        throw "Validation runtime is inside a Git worktree: $resolvedRoot"
    }
    if (Test-Path -LiteralPath (Join-Path $resolvedRoot ".git")) {
        throw "Validation runtime must never contain .git: $resolvedRoot"
    }
    $markerPath = Join-Path $resolvedRoot ".forever-validation-run.json"
    if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
        throw "Validation runtime ownership marker is missing: $markerPath"
    }
    $marker = Get-Content -LiteralPath $markerPath -Raw | ConvertFrom-Json
    if (-not [string]::Equals([string]$marker.runtimeRoot, $resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Validation runtime ownership marker does not match its directory: $resolvedRoot"
    }
    return $marker
}

function New-ForeverValidationRuntime {
    param(
        [string]$RunParent = $script:ValidationRunParent,
        [string]$RunId = ("validation-{0}-{1}" -f (Get-Date -Format "yyyyMMddTHHmmssfffZ"), ([Guid]::NewGuid().ToString("N").Substring(0, 12)))
    )
    if ($RunId -notmatch '^[a-z0-9][a-z0-9-]{7,127}$') { throw "Validation run identity is invalid." }
    $resolvedParent = Assert-ForeverValidationRunParent -RunParent $RunParent
    if (-not (Test-Path -LiteralPath $resolvedParent)) {
        New-Item -ItemType Directory -Path $resolvedParent -Force -ErrorAction Stop | Out-Null
    }
    $resolvedParent = (Resolve-Path -LiteralPath $resolvedParent).ProviderPath
    [void](Assert-ForeverValidationRunParent -RunParent $resolvedParent)
    $runtimeRoot = [System.IO.Path]::GetFullPath((Join-Path $resolvedParent $RunId))
    $parentPrefix = $resolvedParent.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    if (-not $runtimeRoot.StartsWith($parentPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Validation runtime escaped its approved parent."
    }
    if (Test-Path -LiteralPath $runtimeRoot) {
        throw "Validation runtime destination already exists and is not owned by this new run: $runtimeRoot"
    }
    New-Item -ItemType Directory -Path $runtimeRoot -ErrorAction Stop | Out-Null
    try {
        if ((Test-ForeverGitWorktree -Path $runtimeRoot) -or (Test-Path -LiteralPath (Join-Path $runtimeRoot ".git"))) {
            throw "New validation runtime unexpectedly resolves as a Git worktree: $runtimeRoot"
        }
        $marker = [ordered]@{
            schemaVersion = 1
            runId = $RunId
            runtimeRoot = $runtimeRoot
            createdUtc = [DateTime]::UtcNow.ToString("o", [System.Globalization.CultureInfo]::InvariantCulture)
            owner = "forever-treasure-validation"
        } | ConvertTo-Json
        Set-Content -LiteralPath (Join-Path $runtimeRoot ".forever-validation-run.json") -Value $marker -Encoding UTF8
        Write-ForeverValidationRunEvent -RuntimeRoot $runtimeRoot -Event "created"
        [void](Assert-ForeverValidationRuntimeOwnership -RuntimeRoot $runtimeRoot)
        Write-Host "Created task-owned validation runtime: $runtimeRoot" -ForegroundColor DarkGray
        return $runtimeRoot
    } catch {
        if (Test-Path -LiteralPath $runtimeRoot) {
            $markerPath = Join-Path $runtimeRoot ".forever-validation-run.json"
            if (Test-Path -LiteralPath $markerPath) { Remove-Item -LiteralPath $runtimeRoot -Recurse -Force }
        }
        throw
    }
}

function Clear-ForeverValidationRuntime {
    param([Parameter(Mandatory)][string]$RuntimeRoot)
    $marker = Assert-ForeverValidationRuntimeOwnership -RuntimeRoot $RuntimeRoot
    $resolvedRoot = [System.IO.Path]::GetFullPath($RuntimeRoot)
    Write-ForeverValidationRunEvent -RuntimeRoot $resolvedRoot -Event "cleanup-requested"
    $parent = Split-Path -Parent $resolvedRoot
    $receipt = Join-Path $parent ("{0}.cleanup.json" -f [string]$marker.runId)
    $receiptBody = [ordered]@{
        runId = [string]$marker.runId
        runtimeRoot = $resolvedRoot
        cleanupStartedUtc = [DateTime]::UtcNow.ToString("o", [System.Globalization.CultureInfo]::InvariantCulture)
        reason = "owned-validation-runtime-cleanup"
    } | ConvertTo-Json
    Set-Content -LiteralPath $receipt -Value $receiptBody -Encoding UTF8
    $runtimeModules = Join-Path $resolvedRoot "node_modules"
    if (Test-Path -LiteralPath $runtimeModules) {
        $modulesItem = Get-Item -LiteralPath $runtimeModules -Force
        if ($modulesItem.LinkType -eq "Junction") {
            # Delete the owned link itself before recursive cleanup; never
            # traverse into a dependency seed owned by the hosted checkout.
            [System.IO.Directory]::Delete($runtimeModules)
            if (Test-Path -LiteralPath $runtimeModules) { throw "Validation dependency junction cleanup did not remove the owned link." }
        }
    }
    Remove-Item -LiteralPath $resolvedRoot -Recurse -Force
    if (Test-Path -LiteralPath $resolvedRoot) { throw "Owned validation runtime cleanup did not remove $resolvedRoot" }
    Add-Content -LiteralPath $receipt -Value ("cleanupCompletedUtc={0}" -f [DateTime]::UtcNow.ToString("o", [System.Globalization.CultureInfo]::InvariantCulture)) -Encoding UTF8
}

function Sync-ForeverRuntime {
    param([ValidateSet("development", "validation")][string]$Mode = "development")
    $isNetworkPath = $script:ProjectRoot.StartsWith("\\")
    if (-not $isNetworkPath -and $Mode -eq "development") { return $script:ProjectRoot }
    if ($Mode -eq "validation") {
        $runtimeRoot = New-ForeverValidationRuntime
    } else {
        $runtimeRoot = Join-Path $script:RuntimeBase $Mode
        if (-not (Test-Path -LiteralPath $runtimeRoot)) { New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null }
    }
    $resolvedRuntime = [System.IO.Path]::GetFullPath($runtimeRoot)
    if ($Mode -eq "validation") { [void](Assert-ForeverValidationRuntimeOwnership -RuntimeRoot $resolvedRuntime) }
    $excludedDirectories = @(
        foreach ($directoryName in @(
            ".git",
            ".forever",
            "node_modules",
            "node_modules.failed",
            ".next",
            "artifacts",
            "coverage",
            "test-results",
            "playwright-report"
        )) {
            Join-Path $script:ProjectRoot $directoryName
        }
    )
    & robocopy $script:ProjectRoot $resolvedRuntime /E /XD $excludedDirectories /XF .git *.db *.db-journal *.log .forever-dev.json .forever-lock.sha | Out-Null
    if ($LASTEXITCODE -gt 7) { throw "Unable to synchronize the local runtime mirror (robocopy exit $LASTEXITCODE)." }
    if ($Mode -eq "validation") {
        [void](Assert-ForeverValidationRuntimeOwnership -RuntimeRoot $resolvedRuntime)
        Write-ForeverValidationRunEvent -RuntimeRoot $resolvedRuntime -Event "source-synchronized"
    }
    return $resolvedRuntime
}

function Get-ForeverCanonicalDatabase {
    $canonicalRoot = if ($script:ProjectRoot.StartsWith("\\")) {
        Join-Path $script:RuntimeBase "development"
    } else {
        $script:ProjectRoot
    }
    $resolvedRoot = [System.IO.Path]::GetFullPath($canonicalRoot)
    $databasePath = [System.IO.Path]::GetFullPath((Join-Path $resolvedRoot "prisma\dev.db"))
    $rootPrefix = $resolvedRoot.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    if (-not $databasePath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Canonical database path is outside the approved development runtime."
    }
    if (-not (Test-Path -LiteralPath $databasePath -PathType Leaf)) {
        throw "Canonical development database is missing: $databasePath"
    }
    return $databasePath
}

function Use-ForeverDependencySeed {
    param([Parameter(Mandatory)][string]$RuntimeRoot)
    $seedRoot = [string]$env:FOREVER_DEPENDENCY_SEED_ROOT
    if ([string]::IsNullOrWhiteSpace($seedRoot)) { return $false }
    $resolvedRuntime = [System.IO.Path]::GetFullPath($RuntimeRoot)
    $resolvedSeed = [System.IO.Path]::GetFullPath($seedRoot)
    if ($resolvedSeed -eq $resolvedRuntime) { throw "Dependency seed must not be the validation runtime." }
    $runtimeLock = Join-Path $resolvedRuntime "package-lock.json"
    $seedLock = Join-Path $resolvedSeed "package-lock.json"
    $seedModules = Join-Path $resolvedSeed "node_modules"
    $runtimeModules = Join-Path $resolvedRuntime "node_modules"
    if (-not (Test-Path -LiteralPath $seedModules -PathType Container)) { throw "Sounding Line dependency seed is missing node_modules." }
    if (-not (Test-Path -LiteralPath (Join-Path $seedModules "next\package.json") -PathType Leaf)) { throw "Sounding Line dependency seed is incomplete." }
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $runtimeLock).Hash -ne (Get-FileHash -Algorithm SHA256 -LiteralPath $seedLock).Hash) {
        throw "Sounding Line dependency seed lockfile does not match the isolated runtime."
    }
    if (Test-Path -LiteralPath $runtimeModules) { throw "Validation runtime already has a node_modules path before dependency seeding." }
    # A junction avoids a second npm ci in a disposable browser runtime while
    # preserving the exact hosted lockfile and isolating all mutable app data.
    New-Item -ItemType Junction -Path $runtimeModules -Target $seedModules -ErrorAction Stop | Out-Null
    $link = Get-Item -LiteralPath $runtimeModules -Force
    if ($link.LinkType -ne "Junction") { throw "Sounding Line dependency seed was not created as a junction." }
    Set-Content -LiteralPath (Join-Path $resolvedRuntime ".forever-dependency-seed.json") -Encoding UTF8 -Value (@{
        seedRoot = $resolvedSeed
        lockSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $runtimeLock).Hash
        mode = "read-only-hosted-dependency-seed"
    } | ConvertTo-Json)
    Write-Host "Using lockfile-matched hosted dependency seed." -ForegroundColor DarkGray
    return $true
}

function Install-ForeverDependencies {
    param([Parameter(Mandatory)][string]$RuntimeRoot)
    $lock = Join-Path $RuntimeRoot "package-lock.json"
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $lock).Hash
    $marker = Join-Path $RuntimeRoot ".forever-lock.sha"
    $installed = Test-Path (Join-Path $RuntimeRoot "node_modules\next\package.json")
    $currentHash = if (Test-Path $marker) { (Get-Content -Raw $marker).Trim() } else { "" }
    if (-not $installed -or $currentHash -ne $hash) {
        if (Use-ForeverDependencySeed -RuntimeRoot $RuntimeRoot) {
            Set-Content -LiteralPath $marker -Value $hash -Encoding ASCII
            return
        }
        Write-Host "Installing pinned dependencies..." -ForegroundColor Cyan
        Invoke-ForeverNpm -WorkingDirectory $RuntimeRoot -Arguments @("ci", "--no-audit", "--no-fund")
        Set-Content -LiteralPath $marker -Value $hash -Encoding ASCII
    } else { Write-Host "Dependencies are current." -ForegroundColor DarkGray }
}

function Invoke-ForeverNode {
    param([Parameter(Mandatory)][string]$WorkingDirectory, [Parameter(ValueFromRemainingArguments)][string[]]$Arguments)
    Push-Location $WorkingDirectory
    try {
        & (Get-ForeverNode) @Arguments | Out-Host
        if ($LASTEXITCODE -ne 0) { throw "Node command failed with exit code $LASTEXITCODE." }
    } finally { Pop-Location }
}

function Initialize-ForeverRuntime {
    param([ValidateSet("development", "validation")][string]$Mode = "development", [switch]$ResetDatabase)
    $environmentPath = Ensure-ForeverEnvironment
    $runtimeRoot = Sync-ForeverRuntime -Mode $Mode
    Install-ForeverDependencies -RuntimeRoot $runtimeRoot
    $runtimeEnvironment = Join-Path $runtimeRoot ".env"
    Import-ForeverEnvironment -Path $runtimeEnvironment
    if ($Mode -eq "validation") { $env:DATABASE_URL = "file:./validation.db" }
    $databaseName = if ($Mode -eq "validation") { "validation.db" } else { "dev.db" }
    $databasePath = Join-Path $runtimeRoot "prisma\$databaseName"
    if ($ResetDatabase -and (Test-Path $databasePath)) { Remove-Item -LiteralPath $databasePath -Force }
    if (-not (Test-Path $databasePath)) { New-Item -ItemType File -Path $databasePath | Out-Null }
    Write-Host "Generating the database client..." -ForegroundColor Cyan
    Invoke-ForeverNode -WorkingDirectory $runtimeRoot -Arguments @("node_modules/prisma/build/index.js", "generate", "--schema", "prisma/schema.sqlite.prisma")
    Write-Host "Applying database migrations..." -ForegroundColor Cyan
    Invoke-ForeverNode -WorkingDirectory $runtimeRoot -Arguments @("node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "prisma/schema.sqlite.prisma")
    if ($Mode -eq "development") {
        Write-Host "Ensuring development seed data without resetting voyage progress..." -ForegroundColor Cyan
        Invoke-ForeverNode -WorkingDirectory $runtimeRoot -Arguments @("node_modules/tsx/dist/cli.mjs", "prisma/seed.ts", "--ensure")
    } else {
        Write-Host "Verifying development seed data..." -ForegroundColor Cyan
        Invoke-ForeverNode -WorkingDirectory $runtimeRoot -Arguments @("node_modules/tsx/dist/cli.mjs", "prisma/seed.ts")
    }
    return $runtimeRoot
}

function Wait-ForeverHttp {
    param([Parameter(Mandatory)][string]$Url, [int]$Seconds = 60)
    $deadline = (Get-Date).AddSeconds($Seconds)
    do {
        try { $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2; if ($response.StatusCode -lt 500) { return } } catch { Start-Sleep -Milliseconds 500 }
    } while ((Get-Date) -lt $deadline)
    throw "The application did not become ready at $Url within $Seconds seconds."
}
