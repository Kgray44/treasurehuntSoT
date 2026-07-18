"use strict";

const crypto = require("node:crypto");
const path = require("node:path");

const RELEASE_MANIFEST_SCHEMA_VERSION = 1;
const RELEASE_CHANNELS = Object.freeze(["development", "creator-preview", "stable"]);
const RELEASE_STATUSES = Object.freeze(["EXPERIMENTAL", "CREATOR_PREVIEW", "STABLE", "DEPRECATED", "UNSUPPORTED"]);
const PACKAGE_COMPATIBILITY_STATUSES = Object.freeze([
  "COMPATIBLE",
  "COMPATIBLE_WITH_WARNING",
  "NEEDS_RETEST",
  "OUTDATED",
  "INCOMPATIBLE",
  "REVOKED",
]);
const UPDATE_ERROR_CODES = Object.freeze([
  "UPDATE_MANIFEST_INVALID",
  "UPDATE_SIGNATURE_INVALID",
  "UPDATE_CHANNEL_MISMATCH",
  "UPDATE_PLATFORM_INCOMPATIBLE",
  "UPDATE_PATH_NOT_ALLOWED",
  "UPDATE_HASH_MISMATCH",
  "UPDATE_SIZE_MISMATCH",
  "UPDATE_ACTIVE_SESSION",
  "UPDATE_HEALTH_CHECK_FAILED",
  "UPDATE_ROLLBACK_FAILED",
]);

class ReleaseGovernanceError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = "ReleaseGovernanceError";
    this.code = code;
    this.retryable = options.retryable === true;
    this.details = options.details ?? {};
  }
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object" || Buffer.isBuffer(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

function stableStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function assertPlainObject(value, code, message) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ReleaseGovernanceError(code, message, { retryable: false });
  return value;
}

function assertKnownKeys(value, allowed, area) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length)
    throw new ReleaseGovernanceError("UPDATE_MANIFEST_INVALID", `${area} contains unknown fields.`, {
      retryable: false,
      details: { unknown },
    });
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(version));
  if (!match)
    throw new ReleaseGovernanceError("UPDATE_MANIFEST_INVALID", `Version ${version} is not semantic.`, {
      retryable: false,
    });
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] ?? null };
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (const key of ["major", "minor", "patch"]) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  if (a.prerelease === b.prerelease) return 0;
  if (a.prerelease === null) return 1;
  if (b.prerelease === null) return -1;
  return a.prerelease.localeCompare(b.prerelease, "en", { numeric: true });
}

function safeArtifactLocation(location) {
  if (typeof location !== "string" || location.length < 1 || location.length > 2048) return false;
  try {
    const url = new URL(location);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    if (path.isAbsolute(location) || location.includes("\0")) return false;
    const normalized = location.replaceAll("\\", "/");
    if (normalized.split("/").some((segment) => segment === ".." || segment === "")) return false;
    return /^[A-Za-z0-9._/-]+$/.test(normalized);
  }
}

function manifestPayload(manifest) {
  return stableStringify({ ...manifest, manifestSignature: null });
}

function manifestHash(manifest) {
  return `sha256:${sha256(manifestPayload(manifest))}`;
}

