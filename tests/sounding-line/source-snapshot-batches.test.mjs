import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { sourceSnapshot } from "../../scripts/sounding-line/product-experience.mjs";
import {
  readSourceSnapshotBatches,
  SOURCE_SNAPSHOT_MAX_BUFFER,
} from "../../scripts/sounding-line/source-snapshot-batches.mjs";

const oid = "a".repeat(40);
const other = "b".repeat(40);
const entry = (blob = oid, name = "source.json") => ({ path: name, blob });
const frame = (blob, body) => Buffer.concat([Buffer.from(`${blob} blob ${body.length}\n`), body, Buffer.from("\n")]);
const inputIds = (options) => options.input.trimEnd().split("\n");
const invalid = /PRODUCT_EXPERIENCE_SOURCE_SNAPSHOT_INVALID/u;

test("the protected regression script includes every incremental registry and context boundary test", () => {
  const { scripts } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  const files = scripts["test:sounding-line"].split(/\s+/u);
  for (const name of [
    "artifact-dependency-graph",
    "artifact-evidence-registry",
    "experience-artifact-graph",
    "experience-artifact-snapshot",
    "artifact-registry-retention",
    "closed-context-journal",
    "artifact-registry-archive",
    "artifact-registry-provenance",
    "completed-evidence-v2",
    "provider-event-binding-shadow",
    "provider-run-log-archive",
    "native-evidence-context",
    "runtime-snapshot-retention",
    "owned-process-closure",
  ])
    assert.equal(files.filter((file) => file === `tests/sounding-line/${name}.test.mjs`).length, 1, name);
});

test("raw-byte mode preserves invalid UTF-8 while aggregate byte bounds reject before payload", () => {
  const bytes = Buffer.from([255, 0, 10]);
  const read = (args) => (args[1] === "--batch-check" ? Buffer.from(`${oid} blob 3\n`) : frame(oid, bytes));
  assert(
    readSourceSnapshotBatches([entry()], read, { encoding: null, maxTotalBytes: 3 }).get("source.json").equals(bytes),
  );
  let payloads = 0;
  assert.throws(
    () =>
      readSourceSnapshotBatches(
        [entry(), entry(oid, "second.json")],
        (args) => {
          if (args[1] === "--batch") payloads++;
          return Buffer.from(`${oid} blob 3\n${oid} blob 3\n`);
        },
        { maxTotalBytes: 5 },
      ),
    invalid,
  );
  assert.equal(payloads, 0);
  assert.throws(() => readSourceSnapshotBatches([], read, { encoding: "latin1" }), invalid);
});

