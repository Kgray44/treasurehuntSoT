import type { SceneBuildContext, SceneDefinition } from "../core/animation-types";
import { Flip, SplitText } from "../core/gsap-client";
import { distance, mark, parts, sceneTimeline, seconds, settle } from "./scene-utils";

function simpleOpening(context: SceneBuildContext, label = "attention") {
  const timeline = sceneTimeline(context);
  mark(timeline, context, label, 0);
  timeline.to(parts(context.root, "workspace-light"), { opacity: 0.72, duration: seconds(context, 0.35) });
  mark(timeline, context, "await-server", ">");
  return timeline;
}

export const journalOpenScene: SceneDefinition = {
  name: "journal-open",
  buildOpening(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "clasp-awakens", 0);
    timeline.to(parts(context.root, "journal-clasp"), {
      rotate: distance(context, 24),
      x: distance(context, 12),
      duration: seconds(context, 0.48),
    });
    mark(timeline, context, "physical-open", ">");
    timeline.to(parts(context.root, "journal-cover"), {
      rotateY: distance(context, -18),
      duration: seconds(context, 0.58),
    });
    mark(timeline, context, "await-server", ">");
    return timeline;
  },
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "content-readable", 0);
    timeline.fromTo(
      parts(context.root, "page-dust"),
      { opacity: 0 },
      { opacity: 0.7, duration: seconds(context, 0.34) },
    );
    return settle(timeline, context);
  },
};

function releaseSeconds(context: SceneBuildContext, value: number) {
  return seconds(context, context.mode === "full" ? value * 0.72 : value);
}

