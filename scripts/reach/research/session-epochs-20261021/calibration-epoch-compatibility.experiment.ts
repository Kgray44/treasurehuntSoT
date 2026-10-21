// Research only: explicitly invoked; not a unit.reach qualification.
import { describe, expect, it, vi } from "vitest";
import {
  calibratedPoint,
  calibrationLayout,
  fitCalibration,
  fitRelativeCalibration,
  relativeLayout,
  validateCalibration,
  type CalibrationBinding,
  type CalibrationSample,
} from "@/reach/calibration";
import { relativeIndexFeatures, REACH_RELATIVE_FEATURE_PROFILE } from "@/reach/coordinates";
import { calibrationGroups, syntheticBinding, syntheticRelativeBinding } from "@/reach/foundation-scenarios";
import { SampleWindow } from "@/reach/sample-window";
import {
  evaluateRelativeEpochCompatibility,
  type EpochCheckGroup,
  type RelativeEpochCompatibilityRequest,
} from "./calibration-epoch-compatibility";

const oldBinding = { ...syntheticRelativeBinding, trackId: "old-local", trackGeneration: 1 };
const newBinding = { ...oldBinding, trackId: "new-local", trackGeneration: 2 };
type Point = { x: number; y: number };
function collectedGroups(
  targets: readonly Point[],
  binding: CalibrationBinding,
  epochKey: string,
  start: number,
  transform: (p: Point) => Point = (p) => p,
  age = 5,
): EpochCheckGroup[] {
  return targets.map((target, group) => {
    const window = new SampleWindow(binding, target, "RELATIVE");
    const evidence: EpochCheckGroup["evidence"][number][] = [];
    let samples: CalibrationSample[] | null = null;
    for (let i = 0; i < 16; i++) {
      const capture = start + group * 800 + i * 50,
        collectedAt = capture + age;
      // The canonical collection owner checks original-pixel age BEFORE insertion.
      if (collectedAt < capture || collectedAt - capture > 150) throw new Error("FIXTURE_STALE_BEFORE_COLLECTION");
      samples = window.push(relativeIndexFeatures(transform(target)), capture, binding).samples;
      evidence.push({ capture, pixelOrigin: capture, collectedAt, sequence: group * 16 + i + 1 });
    }
    expect(samples).not.toBeNull();
    return { epochKey, binding, frameWidth: 640, frameHeight: 480, samples: samples!, evidence };
  });
}
function fixture(): RelativeEpochCompatibilityRequest {
  const training = collectedGroups(relativeLayout.training, oldBinding, "old", 1000);
  const fitted = fitRelativeCalibration(
    training.map((g) => [...g.samples]),
    oldBinding,
    6000,
  );
  const checks = collectedGroups(calibrationLayout.validation, oldBinding, "old", 7000);
  const calibration = validateCalibration(
    fitted,
    checks.map((g) => [...g.samples]),
  );
  return {
    calibration,
    previousEpoch: { epochKey: "old", binding: oldBinding, frameWidth: 640, frameHeight: 480 },
    previousEvidenceThroughCapture: 10950,
    epoch: { epochKey: "new", binding: newBinding, frameWidth: 640, frameHeight: 480, notBeforeCapture: 12000 },
    groups: collectedGroups(calibrationLayout.validation, newBinding, "new", 13000),
    now: 17000,
  };
}
const reason = (r: RelativeEpochCompatibilityRequest) => evaluateRelativeEpochCompatibility(r).reason;
function freezeDeep<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

