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
  const value = {
    version: HANDOFF_VERSION,
    project: "Project",
    pr: 1,
    candidateSha: sha("a"),
    baseSha: sha("b"),
    status: "READY",
    touches: [],
    paths: [],
    migrationFamilies: [],
    dependencies: [],
    ...overrides,
  };
  if (overrides.touches === undefined) value.touches = [];
  if (overrides.paths === undefined) value.paths = [`src/project-${value.pr}/`];
  return validateHandoff(value);
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
    "priorityLevel",
    "touches",
    "paths",
    "migrationFamilies",
    "dependencies",
  ]);
  assert.deepEqual(STATES, ["ACTIVE", "READY", "WAITING", "CONFLICT", "BLOCKED", "MERGED"]);
  assert.equal(validateHandoff(template).status, "READY");
  assert.equal(validateHandoff(template).priorityLevel, 5);
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
  assert.equal(candidate.state, "READY");
  assert.equal(candidate.action, "RECONCILIATION_REQUIRED");
  assert.deepEqual(candidate.reasons, ["EXPLICIT_DEPENDENCY:PR#198", "RECONCILIATION_REQUIRED"]);
});

test("overlapping paths remain READY in the normal queue and parent directories count as overlap", () => {
  const first = handoff({ project: "First", pr: 10, candidateSha: sha("c"), paths: ["src/drydock/"] });
  const later = handoff({ project: "Later", pr: 20, candidateSha: sha("d"), paths: ["src/drydock/engine/"] });
  const plan = coordinate({ handoffs: [later, first] });
  assert.equal(plan.candidates.find((candidate) => candidate.pr === 10).state, "READY");
  assert.equal(plan.candidates.find((candidate) => candidate.pr === 20).state, "READY");
  assert.deepEqual(
    plan.readyOrder.map((candidate) => [candidate.pr, candidate.seat, candidate.action]),
    [
      [10, 1, "FINALIZE_NEXT"],
      [20, 2, "WARM_STANDBY"],
    ],
  );
  assert.deepEqual(overlapBetween(first, later).paths, ["src/drydock~src/drydock/engine"]);
});

test("same migration families remain READY while only finalization is serialized by the queue", () => {
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
    plan.readyOrder.map((candidate) => [candidate.pr, candidate.seat, candidate.action]),
    [
      [10, 1, "FINALIZE_NEXT"],
      [20, 2, "WARM_STANDBY"],
    ],
  );
  assert.equal(plan.candidates.find((candidate) => candidate.pr === 20).state, "READY");
  assert.deepEqual(overlapBetween(first, later).migrationFamilies, ["postgres-core"]);
});

test("a strongly overlapping owned domain remains READY in the two-seat window", () => {
  const first = handoff({ project: "First", pr: 10, candidateSha: sha("c"), touches: ["studio"] });
  const later = handoff({
    project: "Later",
    pr: 20,
    candidateSha: sha("d"),
    touches: ["studio"],
    paths: ["src/admiralty/"],
  });
  const plan = coordinate({ handoffs: [first, later] });
  assert.equal(plan.candidates.find((candidate) => candidate.pr === 20).state, "READY");
  assert.equal(plan.candidates.find((candidate) => candidate.pr === 20).action, "WARM_STANDBY");
  assert.deepEqual(overlapBetween(first, later).touches, ["studio"]);
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
  assert.equal(remaining.state, "READY");
  assert.equal(remaining.action, "RECONCILIATION_REQUIRED");
  assert.deepEqual(remaining.reasons, ["PATH_OVERLAP", "RECONCILIATION_REQUIRED"]);
});

test("priority defaults to five, accepts the inclusive integer range, and rejects invalid values", () => {
  assert.equal(handoff().priorityLevel, 5);
  for (let priorityLevel = 1; priorityLevel <= 10; priorityLevel += 1)
    assert.equal(handoff({ priorityLevel }).priorityLevel, priorityLevel);
  for (const priorityLevel of [0, -1, 11, 1.5, "1", Number.NaN, null])
    assert.throws(() => handoff({ priorityLevel }), /PARALLEL_COORDINATOR_HANDOFF_PRIORITY_LEVEL_INVALID/u);
});

