import { describe, expect, it } from "vitest";
import { motionPolicy, resolveMotionMode, scaledDistance, scaledDuration } from "./quality";

describe("motion quality policy", () => {
  it("lets the more restrictive system preference win", () => {
    expect(resolveMotionMode("full", true)).toBe("reduced");
    expect(resolveMotionMode("gentle", false)).toBe("gentle");
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
