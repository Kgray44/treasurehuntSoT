"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { VisionBuildEngine, partitionAssets } = require("./vision-build-engine.cjs");
const {
  buildFailureCodes,
  buildFailureGuidance,
  runtimeErrorCodes,
  runtimeErrorGuidance,
  sha256,
  stableStringify,
} = require("./vision-engine-contract.cjs");
const { cloneFrames, createSyntheticPilots } = require("./vision-pilots.cjs");
const { loadRuntimePackage } = require("./vision-package.cjs");
const { VisionProviderRouter } = require("./vision-provider.cjs");
const { VisionRuntimeEngine } = require("./vision-runtime-engine.cjs");

async function buildPilot(pilot, options = {}) {
  const builder = new VisionBuildEngine(options);
  return builder.build({
    buildId: `build_${pilot.id}_test`,
    builtAt: "2026-07-18T00:00:00.000Z",
    buildInput: pilot.buildInput,
    inputHash: sha256(stableStringify(pilot.buildInput)),
    provider: "CPU_CLASSICAL",
    resolveFrameSet: async (asset) => pilot.frameSets.get(asset.id),
    ...options.request,
  });
}

async function verify(pilot, report, name, frames, overrides = {}) {
  return new VisionRuntimeEngine(overrides.runtimeOptions).verify({
    attemptId: `att_${pilot.id}_${name}`,
    package: report.package,
    waypointVersionId: pilot.buildInput.waypoint.versionId,
    stageToken: `stage_${pilot.id}_current`,
    expectedStageToken: `stage_${pilot.id}_current`,
    provider: "CPU_CLASSICAL",
    frames: cloneFrames(frames),
    ...overrides,
  });
}

test("three materially different synthetic pilots execute the production build and mandatory runtime gates", async () => {
  for (const pilot of createSyntheticPilots()) {
    const report = await buildPilot(pilot);
    assert.equal(report.status, "COMPLETED");
    assert.equal(report.shadowModeOnly, true);
    assert.equal(report.certification.automaticEligibility, false);
    assert.equal(report.referenceGraph.components, 1);
    assert.equal(report.reconstruction.type, "PLANAR_REFERENCE_GRAPH");
    assert.equal(pilot.seaOfThievesClaim, false);
    const positive = await verify(pilot, report, "positive", pilot.runtime.positive);
    const negative = await verify(pilot, report, "negative", pilot.runtime.negative);
    const insufficient = await verify(pilot, report, "insufficient", pilot.runtime.insufficient);
    assert.equal(positive.result, "VERIFIED");
    assert.equal(positive.failedGates.length, 0);
    assert.equal(positive.automaticProgression, false);
    assert.equal(positive.shadowMode, true);
    assert.notEqual(negative.result, "VERIFIED");
    assert.ok(["NOT_AT_TARGET", "AMBIGUOUS"].includes(negative.result));
    assert.equal(insufficient.result, "INSUFFICIENT_VISUAL_EVIDENCE");
    assert.equal(positive.diagnostics.rawFramesRetained, false);
  }
});

test("same immutable input, build identity, timestamp, engine, and model produce the same package hash", async () => {
  const pilot = createSyntheticPilots()[0];
  const first = await buildPilot(pilot);
  const second = await buildPilot(pilot);
  assert.equal(first.package.manifest.packageHash, second.package.manifest.packageHash);
  assert.equal(stableStringify(first.package), stableStringify(second.package));
});

test("package loader rejects corrupted data, unsafe names, incompatible versions, and duplicate artifacts", async () => {
  const report = await buildPilot(createSyntheticPilots()[0]);
  assert.equal(loadRuntimePackage(report.package).manifest.packageId, report.package.manifest.packageId);
  const corrupt = structuredClone(report.package);
  corrupt.artifacts[0].data.changed = true;
  assert.throws(
    () => loadRuntimePackage(corrupt),
    (error) => error.code === "PACKAGE_CORRUPT",
  );
  const unsafe = structuredClone(report.package);
  unsafe.artifacts[0].name = "../runtime-config.json";
  assert.throws(
    () => loadRuntimePackage(unsafe),
    (error) => error.code === "PACKAGE_CORRUPT",
  );
  const duplicate = structuredClone(report.package);
  duplicate.artifacts.push(structuredClone(duplicate.artifacts[0]));
  assert.throws(
    () => loadRuntimePackage(duplicate),
    (error) => error.code === "PACKAGE_CORRUPT",
  );
  const incompatible = structuredClone(report.package);
  incompatible.manifest.packageSchemaVersion = 99;
  assert.throws(
    () => loadRuntimePackage(incompatible),
    (error) => error.code === "PACKAGE_SCHEMA_UNSUPPORTED",
  );
});

