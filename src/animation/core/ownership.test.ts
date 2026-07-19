import { afterEach, describe, expect, it, vi } from "vitest";
import {
  animationOwnerFor,
  claimAnimationOwnership,
  claimAnimationOwnershipWithEvidence,
  releaseAnimationOwnership,
} from "./ownership";

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

  it("warns without logging a DOM object or its text and refuses conflicting ownership", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const element = document.createElement("button");
    element.textContent = "private story text";
    claimAnimationOwnership(element, "motion", ["transform"]);
    expect(claimAnimationOwnership(element, "gsap", ["transform", "filter"])).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]).toHaveLength(1);
    expect(warn.mock.calls[0]?.[0]).toEqual(expect.any(String));
    expect(warn.mock.calls[0]?.[0]).not.toContain("private story text");
    releaseAnimationOwnership(element, "motion");
  });

  it("returns sanitized conflict evidence and an idempotent scoped cleanup lease", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const element = document.createElement("div");
    const first = claimAnimationOwnershipWithEvidence(element, "motion", ["transform"], "artifact-reveal");
    const sameOwner = claimAnimationOwnershipWithEvidence(element, "motion", ["opacity"], "artifact-reveal");
    const rejected = claimAnimationOwnershipWithEvidence(element, "gsap", ["transform", "filter"], "artifact-reveal");

    expect(rejected.evidence).toEqual({
      claimed: false,
      owner: "gsap",
      properties: ["transform", "filter"],
      part: "artifact-reveal",
      rejectedOwner: "motion",
      conflictingProperties: ["transform"],
    });
    expect(first.release().released).toBe(true);
    expect(animationOwnerFor(element, "transform")).toBeNull();
    expect(animationOwnerFor(element, "opacity")).toBe("motion");
    expect(first.release().released).toBe(false);
    expect(sameOwner.release().released).toBe(true);
    expect(element).not.toHaveAttribute("data-animation-owner");
  });

  it("honors a foreign declarative owner without overwriting it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const element = document.createElement("div");
    element.dataset.animationOwner = "motion";

    const rejected = claimAnimationOwnershipWithEvidence(element, "gsap", ["opacity"], "seal");

    expect(rejected.evidence).toEqual({
      claimed: false,
      owner: "gsap",
      properties: ["opacity"],
      part: "seal",
      rejectedOwner: "motion",
      conflictingProperties: ["opacity"],
    });
    expect(animationOwnerFor(element, "opacity")).toBe("motion");
    expect(element).toHaveAttribute("data-animation-owner", "motion");
    expect(rejected.release().released).toBe(false);
    expect(element).toHaveAttribute("data-animation-owner", "motion");
    expect(warn).toHaveBeenCalledOnce();
  });

  it("preserves a same-owner declarative attribute through idempotent lease release", () => {
    const element = document.createElement("div");
    element.dataset.animationOwner = "motion";
    const lease = claimAnimationOwnershipWithEvidence(element, "motion", ["transform"], "chart");

    expect(lease.evidence.claimed).toBe(true);
    expect(element).toHaveAttribute("data-animation-owner", "motion");
    expect(lease.release().released).toBe(true);
    expect(lease.release().released).toBe(false);
    expect(element).toHaveAttribute("data-animation-owner", "motion");
    expect(animationOwnerFor(element, "transform")).toBe("motion");
  });
});
