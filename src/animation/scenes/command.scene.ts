import type { AnimationSceneName, SceneBuildContext, SceneDefinition } from "../core/animation-types";
import { distance, idleTimeline, mark, parts, sceneTimeline, seconds, settle } from "./scene-utils";

function opening(context: SceneBuildContext, label: string) {
  const timeline = sceneTimeline(context);
  const lights = parts(context.root, "command-light");
  mark(timeline, context, label, 0);
  if (lights.length) timeline.to(lights, { opacity: 0.8, duration: seconds(context, 0.28) });
  else timeline.to(context.root, { duration: seconds(context, 0.28) });
  mark(timeline, context, "await-server", ">");
  return timeline;
}

function commandScene(
  name: AnimationSceneName,
  openingLabel: string,
  successLabel: string,
  target: string,
  failureLabel = "mark-restoring",
): SceneDefinition {
  return {
    name,
    reversible: name === "undo",
    buildOpening: (context) => opening(context, openingLabel),
    buildIdle: (context) => idleTimeline(context, ["command-light", target]),
    buildSuccess(context) {
      const timeline = sceneTimeline(context);
      mark(timeline, context, "success-branch", 0);
      mark(timeline, context, successLabel, 0);
      const nodes = parts(context.root, target);
      if (!nodes.length) timeline.to(context.root, { duration: seconds(context, 0.2) });
      else if (name === "pause")
        timeline.to(nodes, { opacity: 0.35, rotate: distance(context, -8), duration: seconds(context, 0.7) });
      else if (name === "resume")
        timeline.fromTo(
          nodes,
          { opacity: 0.35, rotate: distance(context, -8) },
          { opacity: 1, rotate: 0, duration: seconds(context, 0.7) },
        );
      else if (name === "undo")
        timeline.to(nodes, {
          rotate: distance(context, -28),
          x: distance(context, -18),
          opacity: 0.24,
          duration: seconds(context, 0.72),
        });
      else
        timeline.fromTo(
          nodes,
          { opacity: 0, scale: 1.8, y: distance(context, -18) },
          { opacity: 1, scale: 1, y: 0, duration: seconds(context, 0.68), ease: "back.out(1.7)" },
        );
      return settle(timeline, context);
    },
    buildFailure(context) {
      const timeline = sceneTimeline(context);
      mark(timeline, context, "failure-branch", 0);
      mark(timeline, context, failureLabel, 0);
      const nodes = parts(context.root, target);
      if (nodes.length) {
        timeline.to(nodes, {
          opacity: 0.25,
          scale: 0.92,
          duration: seconds(context, 0.24),
          yoyo: true,
          repeat: 1,
        });
      } else timeline.to(context.root, { duration: seconds(context, 0.2) });
      return settle(timeline, context);
    },
  };
}

export const prepareChapterScene = commandScene(
  "prepare-chapter",
  "ink-gathering",
  "ready-stamp",
  "blank-page",
  "ink-receding",
);
export const markSolvedScene = commandScene(
  "mark-solved",
  "stamp-rising",
  "captain-stamp",
  "solved-stamp",
  "stamp-withdrawn",
);
export const pauseScene = commandScene("pause", "wind-falling", "pause-stamp", "lantern", "wind-returning");
export const resumeScene = commandScene("resume", "pause-lifting", "lantern-kindling", "lantern", "pause-restoring");
export const undoScene = commandScene("undo", "reversal-gathering", "ink-absorbing", "undo-mark", "mark-restoring");
