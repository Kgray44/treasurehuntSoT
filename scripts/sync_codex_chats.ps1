[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$VerboseOutput,
    [switch]$NoPush,
    [switch]$ReportOnly,
    [switch]$Validate,
    [string[]]$Source
)

$ErrorActionPreference = "Stop"
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$venvCandidates = @(
    (Join-Path $repoRoot ".venv\Scripts\python.exe"),
    (Join-Path $repoRoot "venv\Scripts\python.exe")
)
$python = $venvCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $python) {
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pythonCommand) {
        Write-Error "Python was not found. Install Python 3.10+ or create .venv at the repository root."
        exit 127
    }
    $python = $pythonCommand.Source
}

$arguments = @((Join-Path $PSScriptRoot "sync_codex_chats.py"), "--repo", $repoRoot)
if ($DryRun) { $arguments += "--dry-run" }
if ($VerboseOutput) { $arguments += "--verbose" }
if ($NoPush) { $arguments += "--no-push" }
if ($ReportOnly) { $arguments += "--report-only" }
if ($Validate) { $arguments += "--validate" }
foreach ($item in $Source) { $arguments += @("--source", $item) }

try {
    & $python @arguments
    $exitCode = $LASTEXITCODE
} catch {
    Write-Error "Chat synchronization could not start: $($_.Exception.Message)"
    exit 1
}
exit $exitCode
