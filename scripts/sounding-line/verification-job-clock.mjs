import { readFileSync, readlinkSync, statfsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { performance } from "node:perf_hooks";

const fail = () => {
  throw Error("SOUNDING_LINE_VERIFICATION_NATIVE_CLOCK_UNAVAILABLE");
};
const need = (value) => {
  if (!value) fail();
};
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const runner = /^\/home\/runner\/actions-runner\/cached\/(\d+\.\d+\.\d+)\/bin\/Runner\.(Worker|Listener)$/u;
function statIdentity(raw, pid) {
  need(typeof raw === "string" && Buffer.byteLength(raw) <= 8192);
  const end = raw.lastIndexOf(") ");
  need(end > 0 && Number(raw.slice(0, raw.indexOf(" "))) === pid);
  const fields = raw
    .slice(end + 2)
    .trim()
    .split(/\s+/u);
  const parentPid = Number(fields[1]),
    startTicks = Number(fields[19]);
  need(fields.length >= 20 && !["Z", "X", "x"].includes(fields[0]) && integer(parentPid) && integer(startTicks));
  return { pid, parentPid, startTicks };
}
function uptime(raw) {
  need(typeof raw === "string" && /^\d+\.\d+ \d+(?:\.\d+)?\s*$/u.test(raw) && raw.length <= 256);
  const first = raw.split(" ")[0],
    seconds = Number(first),
    decimals = first.split(".")[1].length;
  need(Number.isFinite(seconds) && seconds >= 0 && decimals >= 1 && decimals <= 9);
  return { seconds, quantumMs: 1000 / 10 ** decimals };
}

// Queue time is separate from runner execution. The Listener receives the job
// before spawning its Worker: actions/runner d1eb12d4b115c301201de27d667284e1a80f2ab5,
// src/Runner.Listener/JobDispatcher.cs. Inference: its age conservatively bounds
// this hosted job's runner execution. Unknown runner forms fail closed; an older
// Listener only spends more budget. No provider wall timestamp is corrected.
// IO callbacks are in-process fixture seams, never CLI or serialized arguments.
export function readNativeVerificationClock({
  platform = process.platform,
  pid = process.pid,
  read = (file) => readFileSync(file, "utf8"),
  link = (file) => readlinkSync(file),
  filesystem = () => statfsSync("/proc").type,
  ticks = () =>
    Number(
      execFileSync("/usr/bin/getconf", ["CLK_TCK"], {
        cwd: "/",
        encoding: "utf8",
        timeout: 1000,
        maxBuffer: 128,
        env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
        stdio: ["ignore", "pipe", "ignore"],
      }).trim(),
    ),
} = {}) {
  try {
    need(platform === "linux" && Number(filesystem()) === 0x9fa0 && integer(pid) && pid > 1);
    const began = performance.now(),
      clockTicksPerSecond = ticks();
    need(integer(clockTicksPerSecond) && clockTicksPerSecond > 0 && clockTicksPerSecond <= 1000000);
    const uptimeBefore = read("/proc/uptime"),
      before = uptime(uptimeBefore),
      chain = [],
      seen = new Set();
    let current = pid,
      worker,
      listener;
    for (let depth = 0; depth < 32; depth++) {
      need(current > 1 && !seen.has(current));
      seen.add(current);
      const raw = read(`/proc/${current}/stat`),
        identity = statIdentity(raw, current),
        executable = link(`/proc/${current}/exe`);
      need(typeof executable === "string" && executable.length <= 1024 && path.posix.isAbsolute(executable));
      const entry = { ...identity, executable, originalStat: raw };
      if (chain.length) need(entry.startTicks <= chain.at(-1).startTicks);
      chain.push(entry);
      const match = runner.exec(executable);
      if (match?.[2] === "Worker") {
        need(!worker && !listener);
        worker = entry;
      }
      if (match?.[2] === "Listener") {
        need(worker && path.posix.dirname(worker.executable) === path.posix.dirname(executable));
        listener = entry;
        break;
      }
      current = identity.parentPid;
    }
    need(worker && listener && listener.startTicks <= worker.startTicks);
    // Re-read every edge and executable, not just a PID/name, against reuse or
    // reparenting. Mutable CPU counters may change without changing identity.
    for (const entry of chain) {
      const verifiedStat = read(`/proc/${entry.pid}/stat`),
        verified = statIdentity(verifiedStat, entry.pid);
      need(
        verified.parentPid === entry.parentPid &&
          verified.startTicks === entry.startTicks &&
          link(`/proc/${entry.pid}/exe`) === entry.executable,
      );
      entry.verifiedStat = verifiedStat;
    }
    const uptimeAfter = read("/proc/uptime"),
      after = uptime(uptimeAfter);
    need(
      after.seconds >= before.seconds &&
        pid === chain[0].pid &&
        chain[0].startTicks / clockTicksPerSecond <= after.seconds,
    );
    const elapsed = after.seconds * 1000 - (listener.startTicks * 1000) / clockTicksPerSecond;
    need(Number.isFinite(elapsed) && elapsed >= 0);
    // Both margins debit time: one kernel tick and the observed uptime precision.
    const roundingDebitMs = Math.ceil(1000 / clockTicksPerSecond + Math.max(before.quantumMs, after.quantumMs));
    const setupMs = Math.ceil(elapsed) + roundingDebitMs;
    need(integer(setupMs));
    return {
      kind: "ANCESTRAL_HOSTED_LISTENER_EXECUTION_UPPER_BOUND",
      originPid: pid,
      workerPid: worker.pid,
      listenerPid: listener.pid,
      clockTicksPerSecond,
      uptimeBefore,
      uptimeAfter,
      roundingDebitMs,
      setupMs,
      captureElapsedMs: Math.ceil(performance.now() - began),
      chain,
      qualification: false,
    };
  } catch {
    fail();
  }
}
