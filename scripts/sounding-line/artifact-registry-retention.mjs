// Encrypted custody only. Neither encryption nor decryption authenticates a
// provider, authorizes inheritance, spends a review ordinal, or qualifies a tree.
import { constants, createHash, createPublicKey, privateDecrypt, createDecipheriv } from "node:crypto";
import { canonicalJson } from "./evidence.mjs";
import { validateArtifactManifest } from "./artifact-evidence-registry.mjs";
import { BROWSER_FAILURE_ENCRYPTION_KEY } from "./private-browser-failure.mjs";
import { sealPosttechnicalEvidence } from "./replay-posttechnical-diagnostic.mjs";

const FORMAT = "VW-POSTTECHNICAL-EVIDENCE-1";
const CLASS = "ARTIFACT_REGISTRY_V2_ENCRYPTED_RETENTION_NOT_ACCEPTANCE";
const MAXIMUM = 8 * 1024 * 1024;
const REGISTRY_MAXIMUM = 2 * 1024 * 1024;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const equal = (a, b) => canonicalJson(a) === canonicalJson(b);
const keys = (value, expected) =>
  value && typeof value === "object" && !Array.isArray(value) && equal(Object.keys(value).sort(), [...expected].sort());
const need = (value, code) => {
  if (!value) throw Error(`SOUNDING_LINE_ARTIFACT_RETENTION_${code}`);
};
function validateBinding(binding) {
  need(
    keys(binding, [
      "repository",
      "prNumber",
      "runId",
      "attempt",
      "baseSha",
      "candidateSha",
      "jobKey",
      "sourceBindingsDigest",
    ]),
    "BINDING",
  );
  need(binding.repository === "Kgray44/treasurehuntSoT" && binding.jobKey === "experience-preparation", "BINDING");
  need(
    [binding.prNumber, binding.runId, binding.attempt].every((value) => Number.isSafeInteger(value) && value > 0) &&
      ![721, 776].includes(binding.prNumber),
    "ORDINARY_OWNER_SCOPE",
  );
  need(
    [binding.baseSha, binding.candidateSha].every((value) => /^[a-f0-9]{40}$/u.test(value ?? "")) &&
      /^[a-f0-9]{64}$/u.test(binding.sourceBindingsDigest ?? ""),
    "BINDING",
  );
}
function validateKey(encryption) {
  need(typeof encryption?.publicKey === "string" && hash(encryption.publicKey) === encryption.keyId, "KEY_PIN");
  const key = createPublicKey(encryption.publicKey);
  need(key.asymmetricKeyType === "rsa" && key.asymmetricKeyDetails.modulusLength >= 2048, "KEY_PIN");
  return key;
}
function decode(value, maximum, exact) {
  need(
    typeof value === "string" && value.length <= Math.ceil(maximum / 3) * 4 && !/[^A-Za-z0-9+/=]/u.test(value),
    "BASE64",
  );
  const bytes = Buffer.from(value, "base64");
  need(
    bytes.toString("base64") === value && bytes.length <= maximum && (exact === undefined || bytes.length === exact),
    "BASE64",
  );
  return bytes;
}
const aad = (binding, encryption) => ({
  version: 2,
  classification: CLASS,
  qualification: false,
  binding,
  keyId: encryption.keyId,
});

export function sealArtifactRegistryRetention({
  manifest,
  binding,
  encryption = BROWSER_FAILURE_ENCRYPTION_KEY,
  validation = {},
}) {
  validateBinding(binding);
  validateKey(encryption);
  validateArtifactManifest(manifest, { ...validation, maximumBytes: REGISTRY_MAXIMUM, requireComplete: false });
  need(
    manifest.originalBaseSha === binding.baseSha &&
      manifest.originalCandidateSha === binding.candidateSha &&
      manifest.producerIdentity.runId === binding.runId &&
      manifest.producerIdentity.attempt === binding.attempt,
    "MANIFEST_SOURCE_BINDING",
  );
  const bytes = Buffer.from(canonicalJson(manifest) + "\n");
  return sealPosttechnicalEvidence({
    files: [{ name: "registry-v2.json", bytes }],
    aad: aad(binding, encryption),
    publicKey: encryption.publicKey,
    limits: { files: 1, rawBytes: REGISTRY_MAXIMUM, jsonBytes: REGISTRY_MAXIMUM, envelopeBytes: MAXIMUM },
  });
}

