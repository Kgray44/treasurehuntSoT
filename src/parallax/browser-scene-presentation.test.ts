// @vitest-environment node
import { readFile } from "node:fs/promises";
import * as T from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { beforeEach, expect, it, vi } from "vitest";
import { syntheticSpatialMoment } from "./fixtures";
import { identityTransform } from "./contracts";
import { createSceneDelivery, type SceneDelivery } from "./scene-delivery";
import { BrowserScenePresentation } from "./browser-scene-presentation";

const compass = new Uint8Array(await readFile("public/parallax/sc02/models/brass-compass.glb"));
const response = (bytes = compass) =>
  new Response(new Uint8Array(bytes), { headers: { "Content-Type": "model/gltf-binary" } });
function delivery(checksum = "b".repeat(64)): SceneDelivery {
  const { version } = syntheticSpatialMoment();
  const entity = version.entities[0];
  version.checksum = checksum;
  entity.kind = "MARKER";
  entity.widthMeters = 0.16;
  entity.element = {
    kind: "PHYSICAL_ASSET",
    modelId: "brass-compass",
    packageVersion: "1.0.0",
    enabled: true,
    articulation: 0,
  };
  return createSceneDelivery({
    version,
    instanceId: "instance:test:run",
    playthroughId: "voyage-1",
    blockId: "passage-1",
    transforms: new Map([[entity.id, identityTransform()]]),
    visibleEntityIds: [entity.id],
    elapsedMs: 0,
  });
}
function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
function model() {
  const scene = new T.Group();
  const mesh = new T.Mesh(
    new T.BoxGeometry(0.16, 0.045, 0.19),
    new T.MeshStandardMaterial({ color: "#b39b58", metalness: 0.82, roughness: 0.3 }),
  );
  scene.add(mesh);
  const geometry = vi.spyOn(mesh.geometry, "dispose"),
    material = vi.spyOn(mesh.material, "dispose");
  return { gltf: { scene } as GLTF, scene, geometry, material };
}
const origin = "https://voyage.example";
let fetchAsset: ReturnType<typeof vi.fn<typeof fetch>>;
beforeEach(() => {
  fetchAsset = vi.fn<typeof fetch>().mockImplementation(async () => response());
});

