import { Matrix4, Quaternion, Vector3 } from "three";
import { createBrowserUuid } from "@/lib/browser-uuid";
import type { BrowserCameraBroker, CameraLease, ExternalCameraReservation } from "@/sextant/camera";
import type { Transform } from "./contracts";
import {
  browserTrackingSampleSchema,
  hasLiveWorldPose,
  type BrowserTrackingSample,
  type BrowserWorldTrackingProvider,
} from "./browser-world-tracking";
import { waitForTrackingOperation } from "./browser-tracking-lifecycle";

const scriptIntegrity = "sha256-s5c5NoYvTLd64y0k8lPYoOix3k+ioM9oiDN0KInugp0=";
export type EighthWallAuthorizedConfig = { version: "1.0.0"; scriptUrl: string; integrity: string };
type Reality = {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  intrinsics: ArrayLike<number>;
  trackingStatus: string;
  trackingReason?: string;
};
type FrameInput = {
  frameStartResult: { videoTime: number; repeatFrame: boolean };
  processCpuResult: { reality?: Reality };
};
type CameraStatus = { status: string; stream?: MediaStream; video?: HTMLVideoElement };
type Dimensions = { canvasWidth?: number; canvasHeight?: number; videoWidth?: number; videoHeight?: number };
export type EighthWallPipelineModule = {
  name: string;
  onCameraStatusChange?(input: CameraStatus): void;
  onStart?(input: Dimensions): void;
  onCanvasSizeChange?(input: Dimensions): void;
  onVideoSizeChange?(input: Dimensions): void;
  onUpdate?(input: FrameInput): void;
  onException?(error: unknown): void;
  onPaused?(): void;
};
/** Documented XR8 API only. This module never reads or modifies proprietary implementation internals. */
export type EighthWallSdk = {
  initialize(): Promise<void>;
  loadChunk(name: "slam"): Promise<void>;
  run(input: {
    canvas: HTMLCanvasElement;
    allowedDevices: string;
    cameraConfig: { direction: string };
    sessionConfiguration: { defaultEnvironment: { disabled: true } };
  }): void | Promise<void>;
  stop(): void;
  addCameraPipelineModules(modules: EighthWallPipelineModule[]): void;
  removeCameraPipelineModules(names: string[]): void;
  XrConfig: { device(): { MOBILE: string }; camera(): { BACK: string } };
  GlTextureRenderer: { pipelineModule(): EighthWallPipelineModule };
  XrController: {
    configure(input: {
      disableWorldTracking: false;
      enableWorldPoints: false;
      scale: "responsive";
      leftHandedAxes: false;
      mirroredDisplay: false;
    }): void;
    pipelineModule(): EighthWallPipelineModule;
    updateCameraProjectionMatrix(input: {
      cam: { pixelRectWidth: number; pixelRectHeight: number; nearClipPlane: number; farClipPlane: number };
      origin?: { x: number; y: number; z: number };
      facing?: { x: number; y: number; z: number; w: number };
    }): void;
  };
};
type ManagedInput = Omit<Parameters<BrowserWorldTrackingProvider["start"]>[0], "lease"> & {
  broker: BrowserCameraBroker;
};
type Dependencies = {
  loadSdk?: (config: EighthWallAuthorizedConfig, signal: AbortSignal) => Promise<EighthWallSdk>;
  now?: () => number;
  createCanvas?: () => HTMLCanvasElement;
};
let sdkOwner: symbol | null = null;
let sdkBootstrap: { key: string; promise: Promise<EighthWallSdk> } | null = null;

function assertConfig(config: EighthWallAuthorizedConfig) {
  if (
    config?.version !== "1.0.0" ||
    config.scriptUrl !== "/api/dev/parallax-tracker/xr.js" ||
    config.integrity !== scriptIntegrity
  )
    throw new Error("The owner-authorized unmodified 8th Wall 1.0.0 distribution is required.");
}

