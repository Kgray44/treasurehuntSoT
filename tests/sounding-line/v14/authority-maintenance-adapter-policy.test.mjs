import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { classifyAuthorityMaintenance } from "../../../scripts/sounding-line/authority-maintenance.mjs";

const root = path.resolve();
const readAuthorityPolicy = async () =>
  JSON.parse(await readFile(path.join(root, "testing", "authority-maintenance-policy.json"), "utf8"));

test("adapter receipt maintenance is admitted only through the governed policy bootstrap", async () => {
  const policy = await readAuthorityPolicy();
  const allowed = [
    "testing/authority-maintenance-policy.json",
    "scripts/sounding-line/verification-maintenance.mjs",
    "tests/sounding-line/v14/authority-maintenance-adapter-policy.test.mjs",
  ];

  assert.equal(policy.version, "1.0.7");
  assert.equal(policy.eligiblePathGlobs.includes("scripts/sounding-line/adapters.mjs"), true);
  assert.equal(policy.bindingPreflightPaths.includes("scripts/sounding-line/adapters.mjs"), true);
  assert.equal(policy.bindingPreflightPaths.includes("scripts/sounding-line/verification-maintenance.mjs"), true);
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
    changedPaths: ["scripts/sounding-line/unapproved-adapter.mjs"],
    ownerAuthorized: true,
  });
  assert.equal(rejected.classification, "AUTHORITY_MAINTENANCE_REJECTED");
  assert.deepEqual(rejected.errors, [
    "AUTHORITY_MAINTENANCE_SCOPE_REJECTED:scripts/sounding-line/unapproved-adapter.mjs",
  ]);
});
