[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "dev-common.ps1")

$testParent = Join-Path $env:TEMP ("forever-validation-runtime-safety-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $testParent -ErrorAction Stop | Out-Null

function Assert-Throws {
    param([Parameter(Mandatory)][scriptblock]$Action, [Parameter(Mandatory)][string]$Label)
    try { & $Action } catch { return }
    throw "Expected failure did not occur: $Label"
}

try {
    Assert-Throws -Label "Git worktree destination" -Action {
        Assert-ForeverValidationRunParent -RunParent $projectRoot | Out-Null
    }

    $dirtyGit = Join-Path $testParent "dirty-git"
    New-Item -ItemType Directory -Path $dirtyGit | Out-Null
    & git -C $dirtyGit init --quiet
    Set-Content -LiteralPath (Join-Path $dirtyGit "intentional-untracked.txt") -Value "dirty" -Encoding ASCII
    Assert-Throws -Label "dirty Git worktree destination" -Action {
        Assert-ForeverValidationRunParent -RunParent $dirtyGit | Out-Null
    }

    $existingId = "validation-existing-non-owned"
    $existing = Join-Path $testParent $existingId
    New-Item -ItemType Directory -Path $existing | Out-Null
    Set-Content -LiteralPath (Join-Path $existing "do-not-own.txt") -Value "preserve" -Encoding ASCII
    Assert-Throws -Label "existing non-owned destination" -Action {
        New-ForeverValidationRuntime -RunParent $testParent -RunId $existingId | Out-Null
    }

    $runtime = New-ForeverValidationRuntime -RunParent $testParent -RunId "validation-fresh-owned"
    if (-not (Test-Path -LiteralPath (Join-Path $runtime ".forever-validation-run.json"))) {
        throw "Fresh non-Git validation runtime did not receive its ownership marker."
    }
    $historical = Join-Path $script:RuntimeBase "validation"
    if ([string]::Equals($runtime, $historical, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Historical fixed validation path was selected."
    }
    $sibling = Join-Path $testParent "sibling-sentinel"
    New-Item -ItemType Directory -Path $sibling | Out-Null
    Set-Content -LiteralPath (Join-Path $sibling "must-survive.txt") -Value "safe" -Encoding ASCII
    Clear-ForeverValidationRuntime -RuntimeRoot $runtime
    if (Test-Path -LiteralPath $runtime) { throw "Owned runtime survived cleanup." }
    if (-not (Test-Path -LiteralPath (Join-Path $sibling "must-survive.txt"))) {
        throw "Cleanup traversed outside the owned runtime."
    }
    Write-Host "Validation runtime safety regression tests passed." -ForegroundColor Green
} finally {
    if (Test-Path -LiteralPath $testParent) { Remove-Item -LiteralPath $testParent -Recurse -Force }
}
