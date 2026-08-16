import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { qualifyTrainAdvanceLineage } from "../../../scripts/sounding-line/v14/train-advance-lineage.mjs";

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
  assert.doesNotMatch(workflow, /envelope\.candidateSha -eq \$env:CANDIDATE_SHA/u);
});
