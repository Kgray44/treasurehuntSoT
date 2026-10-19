// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { expect, it } from "vitest";
import { calibrationLayout, fitCalibration, validateCalibration } from "./calibration";
import { calibrationGroups, syntheticBinding } from "./foundation-scenarios";

it("explains an accuracy failure even when the independently checked holds were steady", () => {
  const fitted = fitCalibration(calibrationGroups(), syntheticBinding, 1000);
  expect(fitted.validationSummary).toBeUndefined();
  expect(fitted.status).toBe("VALIDATION_REQUIRED");
  const checked = validateCalibration(fitted, calibrationGroups(calibrationLayout.validation, 0.15));
  expect(checked.status).toBe("FAILED");
  expect(checked.validationSummary).toMatchObject({
    reason: "HELD_OUT_ERROR_EXCEEDS_LIMIT",
    p95DiagonalFraction: checked.validationP95,
    p95LimitDiagonalFraction: 0.03,
    maximumErrorDiagonalFraction: Math.max(...checked.validationErrors),
    jitterP95DiagonalFraction: checked.validationJitterP95,
    jitterLimitDiagonalFraction: null,
    maximumErrorLimitDiagonalFraction: null,
    targetCount: 5,
    sampleCount: 80,
  });
  expect(checked.validationSummary!.p95DiagonalFraction).toBeGreaterThan(0.03);
  expect(checked.validationSummary!.jitterP95DiagonalFraction).toBeCloseTo(0, 10);
  expect(calibrationLayout.validation).toContainEqual(checked.validationSummary!.worstTarget.target);
  expect(fitted.status).toBe("VALIDATION_REQUIRED");
  expect(fitted.validationSummary).toBeUndefined();
});
it.each([
  [0, "VALIDATED", "ACCURACY_REQUIREMENT_MET"],
  [0.02, "VALIDATED", "ACCURACY_REQUIREMENT_MET"],
  [0.04, "FAILED", "HELD_OUT_ERROR_EXCEEDS_LIMIT"],
] as const)("preserves the established 3 percent heldout outcome for a %s bias", (bias, status, reason) => {
  const fitted = fitCalibration(calibrationGroups(), syntheticBinding, 1000);
  const checked = validateCalibration(fitted, calibrationGroups(calibrationLayout.validation, bias));
  expect(checked.status).toBe(status);
  expect(checked.status === "VALIDATED").toBe(checked.validationP95! <= 0.03);
  expect(checked.validationSummary?.reason).toBe(reason);
  expect(checked.validationSummary?.maximumErrorDiagonalFraction).toBeGreaterThanOrEqual(checked.validationP95!);
});
it("keeps incomplete evidence and target leakage distinct from a completed accuracy failure", () => {
  const fitted = fitCalibration(calibrationGroups(), syntheticBinding, 1000);
  expect(() => validateCalibration(fitted, calibrationGroups(calibrationLayout.validation.slice(0, 4)))).toThrow(
    "CALIBRATION_VALIDATION_INCOMPLETE",
  );
  expect(() => validateCalibration(fitted, calibrationGroups(calibrationLayout.training.slice(0, 5)))).toThrow(
    "CALIBRATION_VALIDATION_LEAKAGE",
  );
  expect(fitted.status).toBe("VALIDATION_REQUIRED");
  expect(fitted.validationSummary).toBeUndefined();
});
