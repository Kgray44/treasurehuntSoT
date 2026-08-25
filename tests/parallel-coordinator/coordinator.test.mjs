import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  HANDOFF_VERSION,
  STATES,
  coordinate,
  evaluateAfterMerge,
  handoffTemplate,
  materiallyAffected,
  overlapBetween,
  validateHandoff,
} from "../../scripts/parallel-coordinator/coordinator.mjs";

const sha = (character) => character.repeat(40);

function handoff(overrides = {}) {
  return validateHandoff({
    version: HANDOFF_VERSION,
    project: "Project",
    pr: 1,
    candidateSha: sha("a"),
    baseSha: sha("b"),
    status: "READY",
    touches: ["drydock"],
    paths: ["src/drydock/"],
    migrationFamilies: [],
    dependencies: [],
    ...overrides,
  });
}

test("the handoff contract is deliberately small and uses only coordinator states", () => {
  const template = handoffTemplate();
  assert.deepEqual(Object.keys(template), [
    "version",
    "project",
    "pr",
    "candidateSha",
    "baseSha",
    "status",
    "touches",
    "paths",
    "migrationFamilies",
    "dependencies",
  ]);
  assert.deepEqual(STATES, ["ACTIVE", "READY", "WAITING", "CONFLICT", "BLOCKED", "MERGED"]);
  assert.equal(validateHandoff(template).status, "READY");
});

test("independent READY candidates receive a stable order and do not require reconciliation", () => {
  const drydock = handoff({ project: "Drydock", pr: 198, candidateSha: sha("c"), paths: ["src/drydock/"] });
  const admiralty = handoff({
    project: "Admiralty",
    pr: 88,
    candidateSha: sha("d"),
    touches: ["admiralty"],
    paths: ["src/admiralty/"],
  });
  const plan = coordinate({ handoffs: [drydock, admiralty], mainSha: sha("e") });
  assert.deepEqual(
    plan.readyOrder.map((candidate) => candidate.pr),
    [88, 198],
  );
  const afterMerge = evaluateAfterMerge({
    handoffs: [drydock, admiralty],
    mergeSha: sha("f"),
    mergedPr: 198,
    mergedPaths: ["src/drydock/engine.ts"],
  });
  assert.equal(afterMerge.candidates.find((candidate) => candidate.pr === 198).state, "MERGED");
  assert.equal(afterMerge.candidates.find((candidate) => candidate.pr === 88).state, "READY");
  assert.deepEqual(afterMerge.unaffected, [{ pr: 88, project: "Admiralty", reason: "NO_RECONCILIATION_REQUIRED" }]);
});

test("an explicit dependency waits until its prerequisite merges and then requests reconciliation", () => {
  const prerequisite = handoff({ project: "Drydock", pr: 198, candidateSha: sha("c") });
  const dependent = handoff({
    project: "Admiralty",
    pr: 88,
    candidateSha: sha("d"),
    touches: ["admiralty"],
    paths: ["src/admiralty/"],
    dependencies: [198],
  });
  const plan = coordinate({ handoffs: [dependent, prerequisite] });
  assert.equal(plan.candidates.find((candidate) => candidate.pr === 198).state, "READY");
  assert.deepEqual(plan.candidates.find((candidate) => candidate.pr === 88).reasons, ["DEPENDENCY_PENDING:PR#198"]);
  const afterMerge = evaluateAfterMerge({
    handoffs: [dependent, prerequisite],
    mergeSha: sha("e"),
    mergedPr: 198,
    mergedPaths: ["src/drydock/engine.ts"],
  });
  const candidate = afterMerge.candidates.find((entry) => entry.pr === 88);
  assert.equal(candidate.state, "WAITING");
  assert.deepEqual(candidate.reasons, ["EXPLICIT_DEPENDENCY:PR#198", "RECONCILIATION_REQUIRED"]);
});

test("overlapping paths serialize the later candidate and parent directories count as overlap", () => {
  const first = handoff({ project: "First", pr: 10, candidateSha: sha("c"), paths: ["src/drydock/"] });
  const later = handoff({ project: "Later", pr: 20, candidateSha: sha("d"), paths: ["src/drydock/engine/"] });
  const plan = coordinate({ handoffs: [later, first] });
  assert.equal(plan.candidates.find((candidate) => candidate.pr === 10).state, "READY");
  assert.deepEqual(plan.candidates.find((candidate) => candidate.pr === 20).reasons, ["PATH_OVERLAP:PR#10"]);
  assert.deepEqual(overlapBetween(first, later).paths, ["src/drydock~src/drydock/engine"]);
});

