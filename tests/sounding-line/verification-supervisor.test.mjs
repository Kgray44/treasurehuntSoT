import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { superviseVerification } from "../../scripts/sounding-line/verification-supervisor.mjs";
import { assertTerminated } from "./fixtures/process-state.mjs";
const runtime = fileURLToPath(new URL("./fixtures/verification-runtime.mjs", import.meta.url));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function observe(root, file) {
  const end = performance.now() + 15000;
  while (performance.now() < end) {
    try {
      return JSON.parse(await readFile(path.join(root, file), "utf8"));
    } catch {
      await pause(20);
    }
  }
  throw new Error("FIXTURE_OBSERVATION_TIMEOUT");
}
async function owned(t, mode, options = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "verification-supervisor-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const pending = superviseVerification({
    root,
    command: process.execPath,
    args: [runtime, mode, root],
    directory: path.join(root, "receipts"),
    identity: { candidate: "a".repeat(40), qualification: false },
    executionMs: 30000,
    ...options,
  });
  return { root, pending };
}
test("external deadline contains a real synchronous verifier hang and retains its failure", async (t) => {
  const { root, pending } = await owned(t, "hang", { executionMs: 4000 });
  const parent = await observe(root, "parent.json"),
    receipt = await pending;
  assert.equal(receipt.status, "FAIL");
  assert.equal(receipt.originalFailure, "SOUNDING_LINE_VERIFICATION_ABSOLUTE_TIMEOUT");
  assert.equal(receipt.cleanupFailure, null);
  assert.equal(receipt.qualification, false);
  await assertTerminated([parent]);
  assert.deepEqual(JSON.parse(await readFile(path.join(root, "receipts/terminal.json"), "utf8")), receipt);
});
test("cancellation reaps a detached owned listener and closes its port", async (t) => {
  const controller = new AbortController();
  const { root, pending } = await owned(t, "orphan", { signal: controller.signal });
  const parent = await observe(root, "parent.json"),
    leaf = await observe(root, "leaf.json");
  controller.abort();
  const receipt = await pending;
  assert.equal(receipt.originalFailure, "SOUNDING_LINE_VERIFICATION_CANCELLED");
  assert.equal(receipt.cleanupFailure, null);
  await assertTerminated([parent, leaf]);
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(leaf.port, "127.0.0.1", resolve);
  });
  await new Promise((resolve) => probe.close(resolve));
});
test("child failure and passing supervision remain separate from release qualification", async (t) => {
  for (const [mode, code] of [
    ["fail", 17],
    ["pass", 0],
  ]) {
    const { pending } = await owned(t, mode),
      receipt = await pending;
    assert.equal(receipt.child.code, code);
    assert.equal(receipt.status, code ? "FAIL" : "PASS");
    assert.equal(receipt.qualification, false);
    assert.equal(receipt.metrics.childCpuMs, null);
    assert.equal(receipt.retryCount, 0);
  }
});
test("retention failure preserves the original child failure and cannot produce passing supervision", async (t) => {
  const { pending } = await owned(t, "fail", {
    publish: async (file, bytes, options) => {
      if (file.endsWith("terminal.json")) throw Object.assign(new Error("synthetic disk full"), { code: "ENOSPC" });
      return writeFile(file, bytes, options);
    },
  });
  await assert.rejects(pending, (error) => {
    assert.equal(error.message, "SOUNDING_LINE_VERIFICATION_RETENTION_FAILURE");
    assert.equal(error.cause.code, "ENOSPC");
    assert.equal(error.supervisionReceipt.originalFailure, "SOUNDING_LINE_VERIFICATION_CHILD_FAILURE");
    assert.equal(error.supervisionReceipt.child.code, 17);
    assert.equal(error.supervisionReceipt.cleanupFailure, null);
    return true;
  });
});
test("a command timeout keeps its original cause and the enclosing OS ownership reaps its child", async (t) => {
  const { root, pending } = await owned(t, "command-hang");
  const failure = await observe(root, "command-failure.json"),
    receipt = await pending;
  assert.equal(failure.code, "SOUNDING_LINE_VERIFICATION_COMMAND_BUDGET_EXHAUSTED");
  assert.equal(failure.causeCode, "ETIMEDOUT");
  assert.equal(receipt.status, "FAIL");
  assert.equal(receipt.cleanupFailure, null);
  await assertTerminated([await observe(root, "parent.json")]);
});
