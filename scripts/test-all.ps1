# Exhaustive release-certification compatibility entrypoint.
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
& node (Join-Path $root "scripts/sounding-line/ordinary.mjs") "--mode" "release"
exit $LASTEXITCODE
