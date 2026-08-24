import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildRepairRouteInventory,
  classifyRepairRoute,
  validateExecutableRepairRoutes,
} from "../../../scripts/sounding-line/control-plane-repair-routes.mjs";
import { qualifyRootMaintenanceProtectedMerge } from "../../../scripts/sounding-line/root-maintenance-protected-binding.mjs";
import {
  createRootMaintenancePlan,
  finalizeRootMaintenance,
  rootMaintenanceEligiblePathGlobs,
} from "../../../scripts/sounding-line/root-maintenance.mjs";

const sha = (letter) => letter.repeat(40);
const rootPolicy = {
  authority: "SOUNDING_LINE_ROOT_MAINTENANCE",
  disposition: "ROOT_MAINTENANCE_GO",
  workflowDispatchOnly: true,
  trustedMainOnly: true,
  ownerAuthorization: "REPOSITORY_OWNER_WORKFLOW_DISPATCH",
  releaseAuthority: "NONE",
  eligiblePathGlobs: ["scripts/sounding-line/**", "testing/root-maintenance-policy.json", "tests/sounding-line/**"],
  runtimeRepairClasses: [
    {
      id: "NIGHTWATCH_BOSUN_RUNTIME",
      disposition: "ROOT_MAINTENANCE_ONLY",
      policyMutation: "BREAK_GLASS_ONLY",
      pathGlobs: ["src/nightwatch/**", "scripts/nightwatch/**"],
    },
  ],
  requiredEvidence: ["ROOT_ANTI_SELF_AUTHORIZATION"],
};

const planFor = (paths = ["scripts/sounding-line/root-maintenance-bind.mjs"]) =>
  createRootMaintenancePlan({
    trustedPolicy: rootPolicy,
    trustedMainSha: sha("a"),
    candidateSha: sha("b"),
    candidateTree: sha("c"),
    qualifiedBaseSha: sha("a"),
    prNumber: 413,
    changedPaths: paths,
    ownerAuthorized: true,
  });

test("Root Maintenance remains owner-only, non-product, and exact-merge bound", () => {
  const plan = planFor();
  assert.equal(plan.errors.length, 0);
  assert.match(plan.planDigest, /^[0-9a-f]{64}$/u);
  assert.ok(planFor(["src/app/page.tsx"]).errors.includes("ROOT_MAINTENANCE_SCOPE_REJECTED:src/app/page.tsx"));
  assert.equal(planFor(["src/nightwatch/future-runtime.ts"]).errors.length, 0);
  assert.equal(planFor(["scripts/nightwatch/future-runtime.ts"]).errors.length, 0);
  assert.deepEqual(rootMaintenanceEligiblePathGlobs(rootPolicy).slice(-2), [
    "src/nightwatch/**",
    "scripts/nightwatch/**",
  ]);
  assert.ok(
    createRootMaintenancePlan({
      trustedPolicy: rootPolicy,
      trustedMainSha: sha("a"),
      candidateSha: sha("b"),
      candidateTree: sha("c"),
      qualifiedBaseSha: sha("a"),
      prNumber: 413,
      changedPaths: ["scripts/sounding-line/root-maintenance-bind.mjs"],
      ownerAuthorized: false,
    }).errors.includes("ROOT_MAINTENANCE_OWNER_AUTHORIZATION_REQUIRED"),
  );
  const evidence = [{ id: "ROOT_ANTI_SELF_AUTHORIZATION", result: "PASSED", candidateSha: sha("b") }];
  const finalization = finalizeRootMaintenance({
    plan,
    evidence,
    observedCandidateSha: sha("b"),
    observedTrustedMainSha: sha("a"),
    observedPrNumber: 413,
  });
  assert.equal(finalization.decision, "ROOT_MAINTENANCE_GO");
  assert.equal(
    qualifyRootMaintenanceProtectedMerge({
      plan,
      finalization,
      candidateSha: sha("b"),
      currentBaseSha: sha("a"),
      mergeSha: sha("d"),
      mergeTree: sha("c"),
      mergeParents: [sha("a"), sha("b")],
      prNumber: 413,
    }).decision,
    "BINDING_PASS",
  );
});