test("priority orders otherwise legal READY candidates while readyAt and PR preserve deterministic ties", () => {
  const early = handoff({
    project: "Early",
    pr: 20,
    candidateSha: sha("c"),
    priorityLevel: 5,
    readyAt: "2026-08-25T10:00:00Z",
  });
  const urgent = handoff({
    project: "Urgent",
    pr: 30,
    candidateSha: sha("d"),
    priorityLevel: 1,
    paths: ["src/urgent/"],
  });
  const sameTimeLowerPr = handoff({
    project: "Tie",
    pr: 10,
    candidateSha: sha("e"),
    priorityLevel: 5,
    paths: ["src/tie/"],
    readyAt: "2026-08-25T10:00:00Z",
  });
  const plan = coordinate({ handoffs: [early, urgent, sameTimeLowerPr] });
  assert.deepEqual(
    plan.readyOrder.map((candidate) => candidate.pr),
    [30, 10, 20],
  );
});

test("priority wins over ordinary migration overlap while explicit dependencies still win", () => {
  const migrationFirst = handoff({
    project: "Migration first",
    pr: 10,
    candidateSha: sha("c"),
    migrationFamilies: ["core"],
  });
  const migrationUrgent = handoff({
    project: "Migration urgent",
    pr: 20,
    candidateSha: sha("d"),
    priorityLevel: 1,
    paths: ["src/other/"],
    migrationFamilies: ["core"],
  });
  const prerequisite = handoff({
    project: "Prerequisite",
    pr: 30,
    candidateSha: sha("e"),
    priorityLevel: 5,
    paths: ["src/prerequisite/"],
  });
  const dependentUrgent = handoff({
    project: "Dependent urgent",
    pr: 40,
    candidateSha: sha("f"),
    priorityLevel: 1,
    paths: ["src/dependent/"],
    dependencies: [30],
  });
  const plan = coordinate({ handoffs: [migrationUrgent, dependentUrgent, prerequisite, migrationFirst] });
  assert.deepEqual(
    plan.readyOrder.map((candidate) => candidate.pr),
    [20, 10, 30],
  );
  assert.equal(plan.candidates.find((candidate) => candidate.pr === 20).state, "READY");
  assert.equal(plan.candidates.find((candidate) => candidate.pr === 40).state, "WAITING");
});

test("ordinary overlap cannot keep a P1 candidate behind a P5 candidate", () => {
  const p5 = handoff({
    project: "P5",
    pr: 5,
    candidateSha: sha("c"),
    priorityLevel: 5,
    paths: ["src/shared/"],
  });
  const p1 = handoff({
    project: "P1",
    pr: 1,
    candidateSha: sha("d"),
    priorityLevel: 1,
    paths: ["src/shared/component.ts"],
  });
  const plan = coordinate({ handoffs: [p5, p1] });
  assert.deepEqual(
    plan.readyOrder.map((candidate) => [candidate.pr, candidate.seat]),
    [
      [1, 1],
      [5, 2],
    ],
  );
});

test("an explicit dependency keeps a P5 prerequisite ahead of an overlapping P1 candidate", () => {
  const p5 = handoff({
    project: "P5 prerequisite",
    pr: 5,
    candidateSha: sha("c"),
    priorityLevel: 5,
    paths: ["src/shared/"],
  });
  const p1 = handoff({
    project: "P1 dependent",
    pr: 1,
    candidateSha: sha("d"),
    priorityLevel: 1,
    paths: ["src/shared/component.ts"],
    dependencies: [5],
  });
  const plan = coordinate({ handoffs: [p5, p1] });
  assert.deepEqual(
    plan.readyOrder.map((candidate) => candidate.pr),
    [5],
  );
  assert.deepEqual(plan.candidates.find((candidate) => candidate.pr === 1).reasons, ["DEPENDENCY_PENDING:PR#5"]);
});

