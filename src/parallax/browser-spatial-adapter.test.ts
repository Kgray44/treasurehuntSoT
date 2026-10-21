import { readFileSync } from "node:fs";
import * as T from "three";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BrowserCameraBroker } from "@/sextant/camera";
import { BrowserSpatialAdapter } from "./browser-spatial-adapter";
import {
  browserTrackingAvailability,
  hasMetricBrowserPose,
  type BrowserTrackingSample,
  type BrowserWorldTrackingProvider,
} from "./browser-world-tracking";
import { syntheticBinding, syntheticSpatialMoment, guidedContext } from "./fixtures";
import { identityTransform, receiptSchema } from "./contracts";
import { materializeSpatialVersion } from "./publication";
import { ParallaxLensRuntime } from "./runtime";
import { evaluateSpatialEvidence } from "./evidence";
import { createSceneDelivery } from "./scene-delivery";

const bytes = new Uint8Array(readFileSync("public/parallax/sc02/models/brass-compass.glb"));
const origin = "https://voyage.example";
const date = new Date("2026-10-22T00:00:00.000Z");
const active: ParallaxLensRuntime[] = [],
  adapters: BrowserSpatialAdapter[] = [];
function moment() {
  const value = syntheticSpatialMoment(),
    { checksum, ...content } = value.version;
  void checksum;
  content.anchors[0].transform = identityTransform();
  content.entities[0].element = {
    enabled: true,
    kind: "PHYSICAL_ASSET",
    modelId: "brass-compass",
    packageVersion: "1.0.0",
    articulation: 0,
  };
  content.entities[0].widthMeters = 0.16;
  value.version = materializeSpatialVersion(content);
  value.attachment.versionChecksum = value.version.checksum;
  return value;
}
function setup() {
  let clock = 10,
    currentDate = date;
  let sample: BrowserTrackingSample | null = null;
  let projection: ArrayLike<number> | null = new T.PerspectiveCamera(60, 1, 0.005, 1000).projectionMatrix.elements;
  const callbacks = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  const track = Object.assign(new EventTarget(), {
    readyState: "live",
    stop: vi.fn(() => {
      track.readyState = "ended";
    }),
  });
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
  const getUserMedia = vi.fn(async () => stream);
  const broker = new BrowserCameraBroker({ getUserMedia });
  const admission = {
    available: true,
    source: "AUTHORIZED_PRIVATE_EVALUATION" as const,
    origin,
    expiresAt: "2026-10-23T00:00:00.000Z",
  };
  const provider: BrowserWorldTrackingProvider = {
    providerId: "parallax.browser.explicit-test-fixture.v1",
    method: "VISUAL_SLAM",
    scale: "METRIC_6DOF",
    discover: vi.fn(async () => admission),
    start: vi.fn(async () => ({ sessionId: "browser-frame-1" })),
    read: () => sample,
    cameraProjection: () => projection,
    stop: vi.fn(async () => {}),
  };
  const renderer = { render: vi.fn(), clear: vi.fn() },
    select = vi.fn();
  const fetchAsset = vi.fn<typeof fetch>(
    async () => new Response(new Uint8Array(bytes), { headers: { "Content-Type": "model/gltf-binary" } }),
  );
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera();
  const adapter = new BrowserSpatialAdapter({
    provider,
    broker,
    video: document.createElement("video"),
    scene,
    camera,
    renderer,
    viewport: () => ({ width: 800, height: 600 }),
    select,
    origin,
    now: () => clock,
    date: () => currentDate,
    requestFrame: (callback) => {
      callbacks.set(++frameId, callback);
      return frameId;
    },
    cancelFrame: (id) => {
      callbacks.delete(id);
    },
    presentation: { fetchAsset },
  });
  adapters.push(adapter);
  const frame = (update: Partial<BrowserTrackingSample> = {}) => {
    clock += 20;
    sample = {
      sessionId: "browser-frame-1",
      timestampMs: clock,
      method: "VISUAL_SLAM",
      status: "TRACKING",
      confidence: "METRIC_6DOF",
      sessionFromCamera: identityTransform(),
      ...update,
    };
    const entry = [...callbacks.entries()][0];
    if (entry) {
      callbacks.delete(entry[0]);
      entry[1](clock);
    }
  };
  return {
    adapter,
    provider,
    broker,
    renderer,
    select,
    fetchAsset,
    getUserMedia,
    track,
    admission,
    scene,
    camera,
    callbacks,
    frame,
    projection: (value: ArrayLike<number> | null) => {
      projection = value;
    },
    expire: () => {
      currentDate = new Date("2026-10-24T00:00:00.000Z");
    },
    stale: () => {
      clock += 600;
      const entry = [...callbacks.entries()][0];
      if (entry) {
        callbacks.delete(entry[0]);
        entry[1](clock);
      }
    },
  };
}
async function open(fixture: ReturnType<typeof setup>) {
  expect((await fixture.adapter.discover()).supported).toBe(true);
  const camera = await fixture.adapter.authorize();
  const lens = new ParallaxLensRuntime(moment(), syntheticBinding, { ...guidedContext(), camera }, () => date);
  active.push(lens);
  await lens.open(fixture.adapter);
  for (let i = 0; i < 3; i++) fixture.frame();
  expect(lens.read()).toMatchObject({ mode: "BROWSER", state: "READY" });
  return lens;
}
beforeEach(() => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
});
afterEach(async () => {
  await Promise.all(active.splice(0).map((lens) => lens.close()));
  await Promise.all(adapters.splice(0).map((adapter) => adapter.stop()));
  vi.restoreAllMocks();
});

