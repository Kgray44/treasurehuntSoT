import assert from "node:assert/strict";
import test from "node:test";
import { digest } from "../../scripts/sounding-line/evidence.mjs";
import {
  ARTIFACT_TYPES,
  artifactLogicalKey,
  artifactContextBindingsDigest,
  sealArtifactManifest,
  validateArtifactManifest,
} from "../../scripts/sounding-line/artifact-evidence-registry.mjs";

const base = "a".repeat(40),
  candidate = "b".repeat(40);
function fixture({ secondScreenshot = false } = {}) {
  const producerIdentity = {
    repository: "Kgray44/treasurehuntSoT",
    runId: 101,
    attempt: 1,
    workflowSha: base,
    controllerDigest: digest("controller"),
    policyDigest: digest("policy"),
  };
  const runtimeBody = {
    producerIdentity,
    captureSession: "session-one",
    sourceTreeDigest: digest("tree"),
    fixtureDigest: digest("fixture"),
    toolchainDigest: digest("toolchain"),
    browserDigest: digest("browser"),
    environmentDigest: digest("environment"),
    mutableStateClass: "TASK_OWNED_ISOLATED_PER_CONTEXT",
  };
  const runtime = { ...runtimeBody, attestationDigest: digest(runtimeBody) };
  const cleanupBody = {
    status: "PASS",
    processTreeClosed: true,
    portsClosed: true,
    streamsClosed: true,
    runtimeAttestationDigest: runtime.attestationDigest,
  };
  const cleanup = { ...cleanupBody, cleanupDigest: digest(cleanupBody) };
  const logical = (type, state = "READY", captureIndex = 0) => ({
    contractId: "contract",
    journeyId: "journey",
    state: type === "screenshot" ? state : "CONTEXT_CLOSED",
    device: "DESKTOP",
    viewport: { width: 1440, height: 900 },
    role: "OWNER",
    motionMode: "NORMAL",
    captureIndex: type === "screenshot" ? captureIndex : null,
    type,
  });
  const requiredCoverage = ARTIFACT_TYPES.map((type) => logical(type));
  if (secondScreenshot) requiredCoverage.push(logical("screenshot", "NEXT", 1));
  const artifacts = requiredCoverage.map((logicalKey, index) => ({
    id: `original-artifact-${index}`,
    logicalKey,
    objectSha256: digest(`bytes:${logicalKey.type}`),
    byteLength: 100,
    mediaType:
      { screenshot: "image/png", recording: "video/webm", trace: "application/zip" }[logicalKey.type] ??
      "application/json",
    definitionFingerprint: digest(logicalKey),
    dependencyClosureDigest: digest("closed dependency graph"),
    runtimeAttestationDigest: runtime.attestationDigest,
    captureSession: runtime.captureSession,
    completedContextReceiptDigest: digest("pending seal"),
    immutableLocation: {
      kind: "PROVIDER_ARTIFACT",
      repository: producerIdentity.repository,
      artifactId: 501,
      archiveSha256: digest("archive"),
      path: `context/${index}.data`,
    },
    retentionIdentity: "provider-run-101-artifact-501",
    producerIdentity,
    originalBaseSha: base,
    originalCandidateSha: candidate,
  }));
  const contextBody = {
    id: "original-context",
    status: "PASS",
    closed: true,
    cleanup: "PASS",
    runtimeAttestationDigest: runtime.attestationDigest,
    runtimeCleanupReceiptDigest: cleanup.cleanupDigest,
    captureSession: runtime.captureSession,
    completedAt: "2026-11-01T00:00:00Z",
    artifactIds: artifacts.map((artifact) => artifact.id),
    artifactBindingsDigest: artifactContextBindingsDigest(artifacts),
    originalBaseSha: base,
    originalCandidateSha: candidate,
    producerIdentity,
  };
  const context = { ...contextBody, receiptDigest: digest(contextBody) };
  for (const artifact of artifacts) artifact.completedContextReceiptDigest = context.receiptDigest;
  return sealArtifactManifest({
    schemaVersion: 2,
    canonicalizationVersion: 1,
    kind: "COMPLETE_MANIFEST",
    qualification: false,
    manifestId: "original-manifest",
    repository: producerIdentity.repository,
    producerIdentity,
    originalBaseSha: base,
    originalCandidateSha: candidate,
    sourceTree: "c".repeat(40),
    controllerDigest: producerIdentity.controllerDigest,
    policyDigest: producerIdentity.policyDigest,
    contractDigest: digest("contract"),
    graphDigest: digest("graph"),
    requiredCoverage,
    fullRequiredCoverageDigest: digest(requiredCoverage.map(artifactLogicalKey).sort()),
    artifacts,
    journeyReceipts: [
      {
        id: "original-journey",
        contextReceiptId: context.id,
        status: "PASS",
        definitionFingerprint: digest("journey"),
        artifactIds: context.artifactIds,
      },
    ],
    reviewReceipts: [],
    inheritance: [],
    deferredCoverage: [],
    completedContexts: [context],
    runtimeAttestations: [runtime],
    runtimeCleanupReceipts: [cleanup],
  });
}

