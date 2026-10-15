import { Matrix4, Quaternion, Vector3 } from "three";
import { createBrowserUuid } from "@/lib/browser-uuid";
import type { Transform } from "./contracts";
import {
  browserTrackingSampleSchema,
  hasLiveWorldPose,
  type BrowserTrackingSample,
  type BrowserWorldTrackingProvider,
} from "./browser-world-tracking";
import { waitForTrackingOperation } from "./browser-tracking-lifecycle";

/** Issued only by the authenticated local availability route after entitlement and bundle verification. */
export type ZapparAuthorizedConfig = {
  version: "4.4.0";
  scriptUrl: string;
  integrity: string;
};
type ZapparAnchor = {
  id: string;
  status: number;
  poseCameraRelative(mirror?: boolean): Float32Array;
};
type ZapparPipeline = {
  glContextSet(gl: WebGLRenderingContext): void;
  glContextLost(): void;
  processGL(): void;
  frameUpdate(): void;
  frameNumber(): number;
  projectionMatrix(width: number, height: number, near?: number, far?: number): Float32Array;
  cameraPoseWithOrigin(origin: Float32Array): Float32Array;
  destroy(): void;
};
type ZapparWorldTracker = {
  quality: number;
  worldAnchor: ZapparAnchor;
  scaleMode: number;
  destroy(): void;
};
type ZapparElementSource = { start(): void; pause(): void; destroy(): void };

/** Public 4.4.0 API subset. No proprietary SDK code or binary is included in this adapter. */
export type ZapparSdk = {
  Pipeline: new () => ZapparPipeline;
  WorldTracker: new (pipeline: ZapparPipeline) => ZapparWorldTracker;
  HTMLElementSource: new (pipeline: ZapparPipeline, video: HTMLVideoElement) => ZapparElementSource;
  WorldScaleMode: { ABSOLUTE: number };
  WorldTrackerQuality: {
    WORLD_TRACKER_QUALITY_INITIALIZING: number;
    WORLD_TRACKER_QUALITY_GOOD: number;
    WORLD_TRACKER_QUALITY_LIMITED: number;
    WORLD_TRACKER_QUALITY_INACTIVE: number;
  };
  AnchorStatus: {
    ANCHOR_STATUS_INITIALIZING: number;
    ANCHOR_STATUS_TRACKING: number;
    ANCHOR_STATUS_PAUSED: number;
    ANCHOR_STATUS_STOPPED: number;
  };
  loadedPromise(): Promise<void>;
};
type Dependencies = {
  loadSdk?: (config: ZapparAuthorizedConfig, signal: AbortSignal) => Promise<ZapparSdk>;
  createCanvas?: () => HTMLCanvasElement;
  now?: () => number;
};

function assertAuthorizedConfig(config: ZapparAuthorizedConfig) {
  if (
    config?.version !== "4.4.0" ||
    config.scriptUrl !== "/api/dev/parallax-tracker/zappar-4.4.0.js" ||
    !/^sha256-[A-Za-z0-9+/]{43}=$/.test(config.integrity)
  )
    throw new Error("A verified local Zappar entitlement and pinned SDK bundle are required.");
}

/** Never downloads a vendor SDK. The local route owns authorization, origin and byte checks. */
export async function loadAuthorizedZapparSdk(config: ZapparAuthorizedConfig, signal: AbortSignal): Promise<ZapparSdk> {
  assertAuthorizedConfig(config);
  if (signal.aborted) throw new Error("Browser AR opening was cancelled.");
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      script.onload = script.onerror = null;
      script.remove();
    };
    const fail = (message: string) => {
      cleanup();
      reject(new Error(message));
    };
    const abort = () => fail("Browser AR opening was cancelled.");
    const timer = setTimeout(
      () => fail("The authorized Zappar SDK did not load. Check the provisioned distribution."),
      15000,
    );
    script.src = config.scriptUrl;
    script.integrity = config.integrity;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      const sdk = (globalThis as typeof globalThis & { Zappar?: ZapparSdk }).Zappar;
      if (
        !sdk ||
        typeof sdk.Pipeline !== "function" ||
        typeof sdk.WorldTracker !== "function" ||
        typeof sdk.HTMLElementSource !== "function" ||
        typeof sdk.loadedPromise !== "function" ||
        !sdk.WorldTrackerQuality ||
        !sdk.AnchorStatus ||
        !sdk.WorldScaleMode
      ) {
        fail("The provisioned Zappar bundle does not expose the required WorldTracker API.");
        return;
      }
      cleanup();
      resolve(sdk);
    };
    script.onerror = () => fail("The authorized Zappar SDK is unavailable or failed its integrity check.");
    signal.addEventListener("abort", abort, { once: true });
    document.head.appendChild(script);
  });
}

