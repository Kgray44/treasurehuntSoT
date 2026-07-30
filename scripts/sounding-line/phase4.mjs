/* Phase 4 provider-neutral, local protocol primitives. */
import { createHash, randomUUID } from "node:crypto";
import { canonicalize } from "./phase3.mjs";

export const workerStates = Object.freeze([
  "REGISTERING",
  "AVAILABLE",
  "RESERVED",
  "EXECUTING",
  "DRAINING",
  "UNHEALTHY",
  "QUARANTINED",
  "REVOKED",
  "OFFLINE",
]);
export const trustDomains = Object.freeze(["LOCAL_TRUSTED", "CI_TRUSTED", "PR_RESTRICTED", "EXTERNAL_RESTRICTED"]);
export const releaseStates = Object.freeze([
  "RELEASE_GO",
  "RELEASE_GO_WITH_EXTERNAL_PENDING",
  "RELEASE_NO_GO",
  "RELEASE_INCOMPLETE",
  "EVIDENCE_INVALID",
]);
export const cutoverStages = Object.freeze([
  "STAGE_0_LEGACY_AUTHORITATIVE",
  "STAGE_1_SHADOW_PLANNING",
  "STAGE_2_SHADOW_EXECUTION",
  "STAGE_3_DUAL_RUN_FOCUSED",
  "STAGE_4_DUAL_RUN_RELEASE",
  "STAGE_5_SOUNDING_LINE_PRIMARY_LEGACY_FALLBACK",
  "STAGE_6_SOUNDING_LINE_AUTHORITATIVE_OBSERVATION",
  "STAGE_7_LEGACY_RETIRED_ROLLBACK_RETAINED",
]);
export const digest = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : canonicalize(value))
    .digest("hex");
const required = (value, name) => {
  if (typeof value !== "string" || !value.trim() || value.length > 256) throw new Error(`INVALID_${name}`);
  return value;
};
const exactDigest = (value, name) => {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) throw new Error(`INVALID_${name}`);
  return value;
};

export function enrollWorker(input) {
  for (const key of [
    "workerId",
    "hostId",
    "bootId",
    "platform",
    "architecture",
    "nodeVersion",
    "executableDigest",
    "enrollmentId",
  ])
    required(input?.[key], key);
  exactDigest(input.executableDigest, "EXECUTABLE_DIGEST");
  if (!trustDomains.includes(input.trustDomain)) throw new Error("INVALID_TRUST_DOMAIN");
  if (!input.capabilities || typeof input.capabilities !== "object" || Array.isArray(input.capabilities))
    throw new Error("INVALID_CAPABILITIES");
  return {
    ...input,
    state: "AVAILABLE",
    sessionNonce: digest(`${input.enrollmentId}:${input.workerId}:${input.bootId}`),
    lastHeartbeatAt: new Date().toISOString(),
    assignment: null,
    revoked: false,
  };
}

export function capabilityDecision(worker, node) {
  if (!worker || worker.revoked || !["AVAILABLE", "RESERVED"].includes(worker.state))
    return { accepted: false, reason: "WORKER_UNAVAILABLE" };
  if (!node || typeof node !== "object") return { accepted: false, reason: "INVALID_NODE" };
  const requirements = node.requirements ?? {};
  if (requirements.trustDomain && worker.trustDomain !== requirements.trustDomain)
    return { accepted: false, reason: "TRUST_DOMAIN_MISMATCH" };
  for (const key of ["platform", "architecture", "browser", "database", "provider"]) {
    const wanted = requirements[key];
    if (!wanted) continue;
    const available = key === "platform" || key === "architecture" ? worker[key] : worker.capabilities[key];
    if (Array.isArray(available) ? !available.includes(wanted) : available !== wanted)
      return { accepted: false, reason: `MISSING_${key.toUpperCase()}` };
  }
  if (worker.trustDomain === "PR_RESTRICTED" && (requirements.releaseAuthority || requirements.privateFixtures))
    return { accepted: false, reason: "UNTRUSTED_WORKER_RESTRICTED" };
  return { accepted: true, reason: "CAPABILITY_MATCH" };
}

export function heartbeatWorker(worker, { sessionNonce, at = new Date().toISOString() }) {
  if (!worker || worker.revoked || !["AVAILABLE", "RESERVED", "EXECUTING", "DRAINING"].includes(worker.state))
    throw new Error("HEARTBEAT_WORKER_UNAVAILABLE");
  if (sessionNonce !== worker.sessionNonce) throw new Error("HEARTBEAT_IDENTITY_INVALID");
  return { ...worker, lastHeartbeatAt: at };
}

