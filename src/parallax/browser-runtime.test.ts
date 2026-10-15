import { afterEach, expect, it, vi } from "vitest";
import { ParallaxLensRuntime, type SpatialRuntimeAdapter, type SpatialRuntimeEvent } from "./runtime";
import { syntheticBinding, syntheticSpatialMoment, guidedContext } from "./fixtures";
import { identityTransform, receiptSchema, type SpatialMoment } from "./contracts";
import { materializeSpatialVersion } from "./publication";
import type { SpatialElement } from "./element-contracts";

afterEach(() => vi.useRealTimers());

function setup(failure = false, moment: SpatialMoment = syntheticSpatialMoment(), motion: "full" | "reduced" = "full") {
  let emit: (event: SpatialRuntimeEvent) => void = () => {};
  let stopped = 0;
  const adapter: SpatialRuntimeAdapter = {
    mode: "BROWSER",
    providerId: "parallax.browser.test-boundary",
    worldTracking: true,
    planePlacement: false,
    async start(input) {
      emit = input.emit;
      if (failure) throw new Error("Tracking module unavailable");
    },
    async resolve() {
      return identityTransform();
    },
    async place() {
      return null;
    },
    render: vi.fn(async () => {}),
    async stop() {
      stopped++;
    },
  };
  const context = {
    ...guidedContext(),
    motionPreference: () => motion,
    camera: {
      ...guidedContext().camera,
      support: "SUPPORTED" as const,
      permission: "GRANTED" as const,
      availability: "AVAILABLE" as const,
    },
  };
  const runtime = new ParallaxLensRuntime(moment, syntheticBinding, context);
  return { runtime, adapter, push: (event: SpatialRuntimeEvent) => emit(event), stopped: () => stopped };
}

it("keeps a failed browser AR attempt explicit until the player chooses Guided", async () => {
  const { runtime, adapter, stopped } = setup(true);
  await runtime.open(adapter);
  expect(runtime.read()).toMatchObject({ mode: "BROWSER", state: "DEGRADED", guidance: "Tracking module unavailable" });
  expect(stopped()).toBe(1);
  await expect(runtime.interact("captains-note", "INSPECT", "attempt-1")).rejects.toThrow(/NOT_READY/);
  await runtime.useGuidedView();
  expect(runtime.read().mode).toBe("GUIDED");
  await runtime.close();
});

function authoredMoment(element: SpatialElement) {
  const moment = syntheticSpatialMoment();
  const { checksum, ...content } = moment.version;
  expect(materializeSpatialVersion(content).checksum).toBe(checksum);
  content.entities[0].element = element;
  moment.version = materializeSpatialVersion(content);
  moment.attachment.versionChecksum = moment.version.checksum;
  return moment;
}

it("requires explicit renderer support for every authored element and keeps unsupported browser attempts explicit", async () => {
  const moment = authoredMoment({ kind: "INTERACTION_VOLUME", enabled: true, shape: "BOX", radius: 1 });
  const { runtime, adapter, stopped } = setup(false, moment);
  adapter.supportsElement = (element) => element.kind === "PHYSICAL_ASSET";
  await runtime.open(adapter);
  expect(runtime.read()).toMatchObject({ mode: "BROWSER", state: "DEGRADED" });
  expect(runtime.read().guidance).toContain("does not yet render");
  expect(adapter.render).not.toHaveBeenCalled();
  expect(stopped()).toBe(1);
  await runtime.close();
});

it("samples authored playback on the canonical clock and admits the real interaction only while the element is visible", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
  const moment = authoredMoment({
    kind: "PHYSICAL_ASSET",
    enabled: true,
    modelId: "lantern",
    packageVersion: "1.0.0",
    articulation: 1,
    playback: { startMs: 1000, durationMs: 2000, fadeInMs: 1000, fadeOutMs: 0, loop: false },
  });
  const original = structuredClone(moment);
  const { runtime, adapter, push } = setup(false, moment, "reduced");
  adapter.supportsElement = (element) => element.kind === "PHYSICAL_ASSET";
  adapter.resolve = async (_anchor, entityId) =>
    entityId ? { ...identityTransform(), position: { x: 5, y: 0, z: 0 } } : identityTransform();
  await runtime.open(adapter);
  for (let i = 0; i < 3; i++) push({ type: "TRACKING", state: "NORMAL" });
  expect(runtime.read().mode).toBe("BROWSER");
  expect(runtime.read().visibleEntityIds).toEqual([]);
  await expect(runtime.interact("captains-note", "INSPECT", "too-early")).rejects.toThrow("FORBIDDEN");
  await vi.advanceTimersByTimeAsync(1500);
  expect(runtime.read().visibleEntityIds).toContain("captains-note");
  const render = vi.mocked(adapter.render);
  const [entities, frame] = render.mock.calls.at(-1)!;
  expect(frame).toMatchObject({ reducedMotion: true });
  expect(frame!.elapsedMs).toBeGreaterThan(1400);
  expect(entities[0].envelope).toBeGreaterThan(0.4);
  expect(entities[0].envelope).toBeLessThanOrEqual(0.5);
  expect(entities[0].transform.position.x).toBe(5);
  const receipt = await runtime.interact("captains-note", "INSPECT", "visible-rich-object");
  expect(receiptSchema.parse(receipt)).toMatchObject({
    mode: "BROWSER",
    synthetic: false,
    authority: "NONAUTHORITATIVE",
  });
  await vi.advanceTimersByTimeAsync(1600);
  expect(runtime.read().visibleEntityIds).toEqual([]);
  await expect(runtime.interact("captains-note", "INSPECT", "expired-rich-object")).rejects.toThrow("FORBIDDEN");
  expect(moment).toEqual(original);
  await runtime.close();
});

it("records actual browser mode separately from native and simulated and suspends interactions on tracking loss", async () => {
  const { runtime, adapter, push } = setup();
  await runtime.open(adapter);
  for (let i = 0; i < 3; i++) push({ type: "TRACKING", state: "NORMAL" });
  expect(runtime.read().state).toBe("READY");
  const receipt = await runtime.interact("captains-note", "INSPECT", "browser-inspect");
  expect(receiptSchema.parse(receipt)).toMatchObject({
    mode: "BROWSER",
    synthetic: false,
    authority: "NONAUTHORITATIVE",
  });
  push({ type: "TRACKING", state: "INTERRUPTED" });
  expect(runtime.read()).toMatchObject({ mode: "BROWSER", state: "DEGRADED" });
  await expect(runtime.interact("captains-note", "PICK", "interrupted-pick")).rejects.toThrow(/NOT_READY/);
  await runtime.close();
});

it("does not silently select Guided when browser camera authorization is missing", async () => {
  const { adapter } = setup();
  const runtime = new ParallaxLensRuntime(syntheticSpatialMoment(), syntheticBinding, guidedContext());
  await runtime.open(adapter);
  expect(runtime.read()).toMatchObject({ mode: "BROWSER", state: "DEGRADED" });
  await runtime.close();
});
