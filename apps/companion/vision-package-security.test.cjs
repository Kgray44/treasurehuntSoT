"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const { createRuntimePackage, loadRuntimePackage } = require("./vision-package.cjs");

function packageInput(overrides = {}) {
  return {
    packageId: "package_security_test",
    buildId: "build_security_test",
    builtAt: "2026-07-18T12:00:00.000Z",
    waypoint: {
      id: "waypoint_security_test",
      versionId: "waypoint_version_security_test",
      versionNumber: 1,
      type: "EXACT_LANDMARK",
    },
    calibrationProfile: "BALANCED",
    certificationStatus: "SHADOW",
    artifacts: {
      "runtime-config.json": { schemaVersion: 1 },
      "global-reference-index.json": { schemaVersion: 1, references: [] },
    },
    ...overrides,
  };
}

test("trusted runtime-package signatures are scope-pinned and tamper evident", () => {
  const keys = crypto.generateKeyPairSync("ed25519");
  const runtimePackage = createRuntimePackage(
    packageInput({
      signer: {
        keyId: "creator-release-key",
        trustScope: "CREATOR_PREVIEW",
        privateKey: keys.privateKey,
      },
    }),
  );
  const loaded = loadRuntimePackage(runtimePackage, {
    requireSignature: true,
    trustScope: "CREATOR_PREVIEW",
    trustedPublicKeys: { "creator-release-key": keys.publicKey },
  });
  assert.equal(loaded.manifest.signatureValidation.trusted, true);
  assert.throws(
    () =>
      loadRuntimePackage(runtimePackage, {
        requireSignature: true,
        trustScope: "STABLE",
        trustedPublicKeys: { "creator-release-key": keys.publicKey },
      }),
    (error) => error.code === "PACKAGE_SIGNATURE_UNTRUSTED",
  );
  const tampered = structuredClone(runtimePackage);
  tampered.manifest.signature.value = `${tampered.manifest.signature.value.slice(0, -2)}aa`;
  assert.throws(
    () =>
      loadRuntimePackage(tampered, {
        requireSignature: true,
        trustScope: "CREATOR_PREVIEW",
        trustedPublicKeys: { "creator-release-key": keys.publicKey },
      }),
    (error) => error.code === "PACKAGE_SIGNATURE_INVALID",
  );
});

test("unsigned runtime package is development-only when trust is required", () => {
  const runtimePackage = createRuntimePackage(packageInput());
  assert.equal(loadRuntimePackage(runtimePackage).manifest.signatureValidation.status, "UNSIGNED");
  assert.throws(
    () => loadRuntimePackage(runtimePackage, { requireSignature: true }),
    (error) => error.code === "PACKAGE_SIGNATURE_REQUIRED",
  );
});
