import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ACCOUNTING_HIERARCHY,
  BUDGET_BANDS,
  CALIBRATION_CORPUS_V1,
  assessContextBudget,
  comparePromptContracts,
  createTaskContract,
  estimateUsage,
  evaluateLeaveOneOut,
  evaluateOptionalIntegrations,
  evaluateRegressionMetrics,
  normalizeTelemetry,
} from "../../scripts/agent-context/trim-phase4.mjs";

const contract = createTaskContract({
  project: "Project Trim",
  increment: "Phase 4",
  title: "Trim the Sails",
  executionProfile: "UNATTENDED_CONTINUATION",
  uniqueScope: ["Activate advisory budgets and privacy-safe efficiency telemetry."],
  uniqueNonGoals: ["Do not begin Phase 5."],
  deliverables: ["Machine-readable budget and telemetry records."],
});

test("short task contracts retain unique scope, authority, non-goals, and completion without a hard size limit", () => {
  const comparison = comparePromptContracts({
    legacy: `${"Generic permanent rule. ".repeat(200)} Activate advisory budgets and privacy-safe efficiency telemetry.`,
    compact: contract,
  });
  assert.equal(comparison.equivalence.result, "PASS");
  assert.equal(comparison.compact.hardCharacterLimit, null);
  assert.ok(comparison.promptByteReductionPercent > 0);
  assert.throws(() => createTaskContract({ ...contract, uniqueScope: [] }), /UNIQUE_SCOPE_REQUIRED/u);
});

test("budget bands diagnose usage and cannot stop a task", () => {
  const budget = assessContextBudget({
    taskClass: "bug-repair",
    usage: { accountingMethod: "CALIBRATED_ESTIMATE", pointEstimate: BUDGET_BANDS.NARROW.warning },
    dominantContextGrowthCategories: ["DUPLICATE_READS"],
  });
  assert.equal(budget.budgetState, "WARNING");
  assert.equal(budget.advisoryOnly, true);
  assert.equal(budget.blocksProgress, false);
  assert.equal(assessContextBudget({ taskClass: "release-closure" }).budgetState, "UNAVAILABLE");
});

test("exact corpus is preserved and held-out calibration records residuals and coverage", () => {
  assert.equal(CALIBRATION_CORPUS_V1.length, 7);
  assert.equal(
    CALIBRATION_CORPUS_V1.reduce((total, sample) => total + sample.exactTokens, 0),
    9883558,
  );
  const calibration = evaluateLeaveOneOut();
  assert.equal(calibration.results.length, 7);
  assert.ok(calibration.results.every((result) => result.heldOut));
  assert.ok(calibration.results.every((result) => result.absoluteResidual >= 0));
  assert.equal(
    calibration.results.find((result) => result.id === "E1").calibrationBasis,
    "SAME_REGIME_PEERS_EXCLUDING_HELD_OUT_SAMPLE",
  );
  assert.equal(
    calibration.results.find((result) => result.id === "E3").calibrationBasis,
    "GOVERNING_SPARSE_REGIME_FALLBACK",
  );
  assert.deepEqual(ACCOUNTING_HIERARCHY, [
    "EXACT",
    "RECONSTRUCTED",
    "CALIBRATED_ESTIMATE",
    "COARSE_ESTIMATE",
    "UNAVAILABLE",
  ]);
});

test("accounting preserves exact provenance, exposes reconstruction gaps, and never turns unknown into zero", () => {
  const exact = estimateUsage({ exactTokens: 81156, provenance: "owner supplied platform total" });
  assert.equal(exact.accountingMethod, "EXACT");
  const reconstructed = estimateUsage({
    accountingMethod: "RECONSTRUCTED",
    pointEstimate: 120000,
    includedSurfaces: ["tool transcript"],
    missingSurfaces: ["platform footer"],
  });
  assert.equal(reconstructed.accountingMethod, "RECONSTRUCTED");
  assert.deepEqual(reconstructed.missingSurfaces, ["platform footer"]);
  assert.equal(estimateUsage({}).accountingMethod, "UNAVAILABLE");
  assert.equal(estimateUsage({}).exactTokens, null);
  assert.equal(
    estimateUsage({ durationMinutes: 10, activityRegime: "WAIT_MONITOR_HEAVY" }).activityRegime,
    "WAIT_MONITOR_HEAVY",
  );
});

test("telemetry is deterministic engineering metadata and refuses prompts or private fields", () => {
  const telemetry = normalizeTelemetry({
    taskId: "phase4",
    project: "Project Trim",
    initialPacketBytes: 1200,
    uniqueFilesRead: 7,
    usage: estimateUsage({ durationMinutes: 10 }),
  });
  assert.equal(telemetry.telemetryAuthority, "NONAUTHORITATIVE_ENGINEERING_METADATA");
  assert.equal(telemetry.activity.uniqueFilesRead, 7);
  assert.equal(telemetry.prompt.bytes, null);
  assert.throws(() => normalizeTelemetry({ rawPrompt: "private prompt" }), /PRIVATE_FIELD_REJECTED/u);
});

test("optional integrations fail safely and regression warnings remain advisory", () => {
  const optional = evaluateOptionalIntegrations();
  assert.equal(optional.bridgewatch.disposition, "EVALUATED_NOT_ADOPTED");
  assert.equal(optional.modelRouting.highRiskDefault, "STRONGEST_VALIDATED_CONFIGURATION");
  const regression = evaluateRegressionMetrics({ rootAgentsBytes: 200, rootAgentsBaselineBytes: 100 });
  assert.equal(regression.status, "WARNING");
  assert.equal(regression.blocksProgress, false);
});

test("the committed worksheet and benchmark retain null-unavailable handling and six representative classes", () => {
  const worksheet = JSON.parse(
    readFileSync("Development_Docs/Programs/Project_Trim/Project_Trim_Context_Budget_and_Usage_Worksheet.json", "utf8"),
  );
  const benchmark = JSON.parse(
    readFileSync("Development_Docs/Programs/Project_Trim/Project_Trim_Phase_4_Benchmark_Data.json", "utf8"),
  );
  assert.equal(worksheet.usage.exactTokens, null);
  assert.equal(worksheet.safety.advisoryBudgetsOnly, true);
  assert.equal(benchmark.promptCompaction.length, 6);
  assert.ok(benchmark.promptCompaction.every((entry) => entry.comparison.equivalence.result === "PASS"));
  assert.equal(benchmark.programTokenReductionTarget.disposition, "NOT_YET_DEFENSIBLY_MEASURABLE");
  const readiness = JSON.parse(
    readFileSync("Development_Docs/Programs/Project_Trim/Project_Trim_Rollout_Readiness.json", "utf8"),
  );
  assert.deepEqual(readiness.families.map((entry) => entry.readiness).sort(), [
    "LEGACY",
    "PARTIAL",
    "READY",
    "SENSITIVE",
  ]);
});
