import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildArtifacts,
  buildMetrics,
  semanticDigest,
  stableStringify,
  validatePhase2Model,
  validatePhase3Model,
  validatePhase4Model,
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

function phase2Model() {
  return structuredClone(baseline.phase2);
}

function phase2Errors(candidate) {
  return validatePhase2Model(candidate);
}

function includesError(errors, text) {
  assert.ok(
    errors.some((error) => error.includes(text)),
    `Expected error containing ${text}; received ${errors.join(" | ")}`,
  );
}

function phase3Model() {
  return structuredClone(baseline);
}

function phase3Errors(candidate) {
  return validatePhase3Model(candidate);
}

function phase4Model() {
  return structuredClone(baseline);
}

function phase4Errors(candidate) {
  return validatePhase4Model(candidate);
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

test("Phase 3 rebuild preserves the accepted Phase 2 finding baseline", async () => {
  assert.equal(baseline.metrics.findings.startingOpen, 20);
  const acceptedPhase2Finding = baseline.phase2.findingsDocument.findings.find(
    (finding) => finding.findingId === "DW-FIND-CATALOG-SURFACE-FT-005",
  );
  assert.equal(acceptedPhase2Finding.status, "ASSIGNED");
  assert.equal(acceptedPhase2Finding.closedAt, null);
  const transitionedFinding = baseline.findingsDocument.findings.find(
    (finding) => finding.findingId === "DW-FIND-CATALOG-SURFACE-FT-005",
  );
  assert.equal(transitionedFinding.status, "CLOSED");
  assert.equal(transitionedFinding.from, undefined);

  const second = await buildArtifacts(root);
  assert.equal(second.metrics.findings.startingOpen, 20);
  assert.equal(semanticDigest(second), semanticDigest(baseline));
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

test("Phase 2 accounts for every seed queue item exactly once", () => {
  assert.equal(baseline.tracesDocument.queueItemCount, 44);
  assert.equal(baseline.tracesDocument.traceCount, 43);
  assert.ok(
    !baseline.remediationDocument.packages.some(
      (packet) => packet.capabilityId === "DW-CAP-PLATFORM-ADMINISTRATION-SUPPORT-ACCESS",
    ),
  );
  assert.deepEqual(phase2Errors(phase2Model()), []);
});

test("Phase 2 rejects an accepted queue item omitted from trace policy", () => {
  const candidate = phase2Model();
  const omittedCapabilityId = candidate.phase1.queueDocument.queue.find((item) =>
    candidate.inputs.phase2Config.tracePolicies.some((policy) => policy.capabilityId === item.capabilityId),
  ).capabilityId;
  candidate.inputs.phase2Config.tracePolicies = candidate.inputs.phase2Config.tracePolicies.filter(
    (policy) => policy.capabilityId !== omittedCapabilityId,
  );
  includesError(phase2Errors(candidate), "trace policy omits accepted seed queue item");
});

test("Phase 2 rejects an unexplained UNKNOWN layer", () => {
  const candidate = phase2Model();
  const trace = candidate.tracesDocument.traces[0];
  trace.layers.service.status = "UNKNOWN";
  trace.layers.service.uncertainty = null;
  includesError(phase2Errors(candidate), "UNKNOWN is not bounded");
});

test("Phase 2 rejects a PARTIAL layer without a linked finding", () => {
  const candidate = phase2Model();
  const trace = candidate.tracesDocument.traces.find(
    (entry) => entry.identity.capabilityId === "DW-CAP-VERIFICATION-PROVIDER-FRAMEWORK",
  );
  trace.layers.service.linkedFindingIds = [];
  includesError(phase2Errors(candidate), "PARTIAL has no linked finding");
});

test("Phase 2 rejects an ABSENT layer without a linked finding", () => {
  const candidate = phase2Model();
  const trace = candidate.tracesDocument.traces.find(
    (entry) => entry.identity.capabilityId === "DW-CAP-TRANSACTIONAL-EMAIL-DELIVERY",
  );
  trace.layers.projection.linkedFindingIds = [];
  includesError(phase2Errors(candidate), "ABSENT has no linked finding");
});

test("Phase 2 rejects user-facing navigation without a conclusion", () => {
  const candidate = phase2Model();
  const trace = candidate.tracesDocument.traces.find(
    (entry) => entry.identity.capabilityId === "DW-CAP-CREATOR-STUDIO",
  );
  trace.layers.navigation.status = "UNKNOWN";
  includesError(phase2Errors(candidate), "user-facing navigation is unevaluated");
});

test("Phase 2 rejects missing state evaluation", () => {
  const candidate = phase2Model();
  delete candidate.tracesDocument.traces[0].stateModel.conclusion;
  includesError(phase2Errors(candidate), "state requirements are not evaluated");
});

test("Phase 2 rejects unevaluated restricted authorization", () => {
  const candidate = phase2Model();
  const trace = candidate.tracesDocument.traces.find(
    (entry) => entry.identity.capabilityId === "DW-CAP-PRIVATE-PROVIDER-HEALTH",
  );
  trace.layers.authorization.status = "UNKNOWN";
  includesError(phase2Errors(candidate), "restricted authorization is unevaluated");
});

test("Phase 2 rejects unevaluated audience projection", () => {
  const candidate = phase2Model();
  candidate.tracesDocument.traces[0].layers.projection.status = "UNKNOWN";
  includesError(phase2Errors(candidate), "audience projection is unevaluated");
});

test("Phase 2 rejects an incomplete capability without a first loss point", () => {
  const candidate = phase2Model();
  const trace = candidate.tracesDocument.traces.find(
    (entry) => entry.identity.capabilityId === "DW-CAP-TRANSACTIONAL-EMAIL-DELIVERY",
  );
  trace.analysis.firstLossPoint = null;
  includesError(phase2Errors(candidate), "incomplete capability has no first loss point");
});

test("Phase 2 rejects an incomplete capability without a root cause", () => {
  const candidate = phase2Model();
  const trace = candidate.tracesDocument.traces.find(
    (entry) => entry.identity.capabilityId === "DW-CAP-TRANSACTIONAL-EMAIL-DELIVERY",
  );
  trace.analysis.rootCause = "";
  includesError(phase2Errors(candidate), "incomplete capability has no root cause");
});

test("Phase 2 rejects a remediation packet with an unknown capability", () => {
  const candidate = phase2Model();
  candidate.remediationDocument.packages[0].capabilityId = "DW-CAP-NOT-REAL";
  includesError(phase2Errors(candidate), "unknown capability");
});

test("Phase 2 rejects a remediation packet with an unknown finding", () => {
  const candidate = phase2Model();
  candidate.remediationDocument.packages[0].findingIds = ["DW-FIND-NOT-REAL"];
  includesError(phase2Errors(candidate), "unknown finding");
});

test("Phase 2 rejects packet ownership divergence without rationale", () => {
  const candidate = phase2Model();
  const packet = candidate.remediationDocument.packages.find(
    (entry) => entry.remediationPacketId === "DW-REMED-VERIFICATION-PROVIDER-REALIZATION-GAP",
  );
  packet.multiOwnerRationale = null;
  includesError(phase2Errors(candidate), "packet owner differs without multi-owner rationale");
});

test("Phase 2 rejects inconsistent PROJECTION root cause", () => {
  const candidate = phase2Model();
  const trace = candidate.tracesDocument.traces.find(
    (entry) => entry.identity.capabilityId === "DW-CAP-TRANSACTIONAL-EMAIL-DELIVERY",
  );
  trace.layers.projection.status = "VERIFIED";
  includesError(phase2Errors(candidate), "PROJECTION loss has a non-lost projection layer");
});

test("Phase 2 rejects silently dropped queue work", () => {
  const candidate = phase2Model();
  candidate.tracesDocument.traces[0].queueIds = [];
  includesError(phase2Errors(candidate), "do not account for every accepted seed queue item");
});

test("Phase 2 privacy validation rejects credential-like trace output", () => {
  const candidate = phase2Model();
  candidate.tracesDocument.traces[0].layers.domain.references.push("api_key=unsafe-value");
  includesError(phase2Errors(candidate), "Phase 2 privacy scan matched forbidden pattern");
});

test("Phase 2 semantic output is deterministic", async () => {
  const second = await buildArtifacts(root);
  assert.equal(semanticDigest(baseline), semanticDigest(second));
  assert.equal(stableStringify(baseline.tracesDocument), stableStringify(second.tracesDocument));
  assert.equal(stableStringify(baseline.remediationDocument), stableStringify(second.remediationDocument));
  assert.equal(stableStringify(baseline.phase3Queue), stableStringify(second.phase3Queue));
});

test("Phase 3 reviews all 55 current accepted capabilities and accepts the generated utilization model", () => {
  assert.equal(baseline.inputs.phase3Config.phase2AcceptedCapabilityCount, 53);
  assert.equal(baseline.inputs.phase3Config.expectedCurrentCapabilityCount, 55);
  assert.equal(baseline.utilizationDocument.reviewedCapabilityCount, 55);
  assert.ok(
    baseline.phase2.ledger.capabilities.some(
      (capability) => capability.capabilityId === "DW-CAP-PLATFORM-ADMINISTRATION-SUPPORT-ACCESS",
    ),
  );
  assert.ok(
    baseline.ledger.capabilities.some(
      (capability) => capability.capabilityId === "DW-CAP-PLATFORM-ADMINISTRATION-SUPPORT-ACCESS",
    ),
  );
  assert.deepEqual(phase3Errors(phase3Model()), []);
});

test("Phase 3 reconciliation closes only accepted documentation evidence and preserves governed boundaries", () => {
  assert.equal(baseline.metrics.documentation.starting, 17);
  assert.equal(baseline.metrics.documentation.closed, 11);
  assert.equal(baseline.metrics.documentation.remaining, 6);
  assert.equal(baseline.metrics.findings.closed, 11);
  assert.equal(baseline.metrics.findings.external, 1);
  assert.equal(baseline.metrics.findings.ownerAcceptance, 1);
  assert.equal(baseline.metrics.findings.remainingHigh, 1);
  assert.equal(baseline.metrics.findings.remainingCritical, 0);
  assert.ok(baseline.slicesDocument.slices.every((slice) => slice.status === "MAINLINE_ACCEPTED"));
  assert.ok(baseline.slicesDocument.slices.every((slice) => /^[0-9a-f]{40}$/u.test(slice.acceptedMainSha)));
  const helmFinding = baseline.findingsDocument.findings.find(
    (finding) => finding.findingId === "DW-FIND-CATALOG-SURFACE-FT-007",
  );
  assert.equal(helmFinding?.status, "CLOSED");
  assert.equal(helmFinding?.observedSourceSha, "3e235e85b974183f3b0888814a15697596f73730");
  assert.match(helmFinding?.closureEvidence ?? "", /PR #32.*3e235e85/u);
  assert.match(baseline.phase3Reports.delta, /DW-FIND-CATALOG-SURFACE-FT-005/u);
  assert.match(baseline.phase3Reports.delta, /DW-FIND-CATALOG-SURFACE-FT-007/u);
  for (const findingId of [
    "DW-FIND-EDITION-COMPARISON-SEMANTIC-UNDERUTILIZATION",
    "DW-FIND-HOMEPORT-OWNER-DECISION-PENDING",
    "DW-FIND-TRANSACTIONAL-EMAIL-HEALTH-PROJECTION",
    "DW-FIND-VERIFICATION-PROVIDER-REALIZATION-GAP",
  ])
    assert.notEqual(
      baseline.findingsDocument.findings.find((finding) => finding.findingId === findingId)?.status,
      "CLOSED",
    );
  assert.equal(baseline.phase3.status.mainlineState, "MAINLINE_ACCEPTED");
  assert.equal(baseline.phase3.status.finalReconciledMainSha, "ca135585a62f445cd4331df1a7dd21203bd50219");
  assert.equal(baseline.inputs.phase3Config.validationEvidence.finalCandidate.decision, "RELEASE_GO");
  assert.equal(baseline.inputs.phase3Config.validationEvidence.finalCandidate.receiptCount, 37);
  assert.equal(baseline.inputs.phase3Config.validationEvidence.hostedMainline.successfulCheckCount, 40);
  assert.equal(baseline.inputs.phase3Config.validationEvidence.acceptedMainProof.receiptCount, 7);
  assert.match(baseline.phase3Reports.final, /Remaining blocker: NONE/u);
});

test("Phase 3 rejects an orphan backend operation", () => {
  const candidate = phase3Model();
  const capability = candidate.utilizationDocument.capabilities.find(
    (entry) => entry.capabilityId === "DW-CAP-ACCOUNT-DATA-EXPORT",
  );
  capability.expectedOperations[0].consumerReferences = [];
  includesError(phase3Errors(candidate), "orphan backend operation");
});

test("Phase 3 rejects an unused safe DTO field marked required", () => {
  const candidate = phase3Model();
  const capability = candidate.utilizationDocument.capabilities[0];
  capability.expectedSafeMetadata.push("unused safe decision field");
  includesError(phase3Errors(candidate), "unused safe DTO field marked required");
});

test("Phase 3 rejects a fake frontend-only mutation", () => {
  const candidate = phase3Model();
  const capability = candidate.utilizationDocument.capabilities.find(
    (entry) => entry.capabilityId === "DW-CAP-CREATOR-STUDIO",
  );
  const operation = capability.expectedOperations[0];
  operation.name = "fake frontend mutation";
  operation.sourceReferences = ["src/components/studio/TaleEditor.tsx"];
  includesError(phase3Errors(candidate), "UI claims an operation absent from backend authority");
});

test("Phase 3 rejects a UI-only success state", () => {
  const candidate = phase3Model();
  const capability = candidate.utilizationDocument.capabilities[0];
  capability.expectedStates.push("UI_ONLY_SUCCESS");
  capability.consumedOrRepresentedStates.push("UI_ONLY_SUCCESS");
  includesError(phase3Errors(candidate), "UI-only state is absent from backend/source contract");
});

test("Phase 3 rejects a missing recovery state", () => {
  const candidate = phase3Model();
  const capability = candidate.utilizationDocument.capabilities.find(
    (entry) => entry.capabilityId === "DW-CAP-VERIFICATION-PROVIDER-FRAMEWORK",
  );
  capability.consumedOrRepresentedStates = capability.consumedOrRepresentedStates.filter(
    (state) => state !== "RECOVERY",
  );
  includesError(phase3Errors(candidate), "missing recovery or lifecycle state RECOVERY");
});

test("Phase 3 rejects unconsumed retry capability", () => {
  const candidate = phase3Model();
  const capability = candidate.utilizationDocument.capabilities.find(
    (entry) => entry.capabilityId === "DW-CAP-COMMUNITY-WORKER-SCHEDULER",
  );
  capability.expectedOperations.push({
    operationId: "retry-orphaned-work",
    name: "retry orphaned work",
    disposition: "CONSUMED",
    sourceReferences: ["src/community/operations.ts"],
    consumerReferences: [],
    rationale: null,
    findingId: null,
  });
  capability.consumedOperations.push("retry-orphaned-work");
  includesError(phase3Errors(candidate), "orphan backend operation");
});

test("Phase 3 rejects unconsumed operator health marked internal without justification", () => {
  const candidate = phase3Model();
  const capability = candidate.utilizationDocument.capabilities.find(
    (entry) => entry.capabilityId === "DW-CAP-COMMUNITY-OPERATIONS-HEALTH",
  );
  capability.status = "INTERNAL_ONLY";
  capability.rationale = "";
  includesError(phase3Errors(candidate), "INTERNAL_ONLY lacks rationale");
});

test("Phase 3 rejects raw-secret projection evidence", () => {
  const candidate = phase3Model();
  const capability = candidate.utilizationDocument.capabilities[0];
  capability.expectedSafeMetadata.push("api_key=unsafe-projection-value");
  capability.consumedSafeMetadata.push("api_key=unsafe-projection-value");
  includesError(phase3Errors(candidate), "Phase 3 privacy scan matched forbidden pattern");
});

test("Phase 3 rejects a machine capability with no worker", () => {
  const candidate = phase3Model();
  const capability = candidate.utilizationDocument.capabilities.find(
    (entry) => entry.capabilityId === "DW-CAP-COMMUNITY-WORKER-SCHEDULER",
  );
  capability.utilizationConsumers = [];
  includesError(phase3Errors(candidate), "machine capability has no worker or dormant declaration");
});

test("Phase 3 rejects duplicate client business logic without a finding", () => {
  const candidate = phase3Model();
  const capability = candidate.utilizationDocument.capabilities.find(
    (entry) => entry.capabilityId === "DW-CAP-ACCOUNT-DATA-EXPORT",
  );
  capability.canonicalConsumption = false;
  includesError(phase3Errors(candidate), "duplicate client business logic lacks a governed finding");
});

test("Phase 3 rejects FULLY_UTILIZED with a missing expected operation", () => {
  const candidate = phase3Model();
  const capability = candidate.utilizationDocument.capabilities.find(
    (entry) => entry.status === "FULLY_UTILIZED" && entry.consumedOperations.length > 0,
  );
  capability.consumedOperations.pop();
  includesError(phase3Errors(candidate), "expected utilization operation is missing");
});

test("Phase 3 rejects INTENTIONALLY_PARTIAL without rationale", () => {
  const candidate = phase3Model();
  const capability = candidate.utilizationDocument.capabilities.find(
    (entry) => entry.status === "INTENTIONALLY_PARTIAL",
  );
  capability.rationale = "";
  includesError(phase3Errors(candidate), "INTENTIONALLY_PARTIAL lacks rationale");
});

test("Phase 4 creates a source-current proof population from Phase 3 plus Bridgewatch", () => {
  assert.equal(baseline.status.phase, "Phase 4 - Break the Surface");
  assert.equal(baseline.phase4ProofMatrix.capabilities.length, 56);
  assert.equal(baseline.inputs.phase4Config.expectedPhase3CapabilityCount, 55);
  assert.equal(baseline.inputs.phase4Config.expectedCurrentCapabilityCount, 56);
  const bridgewatch = baseline.phase4ProofMatrix.capabilities.find(
    (capability) => capability.capabilityId === "DW-CAP-BRIDGEWATCH-DEVELOPMENT-MISSION-CONTROL",
  );
  assert.equal(bridgewatch?.proofFamilyId, "DW-P4-JRN-BRIDGEWATCH");
  assert.equal(bridgewatch?.disposition, "SECURITY_RESTRICTED");
  assert.equal(
    baseline.phase4StateRecoveryMatrix.families.find((family) => family.familyId === "ACCOUNT")?.proofFamilyId,
    "DW-P4-JRN-ACCOUNT",
  );
  assert.deepEqual(phase4Errors(phase4Model()), []);
});

test("Phase 4 rejects a capability population that drops current-main work", () => {
  const candidate = phase4Model();
  candidate.phase4ProofMatrix.capabilities = candidate.phase4ProofMatrix.capabilities.filter(
    (capability) => capability.capabilityId !== "DW-CAP-BRIDGEWATCH-DEVELOPMENT-MISSION-CONTROL",
  );
  includesError(phase4Errors(candidate), "does not include every current capability");
});

test("Phase 4 rejects stale runtime evidence", () => {
  const candidate = phase4Model();
  candidate.inputs.runtimeEvidence.sourceSha = "0000000000000000000000000000000000000000";
  includesError(phase4Errors(candidate), "runtime evidence source SHA does not match");
});

test("Phase 4 rejects a passed screenshot without a hash", () => {
  const candidate = phase4Model();
  candidate.inputs.runtimeEvidence.journeyFamilies = [
    {
      journeyId: "DW-P4-JRN-ACCOUNT",
      status: "PASSED",
      sourceSha: candidate.inputs.phase4Config.productEvidenceSourceSha,
      testReferences: ["tests/e2e/homeport-phase7-owner-correction-round3.spec.ts"],
      screenshots: [{ evidenceId: "DW-P4-EV-ACCOUNT", sha256: "not-a-hash" }],
      states: ["READY"],
      accessibility: ["KEYBOARD"],
    },
  ];
  includesError(phase4Errors(candidate), "screenshot reference lacks a valid SHA-256");
});

test("Phase 4 local-proven state requires current journey, state, and accessibility proof", () => {
  const candidate = phase4Model();
  candidate.inputs.phase4Config.lifecycle.state = "LOCAL_PROVEN";
  const account = candidate.phase4ProofMatrix.capabilities.find(
    (capability) => capability.capabilityId === "DW-CAP-ACCOUNT-DATA-EXPORT",
  );
  account.proofStatus = "PENDING_LOCAL_SYNTHETIC_PROOF";
  account.runtimeEvidence = { states: ["READY"], accessibility: ["KEYBOARD"] };
  includesError(phase4Errors(candidate), "lacks source-current runtime proof");
  includesError(phase4Errors(candidate), "missing required observed state");
  includesError(phase4Errors(candidate), "missing accessibility proof");
});

test("Phase 4 frozen candidate requires completed focused qualification", () => {
  const candidate = phase4Model();
  candidate.inputs.phase4Config.lifecycle.mainlineState = "FROZEN_CANDIDATE";
  candidate.inputs.phase4Config.lifecycle.qualification = "FOCUSED_QUALIFICATION_PENDING";
  includesError(phase4Errors(candidate), "frozen candidate lacks focused qualification");
});

test("Phase 4 rejects an unauthorized Phase 5 promotion", () => {
  const candidate = phase4Model();
  candidate.phase5GovernanceQueue.phase5Authorized = true;
  includesError(phase4Errors(candidate), "incorrectly authorizes Phase 5");
});
