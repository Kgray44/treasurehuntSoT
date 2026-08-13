/*
 * Sounding Line v1.4 shadow foundation.
 *
 * These utilities deliberately have no dependency on the v1.3 planner,
 * finalizer, or GitHub workflows.  They produce audit material only; callers
 * must never treat a result from this module as RELEASE_GO authority.
 */
import { createHash } from "node:crypto";

export const V14_AUTHORITY_BOUNDARY = "SHADOW_OPTIONAL_ADDITIVE_NONAUTHORITATIVE";
export const EVIDENCE_DISPOSITIONS = Object.freeze([
  "FRESH_REQUIRED",
  "PRESERVED",
  "REBOUND",
  "INVALIDATED",
  "UNKNOWN_REQUIRES_EXECUTION",
  "INCOMPATIBLE",
  "EXPIRED",
  "CORRUPT",
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
  "protectedContractIds",
  "sourceClosureDigest",
  "contractClosureDigest",
  "testDefinitionDigest",
  "fixtureDigest",
  "schemaDigest",
  "migrationDigest",
  "dependencyDigest",
  "toolchainDigest",
  "browserDigest",
  "runtimeEnvironmentDigest",
  "policyDigest",
  "authorityDigest",
  "adapterDigest",
  "resourceDeclarationDigest",
  "originalSourceSha",
  "originalTreeSha",
];

/**
 * Create a stable v1 fingerprint.  Null is meaningful for inapplicable
 * optional identities; undefined is rejected to avoid silent omissions.
 */
export function createEvidenceFingerprint(input) {
  const missing = fingerprintFields.filter((field) => input[field] === undefined);
  if (missing.length) throw new Error(`EVIDENCE_FINGERPRINT_FIELD_MISSING:${missing.join(",")}`);
  if (!input.suiteId || !Array.isArray(input.protectedContractIds))
    throw new Error("EVIDENCE_FINGERPRINT_IDENTITY_INVALID");
  const fingerprint = {
    version: 1,
    ...Object.fromEntries(fingerprintFields.map((field) => [field, input[field]])),
    protectedContractIds: uniqueSorted(input.protectedContractIds),
  };
  return { ...canonicalize(fingerprint), fingerprintDigest: digest(fingerprint) };
}

export function deriveContractClosure({
  suiteId,
  directContractIds = [],
  contractRelations = [],
  knownContractIds = [],
  mappingComplete = true,
}) {
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
  const complete = mappingComplete && unknown.length === 0;
  return {
    suiteId,
    contractIds: uniqueSorted(closure),
    complete,
    state: complete ? "COMPLETE" : "INCOMPLETE",
    reason: complete ? null : "UNKNOWN_REQUIRES_EXECUTION",
    unknownContractIds: uniqueSorted(unknown),
    relations: reasons.sort((a, b) => `${a.from}:${a.to}`.localeCompare(`${b.from}:${b.to}`)),
    digest: digest({ suiteId, contractIds: uniqueSorted(closure), complete, unknown }),
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
  if (corruption) return disposition("CORRUPT", "EVIDENCE_INTEGRITY_FAILURE");
  if (expired) return disposition("EXPIRED", "EVIDENCE_EXPIRED");
  if (!prior || !current) return disposition("UNKNOWN_REQUIRES_EXECUTION", "FINGERPRINT_UNAVAILABLE");
  if (prior.version !== 1 || current.version !== 1)
    return disposition("INCOMPATIBLE", "FINGERPRINT_VERSION_INCOMPATIBLE");
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
    version: 1,
    immutable: true,
    originalReceiptId,
    priorFingerprintDigest: priorFingerprint?.fingerprintDigest ?? null,
    currentFingerprintDigest: currentFingerprint?.fingerprintDigest ?? null,
    changedInterval: canonicalize(changedInterval),
    decision: canonicalize(decision),
  };
  return { ...claim, lineageDigest: digest(claim) };
}

export function reconstructLegacyEvidence({ receipt, immutableFacts = {}, currentFingerprint }) {
  if (!receipt || receipt.result !== "PASSED")
    return { classification: "INCOMPATIBLE", reasonCodes: ["LEGACY_RECEIPT_NOT_GREEN"] };
  const fields = { ...receipt, ...immutableFacts };
  const missing = fingerprintFields.filter((field) => fields[field] === undefined);
  const policyMismatch =
    fields.policyDigest && currentFingerprint?.policyDigest && fields.policyDigest !== currentFingerprint.policyDigest;
  const schemaMismatch =
    fields.schemaDigest && currentFingerprint?.schemaDigest && fields.schemaDigest !== currentFingerprint.schemaDigest;
  if (policyMismatch || schemaMismatch)
    return {
      classification: "RERUN_REQUIRED",
      reasonCodes: [policyMismatch ? "POLICY_MISMATCH" : "SCHEMA_MISMATCH"],
      missingFields: missing,
    };
  if (missing.length)
    return {
      classification: missing.length < fingerprintFields.length ? "PARTIALLY_RECONSTRUCTABLE" : "RERUN_REQUIRED",
      reasonCodes: ["LEGACY_IDENTITY_MISSING", "RERUN_REQUIRED"],
      missingFields: missing,
    };
  const reconstructed = createEvidenceFingerprint(fields);
  return {
    classification: "RECONSTRUCTABLE",
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
}) {
  const paths = uniqueSorted(changedPaths);
  const contracts = new Set(changedContractIds);
  const result = mappingsFor({ changedPaths: paths, changedContracts: contracts, impactMap });
  const debtContracts = new Set(
    mappingDebt.filter((entry) => entry.classification !== "MAPPED").map((entry) => entry.contractId),
  );
  const debtAffectedContracts = uniqueSorted([...contracts].filter((contractId) => debtContracts.has(contractId)));
  const unknown =
    result.unknownPaths.length > 0 || result.unmappedContracts.length > 0 || debtAffectedContracts.length > 0;
  const selectedSuiteIds = unknown
    ? uniqueSorted([...allSuiteIds, ...riskFloorSuiteIds])
    : uniqueSorted([...result.affectedSuites, ...riskFloorSuiteIds]);
  return {
    version: 1,
    authorityBoundary: V14_AUTHORITY_BOUNDARY,
    mappingConfidence: unknown ? "UNKNOWN" : "COMPLETE_KNOWN",
    riskFloor: unknown
      ? "CURRENT_LEGACY_MANDATORY_BEHAVIOR"
      : riskFloorSuiteIds.length
        ? "CONFIGURED_SENTINEL_SPINE"
        : "NONE",
    selectedSuiteIds,
    affectedContractIds: uniqueSorted(contracts),
    affectedPaths: paths,
    unknownPaths: result.unknownPaths,
    unmappedContracts: result.unmappedContracts,
    mappingDebtContracts: debtAffectedContracts,
    reasons: result.reasons.sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b))),
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
  const impact = classifyImpact({
    changedPaths,
    changedContractIds,
    impactMap,
    mappingDebt,
    allSuiteIds: currentRequired,
    riskFloorSuiteIds: alwaysFreshSpine,
  });
  const conditional = new Set(gate.conditionalSuites ?? []);
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
      : disposition("FRESH_REQUIRED", "CONDITIONAL_NOT_IMPACTED");
    return {
      suiteId,
      currentV13: Boolean(currentNode) ? "SELECTED" : "OMITTED",
      proposedV14: selected ? "SELECTED" : "OMITTED",
      disposition: evidence.disposition,
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
  createdAt = new Date().toISOString(),
  schemaVersion = 1,
}) {
  if (MUTABLE_LAYER_TYPES.has(layerType)) throw new Error("MUTABLE_RESOURCE_REJECTED");
  if (!Array.isArray(contentManifest) || !contentManifest.length) throw new Error("LAYER_CONTENT_MANIFEST_REQUIRED");
  const normalizedContent = contentManifest
    .map((entry) => ({ path: entry.path.replaceAll("\\\\", "/"), digest: entry.digest, bytes: entry.bytes ?? null }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const identityInputs = canonicalize({ layerType, schemaVersion, sourceInputs, platform });
  const manifest = {
    schemaVersion,
    layerType,
    identityDigest: digest(identityInputs),
    sourceInputs: canonicalize(sourceInputs),
    createdAt,
    producer,
    platform: canonicalize(platform),
    contentManifest: normalizedContent,
    contentDigest: digest(normalizedContent),
    verificationStatus: "VERIFIED",
    mutable: false,
  };
  return { ...manifest, manifestDigest: digest(manifest) };
}

const requiredLayerInputs = Object.freeze({
  dependency: ["packageLockDigest", "nodeVersion", "npmVersion", "os", "arch", "installPolicy"],
  "prisma-generated": [
    "dependencyLayerIdentity",
    "prismaVersion",
    "schemaDigest",
    "generatorConfiguration",
    "os",
    "arch",
  ],
  chromium: ["playwrightVersion", "browserRevision", "os", "arch"],
  webkit: ["playwrightVersion", "browserRevision", "os", "arch"],
  "sqlite-baseline": [
    "schemaDigest",
    "migrationDigest",
    "seedFixtureDigest",
    "prismaIdentity",
    "sqliteRuntimeIdentity",
    "baselineVersion",
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
  if (!manifest || manifest.mutable !== false || MUTABLE_LAYER_TYPES.has(manifest.layerType))
    return { valid: false, reason: "MUTABLE_LAYER_REJECTED" };
  const observed = (observedContentManifest ?? [])
    .map((entry) => ({ path: entry.path.replaceAll("\\\\", "/"), digest: entry.digest, bytes: entry.bytes ?? null }))
    .sort((a, b) => a.path.localeCompare(b.path));
  if (digest(observed) !== manifest.contentDigest) return { valid: false, reason: "LAYER_CONTENT_CORRUPT" };
  const { manifestDigest, ...unsigned } = manifest;
  if (digest(unsigned) !== manifestDigest) return { valid: false, reason: "LAYER_MANIFEST_CORRUPT" };
  return { valid: true, reason: "VERIFIED" };
}

export function createTreeIdentity({
  commitSha,
  treeSha,
  baseSha,
  baseTreeSha,
  candidateSha,
  candidateTreeSha,
  resultingIntegrationTreeSha,
  mergeMethod,
}) {
  const identity = {
    version: 1,
    commitSha,
    treeSha,
    baseSha,
    baseTreeSha,
    candidateSha,
    candidateTreeSha,
    resultingIntegrationTreeSha,
    mergeMethod,
  };
  if (Object.values(identity).some((value) => value === undefined || value === null || value === ""))
    throw new Error("TREE_IDENTITY_FIELD_MISSING");
  return { ...identity, treeIdentityDigest: digest(identity) };
}

export const treesEqual = (left, right) => Boolean(left && right && left.treeSha === right.treeSha);

export function validateCleanupManifest(manifest, { owner, existingResourceIds = [] } = {}) {
  if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.resources))
    return { valid: false, errors: ["CLEANUP_MANIFEST_INVALID"] };
  const errors = [];
  const resourceIds = new Set();
  for (const resource of manifest.resources) {
    if (!resource.id || resourceIds.has(resource.id)) errors.push("CLEANUP_RESOURCE_ID_INVALID");
    resourceIds.add(resource.id);
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
