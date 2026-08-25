export const CONTROLLER_PROTOCOL_VERSION = 1;
export const WORKER_REGISTRY_VERSION = 1;
export const WORKER_TRANSPORT_STATES = ["IDLE", "DISPATCHED", "RUNNING", "REPLIED", "UNREACHABLE"];
export const DISPATCH_ACTIONS = ["FINALIZE_NEXT", "RECONCILIATION_REQUIRED", "WARM_RECONCILE"];
export const WORKER_RESULTS = ["READY", "MERGED", "BLOCKED", "NO_CHANGE", "FAILED_CANDIDATE"];

const shaPattern = /^[0-9a-f]{7,64}$/iu;
const dispatchIdPattern = /^[a-z0-9][a-z0-9._:-]{7,127}$/iu;
const transportStateSet = new Set(WORKER_TRANSPORT_STATES);
const dispatchActionSet = new Set(DISPATCH_ACTIONS);
const workerResultSet = new Set(WORKER_RESULTS);

function fail(code) {
  throw new Error(`PARALLEL_CONTROLLER_${code}`);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function string(value, name) {
  if (typeof value !== "string" || !value.trim()) fail(`${name}_INVALID`);
  return value.trim();
}

function sha(value, name) {
  const normalized = string(value, name).toLowerCase();
  if (!shaPattern.test(normalized)) fail(`${name}_INVALID`);
  return normalized;
}

function pr(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) fail(`${name}_INVALID`);
  return value;
}

function dispatchId(value) {
  const normalized = string(value, "DISPATCH_ID");
  if (!dispatchIdPattern.test(normalized)) fail("DISPATCH_ID_INVALID");
  return normalized;
}

function plainObject(value, name) {
  if (!isRecord(value)) fail(`${name}_INVALID`);
  return structuredClone(value);
}

function stringPaths(value, name) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry.trim()))
    fail(`${name}_INVALID`);
  return [...new Set(value.map((entry) => entry.trim()))].sort();
}

export function validateWorkerRegistry(value) {
  if (!isRecord(value) || value.version !== WORKER_REGISTRY_VERSION || !Array.isArray(value.workers))
    fail("WORKER_REGISTRY_INVALID");
  const projects = new Set();
  const prs = new Set();
  const refs = new Set();
  const workers = value.workers.map((worker) => {
    if (!isRecord(worker)) fail("WORKER_REGISTRY_WORKER_INVALID");
    const normalized = {
      project: string(worker.project, "WORKER_PROJECT"),
      pr: pr(worker.pr, "WORKER_PR"),
      workerRef: string(worker.workerRef, "WORKER_REF"),
      status: string(worker.status ?? "IDLE", "WORKER_STATUS").toUpperCase(),
      lastDispatchId:
        worker.lastDispatchId === null || worker.lastDispatchId === undefined
          ? null
          : dispatchId(worker.lastDispatchId),
    };
    if (!transportStateSet.has(normalized.status)) fail("WORKER_STATUS_INVALID");
    if (projects.has(normalized.project) || prs.has(normalized.pr) || refs.has(normalized.workerRef))
      fail("WORKER_REGISTRY_DUPLICATE");
    projects.add(normalized.project);
    prs.add(normalized.pr);
    refs.add(normalized.workerRef);
    return normalized;
  });
  return { version: WORKER_REGISTRY_VERSION, workers };
}

export function validateDispatchEnvelope(value) {
  if (!isRecord(value) || value.protocolVersion !== CONTROLLER_PROTOCOL_VERSION) fail("DISPATCH_INVALID");
  const envelope = {
    protocolVersion: CONTROLLER_PROTOCOL_VERSION,
    dispatchId: dispatchId(value.dispatchId),
    project: string(value.project, "DISPATCH_PROJECT"),
    pr: pr(value.pr, "DISPATCH_PR"),
    action: string(value.action, "DISPATCH_ACTION").toUpperCase(),
    expectedCandidateSha: sha(value.expectedCandidateSha, "DISPATCH_CANDIDATE_SHA"),
    protectedMainSha: sha(value.protectedMainSha, "DISPATCH_PROTECTED_MAIN_SHA"),
    instructions: plainObject(value.instructions, "DISPATCH_INSTRUCTIONS"),
    returnContract: string(value.returnContract, "DISPATCH_RETURN_CONTRACT"),
  };
  if (!dispatchActionSet.has(envelope.action)) fail("DISPATCH_ACTION_INVALID");
  if (envelope.returnContract !== "PARALLEL_WORKER_REPLY_V1") fail("DISPATCH_RETURN_CONTRACT_INVALID");
  return envelope;
}

export function validateWorkerReply(value) {
  if (!isRecord(value) || value.protocolVersion !== CONTROLLER_PROTOCOL_VERSION) fail("REPLY_INVALID");
  const reply = {
    protocolVersion: CONTROLLER_PROTOCOL_VERSION,
    dispatchId: dispatchId(value.dispatchId),
    project: string(value.project, "REPLY_PROJECT"),
    pr: pr(value.pr, "REPLY_PR"),
    result: string(value.result, "REPLY_RESULT").toUpperCase(),
    candidateSha: sha(value.candidateSha, "REPLY_CANDIDATE_SHA"),
    handoff: value.handoff === null || value.handoff === undefined ? null : plainObject(value.handoff, "REPLY_HANDOFF"),
    mergeSha: value.mergeSha === null || value.mergeSha === undefined ? null : sha(value.mergeSha, "REPLY_MERGE_SHA"),
    landedPaths: stringPaths(value.landedPaths, "REPLY_LANDED_PATHS"),
    blocker: value.blocker === null || value.blocker === undefined ? null : string(value.blocker, "REPLY_BLOCKER"),
  };
  if (!workerResultSet.has(reply.result)) fail("REPLY_RESULT_INVALID");
  if (reply.result === "MERGED" && !reply.mergeSha) fail("REPLY_MERGE_SHA_REQUIRED");
  if (reply.result === "READY" && !reply.handoff) fail("REPLY_HANDOFF_REQUIRED");
  if (reply.result === "BLOCKED" && !reply.blocker) fail("REPLY_BLOCKER_REQUIRED");
  return reply;
}

export function matchesDispatch(reply, envelope) {
  const normalizedReply = validateWorkerReply(reply);
  const normalizedEnvelope = validateDispatchEnvelope(envelope);
  return (
    normalizedReply.dispatchId === normalizedEnvelope.dispatchId &&
    normalizedReply.project === normalizedEnvelope.project &&
    normalizedReply.pr === normalizedEnvelope.pr
  );
}

export function registerWorker(registry, worker) {
  const normalized = validateWorkerRegistry(registry);
  const candidate = validateWorkerRegistry({ version: WORKER_REGISTRY_VERSION, workers: [worker] }).workers[0];
  if (
    normalized.workers.some(
      (entry) =>
        entry.project === candidate.project || entry.pr === candidate.pr || entry.workerRef === candidate.workerRef,
    )
  )
    fail("WORKER_REGISTRY_DUPLICATE");
  return { ...normalized, workers: [...normalized.workers, candidate].sort((left, right) => left.pr - right.pr) };
}
