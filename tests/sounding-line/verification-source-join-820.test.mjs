import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSourceJoinTree,
  verifySourceJoin820,
  SOURCE_JOIN_TREE_BYTES,
  HOMEPORT_820_REVIEW as review,
  HOMEPORT_820_PUBLICATION as pub,
} from "../../scripts/sounding-line/verification-source-join-820.mjs";
import { productSourceDigest } from "../../scripts/sounding-line/product-experience.mjs";
import {
  capacity820Grant,
  encodeCapacity820Grant,
  requireCapacity820Grant,
  CAPACITY_820,
} from "../../scripts/sounding-line/verification-capacity-820.mjs";
const entry = (char, mode = "100644") => [mode, char.repeat(40)];
const encode = (map) => Buffer.from([...map].map(([file, [mode, blob]]) => `${mode} blob ${blob}\t${file}\0`).join(""));
function fixture() {
  const A = new Map([
    ["src/app.ts", entry("a")],
    ["package.json", entry("b")],
    [review, entry("c")],
  ]);
  const O = new Map(A);
  O.set("src/app.ts", entry("d"));
  O.set(pub + "original.png", entry("e"));
  const B = new Map(A);
  B.set("scripts/sounding-line/authority.mjs", entry("f"));
  const C = new Map(B);
  C.set("src/app.ts", entry("d"));
  C.set(pub + "original.png", entry("e"));
  return { A, O, B, C };
}
const join = (m) =>
  verifySourceJoin820({
    originalBase: encode(m.A),
    originalCandidate: encode(m.O),
    currentBase: encode(m.B),
    candidate: encode(m.C),
  });
test("complete-tree join preserves original product and all exact protected updates", () => {
  const m = fixture(),
    value = join(m);
  assert.equal(value.qualification, false);
  assert.equal(value.comparedPaths, 5);
  assert.deepEqual(value.counts, { base: 2, original: 2, reviewReport: 1, newEvidence: 0 });
  for (const k of ["A", "O", "B", "C"]) m[k] = new Map([...m[k]].reverse());
  assert.deepEqual(join(m), value);
});
const changes = [
  ["authority substitution", (m) => m.C.set("scripts/sounding-line/authority.mjs", entry("a"))],
  ["authority deletion", (m) => m.C.delete("scripts/sounding-line/authority.mjs")],
  ["new source", (m) => m.C.set("src/unreviewed.ts", entry("a"))],
  ["original product mutation", (m) => m.C.set("src/app.ts", entry("a"))],
  ["original product deletion", (m) => m.C.delete("src/app.ts")],
  ["original mode mutation", (m) => m.C.set("src/app.ts", entry("d", "100755"))],
  ["original media overwrite", (m) => m.C.set(pub + "original.png", entry("a"))],
  ["original media deletion", (m) => m.C.delete(pub + "original.png")],
  ["conflicting protected overlap", (m) => m.B.set("src/app.ts", entry("f"))],
  ["identical reviewed overlap", (m) => m.B.set("src/app.ts", entry("d")), true],
  ["fresh shared report", (m) => m.C.set(review, entry("f")), true],
  ["executable report", (m) => m.C.set(review, entry("f", "100755"))],
  ["deleted report", (m) => m.C.delete(review)],
  ["new regular evidence namespace", (m) => m.C.set(pub + "base-new/fresh.png", entry("f")), true],
  ["new executable evidence", (m) => m.C.set(pub + "base-new/fresh.png", entry("f", "100755"))],
  ["new symlink evidence", (m) => m.C.set(pub + "base-new/fresh.png", entry("f", "120000"))],
  [
    "foreign evidence namespace",
    (m) => m.C.set("Development_Docs/Testing/Product_Experience/evidence/other/fresh.png", entry("f")),
  ],
  ["traversal", (m) => m.C.set(pub + "../fresh.png", entry("f"))],
  ["empty tail component", (m) => m.C.set(pub + "base//fresh.png", entry("f"))],
  ["control tail", (m) => m.C.set(pub + "base\nfresh.png", entry("f"))],
  [
    "new protected source copied exactly",
    (m) => {
      m.B.set("scripts/future.mjs", entry("a"));
      m.C.set("scripts/future.mjs", entry("a"));
    },
    true,
  ],
  ["protected deletion ignored", (m) => m.B.delete("package.json")],
  [
    "protected deletion copied",
    (m) => {
      m.B.delete("package.json");
      m.C.delete("package.json");
    },
    true,
  ],
  [
    "protected new evidence overwritten",
    (m) => {
      m.B.set(pub + "protected.png", entry("a"));
      m.C.set(pub + "protected.png", entry("f"));
    },
  ],
  [
    "original deletion retained",
    (m) => {
      m.A.set("src/deleted.ts", entry("a"));
      m.B.set("src/deleted.ts", entry("a"));
      m.C.set("src/deleted.ts", entry("a"));
    },
  ],
  [
    "original deletion preserved",
    (m) => {
      m.A.set("src/deleted.ts", entry("a"));
      m.B.set("src/deleted.ts", entry("a"));
    },
    true,
  ],
];
for (const [name, mutate, accept = false] of changes)
  test(`four-tree source join ${accept ? "accepts" : "denies"} ${name}`, () => {
    const m = fixture();
    mutate(m);
    if (accept) assert.equal(join(m).qualification, false);
    else assert.throws(() => join(m), /SOURCE_JOIN_/u);
  });
