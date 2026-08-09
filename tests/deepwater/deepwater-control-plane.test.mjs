import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildArtifacts,
  buildMetrics,
  semanticDigest,
  stableStringify,
  validateModel,
} from "../../scripts/deepwater/lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const baseline = await buildArtifacts(root);

function model() {
  return structuredClone({
    ledger: baseline.ledger,
    findingsDocument: baseline.findingsDocument,
    queueDocument: baseline.queueDocument,
    reconciliationDocument: baseline.reconciliationDocument,
    evidenceIndex: baseline.evidenceIndex,
    inputs: baseline.inputs,
  });
}

function errorsFor(candidate) {
  return validateModel(candidate);
}

function includesError(errors, text) {
  assert.ok(
    errors.some((error) => error.includes(text)),
    `Expected error containing ${text}; received ${errors.join(" | ")}`,
  );
}

test("valid generated ledger and references are accepted", () => {
  assert.deepEqual(errorsFor(model()), []);
});

test("duplicate capability IDs are rejected", () => {
  const candidate = model();
  candidate.ledger.capabilities.push(structuredClone(candidate.ledger.capabilities[0]));
  includesError(errorsFor(candidate), "duplicate capability IDs");
});

test("missing owner is rejected", () => {
  const candidate = model();
  delete candidate.ledger.capabilities[0].owner.project;
  includesError(errorsFor(candidate), "missing owner");
});

test("missing terminal rung is rejected", () => {
  const candidate = model();
  delete candidate.ledger.capabilities[0].expectedRealization.terminalRung;
  includesError(errorsFor(candidate), "terminal rung");
});

test("invalid classification is rejected", () => {
  const candidate = model();
  candidate.ledger.capabilities[0].currentRealization.classification = "KINDA_DONE";
  includesError(errorsFor(candidate), "invalid classification");
});

test("invalid secondary flag is rejected", () => {
  const candidate = model();
  candidate.ledger.capabilities[0].currentRealization.secondaryFlags.push("MAYBE_FINE");
  includesError(errorsFor(candidate), "invalid secondary flag");
});

test("known ownership map entry is accepted", () => {
  const candidate = model();
  const capability = candidate.ledger.capabilities.find((entry) => entry.owner.project === "Wayfarer");
  assert.ok(capability);
  assert.ok(!errorsFor(candidate).some((error) => error.includes(capability.capabilityId)));
});

test("unknown owner is rejected unless explicitly ambiguous", () => {
  const candidate = model();
  candidate.ledger.capabilities[0].owner.project = "Invented Project";
  includesError(errorsFor(candidate), "unknown owner");
});

test("ownership-map contract mismatch is detected", () => {
  const candidate = model();
  candidate.ledger.capabilities[0].owner.contract = "Competing authority";
  includesError(errorsFor(candidate), "ownership-map contract mismatch");
});

test("user-facing FULLY_REALIZED without navigation and journey evidence is rejected", () => {
  const candidate = model();
  const capability = candidate.ledger.capabilities.find(
    (entry) => entry.capabilityId === "DW-CAP-ACCOUNT-EMAIL-CHANGE",
  );
  capability.currentRealization.classification = "FULLY_REALIZED";
  capability.currentRealization.highestRung = capability.expectedRealization.terminalRung;
  capability.trace.navigation.status = "ABSENT";
  capability.evidence.journeyIds = [];
  includesError(errorsFor(candidate), "lacks navigation/journey evidence");
});

test("FULLY_REALIZED with an open blocking finding is rejected", () => {
  const candidate = model();
  const capability = candidate.ledger.capabilities.find(
    (entry) => entry.capabilityId === "DW-CAP-INTEGRATED-WHOLE-PRODUCT-VOYAGE",
  );
  capability.currentRealization.classification = "FULLY_REALIZED";
  capability.currentRealization.highestRung = "OWNER_ACCEPTED";
  capability.trace.navigation.status = "VERIFIED";
  capability.evidence.journeyIds = ["HP-P7-JRN-A"];
  includesError(errorsFor(candidate), "open blocking finding");
});

test("intentional internal capability with rationale is accepted", () => {
  const candidate = model();
  const capability = candidate.ledger.capabilities.find(
    (entry) => entry.capabilityId === "DW-CAP-COMMUNITY-WORKER-SCHEDULER",
  );
  assert.equal(capability.currentRealization.classification, "INTERNAL_BY_DESIGN");
  assert.ok(capability.expectedRealization.rationale.length > 0);
  assert.ok(!errorsFor(candidate).some((error) => error.includes(capability.capabilityId)));
});

