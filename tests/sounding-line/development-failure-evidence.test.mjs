// Synthetic bytes and disposable files only; no application, browser or owner key.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import {
  appendFile,
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  truncate,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createDevelopmentPrivateLauncher } from "../../scripts/sounding-line/develop-browser-suite.mjs";
import { bounded, processExit, stopOwnedProcess } from "../../scripts/sounding-line/owned-process.mjs";
import {
  createDevelopmentFailureEvidence,
  developmentFailureEvidenceFiles,
  DEVELOPMENT_FAILURE_REPORT_LIMIT,
  readDevelopmentFailureReport,
} from "../../scripts/sounding-line/development-failure-evidence.mjs";
const canary = "PRIVATE_SYNTHETIC_DEVELOPMENT_DIAGNOSTIC";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function input() {
  return {
    binding: {
      version: 1,
      runId: randomUUID(),
      scopeId: randomUUID(),
      baseSha: "a".repeat(40),
      candidateSha: "b".repeat(40),
      planDigest: "c".repeat(64),
    },
    selector: "tests/e2e/synthetic.spec.ts:1",
    provider: { repository: "Kgray44/treasurehuntSoT", runId: "123", attempt: 1, workflowSha: "d".repeat(40) },
    report: { status: "COMPLETE", bytes: Buffer.from(JSON.stringify({ errors: [canary] }) + "\n") },
    streams: ["server.stdout", "server.stderr", "browser.stdout", "browser.stderr"].map((label) => {
      const bytes = Buffer.from(`${canary}:${label}\n`);
      return { label, bytes, originalBytes: bytes.length, originalStreamSHA256: hash(bytes), complete: true };
    }),
    producersClosed: true,
  };
}
const invalid = /DEVELOPMENT_FAILURE_EVIDENCE_INVALID/u;

test("only a live source-bound token exposes exact private report/stream bytes and immutable capture metadata", () => {
  const value = input(),
    expectedReport = Buffer.from(value.report.bytes),
    expectedStream = Buffer.from(value.streams[0].bytes);
  const token = createDevelopmentFailureEvidence(value);
  assert.equal(JSON.stringify(token).includes(canary), false);
  value.report.bytes.fill(0);
  value.streams[0].bytes.fill(0);
  const captured = developmentFailureEvidenceFiles(token, value.binding);
  assert.deepEqual(captured.issues, []);
  assert.equal(captured.files.length, 6);
  const context = JSON.parse(captured.files[0].bytes);
  assert.deepEqual(context.binding, value.binding);
  assert.deepEqual(context.provider, value.provider);
  assert.equal(context.selector, value.selector);
  assert.equal(context.qualification, false);
  assert(
    captured.files.find((file) => file.name.endsWith("playwright-report.original.json")).bytes.equals(expectedReport),
  );
  assert(captured.files.find((file) => file.name.endsWith("server.stdout.retained.bin")).bytes.equals(expectedStream));
  captured.files[1].bytes.fill(0);
  assert(developmentFailureEvidenceFiles(token, value.binding).files[1].bytes.equals(expectedReport));
  assert.throws(() => developmentFailureEvidenceFiles(JSON.parse(JSON.stringify(token)), value.binding), invalid);
  assert.throws(
    () => developmentFailureEvidenceFiles(token, { ...value.binding, candidateSha: "e".repeat(40) }),
    invalid,
  );
});

test("missing reports and incomplete streams retain their explicit limits without claiming complete originals", () => {
  const value = input();
  value.report = { status: "MISSING" };
  value.streams[0].complete = false;
  value.streams[0].bytes = value.streams[0].bytes.subarray(0, 5);
  const captured = developmentFailureEvidenceFiles(createDevelopmentFailureEvidence(value), value.binding);
  assert.deepEqual(captured.issues, ["DEVELOPMENT_REPORT_UNAVAILABLE", "DEVELOPMENT_STREAM_INCOMPLETE"]);
  assert.equal(captured.files.length, 5);
  const context = JSON.parse(captured.files[0].bytes);
  assert.equal(context.report.status, "MISSING");
  assert.equal(context.streams[0].complete, false);
  assert.equal(context.streams[0].retainedBytes, 5);
  assert(context.streams[0].originalBytes > context.streams[0].retainedBytes);
});

