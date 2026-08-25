import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "..");
const sqliteRoot = join(root, "prisma", "migrations");
const requestedDatabase = process.env.DRYDOCK_PHASE4_REHEARSAL_DB;
if (requestedDatabase && !isAbsolute(requestedDatabase)) throw new Error("DRYDOCK_PHASE4_REHEARSAL_DB_MUST_BE_ABSOLUTE");
if (requestedDatabase && existsSync(requestedDatabase)) throw new Error("DRYDOCK_PHASE4_REHEARSAL_DB_MUST_NOT_EXIST");
const temporaryRoot = requestedDatabase ? dirname(requestedDatabase) : await mkdtemp(join(tmpdir(), "drydock-phase4-migration-"));
const database = new DatabaseSync(requestedDatabase ?? join(temporaryRoot, "rehearsal.db"));
const applied = [];
const tableExists = (name) => Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));

try {
  database.exec("PRAGMA foreign_keys = ON;");
  const migrations = (await readdir(sqliteRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const apply = async (name) => {
    try {
      database.exec(await readFile(join(sqliteRoot, name, "migration.sql"), "utf8"));
      applied.push(name);
    } catch (cause) {
      throw new Error(`DRYDOCK_PHASE4_MIGRATION_REHEARSAL_FAILED:${name}:${cause instanceof Error ? cause.message : String(cause)}`);
    }
  };
  for (const name of migrations.filter((name) => name < "20260813100000_drydock_phase4_readiness_evidence")) await apply(name);
  database.prepare('INSERT INTO "Chronicle" ("id", "slug", "title", "creatorId", "updatedAt") VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)').run("phase4-chronicle", "phase4-chronicle", "Phase 4 rehearsal", "phase4-creator");
  database.prepare('INSERT INTO "TaleDraft" ("id", "taleId", "revisionNumber", "createdBy", "updatedAt") VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)').run("phase4-draft", "phase4-chronicle", 1, "phase4-creator");
  database.prepare('INSERT INTO "DrydockScenarioSuite" ("id", "draftId", "suiteId", "title", "sourceChecksum", "updatedAt") VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').run("phase4-suite", "phase4-draft", "phase4-suite", "Phase 3 representative Suite", "a".repeat(64));
  for (const name of migrations.filter((name) => name >= "20260813100000_drydock_phase4_readiness_evidence")) await apply(name);
  const representative = database.prepare('SELECT "suiteId", "sourceChecksum", "revision" FROM "DrydockScenarioSuite" WHERE "id" = ?').get("phase4-suite");
  if (!representative || representative.suiteId !== "phase4-suite" || representative.sourceChecksum !== "a".repeat(64) || representative.revision !== 1) throw new Error("DRYDOCK_PHASE4_REPRESENTATIVE_PHASE3_DATA_NOT_PRESERVED");
  for (const table of ["DrydockCompatibilityRun", "DrydockExternalEvidenceReference", "DrydockPublishingEvidence", "DrydockScenarioSuiteEvidence"])
    if (!tableExists(table)) throw new Error(`DRYDOCK_PHASE4_MIGRATION_TABLE_MISSING:${table}`);
  const suiteColumns = database.prepare('PRAGMA table_info("DrydockScenarioSuite");').all().map((column) => column.name);
  if (!suiteColumns.includes("revision")) throw new Error("DRYDOCK_PHASE4_SUITE_REVISION_MISSING");
  const evidenceColumns = database.prepare('PRAGMA table_info("DrydockScenarioSuiteEvidence");').all().map((column) => column.name);
  for (const column of ["suiteRevision", "sourceChecksum", "runIds", "coverageDigest", "requiredSuitePolicyVersion", "compatibilityPolicyVersion"])
    if (!evidenceColumns.includes(column)) throw new Error(`DRYDOCK_PHASE4_SUITE_EVIDENCE_COLUMN_MISSING:${column}`);
  const versionIndexes = database.prepare('PRAGMA index_list("PublishedTaleVersion");').all().map((index) => index.name);
  if (!versionIndexes.includes("PublishedTaleVersion_taleId_checksum_key")) throw new Error("DRYDOCK_PHASE4_PUBLISH_IDEMPOTENCY_INDEX_MISSING");
  if (database.prepare("PRAGMA foreign_key_check;").all().length) throw new Error("DRYDOCK_PHASE4_MIGRATION_FOREIGN_KEY_VIOLATION");
  for (const [name, fragments] of [["0059_drydock_phase4_readiness_evidence", ["CREATE TABLE `DrydockPublishingEvidence`", "DrydockPublishingEvidence_publishedVersionId_fkey"]], ["0060_drydock_phase4_suite_evidence", ["ALTER TABLE `DrydockScenarioSuite`", "CREATE TABLE `DrydockScenarioSuiteEvidence`", "DrydockScenarioSuiteEvidence_suiteRecordId_fkey"]], ["0061_drydock_phase4_publish_idempotency", ["PublishedTaleVersion_taleId_checksum_key"]]]) {
    const sql = await readFile(join(root, "prisma", "mysql-migrations", name, "migration.sql"), "utf8");
    for (const fragment of fragments) if (!sql.includes(fragment)) throw new Error(`DRYDOCK_PHASE4_MYSQL_PARITY_MISSING:${name}:${fragment}`);
  }
  process.stdout.write(`${JSON.stringify({ valid: true, appliedMigrationCount: applied.length, finalMigration: applied.at(-1), phase3RepresentativeData: "VERIFIED", phase4Tables: 4, suiteRevision: "VERIFIED", publishIdempotency: "VERIFIED", mysqlParity: "STATIC_VERIFIED" })}\n`);
} finally {
  database.close();
  if (!requestedDatabase) await rm(temporaryRoot, { recursive: true, force: true });
}
