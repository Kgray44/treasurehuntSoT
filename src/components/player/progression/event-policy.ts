import type { AnimationSceneName } from "@/animation/core/animation-types";
import { sanitizeEventPayload } from "@/domain/visibility";
import {
  progressionPresentationPriorities as priority,
  type GlobalProgressionPresentation,
  type Phase3PlayerProgressEventType,
  type PlayerSafePresentationPayload,
  type PlayerSectionId,
  type ProgressionAudioPolicy,
  type ProgressionEventPresentationPolicy,
  type ProgressionNotificationPolicy,
  type ProgressionPresentationPriority,
  type SectionLocalEnhancement,
} from "./contracts";

const focusBehavior = Object.freeze({
  capture: "meaningful-active-element",
  restore: "exact-destination-heading",
  preserveScroll: true,
} as const);

const replayPolicy = Object.freeze({
  eligible: true,
  historySource: "player-safe",
  sourcePrecedence: "behind-authoritative",
} as const);

const acknowledgmentPolicy = Object.freeze({
  source: "authoritative-only",
  outcomes: ["presented", "fallback", "skipped"],
  onePerEventPerDevice: true,
} as const);

const motionSemantics = Object.freeze({
  full: "staged-readable-outcome",
  gentle: "shortened-staged-readable-outcome",
  reduced: "ordered-static-readable-outcome",
} as const);

const settledStateHandoff = Object.freeze({
  target: "relevant-section-if-mounted",
  failure: "keep-global-readable-state",
} as const);

const intentionalSilence = (reason: string): ProgressionAudioPolicy =>
  Object.freeze({ kind: "intentional-silence", reason });

const local = (section: PlayerSectionId, requiredHandleKeys: readonly string[]): SectionLocalEnhancement =>
  Object.freeze({
    section,
    requiredHandleKeys: Object.freeze([...requiredHandleKeys]),
    handoff: "after-global-commit",
    blocking: false,
    acknowledgmentOwner: "none",
  });

const global = (
  heading: string,
  summaryFields: readonly string[],
  requiredTargets: readonly string[],
  announcement: GlobalProgressionPresentation["announcement"] = "polite",
): GlobalProgressionPresentation =>
  Object.freeze({
    heading,
    summaryFields: Object.freeze([...summaryFields]),
    requiredTargets: Object.freeze([
      "progression-readable-heading",
      "progression-readable-summary",
      ...requiredTargets,
    ]),
    optionalTargets: Object.freeze(["progression-decoration"]),
    announcement,
  });

const notification = (
  destinationAction: PlayerSectionId | null,
  stacking: ProgressionNotificationPolicy["stacking"] = "serialize",
  politeness: ProgressionNotificationPolicy["politeness"] = "polite",
): ProgressionNotificationPolicy =>
  Object.freeze({
    politeness,
    unseenCount: "refresh-authoritative",
    destinationAction,
    stacking,
    dismissal: stacking === "replace-state" ? "on-settle" : "user",
  });

const projector =
  (eventType: Phase3PlayerProgressEventType) =>
  (payload: Record<string, unknown>): PlayerSafePresentationPayload => {
    const sanitized = sanitizeEventPayload(eventType, payload) as PlayerSafePresentationPayload;
    if (eventType !== "CHAPTER_RELEASED") return sanitized;
    // Chapter prose reaches this boundary only through the authorized snapshot
    // reconstruction. Stored release payload prose is stripped server-side.
    const authorizedChapterFields = ["narrative", "objective", "riddle"] as const;
    return Object.freeze({
      ...sanitized,
      ...Object.fromEntries(
        authorizedChapterFields.flatMap((field) =>
          typeof payload[field] === "string" && payload[field].length <= 2_048 ? [[field, payload[field]]] : [],
        ),
      ),
    });
  };

type PolicyInput = Readonly<{
  eventType: Phase3PlayerProgressEventType;
  sceneName: AnimationSceneName;
  priority: ProgressionPresentationPriority;
  requirement?: "mandatory" | "optional";
  interruptibility?: "always" | "before-semantic-commit" | "never";
  relevantSection: PlayerSectionId | null;
  globalPresentation: GlobalProgressionPresentation;
  localEnhancement: SectionLocalEnhancement | null;
  notificationPolicy: ProgressionNotificationPolicy;
  audio: ProgressionAudioPolicy;
  fallbackHeading: string;
}>;

