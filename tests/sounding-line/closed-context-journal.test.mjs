// Synthetic raw-output boundary tests; no capture or provider acceptance claim.
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, truncateSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createRawOutputDirectory,
  createClosedContextJournal,
  sealRawCaptureOutput,
  observeClosedContextShadow,
  closedContextShadowAllowed,
} from "../../scripts/sounding-line/experience-raw-output.mjs";
import {
  retainRawCaptureOutput,
  verifiedRawCapturePaths,
} from "../../scripts/sounding-line/experience-raw-retention.mjs";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("new context observation excludes held owners, finite grants and unknown PR identity", () => {
  assert.equal(closedContextShadowAllowed({ prNumber: 900 }), true);
  assert.equal(closedContextShadowAllowed({}, "900"), true);
  for (const prNumber of [721, 776, 805, "805", undefined, null, "unknown", "0900", "9e2", 0])
    assert.equal(closedContextShadowAllowed({}, prNumber), false);
  assert.equal(closedContextShadowAllowed({ prNumber: 900, exception: { recordDigest: "f".repeat(64) } }), false);
  assert.equal(closedContextShadowAllowed(null, 900), false);
});

test("shadow IO failures remain ineligible without changing canonical capture or leaking private errors", async (t) => {
  const logs = [];
  t.mock.method(console, "error", (value) => logs.push(value));
  let operations = 0;
  const value = Object.freeze({ original: "unchanged" });
  const pass = await observeClosedContextShadow(() => {
    operations++;
    return value;
  });
  assert.equal(pass.value, value);
  assert.equal(operations, 1);
  assert.equal(pass.reuseAuthorized, false);
  const failure = Object.assign(Error("PRIVATE_CAPTURE_PATH_AND_CONTENT"), { code: "ENOSPC" });
  const result = await observeClosedContextShadow(() => {
    throw failure;
  });
  assert.deepEqual(result, { status: "INCOMPLETE", reason: "ENOSPC", qualification: false, reuseAuthorized: false });
  assert.equal(logs.join("").includes("PRIVATE_CAPTURE"), false);
  assert.equal(failure.message, "PRIVATE_CAPTURE_PATH_AND_CONTENT");
  assert.equal(value.original, "unchanged");
});

test("untrusted error tags, accessors and failed shadow logging cannot become capture failures", async (t) => {
  const logs = [];
  t.mock.method(console, "error", (value) => logs.push(value));
  const secret = { code: "PRIVATE_SECRET_TOKEN", message: "PRIVATE_CAPTURE_PATH" };
  assert.equal(
    (
      await observeClosedContextShadow(() => {
        throw secret;
      })
    ).reason,
    "UNCLASSIFIED_SHADOW_FAILURE",
  );
  assert(!logs.join("").includes("PRIVATE_"));
  const hostile = {
    get code() {
      throw Error("private accessor");
    },
  };
  assert.equal(
    (
      await observeClosedContextShadow(() => {
        throw hostile;
      })
    ).status,
    "INCOMPLETE",
  );
  t.mock.method(console, "error", () => {
    throw Error("closed log stream");
  });
  assert.equal(
    (
      await observeClosedContextShadow(() => {
        throw Error("original");
      })
    ).qualification,
    false,
  );
});
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
  assert.equal(saved.rawFiles.length, f.artifacts.length);
  for (const raw of saved.rawFiles) {
    assert(raw.path.startsWith(`${f.rawDirectory}/generic/closed-media/`));
    assert(readFileSync(path.join(f.root, raw.path)).equals(readFileSync(path.join(f.root, raw.originalPath))));
    assert.equal(hash(readFileSync(path.join(f.root, raw.path))), raw.sha256);
  }
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

test("existing finalized raw recording is bound byte-for-byte without another video copy", async (t) => {
  const f = await fixture(t);
  const recordingSource = `${f.rawDirectory}/generic/recordings/original.webm`;
  mkdirSync(path.dirname(path.join(f.root, recordingSource)), { recursive: true });
  const recording = f.artifacts.find((a) => a.type === "recording");
  writeFileSync(path.join(f.root, recordingSource), readFileSync(path.join(f.root, recording.path)));
  const receipt = await f.journal.append({ ...f, recordingSource });
  const saved = JSON.parse(readFileSync(path.join(f.root, receipt.path)));
  assert.equal(saved.rawFiles.find((file) => file.originalPath === recording.path).path, recordingSource);
});

test("equal basenames in different original paths retain separate immutable byte bindings", async (t) => {
  const f = await fixture(t);
  const first = f.artifacts[0];
  const file = first.path.replace("/generic/", "/another/");
  mkdirSync(path.dirname(path.join(f.root, file)), { recursive: true });
  const bytes = Buffer.from("a different logical capture with the same basename");
  writeFileSync(path.join(f.root, file), bytes);
  f.artifacts.push({ ...first, id: "another-screenshot", path: file, sha256: hash(bytes) });
  const receipt = await f.journal.append(f);
  const saved = JSON.parse(readFileSync(path.join(f.root, receipt.path)));
  const a = saved.rawFiles.find((entry) => entry.originalPath === first.path);
  const b = saved.rawFiles.find((entry) => entry.originalPath === file);
  assert.notEqual(a.path, b.path);
  assert.notEqual(a.sha256, b.sha256);
  assert(readFileSync(path.join(f.root, b.path)).equals(bytes));
});

test("media size and aggregate allowance fail closed before copying and cannot raise the hard cap", async (t) => {
  const f = await fixture(t);
  const limited = await createClosedContextJournal({
    ...f,
    rawDirectory: `${f.rawDirectory}/small`,
    maximumMediaBytes: 1,
  });
  await assert.rejects(limited.append(f), /CLOSED_CONTEXT_BOUND/u);
  assert.equal(existsSync(path.join(f.root, f.rawDirectory, "small", "closed-media")), false);
  await assert.rejects(
    createClosedContextJournal({ ...f, maximumMediaBytes: 256 * 1024 * 1024 + 1 }),
    /CLOSED_CONTEXT_BOUND/u,
  );
  truncateSync(path.join(f.root, f.artifacts[0].path), 64 * 1024 * 1024 + 1);
  await assert.rejects(f.journal.append(f), /CLOSED_CONTEXT_BOUND/u);
  assert.equal(existsSync(path.join(f.root, f.rawDirectory, "generic", "closed-media")), false);
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
