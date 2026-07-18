"use strict";

const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { CompanionStorage, withinRoot } = require("./storage.cjs");
const { createRuntimePackage } = require("./vision-package.cjs");

async function temporaryStorage(t) {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "forever-treasure-b2-storage-"));
  t.after(() => fsp.rm(root, { recursive: true, force: true }));
  const storage = new CompanionStorage(root, { maximumCreatorBytes: 1024 * 1024 });
  await storage.initialize();
  return storage;
}

test("creator recording is streamed into managed storage with an integrity manifest", async (t) => {
  const storage = await temporaryStorage(t);
  const started = await storage.startCreatorRecording({
    waypointVersionId: "waypoint_version_test",
    purpose: "TARGET_REFERENCE",
    creatorLabel: "Target reference",
    allowCloudUpload: false,
  });
  await storage.appendCreatorChunk(started.recordingId, Buffer.from("webm-header"));
  await storage.appendCreatorChunk(started.recordingId, Buffer.from("webm-body"));
  const manifest = await storage.finishCreatorRecording(started.recordingId, {
    sessionId: "creator_session_test",
    durationMs: 1_500,
    frameCount: 15,
  });
  assert.equal(manifest.artifactId, started.artifactId);
  assert.equal(manifest.fileSize, 20);
  assert.match(manifest.contentHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(manifest.retention.uploadAuthorized, false);
  const resolved = await storage.getCreatorArtifact(started.artifactId);
  assert.equal(resolved.size, 20);
  assert.equal(withinRoot(storage.paths.creator, resolved.mediaPath), true);
  assert.equal((await storage.listCreatorArtifacts()).length, 1);

  const deleted = await storage.deleteCreatorArtifact(started.artifactId);
  assert.equal(deleted.deleted, true);
  assert.equal((await storage.listCreatorArtifacts()).length, 0);
});

test("storage cancellation and startup cleanup remove only bounded temporary artifacts", async (t) => {
  const storage = await temporaryStorage(t);
  const started = await storage.startCreatorRecording({ creatorLabel: "cancelled" });
  await storage.appendCreatorChunk(started.recordingId, Buffer.from("temporary"));
  const cancelled = await storage.cancelCreatorRecording(started.recordingId);
  assert.equal(cancelled.temporaryRemoved, true);

  await fsp.writeFile(path.join(storage.paths.temporary, "stale.part"), "stale");
  await fsp.writeFile(path.join(storage.paths.temporary, "preserve.txt"), "preserve");
  const cleanup = await storage.cleanupTemporary();
  assert.equal(cleanup.staleTemporaryFilesRemoved, 1);
  assert.equal(await fsp.readFile(path.join(storage.paths.temporary, "preserve.txt"), "utf8"), "preserve");
});

test("artifact lookup rejects traversal and diagnostics contain metadata only", async (t) => {
  const storage = await temporaryStorage(t);
  await assert.rejects(storage.getCreatorArtifact("../../outside"), { code: "VALIDATION_FAILED" });
  const diagnostic = await storage.writeDiagnosticBundle({
    status: { state: "TARGET_SELECTED" },
    privacy: { playerFramesRetained: false },
  });
  assert.equal(diagnostic.containsRawFrames, false);
  assert.equal(diagnostic.storageCategory, "LOCAL_APP_DATA");
  assert.equal(
    withinRoot(storage.paths.diagnostics, path.join(storage.paths.diagnostics, `${diagnostic.bundleId}.json.gz`)),
    true,
  );
  const exported = await storage.getDiagnosticBundle(diagnostic.bundleId);
  assert.equal(exported.fileSize, diagnostic.fileSize);
  assert.equal(exported.mediaType, "application/gzip");
});

test("B-4 derived luminance frames and immutable packages remain inside managed local storage", async (t) => {
  const storage = await temporaryStorage(t);
  const started = await storage.startCreatorRecording({
    waypointVersionId: "waypoint_version_b4",
    purpose: "TARGET_REFERENCE",
    creatorLabel: "B-4 target",
    allowCloudUpload: false,
  });
  await storage.appendCreatorChunk(started.recordingId, Buffer.from("webm-b4-fixture"));
  const luminance = Buffer.alloc(32 * 24, 120);
  const manifest = await storage.finishCreatorRecording(
    started.recordingId,
    { sessionId: "creator_b4_fixture", durationMs: 1_000, frameCount: 2 },
    [
      {
        id: "frame_b4_0001",
        sequence: 1,
        offsetMs: 0,
        capturedAtMs: 1,
        width: 32,
        height: 24,
        quality: { usable: true },
        luminance,
      },
      {
        id: "frame_b4_0002",
        sequence: 2,
        offsetMs: 500,
        capturedAtMs: 501,
        width: 32,
        height: 24,
        quality: { usable: true },
        luminance,
      },
    ],
  );
  assert.equal(manifest.derivedFrameSet.containsColorPixels, false);
  const frames = await storage.loadCreatorFrameSet(started.artifactId, manifest.contentHash);
  assert.equal(frames.frames.length, 2);
  assert.deepEqual(frames.frames[0].luminance, luminance);

  const runtimePackage = createRuntimePackage({
    packageId: "pkg_storage_fixture_01",
    buildId: "build_storage_fixture_01",
    builtAt: "2026-07-18T00:00:00.000Z",
    waypoint: { id: "waypoint_storage_01", versionId: "version_storage_01", versionNumber: 1, type: "EXACT_LANDMARK" },
    calibrationProfile: "BALANCED",
    certificationStatus: "GOOD",
    artifacts: { "runtime-config.json": { shadowModeOnly: true, automaticProgression: false } },
  });
  const published = await storage.publishVisionPackage(runtimePackage);
  const repeated = await storage.publishVisionPackage(runtimePackage);
  assert.equal(published.idempotent, false);
  assert.equal(repeated.idempotent, true);
  assert.equal((await storage.loadVisionPackage(published.packageId)).manifest.packageHash, published.contentHash);
});
