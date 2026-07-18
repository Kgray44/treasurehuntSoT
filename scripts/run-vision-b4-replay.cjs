"use strict";

const { performance } = require("node:perf_hooks");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { VisionBuildEngine } = require("../apps/companion/vision-build-engine.cjs");
const { sha256, stableStringify } = require("../apps/companion/vision-engine-contract.cjs");
const { cloneFrames, createSyntheticPilots } = require("../apps/companion/vision-pilots.cjs");
const { VisionRuntimeEngine } = require("../apps/companion/vision-runtime-engine.cjs");

async function main() {
  const outputIndex = process.argv.indexOf("--output");
  const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
  if (outputIndex >= 0 && !outputPath) throw new Error("--output requires a file path.");
  const suiteStarted = performance.now();
  const cpuStarted = process.cpuUsage();
  const rssStarted = process.memoryUsage().rss;
  let observedPeakRss = rssStarted;
  const results = [];
  for (const pilot of createSyntheticPilots()) {
    const builder = new VisionBuildEngine({ preferred: ["CPU_CLASSICAL"] });
    const inputHash = sha256(stableStringify(pilot.buildInput));
    const buildStarted = performance.now();
    const report = await builder.build({
      buildId: `build_${pilot.id}_replay`,
      buildInput: pilot.buildInput,
      inputHash,
      builtAt: "2026-07-18T00:00:00.000Z",
      provider: "CPU_CLASSICAL",
      resolveFrameSet: async (asset) => pilot.frameSets.get(asset.id),
    });
    observedPeakRss = Math.max(observedPeakRss, process.memoryUsage().rss);
    const runtime = new VisionRuntimeEngine();
    const verify = async (name, frames) => {
      const startedAt = performance.now();
      const result = await runtime.verify({
        attemptId: `att_${pilot.id}_${name}`,
        package: report.package,
        waypointVersionId: pilot.buildInput.waypoint.versionId,
        stageToken: `stage_${pilot.id}_current`,
        expectedStageToken: `stage_${pilot.id}_current`,
        provider: "CPU_CLASSICAL",
        frames: cloneFrames(frames),
      });
      return { result, durationMs: Math.round(performance.now() - startedAt) };
    };
    const positive = await verify("positive", pilot.runtime.positive);
    const negative = await verify("negative", pilot.runtime.negative);
    const insufficient = await verify("insufficient", pilot.runtime.insufficient);
    observedPeakRss = Math.max(observedPeakRss, process.memoryUsage().rss);
    results.push({
      pilotId: pilot.id,
      label: pilot.label,
      evidenceClass: pilot.evidenceClass,
      seaOfThievesClaim: false,
      buildInputHash: `sha256:${inputHash}`,
      build: {
        status: report.status,
        reliabilityGrade: report.certification.reliabilityGrade,
        durationMs: Math.round(performance.now() - buildStarted),
        packageHash: report.package.manifest.packageHash,
      },
      runtime: {
        positive: { result: positive.result.result, durationMs: positive.durationMs },
        negative: { result: negative.result.result, durationMs: negative.durationMs },
        insufficient: { result: insufficient.result.result, durationMs: insufficient.durationMs },
      },
    });
  }
  const cpuUsed = process.cpuUsage(cpuStarted);
  const rssFinished = process.memoryUsage().rss;
  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    statement:
      "Synthetic mathematical fixtures execute the production engine but are not real Sea of Thieves pilot evidence.",
    hardware: {
      platform: `${os.platform()} ${os.release()} ${os.arch()}`,
      cpu: os.cpus()[0]?.model?.trim() ?? "unknown",
      logicalCores: os.cpus().length,
      totalMemoryBytes: os.totalmem(),
      node: process.version,
    },
    performance: {
      provider: "CPU_CLASSICAL",
      gpuBackend: "NOT_IMPLEMENTED_NO_GPU_TESTS_RUN",
      wallDurationMs: Math.round(performance.now() - suiteStarted),
      userCpuMs: Math.round(cpuUsed.user / 1_000),
      systemCpuMs: Math.round(cpuUsed.system / 1_000),
      rssStartedBytes: rssStarted,
      rssFinishedBytes: rssFinished,
      observedPeakRssBytes: observedPeakRss,
      observedRssDeltaBytes: rssFinished - rssStarted,
      measurementScope: "single-process synthetic replay; not a game-impact benchmark",
    },
    pilots: results,
  };
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  if (outputPath) {
    const resolved = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, serialized, { encoding: "utf8", flag: "w" });
  }
  process.stdout.write(serialized);
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({ code: error.code ?? "REPLAY_FAILED", message: error.message, report: error.buildReport ?? null }, null, 2)}\n`,
  );
  process.exitCode = 1;
});
