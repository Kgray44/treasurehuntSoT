/*
 * Sounding Line v1.4 shadow foundation.
 *
 * These utilities deliberately have no dependency on the v1.3 planner,
 * finalizer, or GitHub workflows.  They produce audit material only; callers
 * must never treat a result from this module as RELEASE_GO authority.
 */
import { createHash } from "node:crypto";

export const V14_AUTHORITY_BOUNDARY = "SHADOW_OPTIONAL_ADDITIVE_NONAUTHORITATIVE";
export const V14_EVIDENCE_FINGERPRINT_VERSION = "1.4";
export const V14_PREPARED_ARTIFACT_IDENTITY_VERSION = "1.4";
export const MAPPING_CONFIDENCE = Object.freeze(["EXACT", "BOUNDED", "COARSE", "UNKNOWN"]);
export const EVIDENCE_DISPOSITIONS = Object.freeze([
  "FRESH",
  "PRESERVED",
  "REBOUND",
  "INVALIDATED",
  "SUPERSEDED",
  "CONSERVATIVE_FALLBACK",
]);
export const LEGACY_CLASSIFICATIONS = Object.freeze([
  "RECONSTRUCTABLE",
  "PARTIALLY_RECONSTRUCTABLE",
  "RERUN_REQUIRED",
  "INCOMPATIBLE",
]);

const SHA256 = (value) => createHash("sha256").update(value).digest("hex");
const uniqueSorted = (values = []) => [...new Set(values)].sort();
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Return stable JSON so ordering cannot accidentally become evidence identity. */
export function canonicalize(value) {
  if (Array.isArray(value))
    return value.map(canonicalize).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  if (isObject(value))
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  return value;
}

export const canonicalJson = (value) => JSON.stringify(canonicalize(value));
export const digest = (value) => SHA256(typeof value === "string" ? value : canonicalJson(value));

