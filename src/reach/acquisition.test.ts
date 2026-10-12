// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { expect, it } from "vitest";
import { SampleWindow } from "./sample-window";
import { calibrationGroups, syntheticBinding } from "./foundation-scenarios";
import {
  calibratedPoint,
  calibrationLayout,
  fitCalibration,
  fitRelativeCalibration,
  relativeLayout,
  validateCalibration,
} from "./calibration";
import { containedFrame } from "./visualization";
const target = { x: 0.5, y: 0.5 };
const features = [1, 0.5, 0.5, 0.1, -0.7];
it("accumulates natural noise across a brief dropout without counting loss as evidence", () => {
  const window = new SampleWindow(syntheticBinding, target);
  for (let i = 0; i < 8; i++)
    window.push(
      features.map((v, j) => v + (j === 0 ? 0 : Math.sin(i * 2.7) * (j < 3 ? 0.004 : 0.015))),
      100 + i * 50,
      syntheticBinding,
    );
  expect(window.pause(500).state).toBe("PAUSED");
  let final;
  for (let i = 0; i < 12; i++) final = window.push(features, 600 + i * 50, syntheticBinding);
  expect(final!.state).toBe("ACCEPTED");
  expect(final!.samples!.length).toBeGreaterThanOrEqual(15);
});
it("rejects an isolated outlier while retaining trustworthy samples", () => {
  const window = new SampleWindow(syntheticBinding, target);
  for (let i = 0; i < 8; i++) window.push(features, 100 + i * 50, syntheticBinding);
  expect(window.push([1, 0.8, 0.2, 0.5, -1], 500, syntheticBinding).state).toBe("MOVING");
  let final;
  for (let i = 0; i < 10; i++) final = window.push(features, 550 + i * 50, syntheticBinding);
  expect(final!.samples).not.toBeNull();
  expect(final!.rejected).toBe(1);
  expect(final!.samples!.every((s) => s.features[1] === 0.5)).toBe(true);
});
it("expires a long loss and restarts only the current evidence window", () => {
  const window = new SampleWindow(syntheticBinding, target);
  for (let i = 0; i < 10; i++) window.push(features, 100 + i * 50, syntheticBinding);
  expect(window.pause(1000)).toMatchObject({ state: "EXPIRED", progress: 0 });
  expect(window.push(features, 1050, syntheticBinding)).toMatchObject({ state: "ACQUIRING", samples: null });
});
it.each(["trackGeneration", "providerGeneration", "viewportEpoch", "cameraFrameVersion"] as const)(
  "refuses to bridge %s changes",
  (key) => {
    const window = new SampleWindow(syntheticBinding, target);
    window.push(features, 100, syntheticBinding);
    expect(() => window.push(features, 150, { ...syntheticBinding, [key]: 2 })).toThrow("SAMPLE_CONTEXT_CHANGED");
  },
);
it("rejects NaNs, replayed timestamps and degenerate training coverage", () => {
  const window = new SampleWindow(syntheticBinding, target);
  window.push(features, 100, syntheticBinding);
  expect(() => window.push(features, 100, syntheticBinding)).toThrow();
  expect(() => window.push([1, NaN, 0.5, 0.1, -0.7], 150, syntheticBinding)).toThrow();
  const groups = calibrationGroups();
  for (const group of groups) for (const s of group) s.features = [...features];
  expect(() => fitCalibration(groups, syntheticBinding, 1000)).toThrow("CALIBRATION_INSUFFICIENT_COVERAGE");
});
it("qualifies relative movement separately and cannot pass the absolute pointing claim", () => {
  const c = fitRelativeCalibration(calibrationGroups(relativeLayout.training), syntheticBinding, 1000);
  expect(c.mapping).toBe("RELATIVE_DISPLACEMENT_V1");
  expect(c.status).toBe("VALIDATION_REQUIRED");
  const checked = validateCalibration(c, calibrationGroups(calibrationLayout.validation));
  expect(checked.status).toBe("VALIDATED");
  expect(calibratedPoint(checked, features, syntheticBinding, 1100)).not.toBeNull();
  expect(validateCalibration(c, calibrationGroups(calibrationLayout.validation, 0.15)).status).toBe("FAILED");
  const short = calibrationGroups(relativeLayout.training);
  for (const group of short)
    for (const s of group) {
      s.features[1] = 0.5;
      s.features[2] = 0.5;
    }
  expect(() => fitRelativeCalibration(short, syntheticBinding, 1000)).toThrow("RELATIVE_MOVEMENT_TOO_SMALL");
});
it("keeps camera overlay registration correct across letterboxing and scaling", () => {
  const wide = containedFrame(800, 400, 640, 480);
  expect(wide.width).toBeCloseTo(1600 / 3);
  expect(wide.x).toBeCloseTo(400 / 3);
  expect(wide.height).toBe(400);
  expect(wide.y).toBe(0);
  const portrait = containedFrame(300, 500, 640, 480);
  expect(portrait).toEqual({ width: 300, height: 225, x: 0, y: 137.5 });
});
