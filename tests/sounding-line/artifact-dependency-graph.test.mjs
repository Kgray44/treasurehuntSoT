import assert from "node:assert/strict";
import test from "node:test";
import { digest } from "../../scripts/sounding-line/evidence.mjs";
import {
  createArtifactDependencyGraph,
  artifactDependencyClosure,
  planArtifactInvalidation,
} from "../../scripts/sounding-line/artifact-dependency-graph.mjs";

const node = (id, type, dependencies = [], value = id) => ({ id, type, dependencies, digest: digest(value) });
const seed = () => [
  node("docs", "SOURCE"),
  node("component-a", "SOURCE"),
  node("component-b", "SOURCE"),
  node("shared-style", "STYLE"),
  node("api-projection", "PROJECTION"),
  node("fixture", "FIXTURE"),
  node("lock", "LOCK"),
  node("runtime", "ENVIRONMENT"),
  node("a", "CONTEXT", ["component-a", "shared-style", "api-projection", "fixture", "lock", "runtime"]),
  node("b", "CONTEXT", ["component-b", "shared-style", "fixture", "lock", "runtime"]),
];
const contexts = [
  { id: "a", dependencies: ["a"] },
  { id: "b", dependencies: ["b"] },
];
const impact = (modify) => {
  const before = seed(),
    after = structuredClone(before);
  modify(after);
  return planArtifactInvalidation({
    base: createArtifactDependencyGraph(before),
    candidate: createArtifactDependencyGraph(after),
    contexts,
  });
};

// Hand-authored oracles are intentionally independent of the traversal code.
for (const [name, changed, expected] of [
  ["docs-only", "docs", []],
  ["isolated component", "component-a", ["a"]],
  ["shared style/token", "shared-style", ["a", "b"]],
  ["API projection", "api-projection", ["a"]],
  ["fixture", "fixture", ["a", "b"]],
  ["lock", "lock", ["a", "b"]],
  ["runtime", "runtime", ["a", "b"]],
])
  test(`coverage oracle: ${name}`, () => {
    const result = impact((nodes) => {
      nodes.find((entry) => entry.id === changed).digest = digest("changed bytes");
    });
    assert.deepEqual(result.freshContextIds, expected);
    assert.equal(result.qualification, false);
  });

test("deletion and removed edges cannot hide impact in the candidate-only graph", () => {
  const result = impact((nodes) => {
    nodes.splice(
      nodes.findIndex((entry) => entry.id === "component-a"),
      1,
    );
    nodes.find((entry) => entry.id === "a").dependencies = [
      "shared-style",
      "api-projection",
      "fixture",
      "lock",
      "runtime",
    ];
  });
  assert.deepEqual(result.freshContextIds, ["a"]);
  assert(result.outcomes[0].unionMembers.includes("component-a"));
});

test("rename is a deletion plus addition even when bytes are identical", () => {
  const result = impact((nodes) => {
    nodes.find((entry) => entry.id === "component-a").id = "renamed-a";
    nodes.find((entry) => entry.id === "a").dependencies[0] = "renamed-a";
  });
  assert.deepEqual(result.freshContextIds, ["a"]);
});

test("unknown imports and runtime ownership stay fresh even without observed source drift", () => {
  const nodes = seed();
  nodes.find((entry) => entry.id === "component-a").unknown = true;
  const graph = createArtifactDependencyGraph(nodes);
  const result = planArtifactInvalidation({ base: graph, candidate: graph, contexts });
  assert.deepEqual(result.freshContextIds, ["a"]);
  assert.equal(result.outcomes[0].disposition, "CONSERVATIVE_FRESH");
});

test("byte and edge identity is deterministic; import cycles terminate without losing dependencies", () => {
  const nodes = [node("a", "SOURCE", ["b"]), node("b", "SOURCE", ["a"])];
  const graph = createArtifactDependencyGraph(nodes);
  assert.equal(graph.graphDigest, createArtifactDependencyGraph([...nodes].reverse()).graphDigest);
  assert.deepEqual(artifactDependencyClosure(graph, ["a"]).ids, ["a", "b"]);
});

test("malformed graph, forged digest, missing root and duplicated context cannot be preserved", () => {
  assert.throws(() => createArtifactDependencyGraph([node("a", "UNRECOGNIZED")]));
  assert.throws(() => createArtifactDependencyGraph([node("a", "SOURCE", ["missing"])]));
  assert.throws(() => createArtifactDependencyGraph([node("a", "SOURCE"), node("a", "SOURCE")]));
  const graph = createArtifactDependencyGraph(seed());
  assert.throws(() => artifactDependencyClosure({ ...graph, graphDigest: "0".repeat(64) }, ["a"]));
  assert.equal(artifactDependencyClosure(graph, ["missing"]).unknown, true);
  assert.throws(() =>
    planArtifactInvalidation({ base: graph, candidate: graph, contexts: [contexts[0], contexts[0]] }),
  );
});

test("many individually valid contexts cannot amplify aggregate traversal without a bound", () => {
  const leaves = Array.from({ length: 1000 }, (_, index) => node(`leaf-${index}`, "SOURCE"));
  const graph = createArtifactDependencyGraph([
    ...leaves,
    node(
      "root",
      "CONTEXT",
      leaves.map((entry) => entry.id),
    ),
  ]);
  const contexts = Array.from({ length: 1000 }, (_, index) => ({ id: `context-${index}`, dependencies: ["root"] }));
  assert.throws(() => planArtifactInvalidation({ base: graph, candidate: graph, contexts }), /TOTAL_TRAVERSAL_BOUND/u);
});
