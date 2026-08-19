import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { classifyAuthorityMaintenance } from "../../../scripts/sounding-line/authority-maintenance.mjs";

const root = path.resolve();

test("impact-map governance-documentation routing is admitted only through authority maintenance", async () => {
  const policy = JSON.parse(await readFile(path.join(root, "testing", "authority-maintenance-policy.json"), "utf8"));
  const allowed = [
    "testing/authority-maintenance-policy.json",
    "testing/impact-map.json",
    "tests/sounding-line/v14/authority-maintenance-impact-map-policy.test.mjs",
  ];

  assert.equal(policy.version, "1.0.9");
  assert.equal(policy.bindingPreflightPaths.includes("testing/impact-map.json"), true);
  assert.equal(policy.eligiblePathGlobs.includes("testing/impact-map.json"), true);
  assert.deepEqual(
    classifyAuthorityMaintenance({ trustedPolicy: policy, changedPaths: allowed, ownerAuthorized: true }),
    {
      classification: "SOUNDING_LINE_AUTHORITY_MAINTENANCE",
      changedPaths: [...allowed].sort(),
      errors: [],
    },
  );
  assert.equal(
    classifyAuthorityMaintenance({
      trustedPolicy: policy,
      changedPaths: ["testing/impact-map-unapproved.json"],
      ownerAuthorized: true,
    }).classification,
    "AUTHORITY_MAINTENANCE_REJECTED",
  );
});
