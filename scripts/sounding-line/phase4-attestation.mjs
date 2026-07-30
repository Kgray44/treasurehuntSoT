import { createHash, generateKeyPairSync, sign, verify } from "node:crypto";
import { canonicalize } from "./phase3.mjs";

const digest = (value) => createHash("sha256").update(canonicalize(value)).digest("hex");
const hex = (value, label) => {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) throw new Error(`INVALID_${label}`);
  return value;
};

export function createEphemeralSigner({ keyId } = {}) {
  if (!keyId || !/^[a-z0-9.-]{3,128}$/u.test(keyId)) throw new Error("INVALID_KEY_ID");
  const keys = generateKeyPairSync("ed25519");
  return {
    keyId,
    publicKey: keys.publicKey.export({ type: "spki", format: "pem" }),
    sign: (payload) => sign(null, Buffer.from(canonicalize(payload)), keys.privateKey).toString("base64"),
  };
}

export function attestationPayload({ assignment, evidence, dependencyLockDigest, environmentDigest }) {
  if (!assignment || !evidence) throw new Error("ATTESTATION_BINDING_REQUIRED");
  return {
    version: 1,
    assignmentDigest: hex(assignment.digest, "ASSIGNMENT_DIGEST"),
    sourceDigest: hex(evidence.sourceDigest, "SOURCE_DIGEST"),
    policyDigest: hex(evidence.policyDigest, "POLICY_DIGEST"),
    planDigest: hex(evidence.planDigest, "PLAN_DIGEST"),
    workerId: evidence.workerId,
    workerBootId: evidence.workerBootId,
    environmentDigest: hex(environmentDigest ?? evidence.environmentDigest, "ENVIRONMENT_DIGEST"),
    dependencyLockDigest: hex(dependencyLockDigest ?? evidence.dependencyLockDigest, "LOCK_DIGEST"),
    artifacts: evidence.artifacts,
    outcome: evidence.outcome,
    cleanup: evidence.cleanup,
    evidenceDigest: hex(evidence.digest, "EVIDENCE_DIGEST"),
  };
}

export function signAttestation({ signer, assignment, evidence, dependencyLockDigest, environmentDigest, issuedAt }) {
  if (!signer?.keyId || typeof signer.sign !== "function" || !signer.publicKey) throw new Error("SIGNER_REQUIRED");
  const payload = attestationPayload({ assignment, evidence, dependencyLockDigest, environmentDigest });
  const statement = { ...payload, issuedAt: issuedAt ?? new Date().toISOString(), keyId: signer.keyId };
  return { ...statement, statementDigest: digest(statement), signature: signer.sign(statement) };
}

export function verifyAttestation(
  attestation,
  { publicKey, revokedKeyIds = new Set(), seenStatementDigests = new Set() } = {},
) {
  if (!attestation?.signature || !attestation?.statementDigest || !publicKey) throw new Error("ATTESTATION_UNSIGNED");
  if (revokedKeyIds.has(attestation.keyId)) throw new Error("ATTESTATION_KEY_REVOKED");
  const { signature, statementDigest, ...statement } = attestation;
  if (digest(statement) !== statementDigest) throw new Error("ATTESTATION_TAMPERED");
  if (seenStatementDigests.has(statementDigest)) throw new Error("ATTESTATION_REPLAYED");
  if (!verify(null, Buffer.from(canonicalize(statement)), publicKey, Buffer.from(signature, "base64")))
    throw new Error("ATTESTATION_SIGNATURE_INVALID");
  seenStatementDigests.add(statementDigest);
  return true;
}
