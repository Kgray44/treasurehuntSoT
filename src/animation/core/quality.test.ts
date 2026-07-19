import { describe, expect, it } from "vitest";
import {
  isMotionMode,
  motionPolicy,
  resolveMotionMode,
  resolveMotionPolicy,
  scaledDistance,
  scaledDuration,
} from "./quality";

describe("motion quality policy", () => {
  it("lets the more restrictive system preference win", () => {
    expect(resolveMotionMode("full", true)).toBe("reduced");
    expect(resolveMotionMode("gentle", false)).toBe("gentle");
  });

  it.each([
    ["M1 full", "full", false, "full"],
    ["M2 gentle", "gentle", false, "gentle"],
    ["M3 product reduced", "reduced", false, "reduced"],
    ["M4 browser reduced", "full", true, "reduced"],
    ["M5 both reduced", "reduced", true, "reduced"],
  ] as const)("resolves %s with strictest-wins semantics", (_name, productSetting, browserReduced, level) => {
    const policy = resolveMotionPolicy(productSetting, browserReduced);
    expect(policy).toMatchObject({
      level,
      source: { productSetting, browserPrefersReduced: browserReduced },
      preserveSemanticStaging: true,
    });
    expect(policy.durationScale).toBe(motionPolicy[level].duration);
    expect(policy.distanceScale).toBe(motionPolicy[level].distance);
  });

  it("turns off spatial and continuous runtime travel only for the resolved reduced level", () => {
    expect(resolveMotionPolicy("gentle", false)).toMatchObject({
      allowSpatialTravel: true,
      allowContinuousAmbientMotion: true,
      allowPageCurl: true,
      allowRiveStateTravel: true,
      allowLottiePlayback: true,
      allowMotionCues: true,
    });
    expect(resolveMotionPolicy("full", true)).toMatchObject({
      allowSpatialTravel: false,
      allowContinuousAmbientMotion: false,
      allowPageCurl: false,
      allowRiveStateTravel: false,
      allowLottiePlayback: false,
      allowMotionCues: false,
    });
  });

  it("validates persisted product settings", () => {
    expect(isMotionMode("full")).toBe(true);
    expect(isMotionMode("gentle")).toBe(true);
    expect(isMotionMode("reduced")).toBe(true);
    expect(isMotionMode("system")).toBe(false);
    expect(isMotionMode(null)).toBe(false);
  });

  it("preserves narrative timing while reducing duration and travel", () => {
    expect(scaledDuration(2, "full")).toBe(2);
    expect(scaledDuration(2, "gentle")).toBeLessThan(2);
    expect(scaledDistance(120, "reduced")).toBe(0);
  });

  it("removes ambient loops and physical curl only in reduced mode", () => {
    expect(motionPolicy.full).toMatchObject({ ambient: true, pageFlip: true });
    expect(motionPolicy.gentle).toMatchObject({ ambient: true, pageFlip: true });
    expect(motionPolicy.reduced).toMatchObject({ ambient: false, pageFlip: false });
  });
});
