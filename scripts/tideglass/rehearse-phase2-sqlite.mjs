import { DatabaseSync } from "node:sqlite";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const migrationRoot = path.join(root, "prisma", "migrations");
const phase2Migration = "20260809130000_tideglass_phase2_creator_annotations";
const migrations = (await fs.readdir(migrationRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const phase2MigrationIndex = migrations.indexOf(phase2Migration);
if (phase2MigrationIndex < 0) throw new Error("TIDEGLASS_SQLITE_MIGRATION_MISSING");

const runRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tideglass-phase2-sqlite-"));
const databasePath = path.join(runRoot, "upgrade.sqlite");
const database = new DatabaseSync(databasePath);
try {
  database.exec("PRAGMA foreign_keys = ON;");
  for (const migration of migrations.slice(0, phase2MigrationIndex))
    database.exec(await fs.readFile(path.join(migrationRoot, migration, "migration.sql"), "utf8"));

  database.exec(`
    INSERT INTO "UserAccount" ("id", "status", "createdAt", "updatedAt")
    VALUES ('tideglass-fixture-account', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "Chronicle" (
      "id", "slug", "title", "theme", "status", "visibility", "creatorId", "creatorAccountId",
      "playerCountMin", "playerCountMax", "sortOrder", "featured", "createdAt", "updatedAt"
    ) VALUES (
      'tideglass-fixture-chronicle', 'tideglass-fixture', 'Synthetic Tideglass fixture', 'CLASSIC', 'PUBLISHED',
      'PRIVATE', 'tideglass-fixture-account', 'tideglass-fixture-account', 1, 4, 0, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );
    INSERT INTO "PublishedTaleVersion" (
      "id", "taleId", "versionNumber", "versionLabel", "publishedAt", "publishedBy",
      "publishedByAccountId", "contentSnapshot", "schemaVersion", "checksum", "isCurrent"
    ) VALUES (
      'tideglass-fixture-edition', 'tideglass-fixture-chronicle', 1, '1.0', CURRENT_TIMESTAMP,
      'tideglass-fixture-account', 'tideglass-fixture-account', '{}', 1,
      '0000000000000000000000000000000000000000000000000000000000000000', true
    );
  `);
  const before = fingerprint(database);
  database.exec(await fs.readFile(path.join(migrationRoot, phase2Migration, "migration.sql"), "utf8"));
  const after = fingerprint(database);
  if (before !== after) throw new Error("TIDEGLASS_SQLITE_BUSINESS_DATA_CHANGED");
  const annotationCountAfterUpgrade = database
    .prepare('SELECT COUNT(*) AS count FROM "TideglassCreatorAnnotation"')
    .get().count;
  if (annotationCountAfterUpgrade !== 0) throw new Error("TIDEGLASS_SQLITE_ANNOTATION_BACKFILL_FOUND");
  const auditCountBeforeMutation = database.prepare('SELECT COUNT(*) AS count FROM "PlatformAuditEvent"').get().count;
  database.exec(`
    INSERT INTO "TideglassCreatorAnnotation" (
      "id", "annotationKey", "revision", "chronicleId", "sourceEditionId", "sourceEditionChecksum",
      "targetEditionId", "targetEditionChecksum", "comparisonPolicyVersion", "scopeType", "category",
      "changeRecordId", "annotationKind", "headline", "body", "spoilerLevel", "highlighted",
      "replayGuidance", "createdByAccountId", "supersedesAnnotationId", "state", "idempotencyKey"
    ) VALUES (
      'tideglass-fixture-annotation', 'tideglass-fixture-key', 1, 'tideglass-fixture-chronicle',
      'tideglass-fixture-edition', '0000000000000000000000000000000000000000000000000000000000000000',
      'tideglass-fixture-edition', '0000000000000000000000000000000000000000000000000000000000000000',
      'tideglass.policy.v1', 'PAIR', NULL, NULL, 'HEADLINE', 'Synthetic annotation', NULL,
      'PREVIEW_SAFE', true, 'WORTH_REVISITING', 'tideglass-fixture-account', NULL, 'ACTIVE',
      'tideglass-fixture-idempotency'
    );
    INSERT INTO "PlatformAuditEvent" (
      "id", "actorType", "actorId", "actorAccountId", "action", "resourceType", "resourceId",
      "outcome", "correlationId", "metadata"
    ) VALUES (
      'tideglass-fixture-audit', 'ACCOUNT', 'tideglass-fixture-account', 'tideglass-fixture-account',
      'TIDEGLASS_ANNOTATION_CREATED', 'TIDEGLASS_COMPARISON', 'tideglass-fixture-key', 'SUCCEEDED',
      'tideglass-fixture-correlation', '{"annotationRevision":1}'
    );
  `);
  const afterMutation = fingerprint(database);
  if (after !== afterMutation) throw new Error("TIDEGLASS_SQLITE_ANNOTATION_MUTATED_BUSINESS_DATA");
  const annotationCountAfterMutation = database
    .prepare('SELECT COUNT(*) AS count FROM "TideglassCreatorAnnotation"')
    .get().count;
  const auditCountAfterMutation = database.prepare('SELECT COUNT(*) AS count FROM "PlatformAuditEvent"').get().count;
  if (annotationCountAfterMutation !== 1 || auditCountAfterMutation !== auditCountBeforeMutation + 1)
    throw new Error("TIDEGLASS_SQLITE_ANNOTATION_AUDIT_INVARIANT_FAILED");
  const foreignKeyViolations = database.prepare("PRAGMA foreign_key_check").all();
  if (foreignKeyViolations.length) throw new Error("TIDEGLASS_SQLITE_FOREIGN_KEY_VIOLATION");
  process.stdout.write(
    `${JSON.stringify({
      status: "TIDEGLASS_PHASE2_SQLITE_REHEARSAL_PASS",
      migrationsApplied: migrations.length,
      businessFingerprintPreserved: true,
      annotationRowsAfterUpgrade: annotationCountAfterUpgrade,
      annotationRowsAfterMutation: annotationCountAfterMutation,
      auditRowsAddedByMutation: auditCountAfterMutation - auditCountBeforeMutation,
      foreignKeyViolations: 0,
      taskOwnedDatabase: databasePath,
    })}\n`,
  );
} finally {
  database.close();
  await fs.rm(runRoot, { recursive: true, force: true });
}

function fingerprint(database) {
  return JSON.stringify({
    tableCounts: database
      .prepare(
        `SELECT name FROM sqlite_schema
         WHERE type = 'table'
           AND name NOT LIKE 'sqlite_%'
           AND name NOT IN ('_prisma_migrations', 'TideglassCreatorAnnotation', 'PlatformAuditEvent')
         ORDER BY name`,
      )
      .all()
      .map(({ name }) => ({
        name,
        count: database.prepare(`SELECT COUNT(*) AS count FROM "${name.replaceAll('"', '""')}"`).get().count,
      })),
    accounts: database.prepare('SELECT "id", "status" FROM "UserAccount" ORDER BY "id"').all(),
    chronicles: database
      .prepare('SELECT "id", "slug", "title", "creatorAccountId" FROM "Chronicle" ORDER BY "id"')
      .all(),
    editions: database
      .prepare('SELECT "id", "taleId", "checksum", "contentSnapshot" FROM "PublishedTaleVersion" ORDER BY "id"')
      .all(),
    sessions: database.prepare('SELECT COUNT(*) AS count FROM "TaleSession"').get().count,
    events: database.prepare('SELECT COUNT(*) AS count FROM "TaleSessionEvent"').get().count,
    history: database.prepare('SELECT COUNT(*) AS count FROM "PlayerChronicleRecord"').get().count,
    releases: database.prepare('SELECT COUNT(*) AS count FROM "CommunityRelease"').get().count,
  });
}