test("capture rejects unclosed producers, mismatched lengths/hashes, reordered streams and extra metadata", () => {
  for (const mutate of [
    (value) => {
      value.producersClosed = false;
    },
    (value) => {
      value.selector = "../private.spec.ts";
    },
    (value) => {
      value.provider.attempt = 0;
    },
    (value) => {
      value.provider.runId = "1".repeat(21);
    },
    (value) => {
      value.selector = "tests/e2e/" + "x".repeat(1024) + ".spec.ts";
    },
    (value) => {
      value.provider.extra = canary;
    },
    (value) => {
      value.binding.extra = canary;
    },
    (value) => {
      value.report.extra = canary;
    },
    (value) => {
      value.streams[0].extra = canary;
    },
    (value) => {
      value.streams[0].originalBytes++;
    },
    (value) => {
      value.streams[0].originalStreamSHA256 = "0".repeat(64);
    },
    (value) => {
      value.streams.reverse();
    },
    (value) => {
      value.streams[0].bytes = { type: "Buffer", data: [1] };
    },
  ]) {
    const value = input();
    mutate(value);
    assert.throws(() => createDevelopmentFailureEvidence(value), invalid);
  }
});

test("report and retained-stream limits remain finite and oversized input cannot mint a token", () => {
  const report = input();
  report.report.bytes = Buffer.alloc(DEVELOPMENT_FAILURE_REPORT_LIMIT + 1);
  assert.throws(() => createDevelopmentFailureEvidence(report), invalid);
  const stream = input();
  stream.streams[0].bytes = Buffer.alloc(16 * 1024 * 1024 + 1);
  assert.throws(() => createDevelopmentFailureEvidence(stream), invalid);
});

async function reportFixture(t) {
  const parent = await realpath(tmpdir()),
    root = await realpath(await mkdtemp(path.join(parent, "development-private-report-")));
  assert.equal(path.dirname(root), parent);
  t.after(async () => {
    assert.equal(path.dirname(await realpath(root)), parent);
    await rm(root, { recursive: true, force: true });
  });
  const directory = path.join(root, "private");
  await mkdir(directory, { mode: 0o700 });
  const startedAt = Math.floor((await lstat(directory)).ctimeMs),
    file = path.join(directory, "playwright-report.original.json");
  return { root, directory, startedAt, file };
}