it("uses the real GLB graph, fresh provider projection and exact mesh identity in the existing BROWSER runtime receipt", async () => {
  const fixture = setup(),
    lens = await open(fixture);
  const ray = new T.Raycaster(new T.Vector3(0, 1, 0), new T.Vector3(0, -1, 0));
  expect(fixture.adapter.select(ray)).toBe("captains-note");
  expect(fixture.select).toHaveBeenCalledWith("captains-note", "PICK", expect.any(AbortSignal));
  const receipt = await lens.interact("captains-note", "INSPECT", "browser-inspect-1");
  expect(receipt).toMatchObject({
    mode: "BROWSER",
    synthetic: false,
    authority: "NONAUTHORITATIVE",
    providerId: fixture.provider.providerId,
    versionChecksum: lens.moment.version.checksum,
  });
  expect(evaluateSpatialEvidence(receipt, lens.moment, syntheticBinding, date)).toMatchObject({
    disposition: "OBSERVED_ONLY",
    progressionChanged: false,
    physicalQualification: "NOT_ESTABLISHED",
  });
  fixture.frame({ sessionFromCamera: { ...identityTransform(), position: { x: 1, y: 2, z: 3 } } });
  expect(fixture.camera.position.toArray()).toEqual([1, 2, 3]);
  expect(fixture.renderer.render).toHaveBeenCalledWith(fixture.scene, fixture.camera);
  expect(fixture.fetchAsset).toHaveBeenCalledTimes(1);
  await lens.useGuidedView({ inspection: receipt });
  expect(lens.read()).toMatchObject({ mode: "GUIDED", inspectedEntityId: "captains-note" });
  expect(fixture.track.stop).toHaveBeenCalledTimes(1);
  expect(fixture.callbacks.size).toBe(0);
});

it("never calls relative poses meter-based world tracking and leaves no configured production provider", async () => {
  const fixture = setup();
  Object.defineProperty(fixture.provider, "scale", { value: "POSITION_NO_SCALE" });
  expect((await fixture.adapter.discover()).supported).toBe(false);
  expect(fixture.adapter.worldTracking).toBe(false);
  expect(fixture.adapter.supportsScene(moment().version)).toBe(false);
  await expect(fixture.adapter.authorize()).rejects.toThrow("PARALLAX_BROWSER_PROVIDER_NOT_ADMITTED");
  expect(fixture.getUserMedia).not.toHaveBeenCalled();
  expect(browserTrackingAvailability()).toMatchObject({ supported: false });
  expect(
    hasMetricBrowserPose(
      {
        sessionId: "relative",
        timestampMs: 20,
        method: "VISUAL_SLAM",
        status: "TRACKING",
        confidence: "POSITION_NO_SCALE",
        sessionFromCamera: identityTransform(),
      },
      20,
      "relative",
      "VISUAL_SLAM",
    ),
  ).toBe(false);
});

