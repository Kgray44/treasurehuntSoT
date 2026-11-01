import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  spawnOwnedProcess,
  stopOwnedProcess,
  processExit,
  stopOwnedProcessWithClosureProof,
  inspectOwnedProcessClosure,
  consumeOwnedProcessClosure,
} from "../../scripts/sounding-line/owned-process.mjs";
const root = process.cwd();
async function ready(file) {
  const deadline = Date.now() + 15000;
  while (!fs.existsSync(file)) {
    if (Date.now() > deadline) throw Error("FIXTURE_NOT_READY");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
test("actual creation-owned process closure cannot be forged, rebound or consumed twice", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "owned-closure-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "state"),
    child = spawnOwnedProcess(
      process.execPath,
      ["-e", 'require("node:fs").writeFileSync(process.argv[1],"closed prefix");setInterval(()=>{},1000)', file],
      { root, env: { ...process.env }, cleanupOptions: { gracefulMs: 200, forceMs: 1000 } },
    );
  t.after(() => stopOwnedProcess(child));
  await ready(file);
  const closed = await stopOwnedProcessWithClosureProof(child);
  assert.equal(closed.cleanup.status, "PASS");
  assert.equal(closed.cleanup.treeReaped, true);
  assert.equal(closed.cleanup.streamsClosed, true);
  assert.equal(closed.proof.qualification, false);
  assert.equal(closed.proof.reuseAuthorized, false);
  assert.equal(inspectOwnedProcessClosure({ ...closed.proof }, child), null);
  assert.equal(inspectOwnedProcessClosure(closed.proof, {}), null);
  assert.equal(inspectOwnedProcessClosure(closed.proof, child).consumed, false);
  assert.equal(
    await consumeOwnedProcessClosure(closed.proof, child, () => fs.readFileSync(file, "utf8")),
    "closed prefix",
  );
  assert.equal(inspectOwnedProcessClosure(closed.proof, child).consumed, true);
  await assert.rejects(
    consumeOwnedProcessClosure(closed.proof, child, () => "second"),
    /CLOSURE_UNAVAILABLE/u,
  );
  let killed = false;
  await assert.rejects(
    stopOwnedProcessWithClosureProof({
      pid: process.pid,
      kill() {
        killed = true;
      },
    }),
    /CLOSURE_UNOWNED/u,
  );
  assert.equal(killed, false);
});
test("an actual failed process remains failed while its closed tree can support only one failed snapshot operation", async (t) => {
  const child = spawnOwnedProcess(process.execPath, ["-e", "process.exit(7)"], {
    root,
    env: { ...process.env },
    cleanupOptions: { gracefulMs: 200, forceMs: 1000 },
  });
  t.after(() => stopOwnedProcess(child));
  const outcome = await processExit(child);
  assert.equal(outcome.code, 7);
  const closed = await stopOwnedProcessWithClosureProof(child);
  assert.equal(closed.cleanup.payloadExitCode, 7);
  const marker = Error("ORIGINAL_CHECKPOINT_FAILURE");
  await assert.rejects(
    consumeOwnedProcessClosure(closed.proof, child, () => {
      throw marker;
    }),
    (error) => error === marker,
  );
  await assert.rejects(
    consumeOwnedProcessClosure(closed.proof, child, () => 0),
    /CLOSURE_UNAVAILABLE/u,
  );
  assert.equal(closed.proof.classification, "OWNED_TREE_CLOSED_NOT_FULL_RUNTIME_ISOLATION");
});
