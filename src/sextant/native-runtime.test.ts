// @sounding-line-registration owner=project-sextant suite=unit.sextant contracts=sextant.phase4.native-context
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSextantRuntime } from "./web-runtime";
import { nativeSensorFamilies, type SextantNativeOperation, type SextantNativeTransport } from "./native-provider";
import { emulatedWebSensors } from "./web-fixture";
import { unknownState } from "./contracts";
import type { LeaseEvent, LeaseRequest } from "./leases";
import { SextantPermissionBroker } from "./permissions";

afterEach(() => vi.useRealTimers());
/** D0 transport double, not native execution or a platform/hardware receipt. */
describe("production runtime selection over companion transport", () => {
  function positionRuntime() {
    const active = new Map<string, string>(),
      listeners = new Set<(event: unknown) => void>();
    const capabilityId = "sextant.position.observation";
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
                  { ...unknownState(), support: "SUPPORTED", availability: "AVAILABLE", permission: "GRANTED" },
                ]),
            ),
          };
        if (operation === "SEXTANT_PERMISSION") return { state: "GRANTED" };
        if (operation === "SEXTANT_START") {
          const generation = crypto.randomUUID();
          active.set(payload!.leaseId as string, generation);
          return { accepted: true, generation, nativeMonotonicMs: 10000 };
        }
        if (operation === "SEXTANT_STOP") active.delete(payload!.leaseId as string);
        return { accepted: true };
      },
    );
    const runtime = new WebSextantRuntime(emulatedWebSensors().target, null, () => 10000, {
      nativeTransport: {
        platform: "IOS",
        request,
        subscribe(fn) {
          listeners.add(fn);
          return () => {
            listeners.delete(fn);
          };
        },
      },
    });
    const events: LeaseEvent[] = [];
    const acquire = (requested = capabilityId, retry = false) =>
      runtime.acquire(
        {
          consumerId: "landfall",
          surfaceId: "phone",
          purpose: "Optional input with screen fallback",
          consent: true,
          userInitiated: true,
          capabilityId: requested,
          retry,
          updateClass: "INTERACTIVE",
          minimumQuality: "MEDIUM",
          maxAgeMs: 1000,
          expiresAt: 130000,
          frames:
            requested === capabilityId
              ? ["WGS84"]
              : requested.includes("orientation")
                ? ["LOCAL_ARBITRARY"]
                : ["DEVICE"],
          retentionClass: "EPHEMERAL",
          foregroundRequirement: true,
        },
        (event) => events.push(event),
      );
    return { runtime, active, listeners, request, events, acquire };
  }
  it("acquires relative attitude alongside motion without requesting a conflicting north reference", async () => {
    const f = positionRuntime(),
      original = f.request.getMockImplementation()!;
    f.request.mockImplementation(async (operation, payload) => {
      if (
        operation === "SEXTANT_START" &&
        f.active.size &&
        (payload?.capabilities as string[]).includes("sextant.orientation.absolute")
      )
        return { accepted: false };
      return original(operation, payload);
    });
    try {
      await f.acquire("sextant.motion.stability");
      await f.acquire("sextant.orientation.relative");
      expect(f.active.size).toBe(2);
      expect(f.runtime.leases.diagnostics().activeLeases).toBe(2);
    } finally {
      await f.runtime.dispose();
    }
  });
  it("revokes native position and accepts restored permission only on a fresh explicit retry", async () => {
    const f = positionRuntime();
    try {
      await f.acquire();
      await f.runtime.revoke();
      expect(f.active.size).toBe(0);
      await expect(f.acquire()).rejects.toThrow();
      await f.acquire("sextant.position.observation", true);
      expect(f.active.size).toBe(1);
      expect(f.events.filter((event) => event.type === "OBSERVATION")).toEqual([]);
    } finally {
      await f.runtime.dispose();
    }
  });
  it("pauses position acquisition and requires explicit resume before another lease", async () => {
    const f = positionRuntime();
    try {
      await f.acquire();
      expect(f.active.size).toBe(1);
      await f.runtime.pause();
      expect(f.active.size).toBe(0);
      expect(f.events).toContainEqual({ type: "ENDED", reason: "PERMISSION_REVOKED_OR_PAUSED" });
      await expect(f.acquire()).rejects.toThrow();
      expect(() => f.runtime.resume(false)).toThrow("SEXTANT_USER_ACTION_REQUIRED");
      f.runtime.resume(true);
      await f.acquire();
      expect(f.active.size).toBe(1);
    } finally {
      await f.runtime.dispose();
    }
  });
  it.each(["accepted", "rejected"])(
    "waits for the original native cleanup acknowledgement (%s) before successor acquisition",
    async (outcome) => {
      const f = positionRuntime(),
        original = f.request.getMockImplementation()!;
      let finish!: (value: unknown) => void, reject!: (reason: Error) => void;
      let firstStop = true;
      f.request.mockImplementation((operation, payload) => {
        if (operation === "SEXTANT_STOP" && firstStop) {
          firstStop = false;
          return new Promise((yes, no) => {
            finish = yes;
            reject = no;
          });
        }
        return original(operation, payload);
      });
      try {
        await f.acquire();
        const [leaseId, generation] = [...f.active][0];
        for (const listener of [...f.listeners])
          listener({ type: "sextant-ended", leaseId, generation, reason: "EXPIRED" });
        let settled = false;
        const next = f.acquire().then(
          () => {
            settled = true;
            return "STARTED";
          },
          () => {
            settled = true;
            return "REFUSED";
          },
        );
        await vi.waitFor(() => expect(finish).toBeDefined());
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(settled).toBe(false);
        expect(f.request.mock.calls.filter(([op]) => op === "SEXTANT_START")).toHaveLength(1);
        if (outcome === "accepted") {
          f.active.delete(leaseId);
          finish({ accepted: true });
        } else reject(new Error("Scoped cleanup failed"));
        expect(await next).toBe(outcome === "accepted" ? "STARTED" : "REFUSED");
        expect(f.runtime.leases.diagnostics().failedProviders).toBe(outcome === "accepted" ? 0 : 1);
      } finally {
        finish?.({ accepted: true });
        await f.runtime.dispose();
      }
    },
  );
  it("refreshes native capability availability after a nearby state transition without acquiring sensors", async () => {
    const f = positionRuntime(),
      original = f.request.getMockImplementation()!;
    let ready = false;
    f.request.mockImplementation(async (operation, payload) => {
      const reply = await original(operation, payload);
      if (operation === "SEXTANT_STATE")
        return {
          ...(reply as object),
          states: {
            ...(reply as { states: Record<string, unknown> }).states,
            "sextant.nearby.uwb.range": {
              ...unknownState(),
              support: "SUPPORTED",
              permission: "GRANTED",
              availability: ready ? "AVAILABLE" : "TEMPORARILY_UNAVAILABLE",
            },
          },
        };
      return reply;
    });
    try {
      await f.runtime.ready;
      // Refresh through an explicit contextual action so the initial transport
      // snapshot includes the radio declaration installed by this fixture.
      await f.runtime.enable(
        {
          consumerId: "devices",
          surfaceId: "phone",
          purpose: "Inspect available device input",
          consent: true,
          userInitiated: true,
        },
        "sextant.position.observation",
      );
      expect(f.runtime.projectCapability("sextant.nearby.uwb.range").availability).toBe("TEMPORARILY_UNAVAILABLE");
      ready = true;
      for (const listener of [...f.listeners]) listener({ type: "nearby-state", family: "UWB", state: "READY" });
      await vi.waitFor(() =>
        expect(f.runtime.projectCapability("sextant.nearby.uwb.range").availability).toBe("AVAILABLE"),
      );
      expect(f.request.mock.calls.some(([op]) => op === "SEXTANT_START")).toBe(false);
    } finally {
      await f.runtime.dispose();
    }
  });
  it.each(["EXPIRED", "PERMISSION", "BACKGROUND", "POWER"])(
    "allows a fresh explicit acquisition after native %s without restoring the ended lease",
    async (reason) => {
      const f = positionRuntime();
      try {
        await f.acquire();
        const [leaseId, generation] = [...f.active][0];
        for (const listener of [...f.listeners]) listener({ type: "sextant-ended", leaseId, generation, reason });
        await f.runtime.leases.idle();
        expect(f.active.size).toBe(0);
        expect(f.events).toContainEqual({ type: "ENDED", reason: `PROVIDER_${reason}` });
        await f.acquire();
        expect(f.active.size).toBe(1);
        expect(f.active.has(leaseId)).toBe(false);
        expect(f.events.filter((event) => event.type === "OBSERVATION")).toEqual([]);
      } finally {
        await f.runtime.dispose();
      }
    },
  );
  it("releases a late native start acknowledgement after the consumer scope is cancelled", async () => {
    let acknowledge: ((value: unknown) => void) | undefined;
    const request = vi.fn(async (operation: SextantNativeOperation): Promise<unknown> => {
      if (operation === "SEXTANT_STATE")
        return {
          version: 1,
          background: "FOREGROUND_ONLY",
          states: {
            "sextant.magnetic.field": {
              ...unknownState(),
              support: "SUPPORTED",
              availability: "AVAILABLE",
              permission: "NOT_REQUIRED",
            },
          },
        };
      if (operation === "SEXTANT_PERMISSION") return { state: "NOT_REQUIRED" };
      if (operation === "SEXTANT_START")
        return new Promise((resolve) => {
          acknowledge = resolve;
        });
      return { accepted: true };
    });
    const scope = new AbortController(),
      runtime = new WebSextantRuntime(emulatedWebSensors().target, null, () => 10000, {
        nativeTransport: { platform: "ANDROID", request, subscribe: () => () => {} },
      });
    await runtime.ready;
    const acquisition = runtime.acquire(
      {
        consumerId: "preview",
        surfaceId: "phone",
        purpose: "Optional preview",
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
      },
      vi.fn(),
      { signal: scope.signal },
    );
    const result = expect(acquisition).rejects.toThrow("SEXTANT_ACQUISITION_CANCELLED");
    await vi.waitFor(() => expect(acknowledge).toBeDefined());
    scope.abort();
    acknowledge!({ accepted: true, generation: crypto.randomUUID(), nativeMonotonicMs: 10000 });
    await result;
    expect(request.mock.calls.some(([operation]) => operation === "SEXTANT_STOP")).toBe(true);
    await runtime.dispose();
  });
  it("rechecks a different native permission within a shared motion permission group", async () => {
    const platform = vi.fn(async (_key: string, purpose: { capabilityId?: string }) =>
      purpose.capabilityId === "sextant.motion.pedometer" ? ("DENIED" as const) : ("NOT_REQUIRED" as const),
    );
    const broker = new SextantPermissionBroker(platform, true),
      purpose = {
        consumerId: "lens",
        surfaceId: "phone",
        purpose: "Optional motion with alternative",
        consent: true,
        userInitiated: true,
      };
    expect(
      await broker.authorize("MOTION_PERMISSION_PLATFORM_DEPENDENT", {
        ...purpose,
        capabilityId: "sextant.motion.gravity",
      }),
    ).toBe("NOT_REQUIRED");
    expect(
      await broker.authorize("MOTION_PERMISSION_PLATFORM_DEPENDENT", {
        ...purpose,
        capabilityId: "sextant.motion.pedometer",
      }),
    ).toBe("DENIED");
    expect(platform).toHaveBeenCalledTimes(2);
  });
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
    // The runtime retains only its passive capability-state subscription.
    expect(listeners.size).toBe(1);
    await runtime.dispose();
    expect(active.size).toBe(0);
    expect(listeners.size).toBe(0);
  });
  it("does not prompt or start when the consumer declines purpose consent", async () => {
    const request = vi.fn<(operation: SextantNativeOperation) => Promise<unknown>>(async () => ({
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
