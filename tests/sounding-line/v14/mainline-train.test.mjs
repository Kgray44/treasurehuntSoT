import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
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
import {
  freshTrainWorkerNodes,
  mapBounded,
  movePreparedNodeModules,
  prepareMainlineTrain,
} from "../../../scripts/sounding-line/v14/mainline-train-prepare.mjs";
import { mergeTrainQualifications } from "../../../scripts/sounding-line/v14/merge-train-qualifications.mjs";

const root = process.cwd();

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

test("bounded train preparation runs independent work without changing frozen order", async () => {
  const starts = [];
  let active = 0;
  let peak = 0;
  const result = await mapBounded(["A", "B", "C"], 2, async (id, index) => {
    starts.push(id);
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, index === 0 ? 20 : 5));
    active -= 1;
    return `${id}:${index}`;
  });
  assert.equal(peak, 2);
  assert.deepEqual(result, ["A:0", "B:1", "C:2"]);
  assert.deepEqual(starts.slice(0, 2), ["A", "B"]);
  await assert.rejects(() => mapBounded(["A"], 0, async () => "A"), /TRAIN_PREPARE_CONCURRENCY_INVALID/u);
});

test("prepared train layers copy only when a hosted cross-volume move is impossible", async () => {
  const calls = [];
  await movePreparedNodeModules({
    source: "C:/runner-temp/pr-126/node_modules",
    destination: "D:/workspace/train-prepared/node_modules",
    renameFn: async () => {
      const error = new Error("cross-device link");
      error.code = "EXDEV";
      throw error;
    },
    copyFn: async (source, destination, options) => calls.push({ source, destination, options }),
  });
  assert.deepEqual(calls, [
    {
      source: "C:/runner-temp/pr-126/node_modules",
      destination: "D:/workspace/train-prepared/node_modules",
      options: { recursive: true, errorOnExist: true, preserveTimestamps: true, verbatimSymlinks: true },
    },
  ]);
  await assert.rejects(
    movePreparedNodeModules({
      source: "source",
      destination: "destination",
      renameFn: async () => {
        const error = new Error("permission denied");
        error.code = "EACCES";
        throw error;
      },
    }),
    /permission denied/u,
  );
});

test("train command-line entrypoints execute when invoked through a relative hosted path", async () => {
  for (const script of [
    "scripts/sounding-line/v14/mainline-train-prepare.mjs",
    "scripts/sounding-line/v14/merge-train-qualifications.mjs",
  ]) {
    await assert.rejects(
      execute(process.execPath, [script, "--train", "missing-train-input.json", "--repo", ".", "--out", "unused.json"]),
      /ENOENT|TRAIN_QUALIFICATION_MERGE_BASE_REQUIRED/u,
    );
  }
});

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
  const merged = mergeTrainQualifications({
    base: { train: state, predicted: { status: "READY", immutable: true } },
    states: state.cars.map(qualify),
    timestamp: at,
  });
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

