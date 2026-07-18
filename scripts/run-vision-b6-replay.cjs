"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const { VisionBuildEngine } = require("../apps/companion/vision-build-engine.cjs");
const {
  VISION_ENGINE_VERSION,
  VISION_MODEL_BUNDLE_VERSION,
  sha256,
  stableStringify,
} = require("../apps/companion/vision-engine-contract.cjs");
const { cloneFrames, createSyntheticPilots } = require("../apps/companion/vision-pilots.cjs");
const { VisionRuntimeEngine } = require("../apps/companion/vision-runtime-engine.cjs");

function argumentsFrom(argv) {
  const value = (name, fallback = null) => {
    const index = argv.indexOf(name);
    if (index < 0) return fallback;
    if (!argv[index + 1] || argv[index + 1].startsWith("--")) throw new Error(`${name} requires a value.`);
    return argv[index + 1];
  };
  const tier = value("--tier", "release");
  if (!["fast", "release"].includes(tier)) throw new Error("--tier must be fast or release.");
  const parallel = Number(value("--parallel", "1"));
  if (!Number.isInteger(parallel) || parallel < 1 || parallel > 3) throw new Error("--parallel must be 1, 2, or 3.");
  return {
    manifest: value("--manifest", "release/datasets/synthetic-corpus-v1.json"),
    outputJson: value("--output-json", value("--output")),
    outputMarkdown: value("--output-markdown"),
    baseline: value("--baseline"),
    profile: value("--profile"),
    engineVersion: value("--engine-version", VISION_ENGINE_VERSION),
    modelVersion: value("--model-version", VISION_MODEL_BUNDLE_VERSION),
    tier,
    parallel,
    failOnRegression: argv.includes("--fail-on-regression"),
    summaryOnly: argv.includes("--summary-only"),
  };
}

function frameSequenceHash(frames) {
  return `sha256:${sha256(
    stableStringify(
      frames.map((frame) => ({
        id: frame.id,
        width: frame.width,
        height: frame.height,
        sequence: frame.sequence,
        offsetMs: frame.offsetMs,
        luminanceHash: `sha256:${sha256(frame.luminance)}`,
      })),
    ),
  )}`;
}

function verifyDatasetManifest(manifest) {
  if (
    manifest?.schemaVersion !== 1 ||
    typeof manifest.datasetId !== "string" ||
    typeof manifest.revision !== "string" ||
    !Array.isArray(manifest.cases)
  )
    throw new Error("Dataset manifest schema is invalid.");
  const expected = `sha256:${sha256(stableStringify({ ...manifest, manifestHash: null }))}`;
  if (manifest.manifestHash !== expected)
    throw new Error("Dataset manifest hash does not match its canonical content.");
  const ids = new Set();
  for (const testCase of manifest.cases) {
    if (ids.has(testCase.id)) throw new Error(`Duplicate dataset case ${testCase.id}.`);
    ids.add(testCase.id);
    if (
      !manifest.partitions.includes(testCase.partition) ||
      !/^sha256:[a-f0-9]{64}$/.test(testCase.assetHash) ||
      typeof testCase.truthLabel?.reviewed !== "boolean" ||
      typeof testCase.mayBeUsedForCalibration !== "boolean" ||
      typeof testCase.locked !== "boolean"
    )
      throw new Error(`Dataset case ${testCase.id} is incomplete.`);
  }
  return manifest;
}

function resolveCaseFrames(pilot, source) {
  const [area, name] = source.split(":", 2);
  if (area === "release") return pilot.releaseCorpus.get(name);
  if (area === "build") {
    const prefix = `artifact_${pilot.id}_`;
    const asset = pilot.buildInput.assets.find((entry) => entry.id === `${prefix}${name}`);
    return asset ? pilot.frameSets.get(asset.id)?.frames : null;
  }
  return null;
}

function percentile(values, percentileValue) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1));
  return sorted[index];
}

function wilson(successes, count, confidenceZ = 1.96) {
  if (!count) return null;
  const proportion = successes / count;
  const denominator = 1 + (confidenceZ * confidenceZ) / count;
  const center = (proportion + (confidenceZ * confidenceZ) / (2 * count)) / denominator;
  const margin =
    (confidenceZ / denominator) *
    Math.sqrt((proportion * (1 - proportion)) / count + (confidenceZ * confidenceZ) / (4 * count * count));
  return { lower: Math.max(0, center - margin), upper: Math.min(1, center + margin), confidence: 0.95 };
}

