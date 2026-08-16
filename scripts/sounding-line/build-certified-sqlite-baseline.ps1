param([Parameter(Mandatory)][string]$OutDirectory)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "..\dev-common.ps1")

# The trusted producer may run from a clean hosted checkout. Reuse only the
# verified dependency layer already present in that checkout; do not trigger a
# second package installation while constructing the immutable database.
if (-not $env:FOREVER_DEPENDENCY_SEED_ROOT) {
    $env:FOREVER_DEPENDENCY_SEED_ROOT = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
}

if (-not [System.IO.Path]::IsPathRooted($OutDirectory)) {
    throw "Certified SQLite baseline output must be absolute."
}
if (Test-Path -LiteralPath $OutDirectory) {
    throw "Certified SQLite baseline output must be new and empty."
}
New-Item -ItemType Directory -Path $OutDirectory -Force | Out-Null
$runtimeRoot = $null
try {
    # This is the one trusted cold producer. Consumers only copy and verify its
    # immutable validation.db; they never share this mutable runtime database.
    $runtimeRoot = Initialize-ForeverRuntime -Mode validation -ResetDatabase
    # A certified baseline represents the same migrated-and-seeded starting
    # state that the isolated browser runtime expects. Focused suite fixtures
    # remain task-owned deltas and are never written back to this artifact.
    Invoke-ForeverNode -WorkingDirectory $runtimeRoot -Arguments @("node_modules/tsx/dist/cli.mjs", "prisma/seed.ts")
    $source = Join-Path $runtimeRoot "prisma\validation.db"
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        throw "Certified SQLite baseline producer did not create validation.db."
    }
    Copy-Item -LiteralPath $source -Destination (Join-Path $OutDirectory "validation.db") -ErrorAction Stop
} finally {
    if ($runtimeRoot -and (Test-Path -LiteralPath $runtimeRoot)) {
        Clear-ForeverValidationRuntime -RuntimeRoot $runtimeRoot
    }
}