/** Zappar already returns +Y up, camera -Z, column-major poses; reject scale, reflection and malformed matrices. */
export function zapparCameraPose(values: ArrayLike<number>): Transform {
  if (values.length !== 16 || !Array.from(values).every(Number.isFinite))
    throw new Error("PARALLAX_ZAPPAR_INVALID_POSE");
  const matrix = new Matrix4().fromArray(Array.from(values));
  const x = new Vector3().setFromMatrixColumn(matrix, 0),
    y = new Vector3().setFromMatrixColumn(matrix, 1),
    z = new Vector3().setFromMatrixColumn(matrix, 2);
  if (
    Math.abs(values[3]) > 1e-5 ||
    Math.abs(values[7]) > 1e-5 ||
    Math.abs(values[11]) > 1e-5 ||
    Math.abs(values[15] - 1) > 1e-5 ||
    Math.abs(x.lengthSq() - 1) > 0.02 ||
    Math.abs(y.lengthSq() - 1) > 0.02 ||
    Math.abs(z.lengthSq() - 1) > 0.02 ||
    Math.max(Math.abs(x.dot(y)), Math.abs(x.dot(z)), Math.abs(y.dot(z))) > 0.02 ||
    matrix.determinant() <= 0
  )
    throw new Error("PARALLAX_ZAPPAR_NONRIGID_POSE");
  const position = new Vector3(),
    rotation = new Quaternion(),
    scale = new Vector3();
  matrix.decompose(position, rotation, scale);
  rotation.normalize();
  return {
    position: { x: position.x, y: position.y, z: position.z },
    rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
    scale: 1,
  };
}

