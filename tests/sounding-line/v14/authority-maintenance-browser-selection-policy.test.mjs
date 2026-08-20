import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { classifyAuthorityMaintenance } from "../../../scripts/sounding-line/authority-maintenance.mjs";

const root = path.resolve();

test("browser selection bootstrap admits only the named trusted planner boundary", async () => {
  const policy = JSON.parse(await readFile(path.join(root, "testing", "authority-maintenance-policy.json"), "utf8"));
  const allowed = [
    "testing/authority-maintenance-policy.json",
    "scripts/sounding-line/planner.mjs",
    "tests/sounding-line/v14/authority-maintenance-browser-selection-policy.test.mjs",
  ];
  assert.equal(policy.version, "1.0.8");
  assert.equal(policy.bindingPreflightPaths.includes("scripts/sounding-line/planner.mjs"), true);
  assert.equal(policy.eligiblePathGlobs.includes("scripts/sounding-line/planner.mjs"), true);
  assert.deepEqual(
    classifyAuthorityMaintenance({ trustedPolicy: policy, changedPaths: allowed, ownerAuthorized: true }),
    {
      classification: "SOUNDING_LINE_AUTHORITY_MAINTENANCE",
      changedPaths: [...allowed].sort(),
      errors: [],
    },
  );
  const rejected = classifyAuthorityMaintenance({
    trustedPolicy: policy,
    changedPaths: ["scripts/sounding-line/unrelated-browser-selector.mjs"],
    ownerAuthorized: true,
  });
  assert.equal(rejected.classification, "AUTHORITY_MAINTENANCE_REJECTED");
  assert.deepEqual(rejected.errors, [
    "AUTHORITY_MAINTENANCE_SCOPE_REJECTED:scripts/sounding-line/unrelated-browser-selector.mjs",
  ]);
});