export function digestFileEntries(entries = []) {
  return digest(
    entries
      .map((entry) => ({ path: entry.path.replaceAll("\\\\", "/"), digest: entry.digest, mode: entry.mode ?? null }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  );
}

const fingerprintFields = [
  "suiteId",
  "testSetDigest",
  "protectedContracts",
  "productionClosureDigest",
  "productionClosureMembers",
  "schemaDigest",
  "migrationDigest",
  "generatedClientIdentity",
  "testDefinitionDigest",
  "assertionLibraryDigest",
  "fixtureDigest",
  "baselineIdentity",
  "packageLockDigest",
  "nodeRuntimeIdentity",
  "toolchainIdentity",
  "browserIdentity",
  "providerIdentity",
  "environmentClass",
  "soundingLinePolicyDigest",
  "gatePolicyDigest",
  "resourceContractDigest",
  "preparedArtifactIdentities",
  "cleanupContractDigest",
  "sourceIdentity",
  "treeIdentity",
  "authorityIdentity",
  "adapterIdentity",
  "originalEvidenceIdentity",
  "inapplicableDependencyClasses",
];

/**
 * Create the v1.4 canonical fingerprint. Null is allowed only where the
 * sealed inapplicability rule names that dependency class; this prevents an
 * absent identity from becoming an accidental preservation opportunity.
 */
export function createEvidenceFingerprint(input) {
  const missing = fingerprintFields.filter((field) => input[field] === undefined);
  if (missing.length) throw new Error(`EVIDENCE_FINGERPRINT_FIELD_MISSING:${missing.join(",")}`);
  if (
    !input.suiteId ||
    !input.testSetDigest ||
    !Array.isArray(input.protectedContracts) ||
    !Array.isArray(input.productionClosureMembers) ||
    !Array.isArray(input.preparedArtifactIdentities) ||
    !Array.isArray(input.inapplicableDependencyClasses)
  )
    throw new Error("EVIDENCE_FINGERPRINT_IDENTITY_INVALID");
  if (
    input.protectedContracts.some((contract) => !contract?.id || !contract.version) ||
    !isObject(input.sourceIdentity) ||
    !isObject(input.treeIdentity) ||
    !input.authorityIdentity ||
    !input.adapterIdentity ||
    !input.originalEvidenceIdentity
  )
    throw new Error("EVIDENCE_FINGERPRINT_CLOSURE_INVALID");
  const optional = new Set(input.inapplicableDependencyClasses);
  const optionalFields = [
    "schemaDigest",
    "migrationDigest",
    "generatedClientIdentity",
    "assertionLibraryDigest",
    "fixtureDigest",
    "baselineIdentity",
    "browserIdentity",
    "providerIdentity",
    "environmentClass",
  ];
  for (const field of optionalFields) {
    if (input[field] === null && !optional.has(field))
      throw new Error(`EVIDENCE_FINGERPRINT_INAPPLICABILITY_UNEXPLAINED:${field}`);
  }
  const fingerprint = {
    version: V14_EVIDENCE_FINGERPRINT_VERSION,
    ...Object.fromEntries(fingerprintFields.map((field) => [field, input[field]])),
    protectedContracts: canonicalize(input.protectedContracts),
    productionClosureMembers: uniqueSorted(input.productionClosureMembers),
    preparedArtifactIdentities: uniqueSorted(input.preparedArtifactIdentities),
    inapplicableDependencyClasses: uniqueSorted(input.inapplicableDependencyClasses),
  };
  return { ...canonicalize(fingerprint), fingerprintDigest: digest(fingerprint) };
}

export function deriveContractClosure({
  suiteId,
  directContractIds = [],
  contractRelations = [],
  knownContractIds = [],
  mappingConfidence = "EXACT",
}) {
  if (!MAPPING_CONFIDENCE.includes(mappingConfidence))
    throw new Error(`MAPPING_CONFIDENCE_INVALID:${mappingConfidence}`);
  const known = new Set(knownContractIds);
  const closure = new Set(directContractIds);
  const reasons = [];
  const queue = [...directContractIds];
  while (queue.length) {
    const current = queue.shift();
    for (const relation of contractRelations.filter((entry) => entry.from === current)) {
      if (!closure.has(relation.to)) {
        closure.add(relation.to);
        queue.push(relation.to);
        reasons.push({ from: current, to: relation.to, relation: relation.kind ?? "producer-consumer" });
      }
    }
  }
  const unknown = [...closure].filter((contractId) => !known.has(contractId));
  const closureClass = unknown.length ? "UNKNOWN" : mappingConfidence;
  const preservationEligible = closureClass === "EXACT" || closureClass === "BOUNDED";
  return {
    suiteId,
    contractIds: uniqueSorted(closure),
    closureClass,
    preservationEligible,
    reason: preservationEligible ? null : "EVIDENCE_DEPENDENCY_UNKNOWN",
    unknownContractIds: uniqueSorted(unknown),
    relations: reasons.sort((a, b) => `${a.from}:${a.to}`.localeCompare(`${b.from}:${b.to}`)),
    digest: digest({ suiteId, contractIds: uniqueSorted(closure), closureClass, unknown }),
  };
}

export function compareEvidenceFingerprints({
  prior,
  current,
  priorReceiptId = null,
  changedPaths = [],
  changedContracts = [],
  corruption = false,
  expired = false,
}) {
  if (corruption) return disposition("CONSERVATIVE_FALLBACK", "EVIDENCE_INTEGRITY_FAILURE");
  if (expired) return disposition("INVALIDATED", "EVIDENCE_EXPIRED");
  if (!prior) return disposition("FRESH", "NO_CURRENT_EVIDENCE");
  if (!current) return disposition("CONSERVATIVE_FALLBACK", "FINGERPRINT_UNAVAILABLE");
  if (prior.version !== V14_EVIDENCE_FINGERPRINT_VERSION || current.version !== V14_EVIDENCE_FINGERPRINT_VERSION)
    return disposition("CONSERVATIVE_FALLBACK", "FINGERPRINT_VERSION_INCOMPATIBLE");
  const changed = fingerprintFields.filter((field) => canonicalJson(prior[field]) !== canonicalJson(current[field]));
  if (changed.length)
    return {
      ...disposition("INVALIDATED", "FINGERPRINT_FIELD_CHANGED"),
      changedFields: changed,
      changedPaths: uniqueSorted(changedPaths),
      changedContracts: uniqueSorted(changedContracts),
      priorReceiptId,
    };
  return {
    ...disposition("PRESERVED", "SEMANTIC_FINGERPRINT_MATCH"),
    changedFields: [],
    changedPaths: [],
    changedContracts: [],
    priorReceiptId,
  };
}

const disposition = (value, reasonCode) => ({ disposition: value, reasonCodes: [reasonCode] });

export function createEvidenceLineage({
  originalReceiptId,
  priorFingerprint,
  currentFingerprint,
  decision,
  changedInterval = {},
}) {
  if (!originalReceiptId || !EVIDENCE_DISPOSITIONS.includes(decision.disposition))
    throw new Error("EVIDENCE_LINEAGE_INVALID");
  if (["PRESERVED", "REBOUND"].includes(decision.disposition) && !priorFingerprint)
    throw new Error("EVIDENCE_LINEAGE_ORIGIN_REQUIRED");
  const claim = {
    version: V14_EVIDENCE_FINGERPRINT_VERSION,
    immutable: true,
    originalReceiptId,
    derivedReceiptId: decision.derivedReceiptId ?? null,
    priorFingerprintDigest: priorFingerprint?.fingerprintDigest ?? null,
    currentFingerprintDigest: currentFingerprint?.fingerprintDigest ?? null,
    changedInterval: canonicalize(changedInterval),
    dependencyComparison: canonicalize(decision.dependencyComparison ?? {}),
    authorityIdentity: currentFingerprint?.authorityIdentity ?? null,
    policyIdentity: currentFingerprint?.soundingLinePolicyDigest ?? null,
    decision: canonicalize(decision),
  };
  return { ...claim, lineageDigest: digest(claim) };
}

export function reconstructLegacyEvidence({ receipt, immutableFacts = {}, currentFingerprint }) {
  if (!receipt || receipt.result !== "PASSED")
    return {
      classification: "INCOMPATIBLE",
      adoptionDisposition: "INVALIDATED",
      reasonCodes: ["LEGACY_RECEIPT_NOT_GREEN"],
    };
  const fields = { ...receipt, ...immutableFacts };
  const missing = fingerprintFields.filter((field) => fields[field] === undefined);
  const policyMismatch =
    fields.soundingLinePolicyDigest &&
    currentFingerprint?.soundingLinePolicyDigest &&
    fields.soundingLinePolicyDigest !== currentFingerprint.soundingLinePolicyDigest;
  const schemaMismatch =
    fields.schemaDigest && currentFingerprint?.schemaDigest && fields.schemaDigest !== currentFingerprint.schemaDigest;
  if (policyMismatch || schemaMismatch)
    return {
      classification: "RERUN_REQUIRED",
      adoptionDisposition: "INVALIDATED",
      reasonCodes: [policyMismatch ? "POLICY_MISMATCH" : "SCHEMA_MISMATCH"],
      missingFields: missing,
    };
  if (missing.length)
    return {
      classification: missing.length < fingerprintFields.length ? "PARTIALLY_RECONSTRUCTABLE" : "RERUN_REQUIRED",
      adoptionDisposition: "INVALIDATED",
      reasonCodes: ["LEGACY_IDENTITY_MISSING", "RERUN_REQUIRED"],
      missingFields: missing,
    };
  const reconstructed = createEvidenceFingerprint(fields);
  return {
    classification: "RECONSTRUCTABLE",
    adoptionDisposition: "PRESERVED",
    reasonCodes: ["IMMUTABLE_FACTS_COMPLETE"],
    missingFields: [],
    fingerprint: reconstructed,
  };
}

function mappingsFor({ changedPaths, changedContracts, impactMap }) {
  const pathMappings = impactMap.pathMappings ?? [];
  const contractMappings = impactMap.contractMappings ?? [];
  const affectedSuites = new Set();
  const reasons = [];
  const unknownPaths = [];
  for (const changedPath of changedPaths) {
    const matching = pathMappings.filter((mapping) => glob(mapping.path).test(changedPath));
    if (!matching.length) unknownPaths.push(changedPath);
    for (const mapping of matching) {
      for (const suiteId of mapping.suiteIds ?? []) affectedSuites.add(suiteId);
      for (const contractId of mapping.contractIds ?? []) changedContracts.add(contractId);
      reasons.push({ type: "path", changedPath, mapping: mapping.path });
    }
  }
  const unmappedContracts = [];
  for (const contractId of changedContracts) {
    const matching = contractMappings.filter((mapping) => mapping.contractId === contractId);
    if (!matching.length) unmappedContracts.push(contractId);
    for (const mapping of matching) {
      for (const suiteId of mapping.suiteIds ?? []) affectedSuites.add(suiteId);
      reasons.push({ type: "contract", contractId });
    }
  }
  return {
    affectedSuites,
    unknownPaths: uniqueSorted(unknownPaths),
    unmappedContracts: uniqueSorted(unmappedContracts),
    reasons,
  };
}

const glob = (pattern) =>
  new RegExp(
    `^${pattern
      .replace(/[|\\{}()[\]^$+?.]/gu, "\\$&")
      .replace(/\*\*/gu, "::DS::")
      .replace(/\*/gu, "[^/]*")
      .replace(/::DS::/gu, ".*")}$`,
    "u",
  );

/**
 * Shadow-only impact decision.  Unknown inputs expand the plan; they never
 * permit an omission.  The fallback is intentionally supplied by policy so a
 * future amendment can select its own bounded risk floor.
 */
export function classifyImpact({
  changedPaths = [],
  changedContractIds = [],
  impactMap,
  mappingDebt = [],
  allSuiteIds = [],
  riskFloorSuiteIds = [],
  mappingConfidence = "EXACT",
}) {
  if (!MAPPING_CONFIDENCE.includes(mappingConfidence))
    throw new Error(`MAPPING_CONFIDENCE_INVALID:${mappingConfidence}`);
  const paths = uniqueSorted(changedPaths);
  const contracts = new Set(changedContractIds);
  const result = mappingsFor({ changedPaths: paths, changedContracts: contracts, impactMap });
  const debtContracts = new Set(
    mappingDebt.filter((entry) => entry.classification !== "MAPPED").map((entry) => entry.contractId),
  );
  const debtAffectedContracts = uniqueSorted([...contracts].filter((contractId) => debtContracts.has(contractId)));
  const unknown =
    result.unknownPaths.length > 0 || result.unmappedContracts.length > 0 || debtAffectedContracts.length > 0;
  const effectiveConfidence = unknown ? "UNKNOWN" : mappingConfidence;
  const selectedSuiteIds = unknown
    ? uniqueSorted([...allSuiteIds, ...riskFloorSuiteIds])
    : uniqueSorted([...result.affectedSuites, ...riskFloorSuiteIds]);
  return {
    version: V14_EVIDENCE_FINGERPRINT_VERSION,
    authorityBoundary: V14_AUTHORITY_BOUNDARY,
    mappingConfidence: effectiveConfidence,
    riskFloor: unknown
      ? "CONSERVATIVE_FALLBACK_REQUIRED"
      : riskFloorSuiteIds.length
        ? "RISK_FLOOR_AND_SENTINEL_POLICY"
        : "NONE",
    selectedSuiteIds,
    affectedContractIds: uniqueSorted(contracts),
    affectedPaths: paths,
    unknownPaths: result.unknownPaths,
    unmappedContracts: result.unmappedContracts,
    mappingDebtContracts: debtAffectedContracts,
    reasons: result.reasons.sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b))),
    fallbackDebt: unknown
      ? {
          reason: "UNKNOWN_OR_UNMAPPED_IMPACT",
          affectedUnknownPaths: result.unknownPaths,
          affectedUnmappedContracts: result.unmappedContracts,
          affectedDebtContracts: debtAffectedContracts,
        }
      : null,
  };
}

