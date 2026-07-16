param([switch]$SkipBrowserInstall)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "dev-common.ps1")

$runtimeRoot = Initialize-ForeverRuntime -Mode validation -ResetDatabase
$node = Get-ForeverNode
$nodeDirectory = Split-Path $node
$env:PATH = "$nodeDirectory;$env:PATH"
$env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3100"
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
Invoke-ValidationStep -Name "Verifying seeded database" -Arguments @("node_modules/tsx/dist/cli.mjs", "scripts/verify-database.ts")
Invoke-ValidationStep -Name "Running browser acceptance tests" -Arguments @("node_modules/playwright/cli.js", "test")
Invoke-ValidationStep -Name "Verifying accepted database state" -Arguments @("node_modules/tsx/dist/cli.mjs", "scripts/verify-database.ts", "--acceptance")
Invoke-ValidationStep -Name "Creating production build" -Arguments @("node_modules/next/dist/bin/next", "build")

function Test-ProductionStart {
    param([int]$Port)
    $stdout = Join-Path $runtimeRoot "artifacts\validation\production-$Port.out.log"
    $stderr = Join-Path $runtimeRoot "artifacts\validation\production-$Port.err.log"
    New-Item -ItemType Directory -Path (Split-Path $stdout) -Force | Out-Null
    $process = Start-Process -FilePath $node -ArgumentList "node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "$Port" -WorkingDirectory $runtimeRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    try { Wait-ForeverHttp -Url "http://127.0.0.1:$Port" -Seconds 45 }
    finally { if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force; [void]$process.WaitForExit(10000) } }
}

Write-Host "`n==> Proving production restart safety" -ForegroundColor Cyan
Test-ProductionStart -Port 3200
Test-ProductionStart -Port 3200
Write-Host "`nFull validation passed. Reports and screenshots: $env:VALIDATION_ARTIFACTS" -ForegroundColor Green
