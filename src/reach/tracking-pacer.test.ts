// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { ReachTrackingPacer, reachTrackingPacingPolicy, type ReachTrackingLimits } from "./tracking-pacer";

describe("adaptive local tracking pacing", () => {
  it("bounds the shared capture/inference loop by the lower model and phase ceilings", () => {
    const pacer = new ReachTrackingPacer();
    pacer.setTrackingLimits({
      normalMaximumHz: 15,
      calibrationMaximumHz: 60,
      unfocusedMaximumHz: 8,
      modelMaximumHz: 10,
    });
    expect(pacer.diagnostics).toMatchObject({ phaseCaptureMaximumHz: 15, modelMaximumHz: 10, maximumHz: 10 });
    pacer.setCalibrationCollecting(true);
    expect(pacer.diagnostics).toMatchObject({ phaseCaptureMaximumHz: 60, maximumHz: 10 });
    expect(pacer.nextDelay(0, 0)).toBe(100);
    pacer.setFocused(false);
    expect(pacer.diagnostics).toMatchObject({ phaseCaptureMaximumHz: 8, maximumHz: 8 });
  });
  it("applies validated administrative ceilings to each phase and focus without changing safety budgets", () => {
    const pacer = new ReachTrackingPacer();
    pacer.setTrackingLimits({
      modelMaximumHz: 60,
      normalMaximumHz: 5,
      calibrationMaximumHz: 10,
      unfocusedMaximumHz: 2,
    });
    expect(pacer.maximumHz).toBe(5);
    expect(pacer.nextDelay(0, 0)).toBe(200);
    pacer.setCalibrationCollecting(true);
    expect(pacer.maximumHz).toBe(10);
    expect(pacer.nextDelay(0, 0)).toBe(100);
    pacer.setFocused(false);
    expect(pacer.maximumHz).toBe(2);
    expect(pacer.nextDelay(0, 0)).toBe(500);
    expect(pacer.diagnostics).toMatchObject({ mainThreadDutyLimit: 0.3, processingDutyLimit: 1 });
  });
  it("lowers administrative caps immediately but never raises measured speed without bounded recovery", () => {
    const pacer = new ReachTrackingPacer();
    pacer.recordCompleted(0, 5, 1);
    pacer.setTrackingLimits({
      modelMaximumHz: 60,
      normalMaximumHz: 5,
      calibrationMaximumHz: 10,
      unfocusedMaximumHz: 2,
    });
    expect(pacer.targetHz).toBe(5);
    pacer.setTrackingLimits({
      modelMaximumHz: 60,
      normalMaximumHz: 30,
      calibrationMaximumHz: 60,
      unfocusedMaximumHz: 8,
    });
    expect(pacer.maximumHz).toBe(30);
    expect(pacer.targetHz).toBe(5);
    pacer.recordCompleted(200, 205, 1);
    expect(pacer.intervalMs).toBeGreaterThanOrEqual(200 * 0.9);
    const changed = { modelMaximumHz: 60, normalMaximumHz: 10, calibrationMaximumHz: 20, unfocusedMaximumHz: 5 };
    pacer.setTrackingLimits(changed);
    changed.normalMaximumHz = 30;
    expect(pacer.maximumHz).toBe(10);
  });
  it.each([
    null,
    { normalMaximumHz: 15, calibrationMaximumHz: 60, unfocusedMaximumHz: 8 },
    { modelMaximumHz: 4, normalMaximumHz: 15, calibrationMaximumHz: 60, unfocusedMaximumHz: 8 },
    { modelMaximumHz: 61, normalMaximumHz: 15, calibrationMaximumHz: 60, unfocusedMaximumHz: 8 },
    { modelMaximumHz: 60, normalMaximumHz: 4, calibrationMaximumHz: 60, unfocusedMaximumHz: 4 },
    { modelMaximumHz: 60, normalMaximumHz: 31, calibrationMaximumHz: 60, unfocusedMaximumHz: 8 },
    { modelMaximumHz: 60, normalMaximumHz: 15, calibrationMaximumHz: 14, unfocusedMaximumHz: 8 },
    { modelMaximumHz: 60, normalMaximumHz: 5, calibrationMaximumHz: 60, unfocusedMaximumHz: 8 },
    { modelMaximumHz: 60, normalMaximumHz: 15, calibrationMaximumHz: 61, unfocusedMaximumHz: 8 },
    { modelMaximumHz: 60, normalMaximumHz: NaN, calibrationMaximumHz: 60, unfocusedMaximumHz: 8 },
    { modelMaximumHz: 60, normalMaximumHz: 15, calibrationMaximumHz: 60, unfocusedMaximumHz: 0 },
    { modelMaximumHz: 60, normalMaximumHz: 15, calibrationMaximumHz: 60, unfocusedMaximumHz: 8, featureEnabled: false },
  ])("rejects invalid administrative limits without changing pacing (%j)", (limits) => {
    const pacer = new ReachTrackingPacer();
    const before = pacer.diagnostics;
    expect(() => pacer.setTrackingLimits(limits as ReachTrackingLimits)).toThrow("REACH_TRACKING_LIMITS_INVALID");
    expect(pacer.diagnostics).toEqual(before);
  });
  it("starts up to 15Hz for normal tracking and never queues a capture before the current interval", () => {
    const pacer = new ReachTrackingPacer();
    expect(pacer.targetHz).toBeCloseTo(15);
    expect(pacer.diagnostics).toMatchObject({ calibrationCollecting: false, maximumHz: 15 });
    expect(pacer.nextDelay(0, -Infinity)).toBe(0);
    expect(pacer.nextDelay(100, 100)).toBe(67);
    pacer.recordCompleted(100, 105, 1);
    expect(pacer.nextDelay(105, 100)).toBe(62);
    expect(pacer.nextDelay(167, 100)).toBe(0);
  });

  it.each([false, true])("holds lightweight steady work at the phase ceiling (collecting=%s)", (collecting) => {
    const pacer = new ReachTrackingPacer();
    pacer.setCalibrationCollecting(collecting);
    for (let at = 0; at < 1000; at += 17) {
      pacer.recordTimerLateness(at, at + 0.5);
      pacer.recordCompleted(at, at + 4, 1);
    }
    expect(pacer.targetHz).toBeCloseTo(collecting ? 60 : 15);
    expect(pacer.diagnostics.smoothedTotalMs).toBe(4);
  });

  it("does not add idle time to a serialized slower worker completion", () => {
    const pacer = new ReachTrackingPacer();
    pacer.recordCompleted(0, 90, 3);
    expect(pacer.intervalMs).toBeGreaterThanOrEqual(90 / reachTrackingPacingPolicy.maximumProcessingDuty);
    expect(pacer.nextDelay(90, 0)).toBe(0);
    expect(pacer.targetHz).toBeCloseTo(1000 / 90);
  });

  it("bounds measured main-thread CV duty independently of worker speed", () => {
    const pacer = new ReachTrackingPacer();
    pacer.recordCompleted(0, 25, 20);
    expect(pacer.intervalMs).toBeGreaterThanOrEqual(20 / reachTrackingPacingPolicy.maximumMainThreadDuty);
    expect(20 / pacer.intervalMs).toBeLessThanOrEqual(0.3);
    expect(pacer.diagnostics.smoothedMainThreadMs).toBe(20);
  });

  it("reduces work immediately on a spike and increases speed by at most the bounded recovery step", () => {
    const pacer = new ReachTrackingPacer();
    pacer.recordCompleted(0, 100, 30);
    expect(pacer.intervalMs).toBeGreaterThanOrEqual(100);
    let previous = pacer.intervalMs;
    for (let i = 1; i <= 80; i++) {
      pacer.recordTimerLateness(i * 200, i * 200);
      pacer.recordCompleted(i * 200, i * 200 + 5, 1);
      expect(pacer.intervalMs).toBeGreaterThanOrEqual(previous * 0.9 - 1e-9);
      expect(pacer.targetHz).toBeLessThanOrEqual(15);
      previous = pacer.intervalMs;
    }
    expect(pacer.targetHz).toBeCloseTo(15);
  });

  it("responds to event-loop duress even when inference itself is cheap", () => {
    const pacer = new ReachTrackingPacer();
    pacer.recordCompleted(0, 4, 1);
    pacer.recordTimerLateness(20, 70);
    expect(pacer.intervalMs).toBeGreaterThanOrEqual(1000 / 15 + (50 - 2) * 2);
    expect(pacer.diagnostics.smoothedTimerLatenessMs).toBe(50);
    const stressed = pacer.intervalMs;
    pacer.recordTimerLateness(80, 80);
    expect(pacer.intervalMs).toBe(stressed);
    pacer.recordCompleted(200, 204, 1);
    expect(pacer.intervalMs).toBeGreaterThanOrEqual(stressed * 0.9);
  });

  it("caps a visible unfocused session at 8Hz and ramps back after focus returns", () => {
    const pacer = new ReachTrackingPacer();
    pacer.setFocused(false);
    expect(pacer.targetHz).toBe(8);
    expect(pacer.nextDelay(0, 0)).toBe(125);
    for (let i = 0; i < 3; i++) pacer.recordCompleted(i * 125, i * 125 + 4, 1);
    expect(pacer.targetHz).toBe(8);
    pacer.setFocused(true);
    expect(pacer.targetHz).toBe(8);
    pacer.recordCompleted(400, 404, 1);
    expect(pacer.intervalMs).toBeGreaterThanOrEqual(125 * 0.9);
    expect(pacer.targetHz).toBeGreaterThan(8);
    expect(pacer.targetHz).toBeLessThan(10);
  });

  it("can slow further than the unfocused ceiling when measured load requires it", () => {
    const pacer = new ReachTrackingPacer();
    pacer.setFocused(false);
    pacer.recordCompleted(0, 300, 100);
    expect(pacer.intervalMs).toBeGreaterThanOrEqual(100 / 0.3);
    expect(pacer.targetHz).toBeLessThan(8);
  });

  it("requires serialized completions and does not learn from duplicate or overlapping work", () => {
    const pacer = new ReachTrackingPacer();
    pacer.recordCompleted(100, 130, 5);
    const before = pacer.diagnostics;
    for (const timing of [
      [100, 140, 5],
      [120, 150, 5],
      [90, 140, 5],
    ])
      expect(() => pacer.recordCompleted(timing[0], timing[1], timing[2])).toThrow("REACH_PACER_CLOCK_INVALID");
    expect(pacer.diagnostics).toEqual(before);
    expect(() => pacer.recordCompleted(150, 160, 2)).not.toThrow();
  });

  it("rejects invalid timing data without poisoning subsequent scheduling", () => {
    const invalid = [
      [NaN, 20, 1],
      [0, Infinity, 1],
      [-1, 20, 1],
      [20, 10, 1],
      [0, 20, NaN],
      [0, 20, -1],
      [0, 20, 21],
    ];
    for (const timing of invalid) {
      const pacer = new ReachTrackingPacer();
      expect(() => pacer.recordCompleted(timing[0], timing[1], timing[2])).toThrow("REACH_PACER_CLOCK_INVALID");
      expect(pacer.targetHz).toBeCloseTo(15);
      expect(() => pacer.recordCompleted(0, 4, 1)).not.toThrow();
    }
    for (const timing of [
      [NaN, 0],
      [0, Infinity],
      [-1, 0],
      [0, -1],
    ])
      expect(() => new ReachTrackingPacer().recordTimerLateness(timing[0], timing[1])).toThrow(
        "REACH_PACER_CLOCK_INVALID",
      );
    for (const timing of [
      [NaN, 0],
      [0, Infinity],
      [-1, 0],
      [10, 11],
      [0, -2],
    ])
      expect(() => new ReachTrackingPacer().nextDelay(timing[0], timing[1])).toThrow("REACH_PACER_CLOCK_INVALID");
  });

  it("rejects overflowing duration calculations and treats an early timer as zero lateness", () => {
    const pacer = new ReachTrackingPacer();
    expect(() => pacer.recordCompleted(0, Number.MAX_VALUE, Number.MAX_VALUE)).toThrow("REACH_PACER_DURATION_INVALID");
    expect(() => pacer.recordTimerLateness(0, Number.MAX_VALUE)).toThrow("REACH_PACER_DURATION_INVALID");
    expect(pacer.targetHz).toBeCloseTo(15);
    pacer.recordTimerLateness(20, 19);
    expect(pacer.diagnostics.smoothedTimerLatenessMs).toBe(0);
  });

  it("keeps a serialized workload inside the measured duty limits through stress and recovery", () => {
    const pacer = new ReachTrackingPacer();
    let capture = 0;
    for (let i = 0; i < 100; i++) {
      const elapsed = i >= 20 && i < 40 ? 80 : 5;
      const main = i >= 60 && i < 70 ? 20 : 1;
      const total = Math.max(elapsed, main);
      const completed = capture + total;
      pacer.recordCompleted(capture, completed, main);
      const next = completed + pacer.nextDelay(completed, capture);
      const interval = next - capture;
      expect(next).toBeGreaterThanOrEqual(completed);
      expect(interval).toBeGreaterThanOrEqual(1000 / 15);
      expect(total / interval).toBeLessThanOrEqual(reachTrackingPacingPolicy.maximumProcessingDuty + 1e-9);
      expect(main / interval).toBeLessThanOrEqual(0.3 + 1e-9);
      capture = next;
    }
  });
  it("ramps up for active collection and immediately returns to the normal cap on pause or completion", () => {
    const pacer = new ReachTrackingPacer();
    pacer.recordCompleted(0, 4, 1);
    pacer.setCalibrationCollecting(true);
    expect(pacer.targetHz).toBeCloseTo(15);
    let previous = pacer.intervalMs;
    for (let at = 100; at <= 2000; at += 100) {
      pacer.recordCompleted(at, at + 4, 1);
      expect(pacer.intervalMs).toBeGreaterThanOrEqual(previous * 0.9 - 1e-9);
      previous = pacer.intervalMs;
    }
    expect(pacer.diagnostics).toMatchObject({ calibrationCollecting: true, maximumHz: 60 });
    expect(pacer.targetHz).toBeCloseTo(60);
    pacer.setCalibrationCollecting(false);
    expect(pacer.targetHz).toBeCloseTo(15);
    expect(pacer.nextDelay(2004, 2000)).toBe(63);
  });
  it("never uses the collection cap to bypass main-thread pressure, timer lateness or the unfocused cap", () => {
    const pacer = new ReachTrackingPacer();
    pacer.recordCompleted(0, 100, 30);
    pacer.recordTimerLateness(100, 150);
    const stressed = pacer.intervalMs;
    pacer.setCalibrationCollecting(true);
    expect(pacer.intervalMs).toBeGreaterThanOrEqual(stressed);
    pacer.setFocused(false);
    expect(pacer.maximumHz).toBe(8);
    expect(pacer.targetHz).toBeLessThanOrEqual(8);
    pacer.setCalibrationCollecting(false);
    pacer.setCalibrationCollecting(true);
    expect(pacer.targetHz).toBeLessThanOrEqual(8);
    pacer.setFocused(true);
    expect(pacer.intervalMs).toBeGreaterThanOrEqual(stressed);
  });
});
