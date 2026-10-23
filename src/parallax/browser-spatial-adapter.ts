import * as T from "three";
import type { BrowserCameraBroker, CameraLease } from "@/sextant/camera";
import { unknownState } from "@/sextant/contracts";
import type { Anchor, SpatialVersion } from "./contracts";
import { spatialId } from "./contracts";
import { BrowserScenePresentation } from "./browser-scene-presentation";
import { sceneRequirements, type SceneDelivery } from "./scene-delivery";
import {
  admitsBrowserProvider,
  hasMetricBrowserPose,
  type BrowserWorldTrackingProvider,
} from "./browser-world-tracking";
import type { SpatialRuntimeAdapter, SpatialRuntimeEvent } from "./runtime";

type Options = {
  provider: BrowserWorldTrackingProvider;
  broker: BrowserCameraBroker;
  video: HTMLVideoElement;
  scene: T.Scene;
  camera: T.PerspectiveCamera;
  /** Existing provider surface owns its renderer/canvas; this adapter adds only
   * the canonical presentation graph and camera pose, never another tracker.
   */
  renderer: Pick<T.WebGLRenderer, "render" | "clear">;
  viewport: () => { width: number; height: number };
  select?: (id: string, type: "PICK" | "INSPECT", signal: AbortSignal) => void;
  presentation?: ConstructorParameters<typeof BrowserScenePresentation>[2];
  origin?: string;
  now?: () => number;
  date?: () => Date;
  requestFrame?: typeof requestAnimationFrame;
  cancelFrame?: typeof cancelAnimationFrame;
};

/** Bounded integration seam for an admitted live browser provider. The ordinary
 * Player has no configured provider and remains Guided. Meter-based Scenes
 * require metric poses; relative POSITION_NO_SCALE is never relabeled meters.
 */