test("same migration families serialize candidates even where paths are independent", () => {
  const first = handoff({
    project: "First",
    pr: 10,
    candidateSha: sha("c"),
    paths: ["src/drydock/"],
    migrationFamilies: ["postgres-core"],
  });
  const later = handoff({
    project: "Later",
    pr: 20,
    candidateSha: sha("d"),
    paths: ["src/admiralty/"],
    migrationFamilies: ["postgres-core"],
  });
  const plan = coordinate({ handoffs: [first, later] });
  assert.deepEqual(
    plan.readyOrder.map((candidate) => candidate.pr),
    [10],
  );
  assert.deepEqual(plan.candidates.find((candidate) => candidate.pr === 20).reasons, [
    "MIGRATION_FAMILY_SERIALIZED:postgres-core:PR#10",
  ]);
});

test("a strongly overlapping owned domain serializes the later candidate", () => {
  const first = handoff({ project: "First", pr: 10, candidateSha: sha("c"), touches: ["studio"] });
  const later = handoff({
    project: "Later",
    pr: 20,
    candidateSha: sha("d"),
    touches: ["studio"],
    paths: ["src/admiralty/"],
  });
  const plan = coordinate({ handoffs: [first, later] });
  assert.deepEqual(plan.candidates.find((candidate) => candidate.pr === 20).reasons, ["DOMAIN_OVERLAP:PR#10"]);
});

test("unrelated main movement preserves readiness while relevant movement requests reconciliation", () => {
  const drydock = handoff({ project: "Drydock", pr: 198, candidateSha: sha("c"), paths: ["src/drydock/"] });
  const admiralty = handoff({
    project: "Admiralty",
    pr: 88,
    candidateSha: sha("d"),
    touches: ["admiralty"],
    paths: ["src/admiralty/"],
  });
  assert.deepEqual(
    materiallyAffected({ merged: drydock, candidate: admiralty, mergedPaths: ["src/community/feed.ts"] }),
    [],
  );
  assert.deepEqual(
    materiallyAffected({ merged: drydock, candidate: admiralty, mergedPaths: ["src/admiralty/page.tsx"] }),
    ["PATH_OVERLAP"],
  );
  const afterRelevantMove = evaluateAfterMerge({
    handoffs: [drydock, admiralty],
    mergeSha: sha("e"),
    mergedPr: 198,
    mergedPaths: ["src/admiralty/page.tsx"],
  });
  const remaining = afterRelevantMove.candidates.find((candidate) => candidate.pr === 88);
  assert.equal(remaining.state, "WAITING");
  assert.deepEqual(remaining.reasons, ["PATH_OVERLAP", "RECONCILIATION_REQUIRED"]);
});

test("missing coordination metadata is a concise conflict instead of an invented state", () => {
  const incomplete = handoff({
    project: "Incomplete",
    pr: 7,
    candidateSha: sha("c"),
    touches: [],
    paths: [],
    migrationFamilies: [],
  });
  const plan = coordinate({ handoffs: [incomplete] });
  assert.deepEqual(plan.candidates[0].state, "CONFLICT");
  assert.deepEqual(plan.candidates[0].reasons, ["INSUFFICIENT_COORDINATION_METADATA"]);
});

test("the coordinator remains optional: unavailable PR inspection does not affect a product handoff", () => {
  const candidate = handoff({ project: "Drydock", pr: 198, candidateSha: sha("c") });
  const plan = coordinate({ handoffs: [candidate], prStates: {} });
  assert.deepEqual(
    plan.readyOrder.map((entry) => entry.pr),
    [198],
  );
  assert.equal(plan.candidates[0].state, "READY");
  const ordinaryWorkflow = readFileSync(".github/workflows/sounding-line-ordinary.yml", "utf8");
  const coordinator = readFileSync("scripts/parallel-coordinator/coordinator.mjs", "utf8");
  assert.doesNotMatch(ordinaryWorkflow, /parallel-coordinator/u);
  assert.doesNotMatch(coordinator, /writeFile|mkdir/u);
  assert.doesNotMatch(coordinator, /"pr", "merge"/u);
});