export function buildShadowPlan({
  currentPlan,
  gate,
  impactMap,
  mappingDebt = [],
  changedPaths = [],
  changedContractIds = [],
  priorEvidence = {},
  alwaysFreshSpine = [],
}) {
  const currentRequired = uniqueSorted(currentPlan.nodes.map((node) => node.id));
  const conditional = new Set(gate.conditionalSuites ?? []);
  const eligibleSuiteIds = uniqueSorted([...currentRequired, ...conditional]);
  const impact = classifyImpact({
    changedPaths,
    changedContractIds,
    impactMap,
    mappingDebt,
    allSuiteIds: eligibleSuiteIds,
    riskFloorSuiteIds: alwaysFreshSpine,
  });
  const proposed = new Set(currentRequired);
  for (const suiteId of impact.selectedSuiteIds) if (conditional.has(suiteId)) proposed.add(suiteId);
  const ledger = [...new Set([...currentRequired, ...conditional])].sort().map((suiteId) => {
    const selected = proposed.has(suiteId);
    const currentNode = currentPlan.nodes.find((node) => node.id === suiteId);
    const currentFingerprint = priorEvidence.currentFingerprints?.[suiteId] ?? null;
    const evidence = selected
      ? compareEvidenceFingerprints({
          prior: priorEvidence.priorFingerprints?.[suiteId],
          current: currentFingerprint,
          priorReceiptId: priorEvidence.priorReceiptIds?.[suiteId],
        })
      : disposition("PRESERVED", "CONDITIONAL_NOT_IMPACTED");
    const selectionDisposition = selected
      ? impact.mappingConfidence === "UNKNOWN"
        ? "CONSERVATIVE_FALLBACK_REQUIRED"
        : alwaysFreshSpine.includes(suiteId)
          ? "SELECTED_BY_RISK_FLOOR"
          : "SELECTED_BY_IMPACT"
      : "OMITTED_WITH_PROOF";
    return {
      suiteId,
      currentV13: Boolean(currentNode) ? "SELECTED" : "OMITTED",
      proposedV14: selected ? "SELECTED" : "OMITTED",
      disposition: evidence.disposition,
      selectionDisposition,
      reasonCodes: selected
        ? [
            ...evidence.reasonCodes,
            ...(impact.mappingConfidence === "UNKNOWN" ? ["UNKNOWN_CONSERVATIVE_EXPANSION"] : []),
          ]
        : ["CONDITIONAL_NOT_IMPACTED"],
      affectedPaths: impact.affectedPaths,
      affectedContracts: impact.affectedContractIds,
      riskFloor: impact.riskFloor,
      mappingConfidence: impact.mappingConfidence,
    };
  });
  const lost = ledger
    .filter((entry) => entry.currentV13 === "SELECTED" && entry.proposedV14 === "OMITTED")
    .map((entry) => entry.suiteId);
  return {
    version: 1,
    authorityBoundary: V14_AUTHORITY_BOUNDARY,
    currentV13: { gate: currentPlan.gate, planDigest: currentPlan.planDigest, selectedSuiteIds: currentRequired },
    proposedV14: {
      gate: gate.id,
      selectedSuiteIds: uniqueSorted(proposed),
      alwaysFreshSpine: uniqueSorted(alwaysFreshSpine),
    },
    impact,
    ledger,
    comparison: { status: lost.length ? "SHADOW_UNSAFE" : "SHADOW_SAFE", lostCurrentObligations: lost },
  };
}

