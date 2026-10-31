import * as T from "three";
import { paperSheetGeometry, compassProp, footprintProp } from "@/components/studio/parallax/spatial-props";
import { applySpatialOpacity, disposeSpatialOpacity } from "@/components/studio/parallax/spatial-opacity";
import { previewReferenceFrame } from "./authoring";
import { type Anchor, type SpatialMoment, type Transform } from "./contracts";
import { spatialPropStyle, spatialFootprintSide } from "./prop-style";
import {
  alignmentApplies,
  type BrowserTrackingSample,
  type RoomAlignment,
  type BrowserWorldTrackingProvider,
} from "./browser-world-tracking";
import type { SpatialRuntimeAdapter, SpatialRuntimeEvent } from "./runtime";
import { composeTransform } from "./transforms";

/** Existing Three geometry and runtime entity transforms, rendered into a tracked camera session. */
export class BrowserSpatialAdapter implements SpatialRuntimeAdapter {
  readonly providerId: string;
  readonly mode = "BROWSER" as const;
  readonly worldTracking = true;
  readonly planePlacement = false;
  private renderer: T.WebGLRenderer | null = null;
  private camera = new T.PerspectiveCamera();
  private scene = new T.Scene();
  private objects = new Map<string, T.Group>();
  private observer: ResizeObserver | null = null;
  private emit: ((event: SpatialRuntimeEvent) => void) | null = null;
  private frame = 0;
  private disposeEvents: (() => void) | null = null;
  private lastTracking = "";
  private initialNormalSamples = 0;
  private lastNormalTimestamp = -Infinity;
  constructor(
    private host: HTMLElement,
    private provider: BrowserWorldTrackingProvider,
    private moment: SpatialMoment,
    private alignment: RoomAlignment,
    private select: (id: string) => void,
  ) {
    this.providerId = provider.providerId;
  }
  updateTracking(sample: BrowserTrackingSample | null) {
    if (!this.emit) return;
    const valid = sample && alignmentApplies(this.alignment, sample, performance.now(), this.moment.version.checksum);
    const state = valid
      ? "NORMAL"
      : !sample
        ? "INTERRUPTED"
        : sample.status === "INITIALIZING"
          ? "MAPPING"
          : sample.status === "LOST"
            ? "LOST"
            : sample.status === "SUSPENDED"
              ? "INTERRUPTED"
              : "LIMITED_FEATURES";
    const freshNormal = state === "NORMAL" && sample && sample.timestampMs > this.lastNormalTimestamp;
    if (state === "NORMAL" && !freshNormal) return;
    if (freshNormal) this.lastNormalTimestamp = sample.timestampMs;
    if (state !== this.lastTracking || (freshNormal && this.initialNormalSamples < 3)) {
      this.lastTracking = state;
      if (state === "NORMAL") this.initialNormalSamples++;
      else this.initialNormalSamples = 0;
      this.emit?.({ type: "TRACKING", state });
    }
  }
  async start(input: Parameters<SpatialRuntimeAdapter["start"]>[0]) {
    if (input.signal.aborted) throw new Error("Browser scene opening was cancelled.");
    const intrinsics = this.provider.cameraIntrinsics(),
      sample = this.provider.read();
    if (
      !intrinsics ||
      !sample ||
      !alignmentApplies(this.alignment, sample, performance.now(), this.moment.version.checksum)
    )
      throw new Error("Fresh room alignment and world tracking are required.");
    this.emit = input.emit;
    this.lastTracking = "";
    this.initialNormalSamples = 0;
    this.lastNormalTimestamp = -Infinity;
    const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer = renderer;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setClearColor(0, 0);
    this.camera.fov = T.MathUtils.radToDeg(2 * Math.atan(intrinsics.height / (2 * intrinsics.focal)));
    this.camera.aspect = intrinsics.width / intrinsics.height;
    this.camera.near = 0.005;
    this.camera.far = 1000;
    this.camera.updateProjectionMatrix();
    renderer.domElement.setAttribute("aria-label", "World-tracked Chronicle scene");
    this.host.appendChild(renderer.domElement);
    this.scene.add(new T.HemisphereLight(0xffffff, 0x446080, 2));
    const sun = new T.DirectionalLight(0xffffff, 2);
    sun.position.set(3, 8, 2);
    this.scene.add(sun);
    const resize = () => renderer.setSize(Math.max(1, this.host.clientWidth), Math.max(1, this.host.clientHeight));
    this.observer = new ResizeObserver(resize);
    this.observer.observe(this.host);
    resize();
    const lost = (event: Event) => {
      event.preventDefault();
      input.emit({ type: "TRACKING", state: "LOST" });
    };
    const pick = (event: PointerEvent) => {
      const sample = this.provider.read();
      if (!sample || !alignmentApplies(this.alignment, sample, performance.now(), this.moment.version.checksum)) return;
      const rect = renderer.domElement.getBoundingClientRect(),
        ray = new T.Raycaster();
      ray.setFromCamera(
        new T.Vector2(
          (2 * (event.clientX - rect.left)) / rect.width - 1,
          1 - (2 * (event.clientY - rect.top)) / rect.height,
        ),
        this.camera,
      );
      const hit = ray.intersectObjects(
        [...this.objects.values()].filter((o) => o.visible),
        true,
      )[0];
      if (!hit) return;
      let object: T.Object3D | null = hit.object;
      while (object && !object.userData.entityId) object = object.parent;
      if (object?.userData.entityId) this.select(object.userData.entityId);
    };
    const abort = () => {
      void this.stop();
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    renderer.domElement.addEventListener("pointerup", pick);
    input.signal.addEventListener("abort", abort, { once: true });
    this.disposeEvents = () => {
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      renderer.domElement.removeEventListener("pointerup", pick);
      input.signal.removeEventListener("abort", abort);
    };
    const draw = () => {
      if (this.renderer !== renderer) return;
      this.frame = requestAnimationFrame(draw);
      const sample = this.provider.read();
      // A provider can stop sending callbacks. Freshness must gate the runtime
      // as well as the pixels, so interactions never survive a frozen pose.
      this.updateTracking(sample);
      if (!sample || !alignmentApplies(this.alignment, sample, performance.now(), this.moment.version.checksum)) {
        renderer.clear();
        return;
      }
      const pose = sample.sessionFromCamera!;
      this.camera.position.set(pose.position.x, pose.position.y, pose.position.z);
      this.camera.quaternion.set(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w);
      renderer.render(this.scene, this.camera);
    };
    draw();
    this.updateTracking(sample);
  }
  async resolve(anchor: Anchor): Promise<Transform | null> {
    const room = this.moment.version.studio?.environment;
    if (!room || anchor.kind === "DEVICE_RELATIVE") return null;
    const frame =
      anchor.kind === "SURFACE_RELATIVE"
        ? composeTransform(
            previewReferenceFrame(this.moment.version, anchor, room.id, { ...room, horizontal: true, vertical: true }),
            anchor.transform,
          )
        : anchor.transform;
    return composeTransform(this.alignment.sessionFromScene, frame);
  }
  // No guessed plane placement. Existing authored coordinates stay stable in the aligned room.
  async place() {
    return null;
  }
  async render(entities: Parameters<SpatialRuntimeAdapter["render"]>[0]) {
    if (!this.renderer) throw new Error("Browser renderer is closed.");
    for (const object of this.objects.values()) object.visible = false;
    for (const e of entities) {
      let object = this.objects.get(e.id);
      if (!object) {
        const source = this.moment.version.entities.find((entity) => entity.id === e.id);
        if (!source) throw new Error("Browser render entity is not in this released scene.");
        object = new T.Group();
        object.userData.entityId = e.id;
        const style = spatialPropStyle(source);
        if (style === "FOOTPRINT") object.add(footprintProp(e.widthMeters, spatialFootprintSide(source) === "RIGHT"));
        else {
          const canvas = document.createElement("canvas");
          canvas.width = 512;
          canvas.height = 384;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Scene text rendering is unavailable.");
          context.fillStyle = style === "COMPASS" ? "#16293b" : "#e7d2a0";
          context.fillRect(0, 0, 512, 384);
          context.fillStyle = style === "COMPASS" ? "#efcb70" : "#33291e";
          context.font = "28px serif";
          const lines = (style === "COMPASS" ? "N   E   S   W" : e.content).match(/.{1,28}(?:\s|$)|.{1,28}/g) ?? [];
          lines.slice(0, 10).forEach((line, i) => context.fillText(line.trim(), 20, 38 + i * 32));
          const texture = new T.CanvasTexture(canvas);
          texture.colorSpace = T.SRGBColorSpace;
          if (style === "COMPASS") object.add(compassProp(e.widthMeters, texture));
          else
            object.add(
              new T.Mesh(
                style === "TEXT"
                  ? new T.PlaneGeometry(e.widthMeters, e.widthMeters * 0.75)
                  : paperSheetGeometry(e.widthMeters, style === "LETTER"),
                new T.MeshStandardMaterial({ map: texture, side: T.DoubleSide, roughness: 0.85 }),
              ),
            );
        }
        this.scene.add(object);
        this.objects.set(e.id, object);
      }
      object.visible = true;
      object.position.set(e.transform.position.x, e.transform.position.y, e.transform.position.z);
      object.quaternion.set(
        e.transform.rotation.x,
        e.transform.rotation.y,
        e.transform.rotation.z,
        e.transform.rotation.w,
      );
      object.scale.setScalar(e.transform.scale);
      applySpatialOpacity(object, e.opacity ?? 1);
    }
  }
  async stop() {
    cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    this.observer = null;
    this.disposeEvents?.();
    this.disposeEvents = null;
    this.emit = null;
    const materials = new Set<T.Material>(),
      textures = new Set<T.Texture>(),
      geometries = new Set<T.BufferGeometry>();
    disposeSpatialOpacity(this.scene);
    this.scene.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      geometries.add(o.geometry);
      for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
        materials.add(material);
        if ((material as T.MeshStandardMaterial).map) textures.add((material as T.MeshStandardMaterial).map!);
      }
    });
    for (const item of [...materials, ...textures, ...geometries]) item.dispose();
    this.objects.clear();
    this.scene.clear();
    this.renderer?.domElement.remove();
    this.renderer?.dispose();
    this.renderer = null;
    await this.provider.stop();
  }
}