test("the Admiralty, Drydock, and Confluence field case keeps overlaps in the two-seat queue", () => {
  const baseSha = sha("b");
  const admiralty = handoff({
    project: "Admiralty",
    pr: 88,
    candidateSha: sha("c"),
    baseSha,
    priorityLevel: 5,
    paths: ["prisma/", "src/community/", "Development_Docs/", "package.json"],
  });
  const drydock = handoff({
    project: "Drydock",
    pr: 198,
    candidateSha: sha("d"),
    baseSha,
    priorityLevel: 5,
    paths: ["prisma/", "src/community/", "Development_Docs/", "package.json"],
  });
  const confluence = handoff({
    project: "Confluence",
    pr: 211,
    candidateSha: sha("e"),
    baseSha,
    priorityLevel: 5,
    paths: ["Development_Docs/", "package.json"],
  });
  const initial = coordinate({ handoffs: [confluence, drydock, admiralty], mainSha: baseSha });
  assert.deepEqual(
    initial.readyOrder.map((candidate) => [candidate.pr, candidate.seat, candidate.action]),
    [
      [88, 1, "FINALIZE_NEXT"],
      [198, 2, "WARM_STANDBY"],
      [211, 3, "HOLD"],
    ],
  );
  assert.equal(
    initial.candidates.some((candidate) => candidate.state === "WAITING"),
    false,
  );

  const afterAdmiraltyMerge = evaluateAfterMerge({
    handoffs: [admiralty, drydock, confluence],
    mergeSha: sha("f"),
    mergedPr: 88,
    mainSha: sha("f"),
    mergedPaths: ["prisma/schema.prisma", "src/community/feed.ts"],
  });
  assert.deepEqual(
    afterAdmiraltyMerge.readyOrder.map((candidate) => [candidate.pr, candidate.seat, candidate.action]),
    [
      [198, 1, "RECONCILIATION_REQUIRED"],
      [211, 2, "WARM_STANDBY"],
    ],
  );
  assert.equal(afterAdmiraltyMerge.candidates.find((candidate) => candidate.pr === 198).state, "READY");
  assert.equal(afterAdmiraltyMerge.candidates.find((candidate) => candidate.pr === 211).state, "READY");
});

test("an ACTIVE urgent project has no READY queue seat", () => {
  const active = handoff({
    project: "Active urgent",
    pr: 1,
    candidateSha: sha("c"),
    priorityLevel: 1,
    status: "ACTIVE",
  });
  const ready = handoff({ project: "Ready", pr: 2, candidateSha: sha("d"), paths: ["src/ready/"] });
  const plan = coordinate({ handoffs: [active, ready] });
  assert.equal(plan.candidates.find((candidate) => candidate.pr === 1).seat, undefined);
  assert.deepEqual(
    plan.readyOrder.map((candidate) => [candidate.pr, candidate.seat, candidate.action]),
    [[2, 1, "FINALIZE_NEXT"]],
  );
});

test("the active window assigns finalization, warm standby, then HOLD", () => {
  const candidates = [
    handoff({ project: "One", pr: 1, candidateSha: sha("c"), paths: ["src/one/"] }),
    handoff({ project: "Two", pr: 2, candidateSha: sha("d"), paths: ["src/two/"] }),
    handoff({ project: "Three", pr: 3, candidateSha: sha("e"), paths: ["src/three/"] }),
  ];
  const plan = coordinate({ handoffs: candidates });
  assert.deepEqual(
    plan.readyOrder.map((candidate) => [candidate.seat, candidate.action]),
    [
      [1, "FINALIZE_NEXT"],
      [2, "WARM_STANDBY"],
      [3, "HOLD"],
    ],
  );
});

