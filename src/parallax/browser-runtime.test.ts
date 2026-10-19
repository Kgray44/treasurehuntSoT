import { expect, it } from "vitest";
import { ParallaxLensRuntime, type SpatialRuntimeAdapter, type SpatialRuntimeEvent } from "./runtime";
import { syntheticBinding, syntheticSpatialMoment, guidedContext } from "./fixtures";
import { identityTransform, receiptSchema } from "./contracts";

function setup(failure = false) {
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
    async render() {},
    async stop() {
      stopped++;
    },
  };
  const context = {
    ...guidedContext(),
    camera: {
      ...guidedContext().camera,
      support: "SUPPORTED" as const,
      permission: "GRANTED" as const,
      availability: "AVAILABLE" as const,
    },
  };
  const runtime = new ParallaxLensRuntime(syntheticSpatialMoment(), syntheticBinding, context);
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
