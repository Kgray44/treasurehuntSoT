import { Quaternion, Vector3 } from "three";
import { createBrowserUuid } from "@/lib/browser-uuid";
import type { CameraLease } from "@/sextant/camera";
import {
  browserTrackingSampleSchema,
  hasLiveWorldPose,
  type BrowserTrackingSample,
  type BrowserWorldTrackingProvider,
} from "./browser-world-tracking";
import { cameraTrackingRay } from "./browser-tracking-rays";
import { waitForTrackingOperation } from "./browser-tracking-lifecycle";

// Only the MIT tracking sidecars are used. No Viro renderer or proprietary engine is loaded.
const base = "/api/dev/parallax-tracker/";
const wasmSha256 = "78f1942ec1048fc19f93c2b9edd7b1b52d067a9d0a76b7ec1ef34777298729c3";
type Engine = {
  configure(...values: number[]): void;
  start(): void;
  stop(): void;
  delete(): void;
  feedImu(...values: number[]): void;
  allocFrameBuffer(length: number): number;
  processFrame(width: number, height: number, stride: number, timestamp: number): number;
  poseQx(): number;
  poseQy(): number;
  poseQz(): number;
  poseQw(): number;
  posePx(): number;
  posePy(): number;
  posePz(): number;
  getStatus(): number;
  poseConfidence(): number;
  trackingReason(): number;
};
type Module = { SlamEngine: new () => Engine; HEAPU8: Uint8Array };
type Factory = (input: { wasmBinary: Uint8Array; print(): void; printErr(): void }) => Promise<Module>;
let loader: Promise<Factory> | undefined;
/** Allocation may replace the WASM heap; read the view only after allocating. */
export function writeTrackingFrame(
  module: { HEAPU8: Uint8Array },
  allocator: { allocFrameBuffer(length: number): number },
  pixels: Uint8Array,
) {
  const pointer = allocator.allocFrameBuffer(pixels.length);
  module.HEAPU8.set(pixels, pointer);
}
async function loadFactory(): Promise<Factory> {
  if (!loader) {
    loader = new Promise<Factory>((resolve, reject) => {
      const script = document.createElement("script");
      const fail = (message: string) => {
        clearTimeout(timeout);
        script.onload = script.onerror = null;
        script.remove();
        reject(new Error(message));
      };
      const timeout = setTimeout(() => fail("The local tracking module timed out. Retry browser AR."), 15000);
      script.src = `${base}tinyvio-slam.js`;
      script.integrity = "sha256-rt5wcCGbQOvRPQe+a3nWvjjVeoizm8isa5GcYc78KkA=";
      script.crossOrigin = "anonymous";
      script.onload = () => {
        clearTimeout(timeout);
        const factory = (globalThis as typeof globalThis & { SlamModule?: Factory }).SlamModule;
        if (typeof factory === "function") resolve(factory);
        else fail("The local browser tracking module did not initialize.");
      };
      script.onerror = () => {
        fail("The local browser tracking module could not load.");
      };
      document.head.appendChild(script);
    });
    loader.catch(() => {
      loader = undefined;
    });
  }
  return loader;
}

/** Call synchronously from a click before camera acquisition or asynchronous setup. */
export async function requestBrowserMotionPermission(): Promise<boolean> {
  const Motion = globalThis.DeviceMotionEvent as typeof DeviceMotionEvent & {
    requestPermission?: () => Promise<string>;
  };
  if (!Motion) return false;
  return Motion.requestPermission ? (await Motion.requestPermission()) === "granted" : true;
}

const reasons = [
  "",
  "Waiting for motion and gravity samples.",
  "Move sideways slowly; turning in place is not enough.",
  "Aim at a well-lit, detailed surface.",
  "More light is needed.",
  "Move more slowly.",
  "Tracking could not solve the camera position.",
];
const frameRotation = new Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);
const cameraFlip = new Quaternion(1, 0, 0, 0);
/** Pure coordinate boundary; provider-specific axes never enter authored geometry. */
export function tinyvioCameraPose(position: readonly number[], rotation: readonly number[]) {
  if (position.length !== 3 || rotation.length !== 4 || ![...position, ...rotation].every(Number.isFinite))
    throw new Error("PARALLAX_TRACKING_NONFINITE_POSE");
  const q = new Quaternion(...(rotation as [number, number, number, number]));
  if (Math.abs(q.lengthSq() - 1) > 0.02) throw new Error("PARALLAX_TRACKING_INVALID_ROTATION");
  const p = new Vector3(...(position as [number, number, number])).applyQuaternion(frameRotation);
  q.premultiply(frameRotation).multiply(cameraFlip).normalize();
  return { position: { x: p.x, y: p.y, z: p.z }, rotation: { x: q.x, y: q.y, z: q.z, w: q.w }, scale: 1 };
}

