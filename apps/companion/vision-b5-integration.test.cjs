"use strict";

const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { CompanionStorage } = require("./storage.cjs");
const { VisionBuildEngine } = require("./vision-build-engine.cjs");
const { sha256, stableStringify } = require("./vision-engine-contract.cjs");
const { VisionEngineService } = require("./vision-engine-service.cjs");
const { cloneFrames, createSyntheticPilots } = require("./vision-pilots.cjs");

test("B-5 package install, signed-stage arm, and real B-4 result use the governed Companion command path", async (t) => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "forever-treasure-b5-integration-"));
  t.after(() => fsp.rm(root, { recursive: true, force: true }));
  const storage = new CompanionStorage(root);
  await storage.initialize();
  const pilot = createSyntheticPilots()[0];
  const report = await new VisionBuildEngine({ preferred: ["CPU_CLASSICAL"] }).build({
    buildId: "build_b5_integration_01",
    builtAt: "2026-07-18T00:00:00.000Z",
    buildInput: pilot.buildInput,
    inputHash: sha256(stableStringify(pilot.buildInput)),
    provider: "CPU_CLASSICAL",
    resolveFrameSet: async (asset) => pilot.frameSets.get(asset.id),
  });
  const service = new VisionEngineService({
    storage,
    featureFlags: () => ({
      visionBuildEngine: true,
      visionRuntimeEngine: true,
      visionReconstruction: true,
      visionSecondaryMatcher: true,
      shadowVerification: true,
    }),
  });
  const installed = await service.execute("vision.package.install", { package: report.package });
  assert.equal(installed.packageId, report.package.manifest.packageId);
  assert.equal(installed.contentHash, report.package.manifest.packageHash);
  const stageToken = "stg_b5_integration_current";
  const armed = await service.execute("vision.runtime.arm", {
    attemptId: "att_b5_integration_0001",
    packageId: installed.packageId,
    waypointVersionId: pilot.buildInput.waypoint.versionId,
    stageToken,
    expectedStageToken: stageToken,
    provider: "CPU_CLASSICAL",
    allowProviderFallback: true,
    timeoutMs: 12_000,
    checkpointContext: { publishedVersionId: "version_story_b5_01", storyStateVersion: 7 },
  });
  assert.deepEqual(armed, {
    attemptId: "att_b5_integration_0001",
    armed: true,
    shadowMode: true,
    automaticProgression: false,
  });
  const result = await service.consumePlayerEvidence({
    attemptId: "att_b5_integration_0001",
    frames: cloneFrames(pilot.runtime.positive),
  });
  assert.equal(result.result, "VERIFIED");
  assert.equal(result.rawFramesRetained, false);
  assert.equal(result.automaticProgression, false);
  assert.equal(result.packageId, installed.packageId);
  assert.match(result.evidenceDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal((await storage.loadVisionPackage(installed.packageId)).manifest.packageHash, installed.contentHash);
});
