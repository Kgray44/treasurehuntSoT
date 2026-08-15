import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import {
  applyPolicyDrift,
  admitLiveMainlineTrain,
  compareLandedTree,
  createMainlineTrain,
  detectMigrationCollisions,
  evaluateTrainMigrations,
  loadTrainState,
  landTrainHead,
  mutateTrainCandidate,
  orderTrainCandidates,
  persistTrainState,
  planMainlineTrain,
  preemptTrain,
  reconcileExternalMain,
  revokeTrainEvidence,
  qualifyTrainCar,
  transitionTrainCar,
  V14_TRAIN_AUTHORITY_BOUNDARY,
  verifyTrain,
  withdrawTrainCandidate,
} from "../../../scripts/sounding-line/v14/mainline-train.mjs";
import { prepareMainlineTrain } from "../../../scripts/sounding-line/v14/mainline-train-prepare.mjs";
import { mergeTrainQualifications } from "../../../scripts/sounding-line/v14/merge-train-qualifications.mjs";

const sha = (letter) => (({ m: "a", n: "b", z: "c", q: "d", r: "e", x: "f" })[letter] ?? letter).repeat(40);
const execute = promisify(execFile);
const git = async (cwd, ...args) => (await execute("git", args, { cwd })).stdout.trim();
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
  assert.equal(train().authorityBoundary, V14_TRAIN_AUTHORITY_BOUNDARY);
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
  assert.equal(conflict.cars[0].state, "PLANNING");
  assert.equal(conflict.cars[1].state, "BLOCKED");
  assert.equal(conflict.cars[2].state, "BLOCKED");
});

test("only an exact V14_CANDIDATE RELEASE_GO qualifies a planned car and permits head landing", () => {
  const state = planned();
  const car = state.cars[0];
  const plan = {
    authorityBoundary: "V14_CANDIDATE_QUALIFICATION",
    authorityMode: "V14_CANDIDATE",
    gate: "mainline",
    sourceSha: car.candidateHeadCommitSha,
    qualifiedBaseSha: car.predictedParentCommitSha,
    qualifiedBaseTreeSha: car.predictedParentTreeSha,
    predictedIntegrationTreeSha: car.predictedIntegrationTreeSha,
    planDigest: "plan-a",
    semanticPlanDigest: "mses-a",
  };
  assert.throws(
    () =>
      qualifyTrainCar(state, {
        candidateId: "A",
        plan,
        finalization: { decision: "RELEASE_NO_GO" },
        evidenceClosureIdentity: "evidence-a",
        timestamp: at,
      }),
    /QUALIFICATION_IDENTITY_MISMATCH/,
  );
  const qualified = qualifyTrainCar(state, {
    candidateId: "A",
    plan,
    finalization: { decision: "RELEASE_GO", planDigest: "plan-a" },
    evidenceClosureIdentity: "evidence-a",
    timestamp: at,
  });
  assert.equal(qualified.cars[0].state, "QUALIFIED");
  assert.equal(qualified.cars[0].msesClosureIdentity, "mses-a");
  const headReady = transitionTrainCar(qualified, { position: 0, to: "HEAD_READY", timestamp: at });
  const landed = landTrainHead(headReady, {
    actualLandedCommitSha: sha("z"),
    actualLandedTreeSha: car.predictedIntegrationTreeSha,
    mergeStrategyIdentity: "merge-tree",
    timestamp: at,
    integrate: integrator,
  });
  assert.equal(landed.comparison.result, "MATCH");
  assert.equal(landed.train.cars[0].state, "LANDED");
  assert.equal(landed.train.cars[1].state, "PLANNING");
});

