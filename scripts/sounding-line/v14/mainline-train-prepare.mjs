#!/usr/bin/env node
/* Build per-car sealed execution inputs from one admitted live train. */
import { execFile } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { buildPlan } from "../planner.mjs";
import { verifyTrain } from "./mainline-train.mjs";
import { createDependencyLayerManifest, dependencyLayerInputs } from "./prepared-layer-artifact.mjs";
import { digest } from "./foundation.mjs";

const execute = promisify(execFile);
const git = async (cwd, ...args) => (await execute("git", args, { cwd })).stdout.trim();
const value = (args, flag) => {
  const index = args.indexOf(flag);
  const result = index < 0 ? undefined : args[index + 1];
  if (!result) throw new Error(`TRAIN_PREPARE_${flag.slice(2).toUpperCase()}_REQUIRED`);
  return result;
};
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const defaultPrepareLayer = async ({ worktree, destination, producer, expiresAt }) => {
  await execute(npmCommand, ["ci"], { cwd: worktree, shell: process.platform === "win32" });
  const manifest = await createDependencyLayerManifest({
    root: worktree,
    sourceDirectory: path.join(worktree, "node_modules"),
    producer,
    expiresAt,
  });
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, "dependency-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await rename(path.join(worktree, "node_modules"), path.join(destination, "node_modules"));
};

export async function prepareMainlineTrain({
  state,
  out,
  repoPath,
  temporaryRoot = undefined,
  buildPlanFn = buildPlan,
  dependencyLayerInputsFn = dependencyLayerInputs,
  prepareLayerFn = defaultPrepareLayer,
}) {
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
    const matrix = [];
    const cars = [];
    const producer = `mainline-train:${process.env.GITHUB_RUN_ID ?? state.train.trainId}`;
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const preparedLayers = new Set();
    for (let position = 0; position < state.train.cars.length; position += 1) {
      const car = state.train.cars[position];
      const predicted = state.predicted.cars[position];
      if (
        car.candidateHeadCommitSha !== predicted.sourceHeadSha ||
        car.predictedParentCommitSha !== predicted.predictedParentCommitSha ||
        car.predictedIntegrationTreeSha !== predicted.predictedIntegrationTreeSha
      )
        throw new Error("TRAIN_PREPARE_IDENTITY_MISMATCH");
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
          predictedIdentity: {
            predictedParentCommitSha: car.predictedParentCommitSha,
            predictedParentTreeSha: car.predictedParentTreeSha,
            predictedIntegrationTreeSha: car.predictedIntegrationTreeSha,
          },
        });
        if (
          plan.authorityBoundary !== "V14_CANDIDATE_QUALIFICATION" ||
          plan.predictedIntegrationTreeSha !== car.predictedIntegrationTreeSha
        )
          throw new Error("TRAIN_PREPARE_PLAN_IDENTITY_MISMATCH");
        const preparedLayerKey = digest(await dependencyLayerInputsFn(worktree));
        const preparedPath = preparedLayerKey;
        if (!preparedLayers.has(preparedLayerKey)) {
          await prepareLayerFn({
            worktree,
            destination: path.join(out, "dependencies", preparedPath),
            producer,
            expiresAt,
            preparedLayerKey,
          });
          preparedLayers.add(preparedLayerKey);
        }
        cars.push({
          candidateId: car.candidateId,
          position,
          candidateSha: car.candidateHeadCommitSha,
          prNumber: car.candidatePrIdentity?.number,
          qualifiedBaseSha: car.predictedParentCommitSha,
          planPath: `${car.candidateId}/sounding-line-plan.json`,
          finalizationArtifact: `sounding-line-train-finalization-${car.candidateId}`,
          qualificationArtifact: `sounding-line-train-qualified-${car.candidateId}`,
          acceptanceArtifact: `sounding-line-train-acceptance-envelope-${car.candidateId}`,
        });
        await writeFile(path.join(directory, "sounding-line-plan.json"), `${JSON.stringify(plan, null, 2)}\n`, "utf8");
        // Synthetic integration commits are intentionally unreachable from any
        // branch. Pin the exact object under an internal deterministic ref long
        // enough for Git to serialize it, then remove that local transport ref.
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
          ]);
        } finally {
          await execute("git", ["-C", repoPath, "update-ref", "-d", bundleRef]).catch(() => undefined);
        }
        for (const node of plan.nodes)
          matrix.push({
            carId: car.candidateId,
            suiteId: node.id,
            candidateSha: car.candidateHeadCommitSha,
            executionSha: predicted.resultingIntegrationSha,
            planArtifact: `sounding-line-train-plan-${car.candidateId}`,
            integrationArtifact: `sounding-line-train-integration-${car.candidateId}`,
            preparedArtifact: "sounding-line-train-prepared-dependency",
            preparedPath,
            preparedProducer: producer,
            planPath: `${car.candidateId}/sounding-line-plan.json`,
            integrationBundlePath: `${car.candidateId}/integration.bundle`,
            receiptArtifact: `sounding-line-train-worker-${car.candidateId}-${node.id}`,
            wave: node.execution.wave,
            mode: node.execution.mode,
          });
      } finally {
        await execute("git", ["-C", repoPath, "worktree", "remove", "--force", worktree]).catch(() => undefined);
      }
    }
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
