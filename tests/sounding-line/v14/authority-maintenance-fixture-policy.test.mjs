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

  assert.equal(policy.version, "1.0.8");
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

test("focused browser Studio fixture normalization is bounded to the disposable runtime copy", async () => {
  const runtime = await readFile(
    path.join(root, "scripts", "sounding-line", "isolated-validation-runtime.ps1"),
    "utf8",
  );
  assert.match(runtime, /function Repair-FocusedBrowserStudioFixture/u);
  assert.match(runtime, /FOCUSED_BROWSER_STUDIO_FIXTURE_CURRENT/u);
  assert.match(runtime, /--experimental-sqlite/u);
  assert.match(runtime, /\.sounding-line-focused-browser-studio-fixture\.mjs/u);
  assert.match(
    runtime,
    /\[System\.IO\.File\]::WriteAllText\(\$normalizerPath, \$normalizer, \[System\.Text\.UTF8Encoding\]::new\(\$false\)\)/u,
  );
  assert.doesNotMatch(runtime, /Set-Content[^\r\n]*utf8NoBOM/u);
  assert.match(runtime, /Remove-Item -LiteralPath \$normalizerPath/u);
  assert.doesNotMatch(runtime, /"--eval"/u);
  assert.match(
    runtime,
    /Seeding focused browser development fixture[\s\S]*Repair-FocusedBrowserStudioFixture[\s\S]*Migrating focused browser legacy compatibility projection/u,
  );
  assert.match(runtime, /development-studio-voyage/u);
  assert.match(runtime, /FOCUSED_BROWSER_STUDIO_FIXTURE_TALE_MISSING/u);
});
