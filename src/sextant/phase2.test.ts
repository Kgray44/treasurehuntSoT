// @sounding-line-registration owner=project-sextant suite=unit.sextant contracts=sextant.phase2.web-context
import { describe, it, expect, vi } from "vitest";
import {
  orientationQuaternion,
  rotateVector,
  screenAdjustedQuaternion,
  headingFromAttitude,
  radians,
  deltaDegrees,
  inverseQuaternion,
  multiplyQuaternion,
} from "./attitude";
import { DeviceGestureRecognizer, MotionClassifier, type GestureConfig, type GestureInput } from "./gestures";
import { SextantHaptics, type HapticRequest } from "./haptics";
import { WebDeviceSensorProvider, webSensorHub } from "./web-provider";
import { WebSextantRuntime, SextantGestureSession } from "./web-runtime";
import { emulatedWebSensors } from "./web-fixture";
import { SextantCapabilityRegistry } from "./capabilities";
import { normalizeObservation } from "./observations";
import { SextantProviderRegistry } from "./providers";
import { BrowserContextProvider } from "@/landfall/browser-context";
import type { LeaseEvent, LeaseRequest } from "./leases";
import type { ProviderSample } from "./contracts";
const purpose = {
  consumerId: "parallax",
  surfaceId: "phone",
  purpose: "Manipulate the artifact; screen controls are available",
  consent: true,
  userInitiated: true,
};
const request = (id = "sextant.orientation.relative"): LeaseRequest => ({
  ...purpose,
  capabilityId: id,
  updateClass: "INTERACTIVE",
  minimumQuality: "LOW",
  maxAgeMs: 500,
  expiresAt: 20000,
  frames: id.includes("orientation")
    ? ["LOCAL_ARBITRARY", "EARTH_TRUE", "EARTH_MAGNETIC"]
    : id.includes("heading")
      ? ["EARTH_MAGNETIC", "EARTH_TRUE"]
      : ["DEVICE"],
  retentionClass: "EPHEMERAL",
  foregroundRequirement: true,
});
const common = { fallback: "Use the on-screen controls", timeoutMs: 20000, dwellMs: 200 };
const spin: GestureConfig = {
  ...common,
  kind: "ROTATION_COUNT",
  count: 3,
  direction: "CLOCKWISE",
  reversalToleranceDegrees: 15,
};
const input = (at: number, rate = 0): GestureInput => ({
  at,
  qualified: true,
  gravity: { x: 0, y: 0, z: 9.81 },
  linear: { x: 0, y: 0, z: 0 },
  angular: { x: 0, y: 0, z: -radians(rate) },
  stability: "STABLE",
});
describe("Sextant physical coordinates", () => {
  it("uses intrinsic Z-X-Y axes and a normalized quaternion", () => {
    const q = orientationQuaternion(90, 0, 0);
    const v = rotateVector(q, { x: 0, y: 1, z: 0 });
    expect(v.x).toBeCloseTo(-1);
    expect(v.y).toBeCloseTo(0);
    expect(headingFromAttitude(q)).toBeCloseTo(270);
    expect(rotateVector(orientationQuaternion(0, 90, 0), { x: 0, y: 1, z: 0 }).z).toBeCloseTo(1);
    expect(rotateVector(orientationQuaternion(0, 0, 90), { x: 0, y: 0, z: 1 }).x).toBeCloseTo(1);
    const composed = multiplyQuaternion(inverseQuaternion(q), q);
    expect(composed.w).toBeCloseTo(1);
  });
  it("keeps portrait device attitude separate from screen rotation", () => {
    const q = orientationQuaternion(15, 20, 30);
    const copy = { ...q };
    expect(screenAdjustedQuaternion(q, 90)).not.toEqual(q);
    expect(q).toEqual(copy);
  });
  it("rejects invalid Euler values and undefined horizontal bearing", () => {
    expect(() => orientationQuaternion(NaN, 0, 0)).toThrow();
    expect(() => orientationQuaternion(0, 0, 91)).toThrow();
    expect(headingFromAttitude(orientationQuaternion(0, 90, 0))).toBeNull();
    expect(deltaDegrees(1, 359)).toBe(2);
  });
});
describe("web acquisition", () => {
  it("does not prompt or attach hardware on discovery", async () => {
    const f = emulatedWebSensors();
    const prompt = vi.fn(async () => "granted");
    f.target.DeviceMotionEvent = { requestPermission: prompt };
    const r = new WebSextantRuntime(f.target, null, f.now);
    expect(prompt).not.toHaveBeenCalled();
    expect(f.count("devicemotion")).toBe(0);
    expect(r.status("sextant.motion.gravity").freshness).toBe("UNKNOWN");
    await r.dispose();
  });
  it("reports insecure and missing APIs independently from consent", async () => {
    const f = emulatedWebSensors();
    f.target.isSecureContext = false;
    const r = new WebSextantRuntime(f.target, null, f.now);
    expect(r.status("sextant.orientation.relative").support).toBe("UNSUPPORTED");
    expect(await r.enable(purpose)).toBe("DENIED");
    await r.dispose();
  });
  it("invokes both permission APIs before yielding and deduplicates concurrent consumers", async () => {
    const f = emulatedWebSensors();
    let resolve!: (s: string) => void;
    const p = new Promise<string>((r) => {
      resolve = r;
    });
    const orientation = vi.fn(() => p),
      motion = vi.fn(() => p);
    f.target.DeviceOrientationEvent = { requestPermission: orientation };
    f.target.DeviceMotionEvent = { requestPermission: motion };
    const r = new WebSextantRuntime(f.target, null, f.now);
    const first = r.enable(purpose),
      second = r.enable({ ...purpose, consumerId: "crossdeck" });
    expect(orientation).toHaveBeenCalledTimes(1);
    expect(motion).toHaveBeenCalledTimes(1);
    resolve("granted");
    expect(await first).toBe("GRANTED");
    expect(await second).toBe("GRANTED");
    await r.dispose();
  });
  it("denial never acquires and only a deliberate retry prompts again", async () => {
    const f = emulatedWebSensors();
    const prompt = vi.fn(async () => "denied");
    f.target.DeviceOrientationEvent = { requestPermission: prompt };
    const r = new WebSextantRuntime(f.target, null, f.now);
    await r.enable(purpose);
    await r.enable(purpose);
    expect(prompt).toHaveBeenCalledTimes(1);
    await expect(r.acquire(request(), () => {})).rejects.toThrow("PERMISSION_UNAVAILABLE");
    expect(f.count("deviceorientation")).toBe(0);
    prompt.mockResolvedValue("granted");
    expect(await r.enable({ ...purpose, retry: true })).toBe("GRANTED");
    expect(prompt).toHaveBeenCalledTimes(2);
    await r.dispose();
  });
  it("a late permission grant cannot undo a user pause", async () => {
    const f = emulatedWebSensors();
    let resolve!: (s: string) => void;
    f.target.DeviceOrientationEvent = {
      requestPermission: () =>
        new Promise((r) => {
          resolve = r;
        }),
    };
    const r = new WebSextantRuntime(f.target, null, f.now);
    const pending = r.enable(purpose);
    await r.pause();
    resolve("granted");
    expect(await pending).toBe("DENIED");
    expect(r.status(request().capabilityId).paused).toBe(true);
    await r.dispose();
  });
  it("shares provider starts and never removes another consumer's listener", async () => {
    const f = emulatedWebSensors();
    const r = new WebSextantRuntime(f.target, null, f.now);
    await r.enable(purpose);
    const a: LeaseEvent[] = [],
      b: LeaseEvent[] = [];
    const first = await r.acquire(request(), (e) => a.push(e));
    const second = await r.acquire({ ...request(), consumerId: "crossdeck" }, (e) => b.push(e));
    expect(f.count("deviceorientation")).toBe(1);
    f.orientation();
    await first.release();
    expect(f.count("deviceorientation")).toBe(1);
    f.setTime(200);
    f.orientation({ alpha: 10 });
    expect(b.filter((e) => e.type === "OBSERVATION")).toHaveLength(2);
    await second.release();
    expect(f.count("deviceorientation")).toBe(0);
    await r.dispose();
  });
  it("preserves Landfall's accepted hints while sharing generic acquisition", async () => {
    const f = emulatedWebSensors();
    const r = new WebSextantRuntime(f.target, null, f.now);
    await r.enable(purpose);
    const lease = await r.acquire(request(), () => {});
    const legacy = new BrowserContextProvider(f.target, "world");
    const emit = vi.fn();
    await legacy.start({ sessionId: "session", publishedVersionId: "version" }, emit, () => {}, true);
    expect(f.count("deviceorientation")).toBe(1);
    f.orientation({ webkitCompassHeading: 40, webkitCompassAccuracy: 10 });
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ kind: "HEADING", degrees: 40 }));
    await lease.release();
    expect(f.count("deviceorientation")).toBe(1);
    legacy.stop();
    expect(f.count("deviceorientation")).toBe(0);
    await r.dispose();
  });
  it("relative alpha and unqualified absolute events never invent north", async () => {
    const f = emulatedWebSensors();
    const samples: ProviderSample[] = [];
    const p = new WebDeviceSensorProvider(f.target, "ORIENTATION", f.now);
    await p.start({
      signal: new AbortController().signal,
      updateClass: "INTERACTIVE",
      emit: (s) => samples.push(s),
      fail: () => {},
    });
    f.orientation({ alpha: 82 });
    f.setTime(200);
    f.orientation({ alpha: 83, absolute: true });
    expect(samples.some((s) => s.capabilityId.includes("heading") || s.capabilityId.endsWith("absolute"))).toBe(false);
    expect(samples.at(-1)?.referenceFrame).toBe("LOCAL_ARBITRARY");
    expect(samples.at(-1)?.discontinuity).toBe(true);
    await p.stop();
  });
  it("qualified absolute attitude and heading retain explicit north frame and unknown uncertainty", async () => {
    const f = emulatedWebSensors();
    const samples: ProviderSample[] = [];
    const p = new WebDeviceSensorProvider(f.target, "ORIENTATION", f.now, { absoluteNorthReference: "TRUE" });
    await p.start({
      signal: new AbortController().signal,
      updateClass: "INTERACTIVE",
      emit: (s) => samples.push(s),
      fail: () => {},
    });
    f.orientation({ alpha: 359, absolute: true });
    expect(samples.find((s) => s.capabilityId.endsWith("absolute"))?.referenceFrame).toBe("EARTH_TRUE");
    expect(samples.find((s) => s.capabilityId.includes("heading"))?.value).toBeCloseTo(1);
    await p.stop();
  });
  it("rejects negative compass accuracy and nonfinite/null components", async () => {
    const f = emulatedWebSensors();
    const samples: ProviderSample[] = [];
    const p = new WebDeviceSensorProvider(f.target, "ORIENTATION", f.now);
    await p.start({
      signal: new AbortController().signal,
      updateClass: "INTERACTIVE",
      emit: (s) => samples.push(s),
      fail: () => {},
    });
    f.orientation({ alpha: null });
    expect(samples).toHaveLength(0);
    f.setTime(200);
    f.orientation({ webkitCompassHeading: 10, webkitCompassAccuracy: -1 });
    expect(samples.some((s) => s.capabilityId.includes("heading"))).toBe(false);
    await p.stop();
  });
  it("normalizes gyro axis mapping and separates gravity, never relabels including-gravity as linear", async () => {
    const f = emulatedWebSensors();
    const samples: ProviderSample[] = [];
    const p = new WebDeviceSensorProvider(f.target, "MOTION", f.now);
    await p.start({
      signal: new AbortController().signal,
      updateClass: "INTERACTIVE",
      emit: (s) => samples.push(s),
      fail: () => {},
    });
    f.motion({ rotationRate: { alpha: 180, beta: 90, gamma: -90 } });
    expect(samples.find((s) => s.capabilityId.endsWith("angular-velocity"))?.value).toEqual({
      x: Math.PI / 2,
      y: -Math.PI / 2,
      z: Math.PI,
    });
    expect(samples.find((s) => s.capabilityId.endsWith("gravity"))?.value).toEqual({ x: 0, y: 0, z: 9.81 });
    samples.length = 0;
    f.setTime(200);
    f.motion({ acceleration: null });
    expect(samples.some((s) => s.capabilityId.endsWith("linear-acceleration"))).toBe(false);
    expect(samples.find((s) => s.capabilityId.endsWith("acceleration-including-gravity"))?.warnings).toContain(
      "GRAVITY_NOT_SEPARATED",
    );
    await p.stop();
  });
  it("honors rate classes and marks a sensor gap discontinuous", async () => {
    const f = emulatedWebSensors();
    const samples: ProviderSample[] = [];
    const p = new WebDeviceSensorProvider(f.target, "ORIENTATION", f.now);
    await p.start({
      signal: new AbortController().signal,
      updateClass: "LOW_RATE",
      emit: (s) => samples.push(s),
      fail: () => {},
    });
    f.orientation();
    f.setTime(200);
    f.orientation();
    expect(samples).toHaveLength(2);
    f.setTime(2000);
    f.orientation({ alpha: 90 });
    expect(samples.at(-1)?.discontinuity).toBe(true);
    expect(samples.at(-2)?.value).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    await p.stop();
  });
  it("background and pagehide release resources, foreground requires explicit reacquisition", async () => {
    const f = emulatedWebSensors();
    const r = new WebSextantRuntime(f.target, null, f.now);
    await r.enable(purpose);
    await r.acquire(request(), () => {});
    f.background();
    await r.leases.idle();
    expect(f.count("deviceorientation")).toBe(0);
    f.foreground();
    await r.leases.idle();
    expect(r.leases.diagnostics().activeLeases).toBe(0);
    await r.acquire(request(), () => {});
    f.pagehide();
    await r.leases.idle();
    expect(f.count("deviceorientation")).toBe(0);
    f.pageshow();
    await r.leases.idle();
    expect(r.leases.diagnostics().activeLeases).toBe(0);
    await r.dispose();
    expect(f.count("pagehide")).toBe(0);
    expect(webSensorHub(f.target).diagnostics().ownedListeners).toBe(0);
  });
  it("revocation cleans leases and simulation cannot register in production", async () => {
    const f = emulatedWebSensors();
    const r = new WebSextantRuntime(f.target, null, f.now);
    await r.enable(purpose);
    await r.acquire(request(), () => {});
    await r.revoke();
    expect(f.count("deviceorientation")).toBe(0);
    await r.dispose();
    const registry = new SextantProviderRegistry(new SextantCapabilityRegistry());
    expect(() =>
      registry.register(new WebDeviceSensorProvider(f.target, "MOTION", f.now, { emulationIdentity: "d1" })),
    ).toThrow("SIMULATION_FORBIDDEN");
  });
});
describe("deterministic device intent", () => {
  it("requires continuous quiet motion before stable and resets on missing data/gaps", () => {
    const classifier = new MotionClassifier();
    for (let at = 0; at < 600; at += 100)
      expect(classifier.update(at, input(at).linear!, input(at).angular!)).toBe("UNKNOWN");
    expect(classifier.update(600, input(600).linear!, input(600).angular!)).toBe("STABLE");
    expect(classifier.update(1600, input(1600).linear!, input(1600).angular!)).toBe("UNKNOWN");
    expect(classifier.update(1700, null, input(1700).angular!)).toBe("UNKNOWN");
  });
  it("hysteresis retains a stable classification under small hand jitter", () => {
    const classifier = new MotionClassifier();
    for (let at = 0; at <= 600; at += 100) classifier.update(at, input(at).linear!, input(at).angular!);
    expect(classifier.update(700, { x: 0.5, y: 0, z: 0 }, input(700).angular!)).toBe("STABLE");
    expect(classifier.update(800, { x: 1, y: 0, z: 0 }, input(800).angular!)).toBe("MOVING");
  });
  it("counts three continuous deliberate gravity-aligned rotations with a dwell", () => {
    const g = new DeviceGestureRecognizer(spin);
    let result;
    for (let at = 0; at <= 12400; at += 100) result = g.update(input(at, 90));
    expect(result?.state).toBe("COMPLETED");
    expect(result?.count).toBe(3);
  });
  it("rejects walking, large reversals, fast spinning, discontinuity and stale gaps", () => {
    for (const bad of [
      { ...input(100), linear: { x: 2, y: 0, z: 0 } },
      input(100, 300),
      { ...input(100), discontinuity: true },
      input(1000),
    ]) {
      const g = new DeviceGestureRecognizer(spin);
      g.update(input(0, 90));
      expect(g.update(bad).state).toBe("RESET");
    }
    const g = new DeviceGestureRecognizer(spin);
    g.update(input(0, -90));
    for (let at = 100; at <= 500; at += 100) if (g.update(input(at, -90)).state === "RESET") return;
    throw new Error("reversal not rejected");
  });
  it("small oscillations never satisfy full turns", () => {
    const g = new DeviceGestureRecognizer(spin);
    for (let at = 0; at <= 10000; at += 100)
      expect(g.update(input(at, at % 200 ? -20 : 20)).state).not.toBe("COMPLETED");
  });
  it("matches bearing across zero only with the correct north reference", () => {
    const g = new DeviceGestureRecognizer({
      ...common,
      kind: "TURN_TO_BEARING",
      targetDegrees: 1,
      toleranceDegrees: 5,
      northReference: "MAGNETIC",
    });
    const bearing = (at: number) => ({ ...input(at), heading: { degrees: 359, northReference: "MAGNETIC" as const } });
    expect(g.update(bearing(0)).state).toBe("TRACKING");
    expect(g.update(bearing(200)).state).toBe("COMPLETED");
    g.reset();
    expect(g.update({ ...bearing(300), heading: { degrees: 1, northReference: "UNKNOWN" } }).state).toBe("UNAVAILABLE");
  });
  it("hold steady requires dwell and interruption resets it", () => {
    const g = new DeviceGestureRecognizer({ ...common, kind: "HOLD_STEADY" });
    expect(g.update(input(0)).state).toBe("TRACKING");
    expect(g.update({ ...input(100), stability: "MOVING" }).state).toBe("TRACKING");
    expect(g.update(input(200)).state).toBe("TRACKING");
    expect(g.update(input(400)).state).toBe("COMPLETED");
  });
  it("relative turn integrates gyro and requires stable target dwell", () => {
    const g = new DeviceGestureRecognizer({ ...common, kind: "RELATIVE_TURN", angleDegrees: 90, toleranceDegrees: 10 });
    let result;
    for (let at = 0; at <= 1000; at += 100) result = g.update(input(at, 90));
    result = g.update(input(1100));
    result = g.update(input(1300));
    expect(result.state).toBe("COMPLETED");
  });
  it("tilt band and slow sweep have bounded meaningful completion", () => {
    const tilt = new DeviceGestureRecognizer({
      ...common,
      kind: "TILT_BAND",
      axis: "X",
      minimumDegrees: 20,
      maximumDegrees: 40,
    });
    const t = (at: number) => ({ ...input(at), attitude: orientationQuaternion(0, 30, 0) });
    tilt.update(t(0));
    expect(tilt.update(t(200)).state).toBe("COMPLETED");
    const sweep = new DeviceGestureRecognizer({
      ...common,
      kind: "SLOW_SWEEP",
      coverageDegrees: 30,
      maxSpeedDegreesPerSecond: 45,
    });
    let result;
    for (let at = 0; at <= 1500; at += 100) result = sweep.update(input(at, 30));
    expect(result?.state).toBe("COMPLETED");
  });
  it("rejects missing alternatives and invalid threshold/duration contracts", () => {
    expect(() => new DeviceGestureRecognizer({ ...spin, fallback: "" })).toThrow();
    expect(() => new DeviceGestureRecognizer({ ...spin, dwellMs: 0 })).toThrow();
  });
  it("gesture session consumes semantic envelopes once per frame and resets on loss", async () => {
    const f = emulatedWebSensors();
    const r = new WebSextantRuntime(f.target, null, f.now, { emulationIdentity: "browser-d1" });
    await r.enable(purpose);
    const session = new SextantGestureSession({ ...common, kind: "HOLD_STEADY" }, f.now);
    const results: string[] = [];
    await r.acquire(request("sextant.motion.stability"), (e) => {
      const result = session.accept(e);
      if (result) results.push(result.state);
    });
    for (let at = 100; at <= 1100; at += 100) {
      f.setTime(at);
      f.motion();
    }
    expect(results).toContain("COMPLETED");
    await r.pause();
    expect(session.recognizer.update({ ...input(1200), qualified: false }).state).toBe("UNAVAILABLE");
    await r.dispose();
  });
  it("marks provider gap discontinuity in consumer envelopes", () => {
    const f = emulatedWebSensors();
    const p = new WebDeviceSensorProvider(f.target, "MOTION", f.now);
    const sample: ProviderSample = {
      capabilityId: "sextant.motion.linear-acceleration",
      value: { x: 0, y: 0, z: 0 },
      units: "m/s^2",
      referenceFrame: "DEVICE",
      timestampMonotonic: 100,
      confidence: null,
      calibrationState: "UNKNOWN",
      qualityClass: "MEDIUM",
      warnings: [],
      discontinuity: true,
    };
    expect(
      normalizeObservation(new SextantCapabilityRegistry(), p, sample, { now: 100, sequence: 0, discontinuity: false })
        .discontinuity,
    ).toBe(true);
  });
});
describe("semantic haptic output", () => {
  const cue: HapticRequest = {
    cue: "CONFIRM",
    consumerId: "storytide",
    purpose: "Artifact found",
    fallback: "Artifact found text and visual glow",
  };
  it("unsupported and disabled output return the authored visual/text alternative", () => {
    expect(new SextantHaptics(null).request(cue).state).toBe("FALLBACK");
    const execute = vi.fn(() => true);
    const h = new SextantHaptics({ tier: "BASIC", execute, cancel: () => {} });
    h.setPreferences(true, true);
    expect(h.request(cue).reason).toBe("OUTPUT_PAUSED_OR_DISABLED");
    expect(execute).not.toHaveBeenCalled();
  });
  it("bounds custom patterns, simultaneous ownership and output rate", () => {
    let at = 0;
    const execute = vi.fn(() => true),
      cancel = vi.fn();
    const h = new SextantHaptics({ tier: "BASIC", execute, cancel }, () => at);
    expect(h.request({ ...cue, cue: "CUSTOM", pattern: [200, 200, 200, 200, 200, 200, 200] }).state).toBe("FALLBACK");
    expect(h.request(cue).state).toBe("REQUESTED");
    expect(h.request({ ...cue, consumerId: "other" }).state).toBe("FALLBACK");
    h.cancelConsumer("other");
    expect(cancel).not.toHaveBeenCalled();
    h.cancelConsumer(cue.consumerId);
    expect(cancel).toHaveBeenCalledTimes(1);
    at = 300;
    expect(h.request(cue).state).toBe("FALLBACK");
    at = 600;
    expect(h.request(cue).state).toBe("REQUESTED");
    h.dispose();
  });
  it("background and preference changes cancel owned vibration", () => {
    const cancel = vi.fn();
    const h = new SextantHaptics({ tier: "BASIC", execute: () => true, cancel }, () => 1000);
    h.request(cue);
    h.setForeground(false);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(h.request(cue).state).toBe("FALLBACK");
    h.dispose();
  });
  it("platform false means fallback; true never claims physical confirmation", () => {
    const bad = new SextantHaptics({ tier: "BASIC", execute: () => false, cancel: () => {} });
    expect(bad.request(cue).reason).toBe("PLATFORM_REJECTED_OR_DISABLED");
    const h = new SextantHaptics({ tier: "BASIC", execute: () => true, cancel: () => {} });
    expect(h.request(cue).reason).toBe("PHYSICAL_OUTPUT_UNCONFIRMED");
    h.dispose();
  });
});

