#!/usr/bin/env node
/* Validate a persisted train state before using it to advance one merged PR. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { verifyTrain } from "./mainline-train.mjs";

const sha = (value) => typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);
const stateTrain = (state) => state?.train ?? state;

/**
 * A persisted advance artifact is usable only when its sealed train identifies
 * this exact train and its current HEAD_READY car is the merged PR.  A
 * mechanical GitHub update-branch may rotate the candidate commit, but only
 * the sealed predicted tree can carry that identity forward.
 */
export function qualifyTrainAdvanceState({ state, trainId, prNumber, candidateSha, candidateTreeSha }) {
  const train = stateTrain(state);
  if (!verifyTrain(train).valid) return { valid: false, code: "TRAIN_ADVANCE_STATE_TAMPERED" };
  if (typeof trainId !== "string" || train.trainId !== trainId)
    return { valid: false, code: "TRAIN_ADVANCE_STATE_TRAIN_ID_MISMATCH" };
  if (!Number.isInteger(Number(prNumber)) || !sha(candidateSha) || !sha(candidateTreeSha))
    return { valid: false, code: "TRAIN_ADVANCE_STATE_IDENTITY_INVALID" };
  const head = train.headPosition >= 0 ? train.cars[train.headPosition] : null;
  if (!head || head.state !== "HEAD_READY") return { valid: false, code: "TRAIN_ADVANCE_STATE_HEAD_NOT_READY" };
  if (head.candidatePrIdentity?.number !== Number(prNumber))
    return { valid: false, code: "TRAIN_ADVANCE_STATE_PR_MISMATCH" };
  if (candidateSha === head.candidateHeadCommitSha && candidateTreeSha === head.candidateHeadTreeSha)
    return { valid: true, disposition: "ORIGINAL_CANDIDATE" };
  if (candidateTreeSha === head.predictedIntegrationTreeSha)
    return { valid: true, disposition: "TREE_EQUIVALENT_REBOUND" };
  return { valid: false, code: "TRAIN_ADVANCE_STATE_CANDIDATE_MISMATCH" };
}

const args = process.argv.slice(2);
const value = (flag) => {
  const index = args.indexOf(flag);
  const result = index < 0 ? undefined : args[index + 1];
  if (!result) throw new Error(`TRAIN_ADVANCE_STATE_${flag.slice(2).toUpperCase()}_REQUIRED`);
  return result;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const state = JSON.parse(await readFile(path.resolve(value("--state")), "utf8"));
  const result = qualifyTrainAdvanceState({
    state,
    trainId: value("--train-id"),
    prNumber: value("--pr-number"),
    candidateSha: value("--candidate-sha"),
    candidateTreeSha: value("--candidate-tree-sha"),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.valid ? 0 : 1;
}
