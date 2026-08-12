import { DatabaseSync } from "node:sqlite";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..", "..");
const migrationsRoot = join(repositoryRoot, "prisma", "migrations");
const mysqlMigrations = [
  [
    "0057_drydock_phase3_simulation",
    [
      "CREATE TABLE `DrydockScenario`",
      "CREATE TABLE `DrydockScenarioRevision`",
      "CREATE TABLE `DrydockScenarioSuite`",
      "CREATE TABLE `DrydockSimulationRun`",
      "`sourceChecksum`",
      "`scenario` LONGTEXT",
      "DrydockSimulationRun_draftId_fkey",
    ],
  ],
  [
    "0058_drydock_phase3_run_provenance",
    ["ALTER TABLE `DrydockSimulationRun`", "`sourceGitSha`", "`scenarioSchemaVersion`", "`faultCatalogVersion`"],
  ],
];
const suiteMemberColumns = ["id", "suiteRecordId", "scenarioRevisionId", "orderIndex", "createdAt"];
const suiteMemberFields = [
  "id",
  "suiteRecordId",
  "scenarioRevisionId",
  "orderIndex",
  "createdAt",
  "suiteRecord",
  "scenarioRevision",
];
const temporaryRoot = await mkdtemp(join(tmpdir(), "drydock-phase3-migration-"));
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
        `DRYDOCK_PHASE3_MIGRATION_REHEARSAL_FAILED:${name}:${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  }
  for (const tableName of [
    "DrydockScenario",
    "DrydockScenarioRevision",
    "DrydockScenarioSuite",
    "DrydockScenarioSuiteMember",
    "DrydockSimulationRun",
  ]) {
    const table = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
    if (!table) throw new Error(`DRYDOCK_PHASE3_MIGRATION_TABLE_MISSING:${tableName}`);
  }
  const migratedSuiteMemberColumns = database
    .prepare('PRAGMA table_info("DrydockScenarioSuiteMember");')
    .all()
    .map((column) => column.name);
  if (JSON.stringify(migratedSuiteMemberColumns) !== JSON.stringify(suiteMemberColumns))
    throw new Error("DRYDOCK_PHASE3_SUITE_MEMBER_COLUMN_SHAPE_MISMATCH");
  for (const schemaName of ["schema.prisma", "schema.sqlite.prisma"]) {
    const schema = await readFile(join(repositoryRoot, "prisma", schemaName), "utf8");
    const suiteMemberModel = schema.match(/model DrydockScenarioSuiteMember \{([\s\S]*?)^\}/m)?.[1];
    if (!suiteMemberModel) throw new Error(`DRYDOCK_PHASE3_SUITE_MEMBER_MODEL_MISSING:${schemaName}`);
    const modelFields = suiteMemberModel
      .split("\n")
      .map((line) => line.trim().split(/\s+/, 1)[0])
      .filter((field) => field && !field.startsWith("@@"));
    if (JSON.stringify(modelFields) !== JSON.stringify(suiteMemberFields))
      throw new Error(`DRYDOCK_PHASE3_SUITE_MEMBER_MODEL_SHAPE_MISMATCH:${schemaName}`);
  }
  for (const [name, requiredFragments] of mysqlMigrations) {
    const mysqlMigration = await readFile(
      join(repositoryRoot, "prisma", "mysql-migrations", name, "migration.sql"),
      "utf8",
    );
    for (const requiredFragment of requiredFragments)
      if (!mysqlMigration.includes(requiredFragment))
        throw new Error(`DRYDOCK_PHASE3_MYSQL_MIGRATION_PARITY_MISSING:${name}:${requiredFragment}`);
  }
  const foreignKeyViolations = database.prepare("PRAGMA foreign_key_check;").all();
  if (foreignKeyViolations.length) throw new Error("DRYDOCK_PHASE3_MIGRATION_FOREIGN_KEY_VIOLATION");
  database.close();
  process.stdout.write(
    `${JSON.stringify({
      valid: true,
      appliedMigrationCount: applied.length,
      finalMigration: applied.at(-1),
      tables: [
        "DrydockScenario",
        "DrydockScenarioRevision",
        "DrydockScenarioSuite",
        "DrydockScenarioSuiteMember",
        "DrydockSimulationRun",
      ],
      suiteMemberColumnShape: "VERIFIED",
      mysqlParity: "STATIC_VERIFIED",
    })}\n`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
