import { afterEach, describe, expect, it, vi } from "vitest";
import type { SceneTargetRequirement, SceneTargetResolutionReceipt, SceneVisibilityRule } from "./animation-types";
import type { SceneInvocationHandle } from "../hosts/scene-host-types";
import { animationOwnerFor, claimAnimationOwnership, releaseAnimationOwnership } from "./ownership";
import {
  preflightRegisteredSceneTargets,
  preflightSceneTargets,
  type SceneTargetPreflightOptions,
} from "./target-preflight";

const defaultVisibility: SceneVisibilityRule = {
  mustBeConnected: true,
  mustHaveNonZeroBox: true,
  mustNotBeDisplayNone: true,
  mustNotBeVisibilityHidden: true,
  minimumEffectiveOpacity: 0.01,
  mustIntersectHost: true,
  rejectPageFlipSource: true,
  rejectStaleSceneInstance: true,
};

function requirement(
  part = "seal",
  options: {
    required?: boolean;
    min?: number;
    max?: number;
    visibility?: Partial<SceneVisibilityRule>;
    owner?: SceneTargetRequirement["owner"];
    properties?: SceneTargetRequirement["properties"];
  } = {},
): SceneTargetRequirement {
  return {
    part,
    required: options.required ?? true,
    cardinality: { min: options.min ?? 1, max: options.max ?? 1 },
    visibility: { ...defaultVisibility, ...options.visibility },
    owner: options.owner ?? "gsap",
    properties: options.properties ?? ["transform", "opacity"],
  };
}

function contract(
  requiredTargets: SceneTargetRequirement[] = [requirement()],
  optionalTargets: SceneTargetRequirement[] = [],
): SceneTargetPreflightOptions["contract"] {
  return { sceneName: "chapter-release", requiredTargets, optionalTargets };
}

function domRect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    width,
    height,
    top: y,
    right: x + width,
    bottom: y + height,
    left: x,
    toJSON: () => ({ x, y, width, height }),
  } as DOMRect;
}

function setRect(element: HTMLElement, x: number, y: number, width: number, height: number) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(domRect(x, y, width, height));
}

function hostFixture(connected = true) {
  const host = document.createElement("section");
  host.style.display = "block";
  host.style.visibility = "visible";
  host.style.opacity = "1";
  setRect(host, 0, 0, 200, 200);
  if (connected) document.body.append(host);
  return host;
}

function targetFixture(host: HTMLElement, part = "seal", rect = domRect(20, 20, 40, 40)) {
  const target = document.createElement("div");
  target.dataset.scenePart = part;
  target.style.display = "block";
  target.style.visibility = "visible";
  target.style.opacity = "1";
  vi.spyOn(target, "getBoundingClientRect").mockReturnValue(rect);
  host.append(target);
  return target;
}

function preflight(
  root: HTMLElement,
  sceneContract: SceneTargetPreflightOptions["contract"] = contract(),
  overrides: Partial<Pick<SceneTargetPreflightOptions, "sceneInstanceId" | "hostId" | "viewportRect" | "now">> = {},
) {
  return preflightSceneTargets({
    root,
    contract: sceneContract,
    sceneInstanceId: overrides.sceneInstanceId ?? "scene-instance-current",
    hostId: overrides.hostId ?? "player-progress-host",
    ...(overrides.viewportRect ? { viewportRect: overrides.viewportRect } : {}),
    ...(overrides.now ? { now: overrides.now } : {}),
  });
}

function failureCodes(result: ReturnType<typeof preflightSceneTargets>) {
  return result.report.failures.map((failure) => failure.code);
}