function numberValues(frames, selector) {
  return frames.map(selector).filter((value) => typeof value === "number" && Number.isFinite(value));
}

function maximum(values) {
  return values.length ? Math.max(...values) : null;
}

function minimum(values) {
  return values.length ? Math.min(...values) : null;
}

function compactResult(testCase, result, memory) {
  const frames = result.diagnostics?.frames ?? [];
  const bestFrame = [...frames].sort(
    (left, right) => (right.target?.similarity ?? -1) - (left.target?.similarity ?? -1),
  )[0];
  const gates = result.diagnostics?.gates ?? {};
  const expectedPass =
    testCase.expectedResult === "NOT_VERIFIED"
      ? result.result !== "VERIFIED"
      : result.result === testCase.expectedResult;
  return {
    testCaseId: testCase.id,
    waypoint: testCase.waypoint,
    waypointVersion: testCase.waypointVersion,
    partition: testCase.partition,
    evidenceClass: "SYNTHETIC_MATHEMATICAL_FIXTURE",
    sourceHash: testCase.assetHash,
    expectedResult: testCase.expectedResult,
    actualResult: result.result,
    expectedPass,
    targetSimilarity: maximum(numberValues(frames, (frame) => frame.target?.similarity)),
    strongestNegativeSimilarity: maximum(numberValues(frames, (frame) => frame.negative?.similarity)),
    targetNegativeMargin: bestFrame?.margin ?? null,
    localMatchCount: maximum(numberValues(frames, (frame) => frame.localMatches)),
    geometricInliers: maximum(numberValues(frames, (frame) => frame.inliers)),
    inlierRatio: maximum(numberValues(frames, (frame) => frame.inlierRatio)),
    reprojectionError: minimum(numberValues(frames, (frame) => frame.reprojectionError)),
    cameraPose: bestFrame?.pose ?? null,
    poseUncertainty: bestFrame?.pose?.uncertainty ?? null,
    acceptedRegionStatus: gates.CAMERA_POSE?.pass === true,
    orientationStatus: gates.ORIENTATION_VISIBILITY?.pass === true,
    spatialCoverage: maximum(numberValues(frames, (frame) => frame.spatialCoverage?.hullRatio)),
    temporalConsistency: gates.TEMPORAL_CONSISTENCY ?? null,
    checkpointSpecificRuleStatus: gates.CHECKPOINT_SPECIFIC_RULES ?? null,
    ambiguityVeto: gates.AMBIGUITY_VETO ?? null,
    gateByGate: gates,
    capturedFrameCount: result.capturedFrameCount,
    usableFrameCount: result.usableFrameCount,
    passingFrameCount: result.passingFrameCount,
    failedGates: result.failedGates,
    runtimeDurationMs: result.durationMs,
    wallDurationMs: memory.wallDurationMs,
    rssBeforeBytes: memory.rssBeforeBytes,
    rssAfterBytes: memory.rssAfterBytes,
    rssDeltaBytes: memory.rssAfterBytes - memory.rssBeforeBytes,
    provider: result.provider,
    providerFallbackUsed: result.providerFallbackUsed,
    finalGuidanceCode: result.guidanceCode,
    engineVersion: result.engineVersion,
    modelBundleVersion: result.modelBundleVersion,
    packageId: result.packageId,
  };
}

