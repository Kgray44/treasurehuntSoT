/* Pinned Watchglass region provider with startup-only GPU/CPU selection. */
/* global importScripts */
"use strict";
var exports = {};
importScripts("./recovery-provider.js");
let detector = null,
  generation = null,
  failed = false,
  initialized = false,
  closed = false;
let startupAbort = null;
let readyPublished = false;
let frameGeometry = null;
let backend = "CPU_WASM",
  providerPolicy = "ORIGINAL_CPU",
  fallbackReason = null;
const candidate = exports.WatchglassRecoveryProvider;
const sendError = (reason) => self.postMessage({ type: "ERROR", generation, reason });
function closeDetector() {
  try {
    detector?.close();
    return true;
  } catch {
    return false;
  } finally {
    detector = null;
  }
}
async function fetchBytes(path, maximum) {
  const response = await fetch(path, {
    cache: "force-cache",
    credentials: "same-origin",
    signal: startupAbort?.signal,
  });
  if (!response.ok) throw new Error("RECOVERY_ASSET_FETCH");
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maximum) throw new Error("RECOVERY_ASSET_SIZE");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > maximum) throw new Error("RECOVERY_ASSET_SIZE");
  return bytes;
}
self.onmessage = async ({ data }) => {
  if (data.type === "INIT") {
    if (closed) return;
    if (initialized) {
      sendError("RECOVERY_ALREADY_INITIALIZED");
      return;
    }
    initialized = true;
    generation = data.generation;
    startupAbort = new AbortController();
    try {
      if (
        !Number.isSafeInteger(generation) ||
        generation < 0 ||
        (data.delegate !== undefined && !["CPU", "GPU"].includes(data.delegate)) ||
        (data.mirrorTransform !== undefined && !["NONE", "PREVIEW_X"].includes(data.mirrorTransform)) ||
        !Number.isSafeInteger(data.geometryVersion ?? 1) ||
        (data.geometryVersion ?? 1) <= 0 ||
        ![data.frameWidth, data.frameHeight].every(
          (value) =>
            Number.isSafeInteger(value) &&
            value >= candidate.policy.startup.healthProbe.minimumDimension &&
            value <= candidate.policy.startup.healthProbe.maximumDimension,
        )
      )
        throw new Error("RECOVERY_INIT_CONTEXT");
      frameGeometry = Object.freeze({ width: data.frameWidth, height: data.frameHeight });
      const [bundle, taskBytes] = await Promise.all([
        fetchBytes("/reach/vendor/vision_bundle.js", 204618),
        fetchBytes("/reach/vendor/hand_landmarker.task", candidate.policy.taskBytes),
      ]);
      const assets = await candidate.verifyAssets(bundle, taskBytes);
      if (closed) return;
      const runtimeUrl = URL.createObjectURL(new Blob([bundle], { type: "application/javascript" }));
      try {
        importScripts(runtimeUrl);
      } finally {
        URL.revokeObjectURL(runtimeUrl);
      }
      const fileset = await exports.FilesetResolver.forVisionTasks("/reach/vendor/wasm");
      if (closed) return;
      let actualRegionProvider = true;
      let selectedDelegate = data.delegate ?? "CPU";
      const startupHealth = [];
      const createOriginalAfterGenericInitFailure = async (error) => {
        // Preserve the existing initialization-only original CPU fallback.
        // Integrity is verified outside this branch and cannot arrive here.
        if (!closeDetector() || error?.message === "RECOVERY_PARTIAL_CLOSE_FAILED")
          throw new Error("RECOVERY_PARTIAL_CLOSE_FAILED");
        if (closed) return;
        actualRegionProvider = false;
        fallbackReason = "RECOVERY_PROVIDER_INIT_UNAVAILABLE";
        detector = await exports.HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetBuffer: taskBytes, delegate: "CPU" },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });
        backend = "CPU_WASM";
        providerPolicy = "ORIGINAL_CPU";
      };
      try {
        detector = await candidate.create(fileset, assets, { delegate: selectedDelegate });
      } catch (error) {
        await createOriginalAfterGenericInitFailure(error);
      }
      if (closed) {
        if (!closeDetector()) throw new Error("RECOVERY_PARTIAL_CLOSE_FAILED");
        return;
      }
      const qualify = () => {
        let report;
        try {
          report = detector.qualifyStartupLatency(frameGeometry);
        } catch {
          report = { passed: false, delegate: selectedDelegate, reason: "STARTUP_PROBE_EXECUTION_FAILED" };
        }
        startupHealth.push(report);
        return report.passed === true;
      };
      if (actualRegionProvider && !qualify()) {
        if (!closeDetector()) throw new Error("RECOVERY_PARTIAL_CLOSE_FAILED");
        if (closed) return;
        if (selectedDelegate !== "GPU") throw new Error("RECOVERY_CPU_STARTUP_HEALTH_FAILED");
        selectedDelegate = "CPU";
        fallbackReason = "GPU_STARTUP_LATENCY_HEALTH_FAILED";
        try {
          detector = await candidate.create(fileset, assets, { delegate: "CPU" });
        } catch (error) {
          await createOriginalAfterGenericInitFailure(error);
        }
        if (closed) {
          if (!closeDetector()) throw new Error("RECOVERY_PARTIAL_CLOSE_FAILED");
          return;
        }
        if (actualRegionProvider && !qualify()) {
          if (!closeDetector()) throw new Error("RECOVERY_PARTIAL_CLOSE_FAILED");
          throw new Error("RECOVERY_CPU_STARTUP_HEALTH_FAILED");
        }
      }
      if (actualRegionProvider) {
        detector.reset({
          session: String(generation),
          geometry: String(data.geometryVersion ?? 1),
          mirror: data.mirrorTransform === "PREVIEW_X",
        });
        backend = selectedDelegate === "GPU" ? "GPU_WEBGL" : "CPU_WASM";
        providerPolicy = candidate.policy.version;
      }
      if (closed) {
        if (!closeDetector()) throw new Error("RECOVERY_PARTIAL_CLOSE_FAILED");
        return;
      }
      readyPublished = true;
      self.postMessage({
        type: "READY",
        generation,
        backend,
        providerPolicy,
        fallbackReason,
        startupHealth: {
          classification: "SYNTHETIC_PREREADY_LATENCY_NECESSARY_CONDITION_ONLY",
          attempts: startupHealth,
          probeDimensions: { ...frameGeometry },
          geometryVersion: data.geometryVersion ?? 1,
          mirrorTransform: data.mirrorTransform ?? "NONE",
          livePixelQualification: false,
        },
      });
    } catch (error) {
      failed = true;
      const cleaned = closeDetector();
      if (!closed)
        sendError(
          !cleaned
            ? "RECOVERY_PARTIAL_CLOSE_FAILED"
            : error instanceof Error
              ? error.message
              : "RECOVERY_INITIALIZATION_FAILED",
        );
      if (!cleaned || error?.message === "RECOVERY_PARTIAL_CLOSE_FAILED") self.close();
    } finally {
      startupAbort = null;
    }
  } else if (data.type === "FRAME") {
    try {
      if (failed || !readyPublished || !detector || data.generation !== generation) return;
      if (!data.bitmap || data.bitmap.width !== frameGeometry.width || data.bitmap.height !== frameGeometry.height)
        throw new Error("RECOVERY_FRAME_GEOMETRY_MISMATCH");
      const result = detector.detectForVideo(data.bitmap, data.capture);
      self.postMessage({
        type: "RESULT",
        generation,
        backend,
        providerPolicy,
        capture: data.capture,
        inferenceTime: performance.timeOrigin + performance.now(),
        width: data.bitmap.width,
        height: data.bitmap.height,
        result: { landmarks: result.landmarks, worldLandmarks: result.worldLandmarks, handedness: result.handedness },
      });
    } catch (error) {
      failed = true;
      readyPublished = false;
      const cleaned = closeDetector();
      sendError(
        cleaned
          ? error?.message === "RECOVERY_FRAME_GEOMETRY_MISMATCH"
            ? error.message
            : "MODEL_INFERENCE"
          : "RECOVERY_PARTIAL_CLOSE_FAILED",
      );
      if (!cleaned) self.close();
    } finally {
      data.bitmap?.close();
    }
  } else if (data.type === "CLOSE") {
    closed = true;
    failed = true;
    readyPublished = false;
    startupAbort?.abort();
    closeDetector();
    self.close();
  }
};
