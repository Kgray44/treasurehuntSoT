import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  createPreparationCapsuleShadow,
  verifyPreparationCapsuleShadow,
} from "../../scripts/sounding-line/preparation-capsule-shadow.mjs";
import {
  measurePreparationContentShadow,
  inspectPreparationContentShadow,
} from "../../scripts/sounding-line/preparation-content-shadow.mjs";
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "preparation-capsule-shadow-"));
  t.after(() => {
    assert(root.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(root, { recursive: true });
  });
  const source = path.join(root, "source"),
    directory = path.join(root, "private");
  fs.mkdirSync(source);
  fs.mkdirSync(directory);
  fs.mkdirSync(path.join(source, "empty"));
  fs.writeFileSync(path.join(source, "client.js"), "export const client = 42;\n");
  fs.writeFileSync(path.join(source, "engine.node"), Buffer.alloc(130000, 0x5a));
  return { source, directory };
}
const create = (input) => createPreparationCapsuleShadow({ ...input, layer: "prisma-client" });
test("private capsule copies exact files, empty directories and modes with no reuse authority", (t) => {
  const f = fixture(t),
    result = create(f);
  assert.equal(result.status, "PASS");
  const verified = verifyPreparationCapsuleShadow(result);
  assert.equal(verified.inventoryDigest, result.inventoryDigest);
  assert.equal(verified.fileCount, 2);
  assert.equal(verified.certificate, "NOT_ISSUED");
  assert.equal(verified.reuseAuthorized, false);
  assert.equal(verified.qualification, false);
  assert.equal(verified.manifestBytesVerified, true);
  assert(
    fs
      .readFileSync(path.join(result.payload, "engine.node"))
      .equals(fs.readFileSync(path.join(f.source, "engine.node"))),
  );
  assert(fs.statSync(path.join(result.payload, "empty")).isDirectory());
  assert.equal(verifyPreparationCapsuleShadow(JSON.parse(JSON.stringify(result))), null);
});
test("content inventory inspection requires an opaque observation and cannot mutate it", (t) => {
  const { source } = fixture(t),
    measured = measurePreparationContentShadow({ root: source, layer: "prisma-client" });
  const inspected = inspectPreparationContentShadow(measured);
  assert(Object.isFrozen(inspected.entries));
  assert(inspected.entries.every(Object.isFrozen));
  assert.throws(() => {
    inspected.entries[0].path = "forged";
  }, TypeError);
  assert.equal(inspectPreparationContentShadow(JSON.parse(JSON.stringify(measured))), null);
  assert.equal(Object.hasOwn(inspected, "root"), false);
});
test("payload or either create-only receipt mutation invalidates its capsule", (t) => {
  for (const field of ["payload", "initial", "manifestPath"]) {
    const f = fixture(t),
      result = create(f);
    const filename =
      field === "payload"
        ? path.join(result.payload, "client.js")
        : field === "initial"
          ? path.join(result.root, "initial.json")
          : result.manifestPath;
    fs.appendFileSync(filename, "mutated");
    assert.throws(() => verifyPreparationCapsuleShadow(result), /DRIFT/u);
  }
});
test("source changed during bounded copy retains a failed prefix and original failure", (t) => {
  const f = fixture(t),
    open = fs.openSync,
    read = fs.readSync;
  let sourceFd,
    changed = false,
    copying = false;
  fs.openSync = (...args) => {
    const fd = open(...args);
    if (args[0] === path.join(f.source, "engine.node")) sourceFd = fd;
    if (String(args[0]).endsWith(path.join("payload", "engine.node"))) copying = true;
    return fd;
  };
  fs.readSync = (...args) => {
    const count = read(...args);
    if (copying && args[0] === sourceFd && !changed) {
      changed = true;
      fs.appendFileSync(path.join(f.source, "engine.node"), "drift");
    }
    return count;
  };
  try {
    const result = create(f);
    assert.equal(result.status, "FAIL");
    assert.equal(result.failureRetained, true);
    assert.match(result.originalError.message, /DRIFT/u);
    assert.equal(verifyPreparationCapsuleShadow(result), null);
  } finally {
    fs.openSync = open;
    fs.readSync = read;
  }
});
test("copy read and output-close failures retain both exact originals", (t) => {
  const f = fixture(t),
    open = fs.openSync,
    read = fs.readSync,
    close = fs.closeSync;
  const readError = Error("original capsule read"),
    closeError = Error("original capsule close");
  let input,
    output,
    copying = false;
  fs.openSync = (...args) => {
    const fd = open(...args);
    if (String(args[0]).endsWith(path.join("payload", "engine.node"))) {
      output = fd;
      copying = true;
    } else if (args[0] === path.join(f.source, "engine.node")) input = fd;
    return fd;
  };
  fs.readSync = (...args) => {
    if (copying && args[0] === input) throw readError;
    return read(...args);
  };
  fs.closeSync = (fd) => {
    close(fd);
    if (copying && fd === output) {
      copying = false;
      throw closeError;
    }
  };
  try {
    const result = create(f);
    assert.equal(result.status, "FAIL");
    assert.deepEqual(result.originalError.errors, [readError, closeError]);
    assert.equal(result.failureRetained, true);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(result.root, "failure.json"))).observedFailureMessages, [
      readError.message,
      closeError.message,
    ]);
  } finally {
    fs.openSync = open;
    fs.readSync = read;
    fs.closeSync = close;
  }
});
test("shared build layers, overlapping roots, and oversized source fail before capsule allocation", (t) => {
  const f = fixture(t);
  assert.throws(() => createPreparationCapsuleShadow({ ...f, layer: "build-output" }), /UNSUPPORTED_LAYER/u);
  assert.throws(() => create({ source: f.source, directory: f.source }), /OVERLAPPING/u);
  const fd = fs.openSync(path.join(f.source, "oversized"), "wx");
  fs.ftruncateSync(fd, 128 * 1024 * 1024 + 1);
  fs.closeSync(fd);
  assert.throws(() => create(f), /BOUND/u);
  assert.deepEqual(fs.readdirSync(f.directory), []);
});

