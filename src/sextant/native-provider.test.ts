// @sounding-line-registration owner=project-sextant suite=unit.sextant contracts=sextant.phase4.native-context
import { describe, expect, it, vi } from "vitest";
import {
  NativeSensorProvider,
  type SextantNativeTransport,
  type SextantNativeOperation,
  type NativeSensorFamily,
} from "./native-provider";
import { unknownState, type ProviderSample } from "./contracts";
import { SextantCapabilityRegistry } from "./capabilities";
import { normalizeObservation } from "./observations";
import { SextantProviderRegistry } from "./providers";
import { coordinatedSensorBaseline, coordinatedSensorSeries } from "@/device-lab/coordinated-sensors";

function fixture(simulated = false, family: NativeSensorFamily = "magnetic") {
  const capabilityId = family === "position" ? "sextant.position.observation" : "sextant.magnetic.field";
  let listener: (input: unknown) => void = () => {},
    leaseId = "",
    localNow = 10000;
  const generation = crypto.randomUUID();
  const request = vi.fn(
    async (operation: SextantNativeOperation, payload?: Record<string, unknown>): Promise<unknown> => {
      if (operation === "SEXTANT_STATE")
        return {
          version: 1,
          background: "FOREGROUND_ONLY",
          states: {
            [capabilityId]: {
              ...unknownState(),
              support: "SUPPORTED",
              availability: "AVAILABLE",
              permission: "NOT_REQUIRED",
            },
          },
        };
      if (operation === "SEXTANT_START") {
        leaseId = payload!.leaseId as string;
        return { accepted: true, generation, nativeMonotonicMs: 1000 };
      }
      return { accepted: true };
    },
  );
  const transport: SextantNativeTransport = {
    platform: "ANDROID",
    request,
    subscribe: (fn) => {
      listener = fn;
      return () => {
        listener = () => {};
      };
    },
  };
  const provider = new NativeSensorProvider(
    transport,
    family,
    () => localNow,
    () => 100000,
    simulated ? "native-d0-test" : undefined,
  );
  const emit = vi.fn<(sample: ProviderSample) => void>(),
    fail = vi.fn(),
    controller = new AbortController();
  const event = (overrides: Record<string, unknown> = {}) => ({
    type: "sextant-sample",
    version: 1,
    leaseId,
    generation,
    sequence: 1,
    emittedAtWallMs: 100000,
    captureMonotonicMs: 990,
    captureAgeMs: 10,
    fidelity: simulated ? "INJECTED" : "OS",
    sample: {
      capabilityId,
      value: family === "position" ? { latitude: 1, longitude: 2, accuracyMeters: 5 } : { x: 20, y: 0, z: -45 },
      units: family === "position" ? "degrees/meters" : "microtesla",
      referenceFrame: family === "position" ? "WGS84" : "DEVICE",
      calibrationState: "GOOD",
      qualityClass: "MEDIUM",
      confidence: null,
      warnings: [],
    },
    ...overrides,
  });
  return {
    provider,
    request,
    controller,
    emit,
    fail,
    event,
    advance: (at: number) => {
      localNow = at;
    },
    send: (value: unknown) => listener(value),
    start: () => provider.start({ signal: controller.signal, updateClass: "INTERACTIVE", emit, fail }),
  };
}
describe("native semantic provider boundary (D0 transport doubles)", () => {
  it("normalizes native position with an explicit WGS84 frame and bounded acquisition cadence", async () => {
    const f = fixture(false, "position");
    await f.start();
    expect(f.request).toHaveBeenCalledWith(
      "SEXTANT_START",
      expect.objectContaining({ capabilities: ["sextant.position.observation"], intervalMs: 1000 }),
    );
    f.send(f.event());
    expect(f.emit.mock.calls[0][0]).toMatchObject({
      referenceFrame: "WGS84",
      units: "degrees/meters",
      value: { latitude: 1, longitude: 2, accuracyMeters: 5 },
    });
    f.send(
      f.event({
        sequence: 2,
        captureMonotonicMs: 991,
        captureAgeMs: 9,
        sample: { ...f.event().sample, value: { latitude: 100, longitude: 2, accuracyMeters: 5 } },
      }),
    );
    expect(f.emit).toHaveBeenCalledTimes(1);
    expect(f.fail).toHaveBeenCalled();
    await f.provider.stop();
  });
  it("discovers without acquisition and scopes starts/stops to one short native lease", async () => {
    const f = fixture();
    await f.provider.refresh();
    expect(f.provider.discover("sextant.magnetic.field").support).toBe("SUPPORTED");
    expect(f.request).toHaveBeenCalledTimes(1);
    await f.start();
    f.send(f.event());
    expect(f.emit.mock.calls[0][0]).toMatchObject({ timestampMonotonic: 9990, discontinuity: true });
    f.provider.setUpdateClass("LOW_RATE");
    await Promise.resolve();
    expect(f.request).toHaveBeenCalledWith("SEXTANT_UPDATE", expect.objectContaining({ intervalMs: 1000 }));
    await f.provider.stop();
    f.send(f.event({ sequence: 2 }));
    expect(f.emit).toHaveBeenCalledTimes(1);
    expect(f.provider.discover("sextant.magnetic.field").freshness).toBe("STALE");
    expect(f.request).toHaveBeenCalledWith("SEXTANT_STOP", { leaseId: f.event().leaseId });
  });
  it.each([
    { captureAgeMs: 1001 },
    { captureMonotonicMs: 0, captureAgeMs: 2000 },
    { captureMonotonicMs: 2000 },
    { leaseId: crypto.randomUUID() },
    { sequence: -1 },
    { captureAgeMs: Infinity },
    { unexpected: true },
  ])("refuses stale, malformed, clock-jump and cross-owner frames %j", async (override) => {
    const f = fixture();
    await f.start();
    f.send(f.event(override));
    expect(f.emit).not.toHaveBeenCalled();
    await f.provider.stop();
  });
  it("rejects duplicate/out-of-order events and capture timestamps independently", async () => {
    const f = fixture();
    await f.start();
    f.send(f.event());
    f.send(f.event());
    f.send(f.event({ sequence: 0 }));
    f.send(f.event({ sequence: 2, captureMonotonicMs: 980 }));
    expect(f.emit).toHaveBeenCalledTimes(1);
    await f.provider.stop();
  });
  it("keeps integration on monotonic capture time across wall-clock jumps", async () => {
    const f = fixture();
    await f.start();
    f.send(f.event({ emittedAtWallMs: 1 }));
    f.advance(10200);
    f.send(f.event({ sequence: 2, captureMonotonicMs: 1200, emittedAtWallMs: 9999999999 }));
    expect(f.emit.mock.calls.map(([s]) => s.timestampMonotonic)).toEqual([9990, 10200]);
    await f.provider.stop();
  });
  it("ends on generation changes, injected production input and native interruptions", async () => {
    const f = fixture();
    await f.start();
    f.send(f.event({ generation: crypto.randomUUID() }));
    f.send(f.event({ fidelity: "INJECTED" }));
    f.send({
      type: "sextant-ended",
      leaseId: f.event().leaseId,
      generation: f.event().generation,
      reason: "PERMISSION",
    });
    expect(f.fail).toHaveBeenCalledTimes(3);
    expect(f.emit).not.toHaveBeenCalled();
    await f.provider.stop();
  });
  it("retains synthetic provenance and refuses Device Lab providers in production registries", async () => {
    const f = fixture(true),
      registry = new SextantCapabilityRegistry();
    expect(() => new SextantProviderRegistry(registry).register(f.provider)).toThrow("SEXTANT_SIMULATION_FORBIDDEN");
    new SextantProviderRegistry(registry, "DEVICE_LAB").register(f.provider);
    await f.start();
    f.send(f.event());
    expect(
      normalizeObservation(registry, f.provider, f.emit.mock.calls[0][0], {
        now: 10000,
        sequence: 0,
        discontinuity: true,
      }),
    ).toMatchObject({ syntheticFlag: true, sourceClass: "SIMULATED", simulationIdentity: "native-d0-test" });
    await f.provider.stop();
  });
  it("replays coherent rotating-field inputs through actual TypeScript semantic code", async () => {
    const f = fixture(true);
    await f.start();
    for (const frame of coordinatedSensorSeries({ ...coordinatedSensorBaseline, yawRateRadPerSecond: Math.PI / 2 })) {
      f.advance(10000 + frame.at);
      f.send(
        f.event({
          sequence: frame.sequence,
          captureMonotonicMs: 1000 + frame.at,
          captureAgeMs: 0,
          sample: { ...f.event().sample, value: frame.magneticDeviceMicrotesla },
        }),
      );
    }
    expect(f.emit).toHaveBeenCalledTimes(21);
    for (const [sample] of f.emit.mock.calls)
      expect(Math.hypot(...Object.values(sample.value as Record<string, number>))).toBeCloseTo(Math.sqrt(2425));
    await f.provider.stop();
  });
  it("stops a late accepted native start after the consumer aborts", async () => {
    const f = fixture();
    let finish: (r: unknown) => void = () => {};
    f.request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const start = f.start();
    f.controller.abort();
    finish({ accepted: true, generation: crypto.randomUUID(), nativeMonotonicMs: 1000 });
    await start;
    expect(f.request).toHaveBeenCalledWith("SEXTANT_STOP", expect.anything());
    f.send(f.event());
    expect(f.emit).not.toHaveBeenCalled();
  });
});
