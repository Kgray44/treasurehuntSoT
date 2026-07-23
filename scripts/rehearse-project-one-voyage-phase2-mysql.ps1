[CmdletBinding()]
param(
  [int]$Port = 33316,
  [switch]$KeepArtifacts
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw "Node.js is required for the Phase 2 MySQL rehearsal." }
$mysqlBin = "C:\Program Files\MySQL\MySQL Server 8.0\bin"
foreach ($tool in @("mysqld.exe", "mysql.exe", "mysqldump.exe")) {
  if (-not (Test-Path -LiteralPath (Join-Path $mysqlBin $tool))) { throw "MySQL 8 tool missing: $tool" }
}

$runId = "one-voyage-phase2-" + [Guid]::NewGuid().ToString("N")
$runRoot = Join-Path $env:LOCALAPPDATA "ForeverTreasureCompanion\rehearsals\$runId"
$dataDir = Join-Path $runRoot "data"
$logFile = Join-Path $runRoot "mysql.log"
$configFile = Join-Path $runRoot "my.ini"
$schema = "phase2_" + ([Guid]::NewGuid().ToString("N").Substring(0, 12))
$restoreSchema = "${schema}_restore"
$runtimeUser = "phase2_runtime"
$passwordBytes = New-Object byte[] 24
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($passwordBytes)
$runtimePassword = ([System.BitConverter]::ToString($passwordBytes)).Replace("-", "").ToLowerInvariant()
$process = $null

function Invoke-MySql([string]$sql, [string]$database = "", [string]$user = "root", [string]$password = "") {
  $arguments = @("--protocol=TCP", "--host=127.0.0.1", "--port=$Port", "--user=$user", "--batch", "--skip-column-names")
  if ($password) { $arguments += "--password=$password" } else { $arguments += "--skip-password" }
  if ($database) { $arguments += "--database=$database" }
  $arguments += @("--execute=$sql")
  $previousPreference = $ErrorActionPreference; $ErrorActionPreference = "Continue"
  try { $result = & (Join-Path $mysqlBin "mysql.exe") @arguments 2>$null; $exitCode = $LASTEXITCODE } finally { $ErrorActionPreference = $previousPreference }
  if ($exitCode -ne 0) { throw "mysql failed: $result" }
  return $result
}

function Invoke-MySqlFile([string]$file, [string]$database) {
  $arguments = @("--protocol=TCP", "--host=127.0.0.1", "--port=$Port", "--user=root", "--skip-password", "--database=$database")
  Get-Content -LiteralPath $file -Raw | & (Join-Path $mysqlBin "mysql.exe") @arguments
  if ($LASTEXITCODE -ne 0) { throw "MySQL migration failed: $(Split-Path -Leaf $file)" }
}

function Invoke-MySqlPipe([string]$sql) {
  $previousPreference = $ErrorActionPreference; $ErrorActionPreference = "Continue"
  try { $result = & (Join-Path $mysqlBin "mysql.exe") "--protocol=PIPE" "--socket=MySQL" "--user=root" "--skip-password" "--execute=$sql" 2>$null; $exitCode = $LASTEXITCODE } finally { $ErrorActionPreference = $previousPreference }
  if ($exitCode -ne 0) { throw "bootstrap mysql failed: $result" }
  return $result
}

function Write-MySqlConfig([bool]$Bootstrap) {
  $bootstrapLine = if ($Bootstrap) { "skip-grant-tables" } else { "" }
  @"
[mysqld]
basedir=$mysqlBinConfig
datadir=$dataDirConfig
port=$Port
bind-address=127.0.0.1
named-pipe
skip-name-resolve
log-error=$logFileConfig
$bootstrapLine
"@ | Set-Content -LiteralPath $configFile -NoNewline
}

function Stop-Phase2MySql {
  Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq "mysqld.exe" -and $_.CommandLine -like "*$runId*"
  } | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    Wait-Process -Id $_.ProcessId -ErrorAction SilentlyContinue
  }
  $process = $null
}

