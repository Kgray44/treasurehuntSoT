import assert from "node:assert/strict";
import test from "node:test";
import {
  createEphemeralSigner,
  signAttestation,
  verifyAttestation,
} from "../../scripts/sounding-line/phase4-attestation.mjs";

const hex = (value) => value.repeat(64);
const assignment = { digest: hex("a") };
const evidence = {
  sourceDigest: hex("b"),
  policyDigest: hex("c"),
  planDigest: hex("d"),
  workerId: "worker-a",
  workerBootId: "boot-a",
  environmentDigest: hex("e"),
  dependencyLockDigest: hex("f"),
  artifacts: [{ id: "log", digest: hex("1") }],
  outcome: "PASS",
  cleanup: "CLEAN",
  digest: hex("2"),
};

test("ephemeral attestation verifies exact source, policy, worker, environment, lock, artifacts, outcome, and cleanup", () => {
  const signer = createEphemeralSigner({ keyId: "test.signer" });
  const signed = signAttestation({ signer, assignment, evidence, issuedAt: "2026-07-30T00:00:00.000Z" });
  assert.equal(verifyAttestation(signed, { publicKey: signer.publicKey }), true);
  assert.throws(() => verifyAttestation({ ...signed, outcome: "FAIL" }, { publicKey: signer.publicKey }), /TAMPERED/);
  assert.throws(
    () => verifyAttestation({ ...signed, signature: "invalid" }, { publicKey: signer.publicKey }),
    /SIGNATURE/,
  );
  assert.throws(() => verifyAttestation({ ...signed, signature: "" }, { publicKey: signer.publicKey }), /UNSIGNED/);
});

test("attestation rejects replay and revoked signing identities", () => {
  const signer = createEphemeralSigner({ keyId: "test.revocable" });
  const signed = signAttestation({ signer, assignment, evidence, issuedAt: "2026-07-30T00:00:00.000Z" });
  const seen = new Set();
  assert.equal(verifyAttestation(signed, { publicKey: signer.publicKey, seenStatementDigests: seen }), true);
  assert.throws(
    () => verifyAttestation(signed, { publicKey: signer.publicKey, seenStatementDigests: seen }),
    /REPLAYED/,
  );
  assert.throws(
    () => verifyAttestation(signed, { publicKey: signer.publicKey, revokedKeyIds: new Set([signer.keyId]) }),
    /REVOKED/,
  );
});
