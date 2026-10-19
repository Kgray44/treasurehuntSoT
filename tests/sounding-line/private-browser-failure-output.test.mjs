// Tiny inert publication/output faults only, with public-key encryption.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createBrowserFailurePublicationOutput,
  BROWSER_FAILURE_OUTPUT_KEYS as keys,
} from "../../scripts/sounding-line/private-browser-failure-output.mjs";
import { createPublishableBrowserFailureRetention } from "../../scripts/sounding-line/private-browser-failure-publication.mjs";
import {
  PRIVATE_BROWSER_FAILURE_CONTEXT,
  writeBrowserFailureManifest,
} from "../../scripts/sounding-line/private-browser-failure.mjs";
const canary = "PRIVATE_RAW_OUTPUT_CANARY";
function outputs(file) {
  const lines = fs.readFileSync(file, "utf8").split("\n"),
    result = {};
  for (let i = 0; i < lines.length; i++) {
    const multi = /^([a-z_]+)<<([A-Za-z0-9_]+)$/u.exec(lines[i]);
    if (multi) {
      const values = [];
      while (++i < lines.length && lines[i] !== multi[2]) values.push(lines[i]);
      assert(i < lines.length, "complete GitHub multiline output");
      result[multi[1]] = values.join("\n");
    } else {
      const single = /^([a-z_]+)=(.*)$/u.exec(lines[i]);
      if (single) result[single[1]] = single[2];
    }
  }
  return result;
}
function fixture(t, previous = "") {
  const root = fs.mkdtempSync(path.join(tmpdir(), "private-failure-output-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const candidate = path.join(root, "candidate"),
    authority = path.join(root, "authority"),
    file = path.join(root, "github-output");
  fs.mkdirSync(candidate, { mode: 0o700 });
  fs.mkdirSync(authority, { mode: 0o700 });
  fs.writeFileSync(file, previous, { mode: 0o600 });
  const nonce = randomUUID(),
    sink = createBrowserFailurePublicationOutput({ outputFile: file, nonce });
  return { root, candidate, authority, file, sink, nonce };
}
function collect(f, capture = f.sink.capture) {
  const session = createPublishableBrowserFailureRetention({
    root: f.candidate,
    authorityRoot: f.authority,
    onPublication: capture,
    binding: {
      version: 1,
      runId: randomUUID(),
      scopeId: randomUUID(),
      baseSha: "a".repeat(40),
      candidateSha: "b".repeat(40),
      planDigest: "c".repeat(64),
    },
  });
  const context = JSON.parse(session.environment[PRIVATE_BROWSER_FAILURE_CONTEXT]),
    records = [],
    failureId = "1".repeat(64);
  for (const [kind, ext] of Object.entries({ screenshot: "png", video: "webm", trace: "zip", "error-context": "md" })) {
    const file = `${kind}.${ext}`;
    fs.writeFileSync(path.join(session.resultsDirectory, file), canary);
    records.push({ failureId, status: "failed", kind, path: file });
  }
  writeBrowserFailureManifest(context, records, false, [{ id: failureId, status: "failed" }]);
  const result = session.complete({ exitCode: 1, signal: null, workerClosed: true });
  assert.equal(result.worker.exitCode, 1);
  assert.equal(result.retention, "COMPLETE");
  assert.equal(fs.readFileSync(path.join(session.resultsDirectory, "screenshot.png"), "utf8"), canary);
  return result;
}
test("output starts disabled and enables only one exact genuine current-runtime memory batch", (t) => {
  const f = fixture(t);
  assert.equal(outputs(f.file)[keys.publish], "false");
  const result = collect(f);
  assert.equal(result.publication.output.status, "CAPTURED_NOT_UPLOADED");
  assert.equal(outputs(f.file)[keys.publish], "false");
  assert.equal(f.sink.finish({ failed: true }).status, "ENABLED_EXACT_MEMORY_PATHS");
  const actual = outputs(f.file);
  assert.equal(actual[keys.publish], f.nonce);
  assert.deepEqual(actual[keys.paths].split("\n"), result.publication.uploadPaths);
  assert.equal(fs.readFileSync(f.file, "utf8").includes(canary), false);
  assert.equal(actual[keys.paths].includes("*"), false);
});
test("JSON clones and arbitrary shaped path records cannot enable upload", (t) => {
  for (const clone of [false, true]) {
    const f = fixture(t),
      actual = collect(f, undefined);
    // Use a genuine result only as source of a clone; never the branded object.
    const forged = clone
      ? JSON.parse(JSON.stringify(actual.publication))
      : { status: "STAGED", uploadPaths: ["/raw/failure.encrypted", "/raw/retention.json"] };
    assert.throws(() => f.sink.capture(forged));
    assert.equal(f.sink.finish({ failed: true }).status, "DISABLED");
    assert.equal(outputs(f.file)[keys.publish], "false");
    assert.equal(outputs(f.file)[keys.paths], "");
  }
});
test("a genuine publication from before the sink lifetime cannot be replayed", (t) => {
  const f = fixture(t),
    prior = collect(f);
  const later = createBrowserFailurePublicationOutput({ outputFile: f.file, nonce: f.nonce });
  assert.throws(() => later.capture(prior.publication));
  later.finish({ failed: true });
  assert.equal(outputs(f.file)[keys.publish], "false");
});
test("preexisting publish=true and unterminated multiline leave final selection disabled and empty", (t) => {
  const f = fixture(t, `${keys.paths}=/private/${canary}\n${keys.publish}=true\nunrelated<<OPEN\n`);
  assert.equal(outputs(f.file)[keys.publish], "false");
  const result = collect(f);
  assert.equal(result.publication.output.status, "CAPTURE_FAILED");
  assert.equal(f.sink.finish({ failed: true }).status, "DISABLED");
  assert.equal(outputs(f.file)[keys.publish], "false");
  assert.equal(outputs(f.file)[keys.paths], "");
  assert.equal(result.worker.exitCode, 1);
});
test("duplicate publication and duplicate finish disable final selection instead of overwriting it", (t) => {
  const f = fixture(t),
    result = collect(f);
  assert.equal(f.sink.finish({ failed: true }).status, "ENABLED_EXACT_MEMORY_PATHS");
  assert.throws(() => f.sink.capture(result.publication));
  assert.equal(outputs(f.file)[keys.publish], "false");
  assert.equal(f.sink.finish({ failed: true }).status, "DISABLED");
  assert.equal(outputs(f.file)[keys.paths], "");
});
test("success and empty scopes emit no upload paths and cannot overwrite a failed batch with success", (t) => {
  const f = fixture(t);
  assert.equal(f.sink.finish({ failed: false }).status, "DISABLED");
  assert.equal(outputs(f.file)[keys.publish], "false");
  assert.equal(outputs(f.file)[keys.paths], "");
  const next = createBrowserFailurePublicationOutput({ outputFile: f.file, nonce: f.nonce });
  assert.equal(next.finish({ failed: true }).status, "DISABLED");
  assert.equal(fs.readFileSync(f.file, "utf8").includes("<<"), false);
});
test("current fixture and browser collectors batch their four exact files once", (t) => {
  const f = fixture(t),
    fixtureResult = collect(f),
    browser = collect(f);
  assert.equal(f.sink.finish({ failed: true }).files, 4);
  assert.deepEqual(outputs(f.file)[keys.paths].split("\n"), [
    ...fixtureResult.publication.uploadPaths,
    ...browser.publication.uploadPaths,
  ]);
});
test("output batch write fault preserves worker failure and leaves final publish=false", (t) => {
  const f = fixture(t),
    result = collect(f),
    original = fs.writeSync;
  let injected = false;
  fs.writeSync = function (fd, bytes, ...args) {
    if (!injected && Buffer.isBuffer(bytes) && bytes.toString().startsWith(`${keys.paths}<<`)) {
      injected = true;
      throw Object.assign(Error(canary), { code: "ENOSPC" });
    }
    return original.call(this, fd, bytes, ...args);
  };
  syncBuiltinESMExports();
  let finished;
  try {
    finished = f.sink.finish({ failed: true });
  } finally {
    fs.writeSync = original;
    syncBuiltinESMExports();
  }
  assert.equal(injected, true);
  assert.equal(finished.status, "DISABLED");
  assert.equal(outputs(f.file)[keys.publish], "false");
  assert.equal(outputs(f.file)[keys.paths], "");
  assert.equal(result.worker.exitCode, 1);
  assert.equal(result.retention, "COMPLETE");
});
test("callback failure is separate from the original worker and encrypted retention result", (t) => {
  const f = fixture(t),
    result = collect(f, () => {
      throw Error(canary);
    });
  assert.equal(result.publication.status, "STAGED");
  assert.equal(result.publication.output.status, "CAPTURE_FAILED");
  assert.equal(f.sink.finish({ failed: true }).status, "DISABLED");
  assert.equal(outputs(f.file)[keys.publish], "false");
  assert.equal(result.worker.exitCode, 1);
});
test("an absent local workflow output keeps the actual collector result without claiming upload", (t) => {
  const f = fixture(t),
    sink = createBrowserFailurePublicationOutput({ outputFile: undefined });
  const result = collect(f, sink.capture);
  assert.equal(sink.finish({ failed: true }).status, "NOT_CONFIGURED");
  assert.equal(result.worker.exitCode, 1);
  assert.equal(result.publication.status, "STAGED");
  assert.equal(outputs(f.file)[keys.publish], "false");
});

test("oversized preexisting output is reset without loading or selecting its raw paths", (t) => {
  const f = fixture(t, `${keys.paths}=/private/${canary}\n${keys.publish}=true\n` + "x".repeat(65536));
  assert.equal(f.sink.initialized, true);
  assert.equal(outputs(f.file)[keys.publish], "false");
  assert.equal(outputs(f.file)[keys.paths], "");
  assert(fs.statSync(f.file).size < 256);
  assert.equal(f.sink.finish({ failed: true }).status, "DISABLED");
});
test("initialization failure is explicitly unready before any collector callback or worker", (t) => {
  const f = fixture(t),
    original = fs.ftruncateSync;
  fs.ftruncateSync = function () {
    throw Object.assign(Error(canary), { code: "EIO" });
  };
  syncBuiltinESMExports();
  let sink;
  try {
    sink = createBrowserFailurePublicationOutput({ outputFile: f.file, nonce: f.nonce });
  } finally {
    fs.ftruncateSync = original;
    syncBuiltinESMExports();
  }
  assert.equal(sink.initialized, false);
  assert.equal(sink.finish({ failed: true }).status, "DISABLED");
  assert.equal(outputs(f.file)[keys.publish], "false");
});

test("actual CLI refuses invalid output initialization before any server or Playwright worker launch", (t) => {
  const f = fixture(t),
    blocked = path.join(f.root, "output-directory");
  fs.mkdirSync(blocked);
  const child = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL("../../scripts/sounding-line/browser-authority.mjs", import.meta.url)),
      "--",
      "tests/e2e/not-started.spec.ts",
    ],
    {
      cwd: f.candidate,
      timeout: 5000,
      encoding: "utf8",
      env: { ...process.env, GITHUB_OUTPUT: blocked, SOUNDING_LINE_PRIVATE_FAILURE_PUBLICATION_NONCE: f.nonce },
    },
  );
  assert.ifError(child.error);
  assert.equal(child.status, 1);
  assert.match(child.stderr, /SOUNDING_LINE_PRIVATE_PUBLICATION_OUTPUT_INITIALIZATION_FAILED/u);
  assert.equal(child.stderr.includes('"event":"readiness.backend.start"'), false);
  assert.deepEqual(fs.readdirSync(f.candidate), []);
});
test("missing or invalid independent nonce cannot initialize or match the workflow gate", (t) => {
  const f = fixture(t);
  for (const nonce of [undefined, "true", `${f.nonce}\n${keys.publish}=true`]) {
    const sink = createBrowserFailurePublicationOutput({ outputFile: f.file, nonce });
    assert.equal(sink.initialized, false);
    assert.equal(sink.finish({ failed: true }).status, "DISABLED");
    assert.equal(outputs(f.file)[keys.publish], "false");
    assert.notEqual(outputs(f.file)[keys.publish], f.nonce);
  }
});
