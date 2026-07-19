import { describe, expect, it } from "vitest";
import { sceneNames } from "@/animation/core/animation-types";
import type { ClientProgressEvent } from "@/domain/story";
import {
  phase3PlayerProgressEventTypes,
  progressionPresentationPriorities,
  type Phase3PlayerProgressEventType,
} from "./contracts";
import {
  isPhase3PlayerProgressEventType,
  policyForProgressionEvent,
  progressionEventPresentationPolicy,
} from "./event-policy";

const expectedEvents = [
  "CHAPTER_RELEASED",
  "CHAPTER_SOLVED",
  "ARTIFACT_AWARDED",
  "ARTIFACT_SILHOUETTE_REVEALED",
  "ARTIFACT_CONNECTED",
  "MAP_LOCATION_REVEALED",
  "MAP_ROUTE_REVEALED",
  "SIDE_QUEST_DISCOVERED",
  "SIDE_QUEST_UPDATED",
  "SIDE_QUEST_COMPLETED",
  "JOURNAL_ANNOTATION_ADDED",
  "PLAYER_LOG_ENTRY_ADDED",
  "FINALE_TEASED",
  "FINALE_REQUIREMENT_UPDATED",
  "CAMPAIGN_PAUSED",
  "CAMPAIGN_RESUMED",
  "STATE_REVERTED",
] as const satisfies readonly ClientProgressEvent["type"][];

describe("Phase 3 progression event policy", () => {
  it("freezes the exact 17-event compatibility surface", () => {
    expect(phase3PlayerProgressEventTypes).toEqual(expectedEvents);
    expect(Object.keys(progressionEventPresentationPolicy).sort()).toEqual([...expectedEvents].sort());
    expect(new Set(phase3PlayerProgressEventTypes).size).toBe(17);
  });

  it.each(expectedEvents)("declares all 18 policy fields for %s", (eventType) => {
    const declaration = policyForProgressionEvent(eventType);
    expect(Object.keys(declaration)).toHaveLength(18);
    expect(sceneNames).toContain(declaration.sceneName);
    expect(declaration.globalPresentation.requiredTargets).toEqual(
      expect.arrayContaining(["progression-readable-heading", "progression-readable-summary"]),
    );
    expect(declaration.replayPolicy).toMatchObject({ eligible: true, sourcePrecedence: "behind-authoritative" });
    expect(declaration.oneShotScope).toBe("event-id");
  });

  it("keeps priority classes in the frozen narrative order", () => {
    expect(progressionPresentationPriorities.ceremony).toBeGreaterThan(progressionPresentationPriorities.reversal);
    expect(progressionPresentationPriorities.reversal).toBeGreaterThan(progressionPresentationPriorities.state);
    expect(progressionPresentationPriorities.state).toBeGreaterThan(progressionPresentationPriorities.finale);
    expect(progressionPresentationPriorities.finale).toBeGreaterThan(progressionPresentationPriorities.artifact);
    expect(progressionPresentationPriorities.artifact).toBeGreaterThan(progressionPresentationPriorities.chapter);
    expect(progressionPresentationPriorities.chapter).toBeGreaterThan(progressionPresentationPriorities.section);
    expect(progressionPresentationPriorities.section).toBeGreaterThan(progressionPresentationPriorities.informational);
    expect(progressionEventPresentationPolicy.CHAPTER_RELEASED.priority).toBe(
      progressionPresentationPriorities.ceremony,
    );
  });

  it("declares dedicated quest-update and journal-annotation behavior without new registry scenes", () => {
    const discovery = progressionEventPresentationPolicy.SIDE_QUEST_DISCOVERED;
    const update = progressionEventPresentationPolicy.SIDE_QUEST_UPDATED;
    expect(update.sceneName).toBe(discovery.sceneName);
    expect(update.globalPresentation.heading).not.toBe(discovery.globalPresentation.heading);
    expect(update.localEnhancement?.requiredHandleKeys).toEqual(["quest-objective"]);
    expect(update.notificationPolicy.stacking).toBe("coalesce-by-event-type");

    const annotation = progressionEventPresentationPolicy.JOURNAL_ANNOTATION_ADDED;
    const log = progressionEventPresentationPolicy.PLAYER_LOG_ENTRY_ADDED;
    expect(annotation.sceneName).toBe(log.sceneName);
    expect(annotation.relevantSection).toBe("journal");
    expect(annotation.localEnhancement?.requiredHandleKeys).toEqual(["journal-annotation-ink"]);
    expect(log.relevantSection).toBe("log");
  });

  it("makes every audio decision explicit and preserves intentional silence", () => {
    const policies = Object.values(progressionEventPresentationPolicy);
    expect(
      policies.every((entry) => entry.audio.kind === "semantic-labels" || entry.audio.kind === "intentional-silence"),
    ).toBe(true);
    expect(progressionEventPresentationPolicy.CHAPTER_RELEASED.audio).toEqual({
      kind: "semantic-labels",
      labels: [{ cue: "wax-crack", semanticLabel: "seal", motionOnly: false }],
    });
    expect(progressionEventPresentationPolicy.SIDE_QUEST_UPDATED.audio.kind).toBe("intentional-silence");
    expect(progressionEventPresentationPolicy.CAMPAIGN_RESUMED.audio.kind).toBe("intentional-silence");
  });

  it("projects only Player-safe scalar payload fields", () => {
    const projected = progressionEventPresentationPolicy.ARTIFACT_AWARDED.safePayloadProjector({
      key: "lantern",
      name: "Lantern",
      description: "Safe",
      secretGmNote: "never expose",
      nested: { secret: true },
      infinity: Number.POSITIVE_INFINITY,
    });
    expect(projected).toEqual({ key: "lantern", name: "Lantern", description: "Safe" });
    expect(projected).not.toHaveProperty("secretGmNote");
    expect(projected).not.toHaveProperty("nested");
  });

  it("narrows only policy-covered event names", () => {
    const covered: string = "STATE_REVERTED";
    expect(isPhase3PlayerProgressEventType(covered)).toBe(true);
    expect(isPhase3PlayerProgressEventType("CHAPTER_PREPARED")).toBe(false);

    if (isPhase3PlayerProgressEventType(covered)) {
      const narrowed: Phase3PlayerProgressEventType = covered;
      expect(narrowed).toBe("STATE_REVERTED");
    }
  });
});