function parseEnvelope(bytes, binding, encryption) {
  validateBinding(binding);
  const publicKey = validateKey(encryption);
  need(Buffer.isBuffer(bytes) && bytes.length >= 1 && bytes.length <= MAXIMUM, "ENVELOPE_BOUND");
  let envelope, header;
  try {
    envelope = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw Error("SOUNDING_LINE_ARTIFACT_RETENTION_ENVELOPE");
  }
  need(
    keys(envelope, ["format", "aad", "ciphertext", "tag"]) &&
      envelope.format === FORMAT &&
      Buffer.from(JSON.stringify(envelope)).equals(bytes),
    "ENVELOPE",
  );
  const headerBytes = decode(envelope.aad, 8192);
  try {
    header = JSON.parse(headerBytes.toString("utf8"));
  } catch {
    throw Error("SOUNDING_LINE_ARTIFACT_RETENTION_HEADER");
  }
  need(
    keys(header, [
      "version",
      "classification",
      "qualification",
      "binding",
      "keyId",
      "format",
      "algorithms",
      "plaintextBytes",
      "nonce",
      "wrappedKey",
    ]),
    "HEADER",
  );
  const expected = aad(binding, encryption);
  need(
    Object.keys(expected).every((key) => equal(header[key], expected[key])) &&
      header.format === FORMAT &&
      equal(header.algorithms, { content: "AES-256-GCM", keyWrap: "RSA-OAEP-SHA256" }),
    "SOURCE_OR_PURPOSE_MISMATCH",
  );
  need(
    Number.isSafeInteger(header.plaintextBytes) &&
      header.plaintextBytes > 0 &&
      header.plaintextBytes <= 3 * 1024 * 1024,
    "PLAINTEXT_BOUND",
  );
  const nonce = decode(header.nonce, 12, 12),
    wrappedKey = decode(header.wrappedKey, 1024, publicKey.asymmetricKeyDetails.modulusLength / 8);
  const ciphertext = decode(envelope.ciphertext, 3 * 1024 * 1024, header.plaintextBytes),
    tag = decode(envelope.tag, 16, 16);
  return { header, headerBytes, nonce, wrappedKey, ciphertext, tag };
}

export function inspectArtifactRegistryRetention({ bytes, binding, encryption = BROWSER_FAILURE_ENCRYPTION_KEY }) {
  parseEnvelope(bytes, binding, encryption);
  // Original artifact IDs, paths, raw hashes and logical coverage stay encrypted.
  return {
    encryptedSha256: hash(bytes),
    bytes: bytes.length,
    authentication: "ENCRYPTED_RETENTION_NOT_PROVIDER_AUTHENTICATED",
    qualification: false,
  };
}

export function openArtifactRegistryRetention({
  bytes,
  binding,
  privateKey,
  encryption = BROWSER_FAILURE_ENCRYPTION_KEY,
  validation = {},
}) {
  const envelope = parseEnvelope(bytes, binding, encryption);
  let key, plaintext;
  try {
    need(
      createPublicKey(privateKey).export({ type: "spki", format: "pem" }) === encryption.publicKey,
      "PRIVATE_KEY_PIN",
    );
    key = privateDecrypt(
      {
        key: privateKey,
        oaepHash: "sha256",
        oaepLabel: Buffer.from(FORMAT),
        padding: constants.RSA_PKCS1_OAEP_PADDING,
      },
      envelope.wrappedKey,
    );
    need(key.length === 32, "CONTENT_KEY");
    const decipher = createDecipheriv("aes-256-gcm", key, envelope.nonce);
    decipher.setAAD(envelope.headerBytes);
    decipher.setAuthTag(envelope.tag);
    plaintext = Buffer.concat([decipher.update(envelope.ciphertext), decipher.final()]);
  } catch {
    throw Error("SOUNDING_LINE_ARTIFACT_RETENTION_DECRYPTION_FAILED");
  } finally {
    key?.fill(0);
  }
  let inner;
  try {
    inner = JSON.parse(plaintext.toString("utf8"));
  } catch {
    throw Error("SOUNDING_LINE_ARTIFACT_RETENTION_INNER");
  }
  need(
    keys(inner, ["version", "inventory", "files"]) &&
      inner.version === 1 &&
      Array.isArray(inner.inventory) &&
      inner.inventory.length === 0 &&
      Array.isArray(inner.files) &&
      inner.files.length === 1,
    "INNER",
  );
  const file = inner.files[0];
  need(
    keys(file, ["name", "bytes", "sha256", "content"]) &&
      file.name === "registry-v2.json" &&
      Number.isSafeInteger(file.bytes) &&
      file.bytes > 0 &&
      file.bytes <= REGISTRY_MAXIMUM,
    "INNER",
  );
  const registry = decode(file.content, REGISTRY_MAXIMUM, file.bytes);
  need(hash(registry) === file.sha256, "INNER_INTEGRITY");
  let manifest;
  try {
    manifest = JSON.parse(registry.toString("utf8"));
  } catch {
    throw Error("SOUNDING_LINE_ARTIFACT_RETENTION_REGISTRY");
  }
  need(registry.equals(Buffer.from(canonicalJson(manifest) + "\n")), "REGISTRY_CANONICALIZATION");
  validateArtifactManifest(manifest, { ...validation, maximumBytes: REGISTRY_MAXIMUM, requireComplete: false });
  need(
    manifest.originalBaseSha === binding.baseSha &&
      manifest.originalCandidateSha === binding.candidateSha &&
      manifest.producerIdentity.runId === binding.runId &&
      manifest.producerIdentity.attempt === binding.attempt,
    "MANIFEST_SOURCE_BINDING",
  );
  return { manifest, authentication: "DECRYPTED_RETENTION_NOT_PROVIDER_AUTHENTICATED", qualification: false };
}
