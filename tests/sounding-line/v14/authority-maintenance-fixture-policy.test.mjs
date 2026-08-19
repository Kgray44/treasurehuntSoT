import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { classifyAuthorityMaintenance } from "../../../scripts/sounding-line/authority-maintenance.mjs";

const root = path.resolve();
const readAuthorityPolicy = async () =>
  JSON.parse(await readFile(path.join(root, "testing", "authority-maintenance-policy.json"), "utf8"));

test("fixture bootstrap admits only the exact validation-runtime maintenance class", async () => {
  const policy = await readAuthorityPolicy();
  const allowed = [
    "scripts/sounding-line/isolated-validation-runtime.ps1",
    "scripts/dev-common.ps1",
    "scripts/test-validation-runtime-safety.ps1",
    "scripts/tideglass/seed-phase3-fixture.mjs",
    "tests/sounding-line/v14/authority-maintenance-fixture-policy.test.mjs",
  ];

  assert.equal(policy.version, "1.0.6");
  assert.deepEqual(
    policy.bindingPreflightPaths.filter(
      (entry) => entry.includes("isolated-validation") || entry.includes("tideglass"),
    ),
    ["scripts/sounding-line/isolated-validation-runtime.ps1", "scripts/tideglass/seed-phase3-fixture.mjs"],
  );
  assert.equal(policy.bindingPreflightPaths.includes("scripts/dev-common.ps1"), true);
  assert.equal(policy.bindingPreflightPaths.includes("scripts/test-validation-runtime-safety.ps1"), true);
  assert.equal(policy.bindingPreflightPaths.includes("scripts/tideglass/unrelated-bootstrap.mjs"), false);
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
    changedPaths: ["scripts/tideglass/unrelated-bootstrap.mjs"],
    ownerAuthorized: true,
  });
  assert.equal(rejected.classification, "AUTHORITY_MAINTENANCE_REJECTED");
  assert.deepEqual(rejected.errors, ["AUTHORITY_MAINTENANCE_SCOPE_REJECTED:scripts/tideglass/unrelated-bootstrap.mjs"]);
});
