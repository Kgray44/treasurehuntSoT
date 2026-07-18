param([switch]$SkipBrowserInstall)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "dev-common.ps1")

$runtimeRoot = Initialize-ForeverRuntime -Mode validation -ResetDatabase
$nextCache = Join-Path $runtimeRoot ".next"
if (Test-Path -LiteralPath $nextCache) {
    $resolvedRuntime = [System.IO.Path]::GetFullPath($runtimeRoot)
    $resolvedCache = [System.IO.Path]::GetFullPath($nextCache)
    if (-not $resolvedCache.StartsWith($resolvedRuntime, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe validation cache path." }
    Remove-Item -LiteralPath $resolvedCache -Recurse -Force
}
$validationArtifacts = Join-Path $runtimeRoot "artifacts\validation"
if (Test-Path -LiteralPath $validationArtifacts) {
    $resolvedRuntime = [System.IO.Path]::GetFullPath($runtimeRoot)
    $resolvedArtifacts = [System.IO.Path]::GetFullPath($validationArtifacts)
    if (-not $resolvedArtifacts.StartsWith($resolvedRuntime, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe validation artifact path." }
    Remove-Item -LiteralPath $resolvedArtifacts -Recurse -Force
}
$node = Get-ForeverNode
$nodeDirectory = Split-Path $node
$env:PATH = "$nodeDirectory;$env:PATH"
if (-not $env:PLAYWRIGHT_BASE_URL) { $env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3100" }
$productionPort = if ($env:FOREVER_VALIDATION_PRODUCTION_PORT) { [int]$env:FOREVER_VALIDATION_PRODUCTION_PORT } else { 3200 }
if (-not $env:GM_USERNAME) { $env:GM_USERNAME = "kato" }
if (-not $env:GM_PASSWORD) { $env:GM_PASSWORD = "development-captain-only" }
if (-not $env:PLAYER_ACCESS_CODE) { $env:PLAYER_ACCESS_CODE = "development-moonwake" }
$env:VALIDATION_ARTIFACTS = Join-Path $runtimeRoot "artifacts\validation"

function Invoke-ValidationStep {
    param([Parameter(Mandatory)][string]$Name, [Parameter(Mandatory)][string[]]$Arguments)
    Write-Host "`n==> $Name" -ForegroundColor Cyan
    Invoke-ForeverNode -WorkingDirectory $runtimeRoot -Arguments $Arguments
}

if (-not $SkipBrowserInstall) {
    Invoke-ValidationStep -Name "Installing Playwright browsers" -Arguments @("node_modules/playwright/cli.js", "install", "chromium", "webkit")
}
Invoke-ValidationStep -Name "Checking formatting" -Arguments @("node_modules/prettier/bin/prettier.cjs", "--check", ".")
Invoke-ValidationStep -Name "Linting" -Arguments @("node_modules/eslint/bin/eslint.js", ".")
Invoke-ValidationStep -Name "Type checking" -Arguments @("node_modules/typescript/bin/tsc", "--noEmit")
Invoke-ValidationStep -Name "Running unit tests" -Arguments @("node_modules/vitest/vitest.mjs", "run")
Invoke-ValidationStep -Name "Validating animation assets" -Arguments @("node_modules/tsx/dist/cli.mjs", "scripts/validate-animation-assets.ts")
Invoke-ValidationStep -Name "Verifying seeded database" -Arguments @("node_modules/tsx/dist/cli.mjs", "scripts/verify-database.ts")
Invoke-ValidationStep -Name "Running browser acceptance tests" -Arguments @("node_modules/playwright/cli.js", "test")
Invoke-ValidationStep -Name "Verifying accepted database state" -Arguments @("node_modules/tsx/dist/cli.mjs", "scripts/verify-database.ts", "--acceptance")
Invoke-ValidationStep -Name "Proving launcher seed preserves accepted progress" -Arguments @("node_modules/tsx/dist/cli.mjs", "prisma/seed.ts", "--ensure")
Invoke-ValidationStep -Name "Rechecking preserved database state" -Arguments @("node_modules/tsx/dist/cli.mjs", "scripts/verify-database.ts", "--acceptance")
Invoke-ValidationStep -Name "Creating production build" -Arguments @("node_modules/next/dist/bin/next", "build")

function Test-ProductionStart {
    param([int]$Port)
    $stdout = Join-Path $runtimeRoot "artifacts\validation\production-$Port.out.log"
    $stderr = Join-Path $runtimeRoot "artifacts\validation\production-$Port.err.log"
    New-Item -ItemType Directory -Path (Split-Path $stdout) -Force | Out-Null
    $process = Start-Process -FilePath $node -ArgumentList "node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "$Port" -WorkingDirectory $runtimeRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    try {
        Wait-ForeverHttp -Url "http://127.0.0.1:$Port" -Seconds 45
        $showcaseStatus = 0
        try {
            $showcaseResponse = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/dev/animations" -UseBasicParsing -TimeoutSec 10
            $showcaseStatus = [int]$showcaseResponse.StatusCode
        } catch {
            if ($_.Exception.Response) { $showcaseStatus = [int]$_.Exception.Response.StatusCode }
            else { throw }
        }
        if ($showcaseStatus -ne 404) { throw "Development animation showcase returned HTTP $showcaseStatus in production." }
    }
    finally { if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force; [void]$process.WaitForExit(10000) } }
}

Write-Host "`n==> Proving production restart safety" -ForegroundColor Cyan
Test-ProductionStart -Port $productionPort
Test-ProductionStart -Port $productionPort
Write-Host "`nFull validation passed. Reports and screenshots: $env:VALIDATION_ARTIFACTS" -ForegroundColor Green
