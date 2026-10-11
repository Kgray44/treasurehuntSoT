import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const db = new DatabaseSync(":memory:");
try {
  db.exec('PRAGMA foreign_keys=ON; CREATE TABLE "PlaythroughMembership" (id TEXT PRIMARY KEY);');
  db.exec(readFileSync("prisma/migrations/20261011_0001_crossdeck_phase2/migration.sql", "utf8"));
  db.exec("INSERT INTO PlaythroughMembership VALUES ('member');");
  const state = JSON.stringify({ objects: { chart: { context: { readingPosition: 0.7 } } } });
  db.prepare('INSERT INTO "CrossdeckDeck" (id, membershipId, state, updatedAt) VALUES (?, ?, ?, ?)').run(
    "deck",
    "member",
    state,
    "2026-10-11T00:00:00Z",
  );
  assert.equal(db.prepare('SELECT state FROM "CrossdeckDeck"').get().state, state);
  assert.equal(
    db.prepare('UPDATE "CrossdeckDeck" SET revision=revision+1 WHERE id=? AND revision=?').run("deck", 0).changes,
    1,
  );
  assert.equal(
    db.prepare('UPDATE "CrossdeckDeck" SET revision=revision+1 WHERE id=? AND revision=?').run("deck", 0).changes,
    0,
  );
  assert.throws(() =>
    db
      .prepare('INSERT INTO "CrossdeckDeck" (id, membershipId, state, updatedAt) VALUES (?, ?, ?, ?)')
      .run("other", "member", "{}", "2026-10-11T00:00:00Z"),
  );
  db.exec("DELETE FROM PlaythroughMembership;");
  assert.equal(db.prepare('SELECT COUNT(*) n FROM "CrossdeckDeck"').get().n, 0);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  const mysql = readFileSync("prisma/mysql-migrations/20261011_0001_crossdeck_phase2/migration.sql", "utf8");
  assert.match(mysql, /`state` LONGTEXT NOT NULL/);
  assert.match(mysql, /UNIQUE INDEX/);
  assert.match(mysql, /ON DELETE CASCADE/);
  process.stdout.write(
    "Phase 2 SQLite durable state, compare-and-swap, uniqueness and cascade PASS; MySQL DDL static check PASS (not live MySQL).\n",
  );
} finally {
  db.close();
}
