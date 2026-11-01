import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createRawOutputDirectory } from "../../scripts/sounding-line/experience-raw-output.mjs";
import { createOwnedRuntimeStateRetention } from "../../scripts/sounding-line/owned-runtime-state-retention.mjs";
import { restoreRuntimeSnapshotRetention } from "../../scripts/sounding-line/runtime-snapshot-retention.mjs";
import { processExit } from "../../scripts/sounding-line/owned-process.mjs";
import { authenticatedCompletedReceipt } from "../../scripts/sounding-line/authenticated-completed-evidence.mjs";
const rawDirectory = "artifacts/sounding-line/product-experience-capture-staging/capture-owned-state/raw";
const binding = {
  prNumber: 900,
  baseSha: "a".repeat(40),
  candidateSha: "b".repeat(40),
  sourceDigest: "c".repeat(64),
  runtimeDigest: "d".repeat(64),
  contextId: "e".repeat(64),
};
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
async function ready(file) {
  const deadline = Date.now() + 10000;
  while (!fs.existsSync(file)) {
    assert(Date.now() < deadline, "owned fixture must become ready");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
async function fixture(t, originalBinding = binding) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "owned-runtime-state-"));
  await createRawOutputDirectory({ root, directory: rawDirectory });
  const databasePath = path.join(root, rawDirectory, "runtime.db");
  execFileSync(
    "python",
    [
      "-c",
      "import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);c.execute('create table fixture(value text)');c.commit();c.close()",
      databasePath,
    ],
    { windowsHide: true, timeout: 10000 },
  );
  fs.chmodSync(databasePath, 0o600);
  const owner = await createOwnedRuntimeStateRetention({ root, rawDirectory, databasePath, originalBinding });
  t.after(async () => {
    await owner.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const application = path.join(root, "application.cjs"),
    capture = path.join(root, "capture.cjs");
  fs.writeFileSync(
    application,
    `const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.env.DATABASE_URL.slice(5));db.exec("PRAGMA journal_mode=WAL;PRAGMA wal_autocheckpoint=0;INSERT INTO fixture VALUES ('actual owned committed state')");require('node:fs').writeFileSync(process.argv[2],'ready');setInterval(()=>{},1000);`,
  );
  fs.writeFileSync(capture, `require('node:fs').writeFileSync(process.argv[2],'ready');setInterval(()=>{},1000);`);
  return { root, rawDirectory, databasePath, owner, application, capture };
}
const state = () => ({
  authenticationCache: Buffer.from('{"cookies":[]}'),
  fixtureState: Buffer.from('{"fixture":"original"}'),
});
test(
  "creation-owned application and capture trees close before an independently readable SQLite/cache checkpoint is retained",
  engine,
  async (t) => {
    const originalBinding = structuredClone(binding),
      f = await fixture(t, originalBinding);
    originalBinding.candidateSha = "f".repeat(40);
    const appReady = path.join(f.root, "application-ready"),
      captureReady = path.join(f.root, "capture-ready");
    await f.owner.launch("application", {
      entrypoint: f.application,
      args: [appReady],
      environment: { DATABASE_URL: "file:must-be-overridden.db" },
    });
    await f.owner.launch("capture", { entrypoint: f.capture, args: [captureReady] });
    await Promise.all([ready(appReady), ready(captureReady)]);
    const input = state(),
      pending = f.owner.checkpoint(input);
    input.fixtureState.fill(0);
    const observed = await pending;
    assert.equal(observed.classification, "CREATION_BOUND_DECLARED_SQLITE_RUNTIME_RETENTION_NOT_FULL_ISOLATION");
    assert.equal(observed.cleanup.application.status, "PASS");
    assert.equal(observed.cleanup.capture.status, "PASS");
    assert.equal(observed.qualification, false);
    assert.equal(observed.reuseAuthorized, false);
    assert.equal(authenticatedCompletedReceipt(observed, {}), null);
    const restored = await restoreRuntimeSnapshotRetention({
      ...f,
      id: observed.retained.id,
      expectedOriginalBinding: binding,
    });
    assert.equal(restored.files.get("fixture-state").toString(), '{"fixture":"original"}');
    assert.equal(restored.files.get("browser-authentication-cache").toString(), '{"cookies":[]}');
    const sqlite = path.join(f.root, "independent-restored.db");
    fs.writeFileSync(sqlite, restored.files.get("sqlite-backup"));
    assert.equal(
      execFileSync(
        "python",
        [
          "-c",
          "import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);print(c.execute('select value from fixture').fetchone()[0]);c.close()",
          sqlite,
        ],
        { encoding: "utf8", windowsHide: true, timeout: 10000 },
      ).trim(),
      "actual owned committed state",
    );
    await assert.rejects(f.owner.checkpoint(state()), /CHECKPOINT/u);
    await assert.rejects(f.owner.launch("capture", { entrypoint: f.capture }), /LAUNCH/u);
  },
);
test(
  "the parent cannot checkpoint an incomplete launch set or replace a launch; failed payload outcomes remain original",
  engine,
  async (t) => {
    const f = await fixture(t);
    await assert.rejects(f.owner.checkpoint(state()), /CHECKPOINT/u);
    const failed = path.join(f.root, "failed.cjs");
    fs.writeFileSync(failed, "process.exit(7)");
    const application = await f.owner.launch("application", { entrypoint: failed });
    const capture = await f.owner.launch("capture", { entrypoint: failed });
    await assert.rejects(f.owner.launch("application", { entrypoint: failed }), /LAUNCH/u);
    await Promise.all([processExit(application.child), processExit(capture.child)]);
    const retained = await f.owner.checkpoint(state());
    assert.equal(retained.cleanup.application.payloadExitCode, 7);
    assert.equal(retained.cleanup.capture.payloadExitCode, 7);
    assert.equal(retained.reuseAuthorized, false);
    assert.equal(retained.qualification, false);
  },
);
test(
  "replacing the admitted database inode cannot create a checkpoint and consumes this owner terminally",
  engine,
  async (t) => {
    const f = await fixture(t),
      noop = path.join(f.root, "noop.cjs");
    fs.writeFileSync(noop, "process.exit(0)");
    await f.owner.launch("application", { entrypoint: noop });
    await f.owner.launch("capture", { entrypoint: noop });
    const original = fs.readFileSync(f.databasePath);
    fs.renameSync(f.databasePath, f.databasePath + ".original");
    fs.writeFileSync(f.databasePath, original, { mode: 0o600 });
    await assert.rejects(f.owner.checkpoint(state()), /DATABASE_CHANGED/u);
    await assert.rejects(f.owner.checkpoint(state()), /CHECKPOINT/u);
  },
);