it("drops stale, relative, foreign-session and invalid-projection frames before rendering, picking or interaction", async () => {
  const fixture = setup(),
    lens = await open(fixture);
  const ray = new T.Raycaster(new T.Vector3(0, 1, 0), new T.Vector3(0, -1, 0));
  for (const bad of [{ confidence: "POSITION_NO_SCALE" as const }, { sessionId: "foreign-frame" }]) {
    fixture.frame(bad);
    expect(fixture.adapter.pick(ray)).toBeNull();
    await expect(lens.interact("captains-note", "INSPECT", "invalid-frame")).rejects.toThrow("PARALLAX_LENS_NOT_READY");
    for (let i = 0; i < 3; i++) fixture.frame();
  }
  fixture.stale();
  expect(fixture.adapter.pick(ray)).toBeNull();
  expect(lens.read().state).toBe("DEGRADED");
  for (let i = 0; i < 3; i++) fixture.frame();
  fixture.projection(new Array(16).fill(0));
  const renders = fixture.renderer.render.mock.calls.length;
  fixture.frame();
  expect(fixture.adapter.pick(ray)).toBeNull();
  expect(fixture.renderer.render).toHaveBeenCalledTimes(renders);
  expect(fixture.renderer.clear).toHaveBeenCalled();
});

it("expires origin authorization through existing Guided shutdown and does not advertise a plane", async () => {
  const fixture = setup(),
    lens = await open(fixture);
  expect(fixture.adapter.planePlacement).toBe(false);
  expect(await fixture.adapter.place()).toBeNull();
  fixture.expire();
  fixture.frame();
  await vi.waitFor(() => expect(lens.read().mode).toBe("GUIDED"));
  expect(fixture.track.readyState).toBe("ended");
  expect(fixture.callbacks.size).toBe(0);
  expect(fixture.provider.stop).toHaveBeenCalledTimes(1);
});

it("rejects expired/foreign origin admission and mixed receipt source claims before camera acquisition", async () => {
  const fixture = setup();
  fixture.admission.origin = "https://foreign.example";
  expect((await fixture.adapter.discover()).supported).toBe(false);
  fixture.admission.origin = origin;
  fixture.expire();
  expect((await fixture.adapter.discover()).supported).toBe(false);
  expect(fixture.getUserMedia).not.toHaveBeenCalled();
  const lens = new ParallaxLensRuntime(syntheticSpatialMoment(), syntheticBinding, guidedContext(), () => date);
  active.push(lens);
  await lens.open();
  const receipt = await lens.interact("captains-note", "INSPECT", "source-check");
  for (const changed of [
    { mode: "BROWSER", providerId: "parallax.ios.local.v1" },
    { mode: "BROWSER", providerId: "parallax.browser.example.v1", synthetic: true },
  ])
    expect(receiptSchema.safeParse({ ...receipt, ...changed }).success).toBe(false);
});

it("cancels a pending camera lease without leaking a late stream or starting a provider", async () => {
  const fixture = setup();
  let resolve!: (stream: MediaStream) => void;
  fixture.getUserMedia.mockImplementationOnce(
    () =>
      new Promise((yes) => {
        resolve = yes;
      }),
  );
  await fixture.adapter.discover();
  const authorizing = fixture.adapter.authorize();
  await vi.waitFor(() => expect(fixture.getUserMedia).toHaveBeenCalledTimes(1));
  await fixture.adapter.stop();
  resolve({ getTracks: () => [fixture.track], getVideoTracks: () => [fixture.track] } as unknown as MediaStream);
  await expect(authorizing).rejects.toThrow("CAMERA_REQUEST_CANCELLED");
  expect(fixture.track.readyState).toBe("ended");
  expect(fixture.provider.start).not.toHaveBeenCalled();
  expect(fixture.broker.ownedTracks).toBe(0);
});