function policy(input: PolicyInput): ProgressionEventPresentationPolicy {
  const fallbackControls = input.relevantSection
    ? (["continue", "destination", "replay"] as const)
    : (["continue", "replay"] as const);
  return Object.freeze({
    sceneName: input.sceneName,
    priority: input.priority,
    requirement: input.requirement ?? "optional",
    interruptibility: input.interruptibility ?? "always",
    relevantSection: input.relevantSection,
    globalPresentation: input.globalPresentation,
    localEnhancement: input.localEnhancement,
    replayPolicy,
    acknowledgmentPolicy,
    focusBehavior,
    skipBehavior: Object.freeze({ allowed: true, result: "readable-final-state" }),
    notificationPolicy: input.notificationPolicy,
    audio: input.audio,
    motionSemantics,
    fallback: Object.freeze({
      heading: input.fallbackHeading,
      summaryFields: input.globalPresentation.summaryFields,
      controls: Object.freeze(fallbackControls),
      equivalentReducedOutcome: "ordered-static-readable-outcome",
      verification: "heading-and-summary-visible",
    }),
    safePayloadProjector: projector(input.eventType),
    settledStateHandoff,
    oneShotScope: "event-id",
  });
}

/**
 * Phase 3's complete presentation declaration. This map intentionally has no
 * default branch: adding or removing one of the bounded Player event types
 * fails type checking until its presentation truth is declared here.
 */