async function runPilot(pilot, cases, options) {
  const buildInput = structuredClone(pilot.buildInput);
  if (options.profile) buildInput.waypoint.verificationProfile = options.profile;
  const builder = new VisionBuildEngine({ preferred: ["CPU_CLASSICAL"] });
  const inputHash = sha256(stableStringify(buildInput));
  const buildStarted = performance.now();
  const report = await builder.build({
    buildId: `build_${pilot.id}_b6_${options.profile ?? "default"}`,
    buildInput,
    inputHash,
    builtAt: "2026-07-18T12:00:00.000Z",
    provider: "CPU_CLASSICAL",
    resolveFrameSet: async (asset) => pilot.frameSets.get(asset.id),
  });
  const runtime = new VisionRuntimeEngine();
  const attempts = [];
  for (const testCase of cases) {
    const frames = resolveCaseFrames(pilot, testCase.source);
    if (!frames?.length) throw new Error(`Replay case ${testCase.id} has no frame sequence.`);
    const actualHash = frameSequenceHash(frames);
    if (actualHash !== testCase.assetHash)
      throw new Error(`Replay case ${testCase.id} changed without a manifest revision.`);
    const rssBeforeBytes = process.memoryUsage().rss;
    const started = performance.now();
    const result = await runtime.verify({
      attemptId: `attempt_${testCase.id}`,
      package: report.package,
      waypointVersionId: buildInput.waypoint.versionId,
      stageToken: `stage_${testCase.id}`,
      expectedStageToken: `stage_${testCase.id}`,
      provider: "CPU_CLASSICAL",
      frames: cloneFrames(frames),
    });
    attempts.push(
      compactResult(testCase, result, {
        rssBeforeBytes,
        rssAfterBytes: process.memoryUsage().rss,
        wallDurationMs: Math.round((performance.now() - started) * 100) / 100,
      }),
    );
  }
  return {
    pilotId: pilot.id,
    label: pilot.label,
    waypointType: buildInput.waypoint.type,
    profile: buildInput.waypoint.verificationProfile,
    packageId: report.package.manifest.packageId,
    packageHash: report.package.manifest.packageHash,
    buildInputHash: `sha256:${inputHash}`,
    buildDurationMs: Math.round((performance.now() - buildStarted) * 100) / 100,
    certification: report.certification,
    attempts,
  };
}

