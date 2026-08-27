import { DatabaseSync } from "node:sqlite";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const migrationRoot = path.join(root, "prisma", "migrations");
const migrationName = "20260826110000_helm_a2_authority_lifecycle";
const mysqlMigration = path.join(root, "prisma", "mysql-migrations", "0062_helm_a2_authority_lifecycle", "migration.sql");
const migrations = (await fs.readdir(migrationRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const migrationIndex = migrations.indexOf(migrationName);
if (migrationIndex < 0) throw new Error("HELM_A2_SQLITE_MIGRATION_MISSING");

const taskRoot = await fs.mkdtemp(path.join(os.tmpdir(), "helm-a2-migrations-"));
const upgradePath = path.join(taskRoot, "upgrade.sqlite");
const freshPath = path.join(taskRoot, "fresh.sqlite");

async function apply(database, names) {
  for (const name of names) database.exec(await fs.readFile(path.join(migrationRoot, name, "migration.sql"), "utf8"));
}

function seedSharedVoyage(database) {
  database.exec(`
    INSERT INTO "UserAccount" ("id", "status", "createdAt", "updatedAt")
    VALUES ('helm-a2-captain', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "Chronicle" (
      "id", "slug", "title", "theme", "status", "visibility", "creatorId", "creatorAccountId",
      "playerCountMin", "playerCountMax", "sortOrder", "featured", "createdAt", "updatedAt"
    ) VALUES (
      'helm-a2-chronicle', 'helm-a2-synthetic', 'Synthetic Helm A2 Chronicle', 'CLASSIC', 'PUBLISHED',
      'PRIVATE', 'helm-a2-captain', 'helm-a2-captain', 1, 4, 0, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );
    INSERT INTO "PublishedTaleVersion" (
      "id", "taleId", "versionNumber", "versionLabel", "publishedAt", "publishedBy", "publishedByAccountId",
      "contentSnapshot", "schemaVersion", "checksum", "isCurrent"
    ) VALUES (
      'helm-a2-edition', 'helm-a2-chronicle', 1, '1.0', CURRENT_TIMESTAMP, 'helm-a2-captain', 'helm-a2-captain',
      '{}', 1, '0000000000000000000000000000000000000000000000000000000000000000', true
    );
    INSERT INTO "TaleSession" (
      "id", "taleId", "publishedVersionId", "captainAccountId", "accessTokenHash", "status", "captainMode",
      "configuration", "concurrencyVersion", "currentSequence", "variables", "inventory", "startedAt", "updatedAt"
    ) VALUES (
      'helm-a2-shared-voyage', 'helm-a2-chronicle', 'helm-a2-edition', 'helm-a2-captain', 'helm-a2-access-token',
      'ACTIVE', 'CAPTAIN_AND_PLAYER', '{}', 7, 21, '{"shared":"state"}', '["shared-artifact"]',
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );
  `);
}

function sharedFingerprint(database) {
  return database
    .prepare(
      `SELECT "id", "taleId", "publishedVersionId", "captainAccountId", "status", "captainMode",
              "configuration", "concurrencyVersion", "currentSequence", "variables", "inventory"
         FROM "TaleSession" WHERE "id" = 'helm-a2-shared-voyage'`,
    )
    .get();
}

function tableExists(database, table) {
  return Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function assertFreshSchema(database) {
  for (const table of ["VoyageCaptainAuthorityReceipt", "VoyageForkLineage"])
    if (!tableExists(database, table)) throw new Error(`HELM_A2_FRESH_TABLE_MISSING:${table}`);
  const columns = database.prepare('PRAGMA table_info("TaleSession")').all().map((row) => row.name);
  if (!columns.includes("captainAuthorityState")) throw new Error("HELM_A2_FRESH_AUTHORITY_COLUMN_MISSING");
}

try {
  const upgrade = new DatabaseSync(upgradePath);
  try {
    upgrade.exec("PRAGMA foreign_keys = ON;");
    await apply(upgrade, migrations.slice(0, migrationIndex));
    seedSharedVoyage(upgrade);
    const before = sharedFingerprint(upgrade);
    await apply(upgrade, [migrationName]);
    const after = sharedFingerprint(upgrade);
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("HELM_A2_UPGRADE_SHARED_STATE_CHANGED");
    const upgradedAuthority = upgrade
      .prepare('SELECT "captainAuthorityState" FROM "TaleSession" WHERE "id" = ?')
      .get("helm-a2-shared-voyage").captainAuthorityState;
    if (upgradedAuthority !== "ASSIGNED") throw new Error("HELM_A2_UPGRADE_DEFAULT_AUTHORITY_INVALID");
    assertFreshSchema(upgrade);
    const receiptRows = upgrade.prepare('SELECT COUNT(*) AS count FROM "VoyageCaptainAuthorityReceipt"').get().count;
    const lineageRows = upgrade.prepare('SELECT COUNT(*) AS count FROM "VoyageForkLineage"').get().count;
    if (receiptRows !== 0 || lineageRows !== 0) throw new Error("HELM_A2_UPGRADE_UNEXPECTED_BACKFILL");
    if (upgrade.prepare("PRAGMA foreign_key_check").all().length) throw new Error("HELM_A2_UPGRADE_FOREIGN_KEY_FAILURE");
  } finally {
    upgrade.close();
  }

  const fresh = new DatabaseSync(freshPath);
  try {
    fresh.exec("PRAGMA foreign_keys = ON;");
    await apply(fresh, migrations);
    assertFreshSchema(fresh);
    seedSharedVoyage(fresh);
    const authority = fresh
      .prepare('SELECT "captainAuthorityState" FROM "TaleSession" WHERE "id" = ?')
      .get("helm-a2-shared-voyage").captainAuthorityState;
    if (authority !== "ASSIGNED") throw new Error("HELM_A2_FRESH_DEFAULT_AUTHORITY_INVALID");
    if (fresh.prepare("PRAGMA foreign_key_check").all().length) throw new Error("HELM_A2_FRESH_FOREIGN_KEY_FAILURE");
  } finally {
    fresh.close();
  }

  const mysqlSql = await fs.readFile(mysqlMigration, "utf8");
  for (const token of [
    "ADD COLUMN `captainAuthorityState`",
    "CREATE TABLE `VoyageCaptainAuthorityReceipt`",
    "CREATE TABLE `VoyageForkLineage`",
  ])
    if (!mysqlSql.includes(token)) throw new Error(`HELM_A2_MYSQL_DDL_CONTRACT_MISSING:${token}`);

  process.stdout.write(
    `${JSON.stringify({
      status: "HELM_A2_MIGRATION_REHEARSAL_PASS",
      sqliteUpgrade: { sharedStatePreserved: true, existingAuthorityDefault: "ASSIGNED", receiptBackfillRows: 0 },
      sqliteFresh: { authorityDefault: "ASSIGNED", lineageTablePresent: true },
      mysqlDdlContract: "present",
      taskOwnedDatabaseRoot: taskRoot,
    })}\n`,
  );
} finally {
  const resolvedTaskRoot = path.resolve(taskRoot);
  const resolvedTempRoot = path.resolve(os.tmpdir());
  if (!resolvedTaskRoot.startsWith(`${resolvedTempRoot}${path.sep}`)) throw new Error("Refusing to remove a non-temporary root.");
  await fs.rm(resolvedTaskRoot, { recursive: true, force: true });
}
