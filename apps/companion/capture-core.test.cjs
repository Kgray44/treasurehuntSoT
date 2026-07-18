"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { CaptureCore } = require("./capture-core.cjs");
const { CompanionStorage } = require("./storage.cjs");

class FakeWorker extends EventEmitter {
  async start(input) {
    this.active = input;
  }

  async stop(sessionId) {
    assert.equal(sessionId, this.active.sessionId);
    this.active = null;
    return {
      originalDimensions: { width: 1920, height: 1080 },
      estimatedFrameRate: 10,
      encoding: "video/webm;codecs=vp9",
      droppedFrames: 0,
    };
  }

  async pause() {}
  async resume() {}

  async cancel() {
    this.active = null;
  }

  async destroy() {}
}

class FakeHotkey extends EventEmitter {
  async configure(binding, interaction) {
    this.binding = binding;
    this.interaction = interaction;
    return { registered: true, conflict: false };
  }

  async disable() {}

  async setWindowHandle(windowHandle) {
    this.windowHandle = windowHandle;
  }
}

function framePixels(width, height, phase) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      pixels[index] = (x * (phase + 3) + y * 5 + 40) % 255;
      pixels[index + 1] = (y * (phase + 7) + x * 9 + 30) % 255;
      pixels[index + 2] = ((x + y) * (phase + 11) + 20) % 255;
      pixels[index + 3] = 255;
    }
  }
  return pixels;
}

async function fixture(t, options = {}) {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "forever-treasure-b2-core-"));
  t.after(() => fsp.rm(root, { recursive: true, force: true }));
  const storage = new CompanionStorage(root, { maximumCreatorBytes: 1024 * 1024 });
  const worker = new FakeWorker();
  const hotkey = options.hotkey ? new FakeHotkey() : null;
  const target = {
    targetId: "window:123456:0",
    windowHandle: "123456",
    label: "Sea of Thieves",
    privacyLabel: "Sea of Thieves window",
    dimensions: { width: 320, height: 180 },
    displayId: null,
  };
  const targetProvider = {
    async listTargets() {
      return [target];
    },
    async validateTarget(id) {
      if (id !== target.targetId) throw new Error("unavailable");
      return target;
    },
  };
  const core = new CaptureCore({ targetProvider, worker, storage, hotkeyService: hotkey });
  await core.initialize();
  return { core, worker, storage, hotkey, target };
}

function emitFrames(worker, sessionId, count, identical = false) {
  const buffers = [];
  for (let sequence = 1; sequence <= count; sequence += 1) {
    const pixels = framePixels(64, 36, identical ? 1 : sequence);
    buffers.push(pixels);
    worker.emit("frame", {
      sessionId,
      capturedAtMs: Date.now() + sequence * 100,
      width: 64,
      height: 36,
      originalWidth: 1920,
      originalHeight: 1080,
      pixels,
    });
  }
  return buffers;
}

test("player scan consumes real frame buffers, returns capture-only evidence, and clears memory", async (t) => {
  const { core, worker, target } = await fixture(t);
  await assert.rejects(
    core.beginPlayerScan({
      requestId: "request_missing_target",
      attemptId: "attempt_missing_target",
      durationMs: 3_000,
      sampleFps: 8,
      minimumFrames: 3,
    }),
    { code: "CAPTURE_SOURCE_NOT_SELECTED" },
  );
  await core.selectTarget(target.targetId);
  const started = await core.beginPlayerScan({
    requestId: "request_player_scan_01",
    attemptId: "attempt_player_scan_01",
    durationMs: 3_000,
    sampleFps: 8,
    minimumFrames: 3,
  });
  core.active.startedAtMs = Date.now() - 1_000;
  const buffers = emitFrames(worker, started.sessionId, 12);
  const result = await core.stopPlayerScan(started.sessionId);
  assert.ok(["EVIDENCE_CAPTURED", "INSUFFICIENT_CAPTURE_EVIDENCE"].includes(result.result));
  assert.equal(result.captureOnly, true);
  assert.equal(result.verificationResult, null);
  assert.equal(result.evidenceBundle.verification.performed, false);
  assert.equal(result.evidenceBundle.retention.rawFramesWrittenToDisk, false);
  assert.equal(result.evidenceBundle.retention.transientFramesCleared, true);
  assert.equal(
    buffers.every((buffer) => buffer.every((value) => value === 0)),
    true,
  );
  assert.equal(core.getStatus().state, "COMPLETED");
  assert.equal((await core.stopPlayerScan(started.sessionId)).idempotent, true);
});

