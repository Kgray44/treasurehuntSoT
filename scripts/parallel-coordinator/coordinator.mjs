import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTROLLER_PROTOCOL_VERSION,
  matchesDispatch,
  validateDispatchEnvelope,
  validateWorkerRegistry,
  validateWorkerReply,
} from "./controller-protocol.mjs";

export const HANDOFF_VERSION = 1;
export const STATES = ["ACTIVE", "READY", "WAITING", "CONFLICT", "BLOCKED", "MERGED"];
export const OPERATING_MODES = ["ADVISORY", "AUTONOMOUS_DISPATCH"];

const stateSet = new Set(STATES);
const shaPattern = /^[0-9a-f]{7,64}$/iu;

function fail(code) {
  throw new Error(`PARALLEL_COORDINATOR_${code}`);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringField(value, name) {
  if (typeof value !== "string" || !value.trim()) fail(`HANDOFF_${name}_INVALID`);
  return value.trim();
}

function shaField(value, name) {
  const sha = stringField(value, name).toLowerCase();
  if (!shaPattern.test(sha)) fail(`HANDOFF_${name}_INVALID`);
  return sha;
}

function stringList(value, name, normalize = (item) => item) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail(`HANDOFF_${name}_INVALID`);
  const values = value.map((item) => normalize(stringField(item, name)));
  return [...new Set(values)].sort();
}

export function normalizePath(value) {
  const normalized = stringField(value, "PATH")
    .replace(/\\/gu, "/")
    .replace(/^\.\/+|\/+$/gu, "");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    /^[a-z]:/iu.test(normalized) ||
    normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")
  )
    fail("HANDOFF_PATH_INVALID");
  return normalized;
}

function normalizeToken(value) {
  const normalized = stringField(value, "TOKEN").toLowerCase();
  if (/\s/iu.test(normalized)) fail("HANDOFF_TOKEN_INVALID");
  return normalized;
}

function normalizePr(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) fail(`HANDOFF_${name}_INVALID`);
  return value;
}

function normalizePriorityLevel(value) {
  if (value === undefined) return 5;
  if (!Number.isSafeInteger(value) || value < 1 || value > 10) fail("HANDOFF_PRIORITY_LEVEL_INVALID");
  return value;
}

export function validateHandoff(value, source = "handoff") {
  if (!isRecord(value)) fail("HANDOFF_INVALID");
  if (value.version !== HANDOFF_VERSION) fail("HANDOFF_VERSION_INVALID");
  const handoff = {
    version: HANDOFF_VERSION,
    project: stringField(value.project, "PROJECT"),
    pr: normalizePr(value.pr, "PR"),
    candidateSha: shaField(value.candidateSha, "CANDIDATE_SHA"),
    baseSha: shaField(value.baseSha, "BASE_SHA"),
    status: stringField(value.status, "STATUS").toUpperCase(),
    priorityLevel: normalizePriorityLevel(value.priorityLevel),
    touches: stringList(value.touches, "TOUCHES", normalizeToken),
    paths: stringList(value.paths, "PATHS", normalizePath),
    migrationFamilies: stringList(value.migrationFamilies, "MIGRATION_FAMILIES", normalizeToken),
    dependencies: [],
    source,
  };
  if (!stateSet.has(handoff.status)) fail("HANDOFF_STATUS_INVALID");
  if (value.dependencies !== undefined && !Array.isArray(value.dependencies)) fail("HANDOFF_DEPENDENCIES_INVALID");
  handoff.dependencies = [...new Set((value.dependencies ?? []).map((pr) => normalizePr(pr, "DEPENDENCIES")))].sort(
    (left, right) => left - right,
  );
  if (handoff.dependencies.includes(handoff.pr)) fail("HANDOFF_DEPENDENCY_SELF_REFERENTIAL");
  if (value.readyAt !== undefined) {
    const readyAt = stringField(value.readyAt, "READY_AT");
    if (Number.isNaN(Date.parse(readyAt))) fail("HANDOFF_READY_AT_INVALID");
    handoff.readyAt = new Date(readyAt).toISOString();
  }
  return handoff;
}

