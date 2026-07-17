import type { SceneBuildContext, SceneTimeline } from "../core/animation-types";
import { scaledDistance, scaledDuration } from "../core/quality";
import { gsap } from "../core/gsap-client";

export function sceneTimeline(context: SceneBuildContext) {
  const timeline = gsap.timeline({
    paused: true,
    defaults: { ease: "forever-settle", overwrite: "auto" },
  });
  mark(timeline, context, "scene-start", 0);
  return timeline;
}

export function mark(timeline: SceneTimeline, context: SceneBuildContext, label: string, position?: gsap.Position) {
  timeline.addLabel(label, position);
  timeline.call(() => context.emitLabel(label), [], label);
  return label;
}

export function parts(root: HTMLElement, ...names: string[]) {
  return names.flatMap((name) => Array.from(root.querySelectorAll<HTMLElement>(`[data-scene-part="${name}"]`)));
}

export function seconds(context: SceneBuildContext, value: number) {
  return scaledDuration(value, context.mode);
}

export function distance(context: SceneBuildContext, value: number) {
  return scaledDistance(value, context.mode);
}

export function settle(timeline: SceneTimeline, context: SceneBuildContext, position: gsap.Position = ">") {
  const label = mark(timeline, context, "interaction-restored", position);
  timeline.to(context.root, { duration: seconds(context, 0.08) }, label);
  mark(timeline, context, "scene-complete", ">");
  return timeline;
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
