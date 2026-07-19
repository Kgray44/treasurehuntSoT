import { describe, expect, it } from "vitest";
import type {
  AnimatedProperty,
  AnimationSceneName,
  MotionMode,
  SceneBuildContext,
  SceneBuildContextV2,
  SceneDefinition,
  SceneDefinitionV2,
  SceneInstanceId,
  SceneTargetContractV2,
  SceneTargetId,
  SceneTimeline,
} from "../core/animation-types";
import type { SceneBuildTarget, SceneBuildTargetAccess } from "../hosts/scene-host-types";
import { sceneRegistry } from "../director/scene-registry";
import { animatedPropertiesForTweenVars, fromToTargets, sceneTimeline, toTargets } from "./scene-utils";

type BuiltContext = {
  value: SceneBuildContext | SceneBuildContextV2;
  cleanups: Array<() => void>;
  usedKeys: string[];
  propertyRequests: Array<Readonly<{ key: string; properties: readonly AnimatedProperty[] }>>;
};

function legacyContext(name: AnimationSceneName, mode: MotionMode): BuiltContext {
  const cleanups: Array<() => void> = [];
  const root = document.createElement("main");
  const partNames = [
    "invitation-ink",
    "seal",
    "ribbon",
    "invitation",
    "seal-crack",
    "seal-fragment",
    "lantern",
    "lock",
    "door-bolt",
    "cabin-door",
    "chart-room-light",
    "login-ledger",
    "workspace-light",
    "command-light",
    "blank-page",
  ];
  root.innerHTML = partNames.map((part) => `<div data-scene-part="${part}">Safe development text</div>`).join("");
  return {
    value: {
      root,
      mode,
      sceneName: name,
      display: {},
      emitLabel: () => undefined,
      addCleanup: (cleanup) => cleanups.push(cleanup),
    },
    cleanups,
    usedKeys: [],
    propertyRequests: [],
  };
}

function targetElement(part: string) {
  return part.includes("path") || part.includes("crack") || part === "red-thread"
    ? document.createElementNS("http://www.w3.org/2000/svg", "path")
    : document.createElement("div");
}

function v2Context(name: AnimationSceneName, contract: SceneTargetContractV2, mode: MotionMode): BuiltContext {
  const cleanups: Array<() => void> = [];
  const usedKeys: string[] = [];
  const propertyRequests: Array<Readonly<{ key: string; properties: readonly AnimatedProperty[] }>> = [];
  const groups = new Map(
    contract.targets.map((requirement) => {
      const count = Math.max(1, requirement.cardinality.min);
      const sceneTargets: SceneBuildTarget[] = Array.from({ length: count }, (_, index) => {
        const element = targetElement(requirement.part);
        const declaredProperties: readonly AnimatedProperty[] = requirement.properties;
        const applyProperties = <T>(properties: readonly AnimatedProperty[], operation: (element: Element) => T) => {
          propertyRequests.push({ key: requirement.key, properties: [...properties] });
          if (requirement.identityOnly || properties.some((property) => !declaredProperties.includes(property))) {
            return { status: "denied" as const, reason: "property-not-declared" as const };
          }
          usedKeys.push(requirement.key);
          return { status: "applied" as const, value: operation(element) };
        };
        return Object.freeze({
          targetId: `${name}-${requirement.key}-${index}` as SceneTargetId,
          part: requirement.part,
          identityOnly: requirement.identityOnly === true,
          runtime: requirement.identityOnly ? null : requirement.owner,
          properties: declaredProperties,
          withElement: <T>(property: AnimatedProperty, operation: (element: Element) => T) =>
            applyProperties([property], operation),
          withProperties: applyProperties,
        });
      });
      return [
        requirement.key,
        Object.freeze({
          key: requirement.key,
          part: requirement.part,
          required: requirement.required,
          targets: Object.freeze(sceneTargets),
          one: () => sceneTargets[0] ?? null,
        }),
      ] as const;
    }),
  );
  const targets: SceneBuildTargetAccess = Object.freeze({
    keys: () => Object.freeze([...groups.keys()]),
    get: (key) => groups.get(key),
    require: (key) => {
      const group = groups.get(key);
      if (!group) throw new Error(`Unknown test target ${key}`);
      return group;
    },
  });
  return {
    value: {
      mode,
      sceneName: name,
      sceneInstanceId: `${name}-test-instance` as SceneInstanceId,
      targets,
      display: {},
      emitLabel: () => undefined,
      addCleanup: (cleanup) => cleanups.push(cleanup),
    },
    cleanups,
    usedKeys,
    propertyRequests,
  };
}