it("parses the original compass GLB with its PBR materials, internal matrices, pivot and authored width", async () => {
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera();
  const presenter = new BrowserScenePresentation(scene, camera, { origin, fetchAsset });
  const source = delivery();
  source.entities[0].widthMeters = 0.32;
  source.entities[0].transform = { ...identityTransform(), position: { x: 1, y: 2, z: -3 }, scale: 1.5 };
  await presenter.renderScene(source);
  const graph = scene.getObjectByName("parallax-scene-presentation")!;
  const bounds = new T.Box3().setFromObject(graph),
    size = bounds.getSize(new T.Vector3());
  expect(size.x).toBeCloseTo(0.48, 5);
  expect(size.y).toBeCloseTo(0.135, 5);
  expect(size.z).toBeCloseTo(0.57, 5);
  expect(bounds.min.y).toBeCloseTo(2, 5);
  const materials: T.MeshStandardMaterial[] = [];
  graph.traverse((object) => {
    if (object instanceof T.Mesh) materials.push(object.material as T.MeshStandardMaterial);
  });
  expect(materials).toHaveLength(4);
  expect(materials.some((material) => material.metalness === 0.82 && material.roughness === 0.3)).toBe(true);
  expect(fetchAsset).toHaveBeenCalledWith(
    source.entities[0].model!.url.replace(/^\//, `${origin}/`),
    expect.objectContaining({
      credentials: "same-origin",
      mode: "same-origin",
      redirect: "error",
      cache: "no-store",
      signal: expect.any(AbortSignal),
    }),
  );
  presenter.dispose();
});

it("maps real model raycasts to exact entity identity and updates transforms/visibility without reloading", async () => {
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera();
  const presenter = new BrowserScenePresentation(scene, camera, { origin, fetchAsset });
  const source = delivery();
  const ray = new T.Raycaster(new T.Vector3(0, 1, 0), new T.Vector3(0, -1, 0));
  await presenter.renderScene(source);
  expect(presenter.pick(ray)).toBe("captains-note");
  source.entities[0].selectable = false;
  await presenter.renderScene(source);
  expect(presenter.pick(ray)).toBeNull();
  source.entities[0].selectable = true;
  source.entities[0].visible = false;
  await presenter.renderScene(source);
  expect(presenter.pick(ray)).toBeNull();
  source.entities[0].visible = true;
  source.entities[0].transform.position.x = 2;
  source.entities[0].transform.rotation = { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 };
  await presenter.renderScene(source);
  expect(presenter.pick(ray)).toBeNull();
  ray.set(new T.Vector3(2, 1, 0), new T.Vector3(0, -1, 0));
  expect(presenter.pick(ray)).toBe("captains-note");
  expect(fetchAsset).toHaveBeenCalledTimes(1);
  presenter.dispose();
});

it("applies resolved child transforms once while retaining authored parent identity", async () => {
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera();
  const presenter = new BrowserScenePresentation(scene, camera, { origin, fetchAsset });
  const source = delivery();
  const parent = source.entities[0];
  parent.transform.position.x = 2;
  const child = structuredClone(parent);
  child.id = "compass-child";
  child.parentEntityId = parent.id;
  child.authoredTransform.position.x = 1;
  child.transform.position.x = 3;
  source.entities.push(child);
  await presenter.renderScene(source);
  const holder = scene.getObjectByName("entity:compass-child")!;
  expect(holder.getWorldPosition(new T.Vector3()).x).toBe(3);
  expect(holder.userData.parentEntityId).toBe(parent.id);
  expect(fetchAsset).toHaveBeenCalledTimes(1);
  presenter.dispose();
});

it("rejects corrupted bytes before parsing and fails closed instead of exposing an earlier revision", async () => {
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera();
  const parsed = model(),
    parseAsync = vi.fn().mockResolvedValue(parsed.gltf);
  const presenter = new BrowserScenePresentation(scene, camera, { origin, fetchAsset, loader: { parseAsync } });
  await presenter.renderScene(delivery());
  const corrupt = new Uint8Array(compass);
  corrupt[corrupt.length - 1] ^= 1;
  fetchAsset.mockResolvedValueOnce(response(corrupt));
  await expect(presenter.renderScene(delivery("c".repeat(64)))).rejects.toThrow(
    "PARALLAX_BROWSER_ASSET_INTEGRITY_FAILED",
  );
  expect(parseAsync).toHaveBeenCalledTimes(1);
  expect(scene.getObjectByName("parallax-scene-presentation")!.visible).toBe(false);
  expect(presenter.pick(new T.Raycaster())).toBeNull();
  presenter.dispose();
});

it("bounds network streams and cancels oversized downloads before parsing", async () => {
  const cancel = vi.fn(),
    parseAsync = vi.fn();
  fetchAsset.mockResolvedValueOnce(
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(compass.length + 1));
        },
        cancel,
      }),
      { headers: { "Content-Type": "model/gltf-binary" } },
    ),
  );
  const presenter = new BrowserScenePresentation(new T.Scene(), new T.PerspectiveCamera(), {
    origin,
    fetchAsset,
    loader: { parseAsync },
  });
  await expect(presenter.renderScene(delivery())).rejects.toThrow("PARALLAX_BROWSER_ASSET_SIZE_INVALID");
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(parseAsync).not.toHaveBeenCalled();
  presenter.dispose();
});

it("atomically keeps the newest revision when an older non-abortable GLTF parse finishes later", async () => {
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera();
  const first = deferred<GLTF>(),
    second = deferred<GLTF>(),
    stale = model(),
    current = model();
  const parseAsync = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const presenter = new BrowserScenePresentation(scene, camera, { origin, fetchAsset, loader: { parseAsync } });
  const oldResult = presenter.renderScene(delivery()).catch((error: Error) => error);
  await vi.waitFor(() => expect(parseAsync).toHaveBeenCalledTimes(1));
  const newest = presenter.renderScene(delivery("c".repeat(64)));
  await vi.waitFor(() => expect(parseAsync).toHaveBeenCalledTimes(2));
  second.resolve(current.gltf);
  await newest;
  first.resolve(stale.gltf);
  expect(((await oldResult) as Error).message).toBe("PARALLAX_BROWSER_PRESENTATION_CANCELLED");
  expect(current.scene.parent).not.toBeNull();
  expect(stale.scene.parent).toBeNull();
  expect(stale.geometry).toHaveBeenCalledTimes(1);
  expect(stale.material).toHaveBeenCalledTimes(1);
  expect(scene.children).toHaveLength(1);
  presenter.dispose();
  expect(current.geometry).toHaveBeenCalledTimes(1);
  expect(current.material).toHaveBeenCalledTimes(1);
});