it("consumer gesture wiring releases partial acquisitions and coordinates all semantic channels", async () => {
  const f = emulatedWebSensors();
  const runtime = new WebSextantRuntime(f.target, null, f.now);
  const results: string[] = [];
  const gesture = await runtime.beginGesture({ ...common, kind: "HOLD_STEADY" }, request(), (result) =>
    results.push(result.state),
  );
  for (let at = 100; at <= 1200; at += 100) {
    f.setTime(at);
    f.motion();
  }
  expect(results.filter((state) => state === "COMPLETED")).toHaveLength(1);
  await gesture.release();
  expect(f.count("devicemotion")).toBe(0);
  f.target.DeviceMotionEvent = undefined;
  await expect(
    runtime.beginGesture(
      { ...common, kind: "TILT_BAND", axis: "X", minimumDegrees: 0, maximumDegrees: 20 },
      request(),
      () => {},
    ),
  ).rejects.toThrow("PROVIDER_UNAVAILABLE");
  expect(f.count("deviceorientation")).toBe(0);
  expect(runtime.leases.diagnostics().activeLeases).toBe(0);
  await runtime.dispose();
});
it("high-fidelity bursts expire within 30 seconds and cannot become unlimited sampling", async () => {
  const f = emulatedWebSensors();
  const runtime = new WebSextantRuntime(f.target, null, f.now);
  await expect(
    runtime.acquire({ ...request(), updateClass: "HIGH_FIDELITY_BURST", expiresAt: f.now() + 30001 }, () => {}),
  ).rejects.toThrow("LEASE_UNAVAILABLE");
  expect(f.count("deviceorientation")).toBe(0);
  await runtime.dispose();
});
it("failed haptic cleanup is visible and quarantines future output", () => {
  const haptics = new SextantHaptics({
    tier: "BASIC",
    execute: () => true,
    cancel: () => {
      throw new Error("device lost");
    },
  });
  const cue = { cue: "TICK" as const, consumerId: "lab", purpose: "Clue", fallback: "Show clue text" };
  haptics.request(cue);
  haptics.cancel();
  expect(haptics.status().cleanupFailed).toBe(true);
  expect(haptics.request(cue).reason).toBe("OUTPUT_CLEANUP_FAILED");
  haptics.dispose();
});