test("metadata parser rejects ambiguous, malformed, unsupported and oversized frames", () => {
  const good = encode(new Map([["file", entry("a")]]));
  for (const bytes of [
    good.subarray(0, -1),
    Buffer.concat([good, good]),
    Buffer.concat([good, Buffer.from([0])]),
    Buffer.from("100644 blob invalid\tfile\0"),
    Buffer.from(`160000 commit ${"a".repeat(40)}\tfile\0`),
    Buffer.from(`100664 blob ${"a".repeat(40)}\tfile\0`),
    Buffer.from(`100644 blob ${"a".repeat(40)}\t\0`),
    Buffer.concat([Buffer.from([0xff]), good]),
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), good]),
    Buffer.alloc(SOURCE_JOIN_TREE_BYTES + 1),
  ]) {
    assert.throws(() => parseSourceJoinTree(bytes), /SOURCE_JOIN_/u);
  }
  assert.throws(() => parseSourceJoinTree(good.toString()), /METADATA_BOUND/u);
});
test("trusted authority evolution changes the actual digest without a self-hashing literal pin", () => {
  const m = fixture(),
    grants = [];
  for (const revision of ["a", "b"]) {
    m.B.set("scripts/sounding-line/verification-capacity-820.mjs", entry(revision));
    m.C.set("scripts/sounding-line/verification-capacity-820.mjs", entry(revision));
    const observed = join(m);
    const snapshot = { entries: [...m.C].map(([path, [mode, blob]]) => ({ path, mode, blob })), contents: new Map() };
    const sourceDigest = productSourceDigest(snapshot);
    grants.push(
      capacity820Grant({
        baseSha: "a".repeat(40),
        candidateSha: "b".repeat(40),
        candidateTree: "c".repeat(40),
        runId: "123",
        attempt: "1",
        sourceDigest,
        sourceJoinDigest: observed.digest,
        createdAt: "2026-11-01T20:00:00Z",
        now: Date.parse("2026-11-01T20:01:00Z"),
      }),
    );
  }
  assert.notEqual(grants[0].sourceDigest, grants[1].sourceDigest);
  assert.notEqual(grants[0].sourceJoinDigest, grants[1].sourceJoinDigest);
  assert.equal(grants[1].originalSourceDigest, CAPACITY_820.originalSourceDigest);
  assert.equal(grants[1].version, 2);
  const old = encodeCapacity820Grant(grants[0]);
  assert.throws(() =>
    requireCapacity820Grant(grants[1], {
      SOUNDING_LINE_VERIFICATION_CAPACITY_GRANT: old.json,
      SOUNDING_LINE_VERIFICATION_CAPACITY_ID: old.id,
      SOUNDING_LINE_VERIFICATION_JOB_MINUTES: "65",
    }),
  );
});