test("a frozen candidate ignores accumulated movement until promotion into Seat 2", () => {
  const candidates = [
    handoff({ project: "One", pr: 1, candidateSha: sha("c"), paths: ["src/one/"] }),
    handoff({ project: "Two", pr: 2, candidateSha: sha("d"), paths: ["src/two/"] }),
    handoff({ project: "Three", pr: 3, candidateSha: sha("e"), paths: ["src/three/"] }),
    handoff({ project: "Four", pr: 4, candidateSha: sha("f"), paths: ["src/four/"] }),
  ];
  const frozen = coordinate({
    handoffs: candidates,
    changedPathsByPr: { 3: ["src/three/current.ts"], 4: ["src/four/current.ts"] },
  });
  assert.equal(frozen.candidates.find((candidate) => candidate.pr === 3).action, "HOLD");
  assert.equal(
    frozen.candidates.find((candidate) => candidate.pr === 3).reasons.includes("RECONCILIATION_REQUIRED"),
    false,
  );
  const promoted = coordinate({
    handoffs: candidates,
    prStates: { 1: { state: "MERGED" }, 2: { state: "MERGED" } },
    changedPathsByPr: { 4: ["src/four/current.ts"] },
  });
  assert.deepEqual(
    promoted.readyOrder.map((candidate) => [candidate.pr, candidate.seat, candidate.action]),
    [
      [3, 1, "FINALIZE_NEXT"],
      [4, 2, "WARM_RECONCILE"],
    ],
  );
});

test("accumulated unrelated movement leaves warm standby alone", () => {
  const first = handoff({ project: "First", pr: 1, candidateSha: sha("c"), priorityLevel: 1, paths: ["src/first/"] });
  const second = handoff({
    project: "Second",
    pr: 2,
    candidateSha: sha("d"),
    priorityLevel: 2,
    paths: ["src/second/"],
  });
  const plan = coordinate({ handoffs: [first, second], changedPathsByPr: { 2: ["src/unrelated/file.ts"] } });
  assert.equal(plan.candidates.find((candidate) => candidate.pr === 2).action, "WARM_STANDBY");
});

test("a warmed standby only has final reconciliation after a materially overlapping preceding merge", () => {
  const first = handoff({ project: "First", pr: 1, candidateSha: sha("c"), paths: ["src/first/"] });
  const second = handoff({ project: "Second", pr: 2, candidateSha: sha("d"), paths: ["src/second/"] });
  const unrelated = evaluateAfterMerge({
    handoffs: [first, second],
    mergeSha: sha("e"),
    mergedPr: 1,
    mergedPaths: ["src/unrelated/file.ts"],
  });
  assert.equal(unrelated.candidates.find((candidate) => candidate.pr === 2).action, "FINALIZE_NEXT");
  const overlapping = evaluateAfterMerge({
    handoffs: [first, second],
    mergeSha: sha("e"),
    mergedPr: 1,
    mergedPaths: ["src/second/file.ts"],
  });
  assert.equal(overlapping.candidates.find((candidate) => candidate.pr === 2).action, "RECONCILIATION_REQUIRED");
});

test("priority promotion can jump a cold candidate to Seat 1 and request currentness reconciliation", () => {
  const a = handoff({ project: "A", pr: 1, candidateSha: sha("c"), paths: ["src/a/"] });
  const b = handoff({ project: "B", pr: 2, candidateSha: sha("d"), paths: ["src/b/"] });
  const promoted = handoff({
    project: "Promoted",
    pr: 3,
    candidateSha: sha("e"),
    priorityLevel: 1,
    paths: ["src/promoted/"],
  });
  const plan = coordinate({ handoffs: [a, b, promoted], changedPathsByPr: { 3: ["src/promoted/current.ts"] } });
  assert.deepEqual(
    plan.readyOrder.map((candidate) => candidate.pr),
    [3, 1, 2],
  );
  assert.equal(plan.readyOrder[0].action, "RECONCILIATION_REQUIRED");
  assert.equal(plan.readyOrder[2].action, "HOLD");
});

