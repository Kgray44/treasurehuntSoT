import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  applyPolicyDrift,
  replanAfterMaintenanceAuthorityChange,
  compareLandedTree,
  createMainlineTrain,
  detectMigrationCollisions,
  evaluateTrainMigrations,
  loadTrainState,
  mutateTrainCandidate,
  orderTrainCandidates,
  persistTrainState,
  planMainlineTrain,
  preemptTrain,
  reconcileExternalMain,
  revokeTrainEvidence,
  transitionTrainCar,
  verifyTrain,
  withdrawTrainCandidate,
} from "../../../scripts/sounding-line/v14/mainline-train.mjs";

const sha = (letter) => (({ m: "a", n: "b", z: "c", q: "d", r: "e", x: "f" })[letter] ?? letter).repeat(40);
const at = "2026-08-13T12:00:00.000Z";
const candidate = (id, letter, overrides = {}) => ({
  candidateId: id,
  headCommitSha: sha(letter),
  headTreeSha: sha(letter.toUpperCase().toLowerCase()),
  admissionPolicyIdentity: "admission-v1",
  admittedAt: at,
  admissionOrdinal: id.charCodeAt(0),
  ageCycles: 0,
  ...overrides,
});
const integrator = ({ parentTreeSha, candidateTreeSha, position }) => ({
  treeSha: position === 0 ? candidateTreeSha : `${parentTreeSha.slice(0, 39)}${candidateTreeSha.at(-1)}`,
  commitSha: sha(String((position + 1) % 10)),
});
const train = (candidates = [candidate("A", "a"), candidate("B", "b"), candidate("C", "c")]) =>
  createMainlineTrain({
    trainId: "train-1",
    authorityIdentity: "v1.4-shadow",
    policyIdentity: "policy-1",
    admissionPolicyIdentity: "admission-v1",
    mergeStrategyIdentity: "merge-tree",
    actualMainCommitSha: sha("m"),
    actualMainTreeSha: sha("n"),
    candidates,
    createdAt: at,
  });
const planned = (candidates) => planMainlineTrain(train(candidates), { integrate: integrator, timestamp: at });

test("deterministic ordering, frozen identity, and narrow record-only admission fail closed", () => {
  const input = [candidate("B", "b", { admissionOrdinal: 2 }), candidate("A", "a", { admissionOrdinal: 1 })];
  assert.deepEqual(
    orderTrainCandidates(input).map((item) => item.candidateId),
    ["A", "B"],
  );
  assert.throws(() => orderTrainCandidates([candidate("R", "r", { priorityClass: "RECORD_ONLY" })]), /RECORD_ONLY/);
  assert.throws(() => orderTrainCandidates([candidate("X", "x", { headCommitSha: "branch-name" })]), /FROZEN_HEAD/);
});

test("synthetic planning is deterministic and conflicts brake only the affected suffix", () => {
  const one = planned();
  const two = planned();
  assert.deepEqual(
    one.cars.map((car) => car.predictedIntegrationTreeSha),
    two.cars.map((car) => car.predictedIntegrationTreeSha),
  );
  const conflict = planMainlineTrain(train(), {
    integrate: (input) =>
      input.position === 1 ? { conflict: true, conflictingPaths: ["prisma/migration.sql"] } : integrator(input),
    timestamp: at,
  });
  assert.equal(conflict.cars[0].state, "QUALIFIED");
  assert.equal(conflict.cars[1].state, "BLOCKED");
  assert.equal(conflict.cars[2].state, "BLOCKED");
});

test("landed equality accepts different commits with equal trees and hard-brakes all mismatch forms", () => {
  const state = planned();
  const car = state.cars[0];
  assert.equal(
    compareLandedTree(state, {
      position: 0,
      actualLandedCommitSha: sha("z"),
      actualLandedTreeSha: car.predictedIntegrationTreeSha,
      mergeStrategyIdentity: "merge-tree",
      timestamp: at,
    }).result,
    "MATCH",
  );
  for (const args of [
    { actualLandedCommitSha: sha("z"), actualLandedTreeSha: sha("q"), mergeStrategyIdentity: "merge-tree" },
    { actualLandedCommitSha: sha("z"), actualLandedTreeSha: null, mergeStrategyIdentity: "merge-tree" },
    {
      actualLandedCommitSha: sha("z"),
      actualLandedTreeSha: car.predictedIntegrationTreeSha,
      mergeStrategyIdentity: "squash",
    },
    {
      actualLandedCommitSha: sha("z"),
      actualLandedTreeSha: car.predictedIntegrationTreeSha,
      mergeStrategyIdentity: "merge-tree",
      generation: 99,
    },
  ])
    assert.equal(compareLandedTree(state, { position: 0, timestamp: at, ...args }).result, "BRAKE");
});

