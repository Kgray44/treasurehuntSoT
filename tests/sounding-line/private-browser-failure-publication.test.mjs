// Inert public-key encryption and filesystem faults only: no browser, API, private owner key or acceptance.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import * as publication from "../../scripts/sounding-line/private-browser-failure-publication.mjs";
import {
  PRIVATE_BROWSER_FAILURE_CONTEXT,
  writeBrowserFailureManifest,
} from "../../scripts/sounding-line/private-browser-failure.mjs";

const canary = "PRIVATE_UNTRUSTED_PUBLICATION_BODY_MUST_NOT_UPLOAD";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const binding = () => ({
  version: 1,
  runId: randomUUID(),
  scopeId: randomUUID(),
  baseSha: "a".repeat(40),
  candidateSha: "b".repeat(40),
  planDigest: "c".repeat(64),
});
function fixture(t) {
  const root = fs.mkdtempSync(path.join(tmpdir(), "private-failure-publication-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const candidate = path.join(root, "candidate"),
    authority = path.join(root, "authority");
  fs.mkdirSync(candidate, { mode: 0o700 });
  fs.mkdirSync(authority, { mode: 0o700 });
  const session = publication.createPublishableBrowserFailureRetention({
    root: candidate,
    binding: binding(),
    authorityRoot: authority,
  });
  const context = JSON.parse(session.environment[PRIVATE_BROWSER_FAILURE_CONTEXT]);
  return {
    root,
    candidate,
    authority,
    session,
    context,
    published: path.join(authority, "artifacts/sounding-line/private-browser-failure-publication"),
  };
}
function media(f, missing) {
  const records = [],
    failureId = "1".repeat(64);
  for (const [kind, extension] of Object.entries({
    screenshot: "png",
    video: "webm",
    trace: "zip",
    "error-context": "md",
  })) {
    if (kind === missing) continue;
    const name = `${kind}.${extension}`;
    fs.writeFileSync(path.join(f.session.resultsDirectory, name), `${canary}:${kind}`, { mode: 0o600 });
    records.push({ failureId, status: "failed", kind, path: name });
  }
  writeBrowserFailureManifest(f.context, records, false, [{ id: failureId, status: "failed" }]);
}
const finish = (f) => f.session.complete({ exitCode: 1, signal: null, workerClosed: true });
function staged(f, result) {
  return path.join(f.published, result.publication.publicationId);
}
function assertRaw(f) {
  assert.equal(
    fs.readFileSync(path.join(f.session.resultsDirectory, "screenshot.png"), "utf8"),
    `${canary}:screenshot`,
  );
}
function assertNoPublication(f) {
  assert.equal(fs.existsSync(f.published) ? fs.readdirSync(f.published).length : 0, 0);
  assertRaw(f);
}
function mutateCipher(f, mutate) {
  const target = path.join(f.session.directory, "failure.encrypted"),
    original = fs.openSync;
  let reads = 0;
  fs.openSync = function (file, flags, ...args) {
    if (
      file === target &&
      typeof flags === "number" &&
      (flags & fs.constants.O_WRONLY) === 0 &&
      (flags & fs.constants.O_RDWR) === 0 &&
      ++reads === 2
    )
      mutate(target);
    return original.call(this, file, flags, ...args);
  };
  syncBuiltinESMExports();
  try {
    return finish(f);
  } finally {
    fs.openSync = original;
    syncBuiltinESMExports();
  }
}

test("only actual collector closure publishes an exact encrypted pair and safe allowlisted metadata", (t) => {
  const f = fixture(t);
  media(f);
  const result = finish(f);
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.equal(typeof result.then, "undefined");
  assert.equal(result.retention, "COMPLETE");
  assert.equal(result.worker.exitCode, 1);
  assert.equal(result.publication.status, "STAGED");
  assert.equal(result.qualification, false);
  const target = staged(f, result);
  assert.deepEqual(fs.readdirSync(target).sort(), ["failure.encrypted", "retention.json"]);
  assert.deepEqual(result.publication.uploadPaths, [
    path.join(target, "failure.encrypted"),
    path.join(target, "retention.json"),
  ]);
  const source = fs.readFileSync(path.join(f.session.directory, "failure.encrypted")),
    copy = fs.readFileSync(path.join(target, "failure.encrypted"));
  assert(source.equals(copy));
  assert.equal(hash(copy), result.ciphertextDigest);
  const metadata = JSON.parse(fs.readFileSync(path.join(target, "retention.json")));
  assert.equal(metadata.retention, "COMPLETE");
  assert.equal(metadata.qualification, false);
  assert.equal(metadata.diagnosticBinding.sessionId, f.context.sessionId);
  assert.equal(JSON.stringify(metadata).includes(canary), false);
  assert.equal(copy.includes(Buffer.from(canary)), false);
  assertRaw(f);
  assert.equal(fs.lstatSync(target).mode & 0o777, 0o700);
  for (const name of fs.readdirSync(target)) assert.equal(fs.lstatSync(path.join(target, name)).mode & 0o777, 0o600);
  assert.equal(
    fs.readdirSync(path.join(f.authority, "artifacts/sounding-line/private-browser-failure-publication-pending"))
      .length,
    0,
  );
  const repeated = f.session.complete({ exitCode: 0, signal: null, workerClosed: true });
  assert.equal(repeated.worker.exitCode, 1);
  assert.equal(repeated.publication.status, "NOT_REPUBLISHED");
  assert.equal(fs.readdirSync(f.published).length, 1);
});
test("a preplanted plaintext sibling cannot enter the exact minted upload selection", (t) => {
  const f = fixture(t);
  media(f);
  const sibling = path.join(f.published, "preplanted-private-body");
  fs.mkdirSync(sibling, { recursive: true, mode: 0o700 });
  for (const name of ["failure.encrypted", "retention.json"])
    fs.writeFileSync(path.join(sibling, name), canary, { mode: 0o600 });
  const result = finish(f);
  assert.equal(result.retention, "COMPLETE");
  assert.equal(result.publication.status, "STAGED");
  const target = staged(f, result);
  assert.deepEqual(result.publication.uploadPaths, [
    path.join(target, "failure.encrypted"),
    path.join(target, "retention.json"),
  ]);
  assert.equal(
    result.publication.uploadPaths.some((file) => file.startsWith(sibling)),
    false,
  );
  for (const file of result.publication.uploadPaths) {
    assert.equal(file.includes("*"), false);
    assert.equal(fs.readFileSync(file).includes(Buffer.from(canary)), false);
  }
  assert.equal(fs.readFileSync(path.join(sibling, "failure.encrypted"), "utf8"), canary);
  assertRaw(f);
});
test("forged outcome metadata and candidate retention JSON cannot become publication authority", (t) => {
  const f = fixture(t);
  media(f);
  const file = path.join(f.session.directory, "retention.json");
  fs.writeFileSync(file, JSON.stringify({ retention: "COMPLETE", raw: canary, ciphertextDigest: "0".repeat(64) }));
  const result = f.session.complete({
    exitCode: 1,
    signal: null,
    workerClosed: true,
    context: { directory: "/outside" },
    retention: { retention: "COMPLETE", raw: canary },
  });
  assert.equal(result.retention, "INCOMPLETE");
  assert(result.issues.includes("PERSISTENCE_FAILED"));
  assert.equal(result.publication.status, "STAGED");
  const metadata = fs.readFileSync(path.join(staged(f, result), "retention.json"), "utf8");
  assert.equal(JSON.parse(metadata).retention, "INCOMPLETE");
  assert.equal(metadata.includes(canary), false);
  assert.equal(fs.readFileSync(file, "utf8").includes(canary), true);
  assertRaw(f);
  assert.deepEqual(Object.keys(publication).sort(), [
    "browserFailurePublicationUploadPaths",
    "createPublishableBrowserFailureRetention",
    "validateBrowserFailurePublication",
  ]);
});
test("missing and unclosed collector work cannot publish forged-but-shaped results", (t) => {
  const f = fixture(t);
  media(f);
  const result = f.session.complete({
    exitCode: 1,
    signal: null,
    workerClosed: false,
    retention: {
      format: "VW-POSTTECHNICAL-EVIDENCE-1",
      ciphertextDigest: "a".repeat(64),
      ciphertextBytes: 123,
      qualification: false,
    },
  });
  assert.equal(result.retention, "INCOMPLETE");
  assert.equal(result.publication.status, "NOT_PUBLISHED");
  assertNoPublication(f);
});
test("valid encrypted partial coverage is published explicitly INCOMPLETE", (t) => {
  const f = fixture(t);
  media(f, "trace");
  const result = finish(f);
  assert.equal(result.retention, "INCOMPLETE");
  assert.equal(result.publication.status, "STAGED");
  const metadata = JSON.parse(fs.readFileSync(path.join(staged(f, result), "retention.json")));
  assert.equal(metadata.retention, "INCOMPLETE");
  assert(metadata.issues.includes("MISSING_TRACE"));
  assertRaw(f);
});
for (const kind of ["plaintext", "directory", "symlink"]) {
  test(`preexisting ${kind} named failure.encrypted is never copied or uploaded`, (t) => {
    const f = fixture(t);
    media(f);
    const file = path.join(f.session.directory, "failure.encrypted");
    if (kind === "plaintext") fs.writeFileSync(file, canary);
    if (kind === "directory") {
      fs.mkdirSync(file);
      fs.writeFileSync(path.join(file, "raw-debug.txt"), canary);
    }
    if (kind === "symlink") fs.symlinkSync(path.join(f.session.resultsDirectory, "screenshot.png"), file);
    const result = finish(f);
    assert.equal(result.retention, "ENCRYPTION_FAILED");
    assert.equal(result.publication.status, "NOT_PUBLISHED");
    assertNoPublication(f);
  });
}
for (const kind of ["changed", "symlink", "hardlink", "stale"]) {
  test(`cipher ${kind} fault after genuine collection is rejected and original failure/raw remain`, (t) => {
    const f = fixture(t);
    media(f);
    const result = mutateCipher(f, (file) => {
      if (kind === "changed") fs.writeFileSync(file, canary);
      if (kind === "symlink") {
        fs.unlinkSync(file);
        fs.symlinkSync(path.join(f.session.resultsDirectory, "screenshot.png"), file);
      }
      if (kind === "hardlink") fs.linkSync(file, path.join(f.root, "second-link.encrypted"));
      if (kind === "stale") fs.utimesSync(file, new Date(0), new Date(0));
    });
    assert.equal(result.retention, "COMPLETE");
    assert.equal(result.worker.exitCode, 1);
    assert.equal(result.publication.status, "NOT_PUBLISHED");
    assertNoPublication(f);
  });
}
test("FIFO cipher fault remains nonblocking and cannot publish", { timeout: 10000 }, (t) => {
  if (process.env.SOUNDING_LINE_PUBLICATION_FIFO_PROBE !== "1") {
    const child = spawnSync(
      process.execPath,
      ["--test", "--test-name-pattern", "FIFO cipher fault", fileURLToPath(import.meta.url)],
      { env: { ...process.env, SOUNDING_LINE_PUBLICATION_FIFO_PROBE: "1" }, timeout: 5000, encoding: "utf8" },
    );
    assert.ifError(child.error);
    assert.equal(child.status, 0, child.stderr + child.stdout);
    return;
  }
  const f = fixture(t);
  media(f);
  const result = mutateCipher(f, (file) => {
    fs.unlinkSync(file);
    const child = spawnSync("mkfifo", [file], { timeout: 1000 });
    assert.equal(child.status, 0);
  });
  assert.equal(result.worker.exitCode, 1);
  assert.equal(result.publication.status, "NOT_PUBLISHED");
  assertNoPublication(f);
});
for (const kind of ["file", "symlink", "writable"]) {
  test(`invalid ${kind} publication ancestor preserves the collector result and raw evidence`, (t) => {
    const f = fixture(t);
    media(f);
    const artifacts = path.join(f.authority, "artifacts");
    if (kind === "file") fs.writeFileSync(artifacts, "blocked");
    if (kind === "symlink") fs.symlinkSync(f.candidate, artifacts);
    if (kind === "writable") {
      fs.mkdirSync(artifacts);
      fs.chmodSync(artifacts, 0o777);
    }
    const result = finish(f);
    assert.equal(result.retention, "COMPLETE");
    assert.equal(result.worker.exitCode, 1);
    assert.equal(result.publication.status, "NOT_PUBLISHED");
    assertNoPublication(f);
  });
}
test("pure envelope validation rejects schema/base64/context/key/hash substitutions without staging", (t) => {
  const f = fixture(t);
  media(f);
  const retention = finish(f),
    original = fs.readFileSync(path.join(f.session.directory, "failure.encrypted"));
  const validated = publication.validateBrowserFailurePublication({
    bytes: original,
    context: f.context,
    retention: {
      ...retention,
      raw: canary,
      worker: { ...retention.worker, raw: canary },
      issues: ["PRIVATE_UNTRUSTED_CODE_WITH_CANARY"],
    },
  });
  assert.equal(JSON.stringify(validated).includes(canary), false);
  assert.deepEqual(validated.issues, ["UNCLASSIFIED_COLLECTION_ISSUE"]);
  const variants = [];
  const envelope = JSON.parse(original),
    header = JSON.parse(Buffer.from(envelope.aad, "base64"));
  variants.push(Buffer.from(canary));
  variants.push(Buffer.from(JSON.stringify({ ...envelope, raw: canary })));
  variants.push(Buffer.from(JSON.stringify({ ...envelope, ciphertext: envelope.ciphertext + "!" })));
  variants.push(Buffer.from(JSON.stringify({ ...envelope, tag: Buffer.alloc(15).toString("base64") })));
  for (const change of [
    { keyId: "0".repeat(64) },
    { candidateSha: "c".repeat(40) },
    { scopeId: randomUUID() },
    { sessionId: randomUUID() },
    { purpose: "ACCEPTANCE" },
    { raw: canary },
    { algorithms: { content: "AES-128-GCM", keyWrap: "RSA-OAEP-SHA256" } },
    { wrappedKey: Buffer.alloc(383).toString("base64") },
  ])
    variants.push(
      Buffer.from(
        JSON.stringify({ ...envelope, aad: Buffer.from(JSON.stringify({ ...header, ...change })).toString("base64") }),
      ),
    );
  for (const bytes of variants)
    assert.throws(() =>
      publication.validateBrowserFailurePublication({
        bytes,
        context: f.context,
        retention: { ...retention, ciphertextDigest: hash(bytes), ciphertextBytes: bytes.length },
      }),
    );
  assert.throws(() =>
    publication.validateBrowserFailurePublication({
      bytes: original,
      context: f.context,
      retention: { ...retention, ciphertextDigest: "0".repeat(64) },
    }),
  );
  assert.throws(() =>
    publication.validateBrowserFailurePublication({
      bytes: original,
      context: { ...f.context, startedAt: 0 },
      retention,
    }),
  );
  assert.equal(fs.readdirSync(f.published).length, 1, "pure validator creates no additional publication");
  assertRaw(f);
});
test("publication pending/output write failure never changes the original collector outcome", (t) => {
  const f = fixture(t);
  media(f);
  const original = fs.writeSync;
  fs.writeSync = function (fd, ...args) {
    let name = "";
    try {
      name = fs.readlinkSync(`/proc/self/fd/${fd}`);
    } catch {}
    if (name.includes("private-browser-failure-publication-pending"))
      throw Object.assign(Error(canary), { code: "ENOSPC" });
    return original.call(this, fd, ...args);
  };
  syncBuiltinESMExports();
  let result;
  try {
    result = finish(f);
  } finally {
    fs.writeSync = original;
    syncBuiltinESMExports();
  }
  assert.equal(result.retention, "COMPLETE");
  assert.equal(result.worker.exitCode, 1);
  assert.equal(result.publication.status, "NOT_PUBLISHED");
  assert.equal(JSON.stringify(result.publication).includes(canary), false);
  assertNoPublication(f);
});
