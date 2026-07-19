import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AnimationOwnershipRegistry,
  animationOwnerFor,
  claimAnimationOwnership,
  claimAnimationOwnershipWithEvidence,
  releaseAnimationOwnership,
  normalizeAnimatedProperties,
} from "./ownership";
import { createAnimationProviderId } from "../hosts/scene-host-registry";
import type { SceneHostId, SceneInstanceId, SceneTargetId } from "./animation-types";

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

describe("Phase 2 provider-scoped ownership", () => {
  function connectedTarget() {
    const element = document.createElement("div");
    document.body.append(element);
    return element;
  }

  function request(
    registry: AnimationOwnershipRegistry,
    element: HTMLElement,
    overrides: Partial<Parameters<AnimationOwnershipRegistry["claim"]>[0]> = {},
  ): Parameters<AnimationOwnershipRegistry["claim"]>[0] {
    const hostId = (overrides.scope?.hostId ?? "host-a") as SceneHostId;
    return {
      sceneInstanceId: "scene-a" as SceneInstanceId,
      targetId: "target-a" as SceneTargetId,
      targetGeneration: 1,
      element,
      runtime: "gsap",
      properties: ["transform"],
      allowedProperties: ["transform", "opacity", "layout"],
      scope: { providerId: registry.providerId, hostId, boundary: "invocation" },
      ...overrides,
    };
  }

  afterEach(() => document.body.replaceChildren());

  it("normalizes spatial, presence, and path aliases into fail-closed groups", () => {
    expect(normalizeAnimatedProperties(["translate", "layout", "opacity", "stroke-dashoffset"])).toEqual({
      ok: true,
      properties: ["translate", "layout", "opacity", "stroke-dashoffset"],
      groups: ["spatial-transform", "presence", "path-drawing"],
    });
    expect(normalizeAnimatedProperties(["transform", "unknown-property"])).toEqual({
      ok: false,
      property: "unknown-property",
    });
  });

  it.each([
    ["motion", "gsap"],
    ["css", "gsap"],
    ["page-flip", "motion"],
    ["dnd-kit", "motion"],
    ["dnd-kit", "gsap"],
  ] as const)("rejects %s versus %s spatial writes on one node", (firstRuntime, secondRuntime) => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const registry = new AnimationOwnershipRegistry(createAnimationProviderId());
    const element = connectedTarget();
    const first = registry.claim(request(registry, element, { runtime: firstRuntime }));
    const second = registry.claim(
      request(registry, element, {
        runtime: secondRuntime,
        sceneInstanceId: "scene-b" as SceneInstanceId,
        properties: ["layout"],
      }),
    );

    expect(first.status).toBe("granted");
    expect(second).toMatchObject({
      status: "rejected",
      group: "spatial-transform",
      requestedOwner: secondRuntime,
      existingOwner: firstRuntime,
      reason: "property-conflict",
    });
    registry.destroy();
  });

  it("grants a live opaque permit, reference-counts compatible repeats, and revokes on terminal cleanup", () => {
    const registry = new AnimationOwnershipRegistry(createAnimationProviderId());
    const element = connectedTarget();
    const first = registry.claim(request(registry, element));
    const repeat = registry.claim(request(registry, element));
    expect(first.status).toBe("granted");
    expect(repeat.status).toBe("granted");
    if (first.status !== "granted" || repeat.status !== "granted") return;

    expect(
      registry.allowsWrite(first.permit, {
        targetId: first.claim.targetId,
        targetGeneration: 1,
        runtime: "gsap",
        property: "transform",
      }),
    ).toBe(true);
    expect(first.release()).toBe(true);
    expect(registry.snapshot().activeClaimCount).toBe(1);
    expect(registry.releaseScene(first.claim.sceneInstanceId)).toBe(1);
    expect(
      registry.allowsWrite(first.permit, {
        targetId: first.claim.targetId,
        targetGeneration: 1,
        runtime: "gsap",
        property: "transform",
      }),
    ).toBe(false);
    expect(repeat.release()).toBe(false);
  });

  it("rejects an atomic batch without leaving provisional claims", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const registry = new AnimationOwnershipRegistry(createAnimationProviderId());
    const firstElement = connectedTarget();
    const secondElement = connectedTarget();
    const existing = registry.claim(
      request(registry, secondElement, {
        targetId: "target-b" as SceneTargetId,
        runtime: "motion",
        sceneInstanceId: "scene-existing" as SceneInstanceId,
      }),
    );
    expect(existing.status).toBe("granted");

    const result = registry.claimBatch([
      request(registry, firstElement, { targetId: "target-a" as SceneTargetId }),
      request(registry, secondElement, { targetId: "target-b" as SceneTargetId }),
    ]);

    expect(result.status).toBe("rejected");
    expect(registry.snapshot().activeClaimCount).toBe(1);
    expect(firstElement).not.toHaveAttribute("data-animation-owner");
  });

  it("sweeps only disconnected or terminal claims and never steals a connected live claim", () => {
    const registry = new AnimationOwnershipRegistry(createAnimationProviderId());
    const element = connectedTarget();
    const grant = registry.claim(request(registry, element));
    expect(grant.status).toBe("granted");
    expect(registry.sweepStaleClaims()).toBe(0);
    element.remove();
    expect(registry.sweepStaleClaims()).toBe(1);
    expect(registry.snapshot().activeClaimCount).toBe(0);
  });
});
