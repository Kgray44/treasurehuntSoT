# Compatibility entrypoint retained for callers that have not migrated.
# It deliberately owns no plan, resource, test, or release decision.
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
& node (Join-Path $root "scripts/sounding-line/authority.mjs") "mainline" "--serial"
exit $LASTEXITCODE
