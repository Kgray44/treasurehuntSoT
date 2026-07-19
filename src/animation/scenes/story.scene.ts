import type {
  AnimationSceneName,
  SceneBuildContextV2,
  SceneDefinition,
  SceneDefinitionV2,
} from "../core/animation-types";
import {
  animatedPropertiesForTweenVars,
  distance,
  fromToTargets,
  mark,
  parts,
  sceneTimeline,
  seconds,
  settle,
  settleV2,
  toTargets,
  withTarget,
  withTargetProperties,
} from "./scene-utils";

function simpleOpening(context: SceneBuildContextV2, label = "attention") {
  const timeline = sceneTimeline(context);
  mark(timeline, context, label, 0);
  toTargets(timeline, context, "workspace-light", {
    opacity: 0.72,
    duration: seconds(context, 0.35),
  });
  mark(timeline, context, "await-server", ">");
  return timeline;
}

function tombstoneScene(
  name: AnimationSceneName,
  disposition: "future-contract-static" | "deprecated-tombstone",
): SceneDefinitionV2 {
  return {
    name,
    buildOpening(context) {
      const timeline = sceneTimeline(context);
      mark(timeline, context, disposition, 0);
      mark(timeline, context, "await-server", ">");
      return timeline;
    },
    buildSuccess(context) {
      const timeline = sceneTimeline(context);
      mark(timeline, context, "content-readable", 0);
      return settleV2(timeline, context);
    },
  };
}

function releaseSeconds(context: SceneBuildContextV2, value: number) {
  return seconds(context, context.mode === "full" ? value * 0.66 : value);
}

export const chapterReleaseScene: SceneDefinitionV2 = {
  name: "chapter-release",
  buildOpening(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "omen", 0);
    toTargets(timeline, context, "workspace-light", {
      opacity: 0.42,
      duration: releaseSeconds(context, 0.65),
    });
    toTargets(
      timeline,
      context,
      "lantern",
      { opacity: 0.62, duration: releaseSeconds(context, 0.16), repeat: 3, yoyo: true },
      "omen+=0.18",
    );
    mark(timeline, context, "attention", ">-0.05");
    for (const key of ["companion-header-dim", "companion-desktop-navigation-dim", "companion-mobile-navigation-dim"])
      toTargets(timeline, context, key, { opacity: 0.28, duration: releaseSeconds(context, 0.55) }, "attention");
    toTargets(
      timeline,
      context,
      "journal-stage",
      { scale: context.mode === "full" ? 1.035 : 1, duration: releaseSeconds(context, 0.55) },
      "attention",
    );
    mark(timeline, context, "await-server", ">");
    return timeline;
  },
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "seal", 0);
    fromToTargets(
      timeline,
      context,
      "seal-crack",
      { drawSVG: "0%" },
      { drawSVG: "100%", duration: releaseSeconds(context, 0.82), stagger: releaseSeconds(context, 0.05) },
      "seal",
    );
    toTargets(
      timeline,
      context,
      "seal",
      { scale: 1.16, rotate: distance(context, 9), duration: releaseSeconds(context, 0.48) },
      "seal",
    );
    toTargets(timeline, context, "seal-fragment", {
      x: (index: number) => distance(context, index ? 32 : -28),
      y: distance(context, 24),
      rotate: (index: number) => (index ? 26 : -22),
      opacity: 0,
      duration: releaseSeconds(context, 0.5),
      stagger: releaseSeconds(context, 0.04),
    });
    mark(timeline, context, "parchment", ">-0.08");
    toTargets(
      timeline,
      context,
      "global-sealed-parchment",
      { rotateX: 0, y: 0, duration: releaseSeconds(context, 1.15) },
      "parchment",
    );
    fromToTargets(
      timeline,
      context,
      "page-light",
      { xPercent: -120, opacity: 0 },
      { xPercent: 120, opacity: 0.75, duration: releaseSeconds(context, 0.85) },
      "parchment+=0.2",
    );
    mark(timeline, context, "ink-heading", ">-0.1");
    fromToTargets(
      timeline,
      context,
      "ink-heading",
      { yPercent: 105, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: releaseSeconds(context, 0.38), stagger: releaseSeconds(context, 0.06) },
      "ink-heading",
    );
    mark(timeline, context, "ink-story", ">-0.04");
    fromToTargets(
      timeline,
      context,
      "ink-story",
      { yPercent: 105, opacity: 0, filter: "blur(1px)" },
      {
        yPercent: 0,
        opacity: 1,
        filter: "blur(0px)",
        duration: releaseSeconds(context, 0.52),
        stagger: releaseSeconds(context, 0.12),
      },
      "ink-story",
    );
    if (context.mode !== "reduced") {
      withTarget(context, "quill-path", "path-drawing", (path) => {
        const motionPath = path as SVGPathElement;
        return withTargetProperties(
          context,
          "quill",
          animatedPropertiesForTweenVars(
            { opacity: 0 },
            { opacity: 1, duration: releaseSeconds(context, 0.1) },
            {
              motionPath: { path: motionPath, align: motionPath, autoRotate: true, alignOrigin: [0.2, 0.8] },
              duration: releaseSeconds(context, 1.05),
              ease: "none",
            },
          ),
          (quill) => {
            timeline.fromTo(quill, { opacity: 0 }, { opacity: 1, duration: releaseSeconds(context, 0.1) }, "ink-story");
            timeline.to(
              quill,
              {
                motionPath: { path: motionPath, align: motionPath, autoRotate: true, alignOrigin: [0.2, 0.8] },
                duration: releaseSeconds(context, 1.05),
                ease: "none",
              },
              "ink-story",
            );
          },
        );
      });
    }
    mark(timeline, context, "ink-objective", ">-0.12");
    fromToTargets(
      timeline,
      context,
      "ink-objective",
      { opacity: 0, y: distance(context, 14), rotate: distance(context, -1.5) },
      { opacity: 1, y: 0, rotate: 0, duration: releaseSeconds(context, 0.42) },
      "ink-objective",
    );
    mark(timeline, context, "ink-riddle", ">-0.06");
    fromToTargets(
      timeline,
      context,
      "ink-riddle",
      { clipPath: "inset(0 100% 0 0)", opacity: 0.35 },
      {
        clipPath: "inset(0 0% 0 0)",
        opacity: 1,
        duration: releaseSeconds(context, 0.55),
        stagger: releaseSeconds(context, 0.1),
      },
      "ink-riddle",
    );
    mark(timeline, context, "map", ">-0.06");
    fromToTargets(
      timeline,
      context,
      "route-path",
      { drawSVG: "0%" },
      { drawSVG: "100%", duration: releaseSeconds(context, 0.68) },
      "map",
    );
    toTargets(
      timeline,
      context,
      "map-fog",
      { opacity: 0.16, scale: 1.06, duration: releaseSeconds(context, 0.62) },
      "map",
    );
    mark(timeline, context, "active", ">-0.06");
    for (const key of [
      "companion-header-dim",
      "companion-desktop-navigation-dim",
      "companion-mobile-navigation-dim",
      "workspace-light",
    ])
      toTargets(timeline, context, key, { opacity: 1, duration: releaseSeconds(context, 0.35) }, "active");
    mark(timeline, context, "content-readable", ">");
    fromToTargets(
      timeline,
      context,
      "local-sealed-parchment",
      { y: distance(context, -12), rotateX: -8 },
      { y: 0, rotateX: 0, duration: releaseSeconds(context, 0.12) },
      "content-readable",
    );
    return settleV2(timeline, context);
  },
};

