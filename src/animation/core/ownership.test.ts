import { afterEach, describe, expect, it, vi } from "vitest";
import { animationOwnerFor, claimAnimationOwnership, releaseAnimationOwnership } from "./ownership";

describe("animation ownership", () => {
  afterEach(() => vi.restoreAllMocks());

  it("allows one engine to own several properties and releases cleanly", () => {
    const element = document.createElement("div");
    expect(claimAnimationOwnership(element, "gsap", ["transform", "opacity"])).toBe(true);
    expect(animationOwnerFor(element, "transform")).toBe("gsap");
    releaseAnimationOwnership(element, "gsap");
    expect(animationOwnerFor(element, "transform")).toBeNull();
    expect(element).not.toHaveAttribute("data-animation-owner");
  });

  it("warns and refuses conflicting ownership in development", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const element = document.createElement("button");
    claimAnimationOwnership(element, "motion", ["transform"]);
    expect(claimAnimationOwnership(element, "gsap", ["transform", "filter"])).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    releaseAnimationOwnership(element, "motion");
  });
});
