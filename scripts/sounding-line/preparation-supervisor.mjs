import { randomUUID } from "node:crypto";
import { lstat, mkdir, mkdtemp, open, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { bounded, processExit, spawnOwnedProcess, stopOwnedProcess } from "./owned-process.mjs";
import {
  PREPARATION_CHANNEL,
  PREPARATION_DIRECTORY,
  PREPARATION_EVENT_BYTES,
  PREPARATION_JOB_MS,
  PREPARATION_MAX_EVENTS,
  PREPARATION_PHASE_ORDER,
  PREPARATION_PHASES,
  PREPARATION_TAIL_MS,
  preparationEventName,
  validPreparationBinding,
} from "./preparation-phases.mjs";

const digest = /^[a-f0-9]{64}$/u;
const bindingKeys = ["version", "repository", "base", "candidate", "runId", "attempt", "nonce"];
const digestKeys = ["sourceDigest", "contractDigest", "planDigest"];
const eventKeys = [...bindingKeys, ...digestKeys, "sequence", "phase", "profile", "step"].sort();
const code = (value) => Object.assign(new Error("SOUNDING_LINE_PREPARATION_" + value), { preparationCode: value });
const publicReasons = new Set([
  "PHASE_INVALID",
  "PHASE_CHANNEL_IO",
  "PHASE_TIMEOUT",
  "ABSOLUTE_TIMEOUT",
  "CANCELLED",
  "PUBLISH_FAILURE",
  "CHILD_FAILURE",
  "INCOMPLETE",
  "CLEANUP_FAILURE",
  "OBSERVER_INCOMPLETE",
]);

export async function createPreparationSession({ authorityRoot, binding }) {
  binding = {
    version: 1,
    repository: binding.repository,
    base: binding.base,
    candidate: binding.candidate,
    runId: binding.runId,
    attempt: binding.attempt,
    nonce: randomUUID(),
  };
  if (!validPreparationBinding(binding)) throw code("PHASE_INVALID");
  const root = await realpath(authorityRoot);
  const parent = path.join(root, PREPARATION_DIRECTORY);
  await mkdir(parent, { recursive: true });
  if ((await realpath(parent)) !== parent) throw code("PHASE_INVALID");
  const directory = await mkdtemp(path.join(parent, "session-"));
  const transport = path.join(directory, "transport");
  const publicDirectory = path.join(directory, "public");
  await mkdir(transport);
  await mkdir(publicDirectory);
  await writeFile(
    path.join(transport, "state.json"),
    JSON.stringify({
      binding,
      sequence: 0,
      digests: { sourceDigest: null, contractDigest: null, planDigest: null },
    }) + "\n",
    { flag: "wx" },
  );
  return { binding, directory, transport, publicDirectory };
}

export function createPreparationEventValidator(binding) {
  let next = 1,
    profile = 0,
    rank = -1,
    lastStep = 0,
    tail = false,
    digests = null;
  const seen = new Set();
  return (event) => {
    const invalid = () => {
      throw code("PHASE_INVALID");
    };
    if (!event || Object.keys(event).sort().join() !== eventKeys.join()) invalid();
    if (
      bindingKeys.some((key) => event[key] !== binding[key]) ||
      event.sequence !== next ||
      next > PREPARATION_MAX_EVENTS ||
      !Object.hasOwn(PREPARATION_PHASES, event.phase)
    )
      invalid();
    if (
      !Number.isInteger(event.profile) ||
      event.profile < 0 ||
      event.profile > 64 ||
      !Number.isInteger(event.step) ||
      event.step < 0 ||
      event.step > 16
    )
      invalid();
    const currentRank = PREPARATION_PHASE_ORDER.indexOf(event.phase);
    const key = event.profile + ":" + event.phase + ":" + event.step;
    if (seen.has(key) || (event.phase !== "FIXTURE_PREPARER" && event.step !== 0)) invalid();
    if (
      event.phase === "FIXTURE_PREPARER" &&
      (event.step < 1 || (event.profile === profile && currentRank === rank && event.step <= lastStep))
    )
      invalid();
    if (currentRank >= 3 && currentRank <= 12) {
      if (tail || event.profile < 1 || event.profile < profile || event.profile > profile + 1) invalid();
      if (event.profile === profile + 1) {
        if (event.phase !== "FIXTURE_PRISMA") invalid();
      } else if (currentRank < rank || (currentRank === rank && event.phase !== "FIXTURE_PREPARER")) invalid();
    } else {
      if (event.profile !== 0 || currentRank < rank || (currentRank < 3 && profile > 0)) invalid();
    }
    if (currentRank >= 2 && digestKeys.some((key) => !digest.test(event[key] ?? ""))) invalid();
    if (currentRank < 2 && digestKeys.some((key) => event[key] !== null)) invalid();
    if (digests && digestKeys.some((key) => event[key] !== digests[key])) invalid();
    if (!digests && currentRank >= 2) digests = Object.fromEntries(digestKeys.map((key) => [key, event[key]]));
    if (currentRank >= 3 && currentRank <= 12) profile = event.profile;
    if (currentRank >= 13) tail = true;
    rank = currentRank;
    lastStep = event.step;
    seen.add(key);
    next++;
    return event;
  };
}

export async function readPreparationEvent(session, sequence, { openFile = open, lstatFile = lstat } = {}) {
  const file = path.join(session.transport, preparationEventName(sequence));
  let metadata;
  try {
    metadata = await lstatFile(file);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw code("PHASE_CHANNEL_IO");
  }
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > PREPARATION_EVENT_BYTES)
    throw code("PHASE_INVALID");
  let handle;
  const sameFile = (a, b) =>
    a.dev === b.dev &&
    a.ino === b.ino &&
    a.size === b.size &&
    a.mtimeMs === b.mtimeMs &&
    a.ctimeMs === b.ctimeMs &&
    b.isFile() &&
    !b.isSymbolicLink();
  try {
    handle = await openFile(file, "r");
    const before = await handle.stat();
    if (!sameFile(metadata, before)) throw code("PHASE_INVALID");
    // One extra byte detects growth without ever allocating from file size.
    const bytes = Buffer.alloc(PREPARATION_EVENT_BYTES + 1);
    const result = await handle.read(bytes, 0, bytes.length, 0);
    const after = await handle.stat();
    const pathname = await lstatFile(file);
    if (
      result.bytesRead > PREPARATION_EVENT_BYTES ||
      result.bytesRead !== before.size ||
      !sameFile(before, after) ||
      !sameFile(after, pathname)
    )
      throw code("PHASE_INVALID");
    return JSON.parse(bytes.subarray(0, result.bytesRead).toString("utf8"));
  } catch {
    throw code("PHASE_INVALID");
  } finally {
    await handle?.close();
  }
}