/** Camera pixels stay in the leased video and a processing-only WebGL context. The canonical renderer owns all content. */
export class ZapparBrowserProvider implements BrowserWorldTrackingProvider {
  readonly providerId = "parallax.browser.zappar-world.v1";
  readonly version = "@zappar/zappar@4.4.0";
  readonly method = "VISUAL_SLAM" as const;
  private generation = 0;
  private latest: BrowserTrackingSample | null = null;
  private pipeline: ZapparPipeline | null = null;
  private intrinsics: { width: number; height: number; focal: number } | null = null;
  private cleanup: (() => void) | null = null;
  private opening: AbortController | null = null;
  private animation = 0;
  private readonly now: () => number;
  constructor(
    private config: ZapparAuthorizedConfig,
    private dependencies: Dependencies = {},
  ) {
    this.now = dependencies.now ?? (() => performance.now());
  }
  read() {
    return this.latest;
  }
  cameraIntrinsics() {
    return this.intrinsics;
  }
  cameraProjection(width: number, height: number, near: number, far: number): Float32Array | null {
    if (
      !this.pipeline ||
      ![width, height, near, far].every(Number.isFinite) ||
      Math.min(width, height, near) <= 0 ||
      far <= near
    )
      return null;
    try {
      const projection = this.pipeline.projectionMatrix(width, height, near, far);
      if (
        projection.length !== 16 ||
        !Array.from(projection).every(Number.isFinite) ||
        Math.abs(new Matrix4().fromArray(projection).determinant()) < 1e-12
      )
        return null;
      return new Float32Array(projection);
    } catch {
      return null;
    }
  }
  ray(x: number, y: number) {
    const sample = this.latest,
      intrinsics = this.intrinsics;
    if (
      !sample ||
      !intrinsics ||
      !hasLiveWorldPose(sample, this.now(), sample.sessionId) ||
      ![x, y].every(Number.isFinite) ||
      x < 0 ||
      x > 1 ||
      y < 0 ||
      y > 1
    )
      return null;
    const projection = this.cameraProjection(intrinsics.width, intrinsics.height, 0.005, 1000);
    if (!projection) return null;
    const pose = sample.sessionFromCamera!;
    const direction = new Vector3(2 * x - 1, 1 - 2 * y, -1)
      .applyMatrix4(new Matrix4().fromArray(projection).invert())
      .normalize()
      .applyQuaternion(new Quaternion(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w));
    return {
      sessionId: sample.sessionId,
      origin: { ...pose.position },
      direction: { x: direction.x, y: direction.y, z: direction.z },
    };
  }
  // Room registration uses observed corner rays. Plane polygons are not advertised as rectangular depth or occlusion meshes.
  planes() {
    return [];
  }
  hitTest() {
    return null;
  }
  async start(input: Parameters<BrowserWorldTrackingProvider["start"]>[0]) {
    await this.stop();
    const generation = ++this.generation,
      opening = new AbortController();
    this.opening = opening;
    let sessionId = "",
      anchorId = "",
      hadWorldPose = false,
      invalidated = false;
    const report = (status: BrowserTrackingSample["status"], reason: string, pose: Transform | null = null) => {
      if (generation !== this.generation) return;
      this.latest = browserTrackingSampleSchema.parse({
        sessionId,
        timestampMs: this.now(),
        method: this.method,
        status,
        // Vendor scale is approximate. Existing measured room correspondences remain the scale authority.
        confidence: status === "TRACKING" ? "POSITION_NO_SCALE" : "NONE",
        sessionFromCamera: pose,
        reason,
      });
      input.sample(this.latest);
    };
    const invalidate = () => {
      if (hadWorldPose && !invalidated) {
        sessionId = createBrowserUuid();
        invalidated = true;
      }
    };
    let source: ZapparElementSource | null = null,
      tracker: ZapparWorldTracker | null = null,
      pipeline: ZapparPipeline | null = null,
      canvas: HTMLCanvasElement | null = null,
      gl: WebGLRenderingContext | null = null;
    let watchdog: ReturnType<typeof setInterval> | undefined;
    const detach: (() => void)[] = [];
    const dispose = (operation: () => void) => {
      try {
        operation();
      } catch {
        /* Continue releasing the lease after SDK teardown failures. */
      }
    };
    this.cleanup = () => {
      clearInterval(watchdog);
      detach.forEach((remove) => remove());
      if (source) {
        dispose(() => source!.pause());
        dispose(() => source!.destroy());
      }
      if (tracker) dispose(() => tracker!.destroy());
      if (pipeline) {
        dispose(() => pipeline!.glContextLost());
        dispose(() => pipeline!.destroy());
      }
      if (gl) dispose(() => gl!.getExtension("WEBGL_lose_context")?.loseContext());
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
        canvas.remove();
      }
      if (input.video.srcObject === input.lease.stream) {
        dispose(() => input.video.pause());
        input.video.srcObject = null;
      }
      input.lease.release();
    };
    const suspend = (reason: string) => {
      invalidate();
      report("SUSPENDED", reason);
      void this.stop();
    };
    const abort = () => suspend("Camera tracking paused. Restart and align the room again.");
    input.signal.addEventListener("abort", abort, { once: true });
    detach.push(() => input.signal.removeEventListener("abort", abort));
    try {
      assertAuthorizedConfig(this.config);
      if (!globalThis.isSecureContext) throw new Error("Browser AR requires trusted HTTPS.");
      if (!input.motionGranted)
        throw new Error("Grant motion and orientation permission to initialize Zappar world tracking.");
      if (input.signal.aborted) throw new Error("Browser AR opening was cancelled.");
      const tracks = input.lease.stream.getVideoTracks();
      if (tracks.length !== 1 || tracks[0].readyState !== "live")
        throw new Error("A live exclusive camera lease is required.");
      sessionId = createBrowserUuid();
      report("INITIALIZING", "Opening the authorized Zappar world tracker…");
      const sdk = await waitForTrackingOperation(
        (this.dependencies.loadSdk ?? loadAuthorizedZapparSdk)(this.config, opening.signal),
        opening.signal,
        "The authorized Zappar SDK timed out. Check its local distribution.",
      );
      await waitForTrackingOperation(
        sdk.loadedPromise(),
        opening.signal,
        "Zappar could not initialize its tracking module.",
      );
      if (generation !== this.generation) throw new Error("Browser AR opening was cancelled.");
      input.video.muted = true;
      input.video.playsInline = true;
      input.video.srcObject = input.lease.stream;
      await waitForTrackingOperation(input.video.play(), opening.signal, "The camera did not start. Retry browser AR.");
      if (generation !== this.generation) throw new Error("Browser AR opening was cancelled.");
      const sourceWidth = input.video.videoWidth,
        sourceHeight = input.video.videoHeight;
      if (!sourceWidth || !sourceHeight) throw new Error("The camera has not supplied a video frame.");
      canvas = (this.dependencies.createCanvas ?? (() => document.createElement("canvas")))();
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      gl = canvas.getContext("webgl", { alpha: false, antialias: false });
      if (!gl) throw new Error("WebGL camera processing is unavailable.");
      pipeline = new sdk.Pipeline();
      this.pipeline = pipeline;
      pipeline.glContextSet(gl);
      tracker = new sdk.WorldTracker(pipeline);
      tracker.scaleMode = sdk.WorldScaleMode.ABSOLUTE;
      source = new sdk.HTMLElementSource(pipeline, input.video);
      source.start();
      const lostContext = (event: Event) => {
        event.preventDefault();
        suspend("Camera processing was interrupted. Restart and align again.");
      };
      const hidden = () => {
        if (document.visibilityState === "hidden") abort();
      };
      canvas.addEventListener("webglcontextlost", lostContext);
      tracks[0].addEventListener("ended", abort, { once: true });
      tracks[0].addEventListener("mute", abort, { once: true });
      window.addEventListener("orientationchange", abort);
      document.addEventListener("visibilitychange", hidden);
      detach.push(
        () => canvas?.removeEventListener("webglcontextlost", lostContext),
        () => tracks[0].removeEventListener("ended", abort),
        () => tracks[0].removeEventListener("mute", abort),
        () => window.removeEventListener("orientationchange", abort),
        () => document.removeEventListener("visibilitychange", hidden),
      );
      let lastFrameAt = this.now(),
        lastVideoTime = -1,
        lastFrameNumber = -1;
      watchdog = setInterval(() => {
        if (generation === this.generation && this.now() - lastFrameAt > 500 && this.latest?.status !== "LIMITED")
          report("LIMITED", "Waiting for fresh camera tracking frames.");
      }, 250);
      const frame = () => {
        if (generation !== this.generation) return;
        this.animation = requestAnimationFrame(frame);
        if (input.video.readyState < 2 || input.video.currentTime === lastVideoTime) return;
        if (input.video.videoWidth !== sourceWidth || input.video.videoHeight !== sourceHeight) {
          suspend("The camera view changed. Restart and align the room again.");
          return;
        }
        lastVideoTime = input.video.currentTime;
        try {
          pipeline!.processGL();
          pipeline!.frameUpdate();
          const frameNumber = pipeline!.frameNumber();
          if (!Number.isFinite(frameNumber) || frameNumber === lastFrameNumber) return;
          if (frameNumber < lastFrameNumber) {
            invalidate();
            lastFrameNumber = frameNumber;
            report("INITIALIZING", "The tracking source restarted. Map the room and align again.");
            return;
          }
          lastFrameNumber = frameNumber;
          lastFrameAt = this.now();
          const anchor = tracker!.worldAnchor,
            quality = tracker!.quality;
          if (anchorId && anchor.id !== anchorId) invalidate();
          anchorId = anchor.id;
          if (
            quality === sdk.WorldTrackerQuality.WORLD_TRACKER_QUALITY_INITIALIZING ||
            anchor.status === sdk.AnchorStatus.ANCHOR_STATUS_INITIALIZING
          ) {
            invalidate();
            report("INITIALIZING", "Move the phone sideways slowly to map the room.");
            return;
          }
          if (anchor.status === sdk.AnchorStatus.ANCHOR_STATUS_STOPPED) {
            invalidate();
            report("LOST", "The room map was lost. Re-establish tracking and align again.");
            return;
          }
          if (
            quality !== sdk.WorldTrackerQuality.WORLD_TRACKER_QUALITY_GOOD ||
            anchor.status !== sdk.AnchorStatus.ANCHOR_STATUS_TRACKING
          ) {
            report("LIMITED", "Tracking is limited. Return to a well-lit, detailed view of the room.");
            return;
          }
          // Default and attitude modes hold the camera at the origin; only the world anchor supplies real translation.
          const pose = zapparCameraPose(pipeline!.cameraPoseWithOrigin(anchor.poseCameraRelative(false)));
          const projection = this.cameraProjection(sourceWidth, sourceHeight, 0.005, 1000);
          if (!projection) throw new Error("Invalid camera projection.");
          const focal = (Math.abs(projection[5]) * sourceHeight) / 2;
          if (!Number.isFinite(focal) || focal <= 0) throw new Error("Invalid camera model.");
          this.intrinsics = { width: sourceWidth, height: sourceHeight, focal };
          hadWorldPose = true;
          invalidated = false;
          report("TRACKING", "World tracking active. Align the room before interacting.", pose);
        } catch {
          invalidate();
          report("LOST", "Zappar tracking stopped unexpectedly. Restart and align the room again.");
          void this.stop();
        }
      };
      frame();
    } catch (error) {
      if (sessionId) report("SUSPENDED", error instanceof Error ? error.message : "Zappar tracking could not open.");
      if (generation === this.generation) await this.stop();
      throw error;
    }
  }
  async stop() {
    ++this.generation;
    const cleanup = this.cleanup;
    this.cleanup = null;
    const opening = this.opening;
    this.opening = null;
    cancelAnimationFrame(this.animation);
    opening?.abort();
    this.pipeline = null;
    this.latest = null;
    this.intrinsics = null;
    cleanup?.();
  }
}