test("priority reordering among frozen candidates leaves them on HOLD", () => {
  const first = handoff({ project: "First", pr: 1, candidateSha: sha("c"), priorityLevel: 1, paths: ["src/first/"] });
  const second = handoff({
    project: "Second",
    pr: 2,
    candidateSha: sha("d"),
    priorityLevel: 2,
    paths: ["src/second/"],
  });
  const third = handoff({ project: "Third", pr: 3, candidateSha: sha("e"), paths: ["src/third/"] });
  const fourthUrgent = handoff({
    project: "Fourth",
    pr: 4,
    candidateSha: sha("f"),
    priorityLevel: 4,
    paths: ["src/fourth/"],
  });
  const plan = coordinate({
    handoffs: [first, second, third, fourthUrgent],
    changedPathsByPr: { 3: ["src/third/current.ts"], 4: ["src/fourth/current.ts"] },
  });
  assert.deepEqual(
    plan.readyOrder.map((candidate) => candidate.pr),
    [1, 2, 4, 3],
  );
  assert.equal(plan.candidates.find((candidate) => candidate.pr === 3).action, "HOLD");
  assert.equal(plan.candidates.find((candidate) => candidate.pr === 4).action, "HOLD");
});

test("priority changes outside the window do not spend reconciliation work and demotion preserves a warmed candidate", () => {
  const first = handoff({ project: "First", pr: 1, candidateSha: sha("c"), paths: ["src/first/"] });
  const warmed = handoff({ project: "Warmed", pr: 2, candidateSha: sha("d"), paths: ["src/warmed/"] });
  const third = handoff({ project: "Third", pr: 3, candidateSha: sha("e"), paths: ["src/third/"] });
  const initial = coordinate({ handoffs: [first, warmed, third], changedPathsByPr: { 2: ["src/warmed/current.ts"] } });
  assert.equal(initial.candidates.find((candidate) => candidate.pr === 2).action, "WARM_RECONCILE");
  const urgent = handoff({
    project: "Urgent",
    pr: 4,
    candidateSha: sha("f"),
    priorityLevel: 1,
    paths: ["src/urgent/"],
  });
  const demoted = coordinate({
    handoffs: [first, warmed, third, urgent],
    changedPathsByPr: { 2: ["src/warmed/current.ts"], 3: ["src/third/current.ts"] },
  });
  assert.equal(demoted.candidates.find((candidate) => candidate.pr === 2).action, "HOLD");
  assert.equal(demoted.candidates.find((candidate) => candidate.pr === 3).action, "HOLD");
});

test("a stale live PR head is blocked before it can receive an actionable seat", () => {
  const stale = handoff({ project: "Stale", pr: 1, candidateSha: sha("c"), paths: ["src/stale/"] });
  const fresh = handoff({ project: "Fresh", pr: 2, candidateSha: sha("d"), paths: ["src/fresh/"] });
  const plan = coordinate({
    handoffs: [stale, fresh],
    prStates: { 1: { state: "OPEN", headRefOid: sha("e") }, 2: { state: "OPEN", headRefOid: sha("d") } },
  });
  const staleResult = plan.candidates.find((candidate) => candidate.pr === 1);
  assert.deepEqual([staleResult.state, staleResult.reasons], ["BLOCKED", ["HANDOFF_STALE_PR_HEAD"]]);
  assert.deepEqual(
    plan.readyOrder.map((candidate) => [candidate.pr, candidate.seat]),
    [[2, 1]],
  );
});

test("an already-finalizing Seat 1 is not preempted by a later priority change", () => {
  const finalizing = handoff({
    project: "Finalizing",
    pr: 1,
    candidateSha: sha("c"),
    priorityLevel: 5,
    paths: ["src/finalizing/"],
  });
  const urgent = handoff({
    project: "Urgent",
    pr: 2,
    candidateSha: sha("d"),
    priorityLevel: 1,
    paths: ["src/urgent/"],
  });
  const plan = coordinate({
    handoffs: [finalizing, urgent],
    finalizingPr: 1,
    changedPathsByPr: { 1: ["src/finalizing/current.ts"] },
  });
  assert.deepEqual(
    plan.readyOrder.map((candidate) => [candidate.pr, candidate.seat, candidate.action]),
    [
      [1, 1, "FINALIZE_NEXT"],
      [2, 2, "WARM_STANDBY"],
    ],
  );
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