describe("scene target preflight", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("rejects zero required target matches", () => {
    const result = preflight(hostFixture());

    expect(result.report.requiredSatisfied).toBe(false);
    expect(result.report.observations[0]).toMatchObject({ matchedCount: 0, visibleCount: 0, duplicateCount: 0 });
    expect(failureCodes(result)).toEqual(["missing-required-target"]);
  });

  it("rejects a disconnected required target", () => {
    const host = hostFixture(false);
    targetFixture(host);
    const result = preflight(host);

    expect(result.report.observations[0]?.observations[0]?.connected).toBe(false);
    expect(failureCodes(result)).toEqual(expect.arrayContaining(["disconnected-target", "missing-required-target"]));
  });

  it("rejects zero-width and zero-height boxes", () => {
    const widthHost = hostFixture();
    targetFixture(widthHost, "seal", domRect(20, 20, 0, 40));
    const widthResult = preflight(widthHost);
    const heightHost = hostFixture();
    targetFixture(heightHost, "seal", domRect(20, 20, 40, 0));
    const heightResult = preflight(heightHost);

    expect(failureCodes(widthResult)).toContain("zero-box-target");
    expect(failureCodes(heightResult)).toContain("zero-box-target");
  });

  it("rejects display none on the target or a rendered ancestor", () => {
    const host = hostFixture();
    const wrapper = document.createElement("div");
    wrapper.style.display = "none";
    host.append(wrapper);
    const target = targetFixture(wrapper);
    const result = preflight(host);

    expect(target.style.display).toBe("block");
    expect(result.report.observations[0]?.observations[0]?.display).toBe("none");
    expect(failureCodes(result)).toContain("hidden-target");
  });

  it("rejects visibility hidden or collapse", () => {
    const host = hostFixture();
    const target = targetFixture(host);
    target.style.visibility = "hidden";
    const result = preflight(host);

    expect(result.report.observations[0]?.observations[0]?.visibility).toBe("hidden");
    expect(failureCodes(result)).toContain("hidden-target");
  });

  it("rejects zero effective opacity and multiplies ancestor opacity", () => {
    const host = hostFixture();
    host.style.opacity = "0.5";
    const wrapper = document.createElement("div");
    wrapper.style.opacity = "0";
    host.append(wrapper);
    const target = targetFixture(wrapper);
    target.style.opacity = "0.5";
    const result = preflight(host);

    expect(result.report.observations[0]?.observations[0]?.effectiveOpacity).toBe(0);
    expect(failureCodes(result)).toContain("hidden-target");
  });

  it("rejects a target whose box is outside the supplied host", () => {
    const host = hostFixture();
    targetFixture(host, "seal", domRect(240, 20, 40, 40));
    const result = preflight(host);

    expect(result.report.observations[0]?.observations[0]?.hostIntersection).toBe(false);
    expect(failureCodes(result)).toContain("outside-host");
  });

  it("accepts one valid host-scoped target, records timing, and releases ownership", () => {
    const host = hostFixture();
    host.style.opacity = "0.5";
    const target = targetFixture(host);
    target.style.opacity = "0.5";
    const times = [100, 103];
    const result = preflight(host, contract(), { now: () => times.shift() ?? 103 });

    expect(result.report).toMatchObject({
      sceneName: "chapter-release",
      sceneInstanceId: "scene-instance-current",
      hostId: "player-progress-host",
      startedAt: 100,
      completedAt: 103,
      durationMs: 3,
      requiredSatisfied: true,
      failures: [],
    });
    expect(result.report.observations[0]).toMatchObject({
      matchedCount: 1,
      visibleCount: 1,
      duplicateCount: 0,
      ownershipRejectedCount: 0,
    });
    expect(result.report.observations[0]?.observations[0]).toMatchObject({
      effectiveOpacity: 0.25,
      hostIntersection: true,
      pageFlipSource: false,
      staleSceneInstance: false,
      owner: "gsap",
    });
    expect(animationOwnerFor(target, "transform")).toBe("gsap");
    expect(result.release()).toEqual({ claimedCount: 1, releasedCount: 1, alreadyReleased: false });
    expect(result.release()).toEqual({ claimedCount: 1, releasedCount: 0, alreadyReleased: true });
    expect(animationOwnerFor(target, "transform")).toBeNull();
  });

  it("keeps measured repeated-preflight p95 below 50 ms", () => {
    const host = hostFixture();
    targetFixture(host);

    for (let warmupIndex = 0; warmupIndex < 8; warmupIndex += 1) {
      const warmup = preflight(host);
      expect(warmup.report.requiredSatisfied).toBe(true);
      warmup.release();
    }

    const observedDurationsMs = Array.from({ length: 40 }, () => {
      const startedAt = performance.now();
      const result = preflight(host);
      const durationMs = performance.now() - startedAt;

      expect(result.report.requiredSatisfied).toBe(true);
      expect(result.report.observations[0]).toMatchObject({
        matchedCount: 1,
        visibleCount: 1,
        ownershipRejectedCount: 0,
      });
      result.release();
      return durationMs;
    });
    const sortedDurationsMs = [...observedDurationsMs].sort((left, right) => left - right);
    const nearestRank = Math.ceil(sortedDurationsMs.length * 0.95);
    const percentileIndex = nearestRank - 1;
    const p95DurationMs = sortedDurationsMs[percentileIndex];

    expect(observedDurationsMs).toHaveLength(40);
    expect(percentileIndex).toBe(37);
    expect(p95DurationMs, `observed preflight p95 was ${p95DurationMs.toFixed(2)} ms`).toBeLessThan(50);
  });

  it("rejects duplicate valid targets beyond maximum cardinality", () => {
    const host = hostFixture();
    targetFixture(host);
    targetFixture(host, "seal", domRect(80, 20, 40, 40));
    const result = preflight(host);

    expect(result.report.requiredSatisfied).toBe(false);
    expect(result.report.observations[0]).toMatchObject({ visibleCount: 2, duplicateCount: 1 });
    expect(failureCodes(result)).toEqual(["duplicate-required-target"]);
    result.release();
  });

  it("rejects all mixed invalid matches and applies maximum cardinality to every match", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const host = hostFixture();
    targetFixture(host);

    const hidden = targetFixture(host, "seal", domRect(70, 20, 20, 20));
    hidden.style.display = "none";

    const stale = targetFixture(host, "seal", domRect(100, 20, 20, 20));
    stale.dataset.sceneInstance = "scene-instance-old";

    targetFixture(host, "seal", domRect(240, 20, 20, 20));

    const foreignOwned = targetFixture(host, "seal", domRect(130, 20, 20, 20));
    foreignOwned.dataset.animationOwner = "motion";

    const result = preflight(host);

    expect(result.report.requiredSatisfied).toBe(false);
    expect(result.report.observations[0]).toMatchObject({
      matchedCount: 5,
      visibleCount: 2,
      duplicateCount: 4,
      ownershipRejectedCount: 1,
    });
    expect(failureCodes(result)).toEqual(
      expect.arrayContaining([
        "hidden-target",
        "stale-scene-instance",
        "outside-host",
        "ownership-rejected",
        "duplicate-required-target",
      ]),
    );
    expect(foreignOwned).toHaveAttribute("data-animation-owner", "motion");
    expect(result.release()).toEqual({ claimedCount: 1, releasedCount: 1, alreadyReleased: false });
    expect(foreignOwned).toHaveAttribute("data-animation-owner", "motion");
  });

  it("accepts declared multiple targets within cardinality", () => {
    const host = hostFixture();
    targetFixture(host);
    targetFixture(host, "seal", domRect(80, 20, 40, 40));
    const result = preflight(host, contract([requirement("seal", { min: 1, max: 2 })]));

    expect(result.report.requiredSatisfied).toBe(true);
    expect(result.report.observations[0]).toMatchObject({ visibleCount: 2, duplicateCount: 0 });
    expect(result.release().releasedCount).toBe(2);
  });

  it("rejects hidden PageFlip sources marked by data, inert, and aria-hidden", () => {
    const host = hostFixture();
    const source = document.createElement("div");
    source.className = "page-flip-source";
    source.setAttribute("data-pageflip-source", "");
    source.setAttribute("inert", "");
    source.setAttribute("aria-hidden", "true");
    host.append(source);
    targetFixture(source);
    const result = preflight(host);

    expect(result.report.observations[0]?.observations[0]?.pageFlipSource).toBe(true);
    expect(failureCodes(result)).toEqual(expect.arrayContaining(["page-flip-source", "missing-required-target"]));
  });

  it("rejects a stale scene-instance marker when one is present", () => {
    const host = hostFixture();
    const target = targetFixture(host);
    target.dataset.sceneInstance = "scene-instance-old";
    const result = preflight(host);

    expect(result.report.observations[0]?.observations[0]?.staleSceneInstance).toBe(true);
    expect(failureCodes(result)).toEqual(expect.arrayContaining(["stale-scene-instance", "missing-required-target"]));
  });

  it("rejects a required target when declared property ownership conflicts", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const host = hostFixture();
    const target = targetFixture(host);
    claimAnimationOwnership(target, "motion", ["transform"]);
    const result = preflight(host);

    expect(result.report.observations[0]).toMatchObject({
      visibleCount: 1,
      ownershipRejectedCount: 1,
    });
    expect(result.report.observations[0]?.observations[0]?.rejectedOwner).toBe("motion");
    expect(failureCodes(result)).toEqual(expect.arrayContaining(["ownership-rejected", "missing-required-target"]));
    expect(result.release().claimedCount).toBe(0);
    releaseAnimationOwnership(target, "motion");
  });

  it("allows an absent optional target without weakening required truth", () => {
    const host = hostFixture();
    targetFixture(host);
    const optional = requirement("fog", { required: false, min: 0, max: 1, properties: ["opacity"] });
    const result = preflight(host, contract([requirement()], [optional]));

    expect(result.report.requiredSatisfied).toBe(true);
    expect(result.report.failures).toEqual([]);
    expect(result.report.observations[1]).toMatchObject({ required: false, matchedCount: 0, visibleCount: 0 });
    result.release();
  });

  it("observes but does not fail or claim a hidden optional target", () => {
    const host = hostFixture();
    targetFixture(host);
    const fog = targetFixture(host, "fog", domRect(80, 80, 40, 40));
    fog.style.display = "none";
    const optional = requirement("fog", { required: false, min: 0, max: 1, properties: ["opacity"] });
    const result = preflight(host, contract([requirement()], [optional]));

    expect(result.report.requiredSatisfied).toBe(true);
    expect(result.report.failures).toEqual([]);
    expect(result.report.observations[1]).toMatchObject({ required: false, matchedCount: 1, visibleCount: 0 });
    expect(animationOwnerFor(fog, "opacity")).toBeNull();
    result.release();
  });

  it("enforces viewport intersection only when the requirement opts in", () => {
    const host = hostFixture();
    setRect(host, 0, 0, 500, 500);
    targetFixture(host, "seal", domRect(300, 20, 40, 40));
    const viewportRule = requirement("seal", { visibility: { mustIntersectViewport: true } });
    const result = preflight(host, contract([viewportRule]), {
      viewportRect: { x: 0, y: 0, width: 200, height: 200 },
    });

    expect(result.report.observations[0]?.observations[0]?.viewportIntersection).toBe(false);
    expect(failureCodes(result)).toEqual(expect.arrayContaining(["outside-viewport", "missing-required-target"]));
  });

  it("delegates v2 preflight to the invocation's immutable registered-target snapshot", () => {
    const receipt = Object.freeze({ requiredSatisfied: true }) as SceneTargetResolutionReceipt;
    const resolveTargets = vi.fn(() => receipt);
    const invocation = { resolveTargets } as unknown as SceneInvocationHandle;

    expect(preflightRegisteredSceneTargets(invocation)).toBe(receipt);
    expect(preflightRegisteredSceneTargets(invocation)).toBe(receipt);
    expect(resolveTargets).toHaveBeenCalledTimes(2);
  });
});
