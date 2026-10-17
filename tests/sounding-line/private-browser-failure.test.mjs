// Real failing Playwright worker; synthetic inert attachments, no browser or product execution.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  constants as C,
  createDecipheriv,
  createHash,
  generateKeyPairSync,
  privateDecrypt,
  randomUUID,
} from "node:crypto";
import {
  copyFileSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const generated = generateKeyPairSync("rsa", {
  modulusLength: 3072,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const canary = "PRIVATE_FAILURE_ARTIFACT_CANARY";
const fixtureFailure = { id: "1".repeat(64), status: "failed" };
function manifest(f, records, overflow = false) {
  f.api.writeBrowserFailureManifest(f.context, records, overflow, [fixtureFailure]);
}
const binding = () => ({
  version: 1,
  runId: randomUUID(),
  scopeId: randomUUID(),
  baseSha: "a".repeat(40),
  candidateSha: "b".repeat(40),
  planDigest: "c".repeat(64),
});
async function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "private-browser-failure-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const helperSource = readFileSync(path.join(sourceRoot, "scripts/sounding-line/private-browser-failure.mjs"), "utf8");
  const literal = /const publicKey =\s*("(?:[^"\\]|\\.)*");/u.exec(helperSource);
  assert(literal);
  const originalKey = JSON.parse(literal[1]),
    originalId = hash(originalKey);
  assert.equal(originalId, "f82684218e386d09e9120d0c7b54722e5833e5c18a3d7a8a73d94b9afead48bc");
  const sealerImport = '"./replay-posttechnical-diagnostic.mjs"';
  const absoluteSealer = JSON.stringify(
    pathToFileURL(path.join(sourceRoot, "scripts/sounding-line/replay-posttechnical-diagnostic.mjs")).href,
  );
  const replacement = `const publicKey = ${JSON.stringify(generated.publicKey)};`;
  const transformed = helperSource
    .replace(literal[0], replacement)
    .replace(originalId, hash(generated.publicKey))
    .replace(sealerImport, absoluteSealer);
  assert.equal(
    transformed
      .replace(replacement, literal[0])
      .replace(hash(generated.publicKey), originalId)
      .replace(absoluteSealer, sealerImport),
    helperSource,
    "production logic unchanged after reversing generated-key/import substitutions",
  );
  writeFileSync(path.join(root, "private-browser-failure.mjs"), transformed);
  writeFileSync(
    path.join(root, "private-browser-failure-reporter.mjs"),
    readFileSync(path.join(sourceRoot, "scripts/sounding-line/private-browser-failure-reporter.mjs")),
  );
  const api = await import(pathToFileURL(path.join(root, "private-browser-failure.mjs")).href);
  const session = api.createBrowserFailureRetention({ root, binding: binding() });
  const context = JSON.parse(session.environment[api.PRIVATE_BROWSER_FAILURE_CONTEXT]);
  return { root, api, session, context };
}
function attachments(f) {
  const records = [];
  for (const [kind, extension] of Object.entries({
    screenshot: "png",
    video: "webm",
    trace: "zip",
    "error-context": "md",
  })) {
    const relative = `${kind}.${extension}`;
    writeFileSync(path.join(f.session.resultsDirectory, relative), `${canary}:${kind}`);
    records.push({ failureId: fixtureFailure.id, kind, path: relative, status: "failed" });
  }
  return records;
}
function uploadReceipt(f) {
  return {
    outcome: "success",
    artifactId: 123,
    artifactDigest: "d".repeat(64),
    ciphertextDigest: hash(readFileSync(path.join(f.session.directory, "failure.encrypted"))),
  };
}
function finish(f) {
  return f.session.complete({ exitCode: 1, signal: null, workerClosed: true });
}
function decrypt(f) {
  const envelope = JSON.parse(readFileSync(path.join(f.session.directory, "failure.encrypted")));
  const aad = Buffer.from(envelope.aad, "base64"),
    header = JSON.parse(aad);
  const key = privateDecrypt(
    {
      key: generated.privateKey,
      padding: C.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
      oaepLabel: Buffer.from("VW-POSTTECHNICAL-EVIDENCE-1"),
    },
    Buffer.from(header.wrappedKey, "base64"),
  );
  const cipher = createDecipheriv("aes-256-gcm", key, Buffer.from(header.nonce, "base64"));
  cipher.setAAD(aad);
  cipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const plaintext = JSON.parse(
    Buffer.concat([cipher.update(Buffer.from(envelope.ciphertext, "base64")), cipher.final()]),
  );
  for (const member of plaintext.files) {
    const bytes = Buffer.from(member.content, "base64");
    assert.equal(member.bytes, bytes.length);
    assert.equal(member.sha256, hash(bytes));
  }
  return { header, plaintext };
}

test("real failing Playwright worker preserves four actual attachment paths, original reporters, binding and missing diagnostics from a second failure", async (t) => {
  const f = await fixture(t);
  const require = createRequire(path.join(sourceRoot, "package.json"));
  const packageFile = process.env.SOUNDING_LINE_TEST_PLAYWRIGHT_PACKAGE
    ? path.join(process.env.SOUNDING_LINE_TEST_PLAYWRIGHT_PACKAGE, "package.json")
    : require.resolve("@playwright/test/package.json");
  const packageRoot = path.dirname(packageFile);
  assert.equal(JSON.parse(readFileSync(packageFile)).version, "1.56.1", "locked real Playwright worker");
  const packageEntry = path.join(packageRoot, "index.mjs");
  writeFileSync(
    path.join(f.root, "playwright.config.mjs"),
    `export default { testDir:'.', testMatch:'worker.spec.mjs', outputDir:${JSON.stringify(f.session.resultsDirectory)}, workers:1, retries:0, repeatEach:1, reporter:[['list']], timeout:10000 };`,
  );
  writeFileSync(
    path.join(f.root, "worker.spec.mjs"),
    `import {test, expect} from ${JSON.stringify(pathToFileURL(packageEntry).href)}; import {writeFileSync} from 'node:fs';
    test('actual unexpected worker failure', async ({}, info) => {
      for (const [name, contentType, extension] of [['screenshot','image/png','png'],['video','video/webm','webm'],['trace','application/zip','zip'],['error-context','text/markdown','md']]) { const file=info.outputPath(name+'.'+extension); writeFileSync(file,${JSON.stringify(canary)}+name); await info.attach(name,{path:file,contentType}); }
      await info.attach('unrelated-private-file',{body:Buffer.from('not an allowed diagnostic'),contentType:'text/plain'});
      expect(1).toBe(2);
    });
    test('unexpected worker failure without attachments', async () => { expect(1).toBe(3); });
    test('expected failure excluded', async ({}, info) => { test.fail(); await info.attach('error-context',{body:Buffer.from('expected failure excluded'),contentType:'text/markdown'}); expect(1).toBe(2); });`,
  );
  const result = spawnSync(
    process.execPath,
    [path.join(packageRoot, "cli.js"), "test", "--config", path.join(f.root, "playwright.config.mjs")],
    { cwd: f.root, env: { ...process.env, ...f.session.environment }, encoding: "utf8", timeout: 30000 },
  );
  if (process.env.SOUNDING_LINE_TEST_RECEIPTS_DIRECTORY) {
    const receipts = process.env.SOUNDING_LINE_TEST_RECEIPTS_DIRECTORY;
    mkdirSync(receipts, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(receipts, "actual-failing-playwright-worker.stdout.private.log"), result.stdout ?? "", {
      mode: 0o600,
    });
    writeFileSync(path.join(receipts, "actual-failing-playwright-worker.stderr.private.log"), result.stderr ?? "", {
      mode: 0o600,
    });
    writeFileSync(
      path.join(receipts, "actual-failing-playwright-worker.private.json"),
      JSON.stringify(
        {
          version: 1,
          classification: "INERT_RETENTION_INTEGRATION_NOT_PRODUCT_OR_BROWSER",
          playwrightVersion: JSON.parse(readFileSync(packageFile)).version,
          actualExitCode: result.status,
          signal: result.signal,
          stdoutSha256: hash(result.stdout ?? ""),
          stderrSha256: hash(result.stderr ?? ""),
          originalListReporter: true,
          additiveReporterVia: "PW_TEST_REPORTER",
          browserFixturesUsed: false,
          productExecution: false,
          sourceHelperSha256: hash(
            readFileSync(path.join(sourceRoot, "scripts/sounding-line/private-browser-failure.mjs")),
          ),
          sourceReporterSha256: hash(
            readFileSync(path.join(sourceRoot, "scripts/sounding-line/private-browser-failure-reporter.mjs")),
          ),
        },
        null,
        2,
      ) + "\n",
      { mode: 0o600 },
    );
  }
  assert.ifError(result.error);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /2 failed/u);
  assert.match(result.stdout, /actual unexpected worker failure/u, "original list reporter remains active");
  const receipt = finish(f);
  assert.equal(receipt.worker.exitCode, 1);
  assert.equal(receipt.retention, "INCOMPLETE", JSON.stringify(receipt));
  assert(receipt.issues.includes("FAILURE_ATTACHMENTS_INCOMPLETE"));
  assert.equal(receipt.qualification, false);
  assert.equal(JSON.stringify(receipt).includes(canary), false);
  assert.equal(readFileSync(path.join(f.session.directory, "failure.encrypted"), "utf8").includes(canary), false);
  const { header, plaintext } = decrypt(f);
  for (const [key, value] of Object.entries(f.context.binding)) assert.equal(header[key], value);
  assert.equal(plaintext.files.length, 5);
  assert.equal(
    receipt.rawBytes,
    plaintext.files.reduce((total, file) => total + file.bytes, 0),
  );
  assert.equal(plaintext.inventory.length, 4);
  const privateManifest = JSON.parse(Buffer.from(plaintext.files[0].content, "base64"));
  assert.equal(
    privateManifest.failures.length,
    2,
    "expected failure is excluded; empty unexpected failure remains visible",
  );
  assert.equal(new Set(privateManifest.failures.map((failure) => failure.id)).size, 2);
  assert.equal(
    JSON.stringify(privateManifest).includes("actual unexpected worker failure"),
    false,
    "case identity is opaque",
  );
  assert(
    plaintext.files.slice(1).every((member) => Buffer.from(member.content, "base64").toString().startsWith(canary)),
  );
  assert.equal(lstatSync(f.session.directory).mode & 0o777, 0o700);
  assert.equal(lstatSync(path.join(f.session.directory, "failure.encrypted")).mode & 0o777, 0o600);
  assert.deepEqual(
    f.api.acknowledgeBrowserFailureUpload({ directory: f.session.directory, trustedUpload: { outcome: "failure" } }),
    {
      upload: "FAILED_OR_UNCONFIRMED",
      cleanup: "RAW_RETAINED_PRIVATE",
    },
  );
  assert(existsSync(f.session.resultsDirectory));
  assert.deepEqual(f.api.acknowledgeBrowserFailureUpload({ directory: f.session.directory, trustedUpload: true }), {
    upload: "FAILED_OR_UNCONFIRMED",
    cleanup: "RAW_RETAINED_PRIVATE",
  });
  assert.deepEqual(
    f.api.acknowledgeBrowserFailureUpload({ directory: f.session.directory, trustedUpload: uploadReceipt(f) }),
    {
      upload: "SUCCEEDED",
      cleanup: "RAW_RETAINED_PRIVATE_INCOMPLETE",
    },
  );
  assert(existsSync(f.session.resultsDirectory));
  assert(existsSync(path.join(f.session.directory, "failure.encrypted")));
});

