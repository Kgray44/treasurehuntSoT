import type { SceneDefinitionV2 } from "../core/animation-types";
import { distance, fromToTargets, mark, sceneTimeline, seconds, settleV2 } from "./scene-utils";

export const firstArrivalScene: SceneDefinitionV2 = {
  name: "first-arrival",
  buildOpening(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "dark-sea", 0);
    for (const key of ["sky", "stars"])
      fromToTargets(
        timeline,
        context,
        key,
        { opacity: 0 },
        { opacity: 1, duration: seconds(context, 0.8) },
        "dark-sea",
      );
    mark(timeline, context, "tide-arrives", ">-0.1");
    for (const key of ["moon", "horizon", "ocean"])
      fromToTargets(
        timeline,
        context,
        key,
        { opacity: 0, y: distance(context, 20) },
        { opacity: 1, y: 0, duration: seconds(context, 1.25), stagger: seconds(context, 0.08) },
        "tide-arrives",
      );
    for (const [key, x] of [
      ["fog-back", -34],
      ["fog-front", 42],
    ] as const)
      fromToTargets(
        timeline,
        context,
        key,
        { opacity: 0, x: distance(context, x) },
        { opacity: 0.72, x: 0, duration: seconds(context, 1.1), stagger: seconds(context, 0.12) },
        "tide-arrives+=0.15",
      );
    fromToTargets(
      timeline,
      context,
      "ship",
      { opacity: 0, scale: 0.92 },
      { opacity: 0.72, scale: 1, duration: seconds(context, 1) },
      "tide-arrives+=0.35",
    );
    mark(timeline, context, "title-written", ">-0.08");
    fromToTargets(
      timeline,
      context,
      "title",
      { clipPath: "inset(0 100% 0 0)", opacity: 0.4 },
      { clipPath: "inset(0 0% 0 0)", opacity: 1, duration: seconds(context, 1.15) },
      "title-written",
    );
    mark(timeline, context, "voyage-materializes", ">-0.14");
    fromToTargets(
      timeline,
      context,
      "emblem",
      { opacity: 0, scale: 0.72, rotate: distance(context, -18) },
      { opacity: 1, scale: 1, rotate: 0, duration: seconds(context, 0.95) },
      "voyage-materializes",
    );
    fromToTargets(
      timeline,
      context,
      "arrival-copy",
      { opacity: 0, y: distance(context, 16) },
      { opacity: 1, y: 0, duration: seconds(context, 0.7), stagger: seconds(context, 0.12) },
      "voyage-materializes+=0.24",
    );
    mark(timeline, context, "physical-open", ">-0.08");
    fromToTargets(
      timeline,
      context,
      "arrival-action",
      { opacity: 0, y: distance(context, 24) },
      { opacity: 1, y: 0, duration: seconds(context, 0.62) },
      "physical-open",
    );
    fromToTargets(
      timeline,
      context,
      "nautical-border",
      { opacity: 0 },
      { opacity: 1, duration: seconds(context, 0.7) },
      "physical-open+=0.1",
    );
    mark(timeline, context, "await-server", ">");
    return timeline;
  },
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "content-readable", 0);
    return settleV2(timeline, context);
  },
};

export const sessionReentryScene: SceneDefinitionV2 = {
  ...firstArrivalScene,
  name: "session-reentry",
  buildOpening(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "fog-reentry", 0);
    for (const key of ["fog-front", "title", "arrival-action"])
      fromToTargets(
        timeline,
        context,
        key,
        { opacity: 0, y: distance(context, 8) },
        { opacity: 1, y: 0, duration: seconds(context, 0.32), stagger: seconds(context, 0.04) },
      );
    mark(timeline, context, "await-server", ">");
    return timeline;
  },
};
