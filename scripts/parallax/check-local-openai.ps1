param([Parameter(Mandatory = $true)][string[]]$WorktreePaths)
$ErrorActionPreference = 'Stop'
$taskRepository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$taskProbe = Join-Path $PSScriptRoot 'check-openai-configuration.ts'
$taskTsx = Join-Path $taskRepository 'node_modules\tsx\dist\cli.mjs'
$taskNode = (Get-Command node -ErrorAction Stop).Source
$taskUserCredential = [Environment]::GetEnvironmentVariable('OPENAI_API_KEY', 'User')
$taskUserConfigured = -not [string]::IsNullOrWhiteSpace($taskUserCredential)
$taskRestartRequired = $taskUserConfigured -and ($taskUserCredential -cne $env:OPENAI_API_KEY)
$taskResults = foreach ($taskPath in $WorktreePaths) {
  $taskDirectory = (Resolve-Path -LiteralPath $taskPath -ErrorAction Stop).Path
  if (-not (Test-Path -LiteralPath (Join-Path $taskDirectory '.git'))) { throw 'Each diagnostic directory must be a Git checkout.' }
  $taskStart = [Diagnostics.ProcessStartInfo]::new()
  $taskStart.FileName = $taskNode
  $taskStart.WorkingDirectory = $taskDirectory
  $taskStart.UseShellExecute = $false
  $taskStart.CreateNoWindow = $true
  $taskStart.RedirectStandardOutput = $true
  $taskStart.RedirectStandardError = $true
  foreach ($taskArgument in @($taskTsx, '--tsconfig', (Join-Path $taskRepository 'tsconfig.json'), $taskProbe)) { [void]$taskStart.ArgumentList.Add($taskArgument) }
  # Fresh child launch from the Windows user credential. Memory only: no files,
  # command-line secret, registry mutation, shared server restart or paid invocation.
  if ($taskUserConfigured) { $taskStart.Environment['OPENAI_API_KEY'] = $taskUserCredential }
  else { [void]$taskStart.Environment.Remove('OPENAI_API_KEY') }
  $taskChild = [Diagnostics.Process]::Start($taskStart)
  $taskOutput = $taskChild.StandardOutput.ReadToEnd()
  [void]$taskChild.StandardError.ReadToEnd()
  $taskChild.WaitForExit()
  if ($taskChild.ExitCode -ne 0) { throw 'Configuration probe failed; raw child output is suppressed.' }
  $taskSafe = $taskOutput | ConvertFrom-Json
  [pscustomobject]@{ worktree = $taskDirectory; configured = [bool]$taskSafe.configured; provider = 'OPENAI'; networkRequests = 0; adapterSource = $taskRepository }
  $taskChild.Dispose()
}
[pscustomobject]@{ windowsUserConfigured = $taskUserConfigured; currentProcessConfigured = -not [string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY); currentProcessRestartRequired = $taskRestartRequired; checks = @($taskResults) } | ConvertTo-Json -Depth 4
$taskUserCredential = $null
