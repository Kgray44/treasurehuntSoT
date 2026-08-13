import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildArtifacts } from "../../scripts/deepwater/lib.mjs";
import {
  buildPhase5Governance,
  compareSnapshots,
  phase5SemanticDigest,
  validateImpactDeclaration,
  validatePhase5Governance,
} from "../../scripts/deepwater/phase5.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const artifacts = await buildArtifacts(root);
const baseline = await buildPhase5Governance(root, artifacts);
const clone = (value) => structuredClone(value);
const includes = (errors, fragment) =>
  assert.ok(
    errors.some((error) => error.includes(fragment)),
    errors.join("\n"),
  );

test("Phase 5 baseline is deterministic and reconciles every Feature Catalog entry", async () => {
  const second = await buildPhase5Governance(root, artifacts);
  assert.equal(phase5SemanticDigest(baseline), phase5SemanticDigest(second));
  assert.equal(baseline.currentBaseline.capabilityCount, 58);
  assert.ok(baseline.currentBaseline.backendSurfaces.length > 0);
  assert.equal(baseline.delta.deltas.length, 0);
  assert.deepEqual(validatePhase5Governance(baseline), []);
});

test("Phase 5 rejects Feature Catalog entries without Deepwater mapping", () => {
  const candidate = clone(baseline);
  candidate.currentBaseline.inventories.catalogIds.push("FT-UNMAPPED");
  includes(validatePhase5Governance(candidate), "Feature Catalog entry has no Deepwater mapping");
});

test("Phase 5 rejects maturity evidence that lost discoverability, states, accessibility, or journeys", () => {
  const candidate = clone(baseline);
  const capability = candidate.currentBaseline.capabilities.find(
    (item) =>
      item.classification === "FULLY_REALIZED" &&
      item.routes.length &&
      item.requiredStates.length &&
      item.requiredAccessibility.length,
  );
  capability.routes = [];
  capability.states = [];
  capability.accessibility = [];
  capability.journeys = [];
  const errors = validatePhase5Governance(candidate);
  includes(errors, "lacks discoverability");
  includes(errors, "missing required state evidence");
  includes(errors, "missing accessibility evidence");
  includes(errors, "lacks a natural journey");
});

test("Phase 5 rejects invalid route, screen, journey, owner, closure, and restricted-audience references", () => {
  const candidate = clone(baseline);
  const capability = candidate.currentBaseline.capabilities.find(
    (item) => item.routes.length && item.screens.length && item.journeys.length,
  );
  capability.routes = ["route-not-real"];
  capability.screens = ["screen-not-real"];
  capability.journeys = ["journey-not-real"];
  capability.owner = "";
  capability.findings.push({
    findingId: "DW-FIND-CLOSED-WITHOUT-EVIDENCE",
    status: "CLOSED",
    severity: "HIGH",
    closureEvidence: null,
    debt: null,
  });
  const restricted = candidate.currentBaseline.capabilities.find(
    (item) => item.classification === "SECURITY_RESTRICTED",
  );
  restricted.audience = ["VISITOR"];
  const errors = validatePhase5Governance(candidate);
  includes(errors, "nonexistent route");
  includes(errors, "nonexistent screen");
  includes(errors, "nonexistent journey");
  includes(errors, "unknown canonical owner");
  includes(errors, "closed finding lost closure evidence");
  includes(errors, "ordinary-user audience");
});

test("Phase 5 impact declarations fail closed and require a rationale", () => {
  includes(
    validateImpactDeclaration({
      disposition: "NO_REALIZATION_IMPACT",
      affectedCapabilityIds: [],
      affectedFeatureCatalogIds: [],
      rationale: "",
    }),
    "lacks rationale",
  );
  includes(
    validateImpactDeclaration({
      disposition: "CHANGES_EXISTING_CAPABILITY",
      affectedCapabilityIds: [],
      affectedFeatureCatalogIds: [],
      rationale: "change",
    }),
    "lacks affected capability IDs",
  );
});

test("Phase 5 delta engine is deterministic and marks removed capabilities as review-required regressions", () => {
  const current = clone(baseline.currentBaseline);
  current.capabilities = current.capabilities.slice(1);
  const first = compareSnapshots(baseline.currentBaseline, current);
  const second = compareSnapshots(baseline.currentBaseline, current);
  assert.deepEqual(first, second);
  const removed = first.deltas.find((item) => item.code === "CAPABILITY_REMOVED");
  assert.equal(removed?.severity, "HIGH");
  assert.equal(removed?.humanReviewRequired, true);
  assert.equal(removed?.soundingLineEvidenceInvalidated, true);
});

test("Phase 5 identifies unreviewed backend surface drift", () => {
  const current = clone(baseline.currentBaseline);
  current.backendSurfaces = current.backendSurfaces.slice(1);
  const delta = compareSnapshots(baseline.currentBaseline, current);
  const removed = delta.deltas.find((item) => item.code === "BACKEND_SURFACE_REMOVED");
  assert.equal(removed?.severity, "HIGH");
  assert.equal(removed?.owner, "UNASSIGNED");
  assert.equal(removed?.humanReviewRequired, true);
  assert.equal(removed?.soundingLineEvidenceInvalidated, true);
});

test("Phase 5 rejects governed completion records without an impact declaration or with an overclaim", () => {
  const missing = clone(baseline);
  missing.completionRecordAudits = [
    {
      path: "Development_Docs/Programs/Deepwater/Project_Deepwater_Program_Completion_Receipt.md",
      hasImpactDeclaration: false,
      falselyClaimsCompletion: true,
    },
  ];
  const errors = validatePhase5Governance(missing);
  includes(errors, "completion record lacks Deepwater impact declaration");
  includes(errors, "completion record overclaims Project Deepwater completion");
});

test("Phase 5 requires an owner and closure lifecycle for continuous governance blockers", () => {
  const candidate = clone(baseline);
  candidate.config.continuousGovernance.openItems[0].owner = "";
  candidate.config.continuousGovernance.openItems[0].closureRequirement = "";
  candidate.config.continuousGovernance.openItems[0].retryTrigger = "";
  const errors = validatePhase5Governance(candidate);
  includes(errors, "continuous-governance item has incomplete identity or evidence");
  includes(errors, "continuous-governance item lacks closure lifecycle");
  includes(errors, "blocking Phase 5 item lacks owner or closure lifecycle");
});

test("Phase 5 cannot claim a release decision or unauthorized product scope", () => {
  const candidate = clone(baseline);
  candidate.config.releaseAuthority.decisionEmitter = "Deepwater";
  candidate.config.scope.schemaImpact = "PRISMA";
  candidate.config.soundingLinePolicyDigest = "0".repeat(64);
  const errors = validatePhase5Governance(candidate);
  includes(errors, "attempts to claim release authority");
  includes(errors, "unauthorized product schema or business behavior impact");
  includes(errors, "Sounding Line policy identity is stale");
});
