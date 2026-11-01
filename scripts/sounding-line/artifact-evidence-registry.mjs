import { canonicalJson, digest } from "./evidence.mjs";

export const ARTIFACT_EVIDENCE_VERSION = 2;
export const ARTIFACT_CANONICALIZATION_VERSION = 1;
export const ARTIFACT_TYPES = Object.freeze([
  "screenshot",
  "recording",
  "trace",
  "accessibility",
  "cleanup",
  "journey",
]);
const keyFields = [
  "contractId",
  "journeyId",
  "state",
  "device",
  "viewport",
  "role",
  "motionMode",
  "captureIndex",
  "type",
];
const sha = /^[a-f0-9]{40}$/u,
  sha256 = /^[a-f0-9]{64}$/u;
const types = new Set(ARTIFACT_TYPES);
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) =>
  typeof value === "string" && value.length > 0 && value.length <= 2048 && !/[\u0000-\u001f\u007f]/u.test(value);
const same = (a, b) => canonicalJson(a) === canonicalJson(b);
const need = (condition, code) => {
  if (!condition) throw new Error(`SOUNDING_LINE_ARTIFACT_REGISTRY_${code}`);
};
const keys = (value, expected) => object(value) && same(Object.keys(value).sort(), [...expected].sort());
const identity = (value) =>
  keys(value, ["repository", "runId", "attempt", "workflowSha", "controllerDigest", "policyDigest"]) &&
  value.repository === "Kgray44/treasurehuntSoT" &&
  Number.isSafeInteger(value.runId) &&
  value.runId > 0 &&
  Number.isSafeInteger(value.attempt) &&
  value.attempt > 0 &&
  sha.test(value.workflowSha ?? "") &&
  sha256.test(value.controllerDigest ?? "") &&
  sha256.test(value.policyDigest ?? "");

export function artifactLogicalKey(value) {
  need(keys(value, keyFields), "LOGICAL_KEY_FIELDS");
  for (const field of ["contractId", "journeyId", "state", "role"]) need(text(value[field]), "LOGICAL_KEY_IDENTITY");
  need(
    ["DESKTOP", "MOBILE"].includes(value.device) &&
      ["NORMAL", "REDUCED"].includes(value.motionMode) &&
      types.has(value.type),
    "LOGICAL_KEY_CONTEXT",
  );
  need(
    keys(value.viewport, ["width", "height"]) &&
      [value.viewport.width, value.viewport.height].every((n) => Number.isSafeInteger(n) && n >= 1 && n <= 10000),
    "VIEWPORT",
  );
  need(
    value.captureIndex === null ||
      (Number.isSafeInteger(value.captureIndex) && value.captureIndex >= 0 && value.captureIndex <= 100000),
    "CAPTURE_INDEX",
  );
  return canonicalJson(value);
}
export function artifactContextKey(key) {
  artifactLogicalKey(key);
  const { state: _state, captureIndex: _index, type: _type, ...context } = key;
  return canonicalJson(context);
}
export function sealArtifactManifest(input) {
  const { manifestDigest: _previous, ...body } = input;
  return { ...body, manifestDigest: digest(body) };
}
export function artifactContextBindingsDigest(artifacts) {
  return digest(
    artifacts
      .map(({ completedContextReceiptDigest: _receipt, ...binding }) => binding)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  );
}