function drawScene(name: AnimationSceneName, label: string, target: string, localTarget?: string): SceneDefinitionV2 {
  return {
    name,
    reversible: true,
    buildOpening: (context) => simpleOpening(context),
    buildSuccess(context) {
      const timeline = sceneTimeline(context);
      mark(timeline, context, label, 0);
      fromToTargets(
        timeline,
        context,
        target,
        { drawSVG: "0%", opacity: 0.4 },
        { drawSVG: "100%", opacity: 1, duration: seconds(context, 0.9) },
      );
      if (localTarget)
        fromToTargets(
          timeline,
          context,
          localTarget,
          { drawSVG: "0%", opacity: 0.4 },
          { drawSVG: "100%", opacity: 1, duration: seconds(context, 0.54) },
          ">",
        );
      return settleV2(timeline, context);
    },
  };
}

export const mapRevealScene: SceneDefinitionV2 = {
  name: "map-reveal",
  reversible: true,
  buildOpening: (context) => simpleOpening(context, "fog-gathering"),
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "fog-parting", 0);
    toTargets(timeline, context, "map-fog", {
      clipPath: "circle(18% at 62% 44%)",
      opacity: 0.22,
      duration: seconds(context, 0.75),
    });
    mark(timeline, context, "marker-stamp", ">-0.08");
    fromToTargets(
      timeline,
      context,
      "map-marker-new",
      { scale: 2.4, opacity: 0, rotate: -18 },
      { scale: 1, opacity: 1, rotate: 0, duration: seconds(context, 0.42), ease: "back.out(2)" },
    );
    fromToTargets(
      timeline,
      context,
      "route-path",
      { drawSVG: "0%" },
      { drawSVG: "100%", duration: seconds(context, 0.8) },
    );
    fromToTargets(
      timeline,
      context,
      "local-map-marker",
      { scale: 1.32, opacity: 0.35, rotate: -8 },
      { scale: 1, opacity: 1, rotate: 0, duration: seconds(context, 0.34), ease: "back.out(1.6)" },
      ">",
    );
    return settleV2(timeline, context);
  },
};

