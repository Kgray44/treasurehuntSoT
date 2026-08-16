import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { qualifyTrainAdvanceLineage } from "../../../scripts/sounding-line/v14/train-advance-lineage.mjs";
import { qualifyTrainAdvanceState } from "../../../scripts/sounding-line/v14/train-advance-state-lineage.mjs";
import {
  createMainlineTrain,
  planMainlineTrain,
  qualifyTrainCar,
  transitionTrainCar,
} from "../../../scripts/sounding-line/v14/mainline-train.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const sha = (letter) => letter.repeat(40);
const envelope = { prNumber: 150, candidateSha: sha("a") };
const plan = { sourceSha: sha("a"), candidateTreeSha: sha("b"), predictedIntegrationTreeSha: sha("c") };

test("train advance accepts only its exact original candidate or sealed predicted-tree rebind", () => {
  assert.deepEqual(
    qualifyTrainAdvanceLineage({ envelope, plan, prNumber: 150, candidateSha: sha("a"), candidateTreeSha: sha("b") }),
    { valid: true, disposition: "ORIGINAL_CANDIDATE" },
  );
  assert.deepEqual(
    qualifyTrainAdvanceLineage({ envelope, plan, prNumber: 150, candidateSha: sha("d"), candidateTreeSha: sha("c") }),
    { valid: true, disposition: "TREE_EQUIVALENT_REBOUND" },
  );
});

test("train advance rejects wrong PRs, stale source trees, and arbitrary rebound content", () => {
  for (const input of [
    { prNumber: 151, candidateSha: sha("a"), candidateTreeSha: sha("b") },
    { prNumber: 150, candidateSha: sha("a"), candidateTreeSha: sha("c") },
    { prNumber: 150, candidateSha: sha("d"), candidateTreeSha: sha("b") },
  ])
    assert.equal(qualifyTrainAdvanceLineage({ envelope, plan, ...input }).valid, false);
});

test("hosted advance uses the sealed lineage contract instead of a raw candidate-SHA match", async () => {
  const workflow = await readFile(
    path.join(root, ".github", "workflows", "sounding-line-mainline-train-advance.yml"),
    "utf8",
  );
  assert.match(workflow, /train-advance-lineage\.mjs/u);
  assert.match(workflow, /candidate-tree-sha/u);
  assert.match(workflow, /sounding-line-train-acceptance-envelope-pr-\$\(\$env:PR_NUMBER\)/u);
  assert.doesNotMatch(workflow, /envelope\.candidateSha -eq \$env:CANDIDATE_SHA/u);
  assert.match(workflow, /train-advance-state-lineage\.mjs/u);
  assert.match(workflow, /TRAIN_ADVANCE_LANDED_COMMIT_NOT_ON_PROTECTED_MAIN/u);
  assert.match(workflow, /next-requalification-required=true/u);
});

test("persisted advance state accepts only the current head-ready car and its sealed tree-equivalent rebind", () => {
  const at = "2026-08-16T00:00:00.000Z";
  const candidate = {
    candidateId: "pr-150",
    headCommitSha: sha("a"),
    headTreeSha: sha("b"),
    prIdentity: { number: 150, ref: "refs/heads/train-150", baseSha: sha("d") },
    priorityClass: "NORMAL",
    admissionPolicyIdentity: "policy",
    admittedAt: at,
    admissionOrdinal: 0,
    ageCycles: 0,
  };
  const initial = createMainlineTrain({
    trainId: "train-1",
    authorityIdentity: "SOUNDING_LINE_V14",
    policyIdentity: "policy",
    admissionPolicyIdentity: "policy",
    mergeStrategyIdentity: "github-protected-merge-commit",
    actualMainCommitSha: sha("d"),
    actualMainTreeSha: sha("d"),
    candidates: [candidate],
    createdAt: at,
  });
  const planned = planMainlineTrain(initial, {
    integrate: () => ({ treeSha: sha("c"), commitSha: sha("d") }),
    timestamp: at,
  });
  const qualified = qualifyTrainCar(planned, {
    candidateId: "pr-150",
    plan: {
      authorityBoundary: "V14_CANDIDATE_QUALIFICATION",
      authorityMode: "V14_CANDIDATE",
      gate: "mainline",
      sourceSha: sha("a"),
      qualifiedBaseSha: sha("d"),
      qualifiedBaseTreeSha: sha("d"),
      predictedIntegrationTreeSha: sha("c"),
      planDigest: "plan-1",
    },
    finalization: { decision: "RELEASE_GO", planDigest: "plan-1" },
    evidenceClosureIdentity: "closure",
    timestamp: at,
  });
  const ready = transitionTrainCar(qualified, { position: 0, to: "HEAD_READY", timestamp: at });
  assert.equal(
    qualifyTrainAdvanceState({
      state: { train: ready },
      trainId: "train-1",
      prNumber: 150,
      candidateSha: sha("a"),
      candidateTreeSha: sha("b"),
    }).valid,
    true,
  );
  assert.deepEqual(
    qualifyTrainAdvanceState({
      state: { train: ready },
      trainId: "train-1",
      prNumber: 150,
      candidateSha: sha("e"),
      candidateTreeSha: sha("c"),
    }),
    { valid: true, disposition: "TREE_EQUIVALENT_REBOUND" },
  );
  for (const input of [
    { trainId: "other", prNumber: 150, candidateSha: sha("a"), candidateTreeSha: sha("b") },
    { trainId: "train-1", prNumber: 151, candidateSha: sha("a"), candidateTreeSha: sha("b") },
    { trainId: "train-1", prNumber: 150, candidateSha: sha("e"), candidateTreeSha: sha("f") },
  ])
    assert.equal(qualifyTrainAdvanceState({ state: { train: ready }, ...input }).valid, false);
});
