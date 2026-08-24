import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { selectV14Mainline } from "../../../scripts/sounding-line/v14/fast-channel.mjs";

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