try {
  New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
  $mysqlBinConfig = $mysqlBin.Replace("\", "/")
  $dataDirConfig = $dataDir.Replace("\", "/")
  $logFileConfig = $logFile.Replace("\", "/")
  Write-MySqlConfig $true
  & (Join-Path $mysqlBin "mysqld.exe") "--defaults-file=$configFile" --initialize-insecure
  if ($LASTEXITCODE -ne 0) { throw "MySQL initialization failed." }
  $process = Start-Process -FilePath (Join-Path $mysqlBin "mysqld.exe") -ArgumentList "--defaults-file=$configFile" -WindowStyle Hidden -PassThru
  Start-Sleep -Seconds 5
  Invoke-MySqlPipe "SELECT 1" | Out-Null
  Invoke-MySqlPipe "FLUSH PRIVILEGES; CREATE USER IF NOT EXISTS 'root'@'127.0.0.1' IDENTIFIED BY ''; GRANT ALL PRIVILEGES ON *.* TO 'root'@'127.0.0.1' WITH GRANT OPTION; FLUSH PRIVILEGES;"
  Stop-Phase2MySql
  Write-MySqlConfig $false
  $process = Start-Process -FilePath (Join-Path $mysqlBin "mysqld.exe") -ArgumentList "--defaults-file=$configFile" -WindowStyle Hidden -PassThru
  $deadline = (Get-Date).AddSeconds(45)
  do {
    Start-Sleep -Milliseconds 250
    try { Invoke-MySql "SELECT 1" | Out-Null; $ready = $true } catch { $ready = $false }
  } while (-not $ready -and (Get-Date) -lt $deadline)
  if (-not $ready) { throw "Disposable MySQL did not restart after bootstrap. See $logFile" }

  Invoke-MySql "CREATE DATABASE ``$schema`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
  $orderedMigrations = @(
    "0001_init", "0002_player_companion_shell", "0002_game_master_command_center", "0003_chronicle_studio_phase1",
    "0004_chronicle_platform", "0005_project_one_voyage", "0006_wayfarer_unified_identity",
    "0007_project_sealed_hold_phase1", "0008_cross_project_ownership_constraints",
    "0009_project_harborlight_phase1", "0010_project_harborlight_relations_outbox", "0011_project_one_voyage_phase2_observation"
  )
  foreach ($migration in $orderedMigrations) {
    Invoke-MySqlFile (Join-Path $projectRoot "prisma\mysql-migrations\$migration\migration.sql") $schema
  }
  Invoke-MySql "CREATE USER '$runtimeUser'@'127.0.0.1' IDENTIFIED BY '$runtimePassword'; GRANT SELECT, INSERT, UPDATE, DELETE ON ``$schema``.* TO '$runtimeUser'@'127.0.0.1'; FLUSH PRIVILEGES;"
  $previousPreference = $ErrorActionPreference; $ErrorActionPreference = "Continue"
  try {
    $ddlAttempt = & (Join-Path $mysqlBin "mysql.exe") "--protocol=TCP" "--host=127.0.0.1" "--port=$Port" "--user=$runtimeUser" "--password=$runtimePassword" "--database=$schema" "--execute=CREATE TABLE forbidden_runtime_ddl (id INT)" 2>$null
    $ddlExitCode = $LASTEXITCODE
  } finally { $ErrorActionPreference = $previousPreference }
  if ($ddlExitCode -eq 0) { throw "Runtime MySQL account unexpectedly performed DDL." }

  $env:DATABASE_URL = "mysql://$($runtimeUser):$($runtimePassword)@127.0.0.1:$Port/$schema"
  & $node (Join-Path $projectRoot "node_modules\prisma\build\index.js") generate --schema prisma/schema.prisma
  if ($LASTEXITCODE -ne 0) { throw "MySQL Prisma generation failed." }
  Invoke-MySql "INSERT INTO Campaign (id, slug, title, status, accessCodeHash, currentSequence, finaleState, finaleRequirements, createdAt, updatedAt) VALUES ('phase2-campaign', 'phase2-mysql-proof', 'Phase 2 proof', 'ACTIVE', 'not-a-credential', 0, 'SEALED', '[]', NOW(3), NOW(3))" $schema
  & $node (Join-Path $projectRoot "node_modules\tsx\dist\cli.mjs") scripts/migrate-legacy-companion.ts
  if ($LASTEXITCODE -ne 0) { throw "Legacy migration against disposable MySQL failed." }
  & $node (Join-Path $projectRoot "node_modules\tsx\dist\cli.mjs") scripts/migrate-legacy-companion.ts --verify
  if ($LASTEXITCODE -ne 0) { throw "Legacy migration verification against disposable MySQL failed." }
  & $node (Join-Path $projectRoot "node_modules\tsx\dist\cli.mjs") scripts/migrate-legacy-companion.ts
  if ($LASTEXITCODE -ne 0) { throw "Legacy migration idempotency rerun against disposable MySQL failed." }
  & $node (Join-Path $projectRoot "node_modules\tsx\dist\cli.mjs") scripts/verify-legacy-shadow-parity.ts
  if ($LASTEXITCODE -ne 0) { throw "Legacy shadow parity against disposable MySQL failed." }
  & $node (Join-Path $projectRoot "node_modules\tsx\dist\cli.mjs") scripts/project-one-voyage-phase2-mysql-runtime-proof.ts
  if ($LASTEXITCODE -ne 0) { throw "Canonical runtime proof against disposable MySQL failed." }

  $dumpFile = Join-Path $runRoot "canonical-backup.sql"
  & (Join-Path $mysqlBin "mysqldump.exe") "--protocol=TCP" "--host=127.0.0.1" "--port=$Port" "--user=root" "--skip-password" "--single-transaction" "--no-create-db" "--skip-add-drop-table" $schema | Out-File -LiteralPath $dumpFile -Encoding utf8
  if ($LASTEXITCODE -ne 0) { throw "MySQL backup failed." }
  $backupHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $dumpFile).Hash.ToLowerInvariant()
  Invoke-MySql "CREATE DATABASE ``$restoreSchema`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
  Get-Content -LiteralPath $dumpFile -Raw | & (Join-Path $mysqlBin "mysql.exe") "--protocol=TCP" "--host=127.0.0.1" "--port=$Port" "--user=root" "--skip-password" "--database=$restoreSchema"
  if ($LASTEXITCODE -ne 0) { throw "MySQL restore failed." }
  $sourceCounts = Invoke-MySql "SELECT (SELECT COUNT(*) FROM TaleSessionEvent), (SELECT COUNT(*) FROM PlatformAuditEvent), (SELECT COUNT(*) FROM CompatibilityObservation)" $schema
  $restoredCounts = Invoke-MySql "SELECT (SELECT COUNT(*) FROM TaleSessionEvent), (SELECT COUNT(*) FROM PlatformAuditEvent), (SELECT COUNT(*) FROM CompatibilityObservation)" $restoreSchema
  if ($sourceCounts -ne $restoredCounts) { throw "Restored semantic/audit/observation counts do not match source." }
  Stop-Phase2MySql
  $process = Start-Process -FilePath (Join-Path $mysqlBin "mysqld.exe") -ArgumentList "--defaults-file=$configFile" -WindowStyle Hidden -PassThru
  $deadline = (Get-Date).AddSeconds(45)
  do { Start-Sleep -Milliseconds 250; try { Invoke-MySql "SELECT 1" | Out-Null; $ready = $true } catch { $ready = $false } } while (-not $ready -and (Get-Date) -lt $deadline)
  if (-not $ready) { throw "MySQL restart proof failed." }
  Invoke-MySql "SELECT COUNT(*) FROM TaleSessionEvent" $schema | Out-Null
  [pscustomobject]@{ status = "passed"; schema = $schema; restoredSchema = $restoreSchema; backupSha256 = $backupHash; migrations = $orderedMigrations.Count; runtimeDdlDenied = $true; legacyWritesObserved = 0; restarts = 1 } | ConvertTo-Json -Compress
}
finally {
  Stop-Phase2MySql
  if (-not $KeepArtifacts -and (Test-Path -LiteralPath $runRoot)) { Remove-Item -LiteralPath $runRoot -Recurse -Force }
}