test("head, middle, final mutation and withdrawals preserve the valid prefix", () => {
  const state = planned();
  const head = mutateTrainCandidate(state, {
    candidateId: "A",
    replacement: candidate("A", "d"),
    timestamp: at,
    integrate: integrator,
  });
  assert.equal(head.generation, 1);
  assert.equal(head.cars[0].candidateHeadCommitSha, sha("d"));
  const middle = mutateTrainCandidate(state, {
    candidateId: "B",
    replacement: candidate("B", "d"),
    timestamp: at,
    integrate: integrator,
  });
  assert.equal(middle.cars[0].candidateHeadCommitSha, sha("a"));
  assert.equal(middle.cars[1].candidateHeadCommitSha, sha("d"));
  const final = withdrawTrainCandidate(state, { candidateId: "C", timestamp: at, integrate: integrator });
  assert.equal(final.cars.length, 2);
  assert.equal(final.cars[0].candidateHeadCommitSha, sha("a"));
  const first = withdrawTrainCandidate(state, { candidateId: "A", timestamp: at, integrate: integrator });
  assert.equal(first.cars[0].candidateId, "B");
  assert.throws(
    () =>
      withdrawTrainCandidate(
        { ...state, cars: [{ ...state.cars[0], state: "LANDED" }] },
        { candidateId: "A", timestamp: at },
      ),
    /LANDED/,
  );
});

test("head failure, evidence revocation, policy drift, and illegal landing transitions fail closed", () => {
  const state = planned();
  const revoked = revokeTrainEvidence(state, { candidateId: "B", evidenceIdentity: "receipt-b", timestamp: at });
  assert.equal(revoked.cars[0].state, "QUALIFIED");
  assert.equal(revoked.cars[1].state, "BLOCKED");
  const drift = applyPolicyDrift(state, { policyIdentity: "policy-2", earliestPosition: 1, timestamp: at });
  assert.equal(drift.cars[0].state, "QUALIFIED");
  assert.equal(drift.cars[1].state, "BLOCKED");
  assert.throws(
    () => transitionTrainCar(state, { position: 1, to: "LANDING", timestamp: at }),
    /STATE_TRANSITION|HEAD_ONLY/,
  );
  assert.throws(() => transitionTrainCar(state, { position: 0, to: "LANDED", timestamp: at }), /STATE_TRANSITION/);
});

test("an authority-changing maintenance car preserves its prefix and replans the downstream suffix", () => {
  const state = planned([
    candidate("M", "a", {
      priorityClass: "MAINTENANCE",
      maintenanceClassification: { valid: true },
      authorityChanging: true,
    }),
    candidate("B", "b"),
    candidate("C", "c"),
  ]);
  const replanned = replanAfterMaintenanceAuthorityChange(state, {
    candidateId: "M",
    authorityIdentity: "v1.4.1",
    policyIdentity: "policy-v1.4.1",
    timestamp: at,
    integrate: integrator,
  });
  assert.equal(replanned.cars[0].candidateId, "M");
  assert.equal(replanned.cars[1].replanGeneration, 1);
  assert.equal(replanned.replans.at(-1).cause, "MAINTENANCE_AUTHORITY_CHANGE");
});

test("external main recognizes content-equivalent predictions and conservatively replans unexpected content", () => {
  const state = planned();
  const matched = reconcileExternalMain(state, {
    actualMainCommitSha: sha("z"),
    actualMainTreeSha: state.cars[0].predictedIntegrationTreeSha,
    timestamp: at,
    integrate: integrator,
  });
  assert.equal(matched.cars[0].state, "LANDED");
  const unexpected = reconcileExternalMain(state, {
    actualMainCommitSha: sha("z"),
    actualMainTreeSha: sha("q"),
    timestamp: at,
    integrate: integrator,
  });
  assert.equal(unexpected.generation, 1);
  assert.equal(unexpected.replans[0].cause, "EXTERNAL_MAIN_UNEXPECTED");
});

test("migration collision, emergency preemption, and persistence/restart/tamper checks are explicit", async () => {
  assert.equal(
    detectMigrationCollisions([
      { candidateId: "A", migrations: [{ id: "0001" }] },
      { candidateId: "B", migrations: [{ id: "0001" }] },
    ]).safe,
    false,
  );
  assert.equal(
    detectMigrationCollisions([
      { candidateId: "A", migrations: [{ id: "0001" }] },
      { candidateId: "B", migrations: [{ id: "0002" }] },
    ]).safe,
    true,
  );
  const collisionState = planned([
    candidate("A", "a", { migrations: [{ id: "0001" }] }),
    candidate("B", "b", { migrations: [{ id: "0001" }] }),
  ]);
  assert.equal(evaluateTrainMigrations(collisionState, { timestamp: at }).train.cars[0].state, "BLOCKED");
  const emergency = preemptTrain(planned(), {
    emergencyCandidate: candidate("E", "e", { priorityClass: "EMERGENCY" }),
    timestamp: at,
    integrate: integrator,
  });
  assert.equal(emergency.cars[0].candidateId, "E");
  assert.equal(emergency.audit.at(-1).kind, "EMERGENCY_PREEMPTION");
  const root = await mkdtemp(path.join(os.tmpdir(), "sl14-train-"));
  try {
    const persisted = await persistTrainState(root, emergency);
    assert.equal(verifyTrain(await loadTrainState(persisted.file)).valid, true);
    assert.equal((await loadTrainState(persisted.file)).cars[0].candidateId, "E");
    await writeFile(persisted.file, "{}\n");
    await assert.rejects(loadTrainState(persisted.file), /TAMPERED_STATE/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
