import { afterEach, expect, it, vi } from "vitest";
import { syntheticBinding, syntheticSpatialMoment, guidedContext } from "./fixtures";
import { materializeSpatialVersion } from "./publication";
import { emptyStudioContent, type Behavior } from "./studio-contracts";
import { ParallaxLensRuntime, type SpatialRuntimeAdapter } from "./runtime";
import type { SceneDelivery } from "./scene-delivery";

function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function moment(behaviors: Behavior[], targetVisible: boolean, twoEntities = false) {
  const value = syntheticSpatialMoment();
  const { checksum, ...content } = value.version;
  void checksum;
  const target = content.entities[0];
  target.element = {
    kind: "PHYSICAL_ASSET",
    enabled: true,
    modelId: "brass-compass",
    packageVersion: "1.0.0",
    articulation: 0,
  };
  target.widthMeters = 0.16;
  if (twoEntities) {
    const control = structuredClone(target);
    control.id = "inspection-control";
    content.entities.push(control);
  }
  content.studio = {
    ...emptyStudioContent(),
    behaviors,
    layers: content.entities.map((entity) => ({
      entityId: entity.id,
      tags: [],
      visible: entity.id === target.id ? targetVisible : true,
      locked: false,
      selectable: true,
      audience: "BOTH",
    })),
  };
  value.version = materializeSpatialVersion(content);
  value.attachment.versionChecksum = value.version.checksum;
  return value;
}
const behavior = (action: "SHOW" | "HIDE", delayMs: number): Behavior => ({
  id: `timer-${action}-${delayMs}`,
  trigger: "TIMER",
  delayMs,
  action,
  targetEntityId: "captains-note",
});
function adapter(block: (index: number) => Promise<void> | undefined = () => undefined) {
  const frames: SceneDelivery[] = [];
  let simultaneous = 0,
    maximum = 0;
  const native: SpatialRuntimeAdapter = {
    providerId: "test.native.delivery",
    mode: "NATIVE",
    worldTracking: true,
    planePlacement: true,
    supportsScene: () => true,
    start: vi.fn(async ({ emit }) => {
      for (let i = 0; i < 3; i++) emit({ type: "TRACKING", state: "NORMAL" });
    }),
    stop: vi.fn(async () => {}),
    resolve: vi.fn(async (anchor) => anchor.transform),
    place: vi.fn(async () => null),
    render: vi.fn(async () => {
      throw new Error("EXPECTED_V2");
    }),
    renderScene: vi.fn(async (scene) => {
      const index = frames.length;
      frames.push(structuredClone(scene));
      maximum = Math.max(maximum, ++simultaneous);
      try {
        await block(index);
      } finally {
        simultaneous--;
      }
    }),
  };
  return { native, frames, maximum: () => maximum };
}
const opened: ParallaxLensRuntime[] = [];
function runtime(value: ReturnType<typeof moment>, now?: () => Date) {
  const context = guidedContext();
  context.camera = { ...context.camera, support: "SUPPORTED", permission: "GRANTED", availability: "AVAILABLE" };
  const result = new ParallaxLensRuntime(value, syntheticBinding, context, now);
  opened.push(result);
  return result;
}
afterEach(async () => {
  await Promise.all(opened.splice(0).map((value) => value.close()));
  vi.useRealTimers();
});

it.each(["SHOW", "HIDE"] as const)(
  "catches up a %s deadline that elapses while the first GLB is staging",
  async (action) => {
    let clock = 0;
    const staging = deferred(),
      provider = adapter((index) => (index === 0 ? staging.promise : undefined));
    const lens = runtime(moment([behavior(action, 100)], action === "HIDE"), () => new Date(clock));
    const opening = lens.open(provider.native);
    await vi.waitFor(() => expect(provider.frames).toHaveLength(1));
    expect(provider.frames[0].entities[0].visible).toBe(action === "HIDE");
    clock = 5000;
    staging.resolve();
    await opening;
    expect(provider.frames).toHaveLength(2);
    expect(provider.frames[1].entities[0].visible).toBe(action === "SHOW");
    expect(lens.read().visibleEntityIds.includes("captains-note")).toBe(action === "SHOW");
    expect(lens.read().mode).toBe("NATIVE");
  },
);

it("serializes overlapping timeline and Inspect draws instead of starting concurrent native transfers", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const staging = deferred(),
    provider = adapter((index) => (index === 1 ? staging.promise : undefined));
  const lens = runtime(moment([behavior("HIDE", 100), behavior("SHOW", 200)], true, true));
  await lens.open(provider.native);
  await vi.advanceTimersByTimeAsync(150);
  expect(provider.frames).toHaveLength(2);
  const interaction = lens.interact("inspection-control", "INSPECT", "inspect-queued");
  await vi.advanceTimersByTimeAsync(100);
  expect(provider.frames).toHaveLength(2);
  expect(provider.maximum()).toBe(1);
  staging.resolve();
  const receipt = await interaction;
  await vi.advanceTimersByTimeAsync(0);
  expect(provider.maximum()).toBe(1);
  expect(provider.frames.at(-1)!.entities.find((entity) => entity.id === "captains-note")!.visible).toBe(true);
  expect(lens.read()).toMatchObject({ mode: "NATIVE", state: "READY", inspectedEntityId: "inspection-control" });
  expect(receipt).toMatchObject({ schemaVersion: 1, authority: "NONAUTHORITATIVE", interactionType: "INSPECT" });
});