test("repair-route inventory maps normal Bosun work separately from compatibility control recovery", async () => {
  const inventory = await buildRepairRouteInventory();
  assert.equal(inventory.errors.length, 0);
  assert.equal(inventory.prerequisiteCount, inventory.repairRouteCount);
  assert.equal(inventory.executableRoutes.lanes.CONTROL_PLANE_CHANGE.complete, true);
  assert.equal(inventory.executableRoutes.lanes.BREAK_GLASS.complete, true);
  assert.equal(
    inventory.paths.find((entry) => entry.file === "src/nightwatch/bosun.ts")?.classification,
    "ORDINARY",
  );
  assert.equal(
    inventory.paths.find((entry) => entry.file === "scripts/nightwatch/cli.ts")?.classification,
    "CONTROL_PLANE_CHANGE",
  );
  assert.equal(
    classifyRepairRoute({ file: "src/nightwatch/future-runtime.ts", rootPolicy, authorityPolicy: {}, verificationPolicy: {} }),
    "CONTROL_PLANE_CHANGE",
  );
  assert.equal(
    classifyRepairRoute({ file: "scripts/nightwatch/future-runtime.ts", rootPolicy, authorityPolicy: {}, verificationPolicy: {} }),
    "CONTROL_PLANE_CHANGE",
  );
  assert.equal(classifyRepairRoute({ file: "src/app/page.tsx", rootPolicy, authorityPolicy: {}, verificationPolicy: {} }), null);
  const candidateExpandedPolicy = {
    ...rootPolicy,
    runtimeRepairClasses: [
      ...rootPolicy.runtimeRepairClasses,
      { id: "PRODUCT_ESCAPE", pathGlobs: ["src/app/**"] },
    ],
  };
  assert.ok(rootMaintenanceEligiblePathGlobs(candidateExpandedPolicy).includes("src/app/**"));
  assert.ok(
    planFor(["testing/root-maintenance-policy.json", "src/app/page.tsx"]).errors.includes(
      "ROOT_MAINTENANCE_SCOPE_REJECTED:src/app/page.tsx",
    ),
  );
  const uncovered = await buildRepairRouteInventory(process.cwd(), ["unmapped-control-plane/new-prerequisite.mjs"]);
  assert.deepEqual(uncovered.errors, ["CONTROL_PLANE_REPAIR_ROUTE_INCOMPLETE:unmapped-control-plane/new-prerequisite.mjs"]);
  const policy = JSON.parse(await readFile("testing/control-plane-repair-routes.json", "utf8"));
  const dispatcher = await readFile(".github/workflows/sounding-line-protected-binding-dispatch.yml", "utf8");
  const missingHelper = await validateExecutableRepairRoutes({
    inventoryPolicy: policy,
    readText: async (relative) =>
      relative === ".github/workflows/sounding-line-protected-binding-dispatch.yml"
        ? dispatcher.replaceAll("trusted-root-maintenance-bind.mjs", "missing-root-maintenance-bind.mjs")
        : readFile(relative, "utf8"),
  });
  assert.ok(missingHelper.errors.includes("CONTROL_PLANE_REPAIR_ROUTE_INCOMPLETE:CONTROL_PLANE_CHANGE:ARTIFACT_HANDSHAKE"));
  const qualification = await readFile(".github/workflows/sounding-line-root-maintenance.yml", "utf8");
  assert.match(qualification, /root-maintenance-envelope\.json/u);
  assert.match(qualification, /tests\/sounding-line\/runtime-conformance\.test\.mjs/u);
  assert.match(qualification, /tests\/sounding-line\/v14\/ledgerlight-generated-state\.test\.mjs/u);
  assert.match(qualification, /REPOSITORY_OWNER/);
  assert.match(qualification, /ROOT_MAINTENANCE_TRUSTED_MAIN_STALE/);
  assert.match(qualification, /node scripts\/deepwater\/cli\.mjs audit\s+node scripts\/deepwater\/cli\.mjs validate/u);
  assert.doesNotMatch(qualification, /scripts\/deepwater\/cli\.mjs generate/u);
  assert.doesNotMatch(dispatcher, /root-maintenance-selection\.mjs|root-maintenance-artifact\.mjs|\[int\]\$env:AUTHORITY_RUN_ID/u);
});