export async function discoverHandoffs(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return [];
    throw error;
  }
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
  const handoffs = await Promise.all(
    files.map(async (file) => {
      const source = path.join(directory, file);
      let parsed;
      try {
        parsed = JSON.parse(await readFile(source, "utf8"));
      } catch {
        fail(`HANDOFF_JSON_INVALID:${file}`);
      }
      return validateHandoff(parsed, source);
    }),
  );
  const seenPrs = new Set();
  const seenCandidates = new Set();
  for (const handoff of handoffs) {
    if (seenPrs.has(handoff.pr)) fail(`HANDOFF_PR_DUPLICATE:${handoff.pr}`);
    if (seenCandidates.has(handoff.candidateSha)) fail(`HANDOFF_CANDIDATE_SHA_DUPLICATE:${handoff.candidateSha}`);
    seenPrs.add(handoff.pr);
    seenCandidates.add(handoff.candidateSha);
  }
  return handoffs;
}

export function pathsOverlap(left, right) {
  const first = normalizePath(left);
  const second = normalizePath(right);
  return first === second || first.startsWith(`${second}/`) || second.startsWith(`${first}/`);
}

function shared(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

export function overlapBetween(left, right) {
  const paths = [];
  for (const leftPath of left.paths)
    for (const rightPath of right.paths) if (pathsOverlap(leftPath, rightPath)) paths.push(`${leftPath}~${rightPath}`);
  return {
    paths: [...new Set(paths)].sort(),
    touches: shared(left.touches, right.touches),
    migrationFamilies: shared(left.migrationFamilies, right.migrationFamilies),
  };
}

function hasCoordinationMetadata(handoff) {
  return Boolean(handoff.paths.length || handoff.touches.length || handoff.migrationFamilies.length);
}

function serializationRank(left, right) {
  const leftDate = left.readyAt ? Date.parse(left.readyAt) : Number.POSITIVE_INFINITY;
  const rightDate = right.readyAt ? Date.parse(right.readyAt) : Number.POSITIVE_INFINITY;
  if (leftDate !== rightDate) return leftDate - rightDate;
  return left.pr - right.pr;
}

function queueRank(left, right) {
  if (left.priorityLevel !== right.priorityLevel) return left.priorityLevel - right.priorityLevel;
  return serializationRank(left, right);
}

function setState(candidate, state, reason) {
  candidate.state = state;
  if (reason && !candidate.reasons.includes(reason)) candidate.reasons.push(reason);
}

function applyPrStates(candidates, prStates, actionableStalePrs) {
  for (const candidate of candidates) {
    const prState = prStates?.[candidate.handoff.pr];
    if (prState?.state === "MERGED") setState(candidate, "MERGED", "PR_MERGED");
    if (prState?.state === "CLOSED") setState(candidate, "BLOCKED", "PR_CLOSED");
    if (actionableStalePrs.has(candidate.handoff.pr)) setState(candidate, "BLOCKED", "HANDOFF_STALE_PR_HEAD");
  }
}

function applyDependencies(candidates, byPr) {
  for (let pass = 0; pass < candidates.length; pass += 1) {
    let changed = false;
    for (const candidate of candidates) {
      if (candidate.state !== "READY") continue;
      for (const dependencyPr of candidate.handoff.dependencies) {
        const dependency = byPr.get(dependencyPr);
        if (!dependency) {
          setState(candidate, "BLOCKED", `DEPENDENCY_NOT_FOUND:PR#${dependencyPr}`);
          changed = true;
          break;
        }
        if (dependency.state === "MERGED") continue;
        setState(candidate, "WAITING", `DEPENDENCY_PENDING:PR#${dependencyPr}`);
        changed = true;
        break;
      }
    }
    if (!changed) return;
  }
}

function snapshot(candidate) {
  return {
    project: candidate.handoff.project,
    pr: candidate.handoff.pr,
    candidateSha: candidate.handoff.candidateSha,
    baseSha: candidate.handoff.baseSha,
    priorityLevel: candidate.handoff.priorityLevel,
    ...(candidate.seat ? { seat: candidate.seat, action: candidate.action } : {}),
    state: candidate.state,
    reasons: [...candidate.reasons].sort(),
  };
}

function classifyCandidates({ handoffs, prStates, actionableStalePrs }) {
  const candidates = handoffs.map((handoff) => ({ handoff, state: handoff.status, reasons: [] }));
  const byPr = new Map(candidates.map((candidate) => [candidate.handoff.pr, candidate]));
  applyPrStates(candidates, prStates, actionableStalePrs);
  for (const candidate of candidates)
    if (candidate.state === "READY" && !hasCoordinationMetadata(candidate.handoff))
      setState(candidate, "CONFLICT", "INSUFFICIENT_COORDINATION_METADATA");
  applyDependencies(candidates, byPr);
  return candidates;
}

function hasStaleLiveHead(candidate, prStates) {
  const liveHead = prStates?.[candidate.handoff.pr]?.headRefOid;
  return typeof liveHead === "string" && liveHead.toLowerCase() !== candidate.handoff.candidateSha;
}

function currentnessReasons(candidate, changedPathsByPr, currentnessReasonsByPr) {
  const changedPaths = changedPathsByPr?.[candidate.handoff.pr] ?? [];
  return [
    ...new Set([
      ...materiallyAffected({ candidate: candidate.handoff, mergedPaths: changedPaths }),
      ...(currentnessReasonsByPr?.[candidate.handoff.pr] ?? []),
    ]),
  ].sort();
}

function readyQueue(candidates, finalizingPr) {
  const ready = candidates
    .filter((candidate) => candidate.state === "READY")
    .sort((left, right) => queueRank(left.handoff, right.handoff));
  if (finalizingPr !== null) {
    const finalizingIndex = ready.findIndex((candidate) => candidate.handoff.pr === finalizingPr);
    if (finalizingIndex > 0) ready.unshift(ready.splice(finalizingIndex, 1)[0]);
  }
  return ready;
}

function assignQueueActions(candidates, changedPathsByPr, currentnessReasonsByPr, finalizingPr) {
  const ready = readyQueue(candidates, finalizingPr);
  for (const [index, candidate] of ready.entries()) {
    candidate.seat = index + 1;
    const reasons = currentnessReasons(candidate, changedPathsByPr, currentnessReasonsByPr);
    if (candidate.seat === 1)
      candidate.action =
        candidate.handoff.pr === finalizingPr || !reasons.length ? "FINALIZE_NEXT" : "RECONCILIATION_REQUIRED";
    else if (candidate.seat === 2) candidate.action = reasons.length ? "WARM_RECONCILE" : "WARM_STANDBY";
    else candidate.action = "HOLD";
    if (candidate.seat <= 2 && reasons.length)
      candidate.reasons = [...new Set([...candidate.reasons, "RECONCILIATION_REQUIRED", ...reasons])];
  }
  return ready;
}

export function coordinate({
  handoffs,
  mainSha = null,
  prStates = {},
  changedPathsByPr = {},
  currentnessReasonsByPr = {},
  finalizingPr = null,
}) {
  if (finalizingPr !== null) finalizingPr = normalizePr(finalizingPr, "FINALIZING_PR");
  const actionableStalePrs = new Set();
  let candidates;
  let ready;
  for (;;) {
    candidates = classifyCandidates({ handoffs, prStates, actionableStalePrs });
    ready = readyQueue(candidates, finalizingPr);
    const newlyStale = ready.slice(0, 2).filter((candidate) => hasStaleLiveHead(candidate, prStates));
    if (!newlyStale.length) break;
    newlyStale.forEach((candidate) => actionableStalePrs.add(candidate.handoff.pr));
  }
  ready = assignQueueActions(candidates, changedPathsByPr, currentnessReasonsByPr, finalizingPr);
  const order = candidates
    .filter((candidate) => candidate.state === "READY")
    .sort((left, right) => ready.indexOf(left) - ready.indexOf(right))
    .map(snapshot);
  return {
    version: HANDOFF_VERSION,
    protectedMain: mainSha,
    readyOrder: order,
    candidates: candidates.map(snapshot).sort((left, right) => left.pr - right.pr),
  };
}

function autonomousInstructions(action) {
  if (action === "FINALIZE_NEXT")
    return {
      scope: "Verify the current protected main and expected candidate, preserve the candidate if current, run ordinary Sounding Line, merge only after PASS, run landed smoke, and return the structured reply.",
      maxCandidateRepairCycles: 2,
    };
  return {
    scope: "Reconcile exactly once against the supplied protected main, run only invalidated focused proof, update the candidate handoff, and return the structured reply without finalizing the PR.",
    maxReconciliations: 1,
  };
}

function defaultDispatchId({ candidate, mainSha }) {
  return `pc-v1-pr${candidate.pr}-${candidate.candidateSha.slice(0, 12)}-${candidate.action.toLowerCase()}-${mainSha.slice(0, 12)}`;
}

/**
 * Returns transport-neutral work for the parent Codex chat to deliver. This module
 * never discovers, messages, or creates worker chats itself.
 */
export function planAutonomousDispatch({
  handoffs,
  workerRegistry,
  mainSha,
  prStates = {},
  changedPathsByPr = {},
  currentnessReasonsByPr = {},
  finalizingPr = null,
  dispatchIdFactory = defaultDispatchId,
}) {
  const registry = validateWorkerRegistry(workerRegistry);
  const plan = coordinate({ handoffs, mainSha, prStates, changedPathsByPr, currentnessReasonsByPr, finalizingPr });
  if (!mainSha || !shaPattern.test(mainSha)) fail("PROTECTED_MAIN_SHA_INVALID");
  const workersByPr = new Map(registry.workers.map((worker) => [worker.pr, worker]));
  const handoffsByPr = new Map(handoffs.map((handoff) => [handoff.pr, handoff]));
  const dispatches = [];
  const suppressed = [];
  let occupiedSeats = 0;
  for (const candidate of plan.readyOrder) {
    const worker = workersByPr.get(candidate.pr);
    if (!worker || worker.project !== candidate.project) {
      suppressed.push({ pr: candidate.pr, reason: "WORKER_UNREGISTERED" });
      continue;
    }
    if (worker.status === "UNREACHABLE") {
      suppressed.push({ pr: candidate.pr, reason: "WORKER_UNREACHABLE" });
      continue;
    }
    occupiedSeats += 1;
    if (worker.status === "DISPATCHED" || worker.status === "RUNNING") {
      suppressed.push({ pr: candidate.pr, reason: "WORKER_DISPATCH_ACTIVE" });
      continue;
    }
    const handoff = handoffsByPr.get(candidate.pr);
    const reconciliationReasons = currentnessReasons(
      { handoff },
      changedPathsByPr,
      currentnessReasonsByPr,
    );
    const action =
      occupiedSeats === 1
        ? !reconciliationReasons.length
          ? "FINALIZE_NEXT"
          : "RECONCILIATION_REQUIRED"
        : occupiedSeats === 2
          ? reconciliationReasons.length
            ? "WARM_RECONCILE"
            : "WARM_STANDBY"
          : "HOLD";
    if (action === "WARM_STANDBY" || action === "HOLD") {
      suppressed.push({ pr: candidate.pr, reason: action });
      continue;
    }
    const dispatchId = dispatchIdFactory({ candidate: { ...candidate, action }, mainSha, worker });
    if (worker.lastDispatchId === dispatchId) {
      suppressed.push({ pr: candidate.pr, reason: "DUPLICATE_DISPATCH" });
      continue;
    }
    dispatches.push(
      validateDispatchEnvelope({
        protocolVersion: CONTROLLER_PROTOCOL_VERSION,
        dispatchId,
        project: candidate.project,
        pr: candidate.pr,
        action,
        expectedCandidateSha: candidate.candidateSha,
        protectedMainSha: mainSha,
        instructions: autonomousInstructions(action),
        returnContract: "PARALLEL_WORKER_REPLY_V1",
      }),
    );
  }
  return { plan, dispatches, suppressed };
}

/**
 * Validates a worker result against the dispatch and observations fetched by the
 * parent chat. The caller, not this scheduler, owns native transport and GitHub I/O.
 */
export function validateWorkerReplyAgainstLiveState({ reply, dispatch, workerRegistry, workerRef, livePrState, liveMainSha }) {
  const envelope = validateDispatchEnvelope(dispatch);
  const normalizedReply = validateWorkerReply(reply);
  const registry = validateWorkerRegistry(workerRegistry);
  const worker = registry.workers.find(
    (entry) => entry.pr === envelope.pr && entry.project === envelope.project && entry.workerRef === workerRef,
  );
  if (!worker) fail("REPLY_WORKER_MISMATCH");
  if (!matchesDispatch(normalizedReply, envelope)) fail("REPLY_DISPATCH_MISMATCH");
  if (!shaPattern.test(stringField(liveMainSha, "LIVE_PROTECTED_MAIN_SHA"))) fail("LIVE_PROTECTED_MAIN_SHA_INVALID");
  if (liveMainSha.toLowerCase() !== envelope.protectedMainSha) fail("REPLY_PROTECTED_MAIN_STALE");
  if (!isRecord(livePrState)) fail("REPLY_LIVE_PR_STATE_INVALID");
  const liveHead = livePrState.headRefOid ? shaField(livePrState.headRefOid, "REPLY_LIVE_HEAD") : null;
  if (normalizedReply.result === "READY") {
    const handoff = validateHandoff(normalizedReply.handoff);
    if (handoff.pr !== envelope.pr || handoff.project !== envelope.project || handoff.candidateSha !== normalizedReply.candidateSha)
      fail("REPLY_HANDOFF_MISMATCH");
    if (liveHead !== normalizedReply.candidateSha) fail("REPLY_LIVE_HEAD_STALE");
  }
  if (normalizedReply.result === "NO_CHANGE" && (normalizedReply.candidateSha !== envelope.expectedCandidateSha || liveHead !== normalizedReply.candidateSha))
    fail("REPLY_LIVE_HEAD_STALE");
  if (normalizedReply.result === "MERGED") {
    if (String(livePrState.state ?? "").toUpperCase() !== "MERGED" || livePrState.mergeCommit?.toLowerCase() !== normalizedReply.mergeSha)
      fail("REPLY_MERGE_UNVERIFIED");
  }
  if (normalizedReply.result === "BLOCKED" && normalizedReply.candidateSha !== envelope.expectedCandidateSha)
    fail("REPLY_CANDIDATE_MISMATCH");
  return normalizedReply;
}

export function materiallyAffected({ merged, candidate, mergedPaths = [] }) {
  const reasons = [];
  const changedPaths = mergedPaths.map(normalizePath);
  if (
    changedPaths.some((changedPath) =>
      candidate.paths.some((candidatePath) => pathsOverlap(changedPath, candidatePath)),
    )
  )
    reasons.push("PATH_OVERLAP");
  if (merged) {
    if (shared(merged.touches, candidate.touches).length) reasons.push("DOMAIN_OVERLAP");
    if (shared(merged.migrationFamilies, candidate.migrationFamilies).length) reasons.push("MIGRATION_FAMILY_OVERLAP");
    if (candidate.dependencies.includes(merged.pr)) reasons.push(`EXPLICIT_DEPENDENCY:PR#${merged.pr}`);
  }
  return [...new Set(reasons)].sort();
}

export function evaluateAfterMerge({
  handoffs,
  mergeSha,
  mergedPaths,
  mergedPr = null,
  mainSha = null,
  prStates = {},
}) {
  if (!shaPattern.test(stringField(mergeSha, "MERGE_SHA"))) fail("MERGE_SHA_INVALID");
  const effectivePrStates = { ...prStates };
  if (mergedPr !== null)
    effectivePrStates[normalizePr(mergedPr, "MERGED_PR")] = { state: "MERGED", mergeCommit: mergeSha };
  const byPr = new Map(handoffs.map((handoff) => [handoff.pr, handoff]));
  const merged =
    (mergedPr !== null ? byPr.get(mergedPr) : null) ??
    handoffs.find((handoff) => handoff.candidateSha === mergeSha.toLowerCase()) ??
    handoffs.find((handoff) => prStates?.[handoff.pr]?.mergeCommit?.toLowerCase() === mergeSha.toLowerCase()) ??
    null;
  const result = coordinate({
    handoffs,
    mainSha,
    prStates: effectivePrStates,
    changedPathsByPr: Object.fromEntries(handoffs.map((handoff) => [handoff.pr, mergedPaths])),
    currentnessReasonsByPr: Object.fromEntries(
      handoffs.map((handoff) => [handoff.pr, materiallyAffected({ merged, candidate: handoff, mergedPaths })]),
    ),
  });
  const affected = result.candidates
    .filter((candidate) => candidate.action === "RECONCILIATION_REQUIRED" || candidate.action === "WARM_RECONCILE")
    .map((candidate) => ({
      pr: candidate.pr,
      project: candidate.project,
      reasons: candidate.reasons.filter((reason) => reason !== "RECONCILIATION_REQUIRED"),
    }));
  const unaffected = result.candidates
    .filter((candidate) => candidate.state === "READY" && !affected.some((entry) => entry.pr === candidate.pr))
    .map((candidate) => ({ pr: candidate.pr, project: candidate.project, reason: "NO_RECONCILIATION_REQUIRED" }));
  return { ...result, mergeSha: mergeSha.toLowerCase(), mergedPr: merged?.pr ?? null, affected, unaffected };
}

function runGit(root, argumentsList) {
  return execFileSync("git", argumentsList, { cwd: root, encoding: "utf8" }).trim();
}

export function readCurrentMain(root) {
  return runGit(root, ["rev-parse", "origin/main"]);
}

export function readMergePaths(root, mergeSha) {
  return runGit(root, ["diff", "--name-only", `${mergeSha}^1`, mergeSha])
    .split(/\r?\n/gu)
    .filter(Boolean)
    .map(normalizePath);
}

export function readChangedPathsSinceBase(root, baseSha, mainSha) {
  return runGit(root, ["diff", "--name-only", baseSha, mainSha]).split(/\r?\n/gu).filter(Boolean).map(normalizePath);
}

export function readPrStates(root, handoffs) {
  const states = {};
  try {
    for (const handoff of handoffs) {
      const response = execFileSync(
        "gh",
        ["pr", "view", String(handoff.pr), "--json", "state,mergedAt,mergeCommit,headRefOid"],
        { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
      const parsed = JSON.parse(response);
      states[handoff.pr] = {
        state: parsed.state,
        mergedAt: parsed.mergedAt ?? null,
        mergeCommit: parsed.mergeCommit?.oid ?? null,
        headRefOid: parsed.headRefOid ?? null,
      };
    }
    return { available: true, states };
  } catch (error) {
    return { available: false, states: {}, error: error instanceof Error ? error.message : String(error) };
  }
}

export function handoffTemplate() {
  return {
    version: HANDOFF_VERSION,
    project: "Project Drydock Phase 4",
    pr: 198,
    candidateSha: "0123456789abcdef0123456789abcdef01234567",
    baseSha: "89abcdef0123456789abcdef0123456789abcdef",
    status: "READY",
    priorityLevel: 5,
    touches: ["drydock", "studio"],
    paths: ["src/drydock/", "src/components/studio/"],
    migrationFamilies: [],
    dependencies: [],
  };
}

function parseCli(argumentsList) {
  const positional = [];
  const options = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    const value = argumentsList[index];
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }
    const name = value.slice(2);
    if (name === "json") {
      options.json = true;
      continue;
    }
    const optionValue = argumentsList[index + 1];
    if (!optionValue || optionValue.startsWith("--")) fail(`OPTION_${name.toUpperCase()}_MISSING`);
    options[name] = optionValue;
    index += 1;
  }
  return { positional, options };
}

function reportHuman(result, prAvailable) {
  const lines = ["PARALLEL QUEUE", `protected main: ${result.protectedMain ?? "unavailable"}`];
  if (!prAvailable) lines.push("PR state: unavailable; use the ordinary Sounding Line path directly if needed.");
  lines.push("READY");
  if (result.readyOrder.length)
    result.readyOrder.forEach((candidate) =>
      lines.push(
        `${candidate.seat}. [P${candidate.priorityLevel}] ${candidate.project} — PR #${candidate.pr} — ${candidate.action.replace(/_/gu, " ")}`,
      ),
    );
  else lines.push("none");
  for (const state of STATES.filter((value) => value !== "READY")) {
    const candidates = result.candidates.filter((candidate) => candidate.state === state);
    if (!candidates.length) continue;
    lines.push(state);
    candidates.forEach((candidate) =>
      lines.push(
        `${candidate.project} — PR #${candidate.pr}${candidate.reasons.length ? ` (${candidate.reasons.join(", ")})` : ""}`,
      ),
    );
  }
  for (const candidate of result.unaffected ?? [])
    lines.push(`NO RECONCILIATION REQUIRED: ${candidate.project} — PR #${candidate.pr}`);
  for (const candidate of result.affected ?? [])
    lines.push(`RECONCILIATION REQUIRED: ${candidate.project} — PR #${candidate.pr} (${candidate.reasons.join(", ")})`);
  return `${lines.join("\n")}\n`;
}

async function main() {
  const { positional, options } = parseCli(process.argv.slice(2));
  const [command = "status", ...argumentsList] = positional;
  if (command === "handoff-template") {
    process.stdout.write(`${JSON.stringify(handoffTemplate(), null, 2)}\n`);
    return;
  }
  const root = path.resolve(options.workspace ?? process.cwd());
  const handoffDirectory = path.resolve(
    root,
    argumentsList[command === "evaluate-after-merge" ? 1 : 0] ?? ".coordinator/candidates",
  );
  const handoffs = await discoverHandoffs(handoffDirectory);
  const mainSha = options.main ?? readCurrentMain(root);
  const pr = readPrStates(root, handoffs);
  let result;
  if (command === "status" || command === "plan") {
    const finalizingPr = options["finalizing-pr"] ? Number(options["finalizing-pr"]) : null;
    const preliminary = coordinate({ handoffs, mainSha, prStates: pr.states, finalizingPr });
    const changedPathsByPr = Object.fromEntries(
      preliminary.readyOrder
        .filter((candidate) => candidate.seat <= 2)
        .map((candidate) => [candidate.pr, readChangedPathsSinceBase(root, candidate.baseSha, mainSha)]),
    );
    result = coordinate({ handoffs, mainSha, prStates: pr.states, changedPathsByPr, finalizingPr });
  } else if (command === "evaluate-after-merge") {
    const [mergeSha] = argumentsList;
    if (!mergeSha) fail("MERGE_SHA_MISSING");
    result = evaluateAfterMerge({
      handoffs,
      mergeSha,
      mergedPaths: readMergePaths(root, mergeSha),
      mergedPr: options["merged-pr"] ? Number(options["merged-pr"]) : null,
      mainSha,
      prStates: pr.states,
    });
  } else {
    fail("COMMAND_INVALID");
  }
  const output = { ...result, prStateAvailable: pr.available };
  process.stdout.write(options.json ? `${JSON.stringify(output, null, 2)}\n` : reportHuman(output, pr.available));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