it("closes and reopens while initial staging is blocked without waiting or allowing late completion to revive the old epoch", async () => {
  let clock = 0;
  const staging = deferred(),
    old = adapter((index) => (index === 0 ? staging.promise : undefined)),
    fresh = adapter();
  const lens = runtime(moment([behavior("SHOW", 100)], false), () => new Date(clock));
  const opening = lens.open(old.native);
  await vi.waitFor(() => expect(old.frames).toHaveLength(1));
  await lens.close();
  expect(lens.read().state).toBe("CLOSED");
  clock = 5000;
  await lens.open(fresh.native);
  expect(lens.read()).toMatchObject({ state: "READY", mode: "NATIVE", visibleEntityIds: [] });
  staging.resolve();
  await opening;
  expect(old.frames).toHaveLength(1);
  expect(fresh.frames).toHaveLength(1);
  expect(lens.read()).toMatchObject({ state: "READY", mode: "NATIVE", visibleEntityIds: [] });
});

it("does not let an old queued timer failure switch a reopened Lens to Guided View or restore old selection", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const staging = deferred(),
    old = adapter((index) => (index === 1 ? staging.promise : undefined)),
    fresh = adapter();
  const lens = runtime(moment([behavior("HIDE", 100), behavior("SHOW", 200)], true, true));
  await lens.open(old.native);
  await vi.advanceTimersByTimeAsync(150);
  const interaction = lens.interact("inspection-control", "INSPECT", "old-inspect").catch((error: Error) => error);
  await vi.advanceTimersByTimeAsync(100);
  expect(old.frames).toHaveLength(2);
  await lens.close();
  await lens.open(fresh.native);
  staging.reject(new Error("OLD_NATIVE_TRANSFER_FAILED"));
  expect(await interaction).toBeInstanceOf(Error);
  await vi.advanceTimersByTimeAsync(0);
  expect(old.frames).toHaveLength(2);
  expect(fresh.frames).toHaveLength(1);
  expect(lens.read()).toMatchObject({
    mode: "NATIVE",
    state: "READY",
    selectedEntityId: null,
    inspectedEntityId: null,
  });
});

it("does not mutate a closed Lens when an Inspect render finishes after teardown", async () => {
  const staging = deferred(),
    provider = adapter((index) => (index === 1 ? staging.promise : undefined));
  const lens = runtime(moment([], true));
  await lens.open(provider.native);
  const interaction = lens.interact("captains-note", "INSPECT", "closing-inspect").catch((error: Error) => error);
  await vi.waitFor(() => expect(provider.frames).toHaveLength(2));
  await lens.close();
  staging.resolve();
  expect(((await interaction) as Error).message).toBe("PARALLAX_INTERACTION_CANCELLED");
  expect(lens.read()).toMatchObject({ state: "CLOSED", selectedEntityId: null, inspectedEntityId: null, anchors: {} });
});

it("does not apply stale PLACE rollback or Guided fallback to a reopened epoch", async () => {
  const value = moment([], true);
  const anchor = value.version.anchors[0];
  value.version.anchors[0] = { ...anchor, kind: "SURFACE_RELATIVE", alignment: "HORIZONTAL" };
  value.version.entities[0].coordinateSpace = "SURFACE_RELATIVE";
  const { checksum, ...content } = value.version;
  void checksum;
  value.version = materializeSpatialVersion(content);
  value.attachment.versionChecksum = value.version.checksum;
  const staging = deferred(),
    old = adapter((index) => (index === 1 ? staging.promise : undefined)),
    fresh = adapter();
  old.native.place = vi.fn(async () => anchor.transform);
  const lens = runtime(value);
  await lens.open(old.native);
  const placing = lens.interact("captains-note", "PLACE", "old-place").catch((error: Error) => error);
  await vi.waitFor(() => expect(old.frames).toHaveLength(2));
  await lens.close();
  await lens.open(fresh.native);
  staging.reject(new Error("OLD_PLACE_RENDER_FAILED"));
  expect(((await placing) as Error).message).toBe("OLD_PLACE_RENDER_FAILED");
  expect(lens.read()).toMatchObject({ state: "READY", mode: "NATIVE", selectedEntityId: null });
  expect(lens.read().anchors[anchor.id].version).toBe(1);
  expect(fresh.native.stop).not.toHaveBeenCalled();
});