const MUTABLE_LAYER_TYPES = new Set([
  "sqlite-working-database",
  "browser-profile",
  "port",
  "writable-storage-root",
  "build-output",
  "mutable-test-workspace",
]);

export function createPreparedLayerManifest({
  layerType,
  sourceInputs,
  contentManifest,
  producer,
  platform,
  policyDigest,
  securityScan,
  retentionClass,
  consumerConstraints,
  createdAt = new Date().toISOString(),
  schemaVersion = V14_PREPARED_ARTIFACT_IDENTITY_VERSION,
}) {
  if (MUTABLE_LAYER_TYPES.has(layerType)) throw new Error("MUTABLE_RESOURCE_REJECTED");
  if (!Array.isArray(contentManifest) || !contentManifest.length) throw new Error("LAYER_CONTENT_MANIFEST_REQUIRED");
  const normalizedContent = contentManifest
    .map((entry) => ({ path: entry.path.replaceAll("\\\\", "/"), digest: entry.digest, bytes: entry.bytes ?? null }))
    .sort((a, b) => a.path.localeCompare(b.path));
  if (!producer || !policyDigest || !securityScan || !retentionClass || !consumerConstraints)
    throw new Error("PREPARED_LAYER_PROVENANCE_INCOMPLETE");
  const identityInputs = canonicalize({
    layerType,
    schemaVersion,
    sourceInputs,
    platform,
    policyDigest,
    consumerConstraints,
  });
  const manifest = {
    identityVersion: schemaVersion,
    artifactType: layerType,
    inputDigests: canonicalize(sourceInputs),
    identityDigest: digest(identityInputs),
    sourceInputs: canonicalize(sourceInputs),
    createdAt,
    producer,
    platform: canonicalize(platform),
    contentManifest: normalizedContent,
    artifactDigest: digest(normalizedContent),
    policyDigest,
    securityScan: canonicalize(securityScan),
    retentionClass,
    consumerConstraints: canonicalize(consumerConstraints),
    verificationStatus: "VERIFIED",
    mutable: false,
  };
  return { ...manifest, manifestDigest: digest(manifest) };
}

