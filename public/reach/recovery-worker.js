/* Unreferenced Watchglass recovery candidate. Existing hand-worker.js stays canonical. */
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
        (data.geometryVersion ?? 1) <= 0
      )
        throw new Error("RECOVERY_INIT_CONTEXT");
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
      try {
        detector = await candidate.create(fileset, assets, { delegate: data.delegate ?? "CPU" });
        detector.reset({
          session: String(generation),
          geometry: String(data.geometryVersion ?? 1),
          mirror: data.mirrorTransform === "PREVIEW_X",
        });
        backend = data.delegate === "GPU" ? "GPU_WEBGL" : "CPU_WASM";
        providerPolicy = candidate.policy.version;
      } catch (error) {
        // Initialization-only fallback: never change model/backend within an
        // established capture generation. Asset integrity failure cannot reach here.
        if (!closeDetector() || error?.message === "RECOVERY_PARTIAL_CLOSE_FAILED")
          throw new Error("RECOVERY_PARTIAL_CLOSE_FAILED");
        if (closed) return;
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
      }
      if (closed) {
        closeDetector();
        return;
      }
      self.postMessage({ type: "READY", generation, backend, providerPolicy, fallbackReason });
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
      if (failed || !detector || data.generation !== generation) return;
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
    } catch {
      failed = true;
      const cleaned = closeDetector();
      sendError(cleaned ? "MODEL_INFERENCE" : "RECOVERY_PARTIAL_CLOSE_FAILED");
      if (!cleaned) self.close();
    } finally {
      data.bitmap?.close();
    }
  } else if (data.type === "CLOSE") {
    closed = true;
    failed = true;
    startupAbort?.abort();
    closeDetector();
    self.close();
  }
};
