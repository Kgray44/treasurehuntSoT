import { afterEach, describe, expect, it, vi } from "vitest";
import { NativeSpatialAdapter } from "./native";
import { identityTransform } from "./contracts";
import { ParallaxLensRuntime } from "./runtime";
import { guidedContext, syntheticBinding, syntheticSpatialMoment } from "./fixtures";
function host(permission = "GRANTED", accepted = true) {
  const request = vi.fn(async (message: string) => {
    const { operation, payload } = JSON.parse(message);
    if (operation === "SPATIAL_START")
      return { accepted, sceneTransferVersion: 1, sessionId: payload.sessionId, epoch: payload.epoch };
    if (operation === "SPATIAL_STATE" || operation === "SPATIAL_PERMISSION")
      return { supported: true, permission, sceneTransferVersion: 1 };
    if (operation === "SPATIAL_PLACE") return { pose: identityTransform() };
    return { accepted };
  });
  window.LandfallNative = { version: 1, platform: "IOS", request };
  return request;
}
afterEach(() => {
  delete window.LandfallNative;
});
describe("Parallax native bridge boundary (mock transport, no hardware qualification)", () => {
  it("discovers capability without asking for camera permission", async () => {
    const request = host("PROMPT"),
      adapter = new NativeSpatialAdapter();
    expect(await adapter.discover()).toEqual({ supported: true, permission: "PROMPT", sceneTransferVersion: 1 });
    expect(request.mock.calls.map(([m]) => JSON.parse(m).operation)).toEqual(["SPATIAL_STATE"]);
  });
  it("uses explicit Sextant consent and preserves Guided View after denial", async () => {
    const request = host("DENIED"),
      adapter = new NativeSpatialAdapter();
    const runtime = new ParallaxLensRuntime(syntheticSpatialMoment(), syntheticBinding, guidedContext());
    await runtime.updateDeviceContext(await adapter.authorize());
    await runtime.open(adapter);
    expect(runtime.read().mode).toBe("GUIDED");
    expect(request.mock.calls.map(([m]) => JSON.parse(m).operation)).toEqual(["SPATIAL_PERMISSION"]);
    await runtime.close();
  });
  it("converts plane normal to the entity quad frame", async () => {
    host();
    const adapter = new NativeSpatialAdapter();
    await adapter.start({
      signal: new AbortController().signal,
      emit: () => {},
      sceneIdentity: { versionChecksum: "a".repeat(64), instanceId: "test" },
    });
    const pose = await adapter.place("HORIZONTAL");
    await adapter.stop();
    expect(pose?.rotation.x).toBeCloseTo(-Math.SQRT1_2);
    expect(pose?.rotation.w).toBeCloseTo(Math.SQRT1_2);
  });
  it("requires stable tracking and releases native camera/event listeners on background", async () => {
    const request = host(),
      adapter = new NativeSpatialAdapter();
    const runtime = new ParallaxLensRuntime(syntheticSpatialMoment(), syntheticBinding, guidedContext());
    await runtime.updateDeviceContext(await adapter.authorize());
    await runtime.open(adapter);
    expect(runtime.read().state).toBe("LEARNING_SPACE");
    const identity = JSON.parse(
      request.mock.calls.find(([m]) => JSON.parse(m).operation === "SPATIAL_START")![0],
    ).payload;
    const event = (detail: object) =>
      window.dispatchEvent(
        new CustomEvent("landfall-native-event", {
          detail: { sessionId: identity.sessionId, epoch: identity.epoch, ...detail },
        }),
      );
    for (let i = 0; i < 3; i++) event({ type: "parallax-tracking", state: "NORMAL" });
    expect(runtime.read().state).toBe("READY");
    event({ type: "lifecycle", state: "BACKGROUND" });
    await vi.waitFor(() => expect(runtime.read().mode).toBe("GUIDED"));
    expect(request.mock.calls.some(([m]) => JSON.parse(m).operation === "SPATIAL_STOP")).toBe(true);
    event({ type: "parallax-tracking", state: "LOST" });
    expect(runtime.read().state).toBe("GUIDED_FALLBACK");
    await runtime.close();
  });
});
