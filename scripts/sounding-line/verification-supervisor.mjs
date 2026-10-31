import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { bounded, processExit, spawnOwnedProcess, stopOwnedProcess } from "./owned-process.mjs";

// The parent stays asynchronous even when the verifier or one of its children
// blocks synchronously. Cleanup belongs to the OS process tree, not a port scan.
export async function superviseVerification({
  root,
  command,
  args,
  environment = process.env,
  identity,
  directory,
  executionMs,
  signal,
  tailMs = 120000,
  publish = writeFile,
}) {
  if (
    !Number.isSafeInteger(executionMs) ||
    executionMs < 1 ||
    executionMs > 120 * 60000 ||
    !Number.isSafeInteger(tailMs) ||
    tailMs < 1 ||
    tailMs > 120000
  )
    throw new Error("SOUNDING_LINE_VERIFICATION_BUDGET_INVALID");
  await mkdir(directory, { recursive: true });
  const began = performance.now();
  const cpuBegan = process.cpuUsage();
  const initial = { version: 1, identity, executionMs, tailMs, qualification: false };
  await publish(path.join(directory, "initial.json"), JSON.stringify(initial) + "\n", { flag: "wx" });
  let child,
    outcome = null,
    originalFailure = null,
    cleanup = null,
    cancellation,
    timer;
  const cancelled = new Promise((_, reject) => {
    cancellation = () => reject(new Error("SOUNDING_LINE_VERIFICATION_CANCELLED"));
    signal?.addEventListener("abort", cancellation, { once: true });
    if (signal?.aborted) cancellation();
  });
  cancelled.catch(() => {});
  try {
    if (signal?.aborted) throw new Error("SOUNDING_LINE_VERIFICATION_CANCELLED");
    const remaining = executionMs - (performance.now() - began);
    if (remaining <= 0) throw new Error("SOUNDING_LINE_VERIFICATION_ABSOLUTE_TIMEOUT");
    child = spawnOwnedProcess(command, args, {
      root,
      env: { ...environment, SOUNDING_LINE_COMMAND_DEADLINE_AT_MS: String(Date.now() + Math.floor(remaining)) },
      cleanupOptions: { gracefulMs: 1000, forceMs: 2000 },
    });
    outcome = await Promise.race([
      processExit(child),
      cancelled,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("SOUNDING_LINE_VERIFICATION_ABSOLUTE_TIMEOUT")), remaining);
      }),
    ]);
    if (outcome.code !== 0 || outcome.supervisionFailure) originalFailure = "SOUNDING_LINE_VERIFICATION_CHILD_FAILURE";
    if (performance.now() - began >= executionMs) originalFailure ??= "SOUNDING_LINE_VERIFICATION_ABSOLUTE_TIMEOUT";
  } catch (error) {
    originalFailure = ["SOUNDING_LINE_VERIFICATION_CANCELLED", "SOUNDING_LINE_VERIFICATION_ABSOLUTE_TIMEOUT"].includes(
      error?.message,
    )
      ? error.message
      : "SOUNDING_LINE_VERIFICATION_EXECUTION_UNKNOWN";
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancellation);
    try {
      cleanup = child
        ? await bounded(
            () => stopOwnedProcess(child),
            Math.min(tailMs, 15000),
            "SOUNDING_LINE_VERIFICATION_CLEANUP_TIMEOUT",
          )
        : { status: "NOT_STARTED", treeReaped: true, streamsClosed: true };
    } catch {
      cleanup = { status: "FAIL", treeReaped: false, streamsClosed: false };
    }
  }
  const cleanupPassed = ["PASS", "NOT_STARTED"].includes(cleanup.status) && cleanup.treeReaped && cleanup.streamsClosed;
  const parentCpu = process.cpuUsage(cpuBegan);
  const parentPeak = process.resourceUsage().maxRSS;
  const receipt = {
    ...initial,
    status: originalFailure || !cleanupPassed ? "FAIL" : "PASS",
    originalFailure,
    cleanupFailure: cleanupPassed ? null : "SOUNDING_LINE_VERIFICATION_CLEANUP_FAILURE",
    child: outcome,
    cleanup,
    elapsedMs: Math.round(performance.now() - began),
    metrics: {
      ownedSubprocesses: child ? 1 : 0,
      totalSubprocesses: null,
      preflightGitSubprocesses: identity?.gitSubprocesses ?? null,
      knownApiCalls: identity?.jobLookupCalls ?? null,
      totalApiCalls: null,
      preflightSourceBytes: identity?.sourceInputBytes ?? null,
      transferredBytes: null,
      parentProcessCpuMs: (parentCpu.user + parentCpu.system) / 1000,
      parentProcessPeakMemoryBytes: parentPeak > 0 ? parentPeak * 1024 : null,
      childCpuMs: null,
      childPeakMemoryBytes: null,
      freshWork: null,
      reusedWork: null,
    },
    retryCount: 0,
  };
  // A failed publication rejects the step. It never overwrites the child's
  // decision or turns an original failure into a successful supervision receipt.
  try {
    await publish(path.join(directory, "terminal.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
  } catch (cause) {
    // Retain the original outcome even if the primary filesystem cannot accept
    // its receipt. The fixed-shape fallback survives in immutable Actions logs.
    const fallback = {
      namespace: "SOUNDING_LINE_VERIFICATION_RETENTION_FAILURE",
      originalFailure,
      cleanupFailure: receipt.cleanupFailure,
      childExitCode: outcome?.code ?? null,
      qualification: false,
    };
    process.stderr.write(JSON.stringify(fallback) + "\n");
    const error = new Error("SOUNDING_LINE_VERIFICATION_RETENTION_FAILURE", { cause });
    error.supervisionReceipt = receipt;
    throw error;
  }
  return receipt;
}