// A failed producer may retain a closed context without declaring unfinished
// contexts complete. This projection is still untrusted retention data; provider
// authentication and the current dependency proof are separate operations.
export function createClosedContextCheckpoint(manifest, contextReceiptId, options = {}) {
  need(
    object(manifest) && Buffer.byteLength(canonicalJson(manifest)) <= (options.maximumBytes ?? 2 * 1024 * 1024),
    "CHECKPOINT_INPUT_BOUND",
  );
  for (const field of [
    "completedContexts",
    "artifacts",
    "runtimeAttestations",
    "runtimeCleanupReceipts",
    "journeyReceipts",
    "reviewReceipts",
    "inheritance",
  ])
    need(Array.isArray(manifest[field]) && manifest[field].length <= 8192, "CHECKPOINT_INPUT");
  const selected = manifest.completedContexts.filter((receipt) => receipt.id === contextReceiptId);
  need(selected.length === 1, "CHECKPOINT_CONTEXT_IDENTITY");
  const receipt = selected[0];
  need(Array.isArray(manifest.artifacts) && Array.isArray(receipt.artifactIds), "CHECKPOINT_INPUT");
  const ids = new Set(receipt.artifactIds);
  const artifacts = manifest.artifacts.filter((artifact) => ids.has(artifact.id));
  need(artifacts.length > 0, "CHECKPOINT_CONTEXT_IDENTITY");
  const context = artifactContextKey(artifacts[0].logicalKey);
  need(
    Array.isArray(options.expectedCoverage) && options.expectedCoverage.length <= 8192,
    "CHECKPOINT_EXPECTED_COVERAGE_REQUIRED",
  );
  const fullRequiredCoverageDigest = digest(options.expectedCoverage.map(artifactLogicalKey).sort());
  need(manifest.fullRequiredCoverageDigest === fullRequiredCoverageDigest, "EXPECTED_COVERAGE_MISMATCH");
  const checkpoint = sealArtifactManifest({
    ...manifest,
    kind: "CLOSED_CONTEXT_CHECKPOINT",
    qualification: false,
    requiredCoverage: options.expectedCoverage.filter((key) => artifactContextKey(key) === context),
    artifacts,
    completedContexts: selected,
    runtimeAttestations: manifest.runtimeAttestations.filter(
      (runtime) => runtime.attestationDigest === receipt.runtimeAttestationDigest,
    ),
    runtimeCleanupReceipts: manifest.runtimeCleanupReceipts.filter(
      (cleanup) => cleanup.cleanupDigest === receipt.runtimeCleanupReceiptDigest,
    ),
    journeyReceipts: manifest.journeyReceipts.filter((journey) => journey.contextReceiptId === receipt.id),
    // A review spanning several contexts cannot be narrowed into a new review.
    reviewReceipts: manifest.reviewReceipts.filter((review) => review.artifactIds.some((id) => ids.has(id))),
    inheritance: manifest.inheritance.filter((entry) => ids.has(entry.artifactId)),
    deferredCoverage: [],
  });
  validateArtifactManifest(checkpoint, { ...options, requireComplete: false });
  return JSON.parse(canonicalJson(checkpoint));
}

