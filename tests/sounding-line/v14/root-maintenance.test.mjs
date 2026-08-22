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
} from "../../../scripts/sounding-line/root-maintenance.mjs";
import { selectSealedRootMaintenance } from "../../../scripts/sounding-line/root-maintenance-selection.mjs";

const sha = (letter) => letter.repeat(40);
const rootPolicy = {
  authority: "SOUNDING_LINE_ROOT_MAINTENANCE",
  disposition: "ROOT_MAINTENANCE_GO",
  workflowDispatchOnly: true,
  trustedMainOnly: true,
  ownerAuthorization: "REPOSITORY_OWNER_WORKFLOW_DISPATCH",
  releaseAuthority: "NONE",
  eligiblePathGlobs: ["scripts/sounding-line/**", "testing/root-maintenance-policy.json", "tests/sounding-line/**"],
  requiredEvidence: ["ROOT_ANTI_SELF_AUTHORIZATION"],
};

const planFor = (paths = ["scripts/sounding-line/root-maintenance.mjs"]) =>
  createRootMaintenancePlan({
    trustedPolicy: rootPolicy,
    trustedMainSha: sha("a"),
    candidateSha: sha("b"),
    candidateTree: sha("c"),
    qualifiedBaseSha: sha("a"),
    prNumber: 412,
    changedPaths: paths,
    ownerAuthorized: true,
  });

test("Root Maintenance is owner-only, non-product, and bound to trusted-base scope", () => {
  assert.equal(planFor().errors.length, 0);
  assert.match(planFor().planDigest, /^[0-9a-f]{64}$/u);
  assert.ok(planFor(["src/app/page.tsx"]).errors.includes("ROOT_MAINTENANCE_SCOPE_REJECTED:src/app/page.tsx"));
  assert.ok(
    createRootMaintenancePlan({
      trustedPolicy: rootPolicy,
      trustedMainSha: sha("a"),
      candidateSha: sha("b"),
      candidateTree: sha("c"),
      qualifiedBaseSha: sha("a"),
      prNumber: 412,
      changedPaths: ["scripts/sounding-line/root-maintenance.mjs"],
      ownerAuthorized: false,
    }).errors.includes("ROOT_MAINTENANCE_OWNER_AUTHORIZATION_REQUIRED"),
  );
});

