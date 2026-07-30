/*
 * Executes the two explicitly certified Harborlight Phase 4 browser lanes.
 * Each lane receives a separately marker-owned validation mirror, SQLite copy,
 * loopback port, browser context, and artifact root from the internal runtime.
 * This runner deliberately has no arbitrary-command or arbitrary-spec inputs.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const baseline = process.env.SOUNDING_LINE_BASELINE_DATABASE;
const runRoot = process.env.SOUNDING_LINE_RUN_ROOT;
if (!baseline || !path.isAbsolute(baseline))
  throw new Error("SOUNDING_LINE_BASELINE_DATABASE must be an absolute trusted baseline");
if (!runRoot || !path.isAbsolute(runRoot))
  throw new Error("SOUNDING_LINE_RUN_ROOT must identify the owned Sounding Line runtime");

const lanes = Object.freeze([
  { id: "harborlight-a", port: 3101 },
  { id: "harborlight-b", port: 3102 },
]);
const logsRoot = path.join(runRoot, "logs");
await mkdir(logsRoot, { recursive: true });
const failureTail = (log) => log.slice(-12_000);

function executeLane(lane) {
  const args = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    "scripts/sounding-line/isolated-validation-runtime.ps1",
    "-BrowserOnly",
    "-SkipBrowserInstall",
    "-BrowserTestPath",
    "tests/e2e/harborlight-phase4.spec.ts",
    "-BaselineDatabasePath",
    baseline,
    "-SoundingLineLane",
    lane.id,
    "-SoundingLinePort",
    String(lane.port),
  ];
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", args, {
      cwd: process.cwd(),
      env: { ...process.env, SOUNDING_LINE_INTERNAL_RUNTIME: "1" },
      shell: false,
      windowsHide: true,
    });
    let log = "";
    const append = (chunk) => {
      log += chunk.toString();
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.once("error", reject);
    child.once("close", (exitCode, signal) =>
      resolve({
        lane: lane.id,
        port: lane.port,
        exitCode: exitCode ?? -1,
        signal: signal ?? null,
        runtimeRoot: /Created task-owned validation runtime:\s+(.+)/u.exec(log)?.[1]?.trim() ?? null,
        log,
      }),
    );
  });
}

const results = await Promise.all(lanes.map(executeLane));
for (const result of results)
  await writeFile(path.join(logsRoot, `harborlight-${result.lane}.log`), result.log, "utf8");
const receipt = {
  kind: "harborlight-phase4-concurrent-browser-lanes",
  version: 1,
  startedAt: new Date().toISOString(),
  baseline,
  lanes: results.map((result) => ({
    lane: result.lane,
    port: result.port,
    exitCode: result.exitCode,
    signal: result.signal,
    runtimeRoot: result.runtimeRoot,
    status: result.exitCode === 0 ? "PASS" : "FAIL",
    ...(result.exitCode === 0 ? {} : { diagnosticTail: failureTail(result.log) }),
  })),
};
await writeFile(path.join(logsRoot, "harborlight-browser-lanes.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(receipt)}\n`);
if (results.some((result) => result.exitCode !== 0)) process.exitCode = 1;