// Preserve several original closed contexts after a failed producer without
// converting the unfinished remainder into coverage or renumbering receipts.
export function createClosedContextPrefix(manifest, contextReceiptIds, options = {}) {
  need(object(manifest) && Buffer.byteLength(canonicalJson(manifest)) <= 2 * 1024 * 1024, "CHECKPOINT_INPUT_BOUND");
  need(
    Array.isArray(contextReceiptIds) &&
      contextReceiptIds.length > 0 &&
      contextReceiptIds.length <= 128 &&
      contextReceiptIds.every(text) &&
      new Set(contextReceiptIds).size === contextReceiptIds.length,
    "PREFIX_CONTEXT_IDENTITIES",
  );
  need(
    Array.isArray(options.expectedCoverage) && options.expectedCoverage.length <= 8192,
    "CHECKPOINT_EXPECTED_COVERAGE_REQUIRED",
  );
  for (const field of [
    "completedContexts",
    "artifacts",
    "runtimeAttestations",
    "runtimeCleanupReceipts",
    "journeyReceipts",
    "reviewReceipts",
    "inheritance",
  ])
    need(Array.isArray(manifest[field]) && manifest[field].length <= 8192, "CHECKPOINT_INPUT");
  const selectedIds = new Set(contextReceiptIds);
  const completedContexts = manifest.completedContexts.filter((value) => selectedIds.has(value.id));
  need(completedContexts.length === selectedIds.size, "CHECKPOINT_CONTEXT_IDENTITY");
  const ids = new Set();
  for (const context of completedContexts) {
    need(Array.isArray(context.artifactIds) && context.artifactIds.length <= 8192, "CHECKPOINT_INPUT");
    for (const id of context.artifactIds) ids.add(id);
  }
  const artifacts = manifest.artifacts.filter((value) => ids.has(value.id));
  need(artifacts.length > 0, "CHECKPOINT_CONTEXT_IDENTITY");
  const contexts = new Set(artifacts.map((value) => artifactContextKey(value.logicalKey)));
  const fullRequiredCoverageDigest = digest(options.expectedCoverage.map(artifactLogicalKey).sort());
  need(manifest.fullRequiredCoverageDigest === fullRequiredCoverageDigest, "EXPECTED_COVERAGE_MISMATCH");
  const prefix = sealArtifactManifest({
    ...manifest,
    kind: "CLOSED_CONTEXT_PREFIX",
    qualification: false,
    requiredCoverage: options.expectedCoverage.filter((key) => contexts.has(artifactContextKey(key))),
    artifacts,
    completedContexts,
    runtimeAttestations: manifest.runtimeAttestations.filter((runtime) =>
      completedContexts.some((context) => context.runtimeAttestationDigest === runtime.attestationDigest),
    ),
    runtimeCleanupReceipts: manifest.runtimeCleanupReceipts.filter((cleanup) =>
      completedContexts.some((context) => context.runtimeCleanupReceiptDigest === cleanup.cleanupDigest),
    ),
    journeyReceipts: manifest.journeyReceipts.filter((journey) => selectedIds.has(journey.contextReceiptId)),
    // A cross-context review stays whole; validation rejects any attempted slice.
    reviewReceipts: manifest.reviewReceipts.filter((review) => review.artifactIds.some((id) => ids.has(id))),
    inheritance: manifest.inheritance.filter((entry) => ids.has(entry.artifactId)),
    deferredCoverage: [],
  });
  validateArtifactManifest(prefix, { ...options, requireComplete: false });
  return JSON.parse(canonicalJson(prefix));
}

function validLocation(location) {
  if (
    !object(location) ||
    !["GIT", "PROVIDER_ARTIFACT"].includes(location.kind) ||
    location.repository !== "Kgray44/treasurehuntSoT" ||
    !text(location.path)
  )
    return false;
  if (
    /^[\/]|[:\\\u0000-\u001f\u007f]/u.test(location.path) ||
    location.path.split("/").some((part) => !part || part === "." || part === "..")
  )
    return false;
  if (location.representation !== undefined) {
    if (
      location.kind !== "PROVIDER_ARTIFACT" ||
      location.representation !== "ENCRYPTED_RAW_INDEX_MEMBER" ||
      location.encryptedIndexPath !== "index.encrypted" ||
      !/^artifacts\/sounding-line\/product-experience-capture-staging\/capture-[A-Za-z0-9_-]+\/raw\//u.test(
        location.path,
      )
    )
      return false;
  } else if (location.encryptedIndexPath !== undefined) return false;
  return location.kind === "GIT"
    ? sha.test(location.commit ?? "") && sha.test(location.blob ?? "")
    : Number.isSafeInteger(location.artifactId) && location.artifactId > 0 && sha256.test(location.archiveSha256 ?? "");
}