export const progressionEventPresentationPolicy = {
  CHAPTER_RELEASED: policy({
    eventType: "CHAPTER_RELEASED",
    sceneName: "chapter-release",
    priority: priority.ceremony,
    requirement: "mandatory",
    interruptibility: "before-semantic-commit",
    relevantSection: "journal",
    globalPresentation: global(
      "Chapter released",
      ["ordinal", "title", "narrative", "objective", "riddle"],
      ["sealed-parchment", "ink-heading", "ink-story", "ink-objective", "ink-riddle"],
      "assertive",
    ),
    localEnhancement: local("journal", ["sealed-parchment"]),
    notificationPolicy: notification("journal", "serialize", "assertive"),
    audio: { kind: "semantic-labels", labels: [{ cue: "wax-crack", semanticLabel: "seal", motionOnly: false }] },
    fallbackHeading: "Chapter ready to read",
  }),
  CHAPTER_SOLVED: policy({
    eventType: "CHAPTER_SOLVED",
    sceneName: "mark-solved",
    priority: priority.chapter,
    relevantSection: "journal",
    globalPresentation: global("Chapter solved", ["ordinal"], ["solved-stamp"]),
    localEnhancement: local("journal", ["chapter-solved-stamp"]),
    notificationPolicy: notification("journal"),
    audio: {
      kind: "semantic-labels",
      labels: [{ cue: "stamp-impact", semanticLabel: "captain-stamp", motionOnly: false }],
    },
    fallbackHeading: "Chapter marked solved",
  }),
  ARTIFACT_AWARDED: policy({
    eventType: "ARTIFACT_AWARDED",
    sceneName: "artifact-award",
    priority: priority.artifact,
    relevantSection: "treasures",
    globalPresentation: global("Artifact awarded", ["name", "description", "discoveryText"], ["artifact-reveal"]),
    localEnhancement: local("treasures", ["artifact-slot"]),
    notificationPolicy: notification("treasures"),
    audio: {
      kind: "semantic-labels",
      labels: [{ cue: "artifact-chime", semanticLabel: "artifact-settled", motionOnly: false }],
    },
    fallbackHeading: "Artifact added to your collection",
  }),
  ARTIFACT_SILHOUETTE_REVEALED: policy({
    eventType: "ARTIFACT_SILHOUETTE_REVEALED",
    sceneName: "artifact-award",
    priority: priority.artifact,
    relevantSection: "treasures",
    globalPresentation: global("Artifact silhouette revealed", ["safeName", "silhouetteLabel"], ["artifact-reveal"]),
    localEnhancement: local("treasures", ["artifact-slot"]),
    notificationPolicy: notification("treasures"),
    audio: intentionalSilence("A silhouette has no validated instance-scoped cue."),
    fallbackHeading: "A new artifact silhouette is visible",
  }),
  ARTIFACT_CONNECTED: policy({
    eventType: "ARTIFACT_CONNECTED",
    sceneName: "artifact-connection",
    priority: priority.section,
    relevantSection: "treasures",
    globalPresentation: global("Artifacts connected", ["key", "connectedArtifactKey"], ["artifact-connection-path"]),
    localEnhancement: local("treasures", ["artifact-connection-path"]),
    notificationPolicy: notification("treasures"),
    audio: intentionalSilence("Connection audio remains silent until a semantic scene label is authored."),
    fallbackHeading: "Artifact connection recorded",
  }),
  MAP_LOCATION_REVEALED: policy({
    eventType: "MAP_LOCATION_REVEALED",
    sceneName: "map-reveal",
    priority: priority.section,
    relevantSection: "chart",
    globalPresentation: global("Map location revealed", ["name", "regionLabel"], ["map-marker"]),
    localEnhancement: local("chart", ["map-marker"]),
    notificationPolicy: notification("chart"),
    audio: {
      kind: "semantic-labels",
      labels: [{ cue: "compass-click", semanticLabel: "marker-stamp", motionOnly: false }],
    },
    fallbackHeading: "New location added to the chart",
  }),
  MAP_ROUTE_REVEALED: policy({
    eventType: "MAP_ROUTE_REVEALED",
    sceneName: "route-draw",
    priority: priority.section,
    relevantSection: "chart",
    globalPresentation: global("Map route revealed", ["fromKey", "toKey"], ["route-path"]),
    localEnhancement: local("chart", ["route-path"]),
    notificationPolicy: notification("chart"),
    audio: {
      kind: "semantic-labels",
      labels: [{ cue: "map-scratch", semanticLabel: "route-drawing", motionOnly: false }],
    },
    fallbackHeading: "New route added to the chart",
  }),
  SIDE_QUEST_DISCOVERED: policy({
    eventType: "SIDE_QUEST_DISCOVERED",
    sceneName: "quest-discovery",
    priority: priority.section,
    relevantSection: "quests",
    globalPresentation: global("Side quest discovered", ["title"], ["quest-note-new"]),
    localEnhancement: local("quests", ["quest-note", "quest-red-thread"]),
    notificationPolicy: notification("quests"),
    audio: intentionalSilence("Quest discovery has no validated semantic cue."),
    fallbackHeading: "New side quest available",
  }),
  SIDE_QUEST_UPDATED: policy({
    eventType: "SIDE_QUEST_UPDATED",
    sceneName: "quest-discovery",
    priority: priority.section,
    relevantSection: "quests",
    globalPresentation: global("Side quest updated", ["key", "objectiveOrdinal"], ["quest-note-new"]),
    localEnhancement: local("quests", ["quest-objective"]),
    notificationPolicy: notification("quests", "coalesce-by-event-type"),
    audio: intentionalSilence("Quest updates stay silent until an update-specific scene label exists."),
    fallbackHeading: "Side quest progress updated",
  }),
  SIDE_QUEST_COMPLETED: policy({
    eventType: "SIDE_QUEST_COMPLETED",
    sceneName: "quest-complete",
    priority: priority.section,
    relevantSection: "quests",
    globalPresentation: global("Side quest completed", ["title", "rewardLabel"], ["quest-stamp"]),
    localEnhancement: local("quests", ["quest-stamp"]),
    notificationPolicy: notification("quests"),
    audio: intentionalSilence("Quest completion has no validated instance-scoped cue."),
    fallbackHeading: "Side quest complete",
  }),
  JOURNAL_ANNOTATION_ADDED: policy({
    eventType: "JOURNAL_ANNOTATION_ADDED",
    sceneName: "log-entry",
    priority: priority.section,
    relevantSection: "journal",
    globalPresentation: global("Journal annotation added", ["title", "chapterOrdinal"], ["log-entry-new"]),
    localEnhancement: local("journal", ["journal-annotation-ink"]),
    notificationPolicy: notification("journal", "coalesce-by-event-type"),
    audio: intentionalSilence("Journal ink remains silent until annotation-specific semantics are authored."),
    fallbackHeading: "New annotation in the journal",
  }),
  PLAYER_LOG_ENTRY_ADDED: policy({
    eventType: "PLAYER_LOG_ENTRY_ADDED",
    sceneName: "log-entry",
    priority: priority.informational,
    relevantSection: "log",
    globalPresentation: global("Captain's log updated", ["title"], ["log-entry-new"]),
    localEnhancement: local("log", ["log-entry", "log-symbol"]),
    notificationPolicy: notification("log", "coalesce-by-event-type"),
    audio: intentionalSilence("Ordinary log entries intentionally do not interrupt with sound."),
    fallbackHeading: "New entry in the Captain's log",
  }),
  FINALE_TEASED: policy({
    eventType: "FINALE_TEASED",
    sceneName: "finale-tease",
    priority: priority.finale,
    interruptibility: "before-semantic-commit",
    relevantSection: "finale",
    globalPresentation: global(
      "The finale stirs",
      ["state"],
      ["finale-ring-outer", "finale-ring-inner", "finale-light-path"],
    ),
    localEnhancement: local("finale", ["finale-mechanism"]),
    notificationPolicy: notification("finale"),
    audio: {
      kind: "semantic-labels",
      labels: [{ cue: "mechanism-hum", semanticLabel: "mechanism-wakes", motionOnly: false }],
    },
    fallbackHeading: "Finale mechanism awakened",
  }),
  FINALE_REQUIREMENT_UPDATED: policy({
    eventType: "FINALE_REQUIREMENT_UPDATED",
    sceneName: "finale-requirement",
    priority: priority.finale,
    relevantSection: "finale",
    globalPresentation: global("Finale requirement updated", ["key"], ["finale-light-path"]),
    localEnhancement: local("finale", ["finale-requirement-socket"]),
    notificationPolicy: notification("finale", "coalesce-by-event-type"),
    audio: intentionalSilence("Requirement changes have no validated semantic cue."),
    fallbackHeading: "Finale progress updated",
  }),
  CAMPAIGN_PAUSED: policy({
    eventType: "CAMPAIGN_PAUSED",
    sceneName: "pause",
    priority: priority.state,
    relevantSection: null,
    globalPresentation: global("Voyage paused", [], ["lantern"], "assertive"),
    localEnhancement: null,
    notificationPolicy: notification(null, "replace-state", "assertive"),
    audio: {
      kind: "semantic-labels",
      labels: [{ cue: "pause-wind-down", semanticLabel: "pause-stamp", motionOnly: false }],
    },
    fallbackHeading: "The voyage is paused",
  }),
  CAMPAIGN_RESUMED: policy({
    eventType: "CAMPAIGN_RESUMED",
    sceneName: "resume",
    priority: priority.state,
    relevantSection: null,
    globalPresentation: global("Voyage resumed", [], ["lantern"], "assertive"),
    localEnhancement: null,
    notificationPolicy: notification(null, "replace-state", "assertive"),
    audio: intentionalSilence("Resume has no validated semantic cue and remains sound-independent."),
    fallbackHeading: "The voyage has resumed",
  }),
  STATE_REVERTED: policy({
    eventType: "STATE_REVERTED",
    sceneName: "undo",
    priority: priority.reversal,
    interruptibility: "before-semantic-commit",
    relevantSection: null,
    globalPresentation: global("State restored", ["reversedType"], ["undo-mark"], "assertive"),
    localEnhancement: null,
    notificationPolicy: notification(null, "replace-state", "assertive"),
    audio: {
      kind: "semantic-labels",
      labels: [{ cue: "undo-reverse", semanticLabel: "ink-absorbing", motionOnly: false }],
    },
    fallbackHeading: "Previous state restored",
  }),
} as const satisfies Record<Phase3PlayerProgressEventType, ProgressionEventPresentationPolicy>;

export function isPhase3PlayerProgressEventType(value: ClientEventType): value is Phase3PlayerProgressEventType {
  return Object.hasOwn(progressionEventPresentationPolicy, value);
}

type ClientEventType = string;

export function policyForProgressionEvent(eventType: Phase3PlayerProgressEventType) {
  return progressionEventPresentationPolicy[eventType];
}