const publicInteger = (value) => (Number.isSafeInteger(value) ? value : null);
const publicSignal = (value) => (["SIGTERM", "SIGINT", "SIGKILL", "SIGHUP", "SIGPIPE"].includes(value) ? value : null);
function publicChild(value) {
  return value
    ? {
        code: publicInteger(value.code),
        signal: publicSignal(value.signal),
        guardianExitCode: publicInteger(value.guardianExitCode),
        supervisionFailure: value.supervisionFailure === true,
      }
    : null;
}
function publicCleanup(value) {
  return {
    status: ["PASS", "FAIL", "NOT_STARTED"].includes(value?.status) ? value.status : "FAIL",
    treeReaped: value?.treeReaped === true,
    streamsClosed: value?.streamsClosed === true,
    directExitObserved: value?.directExitObserved === true,
    escalated: value?.escalated === true,
    exitCode: publicInteger(value?.exitCode),
    payloadExitCode: publicInteger(value?.payloadExitCode),
    signal: publicSignal(value?.signal),
    elapsedMs: publicInteger(value?.elapsedMs),
    ownership: ["WINDOWS_JOB_OBJECT", "LINUX_SUBREAPER_AND_PIDFD", "INJECTED"].includes(value?.ownership)
      ? value.ownership
      : null,
  };
}