/** Local camera+IMU adapter. Camera pixels and sensor samples stay on the device. */
export class TinyvioBrowserProvider implements BrowserWorldTrackingProvider {
  readonly providerId = "parallax.browser.tinyvio.v1";
  readonly version = "@reactvision/viro-web-renderer@1.0.1";
  readonly method = "VISUAL_INERTIAL_SLAM" as const;
  private engine: Engine | null = null;
  private lease: CameraLease | null = null;
  private video: HTMLVideoElement | null = null;
  private cleanup: (() => void) | null = null;
  private animation = 0;
  private generation = 0;
  private latest: BrowserTrackingSample | null = null;
  private intrinsics: { width: number; height: number; focal: number } | null = null;
  read() {
    return this.latest;
  }
  cameraIntrinsics() {
    return this.intrinsics;
  }
  ray(x: number, y: number) {
    if (!this.latest || !this.intrinsics || !hasLiveWorldPose(this.latest, performance.now(), this.latest.sessionId))
      return null;
    return cameraTrackingRay({
      ...this.intrinsics,
      sessionId: this.latest.sessionId,
      camera: this.latest.sessionFromCamera!,
      x,
      y,
    });
  }
  // The pinned engine's plane basis/extents are not verified. Do not invent surface hits.
  planes() {
    return [];
  }
  hitTest() {
    return null;
  }
  async start(input: {
    lease: CameraLease;
    video: HTMLVideoElement;
    motionGranted: boolean;
    signal: AbortSignal;
    sample: (sample: BrowserTrackingSample) => void;
  }) {
    await this.stop();
    const generation = ++this.generation;
    this.lease = input.lease;
    this.video = input.video;
    let sessionId = createBrowserUuid();
    let lost = false;
    let hadWorldPose = false;
    const report = (
      status: BrowserTrackingSample["status"],
      reason: string,
      confidence: BrowserTrackingSample["confidence"] = "NONE",
      pose: BrowserTrackingSample["sessionFromCamera"] = null,
    ) => {
      if (generation !== this.generation) return;
      // A recovered map is not assumed to share the old origin. Never reuse old corner rays.
      if ((status === "LOST" || (status === "INITIALIZING" && hadWorldPose)) && !lost) {
        sessionId = createBrowserUuid();
        lost = true;
      }
      if (status === "TRACKING") {
        hadWorldPose = true;
        lost = false;
      }
      this.latest = browserTrackingSampleSchema.parse({
        sessionId,
        timestampMs: performance.now(),
        method: this.method,
        status,
        confidence,
        sessionFromCamera: pose,
        reason,
      });
      input.sample(this.latest);
    };
    try {
      if (!isSecureContext) throw new Error("Browser AR requires trusted HTTPS.");
      if (!input.motionGranted) throw new Error("Grant motion permission to initialize browser world tracking.");
      if (input.signal.aborted) throw new Error("Browser AR opening was cancelled.");
      report("INITIALIZING", "Opening the camera and local tracking engine…");
      input.video.muted = true;
      input.video.playsInline = true;
      input.video.srcObject = input.lease.stream;
      await waitForTrackingOperation(input.video.play(), input.signal, "The camera did not start. Retry browser AR.");
      const factory = await waitForTrackingOperation(
        loadFactory(),
        input.signal,
        "The local tracking module timed out. Retry browser AR.",
      );
      const binary = await waitForTrackingOperation(
        (async () => {
          const response = await fetch(`${base}tinyvio-slam.wasm`, {
            signal: input.signal,
            credentials: "same-origin",
          });
          if (!response.ok) throw new Error("The local tracking binary is unavailable.");
          return new Uint8Array(await response.arrayBuffer());
        })(),
        input.signal,
        "The local tracking download timed out. Retry browser AR.",
      );
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", binary));
      if (Array.from(digest, (n) => n.toString(16).padStart(2, "0")).join("") !== wasmSha256)
        throw new Error("The local tracking binary failed its integrity check.");
      const trackingModule = await waitForTrackingOperation(
        factory({ wasmBinary: binary, print() {}, printErr() {} }),
        input.signal,
        "The local tracking engine timed out. Retry browser AR.",
      );
      if (generation !== this.generation) return;
      if (input.signal.aborted) {
        await this.stop();
        return;
      }
      const engine = new trackingModule.SlamEngine();
      this.engine = engine;
      const sourceW = input.video.videoWidth,
        sourceH = input.video.videoHeight;
      if (!sourceW || !sourceH) throw new Error("The camera has not supplied a video frame.");
      const scale = Math.min(1, 480 / Math.max(sourceW, sourceH));
      const width = Math.round(sourceW * scale),
        height = Math.round(sourceH * scale),
        focal = 0.707 * Math.max(width, height);
      this.intrinsics = { width, height, focal };
      // Estimated camera intrinsics, no image warp/crop or lens-value UI. Scale remains explicitly relative.
      engine.configure(
        focal,
        focal,
        width / 2,
        height / 2,
        width,
        height,
        0,
        0,
        0,
        0,
        15,
        5e-3,
        5e-2,
        5e-4,
        1e-2,
        8,
        15,
        5,
        0,
        0,
        0,
        1,
      );
      engine.start();
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Camera frame processing is unavailable.");
      const gray = new Uint8Array(width * height);
      let lastVideoTime = -1,
        lastFrame = -Infinity,
        imuAt = -Infinity;
      const motion = (event: DeviceMotionEvent) => {
        const a = event.accelerationIncludingGravity,
          r = event.rotationRate;
        if (!a || !r || [a.x, a.y, a.z, r.alpha, r.beta, r.gamma].some((n) => n === null || !Number.isFinite(n)))
          return;
        imuAt = performance.now();
        const rad = Math.PI / 180;
        engine.feedImu(imuAt / 1000, a.x!, a.y!, a.z!, -r.beta! * rad, r.gamma! * rad, r.alpha! * rad);
      };
      const abort = () => {
        report("SUSPENDED", "Camera tracking paused. Restart and align the room again.");
        void this.stop();
      };
      const track = input.lease.stream.getVideoTracks()[0];
      const watchdog = setInterval(() => {
        if (performance.now() - lastFrame > 500) report("LIMITED", "Waiting for fresh camera frames.");
      }, 500);
      window.addEventListener("devicemotion", motion);
      window.addEventListener("orientationchange", abort);
      input.signal.addEventListener("abort", abort, { once: true });
      track.addEventListener("ended", abort, { once: true });
      this.cleanup = () => {
        clearInterval(watchdog);
        window.removeEventListener("devicemotion", motion);
        window.removeEventListener("orientationchange", abort);
        input.signal.removeEventListener("abort", abort);
        track.removeEventListener("ended", abort);
      };
      const frame = () => {
        if (generation !== this.generation) return;
        this.animation = requestAnimationFrame(frame);
        const now = performance.now();
        if (now - lastFrame < 33 || input.video.currentTime === lastVideoTime || input.video.readyState < 2) return;
        if (input.video.videoWidth !== sourceW || input.video.videoHeight !== sourceH) {
          abort();
          return;
        }
        lastFrame = now;
        lastVideoTime = input.video.currentTime;
        try {
          context.drawImage(input.video, 0, 0, width, height);
          const rgba = context.getImageData(0, 0, width, height).data;
          for (let i = 0; i < gray.length; i++)
            gray[i] = (rgba[i * 4] * 77 + rgba[i * 4 + 1] * 150 + rgba[i * 4 + 2] * 29) >> 8;
          writeTrackingFrame(trackingModule, engine, gray);
          if (engine.processFrame(width, height, width, now / 1000) !== 0) {
            report("LIMITED", "The camera frame could not be tracked.");
            return;
          }
          const status = engine.getStatus(),
            confidence = engine.poseConfidence(),
            reason = engine.trackingReason();
          if (now - imuAt > 500) {
            report("LIMITED", "Waiting for fresh motion samples.");
            return;
          }
          if (status !== 2 || confidence < 2 || reason !== 0) {
            report(
              status === 3 ? "LOST" : status <= 1 ? "INITIALIZING" : "LIMITED",
              reasons[reason] ?? "Tracking is limited.",
              confidence === 1 ? "ROTATION_ONLY" : "NONE",
            );
            return;
          }
          const pose = tinyvioCameraPose(
            [engine.posePx(), engine.posePy(), engine.posePz()],
            [engine.poseQx(), engine.poseQy(), engine.poseQz(), engine.poseQw()],
          );
          report("TRACKING", "Relative world tracking. Align the room before interacting.", "POSITION_NO_SCALE", pose);
        } catch {
          report("LOST", "Tracking stopped unexpectedly. Restart and align the room again.");
          void this.stop();
        }
      };
      frame();
    } catch (error) {
      report("SUSPENDED", error instanceof Error ? error.message : "Browser tracking could not open.");
      if (generation === this.generation) await this.stop();
      throw error;
    }
  }
  async stop() {
    ++this.generation;
    cancelAnimationFrame(this.animation);
    this.cleanup?.();
    this.cleanup = null;
    this.engine?.stop();
    this.engine?.delete();
    this.engine = null;
    this.lease?.release();
    this.lease = null;
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
    }
    this.video = null;
    this.latest = null;
    this.intrinsics = null;
  }
}