test("real Git bounded reads preserve all ordered aliases, empty blobs and opaque UTF-8 decoding after monolithic ENOBUFS", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "snapshot-batch-real-git-"));
  assert(root.startsWith(path.resolve(tmpdir()) + path.sep));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (args, options = {}) => execFileSync("git", args, { cwd: root, ...options });
  git(["init", "--quiet", "--initial-branch=main", "--template="]);
  const bodies = [
    Buffer.concat([Buffer.from("a".repeat(160) + `\n${other} blob 999\nbody\0π`), Buffer.from([255])]),
    Buffer.alloc(0),
    Buffer.from("\n" + "b".repeat(190)),
  ];
  const blobs = bodies.map((input) => git(["hash-object", "-w", "--stdin"], { input }).toString().trim());
  const sources = [
    entry(blobs[0], "01-π.json"),
    entry(blobs[0], "02-alias.json"),
    entry(blobs[1], "03-empty.json"),
    entry(blobs[2], "04-header.json"),
  ];
  const values = [bodies[0], bodies[0], bodies[1], bodies[2]];
  const input = sources.map((item) => item.blob).join("\n") + "\n";
  assert.throws(() => git(["cat-file", "--batch"], { input, maxBuffer: 512 }), { code: "ENOBUFS" });
  const calls = [];
  const actual = readSourceSnapshotBatches(
    sources,
    (args, options) => {
      const bytes = git(args, options);
      calls.push({ args, ids: inputIds(options), maxBuffer: options.maxBuffer, bytes: bytes.length });
      return bytes;
    },
    { maxBuffer: 512 },
  );
  const expected = sources.map((item, index) => [item.path, values[index].toString("utf8")]);
  assert.deepEqual([...actual], expected);
  const payloads = calls.filter((call) => call.args[1] === "--batch");
  assert(payloads.length > 1);
  assert.deepEqual(
    payloads.flatMap((call) => call.ids),
    sources.map((item) => item.blob),
  );
  assert.deepEqual(
    calls.filter((call) => call.args[1] === "--batch-check").flatMap((call) => call.ids),
    sources.map((item) => item.blob),
  );
  assert(calls.every((call) => call.maxBuffer === 512 && call.bytes <= 512));
  const tree = git(["mktree"], { input: sources.map((item) => `100644 blob ${item.blob}\t${item.path}\n`).join("") })
    .toString()
    .trim();
  const snapshot = sourceSnapshot(root, tree);
  assert.deepEqual([...snapshot.contents], expected);
  assert.deepEqual(
    snapshot.entries,
    sources.map((item) => ({ path: item.path, mode: "100644", type: "blob", blob: item.blob })),
  );
  assert.throws(
    () =>
      readSourceSnapshotBatches(
        [...sources, entry("0".repeat(40), "missing.json")],
        (args, options) => git(args, options),
        { maxBuffer: 512 },
      ),
    invalid,
  );
});

test("metadata and payload partitions stay bounded and preserve every request exactly once", () => {
  for (const [count, maxBuffer, expectedMetadata] of [
    [513, SOURCE_SNAPSHOT_MAX_BUFFER, [512, 1]],
    [12, 128, Array(12).fill(1)],
  ]) {
    const sources = Array.from({ length: count }, (_, index) => entry(oid, `${index}.json`));
    const calls = [];
    const actual = readSourceSnapshotBatches(
      sources,
      (args, options) => {
        const ids = inputIds(options);
        const bytes = Buffer.from(ids.map((id) => `${id} blob 0\n${args[1] === "--batch" ? "\n" : ""}`).join(""));
        calls.push({ kind: args[1], ids, bytes: bytes.length, maxBuffer: options.maxBuffer });
        return bytes;
      },
      { maxBuffer },
    );
    assert.deepEqual(
      [...actual],
      sources.map((item) => [item.path, ""]),
    );
    assert.deepEqual(
      calls.filter((call) => call.kind === "--batch-check").map((call) => call.ids.length),
      expectedMetadata,
    );
    for (const kind of ["--batch", "--batch-check"])
      assert.deepEqual(
        calls.filter((call) => call.kind === kind).flatMap((call) => call.ids),
        sources.map((item) => item.blob),
      );
    assert(calls.every((call) => call.maxBuffer === maxBuffer && call.bytes <= maxBuffer));
  }
});

test("one complete frame may exactly fill the fixed budget; one extra byte is terminal before payload", () => {
  for (const size of [78, 79]) {
    let reads = 0;
    const read = (args) => {
      reads++;
      return args[1] === "--batch-check" ? Buffer.from(`${oid} blob ${size}\n`) : frame(oid, Buffer.alloc(size, 120));
    };
    if (size === 78) {
      assert.equal(readSourceSnapshotBatches([entry()], read, { maxBuffer: 128 }).get("source.json"), "x".repeat(size));
      assert.equal(reads, 2);
    } else {
      assert.throws(() => readSourceSnapshotBatches([entry()], read, { maxBuffer: 128 }), invalid);
      assert.equal(reads, 1);
    }
  }
});