export function transitionWorker(worker, next, reason) {
  if (!workerStates.includes(next) || !required(reason, "WORKER_TRANSITION_REASON"))
    throw new Error("INVALID_WORKER_TRANSITION");
  const permitted = {
    AVAILABLE: ["RESERVED", "DRAINING", "UNHEALTHY", "QUARANTINED", "REVOKED", "OFFLINE"],
    RESERVED: ["AVAILABLE", "EXECUTING", "DRAINING", "QUARANTINED", "REVOKED", "OFFLINE"],
    EXECUTING: ["AVAILABLE", "DRAINING", "UNHEALTHY", "QUARANTINED", "REVOKED", "OFFLINE"],
    DRAINING: ["AVAILABLE", "QUARANTINED", "REVOKED", "OFFLINE"],
    UNHEALTHY: ["AVAILABLE", "QUARANTINED", "REVOKED", "OFFLINE"],
    QUARANTINED: ["REVOKED", "OFFLINE"],
    REGISTERING: ["AVAILABLE", "QUARANTINED", "REVOKED"],
    REVOKED: [],
    OFFLINE: [],
  };
  if (!permitted[worker?.state]?.includes(next)) throw new Error("WORKER_TRANSITION_DENIED");
  return {
    ...worker,
    state: next,
    revoked: next === "REVOKED" || worker.revoked,
    transitionReason: reason,
    assignment: next === "AVAILABLE" ? null : worker.assignment,
  };
}

export function comparePlans(local, ci) {
  for (const key of ["sourceDigest", "policyDigest", "digest"]) {
    if (local?.[key] !== ci?.[key]) return { equivalent: false, reason: `PLAN_${key.toUpperCase()}_MISMATCH` };
  }
  const selected = (plan) =>
    JSON.stringify([...new Set((plan.selected ?? []).map((item) => item.suiteId ?? item))].sort());
  if (selected(local) !== selected(ci)) return { equivalent: false, reason: "PLAN_SELECTION_MISMATCH" };
  return { equivalent: true, reason: "PLAN_PARITY" };
}

export function compareDualRun(legacy, soundingLine) {
  const differences = [];
  for (const key of ["sourceDigest", "policyDigest", "mandatorySuites", "contractCoverage", "cleanup"]) {
    if (canonicalize(legacy?.[key]) !== canonicalize(soundingLine?.[key])) differences.push(key);
  }
  if (soundingLine?.p34Green === true || soundingLine?.externalProviderValidated === true)
    differences.push("unsupported-authority-claim");
  return { equivalent: differences.length === 0, unacceptableDifferences: differences };
}

export function sealAssignment({ worker, plan, node, grantNonce = randomUUID() }) {
  const decision = capabilityDecision(worker, node);
  if (!decision.accepted) throw new Error(decision.reason);
  exactDigest(plan?.digest, "PLAN_DIGEST");
  required(node?.id, "NODE_ID");
  const assignment = {
    version: 1,
    workerId: worker.workerId,
    bootId: worker.bootId,
    planDigest: plan.digest,
    nodeId: node.id,
    nodeDigest: digest(node),
    sourceDigest: exactDigest(plan.sourceDigest, "SOURCE_DIGEST"),
    policyDigest: exactDigest(plan.policyDigest, "POLICY_DIGEST"),
    grantNonce: required(grantNonce, "GRANT_NONCE"),
  };
  return { ...assignment, digest: digest(assignment) };
}

export function verifyAssignment(assignment, worker, usedNonces = new Set()) {
  const { digest: assignmentDigest, ...unsignedAssignment } = assignment ?? {};
  if (!assignment || assignmentDigest !== digest(unsignedAssignment)) throw new Error("ASSIGNMENT_TAMPERED");
  if (assignment.workerId !== worker.workerId || assignment.bootId !== worker.bootId || worker.revoked)
    throw new Error("ASSIGNMENT_WORKER_INVALID");
  if (usedNonces.has(assignment.grantNonce)) throw new Error("ASSIGNMENT_REPLAYED");
  usedNonces.add(assignment.grantNonce);
  return true;
}

