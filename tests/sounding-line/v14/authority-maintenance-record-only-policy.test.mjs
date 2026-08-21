import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { classifyAuthorityMaintenance } from "../../../scripts/sounding-line/authority-maintenance.mjs";

const root = path.resolve();

test("record-only authority closure repair is admitted only through the governed authority-maintenance lane", async () => {
  const policy = JSON.parse(await readFile(path.join(root, "testing", "authority-maintenance-policy.json"), "utf8"));
  const allowed = [
    "scripts/sounding-line/record-only-closure.mjs",
    "tests/sounding-line/record-only-closure.test.mjs",
    "testing/generated/active-test-registry.json",
  ];

  assert.equal(policy.version, "1.0.8");
  assert.equal(policy.eligiblePathGlobs.includes("scripts/sounding-line/record-only-closure.mjs"), true);
  assert.equal(policy.bindingPreflightPaths.includes("scripts/sounding-line/record-only-closure.mjs"), true);
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
    changedPaths: ["scripts/sounding-line/unapproved-record-only-repair.mjs"],
    ownerAuthorized: true,
  });
  assert.equal(rejected.classification, "AUTHORITY_MAINTENANCE_REJECTED");
});
