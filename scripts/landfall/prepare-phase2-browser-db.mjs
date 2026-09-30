import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "..");
const target = join(root, "artifacts", "landfall-phase2-browser", "validation.db");
if (existsSync(target)) throw new Error("LANDFALL_BROWSER_DATABASE_ALREADY_EXISTS");
mkdirSync(join(root, "artifacts", "landfall-phase2-browser"), { recursive: true });
const db = new DatabaseSync(target);
try {
  db.exec("PRAGMA foreign_keys = ON;");
  const migrations = join(root, "prisma", "migrations");
  for (const name of readdirSync(migrations).sort()) {
    const file = join(migrations, name, "migration.sql");
    if (existsSync(file)) db.exec(readFileSync(file, "utf8"));
  }
  if (db.prepare("PRAGMA foreign_key_check").all().length)
    throw new Error("LANDFALL_BROWSER_DATABASE_FOREIGN_KEY_ERROR");
  process.stdout.write(`${target}\n`);
} finally {
  db.close();
}