test("Root Maintenance cannot self-authorize scope, replay an authority, or bind a changed identity", () => {
  const plan = planFor();
  const evidence = [{ id: "ROOT_ANTI_SELF_AUTHORIZATION", result: "PASSED", candidateSha: sha("b") }];
  const finalized = finalizeRootMaintenance({
    plan,
    evidence,
    observedCandidateSha: sha("b"),
    observedTrustedMainSha: sha("a"),
    observedPrNumber: 412,
  });
  assert.equal(finalized.decision, "ROOT_MAINTENANCE_GO");
  assert.equal(
    finalizeRootMaintenance({
      plan,
      evidence,
      observedCandidateSha: sha("d"),
      observedTrustedMainSha: sha("a"),
      observedPrNumber: 412,
    }).decision,
    "ROOT_MAINTENANCE_NO_GO",
  );
  assert.equal(
    selectSealedRootMaintenance({
      runs: [
        {
          id: 10,
          name: `Sounding Line root maintenance ${sha("b")}`,
          path: ".github/workflows/sounding-line-root-maintenance.yml",
          event: "workflow_dispatch",
          status: "completed",
          conclusion: "success",
          headSha: sha("b"),
          plan,
          finalization: finalized,
        },
      ],
      candidateSha: sha("b"),
      candidateTree: sha("c"),
      qualifiedBaseSha: sha("a"),
      prNumber: 412,
    }).decision,
    "ROOT_MAINTENANCE_AUTHORITY_SELECTED",
  );
  const selected = selectSealedRootMaintenance({
    runs: [
      {
        id: 8,
        name: "Sounding Line root maintenance",
        path: ".github/workflows/sounding-line-root-maintenance.yml",
        event: "workflow_dispatch",
        status: "completed",
        conclusion: "success",
        headSha: sha("b"),
        plan,
        finalization: finalized,
      },
    ],
    candidateSha: sha("b"),
    candidateTree: sha("c"),
    qualifiedBaseSha: sha("a"),
    prNumber: 412,
  });
  assert.equal(selected.decision, "ROOT_MAINTENANCE_AUTHORITY_SELECTED");
  assert.equal(
    selectSealedRootMaintenance({
      runs: [
        {
          id: 8,
          name: "Sounding Line root maintenance",
          path: ".github/workflows/sounding-line-root-maintenance.yml",
          event: "workflow_dispatch",
          status: "completed",
          conclusion: "success",
          headSha: sha("b"),
          plan,
          finalization: finalized,
        },
        {
          id: 9,
          name: "Sounding Line root maintenance",
          path: ".github/workflows/sounding-line-root-maintenance.yml",
          event: "workflow_dispatch",
          status: "completed",
          conclusion: "success",
          headSha: sha("b"),
          plan,
          finalization: finalized,
        },
      ],
      candidateSha: sha("b"),
      candidateTree: sha("c"),
      qualifiedBaseSha: sha("a"),
      prNumber: 412,
    }).decision,
    "SEALED_ROOT_MAINTENANCE_AUTHORITY_NOT_UNIQUE",
  );
  assert.equal(
    selectSealedRootMaintenance({
      runs: [],
      candidateSha: sha("b"),
      candidateTree: sha("c"),
      qualifiedBaseSha: sha("a"),
      prNumber: 412,
    }).decision,
    "SEALED_ROOT_MAINTENANCE_AUTHORITY_NOT_UNIQUE",
  );
  assert.equal(
    qualifyRootMaintenanceProtectedMerge({
      plan,
      finalization: finalized,
      candidateSha: sha("b"),
      currentBaseSha: sha("a"),
      mergeSha: sha("d"),
      mergeTree: sha("c"),
      mergeParents: [sha("a"), sha("b")],
      prNumber: 412,
    }).decision,
    "BINDING_PASS",
  );
  assert.equal(
    qualifyRootMaintenanceProtectedMerge({
      plan,
      finalization: finalized,
      candidateSha: sha("b"),
      currentBaseSha: sha("a"),
      mergeSha: sha("d"),
      mergeTree: sha("c"),
      mergeParents: [sha("a"), sha("b")],
      prNumber: 413,
    }).decision,
    "BINDING_NO_GO",
  );
});

test("repair-route inventory is built from actual baseline/workflow sources and fails unknown additions", async () => {
  const inventory = await buildRepairRouteInventory();
  assert.equal(inventory.errors.length, 0);
  assert.equal(inventory.prerequisiteCount, inventory.repairRouteCount);
  assert.equal(inventory.executableRoutes.lanes.ROOT_MAINTENANCE.complete, true);
  assert.equal(
    classifyRepairRoute({ file: "src/app/page.tsx", rootPolicy, authorityPolicy: {}, verificationPolicy: {} }),
    null,
  );
  const uncovered = await buildRepairRouteInventory(process.cwd(), ["unmapped-control-plane/new-prerequisite.mjs"]);
  assert.deepEqual(uncovered.errors, [
    "CONTROL_PLANE_REPAIR_ROUTE_INCOMPLETE:unmapped-control-plane/new-prerequisite.mjs",
  ]);
  const policy = JSON.parse(await readFile("testing/control-plane-repair-routes.json", "utf8"));
  const dispatcher = await readFile(".github/workflows/sounding-line-protected-binding-dispatch.yml", "utf8");
  const preFix = await validateExecutableRepairRoutes({
    inventoryPolicy: policy,
    readText: async (relative) =>
      relative === ".github/workflows/sounding-line-protected-binding-dispatch.yml"
        ? dispatcher.replaceAll("root_maintenance", "ordinary_only")
        : readFile(relative, "utf8"),
  });
  assert.ok(preFix.errors.includes("CONTROL_PLANE_REPAIR_ROUTE_INCOMPLETE:ROOT_MAINTENANCE:PROTECTED_BINDING"));
  const workflow = await readFile(
    new URL("../../../.github/workflows/sounding-line-root-maintenance.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /REPOSITORY_OWNER/);
  assert.match(workflow, /ROOT_MAINTENANCE_TRUSTED_MAIN_STALE/);
});
