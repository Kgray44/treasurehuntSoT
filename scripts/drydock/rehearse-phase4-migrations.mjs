import { DatabaseSync } from "node:sqlite";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "..");
const sqliteRoot = join(root, "prisma", "migrations");
const temporaryRoot = await mkdtemp(join(tmpdir(), "drydock-phase4-migration-"));
const database = new DatabaseSync(join(temporaryRoot, "rehearsal.db"));
const applied = [];
const tableExists = (name) => Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));

try {
  database.exec("PRAGMA foreign_keys = ON;");
  for (const name of (await readdir(sqliteRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()) {
    try { database.exec(await readFile(join(sqliteRoot, name, "migration.sql"), "utf8")); applied.push(name); }
    catch (cause) { throw new Error(`DRYDOCK_PHASE4_MIGRATION_REHEARSAL_FAILED:${name}:${cause instanceof Error ? cause.message : String(cause)}`); }
  }
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
  for (const [name, fragments] of [["0058_drydock_phase4_readiness_evidence", ["CREATE TABLE `DrydockPublishingEvidence`", "DrydockPublishingEvidence_publishedVersionId_fkey"]], ["0059_drydock_phase4_suite_evidence", ["ALTER TABLE `DrydockScenarioSuite`", "CREATE TABLE `DrydockScenarioSuiteEvidence`", "DrydockScenarioSuiteEvidence_suiteRecordId_fkey"]], ["0060_drydock_phase4_publish_idempotency", ["PublishedTaleVersion_taleId_checksum_key"]]]) {
    const sql = await readFile(join(root, "prisma", "mysql-migrations", name, "migration.sql"), "utf8");
    for (const fragment of fragments) if (!sql.includes(fragment)) throw new Error(`DRYDOCK_PHASE4_MYSQL_PARITY_MISSING:${name}:${fragment}`);
  }
  process.stdout.write(`${JSON.stringify({ valid: true, appliedMigrationCount: applied.length, finalMigration: applied.at(-1), phase4Tables: 4, suiteRevision: "VERIFIED", publishIdempotency: "VERIFIED", mysqlParity: "STATIC_VERIFIED" })}\n`);
} finally { database.close(); await rm(temporaryRoot, { recursive: true, force: true }); }
