import { DatabaseSync } from "node:sqlite";
import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..", "..");
const migrationsRoot = join(root, "prisma", "migrations");
const phaseMigration = "202609290001_landfall_phase1_definition";
const migrations = (await readdir(migrationsRoot, { withFileTypes: true }))
  .filter((item) => item.isDirectory())
  .map((item) => item.name)
  .sort();
if (migrations.at(-1) !== phaseMigration) throw new Error("LANDFALL_MIGRATION_ORDER_INVALID");

async function apply(database, names) {
  database.exec("PRAGMA foreign_keys = ON;");
  for (const name of names) {
    try {
      database.exec(await readFile(join(migrationsRoot, name, "migration.sql"), "utf8"));
    } catch (cause) {
      throw new Error(`LANDFALL_MIGRATION_FAILED:${name}:${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }
}
const hasLandfall = (database) =>
  database
    .prepare("PRAGMA table_info('TaleDraft')")
    .all()
    .some((column) => column.name === "landfallDefinition" && column.notnull === 0);

const fresh = new DatabaseSync(":memory:");
await apply(fresh, migrations);
if (!hasLandfall(fresh)) throw new Error("LANDFALL_FRESH_SCHEMA_MISSING");
if (fresh.prepare("PRAGMA foreign_key_check").all().length) throw new Error("LANDFALL_FRESH_FOREIGN_KEY_ERROR");
fresh.close();

const upgrade = new DatabaseSync(":memory:");
await apply(upgrade, migrations.slice(0, -1));
if (hasLandfall(upgrade)) throw new Error("LANDFALL_UPGRADE_BASE_ALREADY_HAS_COLUMN");
upgrade
  .prepare("INSERT INTO Chronicle(id, slug, title, creatorId, updatedAt) VALUES (?, ?, ?, ?, ?)")
  .run("legacy-tale", "legacy-tale", "Legacy Tale", "creator", "2026-09-28T12:00:00Z");
upgrade
  .prepare("INSERT INTO TaleDraft(id, taleId, createdBy, updatedAt) VALUES (?, ?, ?, ?)")
  .run("legacy-draft", "legacy-tale", "creator", "2026-09-28T12:00:00Z");
await apply(upgrade, [phaseMigration]);
if (!hasLandfall(upgrade)) throw new Error("LANDFALL_UPGRADE_SCHEMA_MISSING");
const legacy = upgrade.prepare("SELECT id, landfallDefinition FROM TaleDraft WHERE id = ?").get("legacy-draft");
if (legacy?.id !== "legacy-draft" || legacy.landfallDefinition !== null)
  throw new Error("LANDFALL_LEGACY_DRAFT_CHANGED");
if (upgrade.prepare("PRAGMA foreign_key_check").all().length) throw new Error("LANDFALL_UPGRADE_FOREIGN_KEY_ERROR");
upgrade.close();

const mysql = await readFile(
  join(root, "prisma", "mysql-migrations", "0067_landfall_phase1_definition", "migration.sql"),
  "utf8",
);
if (!/ALTER TABLE `TaleDraft` ADD COLUMN `landfallDefinition` LONGTEXT NULL;/u.test(mysql))
  throw new Error("LANDFALL_MYSQL_MIGRATION_PARITY_MISSING");
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
