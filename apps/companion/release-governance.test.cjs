"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const {
  assertUpgradeAllowed,
  classifyCompatibility,
  signManifest,
  verifyArtifactBuffer,
  verifyManifestSignature,
} = require("./release-governance.cjs");

function manifestFor(buffer, overrides = {}) {
  return {
    schemaVersion: 1,
    releaseVersion: "0.8.0-b6",
    channel: "development",
    publicationDate: "2026-07-18T12:00:00.000Z",
    platform: "win32",
    architecture: "x64",
    artifact: {
      location: "artifacts/Forever-Treasure-0.8.0-b6.exe",
      sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
      size: buffer.length,
      authenticode: {
        required: false,
        status: "UNSIGNED_DEVELOPMENT",
        signerThumbprint: null,
        timestamped: false,
      },
    },
    minimumSupportedVersion: "0.7.0-b5",
    compatibility: {
      packageSchemas: [1],
      companionProtocols: ["2.0"],
      modelBundles: ["classical-local-v1"],
    },
    releaseNotes: ["Unsigned deterministic development fixture."],
    rollback: { eligible: true, targetVersion: "0.7.0-b5" },
    mandatory: false,
    source: {
      commit: "fa521c3",
      buildId: "build-b6-test",
      lockHash: "a".repeat(64),
    },
    manifestSignature: null,
    ...overrides,
  };
}

test("signed release metadata is canonical, channel-pinned, and tamper evident", () => {
  const buffer = Buffer.from("signed update fixture");
  const keys = crypto.generateKeyPairSync("ed25519");
  const unsigned = manifestFor(buffer, {
    channel: "creator-preview",
    artifact: {
      ...manifestFor(buffer).artifact,
      authenticode: {
        required: true,
        status: "SIGNED",
        signerThumbprint: "A".repeat(40),
        timestamped: true,
      },
    },
  });
  const signed = signManifest(unsigned, { keyId: "release-2026", privateKey: keys.privateKey });
  const verified = verifyManifestSignature(signed, { trustedPublicKeys: { "release-2026": keys.publicKey } });
  assert.equal(verified.trusted, true);
  assert.match(verified.manifestHash, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(
    assertUpgradeAllowed("0.7.0-b5", verified, {
      channel: "creator-preview",
      platform: "win32",
      architecture: "x64",
    }),
    {
      allowed: true,
      fromVersion: "0.7.0-b5",
      toVersion: "0.8.0-b6",
      rollbackTarget: "0.7.0-b5",
    },
  );
  assert.throws(
    () =>
      verifyManifestSignature(
        { ...signed, mandatory: true },
        { trustedPublicKeys: { "release-2026": keys.publicKey } },
      ),
    (error) => error.code === "UPDATE_SIGNATURE_INVALID",
  );
});

test("unsigned builds are confined to development and unsafe locations are rejected", () => {
  const buffer = Buffer.from("development update fixture");
  const verified = verifyManifestSignature(manifestFor(buffer), { allowUnsignedDevelopment: true });
  assert.equal(verified.status, "UNSIGNED_DEVELOPMENT");
  assert.throws(
    () =>
      verifyManifestSignature(
        manifestFor(buffer, {
          channel: "stable",
          artifact: {
            ...manifestFor(buffer).artifact,
            authenticode: {
              required: false,
              status: "UNSIGNED_DEVELOPMENT",
              signerThumbprint: null,
              timestamped: false,
            },
          },
        }),
        { allowUnsignedDevelopment: true },
      ),
    (error) => error.code === "UPDATE_SIGNATURE_INVALID",
  );
  assert.throws(
    () =>
      verifyManifestSignature(
        manifestFor(buffer, { artifact: { ...manifestFor(buffer).artifact, location: "../outside/update.exe" } }),
        { allowUnsignedDevelopment: true },
      ),
    (error) => error.code === "UPDATE_PATH_NOT_ALLOWED",
  );
});

test("artifact, active-session, and compatibility failures remain explicit", () => {
  const buffer = Buffer.from("artifact fixture");
  const manifest = manifestFor(buffer);
  assert.equal(verifyArtifactBuffer(buffer, manifest.artifact).verified, true);
  assert.throws(
    () => verifyArtifactBuffer(Buffer.from("tampered"), manifest.artifact),
    (error) => ["UPDATE_SIZE_MISMATCH", "UPDATE_HASH_MISMATCH"].includes(error.code),
  );
  const verified = verifyManifestSignature(manifest, { allowUnsignedDevelopment: true });
  assert.throws(
    () =>
      assertUpgradeAllowed("0.7.0-b5", verified, {
        channel: "development",
        platform: "win32",
        architecture: "x64",
        activeScan: true,
      }),
    (error) => error.code === "UPDATE_ACTIVE_SESSION" && error.retryable === true,
  );
  assert.equal(
    classifyCompatibility({
      integrityValid: true,
      packageSchemaSupported: true,
      modelBundleAvailable: true,
      storyBindingCompatible: true,
      minimumApplicationSatisfied: true,
      certifiedEngineVersion: "engine-1",
      activeEngineVersion: "engine-2",
    }).status,
    "NEEDS_RETEST",
  );
  assert.equal(classifyCompatibility({ revoked: true }).status, "REVOKED");
});

module.exports = { manifestFor };