it("projects basic output support separately from rich support and user preferences", async () => {
  const f = emulatedWebSensors();
  const runtime = new WebSextantRuntime(f.target, { vibrate: () => true }, f.now);
  expect(runtime.status("sextant.haptics.basic").support).toBe("SUPPORTED");
  expect(runtime.status("sextant.haptics.rich").support).toBe("UNSUPPORTED");
  runtime.setHapticPreferences(true, true);
  expect(runtime.status("sextant.haptics.basic").paused).toBe(true);
  await runtime.pause();
  runtime.resume(true);
  expect(runtime.haptics.status().reducedSensory).toBe(true);
  await runtime.dispose();
});
it("bearing alignment abstains when uncertainty exceeds the authored tolerance", () => {
  const f = emulatedWebSensors();
  const provider = new WebDeviceSensorProvider(f.target, "ORIENTATION", f.now);
  const session = new SextantGestureSession(
    { ...common, kind: "TURN_TO_BEARING", targetDegrees: 1, toleranceDegrees: 5, northReference: "MAGNETIC" },
    f.now,
  );
  const registry = new SextantCapabilityRegistry();
  const make = (capabilityId: string, value: unknown, uncertainty?: number) =>
    normalizeObservation(
      registry,
      capabilityId.includes("heading") ? provider : new WebDeviceSensorProvider(f.target, "MOTION", f.now),
      {
        capabilityId,
        value,
        units: capabilityId.includes("heading") ? "degrees" : "classification",
        referenceFrame: capabilityId.includes("heading") ? "EARTH_MAGNETIC" : "DEVICE",
        timestampMonotonic: f.now(),
        confidence: null,
        calibrationState: "UNKNOWN",
        qualityClass: "MEDIUM",
        warnings: [],
        uncertainty,
      },
      { now: f.now(), sequence: 1, discontinuity: false },
    );
  session.accept({ type: "OBSERVATION", observation: make("sextant.heading.estimate", 1, 30) });
  expect(session.accept({ type: "OBSERVATION", observation: make("sextant.motion.stability", "STABLE") })?.state).toBe(
    "UNAVAILABLE",
  );
});
