import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createRawOutputDirectory } from "../../scripts/sounding-line/experience-raw-output.mjs";
import {
  createOwnedRuntimeStateRetentionFactory,
  inspectOwnedRuntimeStateCut,
} from "../../scripts/sounding-line/owned-runtime-state-retention.mjs";
import { restoreRuntimeSnapshotRetention } from "../../scripts/sounding-line/runtime-snapshot-retention.mjs";
import { processExit, spawnOwnedProcess, stopOwnedProcess } from "../../scripts/sounding-line/owned-process.mjs";
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
  const factory = await createOwnedRuntimeStateRetentionFactory({
    root,
    rawDirectory,
    prNumber: originalBinding.prNumber,
  });
  const owner = await factory.forContext({ databasePath, originalBinding });
  t.after(async () => {
    await factory.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const application = path.join(root, "application.cjs"),
    capture = path.join(root, "capture.cjs");
  fs.writeFileSync(
    application,
    `const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.env.DATABASE_URL.slice(5));db.exec("PRAGMA journal_mode=WAL;PRAGMA wal_autocheckpoint=0;INSERT INTO fixture VALUES ('actual owned committed state')");require('node:fs').writeFileSync(process.argv[2],'ready');setInterval(()=>{},1000);`,
  );
  fs.writeFileSync(capture, `require('node:fs').writeFileSync(process.argv[2],'ready');setInterval(()=>{},1000);`);
  return { root, rawDirectory, databasePath, factory, owner, application, capture };
}
const state = () => ({
  authenticationCache: Buffer.from('{"cookies":[]}'),
  fixtureState: Buffer.from('{"fixture":"original"}'),
});
test(
  "existing supervisor launches can be adopted only through their actual creation identity and declared database",
  engine,
  async (t) => {
    const f = await fixture(t),
      entrypoint = path.join(f.root, "adopt.cjs");
    fs.writeFileSync(entrypoint, "process.exit(0)");
    const outside = spawnOwnedProcess(process.execPath, [entrypoint], {
      root: f.root,
      env: { ...process.env, DATABASE_URL: "file:wrong.db" },
      cleanupOptions: { gracefulMs: 200, forceMs: 1000 },
    });
    const children = [outside];
    t.after(async () => {
      await Promise.all(children.map((child) => stopOwnedProcess(child)));
    });
    await assert.rejects(
      f.owner.adoptCreatedProcess("application", { child: outside, entrypoint }),
      /CREATION_BINDING/u,
    );
    await assert.rejects(
      f.owner.adoptCreatedProcess("application", { child: { ...outside }, entrypoint }),
      /CREATION_BINDING/u,
    );
    const application = spawnOwnedProcess(process.execPath, [entrypoint], {
      root: f.root,
      env: { ...process.env, DATABASE_URL: `file:${f.databasePath}` },
      cleanupOptions: { gracefulMs: 200, forceMs: 1000 },
    });
    children.push(application);
    await f.owner.adoptCreatedProcess("application", { child: application, entrypoint });
    await assert.rejects(f.owner.adoptCreatedProcess("capture", { child: application, entrypoint }), /LAUNCH/u);
    const capture = spawnOwnedProcess(process.execPath, [entrypoint], {
      root: f.root,
      env: { ...process.env, DATABASE_URL: `file:${f.databasePath}` },
      cleanupOptions: { gracefulMs: 200, forceMs: 1000 },
    });
    children.push(capture);
    await f.owner.adoptCreatedProcess("capture", { child: capture, entrypoint });
    await Promise.all(children.map((child) => processExit(child)));
    const retained = await f.owner.checkpoint(state());
    assert.equal(retained.cleanup.capture.status, "PASS");
    assert.equal(retained.qualification, false);
    assert.equal(retained.reuseAuthorized, false);
  },
);
test(
  "two context cuts share a finite store while preserving both original bindings and the first immutable database",
  engine,
  async (t) => {
    const f = await fixture(t);
    await assert.rejects(
      f.factory.forContext({
        databasePath: f.databasePath,
        originalBinding: { ...binding, contextId: "f".repeat(64) },
      }),
      /CONTEXT/u,
    );
    const run = async (owner, suffix) => {
      const appReady = path.join(f.root, `application-ready-${suffix}`),
        captureReady = path.join(f.root, `capture-ready-${suffix}`);
      await owner.launch("application", { entrypoint: f.application, args: [appReady] });
      await owner.launch("capture", { entrypoint: f.capture, args: [captureReady] });
      await Promise.all([ready(appReady), ready(captureReady)]);
      return await owner.checkpoint(state());
    };
    const first = await run(f.owner, "first"),
      firstManifest = fs.readFileSync(first.retained.path);
    const databasePath = path.join(f.root, rawDirectory, "second-runtime.db"),
      secondBinding = { ...binding, contextId: "f".repeat(64) };
    fs.writeFileSync(databasePath, fs.readFileSync(first.snapshot.path), { flag: "wx", mode: 0o600 });
    const next = await f.factory.forContext({ databasePath, originalBinding: secondBinding });
    await assert.rejects(f.factory.forContext({ databasePath, originalBinding: secondBinding }), /CONTEXT/u);
    await assert.rejects(
      f.factory.forContext({ databasePath, originalBinding: { ...binding, prNumber: 805 } }),
      /CONTEXT/u,
    );
    const second = await run(next, "second");
    assert(
      second.retained.measurements.newBytes < second.retained.measurements.inputBytes + second.retained.bytes,
      "identical authentication and fixture chunks are retained once",
    );
    assert(fs.readFileSync(first.retained.path).equals(firstManifest));
    for (const [result, expectedOriginalBinding, count] of [
      [first, binding, 1],
      [second, secondBinding, 2],
    ]) {
      const restored = await restoreRuntimeSnapshotRetention({ ...f, id: result.retained.id, expectedOriginalBinding });
      const sqlite = path.join(f.root, `restored-${count}.db`);
      fs.writeFileSync(sqlite, restored.files.get("sqlite-backup"));
      assert.equal(
        Number(
          execFileSync(
            "python",
            [
              "-c",
              "import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);print(c.execute('select count(*) from fixture').fetchone()[0]);c.close()",
              sqlite,
            ],
            { encoding: "utf8", windowsHide: true, timeout: 10000 },
          ).trim(),
        ),
        count,
      );
      assert.equal(result.qualification, false);
      assert.equal(result.reuseAuthorized, false);
    }
  },
);
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
    assert(inspectOwnedRuntimeStateCut(observed, { root: f.root, expectedOriginalBinding: binding }));
    assert.equal(
      inspectOwnedRuntimeStateCut(structuredClone(observed), { root: f.root, expectedOriginalBinding: binding }),
      null,
    );
    assert.equal(
      inspectOwnedRuntimeStateCut(observed, {
        root: f.root,
        expectedOriginalBinding: { ...binding, contextId: "f".repeat(64) },
      }),
      null,
    );
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
    observed.originalBinding.candidateSha = "0".repeat(40);
    assert.equal(inspectOwnedRuntimeStateCut(observed, { root: f.root, expectedOriginalBinding: binding }), null);
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
