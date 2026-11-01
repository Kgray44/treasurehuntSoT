import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { superviseVerification } from "../../scripts/sounding-line/verification-supervisor.mjs";
import { ordinaryVerificationInvocation } from "../../scripts/sounding-line/ordinary-supervised.mjs";
import { assertTerminated } from "./fixtures/process-state.mjs";
const runtime = fileURLToPath(new URL("./fixtures/verification-runtime.mjs", import.meta.url));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function candidateWorkspace(t) {
  const parent = await mkdtemp(path.join(tmpdir(), "verification-workspace-"));
  assert(parent.startsWith(path.resolve(tmpdir()) + path.sep));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const root = path.join(parent, "candidate");
  await mkdir(path.join(root, "testing"), { recursive: true });
  await writeFile(path.join(root, "testing/contracts.json"), "{}\n");
  await writeFile(path.join(root, "package.json"), '{"scripts":{}}\n');
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-q");
  git("config", "user.name", "Workspace fixture");
  git("config", "user.email", "fixture@example.invalid");
  git("add", ".");
  git("commit", "-qm", "fixture base");
  const baseSha = git("rev-parse", "HEAD");
  await mkdir(path.join(root, "scripts/sounding-line"), { recursive: true });
  await writeFile(path.join(root, "scripts/sounding-line/cwd-fixture.mjs"), "export const fixture = true;\n");
  git("add", ".");
  git("commit", "-qm", "control-plane candidate");
  return { parent, root, baseSha, candidateSha: git("rev-parse", "HEAD") };
}

test("supervised ordinary CLI keeps one canonical workspace after the guardian changes cwd", async (t) => {
  const entry = fileURLToPath(new URL("../../scripts/sounding-line/ordinary.mjs", import.meta.url));
  const environment = { ...process.env, GITHUB_ACTIONS: "false", SOUNDING_LINE_PR_NUMBER: "0" };
  const original = await candidateWorkspace(t);
  const failed = await superviseVerification({
    root: original.root,
    command: process.execPath,
    args: [
      entry,
      "--mode",
      "ordinary",
      "--workspace",
      "candidate",
      "--base",
      original.baseSha,
      "--candidate",
      original.candidateSha,
    ],
    environment,
    identity: { qualification: false },
    directory: path.join(original.parent, "old-receipts"),
    executionMs: 30000,
  });
  assert.equal(failed.status, "FAIL");
  const nested = JSON.parse(
    await readFile(path.join(original.root, "candidate/artifacts/sounding-line/ordinary-decision.json"), "utf8"),
  );
  assert.equal(nested.failureObservation.code, "ENOENT");
  await assert.rejects(readFile(path.join(original.root, "artifacts/sounding-line/ordinary-decision.json")), {
    code: "ENOENT",
  });

  const fixed = await candidateWorkspace(t);
  const invocation = ordinaryVerificationInvocation({
    workspace: "candidate",
    workingDirectory: fixed.parent,
    baseSha: fixed.baseSha,
    candidateSha: fixed.candidateSha,
  });
  assert.equal(invocation.root, fixed.root);
  const receipt = await superviseVerification({
    ...invocation,
    environment,
    identity: { qualification: false },
    directory: path.join(fixed.parent, "fixed-receipts"),
    executionMs: 30000,
  });
  // A deliberately forbidden controller edit proves classification ran in the
  // right repository; it must still fail qualification, rather than run tools.
  assert.equal(receipt.status, "FAIL");
  assert.equal(receipt.cleanupFailure, null);
  const decision = JSON.parse(
    await readFile(path.join(fixed.root, "artifacts/sounding-line/ordinary-decision.json"), "utf8"),
  );
  assert.match(decision.error, /SOUNDING_LINE_CONTROL_PLANE_CHANGE_REQUIRES_RELEASE_MODE/u);
  assert.notEqual(decision.failureObservation.code, "ENOENT");
  await assert.rejects(readFile(path.join(fixed.root, "candidate/artifacts/sounding-line/ordinary-decision.json")), {
    code: "ENOENT",
  });
  assert.equal(
    ordinaryVerificationInvocation({
      workspace: fixed.root,
      workingDirectory: original.parent,
      baseSha: fixed.baseSha,
      candidateSha: fixed.candidateSha,
    }).root,
    fixed.root,
  );
});
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
      if (file.endsWith("initial.json")) {
        const initial = JSON.parse(bytes);
        assert.equal(initial.status, "INCOMPLETE");
        assert.equal(initial.qualification, false);
      }
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

test("supervision records known capacity and job lookups without inventing a total", async (t) => {
  for (const [identity, expected] of [
    [{ jobLookupCalls: 1, capacityLookupCalls: 3 }, 4],
    [{ jobLookupCalls: 1, capacityLookupCalls: 0 }, 1],
    [{}, null],
  ]) {
    const { pending } = await owned(t, "pass", { identity });
    const receipt = await pending;
    assert.equal(receipt.status, "PASS");
    assert.equal(receipt.metrics.knownApiCalls, expected);
    assert.equal(receipt.metrics.totalApiCalls, null);
    assert.equal(receipt.qualification, false);
  }
});
