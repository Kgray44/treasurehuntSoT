import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { selectV14Mainline } from "../../../scripts/sounding-line/v14/fast-channel.mjs";
import { attributeGeneratedState } from "../../../scripts/sounding-line/generated-state-attribution.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("safe direct fallback selects fresh conservative evidence for every registered ordinary suite", () => {
  const plan = selectV14Mainline({
    changedPaths: ["src/community/example.ts"],
    suites: [
      { id: "static.core", dependencies: [] },
      { id: "unit.community", dependencies: ["static.core"] },
    ],
    requiredSuiteIds: ["static.core"],
    ledgerSuiteIds: ["static.core", "unit.community"],
    conservativeFallbackReason: "MAINLINE_TRAIN_OPTIMIZATION_FAILURE",
  });
  assert.equal(plan.fallback.disposition, "CONSERVATIVE_FALLBACK");
  assert.deepEqual(plan.selectedSuiteIds, ["static.core", "unit.community"]);
  assert.ok(plan.ledger.every((entry) => entry.evidenceDisposition === "CONSERVATIVE_FALLBACK"));
  assert.ok(plan.ledger.every((entry) => entry.selectionReason === "CONSERVATIVE_FALLBACK"));
});

test("ordinary candidate authority is Direct Mainline and does not require a Baseline Certification receipt", async () => {
  const [policy, workflow] = await Promise.all([
    readFile(path.join(root, "testing", "verification-maintenance-policy.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, ".github", "workflows", "sounding-line-authoritative.yml"), "utf8"),
  ]);
  assert.equal(policy.ordinaryIntegrationPath, "DIRECT_MAINLINE");
  assert.equal(policy.mainlineTrain.failureRoute, "SAFE_DIRECT_FALLBACK");
  assert.match(workflow, /verification_route/u);
  assert.doesNotMatch(workflow, /SOUNDING_LINE_BASELINE_CERTIFICATION_REQUIRED/u);
});

test("declared derived records leave structural product impact narrow", async () => {
  const policy = JSON.parse(await readFile(path.join(root, "testing", "verification-maintenance-policy.json"), "utf8"));
  const retirementCsv = "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_P34_Retirement_Ledger.csv";
  const changedPaths = ["src/styles/community.css", retirementCsv];
  const attribution = attributeGeneratedState({ policy, changedPaths, generatedDriftPaths: [] });
  assert.deepEqual(attribution.errors, []);
  assert.deepEqual(attribution.nonSemanticChangedPaths, [retirementCsv]);

  const plan = selectV14Mainline({
    changedPaths,
    nonSemanticChangedPaths: attribution.nonSemanticChangedPaths,
    suites: [
      { id: "browser.access-sentinel", dependencies: [] },
      { id: "browser.community", dependencies: [] },
      { id: "unit.unrelated", dependencies: [] },
    ],
    requiredSuiteIds: ["browser.access-sentinel"],
    ledgerSuiteIds: ["browser.access-sentinel", "browser.community", "unit.unrelated"],
    impact: {
      pathMappings: [{ path: "src/styles/community.css", suiteIds: ["browser.community"] }],
      contractMappings: [],
    },
  });
  assert.equal(plan.fallback, null);
  assert.deepEqual(plan.selectedSuiteIds, ["browser.access-sentinel", "browser.community"]);
  assert.deepEqual(plan.changedInterval.nonSemanticGeneratedPaths, [retirementCsv]);
  assert.deepEqual(plan.changedInterval.semanticChangedPaths, ["src/styles/community.css"]);
});

test("candidate-caused generated drift blocks while pre-existing unrelated drift is quarantined asynchronously", async () => {
  const policy = JSON.parse(await readFile(path.join(root, "testing", "verification-maintenance-policy.json"), "utf8"));
  const output = "testing/generated/active-test-registry.json";
  const candidateCaused = attributeGeneratedState({
    policy,
    changedPaths: ["tests/e2e/harborlight-phase3.spec.ts", output],
    generatedDriftPaths: [output],
  });
  assert.deepEqual(candidateCaused.errors, [`GENERATED_STATE_CANDIDATE_DRIFT:active-test-registry:${output}`]);

  const preexisting = attributeGeneratedState({
    policy,
    changedPaths: ["src/app/community/example.ts"],
    generatedDriftPaths: [output],
  });
  assert.deepEqual(preexisting.errors, []);
  assert.equal(
    preexisting.records.find((entry) => entry.id === "active-test-registry")?.disposition,
    "PREEXISTING_UNRELATED",
  );
  assert.equal(
    preexisting.records.find((entry) => entry.id === "active-test-registry")?.handling,
    "ASYNC_QUARANTINE_NONBLOCKING",
  );

  const derivedOutput = "testing/generated/p34-retirement-ledger.json";
  const candidateDerivedRecord = attributeGeneratedState({
    policy,
    changedPaths: ["tests/e2e/harborlight-phase3.spec.ts", output, derivedOutput],
    generatedDriftPaths: [derivedOutput],
  });
  assert.deepEqual(candidateDerivedRecord.errors, []);
  assert.equal(
    candidateDerivedRecord.records.find((entry) => entry.id === "p34-retirement-ledger")?.disposition,
    "DERIVED_RECORD_RECONCILIATION",
  );
  assert.equal(
    candidateDerivedRecord.records.find((entry) => entry.id === "p34-retirement-ledger")?.handling,
    "ASYNC_QUARANTINE_NONBLOCKING",
  );
});

test("an undeclared executable path still widens conservatively", () => {
  const plan = selectV14Mainline({
    changedPaths: ["scripts/unowned-executable.mjs"],
    suites: [
      { id: "browser.access-sentinel", dependencies: [] },
      { id: "unit.unrelated", dependencies: [] },
    ],
    requiredSuiteIds: ["browser.access-sentinel"],
    ledgerSuiteIds: ["browser.access-sentinel", "unit.unrelated"],
    impact: { pathMappings: [], contractMappings: [] },
  });
  assert.equal(plan.fallback.disposition, "CONSERVATIVE_FALLBACK");
  assert.deepEqual(plan.selectedSuiteIds, ["browser.access-sentinel", "unit.unrelated"]);
});