function context(name: AnimationSceneName, mode: MotionMode = "full") {
  const contract = sceneRegistry[name].contract;
  return contract.version === 2 ? v2Context(name, contract, mode) : legacyContext(name, mode);
}

type Stage = "buildOpening" | "buildSuccess" | "buildFailure" | "buildIdle";

function build(name: AnimationSceneName, stage: Stage, built: BuiltContext) {
  const definition = sceneRegistry[name];
  if (definition.contract.version === 2) {
    const builder = (definition as SceneDefinitionV2)[stage];
    return builder?.(built.value as SceneBuildContextV2);
  }
  const builder = (definition as SceneDefinition)[stage];
  return builder?.(built.value as SceneBuildContext);
}

const expectLabels = (timeline: SceneTimeline, labels: string[]) => {
  for (const label of labels) expect(timeline.labels).toHaveProperty(label);
};

describe("GSAP scene builders", () => {
  it.each(["full", "gentle", "reduced"] as const)("builds every scene in %s mode without starting it", (mode) => {
    for (const name of Object.keys(sceneRegistry) as AnimationSceneName[]) {
      const built = context(name, mode);
      const timelines = (["buildOpening", "buildSuccess", "buildFailure", "buildIdle"] as const)
        .map((stage) => build(name, stage, built))
        .filter(Boolean) as SceneTimeline[];
      for (const timeline of timelines) {
        expect(timeline.paused()).toBe(true);
        expect(timeline.labels).toHaveProperty("scene-start");
        timeline.kill();
      }
      built.cleanups.reverse().forEach((cleanup) => cleanup());
    }
  });

  it("preserves semantic checkpoints for arrival, access, and the flagship chapter ceremony", () => {
    const arrival = context("first-arrival");
    expectLabels(build("first-arrival", "buildOpening", arrival)!, [
      "dark-sea",
      "tide-arrives",
      "title-written",
      "voyage-materializes",
      "physical-open",
      "await-server",
    ]);

    const access = context("player-access");
    expectLabels(build("player-access", "buildSuccess", access)!, [
      "success-branch",
      "seal-released",
      "invitation-unfolds",
      "content-readable",
    ]);

    const chapter = context("chapter-release");
    expectLabels(build("chapter-release", "buildSuccess", chapter)!, [
      "seal",
      "parchment",
      "ink-heading",
      "ink-story",
      "ink-objective",
      "ink-riddle",
      "map",
      "active",
      "content-readable",
      "scene-complete",
    ]);
  });

  it("keeps chapter choreography inside the cold acknowledgment envelope", () => {
    const chapter = context("chapter-release", "full");
    const opening = build("chapter-release", "buildOpening", chapter)!;
    const success = build("chapter-release", "buildSuccess", chapter)!;
    const choreographySeconds = opening.duration() + success.duration();
    expect(choreographySeconds).toBeGreaterThanOrEqual(4);
    expect(choreographySeconds).toBeLessThan(4.5);
    opening.kill();
    success.kill();
  });

  it("provides truthful failure checkpoints for legacy authenticated and GM operations", () => {
    const access = context("player-access");
    expectLabels(build("player-access", "buildFailure", access)!, ["failure-branch", "lock-rejected"]);
    const prepare = context("prepare-chapter");
    expectLabels(build("prepare-chapter", "buildFailure", prepare)!, ["failure-branch", "ink-receding"]);
  });

  it("keeps fake page turns and journal-open as non-executable tombstones", () => {
    for (const name of ["journal-open", "manual-page-flip", "programmatic-page-flip"] as const) {
      const built = context(name);
      const opening = build(name, "buildOpening", built)!;
      expectLabels(opening, ["deprecated-tombstone", "await-server"]);
      expect(built.usedKeys).toEqual([]);
      opening.kill();
    }
  });

  it("delivers no root/query escape hatch to native v2 builders", () => {
    for (const name of Object.keys(sceneRegistry) as AnimationSceneName[]) {
      if (sceneRegistry[name].contract.version !== 2) continue;
      const built = context(name);
      expect("root" in built.value).toBe(false);
      const opening = build(name, "buildOpening", built)!;
      const success = build(name, "buildSuccess", built)!;
      opening.kill();
      success.kill();
    }
  });

  it("keeps production builders free of root, document, selector, and parts queries", () => {
    for (const name of Object.keys(sceneRegistry) as AnimationSceneName[]) {
      const definition = sceneRegistry[name];
      if (definition.contract.reachability !== "production") continue;
      const source = [definition.buildOpening, definition.buildSuccess, definition.buildFailure, definition.buildIdle]
        .filter(Boolean)
        .map((builder) => builder!.toString())
        .join("\n");
      expect(source, name).not.toMatch(/querySelector|querySelectorAll|\bdocument\b|\bparts\s*\(|\.root\b/);
    }
  });

  it("requests every GSAP write property together and denies undeclared extras before element exposure", () => {
    expect(
      animatedPropertiesForTweenVars({
        x: 1,
        yPercent: 1,
        scaleX: 1,
        rotateY: 1,
        skew: 1,
        transformOrigin: "center",
        motionPath: "#path",
        autoAlpha: 1,
        clipPath: "inset(0)",
        filter: "none",
        width: 10,
        height: 10,
        drawSVG: "100%",
        morphSVG: "#shape",
        strokeDasharray: "1 1",
        strokeDashoffset: 0,
        scrollTo: 12,
        duration: 1,
        ease: "none",
        delay: 0,
        stagger: 0,
        repeat: 0,
        yoyo: false,
        overwrite: "auto",
        onComplete: () => undefined,
      }),
    ).toEqual([
      "transform",
      "opacity",
      "clip-path",
      "filter",
      "width",
      "height",
      "path-drawing",
      "stroke-dasharray",
      "stroke-dashoffset",
      "scroll-position",
      "visibility",
    ]);

    const map = context("map-reveal");
    const mapTimeline = build("map-reveal", "buildSuccess", map)!;
    expect(map.propertyRequests).toContainEqual({
      key: "map-marker-new",
      properties: ["transform", "opacity"],
    });
    mapTimeline.kill();

    const chapter = context("chapter-release");
    const chapterTimeline = build("chapter-release", "buildSuccess", chapter)!;
    expect(chapter.propertyRequests).toContainEqual({ key: "quill", properties: ["transform", "opacity"] });
    expect(chapter.propertyRequests).toContainEqual({ key: "route-path", properties: ["path-drawing"] });
    chapterTimeline.kill();

    const mixed = context("map-reveal");
    const mapTargets = (mixed.value as SceneBuildContextV2).targets;
    const group = mapTargets.require("map-marker-new");
    const target = group.one();
    expect(target).not.toBeNull();
    if (!target) return;
    let elementExposed = false;
    const restrictedTarget: SceneBuildTarget = Object.freeze({
      ...target,
      properties: ["transform"] as const,
      withProperties: <T>(properties: readonly AnimatedProperty[], operation: (element: Element) => T) => {
        mixed.propertyRequests.push({ key: "map-marker-new", properties: [...properties] });
        if (properties.some((property) => property !== "transform")) {
          return { status: "denied" as const, reason: "property-not-declared" as const };
        }
        elementExposed = true;
        return { status: "applied" as const, value: operation(document.createElement("div")) };
      },
    });
    const restrictedContext: SceneBuildContextV2 = {
      ...(mixed.value as SceneBuildContextV2),
      targets: {
        ...mapTargets,
        get: (key) =>
          key === "map-marker-new"
            ? { ...group, targets: [restrictedTarget], one: () => restrictedTarget }
            : mapTargets.get(key),
      },
    };
    const timeline = sceneTimeline(restrictedContext);
    expect(() =>
      fromToTargets(timeline, restrictedContext, "map-marker-new", { x: 12, opacity: 0 }, { x: 0, opacity: 1 }),
    ).toThrow("Required scene target capability denied");
    expect(elementExposed).toBe(false);

    expect(() =>
      toTargets(timeline, restrictedContext, "map-marker-new", { clearProps: "all", duration: 0.1 }),
    ).toThrow("Unsupported GSAP target write property: clearProps");
    timeline.kill();
  });
});
