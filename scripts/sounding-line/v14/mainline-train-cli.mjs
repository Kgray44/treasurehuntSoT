#!/usr/bin/env node
/* Thin operational interface for the live mainline-train state controller. */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  admitLiveMainlineTrain,
  landTrainHead,
  qualifyTrainCar,
  transitionTrainCar,
  verifyTrain,
} from "./mainline-train.mjs";

const args = process.argv.slice(2);
const command = args.shift();
const value = (flag, optional = false) => {
  const index = args.indexOf(flag);
  const result = index < 0 ? undefined : args[index + 1];
  if (!result && !optional) throw new Error(`TRAIN_CLI_${flag.slice(2).toUpperCase()}_REQUIRED`);
  return result;
};
const json = async (file) => JSON.parse(await readFile(path.resolve(file), "utf8"));
const write = async (file, valueToWrite) =>
  writeFile(path.resolve(file), `${JSON.stringify(valueToWrite, null, 2)}\n`, "utf8");
const timestamp = () => new Date().toISOString();

if (command === "admit") {
  const input = await json(value("--input"));
  const result = await admitLiveMainlineTrain({
    repoPath: path.resolve(input.repoPath ?? process.cwd()),
    trainId: input.trainId,
    authorityIdentity: input.authorityIdentity,
    policyIdentity: input.policyIdentity,
    admissionPolicyIdentity: input.admissionPolicyIdentity,
    mergeStrategyIdentity: input.mergeStrategyIdentity,
    actualMainCommitSha: input.actualMainCommitSha,
    candidates: input.candidates,
    createdAt: input.createdAt ?? timestamp(),
  });
  await write(value("--out"), result);
} else if (command === "qualify") {
  const state = await json(value("--state"));
  if (!verifyTrain(state).valid) throw new Error("TRAIN_CLI_TAMPERED_STATE");
  const plan = await json(value("--plan"));
  const finalization = await json(value("--finalization"));
  const train = qualifyTrainCar(state, {
    candidateId: value("--candidate-id"),
    plan,
    finalization,
    evidenceClosureIdentity: value("--evidence-closure"),
    timestamp: value("--timestamp", true) ?? timestamp(),
  });
  await write(value("--out"), train);
} else if (command === "head-ready") {
  const state = await json(value("--state"));
  if (!verifyTrain(state).valid) throw new Error("TRAIN_CLI_TAMPERED_STATE");
  const position = state.cars.findIndex((car) => car.candidateId === value("--candidate-id"));
  if (position !== state.headPosition) throw new Error("TRAIN_CLI_HEAD_CANDIDATE_REQUIRED");
  await write(
    value("--out"),
    transitionTrainCar(state, { position, to: "HEAD_READY", timestamp: value("--timestamp", true) ?? timestamp() }),
  );
} else if (command === "land") {
  const state = await json(value("--state"));
  if (!verifyTrain(state).valid) throw new Error("TRAIN_CLI_TAMPERED_STATE");
  const result = landTrainHead(state, {
    actualLandedCommitSha: value("--commit"),
    actualLandedTreeSha: value("--tree"),
    mergeStrategyIdentity: value("--merge-strategy"),
    timestamp: value("--timestamp", true) ?? timestamp(),
    // An exact head-tree match retains the already sealed suffix predictions;
    // an external/unexpected advance must go back through governed admission.
    integrate: ({ position }) => {
      const car = state.cars[position];
      if (!car?.predictedIntegrationTreeSha) throw new Error("TRAIN_CLI_SUFFIX_REPLAN_REQUIRES_GOVERNED_ADMISSION");
      return { treeSha: car.predictedIntegrationTreeSha, commitSha: car.predictedIntegrationCommitSha };
    },
  });
  await write(value("--out"), result);
} else {
  throw new Error("TRAIN_CLI_COMMAND_INVALID");
}