test(
  "exact private development launcher drains large owned producer streams without public output",
  { timeout: 35000 },
  async (t) => {
    const children = [];
    t.after(async () => {
      await Promise.all(children.map((child) => stopOwnedProcess(child)));
    });
    const f = await reportFixture(t),
      secret = "GENERATED_SYNTHETIC_STREAM_CREDENTIAL";
    const producer = path.join(f.root, "inert-producer.mjs");
    await writeFile(
      producer,
      `const role = process.argv[2];
    for (const [kind, fill] of [['stdout', role === 'server' ? 65 : 67], ['stderr', role === 'server' ? 66 : 68]]) {
      process[kind].write(Buffer.concat([Buffer.from(${JSON.stringify(secret)} + ':' + role + ':' + kind + '\\n'), Buffer.alloc(2 * 1024 * 1024, fill)]));
    }`,
    );
    const launcher = createDevelopmentPrivateLauncher(f.directory, secret);
    let publicBytes = 0,
      exits,
      failure;
    const suppressAndObserve = (chunk, encoding, callback) => {
      publicBytes += Buffer.byteLength(chunk);
      const done = typeof encoding === "function" ? encoding : callback;
      if (done) queueMicrotask(done);
      return true;
    };
    const stdout = t.mock.method(process.stdout, "write", suppressAndObserve);
    const stderr = t.mock.method(process.stderr, "write", suppressAndObserve);
    let cleanup;
    try {
      for (const role of ["server", "browser"]) {
        const env = { ...process.env };
        for (const key of Object.keys(env)) if (/^(?:GH_TOKEN|GITHUB_TOKEN|SOUNDING_LINE_)/u.test(key)) delete env[key];
        children.push(launcher.launch(process.execPath, [producer, role], { root: f.root, env }));
      }
      exits = await bounded(() => Promise.all(children.map(processExit)), 15000, "PRIVATE_PRODUCER_EXIT_DEADLINE");
    } catch (error) {
      failure = error;
    } finally {
      try {
        cleanup = await Promise.all(children.map((child) => stopOwnedProcess(child)));
      } finally {
        stdout.mock.restore();
        stderr.mock.restore();
      }
    }
    assert.equal(cleanup.length, 2);
    for (const result of cleanup) {
      assert.equal(result.status, "PASS");
      assert.equal(result.treeReaped, true);
      assert.equal(result.streamsClosed, true);
    }
    assert.equal(publicBytes, 0, "private adapter sends no producer bytes to public output");
    if (failure) throw failure;
    assert(exits.every((exit) => exit.code === 0 && !exit.supervisionFailure));
    assert(children.every((child) => child.stdout.closed && child.stderr.closed));
    const streams = launcher.snapshot();
    assert.equal(streams.length, 4);
    for (const [index, stream] of streams.entries()) {
      const [role, kind] = stream.label.split(".");
      const expected = Buffer.concat([
        Buffer.from(`${secret}:${role}:${kind}\n`),
        Buffer.alloc(2 * 1024 * 1024, 65 + index),
      ]);
      assert.equal(stream.bytes.length, expected.length);
      assert.equal(hash(stream.bytes), hash(expected));
      assert.equal(stream.originalBytes, expected.length);
      assert.equal(stream.originalStreamSHA256, hash(expected));
      assert.equal(stream.complete, true);
    }
    const logs = await launcher.close();
    for (const producerLog of logs)
      for (const stream of Object.values(producerLog.streams)) {
        const bytes = await readFile(stream.file);
        assert.equal(bytes.includes(secret), false);
        assert(bytes.includes("[REDACTED_GENERATED_RUNTIME_CREDENTIAL]"));
      }
  },
);
test(
  "POSIX private report reader retains exact fresh bytes and distinguishes a missing report",
  { skip: process.platform === "win32" },
  async (t) => {
    const f = await reportFixture(t);
    assert.deepEqual(await readDevelopmentFailureReport(f.directory, f.startedAt), { status: "MISSING" });
    const bytes = Buffer.from(JSON.stringify({ error: canary }) + "\n");
    await writeFile(f.file, bytes, { mode: 0o600 });
    const captured = await readDevelopmentFailureReport(f.directory, f.startedAt);
    assert.equal(captured.status, "COMPLETE");
    assert(captured.bytes.equals(bytes));
  },
);
for (const mutation of ["grow", "truncate", "replace"]) {
  test(
    `POSIX private report reader bounds I/O and rejects ${mutation} during reading`,
    { skip: process.platform === "win32" },
    async (t) => {
      const f = await reportFixture(t),
        bytes = Buffer.from(JSON.stringify({ error: canary }) + "\n");
      await writeFile(f.file, bytes, { mode: 0o600 });
      const probe = await open(f.file, "r"),
        prototype = Object.getPrototypeOf(probe),
        originalRead = prototype.read;
      await probe.close();
      let injected = false,
        bytesRead = 0;
      const requests = [];
      t.mock.method(prototype, "read", async function (...args) {
        requests.push({ bufferBytes: args[0].length, requestedBytes: args[2] });
        if (!injected) {
          if (mutation === "grow") await appendFile(f.file, Buffer.alloc(DEVELOPMENT_FAILURE_REPORT_LIMIT + 1));
          else if (mutation === "truncate") await truncate(f.file, 0);
          else {
            await rename(f.file, path.join(f.directory, "moved-original.json"));
            await writeFile(f.file, bytes, { mode: 0o600 });
          }
          injected = true;
        }
        const result = await Reflect.apply(originalRead, this, args);
        bytesRead += result.bytesRead;
        return result;
      });
      assert.deepEqual(await readDevelopmentFailureReport(f.directory, f.startedAt), { status: "UNREADABLE" });
      assert.equal(injected, true, "mutation occurs after initial handle validation and before a real read");
      assert(requests.length > 0);
      assert(
        requests.every(
          (request) =>
            request.bufferBytes <= DEVELOPMENT_FAILURE_REPORT_LIMIT &&
            request.requestedBytes <= DEVELOPMENT_FAILURE_REPORT_LIMIT,
        ),
      );
      assert(
        bytesRead <= bytes.length + 1,
        "growth cannot increase the bounded read beyond the initial size and one-byte probe",
      );
    },
  );
}
for (const kind of ["symlink", "hardlink", "stale", "oversize", "public-mode", "directory"]) {
  test(
    `POSIX private report reader rejects ${kind} input without publishing raw bytes`,
    { skip: process.platform === "win32" },
    async (t) => {
      const f = await reportFixture(t);
      const outside = path.join(f.root, "synthetic-outside.json");
      await writeFile(outside, canary, { mode: 0o600 });
      if (kind === "symlink") await symlink(outside, f.file);
      else if (kind === "hardlink") await link(outside, f.file);
      else if (kind === "directory") await mkdir(f.file, { mode: 0o700 });
      else {
        await writeFile(f.file, kind === "oversize" ? Buffer.alloc(DEVELOPMENT_FAILURE_REPORT_LIMIT + 1) : canary, {
          mode: 0o600,
        });
        if (kind === "stale") await utimes(f.file, new Date(1000), new Date(1000));
        if (kind === "public-mode") await chmod(f.file, 0o644);
      }
      assert.deepEqual(await readDevelopmentFailureReport(f.directory, f.startedAt), { status: "UNREADABLE" });
      assert.equal((await readFile(outside)).toString(), canary);
    },
  );
}