export const chapterReleaseScene: SceneDefinition = {
  name: "chapter-release",
  buildOpening(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "omen", 0);
    timeline.to(parts(context.root, "workspace-light"), { opacity: 0.42, duration: releaseSeconds(context, 0.65) });
    timeline.to(
      parts(context.root, "lantern"),
      { opacity: 0.62, duration: releaseSeconds(context, 0.16), repeat: 3, yoyo: true },
      "omen+=0.18",
    );
    mark(timeline, context, "attention", ">-0.05");
    timeline.to(
      parts(context.root, "peripheral"),
      { opacity: 0.28, scale: context.mode === "full" ? 0.97 : 1, duration: releaseSeconds(context, 0.55) },
      "attention",
    );
    timeline.to(
      parts(context.root, "journal-stage"),
      { scale: context.mode === "full" ? 1.035 : 1, duration: releaseSeconds(context, 0.55) },
      "attention",
    );
    mark(timeline, context, "await-server", ">");
    return timeline;
  },
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    const cracks = parts(context.root, "seal-crack");
    const parchment = parts(context.root, "sealed-parchment");
    const headings = parts(context.root, "ink-heading");
    const prose = parts(context.root, "ink-story");
    const objective = parts(context.root, "ink-objective");
    const riddle = parts(context.root, "ink-riddle");
    const route = parts(context.root, "route-path");
    const quill = parts(context.root, "quill")[0];
    const quillPath = context.root.querySelector<SVGPathElement>("[data-quill-path]");
    const splits: Array<{ revert: () => void; lines: Element[]; words: Element[] }> = [];
    for (const target of [...headings, ...prose, ...riddle]) {
      const split = SplitText.create(target, { type: "lines,words", mask: "lines", autoSplit: true, aria: "auto" });
      splits.push(split);
    }
    context.addCleanup(() => splits.forEach((split) => split.revert()));

    mark(timeline, context, "seal", 0);
    timeline.fromTo(
      cracks,
      { drawSVG: "0%" },
      { drawSVG: "100%", duration: releaseSeconds(context, 0.82), stagger: releaseSeconds(context, 0.05) },
      "seal",
    );
    timeline.to(
      parts(context.root, "seal"),
      { scale: 1.16, rotate: distance(context, 9), duration: releaseSeconds(context, 0.48) },
      "seal",
    );
    timeline.to(parts(context.root, "seal-fragment"), {
      x: (i) => distance(context, i ? 32 : -28),
      y: distance(context, 24),
      rotate: (i) => (i ? 26 : -22),
      opacity: 0,
      duration: releaseSeconds(context, 0.5),
      stagger: releaseSeconds(context, 0.04),
    });
    mark(timeline, context, "parchment", ">-0.08");
    timeline.to(
      parchment,
      {
        rotateX: 0,
        y: 0,
        boxShadow: "0 26px 60px rgba(0,0,0,.28)",
        duration: releaseSeconds(context, 1.15),
      },
      "parchment",
    );
    timeline.fromTo(
      parts(context.root, "page-light"),
      { xPercent: -120, opacity: 0 },
      { xPercent: 120, opacity: 0.75, duration: releaseSeconds(context, 0.85) },
      "parchment+=0.2",
    );
    mark(timeline, context, "ink-heading", ">-0.1");
    const headingLines = splits
      .slice(0, headings.length)
      .flatMap((split, index) =>
        split.lines.length ? split.lines : split.words.length ? split.words : [headings[index]],
      );
    timeline.fromTo(
      headingLines,
      { yPercent: 105, opacity: 0 },
      {
        yPercent: 0,
        opacity: 1,
        duration: releaseSeconds(context, 0.38),
        stagger: releaseSeconds(context, 0.06),
      },
      "ink-heading",
    );
    mark(timeline, context, "ink-story", ">-0.04");
    const storyLines = splits
      .slice(headings.length, headings.length + prose.length)
      .flatMap((split, index) =>
        split.lines.length ? split.lines : split.words.length ? split.words : [prose[index]],
      );
    timeline.fromTo(
      storyLines,
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
    if (quill && quillPath && context.mode !== "reduced") {
      timeline.fromTo(quill, { opacity: 0 }, { opacity: 1, duration: releaseSeconds(context, 0.1) }, "ink-story");
      timeline.to(
        quill,
        {
          motionPath: { path: quillPath, align: quillPath, autoRotate: true, alignOrigin: [0.2, 0.8] },
          duration: releaseSeconds(context, 1.05),
          ease: "none",
        },
        "ink-story",
      );
    }
    mark(timeline, context, "ink-objective", ">-0.12");
    timeline.fromTo(
      objective,
      { opacity: 0, y: distance(context, 14), rotate: distance(context, -1.5) },
      { opacity: 1, y: 0, rotate: 0, duration: releaseSeconds(context, 0.42) },
      "ink-objective",
    );
    mark(timeline, context, "ink-riddle", ">-0.06");
    const riddleLines = splits
      .slice(headings.length + prose.length)
      .flatMap((split, index) =>
        split.lines.length ? split.lines : split.words.length ? split.words : [riddle[index]],
      );
    timeline.fromTo(
      riddleLines,
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
    timeline.fromTo(route, { drawSVG: "0%" }, { drawSVG: "100%", duration: releaseSeconds(context, 0.68) }, "map");
    timeline.to(
      parts(context.root, "map-fog"),
      { opacity: 0.16, scale: 1.06, duration: releaseSeconds(context, 0.62) },
      "map",
    );
    mark(timeline, context, "active", ">");
    timeline.to(
      parts(context.root, "peripheral"),
      { opacity: 1, scale: 1, duration: releaseSeconds(context, 0.35) },
      "active",
    );
    timeline.to(
      parts(context.root, "workspace-light"),
      { opacity: 1, duration: releaseSeconds(context, 0.35) },
      "active",
    );
    mark(timeline, context, "content-readable", ">");
    return settle(timeline, context);
  },
};

function drawScene(name: SceneDefinition["name"], label: string, target: string): SceneDefinition {
  return {
    name,
    reversible: true,
    buildOpening: (context) => simpleOpening(context),
    buildSuccess(context) {
      const timeline = sceneTimeline(context);
      mark(timeline, context, label, 0);
      timeline.fromTo(
        parts(context.root, target),
        { drawSVG: "0%", opacity: 0.4 },
        { drawSVG: "100%", opacity: 1, duration: seconds(context, 0.9) },
      );
      return settle(timeline, context);
    },
  };
}

export const mapRevealScene: SceneDefinition = {
  name: "map-reveal",
  reversible: true,
  buildOpening: (context) => simpleOpening(context, "fog-gathering"),
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "fog-parting", 0);
    timeline.to(parts(context.root, "map-fog"), {
      clipPath: "circle(18% at 62% 44%)",
      opacity: 0.22,
      duration: seconds(context, 0.75),
    });
    mark(timeline, context, "marker-stamp", ">-0.08");
    timeline.fromTo(
      parts(context.root, "map-marker-new"),
      { scale: 2.4, opacity: 0, rotate: -18 },
      { scale: 1, opacity: 1, rotate: 0, duration: seconds(context, 0.42), ease: "back.out(2)" },
    );
    timeline.fromTo(
      parts(context.root, "route-path"),
      { drawSVG: "0%" },
      { drawSVG: "100%", duration: seconds(context, 0.8) },
    );
    return settle(timeline, context);
  },
};