export const routeDrawScene = drawScene("route-draw", "route-drawing", "global-route-path", "local-route-path");

export const artifactAwardScene: SceneDefinitionV2 = {
  name: "artifact-award",
  buildOpening: (context) => simpleOpening(context, "velvet-darkening"),
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "silhouette", 0);
    fromToTargets(
      timeline,
      context,
      "artifact-reveal",
      { opacity: 0, scale: 0.65, rotateY: -48 },
      { opacity: 1, scale: 1, rotateY: 0, duration: seconds(context, 0.82) },
    );
    mark(timeline, context, "light-sweep", ">-0.12");
    fromToTargets(
      timeline,
      context,
      "artifact-light",
      { xPercent: -140, opacity: 0 },
      { xPercent: 140, opacity: 0.85, duration: seconds(context, 0.68) },
    );
    mark(timeline, context, "artifact-settled", ">");
    fromToTargets(
      timeline,
      context,
      "local-artifact-slot",
      { scale: 0.9, opacity: 0.45, filter: "brightness(0.72)" },
      {
        scale: 1,
        opacity: 1,
        filter: "brightness(1)",
        duration: seconds(context, 0.42),
        ease: "back.out(1.5)",
      },
      "artifact-settled",
    );
    return settleV2(timeline, context);
  },
};

export const artifactConnectionScene = drawScene(
  "artifact-connection",
  "connection-drawing",
  "global-artifact-connection-path",
  "local-artifact-connection-path",
);

export const questDiscoveryScene: SceneDefinitionV2 = {
  name: "quest-discovery",
  buildOpening: (context) => simpleOpening(context),
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "note-unfolds", 0);
    fromToTargets(
      timeline,
      context,
      "quest-note-new",
      { y: distance(context, -42), rotate: -4, opacity: 0 },
      { y: 0, rotate: 0, opacity: 1, duration: seconds(context, 0.72) },
    );
    fromToTargets(
      timeline,
      context,
      "red-thread",
      { drawSVG: "0%" },
      { drawSVG: "100%", duration: seconds(context, 0.62) },
    );
    fromToTargets(
      timeline,
      context,
      "local-quest-note",
      { y: distance(context, -18), rotate: -2, opacity: 0.35 },
      { y: 0, rotate: 0, opacity: 1, duration: seconds(context, 0.42) },
      ">",
    );
    fromToTargets(
      timeline,
      context,
      "local-quest-red-thread",
      { drawSVG: "0%" },
      { drawSVG: "100%", duration: seconds(context, 0.38) },
      ">",
    );
    fromToTargets(
      timeline,
      context,
      "local-quest-objective",
      { y: distance(context, -8), opacity: 0.35 },
      { y: 0, opacity: 1, duration: seconds(context, 0.38) },
      ">",
    );
    return settleV2(timeline, context);
  },
};

export const questCompleteScene: SceneDefinitionV2 = {
  name: "quest-complete",
  buildOpening: (context) => simpleOpening(context),
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "completion-stamp", 0);
    fromToTargets(
      timeline,
      context,
      "global-quest-stamp",
      { y: distance(context, -48), scale: 1.6, opacity: 0 },
      { y: 0, scale: 1, opacity: 1, duration: seconds(context, 0.42), ease: "back.out(1.8)" },
    );
    fromToTargets(
      timeline,
      context,
      "local-quest-stamp",
      { y: distance(context, -24), scale: 1.35, opacity: 0.35 },
      { y: 0, scale: 1, opacity: 1, duration: seconds(context, 0.34), ease: "back.out(1.6)" },
      ">",
    );
    return settleV2(timeline, context);
  },
};

export const logEntryScene: SceneDefinitionV2 = {
  name: "log-entry",
  buildOpening: (context) => simpleOpening(context),
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "date-written", 0);
    fromToTargets(
      timeline,
      context,
      "log-entry-new",
      { opacity: 0, clipPath: "inset(0 100% 0 0)", filter: "blur(1px)" },
      { opacity: 1, clipPath: "inset(0 0% 0 0)", filter: "blur(0px)", duration: seconds(context, 0.48) },
    );
    fromToTargets(
      timeline,
      context,
      "log-symbol-new",
      { scale: 2, opacity: 0 },
      { scale: 1, opacity: 1, duration: seconds(context, 0.3), ease: "back.out(2)" },
    );
    fromToTargets(
      timeline,
      context,
      "local-log-entry",
      { opacity: 0.35, clipPath: "inset(0 100% 0 0)", filter: "blur(1px)" },
      {
        opacity: 1,
        clipPath: "inset(0 0% 0 0)",
        filter: "blur(0px)",
        duration: seconds(context, 0.36),
      },
      ">",
    );
    fromToTargets(
      timeline,
      context,
      "local-log-symbol",
      { scale: 1.6, opacity: 0.35 },
      { scale: 1, opacity: 1, duration: seconds(context, 0.28), ease: "back.out(1.6)" },
      ">",
    );
    fromToTargets(
      timeline,
      context,
      "local-journal-annotation-ink",
      { opacity: 0.3, clipPath: "inset(0 100% 0 0)", filter: "blur(1px)" },
      {
        opacity: 1,
        clipPath: "inset(0 0% 0 0)",
        filter: "blur(0px)",
        duration: seconds(context, 0.48),
      },
      ">",
    );
    return settleV2(timeline, context);
  },
};

