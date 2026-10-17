// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { SampleWindow } from "./sample-window";
import {
  calibrationLayout,
  fitCalibration,
  sampleEvidenceDuration,
  stableSamples,
  validateCalibration,
  type CalibrationSample,
} from "./calibration";
import { calibrationGroups, syntheticBinding } from "./foundation-scenarios";
const target = { x: 0.5, y: 0.5 };
const features = [1, 0.5, 0.5, 0.1, -0.7];
const shifted = [1, 0.58, 0.45, 0.4, -0.5];
function seed(window: SampleWindow, count = 8) {
  let result;
  for (let i = 0; i < count; i++) result = window.push(features, 100 + i * 50, syntheticBinding);
  return result!;
}
describe("source-bound calibration evidence recovery", () => {
  it("freezes partial progress through a 900ms interruption and resumes the same stable hold", () => {
    const window = new SampleWindow(syntheticBinding, target);
    const before = seed(window);
    expect(window.pause(500)).toMatchObject({ state: "PAUSED", progress: before.progress });
    expect(window.pause(1300)).toMatchObject({ state: "PAUSED", progress: before.progress });
    const resumed = window.push(features, 1350, syntheticBinding);
    expect(resumed.progress).toBeCloseTo(350 / 600);
    let result = resumed;
    for (let i = 1; i <= 6; i++) result = window.push(features, 1350 + i * 50, syntheticBinding);
    expect(result.state).toBe("ACCEPTED");
    expect(result.samples).toHaveLength(15);
    expect(result.samples![0].at).toBe(100);
    expect(result.samples![8]).toMatchObject({ at: 1350, continuitySegment: 1 });
    expect(sampleEvidenceDuration(result.samples!)).toBe(650);
  });
  it("does not turn a pause into 600ms of evidence even with fifteen rapid observations", () => {
    const window = new SampleWindow(syntheticBinding, target);
    for (let i = 0; i < 8; i++) window.push(features, 100 + i * 10, syntheticBinding);
    const before = window.pause(200);
    let result = before;
    for (let i = 0; i < 7; i++) result = window.push(features, 1200 + i * 10, syntheticBinding);
    expect(result.samples).toBeNull();
    expect(result.progress).toBeCloseTo(130 / 600);
    expect(result.progress).toBeGreaterThan(before.progress);
  });
  it("keeps capture-time ordering separate from a later watchdog pause clock", () => {
    const window = new SampleWindow(syntheticBinding, target);
    seed(window);
    window.pause(600);
    // A fresh delivered frame can have been captured before the watchdog ran.
    expect(window.push(features, 550, syntheticBinding)).toMatchObject({ state: "COLLECTING", samples: null });
    expect(() => window.push(features, 550, syntheticBinding)).toThrow("SAMPLE_INVALID_OR_REORDERED");
  });
  it("retains useful evidence through three bad frames and never includes their features or elapsed time", () => {
    const window = new SampleWindow(syntheticBinding, target);
    const before = seed(window);
    for (const at of [500, 550, 600])
      expect(window.push(shifted, at, syntheticBinding)).toMatchObject({ state: "MOVING", progress: before.progress });
    let result = window.push(features, 650, syntheticBinding);
    for (let i = 1; i <= 6; i++) result = window.push(features, 650 + i * 50, syntheticBinding);
    expect(result.state).toBe("ACCEPTED");
    expect(result.rejected).toBe(3);
    expect(result.samples![0].at).toBe(100);
    expect(result.samples!.every((s) => s.features[1] === 0.5)).toBe(true);
    expect(sampleEvidenceDuration(result.samples!)).toBe(650);
  });
  it("uses a coherent sustained replacement hold without mixing two different target poses", () => {
    const window = new SampleWindow(syntheticBinding, target);
    seed(window);
    let result;
    for (let i = 0; i < 9; i++) result = window.push(shifted, 500 + i * 50, syntheticBinding);
    expect(result!.state).toBe("MOVING");
    result = window.push(shifted, 950, syntheticBinding);
    expect(result.state).toBe("COLLECTING");
    for (let i = 10; i < 15; i++) result = window.push(shifted, 500 + i * 50, syntheticBinding);
    expect(result.state).toBe("ACCEPTED");
    expect(result.samples).toHaveLength(15);
    expect(result.samples!.every((s) => s.features[1] === shifted[1])).toBe(true);
    expect(result.samples![0].at).toBe(500);
  });
  it("cannot turn a sequence of unstable outliers into a replacement hold", () => {
    const window = new SampleWindow(syntheticBinding, target);
    const before = seed(window);
    for (let i = 0; i < 20; i++) {
      const unstable = [...shifted];
      unstable[1] += i % 2 ? 0.1 : -0.1;
      expect(window.push(unstable, 500 + i * 50, syntheticBinding)).toMatchObject({
        state: "MOVING",
        progress: before.progress,
        samples: null,
      });
    }
  });
  it("expires only the current stale window and keeps timestamp and binding protection after reset", () => {
    const window = new SampleWindow(syntheticBinding, target);
    seed(window);
    expect(window.pause(2950).state).toBe("PAUSED");
    expect(window.pause(2951)).toMatchObject({ state: "EXPIRED", progress: 0 });
    expect(() => window.push(features, 450, syntheticBinding)).toThrow("SAMPLE_INVALID_OR_REORDERED");
    expect(() => window.push(features, 3000, { ...syntheticBinding, trackGeneration: 2 })).toThrow(
      "SAMPLE_CONTEXT_CHANGED",
    );
    expect(window.push(features, 3000, syntheticBinding)).toMatchObject({ state: "ACQUIRING", progress: 0 });
    expect(() => window.pause(2999)).toThrow("SAMPLE_CLOCK_INVALID");
    window.reset();
    expect(() => window.push(features, 3000, syntheticBinding)).toThrow("SAMPLE_INVALID_OR_REORDERED");
  });
  it("preserves independent validation and the established 3 percent error limit", () => {
    const calibration = fitCalibration(calibrationGroups(), syntheticBinding, 1000);
    expect(calibration.mapping).toBe("INDEX_TIP_AXIS_RIDGE_V1");
    expect(calibration.status).toBe("VALIDATION_REQUIRED");
    expect(validateCalibration(calibration, calibrationGroups(calibrationLayout.validation, 0.15)).status).toBe(
      "FAILED",
    );
    expect(() => validateCalibration(calibration, calibrationGroups(calibrationLayout.training.slice(0, 5)))).toThrow(
      "CALIBRATION_VALIDATION_LEAKAGE",
    );
  });
});
describe("segmented evidence invariants", () => {
  const group = (): CalibrationSample[] =>
    Array.from({ length: 15 }, (_, i) => ({
      target,
      features: [...features],
      at: 100 + i * 50 + (i >= 8 ? 1000 : 0),
      continuitySegment: i < 8 ? 0 : 1,
    }));
  it("requires explicit segment boundaries and a bounded recovery rather than silently bridging missing observations", () => {
    expect(stableSamples(group())).toBe(true);
    expect(stableSamples(group().map(({ target, features, at }) => ({ target, features, at })))).toBe(false);
    const oversized = group();
    for (const sample of oversized.slice(8)) sample.at += 1501;
    expect(stableSamples(oversized)).toBe(false);
    const inconsistent = group();
    inconsistent[8].continuitySegment = 2;
    expect(stableSamples(inconsistent)).toBe(false);
    const mixed = group();
    delete mixed[8].continuitySegment;
    expect(stableSamples(mixed)).toBe(false);
  });
  it("still requires fifteen samples, 600ms of observed evidence and the original spread", () => {
    expect(stableSamples(group().slice(1))).toBe(false);
    const tooShort = group();
    for (let i = 1; i < tooShort.length; i++) tooShort[i].at = tooShort[0].at + i * 10 + (i >= 8 ? 1000 : 0);
    expect(stableSamples(tooShort)).toBe(false);
    const moved = group();
    moved[14].features[1] += 0.021;
    expect(stableSamples(moved)).toBe(false);
    const oversizedWall = Array.from({ length: 30 }, (_, i) => ({
      target,
      features: [...features],
      at: 100 + i * 200,
      continuitySegment: 0,
    }));
    expect(stableSamples(oversizedWall)).toBe(false);
  });
});
