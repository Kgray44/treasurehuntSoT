/* Creation-bound process ownership. Never discover ownership by port or executable. */
import { spawn } from "node:child_process";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const observations = new WeakMap();
const ownership = new WeakMap();
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function observeProcess(child) {
  if (observations.has(child)) return observations.get(child);
  const state = { exited: false, closed: false, error: false, code: null, signal: null };
  state.exit = new Promise((resolve) => {
    const finish = (code, signal) => {
      state.exited = true;
      state.code = code;
      state.signal = signal;
      resolve({ code, signal });
    };
    child.once("exit", finish);
    child.once("error", () => {
      state.error = true;
      finish(null, null);
    });
    // Check after subscribing: works for an already exited child and an exit
    // between the state check and listener registration.
    if (child.exitCode !== null || child.signalCode !== null) finish(child.exitCode, child.signalCode);
  });
  child.once("close", () => {
    state.closed = true;
  });
  if (child.stdout?.closed && child.stderr?.closed && state.exited) state.closed = true;
  observations.set(child, state);
  return state;
}

export async function processExit(child) {
  const observed = await observeProcess(child).exit;
  const record = ownership.get(child);
  if (!record) return observed;
  try {
    await record.initialized;
    record.guardianReceipt ??= JSON.parse(await readFile(record.receiptPath, "utf8"));
    const payload = record.guardianReceipt.payloadExitCode;
    return {
      code: Number.isInteger(payload) ? payload : observed.code,
      signal: observed.signal,
      guardianExitCode: observed.code,
    };
  } catch {
    return { ...observed, supervisionFailure: true };
  }
}

export async function bounded(operation, milliseconds, code) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(code)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function spawnOwnedProcess(command, args, { root, env, cleanupOptions = {} }) {
  const windows = process.platform === "win32";
  const finiteBudget = (value, fallback) => (Number.isFinite(value) ? Math.max(0, Math.min(value, 5000)) : fallback);
  const gracefulMs = finiteBudget(cleanupOptions.gracefulMs, 2000);
  const forceMs = finiteBudget(cleanupOptions.forceMs, 3000);
  // On Windows the guardian creates the payload suspended, assigns a kill-on-
  // close Job Object, then resumes it. No descendant can escape through the
  // spawn-to-assignment race, including when the guardian's parent disappears.
  const child = spawn(
    windows ? "powershell.exe" : "python3",
    windows
      ? [
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          fileURLToPath(new URL("./owned-process-windows.ps1", import.meta.url)),
        ]
      : [fileURLToPath(new URL("./owned-process-linux.py", import.meta.url))],
    {
      cwd: root,
      env,
      detached: !windows,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  observeProcess(child);
  child.stdin.on("error", () => {});
  child.stdout.pipe(process.stdout, { end: false });
  child.stderr.pipe(process.stderr, { end: false });
  const record = { windows, receiptDirectory: null, gracefulMs, forceMs };
  ownership.set(child, record);
  // Record before readiness or any other asynchronous wait.
  record.initialized = (async () => {
    record.receiptDirectory = await mkdtemp(path.join(tmpdir(), "sounding-line-job-"));
    record.receiptPath = path.join(record.receiptDirectory, "cleanup.json");
    child.stdin.write(`${JSON.stringify({ command, args, receiptPath: record.receiptPath, gracefulMs, forceMs })}\n`);
  })();
  // A startup error is consumed by both the observer and cleanup.
  record.initialized.catch(() => {});
  return child;
}

export async function stopOwnedProcess(child, { gracefulMs = 2000, forceMs = 3000 } = {}) {
  if (!child) return { status: "NOT_STARTED", treeReaped: true, streamsClosed: true };
  const started = performance.now();
  const state = observeProcess(child);
  const record = ownership.get(child);
  if (record?.finalReceipt) return record.finalReceipt;
  if (record) {
    gracefulMs = record.gracefulMs;
    forceMs = record.forceMs;
  }
  let escalated = false;
  let treeReaped = false;
  let verificationFailed = false;
  try {
    await bounded(
      async () => {
        if (!record) {
          // Dependency-injected children used by legacy contract tests have no
          // OS ownership. Real launches always use spawnOwnedProcess.
          if (!state.exited) child.kill();
          await state.exit;
          treeReaped = !Number.isInteger(child.pid);
          return;
        }
        await record.initialized;
        child.stdin.end("stop\n");
        await state.exit;
        const receipt = record.guardianReceipt ?? JSON.parse(await readFile(record.receiptPath, "utf8"));
        record.guardianReceipt = receipt;
        treeReaped = receipt.treeReaped === true && receipt.verificationFailed !== true;
        escalated = receipt.terminated === true;
      },
      gracefulMs + forceMs + 2000,
      "SOUNDING_LINE_CLEANUP_DEADLINE",
    );
  } catch {
    verificationFailed = true;
    // Windows Job Object kills all members when its guardian handle closes.
    if (record && !state.exited) child.kill();
  }
  if (record) {
    const streamEnd = performance.now() + 1000;
    while (!state.closed && performance.now() < streamEnd) await pause(10);
  }
  const streamsClosed = !record || state.closed;
  // On failure sever task-owned pipes so the caller can publish a terminal
  // failure. This is never counted as successful stream/tree verification.
  if (!streamsClosed) {
    child.stdout?.destroy();
    child.stderr?.destroy();
    child.unref?.();
  }
  if (record?.receiptDirectory)
    await bounded(
      () => rm(record.receiptDirectory, { recursive: true, force: true }),
      500,
      "SOUNDING_LINE_CLEANUP_DIRECTORY_DEADLINE",
    ).catch(() => {
      verificationFailed = true;
    });
  const receipt = {
    status: !verificationFailed && treeReaped && streamsClosed ? "PASS" : "FAIL",
    directExitObserved: state.exited,
    exitCode: state.code,
    signal: state.signal,
    treeReaped,
    streamsClosed,
    escalated,
    ...(record?.guardianReceipt ? { payloadExitCode: record.guardianReceipt.payloadExitCode } : {}),
    elapsedMs: Math.round(performance.now() - started),
    ownership: record ? (record.windows ? "WINDOWS_JOB_OBJECT" : "LINUX_SUBREAPER_AND_PIDFD") : "INJECTED",
  };
  if (record && receipt.status === "PASS") record.finalReceipt = receipt;
  return receipt;
}