/** Bytes are supplied by the hash-checked private local route, never a third-party CDN. */
export async function loadAuthorizedEighthWallSdk(
  config: EighthWallAuthorizedConfig,
  signal: AbortSignal,
): Promise<EighthWallSdk> {
  assertConfig(config);
  if (signal.aborted) throw new Error("Browser AR opening was cancelled.");
  const key = `${config.version}:${config.scriptUrl}:${config.integrity}`;
  if (sdkBootstrap && sdkBootstrap.key !== key)
    throw new Error("Reload the page before changing the authorized 8th Wall distribution.");
  if (!sdkBootstrap) {
    const promise = bootstrapEighthWallScript(config);
    // A cancelled consumer cannot abandon the shared script or cause reinjection.
    // Keep even a failed bootstrap until reload; its partial global state is unsafe to execute over.
    void promise.catch(() => {});
    sdkBootstrap = { key, promise };
  }
  return waitForTrackingOperation(sdkBootstrap.promise, signal, "8th Wall's authorized local distribution timed out.");
}

function bootstrapEighthWallScript(config: EighthWallAuthorizedConfig): Promise<EighthWallSdk> {
  const previousSdk = (globalThis as typeof globalThis & { XR8?: EighthWallSdk }).XR8;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    let ownScriptLoaded = false;
    let readySdk: EighthWallSdk | null = null;
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("xrloaded", loaded);
      script.onload = script.onerror = null;
      script.remove();
    };
    const fail = (message: string) => {
      cleanup();
      reject(new Error(`${message} Reload the page before retrying.`));
    };
    const finish = () => {
      if (!ownScriptLoaded || !readySdk || (globalThis as typeof globalThis & { XR8?: EighthWallSdk }).XR8 !== readySdk)
        return;
      cleanup();
      resolve(readySdk);
    };
    const loaded = () => {
      const sdk = (globalThis as typeof globalThis & { XR8?: EighthWallSdk }).XR8;
      if (
        !sdk ||
        sdk === previousSdk ||
        typeof sdk.initialize !== "function" ||
        typeof sdk.run !== "function" ||
        typeof sdk.loadChunk !== "function"
      )
        return;
      readySdk = sdk;
      finish();
    };
    const timer = setTimeout(() => fail("8th Wall could not load its authorized local distribution."), 15000);
    script.src = config.scriptUrl;
    script.integrity = config.integrity;
    script.crossOrigin = "anonymous";
    script.setAttribute("data-preload-chunks", "slam");
    script.onload = () => {
      ownScriptLoaded = true;
      finish();
    };
    script.onerror = () => fail("8th Wall's authorized script is unavailable or failed integrity verification.");
    window.addEventListener("xrloaded", loaded);
    try {
      document.head.appendChild(script);
    } catch {
      fail("The authorized 8th Wall script could not be attached.");
    }
  });
}

export function eighthWallCameraPose(reality: Pick<Reality, "position" | "rotation">): Transform {
  const { position, rotation } = reality;
  if (
    !position ||
    !rotation ||
    ![position.x, position.y, position.z, rotation.x, rotation.y, rotation.z, rotation.w].every(Number.isFinite)
  )
    throw new Error("PARALLAX_EIGHTHWALL_INVALID_POSE");
  const q = new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
  if (Math.abs(q.lengthSq() - 1) > 0.02) throw new Error("PARALLAX_EIGHTHWALL_INVALID_ROTATION");
  q.normalize();
  return { position: { ...position }, rotation: { x: q.x, y: q.y, z: q.z, w: q.w }, scale: 1 };
}

