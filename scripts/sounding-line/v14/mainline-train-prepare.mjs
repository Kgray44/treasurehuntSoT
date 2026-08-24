#!/usr/bin/env node
/* Build per-car sealed execution inputs from one admitted live train. */
import { execFile } from "node:child_process";
import { cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { buildPlan } from "../planner.mjs";
import { batchPhysicalWorkers } from "./physical-worker-batching.mjs";
import { verifyTrain } from "./mainline-train.mjs";

const execute = promisify(execFile);
const candidateRefPattern = /^refs\/heads\/[A-Za-z0-9._/-]+$/u;
const admittedCandidateRef = (car) => {
  const candidateRef = car?.candidatePrIdentity?.ref;
  if (candidateRef === null || candidateRef === undefined || candidateRef === "")
    throw new Error("TRAIN_PREPARE_CANDIDATE_REF_REQUIRED");
  if (typeof candidateRef !== "string" || !candidateRefPattern.test(candidateRef))
    throw new Error("TRAIN_PREPARE_CANDIDATE_REF_INVALID");
  return candidateRef;
};
const value = (args, flag) => {
  const index = args.indexOf(flag);
  const result = index < 0 ? undefined : args[index + 1];
  if (!result) throw new Error(`TRAIN_PREPARE_${flag.slice(2).toUpperCase()}_REQUIRED`);
  return result;
};
export async function movePreparedNodeModules({ source, destination, renameFn = rename, copyFn = cp }) {
  try {
    await renameFn(source, destination);
  } catch (error) {
    if (error?.code !== "EXDEV") throw error;
    await copyFn(source, destination, {
      recursive: true,
      errorOnExist: true,
      preserveTimestamps: true,
      verbatimSymlinks: true,
    });
  }
}

export function freshTrainWorkerNodes(plan, candidateId) {
  if (!Array.isArray(plan?.selectionLedger)) throw new Error(`TRAIN_SELECTION_LEDGER_REQUIRED:${candidateId}`);
  const ledgerBySuite = new Map(plan.selectionLedger.map((entry) => [entry.suiteId, entry]));
  return plan.nodes.map((node) => {
    const disposition = ledgerBySuite.get(node.id);
    if (!disposition) throw new Error(`TRAIN_PLAN_NODE_UNDECLARED:${candidateId}:${node.id}`);
    // A conservative fallback deliberately schedules every affected obligation
    // for a new execution. It is therefore executable evidence, not preserved
    // evidence. Keep the preflight aligned with the finalizer's sealed
    // selection contract, which accepts FRESH and CONSERVATIVE_FALLBACK only.
    if (!disposition.selected || !["FRESH", "CONSERVATIVE_FALLBACK"].includes(disposition.evidenceDisposition))
      throw new Error(`TRAIN_PLAN_NODE_NOT_FRESH:${candidateId}:${node.id}`);
    return node;
  });
}

/**
 * Keep each predicted-car preparation isolated, while admitting bounded
 * parallelism for independent synthetic worktrees. The stable caller order is
 * restored after completion so concurrent preparation cannot affect train
 * order, matrix order, or bundle identities.
 */
export async function mapBounded(items, limit, mapper) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error("TRAIN_PREPARE_CONCURRENCY_INVALID");
  const output = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      output[index] = await mapper(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

export async function prepareMainlineTrain({
  state,
  out,
  repoPath,
  temporaryRoot = undefined,
  buildPlanFn = buildPlan,
  preparationConcurrency = 3,
}) {
  for (const car of state?.train?.cars ?? []) admittedCandidateRef(car);
  if (!verifyTrain(state.train).valid || state.predicted?.status !== "READY")
    throw new Error("TRAIN_PREPARE_STATE_INVALID");
  if (state.train.cars.length !== state.predicted.cars.length) throw new Error("TRAIN_PREPARE_CAR_COUNT_MISMATCH");
  await mkdir(out, { recursive: true });
  const root =
    temporaryRoot ??
    (await mkdir(path.join(os.tmpdir(), `sounding-line-train-${process.pid}`), { recursive: true }).then(() =>
      path.join(os.tmpdir(), `sounding-line-train-${process.pid}`),
    ));
  try {
    const preparedCars = await mapBounded(state.train.cars, preparationConcurrency, async (car, position) => {
      const predicted = state.predicted.cars[position];
      if (
        car.candidateHeadCommitSha !== predicted.sourceHeadSha ||
        car.predictedParentCommitSha !== predicted.predictedParentCommitSha ||
        car.predictedIntegrationTreeSha !== predicted.predictedIntegrationTreeSha
      )
        throw new Error("TRAIN_PREPARE_IDENTITY_MISMATCH");
      const candidateRef = admittedCandidateRef(car);
      const directory = path.join(out, car.candidateId);
      const worktree = path.join(root, car.candidateId);
      await mkdir(directory, { recursive: true });
      await execute("git", [
        "-C",
        repoPath,
        "worktree",
        "add",
        "--detach",
        worktree,
        predicted.resultingIntegrationSha,
      ]);
      try {
        const plan = await buildPlanFn({
          root: worktree,
          gateId: "mainline",
          sourceSha: car.candidateHeadCommitSha,
          qualifiedBaseSha: car.predictedParentCommitSha,
          authorityMode: "V14_CANDIDATE",
          githubRef: "refs/heads/main",
          candidateRef,
          predictedIdentity: {
            predictedParentCommitSha: car.predictedParentCommitSha,
            predictedParentTreeSha: car.predictedParentTreeSha,
            predictedIntegrationTreeSha: car.predictedIntegrationTreeSha,
          },
        });
        if (
          plan.authorityBoundary !== "V14_CANDIDATE_QUALIFICATION" ||
          plan.sourceSha !== car.candidateHeadCommitSha ||
          plan.predictedIntegrationTreeSha !== car.predictedIntegrationTreeSha
        )
          throw new Error("TRAIN_PREPARE_PLAN_IDENTITY_MISMATCH");
        if (plan.candidateRef !== candidateRef) throw new Error("TRAIN_PREPARE_CANDIDATE_REF_PLAN_MISMATCH");
        // The planner's sealed selection ledger is the authoritative worker
        // boundary. Preflight it before constructing the dependency layer so
        // a malformed plan cannot spend hosted preparation time before it is
        // rejected, and no preserved or undeclared obligation reaches a matrix.
        const workerNodes = freshTrainWorkerNodes(plan, car.candidateId);
        const activeMaximumWave = Math.max(...workerNodes.map((node) => node.execution.wave));
        const preparedCar = {
          candidateId: car.candidateId,
          position,
          candidateSha: car.candidateHeadCommitSha,
          candidateRef,
          prNumber: car.candidatePrIdentity?.number,
          qualifiedBaseSha: car.predictedParentCommitSha,
          planPath: `${car.candidateId}/sounding-line-plan.json`,
          finalizationArtifact: `sounding-line-train-finalization-${car.candidateId}`,
          qualificationArtifact: `sounding-line-train-qualified-${car.candidateId}`,
          acceptanceArtifact: `sounding-line-train-acceptance-envelope-${car.candidateId}`,
          activeMaximumWave,
        };
        await writeFile(path.join(directory, "sounding-line-plan.json"), `${JSON.stringify(plan, null, 2)}\n`, "utf8");
        // Synthetic integration commits are intentionally unreachable from any
        // branch. The candidate checkout already contains the trusted base, so
        // ship only the synthetic integration delta, never repository history.
        // Git records the candidate/base as bundle prerequisites and rejects a
        // worker that cannot prove it has the exact prerequisite objects.
        const bundleRef = `refs/sounding-line/train/${position}-${car.candidateHeadCommitSha}`;
        await execute("git", ["-C", repoPath, "update-ref", bundleRef, predicted.resultingIntegrationSha]);
        try {
          await execute("git", [
            "-C",
            repoPath,
            "bundle",
            "create",
            path.join(directory, "integration.bundle"),
            bundleRef,
            `^${car.candidateHeadCommitSha}`,
          ]);
        } finally {
          await execute("git", ["-C", repoPath, "update-ref", "-d", bundleRef]).catch(() => undefined);
        }
        const workerMatrix = [];
        const groups = new Map();
        for (const node of workerNodes) {
          const key = `${node.execution.wave}:${node.execution.mode}`;
          groups.set(key, [...(groups.get(key) ?? []), node]);
        }
        for (const [key, grouped] of [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
          const [wave, mode] = key.split(":");
          for (const batch of batchPhysicalWorkers(grouped, {
            carId: car.candidateId,
            candidateSha: car.candidateHeadCommitSha,
            candidateRef,
            executionSha: predicted.resultingIntegrationSha,
            // The compact integration bundle excludes every object reachable
            // from the candidate. Its only trusted remote prerequisite is the
            // immutable main snapshot from which this train was admitted.
            // Carry that object explicitly instead of assuming a two-commit
            // checkout contains it: an ordinary PR may have any commit depth.
            integrationBaseSha: state.train.actualMainCommitSha,
            planArtifact: `sounding-line-train-plan-${car.candidateId}`,
            integrationArtifact: `sounding-line-train-integration-${car.candidateId}`,
            planPath: `${car.candidateId}/sounding-line-plan.json`,
            integrationBundlePath: `${car.candidateId}/integration.bundle`,
            wave: Number(wave),
            mode,
          }))
            workerMatrix.push({
              ...batch,
              receiptArtifact: `sounding-line-train-worker-${car.candidateId}-${batch.batchId}`,
            });
        }
        return { car: preparedCar, matrix: workerMatrix };
      } finally {
        await execute("git", ["-C", repoPath, "worktree", "remove", "--force", worktree]).catch(() => undefined);
      }
    });
    const cars = preparedCars.map((entry) => entry.car);
    const matrix = preparedCars.flatMap((entry) => entry.matrix);
    await writeFile(path.join(out, "worker-matrix.json"), `${JSON.stringify({ include: matrix }, null, 2)}\n`, "utf8");
    await writeFile(path.join(out, "car-matrix.json"), `${JSON.stringify({ include: cars }, null, 2)}\n`, "utf8");
    return { include: matrix, cars };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const state = JSON.parse(await readFile(path.resolve(value(args, "--train")), "utf8"));
  await prepareMainlineTrain({
    state,
    out: path.resolve(value(args, "--out")),
    repoPath: path.resolve(value(args, "--repo")),
  });
}
