import test from "node:test";
import assert from "node:assert/strict";
import { digest } from "../../scripts/sounding-line/evidence.mjs";
import { createArtifactDependencyGraph } from "../../scripts/sounding-line/artifact-dependency-graph.mjs";
import { planSelectedSourceShadow } from "../../scripts/sounding-line/selected-source-shadow.mjs";

const sha = (letter) => letter.repeat(40);
const entry = (path, letter, mode = "100644") => ({ path, blob: sha(letter), mode, type: "blob" });
const snapshot = (revision, entries) => ({ revision, entries, sourceTreeDigest: digest(entries) });
function setup() {
  const a = entry("src/a.ts", "a"),
    b = entry("src/b.ts", "b"),
    old = entry("src/deleted.ts", "c");
  const untouched = entry("public/archive.bin", "d"),
    pkg = entry("package.json", "e"),
    lock = entry("package-lock.json", "f");
  const config = entry(".gitattributes", "1"),
    reader = entry("scripts/reader.mjs", "2");
  const added = entry("src/added.ts", "3"),
    modified = entry("src/b.ts", "4", "100755");
  const base = snapshot(sha("5"), [a, b, old, untouched, pkg, lock, config, reader]);
  const candidate = snapshot(sha("6"), [a, modified, added, untouched, pkg, lock, config, reader]);
  const graph = (entries) =>
    createArtifactDependencyGraph([
      ...entries.map((item) => ({
        id: `file:${item.path}`,
        type: "SOURCE",
        digest: digest({ blob: item.blob, mode: item.mode }),
        dependencies: [],
      })),
      { id: "context:one", type: "CONTEXT", digest: digest("context"), dependencies: ["file:src/a.ts"] },
    ]);
  const historicalEntry = entry("evidence/original.png", "7");
  const historical = [snapshot(sha("8"), [historicalEntry])];
  return {
    base,
    candidate,
    baseGraph: graph(base.entries),
    candidateGraph: graph(candidate.entries),
    roots: ["context:one"],
    readerPaths: ["scripts/reader.mjs"],
    historical,
    historicalPins: [{ revision: sha("8"), ...historicalEntry }],
    prNumber: 900,
  };
}

test("proposal retains dependency, changed/deleted/mode, reader, root-policy and original historical identities", () => {
  const input = setup(),
    result = planSelectedSourceShadow(input);
  assert.equal(result.profile, "SELECTED_SOURCE_SHADOW");
  const paths = result.readSet.map((entry) => `${entry.revision}:${entry.path}`);
  for (const file of [
    "src/a.ts",
    "src/b.ts",
    "package.json",
    "package-lock.json",
    ".gitattributes",
    "scripts/reader.mjs",
  ])
    for (const revision of [input.base.revision, input.candidate.revision])
      assert(paths.includes(`${revision}:${file}`));
  assert(paths.includes(`${input.base.revision}:src/deleted.ts`));
  assert(paths.includes(`${input.candidate.revision}:src/added.ts`));
  assert(paths.includes(`${sha("8")}:evidence/original.png`));
  assert(!result.readSet.some((entry) => entry.path === "public/archive.bin"));
  assert.deepEqual(result.changedPaths, ["src/added.ts", "src/b.ts", "src/deleted.ts"]);
  assert.equal(result.productionMaterialization, "FULL_SNAPSHOT");
  assert.equal(result.certificate, "NOT_ISSUED");
  assert.equal(result.reuseAuthorized, false);
  assert.equal(result.requiresCompleteCommitAndTreeMetadata, true);
  assert.equal(result.lateTransportAllowed, false);
  assert.equal(result.measurements.rawByteSavings, null);
});

test("deleted edges remain visible through independently computed base closure", () => {
  const input = setup();
  input.baseGraph = createArtifactDependencyGraph(
    input.baseGraph.nodes.map((node) =>
      node.id === "context:one" ? { ...node, dependencies: ["file:src/deleted.ts"] } : node,
    ),
  );
  const result = planSelectedSourceShadow(input);
  assert.equal(result.profile, "SELECTED_SOURCE_SHADOW");
  assert(
    result.readSet.some(
      (entry) =>
        entry.revision === input.base.revision &&
        entry.path === "src/deleted.ts" &&
        entry.reasons.includes("DEPENDENCY_CLOSURE"),
    ),
  );
});

test("unknown dependencies, graph tampering and graph/source divergence retain FULL fallback", () => {
  for (const mutate of [
    (input) => {
      input.candidateGraph = createArtifactDependencyGraph(
        input.candidateGraph.nodes.map((node) => (node.id === "file:src/a.ts" ? { ...node, unknown: true } : node)),
      );
    },
    (input) => {
      input.candidateGraph.graphDigest = "0".repeat(64);
    },
    (input) => {
      input.candidateGraph = createArtifactDependencyGraph(
        input.candidateGraph.nodes.map((node) =>
          node.id === "file:src/a.ts" ? { ...node, digest: "0".repeat(64) } : node,
        ),
      );
    },
  ]) {
    const input = setup();
    mutate(input);
    const result = planSelectedSourceShadow(input);
    assert.equal(result.profile, "FULL_SNAPSHOT");
    assert.equal(result.certificate, "NOT_ISSUED");
    assert.equal(result.reuseAuthorized, false);
  }
});

test("historical pin substitution, duplicate pins and missing reader closure never produce a partial proposal", () => {
  for (const mutate of [
    (input) => {
      input.historicalPins[0].blob = sha("9");
    },
    (input) => {
      input.historicalPins.push({ ...input.historicalPins[0] });
    },
    (input) => {
      input.historical = [];
    },
    (input) => {
      input.readerPaths.push("scripts/missing.mjs");
    },
    (input) => {
      input.candidate.entries[0].blob = sha("9");
    },
  ]) {
    const input = setup();
    mutate(input);
    const result = planSelectedSourceShadow(input);
    assert.equal(result.profile, "FULL_SNAPSHOT");
    assert.equal(Object.hasOwn(result, "readSet"), false);
  }
});

test("unsafe metadata, absent required toolchain and symlinked dependency roots remain full", () => {
  for (const change of ["traversal", "lock", "symlink"]) {
    const input = setup();
    if (change === "traversal") input.candidate.entries.push(entry("../outside", "9"));
    else if (change === "lock")
      input.candidate.entries = input.candidate.entries.filter((entry) => entry.path !== "package-lock.json");
    else {
      input.candidate.entries[0].mode = "120000";
      input.candidateGraph = createArtifactDependencyGraph(
        input.candidateGraph.nodes.map((node) =>
          node.id === "file:src/a.ts"
            ? { ...node, digest: digest({ blob: input.candidate.entries[0].blob, mode: "120000" }) }
            : node,
        ),
      );
    }
    input.candidate.sourceTreeDigest = digest(input.candidate.entries);
    assert.equal(planSelectedSourceShadow(input).profile, "FULL_SNAPSHOT");
  }
});

test("held owners and bounded inventory expansion cannot obtain a new selection mechanism", () => {
  for (const prNumber of [721, 776, 805])
    assert.throws(() => planSelectedSourceShadow({ ...setup(), prNumber }), /SHADOW_SCOPE/u);
  const input = setup();
  input.historical = Array(15).fill(input.historical[0]);
  assert.equal(planSelectedSourceShadow(input).profile, "FULL_SNAPSHOT");
});