async function mapWithConcurrency(values, limit, operation) {
  const results = new Array(values.length);
  let next = 0;
  async function worker() {
    while (next < values.length) {
      const index = next++;
      results[index] = await operation(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

function summarize(attempts) {
  const scored = attempts.filter((attempt) => attempt.expectedResult !== "REFERENCE_ONLY");
  const positives = scored.filter((attempt) => attempt.expectedResult === "VERIFIED");
  const lockedNegative = scored.filter(
    (attempt) =>
      attempt.partition === "LOCKED_NEGATIVE" ||
      (attempt.partition === "REGRESSION" && attempt.expectedResult === "NOT_VERIFIED"),
  );
  const falseAccepts = lockedNegative.filter((attempt) => attempt.actualResult === "VERIFIED");
  const positiveSuccesses = positives.filter((attempt) => attempt.actualResult === "VERIFIED").length;
  const durations = scored.map((attempt) => attempt.runtimeDurationMs);
  return {
    attemptCount: scored.length,
    passedCases: scored.filter((attempt) => attempt.expectedPass).length,
    failedCases: scored.filter((attempt) => !attempt.expectedPass).length,
    positiveCases: positives.length,
    firstScanSuccesses: positiveSuccesses,
    firstScanSuccessRate: positives.length ? positiveSuccesses / positives.length : null,
    firstScanWilson95: wilson(positiveSuccesses, positives.length),
    withinTwoGuidedAttemptsRate: null,
    withinTwoGuidedAttemptsReason: "The synthetic corpus has no human guided-retry pairs; no rate is invented.",
    lockedAndRegressionNegativeCases: lockedNegative.length,
    confirmedFalseAccepts: falseAccepts.length,
    falseAcceptCaseIds: falseAccepts.map((attempt) => attempt.testCaseId),
    zeroFalseAcceptUpper95:
      falseAccepts.length === 0 && lockedNegative.length ? Math.min(1, 3 / lockedNegative.length) : null,
    runtimeMs: {
      p50: percentile(durations, 50),
      p95: percentile(durations, 95),
      p99: percentile(durations, 99),
      maximum: maximum(durations),
    },
    gatePass:
      scored.every((attempt) => attempt.expectedPass) &&
      falseAccepts.length === 0 &&
      positives.length > 0 &&
      positiveSuccesses / positives.length >= 0.95,
    releaseEligible: false,
    releaseEligibilityReason:
      "Synthetic evidence cannot satisfy the real-pilot, hardware, usability, signing, or public-release gates.",
  };
}

function comparison(currentAttempts, baselinePath) {
  if (!baselinePath) return null;
  const baseline = JSON.parse(fs.readFileSync(path.resolve(baselinePath), "utf8"));
  const previous = new Map((baseline.attempts ?? []).map((attempt) => [attempt.testCaseId, attempt]));
  const cases = currentAttempts.map((attempt) => {
    const prior = previous.get(attempt.testCaseId);
    if (!prior) return { testCaseId: attempt.testCaseId, status: "NEW_CASE" };
    const regressions = [];
    if (prior.expectedPass && !attempt.expectedPass) regressions.push("EXPECTED_RESULT_REGRESSION");
    if (prior.actualResult === "VERIFIED" && attempt.actualResult !== "VERIFIED")
      regressions.push("POSITIVE_RESULT_REGRESSION");
    if (prior.actualResult !== "VERIFIED" && attempt.actualResult === "VERIFIED")
      regressions.push("POTENTIAL_FALSE_ACCEPT_REGRESSION");
    if (
      typeof prior.runtimeDurationMs === "number" &&
      typeof attempt.runtimeDurationMs === "number" &&
      attempt.runtimeDurationMs > prior.runtimeDurationMs * 1.5 + 20
    )
      regressions.push("RUNTIME_DURATION_REGRESSION");
    return {
      testCaseId: attempt.testCaseId,
      status: regressions.length ? "REGRESSION" : "UNCHANGED_OR_IMPROVED",
      regressions,
      previousResult: prior.actualResult,
      currentResult: attempt.actualResult,
      previousDurationMs: prior.runtimeDurationMs,
      currentDurationMs: attempt.runtimeDurationMs,
    };
  });
  return {
    baseline: path.resolve(baselinePath),
    cases,
    regressionCount: cases.filter((entry) => entry.status === "REGRESSION").length,
  };
}

function markdown(output) {
  const lines = [
    "# Vision B-6 Replay Report",
    "",
    `Dataset: \`${output.dataset.revision}\` (${output.dataset.evidenceClass})`,
    "",
    `Result: **${output.status}**`,
    "",
    `> ${output.dataset.statement}`,
    "",
    "## Metrics",
    "",
    `- Cases: ${output.metrics.attemptCount}; passed: ${output.metrics.passedCases}; failed: ${output.metrics.failedCases}.`,
    `- Confirmed false accepts: ${output.metrics.confirmedFalseAccepts} / ${output.metrics.lockedAndRegressionNegativeCases} locked or regression negatives.`,
    `- Zero-observation upper 95% bound: ${
      output.metrics.zeroFalseAcceptUpper95 === null
        ? "not applicable"
        : (output.metrics.zeroFalseAcceptUpper95 * 100).toFixed(2) + "%"
    }.`,
    `- First-scan synthetic positive success: ${output.metrics.firstScanSuccesses} / ${output.metrics.positiveCases} (${(
      (output.metrics.firstScanSuccessRate ?? 0) * 100
    ).toFixed(2)}%).`,
    `- Runtime p50/p95/p99: ${output.metrics.runtimeMs.p50} / ${output.metrics.runtimeMs.p95} / ${output.metrics.runtimeMs.p99} ms.`,
    `- Release eligible: **No** — ${output.metrics.releaseEligibilityReason}`,
    "",
    "## Case results",
    "",
    "| Case | Partition | Expected | Actual | Pass | Duration ms | Guidance |",
    "| --- | --- | --- | --- | --- | ---: | --- |",
    ...output.attempts.map(
      (attempt) =>
        `| ${attempt.testCaseId} | ${attempt.partition} | ${attempt.expectedResult} | ${attempt.actualResult} | ${
          attempt.expectedPass ? "yes" : "no"
        } | ${attempt.runtimeDurationMs} | ${attempt.finalGuidanceCode} |`,
    ),
    "",
    "## Truth boundary",
    "",
    "This report does not certify Sea of Thieves reliability, automatic progression, Creator Preview, or Stable release.",
    "",
  ];
  return lines.join("\n");
}

async function main() {
  const options = argumentsFrom(process.argv.slice(2));
  if (options.engineVersion !== VISION_ENGINE_VERSION)
    throw new Error(
      `Requested engine ${options.engineVersion} is unavailable; active engine is ${VISION_ENGINE_VERSION}.`,
    );
  if (options.modelVersion !== VISION_MODEL_BUNDLE_VERSION)
    throw new Error(
      `Requested model ${options.modelVersion} is unavailable; active model is ${VISION_MODEL_BUNDLE_VERSION}.`,
    );
  const manifest = verifyDatasetManifest(JSON.parse(fs.readFileSync(path.resolve(options.manifest), "utf8")));
  const included = manifest.cases.filter(
    (testCase) =>
      testCase.partition !== "REFERENCE_BUILD" &&
      (options.tier === "release" || ["LOCKED_POSITIVE", "LOCKED_NEGATIVE"].includes(testCase.partition)),
  );
  const pilots = createSyntheticPilots();
  const suiteStarted = performance.now();
  const cpuStarted = process.cpuUsage();
  const rssStarted = process.memoryUsage().rss;
  const pilotResults = await mapWithConcurrency(pilots, options.parallel, (pilot) =>
    runPilot(
      pilot,
      included.filter((testCase) => testCase.waypoint === pilot.buildInput.waypoint.id),
      options,
    ),
  );
  const attempts = pilotResults.flatMap((pilot) => pilot.attempts);
  const metrics = summarize(attempts);
  const compared = comparison(attempts, options.baseline);
  const cpu = process.cpuUsage(cpuStarted);
  const output = {
    schemaVersion: 1,
    reportType: "VISION_B6_REPLAY",
    generatedAt: new Date().toISOString(),
    status: metrics.gatePass ? "SYNTHETIC_GATE_PASS" : "SYNTHETIC_GATE_FAIL",
    tier: options.tier,
    deterministicSeed: manifest.deterministicSeed,
    dataset: {
      datasetId: manifest.datasetId,
      revision: manifest.revision,
      manifestHash: manifest.manifestHash,
      evidenceClass: manifest.evidenceClass,
      statement: manifest.statement,
      lockedAt: manifest.lockedAt,
    },
    selectors: {
      engineVersion: options.engineVersion,
      modelBundleVersion: options.modelVersion,
      profileOverride: options.profile,
      parallelism: options.parallel,
    },
    environment: {
      platform: `${os.platform()} ${os.release()} ${os.arch()}`,
      cpu: os.cpus()[0]?.model?.trim() ?? "unknown",
      logicalCores: os.cpus().length,
      totalMemoryBytes: os.totalmem(),
      node: process.version,
      provider: "CPU_CLASSICAL",
      gpuProvider: "NOT_ACTIVE_NOT_MEASURED",
    },
    performance: {
      wallDurationMs: Math.round((performance.now() - suiteStarted) * 100) / 100,
      userCpuMs: Math.round(cpu.user / 1_000),
      systemCpuMs: Math.round(cpu.system / 1_000),
      rssStartedBytes: rssStarted,
      rssFinishedBytes: process.memoryUsage().rss,
      scope: "single-host synthetic replay; excludes native game capture and game impact",
    },
    metrics,
    pilots: pilotResults.map((pilot) => {
      const summary = { ...pilot };
      delete summary.attempts;
      return summary;
    }),
    attempts,
    comparison: compared,
    reportHash: null,
  };
  output.reportHash = `sha256:${sha256(stableStringify({ ...output, reportHash: null }))}`;
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  if (options.outputJson) {
    const destination = path.resolve(options.outputJson);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, serialized, { encoding: "utf8", flag: "w" });
  }
  if (options.outputMarkdown) {
    const destination = path.resolve(options.outputMarkdown);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, `${markdown(output)}\n`, { encoding: "utf8", flag: "w" });
  }
  process.stdout.write(
    options.summaryOnly
      ? `${JSON.stringify({
          status: output.status,
          tier: output.tier,
          reportHash: output.reportHash,
          dataset: output.dataset,
          environment: output.environment,
          performance: output.performance,
          metrics: output.metrics,
        })}\n`
      : serialized,
  );
  if (options.failOnRegression && (metrics.gatePass !== true || (compared?.regressionCount ?? 0) > 0))
    process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ code: "B6_REPLAY_FAILED", message: error.message }, null, 2)}\n`);
  process.exitCode = 1;
});