const requiredLayerInputs = Object.freeze({
  dependency: [
    "packageJsonDigest",
    "packageLockDigest",
    "nodeVersion",
    "npmVersion",
    "os",
    "architecture",
    "nativeDependencyClass",
    "installPolicyDigest",
  ],
  "prisma-client": [
    "dependencyLayerIdentity",
    "prismaVersion",
    "schemaDigest",
    "generatorConfigurationDigest",
    "targetPlatformIdentity",
  ],
  "browser-chromium": [
    "playwrightVersion",
    "browserEngine",
    "browserRevision",
    "os",
    "architecture",
    "browserPolicyDigest",
  ],
  "browser-webkit": [
    "playwrightVersion",
    "browserEngine",
    "browserRevision",
    "os",
    "architecture",
    "browserPolicyDigest",
  ],
  "sqlite-baseline": [
    "sqliteSchemaDigest",
    "orderedMigrationDigest",
    "fixtureBuilderDigest",
    "fixtureVersion",
    "baselineCertificationPolicyDigest",
  ],
});

/** Validate the complete identity surface for each supported immutable layer. */
export function createTypedPreparedLayerManifest({ layerType, sourceInputs, ...rest }) {
  const required = requiredLayerInputs[layerType];
  if (!required) throw new Error(`UNKNOWN_PREPARED_LAYER_TYPE:${layerType}`);
  const missing = required.filter((field) => sourceInputs?.[field] === undefined || sourceInputs[field] === null);
  if (missing.length) throw new Error(`PREPARED_LAYER_IDENTITY_INCOMPLETE:${layerType}:${missing.join(",")}`);
  return createPreparedLayerManifest({ layerType, sourceInputs, ...rest });
}

