import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { sceneDeliverySchema, type ModelReference, type SceneDelivery } from "./scene-delivery";

type DeliveryEntity = SceneDelivery["entities"][number];
type Options = {
  origin?: string;
  fetchAsset?: typeof fetch;
  loader?: Pick<GLTFLoader, "parseAsync">;
  /** Existing browser adapters retain their own text-plane rendering. Return owned resources. */
  createLegacyEntity?: (entity: DeliveryEntity) => T.Object3D;
};
type MaterialState = { opacity: number; transparent: boolean };
type Graph = {
  root: T.Group;
  entities: Map<string, T.Group>;
  materials: Map<T.Material, MaterialState>;
  signature: string;
};
const cancelled = () => new Error("PARALLAX_BROWSER_PRESENTATION_CANCELLED");

function disposeGraph(root: T.Object3D) {
  const objects: T.Object3D[] = [];
  const geometries = new Set<T.BufferGeometry>();
  const materials = new Set<T.Material>();
  const textures = new Set<T.Texture>();
  const images = new Set<object>();
  root.traverse((object) => {
    objects.push(object);
    const mesh = object as T.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material)
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof T.Texture) textures.add(value);
    material.dispose();
  }
  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) {
    const image = texture.source.data as { close?: () => void } | null;
    if (image && !images.has(image)) {
      images.add(image);
      image.close?.();
    }
    texture.dispose();
  }
  root.removeFromParent();
  for (const object of objects) object.clear();
}

function signature(scene: SceneDelivery) {
  return JSON.stringify({
    identity: scene.identity,
    requirements: scene.requirements,
    entities: scene.entities.map((entity) => ({
      id: entity.id,
      kind: entity.kind,
      content: entity.content,
      widthMeters: entity.widthMeters,
      anchorId: entity.anchorId,
      parentEntityId: entity.parentEntityId,
      authoredTransform: entity.authoredTransform,
      interactions: entity.interactions,
      element: entity.element,
      model: entity.model,
    })),
  });
}

/** A presentation graph owned by an existing browser tracking adapter.
 * It never starts tracking, owns a camera, changes identity, or writes Chronicle state.
 */
export class BrowserScenePresentation {
  private generation = 0;
  private disposed = false;
  private pending: AbortController | null = null;
  private active: Graph | null = null;
  private readonly origin: string;
  private readonly fetchAsset: typeof fetch;
  private readonly loader: Pick<GLTFLoader, "parseAsync">;

  constructor(
    private readonly scene: T.Scene,
    private readonly camera: T.Camera,
    private readonly options: Options = {},
  ) {
    const origin = new URL(options.origin ?? window.location.origin);
    if (!["https:", "http:"].includes(origin.protocol)) throw new Error("PARALLAX_BROWSER_ORIGIN_INVALID");
    this.origin = origin.origin;
    this.fetchAsset = options.fetchAsset ?? fetch;
    this.loader = options.loader ?? new GLTFLoader();
  }

