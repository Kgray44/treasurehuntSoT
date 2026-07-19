import type {
  AnimatedProperty,
  SceneBuildContext,
  SceneBuildContextBase,
  SceneBuildContextV2,
  SceneTimeline,
} from "../core/animation-types";
import { scaledDistance, scaledDuration } from "../core/quality";
import { gsap } from "../core/gsap-client";

export function sceneTimeline(context: SceneBuildContextBase) {
  const timeline = gsap.timeline({
    paused: true,
    defaults: { ease: "forever-settle", overwrite: "auto" },
  });
  mark(timeline, context, "scene-start", 0);
  return timeline;
}

export function mark(timeline: SceneTimeline, context: SceneBuildContextBase, label: string, position?: gsap.Position) {
  timeline.addLabel(label, position);
  timeline.call(() => context.emitLabel(label), [], label);
  return label;
}

/** @deprecated Bounded v1 compatibility only; native v2 builders receive permit-gated target capabilities. */
export function parts(root: HTMLElement, ...names: string[]) {
  return names.flatMap((name) => Array.from(root.querySelectorAll<HTMLElement>(`[data-scene-part="${name}"]`)));
}

export function seconds(context: SceneBuildContextBase, value: number) {
  return scaledDuration(value, context.mode);
}

export function distance(context: SceneBuildContextBase, value: number) {
  return scaledDistance(value, context.mode);
}

export function settle(timeline: SceneTimeline, context: SceneBuildContext, position: gsap.Position = ">") {
  const label = mark(timeline, context, "interaction-restored", position);
  timeline.to(context.root, { duration: seconds(context, 0.08) }, label);
  mark(timeline, context, "scene-complete", ">");
  return timeline;
}

export function settleV2(timeline: SceneTimeline, context: SceneBuildContextV2, position: gsap.Position = ">") {
  const label = mark(timeline, context, "interaction-restored", position);
  const clock = { progress: 0 };
  timeline.to(clock, { progress: 1, duration: seconds(context, 0.08) }, label);
  mark(timeline, context, "scene-complete", ">");
  return timeline;
}

export function withTarget<T>(
  context: SceneBuildContextV2,
  key: string,
  property: AnimatedProperty,
  operation: (element: Element, index: number) => T,
) {
  return withTargetProperties(context, key, [property], operation);
}

export function withTargetProperties<T>(
  context: SceneBuildContextV2,
  key: string,
  properties: readonly AnimatedProperty[],
  operation: (element: Element, index: number) => T,
) {
  if (properties.length === 0) throw new Error("Scene target tween declares no animated properties");
  const group = context.targets.get(key);
  if (!group) return [];
  return group.targets.flatMap((target, index) => {
    const result = target.withProperties(properties, (element) => operation(element, index));
    if (result.status === "denied" && group.required) {
      throw new Error("Required scene target capability denied");
    }
    return result.status === "applied" ? [result.value] : [];
  });
}

const propertyOrder = [
  "transform",
  "translate",
  "scale",
  "rotate",
  "opacity",
  "layout",
  "clip-path",
  "filter",
  "width",
  "height",
  "path-drawing",
  "stroke-dasharray",
  "stroke-dashoffset",
  "scroll-position",
  "visibility",
] as const satisfies readonly AnimatedProperty[];

const tweenPropertyMap: Readonly<Record<string, readonly AnimatedProperty[]>> = Object.freeze({
  x: ["transform"],
  y: ["transform"],
  z: ["transform"],
  xPercent: ["transform"],
  yPercent: ["transform"],
  zPercent: ["transform"],
  scale: ["transform"],
  scaleX: ["transform"],
  scaleY: ["transform"],
  scaleZ: ["transform"],
  rotate: ["transform"],
  rotateX: ["transform"],
  rotateY: ["transform"],
  rotateZ: ["transform"],
  rotation: ["transform"],
  rotationX: ["transform"],
  rotationY: ["transform"],
  rotationZ: ["transform"],
  skew: ["transform"],
  skewX: ["transform"],
  skewY: ["transform"],
  transform: ["transform"],
  transformOrigin: ["transform"],
  transformPerspective: ["transform"],
  perspective: ["transform"],
  force3D: ["transform"],
  motionPath: ["transform"],
  opacity: ["opacity"],
  autoAlpha: ["opacity", "visibility"],
  visibility: ["visibility"],
  clipPath: ["clip-path"],
  filter: ["filter"],
  width: ["width"],
  height: ["height"],
  drawSVG: ["path-drawing"],
  morphSVG: ["path-drawing"],
  strokeDasharray: ["stroke-dasharray"],
  strokeDashoffset: ["stroke-dashoffset"],
  scrollTo: ["scroll-position"],
  scrollTop: ["scroll-position"],
  scrollLeft: ["scroll-position"],
});

const tweenControlKeys = new Set([
  "duration",
  "ease",
  "delay",
  "stagger",
  "repeat",
  "repeatDelay",
  "yoyo",
  "yoyoEase",
  "overwrite",
]);

/** Derive the complete permit set before exposing a target element to GSAP. */
export function animatedPropertiesForTweenVars(...varsList: readonly gsap.TweenVars[]): readonly AnimatedProperty[] {
  const properties = new Set<AnimatedProperty>();
  for (const vars of varsList) {
    for (const key of Object.keys(vars)) {
      if (tweenControlKeys.has(key) || key.startsWith("on")) continue;
      const mapped = tweenPropertyMap[key];
      if (!mapped) throw new Error(`Unsupported GSAP target write property: ${key}`);
      for (const property of mapped) properties.add(property);
    }
  }
  return propertyOrder.filter((property) => properties.has(property));
}

export function toTargets(
  timeline: SceneTimeline,
  context: SceneBuildContextV2,
  key: string,
  vars: gsap.TweenVars,
  position?: gsap.Position,
) {
  return withTargetProperties(context, key, animatedPropertiesForTweenVars(vars), (element, index) =>
    timeline.to(element, { ...vars, delay: Number(vars.delay ?? 0) + index * Number(vars.stagger ?? 0) }, position),
  );
}

export function fromToTargets(
  timeline: SceneTimeline,
  context: SceneBuildContextV2,
  key: string,
  fromVars: gsap.TweenVars,
  toVars: gsap.TweenVars,
  position?: gsap.Position,
) {
  return withTargetProperties(context, key, animatedPropertiesForTweenVars(fromVars, toVars), (element, index) =>
    timeline.fromTo(
      element,
      fromVars,
      { ...toVars, delay: Number(toVars.delay ?? 0) + index * Number(toVars.stagger ?? 0) },
      position,
    ),
  );
}

export function idleTimeline(context: SceneBuildContext, targetNames: string[] = ["living-idle"]) {
  const timeline = sceneTimeline(context);
  const targets = parts(context.root, ...targetNames);
  mark(timeline, context, "await-server", 0);
  if (targets.length) {
    timeline.to(targets, {
      opacity: 0.72,
      scale: context.mode === "reduced" ? 1 : 1.025,
      duration: seconds(context, 0.8),
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
  } else timeline.to(context.root, { duration: seconds(context, 0.2), repeat: -1 });
  return timeline;
}