test("frozen player input is insufficient and a minimized target can recover after restore", async (t) => {
  const { core, worker, target } = await fixture(t);
  await core.selectTarget(target.targetId);
  const frozenScan = await core.beginPlayerScan({
    requestId: "request_frozen_scan_01",
    attemptId: "attempt_frozen_scan_01",
    durationMs: 3_000,
    sampleFps: 8,
    minimumFrames: 3,
  });
  core.active.startedAtMs = Date.now() - 1_000;
  emitFrames(worker, frozenScan.sessionId, 10, true);
  const frozenResult = await core.stopPlayerScan(frozenScan.sessionId);
  assert.equal(frozenResult.result, "INSUFFICIENT_CAPTURE_EVIDENCE");
  assert.ok(frozenResult.reasons.includes("STREAM_FROZEN"));

  core.lastCompletionAt = 0;
  const interrupted = await core.beginPlayerScan({
    requestId: "request_restore_scan_01",
    attemptId: "attempt_restore_scan_01",
    durationMs: 3_000,
    sampleFps: 8,
    minimumFrames: 3,
  });
  await core.handleTargetHealth({ windowHandle: target.windowHandle, minimized: true, closed: false });
  assert.equal(core.getStatus().state, "TARGET_LOST");
  assert.equal(core.getStatus().session, null);
  await core.handleTargetHealth({ windowHandle: target.windowHandle, minimized: false, closed: false });
  assert.equal(core.getStatus().state, "TARGET_SELECTED");
  assert.notEqual(interrupted.sessionId, frozenScan.sessionId);
});

test("creator recording writes a retained WebM manifest and supports pause/resume", async (t) => {
  const { core, worker, target, storage } = await fixture(t);
  await core.selectTarget(target.targetId);
  const started = await core.beginCreatorRecording({
    requestId: "request_creator_0001",
    waypointVersionId: "waypoint_version_0001",
    purpose: "TARGET_REFERENCE",
    label: "B-2 creator reference",
    notes: "controlled test",
    fieldOfView: 90,
    environmentNotes: "daylight",
    allowCloudUpload: false,
    maxDurationMs: 3_000,
  });
  await core.pause(started.sessionId);
  assert.equal(core.getStatus().state, "PAUSED");
  await core.resume(started.sessionId);
  worker.emit("recording-chunk", { sessionId: started.sessionId, chunk: Buffer.from("webm-test-content") });
  emitFrames(worker, started.sessionId, 4);
  const completed = await core.stopCreatorRecording(started.sessionId);
  assert.equal(completed.result, "EVIDENCE_CAPTURED");
  assert.equal(completed.captureOnly, true);
  assert.equal(completed.artifact.retention.uploadAuthorized, false);
  assert.equal(completed.artifact.metadata.fieldOfView, 90);
  assert.equal((await storage.listCreatorArtifacts()).length, 1);
});

test("toggle hotkey starts and stops only the player scan path", async (t) => {
  const { core, hotkey, target } = await fixture(t, { hotkey: true });
  await core.selectTarget(target.targetId);
  await core.configureHotkey({ binding: "Control+Alt+F9", interaction: "TOGGLE" });
  hotkey.emit("keydown");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(core.getStatus().mode, "PLAYER_SCAN");
  core.active.startedAtMs = Date.now() - 1_000;
  hotkey.emit("keydown");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(core.getStatus().session, null);
  assert.equal(core.getStatus().lastCompleted.result, "INSUFFICIENT_CAPTURE_EVIDENCE");
});
