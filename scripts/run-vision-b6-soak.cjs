"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const { VisionBuildEngine } = require("../apps/companion/vision-build-engine.cjs");
const { sha256, stableStringify } = require("../apps/companion/vision-engine-contract.cjs");
const { cloneFrames, createSyntheticPilots } = require("../apps/companion/vision-pilots.cjs");
const { VisionRuntimeEngine } = require("../apps/companion/vision-runtime-engine.cjs");

function integerOption(name, fallback, maximum) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? Number(process.argv[index + 1]) : fallback;
  if (!Number.isInteger(value) || value < 1 || value > maximum) throw new Error(`${name} must be 1-${maximum}.`);
  return value;
}

function stringOption(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  if (!process.argv[index + 1] || process.argv[index + 1].startsWith("--"))
    throw new Error(`${name} requires a value.`);
  return process.argv[index + 1];
}

async function main() {
  const buildIterations = integerOption("--build-iterations", process.argv.includes("--quick") ? 3 : 15, 100);
  const scanIterations = integerOption("--scan-iterations", process.argv.includes("--quick") ? 15 : 250, 5000);
  const outputJson = stringOption("--output-json");
  const pilots = createSyntheticPilots();
  const before = process.memoryUsage();
  const started = performance.now();
  const packages = [];
  for (let index = 0; index < buildIterations; index += 1) {
    const pilot = pilots[index % pilots.length];
    const builder = new VisionBuildEngine({ preferred: ["CPU_CLASSICAL"] });
    const inputHash = sha256(stableStringify(pilot.buildInput));
    const report = await builder.build({
      buildId: `soak_build_${index}`,
      buildInput: pilot.buildInput,
      inputHash,
      builtAt: "2026-07-18T12:00:00.000Z",
      provider: "CPU_CLASSICAL",
      resolveFrameSet: async (asset) => pilot.frameSets.get(asset.id),
    });
    packages.push({ pilot, package: report.package });
  }
  const results = { verified: 0, nonSuccess: 0, systemErrors: 0 };
  const durations = [];
  for (let index = 0; index < scanIterations; index += 1) {
    const entry = packages[index % packages.length];
    const positive = index % 3 === 0;
    const frames = positive ? entry.pilot.runtime.positive : entry.pilot.runtime.negative;
    const runtime = new VisionRuntimeEngine();
    const result = await runtime.verify({
      attemptId: `soak_attempt_${index}`,
      package: entry.package,
      waypointVersionId: entry.pilot.buildInput.waypoint.versionId,
      stageToken: `soak_stage_${index}`,
      expectedStageToken: `soak_stage_${index}`,
      provider: "CPU_CLASSICAL",
      frames: cloneFrames(frames),
    });
    durations.push(result.durationMs);
    if (result.result === "SYSTEM_ERROR") results.systemErrors += 1;
    else if (result.result === "VERIFIED") results.verified += 1;
    else results.nonSuccess += 1;
    if ((positive && result.result !== "VERIFIED") || (!positive && result.result === "VERIFIED"))
      throw new Error(`Soak attempt ${index} violated its expected safety result.`);
  }
  const after = process.memoryUsage();
  const rssGrowthBytes = after.rss - before.rss;
  const budgetBytes = 256 * 1024 * 1024;
  if (rssGrowthBytes > budgetBytes) throw new Error(`Synthetic soak RSS grew by ${rssGrowthBytes} bytes.`);
  const sorted = [...durations].sort((left, right) => left - right);
  const p95 = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
  const output = {
    schemaVersion: 1,
    evidenceClass: "SYNTHETIC_SOAK_NOT_MULTI_HOUR_FIELD_EVIDENCE",
    buildIterations,
    scanIterations,
    results,
    performance: {
      wallDurationMs: Math.round((performance.now() - started) * 100) / 100,
      runtimeP95Ms: p95,
      rssBeforeBytes: before.rss,
      rssAfterBytes: after.rss,
      rssGrowthBytes,
      budgetBytes,
    },
    releaseEligible: false,
    limitations: [
      "No Sea of Thieves process was running.",
      "No native capture, GPU, thermal, sleep/resume, or multi-hour behavior was measured.",
      "Passing this bounded harness does not close the B-6 long-duration release blocker.",
    ],
  };
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  if (outputJson) {
    const destination = path.resolve(outputJson);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, serialized, { encoding: "utf8", flag: "w" });
  }
  process.stdout.write(serialized);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ code: "B6_SOAK_FAILED", message: error.message }, null, 2)}\n`);
  process.exitCode = 1;
});
