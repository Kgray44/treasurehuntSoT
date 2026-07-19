import type { SceneDefinition, SceneDefinitionV2 } from "../core/animation-types";
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

export const playerAccessScene: SceneDefinition = {
  name: "player-access",
  buildOpening(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "listening", 0);
    timeline.to(parts(context.root, "invitation-ink"), {
      filter: "drop-shadow(0 0 8px #79d7cf)",
      duration: seconds(context, 0.45),
    });
    timeline.to(parts(context.root, "seal"), { scale: 1.035, duration: seconds(context, 0.32) }, "<");
    mark(timeline, context, "await-server", ">");
    return timeline;
  },
  buildIdle: (context) => idleTimeline(context, ["seal", "lantern"]),
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    const seal = parts(context.root, "seal");
    const ribbon = parts(context.root, "ribbon");
    const invitation = parts(context.root, "invitation");
    const cracks = parts(context.root, "seal-crack");
    const morph = context.root.querySelector<SVGPathElement>("[data-seal-morph]");
    const target = morph?.getAttribute("data-morph-to");
    mark(timeline, context, "success-branch", 0);
    timeline.to(seal, { filter: "drop-shadow(0 0 24px #dcae63)", scale: 1.12, duration: seconds(context, 0.4) });
    if (morph && target) timeline.to(morph, { morphSVG: target, duration: seconds(context, 0.45) }, "<");
    timeline.fromTo(cracks, { drawSVG: "0%" }, { drawSVG: "100%", duration: seconds(context, 0.42), stagger: 0.04 });
    mark(timeline, context, "seal-released", ">");
    timeline.to(seal, {
      rotate: distance(context, 22),
      y: distance(context, 44),
      opacity: 0,
      duration: seconds(context, 0.48),
    });
    timeline.to(
      ribbon,
      { x: distance(context, 86), rotate: distance(context, 8), opacity: 0.3, duration: seconds(context, 0.55) },
      "<",
    );
    mark(timeline, context, "invitation-unfolds", ">-0.1");
    timeline.to(invitation, {
      rotateX: 0,
      scale: context.mode === "full" ? 1.035 : 1,
      duration: seconds(context, 0.72),
    });
    mark(timeline, context, "content-readable", ">");
    return settle(timeline, context);
  },
  buildFailure(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "failure-branch", 0);
    timeline.to(parts(context.root, "seal"), {
      x: context.mode === "reduced" ? 0 : -4,
      rotate: context.mode === "reduced" ? 0 : -2,
      duration: seconds(context, 0.11),
      yoyo: true,
      repeat: 3,
      ease: "sine.inOut",
    });
    timeline.to(parts(context.root, "invitation-ink"), { opacity: 0.42, duration: seconds(context, 0.18) }, "<");
    mark(timeline, context, "lock-rejected", ">");
    timeline.to(parts(context.root, "invitation-ink"), { opacity: 1, duration: seconds(context, 0.2) });
    return settle(timeline, context);
  },
};

export const quartermasterLoginScene: SceneDefinition = {
  name: "quartermaster-login",
  buildOpening(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "key-turning", 0);
    timeline.to(parts(context.root, "lock"), { rotate: distance(context, 28), duration: seconds(context, 0.48) });
    timeline.to(
      parts(context.root, "door-bolt"),
      { x: distance(context, 18), duration: seconds(context, 0.34) },
      "<+0.12",
    );
    mark(timeline, context, "await-server", ">");
    return timeline;
  },
  buildIdle: (context) => idleTimeline(context, ["lantern", "lock"]),
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "success-branch", 0);
    timeline.to(parts(context.root, "cabin-door"), {
      rotateY: distance(context, -68),
      duration: seconds(context, 0.9),
    });
    timeline.fromTo(
      parts(context.root, "chart-room-light"),
      { opacity: 0 },
      { opacity: 1, duration: seconds(context, 0.72) },
      "<+0.12",
    );
    timeline.fromTo(
      parts(context.root, "login-ledger"),
      { y: distance(context, 22) },
      { y: 0, duration: seconds(context, 0.55) },
      "<",
    );
    mark(timeline, context, "content-readable", ">");
    return settle(timeline, context);
  },
  buildFailure(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "failure-branch", 0);
    timeline.to(parts(context.root, "lock"), { rotate: 0, duration: seconds(context, 0.34), ease: "back.out(2)" });
    timeline.to(parts(context.root, "door-bolt"), { x: 0, duration: seconds(context, 0.3) }, "<");
    mark(timeline, context, "lock-rejected", ">");
    return settle(timeline, context);
  },
};

export const studioPublishScene: SceneDefinitionV2 = {
  name: "studio-publish",
  buildOpening(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "publish-requested", 0);
    toTargets(timeline, context, "version-seal", {
      scale: 1.04,
      opacity: 0.72,
      filter: "drop-shadow(0 0 14px #dcae63)",
      duration: seconds(context, 0.34),
    });
    toTargets(timeline, context, "publish-ledger", { opacity: 0.72, duration: seconds(context, 0.24) }, "<");
    mark(timeline, context, "await-server", ">");
    return timeline;
  },
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "version-authorized", 0);
    toTargets(timeline, context, "version-seal", {
      scale: 1.14,
      opacity: 1,
      rotate: distance(context, -9),
      filter: "drop-shadow(0 0 28px #f0d18a)",
      duration: seconds(context, 0.38),
    });
    fromToTargets(
      timeline,
      context,
      "release-ribbon",
      { scaleX: 0, opacity: 0 },
      { scaleX: 1, opacity: 1, duration: seconds(context, 0.52) },
      "<+0.08",
    );
    toTargets(timeline, context, "publish-ledger", {
      y: distance(context, -12),
      opacity: 1,
      duration: seconds(context, 0.42),
    });
    mark(timeline, context, "version-readable", ">");
    return settleV2(timeline, context);
  },
  buildFailure(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "publish-rejected", 0);
    toTargets(timeline, context, "version-seal", {
      scale: 1,
      opacity: 0.01,
      rotate: 0,
      filter: "none",
      duration: seconds(context, 0.26),
    });
    toTargets(timeline, context, "publish-ledger", { opacity: 1, y: 0, duration: seconds(context, 0.2) }, "<");
    mark(timeline, context, "draft-readable", ">");
    return settleV2(timeline, context);
  },
};
