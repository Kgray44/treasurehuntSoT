import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const mysql = readFileSync("prisma/mysql-migrations/0069_crossdeck_phase1/migration.sql", "utf8");
// Static DDL compatibility check, not a claim of physical MySQL execution.
assert.match(mysql, /`capabilities` LONGTEXT NOT NULL DEFAULT \('\{\}'\)/);
const db = new DatabaseSync(":memory:");
try {
  db.exec(
    'PRAGMA foreign_keys = ON; CREATE TABLE "AccountSession" ("id" TEXT PRIMARY KEY); CREATE TABLE "PlaythroughMembership" ("id" TEXT PRIMARY KEY);',
  );
  db.exec(readFileSync("prisma/migrations/202610100001_crossdeck_phase1/migration.sql", "utf8"));
  db.exec(
    "INSERT INTO \"AccountSession\" VALUES ('session'); INSERT INTO \"PlaythroughMembership\" VALUES ('member');",
  );
  const capabilities = JSON.stringify({ example: "a".repeat(3000) });
  db.prepare(
    'INSERT INTO "CrossdeckSurfaceSession" (id, surfaceId, accountSessionId, membershipId, label, capabilities, expiresAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run("participation", "surface", "session", "member", "Phone", capabilities, "2026-10-11T00:00:00Z");
  db.prepare(
    'INSERT INTO "CrossdeckPairingChallenge" (id, codeHash, sourceId, requestedRole, expiresAt) VALUES (?, ?, ?, ?, ?)',
  ).run("challenge", "a".repeat(64), "participation", "CHRONICLE_LENS", "2026-10-10T00:02:00Z");
  assert.equal(db.prepare('SELECT capabilities FROM "CrossdeckSurfaceSession"').get().capabilities, capabilities);
  assert.throws(() =>
    db
      .prepare(
        'INSERT INTO "CrossdeckPairingChallenge" (id, codeHash, sourceId, requestedRole, expiresAt) VALUES (?, ?, ?, ?, ?)',
      )
      .run("replay", "a".repeat(64), "participation", "CHART", "2026-10-10T00:02:00Z"),
  );
  db.exec("DELETE FROM \"AccountSession\" WHERE id = 'session';");
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM "CrossdeckSurfaceSession"').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM "CrossdeckPairingChallenge"').get().n, 0);
  assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  process.stdout.write("Crossdeck SQLite migration: storage, uniqueness, parent cascade and foreign keys PASS\n");
} finally {
  db.close();
}