test("early post-allocation failures retain their original error and never delete the prefix", (t) => {
  for (const stage of ["identity", "initial-write", "initial-stat"]) {
    const f = fixture(t),
      realpath = fs.realpathSync,
      write = fs.writeFileSync,
      stat = fs.lstatSync;
    const original = Error(`original ${stage}`);
    let injected = false;
    fs.realpathSync = (...args) => {
      if (stage === "identity" && !injected && path.basename(String(args[0])).startsWith("preparation-capsule-")) {
        injected = true;
        throw original;
      }
      return realpath(...args);
    };
    fs.writeFileSync = (...args) => {
      if (stage === "initial-write" && !injected && String(args[0]).endsWith("initial.json")) {
        injected = true;
        write(args[0], "partial original prefix", args[2]);
        throw original;
      }
      return write(...args);
    };
    fs.lstatSync = (...args) => {
      if (stage === "initial-stat" && !injected && String(args[0]).endsWith("initial.json")) {
        injected = true;
        throw original;
      }
      return stat(...args);
    };
    let result;
    try {
      result = create(f);
    } finally {
      fs.realpathSync = realpath;
      fs.writeFileSync = write;
      fs.lstatSync = stat;
    }
    assert.equal(result.status, "FAIL", stage);
    assert.equal(result.originalError, original);
    assert.equal(result.initialReceiptCustody, "UNAVAILABLE");
    assert.equal(result.failureRetained, true);
    assert(fs.statSync(result.root).isDirectory());
    assert.equal(JSON.parse(fs.readFileSync(path.join(result.root, "failure.json"))).message, original.message);
    if (stage === "initial-write") assert.equal(fs.readFileSync(result.initial, "utf8"), "partial original prefix");
    assert.equal(verifyPreparationCapsuleShadow(result), null);
  }
});

test("an early initial-write failure and failure-record error remain separate originals", (t) => {
  const f = fixture(t),
    write = fs.writeFileSync;
  const original = Error("original initial write"),
    retention = Error("original failed receipt write");
  fs.writeFileSync = (...args) => {
    if (String(args[0]).endsWith("initial.json")) throw original;
    if (String(args[0]).endsWith("failure.json")) throw retention;
    return write(...args);
  };
  let result;
  try {
    result = create(f);
  } finally {
    fs.writeFileSync = write;
  }
  assert.equal(result.status, "FAIL");
  assert.equal(result.originalError, original);
  assert.equal(result.retentionError, retention);
  assert.equal(result.failureRetained, false);
  assert(fs.statSync(result.root).isDirectory());
});
