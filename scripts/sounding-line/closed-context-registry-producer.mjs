// Shadow custody only. These declarations cannot certify external isolation,
// grant capture skips, spend a review ordinal, or satisfy release acceptance.
import { createHash } from "node:crypto";
import { canonicalJson, digest } from "./evidence.mjs";
import {
  artifactLogicalKey,
  artifactContextKey,
  artifactContextBindingsDigest,
  sealArtifactManifest,
  validateArtifactManifest,
} from "./artifact-evidence-registry.mjs";
import { closedContextIdentity, rawCaptureBinding } from "./experience-raw-output.mjs";
import { shadowCaptureContextSchedule } from "./experience-browser.mjs";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const need = (value, code) => {
  if (!value) throw Error(`SOUNDING_LINE_CONTEXT_REGISTRY_PRODUCER_${code}`);
};
const equal = (a, b) => canonicalJson(a) === canonicalJson(b);
const sha = (value) => typeof value === "string" && /^[a-f0-9]{40}$/u.test(value);
const sha256 = (value) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const media = {
  screenshot: "image/png",
  recording: "video/webm",
  trace: "application/zip",
  accessibility: "application/json",
  cleanup: "application/json",
  journey: "application/json",
};
export const CLOSED_CONTEXT_REGISTRY_SHADOW_POLICY = Object.freeze({
  version: 1,
  maximumContexts: 128,
  maximumArtifacts: 8192,
  maximumRegistryBytes: 2 * 1024 * 1024,
  runtimeStateClass: "UNATTESTED_SHARED_TASK_RUNTIME",
  qualification: false,
  reuseAuthorized: false,
});

