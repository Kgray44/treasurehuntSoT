import { Quaternion, Vector3 } from "three";
import { createBrowserUuid } from "@/lib/browser-uuid";
import type { BrowserTrackingSample, BrowserWorldTrackingProvider } from "./browser-world-tracking";
import { browserTrackingSampleSchema, hasLiveWorldPose } from "./browser-world-tracking";
import { cameraTrackingRay } from "./browser-tracking-rays";
import { waitForTrackingOperation } from "./browser-tracking-lifecycle";
import {
  admitsPublicSourceFrame,
  browserCameraRotation,
  publicSourceCameraPose,
  publicSourceRotationInput,
} from "./public-source-tracking-pose";

const base = "/api/dev/parallax-tracker/";
const wasmSha256 = "8fdd5d411163ee6bc7065efdf73b5a1ca33096341ecdda8cb1a3ee4b2ef844d1";
type Module = {
  HEAPU8: Uint8Array;
  HEAPF64: Float64Array;
  _malloc(bytes: number): number;
  _free(pointer: number): void;
  _setCameraIntrinsics(width: number, height: number, fx: number, fy: number, cx: number, cy: number): number;
  _processFrameWithPoseInput(frame: number, width: number, height: number, rotation: number): number;
  _getFrameStats(pointer: number): void;
};
type Factory = (input: { wasmBinary: Uint8Array; print(): void; printErr(): void }) => Promise<Module>;
let loader: Promise<Factory> | undefined;
function loadFactory(): Promise<Factory> {
  if (!loader) {
    loader = new Promise<Factory>((resolve, reject) => {
      const script = document.createElement("script");
      const fail = () => {
        clearTimeout(timer);
        script.onload = script.onerror = null;
        script.remove();
        reject(new Error("The public-source tracking module could not load. Retry browser AR."));
      };
      const timer = setTimeout(fail, 15000);
      script.src = `${base}public-source-slam.js`;
      script.integrity = "sha256-nwP+pag3AiyFHMOCDuWk9foEeXmTjFFsD4OzfbIharw=";
      script.crossOrigin = "anonymous";
      script.onload = () => {
        clearTimeout(timer);
        const factory = (globalThis as typeof globalThis & { createARModule?: Factory }).createARModule;
        if (typeof factory === "function") resolve(factory);
        else fail();
      };
      script.onerror = fail;
      document.head.appendChild(script);
    });
    loader.catch(() => {
      loader = undefined;
    });
  }
  return loader;
}

/** Must be invoked within the same direct user gesture as motion/camera permission. */
export function requestBrowserOrientationPermission(): Promise<boolean> {
  const Orientation = globalThis.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<string>;
  };
  if (!Orientation) return Promise.resolve(false);
  return Orientation.requestPermission
    ? Orientation.requestPermission().then((value) => value === "granted")
    : Promise.resolve(true);
}

/** Public, rebuildable Apache source experiment. Local prototype only, relative visual SLAM.
 * Device orientation supplies rotation; fresh image-to-map PnP must independently supply position.
 * Camera pixels, sensor values, map points and engine state remain ephemeral on this device.
 */
