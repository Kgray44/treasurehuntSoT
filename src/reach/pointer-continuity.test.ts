// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { expect, it } from "vitest";
import { PointerContinuity, outsideCalibratedRange } from "./pointer-continuity";
import { PointFilter } from "./coordinates";
import {
  calibratedPoint,
  fitRelativeCalibration,
  relativeLayout,
  validateCalibration,
  calibrationLayout,
} from "./calibration";
import { calibrationGroups, syntheticBinding } from "./foundation-scenarios";

it("keeps a distinctly last-seen display for at most 450ms, without inventing motion", () => {
  const memory = new PointerContinuity();
  memory.observe({ x: 0.4, y: 0.6 }, 100, "same-context");
  expect(memory.hold(300, "same-context")).toEqual({ point: { x: 0.4, y: 0.6 }, capturedAt: 100 });
  expect(memory.hold(550, "same-context")).not.toBeNull();
  expect(memory.hold(551, "same-context")).toBeNull();
  expect(memory.hold(552, "same-context")).toBeNull();
});
it("never carries display memory across context changes, clock reversal, invalid points or explicit reset", () => {
  for (const fault of ["CONTEXT", "CLOCK", "POINT", "RESET"]) {
    const memory = new PointerContinuity();
    memory.observe({ x: 0.4, y: 0.6 }, 100, "a");
    if (fault === "POINT") memory.observe({ x: NaN, y: 0.5 }, 120, "a");
    if (fault === "RESET") memory.reset();
    expect(memory.hold(fault === "CLOCK" ? 99 : 150, fault === "CONTEXT" ? "b" : "a")).toBeNull();
    expect(memory.hold(160, "a")).toBeNull();
  }
});
it("keeps a visible point and confirms a fresh large movement on the next coherent frame", () => {
  const filter = new PointFilter();
  filter.update({ x: 0.25, y: 0.25 }, 100);
  expect(filter.update({ x: 0.75, y: 0.25 }, 150)).toEqual({ x: 0.25, y: 0.25 });
  expect(filter.update({ x: 0.76, y: 0.25 }, 200)!.x).toBeGreaterThan(0.65);
  expect(filter.update({ x: 0.8, y: 0.2 }, 200)).toBeNull();
});
it("explains out-of-range tracking without making the calibrated pointer valid", () => {
  const c = validateCalibration(
    fitRelativeCalibration(calibrationGroups(relativeLayout.training), syntheticBinding, 1000),
    calibrationGroups(calibrationLayout.validation),
  );
  const features = [1, 1, 0.5, 0, 0];
  expect(outsideCalibratedRange(c, features)).toBe(true);
  expect(calibratedPoint(c, features, syntheticBinding, 1100)).toBeNull();
  expect(outsideCalibratedRange(c, [1, 0.5, 0.5, 0, 0])).toBe(false);
});