for (const scenario of ["missing", "symlink", "ancestor-symlink", "stale", "hardlink", "oversize", "escape", "fifo"]) {
  test(`failed-worker retention rejects ${scenario} without replacing its failure or losing other artifacts`, async (t) => {
    const f = await fixture(t),
      records = attachments(f),
      target = path.join(f.session.resultsDirectory, records[0].path);
    if (scenario === "missing") rmSync(target);
    if (scenario === "symlink") {
      rmSync(target);
      symlinkSync(path.join(f.session.resultsDirectory, records[1].path), target);
    }
    if (scenario === "ancestor-symlink") {
      symlinkSync(f.session.resultsDirectory, path.join(f.session.resultsDirectory, "aliased"));
      records[0].path = `aliased/${records[0].path}`;
    }
    if (scenario === "stale") utimesSync(target, new Date(0), new Date(0));
    if (scenario === "hardlink") linkSync(target, path.join(f.root, "hardlink.png"));
    if (scenario === "oversize") writeFileSync(target, Buffer.alloc(f.api.BROWSER_FAILURE_LIMITS.fileBytes + 1));
    if (scenario === "escape") records[0].path = "../../outside.png";
    if (scenario === "fifo") {
      rmSync(target);
      const fifo = spawnSync("mkfifo", [target], { timeout: 2000 });
      assert.equal(fifo.status, 0);
    }
    manifest(f, records);
    const receipt = finish(f);
    assert.equal(receipt.worker.exitCode, 1);
    assert.equal(receipt.retention, "INCOMPLETE");
    assert(receipt.issues.length);
    assert.equal(decrypt(f).plaintext.inventory.length, 3);
    assert(existsSync(f.session.resultsDirectory));
    assert.equal(JSON.stringify(receipt).includes(canary), false);
  });
}