function validateReleaseManifest(unchecked) {
  const manifest = assertPlainObject(unchecked, "UPDATE_MANIFEST_INVALID", "Release manifest must be an object.");
  assertKnownKeys(
    manifest,
    [
      "schemaVersion",
      "releaseVersion",
      "channel",
      "publicationDate",
      "platform",
      "architecture",
      "artifact",
      "minimumSupportedVersion",
      "compatibility",
      "releaseNotes",
      "rollback",
      "mandatory",
      "source",
      "manifestSignature",
    ],
    "Release manifest",
  );
  if (manifest.schemaVersion !== RELEASE_MANIFEST_SCHEMA_VERSION)
    throw new ReleaseGovernanceError("UPDATE_MANIFEST_INVALID", "Release manifest schema is unsupported.");
  parseVersion(manifest.releaseVersion);
  parseVersion(manifest.minimumSupportedVersion);
  if (!RELEASE_CHANNELS.includes(manifest.channel))
    throw new ReleaseGovernanceError("UPDATE_MANIFEST_INVALID", "Release channel is unsupported.");
  if (!Number.isFinite(Date.parse(manifest.publicationDate)))
    throw new ReleaseGovernanceError("UPDATE_MANIFEST_INVALID", "Publication date is invalid.");
  if (manifest.platform !== "win32" || !["x64", "arm64"].includes(manifest.architecture))
    throw new ReleaseGovernanceError(
      "UPDATE_PLATFORM_INCOMPATIBLE",
      "Release platform or architecture is unsupported.",
    );
  const artifact = assertPlainObject(
    manifest.artifact,
    "UPDATE_MANIFEST_INVALID",
    "Release artifact metadata is missing.",
  );
  assertKnownKeys(artifact, ["location", "sha256", "size", "authenticode"], "Release artifact");
  if (!safeArtifactLocation(artifact.location))
    throw new ReleaseGovernanceError("UPDATE_PATH_NOT_ALLOWED", "Release artifact location is unsafe.");
  if (!/^[a-f0-9]{64}$/.test(artifact.sha256) || !Number.isSafeInteger(artifact.size) || artifact.size < 1)
    throw new ReleaseGovernanceError("UPDATE_MANIFEST_INVALID", "Release artifact hash or size is invalid.");
  const authenticode = assertPlainObject(
    artifact.authenticode,
    "UPDATE_MANIFEST_INVALID",
    "Authenticode policy is missing.",
  );
  assertKnownKeys(authenticode, ["required", "status", "signerThumbprint", "timestamped"], "Authenticode policy");
  if (typeof authenticode.required !== "boolean" || !["SIGNED", "UNSIGNED_DEVELOPMENT"].includes(authenticode.status))
    throw new ReleaseGovernanceError("UPDATE_MANIFEST_INVALID", "Authenticode policy is invalid.");
  if (manifest.channel !== "development" && (!authenticode.required || authenticode.status !== "SIGNED"))
    throw new ReleaseGovernanceError(
      "UPDATE_SIGNATURE_INVALID",
      "Creator Preview and Stable artifacts must require a production signature.",
    );
  const compatibility = assertPlainObject(
    manifest.compatibility,
    "UPDATE_MANIFEST_INVALID",
    "Compatibility metadata is missing.",
  );
  for (const key of ["packageSchemas", "companionProtocols", "modelBundles"]) {
    if (!Array.isArray(compatibility[key]) || compatibility[key].length < 1)
      throw new ReleaseGovernanceError("UPDATE_MANIFEST_INVALID", `Compatibility field ${key} is missing.`);
  }
  if (!Array.isArray(manifest.releaseNotes) || manifest.releaseNotes.some((note) => typeof note !== "string"))
    throw new ReleaseGovernanceError("UPDATE_MANIFEST_INVALID", "Release notes must be a string list.");
  const rollback = assertPlainObject(manifest.rollback, "UPDATE_MANIFEST_INVALID", "Rollback policy is missing.");
  if (typeof rollback.eligible !== "boolean" || (rollback.eligible && !rollback.targetVersion))
    throw new ReleaseGovernanceError("UPDATE_MANIFEST_INVALID", "Rollback policy is invalid.");
  if (rollback.targetVersion) parseVersion(rollback.targetVersion);
  const source = assertPlainObject(manifest.source, "UPDATE_MANIFEST_INVALID", "Release provenance is missing.");
  if (
    !/^[a-f0-9]{7,64}$/i.test(source.commit) ||
    typeof source.buildId !== "string" ||
    !/^[a-f0-9]{64}$/i.test(source.lockHash)
  )
    throw new ReleaseGovernanceError("UPDATE_MANIFEST_INVALID", "Release provenance is invalid.");
  if (typeof manifest.mandatory !== "boolean")
    throw new ReleaseGovernanceError("UPDATE_MANIFEST_INVALID", "Mandatory status must be boolean.");
  return canonicalize(manifest);
}

function verifyManifestSignature(unchecked, options = {}) {
  const manifest = validateReleaseManifest(unchecked);
  const signature = manifest.manifestSignature;
  if (!signature) {
    if (manifest.channel === "development" && options.allowUnsignedDevelopment === true)
      return { manifest, status: "UNSIGNED_DEVELOPMENT", trusted: false, manifestHash: manifestHash(manifest) };
    throw new ReleaseGovernanceError("UPDATE_SIGNATURE_INVALID", "Signed release metadata is required.");
  }
  assertKnownKeys(signature, ["algorithm", "keyId", "value"], "Manifest signature");
  if (signature.algorithm !== "Ed25519" || typeof signature.keyId !== "string" || typeof signature.value !== "string")
    throw new ReleaseGovernanceError("UPDATE_SIGNATURE_INVALID", "Manifest signature metadata is invalid.");
  const publicKey = options.trustedPublicKeys?.[signature.keyId];
  if (!publicKey) throw new ReleaseGovernanceError("UPDATE_SIGNATURE_INVALID", "Manifest signer is not trusted.");
  let valid = false;
  try {
    valid = crypto.verify(
      null,
      Buffer.from(manifestPayload(manifest), "utf8"),
      publicKey,
      Buffer.from(signature.value, "base64url"),
    );
  } catch {
    valid = false;
  }
  if (!valid) throw new ReleaseGovernanceError("UPDATE_SIGNATURE_INVALID", "Manifest signature verification failed.");
  return { manifest, status: "TRUSTED", trusted: true, keyId: signature.keyId, manifestHash: manifestHash(manifest) };
}

