"use strict";

const {
  RUNTIME_PACKAGE_SCHEMA_VERSION,
  VISION_ENGINE_VERSION,
  VISION_MODEL_BUNDLE_VERSION,
  VisionEngineError,
  sha256,
  stableStringify,
} = require("./vision-engine-contract.cjs");

const PACKAGE_FORMAT_VERSION = "b4-json-envelope-1";
const allowedArtifactNames = Object.freeze([
  "runtime-config.json",
  "global-reference-index.json",
  "negative-reference-index.json",
  "local-reference-features.json",
  "reference-graph.json",
  "reconstruction.json",
  "accepted-pose-regions.json",
  "stable-regions.json",
  "checkpoint-rules.json",
  "calibration.json",
  "guidance-map.json",
  "compatibility.json",
  "certification-summary.json",
]);

function artifactEntry(name, data) {
  if (!allowedArtifactNames.includes(name) || name.includes("/") || name.includes("\\") || name.includes(".."))
    throw new VisionEngineError("PACKAGE_SCHEMA_FAILURE", `Package artifact name ${name} is not allowed.`, {
      retryable: false,
    });
  const body = stableStringify(data);
  return { name, mediaType: "application/json", size: Buffer.byteLength(body), hash: `sha256:${sha256(body)}`, data };
}

function packageDigest(envelope) {
  return `sha256:${sha256(stableStringify({ manifest: { ...envelope.manifest, packageHash: null, packageSize: null }, artifacts: envelope.artifacts }))}`;
}

function createRuntimePackage(input) {
  const artifacts = Object.entries(input.artifacts)
    .map(([name, data]) => artifactEntry(name, data))
    .sort((left, right) => left.name.localeCompare(right.name));
  if (new Set(artifacts.map((artifact) => artifact.name)).size !== artifacts.length)
    throw new VisionEngineError("PACKAGE_SCHEMA_FAILURE", "Duplicate package artifacts are forbidden.", {
      retryable: false,
    });
  const builtAt = input.builtAt ?? new Date().toISOString();
  const manifest = {
    packageFormatVersion: PACKAGE_FORMAT_VERSION,
    packageSchemaVersion: RUNTIME_PACKAGE_SCHEMA_VERSION,
    packageId: input.packageId,
    waypointId: input.waypoint.id,
    waypointVersionId: input.waypoint.versionId,
    waypointVersion: input.waypoint.versionNumber,
    waypointType: input.waypoint.type,
    buildId: input.buildId,
    builtAt,
    engineVersion: VISION_ENGINE_VERSION,
    modelBundleVersions: [VISION_MODEL_BUNDLE_VERSION],
    calibrationProfile: input.calibrationProfile,
    runtimeRequirements: { memoryBytes: input.memoryBytes ?? 128 * 1024 * 1024, localOnly: true },
    minimumCompanionVersion: "0.6.0-b4",
    supportedProtocolVersions: ["2.0"],
    expectedProviders: input.expectedProviders ?? ["CPU_CLASSICAL"],
    supportedResolutions: [{ width: 320, height: 180 }],
    fieldOfViewRange: input.fieldOfViewRange ?? null,
    knownLimitations: input.knownLimitations ?? [],
    certificationStatus: input.certificationStatus,
    automaticEligibility: false,
    shadowModeOnly: true,
    signature: null,
    artifactHashes: Object.fromEntries(artifacts.map((artifact) => [artifact.name, artifact.hash])),
    packageHash: null,
    packageSize: null,
  };
  const envelope = { manifest, artifacts };
  manifest.packageHash = packageDigest(envelope);
  manifest.packageSize = Buffer.byteLength(stableStringify(envelope));
  return envelope;
}

function loadRuntimePackage(unchecked, options = {}) {
  if (!unchecked || typeof unchecked !== "object" || Array.isArray(unchecked))
    throw new VisionEngineError("PACKAGE_CORRUPT", "Runtime package is not a data envelope.", { retryable: false });
  const { manifest, artifacts } = unchecked;
  if (
    !manifest ||
    manifest.packageFormatVersion !== PACKAGE_FORMAT_VERSION ||
    manifest.packageSchemaVersion !== RUNTIME_PACKAGE_SCHEMA_VERSION
  )
    throw new VisionEngineError("PACKAGE_SCHEMA_UNSUPPORTED", "Runtime package schema is unsupported.", {
      retryable: false,
    });
  if (!Array.isArray(artifacts) || artifacts.length < 1)
    throw new VisionEngineError("PACKAGE_CORRUPT", "Runtime package artifacts are missing.", { retryable: false });
  if (manifest.engineVersion !== VISION_ENGINE_VERSION)
    throw new VisionEngineError(
      "RUNTIME_VERSION_TOO_OLD",
      "Runtime engine version is incompatible with this package.",
      { retryable: false },
    );
  if (!Array.isArray(manifest.modelBundleVersions) || manifest.modelBundleVersions.length < 1)
    throw new VisionEngineError("MODEL_BUNDLE_MISSING", "Runtime package model bundle is unavailable.", {
      retryable: false,
    });
  if (!manifest.modelBundleVersions.includes(VISION_MODEL_BUNDLE_VERSION))
    throw new VisionEngineError("MODEL_VERSION_INCOMPATIBLE", "Runtime package model version is incompatible.", {
      retryable: false,
    });
  if (
    options.availableMemoryBytes !== undefined &&
    manifest.runtimeRequirements?.memoryBytes > options.availableMemoryBytes
  )
    throw new VisionEngineError("INSUFFICIENT_MEMORY", "The runtime package exceeds the configured memory budget.");
  if (options.waypointVersionId && manifest.waypointVersionId !== options.waypointVersionId)
    throw new VisionEngineError("PACKAGE_INCOMPATIBLE", "Runtime package belongs to another waypoint version.", {
      retryable: false,
    });
  const names = new Set();
  for (const artifact of artifacts) {
    if (
      !allowedArtifactNames.includes(artifact.name) ||
      artifact.name.includes("/") ||
      artifact.name.includes("\\") ||
      artifact.name.includes("..") ||
      names.has(artifact.name)
    )
      throw new VisionEngineError("PACKAGE_CORRUPT", "Runtime package contains an unsafe or duplicate artifact.", {
        retryable: false,
      });
    names.add(artifact.name);
    const body = stableStringify(artifact.data);
    if (
      `sha256:${sha256(body)}` !== artifact.hash ||
      Buffer.byteLength(body) !== artifact.size ||
      manifest.artifactHashes?.[artifact.name] !== artifact.hash
    )
      throw new VisionEngineError(
        "PACKAGE_CORRUPT",
        `Runtime package artifact ${artifact.name} failed integrity validation.`,
        { retryable: false },
      );
  }
  if (packageDigest(unchecked) !== manifest.packageHash)
    throw new VisionEngineError("PACKAGE_CORRUPT", "Runtime package digest does not match.", { retryable: false });
  return {
    manifest: Object.freeze({ ...manifest }),
    artifacts: Object.freeze(Object.fromEntries(artifacts.map((artifact) => [artifact.name, artifact.data]))),
  };
}

module.exports = {
  PACKAGE_FORMAT_VERSION,
  allowedArtifactNames,
  createRuntimePackage,
  loadRuntimePackage,
  packageDigest,
};