test("encryption/write failure preserves private raw evidence and original failing exit", async (t) => {
  const f = await fixture(t);
  manifest(f, attachments(f));
  mkdirSync(path.join(f.session.directory, "failure.encrypted"));
  const receipt = finish(f);
  assert.equal(receipt.retention, "ENCRYPTION_FAILED");
  assert.equal(receipt.worker.exitCode, 1);
  assert(existsSync(f.session.resultsDirectory));
  assert.equal(JSON.stringify(receipt).includes(canary), false);
});

test("unclosed, crashed, mismatched and overflow workers never become complete", async (t) => {
  const f = await fixture(t);
  assert.deepEqual(f.session.complete({ exitCode: null, signal: "SIGTERM", workerClosed: false }).issues, [
    "WORKER_CLOSURE_UNPROVEN",
  ]);
  assert.equal(f.session.complete({ exitCode: null, signal: "SIGTERM", workerClosed: true }).retention, "INCOMPLETE");
  const second = f.api.createBrowserFailureRetention({ root: f.root, binding: f.context.binding });
  const secondContext = JSON.parse(second.environment[f.api.PRIVATE_BROWSER_FAILURE_CONTEXT]);
  assert.notEqual(secondContext.sessionId, f.context.sessionId);
  f.api.writeBrowserFailureManifest(secondContext, [], true);
  const receipt = second.complete({ exitCode: 1, signal: null, workerClosed: true });
  assert.equal(receipt.retention, "INCOMPLETE");
  assert(receipt.issues.includes("LIMIT"));
  assert(receipt.issues.includes("NO_FAILURE_ATTACHMENTS"));
  assert.throws(() =>
    f.api.loadBrowserFailureContext({
      [f.api.PRIVATE_BROWSER_FAILURE_CONTEXT]: JSON.stringify({
        ...f.context,
        binding: secondContext.binding,
        sessionId: secondContext.sessionId,
      }),
    }),
  );
});