export class PublicSourceBrowserProvider implements BrowserWorldTrackingProvider {
  readonly providerId = "parallax.browser.public-source.v1";
  readonly version = "slam_wasm@e4ebca91+parallax-camera-prototype-20261014";
  readonly method = "VISUAL_SLAM" as const;
  private generation = 0;
  private latest: BrowserTrackingSample | null = null;
  private intrinsics: { width: number; height: number; focal: number } | null = null;
  private cleanup: (() => void) | null = null;
  private animation = 0;
  read() {
    return this.latest;
  }
  cameraIntrinsics() {
    return this.intrinsics;
  }
  planes() {
    return [];
  }
  hitTest() {
    return null;
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
  async start(input: Parameters<BrowserWorldTrackingProvider["start"]>[0]) {
    await this.stop();
    const generation = ++this.generation;
    let sessionId: string;
    try {
      sessionId = createBrowserUuid();
    } catch (cause) {
      input.lease.release();
      throw cause;
    }
    let trackingModule: Module | null = null,
      pointers: number[] = [];
    const report = (
      status: BrowserTrackingSample["status"],
      reason: string,
      pose: BrowserTrackingSample["sessionFromCamera"] = null,
    ) => {
      if (generation !== this.generation) return;
      this.latest = browserTrackingSampleSchema.parse({
        sessionId,
        timestampMs: performance.now(),
        method: this.method,
        status,
        confidence: pose ? "POSITION_NO_SCALE" : "NONE",
        sessionFromCamera: pose,
        reason,
      });
      input.sample(this.latest);
    };
    const release = () => {
      if (trackingModule) for (const pointer of pointers) if (pointer) trackingModule._free(pointer);
      pointers = [];
      trackingModule = null;
      input.lease.release();
      input.video.pause();
      input.video.srcObject = null;
    };
    this.cleanup = release;
    try {
      if (!isSecureContext || !input.motionGranted)
        throw new Error("Grant camera and motion permissions using trusted HTTPS.");
      if (input.signal.aborted) throw new Error("Browser AR opening was cancelled.");
      report("INITIALIZING", "Opening the camera and public-source tracking prototype…");
      input.video.muted = true;
      input.video.playsInline = true;
      input.video.srcObject = input.lease.stream;
      await waitForTrackingOperation(input.video.play(), input.signal, "The camera did not start. Retry browser AR.");
      const factory = await waitForTrackingOperation(loadFactory(), input.signal, "Tracking module loading timed out.");
      const binary = await waitForTrackingOperation(
        (async () => {
          const response = await fetch(`${base}public-source-slam.wasm`, {
            signal: input.signal,
            credentials: "same-origin",
          });
          if (!response.ok) throw new Error("The local public-source binary is unavailable.");
          return new Uint8Array(await response.arrayBuffer());
        })(),
        input.signal,
        "Tracking download timed out.",
      );
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", binary));
      if (Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join("") !== wasmSha256)
        throw new Error("The public-source tracking binary failed its integrity check.");
      const initialized = await waitForTrackingOperation(
        factory({ wasmBinary: binary, print() {}, printErr() {} }),
        input.signal,
        "Tracking initialization timed out.",
      );
      if (generation !== this.generation) return;
      if (input.signal.aborted) throw new Error("Browser AR opening was cancelled.");
      trackingModule = initialized;
      const sourceW = input.video.videoWidth,
        sourceH = input.video.videoHeight;
      if (!sourceW || !sourceH) throw new Error("The camera has not supplied a frame.");
      const scale = Math.min(1, 320 / Math.max(sourceW, sourceH)),
        width = Math.round(sourceW * scale),
        height = Math.round(sourceH * scale);
      const focal = 0.707 * Math.max(width, height);
      this.intrinsics = { width, height, focal };
      // Shared estimated projection only. No lens input, crop, unwarp, metric scale or calibration claim.
      if (trackingModule._setCameraIntrinsics(width, height, focal, focal, width / 2, height / 2) !== 1)
        throw new Error("The tracking camera projection could not initialize.");
      for (const bytes of [width * height * 4, 12 * 8, 11 * 8]) pointers.push(trackingModule._malloc(bytes));
      const [framePointer, rotationPointer, statsPointer] = pointers;
      if (pointers.some((pointer) => !pointer)) throw new Error("The tracking prototype could not allocate memory.");
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Camera frame processing is unavailable.");
      let orientation: Quaternion | null = null,
        yawOrigin: Quaternion | null = null,
        orientationAt = -Infinity;
      let lastFrame = -Infinity,
        lastVideoTime = -1,
        hadWorldPose = false;
      const screenAngle = () =>
        screen.orientation?.angle ?? (window as Window & { orientation?: number }).orientation ?? 0;
      const orient = (event: DeviceOrientationEvent) => {
        if ([event.alpha, event.beta, event.gamma].some((value) => value === null || !Number.isFinite(value))) return;
        const camera = browserCameraRotation(event.alpha!, event.beta!, event.gamma!, screenAngle());
        if (!yawOrigin) {
          const forward = new Vector3(0, 0, -1).applyQuaternion(camera);
          // Wait until a useful horizontal heading exists. Keep gravity up, remove only initial yaw.
          if (Math.hypot(forward.x, forward.z) < 0.15) return;
          yawOrigin = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.atan2(-forward.x, -forward.z));
        }
        orientation = camera.premultiply(yawOrigin);
        orientationAt = performance.now();
      };
      const suspend = () => {
        report("SUSPENDED", "Camera tracking paused. Restart and align the room again.");
        void this.stop();
      };
      const track = input.lease.stream.getVideoTracks()[0];
      if (!track) throw new Error("The camera stream ended.");
      const watchdog = setInterval(() => {
        if (performance.now() - lastFrame > 500) report("LIMITED", "Waiting for fresh camera frames.");
      }, 500);
      window.addEventListener("deviceorientation", orient);
      window.addEventListener("orientationchange", suspend);
      input.signal.addEventListener("abort", suspend, { once: true });
      track.addEventListener("ended", suspend, { once: true });
      this.cleanup = () => {
        clearInterval(watchdog);
        window.removeEventListener("deviceorientation", orient);
        window.removeEventListener("orientationchange", suspend);
        input.signal.removeEventListener("abort", suspend);
        track.removeEventListener("ended", suspend);
        release();
      };
      const frame = () => {
        if (generation !== this.generation || !trackingModule) return;
        this.animation = requestAnimationFrame(frame);
        const now = performance.now();
        if (now - lastFrame < 100 || input.video.currentTime === lastVideoTime || input.video.readyState < 2) return;
        if (input.video.videoWidth !== sourceW || input.video.videoHeight !== sourceH) {
          suspend();
          return;
        }
        lastFrame = now;
        lastVideoTime = input.video.currentTime;
        if (!orientation || now - orientationAt > 250) {
          report("LIMITED", "Waiting for fresh device orientation. Hold the phone upright.");
          return;
        }
        try {
          context.drawImage(input.video, 0, 0, width, height);
          trackingModule.HEAPU8.set(context.getImageData(0, 0, width, height).data, framePointer);
          trackingModule.HEAPF64.set([...publicSourceRotationInput(orientation), 0, 0, 0], rotationPointer / 8);
          const posePointer = trackingModule._processFrameWithPoseInput(framePointer, width, height, rotationPointer);
          trackingModule._getFrameStats(statsPointer);
          const stats = Array.from(trackingModule.HEAPF64.subarray(statsPointer / 8, statsPointer / 8 + 11));
          if (!admitsPublicSourceFrame(stats) || performance.now() - orientationAt > 500) {
            report(
              hadWorldPose && stats[0] < 8 ? "LOST" : hadWorldPose ? "LIMITED" : "INITIALIZING",
              stats[0] < 8
                ? "Aim at a well-lit, detailed surface."
                : "Move sideways slowly to build the visual map; turning alone is not enough.",
            );
            return;
          }
          if (!posePointer || posePointer % 8 || posePointer / 8 + 12 > trackingModule.HEAPF64.length)
            throw new Error("Invalid tracking output.");
          const pose = publicSourceCameraPose(
            Array.from(trackingModule.HEAPF64.subarray(posePointer / 8, posePointer / 8 + 12)),
          );
          hadWorldPose = true;
          report("TRACKING", "Relative visual world tracking. Align the room before interacting.", pose);
        } catch {
          report("LOST", "Tracking stopped unexpectedly. Restart and align again.");
          void this.stop();
        }
      };
      frame();
    } catch (cause) {
      report("SUSPENDED", cause instanceof Error ? cause.message : "Public-source tracking could not open.");
      if (generation === this.generation) await this.stop();
      throw cause;
    }
  }
  async stop() {
    ++this.generation;
    cancelAnimationFrame(this.animation);
    this.cleanup?.();
    this.cleanup = null;
    this.latest = null;
    this.intrinsics = null;
  }
}