test("a complete v2 registry validates only as untrusted retention data", () => {
  const manifest = fixture();
  const result = validateArtifactManifest(manifest, { expectedCoverage: manifest.requiredCoverage });
  assert.equal(result.requiredCoverage, 6);
  assert.equal(result.completedContexts, 1);
  assert.equal(result.authentication, "RETENTION_ONLY_NOT_AUTHENTICATED");
  assert.equal(result.qualification, false);
});

test("content identity never substitutes for a different logical state", () => {
  const manifest = fixture({ secondScreenshot: true });
  assert.equal(manifest.artifacts[0].objectSha256, manifest.artifacts.at(-1).objectSha256);
  assert.notEqual(
    artifactLogicalKey(manifest.artifacts[0].logicalKey),
    artifactLogicalKey(manifest.artifacts.at(-1).logicalKey),
  );
  assert.equal(validateArtifactManifest(manifest).requiredCoverage, 7);
  manifest.artifacts.pop();
  assert.throws(() => validateArtifactManifest(sealArtifactManifest(manifest)), /MISSING_REQUIRED_COVERAGE/u);
});

for (const [name, mutate, code] of [
  [
    "missing coverage",
    (m) => {
      m.artifacts.pop();
    },
    /MISSING_REQUIRED_COVERAGE/u,
  ],
  [
    "duplicate coverage",
    (m) => {
      m.requiredCoverage.push(m.requiredCoverage[0]);
    },
    /DUPLICATE_REQUIRED_COVERAGE/u,
  ],
  [
    "substituted object",
    (m) => {
      m.artifacts[0].objectSha256 = digest("substitution");
    },
    /CONTEXT_BYTE_BINDING/u,
  ],
  [
    "rewritten candidate identity",
    (m) => {
      m.artifacts[0].originalCandidateSha = "d".repeat(40);
    },
    /UNBOUND_FOREIGN_ARTIFACT/u,
  ],
  [
    "incomplete context",
    (m) => {
      m.completedContexts[0].closed = false;
    },
    /INCOMPLETE_CONTEXT/u,
  ],
  [
    "missing closed context",
    (m) => {
      m.completedContexts = [];
      m.journeyReceipts = [];
    },
    /ARTIFACT_CONTEXT_UNCLOSED/u,
  ],
  [
    "failed runtime cleanup",
    (m) => {
      m.runtimeCleanupReceipts[0].portsClosed = false;
    },
    /RUNTIME_CLEANUP_INCOMPLETE/u,
  ],
  [
    "missing runtime witness",
    (m) => {
      m.runtimeAttestations = [];
    },
    /RUNTIME_CLEANUP_INCOMPLETE/u,
  ],
  [
    "journey scope substitution",
    (m) => {
      m.journeyReceipts[0].artifactIds = ["missing"];
    },
    /JOURNEY_ARTIFACT_SCOPE/u,
  ],
  [
    "absolute immutable location",
    (m) => {
      m.artifacts[0].immutableLocation.path = "C:/outside";
    },
    /IMMUTABLE_LOCATION/u,
  ],
  [
    "path traversal",
    (m) => {
      m.artifacts[0].immutableLocation.path = "context/../outside";
    },
    /IMMUTABLE_LOCATION/u,
  ],
  [
    "unexpected media",
    (m) => {
      m.artifacts[0].mediaType = "text/html";
    },
    /MEDIA_TYPE/u,
  ],
  [
    "forged release authority",
    (m) => {
      m.qualification = true;
    },
    /RETENTION_IDENTITY/u,
  ],
])
  test(`rejects ${name} even after the manifest is self-rehashed`, () => {
    const manifest = fixture();
    mutate(manifest);
    assert.throws(() => validateArtifactManifest(sealArtifactManifest(manifest)), code);
  });

