import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { classifyAuthorityMaintenance } from "../../../scripts/sounding-line/authority-maintenance.mjs";

const root = path.resolve();
const readAuthorityPolicy = async () =>
  JSON.parse(await readFile(path.join(root, "testing", "authority-maintenance-policy.json"), "utf8"));

test("the deterministic documentation index is authority-maintenance eligible without admitting migration matrices", async () => {
  const policy = await readAuthorityPolicy();
  const allowed = [
    "Development_Docs/document-index.json",
    "tests/sounding-line/v14/authority-maintenance-document-index-policy.test.mjs",
  ];

  assert.equal(policy.eligiblePathGlobs.includes("Development_Docs/document-index.json"), true);
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
    changedPaths: ["Development_Docs/Project_Ledgerlight_Documentation_Migration_Matrix.csv"],
    ownerAuthorized: true,
  });
  assert.equal(rejected.classification, "AUTHORITY_MAINTENANCE_REJECTED");
  assert.deepEqual(rejected.errors, [
    "AUTHORITY_MAINTENANCE_SCOPE_REJECTED:Development_Docs/Project_Ledgerlight_Documentation_Migration_Matrix.csv",
  ]);
});