export const routeDrawScene = drawScene("route-draw", "route-drawing", "route-path");
export const markerStampScene: SceneDefinition = {
  name: "marker-stamp",
  buildOpening: (context) => simpleOpening(context),
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "marker-stamp", 0);
    timeline.fromTo(
      parts(context.root, "map-marker-new"),
      { scale: 2, opacity: 0 },
      { scale: 1, opacity: 1, duration: seconds(context, 0.42), ease: "back.out(2)" },
    );
    return settle(timeline, context);
  },
};

export const shipCourseScene: SceneDefinition = {
  name: "ship-course",
  reversible: true,
  buildOpening: (context) => simpleOpening(context),
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    const ship = parts(context.root, "ship-token");
    const path = context.root.querySelector<SVGPathElement>("[data-route-motion-path]");
    mark(timeline, context, "ship-underway", 0);
    if (path)
      timeline.to(ship, {
        motionPath: { path, align: path, autoRotate: true },
        duration: seconds(context, 1.2),
        ease: "power1.inOut",
      });
    return settle(timeline, context);
  },
};

function flipArtifact(context: SceneBuildContext) {
  const source = context.root.querySelector<HTMLElement>("[data-scene-part='artifact-reveal']");
  const slot = context.root.querySelector<HTMLElement>("[data-scene-part='artifact-slot-target']");
  if (!source || !slot) return null;
  const clone = source.cloneNode(true) as HTMLElement;
  clone.dataset.flipClone = "true";
  const rect = source.getBoundingClientRect();
  Object.assign(clone.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    zIndex: "80",
  });
  document.body.appendChild(clone);
  const state = Flip.getState(clone);
  slot.appendChild(clone);
  clone.style.position = "absolute";
  clone.style.left = "50%";
  clone.style.top = "50%";
  clone.style.width = "80px";
  clone.style.height = "80px";
  const tween = Flip.from(state, {
    paused: true,
    duration: seconds(context, 0.82),
    ease: "forever-settle",
    absolute: true,
  });
  context.addCleanup(() => clone.remove());
  return tween;
}

export const artifactAwardScene: SceneDefinition = {
  name: "artifact-award",
  buildOpening: (context) => simpleOpening(context, "velvet-darkening"),
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "silhouette", 0);
    timeline.fromTo(
      parts(context.root, "artifact-reveal"),
      { opacity: 0, scale: 0.65, rotateY: -48 },
      { opacity: 1, scale: 1, rotateY: 0, duration: seconds(context, 0.82) },
    );
    mark(timeline, context, "light-sweep", ">-0.12");
    timeline.fromTo(
      parts(context.root, "artifact-light"),
      { xPercent: -140, opacity: 0 },
      { xPercent: 140, opacity: 0.85, duration: seconds(context, 0.68) },
    );
    const flip = flipArtifact(context);
    if (flip) timeline.add(flip, ">");
    mark(timeline, context, "artifact-settled", ">");
    return settle(timeline, context);
  },
};

export const artifactConnectionScene = drawScene(
  "artifact-connection",
  "connection-drawing",
  "artifact-connection-path",
);
export const artifactInspectionScene: SceneDefinition = {
  name: "artifact-inspection",
  buildOpening: (context) => simpleOpening(context),
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "engraving-reveal", 0);
    timeline.fromTo(
      parts(context.root, "artifact-engraving"),
      { clipPath: "inset(0 100% 0 0)" },
      { clipPath: "inset(0 0% 0 0)", duration: seconds(context, 0.7) },
    );
    return settle(timeline, context);
  },
};

