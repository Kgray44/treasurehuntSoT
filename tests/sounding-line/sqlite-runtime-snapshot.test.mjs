import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRawOutputDirectory } from "../../scripts/sounding-line/experience-raw-output.mjs";
import { captureSqliteRuntimeSnapshot } from "../../scripts/sounding-line/sqlite-runtime-snapshot.mjs";
import { authenticatedCompletedReceipt } from "../../scripts/sounding-line/authenticated-completed-evidence.mjs";
const rawDirectory = "artifacts/sounding-line/product-experience-capture-staging/capture-sqlite-test/raw";
const sqlite = await import("node:sqlite").catch((error) => {
  if (error.code !== "ERR_UNKNOWN_BUILTIN_MODULE") throw error;
  return null;
});
const engine = {
  skip:
    !sqlite?.backup && process.env.GITHUB_ACTIONS !== "true"
      ? "Optional shadow backup unavailable before Node22.16; native pinned runtime must exercise it"
      : false,
};
async function fixture(t) {
  assert.equal(typeof sqlite?.backup, "function", "native pinned runtime must exercise SQLite backup");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sqlite-snapshot-"));
  await createRawOutputDirectory({ root, directory: rawDirectory });
  const databasePath = path.join(root, rawDirectory, "runtime.db");
  const database = new sqlite.DatabaseSync(databasePath);
  database.exec(
    "PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE fixture(value TEXT); INSERT INTO fixture VALUES ('committed WAL row');",
  );
  fs.chmodSync(databasePath, 0o600);
  t.after(() => {
    database.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  return { root, rawDirectory, databasePath, prNumber: 900, database };
}
test(
  "engine snapshot includes committed WAL data but excludes a pending transaction, independently readable by Python",
  engine,
  async (t) => {
    const f = await fixture(t);
    assert(fs.statSync(f.databasePath + "-wal").size > 0);
    f.database.exec("BEGIN IMMEDIATE; INSERT INTO fixture VALUES ('uncommitted row');");
    const snapshot = await captureSqliteRuntimeSnapshot(f);
    assert.equal(snapshot.cleanup.status, "PASS");
    assert.equal(snapshot.classification, "SQLITE_ENGINE_SNAPSHOT_NO_RUNTIME_OR_PRODUCER_AUTHENTICATION");
    assert.equal(snapshot.qualification, false);
    assert.equal(snapshot.reuseAuthorized, false);
    assert.equal(authenticatedCompletedReceipt(snapshot, {}), null);
    const raw = fs.readFileSync(snapshot.path);
    assert.equal(createHash("sha256").update(raw).digest("hex"), snapshot.sha256);
    assert.equal(raw.length, snapshot.bytes);
    assert.deepEqual(
      JSON.parse(
        execFileSync(
          "python",
          [
            "-c",
            "import sqlite3,json,sys;c=sqlite3.connect(sys.argv[1]);print(json.dumps(c.execute('select value from fixture').fetchall()));c.close()",
            snapshot.path,
          ],
          { encoding: "utf8", windowsHide: true, timeout: 10000 },
        ),
      ),
      [["committed WAL row"]],
    );
    f.database.exec("ROLLBACK");
  },
);
test(
  "held PRs, unknown identity, unsafe budgets and source outside private raw scope fail before a worker starts",
  engine,
  async (t) => {
    const f = await fixture(t);
    const original = fs.readdirSync(path.join(f.root, rawDirectory));
    for (const prNumber of [721, 776, 805, undefined, "900", 0])
      await assert.rejects(captureSqliteRuntimeSnapshot({ ...f, prNumber }), /SQLITE_SNAPSHOT_PR/u);
    for (const maximumBytes of [0, 511, 33 * 1024 * 1024, NaN])
      await assert.rejects(captureSqliteRuntimeSnapshot({ ...f, maximumBytes }), /SQLITE_SNAPSHOT_BOUND/u);
    for (const deadlineMs of [0, 15001, NaN])
      await assert.rejects(captureSqliteRuntimeSnapshot({ ...f, deadlineMs }), /SQLITE_SNAPSHOT_DEADLINE/u);
    const outside = path.join(f.root, "unowned.db");
    fs.copyFileSync(f.databasePath, outside);
    await assert.rejects(captureSqliteRuntimeSnapshot({ ...f, databasePath: outside }), /READ_SCOPE/u);
    assert.deepEqual(fs.readdirSync(path.join(f.root, rawDirectory)), original);
  },
);
test("hard-linked source and a database larger than the finite bound cannot produce a snapshot", engine, async (t) => {
  const f = await fixture(t),
    linked = path.join(f.root, rawDirectory, "linked.db");
  fs.linkSync(f.databasePath, linked);
  await assert.rejects(captureSqliteRuntimeSnapshot({ ...f, databasePath: linked }), /READ_FILE/u);
  fs.unlinkSync(linked);
  await assert.rejects(captureSqliteRuntimeSnapshot({ ...f, maximumBytes: 512 }), /READ_FILE/u);
});
test(
  "actual owned backup deadline preserves fragments and proves worker cleanup without authorizing resume",
  engine,
  async (t) => {
    const f = await fixture(t);
    await assert.rejects(captureSqliteRuntimeSnapshot({ ...f, deadlineMs: 20 }), (error) => {
      assert.match(error.message, /SQLITE_SNAPSHOT_DEADLINE/u);
      assert.equal(error.cleanup.status, "PASS");
      assert.equal(error.cleanup.treeReaped, true);
      return true;
    });
    assert(fs.readdirSync(path.join(f.root, rawDirectory)).some((name) => name.startsWith("sqlite-engine-")));
  },
);
