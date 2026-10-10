// @sounding-line-registration owner=project-sextant suite=unit.sextant contracts=sextant.phase1.foundation
import { afterEach, describe, it, expect, vi } from "vitest";
import { SextantCapabilityRegistry } from "./capabilities";
import { SextantPermissionBroker } from "./permissions";
import { sextantD0Fixture } from "./foundation-scenarios";
import { SyntheticSextantProvider } from "./synthetic";
import { normalizeObservation, projectObservation } from "./observations";
import { observationSchema } from "./contracts";
import type { LeaseEvent } from "./leases";
afterEach(() => vi.useRealTimers());
describe("capability/provider/observation boundaries", () => {
  it("resolves all 30 versioned product definitions to Sextant-owned Wave 4 hardware and authoring semantics", () => {
    const r = new SextantCapabilityRegistry();
    expect(r.list()).toHaveLength(30);
    expect(r.list().every((d) => d.owner === "SEXTANT" && d.version === 1)).toBe(true);
    expect(r.project().every((d) => !Object.hasOwn(d, "valueSchema"))).toBe(true);
    expect(() => r.get("spatial.anchor")).toThrow("SEXTANT_CAPABILITY_UNKNOWN");
    expect(() =>
      r.validateRequirement({ capabilityId: "sextant.heading.estimate", version: 2, fallback: "manual" }),
    ).toThrow();
    expect(() =>
      r.validateRequirement({ capabilityId: "sextant.heading.estimate", version: 1, fallback: " " }),
    ).toThrow();
    expect(
      r.validateRequirement({ capabilityId: "sextant.heading.estimate", version: 1, fallback: "manual" }),
    ).toMatchObject({ owner: "SEXTANT" });
  });
  it("does not expose mutable frame arrays", () => {
    const r = new SextantCapabilityRegistry();
    r.get("sextant.heading.estimate").frames.length = 0;
    expect(r.get("sextant.heading.estimate").frames.length).toBe(3);
  });
  it("rejects duplicate/unknown provider contracts and counterfeit simulation identities", () => {
    const f = sextantD0Fixture();
    expect(() => f.providers.register(f.provider)).toThrow();
    const invalid = new SyntheticSextantProvider("id", f.capabilities, [f.request.capabilityId], "synthetic.invalid");
    invalid.definition.capabilities.push("sextant.fake");
    expect(() => f.providers.register(invalid)).toThrow();
    const counterfeit = new SyntheticSextantProvider(
      "id",
      f.capabilities,
      [f.request.capabilityId],
      "synthetic.counterfeit",
    );
    counterfeit.definition.platformFamily = "WEB";
    expect(() => f.providers.register(counterfeit)).toThrow("SEXTANT_SIMULATION_FORBIDDEN");
  });
  it("isolates a provider whose discovery fails", () => {
    const f = sextantD0Fixture();
    f.provider.discover = () => {
      throw new Error("failure");
    };
    expect(f.providers.candidates(f.request.capabilityId)).toEqual([]);
  });
  it("validates units, frames, value ranges and canonical quaternion norm", () => {
    const f = sextantD0Fixture();
    const context = { now: 100, sequence: 0, discontinuity: true };
    for (const s of [
      { ...f.sample, units: "radians" },
      { ...f.sample, referenceFrame: "DEVICE" as const },
      { ...f.sample, value: NaN },
      { ...f.sample, value: 360 },
      { ...f.sample, timestampMonotonic: 101 },
    ])
      expect(() => normalizeObservation(f.capabilities, f.provider, s, context)).toThrow();
    expect(() =>
      f.capabilities.get("sextant.orientation.relative").valueSchema.parse({ x: 1, y: 1, z: 1, w: 1 }),
    ).toThrow();
  });
  it("labels simulation and rejects inconsistent provenance", () => {
    const f = sextantD0Fixture(),
      o = normalizeObservation(f.capabilities, f.provider, f.sample, { now: 100, sequence: 0, discontinuity: true });
    expect(o).toMatchObject({
      syntheticFlag: true,
      sourceClass: "SIMULATED",
      simulationIdentity: f.provider.simulationIdentity,
      ageMs: 0,
      confidence: 0.8,
    });
    expect(() => observationSchema.parse({ ...o, simulationIdentity: undefined })).toThrow();
    expect(() => observationSchema.parse({ ...o, sourceClass: "HARDWARE" })).toThrow();
    expect(projectObservation(o, 2000, 1000)).toMatchObject({ ageMs: 1900, warnings: ["STALE"] });
    expect(() => projectObservation(o, 99, 10)).toThrow();
  });
});
describe("contextual permissions and asynchronous cancellation", () => {
  const purpose = {
    consumerId: "consumer",
    surfaceId: "surface",
    purpose: "NAVIGATION_HEADING",
    consent: true,
    userInitiated: true,
  };
  it("never prompts on construction, discovery, no consent or missing user action", async () => {
    const ask = vi.fn(async () => "GRANTED" as const),
      b = new SextantPermissionBroker(ask);
    expect(b.state("motion").permission).toBe("PROMPT");
    expect(await b.authorize("motion", { ...purpose, consent: false })).toBe("DENIED");
    expect(await b.authorize("motion", { ...purpose, userInitiated: false })).toBe("PROMPT");
    expect(ask).not.toHaveBeenCalled();
  });
  it("deduplicates simultaneous prompts, preserves denial and requires explicit retry", async () => {
    let resolve!: (state: "DENIED") => void;
    const ask = vi.fn(
        () =>
          new Promise<"DENIED">((r) => {
            resolve = r;
          }),
      ),
      b = new SextantPermissionBroker(ask);
    const a = b.authorize("motion", purpose),
      c = b.authorize("motion", purpose);
    expect(ask).toHaveBeenCalledTimes(1);
    resolve("DENIED");
    expect(await a).toBe("DENIED");
    expect(await c).toBe("DENIED");
    await b.authorize("motion", purpose);
    expect(ask).toHaveBeenCalledTimes(1);
    const retry = b.authorize("motion", { ...purpose, retry: true });
    expect(ask).toHaveBeenCalledTimes(2);
    resolve("DENIED");
    await retry;
  });
  it("does not let a pending grant undo revocation or pause", async () => {
    let resolve!: (state: "GRANTED") => void;
    const b = new SextantPermissionBroker(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const a = b.authorize("motion", purpose);
    b.set("motion", "DENIED");
    resolve("GRANTED");
    expect(await a).toBe("DENIED");
    const c = b.authorize("motion", { ...purpose, retry: true });
    b.pause("motion");
    resolve("GRANTED");
    expect(await c).toBe("DENIED");
    expect(() => b.resume("motion", false)).toThrow();
  });
  it("isolates rejected platform requests and requires purpose even for a grant", async () => {
    const b = new SextantPermissionBroker(async () => {
      throw new Error("host");
    });
    expect(await b.authorize("motion", purpose)).toBe("RESTRICTED");
    await expect(b.authorize("motion", { ...purpose, purpose: "" })).rejects.toThrow("SEXTANT_PURPOSE_REQUIRED");
  });
});
describe("leases, rates, failure isolation and owned cleanup", () => {
  it("shares a start under concurrent acquisitions and isolates callbacks and sample mutations", async () => {
    const f = sextantD0Fixture(),
      events: LeaseEvent[] = [];
    try {
      const [a, b] = await Promise.all([
        f.broker.acquire(f.request, () => {
          throw new Error("consumer");
        }),
        f.broker.acquire({ ...f.request, consumerId: "second" }, (e) => events.push(e)),
      ]);
      expect(f.provider.starts).toBe(1);
      f.provider.push(f.sample);
      expect(events).toHaveLength(1);
      await a.release();
      expect(f.provider.stops).toBe(0);
      await b.release();
      expect(f.provider.stops).toBe(1);
    } finally {
      await f.broker.dispose();
    }
  });
  it("downsamples per consumer and rejects out-of-order or invalid readings", async () => {
    const f = sextantD0Fixture(),
      events: LeaseEvent[] = [];
    try {
      await f.broker.acquire(f.request, (e) => events.push(e));
      f.provider.push(f.sample);
      f.setTime(200);
      f.provider.push({ ...f.sample, timestampMonotonic: 200 });
      f.provider.push({ ...f.sample, timestampMonotonic: 150 });
      f.setTime(1100);
      f.provider.push({ ...f.sample, timestampMonotonic: 1100 });
      expect(events.filter((e) => e.type === "OBSERVATION")).toHaveLength(2);
    } finally {
      await f.broker.dispose();
    }
  });
  it("automatically expires even when a provider is silent", async () => {
    vi.useFakeTimers();
    const f = sextantD0Fixture(),
      events: LeaseEvent[] = [];
    await f.broker.acquire({ ...f.request, expiresAt: 200 }, (e) => events.push(e));
    f.setTime(200);
    await vi.advanceTimersByTimeAsync(100);
    await f.broker.idle();
    expect(events).toEqual([{ type: "ENDED", reason: "EXPIRED" }]);
    expect(f.provider.stops).toBe(1);
    await f.broker.dispose();
  });
  for (const action of ["consumer", "surface", "background", "dispose", "pause", "revoke"] as const)
    it(`cleans ${action} without automatic restart`, async () => {
      const f = sextantD0Fixture();
      await f.broker.acquire(f.request, () => {});
      if (action === "consumer") await f.broker.cancelConsumer(f.request.consumerId);
      if (action === "surface") await f.broker.disconnectSurface(f.request.surfaceId);
      if (action === "background") await f.broker.setForeground(false);
      if (action === "dispose") await f.broker.dispose();
      if (action === "pause") f.permissions.pause(f.capabilities.get(f.request.capabilityId).permission);
      if (action === "revoke") f.permissions.set(f.capabilities.get(f.request.capabilityId).permission, "DENIED");
      await f.broker.idle();
      expect(f.broker.diagnostics()).toMatchObject({ activeLeases: 0, activeProviders: 0 });
      expect(f.provider.stops).toBe(1);
      await f.broker.setForeground(true);
      expect(f.provider.starts).toBe(1);
      await f.broker.dispose();
    });
  it("cancels a late provider start after backgrounding", async () => {
    const f = sextantD0Fixture();
    let resolve!: () => void;
    const entered = new Promise<void>((done) => {
      f.provider.start = async () => {
        done();
        await new Promise<void>((r) => {
          resolve = r;
        });
      };
    });
    const acquiring = f.broker.acquire(f.request, () => {});
    await entered;
    const paused = f.broker.setForeground(false);
    resolve();
    await expect(acquiring).rejects.toThrow("SEXTANT_PROVIDER_START_FAILED");
    await paused;
    expect(f.broker.diagnostics().activeProviders).toBe(0);
    await f.broker.dispose();
  });
  it("stops a failed start and leaves no lease", async () => {
    const f = sextantD0Fixture();
    f.provider.start = async () => {
      throw new Error("start");
    };
    await expect(f.broker.acquire(f.request, () => {})).rejects.toThrow("SEXTANT_PROVIDER_START_FAILED");
    expect(f.broker.diagnostics()).toMatchObject({ activeProviders: 0, activeLeases: 0, failedProviders: 1 });
    expect(f.provider.stops).toBe(1);
    await f.broker.dispose();
  });
  it("hard provider failure terminates owned leases and permits a healthy alternative", async () => {
    const f = sextantD0Fixture();
    await f.broker.acquire(f.request, () => {});
    f.provider.fail();
    await f.broker.idle();
    expect(f.broker.diagnostics().activeLeases).toBe(0);
    const second = new SyntheticSextantProvider(
      "alternate",
      f.capabilities,
      [f.request.capabilityId],
      "synthetic.alternate",
    );
    f.providers.register(second);
    await f.broker.acquire(f.request, () => {});
    expect(second.starts).toBe(1);
    await f.broker.dispose();
  });
  it("reports cleanup failure and never reuses an unclean provider", async () => {
    const f = sextantD0Fixture();
    const lease = await f.broker.acquire(f.request, () => {});
    f.provider.stop = async () => {
      throw new Error("stop");
    };
    await expect(lease.release()).rejects.toThrow("SEXTANT_CLEANUP_FAILED");
    await expect(f.broker.acquire(f.request, () => {})).rejects.toThrow("SEXTANT_PROVIDER_UNAVAILABLE");
    expect(f.broker.diagnostics().failedProviders).toBe(1);
    await f.broker.dispose();
  });
  it("does not equate a supported capability with permission or readiness", () => {
    const f = sextantD0Fixture();
    const key = f.capabilities.get(f.request.capabilityId).permission;
    f.permissions.set(key, "DENIED");
    expect(f.broker.snapshot(f.request.capabilityId)).toMatchObject({
      support: "SUPPORTED",
      permission: "DENIED",
      freshness: "UNKNOWN",
    });
  });
  it("rejects absent frame compatibility, expired leases and durable retention", async () => {
    const f = sextantD0Fixture();
    await expect(f.broker.acquire({ ...f.request, frames: ["DEVICE"] }, () => {})).rejects.toThrow();
    await expect(f.broker.acquire({ ...f.request, expiresAt: 100 }, () => {})).rejects.toThrow();
    await expect(f.broker.acquire({ ...f.request, retentionClass: "DURABLE" as never }, () => {})).rejects.toThrow();
    await f.broker.dispose();
  });
});

describe("bounded and immutable provider lifecycle", () => {
  it("rejects a stalled startup, runs bounded cleanup and quarantines the provider", async () => {
    vi.useFakeTimers();
    const f = sextantD0Fixture();
    f.provider.start = () => new Promise(() => {});
    const result = f.broker
      .acquire(f.request, () => {})
      .then(
        () => "unexpected",
        (e) => (e as Error).message,
      );
    await vi.advanceTimersByTimeAsync(5001);
    expect(await result).toBe("SEXTANT_PROVIDER_START_FAILED");
    expect(f.provider.stops).toBe(1);
    expect(f.broker.diagnostics()).toMatchObject({ activeLeases: 0, failedProviders: 1 });
    await f.broker.dispose();
  });
  it("rejects a stalled stop and reports the provider as failed", async () => {
    vi.useFakeTimers();
    const f = sextantD0Fixture();
    const lease = await f.broker.acquire(f.request, () => {});
    f.provider.stop = () => new Promise(() => {});
    const result = lease.release().then(
      () => "unexpected",
      (e) => (e as Error).message,
    );
    await vi.advanceTimersByTimeAsync(5001);
    expect(await result).toBe("SEXTANT_CLEANUP_FAILED");
    expect(f.broker.diagnostics().failedProviders).toBe(1);
    await f.broker.dispose();
  });
  it("retains registered identity and capabilities after the caller mutates metadata", () => {
    const f = sextantD0Fixture();
    f.provider.definition.capabilities.length = 0;
    f.provider.definition.platformFamily = "WEB";
    const registered = f.providers.candidates(f.request.capabilityId);
    expect(registered).toHaveLength(0); // Provider discovery now honestly reports unsupported.
    expect(f.providers.list()[0]).toMatchObject({
      platformFamily: "SYNTHETIC",
      capabilities: [f.request.capabilityId],
    });
  });
  it("ignores stale late callbacks from an old stopped provider generation", async () => {
    const f = sextantD0Fixture(),
      events: LeaseEvent[] = [];
    let stale: ((s: typeof f.sample) => void) | undefined;
    const start = f.provider.start.bind(f.provider);
    f.provider.start = async (ctx) => {
      stale = ctx.emit;
      await start(ctx);
    };
    const lease = await f.broker.acquire(f.request, (e) => events.push(e));
    await lease.release();
    stale?.(f.sample);
    expect(events.filter((e) => e.type === "OBSERVATION")).toHaveLength(0);
    await f.broker.dispose();
  });
});

describe("independent runtime quality and freshness state", () => {
  it("reports latest quality/calibration and consumer-defined freshness without retaining raw values", async () => {
    const f = sextantD0Fixture();
    await f.broker.acquire(f.request, () => {});
    expect(f.broker.snapshot(f.request.capabilityId, 500).freshness).toBe("UNKNOWN");
    f.provider.push({ ...f.sample, qualityClass: "LOW", calibrationState: "DISTURBED" });
    expect(f.broker.snapshot(f.request.capabilityId, 500)).toMatchObject({
      quality: "LOW",
      calibration: "DISTURBED",
      freshness: "FRESH",
      permission: "GRANTED",
      support: "SUPPORTED",
    });
    f.setTime(601);
    expect(f.broker.snapshot(f.request.capabilityId, 500).freshness).toBe("STALE");
    expect(f.broker.snapshot(f.request.capabilityId).freshness).toBe("UNKNOWN");
    expect(() => f.broker.snapshot(f.request.capabilityId, -1)).toThrow();
    await f.broker.dispose();
  });
});
