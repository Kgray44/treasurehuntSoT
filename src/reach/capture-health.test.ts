// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import {
  ReachCaptureHealth,
  defaultReachCaptureHealthPolicy,
  reachCaptureHealthPolicySchema,
  captureProcessingPressure,
  type ReachCaptureEvidence,
} from "./capture-health";

const frame = (at: number, overrides: Partial<ReachCaptureEvidence> = {}): ReachCaptureEvidence => ({
  sourceBinding: "camera-lease-a/geometry-1",
  context: "camera-a/baseline",
  captureMs: at,
  receivedMs: at + 20,
  accepted: true,
  trackingExpected: true,
  usablePoint: true,
  modelHandPresent: true,
  freshImageContinuity: true,
  identityConflict: false,
  contraryGesture: false,
  processingPressure: false,
  imageSignal: { scope: "SUBJECT_REGION", meanLuminance: 0.5, luminanceDeviation: 0.15, detail: 0.2 },
  ...overrides,
});
function feed(
  health: ReachCaptureHealth,
  from: number,
  through: number,
  overrides: Partial<ReachCaptureEvidence> = {},
  step = 100,
) {
  for (let at = from; at <= through; at += step) health.record(frame(at, overrides));
  return health.diagnose(through + 20);
}
describe("time-weighted Reach capture diagnosis", () => {
  it("distinguishes steady adaptive capacity from latency risk and absolute timer pressure", () => {
    const steady = {
      intervalMs: 34,
      smoothedTotalMs: 33,
      smoothedMainThreadMs: 5,
      smoothedTimerLatenessMs: 0,
      mainThreadDutyLimit: 0.3,
    };
    expect(captureProcessingPressure(steady, 2)).toBe(false);
    expect(captureProcessingPressure({ ...steady, intervalMs: 200, smoothedTotalMs: 200 }, 2)).toBe(true);
    expect(captureProcessingPressure({ ...steady, intervalMs: 200, smoothedTotalMs: 30 }, 2)).toBe(false);
    expect(captureProcessingPressure({ ...steady, intervalMs: 300, smoothedMainThreadMs: 70 }, 2)).toBe(true);
    expect(captureProcessingPressure({ ...steady, intervalMs: 200, smoothedTimerLatenessMs: 8 }, 2)).toBe(true);
  });
  it("keeps ordinary-camera healthy tracking independent of optional sources, dimensions and nominal sensor FPS", () => {
    for (const step of [34, 67, 100, 200]) {
      const health = new ReachCaptureHealth();
      expect(feed(health, 0, step * Math.ceil(1400 / step), {}, step).state).toBe("HEALTHY");
    }
  });
  it("does not cancel useful setup or diagnose hardware failure from a single imperfect frame", () => {
    const health = new ReachCaptureHealth();
    feed(health, 0, 2000);
    const lost = health.record(frame(2100, { usablePoint: false, modelHandPresent: false }));
    expect(lost.state).toBe("INTERRUPTED");
    expect(lost.measured).toEqual([]);
    expect(lost.hypotheses).toEqual([]);
    expect(health.record(frame(2200)).state).toBe("HEALTHY");
  });
  it("distinguishes sustained fresh model-acquisition loss from capture failure", () => {
    const health = new ReachCaptureHealth();
    const result = feed(health, 0, 2000, { usablePoint: false, modelHandPresent: false });
    expect(result.state).toBe("DEGRADED");
    expect(result.measured).toEqual(["MODEL_ACQUISITION_GAP"]);
    expect(result.staleFraction).toBe(0);
    expect(result.hypotheses).toEqual([]);
  });
  it("does not infer bad lighting from no hands, or from a dark whole-frame background", () => {
    const health = new ReachCaptureHealth();
    const result = feed(health, 0, 2000, {
      usablePoint: false,
      modelHandPresent: false,
      freshImageContinuity: false,
      imageSignal: { scope: "WHOLE_FRAME", meanLuminance: 0.01, luminanceDeviation: 0.01, detail: 0.001 },
    });
    expect(result.measured).toEqual([]);
    expect(result.hypotheses).toEqual(["UNKNOWN"]);
  });
  it("does not mislabel fresh-clock rejected packets as late captures", () => {
    const result = feed(new ReachCaptureHealth(), 0, 2000, { accepted: false, usablePoint: false });
    expect(result.measured).toContain("REJECTED_OBSERVATION");
    expect(result.measured).not.toContain("STALE_CAPTURE");
    expect(result.staleFraction).toBe(0);
    expect(result.rejectedFraction).toBe(1);
  });
  it("labels measured subject signal separately from its lighting hypothesis", () => {
    const result = feed(new ReachCaptureHealth(), 0, 2000, {
      usablePoint: false,
      modelHandPresent: false,
      imageSignal: { scope: "SUBJECT_REGION", meanLuminance: 0.04, luminanceDeviation: 0.02, detail: 0.01 },
    });
    expect(result.measured).toContain("LOW_SUBJECT_SIGNAL");
    expect(result.hypotheses).toContain("LIGHTING_OR_CONTRAST");
  });
  it("does not treat an open palm or absent user as a hardware problem", () => {
    const result = feed(new ReachCaptureHealth(), 0, 3000, {
      trackingExpected: false,
      usablePoint: false,
      modelHandPresent: false,
      contraryGesture: true,
      imageSignal: null,
    });
    expect(result.state).toBe("NO_POINTING_INTENT");
    expect(result.evidenceMs).toBe(0);
    expect(result.measured).toEqual([]);
  });
  it("never counts a confident image track over conflicting or contrary full-hand evidence as usable", () => {
    for (const overrides of [{ identityConflict: true }, { contraryGesture: true }]) {
      const result = feed(new ReachCaptureHealth(), 0, 2000, overrides);
      expect(result.usableFraction).toBe(0);
      expect(result.state).toBe("DEGRADED");
    }
  });
  it("retains honest freshness at exactly150ms and rejects150.001 without changing independent gates", () => {
    const health = new ReachCaptureHealth();
    feed(health, 0, 2000, {}, 200);
    health.record(frame(2200, { receivedMs: 2350 }));
    expect(health.record(frame(2400, { receivedMs: 2550 })).staleFraction).toBe(0);
    health.record(frame(2600, { receivedMs: 2750.001 }));
    expect(health.record(frame(2800, { receivedMs: 2950 })).staleFraction).toBeGreaterThan(0);
  });
  it("does not convert display expiry between slow valid frames into a stale-capture diagnosis", () => {
    const health = new ReachCaptureHealth({
      ...defaultReachCaptureHealthPolicy,
      windowMs: 2000,
      recoveryEvidenceMs: 1000,
    });
    for (let at = 0; at <= 2000; at += 200) health.record(frame(at, { usablePoint: false, receivedMs: at + 120 }));
    for (let at = 2200; at <= 6000; at += 200) {
      health.record(frame(at, { receivedMs: at + 120 }));
      expect(health.diagnose(at + 180).state).toBe("INTERRUPTED");
    }
    const result = health.record(frame(6200, { receivedMs: 6320 }));
    expect(result.state).toBe("HEALTHY");
    expect(result.staleFraction).toBe(0);
  });
  it("does not count a long camera interruption as evidence or extend a last-known pointer", () => {
    const health = new ReachCaptureHealth();
    feed(health, 0, 2000);
    expect(health.diagnose(5000).state).toBe("INTERRUPTED");
    const resumed = health.record(frame(10000));
    expect(resumed.evidenceMs).toBe(0);
    expect(resumed.state).toBe("WARMING");
  });
  it("measures delivery cadence separately and includes gaps without counting them as hold evidence", () => {
    const health = new ReachCaptureHealth();
    expect(feed(health, 0, 2000, {}, 100).captureHz).toBeCloseTo(10);
    const afterGap = health.record(frame(3000));
    expect(afterGap.evidenceMs).toBe(2000);
    expect(afterGap.captureHz).toBeCloseTo(7);
  });
  it("keeps evidence weighted by time rather than letting a fast burst dominate", () => {
    const health = new ReachCaptureHealth();
    feed(health, 0, 1200, { usablePoint: false }, 100);
    for (let i = 1; i <= 100; ++i) health.record(frame(1200 + i, { usablePoint: true }));
    const result = health.diagnose(1320);
    expect(result.usableFraction).toBeLessThan(0.1);
    expect(result.state).toBe("DEGRADED");
  });
  it("does not present initial alternating recognition as a healthy baseline", () => {
    const health = new ReachCaptureHealth();
    for (let at = 0; at <= 2000; at += 100) {
      const result = health.record(frame(at, { usablePoint: at % 200 === 0 }));
      expect(result.state).not.toBe("HEALTHY");
    }
    expect(health.diagnose(2020).usableFraction).toBe(0.5);
  });
  it("uses sustained recovery and pauses its recovery timer on another loss", () => {
    const health = new ReachCaptureHealth({
      ...defaultReachCaptureHealthPolicy,
      windowMs: 2000,
      recoveryEvidenceMs: 1000,
    });
    feed(health, 0, 2000, { usablePoint: false });
    expect(feed(health, 2100, 4000).state).toBe("RECOVERING");
    expect(health.record(frame(4100, { usablePoint: false })).state).toBe("DEGRADED");
    expect(feed(health, 4200, 4600).state).toBe("RECOVERING");
    expect(feed(health, 4700, 5800).state).toBe("HEALTHY");
  });
  it("discards temporal evidence on exact source or processing-context changes", () => {
    const health = new ReachCaptureHealth();
    feed(health, 0, 2000, { usablePoint: false });
    expect(health.record(frame(2100, { context: "camera-a/aid-trial" })).evidenceMs).toBe(0);
    expect(
      health.record(frame(2200, { context: "camera-a/aid-trial", sourceBinding: "camera-lease-b/geometry-1" }))
        .evidenceMs,
    ).toBe(0);
  });
  it("rejects reversed clocks, invalid quality and policies that count long gaps as continuous evidence", () => {
    const health = new ReachCaptureHealth();
    health.record(frame(100));
    expect(() => health.record(frame(100))).toThrow("REORDERED");
    expect(() => health.record(frame(200, { receivedMs: 199 }))).toThrow("INVALID");
    expect(() => health.diagnose(119)).toThrow("REVERSED");
    expect(() =>
      health.record(
        frame(200, { imageSignal: { scope: "SUBJECT_REGION", meanLuminance: NaN, luminanceDeviation: 0, detail: 0 } }),
      ),
    ).toThrow("INVALID");
    expect(
      reachCaptureHealthPolicySchema.safeParse({ ...defaultReachCaptureHealthPolicy, maximumEvidenceGapMs: 1000 })
        .success,
    ).toBe(false);
  });
});
