import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CALIBRATION_CORPUS_V1,
  canonicalDigest,
  comparePromptContracts,
  createTaskContract,
  evaluateLeaveOneOut,
  evaluateOptionalIntegrations,
} from "./trim-phase4.mjs";

const outputIndex = process.argv.indexOf("--out");
const output =
  outputIndex >= 0
    ? process.argv[outputIndex + 1]
    : "Development_Docs/Programs/Project_Trim/Project_Trim_Phase_4_Benchmark_Data.json";
if (!output) throw new Error("PHASE4_BENCHMARK_OUTPUT_REQUIRED");

const permanentVerboseText = [
  "Use all generic repository safety rules and worktree hygiene.",
  "Sounding Line remains release authority and the complete generic testing lifecycle applies.",
  "Context expansion is not scope expansion; repeat all generic privacy and documentation requirements.",
].join(" ");
const cases = [
  ["focused-repair", "bug-repair", "Repair a bounded stale packet path."],
  ["ordinary-implementation", "product-phase", "Add one bounded context workflow capability."],
  ["continuation", "tight-continuation", "Continue an accepted phase from its capsule."],
  ["infrastructure", "integration", "Reconcile a source-bound integration seam."],
  ["documentation-record", "documentation-only", "Publish a bounded evidence record."],
  ["release-closure", "release-closure", "Freeze and qualify one exact closure candidate."],
];
const comparisons = cases.map(([id, taskClass, uniqueScope]) => {
  const compact = createTaskContract({
    project: "Project Trim",
    increment: `Phase 4 benchmark ${id}`,
    title: id,
    executionProfile: "STANDARD_AUTONOMOUS",
    uniqueScope: [uniqueScope],
    uniqueNonGoals: ["Do not begin another phase."],
    deliverables: ["Bounded implementation evidence."],
  });
  return {
    id,
    taskClass,
    comparison: comparePromptContracts({
      legacy: `${permanentVerboseText} ${permanentVerboseText} ${uniqueScope}`,
      compact,
    }),
    evidenceQuality: "DETERMINISTIC_CONTRACT_FIXTURE",
  };
});
const result = {
  schemaVersion: "1.0",
  program: "PROJECT_TRIM_PHASE_4",
  benchmark: "TRIM_THE_SAILS_PROMPT_COMPACTION_AND_CALIBRATION",
  method: {
    promptCompaction:
      "Deterministic representative fixtures compare an intentionally verbose legacy form against the canonical short contract. Packet, capsule, and permanent guidance remain external governed context rather than copied into the short contract.",
    tokenComparison: "UNAVAILABLE_WITHOUT_VALID_COMPARABLE_END_TO_END_TASK_REPLAY",
    correctness:
      "Contract fixture equivalence verifies retained unique scope, authority, non-goals, and completion requirements; it is not a product-work replay.",
  },
  promptCompaction: comparisons,
  calibration: {
    exactCorpus: {
      count: CALIBRATION_CORPUS_V1.length,
      totalExactTokens: CALIBRATION_CORPUS_V1.reduce((total, sample) => total + sample.exactTokens, 0),
      source: "Project Trim v1.0-R1 Appendix I",
      samples: CALIBRATION_CORPUS_V1,
    },
    leaveOneOut: evaluateLeaveOneOut(),
  },
  optionalIntegrations: evaluateOptionalIntegrations(),
  programTokenReductionTarget: {
    target: "40-60_PERCENT_FOR_SUITABLE_ORDINARY_TASKS",
    disposition: "NOT_YET_DEFENSIBLY_MEASURABLE",
    reason:
      "No comparable end-to-end ordinary-task token replay is available; prompt bytes and fixture equivalence are direct proxies, not token savings.",
  },
};
result.integrity = { semanticDigest: canonicalDigest(result) };
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify({ output, semanticDigest: result.integrity.semanticDigest, classes: comparisons.length }, null, 2),
);
