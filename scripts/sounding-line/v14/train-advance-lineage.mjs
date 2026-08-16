#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";

const SHA = /^[0-9a-f]{40}$/u;
const value = (args, flag) => {
  const index = args.indexOf(flag);
  const result = index < 0 ? undefined : args[index + 1];
  if (!result) throw new Error(`TRAIN_ADVANCE_${flag.slice(2).toUpperCase()}_REQUIRED`);
  return result;
};

const validSha = (valueToCheck) => typeof valueToCheck === "string" && SHA.test(valueToCheck);

/**
 * Bind a merged train head to exactly the candidate content qualified by its
 * sealed plan. A normal head keeps its source-tree identity; a retained suffix
 * may instead carry the exact predicted integration tree after update-branch.
 */
export function qualifyTrainAdvanceLineage({ envelope, plan, prNumber, candidateSha, candidateTreeSha }) {
  if (!Number.isInteger(prNumber) || prNumber < 1 || !validSha(candidateSha) || !validSha(candidateTreeSha))
    return { valid: false, code: "TRAIN_ADVANCE_MERGED_IDENTITY_INVALID" };
  if (
    !envelope ||
    !plan ||
    envelope.prNumber !== prNumber ||
    !validSha(envelope.candidateSha) ||
    plan.sourceSha !== envelope.candidateSha ||
    !validSha(plan.candidateTreeSha) ||
    !validSha(plan.predictedIntegrationTreeSha)
  )
    return { valid: false, code: "TRAIN_ADVANCE_SEALED_LINEAGE_INVALID" };
  if (candidateSha === envelope.candidateSha && candidateTreeSha === plan.candidateTreeSha)
    return { valid: true, disposition: "ORIGINAL_CANDIDATE" };
  if (candidateSha !== envelope.candidateSha && candidateTreeSha === plan.predictedIntegrationTreeSha)
    return { valid: true, disposition: "TREE_EQUIVALENT_REBOUND" };
  return { valid: false, code: "TRAIN_ADVANCE_CANDIDATE_TREE_MISMATCH" };
}

const args = process.argv.slice(2);
if (args.length) {
  const envelope = JSON.parse(await readFile(value(args, "--envelope"), "utf8"));
  const plan = JSON.parse(await readFile(value(args, "--plan"), "utf8"));
  const result = qualifyTrainAdvanceLineage({
    envelope,
    plan,
    prNumber: Number(value(args, "--pr-number")),
    candidateSha: value(args, "--candidate-sha"),
    candidateTreeSha: value(args, "--candidate-tree-sha"),
  });
  console.log(JSON.stringify(result));
  process.exitCode = result.valid ? 0 : 1;
}