test("provider routing reports detected acceleration but falls back only to a genuinely active CPU provider", () => {
  const router = new VisionProviderRouter({ graphicsAdapters: [{ deviceString: "NVIDIA RTX fixture", active: true }] });
  const selected = router.select({ requested: "CUDA_DETECTED", allowFallback: true });
  assert.equal(selected.provider.id, "CPU_CLASSICAL");
  assert.equal(selected.fallbackUsed, true);
  assert.equal(selected.attempts[0].available, true);
  assert.equal(selected.attempts[0].usable, false);
  assert.throws(
    () => router.select({ requested: "CUDA_DETECTED", allowFallback: false }),
    (error) => error.code === "PROVIDER_UNAVAILABLE",
  );
});

test("every creator-facing failure code has deterministic explanation, action, severity, and retry policy", () => {
  for (const code of buildFailureCodes) {
    assert.equal(typeof buildFailureGuidance[code].title, "string");
    assert.equal(typeof buildFailureGuidance[code].explanation, "string");
    assert.equal(typeof buildFailureGuidance[code].correctiveAction, "string");
    assert.ok(["INFO", "ERROR"].includes(buildFailureGuidance[code].severity));
    assert.equal(typeof buildFailureGuidance[code].retryable, "boolean");
    assert.equal(typeof buildFailureGuidance[code].studioRoute, "number");
  }
  for (const code of runtimeErrorCodes) assert.equal(typeof runtimeErrorGuidance[code].correctiveAction, "string");
});

test("partition leakage, cancellation, timeout, stale stage, and provider failure are deterministic safe failures", async () => {
  const pilot = createSyntheticPilots()[0];
  const leaky = structuredClone(pilot.buildInput);
  leaky.validationTests[0].environment.assetIds = [leaky.assets[0].id];
  assert.throws(
    () => partitionAssets(leaky),
    (error) => error.code === "DATASET_PARTITION_CONFLICT",
  );

  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(
    buildPilot(pilot, { request: { signal: aborted.signal } }),
    (error) => error.code === "BUILD_CANCELLED" && error.buildReport.status === "CANCELLED",
  );

  let time = 0;
  await assert.rejects(
    buildPilot(pilot, { clock: () => (time += 10_000), request: { timeoutMs: 1_000 } }),
    (error) => error.code === "BUILD_TIMEOUT",
  );

  const report = await buildPilot(pilot);
  const stale = await verify(pilot, report, "stale", pilot.runtime.positive, {
    expectedStageToken: "stage_pilot1_replaced",
  });
  assert.equal(stale.result, "SYSTEM_ERROR");
  assert.equal(stale.errorCode, "STAGE_TOKEN_STALE");

  const providerFailure = await verify(pilot, report, "provider_failure", pilot.runtime.positive, {
    provider: "CUDA_DETECTED",
    allowProviderFallback: false,
  });
  assert.equal(providerFailure.result, "SYSTEM_ERROR");
  assert.equal(providerFailure.errorCode, "PROVIDER_UNAVAILABLE");
});

test("runtime completion is idempotent and stays within the synthetic pilot budget", async () => {
  const pilot = createSyntheticPilots()[1];
  const report = await buildPilot(pilot);
  const runtime = new VisionRuntimeEngine();
  const input = {
    attemptId: "att_idempotent_runtime_01",
    package: report.package,
    waypointVersionId: pilot.buildInput.waypoint.versionId,
    stageToken: "stage_idempotent_01",
    expectedStageToken: "stage_idempotent_01",
    provider: "CPU_CLASSICAL",
    frames: cloneFrames(pilot.runtime.positive),
  };
  const first = await runtime.verify(input);
  const second = await runtime.verify({ ...input, frames: cloneFrames(pilot.runtime.negative) });
  assert.equal(first.result, "VERIFIED");
  assert.equal(second.result, "VERIFIED");
  assert.equal(second.idempotent, true);
  assert.ok(first.durationMs < 2_000, `Synthetic runtime took ${first.durationMs}ms`);
});