export const finaleTeaseScene: SceneDefinitionV2 = {
  name: "finale-tease",
  buildOpening: (context) => simpleOpening(context, "fog-gathering"),
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "mechanism-wakes", 0);
    toTargets(timeline, context, "finale-ring-outer", {
      rotate: distance(context, 36),
      duration: seconds(context, 1.1),
    });
    toTargets(
      timeline,
      context,
      "finale-ring-inner",
      { rotate: distance(context, -54), duration: seconds(context, 1.1) },
      "<",
    );
    fromToTargets(
      timeline,
      context,
      "finale-light-path",
      { drawSVG: "0%" },
      { drawSVG: "100%", duration: seconds(context, 0.82) },
      "<+0.18",
    );
    mark(timeline, context, "core-sealed", ">");
    fromToTargets(
      timeline,
      context,
      "local-finale-mechanism",
      { scale: 0.96, opacity: 0.45 },
      { scale: 1, opacity: 1, duration: seconds(context, 0.42), ease: "back.out(1.4)" },
      "core-sealed",
    );
    return settleV2(timeline, context);
  },
};

export const finaleRequirementScene: SceneDefinitionV2 = {
  name: "finale-requirement",
  reversible: true,
  buildOpening: (context) => simpleOpening(context),
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "requirement-activates", 0);
    fromToTargets(
      timeline,
      context,
      "finale-light-path",
      { drawSVG: "0%", opacity: 0.4 },
      { drawSVG: "100%", opacity: 1, duration: seconds(context, 0.9) },
    );
    fromToTargets(
      timeline,
      context,
      "local-finale-requirement-socket",
      { scale: 0.82, opacity: 0.45, filter: "brightness(0.65)" },
      {
        scale: 1,
        opacity: 1,
        filter: "brightness(1)",
        duration: seconds(context, 0.46),
        ease: "back.out(1.6)",
      },
      ">",
    );
    return settleV2(timeline, context);
  },
};

export const journalOpenScene = tombstoneScene("journal-open", "deprecated-tombstone");
export const manualPageFlipScene = tombstoneScene("manual-page-flip", "deprecated-tombstone");
export const programmaticPageFlipScene = tombstoneScene("programmatic-page-flip", "deprecated-tombstone");
export const chapterHeadingScene = tombstoneScene("chapter-heading", "future-contract-static");
export const proseInkScene = tombstoneScene("prose-ink", "future-contract-static");
export const markerStampScene = tombstoneScene("marker-stamp", "future-contract-static");
export const shipCourseScene = tombstoneScene("ship-course", "future-contract-static");
export const artifactInspectionScene = tombstoneScene("artifact-inspection", "future-contract-static");

/** Bounded v1 compatibility builder for the named legacy Quartermaster command. */
export const sealBreakScene: SceneDefinition = {
  name: "seal-break",
  buildOpening(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "attention", 0);
    timeline.to(parts(context.root, "workspace-light"), { opacity: 0.72, duration: seconds(context, 0.35) });
    mark(timeline, context, "await-server", ">");
    return timeline;
  },
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    const cracks = parts(context.root, "seal-crack");
    const seals = parts(context.root, "seal");
    const fragments = parts(context.root, "seal-fragment");
    mark(timeline, context, "seal", 0);
    if (cracks.length)
      timeline.fromTo(
        cracks,
        { drawSVG: "0%" },
        { drawSVG: "100%", duration: seconds(context, 0.82), stagger: seconds(context, 0.05) },
      );
    if (seals.length)
      timeline.to(seals, { scale: 1.16, rotate: distance(context, 9), duration: seconds(context, 0.48) }, "seal");
    if (fragments.length)
      timeline.to(fragments, {
        x: (index) => distance(context, index ? 32 : -28),
        y: distance(context, 24),
        rotate: (index) => (index ? 26 : -22),
        opacity: 0,
        duration: seconds(context, 0.5),
        stagger: seconds(context, 0.04),
      });
    return settle(timeline, context);
  },
};