test("upload acknowledgment rejects altered ciphertext and unsafe cleanup before deleting raw", async (t) => {
  const f = await fixture(t);
  manifest(f, attachments(f));
  assert.equal(finish(f).retention, "COMPLETE");
  const encrypted = path.join(f.session.directory, "failure.encrypted"),
    original = readFileSync(encrypted);
  const acknowledged = uploadReceipt(f);
  writeFileSync(encrypted, "tampered");
  assert.throws(() =>
    f.api.acknowledgeBrowserFailureUpload({ directory: f.session.directory, trustedUpload: acknowledged }),
  );
  assert(existsSync(f.session.resultsDirectory));
  writeFileSync(encrypted, original);
  symlinkSync(f.root, path.join(f.session.resultsDirectory, "unsafe"));
  assert.throws(() =>
    f.api.acknowledgeBrowserFailureUpload({ directory: f.session.directory, trustedUpload: uploadReceipt(f) }),
  );
  for (const name of ["screenshot.png", "video.webm", "trace.zip", "error-context.md"])
    assert(existsSync(path.join(f.session.resultsDirectory, name)));
});

test("incomplete diagnostics retain every original even after trusted successful upload", async (t) => {
  const f = await fixture(t),
    records = attachments(f);
  rmSync(path.join(f.session.resultsDirectory, records[0].path));
  manifest(f, records);
  assert.equal(finish(f).retention, "INCOMPLETE");
  assert.deepEqual(
    f.api.acknowledgeBrowserFailureUpload({ directory: f.session.directory, trustedUpload: uploadReceipt(f) }),
    { upload: "SUCCEEDED", cleanup: "RAW_RETAINED_PRIVATE_INCOMPLETE" },
  );
  assert(existsSync(path.join(f.session.resultsDirectory, "video.webm")));
});
test("receipt persistence failure cannot report COMPLETE and preserves raw", async (t) => {
  const f = await fixture(t);
  manifest(f, attachments(f));
  mkdirSync(path.join(f.session.directory, "retention.json"));
  const receipt = finish(f);
  assert.equal(receipt.retention, "INCOMPLETE");
  assert(receipt.issues.includes("PERSISTENCE_FAILED"));
  assert(existsSync(f.session.resultsDirectory));
});
test("cleanup requires exact canonical session, complete coverage, unchanged bytes and trusted upload metadata", async (t) => {
  const f = await fixture(t);
  manifest(f, attachments(f));
  assert.equal(finish(f).retention, "COMPLETE");
  const copied = path.join(f.root, "copied");
  mkdirSync(copied);
  writeFileSync(path.join(copied, "context.private.json"), JSON.stringify(f.context));
  assert.throws(() => f.api.acknowledgeBrowserFailureUpload({ directory: copied, trustedUpload: uploadReceipt(f) }));
  const extra = path.join(f.session.resultsDirectory, "unmanifested.txt");
  writeFileSync(extra, "must remain private");
  assert.deepEqual(
    f.api.acknowledgeBrowserFailureUpload({ directory: f.session.directory, trustedUpload: uploadReceipt(f) }),
    { upload: "SUCCEEDED", cleanup: "RAW_RETAINED_PRIVATE_UNCAPTURED_FILES" },
  );
  rmSync(extra);
  const screenshot = path.join(f.session.resultsDirectory, "screenshot.png"),
    original = readFileSync(screenshot);
  writeFileSync(screenshot, "changed after upload");
  assert.throws(() =>
    f.api.acknowledgeBrowserFailureUpload({ directory: f.session.directory, trustedUpload: uploadReceipt(f) }),
  );
  assert(existsSync(path.join(f.session.resultsDirectory, "video.webm")));
  writeFileSync(screenshot, original);
  assert.deepEqual(
    f.api.acknowledgeBrowserFailureUpload({ directory: f.session.directory, trustedUpload: uploadReceipt(f) }),
    { upload: "SUCCEEDED", cleanup: "RAW_REMOVED_AFTER_UPLOAD" },
  );
  assert.equal(existsSync(f.session.resultsDirectory), false);
});