test("independently finalized cars merge into one complete head-ready train without a landing claim", () => {
  const state = planned();
  const qualify = (car) =>
    qualifyTrainCar(state, {
      candidateId: car.candidateId,
      plan: {
        authorityBoundary: "V14_CANDIDATE_QUALIFICATION",
        authorityMode: "V14_CANDIDATE",
        gate: "mainline",
        sourceSha: car.candidateHeadCommitSha,
        qualifiedBaseSha: car.predictedParentCommitSha,
        qualifiedBaseTreeSha: car.predictedParentTreeSha,
        predictedIntegrationTreeSha: car.predictedIntegrationTreeSha,
        planDigest: `plan-${car.candidateId}`,
      },
      finalization: { decision: "RELEASE_GO", planDigest: `plan-${car.candidateId}` },
      evidenceClosureIdentity: `evidence-${car.candidateId}`,
      timestamp: at,
    });
  const merged = mergeTrainQualifications({ base: state, states: state.cars.map(qualify), timestamp: at });
  assert.ok(verifyTrain(merged).valid);
  assert.equal(merged.status, "QUALIFIED");
  assert.ok(merged.cars.every((car) => car.state === "QUALIFIED"));
  const ready = transitionTrainCar(merged, { position: merged.headPosition, to: "HEAD_READY", timestamp: at });
  assert.equal(ready.cars[0].state, "HEAD_READY");
  assert.equal(ready.cars[1].state, "QUALIFIED");
  const advanced = landTrainHead(ready, {
    actualLandedCommitSha: sha("z"),
    actualLandedTreeSha: ready.cars[0].predictedIntegrationTreeSha,
    mergeStrategyIdentity: "merge-tree",
    timestamp: at,
    integrate: integrator,
  });
  assert.equal(advanced.comparison.result, "MATCH");
  assert.equal(advanced.train.cars[0].state, "LANDED");
  assert.equal(advanced.train.cars[1].state, "HEAD_READY");
  assert.equal(advanced.train.cars[2].state, "QUALIFIED");
  assert.equal(advanced.train.replans.length, 0);
  assert.ok(advanced.train.audit.some((entry) => entry.kind === "PREDICTED_PREFIX_REBOUND"));
});

