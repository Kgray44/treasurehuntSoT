import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { classifyAuthorityMaintenance } from "../../../scripts/sounding-line/authority-maintenance.mjs";

const root = path.resolve();
const readAuthorityPolicy = async () =>
  JSON.parse(await readFile(path.join(root, "testing", "authority-maintenance-policy.json"), "utf8"));

test("fast-channel bootstrap admits only its exact authority-maintenance modules", async () => {
  const policy = await readAuthorityPolicy();
  const allowed = [
    "scripts/sounding-line/v14-fast-channel.mjs",
    "scripts/sounding-line/v14/fast-channel.mjs",
    "tests/sounding-line/v14/authority-maintenance-fast-channel-policy.test.mjs",
  ];

  assert.equal(policy.version, "1.0.8");
  assert.deepEqual(
    policy.bindingPreflightPaths.filter((entry) => entry.includes("v14") || entry.includes("fast-channel")),
    ["scripts/sounding-line/v14-fast-channel.mjs", "scripts/sounding-line/v14/fast-channel.mjs"],
  );
  assert.equal(policy.bindingPreflightPaths.includes("scripts/foreign-product/bootstrap.mjs"), false);
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
    changedPaths: ["scripts/foreign-product/bootstrap.mjs"],
    ownerAuthorized: true,
  });
  assert.equal(rejected.classification, "AUTHORITY_MAINTENANCE_REJECTED");
  assert.deepEqual(rejected.errors, ["AUTHORITY_MAINTENANCE_SCOPE_REJECTED:scripts/foreign-product/bootstrap.mjs"]);
});
