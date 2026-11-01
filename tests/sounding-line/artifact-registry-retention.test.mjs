import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync, createHash } from "node:crypto";
import { artifactRegistryFixture } from "./fixtures/artifact-registry-v2.mjs";
import {
  sealArtifactRegistryRetention,
  inspectArtifactRegistryRetention,
  openArtifactRegistryRetention,
} from "../../scripts/sounding-line/artifact-registry-retention.mjs";

const { publicKey: publicObject, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicKey = publicObject.export({ type: "spki", format: "pem" });
const encryption = { publicKey, keyId: createHash("sha256").update(publicKey).digest("hex") };
const binding = {
  repository: "Kgray44/treasurehuntSoT",
  prNumber: 900,
  runId: 101,
  attempt: 1,
  baseSha: "a".repeat(40),
  candidateSha: "b".repeat(40),
  jobKey: "experience-preparation",
  sourceBindingsDigest: "c".repeat(64),
};
const seal = (manifest = artifactRegistryFixture()) => sealArtifactRegistryRetention({ manifest, binding, encryption });
const open = (bytes) => openArtifactRegistryRetention({ bytes, binding, encryption, privateKey });

test("v2 retention keeps all original artifact paths and raw hashes encrypted without minting evidence authority", () => {
  const manifest = artifactRegistryFixture(),
    bytes = seal(manifest);
  for (const artifact of manifest.artifacts) {
    assert(!bytes.includes(Buffer.from(artifact.id)));
    assert(!bytes.includes(Buffer.from(artifact.objectSha256)));
    assert(!bytes.includes(Buffer.from(artifact.immutableLocation.path)));
  }
  const inspected = inspectArtifactRegistryRetention({ bytes, binding, encryption });
  assert.equal(inspected.authentication, "ENCRYPTED_RETENTION_NOT_PROVIDER_AUTHENTICATED");
  assert.equal(inspected.qualification, false);
  const decoded = open(bytes);
  assert.deepEqual(decoded.manifest, manifest);
  assert.equal(decoded.authentication, "DECRYPTED_RETENTION_NOT_PROVIDER_AUTHENTICATED");
  assert.equal(decoded.qualification, false);
  assert.notDeepEqual(seal(manifest), bytes, "independent encryption uses fresh key and nonce");
});

test("retention cannot substitute another source, owner scope, run, attempt or producer binding", () => {
  const bytes = seal();
  for (const mutation of [
    (value) => {
      value.baseSha = "d".repeat(40);
    },
    (value) => {
      value.candidateSha = "e".repeat(40);
    },
    (value) => {
      value.runId++;
    },
    (value) => {
      value.attempt++;
    },
    (value) => {
      value.prNumber = 901;
    },
    (value) => {
      value.sourceBindingsDigest = "d".repeat(64);
    },
  ]) {
    const expected = structuredClone(binding);
    mutation(expected);
    assert.throws(
      () => openArtifactRegistryRetention({ bytes, binding: expected, encryption, privateKey }),
      /SOURCE_OR_PURPOSE_MISMATCH/u,
    );
  }
  assert.throws(
    () => inspectArtifactRegistryRetention({ bytes, binding: { ...binding, prNumber: 776 }, encryption }),
    /ORDINARY_OWNER_SCOPE/u,
  );
  assert.throws(
    () =>
      sealArtifactRegistryRetention({
        manifest: artifactRegistryFixture(),
        binding: { ...binding, candidateSha: "d".repeat(40) },
        encryption,
      }),
    /MANIFEST_SOURCE_BINDING/u,
  );
});

test("ciphertext, tag and authenticated header mutations cannot become a registry", () => {
  const bytes = seal();
  for (const field of ["ciphertext", "tag"]) {
    const envelope = JSON.parse(bytes);
    const part = Buffer.from(envelope[field], "base64");
    part[0] ^= 1;
    envelope[field] = part.toString("base64");
    assert.throws(() => open(Buffer.from(JSON.stringify(envelope))), /DECRYPTION_FAILED/u);
  }
  const envelope = JSON.parse(bytes),
    header = JSON.parse(Buffer.from(envelope.aad, "base64"));
  header.classification = "CAPTURE_RAW_DIAGNOSTICS_NOT_ACCEPTANCE";
  envelope.aad = Buffer.from(JSON.stringify(header)).toString("base64");
  assert.throws(() => open(Buffer.from(JSON.stringify(envelope))), /SOURCE_OR_PURPOSE_MISMATCH/u);
  const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
  assert.throws(
    () => openArtifactRegistryRetention({ bytes, binding, encryption, privateKey: other.privateKey }),
    /DECRYPTION_FAILED/u,
  );
});

test("oversized or ambiguous envelopes and self-asserted qualification are rejected before use", () => {
  assert.throws(() => open(Buffer.alloc(8 * 1024 * 1024 + 1)), /ENVELOPE_BOUND/u);
  const bytes = seal();
  assert.throws(() => open(Buffer.concat([bytes, Buffer.from("\n")])), /ENVELOPE/u);
  const envelope = JSON.parse(bytes);
  envelope.tag += "=";
  assert.throws(() => open(Buffer.from(JSON.stringify(envelope))), /BASE64/u);
  assert.throws(() => seal({ ...artifactRegistryFixture(), qualification: true }), /RETENTION_IDENTITY/u);
  assert.throws(
    () =>
      sealArtifactRegistryRetention({
        manifest: artifactRegistryFixture(),
        binding: { ...binding, extra: "raw-path" },
        encryption,
      }),
    /BINDING/u,
  );
});
