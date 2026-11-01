import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { canonicalJson } from "../../scripts/sounding-line/evidence.mjs";
import {
  createRawOutputDirectory,
  readBoundedRawCaptureFile,
} from "../../scripts/sounding-line/experience-raw-output.mjs";
import {
  createRuntimeSnapshotRetention,
  restoreRuntimeSnapshotRetention,
} from "../../scripts/sounding-line/runtime-snapshot-retention.mjs";
import { authenticatedCompletedReceipt } from "../../scripts/sounding-line/authenticated-completed-evidence.mjs";
const rawDirectory = "artifacts/sounding-line/product-experience-capture-staging/capture-runtime-test/raw";
const binding = {
  prNumber: 900,
  baseSha: "a".repeat(40),
  candidateSha: "b".repeat(40),
  sourceDigest: "c".repeat(64),
  runtimeDigest: "d".repeat(64),
  contextId: "e".repeat(64),
};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function fixture(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "runtime-retention-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  await createRawOutputDirectory({ root, directory: rawDirectory });
  const store = await createRuntimeSnapshotRetention({ root, rawDirectory, ...options });
  return { root, rawDirectory, store };
}
const restore = (f, id, expectedOriginalBinding = binding) =>
  restoreRuntimeSnapshotRetention({ ...f, id, expectedOriginalBinding });
test("immutable chunk retention restores every SQLite and private fixture byte without attesting runtime or producer", async (t) => {
  const f = await fixture(t),
    source = path.join(f.root, "source.db");
  execFileSync(
    "python",
    [
      "-c",
      "import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);c.execute('create table fixture (value text)');c.execute(\"insert into fixture values ('original retained row')\");c.commit();c.close()",
      source,
    ],
    { windowsHide: true, timeout: 10000 },
  );
  const sqlite = fs.readFileSync(source),
    state = Buffer.alloc(2 * 65536 + 13, 97),
    expected = Buffer.from(state);
  const originalBinding = structuredClone(binding);
  const pending = f.store.append({
    originalBinding,
    files: new Map([
      ["sqlite-backup", sqlite],
      ["fixture-state", state],
      ["browser-authentication-cache", Buffer.from('{"cookies":[]}')],
    ]),
  });
  state.fill(0);
  originalBinding.candidateSha = "f".repeat(40);
  const first = await pending,
    observed = await restore(f, first.id);
  assert(observed.files.get("fixture-state").equals(expected));
  assert(observed.files.get("sqlite-backup").equals(sqlite));
  assert.equal(observed.originalBinding.candidateSha, binding.candidateSha);
  assert.equal(observed.qualification, false);
  assert.equal(observed.reuseAuthorized, false);
  assert.equal(observed.classification, "RETENTION_ONLY_NO_RUNTIME_QUIESCENCE_OR_PROVIDER_PROOF");
  assert.equal(authenticatedCompletedReceipt(observed, {}), null);
  const reconstructed = path.join(f.root, "restored.db");
  fs.writeFileSync(reconstructed, observed.files.get("sqlite-backup"));
  assert.equal(
    execFileSync(
      "python",
      [
        "-c",
        "import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);print(c.execute('select value from fixture').fetchone()[0]);c.close()",
        reconstructed,
      ],
      { encoding: "utf8", windowsHide: true, timeout: 10000 },
    ).trim(),
    "original retained row",
  );
  const nextBinding = { ...binding, contextId: "f".repeat(64) };
  const second = await f.store.append({ originalBinding: nextBinding, files: new Map([["fixture-state", expected]]) });
  assert(second.measurements.newBytes < expected.length / 8);
  assert((await restore(f, second.id, nextBinding)).files.get("fixture-state").equals(expected));
  await assert.rejects(restore(f, first.id, nextBinding), /MANIFEST/u);
});
test("concurrent appends cannot exceed the finite payload budget or publish an incomplete checkpoint", async (t) => {
  const f = await fixture(t, { maximumBytes: 35000 });
  const results = await Promise.allSettled([
    f.store.append({ originalBinding: binding, files: new Map([["fixture-state", Buffer.alloc(20000, 97)]]) }),
    f.store.append({
      originalBinding: { ...binding, contextId: "f".repeat(64) },
      files: new Map([["fixture-state", Buffer.alloc(20000, 98)]]),
    }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  const directory = path.join(f.root, rawDirectory, "runtime-snapshots");
  assert.equal(fs.readdirSync(path.join(directory, "chunks")).length, 1);
  assert.equal(fs.readdirSync(path.join(directory, "manifests")).length, 1);
  for (const prNumber of [721, 776, 805])
    await assert.rejects(
      f.store.append({
        originalBinding: { ...binding, prNumber },
        files: new Map([["fixture-state", Buffer.from("private")]]),
      }),
      /BINDING/u,
    );
});
test("altered chunks and self-rehashed malformed manifests cannot reconstruct retained originals", async (t) => {
  const f = await fixture(t),
    retained = await f.store.append({
      originalBinding: binding,
      files: new Map([["fixture-state", Buffer.from("unchanged fixture bytes")]]),
    });
  const directory = path.join(f.root, rawDirectory, "runtime-snapshots"),
    original = JSON.parse(fs.readFileSync(retained.path));
  for (const change of [
    (m) => (m.qualification = true),
    (m) => (m.originalBinding.candidateSha = "f".repeat(40)),
    (m) => m.files[0].chunks[0].bytes++,
    (m) => (m.files[0].bytes = 64 * 1024 * 1024 + 1),
    (m) => m.files.push(m.files[0]),
  ]) {
    const m = structuredClone(original);
    change(m);
    const bytes = Buffer.from(canonicalJson(m) + "\n"),
      id = hash(bytes);
    fs.writeFileSync(path.join(directory, "manifests", id + ".json"), bytes);
    await assert.rejects(restore(f, id), /RUNTIME_RETENTION_/u);
  }
  const chunk = path.join(directory, "chunks", original.files[0].chunks[0].sha256);
  fs.writeFileSync(chunk, "altered bytes");
  await assert.rejects(restore(f, retained.id), /CHUNK_CHANGED/u);
});
test("bounded raw reads deny external paths, hard links, nonfiles and oversize members", async (t) => {
  const f = await fixture(t),
    raw = path.join(f.root, rawDirectory),
    outside = path.join(f.root, "private-outside");
  fs.writeFileSync(outside, "PRIVATE_OUTSIDE_DATA");
  await assert.rejects(readBoundedRawCaptureFile({ ...f, file: outside, maximumBytes: 64 }), /READ_SCOPE/u);
  const linked = path.join(raw, "linked");
  fs.linkSync(outside, linked);
  await assert.rejects(readBoundedRawCaptureFile({ ...f, file: linked, maximumBytes: 64 }), /READ_FILE/u);
  const large = path.join(raw, "oversize");
  fs.writeFileSync(large, Buffer.alloc(65));
  await assert.rejects(readBoundedRawCaptureFile({ ...f, file: large, maximumBytes: 64 }), /READ_FILE/u);
  await assert.rejects(readBoundedRawCaptureFile({ ...f, file: raw, maximumBytes: 64 }));
  await assert.rejects(
    f.store.append({ originalBinding: binding, files: new Map([["../outside", Buffer.from("x")]]) }),
    /FILE_BOUND/u,
  );
  await assert.rejects(
    f.store.append({
      originalBinding: binding,
      files: new Map([["fixture-state", Buffer.alloc(32 * 1024 * 1024 + 1)]]),
    }),
    /FILE_BOUND/u,
  );
});