const observedTraceBytes = 34_005_398;
function observedBrowserAttachments(f) {
  const actualDirectory = process.env.SOUNDING_LINE_TEST_ORIGINAL_BROWSER_FAILURE_DIRECTORY;
  const files = [
    { kind: "screenshot", name: "test-failed-1.png" },
    { kind: "video", name: "video.webm" },
    { kind: "trace", name: "trace.zip" },
    { kind: "error-context", name: "error-context.md" },
  ];
  const records = [];
  for (const file of files) {
    const destination = path.join(f.session.resultsDirectory, file.name);
    if (actualDirectory) copyFileSync(path.join(actualDirectory, file.name), destination);
    else
      writeFileSync(
        destination,
        file.kind === "trace" ? Buffer.alloc(observedTraceBytes) : `INERT_OBSERVED_SIZE_BOUNDARY_${file.kind}`,
      );
    const bytes = readFileSync(destination);
    records.push({
      failureId: fixtureFailure.id,
      status: "failed",
      kind: file.kind,
      path: file.name,
      bytes: bytes.length,
      sha256: hash(bytes),
    });
  }
  assert.equal(
    records.find((record) => record.kind === "trace").bytes,
    observedTraceBytes,
    "exact observed browser-generated trace size",
  );
  return {
    origin: actualDirectory ? "ACTUAL_F_FOCUSED_BROWSER_FAILURE_FILES" : "INERT_EXACT_OBSERVED_TRACE_SIZE_BOUNDARY",
    records,
  };
}
function observedManifest(f, records) {
  manifest(
    f,
    records.map(({ failureId, status, kind, path }) => ({ failureId, status, kind, path })),
  );
}
test("observed 34005398-byte browser trace crosses old 32 MiB limit and retains exact four-file hashes at 64 MiB", async (t) => {
  const f = await fixture(t),
    observed = observedBrowserAttachments(f);
  assert.equal(f.api.BROWSER_FAILURE_LIMITS.fileBytes, 64 * 1024 * 1024);
  assert.equal(f.api.BROWSER_FAILURE_LIMITS.rawBytes, 64 * 1024 * 1024, "aggregate cap is unchanged");
  assert(observed.records.reduce((total, record) => total + record.bytes, 0) < f.api.BROWSER_FAILURE_LIMITS.rawBytes);
  observedManifest(f, observed.records);
  const receipt = finish(f);
  assert.equal(receipt.retention, "COMPLETE");
  assert.equal(receipt.worker.exitCode, 1);
  const { plaintext } = decrypt(f);
  assert.equal(plaintext.inventory.length, 4);
  assert.equal(plaintext.files.length, 5);
  for (const record of observed.records) {
    const member = plaintext.files.find((file) => file.name === `private/results/${record.path}`);
    assert(member);
    assert.equal(member.bytes, record.bytes);
    assert.equal(member.sha256, record.sha256);
  }
  const current = readFileSync(path.join(f.root, "private-browser-failure.mjs"), "utf8");
  const old = current.replace("fileBytes: 64 * 1024 * 1024,", "fileBytes: 32 * 1024 * 1024,");
  assert.notEqual(old, current);
  assert.equal(
    old.replace("fileBytes: 32 * 1024 * 1024,", "fileBytes: 64 * 1024 * 1024,"),
    current,
    "old-limit control changes exactly the one bound",
  );
  const oldModule = path.join(f.root, "old-file-limit-control.mjs");
  writeFileSync(oldModule, old);
  const oldApi = await import(pathToFileURL(oldModule).href),
    oldSession = oldApi.createBrowserFailureRetention({ root: f.root, binding: f.context.binding });
  const oldContext = JSON.parse(oldSession.environment[oldApi.PRIVATE_BROWSER_FAILURE_CONTEXT]);
  for (const record of observed.records)
    copyFileSync(
      path.join(f.session.resultsDirectory, record.path),
      path.join(oldSession.resultsDirectory, record.path),
    );
  oldApi.writeBrowserFailureManifest(
    oldContext,
    observed.records.map(({ failureId, status, kind, path }) => ({ failureId, status, kind, path })),
    false,
    [fixtureFailure],
  );
  const oldReceipt = oldSession.complete({ exitCode: 1, signal: null, workerClosed: true });
  assert.equal(oldReceipt.retention, "INCOMPLETE");
  assert(oldReceipt.issues.includes("LIMIT"));
  assert(oldReceipt.issues.includes("MISSING_TRACE"));
  const oldInventory = JSON.parse(readFileSync(path.join(oldSession.directory, "cleanup.private.json"))).files;
  assert.equal(oldInventory.length, 3);
  assert.equal(
    oldInventory.some((record) => record.path === "trace.zip"),
    false,
  );
  if (process.env.SOUNDING_LINE_TEST_RECEIPTS_DIRECTORY) {
    const destination = path.join(
      process.env.SOUNDING_LINE_TEST_RECEIPTS_DIRECTORY,
      "observed-file-limit-boundary.actual.private.json",
    );
    writeFileSync(
      destination,
      JSON.stringify(
        {
          version: 1,
          origin: observed.origin,
          sourceHelperSha256: hash(
            readFileSync(path.join(sourceRoot, "scripts/sounding-line/private-browser-failure.mjs")),
          ),
          files: observed.records,
          oldLimit: 32 * 1024 * 1024,
          newLimit: f.api.BROWSER_FAILURE_LIMITS.fileBytes,
          aggregateLimit: f.api.BROWSER_FAILURE_LIMITS.rawBytes,
          oldReceipt,
          newReceipt: receipt,
          generatedTransportKeyOnly: true,
          actualOwnerKeyRead: false,
          authenticatedGeneratedKeyRoundtripAllFourFiles: true,
          productAcceptance: false,
        },
        null,
        2,
      ) + "\n",
      { mode: 0o600 },
    );
  }
});
test("observed-size trace pairs remain bounded by the unchanged 64 MiB aggregate cap", async (t) => {
  const f = await fixture(t),
    observed = observedBrowserAttachments(f),
    trace = observed.records.find((record) => record.kind === "trace");
  copyFileSync(
    path.join(f.session.resultsDirectory, trace.path),
    path.join(f.session.resultsDirectory, "second-trace.zip"),
  );
  observedManifest(f, [...observed.records, { ...trace, path: "second-trace.zip" }]);
  const receipt = finish(f);
  assert.equal(receipt.worker.exitCode, 1);
  assert.equal(receipt.retention, "INCOMPLETE");
  assert(receipt.issues.includes("LIMIT"));
  const inventory = JSON.parse(readFileSync(path.join(f.session.directory, "cleanup.private.json"))).files;
  assert.equal(inventory.length, 4);
  assert.equal(
    inventory.some((record) => record.path === "second-trace.zip"),
    false,
  );
  assert(
    existsSync(path.join(f.session.resultsDirectory, "second-trace.zip")),
    "rejected original is preserved privately",
  );
});
