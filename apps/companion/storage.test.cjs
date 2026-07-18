"use strict";

const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { CompanionStorage, withinRoot } = require("./storage.cjs");

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
