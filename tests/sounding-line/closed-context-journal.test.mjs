// Synthetic raw-output boundary tests; no capture or provider acceptance claim.
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createRawOutputDirectory,
  createClosedContextJournal,
  sealRawCaptureOutput,
} from "../../scripts/sounding-line/experience-raw-output.mjs";
import {
  retainRawCaptureOutput,
  verifiedRawCapturePaths,
} from "../../scripts/sounding-line/experience-raw-retention.mjs";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "closed-context-journal-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const invocation = "artifacts/sounding-line/product-experience-capture-staging/capture-synthetic";
  const rawDirectory = `${invocation}/raw`;
  await createRawOutputDirectory({ root, directory: rawDirectory });
  await createRawOutputDirectory({ root, directory: `${rawDirectory}/generic` });
  const binding = {
    baseSha: "a".repeat(40),
    candidateSha: "b".repeat(40),
    sourceDigest: "c".repeat(64),
    contractDigest: "d".repeat(64),
    recordDigest: null,
  };
  const context = {
    contractId: "fixture",
    journeyId: "first",
    device: "DESKTOP",
    role: "ANONYMOUS",
    motionMode: "REDUCED",
    viewport: { width: 1280, height: 720 },
  };
  mkdirSync(path.join(root, invocation, "capture", "generic"), { recursive: true });
  const artifacts = ["screenshot", "trace", "recording"].map((type) => {
    const file = `${invocation}/capture/generic/SOURCE_ONLY_PRIVATE_${type}.bin`;
    const bytes = Buffer.from(`inert ${type}`);
    writeFileSync(path.join(root, file), bytes);
    const scope = Object.fromEntries(["contractId", "device", "role", "motionMode"].map((key) => [key, context[key]]));
    return { id: type, path: file, sha256: hash(bytes), type, origin: "ACTUAL_APPLICATION", ...scope };
  });
  const journal = await createClosedContextJournal({ root, rawDirectory: `${rawDirectory}/generic`, binding });
  return {
    root,
    rawDirectory,
    binding,
    context,
    artifacts,
    journal,
    journey: {
      id: "first",
      contractId: context.contractId,
      device: context.device,
      role: context.role,
      motionMode: context.motionMode,
      status: "PASS",
      accessibility: { axeSerious: [] },
    },
  };
}

test("a closed prefix keeps original identities and hashes when a later context fails", async (t) => {
  const f = await fixture(t);
  const original = structuredClone({ context: f.context, artifacts: f.artifacts, journey: f.journey });
  const receipt = await f.journal.append(original);
  original.context.journeyId = "later failed context";
  original.artifacts[0].sha256 = "0".repeat(64);
  const bytes = readFileSync(path.join(f.root, receipt.path));
  assert.equal(hash(bytes), receipt.sha256);
  const saved = JSON.parse(bytes);
  assert.equal(saved.context.journeyId, "first");
  assert.deepEqual(saved.artifacts, f.artifacts);
  assert.deepEqual(saved.binding, f.binding);
  assert.equal(saved.reuseAuthorized, false);
  assert.equal(saved.qualification, false);
  assert.equal(saved.mutableStateClass, "UNATTESTED_SHARED_TASK_RUNTIME");
  assert.equal(saved.parentRuntimeCleanup, "UNAVAILABLE_UNTIL_PARENT_REAP");
  const sealed = await sealRawCaptureOutput({ ...f, outcome: "FAIL" });
  assert.equal(sealed.outcome, "FAIL");
  assert.equal(sealed.files.find((file) => file.path === receipt.path).classification, "RAW_ONLY");
  const encryptedDirectory = f.rawDirectory.slice(0, -3) + "encrypted";
  const retained = await retainRawCaptureOutput({ ...f, encryptedDirectory, outcome: "FAIL" });
  for (const file of await verifiedRawCapturePaths(retained)) {
    const encrypted = readFileSync(path.join(f.root, file)).toString("utf8");
    assert.equal(encrypted.includes("SOURCE_ONLY_PRIVATE"), false);
    assert.equal(encrypted.includes(receipt.path), false);
    assert.equal(encrypted.includes(receipt.sha256), false);
    for (const artifact of f.artifacts) assert.equal(encrypted.includes(artifact.sha256), false);
  }
  await assert.rejects(f.journal.append(f), /EEXIST/u);
  assert(bytes.equals(readFileSync(path.join(f.root, receipt.path))));
});

test("wrong context, substituted media, missing finalized recording and path escape never create a checkpoint", async (t) => {
  const f = await fixture(t);
  for (const change of [
    (x) => {
      x.artifacts[0].role = "CREATOR";
    },
    (x) => {
      x.artifacts[0].sha256 = "0".repeat(64);
    },
    (x) => {
      x.artifacts = x.artifacts.filter((a) => a.type !== "recording");
    },
    (x) => {
      x.artifacts[0].path = "../outside";
    },
    (x) => {
      x.artifacts.push(x.artifacts[0]);
    },
    (x) => {
      x.context.role = "";
    },
    (x) => {
      x.context.viewport.width = 0;
    },
    (x) => {
      x.journey.id = "other";
    },
    (x) => {
      x.journey.status = "FAIL";
    },
    (x) => {
      x.journey.payload = "x".repeat(2 * 1024 * 1024);
    },
  ]) {
    const input = structuredClone({ context: f.context, artifacts: f.artifacts, journey: f.journey });
    change(input);
    await assert.rejects(f.journal.append(input), /RAW_OUTPUT_/u);
  }
  const saved = await f.journal.append(f);
  assert.equal(saved.qualification, false);
  await assert.rejects(
    createClosedContextJournal({ ...f, binding: { ...f.binding, recordDigest: "e".repeat(64) } }),
    /CLOSED_CONTEXT_ORDINARY_SCOPE_REQUIRED/u,
  );
});