test("restricted capability with approved audience and rationale is accepted", () => {
  const candidate = model();
  const capability = candidate.ledger.capabilities.find(
    (entry) => entry.capabilityId === "DW-CAP-PRIVATE-REPAIR-OPERATIONS",
  );
  assert.equal(capability.currentRealization.classification, "SECURITY_RESTRICTED");
  assert.ok(capability.audience.roles.length > 0);
  assert.ok(capability.expectedRealization.rationale.length > 0);
  assert.ok(!errorsFor(candidate).some((error) => error.includes(capability.capabilityId)));
});

test("finding referencing an unknown capability is rejected", () => {
  const candidate = model();
  candidate.findingsDocument.findings[0].capabilityId = "DW-CAP-NOT-REAL";
  includesError(errorsFor(candidate), "invalid capability reference");
});

test("closed finding requires closure evidence", () => {
  const candidate = model();
  const finding = candidate.findingsDocument.findings[0];
  finding.status = "CLOSED";
  finding.closedAt = null;
  finding.closureEvidence = "";
  includesError(errorsFor(candidate), "closed finding lacks closure evidence");
});

test("accepted debt requires owner, reason, and expiry or trigger", () => {
  const candidate = model();
  const finding = candidate.findingsDocument.findings[0];
  finding.status = "DEBT_ACCEPTED";
  finding.debt = { owner: "", reason: "", expiry: null, trigger: null };
  includesError(errorsFor(candidate), "debt record lacks owner/reason/expiry or trigger");
});

test("privacy scan rejects credential-like values", () => {
  const candidate = model();
  candidate.ledger.capabilities[0].evidence.references[0].reference = "password=supersecretvalue";
  includesError(errorsFor(candidate), "privacy scan matched forbidden pattern");
});

test("same accepted inputs generate stable semantic output", async () => {
  const second = await buildArtifacts(root);
  assert.equal(semanticDigest(baseline), semanticDigest(second));
  assert.equal(stableStringify(baseline.ledger), stableStringify(second.ledger));
  assert.deepEqual(
    baseline.ledger.capabilities.map((capability) => capability.capabilityId),
    [...baseline.ledger.capabilities.map((capability) => capability.capabilityId)].sort(),
  );
});

test("known capability IDs remain semantic and stable", () => {
  const ids = new Set(baseline.ledger.capabilities.map((capability) => capability.capabilityId));
  for (const id of [
    "DW-CAP-UNIFIED-IDENTITY-SESSION-AUTHORITY",
    "DW-CAP-INTEGRATED-WHOLE-PRODUCT-VOYAGE",
    "DW-CAP-PRIVATE-PROVIDER-HEALTH",
    "DW-CAP-COMMUNITY-WORKER-SCHEDULER",
  ])
    assert.ok(ids.has(id), `missing stable capability ID ${id}`);
});

test("every Feature Catalog entry maps exactly once", () => {
  const mapped = baseline.ledger.capabilities
    .map((capability) => capability.catalogMapping?.featureCatalogId)
    .filter(Boolean);
  assert.equal(mapped.length, baseline.inputs.catalog.length);
  assert.equal(new Set(mapped).size, baseline.inputs.catalog.length);
});

test("Feature Catalog mapping coverage uses the accepted catalog denominator", () => {
  const oneMappedCapability = baseline.ledger.capabilities.find((capability) => capability.catalogMapping !== null);
  const metrics = buildMetrics([oneMappedCapability], [], 2);
  assert.equal(metrics.ratios.featureCatalogMappingCoverage, 0.5);
});

test("catalog surface missing from accepted route inventory is identified", () => {
  const entry = baseline.reconciliationDocument.entries.find((candidate) => candidate.featureCatalogId === "FT-015");
  assert.equal(entry.documentationMismatch, true);
  assert.ok(entry.mismatchFindingIds.includes("DW-FIND-CATALOG-SURFACE-FT-015"));
});

test("meaningful uncataloged implementation is reported", () => {
  const uncataloged = baseline.ledger.capabilities.filter((capability) => capability.catalogMapping === null);
  assert.equal(uncataloged.length, 12);
  assert.ok(uncataloged.some((capability) => capability.capabilityId === "DW-CAP-TRANSACTIONAL-EMAIL-DELIVERY"));
});

test("catalog maturity and observed realization mismatch remains visible", () => {
  const capability = baseline.ledger.capabilities.find(
    (entry) => entry.capabilityId === "DW-CAP-INTEGRATED-WHOLE-PRODUCT-VOYAGE",
  );
  assert.equal(capability.catalogMapping.declaredStatus, "MAINLINE");
  assert.equal(capability.currentRealization.classification, "PARTIALLY_REALIZED");
  assert.equal(capability.evidence.ownerAcceptance, "PENDING_OWNER_DECISION");
});