it("rejects foreign delivery identity and unsupported planes on an active browser session", async () => {
  const fixture = setup(),
    lens = await open(fixture);
  const delivery = createSceneDelivery({
    version: lens.moment.version,
    instanceId: lens.instanceId,
    playthroughId: syntheticBinding.sessionId,
    blockId: syntheticBinding.blockId,
    transforms: new Map([["captains-note", identityTransform()]]),
    visibleEntityIds: ["captains-note"],
    elapsedMs: 0,
  });
  await expect(
    fixture.adapter.renderScene({
      ...delivery,
      identity: { ...delivery.identity, instanceId: "instance:foreign:run" },
    }),
  ).rejects.toThrow("PARALLAX_BROWSER_SCENE_IDENTITY_MISMATCH");
  await expect(
    fixture.adapter.renderScene({ ...delivery, requirements: [...delivery.requirements, "PLANE_PLACEMENT"] }),
  ).rejects.toThrow("PARALLAX_BROWSER_SCENE_UNSUPPORTED");
  expect(fixture.fetchAsset).toHaveBeenCalledTimes(1);
});

it("closes during model staging without waiting for or reviving a late asset response", async () => {
  const fixture = setup();
  let resolve!: (response: Response) => void;
  fixture.fetchAsset.mockImplementationOnce(
    () =>
      new Promise((yes) => {
        resolve = yes;
      }),
  );
  await fixture.adapter.discover();
  const camera = await fixture.adapter.authorize();
  const lens = new ParallaxLensRuntime(moment(), syntheticBinding, { ...guidedContext(), camera }, () => date);
  active.push(lens);
  const opening = lens.open(fixture.adapter);
  await vi.waitFor(() => expect(fixture.fetchAsset).toHaveBeenCalledTimes(1));
  await lens.close();
  expect(lens.read().state).toBe("CLOSED");
  expect(fixture.broker.ownedTracks).toBe(0);
  expect(fixture.callbacks.size).toBe(0);
  resolve(new Response(new Uint8Array(bytes), { headers: { "Content-Type": "model/gltf-binary" } }));
  await opening;
  expect(lens.read()).toMatchObject({ state: "CLOSED", inspectedEntityId: null, visibleEntityIds: [] });
  expect(fixture.scene.getObjectByName("parallax-scene-presentation")).toBeUndefined();
});

it("does not overlap a new provider start or revive rendering when an old unabortable start settles after close", async () => {
  const fixture = setup();
  let resolve!: (reply: { sessionId: string }) => void;
  vi.mocked(fixture.provider.start).mockImplementationOnce(
    () =>
      new Promise((yes) => {
        resolve = yes;
      }),
  );
  await fixture.adapter.discover();
  const camera = await fixture.adapter.authorize();
  const lens = new ParallaxLensRuntime(moment(), syntheticBinding, { ...guidedContext(), camera }, () => date);
  active.push(lens);
  const opening = lens.open(fixture.adapter);
  await vi.waitFor(() => expect(fixture.provider.start).toHaveBeenCalledTimes(1));
  await lens.close();
  await expect(fixture.adapter.authorize()).rejects.toThrow("PARALLAX_BROWSER_PROVIDER_STOPPING");
  resolve({ sessionId: "late-retired-frame" });
  await opening;
  expect(fixture.provider.stop).toHaveBeenCalledTimes(2);
  expect(fixture.renderer.render).not.toHaveBeenCalled();
  expect(fixture.fetchAsset).not.toHaveBeenCalled();
  expect(fixture.callbacks.size).toBe(0);
  expect(lens.read().state).toBe("CLOSED");
});
