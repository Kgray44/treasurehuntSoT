import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { readNativeVerificationClock } from "../../scripts/sounding-line/verification-job-clock.mjs";
import { currentVerificationJob } from "../../scripts/sounding-line/ordinary-supervised.mjs";
import { verificationBudgetFromElapsed } from "../../scripts/sounding-line/verification-budget.mjs";

function fixture(change = () => {}) {
  const processes = new Map([
    [400, { parent: 300, start: 9000, exe: "/usr/bin/node" }],
    [300, { parent: 200, start: 8800, exe: "/usr/bin/bash" }],
    [200, { parent: 100, start: 8000, exe: "/home/runner/actions-runner/cached/2.338.2/bin/Runner.Worker" }],
    [100, { parent: 1, start: 1000, exe: "/home/runner/actions-runner/cached/2.338.2/bin/Runner.Listener" }],
  ]);
  const state = {
    processes,
    uptimes: ["100.00 1.00\n", "100.01 1.00\n"],
    filesystem: 0x9fa0,
    ticks: 100,
    reads: new Map(),
  };
  change(state);
  return {
    state,
    input: {
      platform: "linux",
      pid: 400,
      filesystem: () => state.filesystem,
      ticks: () => state.ticks,
      read: (file) => {
        if (file === "/proc/uptime") return state.uptimes.shift();
        const pid = Number(/^\/proc\/(\d+)\/stat$/u.exec(file)?.[1]),
          entry = processes.get(pid);
        if (!entry) throw Error("ENOENT");
        const count = (state.reads.get(pid) ?? 0) + 1;
        state.reads.set(pid, count);
        state.onRead?.(pid, count, entry);
        const fields = Array(50).fill("0");
        fields[0] = "S";
        fields[1] = String(entry.parent);
        fields[19] = String(entry.start);
        return `${pid} (fixture) ${fields.join(" ")}\n`;
      },
      link: (file) => {
        const pid = Number(/^\/proc\/(\d+)\/exe$/u.exec(file)?.[1]);
        const entry = processes.get(pid);
        if (!entry) throw Error("ENOENT");
        return entry.exe;
      },
    },
  };
}
test("Listener age debits all pre-worker execution and conservative clock precision", () => {
  const { input } = fixture(),
    clock = readNativeVerificationClock(input);
  assert.equal(clock.setupMs, 90030);
  assert.equal(clock.roundingDebitMs, 20);
  assert.equal(clock.listenerPid, 100);
  assert.equal(clock.workerPid, 200);
  assert(clock.chain.every((entry) => entry.originalStat === entry.verifiedStat));
  assert.equal(clock.qualification, false);
  const younger = fixture((state) => {
    state.processes.get(200).start = 8799;
  });
  assert.equal(readNativeVerificationClock(younger.input).setupMs, clock.setupMs, "a younger Worker cannot buy budget");
});
for (const [name, change] of [
  [
    "fake proc filesystem",
    (state) => {
      state.filesystem = 0;
    },
  ],
  [
    "invalid kernel ticks",
    (state) => {
      state.ticks = 0;
    },
  ],
  [
    "regressed uptime",
    (state) => {
      state.uptimes[1] = "99.99 1.00\n";
    },
  ],
  [
    "non-ancestor Worker",
    (state) => {
      state.processes.get(300).parent = 100;
    },
  ],
  [
    "unrecognized executable",
    (state) => {
      state.processes.get(200).exe = "/tmp/Runner.Worker";
    },
  ],
  [
    "different runner installation",
    (state) => {
      state.processes.get(100).exe = "/home/runner/actions-runner/cached/2.339.0/bin/Runner.Listener";
    },
  ],
  [
    "younger Listener",
    (state) => {
      state.processes.get(100).start = 8100;
    },
  ],
  [
    "PID reuse",
    (state) => {
      state.onRead = (pid, count, entry) => {
        if (pid === 200 && count === 2) entry.start++;
      };
    },
  ],
  [
    "reparented process",
    (state) => {
      state.onRead = (pid, count, entry) => {
        if (pid === 300 && count === 2) entry.parent = 100;
      };
    },
  ],
  [
    "missing process record",
    (state) => {
      state.processes.delete(100);
    },
  ],
  [
    "cyclic ancestry",
    (state) => {
      state.processes.get(300).parent = 400;
    },
  ],
])
  test(`native clock fails closed for ${name}`, () => {
    const { input } = fixture(change);
    assert.throws(() => readNativeVerificationClock(input), /NATIVE_CLOCK_UNAVAILABLE/u);
  });
test("no native age can extend an exhausted fixed execution budget or remove its cleanup tail", () => {
  assert.throws(() => verificationBudgetFromElapsed({ setupMs: 45 * 60000 - 120000 }), /JOB_BUDGET_EXHAUSTED/u);
  assert.throws(() => verificationBudgetFromElapsed({ setupMs: -1 }), /JOB_BINDING_INVALID/u);
  const budget = verificationBudgetFromElapsed({ setupMs: 90030 });
  assert.equal(budget.limitMs, 45 * 60000);
  assert.equal(budget.tailMs, 120000);
  assert.equal(budget.setupMs + budget.executionMs + budget.tailMs, budget.limitMs);
});

test("retained native proc wire format is readable without mistaking replay for live clock authority", () => {
  const recorded = JSON.parse(readFileSync(new URL("./fixtures/native-clock-41290027284.json", import.meta.url)));
  const records = new Map(recorded.processes.map((value) => [value.pid, value]));
  const samples = [recorded.uptimeBefore, recorded.uptimeAfter];
  const clock = readNativeVerificationClock({
    platform: "linux",
    pid: recorded.processes[0].pid,
    filesystem: () => 0x9fa0,
    ticks: () => recorded.clockTicksPerSecond,
    read: (file) => (file === "/proc/uptime" ? samples.shift() : records.get(Number(file.split("/")[2])).stat),
    link: (file) => records.get(Number(file.split("/")[2])).executable,
  });
  assert.equal(clock.setupMs, 3350);
  assert.equal(clock.workerPid, 2431);
  assert.equal(clock.listenerPid, 2403);
  assert.equal(recorded.classification, "RECORDED_WIRE_FORMAT_NOT_LIVE_ATTESTATION");
  assert.equal(clock.qualification, false);
});

test(
  "actual hosted kernel ancestry and current exact job bind a conservative clock despite provider header skew",
  {
    skip: process.platform !== "linux" || process.env.GITHUB_ACTIONS !== "true",
  },
  async () => {
    const candidateSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", timeout: 15000 }).trim();
    // The repository is public. This trusted test adapter reads the real own-run
    // API over TLS without exposing a token to candidate regression tests. It
    // supplies no synthetic provider data and issues no decision or mutation.
    const result = await currentVerificationJob({
      candidateSha,
      env: { ...process.env, GH_TOKEN: "public-read-fixture-no-credential" },
      request: (url, options) => {
        const headers = new Headers(options.headers);
        headers.delete("Authorization");
        return fetch(url, { ...options, headers });
      },
    });
    assert.equal(result.clockObservation.providerJob.candidateSha, candidateSha);
    assert.equal(result.clockObservation.nativeClock.originPid, process.pid);
    assert(result.setupMs >= result.clockObservation.nativeClock.setupMs);
    assert.equal(result.limitMs, 2700000);
    assert.equal(result.tailMs, 120000);
    assert(result.executionMs > 0);
    console.log(JSON.stringify({ namespace: "SOUNDING_LINE_NATIVE_CLOCK_PROOF", ...result, qualification: false }));
  },
);