export class BrowserSpatialAdapter implements SpatialRuntimeAdapter {
  readonly mode = "BROWSER" as const;
  readonly planePlacement = false;
  readonly providerId: string;
  private readonly origin: string;
  private readonly now: () => number;
  private readonly date: () => Date;
  private readonly requestFrame: typeof requestAnimationFrame;
  private readonly cancelFrame: typeof cancelAnimationFrame;
  private admission: Awaited<ReturnType<BrowserWorldTrackingProvider["discover"]>> | null = null;
  private lease: CameraLease | null = null;
  private presentation: BrowserScenePresentation | null = null;
  private emit: ((event: SpatialRuntimeEvent) => void) | null = null;
  private signal: AbortSignal | null = null;
  private sessionId = "";
  private generation = 0;
  private frame: number | null = null;
  private detach: (() => void) | null = null;
  private lastState = "";
  private lastTimestamp = -Infinity;
  private normalSamples = 0;
  private delivery: SceneDelivery | null = null;
  private identity: { instanceId: string; versionChecksum: string } | null = null;
  private authorizing = false;
  private providerActive = false;
  private providerOpening = false;
  private stopping: Promise<void> | null = null;
  constructor(private readonly options: Options) {
    this.origin = new URL(options.origin ?? window.location.origin).origin;
    this.providerId = options.provider.providerId;
    if (!spatialId.safeParse(this.providerId).success || !this.providerId.startsWith("parallax.browser."))
      throw new Error("PARALLAX_BROWSER_PROVENANCE_INVALID");
    this.now = options.now ?? (() => performance.now());
    this.date = options.date ?? (() => new Date());
    this.requestFrame = options.requestFrame ?? requestAnimationFrame;
    this.cancelFrame = options.cancelFrame ?? cancelAnimationFrame;
  }
  get worldTracking() {
    return (
      this.options.provider.scale === "METRIC_6DOF" &&
      ["VISUAL_INERTIAL_SLAM", "VISUAL_SLAM"].includes(this.options.provider.method)
    );
  }
  private admitted() {
    return (
      this.admission !== null && admitsBrowserProvider(this.admission, this.origin, this.date()) && this.worldTracking
    );
  }
  async discover() {
    this.admission = await this.options.provider.discover();
    return { supported: this.admitted() };
  }
  supportsScene(scene: SpatialVersion) {
    return (
      this.admitted() &&
      !scene.adaptive &&
      sceneRequirements(scene).every((r) => ["WORLD_TRACKING", "MODEL_GLB"].includes(r))
    );
  }
  async authorize() {
    await this.stopping;
    if (this.providerOpening) throw new Error("PARALLAX_BROWSER_PROVIDER_STOPPING");
    if (!this.admitted()) throw new Error("PARALLAX_BROWSER_PROVIDER_NOT_ADMITTED");
    const generation = this.generation;
    if (!this.lease) {
      this.authorizing = true;
      try {
        const lease = await this.options.broker.acquire(true, document.visibilityState === "visible");
        if (generation !== this.generation || !this.admitted()) {
          lease.release();
          throw new Error("PARALLAX_BROWSER_START_CANCELLED");
        }
        this.lease = lease;
      } finally {
        this.authorizing = false;
      }
    }
    return {
      ...unknownState(),
      support: "SUPPORTED" as const,
      availability: "AVAILABLE" as const,
      permission: "GRANTED" as const,
      lifecycle: "FOREGROUND_ONLY" as const,
    };
  }
  async start(input: Parameters<SpatialRuntimeAdapter["start"]>[0]) {
    await this.stopping;
    if (this.signal || this.providerOpening || !this.lease || !this.admitted() || input.signal.aborted)
      throw new Error("PARALLAX_BROWSER_START_NOT_AUTHORIZED");
    if (!input.sceneIdentity) throw new Error("PARALLAX_BROWSER_SCENE_IDENTITY_REQUIRED");
    const generation = ++this.generation;
    this.signal = input.signal;
    this.identity = structuredClone(input.sceneIdentity);
    this.emit = input.emit;
    this.lastState = "";
    this.lastTimestamp = -Infinity;
    this.normalSamples = 0;
    const abort = () => {
      void this.stop().catch(() => undefined);
    };
    input.signal.addEventListener("abort", abort, { once: true });
    this.detach = () => input.signal.removeEventListener("abort", abort);
    try {
      this.providerOpening = true;
      this.providerActive = true;
      const reply = await this.options.provider.start({
        lease: this.lease,
        video: this.options.video,
        signal: input.signal,
      });
      if (generation !== this.generation || input.signal.aborted) throw new Error("PARALLAX_BROWSER_START_CANCELLED");
      this.sessionId = spatialId.parse(reply.sessionId);
      this.presentation = new BrowserScenePresentation(this.options.scene, this.options.camera, {
        ...this.options.presentation,
        origin: this.origin,
      });
      const draw = () => {
        if (generation !== this.generation || input.signal.aborted) return;
        try {
          this.updateFrame();
        } catch {
          this.emit?.({ type: "TRACKING", state: "INTERRUPTED" });
          void this.stop().catch(() => undefined);
          return;
        }
        if (generation === this.generation && !input.signal.aborted) this.frame = this.requestFrame(draw);
      };
      draw();
    } catch (error) {
      if (generation === this.generation) await this.stop();
      else await this.options.provider.stop().catch(() => undefined);
      throw error;
    } finally {
      this.providerOpening = false;
    }
  }
  private poseReady() {
    const sample = this.options.provider.read();
    return this.admitted() &&
      this.signal &&
      !this.signal.aborted &&
      hasMetricBrowserPose(sample, this.now(), this.sessionId, this.options.provider.method)
      ? sample
      : null;
  }
  private cameraReady() {
    const sample = this.poseReady();
    if (!sample) return null;
    const { width, height } = this.options.viewport();
    if (![width, height].every((n) => Number.isFinite(n) && n > 0)) return null;
    let projection: ArrayLike<number> | null;
    try {
      projection = this.options.provider.cameraProjection(width, height, 0.005, 1000);
    } catch {
      return null;
    }
    if (!projection || projection.length !== 16 || !Array.from(projection).every(Number.isFinite)) return null;
    const matrix = new T.Matrix4().fromArray(projection),
      determinant = matrix.determinant();
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) return null;
    const camera = this.options.camera,
      pose = sample.sessionFromCamera!;
    camera.projectionMatrix.copy(matrix);
    camera.projectionMatrixInverse.copy(matrix).invert();
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    camera.quaternion.set(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w);
    camera.updateMatrixWorld(true);
    return sample;
  }
  private updateFrame() {
    if (!this.emit || !this.presentation) return;
    if (!this.admitted()) {
      this.emit({ type: "TRACKING", state: "INTERRUPTED" });
      void this.stop().catch(() => undefined);
      return;
    }
    const sample = this.cameraReady();
    const raw = this.options.provider.read();
    const state = sample ? "NORMAL" : raw?.status === "INITIALIZING" ? "MAPPING" : "LOST";
    const fresh = sample && sample.timestampMs > this.lastTimestamp;
    if (state !== this.lastState || (fresh && this.normalSamples < 3)) {
      this.lastState = state;
      if (sample) {
        this.lastTimestamp = sample.timestampMs;
        ++this.normalSamples;
      } else this.normalSamples = 0;
      this.emit({ type: "TRACKING", state });
    }
    if (sample) this.options.renderer.render(this.options.scene, this.options.camera);
    else this.options.renderer.clear();
  }
  async resolve(anchor: Anchor) {
    return anchor.kind === "LOCAL_WORLD" ? structuredClone(anchor.transform) : null;
  }
  async place() {
    return null;
  }
  async render() {
    throw new Error("PARALLAX_BROWSER_V2_DELIVERY_REQUIRED");
  }
  async renderScene(scene: SceneDelivery) {
    const generation = this.generation,
      presenter = this.presentation;
    if (!presenter || !this.signal || this.signal.aborted || !this.admitted())
      throw new Error("PARALLAX_BROWSER_CLOSED");
    if (
      scene.identity.instanceId !== this.identity?.instanceId ||
      scene.identity.versionChecksum !== this.identity.versionChecksum
    )
      throw new Error("PARALLAX_BROWSER_SCENE_IDENTITY_MISMATCH");
    if (scene.requirements.some((r) => !["WORLD_TRACKING", "MODEL_GLB"].includes(r)))
      throw new Error("PARALLAX_BROWSER_SCENE_UNSUPPORTED");
    await presenter.renderScene(scene);
    if (generation !== this.generation || this.signal?.aborted)
      throw new Error("PARALLAX_BROWSER_PRESENTATION_CANCELLED");
    this.delivery = structuredClone(scene);
  }
  /** Existing surface pointer/XR-ray handler calls this; only actual geometry,
   * current visibility and allowed actions can produce an intent.
   */
  pick(ray: T.Raycaster) {
    if (!this.cameraReady() || !this.presentation || !this.signal || this.signal.aborted) return null;
    return this.presentation.pick(ray);
  }
  select(ray: T.Raycaster) {
    const id = this.pick(ray);
    const entity = this.delivery?.entities.find((e) => e.id === id);
    const action = entity?.interactions.includes("PICK")
      ? "PICK"
      : entity?.interactions.includes("INSPECT")
        ? "INSPECT"
        : null;
    if (id && action && this.signal) this.options.select?.(id, action, this.signal);
    return id;
  }
  async stop() {
    ++this.generation;
    this.detach?.();
    this.detach = null;
    if (this.frame !== null) this.cancelFrame(this.frame);
    this.frame = null;
    this.emit = null;
    this.signal = null;
    this.sessionId = "";
    this.delivery = null;
    this.identity = null;
    this.presentation?.dispose();
    this.presentation = null;
    const lease = this.lease;
    this.lease = null;
    lease?.release();
    if (this.authorizing) this.options.broker.release();
    this.options.renderer.clear();
    if (!this.providerActive) {
      await this.stopping;
      return;
    }
    this.providerActive = false;
    const stopping = this.options.provider.stop();
    this.stopping = stopping;
    try {
      await stopping;
    } finally {
      if (this.stopping === stopping) this.stopping = null;
    }
  }
}
