Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).ProviderPath
$script:RuntimeBase = Join-Path $env:LOCALAPPDATA "ForeverTreasureCompanion"

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

function Sync-ForeverRuntime {
    param([ValidateSet("development", "validation")][string]$Mode = "development")
    $isNetworkPath = $script:ProjectRoot.StartsWith("\\")
    if (-not $isNetworkPath -and $Mode -eq "development") { return $script:ProjectRoot }
    $runtimeRoot = Join-Path $script:RuntimeBase $Mode
    if (-not (Test-Path -LiteralPath $runtimeRoot)) { New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null }
    $resolvedBase = (Resolve-Path $script:RuntimeBase).ProviderPath
    $resolvedRuntime = (Resolve-Path $runtimeRoot).ProviderPath
    if (-not $resolvedRuntime.StartsWith($resolvedBase, [StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe runtime mirror path." }
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
            Join-Path $runtimeRoot $directoryName
        }
    )
    & robocopy $script:ProjectRoot $runtimeRoot /MIR /XD $excludedDirectories /XF *.db *.db-journal *.log .forever-dev.json .forever-lock.sha | Out-Null
    if ($LASTEXITCODE -gt 7) { throw "Unable to synchronize the local runtime mirror (robocopy exit $LASTEXITCODE)." }
    return $runtimeRoot
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

function Install-ForeverDependencies {
    param([Parameter(Mandatory)][string]$RuntimeRoot)
    $lock = Join-Path $RuntimeRoot "package-lock.json"
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $lock).Hash
    $marker = Join-Path $RuntimeRoot ".forever-lock.sha"
    $installed = Test-Path (Join-Path $RuntimeRoot "node_modules\next\package.json")
    $currentHash = if (Test-Path $marker) { (Get-Content -Raw $marker).Trim() } else { "" }
    if (-not $installed -or $currentHash -ne $hash) {
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
