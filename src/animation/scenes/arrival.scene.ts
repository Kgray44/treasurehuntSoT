import type { SceneDefinition } from "../core/animation-types";
import { distance, mark, parts, sceneTimeline, seconds, settle } from "./scene-utils";

export const firstArrivalScene: SceneDefinition = {
  name: "first-arrival",
  buildOpening(context) {
    const timeline = sceneTimeline(context);
    const sky = parts(context.root, "sky", "stars");
    const horizon = parts(context.root, "moon", "horizon");
    const fog = parts(context.root, "fog-back", "fog-front");
    const ocean = parts(context.root, "ocean");
    const ship = parts(context.root, "ship");
    const title = parts(context.root, "title");
    const emblem = parts(context.root, "emblem");
    const copy = parts(context.root, "arrival-copy");
    const action = parts(context.root, "arrival-action");
    const border = parts(context.root, "nautical-border");
    context.root.dataset.arrival = "playing";
    context.addCleanup(() => delete context.root.dataset.arrival);

    mark(timeline, context, "dark-sea", 0);
    timeline.fromTo(sky, { opacity: 0 }, { opacity: 1, duration: seconds(context, 0.8) }, "dark-sea");
    mark(timeline, context, "tide-arrives", ">-0.1");
    timeline.fromTo(
      [...horizon, ...ocean],
      { opacity: 0, y: distance(context, 20) },
      { opacity: 1, y: 0, duration: seconds(context, 1.25), stagger: seconds(context, 0.08) },
      "tide-arrives",
    );
    timeline.fromTo(
      fog,
      { opacity: 0, x: (index) => distance(context, index ? 42 : -34) },
      { opacity: 0.72, x: 0, duration: seconds(context, 1.1), stagger: seconds(context, 0.12) },
      "tide-arrives+=0.15",
    );
    if (ship.length) {
      timeline.fromTo(
        ship,
        { opacity: 0, scale: 0.92 },
        { opacity: 0.72, scale: 1, duration: seconds(context, 1) },
        "tide-arrives+=0.35",
      );
    }
    mark(timeline, context, "title-written", ">-0.08");
    timeline.fromTo(
      title,
      { clipPath: "inset(0 100% 0 0)", opacity: 0.4 },
      { clipPath: "inset(0 0% 0 0)", opacity: 1, duration: seconds(context, 1.15) },
      "title-written",
    );
    mark(timeline, context, "voyage-materializes", ">-0.14");
    if (emblem.length)
      timeline.fromTo(
        emblem,
        { opacity: 0, scale: 0.72, rotate: distance(context, -18) },
        { opacity: 1, scale: 1, rotate: 0, duration: seconds(context, 0.95) },
        "voyage-materializes",
      );
    timeline.fromTo(
      copy,
      { opacity: 0, y: distance(context, 16) },
      { opacity: 1, y: 0, duration: seconds(context, 0.7), stagger: seconds(context, 0.12) },
      "voyage-materializes+=0.24",
    );
    mark(timeline, context, "physical-open", ">-0.08");
    if (action.length)
      timeline.fromTo(
        action,
        { opacity: 0, y: distance(context, 24) },
        { opacity: 1, y: 0, duration: seconds(context, 0.62) },
        "physical-open",
      );
    if (border.length) {
      timeline.fromTo(border, { opacity: 0 }, { opacity: 1, duration: seconds(context, 0.7) }, "physical-open+=0.1");
    }
    mark(timeline, context, "await-server", ">");
    return timeline;
  },
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "content-readable", 0);
    timeline.to(context.root, { "--arrival-light": 1, duration: seconds(context, 0.25) });
    return settle(timeline, context);
  },
};

export const sessionReentryScene: SceneDefinition = {
  ...firstArrivalScene,
  name: "session-reentry",
  buildOpening(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "fog-reentry", 0);
    timeline.fromTo(
      parts(context.root, "fog-front", "title", "arrival-action"),
      { opacity: 0, y: distance(context, 8) },
      { opacity: 1, y: 0, duration: seconds(context, 0.32), stagger: seconds(context, 0.04) },
    );
    mark(timeline, context, "await-server", ">");
    return timeline;
  },
};