export async function supervisePreparation({
  session,
  command,
  args,
  root,
  environment,
  publish,
  signal,
  absoluteMs = PREPARATION_JOB_MS - PREPARATION_TAIL_MS,
  phaseLimits = PREPARATION_PHASES,
  pollMs = 100,
  launch = spawnOwnedProcess,
  stop = stopOwnedProcess,
  now = () => performance.now(),
  writeCheckpoint = writeFile,
}) {
  if (
    !validPreparationBinding(session.binding) ||
    typeof publish !== "function" ||
    !Number.isFinite(absoluteMs) ||
    absoluteMs <= 0 ||
    absoluteMs > PREPARATION_JOB_MS - PREPARATION_TAIL_MS ||
    !Number.isFinite(pollMs) ||
    pollMs < 5 ||
    pollMs > 1000 ||
    Object.keys(PREPARATION_PHASES).some(
      (key) =>
        !Number.isFinite(phaseLimits[key]) || phaseLimits[key] <= 0 || phaseLimits[key] > PREPARATION_PHASES[key],
    )
  )
    throw code("PHASE_INVALID");
  const started = now();
  const elapsed = () => Math.round(now() - started);
  const cancellation = new AbortController();
  const cancel = () => cancellation.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  let child,
    childResult,
    cleanup,
    reason = null,
    sequence = 0,
    phase = "CONTROLLER_START";
  let stopped = false,
    observerClosed = false,
    observer,
    watchdog;
  let phaseDeadline = started + phaseLimits.ADMISSION;
  const executionBoundary = () => {
    if (signal?.aborted) throw code("CANCELLED");
    if (now() - started >= absoluteMs) throw code("ABSOLUTE_TIMEOUT");
    if (now() >= phaseDeadline) throw code("PHASE_TIMEOUT");
  };
  let boundDigests = { sourceDigest: null, contractDigest: null, planDigest: null };
  const validate = createPreparationEventValidator(session.binding);
  const checkpoint = async (record, name) => {
    const content = JSON.stringify(record) + "\n";
    if (Buffer.byteLength(content) > PREPARATION_EVENT_BYTES) throw code("PHASE_INVALID");
    await writeCheckpoint(path.join(session.publicDirectory, name), content, { flag: "wx" });
  };
  const publishRecord = async (record, terminal = false) => {
    try {
      await bounded(
        () => publish(record, terminal ? undefined : cancellation.signal),
        5000,
        "SOUNDING_LINE_PREPARATION_PUBLISH_DEADLINE",
      );
    } catch {
      throw code("PUBLISH_FAILURE");
    }
  };
  const initial = {
    version: 1,
    binding: session.binding,
    sequence,
    phase,
    profile: 0,
    step: 0,
    elapsedMs: elapsed(),
    ...boundDigests,
    child: "NOT_STARTED",
    qualification: false,
  };
  try {
    await checkpoint(initial, "000000.json");
    await publishRecord(initial);
    executionBoundary();
    cancellation.signal.throwIfAborted();
    child = launch(command, args, {
      root,
      env: { ...environment, [PREPARATION_CHANNEL]: session.transport },
    });
    const exited = processExit(child).then((value) => {
      childResult = value;
    });
    exited.catch(() => {});
    observer = (async () => {
      while (!stopped) {
        executionBoundary();
        const event = sequence < PREPARATION_MAX_EVENTS ? await readPreparationEvent(session, sequence + 1) : null;
        if (stopped) return;
        executionBoundary();
        if (event) {
          validate(event);
          sequence = event.sequence;
          phase = event.phase;
          boundDigests = Object.fromEntries(digestKeys.map((key) => [key, event[key]]));
          phaseDeadline = now() + phaseLimits[phase];
          const record = {
            version: 1,
            binding: session.binding,
            sequence,
            phase,
            profile: event.profile,
            step: event.step,
            elapsedMs: elapsed(),
            ...boundDigests,
            child: childResult ? "EXITED" : "RUNNING",
            qualification: false,
          };
          await checkpoint(record, String(sequence).padStart(6, "0") + ".json");
          if (stopped) return;
          await publishRecord(record);
          executionBoundary();
        } else {
          if (childResult) return;
          await pause(pollMs, undefined, { signal: cancellation.signal });
        }
      }
    })();
    watchdog = (async () => {
      while (!stopped) {
        executionBoundary();
        await pause(25);
      }
    })();
    await Promise.race([observer, watchdog]);
    executionBoundary();
    if (childResult?.code !== 0 || childResult?.supervisionFailure) reason = "CHILD_FAILURE";
    else if (phase !== "COMPLETE") reason = "INCOMPLETE";
  } catch (error) {
    reason = cancellation.signal.aborted
      ? "CANCELLED"
      : publicReasons.has(error.preparationCode)
        ? error.preparationCode
        : "CONTROLLER_FAILURE";
  } finally {
    stopped = true;
    cancellation.abort();
    try {
      cleanup = await stop(child);
    } catch {
      cleanup = { status: "FAIL", treeReaped: false, streamsClosed: false };
    }
    try {
      if (observer) await bounded(() => observer.catch(() => {}), 5500, "PREPARATION_OBSERVER_STOP");
      observerClosed = true;
    } catch {
      reason ??= "OBSERVER_INCOMPLETE";
    }
    await watchdog?.catch(() => {});
    if (!["PASS", "NOT_STARTED"].includes(cleanup.status) || !cleanup.treeReaped || !cleanup.streamsClosed)
      reason ??= "CLEANUP_FAILURE";
  }
  const finalBoundary = () => {
    try {
      executionBoundary();
    } catch (error) {
      reason ??= error.preparationCode;
    }
  };
  finalBoundary();
  const receipt = {
    version: 1,
    binding: session.binding,
    sequence,
    phase,
    elapsedMs: elapsed(),
    ...boundDigests,
    status: reason === null ? "PASS" : "FAIL",
    reason,
    child: publicChild(childResult),
    cleanup: publicCleanup(cleanup),
    observerClosed,
    publication: "PENDING",
    qualification: false,
  };
  const finalizeBoundary = () => {
    finalBoundary();
    if (reason !== null) {
      receipt.status = "FAIL";
      receipt.reason = reason;
    }
  };
  const publishTerminal = async () => {
    try {
      await publishRecord(receipt, true);
      receipt.publication = "PASS";
    } catch {
      receipt.publication = "FAIL";
      receipt.status = "FAIL";
      receipt.reason ??= "PUBLISH_FAILURE";
    }
  };
  try {
    await publishTerminal();
    const publishedStatus = receipt.status;
    finalizeBoundary();
    // A cancellation/deadline during final publication needs a distinct failure
    // status, never a retry or erasure of the original provider observation.
    if (publishedStatus === "PASS" && receipt.status === "FAIL") await publishTerminal();
    receipt.elapsedMs = elapsed();
    await checkpoint(receipt, "terminal.json");
    const retainedStatus = receipt.status;
    finalizeBoundary();
    if (retainedStatus === "PASS" && receipt.status === "FAIL") {
      await publishTerminal();
      receipt.elapsedMs = elapsed();
      await checkpoint(receipt, "terminal-correction.json");
    }
    return receipt;
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
}

export function preparationProgressContext(binding) {
  if (!validPreparationBinding(binding)) throw code("PUBLISH_FAILURE");
  return "Sounding Line / Preparation progress (" + binding.runId + "." + binding.attempt + "." + binding.nonce + ")";
}
export function createPreparationStatusPublisher({ binding, token, request = fetch }) {
  if (!validPreparationBinding(binding) || typeof token !== "string" || !token) throw code("PUBLISH_FAILURE");
  const context = preparationProgressContext(binding);
  return async (record, signal) => {
    if (
      !record ||
      bindingKeys.some((key) => record.binding?.[key] !== binding[key]) ||
      !Number.isInteger(record.sequence) ||
      record.sequence < 0 ||
      record.sequence > PREPARATION_MAX_EVENTS ||
      (record.phase !== "CONTROLLER_START" && !Object.hasOwn(PREPARATION_PHASES, record.phase)) ||
      (Object.hasOwn(record, "status") && !["PASS", "FAIL"].includes(record.status))
    )
      throw code("PUBLISH_FAILURE");
    const terminal = Object.hasOwn(record, "status");
    const response = await request(
      "https://api.github.com/repos/" + binding.repository + "/statuses/" + binding.candidate,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          state: terminal ? (record.status === "PASS" ? "success" : "failure") : "pending",
          context,
          description: terminal
            ? "Controller " + record.status + "; progress only, no qualification"
            : String(record.sequence) + " " + record.phase + "; preparation progress",
          target_url: "https://github.com/" + binding.repository + "/actions/runs/" + binding.runId,
        }),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000),
      },
    );
    if (response.status !== 201) {
      await response.body?.cancel();
      throw code("PUBLISH_FAILURE");
    }
    await response.body?.cancel();
  };
}