export function verifyPreparedLayerManifest(manifest, observedContentManifest) {
  if (!manifest || manifest.mutable !== false || MUTABLE_LAYER_TYPES.has(manifest.artifactType))
    return { valid: false, reason: "MUTABLE_LAYER_REJECTED" };
  const required = [
    "identityVersion",
    "artifactType",
    "inputDigests",
    "artifactDigest",
    "producer",
    "createdAt",
    "policyDigest",
    "securityScan",
    "retentionClass",
    "consumerConstraints",
  ];
  if (required.some((field) => manifest[field] === undefined || manifest[field] === null || manifest[field] === ""))
    return { valid: false, reason: "LAYER_PROVENANCE_INCOMPLETE" };
  const observed = (observedContentManifest ?? [])
    .map((entry) => ({ path: entry.path.replaceAll("\\\\", "/"), digest: entry.digest, bytes: entry.bytes ?? null }))
    .sort((a, b) => a.path.localeCompare(b.path));
  if (digest(observed) !== manifest.artifactDigest) return { valid: false, reason: "LAYER_CONTENT_CORRUPT" };
  const { manifestDigest, ...unsigned } = manifest;
  if (digest(unsigned) !== manifestDigest) return { valid: false, reason: "LAYER_MANIFEST_CORRUPT" };
  return { valid: true, reason: "VERIFIED" };
}

