// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import {
  calibratedPoint,
  calibrationLayout,
  estimatedPoint,
  fitCalibration,
  fitRelativeCalibration,
  isCurrentCalibration,
  REACH_ABSOLUTE_MAPPING,
  REACH_RELATIVE_MAPPING,
  validateCalibration,
  type Calibration,
  type CalibrationBinding,
} from "./calibration";
import {
  pointingFeatures,
  REACH_ASSOCIATION_BASIS,
  REACH_FEATURE_PROFILE,
  REACH_RELATIVE_ASSOCIATION_BASIS,
  REACH_RELATIVE_FEATURE_PROFILE,
  relativeIndexFeatures,
} from "./coordinates";
import {
  calibrationGroups,
  relativeCalibrationGroups,
  syntheticBinding,
  syntheticRelativeBinding,
} from "./foundation-scenarios";
import { SampleWindow } from "./sample-window";
import { syntheticObservation } from "./synthetic";

const checkedAbsolute = () =>
  validateCalibration(
    fitCalibration(calibrationGroups(), syntheticBinding, 1000),
    calibrationGroups(calibrationLayout.validation),
  );
function incompatibleBinding(kind: string): CalibrationBinding {
  const binding: Record<string, unknown> = { ...syntheticBinding };
  if (kind === "missing profile") delete binding.featureProfile;
  if (kind === "missing basis") delete binding.associationBasis;
  if (kind === "legacy profile") binding.featureProfile = "INDEX_PALM_AXIS_V2";
  if (kind === "legacy basis") binding.associationBasis = "PALM_KNUCKLES_V1";
  if (kind === "mixed image profile") binding.featureProfile = REACH_RELATIVE_FEATURE_PROFILE;
  if (kind === "mixed image basis") binding.associationBasis = REACH_RELATIVE_ASSOCIATION_BASIS;
  return binding as unknown as CalibrationBinding;
}

