import assert from "node:assert/strict";
import test from "node:test";
import * as phase4 from "../../scripts/sounding-line/phase4.mjs";

const hex = (char) => char.repeat(64);
const worker = () =>
  phase4.enrollWorker({
    workerId: "worker-a",
    hostId: "host-a",
    bootId: "boot-a",
    trustDomain: "LOCAL_TRUSTED",
    platform: "win32",
    architecture: "x64",
    nodeVersion: "22",
    executableDigest: hex("a"),
    enrollmentId: "enroll-a",
    capabilities: { browser: ["chromium"], database: ["sqlite"], provider: ["local"] },
  });
const plan = { digest: hex("b"), sourceDigest: hex("c"), policyDigest: hex("d") };
const node = {
  id: "unit",
  requirements: { platform: "win32", browser: "chromium", database: "sqlite", trustDomain: "LOCAL_TRUSTED" },
};

test("worker enrollment, capability matching, and sealed assignment fail closed", () => {
  const registered = worker();
  assert.equal(phase4.capabilityDecision(registered, node).accepted, true);
  const assignment = phase4.sealAssignment({ worker: registered, plan, node, grantNonce: "nonce-a" });
  assert.equal(phase4.verifyAssignment(assignment, registered), true);
  assert.throws(() => phase4.verifyAssignment(assignment, registered, new Set(["nonce-a"])), /REPLAYED/);
  assert.equal(
    phase4.capabilityDecision(
      { ...registered, trustDomain: "PR_RESTRICTED" },
      { ...node, requirements: { releaseAuthority: true } },
    ).reason,
    "UNTRUSTED_WORKER_RESTRICTED",
  );
});

test("worker lifecycle and local/CI parity reject identity and proof drift", () => {
  const registered = worker();
  const heartbeated = phase4.heartbeatWorker(registered, { sessionNonce: registered.sessionNonce });
  assert.equal(heartbeated.state, "AVAILABLE");
  assert.equal(phase4.transitionWorker(heartbeated, "DRAINING", "operator-drain").state, "DRAINING");
  assert.throws(() => phase4.transitionWorker(heartbeated, "EXECUTING", "skip-reservation"), /DENIED/);
  assert.throws(() => phase4.heartbeatWorker(registered, { sessionNonce: "forged" }), /IDENTITY/);
  const local = { ...plan, selected: [{ suiteId: "unit.core" }] };
  assert.equal(phase4.comparePlans(local, { ...local }).equivalent, true);
  assert.equal(phase4.comparePlans(local, { ...local, policyDigest: hex("e") }).equivalent, false);
  assert.equal(
    phase4.compareDualRun(
      {
        sourceDigest: hex("1"),
        policyDigest: hex("2"),
        mandatorySuites: ["unit"],
        contractCoverage: ["contract"],
        cleanup: "CLEAN",
      },
      {
        sourceDigest: hex("1"),
        policyDigest: hex("2"),
        mandatorySuites: ["unit"],
        contractCoverage: ["contract"],
        cleanup: "CLEAN",
        p34Green: false,
      },
    ).equivalent,
    true,
  );
});

test("evidence binds assignment, worker, cleanup, digest, and replay identity", () => {
  const registered = worker();
  const assignment = phase4.sealAssignment({ worker: registered, plan, node, grantNonce: "nonce-b" });
  const evidence = phase4.createEvidenceManifest({
    sourceDigest: plan.sourceDigest,
    policyDigest: plan.policyDigest,
    planDigest: plan.digest,
    nodeId: node.id,
    attemptId: "attempt-a",
    workerId: registered.workerId,
    workerBootId: registered.bootId,
    environmentDigest: hex("e"),
    dependencyLockDigest: hex("f"),
    executableDigest: registered.executableDigest,
    artifacts: [{ id: "log", digest: hex("1") }],
    outcome: "PASS",
    cleanup: "CLEAN",
    retentionClass: "LOCAL",
  });
  assert.equal(phase4.verifyEvidence(evidence, assignment, registered), true);
  assert.throws(() => phase4.verifyEvidence({ ...evidence, outcome: "FAIL" }, assignment, registered), /TAMPERED/);
  assert.throws(() => phase4.createEvidenceManifest({ ...evidence, cleanup: "UNKNOWN" }), /CLEANUP/);
});

test("release and cutover preserve vetoes and rollback readiness", () => {
  assert.equal(
    phase4.decideRelease({
      trustedController: true,
      mandatoryComplete: true,
      evidenceValid: true,
      cleanupClean: true,
      p34NonGreen: true,
      externalPending: true,
    }).state,
    "HISTORICAL_SIMULATION_REJECTED",
  );
  assert.equal(
    phase4.decideRelease({ trustedController: true, mandatoryComplete: true, evidenceValid: false, cleanupClean: true })
      .state,
    "HISTORICAL_SIMULATION_INVALID",
  );
  assert.deepEqual(
    phase4.transitionCutover("STAGE_0_LEGACY_AUTHORITATIVE", "STAGE_1_SHADOW_PLANNING", {
      approved: true,
      rollbackReady: true,
    }).current,
    "STAGE_1_SHADOW_PLANNING",
  );
  assert.throws(
    () =>
      phase4.transitionCutover("STAGE_0_LEGACY_AUTHORITATIVE", "STAGE_2_SHADOW_EXECUTION", {
        approved: true,
        rollbackReady: true,
      }),
    /DENIED/,
  );
  const evidence = phase4.createEvidenceManifest({
    sourceDigest: plan.sourceDigest,
    policyDigest: plan.policyDigest,
    planDigest: plan.digest,
    nodeId: node.id,
    attemptId: "attempt-revoke",
    workerId: "worker-a",
    workerBootId: "boot-a",
    environmentDigest: hex("e"),
    dependencyLockDigest: hex("f"),
    executableDigest: hex("a"),
    artifacts: [],
    outcome: "PASS",
    cleanup: "CLEAN",
    retentionClass: "LOCAL",
  });
  assert.equal(
    phase4.revokeEvidence({ manifest: evidence, reason: "ARTIFACT_TAMPERED", affectedDecisions: ["decision-a"] })
      .status,
    "REVOKED",
  );
  assert.equal(
    phase4.emergencySerial({ legacyAvailable: true, reason: "rollback-proof" }).releaseAuthority,
    "LEGACY_HARNESS",
  );
});
