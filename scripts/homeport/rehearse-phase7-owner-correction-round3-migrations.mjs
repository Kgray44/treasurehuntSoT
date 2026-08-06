import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(process.cwd());
const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const ownedRoot = path.resolve("C:/Users/kkids/AppData/Local/ProjectHomeport");
const finalMigration = "20260805230000_homeport_phase7_owner_correction_round3";
const sourceCopy = path.join(taskRoot, "immutable-seed", "owner-correction-round3-source-copy.db");
const rehearsalRoot = path.join(taskRoot, "migration-rehearsal-round3");

if (
  !taskRoot.startsWith(`${ownedRoot}${path.sep}`) ||
  !path.basename(taskRoot).startsWith("phase7-owner-correction-round3-")
)
  throw new Error(`HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND3_TASK_ROOT_REFUSED:${taskRoot}`);
if (!rehearsalRoot.startsWith(`${taskRoot}${path.sep}`))
  throw new Error(`MIGRATION_REHEARSAL_ROOT_REFUSED:${rehearsalRoot}`);

const migrationRoot = path.join(repositoryRoot, "prisma", "migrations");
const migrations = (await readdir(migrationRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
if (migrations.at(-1) !== finalMigration)
  throw new Error(`ROUND3_FINAL_SQLITE_MIGRATION_MISMATCH:${migrations.at(-1) ?? "NONE"}`);

await rm(rehearsalRoot, { recursive: true, force: true });
await mkdir(rehearsalRoot, { recursive: true });
const freshDatabase = path.join(rehearsalRoot, "fresh.db");
const populatedDatabase = path.join(rehearsalRoot, "populated-upgrade.db");
await copyFile(sourceCopy, populatedDatabase);

const payloadPath = path.join(rehearsalRoot, "migration-payload.json");
const pythonPath = path.join(rehearsalRoot, "apply-and-inspect.py");
const payload = {
  freshDatabase,
  populatedDatabase,
  migrations: await Promise.all(
    migrations.map(async (name) => {
      const sql = await readFile(path.join(migrationRoot, name, "migration.sql"), "utf8");
      return { name, sql, checksum: createHash("sha256").update(sql).digest("hex") };
    }),
  ),
};
await writeFile(payloadPath, `${JSON.stringify(payload)}\n`, "utf8");
await writeFile(
  pythonPath,
  `import datetime, json, sqlite3, sys\n\n` +
    `payload = json.load(open(sys.argv[1], encoding="utf-8"))\n` +
    `required_columns = {\n` +
    `  "UserAccount": ["ordinaryWorkspaceEntryAt"],\n` +
    `  "AccountToken": ["attemptCount", "maxAttempts", "lastAttemptAt"],\n` +
    `  "AccountSession": ["sessionType"],\n` +
    `  "ProfileMedia": ["ownerAccountId", "originalStorageKey", "processingState", "scanState", "cropCenterX", "cropCenterY", "cropScale"],\n` +
    `}\n` +
    `required_tables = ["TransactionalEmailDelivery", "TransactionalEmailEvent"]\n\n` +
    `def apply_all(database, fresh):\n` +
    `  connection = sqlite3.connect(database)\n` +
    `  connection.execute("PRAGMA foreign_keys=ON")\n` +
    `  connection.execute("CREATE TABLE IF NOT EXISTS _prisma_migrations (id TEXT PRIMARY KEY, checksum TEXT NOT NULL, finished_at DATETIME, migration_name TEXT NOT NULL, logs TEXT, rolled_back_at DATETIME, started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, applied_steps_count INTEGER NOT NULL DEFAULT 0)")\n` +
    `  applied = {row[0] for row in connection.execute("SELECT migration_name FROM _prisma_migrations WHERE rolled_back_at IS NULL AND finished_at IS NOT NULL")}\n` +
    `  executed = []\n` +
    `  for migration in payload["migrations"]:\n` +
    `    if migration["name"] in applied:\n` +
    `      continue\n` +
    `    connection.executescript(migration["sql"])\n` +
    `    now = datetime.datetime.now(datetime.timezone.utc).isoformat()\n` +
    `    connection.execute("INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count) VALUES (?, ?, ?, ?, ?, 1)", ("round3-" + migration["checksum"][:24], migration["checksum"], now, migration["name"], now))\n` +
    `    connection.commit()\n` +
    `    executed.append(migration["name"])\n` +
    `  integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]\n` +
    `  foreign_keys = list(connection.execute("PRAGMA foreign_key_check"))\n` +
    `  tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}\n` +
    `  columns = {table: {row[1] for row in connection.execute("PRAGMA table_info('" + table + "')")} for table in required_columns}\n` +
    `  result = {\n` +
    `    "fresh": fresh,\n` +
    `    "integrity": integrity,\n` +
    `    "foreignKeyFailures": len(foreign_keys),\n` +
    `    "tableCount": len(tables),\n` +
    `    "executedMigrations": executed,\n` +
    `    "requiredTables": {table: table in tables for table in required_tables},\n` +
    `    "requiredColumns": {table: {column: column in columns[table] for column in expected} for table, expected in required_columns.items()},\n` +
    `    "accountCount": connection.execute("SELECT COUNT(*) FROM UserAccount").fetchone()[0],\n` +
    `  }\n` +
    `  connection.close()\n` +
    `  return result\n\n` +
    `results = [apply_all(payload["freshDatabase"], True), apply_all(payload["populatedDatabase"], False)]\n` +
    `print(json.dumps(results))\n`,
  "utf8",
);

const execution = spawnSync("python", [pythonPath, payloadPath], {
  cwd: rehearsalRoot,
  encoding: "utf8",
  windowsHide: true,
});
if (execution.error) throw execution.error;
if (execution.status !== 0) throw new Error(`ROUND3_SQLITE_MIGRATION_REHEARSAL_FAILED:${execution.stderr}`);
const [fresh, populated] = JSON.parse(execution.stdout);
for (const result of [fresh, populated]) {
  if (
    result.integrity !== "ok" ||
    result.foreignKeyFailures !== 0 ||
    Object.values(result.requiredTables).some((value) => !value) ||
    Object.values(result.requiredColumns).some((columns) => Object.values(columns).some((value) => !value))
  )
    throw new Error(`ROUND3_SQLITE_MIGRATION_INVARIANT_FAILED:${JSON.stringify(result)}`);
}
if (fresh.accountCount !== 0) throw new Error(`ROUND3_FRESH_DATABASE_NOT_EMPTY:${fresh.accountCount}`);
if (populated.accountCount < 1) throw new Error(`ROUND3_POPULATED_DATABASE_LOST_DATA:${populated.accountCount}`);
if (!populated.executedMigrations.includes(finalMigration))
  throw new Error(`ROUND3_POPULATED_DATABASE_DID_NOT_APPLY:${finalMigration}`);

const receipt = {
  schema: "homeport.phase7.owner-correction-round3.migration-rehearsal.v1",
  status: "HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND3_MIGRATIONS_VALID",
  execution: "ORDERED_SQLITE_EXECUTESCRIPT_FALLBACK_AFTER_WINDOWS_SCHEMA_ENGINE_CREATE_FAILURE",
  truthBoundary:
    "The repository Prisma schema engine could migrate an existing populated clone but failed opaquely while creating a fresh SQLite file on this Windows host; ordered SQL was therefore applied to task-owned fresh and populated databases with SQLite integrity and foreign-key verification.",
  finalMigration,
  migrationCount: migrations.length,
  fresh,
  populated,
  databases: { fresh: freshDatabase, populated: populatedDatabase },
};
await writeFile(path.join(rehearsalRoot, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
