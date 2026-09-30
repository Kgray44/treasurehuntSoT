import { DatabaseSync } from "node:sqlite";
import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..", "..");
const migrationsRoot = join(root, "prisma", "migrations");
const phaseMigration = "202609300001_landfall_phase2_field_test_receipts";
const migrations = (await readdir(migrationsRoot, { withFileTypes: true }))
  .filter((item) => item.isDirectory())
  .map((item) => item.name)
  .sort();
if (migrations.at(-1) !== phaseMigration) throw new Error("LANDFALL_PHASE2_MIGRATION_ORDER_INVALID");

async function apply(database, names) {
  database.exec("PRAGMA foreign_keys = ON;");
  for (const name of names) {
    try {
      database.exec(await readFile(join(migrationsRoot, name, "migration.sql"), "utf8"));
    } catch (cause) {
      throw new Error(
        `LANDFALL_PHASE2_MIGRATION_FAILED:${name}:${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  }
}

function hasReceipts(database) {
  return (
    database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'LandfallFieldTestReceipt'").get()
      ?.name === "LandfallFieldTestReceipt"
  );
}

const fresh = new DatabaseSync(":memory:");
await apply(fresh, migrations);
if (!hasReceipts(fresh)) throw new Error("LANDFALL_PHASE2_FRESH_TABLE_MISSING");
if (fresh.prepare("PRAGMA foreign_key_check").all().length) throw new Error("LANDFALL_PHASE2_FRESH_FOREIGN_KEY_ERROR");
fresh.close();

const upgrade = new DatabaseSync(":memory:");
await apply(upgrade, migrations.slice(0, -1));
if (hasReceipts(upgrade)) throw new Error("LANDFALL_PHASE2_UPGRADE_BASE_ALREADY_HAS_TABLE");
upgrade
  .prepare("INSERT INTO Chronicle(id, slug, title, creatorId, updatedAt) VALUES (?, ?, ?, ?, ?)")
  .run("legacy-tale", "legacy-tale", "Legacy Tale", "creator", "2026-09-29T12:00:00Z");
upgrade
  .prepare("INSERT INTO TaleDraft(id, taleId, createdBy, updatedAt) VALUES (?, ?, ?, ?)")
  .run("legacy-draft", "legacy-tale", "creator", "2026-09-29T12:00:00Z");
await apply(upgrade, [phaseMigration]);
if (!hasReceipts(upgrade)) throw new Error("LANDFALL_PHASE2_UPGRADE_TABLE_MISSING");
if (
  upgrade.prepare("SELECT landfallDefinition FROM TaleDraft WHERE id = 'legacy-draft'").get()?.landfallDefinition !==
  null
)
  throw new Error("LANDFALL_PHASE2_LEGACY_DRAFT_CHANGED");
if (upgrade.prepare("PRAGMA foreign_key_check").all().length)
  throw new Error("LANDFALL_PHASE2_UPGRADE_FOREIGN_KEY_ERROR");
upgrade.close();

const mysql = await readFile(
  join(root, "prisma", "mysql-migrations", "0068_landfall_phase2_field_test_receipts", "migration.sql"),
  "utf8",
);
if (!/CREATE TABLE `LandfallFieldTestReceipt`/u.test(mysql))
  throw new Error("LANDFALL_PHASE2_MYSQL_MIGRATION_PARITY_MISSING");
process.stdout.write(
  JSON.stringify({
    valid: true,
    sqliteFresh: true,
    sqliteUpgrade: true,
    legacyDraftPreserved: true,
    mysqlParity: "STATIC_VERIFIED",
    appliedMigrations: migrations.length,
  }) + "\n",
);
