import { DatabaseSync } from "node:sqlite";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..", "..");
const migrationsRoot = join(repositoryRoot, "prisma", "migrations");
const mysqlMigrations = [
  [
    "0054_drydock_phase2_validation_reports",
    [
      "CREATE TABLE `DrydockValidationRun`",
      "`draftId`",
      "`runId`",
      "`sourceChecksum`",
      "`sourceRevision`",
      "`report` LONGTEXT",
      "DrydockValidationRun_draftId_fkey",
    ],
  ],
  [
    "0055_drydock_phase2_rule_waivers",
    [
      "CREATE TABLE `DrydockRuleWaiver`",
      "`issueId`",
      "`sourceChecksum`",
      "`sourceRevision`",
      "`authorizedByAccountId`",
      "DrydockRuleWaiver_draftId_fkey",
    ],
  ],
];
const temporaryRoot = await mkdtemp(join(tmpdir(), "drydock-phase2-migration-"));
const databasePath = join(temporaryRoot, "rehearsal.db");
const applied = [];

try {
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON;");
  for (const name of (await readdir(migrationsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()) {
    const migrationPath = join(migrationsRoot, name, "migration.sql");
    try {
      database.exec(await readFile(migrationPath, "utf8"));
      applied.push(name);
    } catch (cause) {
      throw new Error(
        `DRYDOCK_MIGRATION_REHEARSAL_FAILED:${name}:${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  }
  const table = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get("DrydockValidationRun");
  if (!table) throw new Error("DRYDOCK_MIGRATION_REHEARSAL_TABLE_MISSING");
  for (const [name, requiredFragments] of mysqlMigrations) {
    const mysqlMigration = await readFile(
      join(repositoryRoot, "prisma", "mysql-migrations", name, "migration.sql"),
      "utf8",
    );
    for (const requiredFragment of requiredFragments)
      if (!mysqlMigration.includes(requiredFragment))
        throw new Error(`DRYDOCK_MYSQL_MIGRATION_PARITY_MISSING:${name}:${requiredFragment}`);
  }
  const foreignKeyViolations = database.prepare("PRAGMA foreign_key_check;").all();
  if (foreignKeyViolations.length) throw new Error("DRYDOCK_MIGRATION_REHEARSAL_FOREIGN_KEY_VIOLATION");
  database.close();
  process.stdout.write(
    `${JSON.stringify({ valid: true, appliedMigrationCount: applied.length, finalMigration: applied.at(-1), table: "DrydockValidationRun", mysqlParity: "STATIC_VERIFIED" })}\n`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