test("qualification CLI consumes an unchanged sealed admission artifact", async (t) => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "sl14-train-cli-envelope-"));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const state = planned([candidate("A", "a")]);
  const car = state.cars[0];
  const plan = {
    authorityBoundary: "V14_CANDIDATE_QUALIFICATION",
    authorityMode: "V14_CANDIDATE",
    gate: "mainline",
    sourceSha: car.candidateHeadCommitSha,
    qualifiedBaseSha: car.predictedParentCommitSha,
    qualifiedBaseTreeSha: car.predictedParentTreeSha,
    predictedIntegrationTreeSha: car.predictedIntegrationTreeSha,
    planDigest: "sealed-envelope-plan",
  };
  const envelope = path.join(workspace, "mainline-train.json");
  const planPath = path.join(workspace, "plan.json");
  const finalizationPath = path.join(workspace, "finalization.json");
  const output = path.join(workspace, "qualified.json");
  await Promise.all([
    writeFile(envelope, `${JSON.stringify({ train: state, predicted: { status: "READY" } })}\n`),
    writeFile(planPath, `${JSON.stringify(plan)}\n`),
    writeFile(finalizationPath, `${JSON.stringify({ decision: "RELEASE_GO", planDigest: plan.planDigest })}\n`),
  ]);
  await execute(process.execPath, [
    "scripts/sounding-line/v14/mainline-train-cli.mjs",
    "qualify",
    "--state",
    envelope,
    "--plan",
    planPath,
    "--finalization",
    finalizationPath,
    "--candidate-id",
    "A",
    "--evidence-closure",
    "sealed-envelope-evidence",
    "--out",
    output,
  ]);
  const qualified = JSON.parse(await readFile(output, "utf8"));
  assert.ok(verifyTrain(qualified).valid);
  assert.equal(qualified.cars[0].state, "QUALIFIED");
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
        selectionLedger: [{ suiteId: "unit", selected: true, evidenceDisposition: "FRESH" }],
      }),
      dependencyLayerInputsFn: async () => ({ packageLockDigest: "fixture" }),
      prepareLayerFn: async ({ destination }) => {
        await mkdir(path.join(destination, "node_modules"), { recursive: true });
        await writeFile(path.join(destination, "dependency-manifest.json"), "{}\n");
      },
    });
    assert.equal(matrix.include.length, 1);
    assert.equal(matrix.cars[0].activeMaximumWave, 0);
    await execute("git", ["clone", "--no-checkout", root, receiver]);
    // Hosted workers receive the frozen candidate and its immediate trusted
    // base before fetching the compact predicted-integration transport.
    await git(receiver, "fetch", "--depth", "2", "origin", "candidate-a");
    const predicted = admitted.predicted.cars[0].resultingIntegrationSha;
    await git(receiver, "fetch", path.join(out, "A", "integration.bundle"), predicted);
    assert.equal(await git(receiver, "rev-parse", "FETCH_HEAD"), predicted);
    assert.ok((await stat(path.join(out, "A", "integration.bundle"))).size > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("train preparation reads the planner selection ledger and fails closed before dependency preparation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sl14-train-ledger-"));
  const out = path.join(root, "prepared");
  try {
    await git(root, "init");
    await git(root, "config", "user.email", "sounding-line@example.invalid");
    await git(root, "config", "user.name", "Sounding Line");
    await writeFile(path.join(root, "base.txt"), "base\n");
    await git(root, "add", ".");
    await git(root, "commit", "-m", "base");
    const base = await git(root, "rev-parse", "HEAD");
    await git(root, "checkout", "-b", "candidate-ledger");
    await writeFile(path.join(root, "candidate.txt"), "candidate\n");
    await git(root, "add", ".");
    await git(root, "commit", "-m", "candidate");
    const head = await git(root, "rev-parse", "HEAD");
    const headTree = await git(root, "rev-parse", "HEAD^{tree}");
    const admitted = await admitLiveMainlineTrain({
      repoPath: root,
      trainId: "ledger-train",
      authorityIdentity: "authority-v14",
      policyIdentity: "policy-v14",
      admissionPolicyIdentity: "admission-v14",
      mergeStrategyIdentity: "git-merge-tree-write-tree",
      actualMainCommitSha: base,
      candidates: [candidate("L", "l", { headCommitSha: head, headTreeSha: headTree, admissionOrdinal: 1 })],
      createdAt: at,
    });
    const plan =
      ({ selectionLedger }) =>
      async ({ sourceSha, qualifiedBaseSha, predictedIdentity }) => ({
        authorityBoundary: "V14_CANDIDATE_QUALIFICATION",
        authorityMode: "V14_CANDIDATE",
        gate: "mainline",
        sourceSha,
        qualifiedBaseSha,
        qualifiedBaseTreeSha: predictedIdentity.predictedParentTreeSha,
        predictedIntegrationTreeSha: predictedIdentity.predictedIntegrationTreeSha,
        planDigest: "prepared-plan-ledger",
        nodes: [{ id: "preserved", execution: { wave: 0, mode: "parallel" } }],
        selectionLedger,
      });
    for (const [selectionLedger, expected] of [
      [undefined, /TRAIN_SELECTION_LEDGER_REQUIRED:L/],
      [[], /TRAIN_PLAN_NODE_UNDECLARED:L:preserved/],
      [
        [{ suiteId: "preserved", selected: false, evidenceDisposition: "PRESERVED" }],
        /TRAIN_PLAN_NODE_NOT_FRESH:L:preserved/,
      ],
      [
        [{ suiteId: "preserved", selected: false, evidenceDisposition: "FRESH" }],
        /TRAIN_PLAN_NODE_NOT_FRESH:L:preserved/,
      ],
    ]) {
      let prepared = false;
      await assert.rejects(
        prepareMainlineTrain({
          state: admitted,
          out,
          repoPath: root,
          temporaryRoot: path.join(root, "temporary-worktrees"),
          buildPlanFn: plan({ selectionLedger }),
          dependencyLayerInputsFn: async () => ({ packageLockDigest: "fixture" }),
          prepareLayerFn: async () => {
            prepared = true;
          },
        }),
        expected,
      );
      assert.equal(prepared, false);
    }
    assert.deepEqual(
      freshTrainWorkerNodes(
        {
          nodes: [{ id: "fresh", execution: { wave: 0, mode: "parallel" } }],
          selectionLedger: [{ suiteId: "fresh", selected: true, evidenceDisposition: "FRESH" }],
        },
        "L",
      ).map((node) => node.id),
      ["fresh"],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("hosted train finalization is partitioned by each car's active dependency depth", async () => {
  const workflow = await readFile(path.join(root, ".github", "workflows", "sounding-line-mainline-train.yml"), "utf8");
  const finalizer = await readFile(
    path.join(root, ".github", "workflows", "sounding-line-train-finalize-cars.yml"),
    "utf8",
  );
  assert.match(workflow, /finalization\$wave/u);
  assert.match(workflow, /finalize-cars-wave-0:[\s\S]*?needs: \[admit, wave-0\]/u);
  assert.match(workflow, /finalize-cars-wave-5:[\s\S]*?needs: \[admit, wave-5\]/u);
  assert.match(workflow, /merge-qualifications:[\s\S]*?finalize-cars-wave-0/u);
  assert.match(finalizer, /matrix\.position == 0/u);
  assert.match(finalizer, /Make a qualified head independently landing-ready/u);
  assert.match(finalizer, /sounding-line-mainline-train-head-live/u);
  assert.match(finalizer, /TRAIN_PER_CAR_FINALIZATION_FAILED/u);
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