test("malformed, missing, extra and misordered metadata never produce a partial snapshot", () => {
  for (const bytes of [
    Buffer.from(`${other} blob 1\n`),
    Buffer.from(`${oid} tree 1\n`),
    Buffer.from(`${oid} missing\n`),
    ...["-1", "01", "NaN", "9007199254740992"].map((size) => Buffer.from(`${oid} blob ${size}\n`)),
    Buffer.from(`${oid} blob 1`),
    Buffer.from(`${oid} blob 1\nextra\n`),
    Buffer.from(`${oid} blob 1\r\n`),
  ]) {
    let reads = 0;
    assert.throws(
      () =>
        readSourceSnapshotBatches(
          [entry()],
          () => {
            reads++;
            return bytes;
          },
          { maxBuffer: 128 },
        ),
      invalid,
    );
    assert.equal(reads, 1);
  }
});

test("payload framing rejects wrong identity, type, size, missing separators, truncation and trailing bytes", () => {
  const good = frame(oid, Buffer.from("x"));
  for (const bytes of [
    frame(other, Buffer.from("x")),
    Buffer.from(`${oid} tree 1\nx\n`),
    Buffer.from(`${oid} blob 2\nx\n`),
    Buffer.from(`${oid} blob 01\nx\n`),
    Buffer.from(`${oid} blob 1x\n`),
    good.subarray(0, good.length - 2),
    good.subarray(0, good.length - 1),
    Buffer.concat([good, Buffer.from("\n")]),
    Buffer.from(`${oid} missing\n`),
  ])
    assert.throws(
      () =>
        readSourceSnapshotBatches(
          [entry()],
          (args) => (args[1] === "--batch-check" ? Buffer.from(`${oid} blob 1\n`) : bytes),
          { maxBuffer: 128 },
        ),
      invalid,
    );
  assert.throws(
    () =>
      readSourceSnapshotBatches(
        [entry(oid, "one.json"), entry(other, "two.json")],
        (args, options) =>
          args[1] === "--batch-check"
            ? Buffer.from(`${inputIds(options)[0]} blob 0\n`)
            : Buffer.concat([frame(other, Buffer.alloc(0)), frame(oid, Buffer.alloc(0))]),
        { maxBuffer: 128 },
      ),
    invalid,
  );
});

test("a late native read failure keeps its exact identity and does not retry or expose partial results", () => {
  const original = Object.freeze(Object.assign(new Error("synthetic terminal read failure"), { code: "ENOBUFS" }));
  const calls = [];
  let payloads = 0;
  assert.throws(
    () =>
      readSourceSnapshotBatches(
        [entry(oid, "first.json"), entry(other, "late.json")],
        (args, options) => {
          calls.push(args[1]);
          const id = inputIds(options)[0];
          if (args[1] === "--batch-check") return Buffer.from(`${id} blob 78\n`);
          if (++payloads === 2) throw original;
          return frame(id, Buffer.alloc(78));
        },
        { maxBuffer: 128 },
      ),
    (error) => error === original,
  );
  assert.deepEqual(calls, ["--batch-check", "--batch-check", "--batch", "--batch"]);
});

test("empty selections do no I/O and invalid budgets cannot increase the production cap", () => {
  const read = () => {
    throw Error("unexpected read");
  };
  assert.deepEqual([...readSourceSnapshotBatches([], read)], []);
  for (const maxBuffer of [0, 127, 128.5, NaN, "512", SOURCE_SNAPSHOT_MAX_BUFFER + 1])
    assert.throws(() => readSourceSnapshotBatches([entry()], read, { maxBuffer }), invalid);
});

test("a missing object in a later payload batch rejects the entire snapshot", () => {
  const calls = [];
  assert.throws(
    () =>
      readSourceSnapshotBatches(
        [entry(oid, "first.json"), entry(other, "missing.json")],
        (args, options) => {
          calls.push(args[1]);
          const id = inputIds(options)[0];
          if (args[1] === "--batch-check") return Buffer.from(`${id} blob 78\n`);
          return id === oid ? frame(id, Buffer.alloc(78)) : Buffer.from(`${id} missing\n`);
        },
        { maxBuffer: 128 },
      ),
    invalid,
  );
  assert.deepEqual(calls, ["--batch-check", "--batch-check", "--batch", "--batch"]);
});
