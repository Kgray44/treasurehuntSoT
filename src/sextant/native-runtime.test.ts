import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSextantRuntime } from "./web-runtime";
import { nativeSensorFamilies, type SextantNativeOperation, type SextantNativeTransport } from "./native-provider";
import { emulatedWebSensors } from "./web-fixture";
import { unknownState } from "./contracts";
import type { LeaseEvent, LeaseRequest } from "./leases";

afterEach(() => vi.useRealTimers());
/** D0 transport double, not native execution or a platform/hardware receipt. */
describe("production runtime selection over companion transport", () => {
  it("shares native magnetic acquisition across consumers, ignores browser streams, and releases the final owner", async () => {
    vi.useFakeTimers();
    let clock = 10000;
    const listeners = new Set<(event: unknown) => void>(),
      active = new Map<string, string>();
    const request = vi.fn(
      async (operation: SextantNativeOperation, payload?: Record<string, unknown>): Promise<unknown> => {
        if (operation === "SEXTANT_STATE")
          return {
            version: 1,
            background: "FOREGROUND_ONLY",
            states: Object.fromEntries(
              Object.values(nativeSensorFamilies)
                .flat()
                .map((id) => [
                  id,
                  { ...unknownState(), support: "SUPPORTED", availability: "AVAILABLE", permission: "NOT_REQUIRED" },
                ]),
            ),
          };
        if (operation === "SEXTANT_PERMISSION") return { state: "NOT_REQUIRED" };
        if (operation === "SEXTANT_START") {
          const generation = crypto.randomUUID();
          active.set(payload!.leaseId as string, generation);
          return { accepted: true, generation, nativeMonotonicMs: clock };
        }
        if (operation === "SEXTANT_STOP") active.delete(payload!.leaseId as string);
        return { accepted: true };
      },
    );
    const transport: SextantNativeTransport = {
      platform: "ANDROID",
      request,
      subscribe(fn) {
        listeners.add(fn);
        return () => {
          listeners.delete(fn);
        };
      },
    };
    const target = emulatedWebSensors(),
      runtime = new WebSextantRuntime(target.target, null, () => clock, { nativeTransport: transport });
    await runtime.ready;
    expect(request.mock.calls.every(([operation]) => operation === "SEXTANT_STATE")).toBe(true);
    const purpose = (consumerId: string): LeaseRequest => ({
      consumerId,
      surfaceId: "phone",
      purpose: "Inspect magnetic reference with manual alternative",
      consent: true,
      userInitiated: true,
      capabilityId: "sextant.magnetic.field",
      updateClass: "INTERACTIVE",
      minimumQuality: "MEDIUM",
      maxAgeMs: 500,
      expiresAt: 20000,
      frames: ["DEVICE"],
      retentionClass: "EPHEMERAL",
      foregroundRequirement: true,
    });
    const a: LeaseEvent[] = [],
      b: LeaseEvent[] = [];
    const first = await runtime.acquire(purpose("parallax"), (e) => a.push(e)),
      second = await runtime.acquire(purpose("crossdeck"), (e) => b.push(e));
    expect(request.mock.calls.filter(([op]) => op === "SEXTANT_START")).toHaveLength(1);
    expect(active.size).toBe(1);
    target.motion();
    target.orientation();
    expect(target.count("devicemotion")).toBe(0);
    expect(target.count("deviceorientation")).toBe(0);
    expect(a).toHaveLength(0);
    expect(b).toHaveLength(0);
    const [leaseId, generation] = [...active][0];
    const event = () => ({
      type: "sextant-sample",
      version: 1,
      leaseId,
      generation,
      sequence: clock,
      emittedAtWallMs: 0,
      captureMonotonicMs: clock,
      captureAgeMs: 0,
      fidelity: "OS",
      sample: {
        capabilityId: "sextant.magnetic.field",
        value: { x: 20, y: 0, z: -45 },
        units: "microtesla",
        referenceFrame: "DEVICE",
        qualityClass: "MEDIUM",
        calibrationState: "GOOD",
        confidence: null,
        warnings: [],
      },
    });
    for (const listener of listeners) listener(event());
    expect(a.filter((e) => e.type === "OBSERVATION")).toHaveLength(1);
    expect(b.filter((e) => e.type === "OBSERVATION")).toHaveLength(1);
    await first.release();
    expect(active.size).toBe(1);
    clock += 200;
    for (const listener of listeners) listener(event());
    expect(a.filter((e) => e.type === "OBSERVATION")).toHaveLength(1);
    expect(b.filter((e) => e.type === "OBSERVATION")).toHaveLength(2);
    await second.release();
    expect(active.size).toBe(0);
    expect(listeners.size).toBe(0);
    await runtime.dispose();
    expect(active.size).toBe(0);
  });
  it("does not prompt or start when the consumer declines purpose consent", async () => {
    const request = vi.fn(async (_operation: SextantNativeOperation) => ({
      version: 1,
      background: "FOREGROUND_ONLY",
      states: {},
    }));
    const runtime = new WebSextantRuntime(emulatedWebSensors().target, null, () => 10000, {
      nativeTransport: { platform: "IOS", request, subscribe: () => () => {} },
    });
    await runtime.ready;
    expect(
      await runtime.enable(
        { consumerId: "lens", surfaceId: "phone", purpose: "Optional tilt", consent: false, userInitiated: true },
        "sextant.orientation.relative",
      ),
    ).toBe("DENIED");
    expect(request.mock.calls.every(([op]) => op === "SEXTANT_STATE")).toBe(true);
    await runtime.dispose();
  });
});