it("disposing during GLTF parsing releases the late model and cannot resurrect a scene or affect the host camera", async () => {
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera();
  const host = new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial());
  const hostDispose = vi.spyOn(host.geometry, "dispose");
  scene.add(camera, host);
  const parsing = deferred<GLTF>(),
    loaded = model(),
    parseAsync = vi.fn().mockReturnValue(parsing.promise);
  const presenter = new BrowserScenePresentation(scene, camera, { origin, fetchAsset, loader: { parseAsync } });
  const result = presenter.renderScene(delivery()).catch((error: Error) => error);
  await vi.waitFor(() => expect(parseAsync).toHaveBeenCalledTimes(1));
  presenter.dispose();
  presenter.dispose();
  parsing.resolve(loaded.gltf);
  expect(((await result) as Error).message).toBe("PARALLAX_BROWSER_PRESENTATION_CANCELLED");
  expect(loaded.geometry).toHaveBeenCalledTimes(1);
  expect(scene.children).toEqual([camera, host]);
  expect(hostDispose).not.toHaveBeenCalled();
  await expect(presenter.renderScene(delivery())).rejects.toThrow("PARALLAX_BROWSER_PRESENTATION_CANCELLED");
});

it("aborts pending authorized fetch and never invokes its parser after disposal", async () => {
  const loading = deferred<Response>(),
    parseAsync = vi.fn();
  fetchAsset.mockReturnValueOnce(loading.promise);
  const presenter = new BrowserScenePresentation(new T.Scene(), new T.PerspectiveCamera(), {
    origin,
    fetchAsset,
    loader: { parseAsync },
  });
  const result = presenter.renderScene(delivery()).catch((error: Error) => error);
  const signal = fetchAsset.mock.calls[0][1]!.signal!;
  presenter.dispose();
  expect(signal.aborted).toBe(true);
  loading.resolve(response());
  expect(((await result) as Error).message).toBe("PARALLAX_BROWSER_PRESENTATION_CANCELLED");
  expect(parseAsync).not.toHaveBeenCalled();
});

it("rejects unavailable effects instead of silently discarding authored semantics", async () => {
  const presenter = new BrowserScenePresentation(new T.Scene(), new T.PerspectiveCamera(), { origin, fetchAsset });
  const source = delivery();
  source.requirements.push("PARTICLES");
  await expect(presenter.renderScene(source)).rejects.toThrow("PARALLAX_BROWSER_PRESENTATION_UNSUPPORTED");
  expect(fetchAsset).not.toHaveBeenCalled();
  presenter.dispose();
});

it("reuses the host legacy presenter and releases its owned textures without accumulating opacity", async () => {
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera();
  const texture = new T.Texture();
  const close = vi.fn();
  texture.source.data = { close };
  const mesh = new T.Mesh(
    new T.PlaneGeometry(),
    new T.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.8 }),
  );
  const disposeTexture = vi.spyOn(texture, "dispose"),
    disposeMaterial = vi.spyOn(mesh.material, "dispose");
  const createLegacyEntity = vi.fn(() => mesh);
  const presenter = new BrowserScenePresentation(scene, camera, { origin, fetchAsset, createLegacyEntity });
  const source = delivery();
  delete source.entities[0].model;
  delete source.entities[0].element;
  source.requirements = ["WORLD_TRACKING"];
  source.anchors[0] = {
    id: source.anchors[0].id,
    frameId: source.anchors[0].frameId,
    kind: "SURFACE_RELATIVE",
    alignment: "HORIZONTAL",
    transform: source.anchors[0].transform,
  };
  source.entities[0].opacity = 0.5;
  await presenter.renderScene(source);
  const normal = new T.Vector3(0, 0, 1).applyQuaternion(mesh.getWorldQuaternion(new T.Quaternion()));
  expect(normal.y).toBeCloseTo(1);
  expect(mesh.material.opacity).toBe(0.4);
  source.entities[0].opacity = 1;
  await presenter.renderScene(source);
  expect(mesh.material.opacity).toBe(0.8);
  expect(createLegacyEntity).toHaveBeenCalledTimes(1);
  expect(fetchAsset).not.toHaveBeenCalled();
  presenter.dispose();
  expect(disposeTexture).toHaveBeenCalledTimes(1);
  expect(disposeMaterial).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledTimes(1);
});