export function createEvidenceManifest(input) {
  const manifest = {
    version: 1,
    sourceDigest: exactDigest(input?.sourceDigest, "SOURCE_DIGEST"),
    policyDigest: exactDigest(input?.policyDigest, "POLICY_DIGEST"),
    planDigest: exactDigest(input?.planDigest, "PLAN_DIGEST"),
    nodeId: required(input?.nodeId, "NODE_ID"),
    attemptId: required(input?.attemptId, "ATTEMPT_ID"),
    workerId: required(input?.workerId, "WORKER_ID"),
    workerBootId: required(input?.workerBootId, "WORKER_BOOT_ID"),
    environmentDigest: exactDigest(input?.environmentDigest, "ENVIRONMENT_DIGEST"),
    dependencyLockDigest: exactDigest(input?.dependencyLockDigest, "LOCK_DIGEST"),
    executableDigest: exactDigest(input?.executableDigest, "EXECUTABLE_DIGEST"),
    artifacts: [...(input?.artifacts ?? [])].map((item) => ({
      id: required(item.id, "ARTIFACT_ID"),
      digest: exactDigest(item.digest, "ARTIFACT_DIGEST"),
    })),
    outcome: required(input?.outcome, "OUTCOME"),
    cleanup: required(input?.cleanup, "CLEANUP"),
    retentionClass: required(input?.retentionClass, "RETENTION_CLASS"),
    issuedAt: input?.issuedAt ?? new Date().toISOString(),
  };
  if (manifest.cleanup !== "CLEAN") throw new Error("EVIDENCE_CLEANUP_INVALID");
  return { ...manifest, digest: digest(manifest) };
}

export function verifyEvidence(manifest, assignment, worker, seen = new Set()) {
  const { digest: manifestDigest, ...unsignedManifest } = manifest ?? {};
  if (!manifest || manifestDigest !== digest(unsignedManifest)) throw new Error("EVIDENCE_TAMPERED");
  if (seen.has(manifest.digest)) throw new Error("EVIDENCE_REPLAYED");
  if (worker.revoked || manifest.workerId !== worker.workerId || manifest.workerBootId !== worker.bootId)
    throw new Error("EVIDENCE_WORKER_INVALID");
  for (const key of ["sourceDigest", "policyDigest", "planDigest"])
    if (manifest[key] !== assignment[key]) throw new Error("EVIDENCE_ASSIGNMENT_MISMATCH");
  if (manifest.executableDigest !== worker.executableDigest || manifest.cleanup !== "CLEAN")
    throw new Error("EVIDENCE_ENVIRONMENT_INVALID");
  seen.add(manifest.digest);
  return true;
}

export function decideRelease(input) {
  const vetoes = [];
  if (!input?.trustedController) vetoes.push("UNTRUSTED_CONTROLLER");
  if (!input?.mandatoryComplete) vetoes.push("MANDATORY_PROOF_INCOMPLETE");
  if (!input?.evidenceValid) vetoes.push("EVIDENCE_INVALID");
  if (!input?.cleanupClean) vetoes.push("CLEANUP_INVALID");
  if (input?.p34Green === true) vetoes.push("P34_FALSELY_GREEN");
  if (vetoes.length)
    return { state: vetoes.includes("EVIDENCE_INVALID") ? "EVIDENCE_INVALID" : "RELEASE_NO_GO", vetoes };
  return {
    state: input.externalPending || input.p34NonGreen ? "RELEASE_GO_WITH_EXTERNAL_PENDING" : "RELEASE_GO",
    vetoes: [],
  };
}

export function revokeEvidence({ manifest, reason, affectedDecisions = [] }) {
  const allowed = new Set([
    "WORKER_REVOKED",
    "ARTIFACT_TAMPERED",
    "POLICY_MOVED",
    "SOURCE_MISMATCH",
    "CLEANUP_INVALID",
    "HISTORY_CORRUPT",
  ]);
  if (!manifest?.digest || !allowed.has(reason)) throw new Error("EVIDENCE_REVOCATION_INVALID");
  return {
    status: "REVOKED",
    manifestDigest: manifest.digest,
    reason,
    affectedDecisions: [...new Set(affectedDecisions)].sort(),
    requiredRerunScope: "RECOMPUTE_AFFECTED_PLAN_AND_MANDATORY_DEPENDENTS",
  };
}

export function emergencySerial({ legacyAvailable, reason }) {
  if (!legacyAvailable || !required(reason, "EMERGENCY_SERIAL_REASON")) throw new Error("EMERGENCY_SERIAL_UNAVAILABLE");
  return {
    mode: "EMERGENCY_SERIAL",
    releaseAuthority: "LEGACY_HARNESS",
    distributedDispatch: "DISABLED",
    evidenceReuse: "DISABLED",
    reason,
  };
}

export function transitionCutover(current, next, evidence) {
  if (!cutoverStages.includes(current) || !cutoverStages.includes(next)) throw new Error("INVALID_CUTOVER_STAGE");
  const delta = cutoverStages.indexOf(next) - cutoverStages.indexOf(current);
  if (delta !== 1 || !evidence?.approved || !evidence?.rollbackReady) throw new Error("CUTOVER_TRANSITION_DENIED");
  return { current: next, previous: current, rollbackReady: true };
}