describe("research-only frozen relative mapping across explicit local epochs", () => {
  it("checks equivalent fresh coordinates without rebinding or inheriting physical identity", () => {
    const r = fixture(),
      result = evaluateRelativeEpochCompatibility(r);
    expect(result).toMatchObject({
      kind: "RESEARCH_NUMERICAL_PROPOSAL",
      reason: "RAW_CHECKS_WITHIN_LIMIT",
      checkedTargetCount: 5,
      checkedSampleCount: 80,
    });
    expect(result.rawP95DiagonalFraction!).toBeLessThanOrEqual(0.03);
    expect(calibratedPoint(r.calibration, relativeIndexFeatures({ x: 0.5, y: 0.5 }), newBinding, r.now)).toBeNull();
    expect(Object.keys(result).sort()).toEqual([
      "checkedSampleCount",
      "checkedTargetCount",
      "kind",
      "rawP95DiagonalFraction",
      "reason",
    ]);
  });
  it("rejects a constant endpoint bias under unchanged camera metadata", () => {
    const r = fixture();
    r.groups = collectedGroups(calibrationLayout.validation, newBinding, "new", 13000, (p) => ({
      x: p.x + 0.08,
      y: p.y,
    }));
    expect(reason(r)).toBe("RAW_ERROR_LIMIT_EXCEEDED");
  });
  it("rejects changed displacement scale without fitting an alignment from checks", () => {
    const r = fixture();
    r.groups = collectedGroups(calibrationLayout.validation, newBinding, "new", 13000, (p) => ({
      x: 0.5 + (p.x - 0.5) * 1.2,
      y: 0.5 + (p.y - 0.5) * 1.2,
    }));
    expect(reason(r)).toBe("RAW_ERROR_LIMIT_EXCEEDED");
  });
  it("rejects rotated coordinates although their center is unchanged", () => {
    const r = fixture();
    r.groups = collectedGroups(calibrationLayout.validation, newBinding, "new", 13000, (p) => ({ x: 1 - p.y, y: p.x }));
    expect(reason(r)).toBe("RAW_ERROR_LIMIT_EXCEEDED");
  });
  it("rejects every source/view change and changed native dimensions", () => {
    for (const changed of [
      { providerId: "other" },
      { providerVersion: "other" },
      { modelDigest: "c".repeat(64) },
      { providerGeneration: 2 },
      { cameraLeaseId: "other" },
      { cameraFrameVersion: 2 },
      { viewportEpoch: 2 },
      { viewportWidth: 1200 },
      { viewportHeight: 800 },
      { mirror: true },
      { orientation: 90 },
      { evidenceTier: "UNQUALIFIED" as const },
    ]) {
      const r = fixture();
      r.epoch.binding = { ...newBinding, ...changed };
      expect(reason(r)).toBe("EPOCH_DOMAIN_MISMATCH");
    }
    for (const dimension of ["frameWidth", "frameHeight"] as const) {
      const r = fixture();
      r.epoch[dimension]++;
      expect(reason(r)).toBe("EPOCH_DOMAIN_MISMATCH");
    }
  });
  it("does not relabel the same local track or a duplicate epoch as a new domain", () => {
    const r = fixture();
    r.epoch.epochKey = "old";
    expect(reason(r)).toBe("EPOCH_DOMAIN_MISMATCH");
    r.epoch.epochKey = "new";
    r.epoch.binding = { ...oldBinding };
    expect(reason(r)).toBe("EPOCH_DOMAIN_MISMATCH");
  });
  it("retains original fit expiry and rejects a reversed proposal clock", () => {
    const r = fixture();
    r.now = r.calibration.expiresAt;
    expect(reason(r)).toBe("FIT_EXPIRED_OR_INVALID");
    r.now = r.calibration.createdAt - 1;
    expect(reason(r)).toBe("FIT_EXPIRED_OR_INVALID");
  });
  it("does not support absolute calibration or a substituted feature profile", () => {
    const r = fixture();
    r.calibration = fitCalibration(calibrationGroups(), syntheticBinding, 6000);
    expect(reason(r)).toBe("RELATIVE_MAPPING_REQUIRED");
    const next = fixture();
    next.epoch.binding = { ...newBinding, featureProfile: "INDEX_TIP_AXIS_V1" } as unknown as CalibrationBinding;
    expect(reason(next)).toBe("EPOCH_DOMAIN_MISMATCH");
  });
  it("rejects incomplete, unstable and duplicate checking targets through the canonical checker", () => {
    const r = fixture();
    r.groups = r.groups.slice(0, 4);
    expect(reason(r)).toBe("CHECKS_INCOMPLETE");
    const unstable = fixture();
    unstable.groups[0].samples[0].features[1] += 0.05;
    expect(reason(unstable)).toBe("CHECKS_INCOMPLETE");
    const duplicate = fixture();
    for (const sample of duplicate.groups[1].samples) sample.target = { ...calibrationLayout.validation[0] };
    expect(reason(duplicate)).toBe("CHECKS_INCOMPLETE");
  });
  it("rejects old or mixed epoch groups even when their coordinates happen to agree", () => {
    const r = fixture();
    r.groups[0].epochKey = "old";
    expect(reason(r)).toBe("CHECK_PROVENANCE_MISMATCH");
    const mixed = fixture();
    mixed.groups[2].binding = { ...oldBinding };
    expect(reason(mixed)).toBe("CHECK_PROVENANCE_MISMATCH");
  });
  it("rejects replayed old evidence, duplicate captures and reordered sequences", () => {
    const r = fixture();
    r.groups = collectedGroups(calibrationLayout.validation, newBinding, "new", 7000);
    expect(reason(r)).toBe("CHECK_CLOCKS_OR_FRESHNESS_INVALID");
    const duplicate = fixture();
    duplicate.groups[1].samples[0].at = duplicate.groups[0].samples.at(-1)!.at;
    duplicate.groups[1].evidence[0].capture = duplicate.groups[1].samples[0].at;
    expect(reason(duplicate)).toBe("CHECK_CLOCKS_OR_FRESHNESS_INVALID");
    const sequence = fixture();
    sequence.groups[1].evidence[0].sequence = 1;
    expect(reason(sequence)).toBe("CHECK_CLOCKS_OR_FRESHNESS_INVALID");
  });
  it("requires both capture and original pixels strictly after a cutoff disjoint from old evidence", () => {
    const r = fixture();
    r.epoch.notBeforeCapture = r.previousEvidenceThroughCapture - 1;
    expect(reason(r)).toBe("CHECK_CLOCKS_OR_FRESHNESS_INVALID");
    const pixels = fixture();
    pixels.groups[0].evidence[0].pixelOrigin = pixels.epoch.notBeforeCapture;
    expect(reason(pixels)).toBe("CHECK_CLOCKS_OR_FRESHNESS_INVALID");
  });
  it("rejects stale pixels before canonical collection and rejects stale provenance at numerical checking", () => {
    const push = vi.spyOn(SampleWindow.prototype, "push");
    expect(() => collectedGroups(calibrationLayout.validation, newBinding, "new", 13000, (p) => p, 151)).toThrow(
      "FIXTURE_STALE_BEFORE_COLLECTION",
    );
    expect(push).not.toHaveBeenCalled();
    push.mockRestore();
    const r = fixture();
    r.groups[0].evidence[0].collectedAt = r.groups[0].evidence[0].pixelOrigin + 151;
    expect(reason(r)).toBe("CHECK_CLOCKS_OR_FRESHNESS_INVALID");
  });
  it("requires real600ms evidence, fifteen samples and bounded canonical windows", () => {
    const r = fixture();
    r.groups[0].samples = r.groups[0].samples.slice(0, 14);
    r.groups[0].evidence = r.groups[0].evidence.slice(0, 14);
    expect(reason(r)).toBe("CHECKS_INCOMPLETE");
    const fast = fixture();
    fast.groups[0].samples.forEach((s, i) => {
      s.at = 13000 + i * 20;
      Object.assign(fast.groups[0].evidence[i], {
        capture: s.at,
        pixelOrigin: s.at,
        collectedAt: s.at + 5,
        sequence: i + 1,
      });
    });
    expect(reason(fast)).toBe("CHECKS_INCOMPLETE");
  });
  it("does not expand old feature bounds, accept model axes or change the frozen fit", () => {
    const r = fixture();
    r.calibration.featureBounds[1] = { min: 0.3, max: 0.7 };
    expect(reason(r)).toBe("CHECK_OUTSIDE_OLD_BOUNDS");
    const axis = fixture();
    axis.groups[0].samples[0].features[3] = 0.1;
    expect(reason(axis)).toBe("CHECKS_INCOMPLETE");
    const transform = fixture();
    transform.calibration.coefficients[0][2] = 0.01;
    expect(reason(transform)).toBe("FIT_EXPIRED_OR_INVALID");
  });
  it("never mutates frozen old fit, old groups or fresh evidence on either result", () => {
    const oldGroups = collectedGroups(relativeLayout.training, oldBinding, "old", 1000);
    const beforeGroups = structuredClone(oldGroups),
      r = fixture(),
      before = structuredClone(r);
    freezeDeep(oldGroups);
    freezeDeep(r);
    expect(reason(r)).toBe("RAW_CHECKS_WITHIN_LIMIT");
    expect(r).toEqual(before);
    expect(oldGroups).toEqual(beforeGroups);
    const failed = fixture();
    failed.groups[0].samples[0].features[1] += 0.05;
    const failedBefore = structuredClone(failed);
    freezeDeep(failed);
    expect(reason(failed)).toBe("CHECKS_INCOMPLETE");
    expect(failed).toEqual(failedBefore);
  });
  it("does not collect across a canonical window binding change", () => {
    const window = new SampleWindow(oldBinding, { x: 0.5, y: 0.5 }, "RELATIVE");
    window.push(relativeIndexFeatures({ x: 0.5, y: 0.5 }), 100, oldBinding);
    expect(() => window.push(relativeIndexFeatures({ x: 0.5, y: 0.5 }), 150, newBinding)).toThrow(
      "SAMPLE_CONTEXT_CHANGED",
    );
  });
  it("refuses extra identity/authority claims instead of treating them as proof", () => {
    const r = { ...fixture(), physicalAssociation: "PROVEN" } as RelativeEpochCompatibilityRequest;
    expect(reason(r)).toBe("INVALID_REQUEST");
    const group = fixture();
    Object.assign(group.groups[0], { identityProven: true });
    expect(reason(group)).toBe("CHECK_PROVENANCE_MISMATCH");
    const sample = fixture();
    Object.assign(sample.groups[0].samples[0], { actionable: true });
    expect(reason(sample)).toBe("CHECKS_INCOMPLETE");
    expect(fixture().epoch.binding.featureProfile).toBe(REACH_RELATIVE_FEATURE_PROFILE);
  });
});