export function createTreeIdentity({
  candidateHeadSha,
  candidateTreeSha,
  predictedParentCommitSha,
  predictedParentTreeSha,
  predictedIntegrationTreeSha,
  actualIntegratedCommitSha = null,
  actualIntegratedTreeSha = null,
  mergeStrategyIdentity,
  trainId = null,
  trainPosition = null,
}) {
  const identity = {
    version: V14_EVIDENCE_FINGERPRINT_VERSION,
    candidateHeadSha,
    candidateTreeSha,
    predictedParentCommitSha,
    predictedParentTreeSha,
    predictedIntegrationTreeSha,
    actualIntegratedCommitSha,
    actualIntegratedTreeSha,
    mergeStrategyIdentity,
    trainId,
    trainPosition,
  };
  const required = [
    candidateHeadSha,
    candidateTreeSha,
    predictedParentCommitSha,
    predictedParentTreeSha,
    predictedIntegrationTreeSha,
    mergeStrategyIdentity,
  ];
  if (required.some((value) => value === undefined || value === null || value === ""))
    throw new Error("TREE_IDENTITY_FIELD_MISSING");
  if ((actualIntegratedCommitSha === null) !== (actualIntegratedTreeSha === null))
    throw new Error("TREE_IDENTITY_ACTUAL_PAIR_INCOMPLETE");
  return { ...identity, treeIdentityDigest: digest(identity) };
}

export const treesEqual = (left, right) =>
  Boolean(left && right && left.predictedIntegrationTreeSha === right.actualIntegratedTreeSha);

export function validateCleanupManifest(manifest, { owner, existingResourceIds = [] } = {}) {
  if (!manifest || manifest.version !== V14_EVIDENCE_FINGERPRINT_VERSION || !Array.isArray(manifest.resources))
    return { valid: false, errors: ["CLEANUP_MANIFEST_INVALID"] };
  const errors = [];
  const resourceIds = new Set();
  for (const resource of manifest.resources) {
    if (!resource.id || resourceIds.has(resource.id)) errors.push("CLEANUP_RESOURCE_ID_INVALID");
    resourceIds.add(resource.id);
    if (!resource.type || !resource.allocated || !resource.createdIdentity)
      errors.push(`CLEANUP_RESOURCE_PROVENANCE_INCOMPLETE:${resource.id}`);
    if (!resource.leaseOwner || resource.leaseOwner !== owner) errors.push(`CLEANUP_OWNER_INVALID:${resource.id}`);
    if (
      !resource.cleanupAction ||
      !resource.cleanupTimestamp ||
      resource.finalState !== "ABSENT" ||
      resource.result !== "CLEAN"
    )
      errors.push(`CLEANUP_RESOURCE_INCOMPLETE:${resource.id}`);
    if (existingResourceIds.includes(resource.id)) errors.push(`CLEANUP_RESOURCE_SURVIVES:${resource.id}`);
  }
  return { valid: errors.length === 0, errors: uniqueSorted(errors) };
}