export const questDiscoveryScene: SceneDefinition = {
  name: "quest-discovery",
  buildOpening: (context) => simpleOpening(context),
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "note-unfolds", 0);
    timeline.fromTo(
      parts(context.root, "quest-note-new"),
      { y: distance(context, -42), rotate: -4, opacity: 0 },
      { y: 0, rotate: 0, opacity: 1, duration: seconds(context, 0.72) },
    );
    timeline.fromTo(
      parts(context.root, "red-thread"),
      { drawSVG: "0%" },
      { drawSVG: "100%", duration: seconds(context, 0.62) },
    );
    return settle(timeline, context);
  },
};

export const questCompleteScene: SceneDefinition = {
  name: "quest-complete",
  buildOpening: (context) => simpleOpening(context),
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "completion-stamp", 0);
    timeline.fromTo(
      parts(context.root, "quest-stamp"),
      { y: distance(context, -48), scale: 1.6, opacity: 0 },
      { y: 0, scale: 1, opacity: 1, duration: seconds(context, 0.42), ease: "back.out(1.8)" },
    );
    return settle(timeline, context);
  },
};

export const logEntryScene: SceneDefinition = {
  name: "log-entry",
  buildOpening: (context) => simpleOpening(context),
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "date-written", 0);
    timeline.fromTo(
      parts(context.root, "log-entry-new"),
      { opacity: 0, y: distance(context, 18) },
      { opacity: 1, y: 0, duration: seconds(context, 0.48) },
    );
    timeline.fromTo(
      parts(context.root, "log-symbol-new"),
      { scale: 2, opacity: 0 },
      { scale: 1, opacity: 1, duration: seconds(context, 0.3), ease: "back.out(2)" },
    );
    return settle(timeline, context);
  },
};

export const finaleTeaseScene: SceneDefinition = {
  name: "finale-tease",
  buildOpening: (context) => simpleOpening(context, "fog-gathering"),
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    mark(timeline, context, "mechanism-wakes", 0);
    timeline.to(parts(context.root, "finale-ring-outer"), {
      rotate: distance(context, 36),
      duration: seconds(context, 1.1),
    });
    timeline.to(
      parts(context.root, "finale-ring-inner"),
      { rotate: distance(context, -54), duration: seconds(context, 1.1) },
      "<",
    );
    timeline.fromTo(
      parts(context.root, "finale-light-path"),
      { drawSVG: "0%" },
      { drawSVG: "100%", duration: seconds(context, 0.82) },
      "<+0.18",
    );
    mark(timeline, context, "core-sealed", ">");
    return settle(timeline, context);
  },
};

export const finaleRequirementScene = drawScene("finale-requirement", "requirement-activates", "finale-light-path");

export const manualPageFlipScene: SceneDefinition = {
  name: "manual-page-flip",
  buildOpening: (context) => simpleOpening(context, "physical-open"),
  buildSuccess: (context) => settle(sceneTimeline(context), context, 0),
};
export const programmaticPageFlipScene: SceneDefinition = { ...manualPageFlipScene, name: "programmatic-page-flip" };
export const chapterHeadingScene: SceneDefinition = {
  ...chapterReleaseScene,
  name: "chapter-heading",
  buildOpening: (context) => simpleOpening(context),
};
export const proseInkScene: SceneDefinition = {
  ...chapterReleaseScene,
  name: "prose-ink",
  buildOpening: (context) => simpleOpening(context),
};
export const sealBreakScene: SceneDefinition = {
  ...chapterReleaseScene,
  name: "seal-break",
  buildOpening: (context) => simpleOpening(context),
  buildSuccess(context) {
    const timeline = sceneTimeline(context);
    const cracks = parts(context.root, "seal-crack");
    const seals = parts(context.root, "seal");
    const fragments = parts(context.root, "seal-fragment");
    mark(timeline, context, "seal", 0);
    if (cracks.length) {
      timeline.fromTo(
        cracks,
        { drawSVG: "0%" },
        { drawSVG: "100%", duration: seconds(context, 0.82), stagger: seconds(context, 0.05) },
        "seal",
      );
    }
    if (seals.length) {
      timeline.to(seals, { scale: 1.16, rotate: distance(context, 9), duration: seconds(context, 0.48) }, "seal");
    }
    if (fragments.length) {
      timeline.to(fragments, {
        x: (index) => distance(context, index ? 32 : -28),
        y: distance(context, 24),
        rotate: (index) => (index ? 26 : -22),
        opacity: 0,
        duration: seconds(context, 0.5),
        stagger: seconds(context, 0.04),
      });
    }
    return settle(timeline, context);
  },
};
