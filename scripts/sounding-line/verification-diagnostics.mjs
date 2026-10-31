// Observations only: never used for admission, fingerprints or acceptance.
import { replayAdmissionFailure, withReplayAdmissionScope } from "./source-diagnostics.mjs";
const stages = new Set([
  "CLASSIFICATION",
  "EXPERIENCE_PLAN",
  "COMMITTED_EVIDENCE",
  "TRUSTED_ATTESTATION",
  "TRUSTED_ATTESTATION_METADATA",
  "TRUSTED_ATTESTATION_DOWNLOAD",
  "TRUSTED_ATTESTATION_HASH",
  "TRUSTED_ATTESTATION_MANIFEST",
  "EVIDENCE_FINGERPRINTS",
  "ORDINARY_ADMISSION",
  "COMPLETED_EVIDENCE_INTAKE",
  "TECHNICAL_VERIFICATION",
  "TECHNICAL_COMPLETE",
  "HISTORICAL_EXPERIENCE",
  "EXPERIENCE_REPLAY",
  "PHASE_DIRECTORY",
  "PHASE_CREATE",
  "REPLAY_ADMISSION",
  "REPLAY_PLAN_DIRECTORY",
  "REPLAY_PLAN_WRITE",
  "REPLAY_PROFILE_PLAN_WRITE",
  "REPLAY_PROFILE_PROCESS",
  "REPLAY_CAPTURE_READ",
  "REPLAY_PAIRED_SEAL",
  "REPLAY_PAIRED_PACKETS",
  "REPLAY_PAIRED_VALIDATE",
  "REPLAY_CAPTURE_WRITE",
  "REPLAY_REVIEW_PACKETS",
  "REPLAY_EVIDENCE_VALIDATE",
]);
const names = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "ReferenceError",
  "URIError",
  "AggregateError",
]);
const codes = new Set([
  "EACCES",
  "EPERM",
  "EBUSY",
  "EEXIST",
  "EISDIR",
  "EMFILE",
  "ENFILE",
  "ENOENT",
  "ENOSPC",
  "ENOMEM",
  "ENOTDIR",
  "ENOBUFS",
  "ETIMEDOUT",
  "EIO",
  "EROFS",
  "ENAMETOOLONG",
  "ERR_FS_FILE_TOO_LARGE",
  "ERR_STRING_TOO_LONG",
  "ERR_OUT_OF_RANGE",
  "ERR_INVALID_ARG_TYPE",
]);
const syscalls = new Set(["mkdir", "open", "write", "read", "stat", "lstat", "rename", "unlink", "spawn", "spawnSync"]);
const signals = new Set(["SIGTERM", "SIGKILL", "SIGINT", "SIGABRT", "SIGSEGV", "SIGPIPE", "SIGHUP", "SIGQUIT"]);
const phases = new Set(["ordinary", "technical", "technical-launch", "technical-complete", "experience", "render"]);
const observations = new WeakMap();
const object = (value) => value !== null && ["object", "function"].includes(typeof value);
function property(value, key) {
  try {
    return value?.[key];
  } catch {
    return undefined;
  }
}
const member = (set, value) => (set.has(value) ? value : null);
function observation(stage, error, cause, phase) {
  const status = property(cause, "status");
  return {
    version: 1,
    stage: stages.has(stage) ? stage : "UNCLASSIFIED",
    phase: member(phases, phase),
    errorName: member(names, property(error, "name")) ?? "Error",
    code: member(codes, property(cause, "code")),
    causeCode: member(codes, property(property(cause, "cause"), "code")),
    syscall: member(syscalls, property(cause, "syscall")),
    exitCode: Number.isInteger(status) && status >= 0 && status <= 255 ? status : null,
    signal: member(signals, property(cause, "signal")),
  };
}
export function observeVerificationFailure(stage, error, { cause = error, phase } = {}) {
  // Keep the deepest observed boundary and rethrow the identical authority error.
  // No raw error, message, stack, path, argv or environment is retained here.
  if (object(error) && !observations.has(error)) observations.set(error, observation(stage, error, cause, phase));
  return error;
}
export async function withVerificationStage(stage, operation, { observeFailure = true } = {}) {
  const enabled = process.env.SOUNDING_LINE_EVIDENCE_PURPOSE === "PROTECTED_FINAL_VERIFICATION";
  const startedAt = performance.now();
  const progress = (event) => {
    if (!enabled) return;
    try {
      process.stdout.write(
        JSON.stringify({
          namespace: "SOUNDING_LINE_VERIFICATION_PROGRESS",
          stage: stages.has(stage) ? stage : "UNCLASSIFIED",
          event,
          elapsedMs: Math.max(0, Math.round(performance.now() - startedAt)),
        }) + "\n",
      );
    } catch {
      // Progress is observational and cannot replace the operation or its error.
    }
  };
  progress("START");
  try {
    const result = await (stage === "REPLAY_ADMISSION" ? withReplayAdmissionScope(operation) : operation());
    progress("END");
    return result;
  } catch (error) {
    progress("FAIL");
    throw observeFailure ? observeVerificationFailure(stage, error) : error;
  }
}
export function verificationFailureObservation(error) {
  const observed =
    object(error) && observations.has(error)
      ? { ...observations.get(error) }
      : observation("UNCLASSIFIED", error, error);
  const replayAdmission = replayAdmissionFailure(error);
  return replayAdmission ? { ...observed, replayAdmission } : observed;
}
