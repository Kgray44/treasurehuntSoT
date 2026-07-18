"use strict";
const { ipcRenderer } = require("electron");

let active = null;

function emit(type, payload = {}) {
  ipcRenderer.send("capture-worker:event", { type, ...payload });
}

function response(requestId, ok, payload = {}) {
  emit("response", { requestId, ok, payload });
}

function preferredMimeType() {
  for (const type of ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

async function startCapture(requestId, configuration) {
  if (active) throw new Error("CAPTURE_WORKER_ALREADY_ACTIVE");
  const mandatory = {
    chromeMediaSource: "desktop",
    chromeMediaSourceId: configuration.sourceId,
    minFrameRate: configuration.sampleFps,
    maxFrameRate: Math.max(configuration.sampleFps, 30),
  };
  const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { mandatory } });
  const video = document.createElement("video");
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.srcObject = stream;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("CAPTURE_WORKER_METADATA_TIMEOUT")), 8_000);
    video.onloadedmetadata = async () => {
      clearTimeout(timeout);
      await video.play();
      resolve();
    };
    video.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("CAPTURE_WORKER_VIDEO_ERROR"));
    };
  });
  const canvas = new OffscreenCanvas(configuration.analysisWidth, configuration.analysisHeight);
  const context = canvas.getContext("2d", { alpha: false, desynchronized: true, willReadFrequently: true });
  if (!context) throw new Error("CAPTURE_WORKER_CANVAS_UNAVAILABLE");
  const track = stream.getVideoTracks()[0];
  const settings = track.getSettings();
  active = {
    sessionId: configuration.sessionId,
    mode: configuration.mode,
    stream,
    track,
    video,
    canvas,
    context,
    frameTimer: null,
    recorder: null,
    pendingChunkTransfers: new Set(),
    paused: false,
    emittedFrames: 0,
    startedAtMs: Date.now(),
    originalDimensions: { width: settings.width ?? video.videoWidth, height: settings.height ?? video.videoHeight },
    encoding: null,
  };
  track.addEventListener("ended", () => emit("ended", { sessionId: configuration.sessionId, reason: "TRACK_ENDED" }));
  track.addEventListener("mute", () => emit("track-muted", { sessionId: configuration.sessionId }));
  track.addEventListener("unmute", () => emit("track-unmuted", { sessionId: configuration.sessionId }));
  if (configuration.mode === "CREATOR_RECORDING") {
    const captureState = active;
    const mimeType = preferredMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 6_000_000 } : undefined);
    recorder.addEventListener("dataavailable", (event) => {
      if (!event.data.size) return;
      const transfer = event.data
        .arrayBuffer()
        .then((arrayBuffer) => {
          const binary = new Uint8Array(arrayBuffer);
          emit("recording-chunk", { sessionId: configuration.sessionId, chunk: binary });
        })
        .finally(() => captureState.pendingChunkTransfers.delete(transfer));
      captureState.pendingChunkTransfers.add(transfer);
    });
    recorder.addEventListener("error", (event) =>
      emit("error", { sessionId: configuration.sessionId, message: event.error?.message ?? "CAPTURE_ENCODER_ERROR" }),
    );
    recorder.start(1_000);
    active.recorder = recorder;
    active.encoding = recorder.mimeType || mimeType || "video/webm";
  }
  const intervalMs = Math.max(50, Math.round(1_000 / configuration.sampleFps));
  active.frameTimer = setInterval(() => {
    if (!active || active.paused || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    try {
      context.drawImage(video, 0, 0, configuration.analysisWidth, configuration.analysisHeight);
      const image = context.getImageData(0, 0, configuration.analysisWidth, configuration.analysisHeight);
      emit("frame", {
        sessionId: configuration.sessionId,
        capturedAtMs: Date.now(),
        width: configuration.analysisWidth,
        height: configuration.analysisHeight,
        originalWidth: video.videoWidth,
        originalHeight: video.videoHeight,
        pixels: image.data,
      });
      active.emittedFrames += 1;
    } catch (error) {
      emit("error", { sessionId: configuration.sessionId, message: error.message });
    }
  }, intervalMs);
  response(requestId, true, {
    sessionId: configuration.sessionId,
    originalDimensions: active.originalDimensions,
    encoding: active.encoding,
  });
}

async function stopCapture(requestId, sessionId, cancelled = false) {
  if (!active || active.sessionId !== sessionId) {
    response(requestId, true, { sessionId, idempotent: true });
    return;
  }
  const current = active;
  active = null;
  clearInterval(current.frameTimer);
  if (current.recorder && current.recorder.state !== "inactive") {
    await new Promise((resolve) => {
      current.recorder.addEventListener("stop", resolve, { once: true });
      if (current.recorder.state === "paused") current.recorder.resume();
      current.recorder.stop();
    });
    await Promise.all([...current.pendingChunkTransfers]);
  }
  for (const track of current.stream.getTracks()) track.stop();
  current.video.srcObject = null;
  const elapsedMs = Math.max(1, Date.now() - current.startedAtMs);
  response(requestId, true, {
    sessionId,
    cancelled,
    originalDimensions: current.originalDimensions,
    estimatedFrameRate: current.emittedFrames / (elapsedMs / 1_000),
    emittedFrames: current.emittedFrames,
    encoding: current.encoding,
  });
}

async function handleCommand(message) {
  try {
    if (message.command === "start") return await startCapture(message.requestId, message.payload);
    if (message.command === "pause") {
      if (!active || active.sessionId !== message.payload.sessionId)
        return response(message.requestId, true, { idempotent: true });
      active.paused = true;
      if (active.recorder?.state === "recording") active.recorder.pause();
      return response(message.requestId, true, { state: "PAUSED" });
    }
    if (message.command === "resume") {
      if (!active || active.sessionId !== message.payload.sessionId)
        return response(message.requestId, true, { idempotent: true });
      active.paused = false;
      if (active.recorder?.state === "paused") active.recorder.resume();
      return response(message.requestId, true, { state: "CAPTURING" });
    }
    if (message.command === "stop") return await stopCapture(message.requestId, message.payload.sessionId, false);
    if (message.command === "cancel") return await stopCapture(message.requestId, message.payload.sessionId, true);
    throw new Error("CAPTURE_WORKER_COMMAND_NOT_ALLOWED");
  } catch (error) {
    response(message.requestId, false, { message: String(error?.message || "CAPTURE_WORKER_ERROR").slice(0, 300) });
  }
}

ipcRenderer.on("capture-worker:command", (_event, message) => void handleCommand(message));
emit("ready", {});
