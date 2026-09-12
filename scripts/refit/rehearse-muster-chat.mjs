import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import path from "node:path";

const base = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(base ?? "")) throw new Error("EXACT_PRE_MUSTER_MAIN_SHA_REQUIRED");
const root = path.resolve(".runtime/muster-final/migration");
await mkdir(root, { recursive: true });
const schemaFile = path.join(root, "base.prisma");
await writeFile(schemaFile, execFileSync("git", ["show", `${base}:prisma/schema.sqlite.prisma`]));
const sql = execFileSync(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema-datamodel",
    schemaFile,
    "--script",
  ],
  { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
);
const target = path.join(root, `${randomUUID()}.sqlite`);
const db = new DatabaseSync(target);
try {
  db.exec(sql);
  db.exec("PRAGMA foreign_keys = OFF");
  const fixture = path.resolve(".runtime/muster-final/accepted-fixtures.sqlite").replaceAll("\\", "/");
  db.prepare("ATTACH DATABASE ? AS fixture").run(fixture);
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((row) => row.name);
  const retained = [];
  db.exec("BEGIN");
  for (const table of tables) {
    if (!db.prepare("SELECT name FROM fixture.sqlite_master WHERE type='table' AND name=?").get(table)) continue;
    const columns = db
      .prepare(`PRAGMA table_info("${table}")`)
      .all()
      .map((row) => `"${row.name}"`)
      .join(",");
    db.exec(`INSERT INTO "${table}" (${columns}) SELECT ${columns} FROM fixture."${table}"`);
    retained.push({ table, rows: db.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n });
  }
  db.exec("COMMIT; DETACH DATABASE fixture; PRAGMA foreign_keys = ON");
  db.exec(await readFile("prisma/migrations/202609120001_muster_crew_chat/migration.sql", "utf8"));
  for (const item of retained) assert.equal(db.prepare(`SELECT count(*) AS n FROM "${item.table}"`).get().n, item.rows);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  const insert = db.prepare(
    "INSERT INTO VoyageCrewMessage(voyageId,senderAccountId,senderName,body,clientMessageId) VALUES (?,?,?,?,?)",
  );
  insert.run("muster-all-ready", "muster-account-captain", "Kato", "Migration rehearsal", "synthetic-retry");
  assert.throws(
    () => insert.run("muster-all-ready", "muster-account-captain", "Kato", "Duplicate", "synthetic-retry"),
    /UNIQUE/,
  );
  assert.throws(
    () => insert.run("muster-all-ready", "absent-account", "Nobody", "Rejected", "bad-sender"),
    /FOREIGN KEY/,
  );
  assert.throws(
    () => insert.run("absent-voyage", "muster-account-captain", "Kato", "Rejected", "bad-voyage"),
    /FOREIGN KEY/,
  );
  await writeFile(
    path.join(root, "proof.json"),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        base,
        database: path.basename(target),
        retained,
        foreignKeys: "PASS",
        retryUniqueness: "PASS",
        scope:
          "Current protected-main SQLite schema plus retained synthetic rows; additive Muster migration. MySQL deployment is not claimed.",
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      migration: "PASS",
      retainedTables: retained.length,
      retainedRows: retained.reduce((sum, row) => sum + row.rows, 0),
      foreignKeys: "PASS",
      retryUniqueness: "PASS",
    }),
  );
} finally {
  db.close();
}