// Validation only: a self-hashed or candidate-written registry remains untrusted.
// Authentication is a separate protected-provider operation with an opaque proof.
export function validateArtifactManifest(
  manifest,
  {
    allowedDeferrals = [],
    spentReviewOrdinals = {},
    maximumBytes = 2 * 1024 * 1024,
    requireComplete = true,
    expectedCoverage,
  } = {},
) {
  need(object(manifest) && Buffer.byteLength(canonicalJson(manifest)) <= maximumBytes, "MANIFEST_BOUND");
  need(
    manifest.schemaVersion === ARTIFACT_EVIDENCE_VERSION &&
      manifest.canonicalizationVersion === ARTIFACT_CANONICALIZATION_VERSION,
    "VERSION",
  );
  need(
    manifest.qualification === false && text(manifest.manifestId) && sha256.test(manifest.manifestDigest ?? ""),
    "RETENTION_IDENTITY",
  );
  need(
    ["COMPLETE_MANIFEST", "CLOSED_CONTEXT_CHECKPOINT", "CLOSED_CONTEXT_PREFIX"].includes(manifest.kind) &&
      (!requireComplete || manifest.kind === "COMPLETE_MANIFEST"),
    "PARTIAL_MANIFEST_NOT_ACCEPTANCE",
  );
  need(sealArtifactManifest(manifest).manifestDigest === manifest.manifestDigest, "MANIFEST_INTEGRITY");
  need(manifest.repository === "Kgray44/treasurehuntSoT" && identity(manifest.producerIdentity), "PRODUCER_IDENTITY");
  need(
    sha.test(manifest.originalBaseSha ?? "") &&
      sha.test(manifest.originalCandidateSha ?? "") &&
      sha.test(manifest.sourceTree ?? ""),
    "ORIGINAL_SOURCE_IDENTITY",
  );
  for (const field of ["controllerDigest", "policyDigest", "contractDigest", "graphDigest"])
    need(sha256.test(manifest[field] ?? ""), "DEFINITION_IDENTITY");
  need(
    manifest.producerIdentity.workflowSha === manifest.originalBaseSha &&
      manifest.producerIdentity.controllerDigest === manifest.controllerDigest &&
      manifest.producerIdentity.policyDigest === manifest.policyDigest,
    "PRODUCER_DEFINITION_MISMATCH",
  );
  for (const field of [
    "requiredCoverage",
    "artifacts",
    "journeyReceipts",
    "reviewReceipts",
    "inheritance",
    "deferredCoverage",
    "completedContexts",
    "runtimeAttestations",
    "runtimeCleanupReceipts",
  ])
    need(Array.isArray(manifest[field]) && manifest[field].length <= 8192, "COLLECTION_BOUND");
  const required = new Set(manifest.requiredCoverage.map(artifactLogicalKey));
  need(required.size === manifest.requiredCoverage.length, "DUPLICATE_REQUIRED_COVERAGE");
  need(sha256.test(manifest.fullRequiredCoverageDigest ?? ""), "FULL_COVERAGE_IDENTITY");
  if (manifest.kind === "COMPLETE_MANIFEST")
    need(manifest.fullRequiredCoverageDigest === digest([...required].sort()), "FULL_COVERAGE_IDENTITY");
  if (manifest.kind === "CLOSED_CONTEXT_PREFIX")
    need(Array.isArray(expectedCoverage) && expectedCoverage.length > 0, "PREFIX_EXPECTED_COVERAGE_REQUIRED");
  if (expectedCoverage) {
    const expected = expectedCoverage.map(artifactLogicalKey).sort();
    need(manifest.fullRequiredCoverageDigest === digest(expected), "EXPECTED_COVERAGE_MISMATCH");
    const selectedContexts = new Set(manifest.requiredCoverage.map(artifactContextKey));
    const selected =
      manifest.kind === "COMPLETE_MANIFEST"
        ? expected
        : expectedCoverage
            .filter((key) => selectedContexts.has(artifactContextKey(key)))
            .map(artifactLogicalKey)
            .sort();
    need(same(selected, [...required].sort()), "EXPECTED_COVERAGE_MISMATCH");
  }
  const runtimes = new Map();
  for (const runtime of manifest.runtimeAttestations) {
    const { attestationDigest, ...body } = runtime;
    need(
      sha256.test(attestationDigest ?? "") &&
        !runtimes.has(attestationDigest) &&
        digest(body) === attestationDigest &&
        identity(runtime.producerIdentity) &&
        text(runtime.captureSession),
      "RUNTIME_ATTESTATION",
    );
    for (const field of ["sourceTreeDigest", "fixtureDigest", "toolchainDigest", "browserDigest", "environmentDigest"])
      need(sha256.test(runtime[field] ?? ""), "RUNTIME_ATTESTATION");
    need(
      ["TASK_OWNED_ISOLATED_PER_CONTEXT", "UNATTESTED_SHARED_TASK_RUNTIME"].includes(runtime.mutableStateClass),
      "RUNTIME_STATE_CLASS",
    );
    runtimes.set(attestationDigest, runtime);
  }
  const cleanups = new Map();
  for (const cleanup of manifest.runtimeCleanupReceipts) {
    const { cleanupDigest, ...body } = cleanup;
    need(
      sha256.test(cleanupDigest ?? "") &&
        !cleanups.has(cleanupDigest) &&
        digest(body) === cleanupDigest &&
        cleanup.status === "PASS" &&
        cleanup.processTreeClosed === true &&
        cleanup.portsClosed === true &&
        cleanup.streamsClosed === true &&
        runtimes.has(cleanup.runtimeAttestationDigest),
      "RUNTIME_CLEANUP_INCOMPLETE",
    );
    cleanups.set(cleanupDigest, cleanup);
  }
  const artifacts = new Map(),
    covered = new Set();
  for (const artifact of manifest.artifacts) {
    need(text(artifact.id) && !artifacts.has(artifact.id), "ARTIFACT_IDENTITY");
    const key = artifactLogicalKey(artifact.logicalKey);
    need(required.has(key) && !covered.has(key), "DUPLICATE_OR_EXTRA_COVERAGE");
    need(
      sha256.test(artifact.objectSha256 ?? "") && Number.isSafeInteger(artifact.byteLength) && artifact.byteLength > 0,
      "OBJECT_IDENTITY",
    );
    for (const field of [
      "definitionFingerprint",
      "dependencyClosureDigest",
      "runtimeAttestationDigest",
      "completedContextReceiptDigest",
    ])
      need(sha256.test(artifact[field] ?? ""), "ARTIFACT_DEFINITION");
    need(
      text(artifact.captureSession) && validLocation(artifact.immutableLocation) && text(artifact.retentionIdentity),
      "IMMUTABLE_LOCATION",
    );
    need(
      identity(artifact.producerIdentity) &&
        sha.test(artifact.originalBaseSha ?? "") &&
        sha.test(artifact.originalCandidateSha ?? ""),
      "ARTIFACT_ORIGINAL_IDENTITY",
    );
    const media = {
      screenshot: "image/png",
      recording: "video/webm",
      trace: "application/zip",
      accessibility: "application/json",
      cleanup: "application/json",
      journey: "application/json",
    };
    need(artifact.mediaType === media[artifact.logicalKey.type], "MEDIA_TYPE");
    covered.add(key);
    artifacts.set(artifact.id, artifact);
  }
  const permitted = new Map(allowedDeferrals.map((entry) => [artifactLogicalKey(entry.logicalKey), entry.authority]));
  for (const entry of manifest.deferredCoverage) {
    const key = artifactLogicalKey(entry.logicalKey);
    need(
      required.has(key) && !covered.has(key) && permitted.has(key) && same(permitted.get(key), entry.authority),
      "UNAUTHORIZED_DEFERRAL",
    );
    covered.add(key);
  }
  need(covered.size === required.size, "MISSING_REQUIRED_COVERAGE");
  const inherited = new Set();
  for (const entry of manifest.inheritance) {
    const artifact = artifacts.get(entry.artifactId);
    need(
      artifact && !inherited.has(entry.artifactId) && entry.originalArtifactId === artifact.id,
      "INHERITANCE_IDENTITY",
    );
    need(
      sha256.test(entry.originalManifestDigest ?? "") &&
        sha256.test(entry.exactIntervalProofDigest ?? "") &&
        entry.currentCandidateSha === manifest.originalCandidateSha,
      "INHERITANCE_BINDING",
    );
    need(
      entry.originalBaseSha === artifact.originalBaseSha &&
        entry.originalCandidateSha === artifact.originalCandidateSha,
      "ORIGINAL_IDENTITY_REWRITE",
    );
    need(
      Array.isArray(entry.lineage) &&
        entry.lineage.length > 0 &&
        entry.lineage.length <= 32 &&
        entry.lineage.every((value) => sha256.test(value)) &&
        new Set(entry.lineage).size === entry.lineage.length &&
        !entry.lineage.includes(manifest.manifestDigest),
      "LINEAGE_CYCLE_OR_BOUND",
    );
    need(entry.lineage[0] === entry.originalManifestDigest, "LINEAGE_ORIGIN");
    inherited.add(entry.artifactId);
  }
  for (const artifact of artifacts.values()) {
    if (inherited.has(artifact.id)) continue;
    need(
      artifact.originalBaseSha === manifest.originalBaseSha &&
        artifact.originalCandidateSha === manifest.originalCandidateSha &&
        same(artifact.producerIdentity, manifest.producerIdentity),
      "UNBOUND_FOREIGN_ARTIFACT",
    );
  }
  const contexts = new Map();
  for (const receipt of manifest.completedContexts) {
    need(
      text(receipt.id) &&
        !contexts.has(receipt.id) &&
        receipt.status === "PASS" &&
        receipt.closed === true &&
        receipt.cleanup === "PASS",
      "INCOMPLETE_CONTEXT",
    );
    need(
      sha256.test(receipt.receiptDigest ?? "") &&
        sha256.test(receipt.runtimeAttestationDigest ?? "") &&
        text(receipt.captureSession),
      "CONTEXT_IDENTITY",
    );
    const { receiptDigest: _receiptDigest, ...body } = receipt;
    need(
      digest(body) === receipt.receiptDigest && Number.isFinite(Date.parse(receipt.completedAt)),
      "CONTEXT_INTEGRITY",
    );
    need(
      Array.isArray(receipt.artifactIds) &&
        receipt.artifactIds.length > 0 &&
        new Set(receipt.artifactIds).size === receipt.artifactIds.length,
      "CONTEXT_ARTIFACT_IDENTITY",
    );
    const selected = receipt.artifactIds.map((id) => artifacts.get(id));
    need(selected.every(Boolean), "CONTEXT_ARTIFACT_MISSING");
    const context = artifactContextKey(selected[0].logicalKey);
    const runtime = runtimes.get(receipt.runtimeAttestationDigest),
      cleanup = cleanups.get(receipt.runtimeCleanupReceiptDigest);
    need(
      runtime &&
        cleanup?.runtimeAttestationDigest === receipt.runtimeAttestationDigest &&
        runtime.captureSession === receipt.captureSession &&
        same(runtime.producerIdentity, selected[0].producerIdentity),
      "CONTEXT_RUNTIME_UNBOUND",
    );
    need(receipt.artifactBindingsDigest === artifactContextBindingsDigest(selected), "CONTEXT_BYTE_BINDING");
    need(
      selected.every(
        (artifact) =>
          artifactContextKey(artifact.logicalKey) === context &&
          artifact.captureSession === receipt.captureSession &&
          artifact.runtimeAttestationDigest === receipt.runtimeAttestationDigest &&
          artifact.completedContextReceiptDigest === receipt.receiptDigest,
      ),
      "CONTEXT_ARTIFACT_SUBSTITUTION",
    );
    need(
      selected.every(
        (artifact) =>
          artifact.originalBaseSha === receipt.originalBaseSha &&
          artifact.originalCandidateSha === receipt.originalCandidateSha &&
          same(artifact.producerIdentity, receipt.producerIdentity),
      ),
      "CONTEXT_ORIGINAL_IDENTITY",
    );
    for (const type of ARTIFACT_TYPES)
      need(
        selected.some((artifact) => artifact.logicalKey.type === type),
        "CONTEXT_FAMILY_MISSING",
      );
    const requiredContext = manifest.requiredCoverage
      .filter((key) => artifactContextKey(key) === context)
      .map(artifactLogicalKey);
    need(
      requiredContext.length === selected.length &&
        requiredContext.every((key) => selected.some((artifact) => artifactLogicalKey(artifact.logicalKey) === key)),
      "CONTEXT_COVERAGE_INCOMPLETE",
    );
    need(![...contexts.values()].some((value) => value === context), "DUPLICATE_COMPLETED_CONTEXT");
    contexts.set(receipt.id, context);
  }
  need(
    manifest.kind !== "CLOSED_CONTEXT_CHECKPOINT" || (contexts.size === 1 && manifest.deferredCoverage.length === 0),
    "CHECKPOINT_SCOPE",
  );
  need(
    manifest.kind !== "CLOSED_CONTEXT_PREFIX" ||
      (contexts.size > 0 && contexts.size <= 128 && manifest.deferredCoverage.length === 0),
    "PREFIX_SCOPE",
  );
  const journeys = new Set();
  for (const journey of manifest.journeyReceipts) {
    need(
      text(journey.id) &&
        !journeys.has(journey.id) &&
        contexts.has(journey.contextReceiptId) &&
        journey.status === "PASS" &&
        sha256.test(journey.definitionFingerprint ?? ""),
      "JOURNEY_RECEIPT",
    );
    need(
      Array.isArray(journey.artifactIds) &&
        journey.artifactIds.length > 0 &&
        new Set(journey.artifactIds).size === journey.artifactIds.length &&
        journey.artifactIds.every((id) => artifacts.has(id)),
      "JOURNEY_ARTIFACT_SCOPE",
    );
    need(
      journey.artifactIds.every(
        (id) => artifactContextKey(artifacts.get(id).logicalKey) === contexts.get(journey.contextReceiptId),
      ),
      "JOURNEY_ARTIFACT_SCOPE",
    );
    journeys.add(journey.id);
  }
  for (const id of contexts.keys())
    need(
      manifest.journeyReceipts.some((journey) => journey.contextReceiptId === id),
      "JOURNEY_RECEIPT_MISSING",
    );
  const closed = new Set(manifest.completedContexts.map((receipt) => receipt.receiptDigest));
  for (const artifact of artifacts.values())
    need(closed.has(artifact.completedContextReceiptDigest), "ARTIFACT_CONTEXT_UNCLOSED");
  const reviews = new Set();
  for (const review of manifest.reviewReceipts) {
    need(text(review.id) && !reviews.has(review.id) && text(review.contractId), "REVIEW_IDENTITY");
    need(
      Number.isSafeInteger(review.originalOrdinal) &&
        review.originalOrdinal > 0 &&
        spentReviewOrdinals[review.contractId] === review.originalOrdinal,
      "UNAUTHORIZED_REVIEW_ORDINAL",
    );
    need(
      sha.test(review.originalCandidateSha ?? "") &&
        sha256.test(review.originalPacketDigest ?? "") &&
        Array.isArray(review.artifactIds) &&
        review.artifactIds.length > 0 &&
        new Set(review.artifactIds).size === review.artifactIds.length &&
        review.artifactIds.every((id) => artifacts.get(id)?.logicalKey.contractId === review.contractId),
      "REVIEW_SCOPE",
    );
    need(
      Array.isArray(review.priorFindingIds) && new Set(review.priorFindingIds).size === review.priorFindingIds.length,
      "REVIEW_FINDINGS",
    );
    reviews.add(review.id);
  }
  return {
    manifestDigest: manifest.manifestDigest,
    requiredCoverage: required.size,
    artifacts: artifacts.size,
    completedContexts: contexts.size,
    authentication: "RETENTION_ONLY_NOT_AUTHENTICATED",
    qualification: false,
  };
}
