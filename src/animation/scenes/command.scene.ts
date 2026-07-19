import type {
  AnimationSceneName,
  SceneBuildContext,
  SceneBuildContextV2,
  SceneDefinition,
  SceneDefinitionV2,
} from "../core/animation-types";
import {
  distance,
  fromToTargets,
  idleTimeline,
  mark,
  parts,
  sceneTimeline,
  seconds,
  settle,
  settleV2,
  toTargets,
} from "./scene-utils";

function opening(context: SceneBuildContext, label: string) {
  const timeline = sceneTimeline(context);
  const lights = parts(context.root, "command-light");
  mark(timeline, context, label, 0);
  if (lights.length) timeline.to(lights, { opacity: 0.8, duration: seconds(context, 0.28) });
  else timeline.to(context.root, { duration: seconds(context, 0.28) });
  mark(timeline, context, "await-server", ">");
  return timeline;
}

function legacyCommandScene(
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

function v2Opening(context: SceneBuildContextV2, label: string) {
  const timeline = sceneTimeline(context);
  mark(timeline, context, label, 0);
  toTargets(timeline, context, "command-light", { opacity: 0.8, duration: seconds(context, 0.28) });
  mark(timeline, context, "await-server", ">");
  return timeline;
}

function v2CommandScene(
  name: AnimationSceneName,
  openingLabel: string,
  successLabel: string,
  target: string,
  failureLabel = "mark-restoring",
): SceneDefinitionV2 {
  return {
    name,
    reversible: name === "undo",
    buildOpening: (context) => v2Opening(context, openingLabel),
    buildIdle(context) {
      const timeline = sceneTimeline(context);
      mark(timeline, context, "await-server", 0);
      toTargets(timeline, context, "command-light", {
        opacity: 0.72,
        duration: seconds(context, 0.8),
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
      toTargets(timeline, context, target, {
        opacity: 0.72,
        scale: context.mode === "reduced" ? 1 : 1.025,
        duration: seconds(context, 0.8),
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
      return timeline;
    },
    buildSuccess(context) {
      const timeline = sceneTimeline(context);
      mark(timeline, context, "success-branch", 0);
      mark(timeline, context, successLabel, 0);
      if (name === "pause")
        toTargets(timeline, context, target, {
          opacity: 0.35,
          rotate: distance(context, -8),
          duration: seconds(context, 0.7),
        });
      else if (name === "resume")
        fromToTargets(
          timeline,
          context,
          target,
          { opacity: 0.35, rotate: distance(context, -8) },
          { opacity: 1, rotate: 0, duration: seconds(context, 0.7) },
        );
      else if (name === "undo")
        toTargets(timeline, context, target, {
          rotate: distance(context, -28),
          x: distance(context, -18),
          opacity: 0.24,
          duration: seconds(context, 0.72),
        });
      else
        fromToTargets(
          timeline,
          context,
          target,
          { opacity: 0, scale: 1.8, y: distance(context, -18) },
          { opacity: 1, scale: 1, y: 0, duration: seconds(context, 0.68), ease: "back.out(1.7)" },
        );
      return settleV2(timeline, context);
    },
    buildFailure(context) {
      const timeline = sceneTimeline(context);
      mark(timeline, context, "failure-branch", 0);
      mark(timeline, context, failureLabel, 0);
      toTargets(timeline, context, target, {
        opacity: 0.25,
        scale: 0.92,
        duration: seconds(context, 0.24),
        yoyo: true,
        repeat: 1,
      });
      return settleV2(timeline, context);
    },
  };
}

export const prepareChapterScene = legacyCommandScene(
  "prepare-chapter",
  "ink-gathering",
  "ready-stamp",
  "blank-page",
  "ink-receding",
);
export const markSolvedScene = v2CommandScene(
  "mark-solved",
  "stamp-rising",
  "captain-stamp",
  "solved-stamp",
  "stamp-withdrawn",
);
export const pauseScene = v2CommandScene("pause", "wind-falling", "pause-stamp", "lantern", "wind-returning");
export const resumeScene = v2CommandScene("resume", "pause-lifting", "lantern-kindling", "lantern", "pause-restoring");
export const undoScene = v2CommandScene("undo", "reversal-gathering", "ink-absorbing", "undo-mark", "mark-restoring");