  private async modelBytes(model: ModelReference, signal: AbortSignal) {
    const url = new URL(model.url, this.origin);
    if (url.origin !== this.origin) throw new Error("PARALLAX_BROWSER_ASSET_ORIGIN_INVALID");
    const response = await this.fetchAsset(url.href, {
      credentials: "same-origin",
      mode: "same-origin",
      redirect: "error",
      cache: "no-store",
      signal,
    });
    const reject = async (error: Error): Promise<never> => {
      await response.body?.cancel().catch(() => undefined);
      throw error;
    };
    if (signal.aborted) return reject(cancelled());
    if (!response.ok || response.redirected || (response.url && new URL(response.url).origin !== this.origin))
      return reject(new Error("PARALLAX_BROWSER_ASSET_UNAVAILABLE"));
    if (response.headers.get("content-type")?.split(";")[0].trim() !== "model/gltf-binary")
      return reject(new Error("PARALLAX_BROWSER_ASSET_TYPE_INVALID"));
    const declared = response.headers.get("content-length");
    if (declared !== null && Number(declared) !== model.byteLength)
      return reject(new Error("PARALLAX_BROWSER_ASSET_SIZE_INVALID"));
    if (!response.body) throw new Error("PARALLAX_BROWSER_ASSET_UNAVAILABLE");
    const reader = response.body.getReader();
    const abort = () => {
      void reader.cancel().catch(() => undefined);
    };
    signal.addEventListener("abort", abort, { once: true });
    let length = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        if (signal.aborted) throw cancelled();
        const chunk = await reader.read();
        if (signal.aborted) throw cancelled();
        if (chunk.done) break;
        length += chunk.value.byteLength;
        if (length > model.byteLength) throw new Error("PARALLAX_BROWSER_ASSET_SIZE_INVALID");
        chunks.push(chunk.value);
      }
      if (length !== model.byteLength) throw new Error("PARALLAX_BROWSER_ASSET_SIZE_INVALID");
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    } finally {
      signal.removeEventListener("abort", abort);
      reader.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (signal.aborted) throw cancelled();
    if (sha256 !== model.sha256) throw new Error("PARALLAX_BROWSER_ASSET_INTEGRITY_FAILED");
    return bytes.buffer;
  }

  private update(graph: Graph, delivery: SceneDelivery) {
    for (const entity of delivery.entities) {
      const holder = graph.entities.get(entity.id)!;
      holder.position.set(entity.transform.position.x, entity.transform.position.y, entity.transform.position.z);
      holder.quaternion.set(
        entity.transform.rotation.x,
        entity.transform.rotation.y,
        entity.transform.rotation.z,
        entity.transform.rotation.w,
      );
      holder.scale.setScalar(entity.transform.scale);
      holder.visible = entity.visible && entity.opacity > 0;
      holder.userData.selectable = entity.selectable && entity.interactions.length > 0;
      holder.traverse((object) => {
        const mesh = object as T.Mesh;
        if (!mesh.material) return;
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          const initial = graph.materials.get(material)!;
          material.opacity = initial.opacity * entity.opacity;
          const transparent = initial.transparent || material.opacity < 1;
          if (material.transparent !== transparent) {
            material.transparent = transparent;
            material.needsUpdate = true;
          }
        }
      });
    }
    graph.root.visible = true;
    graph.root.updateWorldMatrix(true, true);
  }

  async renderScene(input: SceneDelivery): Promise<void> {
    if (this.disposed) throw cancelled();
    const revision = ++this.generation;
    this.pending?.abort();
    this.pending = null;
    if (this.active) this.active.root.visible = false;
    const delivery = sceneDeliverySchema.parse(input);
    const supported = new Set(["WORLD_TRACKING", "PLANE_PLACEMENT", "MODEL_GLB"]);
    if (delivery.requirements.some((requirement) => !supported.has(requirement)))
      throw new Error("PARALLAX_BROWSER_PRESENTATION_UNSUPPORTED");
    if (
      delivery.entities.some(
        (entity) =>
          entity.element?.enabled &&
          (entity.element.kind !== "PHYSICAL_ASSET" || entity.element.articulation !== 0 || entity.element.playback),
      )
    )
      throw new Error("PARALLAX_BROWSER_PRESENTATION_UNSUPPORTED");
    const key = signature(delivery);
    if (this.active?.signature === key) {
      this.update(this.active, delivery);
      return;
    }
    const abort = new AbortController();
    this.pending = abort;
    const current = () => {
      if (this.disposed || abort.signal.aborted || revision !== this.generation) throw cancelled();
    };
    const graph: Graph = { root: new T.Group(), entities: new Map(), materials: new Map(), signature: key };
    graph.root.name = "parallax-scene-presentation";
    const buffers = new Map<string, ArrayBuffer>();
    try {
      for (const entity of delivery.entities) {
        current();
        const holder = new T.Group();
        holder.name = `entity:${entity.id}`;
        holder.userData.entityId = entity.id;
        holder.userData.parentEntityId = entity.parentEntityId;
        graph.root.add(holder);
        graph.entities.set(entity.id, holder);
        if (entity.element && !entity.element.enabled) continue;
        if (entity.model) {
          let buffer = buffers.get(entity.model.sha256);
          if (!buffer) {
            buffer = await this.modelBytes(entity.model, abort.signal);
            buffers.set(entity.model.sha256, buffer);
          }
          current();
          const model = await this.loader.parseAsync(buffer, "");
          const units = new T.Group();
          units.scale.setScalar(entity.widthMeters / entity.model.sourceWidthMeters);
          units.add(model.scene);
          holder.add(units);
          // GLTF parsing cannot be aborted. Attach to the disposable candidate before checking its generation.
          current();
        } else {
          if (!this.options.createLegacyEntity) throw new Error("PARALLAX_BROWSER_LEGACY_PRESENTER_REQUIRED");
          const geometryFrame = new T.Group();
          // V2 surface anchors keep +Y as their normal, independently of content.
          // Legacy quads face +Z, so only their local geometry needs conversion.
          if (delivery.anchors.some((anchor) => anchor.id === entity.anchorId && anchor.kind === "SURFACE_RELATIVE"))
            geometryFrame.rotation.x = -Math.PI / 2;
          geometryFrame.add(this.options.createLegacyEntity(entity));
          holder.add(geometryFrame);
        }
        holder.traverse((object) => {
          const mesh = object as T.Mesh;
          if (mesh.material)
            for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
              if (!graph.materials.has(material))
                graph.materials.set(material, { opacity: material.opacity, transparent: material.transparent });
        });
      }
      current();
      this.update(graph, delivery);
      const previous = this.active;
      this.scene.add(graph.root);
      this.active = graph;
      if (previous) disposeGraph(previous.root);
    } catch (error) {
      disposeGraph(graph.root);
      throw error;
    } finally {
      if (this.pending === abort) this.pending = null;
    }
  }

  /** Returns stable authored identity only; the owning Lens handles Inspect and its receipt. */
  pick(raycaster: T.Raycaster): string | null {
    const graph = this.active;
    if (this.disposed || this.pending || !graph?.root.visible) return null;
    graph.root.updateWorldMatrix(true, true);
    raycaster.camera = this.camera;
    for (const hit of raycaster.intersectObjects(graph.root.children, true)) {
      let object: T.Object3D | null = hit.object;
      let entity: T.Object3D | null = null;
      let visible = true;
      while (object && object !== graph.root) {
        if (!object.visible) visible = false;
        if (typeof object.userData.entityId === "string") entity = object;
        object = object.parent;
      }
      if (visible && entity?.userData.selectable) return entity.userData.entityId as string;
    }
    return null;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.generation++;
    this.pending?.abort();
    this.pending = null;
    if (this.active) disposeGraph(this.active.root);
    this.active = null;
  }
}