test("a closed-context checkpoint cannot stand in for a complete final manifest", () => {
  const manifest = sealArtifactManifest({ ...fixture(), kind: "CLOSED_CONTEXT_CHECKPOINT" });
  assert.throws(() => validateArtifactManifest(manifest), /PARTIAL_MANIFEST_NOT_ACCEPTANCE/u);
  assert.equal(validateArtifactManifest(manifest, { requireComplete: false }).completedContexts, 1);
  const wrong = fixture().requiredCoverage.map((key) => ({ ...key, role: "OTHER_OWNER" }));
  assert.throws(
    () => validateArtifactManifest(manifest, { requireComplete: false, expectedCoverage: wrong }),
    /EXPECTED_COVERAGE_MISMATCH/u,
  );
});

test("inheritance adds a current binding while every original source identity remains intact", () => {
  const parent = fixture();
  const current = structuredClone(parent);
  current.manifestId = "successor-manifest";
  current.originalBaseSha = "d".repeat(40);
  current.originalCandidateSha = "e".repeat(40);
  current.producerIdentity = { ...current.producerIdentity, runId: 102, workflowSha: current.originalBaseSha };
  current.inheritance = current.artifacts.map((artifact) => ({
    artifactId: artifact.id,
    originalArtifactId: artifact.id,
    originalManifestDigest: parent.manifestDigest,
    exactIntervalProofDigest: digest("independent interval proof"),
    originalBaseSha: artifact.originalBaseSha,
    originalCandidateSha: artifact.originalCandidateSha,
    currentCandidateSha: current.originalCandidateSha,
    lineage: [parent.manifestDigest],
  }));
  const sealed = sealArtifactManifest(current);
  assert.equal(validateArtifactManifest(sealed).artifacts, 6);
  assert.equal(sealed.completedContexts[0].originalCandidateSha, candidate);
  assert.equal(sealed.artifacts[0].originalCandidateSha, candidate);
  sealed.inheritance[0].lineage.push(parent.manifestDigest);
  assert.throws(() => validateArtifactManifest(sealArtifactManifest(sealed)), /LINEAGE_CYCLE_OR_BOUND/u);
});

test("review metadata cannot reset a spent ordinal or silently change its scope", () => {
  const manifest = fixture();
  manifest.reviewReceipts = [
    {
      id: "original-review",
      contractId: "contract",
      originalOrdinal: 3,
      originalCandidateSha: candidate,
      originalPacketDigest: digest("original packet"),
      artifactIds: manifest.artifacts.map((artifact) => artifact.id),
      priorFindingIds: ["original-blocker"],
    },
  ];
  assert.throws(() => validateArtifactManifest(sealArtifactManifest(manifest)), /UNAUTHORIZED_REVIEW_ORDINAL/u);
  assert.equal(
    validateArtifactManifest(sealArtifactManifest(manifest), { spentReviewOrdinals: { contract: 3 } }).qualification,
    false,
  );
  manifest.reviewReceipts[0].originalOrdinal = 1;
  assert.throws(
    () => validateArtifactManifest(sealArtifactManifest(manifest), { spentReviewOrdinals: { contract: 3 } }),
    /UNAUTHORIZED_REVIEW_ORDINAL/u,
  );
});
