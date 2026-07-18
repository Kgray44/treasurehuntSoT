"use strict";

const crypto = require("node:crypto");
const { EventEmitter } = require("node:events");
const os = require("node:os");
const {
  CAPTURE_CORE_VERSION,
  CAPTURE_PROTOCOL_VERSION,
  assertTransition,
  captureError,
  serializeCaptureError,
  validateCommand,
} = require("./capture-contract.cjs");
const { BoundedFrameRing, disposeFrame } = require("./ring-buffer.cjs");
const { analyzeFrame, selectBestFrames, summarizeQuality } = require("./quality.cjs");

function randomId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function digest(value) {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

class CaptureCore extends EventEmitter {
  constructor(options) {
    super();
    if (!options?.targetProvider || !options?.worker || !options?.storage)
      throw new Error("CaptureCore requires targetProvider, worker, and storage.");
    this.targetProvider = options.targetProvider;
    this.worker = options.worker;
    this.storage = options.storage;
    this.logger = options.logger ?? (() => {});
    this.hotkeyService = options.hotkeyService ?? null;
    this.captureApi = options.captureApi ?? "ELECTRON_DESKTOP_CAPTURER";
    this.graphicsAdapters = [];
    this.storageStatus = { location: { category: "ELECTRON_USER_DATA", managed: true }, availableDiskBytes: null };
    this.diagnosticContextProvider = null;
    this.playerEvidenceConsumer = null;
    this.state = "TARGET_SELECTION_REQUIRED";
    this.target = null;
    this.active = null;
    this.privacyPaused = false;
    this.hotkey = { enabled: false, binding: "Control+Alt+F9", interaction: "HOLD", state: "DISABLED" };
    this.lastCompleted = null;
    this.lastCompletionResponse = null;
    this.lastError = null;
    this.lastCompletionAt = 0;
    this.transitionHistory = [];
    this.completionPromise = null;
    this.autoStopTimer = null;
    this.pendingWrites = Promise.resolve();
    this.initializedAt = new Date().toISOString();
    this.worker.on("frame", (frame) => this.#handleFrame(frame));
    this.worker.on("recording-chunk", (chunk) => this.#handleRecordingChunk(chunk));
    this.worker.on("ended", (detail) => this.#handleWorkerEnded(detail));
    this.worker.on("error", (error) => void this.#fail(error).catch(() => {}));
    this.hotkeyService?.on("keydown", () => void this.#handleHotkeyDown().catch((error) => this.#fail(error)));
    this.hotkeyService?.on("keyup", () => void this.#handleHotkeyUp().catch((error) => this.#fail(error)));
    this.hotkeyService?.on(
      "release-lost",
      () => void this.#handleHotkeyReleaseLost().catch((error) => this.#fail(error)),
    );
    this.hotkeyService?.on(
      "health",
      (health) => void this.handleTargetHealth(health).catch((error) => this.#fail(error)),
    );
  }

  async initialize() {
    const storage = await this.storage.initialize();
    this.storageStatus = storage;
    this.#log("INFO", "capture_core_initialized", { storageCleanup: storage.cleanup });
    this.#emitStatus();
    return this.getCapabilities();
  }

  getCapabilities() {
    const memory = os.totalmem();
    return {
      protocolVersion: CAPTURE_PROTOCOL_VERSION,
      companionVersion: CAPTURE_CORE_VERSION,
      captureCoreVersion: CAPTURE_CORE_VERSION,
      supportedProtocolVersions: [CAPTURE_PROTOCOL_VERSION],
      supportedPackageSchemaVersions: [1],
      captureApi: this.captureApi,
      nativeCapture: true,
      applicationWindowCapture: true,
      displayCaptureDefault: false,
      globalHotkeys: Boolean(this.hotkeyService),
      hotkeyHoldRelease: Boolean(this.hotkeyService),
      creatorRecording: true,
      playerScan: true,
      diagnosticCapture: true,
      diagnosticRawFrameDefault: false,
      browserPairing: true,
      desktopIntegrated: true,
      systemTray: true,
      localInference: true,
      locationVerification: true,
      cloudBuild: false,
      offlineCapture: true,
      operatingSystem: { platform: os.platform(), release: os.release(), architecture: os.arch() },
      hardware: {
        logicalCores: os.cpus().length,
        cpuModel: os.cpus()[0]?.model ?? "unknown",
        totalMemoryBytes: memory,
        freeMemoryBytes: os.freemem(),
        graphicsAdapters: this.graphicsAdapters,
        encoderCandidates: ["WEBM_VP9", "WEBM_VP8", "WEBM_DEFAULT"],
        hardwareAccelerationAvailable: this.graphicsAdapters.some((device) => device.active),
        cpuFallbackAvailable: true,
        futureComputeProviders: ["CPU_CLASSICAL", "DIRECTML_DETECTED", "CUDA_DETECTED"],
      },
      storage: {
        ...this.storageStatus.location,
        availableDiskBytes: this.storageStatus.availableDiskBytes,
        creatorRetention: "USER_MANAGED",
        playerRetention: "MEMORY_ONLY_UNTIL_CONSUMED",
      },
      supportedCaptureResolutions: {
        source: "SELECTED_WINDOW_NATIVE_RESOLUTION",
        analysis: [{ width: 320, height: 180 }],
      },
      supportedModes: ["CREATOR_RECORDING", "PLAYER_SCAN", "DIAGNOSTIC_METADATA"],
      preview: { creatorRecording: true, playerRawFrames: false },
      budgets: {
        playerMemoryBytes: 32 * 1024 * 1024,
        playerMaximumFrames: 84,
        playerDurationMs: { minimum: 3_000, default: 5_000, maximum: 8_000 },
        playerSampleFps: { minimum: 8, default: 10, maximum: 12 },
        playerSelectedFrames: { minimum: 6, maximum: 12 },
        creatorMaximumBytes: this.storage.maximumCreatorBytes,
      },
      privacy: {
        playerFramesMemoryOnly: true,
        playerDiskSpill: false,
        fullFramesOverJson: false,
        captureVisible: true,
        diagnosticFrameRetentionRequiresConsent: true,
      },
    };
  }

  setGraphicsAdapters(devices) {
    this.graphicsAdapters = Array.isArray(devices)
      ? devices.slice(0, 8).map((device) => ({
          vendorId: Number(device.vendorId ?? 0),
          deviceId: Number(device.deviceId ?? 0),
          active: Boolean(device.active),
          driverVendor: String(device.driverVendor ?? "unknown").slice(0, 120),
          deviceString: String(device.deviceString ?? "unknown").slice(0, 160),
        }))
      : [];
  }

  setDiagnosticContextProvider(provider) {
    this.diagnosticContextProvider = typeof provider === "function" ? provider : null;
  }

  setPlayerEvidenceConsumer(consumer) {
    this.playerEvidenceConsumer = typeof consumer === "function" ? consumer : null;
  }

  async execute(command, input = {}) {
    const payload = validateCommand(command, { ...input });
    if (command === "capture.getCapabilities") return this.getCapabilities();
    if (command === "capture.getStatus") return this.getStatus();
    if (command === "capture.listTargets") return { targets: await this.listTargets() };
    if (command === "capture.selectTarget") return this.selectTarget(payload.targetId, payload.remember);
    if (command === "capture.creator.start") return this.beginCreatorRecording(payload);
    if (command === "capture.creator.pause") return this.pause(payload.sessionId);
    if (command === "capture.creator.resume") return this.resume(payload.sessionId);
    if (command === "capture.creator.stop") return this.stopCreatorRecording(payload.sessionId);
    if (command === "capture.creator.cancel") return this.cancel(payload.sessionId);
    if (command === "capture.creator.list") return { artifacts: await this.storage.listCreatorArtifacts() };
    if (command === "capture.creator.delete") return this.storage.deleteCreatorArtifact(payload.artifactId);
    if (command === "capture.creator.preview") return this.storage.getCreatorArtifact(payload.artifactId);
    if (command === "capture.scan.start") return this.beginPlayerScan(payload);
    if (command === "capture.scan.stop") return this.stopPlayerScan(payload.sessionId);
    if (command === "capture.scan.cancel") return this.cancel(payload.sessionId);
    if (command === "capture.privacy.pause") return this.pauseVision(payload.reason);
    if (command === "capture.privacy.resume") return this.resumeVision();
    if (command === "capture.hotkey.configure") return this.configureHotkey(payload);
    if (command === "capture.hotkey.disable") return this.disableHotkey();
    if (command === "capture.diagnostic.create") return this.createDiagnosticBundle(payload);
    throw captureError("VALIDATION_FAILED", `Capture command ${command} is not implemented.`);
  }

  async listTargets() {
    const targets = await this.targetProvider.listTargets();
    return targets.map((target) => ({
      targetId: target.targetId,
      label: target.label,
      privacyLabel: target.privacyLabel,
      likelySeaOfThieves: Boolean(target.likelySeaOfThieves),
      dimensions: target.dimensions,
      thumbnailDataUrl: target.thumbnailDataUrl,
      applicationIconDataUrl: target.applicationIconDataUrl,
      available: target.available !== false,
    }));
  }

  async selectTarget(targetId, remember = false) {
    if (this.active)
      throw captureError("CAPTURE_ALREADY_ACTIVE", "Stop the active capture before changing the target.");
    const selected = await this.targetProvider.validateTarget(targetId);
    this.target = {
      targetId: selected.targetId,
      windowHandle: selected.windowHandle,
      label: selected.label,
      privacyLabel: selected.privacyLabel,
      dimensions: selected.dimensions,
      displayId: selected.displayId,
      selectedAt: new Date().toISOString(),
      remembered: Boolean(remember),
    };
    this.#move("TARGET_SELECTED", { targetId: selected.targetId, remember: Boolean(remember) });
    const monitorStatus = await this.hotkeyService?.setWindowHandle(selected.windowHandle);
    if (this.hotkey.enabled && monitorStatus && !monitorStatus.registered) {
      this.hotkey = { ...this.hotkey, enabled: false, state: "CONFLICT" };
    }
    this.#log("INFO", "capture_target_selected", { targetId: selected.targetId, dimensions: selected.dimensions });
    return { target: { ...this.target, windowHandle: undefined }, health: this.#health() };
  }

  async beginPlayerScan(input) {
    this.#assertCanStart();
    if (Date.now() - this.lastCompletionAt < 2_000)
      throw captureError("CAPTURE_ALREADY_ACTIVE", "Wait for the scan cooldown before trying again.");
    const sessionId = randomId("scan");
    const ring = new BoundedFrameRing({ maxFrames: Math.min(84, input.sampleFps * 8 + 4), maxBytes: 32 * 1024 * 1024 });
    this.active = {
      sessionId,
      requestId: input.requestId,
      attemptId: input.attemptId,
      mode: "PLAYER_SCAN",
      startedAt: new Date().toISOString(),
      startedAtMs: Date.now(),
      durationMs: input.durationMs,
      sampleFps: input.sampleFps,
      minimumFrames: input.minimumFrames,
      ring,
      frameSequence: 0,
      lastFrameAtMs: null,
      previousFrame: null,
      progress: 0,
      completionEmitted: false,
      interruptions: [],
    };
    this.#move("STARTING", { sessionId, mode: "PLAYER_SCAN" });
    try {
      await this.worker.start({
        sessionId,
        mode: "PLAYER_SCAN",
        sourceId: this.target.targetId,
        sampleFps: input.sampleFps,
        maximumDurationMs: input.durationMs,
        analysisWidth: 320,
        analysisHeight: 180,
      });
    } catch (error) {
      await this.#fail(error);
      throw error;
    }
    this.#move("CAPTURING", { sessionId });
    this.autoStopTimer = setTimeout(() => {
      void this.stopPlayerScan(sessionId).catch((error) => this.#fail(error));
    }, input.durationMs);
    this.#emitProgress();
    return { sessionId, state: this.state, startedAt: this.active.startedAt, maximumDurationMs: input.durationMs };
  }

  async stopPlayerScan(sessionId) {
    if (this.completionPromise) return this.completionPromise;
    if (!this.active && this.lastCompletionResponse?.sessionId === sessionId) {
      return { ...this.lastCompletionResponse, idempotent: true };
    }
    this.#assertActive(sessionId, "PLAYER_SCAN");
    this.completionPromise = this.#completePlayerScan().catch(async (error) => {
      await this.#fail(error);
      throw error;
    });
    try {
      return await this.completionPromise;
    } finally {
      this.completionPromise = null;
    }
  }

  async #completePlayerScan() {
    const active = this.active;
    clearTimeout(this.autoStopTimer);
    this.autoStopTimer = null;
    const elapsed = Date.now() - active.startedAtMs;
    if (elapsed < 500) return this.cancel(active.sessionId, "ACCIDENTAL_SHORT_PRESS");
    this.#move("FINALIZING", { sessionId: active.sessionId });
    await this.worker.stop(active.sessionId);
    this.#move("PROCESSING_CAPTURE", { sessionId: active.sessionId });
    const frames = active.ring.snapshot();
    const qualitySummary = summarizeQuality(frames, active.ring.stats());
    const selection = selectBestFrames(frames, { minimum: active.minimumFrames, maximum: 12 });
    const selectedMetadata = selection.selected.map((frame) => ({
      frameRef: `frame_${active.sessionId}_${frame.sequence}`,
      sequence: frame.sequence,
      capturedAtMs: frame.capturedAtMs,
      width: frame.width,
      height: frame.height,
      quality: frame.quality,
    }));
    const result =
      selection.sufficient && !qualitySummary.frozen ? "EVIDENCE_CAPTURED" : "INSUFFICIENT_CAPTURE_EVIDENCE";
    const reasons = [...new Set([...selection.reasons, ...(qualitySummary.frozen ? ["STREAM_FROZEN"] : [])])];
    const evidenceMetadata = {
      schemaVersion: 1,
      protocolVersion: CAPTURE_PROTOCOL_VERSION,
      captureCoreVersion: CAPTURE_CORE_VERSION,
      evidenceBundleId: randomId("evidence"),
      sessionId: active.sessionId,
      attemptId: active.attemptId,
      target: {
        targetId: this.target.targetId,
        privacyLabel: this.target.privacyLabel,
        dimensions: this.target.dimensions,
      },
      captureApi: this.captureApi,
      startedAt: active.startedAt,
      completedAt: new Date().toISOString(),
      elapsedMs: elapsed,
      sampleFps: active.sampleFps,
      result,
      reasons,
      qualitySummary,
      selection: {
        algorithmVersion: selection.algorithmVersion,
        selectedFrameCount: selectedMetadata.length,
        frames: selectedMetadata,
      },
      retention: {
        rawFramesWrittenToDisk: false,
        transientFramesCleared: false,
        replayable: false,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      verification: { performed: false, outcome: null },
    };
    let verificationResult = null;
    if (this.playerEvidenceConsumer && selection.selected.length) {
      verificationResult = await this.playerEvidenceConsumer({
        attemptId: active.attemptId,
        sessionId: active.sessionId,
        frames: selection.selected.map((frame) => ({
          ...frame,
          id: `frame_${active.sessionId}_${frame.sequence}`,
        })),
        capture: { result, reasons, qualitySummary },
      });
      if (verificationResult) {
        evidenceMetadata.verification = {
          performed: true,
          outcome: verificationResult.result,
          attemptId: verificationResult.attemptId,
          evidenceDigest: verificationResult.evidenceDigest ?? null,
          shadowMode: true,
          automaticProgression: false,
        };
      }
    }
    evidenceMetadata.evidenceDigest = digest(evidenceMetadata);
    const clearedFrames = active.ring.clear();
    evidenceMetadata.retention.transientFramesCleared = true;
    evidenceMetadata.retention.clearedFrameCount = clearedFrames;
    evidenceMetadata.retention.consumedAt = new Date().toISOString();
    this.#move("COMPLETED", { sessionId: active.sessionId, result, selectedFrameCount: selectedMetadata.length });
    const response = {
      sessionId: active.sessionId,
      result,
      reasons,
      qualitySummary,
      evidenceBundle: evidenceMetadata,
      captureOnly: verificationResult === null,
      verificationResult,
    };
    this.#finishActive(response);
    return response;
  }

  async beginCreatorRecording(input) {
    this.#assertCanStart();
    const sessionId = randomId("creator");
    const storageSession = await this.storage.startCreatorRecording({
      waypointVersionId: input.waypointVersionId,
      purpose: input.purpose,
      creatorLabel: input.label.trim(),
      notes: input.notes ?? "",
      fieldOfView: input.fieldOfView ?? null,
      environmentNotes: input.environmentNotes ?? "",
      allowCloudUpload: Boolean(input.allowCloudUpload),
      target: { targetId: this.target.targetId, privacyLabel: this.target.privacyLabel },
      captureApi: this.captureApi,
    });
    this.active = {
      sessionId,
      requestId: input.requestId,
      mode: "CREATOR_RECORDING",
      startedAt: new Date().toISOString(),
      startedAtMs: Date.now(),
      maximumDurationMs: input.maxDurationMs,
      recordingId: storageSession.recordingId,
      artifactId: storageSession.artifactId,
      metrics: [],
      authoringFrames: [],
      previousFrame: null,
      frameSequence: 0,
      lastFrameAtMs: null,
      progress: 0,
      completionEmitted: false,
      interruptions: [],
    };
    this.#move("STARTING", { sessionId, mode: "CREATOR_RECORDING" });
    try {
      await this.worker.start({
        sessionId,
        mode: "CREATOR_RECORDING",
        sourceId: this.target.targetId,
        sampleFps: 10,
        maximumDurationMs: input.maxDurationMs,
        analysisWidth: 320,
        analysisHeight: 180,
      });
    } catch (error) {
      await this.#fail(error);
      throw error;
    }
    this.#move("CAPTURING", { sessionId });
    this.autoStopTimer = setTimeout(() => {
      void this.stopCreatorRecording(sessionId).catch((error) => this.#fail(error));
    }, input.maxDurationMs);
    this.#emitProgress();
    return {
      sessionId,
      artifactId: storageSession.artifactId,
      state: this.state,
      startedAt: this.active.startedAt,
      storageCategory: storageSession.storageCategory,
    };
  }

  async stopCreatorRecording(sessionId) {
    if (this.completionPromise) return this.completionPromise;
    if (!this.active && this.lastCompletionResponse?.sessionId === sessionId) {
      return { ...this.lastCompletionResponse, idempotent: true };
    }
    this.#assertActive(sessionId, "CREATOR_RECORDING");
    this.completionPromise = this.#completeCreatorRecording().catch(async (error) => {
      await this.#fail(error);
      throw error;
    });
    try {
      return await this.completionPromise;
    } finally {
      this.completionPromise = null;
    }
  }

  async #completeCreatorRecording() {
    const active = this.active;
    clearTimeout(this.autoStopTimer);
    this.autoStopTimer = null;
    this.#move("FINALIZING", { sessionId: active.sessionId });
    const workerResult = await this.worker.stop(active.sessionId);
    await this.pendingWrites;
    this.pendingWrites = Promise.resolve();
    this.#move("PROCESSING_CAPTURE", { sessionId: active.sessionId });
    if (active.previousFrame) {
      disposeFrame(active.previousFrame);
      active.previousFrame = null;
    }
    const qualitySummary = summarizeQuality(active.metrics, { droppedFrames: workerResult?.droppedFrames ?? 0 });
    const frameSelection = selectBestFrames(active.authoringFrames, { minimum: 2, maximum: 18 });
    const derivedFrames = frameSelection.selected.map((frame) => ({
      id: `frame_${active.artifactId}_${frame.sequence}`,
      sequence: frame.sequence,
      offsetMs: Math.max(0, frame.capturedAtMs - active.startedAtMs),
      capturedAtMs: frame.capturedAtMs,
      width: frame.width,
      height: frame.height,
      quality: frame.quality,
      luminance: frame.luminance,
    }));
    const manifest = await this.storage.finishCreatorRecording(
      active.recordingId,
      {
        sessionId: active.sessionId,
        captureCoreVersion: CAPTURE_CORE_VERSION,
        protocolVersion: CAPTURE_PROTOCOL_VERSION,
        originalDimensions: workerResult?.originalDimensions ?? this.target.dimensions,
        normalizedDimensions: { width: 320, height: 180 },
        estimatedFrameRate: workerResult?.estimatedFrameRate ?? 10,
        durationMs: Date.now() - active.startedAtMs,
        frameCount: active.metrics.length,
        encoding: workerResult?.encoding ?? "video/webm",
        qualitySummary,
        interruptions: active.interruptions,
        derivedFrameSelection: {
          algorithmVersion: frameSelection.algorithmVersion,
          selectedFrameCount: derivedFrames.length,
          reasons: frameSelection.reasons,
        },
      },
      derivedFrames,
    );
    for (const frame of active.authoringFrames) disposeFrame(frame);
    active.authoringFrames.length = 0;
    this.#move("COMPLETED", { sessionId: active.sessionId, artifactId: active.artifactId });
    const response = {
      sessionId: active.sessionId,
      result: "EVIDENCE_CAPTURED",
      artifact: manifest,
      qualitySummary,
      captureOnly: true,
      verificationResult: null,
    };
    this.#finishActive(response);
    return response;
  }

  async pause(sessionId) {
    this.#assertActive(sessionId);
    if (this.state === "PAUSED") return { sessionId, state: this.state, idempotent: true };
    if (this.state !== "CAPTURING") throw captureError("CAPTURE_NOT_ACTIVE", "Only an active capture can be paused.");
    await this.worker.pause(sessionId);
    this.#move("PAUSED", { sessionId });
    return { sessionId, state: this.state };
  }

  async resume(sessionId) {
    this.#assertActive(sessionId);
    if (this.state === "CAPTURING") return { sessionId, state: this.state, idempotent: true };
    if (this.state !== "PAUSED") throw captureError("CAPTURE_NOT_ACTIVE", "Only a paused capture can resume.");
    if (this.privacyPaused) throw captureError("CAPTURE_PRIVACY_PAUSED", "Vision privacy pause is active.");
    await this.worker.resume(sessionId);
    this.#move("CAPTURING", { sessionId });
    return { sessionId, state: this.state };
  }

  async cancel(sessionId, reason = "USER_CANCELLED") {
    if (!this.active) return { sessionId, result: "CAPTURE_CANCELLED", idempotent: true };
    if (this.active.sessionId !== sessionId) throw captureError("CAPTURE_REQUEST_STALE", "Capture session is stale.");
    const active = this.active;
    clearTimeout(this.autoStopTimer);
    this.autoStopTimer = null;
    await this.worker.cancel(sessionId).catch(() => {});
    if (active.mode === "CREATOR_RECORDING") {
      await this.pendingWrites.catch(() => {});
      this.pendingWrites = Promise.resolve();
      await this.storage.cancelCreatorRecording(active.recordingId);
      for (const frame of active.authoringFrames ?? []) disposeFrame(frame);
      if (active.authoringFrames) active.authoringFrames.length = 0;
    }
    if (active.ring) active.ring.clear();
    if (active.previousFrame) disposeFrame(active.previousFrame);
    this.#move("CANCELLED", { sessionId, reason });
    const response = {
      sessionId,
      result: "CAPTURE_CANCELLED",
      reason,
      cleanup: { transientFramesCleared: true, temporaryRecordingRemoved: active.mode === "CREATOR_RECORDING" },
      captureOnly: true,
      verificationResult: null,
    };
    this.#finishActive(response);
    return response;
  }

  async pauseVision(reason = "USER_PRIVACY_PAUSE") {
    this.privacyPaused = true;
    if (this.active && this.state === "CAPTURING") await this.pause(this.active.sessionId);
    this.#log("INFO", "privacy_pause_enabled", { reason });
    this.#emitStatus();
    return { privacyPaused: true, activeSessionPaused: this.state === "PAUSED" };
  }

  async resumeVision() {
    this.privacyPaused = false;
    this.#log("INFO", "privacy_pause_disabled", {});
    this.#emitStatus();
    return { privacyPaused: false, activeSessionState: this.state };
  }

  async configureHotkey(input) {
    if (!this.hotkeyService) throw captureError("HOTKEY_UNAVAILABLE", "The Windows hotkey monitor is unavailable.");
    const status = await this.hotkeyService.configure(input.binding, input.interaction);
    this.hotkey = {
      ...input,
      ...status,
      enabled: status.registered,
      state: status.registered ? "REGISTERED" : "CONFLICT",
    };
    if (!status.registered) throw captureError("HOTKEY_CONFLICT", "The selected hotkey is already registered.");
    this.#emitStatus();
    return this.hotkey;
  }

  async disableHotkey() {
    await this.hotkeyService?.disable();
    this.hotkey = { ...this.hotkey, enabled: false, state: "DISABLED" };
    this.#emitStatus();
    return this.hotkey;
  }

  async createDiagnosticBundle(input) {
    if (input.includeFrames && !input.consent)
      throw captureError("DIAGNOSTIC_CONSENT_REQUIRED", "Diagnostic frame retention requires explicit consent.");
    if (input.includeFrames)
      throw captureError("CAPTURE_SOURCE_UNAVAILABLE", "Raw-frame diagnostic retention is not enabled in Phase B-2.");
    return this.storage.writeDiagnosticBundle({
      generatedAt: new Date().toISOString(),
      applicationVersion: CAPTURE_CORE_VERSION,
      protocolVersion: CAPTURE_PROTOCOL_VERSION,
      captureApi: this.captureApi,
      capabilities: this.getCapabilities(),
      status: this.getStatus(),
      transitionHistory: this.transitionHistory.slice(-200),
      lastError: this.lastError,
      privacy: { playerFramesRetained: false, diagnosticFramesIncluded: false, consent: Boolean(input.consent) },
      cleanup: {
        activeTemporaryRecordings: this.storage.activeRecordings.size,
        playerRingActive: Boolean(this.active?.ring),
      },
      companion: this.diagnosticContextProvider?.() ?? null,
    });
  }

  getStatus() {
    return {
      protocolVersion: CAPTURE_PROTOCOL_VERSION,
      companionVersion: CAPTURE_CORE_VERSION,
      state: this.state,
      mode: this.active?.mode ?? null,
      session: this.active
        ? {
            sessionId: this.active.sessionId,
            startedAt: this.active.startedAt,
            progress: this.active.progress,
            frameCount: this.active.ring?.stats().frameCount ?? this.active.metrics?.length ?? 0,
            droppedFrames: this.active.ring?.stats().droppedFrames ?? 0,
          }
        : null,
      target: this.target
        ? {
            targetId: this.target.targetId,
            privacyLabel: this.target.privacyLabel,
            dimensions: this.target.dimensions,
            remembered: this.target.remembered,
          }
        : null,
      health: this.#health(),
      privacy: {
        paused: this.privacyPaused,
        playerFramesMemoryOnly: true,
        diagnosticRetentionEnabled: false,
        captureIndicatorVisible: ["STARTING", "CAPTURING", "PAUSED", "FINALIZING", "PROCESSING_CAPTURE"].includes(
          this.state,
        ),
      },
      hotkey: this.hotkey,
      lastCompleted: this.lastCompleted,
      lastError: this.lastError,
    };
  }

  async handleTargetHealth(health) {
    if (!this.target || String(health.windowHandle) !== String(this.target.windowHandle)) return;
    if (health.closed) {
      this.#log("WARN", "capture_target_closed", { targetId: this.target.targetId });
      if (this.active) await this.#targetLost("CAPTURE_SOURCE_CLOSED");
      else {
        this.target = null;
        this.#move("TARGET_LOST", { reason: "CAPTURE_SOURCE_CLOSED" });
      }
      await this.hotkeyService?.setWindowHandle("0");
      return;
    }
    if (!health.minimized && !this.active && this.state === "TARGET_LOST") {
      this.#move("TARGET_SELECTED", { reason: "CAPTURE_SOURCE_RESTORED" });
    }
    if (health.minimized) {
      if (this.active) {
        this.active.interruptions.push({ code: "CAPTURE_SOURCE_MINIMIZED", at: new Date().toISOString() });
        await this.#targetLost("CAPTURE_SOURCE_MINIMIZED");
      } else if (this.state !== "TARGET_LOST") {
        this.lastError = serializeCaptureError(
          captureError("CAPTURE_SOURCE_MINIMIZED", "The selected window is minimized."),
        );
        this.#move("TARGET_LOST", { reason: "CAPTURE_SOURCE_MINIMIZED" });
        this.emit("capture-error", this.lastError);
      }
      return;
    }
    if (health.dimensions && this.target.dimensions) {
      const changed =
        health.dimensions.width !== this.target.dimensions.width ||
        health.dimensions.height !== this.target.dimensions.height;
      if (changed) {
        this.target.dimensions = health.dimensions;
        this.active?.interruptions.push({
          code: "CAPTURE_FORMAT_CHANGED",
          at: new Date().toISOString(),
          dimensions: health.dimensions,
        });
        this.#log("INFO", "capture_target_resized", { dimensions: health.dimensions });
        this.#emitStatus();
      }
    }
  }

  async shutdown() {
    if (this.active) await this.cancel(this.active.sessionId, "COMPANION_SHUTDOWN");
    await this.hotkeyService?.shutdown?.().catch(() => {});
    this.hotkey = { ...this.hotkey, enabled: false, state: "DISABLED" };
    await this.worker.destroy?.();
    this.#log("INFO", "capture_core_shutdown", {});
  }

  #assertCanStart() {
    if (this.privacyPaused) throw captureError("CAPTURE_PRIVACY_PAUSED", "Vision privacy pause is active.");
    if (!this.target) throw captureError("CAPTURE_SOURCE_NOT_SELECTED", "Select a game window before capture.");
    if (this.active)
      throw captureError("CAPTURE_ALREADY_ACTIVE", "Another capture session already owns the selected window.");
    if (!["TARGET_SELECTED", "COMPLETED", "CANCELLED", "FAILED"].includes(this.state))
      throw captureError("CAPTURE_SOURCE_UNAVAILABLE", `Capture cannot start from ${this.state}.`);
    if (["COMPLETED", "CANCELLED", "FAILED"].includes(this.state))
      this.#move("TARGET_SELECTED", { reason: "NEXT_SESSION" });
  }

  #assertActive(sessionId, mode) {
    if (!this.active) throw captureError("CAPTURE_NOT_ACTIVE", "No capture session is active.");
    if (this.active.sessionId !== sessionId) throw captureError("CAPTURE_REQUEST_STALE", "Capture session is stale.");
    if (mode && this.active.mode !== mode)
      throw captureError("CAPTURE_REQUEST_STALE", "Capture session mode is stale.");
  }

  #handleFrame(frame) {
    const active = this.active;
    if (!active || frame.sessionId !== active.sessionId || this.state !== "CAPTURING") {
      if (Buffer.isBuffer(frame?.pixels)) frame.pixels.fill(0);
      return;
    }
    try {
      const analyzed = analyzeFrame(frame, active.previousFrame);
      const originalDimensions = {
        width: frame.originalWidth ?? frame.width,
        height: frame.originalHeight ?? frame.height,
      };
      if (
        originalDimensions.width > 0 &&
        originalDimensions.height > 0 &&
        (originalDimensions.width !== this.target.dimensions?.width ||
          originalDimensions.height !== this.target.dimensions?.height)
      ) {
        this.target.dimensions = originalDimensions;
      }
      const captured = {
        sessionId: active.sessionId,
        sequence: ++active.frameSequence,
        capturedAtMs: frame.capturedAtMs ?? Date.now(),
        width: frame.width,
        height: frame.height,
        originalWidth: frame.originalWidth,
        originalHeight: frame.originalHeight,
        pixels: frame.pixels,
        luminance: analyzed.luminance,
        quality: analyzed.quality,
      };
      active.lastFrameAtMs = captured.capturedAtMs;
      active.progress = Math.min(
        1,
        (Date.now() - active.startedAtMs) / (active.durationMs ?? active.maximumDurationMs),
      );
      if (active.mode === "PLAYER_SCAN") {
        active.ring.push(captured);
        active.previousFrame = captured;
      } else {
        active.metrics.push({ ...captured, pixels: undefined, luminance: undefined });
        if (active.metrics.length > 600) active.metrics.shift();
        if (active.frameSequence === 1 || active.frameSequence % 5 === 0) {
          active.authoringFrames.push({
            ...captured,
            pixels: Buffer.alloc(0),
            luminance: Buffer.from(analyzed.luminance),
          });
          while (active.authoringFrames.length > 72) disposeFrame(active.authoringFrames.shift());
        }
        if (active.previousFrame) disposeFrame(active.previousFrame);
        active.previousFrame = captured;
        captured.pixels.fill(0);
      }
      this.#emitProgress();
    } catch (error) {
      if (Buffer.isBuffer(frame?.pixels)) frame.pixels.fill(0);
      void this.#fail(error);
    }
  }

  #handleRecordingChunk(event) {
    if (!this.active || this.active.mode !== "CREATOR_RECORDING" || event.sessionId !== this.active.sessionId) {
      if (Buffer.isBuffer(event?.chunk)) event.chunk.fill(0);
      return;
    }
    const recordingId = this.active.recordingId;
    this.pendingWrites = this.pendingWrites
      .then(() => this.storage.appendCreatorChunk(recordingId, event.chunk))
      .finally(() => event.chunk.fill(0));
  }

  #handleWorkerEnded(detail) {
    if (!this.active || detail.sessionId !== this.active.sessionId) return;
    if (!["FINALIZING", "PROCESSING_CAPTURE", "CANCELLED"].includes(this.state))
      void this.#targetLost("CAPTURE_SOURCE_CLOSED");
  }

  async #handleHotkeyDown() {
    if (!this.hotkey.enabled || this.privacyPaused || !this.target) return;
    if (this.hotkey.interaction === "TOGGLE") {
      if (this.active?.mode === "PLAYER_SCAN") await this.stopPlayerScan(this.active.sessionId);
      else if (this.active) return;
      else
        await this.beginPlayerScan({
          requestId: randomId("request"),
          attemptId: randomId("attempt"),
          durationMs: 5_000,
          sampleFps: 10,
          minimumFrames: 6,
        });
      return;
    }
    if (this.active) return;
    await this.beginPlayerScan({
      requestId: randomId("request"),
      attemptId: randomId("attempt"),
      durationMs: 5_000,
      sampleFps: 10,
      minimumFrames: 6,
    }).catch((error) => this.#fail(error));
  }

  async #handleHotkeyUp() {
    if (this.hotkey.interaction !== "HOLD" || this.active?.mode !== "PLAYER_SCAN") return;
    await this.stopPlayerScan(this.active.sessionId).catch((error) => this.#fail(error));
  }

  async #handleHotkeyReleaseLost() {
    if (this.active?.mode !== "PLAYER_SCAN") return;
    this.active.interruptions.push({ code: "HOTKEY_RELEASE_LOST", at: new Date().toISOString() });
    await this.stopPlayerScan(this.active.sessionId).catch((error) => this.#fail(error));
  }

  async #targetLost(code) {
    const active = this.active;
    clearTimeout(this.autoStopTimer);
    this.autoStopTimer = null;
    await this.worker.cancel(active.sessionId).catch(() => {});
    if (active.mode === "CREATOR_RECORDING") {
      await this.pendingWrites.catch(() => {});
      this.pendingWrites = Promise.resolve();
      await this.storage.cancelCreatorRecording(active.recordingId);
      for (const frame of active.authoringFrames ?? []) disposeFrame(frame);
      if (active.authoringFrames) active.authoringFrames.length = 0;
    }
    active.ring?.clear();
    this.lastError = serializeCaptureError(captureError(code, code));
    this.#move("TARGET_LOST", { sessionId: active.sessionId, code });
    this.active = null;
    this.target = code === "CAPTURE_SOURCE_CLOSED" ? null : this.target;
    this.emit("capture-error", this.lastError);
  }

  async #fail(error) {
    const normalized = error?.name === "CaptureError" ? error : captureError("INTERNAL_ERROR", error?.message);
    const active = this.active;
    clearTimeout(this.autoStopTimer);
    this.autoStopTimer = null;
    if (active) {
      await this.worker.cancel(active.sessionId).catch(() => {});
      if (active.mode === "CREATOR_RECORDING") {
        await this.pendingWrites.catch(() => {});
        this.pendingWrites = Promise.resolve();
        await this.storage.cancelCreatorRecording(active.recordingId).catch(() => {});
        for (const frame of active.authoringFrames ?? []) disposeFrame(frame);
        if (active.authoringFrames) active.authoringFrames.length = 0;
      }
      active.ring?.clear();
    }
    this.lastError = serializeCaptureError(normalized);
    if (this.state !== "FAILED") {
      try {
        this.#move("FAILED", { sessionId: active?.sessionId, code: this.lastError.code });
      } catch {
        this.state = "FAILED";
      }
    }
    this.active = null;
    this.emit("capture-error", this.lastError);
    this.#log("ERROR", "capture_failed", { code: this.lastError.code, recoverable: this.lastError.recoverable });
  }

  #finishActive(response) {
    if (this.active?.completionEmitted) return;
    if (this.active) this.active.completionEmitted = true;
    this.lastCompleted = {
      sessionId: response.sessionId,
      mode: this.active?.mode,
      result: response.result,
      completedAt: new Date().toISOString(),
      selectedFrameCount: response.evidenceBundle?.selection?.selectedFrameCount ?? null,
      artifactId: response.artifact?.artifactId ?? null,
    };
    this.lastCompletionResponse = response;
    this.lastCompletionAt = Date.now();
    this.active = null;
    this.emit("capture-completed", response);
    this.#emitStatus();
  }

  #move(to, metadata = {}) {
    const from = this.state;
    if (from === to) return;
    assertTransition(from, to);
    this.state = to;
    const transition = {
      sequence: this.transitionHistory.length + 1,
      from,
      to,
      at: new Date().toISOString(),
      correlationId: this.active?.sessionId ?? metadata.sessionId ?? null,
      metadata,
    };
    this.transitionHistory.push(transition);
    if (this.transitionHistory.length > 500) this.transitionHistory.shift();
    this.emit("state", transition);
    this.#log("INFO", "capture_state_transition", { from, to, sessionId: transition.correlationId });
    this.#emitStatus();
  }

  #health() {
    if (this.privacyPaused) return { status: "PAUSED", reason: "PRIVACY_PAUSE" };
    if (this.state === "TARGET_LOST") return { status: "TARGET_LOST", reason: this.lastError?.code ?? null };
    if (this.lastError && this.state === "FAILED") return { status: "ERROR", reason: this.lastError.code };
    if (!this.target) return { status: "DEGRADED", reason: "CAPTURE_SOURCE_NOT_SELECTED" };
    if (this.state === "PAUSED") return { status: "PAUSED", reason: "SESSION_PAUSED" };
    const frameAgeMs = this.active?.lastFrameAtMs ? Date.now() - this.active.lastFrameAtMs : null;
    if (this.active && frameAgeMs !== null && frameAgeMs > 2_000) return { status: "STREAM_FROZEN", frameAgeMs };
    const ring = this.active?.ring?.stats();
    if (ring?.pressureRatio > 0.9)
      return { status: "DEGRADED", reason: "QUEUE_PRESSURE", queuePressure: ring.pressureRatio };
    return { status: "HEALTHY", frameAgeMs, queuePressure: ring?.pressureRatio ?? 0 };
  }

  #emitProgress() {
    if (!this.active) return;
    this.emit("capture-progress", {
      sessionId: this.active.sessionId,
      state: this.state,
      mode: this.active.mode,
      progress: this.active.progress,
      elapsedMs: Date.now() - this.active.startedAtMs,
      frameCount: this.active.ring?.stats().frameCount ?? this.active.metrics?.length ?? 0,
      droppedFrames: this.active.ring?.stats().droppedFrames ?? 0,
      health: this.#health(),
    });
  }

  #emitStatus() {
    this.emit("status", this.getStatus());
  }

  #log(level, event, fields) {
    this.logger({ timestamp: new Date().toISOString(), level, event, ...fields });
  }
}

module.exports = { CaptureCore, digest, randomId };
