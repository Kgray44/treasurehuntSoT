import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  measurePreparationContentShadow,
  comparePreparationContentShadow,
} from "../../scripts/sounding-line/preparation-content-shadow.mjs";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "preparation-content-shadow-"));
  t.after(() => fs.rmSync(root, { recursive: true }));
  const source = path.join(root, "source"),
    destination = path.join(root, "destination");
  fs.mkdirSync(source);
  fs.mkdirSync(destination);
  for (const directory of [source, destination]) {
    fs.mkdirSync(path.join(directory, "nested"));
    fs.writeFileSync(path.join(directory, "nested", "client.js"), "export const value = 42;\n");
    fs.writeFileSync(path.join(directory, "engine.wasm"), Buffer.alloc(70000, 0x5a));
  }
  return { root, source, destination };
}
const measure = (root) => measurePreparationContentShadow({ root, layer: "prisma-client" });
test("independent complete source and destination rehash has no reuse authority", (t) => {
  const { source, destination } = fixture(t);
  const a = measure(source),
    b = measure(destination);
  assert.equal(a.fileCount, 2);
  assert.equal(a.inventoryDigest, b.inventoryDigest);
  assert.equal(Object.hasOwn(a, "root"), false);
  const comparison = comparePreparationContentShadow({ source: a, destination: b });
  assert.equal(comparison.contentEquivalent, true);
  assert.equal(comparison.disposition, "EQUIVALENT_SHADOW");
  assert.equal(comparison.reuseAuthorized, false);
  assert.equal(comparison.qualification, false);
  assert.equal(comparison.externalIsolationAttested, false);
  assert.equal(comparison.action, "RUN_FRESH_PREPARATION");
  assert.equal(comparison.certificate, "NOT_ISSUED");
});
test("corrupt restored bytes are rejected even with an independently measured destination", (t) => {
  const { source, destination } = fixture(t);
  fs.writeFileSync(path.join(destination, "engine.wasm"), Buffer.alloc(70000, 0x5b));
  const comparison = comparePreparationContentShadow({ source: measure(source), destination: measure(destination) });
  assert.equal(comparison.disposition, "REJECT_CORRUPTION");
  assert.equal(comparison.contentEquivalent, false);
});
test("late destination mutation and source mutation independently reject stale observations", (t) => {
  const { source, destination } = fixture(t),
    a = measure(source),
    b = measure(destination);
  fs.writeFileSync(path.join(destination, "extra"), "late file");
  let result = comparePreparationContentShadow({ source: a, destination: b });
  assert.equal(result.disposition, "REJECT_DRIFT");
  assert.equal(result.destinationUnchanged, false);
  const c = measure(destination);
  fs.writeFileSync(path.join(source, "engine.wasm"), "changed producer");
  result = comparePreparationContentShadow({ source: a, destination: c });
  assert.equal(result.sourceUnchanged, false);
  assert.equal(result.contentEquivalent, false);
});
test("serialized observations, same root and nested root cannot supply independent proof", (t) => {
  const { source, destination } = fixture(t),
    a = measure(source),
    b = measure(destination);
  assert.throws(
    () => comparePreparationContentShadow({ source: JSON.parse(JSON.stringify(a)), destination: b }),
    /OPAQUE/,
  );
  assert.throws(() => comparePreparationContentShadow({ source: a, destination: a }), /DISTINCT/);
  assert.throws(
    () => comparePreparationContentShadow({ source: a, destination: measure(path.join(source, "nested")) }),
    /OVERLAPPING/,
  );
});
test("hard linked files and Git stores are excluded from immutable layer observations", (t) => {
  const { root, source } = fixture(t);
  fs.linkSync(path.join(source, "engine.wasm"), path.join(root, "hardlink"));
  assert.throws(() => measure(source), /FILE_TYPE_OR_LINK/);
  const other = path.join(root, "git-layer");
  fs.mkdirSync(other);
  fs.mkdirSync(path.join(other, ".git"));
  assert.throws(() => measure(other), /PATH/);
});
test("unbounded or excluded layer declarations and empty directories fail closed", (t) => {
  const { root, source } = fixture(t);
  for (const layer of ["build-output", "workspace", "database", "browser-profile", "unknown"])
    assert.throws(() => measurePreparationContentShadow({ root: source, layer }), /LAYER/);
  const empty = path.join(root, "empty");
  fs.mkdirSync(empty);
  assert.throws(() => measure(empty), /EMPTY/);
  assert.throws(() => measure("relative-path"), /ROOT/);
});
test("read failure and close failure retain both exact original errors", (t) => {
  const { source } = fixture(t),
    read = fs.readSync,
    close = fs.closeSync;
  const readError = Error("original read failure"),
    closeError = Error("original close failure");
  fs.readSync = () => {
    throw readError;
  };
  fs.closeSync = (fd) => {
    close(fd);
    throw closeError;
  };
  try {
    assert.throws(
      () => measure(source),
      (error) =>
        error instanceof AggregateError &&
        error.errors[0] === readError &&
        error.errors[1] === closeError &&
        error.cause === readError,
    );
  } finally {
    fs.readSync = read;
    fs.closeSync = close;
  }
});
test("tree changes during reads are detected before issuing an observation", (t) => {
  const { source } = fixture(t),
    read = fs.readSync;
  let changed = false;
  fs.readSync = (...args) => {
    const count = read(...args);
    if (!changed) {
      changed = true;
      fs.writeFileSync(path.join(source, "injected"), "new");
    }
    return count;
  };
  try {
    assert.throws(() => measure(source), /DIRECTORY_DRIFT/);
  } finally {
    fs.readSync = read;
  }
});