/** SDK owns capture inside a Sextant reservation. Its canvas displays camera pixels only; authored content remains canonical. */
export class EighthWallBrowserProvider implements BrowserWorldTrackingProvider {
  readonly providerId = "parallax.browser.eighthwall.v1";
  readonly version = "@8thwall/engine-binary@1.0.0";
  readonly method = "VISUAL_SLAM" as const;
  private readonly sdkOwnership = Symbol("Parallax 8th Wall camera owner");
  private latest: BrowserTrackingSample | null = null;
  private projection: Float32Array | null = null;
  private dimensions: { width: number; height: number; focal: number } | null = null;
  private cleanup: (() => void) | null = null;
  private opening: AbortController | null = null;
  private generation = 0;
  private readonly now: () => number;
  constructor(
    private config: EighthWallAuthorizedConfig,
    private dependencies: Dependencies = {},
  ) {
    this.now = dependencies.now ?? (() => performance.now());
  }
  read() {
    return this.latest;
  }
  cameraIntrinsics() {
    return this.dimensions;
  }
  cameraProjection(width: number, height: number, near: number, far: number) {
    if (
      !this.projection ||
      !this.dimensions ||
      ![width, height, near, far].every(Number.isFinite) ||
      Math.min(width, height, near) <= 0 ||
      far <= near
    )
      return null;
    const matrix = new Float32Array(this.projection);
    const fit = Math.min(width / this.dimensions.width, height / this.dimensions.height);
    // Match the contain-fitted SDK camera canvas, including any principal point offset.
    for (const index of [0, 4, 8, 12]) matrix[index] *= (this.dimensions.width * fit) / width;
    for (const index of [1, 5, 9, 13]) matrix[index] *= (this.dimensions.height * fit) / height;
    matrix[10] = -(far + near) / (far - near);
    matrix[14] = (-2 * far * near) / (far - near);
    return matrix;
  }
  ray(x: number, y: number) {
    const sample = this.latest,
      dimensions = this.dimensions;
    if (
      !sample ||
      !dimensions ||
      !hasLiveWorldPose(sample, this.now(), sample.sessionId) ||
      ![x, y].every(Number.isFinite) ||
      x < 0 ||
      x > 1 ||
      y < 0 ||
      y > 1
    )
      return null;
    const projection = this.cameraProjection(dimensions.width, dimensions.height, 0.005, 1000);
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
  planes() {
    return [];
  }
  hitTest() {
    return null;
  }
  async start(input: Parameters<BrowserWorldTrackingProvider["start"]>[0]) {
    input.lease.release();
    throw new Error("8th Wall requires its exclusive SDK camera reservation; a pre-opened camera cannot be supplied.");
  }
  async startManaged(input: ManagedInput) {
    await this.stop();
    const generation = ++this.generation,
      opening = new AbortController();
    this.opening = opening;
    let sdk: EighthWallSdk | null = null,
      reservation: ExternalCameraReservation | null = null,
      lease: CameraLease | null = null;
    let canvas: HTMLCanvasElement | null = null,
      modules: EighthWallPipelineModule[] = [],
      watchdog: ReturnType<typeof setInterval> | undefined;
    let sessionId = "",
      hadPose = false,
      invalidated = false,
      lastVideoTime = -Infinity,
      lastFrameAt = this.now();
    const detach: (() => void)[] = [];
    let failStartup: (error: Error) => void = () => {},
      ready: () => void = () => {};
    const dispose = (operation: () => void) => {
      try {
        operation();
      } catch {
        /* Release the camera even after SDK cleanup errors. */
      }
    };
    const report = (status: BrowserTrackingSample["status"], reason: string, pose: Transform | null = null) => {
      if (generation !== this.generation || !sessionId) return;
      this.latest = browserTrackingSampleSchema.parse({
        sessionId,
        timestampMs: this.now(),
        method: this.method,
        status,
        confidence: status === "TRACKING" ? "POSITION_NO_SCALE" : "NONE",
        sessionFromCamera: pose,
        reason: reason.slice(0, 300),
      });
      input.sample(this.latest);
    };
    const invalidate = () => {
      if (hadPose && !invalidated) {
        sessionId = createBrowserUuid();
        invalidated = true;
      }
    };
    const suspend = (reason: string) => {
      if (generation !== this.generation) return;
      invalidate();
      report("SUSPENDED", reason);
      failStartup(new Error(reason));
      void this.stop();
    };
    const abort = () => suspend("Camera tracking paused. Restart and align the room again.");
    const priorVisibility = input.video.style.visibility;
    this.cleanup = () => {
      clearInterval(watchdog);
      detach.forEach((remove) => remove());
      // XR8.stop closes the SDK source before Sextant releases its adopted stream.
      if (sdk) dispose(() => sdk!.stop());
      if (sdk && modules.length) dispose(() => sdk!.removeCameraPipelineModules(modules.map((module) => module.name)));
      reservation?.release();
      if (input.video.srcObject === lease?.stream) {
        dispose(() => input.video.pause());
        input.video.srcObject = null;
      }
      input.video.style.visibility = priorVisibility;
      canvas?.remove();
      if (sdkOwner === this.sdkOwnership) sdkOwner = null;
    };
    input.signal.addEventListener("abort", abort, { once: true });
    detach.push(() => input.signal.removeEventListener("abort", abort));
    try {
      assertConfig(this.config);
      if (!isSecureContext) throw new Error("Browser AR requires trusted HTTPS.");
      if (!input.motionGranted)
        throw new Error("Grant orientation and motion access before starting browser world tracking.");
      if (input.signal.aborted) throw new Error("Browser AR opening was cancelled.");
      if (sdkOwner && sdkOwner !== this.sdkOwnership)
        throw new Error("Another 8th Wall camera session is already running.");
      sessionId = createBrowserUuid();
      reservation = input.broker.reserveExternal(true, document.visibilityState === "visible", () =>
        suspend("The exclusive camera reservation ended. Restart and align again."),
      );
      sdkOwner = this.sdkOwnership;
      report("INITIALIZING", "Loading the authorized 8th Wall world tracker…");
      sdk = await waitForTrackingOperation(
        (this.dependencies.loadSdk ?? loadAuthorizedEighthWallSdk)(this.config, opening.signal),
        opening.signal,
        "8th Wall's local distribution did not load.",
      );
      await waitForTrackingOperation(sdk.loadChunk("slam"), opening.signal, "8th Wall's SLAM module did not load.");
      await waitForTrackingOperation(
        sdk.initialize(),
        opening.signal,
        "8th Wall's tracking module did not initialize.",
      );
      if (generation !== this.generation) throw new Error("Browser AR opening was cancelled.");
      if (!sdk.XrController || !sdk.GlTextureRenderer || !sdk.XrConfig)
        throw new Error("The authorized engine does not expose World Tracking.");
      canvas = (this.dependencies.createCanvas ?? (() => document.createElement("canvas")))();
      canvas.width = Math.max(1, input.video.parentElement?.clientWidth || 640);
      canvas.height = Math.max(1, input.video.parentElement?.clientHeight || 480);
      canvas.setAttribute("aria-label", "8th Wall live rear camera");
      Object.assign(canvas.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        objectFit: "contain",
        pointerEvents: "none",
      });
      input.video.parentElement?.insertBefore(canvas, input.video.nextSibling);
      input.video.style.visibility = "hidden";
      const updateGeometry = (input: Dimensions) => {
        if (generation !== this.generation) return;
        const width = input.canvasWidth ?? canvas!.width,
          height = input.canvasHeight ?? canvas!.height;
        if (!Number.isFinite(width) || !Number.isFinite(height) || Math.min(width, height) <= 0) return;
        if (hadPose && this.dimensions && (width !== this.dimensions.width || height !== this.dimensions.height)) {
          suspend("The camera view changed. Restart and align the room again.");
          return;
        }
        sdk!.XrController.updateCameraProjectionMatrix({
          cam: { pixelRectWidth: width, pixelRectHeight: height, nearClipPlane: 0.005, farClipPlane: 1000 },
        });
      };
      const cameraReady = new Promise<void>((resolve, reject) => {
        ready = resolve;
        failStartup = reject;
      });
      const observer: EighthWallPipelineModule = {
        name: `parallax-world-observer-${generation}`,
        onStart: updateGeometry,
        onCanvasSizeChange: updateGeometry,
        onVideoSizeChange: () => {
          if (hadPose) suspend("The camera source changed size. Restart and align the room again.");
        },
        onCameraStatusChange: ({ status, stream, video }) => {
          if (generation !== this.generation) {
            if (stream)
              dispose(() => {
                reservation?.adopt(stream);
              });
            return;
          }
          try {
            if (status === "failed") {
              suspend("Safari could not open the rear camera. Check camera permission and retry.");
              return;
            }
            if (stream) {
              lease = reservation!.adopt(stream);
              input.video.muted = true;
              input.video.playsInline = true;
              input.video.srcObject = stream;
            }
            if (status === "hasVideo" && video && lease) {
              // The SDK video already plays this stream. The hidden React video preserves
              // the existing layout/tap surface; it must not start a second video playback.
              ready();
            }
          } catch {
            suspend("The camera source could not join its exclusive reservation. Restart browser AR.");
          }
        },
        onUpdate: ({ frameStartResult, processCpuResult }) => {
          if (
            generation !== this.generation ||
            !lease ||
            !frameStartResult ||
            frameStartResult.repeatFrame ||
            !Number.isFinite(frameStartResult.videoTime) ||
            frameStartResult.videoTime === lastVideoTime
          )
            return;
          if (frameStartResult.videoTime < lastVideoTime) invalidate();
          lastVideoTime = frameStartResult.videoTime;
          lastFrameAt = this.now();
          const reality = processCpuResult?.reality;
          if (!reality) {
            report("INITIALIZING", "Waiting for 8th Wall's first world-tracking result.");
            return;
          }
          if (reality.trackingStatus !== "NORMAL") {
            if (reality.trackingReason === "INITIALIZING") {
              invalidate();
              report("INITIALIZING", "Move slowly sideways across a detailed surface.");
            } else report("LIMITED", "Tracking is limited. Return to a well-lit, detailed view.");
            return;
          }
          try {
            const values = Array.from(reality.intrinsics);
            if (
              values.length !== 16 ||
              !values.every(Number.isFinite) ||
              Math.abs(new Matrix4().fromArray(values).determinant()) < 1e-12
            )
              throw new Error("projection");
            const width = canvas!.width,
              height = canvas!.height,
              focal = (Math.abs(values[5]) * height) / 2;
            if (Math.min(width, height, focal) <= 0 || !Number.isFinite(focal)) throw new Error("camera model");
            this.projection = new Float32Array(values);
            this.dimensions = { width, height, focal };
            const pose = eighthWallCameraPose(reality);
            hadPose = true;
            invalidated = false;
            report("TRACKING", "8th Wall world tracking active. Align the room before interacting.", pose);
          } catch {
            invalidate();
            report("LOST", "8th Wall returned an invalid camera pose. Restart and align again.");
            void this.stop();
          }
        },
        onException: () => suspend("8th Wall stopped with a camera or tracking error. Restart browser AR."),
        onPaused: abort,
      };
      sdk.XrController.configure({
        disableWorldTracking: false,
        enableWorldPoints: false,
        scale: "responsive",
        leftHandedAxes: false,
        mirroredDisplay: false,
      });
      modules = [sdk.GlTextureRenderer.pipelineModule(), sdk.XrController.pipelineModule(), observer];
      sdk.addCameraPipelineModules(modules);
      const hidden = () => {
        if (document.visibilityState === "hidden") abort();
      };
      const contextLost = (event: Event) => {
        event.preventDefault();
        suspend("Camera graphics were interrupted. Restart and align again.");
      };
      window.addEventListener("orientationchange", abort);
      document.addEventListener("visibilitychange", hidden);
      canvas.addEventListener("webglcontextlost", contextLost);
      detach.push(
        () => window.removeEventListener("orientationchange", abort),
        () => document.removeEventListener("visibilitychange", hidden),
        () => canvas?.removeEventListener("webglcontextlost", contextLost),
      );
      watchdog = setInterval(() => {
        if (generation === this.generation && this.now() - lastFrameAt > 500 && this.latest?.status !== "LIMITED")
          report("LIMITED", "Waiting for fresh camera tracking frames.");
      }, 250);
      const running = sdk.run({
        canvas,
        allowedDevices: sdk.XrConfig.device().MOBILE,
        cameraConfig: { direction: sdk.XrConfig.camera().BACK },
        sessionConfiguration: { defaultEnvironment: { disabled: true } },
      });
      if (running)
        void Promise.resolve(running).catch(() => suspend("8th Wall could not start this device's camera session."));
      await waitForTrackingOperation(
        cameraReady,
        opening.signal,
        "8th Wall's camera startup timed out. Finish or dismiss the Safari permission prompt, then retry.",
        30000,
      );
    } catch (error) {
      report("SUSPENDED", error instanceof Error ? error.message : "8th Wall could not start.");
      if (generation === this.generation) await this.stop();
      throw error;
    }
  }
  async stop() {
    ++this.generation;
    const opening = this.opening,
      cleanup = this.cleanup;
    this.opening = null;
    this.cleanup = null;
    opening?.abort();
    this.latest = null;
    this.projection = null;
    this.dimensions = null;
    cleanup?.();
  }
}
