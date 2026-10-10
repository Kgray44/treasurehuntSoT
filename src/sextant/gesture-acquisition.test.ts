// @sounding-line-registration owner=project-sextant suite=unit.sextant contracts=sextant.phase2.web-context
import { describe, it, expect, vi } from "vitest";
import { WebSextantRuntime, SextantGestureSession } from "./web-runtime";
import { emulatedWebSensors } from "./web-fixture";
import { gestureAcquisition } from "./gesture-acquisition";
import type { GestureConfig } from "./gestures";
import type { LeaseRequest } from "./leases";
import type { Observation } from "./contracts";
const common = { fallback: "Use screen controls", timeoutMs: 20000, dwellMs: 200 };
const configs: GestureConfig[] = [
  { ...common, kind: "HOLD_STEADY" },
  { ...common, kind: "RELATIVE_TURN", angleDegrees: 90, toleranceDegrees: 10 },
  { ...common, kind: "TURN_TO_BEARING", targetDegrees: 0, toleranceDegrees: 10, northReference: "MAGNETIC" },
  { ...common, kind: "ROTATION_COUNT", count: 1, direction: "CLOCKWISE", reversalToleranceDegrees: 15 },
  { ...common, kind: "TILT_BAND", axis: "X", minimumDegrees: 20, maximumDegrees: 40 },
  { ...common, kind: "SLOW_SWEEP", coverageDegrees: 30, maxSpeedDegreesPerSecond: 45 },
];
const request = (): Omit<LeaseRequest, "capabilityId" | "frames"> => ({
  consumerId: "gesture",
  surfaceId: "phone",
  purpose: "Clue with screen alternative",
  consent: true,
  userInitiated: true,
  updateClass: "INTERACTIVE",
  minimumQuality: "MEDIUM",
  maxAgeMs: 500,
  expiresAt: 20000,
  retentionClass: "EPHEMERAL",
  foregroundRequirement: true,
});
describe("complete acquired gesture sessions (D1 emulation)", () => {
  for (const config of configs)
    it(config.kind, async () => {
      const f = emulatedWebSensors(),
        r = new WebSextantRuntime(f.target, null, f.now, { emulationIdentity: "gesture-session" });
      const results: string[] = [];
      const g = await r.beginGesture(config, request(), (x) => results.push(x.state));
      for (let at = 100; at <= 7000; at += 100) {
        f.setTime(at);
        let rate = 0;
        if (config.kind === "RELATIVE_TURN") rate = at <= 1200 ? 90 : 0;
        if (config.kind === "ROTATION_COUNT") rate = 90;
        if (config.kind === "SLOW_SWEEP") rate = 30;
        f.orientation({
          beta: config.kind === "TILT_BAND" ? 30 : 0,
          webkitCompassHeading: 0,
          webkitCompassAccuracy: 2,
        });
        f.motion({ rotationRate: { alpha: -rate, beta: 0, gamma: 0 } });
      }
      expect(results.filter((x) => x === "COMPLETED")).toHaveLength(1);
      await g.release();
      expect(r.leases.diagnostics().activeLeases).toBe(0);
      expect(f.count("devicemotion") + f.count("deviceorientation")).toBe(0);
      await r.dispose();
    });
  for (const updateClass of ["LOW_RATE", "PASSIVE"] as const)
    it(`rejects ${updateClass} before permission or acquisition`, async () => {
      const f = emulatedWebSensors(),
        r = new WebSextantRuntime(f.target, null, f.now, { emulationIdentity: "gesture" }),
        acquire = vi.spyOn(r, "acquire");
      await expect(r.beginGesture(configs[0], { ...request(), updateClass }, () => {})).rejects.toThrow(
        "CADENCE_INCOMPATIBLE",
      );
      expect(acquire).not.toHaveBeenCalled();
      await r.dispose();
    });
  it("aborts a pending multi-lease acquisition and releases the late lease", async () => {
    const f = emulatedWebSensors(),
      r = new WebSextantRuntime(f.target, null, f.now, { emulationIdentity: "gesture" });
    const original = r.acquire.bind(r),
      controller = new AbortController();
    vi.spyOn(r, "acquire").mockImplementationOnce(async (...args) => {
      const lease = await original(...args);
      controller.abort();
      return lease;
    });
    await expect(r.beginGesture(configs[1], request(), () => {}, { signal: controller.signal })).rejects.toThrow(
      "ABORTED",
    );
    expect(r.leases.diagnostics().activeLeases).toBe(0);
    await r.dispose();
  });
  it("expires a burst as one gesture and reacquires after interruption", async () => {
    const f = emulatedWebSensors(),
      r = new WebSextantRuntime(f.target, null, f.now, { emulationIdentity: "gesture" });
    await r.beginGesture(configs[1], { ...request(), updateClass: "HIGH_FIDELITY_BURST", expiresAt: 1000 }, () => {});
    f.setTime(1000);
    await r.leases.sweep();
    await r.leases.idle();
    expect(r.leases.diagnostics().activeLeases).toBe(0);
    const g = await r.beginGesture(configs[0], request(), () => {});
    f.background();
    await r.leases.idle();
    expect(r.leases.diagnostics().activeLeases).toBe(0);
    f.foreground();
    await g.release();
    const h = await r.beginGesture(configs[0], request(), () => {});
    await h.release();
    await r.dispose();
  });
});
function observation(id: string, at: number, value: unknown): Observation {
  return {
    observationId: `${id}-${at}`,
    capabilityId: id,
    semanticVersion: 1,
    value,
    units: "test",
    referenceFrame: id.includes("heading") ? "EARTH_MAGNETIC" : "DEVICE",
    timestampMonotonic: at,
    ageMs: 0,
    sequence: at,
    discontinuity: false,
    sourceClass: "SIMULATED",
    providerIdDiagnostic: "test",
    confidence: null,
    uncertainty: 2,
    calibrationState: "GOOD",
    qualityClass: "HIGH",
    provenanceRoot: "test",
    syntheticFlag: true,
    simulationIdentity: "test",
    lifecycleState: "FOREGROUND_ONLY",
    warnings: [],
  };
}
describe("gesture observation boundaries (D0)", () => {
  for (const gap of [100, 500, 1000, 5000])
    it(`honest gap ${gap}`, () => {
      let at = 0;
      const s = new SextantGestureSession({ ...configs[0], dwellMs: 1000 }, () => at);
      let completed = false;
      for (let i = 0; i < 16; i++) {
        at = i * gap;
        completed =
          s.accept({ type: "OBSERVATION", observation: observation("sextant.motion.stability", at, "STABLE") })
            ?.state === "COMPLETED" || completed;
      }
      expect(completed).toBe(gap <= 500);
    });
  for (const skew of [99, 100, 101])
    it(`cross-channel skew ${skew}`, () => {
      let at = 0;
      const s = new SextantGestureSession(configs[2], () => at);
      let completed = false;
      for (at = 100; at <= 1000; at += 100) {
        s.accept({ type: "OBSERVATION", observation: observation("sextant.heading.estimate", at - skew, 0) });
        completed =
          s.accept({ type: "OBSERVATION", observation: observation("sextant.motion.stability", at, "STABLE") })
            ?.state === "COMPLETED" || completed;
      }
      expect(completed).toBe(skew <= 100);
    });
  it("resets on missing, stale, unknown, changed provider and wrong north reference", () => {
    let at = 100;
    const s = new SextantGestureSession(configs[2], () => at);
    const send = (o: Observation) => s.accept({ type: "OBSERVATION", observation: o });
    expect(send(observation("sextant.motion.stability", at, "STABLE"))?.state).toBe("UNAVAILABLE");
    for (const override of [
      { referenceFrame: "EARTH_TRUE" as const },
      { qualityClass: "UNKNOWN" as const },
      { timestampMonotonic: 0 },
    ]) {
      at = 1000;
      send({ ...observation("sextant.heading.estimate", at, 0), ...override });
      expect(send(observation("sextant.motion.stability", at, "STABLE"))?.state).toBe("UNAVAILABLE");
    }
    at = 1100;
    send(observation("sextant.heading.estimate", at, 0));
    send(observation("sextant.motion.stability", at, "STABLE"));
    at = 1300;
    send({ ...observation("sextant.heading.estimate", at, 0), providerIdDiagnostic: "replacement" });
    expect(send(observation("sextant.motion.stability", at, "STABLE"))?.state).not.toBe("COMPLETED");
    expect(gestureAcquisition(configs[2]).northReference).toBe("MAGNETIC");
  });
});
