import { digest } from "../../../scripts/sounding-line/evidence.mjs";
import {
  ARTIFACT_TYPES,
  artifactLogicalKey,
  artifactContextBindingsDigest,
  sealArtifactManifest,
} from "../../../scripts/sounding-line/artifact-evidence-registry.mjs";
const defaultBase = "a".repeat(40),
  defaultCandidate = "b".repeat(40);
export function artifactRegistryFixture({
  baseSha = defaultBase,
  candidateSha = defaultCandidate,
  runId = 101,
  secondScreenshot = false,
  graphDigest = digest("graph"),
  dependencyClosureDigest = digest("closed dependency graph"),
} = {}) {
  const base = baseSha,
    candidate = candidateSha;
  const producerIdentity = {
    repository: "Kgray44/treasurehuntSoT",
    runId,
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
    dependencyClosureDigest,
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
    graphDigest,
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
