// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { ReachTrackingPacer, reachTrackingPacingPolicy } from "./tracking-pacer";

describe("adaptive local tracking pacing", () => {
  it("starts up to 60Hz and never queues a capture before the current interval", () => {
    const pacer = new ReachTrackingPacer();
    expect(pacer.targetHz).toBeCloseTo(60);
    expect(pacer.nextDelay(0, -Infinity)).toBe(0);
    expect(pacer.nextDelay(100, 100)).toBe(17);
    pacer.recordCompleted(100, 105, 1);
    expect(pacer.nextDelay(105, 100)).toBe(12);
    expect(pacer.nextDelay(117, 100)).toBe(0);
  });

  it("holds lightweight steady work near the foreground ceiling", () => {
    const pacer = new ReachTrackingPacer();
    for (let at = 0; at < 1000; at += 17) {
      pacer.recordTimerLateness(at, at + 0.5);
      pacer.recordCompleted(at, at + 4, 1);
    }
    expect(pacer.targetHz).toBeCloseTo(60);
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
      expect(pacer.targetHz).toBeLessThanOrEqual(60);
      previous = pacer.intervalMs;
    }
    expect(pacer.targetHz).toBeCloseTo(60);
  });

  it("responds to event-loop duress even when inference itself is cheap", () => {
    const pacer = new ReachTrackingPacer();
    pacer.recordCompleted(0, 4, 1);
    pacer.recordTimerLateness(20, 70);
    expect(pacer.intervalMs).toBeGreaterThanOrEqual(1000 / 60 + (50 - 2) * 2);
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
      expect(pacer.targetHz).toBeCloseTo(60);
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
    expect(pacer.targetHz).toBeCloseTo(60);
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
      expect(interval).toBeGreaterThanOrEqual(1000 / 60);
      expect(total / interval).toBeLessThanOrEqual(reachTrackingPacingPolicy.maximumProcessingDuty + 1e-9);
      expect(main / interval).toBeLessThanOrEqual(0.3 + 1e-9);
      capture = next;
    }
  });
});