test("live admission derives ordered predicted trees from real immutable Git heads", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sl14-live-train-"));
  try {
    await git(root, "init");
    await git(root, "config", "user.email", "sounding-line@example.invalid");
    await git(root, "config", "user.name", "Sounding Line");
    await writeFile(path.join(root, "base.txt"), "base\n");
    await git(root, "add", ".");
    await git(root, "commit", "-m", "base");
    const base = await git(root, "rev-parse", "HEAD");
    await git(root, "checkout", "-b", "candidate-a");
    await writeFile(path.join(root, "a.txt"), "a\n");
    await git(root, "add", ".");
    await git(root, "commit", "-m", "a");
    const a = await git(root, "rev-parse", "HEAD");
    const aTree = await git(root, "rev-parse", "HEAD^{tree}");
    await git(root, "checkout", base);
    await git(root, "checkout", "-b", "candidate-b");
    await writeFile(path.join(root, "b.txt"), "b\n");
    await git(root, "add", ".");
    await git(root, "commit", "-m", "b");
    const b = await git(root, "rev-parse", "HEAD");
    const bTree = await git(root, "rev-parse", "HEAD^{tree}");
    const result = await admitLiveMainlineTrain({
      repoPath: root,
      trainId: "live-train",
      authorityIdentity: "authority-v14",
      policyIdentity: "policy-v14",
      admissionPolicyIdentity: "admission-v14",
      mergeStrategyIdentity: "git-merge-tree-write-tree",
      actualMainCommitSha: base,
      candidates: [
        candidate("A", "a", { headCommitSha: a, headTreeSha: aTree, admissionOrdinal: 1 }),
        candidate("B", "b", { headCommitSha: b, headTreeSha: bTree, admissionOrdinal: 2 }),
      ],
      createdAt: at,
    });
    assert.equal(result.predicted.authorityBoundary, V14_TRAIN_AUTHORITY_BOUNDARY);
    assert.equal(
      result.train.cars[0].predictedIntegrationTreeSha,
      result.predicted.cars[0].predictedIntegrationTreeSha,
    );
    assert.equal(result.train.cars[1].predictedParentTreeSha, result.train.cars[0].predictedIntegrationTreeSha);
    assert.ok(result.train.cars.every((car) => car.state === "PLANNING"));
    await assert.rejects(
      admitLiveMainlineTrain({
        repoPath: root,
        trainId: "collision-train",
        authorityIdentity: "authority-v14",
        policyIdentity: "policy-v14",
        admissionPolicyIdentity: "admission-v14",
        mergeStrategyIdentity: "git-merge-tree-write-tree",
        actualMainCommitSha: base,
        candidates: [
          candidate("A", "a", { headCommitSha: a, headTreeSha: aTree, admissionOrdinal: 1, migrations: ["shared"] }),
          candidate("B", "b", { headCommitSha: b, headTreeSha: bTree, admissionOrdinal: 2, migrations: ["shared"] }),
        ],
        createdAt: at,
      }),
      /TRAIN_MIGRATION_COLLISION/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("per-car preparation seals plans and bundles the exact unreachable predicted integration commits", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sl14-train-prepare-"));
  const out = path.join(root, "prepared");
  const receiver = path.join(root, "receiver");
  try {
    await git(root, "init");
    await git(root, "config", "user.email", "sounding-line@example.invalid");
    await git(root, "config", "user.name", "Sounding Line");
    await writeFile(path.join(root, "base.txt"), "base\n");
    await git(root, "add", ".");
    await git(root, "commit", "-m", "base");
    const base = await git(root, "rev-parse", "HEAD");
    await git(root, "checkout", "-b", "candidate-a");
    await writeFile(path.join(root, "a.txt"), "a\n");
    await git(root, "add", ".");
    await git(root, "commit", "-m", "a");
    const a = await git(root, "rev-parse", "HEAD");
    const aTree = await git(root, "rev-parse", "HEAD^{tree}");
    const admitted = await admitLiveMainlineTrain({
      repoPath: root,
      trainId: "prepared-train",
      authorityIdentity: "authority-v14",
      policyIdentity: "policy-v14",
      admissionPolicyIdentity: "admission-v14",
      mergeStrategyIdentity: "git-merge-tree-write-tree",
      actualMainCommitSha: base,
      candidates: [candidate("A", "a", { headCommitSha: a, headTreeSha: aTree, admissionOrdinal: 1 })],
      createdAt: at,
    });
    const matrix = await prepareMainlineTrain({
      state: admitted,
      out,
      repoPath: root,
      temporaryRoot: path.join(root, "temporary-worktrees"),
      buildPlanFn: async ({ sourceSha, qualifiedBaseSha, predictedIdentity }) => ({
        authorityBoundary: "V14_CANDIDATE_QUALIFICATION",
        authorityMode: "V14_CANDIDATE",
        gate: "mainline",
        sourceSha,
        qualifiedBaseSha,
        qualifiedBaseTreeSha: predictedIdentity.predictedParentTreeSha,
        predictedIntegrationTreeSha: predictedIdentity.predictedIntegrationTreeSha,
        planDigest: "prepared-plan-a",
        nodes: [{ id: "unit", execution: { wave: 0, mode: "parallel" } }],
      }),
      dependencyLayerInputsFn: async () => ({ packageLockDigest: "fixture" }),
      prepareLayerFn: async ({ destination }) => {
        await mkdir(path.join(destination, "node_modules"), { recursive: true });
        await writeFile(path.join(destination, "dependency-manifest.json"), "{}\n");
      },
    });
    assert.equal(matrix.include.length, 1);
    await mkdir(receiver);
    await git(receiver, "init");
    const predicted = admitted.predicted.cars[0].resultingIntegrationSha;
    await git(receiver, "fetch", path.join(out, "A", "integration.bundle"), predicted);
    assert.equal(await git(receiver, "rev-parse", "FETCH_HEAD"), predicted);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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
  assert.equal(revoked.cars[0].state, "PLANNING");
  assert.equal(revoked.cars[1].state, "BLOCKED");
  const drift = applyPolicyDrift(state, { policyIdentity: "policy-2", earliestPosition: 1, timestamp: at });
  assert.equal(drift.cars[0].state, "PLANNING");
  assert.equal(drift.cars[1].state, "BLOCKED");
  assert.throws(
    () => transitionTrainCar(state, { position: 1, to: "LANDING", timestamp: at }),
    /STATE_TRANSITION|HEAD_ONLY/,
  );
  assert.throws(() => transitionTrainCar(state, { position: 0, to: "LANDED", timestamp: at }), /STATE_TRANSITION/);
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
  const affectedSuffix = reconcileExternalMain(state, {
    actualMainCommitSha: sha("z"),
    actualMainTreeSha: sha("q"),
    earliestAffectedPosition: 1,
    timestamp: at,
    integrate: integrator,
  });
  assert.equal(affectedSuffix.replans[0].cause, "EXTERNAL_MAIN_AFFECTED_SUFFIX");
  assert.equal(affectedSuffix.replans[0].preservedPrefix.length, 1);
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