// The I/O adapter must independently verify every original file and provider
// location. This pure transformation never authenticates its arguments.
export function buildClosedContextRegistryShadow({
  plan,
  contexts,
  producer,
  sourceTree,
  controllerDigest,
  rawArtifact,
  lifecycleArtifact,
  cleanup,
  definitionObservations,
  captureMode = "capture",
}) {
  need(plan && Buffer.byteLength(canonicalJson(plan)) <= 2 * 1024 * 1024, "PLAN_BOUND");
  const schedule = shadowCaptureContextSchedule(plan);
  need(
    ["capture", "capture-diagnostic"].includes(captureMode) &&
      (captureMode !== "capture-diagnostic" || plan.baseSha === plan.candidateSha),
    "CAPTURE_MODE",
  );
  need(Array.isArray(contexts) && contexts.length > 0 && contexts.length <= 128, "CONTEXT_BOUND");
  for (const observation of contexts) need(observation?.journal?.context?.viewport, "CONTEXT_IDENTITY");
  contexts = [...contexts].sort(
    (a, b) =>
      schedule.findIndex((value) => value.contextId === closedContextIdentity(a.journal.context)) -
      schedule.findIndex((value) => value.contextId === closedContextIdentity(b.journal.context)),
  );
  need(
    producer?.repository === "Kgray44/treasurehuntSoT" &&
      positive(producer.runId) &&
      positive(producer.attempt) &&
      producer.workflowSha === plan.baseSha &&
      sha(sourceTree) &&
      sha256(controllerDigest),
    "PRODUCER_BINDING",
  );
  for (const artifact of [rawArtifact, lifecycleArtifact])
    need(positive(artifact?.id) && sha256(artifact.archiveSha256), "PROVIDER_LOCATION");
  const cleanups = Array.isArray(cleanup) ? cleanup : [cleanup];
  need(
    cleanups.length > 0 &&
      cleanups.length <= 16 &&
      new Set(cleanups.map((value) => value?.fixtureProfile ?? "generic")).size === cleanups.length,
    "CLEANUP_PROFILES",
  );
  for (const cleanup of cleanups) {
    need(
      Buffer.isBuffer(cleanup?.bytes) &&
        cleanup.bytes.length > 0 &&
        cleanup.bytes.length <= 1024 * 1024 &&
        typeof cleanup.path === "string",
      "CLEANUP_BYTES",
    );
    need(
      cleanup.processTreeClosed === true && cleanup.portsClosed === true && cleanup.streamsClosed === true,
      "CLEANUP_INCOMPLETE",
    );
  }
  const observationKeys = ["fixtureDigest", "toolchainDigest", "browserDigest", "environmentDigest"];
  need(
    definitionObservations &&
      equal(Object.keys(definitionObservations).sort(), observationKeys.sort()) &&
      observationKeys.every((key) => sha256(definitionObservations[key])),
    "OBSERVATION_BINDING",
  );
  const policyDigest = digest(CLOSED_CONTEXT_REGISTRY_SHADOW_POLICY),
    producerIdentity = { ...producer, controllerDigest, policyDigest };
  need(
    Object.keys(producerIdentity).sort().join() ===
      ["repository", "runId", "attempt", "workflowSha", "controllerDigest", "policyDigest"].sort().join(),
    "PRODUCER_FIELDS",
  );
  const graphDigest = digest({
    classification: "UNKNOWN_EXTERNAL_RUNTIME_DEPENDENCIES",
    sourceDigest: plan.sourceDigest,
    contractDigest: plan.contractDigest,
  });
  const requiredFor = (target, type, state = "CONTEXT_CLOSED", index = null) => ({
    ...target.context,
    journeyId: target.context.journeyId,
    state,
    captureIndex: index,
    type,
  });
  const expectedCoverage = [];
  // States and indexes follow the same authored step order as capture. Missing
  // or extra screenshots cannot silently narrow a completed context.
  for (const target of schedule) {
    const contract = plan.contracts.find((value) => value.id === target.context.contractId);
    const journey = contract.experience.journeys.find((value) => value.id === target.context.journeyId);
    need(
      !journey.steps.some((step) => Object.hasOwn(step, "devices") || Object.hasOwn(step, "when")),
      "CONDITIONAL_COVERAGE_UNAVAILABLE",
    );
    for (const [index, step] of journey.steps.entries())
      if (step.state) expectedCoverage.push(requiredFor(target, "screenshot", step.state, index));
    for (const type of ["recording", "trace", "accessibility", "cleanup", "journey"])
      expectedCoverage.push(requiredFor(target, type));
  }
  const artifacts = [],
    completedContexts = [],
    runtimeAttestations = [],
    runtimeCleanupReceipts = [],
    journeyReceipts = [],
    seenContexts = new Set(),
    seenIds = new Set();
  for (const observation of contexts) {
    const journal = observation.journal,
      target = schedule.find((value) => value.contextId === closedContextIdentity(journal?.context));
    need(target && !seenContexts.has(target.contextId), "CONTEXT_IDENTITY");
    seenContexts.add(target.contextId);
    const profile =
      plan.contracts.find((value) => value.id === target.context.contractId).experience.fixtureProfile ?? "generic";
    const cleanup = cleanups.find((value) => (value.fixtureProfile ?? "generic") === profile);
    need(cleanup, "CLEANUP_PROFILE_MISSING");
    need(
      journal.classification === "CLOSED_BROWSER_CONTEXT_OBSERVATION_NOT_RUNTIME_CLEANUP" &&
        equal(journal.binding, rawCaptureBinding(plan)) &&
        journal.mutableStateClass === "UNATTESTED_SHARED_TASK_RUNTIME" &&
        journal.parentRuntimeCleanup === "UNAVAILABLE_UNTIL_PARENT_REAP" &&
        journal.qualification === false &&
        journal.reuseAuthorized === false,
      "JOURNAL_BINDING",
    );
    need(
      Buffer.isBuffer(observation.bytes) &&
        observation.bytes.length <= 2 * 1024 * 1024 &&
        equal(JSON.parse(observation.bytes.toString("utf8")), journal) &&
        typeof observation.path === "string",
      "JOURNAL_BYTES",
    );
    need(
      journal.journey?.status === "PASS" &&
        journal.journey.id === target.context.journeyId &&
        journal.journey.accessibility?.states?.length > 0 &&
        Array.isArray(journal.artifacts) &&
        journal.artifacts.length <= 512 &&
        Array.isArray(journal.rawFiles) &&
        journal.rawFiles.length === journal.artifacts.length,
      "JOURNEY_INCOMPLETE",
    );
    const captureSession = `original-${producer.runId}-${producer.attempt}-${target.contextId}`;
    const runtimeBody = {
      producerIdentity,
      captureSession,
      sourceTreeDigest: digest({ sourceTree }),
      ...definitionObservations,
      mutableStateClass: "UNATTESTED_SHARED_TASK_RUNTIME",
    };
    const runtime = { ...runtimeBody, attestationDigest: digest(runtimeBody) };
    const cleanupBody = {
      status: "PASS",
      processTreeClosed: true,
      portsClosed: true,
      streamsClosed: true,
      runtimeAttestationDigest: runtime.attestationDigest,
    };
    const cleanupReceipt = { ...cleanupBody, cleanupDigest: digest(cleanupBody) };
    const selected = [];
    const add = (id, logicalKey, bytes, objectSha256, path, location) => {
      need(typeof id === "string" && !seenIds.has(id), "ARTIFACT_IDENTITY");
      seenIds.add(id);
      selected.push({
        id,
        logicalKey,
        objectSha256,
        byteLength: bytes,
        mediaType: media[logicalKey.type],
        definitionFingerprint: digest({ logicalKey, contractDigest: plan.contractDigest }),
        dependencyClosureDigest: digest({ graphDigest, contextId: target.contextId, unknown: true }),
        runtimeAttestationDigest: runtime.attestationDigest,
        captureSession,
        completedContextReceiptDigest: "0".repeat(64),
        immutableLocation: {
          kind: "PROVIDER_ARTIFACT",
          repository: producer.repository,
          artifactId: location.id,
          archiveSha256: location.archiveSha256,
          path,
          ...(location === rawArtifact
            ? { representation: "ENCRYPTED_RAW_INDEX_MEMBER", encryptedIndexPath: "index.encrypted" }
            : {}),
        },
        retentionIdentity: `provider-run-${producer.runId}-${producer.attempt}-artifact-${location.id}`,
        producerIdentity,
        originalBaseSha: plan.baseSha,
        originalCandidateSha: plan.candidateSha,
      });
    };
    for (const original of journal.artifacts) {
      need(["screenshot", "recording", "trace"].includes(original.type) && sha256(original.sha256), "MEDIA_KIND");
      const files = journal.rawFiles.filter((file) => file.originalPath === original.path);
      need(
        files.length === 1 && files[0].sha256 === original.sha256 && positive(files[0].bytes),
        "ORIGINAL_MEDIA_BINDING",
      );
      let key = requiredFor(target, original.type);
      if (original.type === "screenshot") {
        const keys = expectedCoverage.filter(
          (value) =>
            value.type === "screenshot" &&
            artifactContextKey(value) === artifactContextKey(key) &&
            value.state === original.state &&
            original.id ===
              `${value.contractId}-${value.journeyId}-${value.device}-${value.role}-${value.motionMode}-${value.state}-${value.captureIndex}`,
        );
        need(keys.length === 1, "ORIGINAL_SCREENSHOT_INDEX");
        key = keys[0];
      }
      need(
        ["contractId", "device", "role", "motionMode"].every((field) => original[field] === target.context[field]),
        "MEDIA_CONTEXT",
      );
      add(original.id, key, files[0].bytes, original.sha256, files[0].path, rawArtifact);
    }
    for (const type of ["accessibility", "journey"])
      add(
        `original-${target.contextId}-${type}`,
        requiredFor(target, type),
        observation.bytes.length,
        hash(observation.bytes),
        observation.path,
        rawArtifact,
      );
    add(
      `original-${target.contextId}-cleanup`,
      requiredFor(target, "cleanup"),
      cleanup.bytes.length,
      hash(cleanup.bytes),
      cleanup.path,
      lifecycleArtifact,
    );
    const receiptBody = {
      id: `original-context-${target.contextId}`,
      status: "PASS",
      closed: true,
      cleanup: "PASS",
      runtimeAttestationDigest: runtime.attestationDigest,
      runtimeCleanupReceiptDigest: cleanupReceipt.cleanupDigest,
      captureSession,
      completedAt: observation.completedAt,
      originalScheduleOrdinal: schedule.findIndex((value) => value.contextId === target.contextId) + 1,
      artifactIds: selected.map((value) => value.id),
      artifactBindingsDigest: artifactContextBindingsDigest(selected),
      originalBaseSha: plan.baseSha,
      originalCandidateSha: plan.candidateSha,
      producerIdentity,
    };
    const receipt = { ...receiptBody, receiptDigest: digest(receiptBody) };
    for (const artifact of selected) artifact.completedContextReceiptDigest = receipt.receiptDigest;
    artifacts.push(...selected);
    completedContexts.push(receipt);
    runtimeAttestations.push(runtime);
    runtimeCleanupReceipts.push(cleanupReceipt);
    journeyReceipts.push({
      id: `original-journey-${target.contextId}`,
      contextReceiptId: receipt.id,
      status: "PASS",
      definitionFingerprint: digest({ contractDigest: plan.contractDigest, journeyId: target.context.journeyId }),
      artifactIds: selected.map((value) => value.id),
    });
  }
  need(artifacts.length <= 8192, "ARTIFACT_BOUND");
  const selectedContexts = new Set(artifacts.map((artifact) => artifactContextKey(artifact.logicalKey)));
  const requiredCoverage = expectedCoverage.filter((key) => selectedContexts.has(artifactContextKey(key)));
  const manifest = sealArtifactManifest({
    schemaVersion: 2,
    canonicalizationVersion: 1,
    kind: "CLOSED_CONTEXT_PREFIX",
    qualification: false,
    manifestId: `original-context-prefix-${producer.runId}-${producer.attempt}`,
    producerMode: captureMode,
    repository: producer.repository,
    producerIdentity,
    originalBaseSha: plan.baseSha,
    originalCandidateSha: plan.candidateSha,
    sourceTree,
    controllerDigest,
    policyDigest,
    contractDigest: plan.contractDigest,
    graphDigest,
    requiredCoverage,
    fullRequiredCoverageDigest: digest(expectedCoverage.map(artifactLogicalKey).sort()),
    artifacts,
    completedContexts,
    runtimeAttestations,
    runtimeCleanupReceipts,
    journeyReceipts,
    reviewReceipts: [],
    inheritance: [],
    deferredCoverage: [],
  });
  validateArtifactManifest(manifest, { expectedCoverage, requireComplete: false });
  return {
    manifest,
    expectedCoverage,
    classification: "CLOSED_CONTEXT_REGISTRY_TRANSFORMATION_NOT_AUTHENTICATED",
    qualification: false,
    reuseAuthorized: false,
  };
}