describe("index-tip feature and calibration source contract", () => {
  it("uses the observed tip and self-normalized index chord without any palm coordinates", () => {
    const observation = syntheticObservation({ x: 0.5, y: 0.5 }, 0, 100);
    const hand = observation.hands[0];
    const full = pointingFeatures(hand, observation);
    expect(full).toEqual([1, hand.landmarks[8].x, hand.landmarks[8].y, 0, -1 / 0.75]);
    for (let i = 0; i < 21; i++) if (![5, 6, 7, 8].includes(i)) hand.landmarks[i] = { x: 0, y: 0, z: 0, valid: false };
    expect(pointingFeatures(hand, observation)).toEqual(full);
    for (const i of [5, 6, 7, 8]) {
      hand.landmarks[i].x += 0.02;
      hand.landmarks[i].y += 0.03;
    }
    const moved = pointingFeatures(hand, observation);
    expect(moved[1]).toBeCloseTo(full[1] + 0.02);
    expect(moved[2]).toBeCloseTo(full[2] + 0.03);
    expect(moved.slice(3)).toEqual(full.slice(3));
  });

  it("creates separate current mappings and requires a fresh independent check", () => {
    const absolute = fitCalibration(calibrationGroups(), syntheticBinding, 1000);
    const relative = fitRelativeCalibration(relativeCalibrationGroups(), syntheticRelativeBinding, 1000);
    expect(absolute.mapping).toBe(REACH_ABSOLUTE_MAPPING);
    expect(relative.mapping).toBe(REACH_RELATIVE_MAPPING);
    expect(absolute.binding).toMatchObject({
      featureProfile: REACH_FEATURE_PROFILE,
      associationBasis: REACH_ASSOCIATION_BASIS,
    });
    expect(relative.binding).toMatchObject({
      featureProfile: REACH_RELATIVE_FEATURE_PROFILE,
      associationBasis: REACH_RELATIVE_ASSOCIATION_BASIS,
    });
    for (const calibration of [absolute, relative]) {
      expect(calibration.status).toBe("VALIDATION_REQUIRED");
      expect(calibration.validationErrors).toEqual([]);
      expect(isCurrentCalibration(calibration)).toBe(true);
    }
  });

  it("uses only bounded observed image-tip coordinates for relative features", () => {
    expect(relativeIndexFeatures({ x: 0.2, y: 0.8 })).toEqual([1, 0.2, 0.8, 0, 0]);
    expect(relativeIndexFeatures({ x: 0, y: 1 })).toEqual([1, 0, 1, 0, 0]);
    for (const point of [
      { x: NaN, y: 0.5 },
      { x: 0.5, y: Infinity },
      { x: -0.001, y: 0.5 },
      { x: 0.5, y: 1.001 },
    ])
      expect(() => relativeIndexFeatures(point)).toThrow("INDEX_IMAGE_POINT_INVALID");
  });

  it.each([
    "missing profile",
    "missing basis",
    "legacy profile",
    "legacy basis",
    "mixed image profile",
    "mixed image basis",
  ])("refuses %s at fit, collection, validation and estimate boundaries", (kind) => {
    const invalid = incompatibleBinding(kind);
    expect(() => fitCalibration(calibrationGroups(), invalid, 1000)).toThrow("REACH_FEATURE_PROFILE_MISMATCH");
    expect(() => fitRelativeCalibration(relativeCalibrationGroups(), invalid, 1000)).toThrow(
      "REACH_FEATURE_PROFILE_MISMATCH",
    );
    expect(() => new SampleWindow(invalid, { x: 0.5, y: 0.5 })).toThrow("REACH_FEATURE_PROFILE_MISMATCH");
    const window = new SampleWindow(syntheticBinding, { x: 0.5, y: 0.5 });
    expect(() => window.push([1, 0.5, 0.5, 0, -1], 100, invalid)).toThrow("REACH_FEATURE_PROFILE_MISMATCH");
    const checked = checkedAbsolute();
    const old = { ...checked, binding: invalid };
    expect(() => validateCalibration(old, calibrationGroups(calibrationLayout.validation))).toThrow(
      "REACH_FEATURE_PROFILE_MISMATCH",
    );
    expect(calibratedPoint(old, [1, 0.5, 0.5, 0, -1], syntheticBinding, 1100)).toBeNull();
    expect(calibratedPoint(checked, [1, 0.5, 0.5, 0, -1], invalid, 1100)).toBeNull();
    expect(estimatedPoint(old, syntheticObservation({ x: 0.5, y: 0.5 }, 0, 1100), syntheticBinding, 1101)).toBeNull();
  });

  it("never mixes image-relative and model-index feature families or sources", () => {
    expect(() => fitCalibration(calibrationGroups(), syntheticRelativeBinding, 1000)).toThrow(
      "REACH_FEATURE_PROFILE_MISMATCH",
    );
    expect(() => fitRelativeCalibration(relativeCalibrationGroups(), syntheticBinding, 1000)).toThrow(
      "REACH_FEATURE_PROFILE_MISMATCH",
    );
    const absolute = checkedAbsolute();
    const relative = validateCalibration(
      fitRelativeCalibration(relativeCalibrationGroups(), syntheticRelativeBinding, 1000),
      relativeCalibrationGroups(calibrationLayout.validation),
    );
    for (const mismatched of [
      { ...absolute, binding: syntheticRelativeBinding },
      { ...relative, binding: syntheticBinding },
    ]) {
      expect(isCurrentCalibration(mismatched)).toBe(false);
      expect(() => validateCalibration(mismatched, relativeCalibrationGroups(calibrationLayout.validation))).toThrow(
        "CALIBRATION_MAPPING_UNSUPPORTED",
      );
      expect(calibratedPoint(mismatched, [1, 0.5, 0.5, 0, 0], mismatched.binding, 1100)).toBeNull();
    }
    expect(calibratedPoint(relative, [1, 0.5, 0.5, 0, 0], syntheticBinding, 1100)).toBeNull();
    expect(calibratedPoint(absolute, [1, 0.5, 0.5, 0, -1 / 0.75], syntheticRelativeBinding, 1100)).toBeNull();
    const model = syntheticObservation({ x: 0.5, y: 0.5 }, 0, 1100);
    Object.assign(model, syntheticRelativeBinding);
    model.hands[0].trackId = syntheticRelativeBinding.trackId;
    expect(estimatedPoint(relative, model, syntheticRelativeBinding, 1101)).toBeNull();
  });

  it("keeps sample collection bound to its selected source family", () => {
    const target = { x: 0.5, y: 0.5 };
    expect(() => new SampleWindow(syntheticRelativeBinding, target, "ABSOLUTE")).toThrow(
      "REACH_FEATURE_PROFILE_MISMATCH",
    );
    expect(() => new SampleWindow(syntheticBinding, target, "RELATIVE")).toThrow("REACH_FEATURE_PROFILE_MISMATCH");
    const window = new SampleWindow(syntheticRelativeBinding, target, "RELATIVE");
    expect(window.push(relativeIndexFeatures(target), 100, syntheticRelativeBinding).state).toBe("ACQUIRING");
    expect(() => window.push(relativeIndexFeatures(target), 150, syntheticBinding)).toThrow(
      "REACH_FEATURE_PROFILE_MISMATCH",
    );
  });

  it("requires fresh calibration rather than upgrading the former image-only profile", () => {
    const former = {
      ...syntheticRelativeBinding,
      featureProfile: "INDEX_TIP_IMAGE_V1",
      associationBasis: "INDEX_IMAGE_TRACK_V1",
    } as unknown as CalibrationBinding;
    expect(() => fitRelativeCalibration(relativeCalibrationGroups(), former, 1000)).toThrow(
      "REACH_FEATURE_PROFILE_MISMATCH",
    );
    expect(() => new SampleWindow(former, { x: 0.5, y: 0.5 }, "RELATIVE")).toThrow("REACH_FEATURE_PROFILE_MISMATCH");
    const checked = validateCalibration(
      fitRelativeCalibration(relativeCalibrationGroups(), syntheticRelativeBinding, 1000),
      relativeCalibrationGroups(calibrationLayout.validation),
    );
    const old = { ...checked, binding: former };
    expect(isCurrentCalibration(old)).toBe(false);
    expect(() => validateCalibration(old, relativeCalibrationGroups(calibrationLayout.validation))).toThrow(
      "REACH_FEATURE_PROFILE_MISMATCH",
    );
    expect(calibratedPoint(old, relativeIndexFeatures({ x: 0.5, y: 0.5 }), former, 1100)).toBeNull();
  });

  it("preserves every image-relative source/context binding and fit expiration", () => {
    const checked = validateCalibration(
      fitRelativeCalibration(relativeCalibrationGroups(), syntheticRelativeBinding, 1000),
      relativeCalibrationGroups(calibrationLayout.validation),
    );
    const features = relativeIndexFeatures({ x: 0.5, y: 0.5 });
    expect(calibratedPoint(checked, features, syntheticRelativeBinding, 1100)).not.toBeNull();
    const changes = {
      providerId: "other-image-provider",
      modelDigest: "c".repeat(64),
      providerGeneration: 2,
      cameraLeaseId: "other-camera",
      cameraFrameVersion: 2,
      viewportEpoch: 2,
      viewportWidth: 1200,
      viewportHeight: 800,
      mirror: true,
      orientation: 90,
      trackId: "other-image-track",
      trackGeneration: 2,
      evidenceTier: "UNQUALIFIED",
    };
    for (const [key, value] of Object.entries(changes))
      expect(calibratedPoint(checked, features, { ...syntheticRelativeBinding, [key]: value }, 1100)).toBeNull();
    expect(calibratedPoint(checked, features, syntheticRelativeBinding, checked.expiresAt)).toBeNull();
    expect(calibratedPoint(checked, features, syntheticRelativeBinding, checked.createdAt - 1)).toBeNull();
  });

  it.each(["INDEX_AXIS_RIDGE_V2", "RELATIVE_DISPLACEMENT_V1", "UNKNOWN_MAPPING"])(
    "never reinterprets an old or unknown mapping as current index-tip features: %s",
    (mapping) => {
      const old = { ...checkedAbsolute(), mapping } as unknown as Calibration;
      expect(isCurrentCalibration(old)).toBe(false);
      expect(() => validateCalibration(old, calibrationGroups(calibrationLayout.validation))).toThrow(
        "CALIBRATION_MAPPING_UNSUPPORTED",
      );
      expect(calibratedPoint(old, [1, 0.5, 0.5, 0, -1], syntheticBinding, 1100)).toBeNull();
      expect(estimatedPoint(old, syntheticObservation({ x: 0.5, y: 0.5 }, 0, 1100), syntheticBinding, 1101)).toBeNull();
    },
  );

  it("rejects model-axis features at every image-relative boundary", () => {
    const fitted = fitRelativeCalibration(relativeCalibrationGroups(), syntheticRelativeBinding, 1000);
    const checked = validateCalibration(fitted, relativeCalibrationGroups(calibrationLayout.validation));
    for (const features of [
      [1, 0.5, 0.5, 0.6, 0],
      [1, 0.5, 0.5, 0, -0.6],
      [1, 0.5, 0.5, Number.EPSILON, 0],
      [0.99, 0.5, 0.5, 0, 0],
      [1, NaN, 0.5, 0, 0],
      [1, 0.5, 1.001, 0, 0],
    ]) {
      const window = new SampleWindow(syntheticRelativeBinding, { x: 0.5, y: 0.5 }, "RELATIVE");
      expect(() => window.push(features, 100, syntheticRelativeBinding)).toThrow("SAMPLE_INVALID_OR_REORDERED");
      const training = relativeCalibrationGroups();
      for (const sample of training[0]) sample.features = [...features];
      expect(() => fitRelativeCalibration(training, syntheticRelativeBinding, 1000)).toThrow(
        "RELATIVE_SETUP_INCOMPLETE",
      );
      const validation = relativeCalibrationGroups(calibrationLayout.validation);
      for (const sample of validation[0]) sample.features = [...features];
      expect(() => validateCalibration(fitted, validation)).toThrow("CALIBRATION_VALIDATION_INCOMPLETE");
      expect(calibratedPoint(checked, features, syntheticRelativeBinding, 1100)).toBeNull();
    }
  });

  it("retains the raw held-out 3 percent requirement for the new mappings", () => {
    const absolute = fitCalibration(calibrationGroups(), syntheticBinding, 1000);
    const relative = fitRelativeCalibration(relativeCalibrationGroups(), syntheticRelativeBinding, 1000);
    for (const [fitted, groups] of [
      [absolute, calibrationGroups],
      [relative, relativeCalibrationGroups],
    ] as const) {
      const passed = validateCalibration(fitted, groups(calibrationLayout.validation, 0.02));
      const failed = validateCalibration(fitted, groups(calibrationLayout.validation, 0.04));
      expect(passed.status).toBe("VALIDATED");
      expect(failed.status).toBe("FAILED");
      expect(failed.validationSummary?.p95LimitDiagonalFraction).toBe(0.03);
      expect(failed.validationP95).toBeGreaterThan(0.03);
    }
  });
});