function signManifest(unchecked, signer) {
  const manifest = validateReleaseManifest({ ...unchecked, manifestSignature: null });
  const value = crypto.sign(null, Buffer.from(manifestPayload(manifest), "utf8"), signer.privateKey);
  return {
    ...manifest,
    manifestSignature: {
      algorithm: "Ed25519",
      keyId: signer.keyId,
      value: value.toString("base64url"),
    },
  };
}

function verifyArtifactBuffer(buffer, artifact) {
  if (!Buffer.isBuffer(buffer))
    throw new ReleaseGovernanceError("UPDATE_HASH_MISMATCH", "Update artifact must be a binary buffer.");
  if (buffer.length !== artifact.size)
    throw new ReleaseGovernanceError("UPDATE_SIZE_MISMATCH", "Update artifact size does not match the manifest.");
  if (sha256(buffer) !== artifact.sha256)
    throw new ReleaseGovernanceError("UPDATE_HASH_MISMATCH", "Update artifact hash does not match the manifest.");
  return { verified: true, hash: `sha256:${artifact.sha256}`, size: buffer.length };
}

function assertUpgradeAllowed(currentVersion, verifiedManifest, options = {}) {
  const manifest = verifiedManifest.manifest ?? verifiedManifest;
  if (manifest.channel !== options.channel)
    throw new ReleaseGovernanceError("UPDATE_CHANNEL_MISMATCH", "The update belongs to another release channel.");
  if (
    manifest.platform !== (options.platform ?? process.platform) ||
    manifest.architecture !== (options.architecture ?? process.arch)
  )
    throw new ReleaseGovernanceError("UPDATE_PLATFORM_INCOMPATIBLE", "The update does not support this device.");
  if (compareVersions(currentVersion, manifest.minimumSupportedVersion) < 0)
    throw new ReleaseGovernanceError("UPDATE_PATH_NOT_ALLOWED", "The installed version is too old for this update.");
  if (compareVersions(manifest.releaseVersion, currentVersion) <= 0)
    throw new ReleaseGovernanceError("UPDATE_PATH_NOT_ALLOWED", "The update is not newer than the installed version.");
  if (options.activeScan || options.activeStoryCriticalPresentation)
    throw new ReleaseGovernanceError(
      "UPDATE_ACTIVE_SESSION",
      "Finish the active scan or story-critical presentation first.",
      {
        retryable: true,
      },
    );
  return {
    allowed: true,
    fromVersion: currentVersion,
    toVersion: manifest.releaseVersion,
    rollbackTarget: manifest.rollback.eligible ? manifest.rollback.targetVersion : null,
  };
}

function classifyCompatibility(input) {
  if (input.revoked === true) return { status: "REVOKED", reason: "This exact package was revoked." };
  if (input.integrityValid !== true) return { status: "INCOMPATIBLE", reason: "Package integrity validation failed." };
  if (
    input.packageSchemaSupported !== true ||
    input.modelBundleAvailable !== true ||
    input.storyBindingCompatible !== true
  )
    return { status: "INCOMPATIBLE", reason: "A required schema, model bundle, or story binding is incompatible." };
  if (input.minimumApplicationSatisfied !== true)
    return { status: "OUTDATED", reason: "The installed application is older than the package minimum." };
  if (input.certifiedEngineVersion !== input.activeEngineVersion)
    return { status: "NEEDS_RETEST", reason: "The active engine differs from the certified engine." };
  if (input.warning) return { status: "COMPATIBLE_WITH_WARNING", reason: input.warning };
  return { status: "COMPATIBLE", reason: "All pinned compatibility and integrity checks passed." };
}

module.exports = {
  PACKAGE_COMPATIBILITY_STATUSES,
  RELEASE_CHANNELS,
  RELEASE_MANIFEST_SCHEMA_VERSION,
  RELEASE_STATUSES,
  UPDATE_ERROR_CODES,
  ReleaseGovernanceError,
  assertUpgradeAllowed,
  canonicalize,
  classifyCompatibility,
  compareVersions,
  manifestHash,
  manifestPayload,
  parseVersion,
  safeArtifactLocation,
  sha256,
  signManifest,
  stableStringify,
  validateReleaseManifest,
  verifyArtifactBuffer,
  verifyManifestSignature,
};
