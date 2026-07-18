import { describe, expect, it } from "vitest";
import type { MotionMode, SceneBuildContext, SceneTimeline } from "../core/animation-types";
import { sceneRegistry } from "../director/scene-registry";

function context(mode: MotionMode = "full") {
  const cleanups: Array<() => void> = [];
  const root = document.createElement("main");
  const partNames = [
    "sky",
    "stars",
    "moon",
    "horizon",
    "fog-back",
    "fog-front",
    "ocean",
    "ship",
    "title",
    "emblem",
    "arrival-copy",
    "arrival-action",
    "nautical-border",
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
    "journal-clasp",
    "journal-cover",
    "page-dust",
    "workspace-light",
    "peripheral",
    "journal-stage",
    "sealed-parchment",
    "ink-heading",
    "ink-story",
    "ink-objective",
    "ink-riddle",
    "route-path",
    "page-light",
    "map-fog",
    "map-marker-new",
    "artifact-connection-path",
    "artifact-reveal",
    "artifact-light",
    "artifact-engraving",
    "quest-note-new",
    "red-thread",
    "quest-stamp",
    "log-entry-new",
    "log-symbol-new",
    "finale-ring-outer",
    "finale-ring-inner",
    "finale-light-path",
    "living-idle",
    "command-light",
    "blank-page",
    "solved-stamp",
    "undo-mark",
  ];
  root.innerHTML = partNames.map((name) => `<div data-scene-part="${name}">Safe development text</div>`).join("");
  const value: SceneBuildContext = {
    root,
    mode,
    sceneName: "first-arrival",
    display: {},
    emitLabel: () => undefined,
    addCleanup: (cleanup) => cleanups.push(cleanup),
  };
  return { value, cleanups };
}

const expectLabels = (timeline: SceneTimeline, labels: string[]) => {
  for (const label of labels) expect(timeline.labels).toHaveProperty(label);
};

describe("GSAP scene builders", () => {
  it.each(["full", "gentle", "reduced"] as const)("builds every scene in %s mode without starting it", (mode) => {
    for (const definition of Object.values(sceneRegistry)) {
      const built = context(mode);
      built.value.sceneName = definition.name;
      const timelines = [
        definition.buildOpening(built.value),
        definition.buildSuccess(built.value),
        definition.buildFailure?.(built.value),
        definition.buildIdle?.(built.value),
      ].filter(Boolean) as SceneTimeline[];
      for (const timeline of timelines) {
        expect(timeline.paused()).toBe(true);
        expect(timeline.labels).toHaveProperty("scene-start");
        timeline.kill();
      }
      built.cleanups.reverse().forEach((cleanup) => cleanup());
    }
  });

  it("preserves semantic checkpoints for the arrival, access, and flagship chapter ceremony", () => {
    const arrival = context();
    expectLabels(sceneRegistry["first-arrival"].buildOpening(arrival.value), [
      "dark-sea",
      "tide-arrives",
      "title-written",
      "voyage-materializes",
      "physical-open",
      "await-server",
    ]);

    const access = context();
    expectLabels(sceneRegistry["player-access"].buildSuccess(access.value), [
      "success-branch",
      "seal-released",
      "invitation-unfolds",
      "content-readable",
    ]);

    const chapter = context();
    expectLabels(sceneRegistry["chapter-release"].buildSuccess(chapter.value), [
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
    chapter.cleanups.reverse().forEach((cleanup) => cleanup());
  });

  it("provides truthful failure checkpoints for authenticated and GM operations", () => {
    const access = context();
    expectLabels(sceneRegistry["player-access"].buildFailure!(access.value), ["failure-branch", "lock-rejected"]);
    const prepare = context();
    expectLabels(sceneRegistry["prepare-chapter"].buildFailure!(prepare.value), ["failure-branch", "ink-receding"]);
  });
});
