import type {
  AnimationSceneName,
  JournalPhaseOutcome,
  MotionMode,
  PresentationReceipt,
  ResolvedMotionPolicy,
  ScenePreflightReport,
} from "@/animation/core/animation-types";
import type { AudioCueName } from "@/animation/core/audio-cues";
import type { ClientProgressEvent } from "@/domain/story";

/**
 * The compatibility Player event surface covered by Lanternwake Phase 3.
 * `satisfies` keeps every member compatible with the wider persisted event
 * union without accidentally widening this bounded presentation contract.
 */
export const phase3PlayerProgressEventTypes = [
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

export type Phase3PlayerProgressEventType = (typeof phase3PlayerProgressEventTypes)[number];

export type Phase3PlayerProgressEvent = Readonly<
  Omit<ClientProgressEvent, "payload" | "type"> & {
    type: Phase3PlayerProgressEventType;
    payload: Readonly<Record<string, unknown>>;
  }
>;

export const playerSectionIds = ["journal", "chart", "treasures", "quests", "log", "finale"] as const;
export type PlayerSectionId = (typeof playerSectionIds)[number];

export type ProgressionPresentationSource = "live" | "reconnect" | "replay";

export const progressionPresentationPriorities = {
  informational: 100,
  section: 200,
  chapter: 300,
  artifact: 400,
  finale: 450,
  state: 500,
  reversal: 550,
  ceremony: 600,
} as const;

export type ProgressionPresentationPriority =
  (typeof progressionPresentationPriorities)[keyof typeof progressionPresentationPriorities];

export type ProgressionPresentationStatus =
  | "queued"
  | "active"
  | "presented"
  | "duplicate"
  | "stale"
  | "deferred"
  | "interrupted"
  | "skipped"
  | "fallback"
  | "failed"
  | "cancelled";

export type PlayerSafePresentationPayload = Readonly<Record<string, string | number | boolean>>;

type ProgressionPresentationRequestBase = Readonly<{
  requestId: string;
  eventId: string;
  eventSequence: number;
  eventType: Phase3PlayerProgressEventType;
  payload: PlayerSafePresentationPayload;
  policyVersion: 1;
  priority: ProgressionPresentationPriority;
  enqueuedAt: number;
  relevantSection: PlayerSectionId | null;
  mandatory: boolean;
  playbackIdentity: string;
  requestedMotionPolicy?: ResolvedMotionPolicy;
}>;

export type AuthoritativePresentationRequest = ProgressionPresentationRequestBase &
  Readonly<{
    source: "live" | "reconnect";
    acknowledgmentEligible: boolean;
  }>;

export type ReplayPresentationRequest = ProgressionPresentationRequestBase &
  Readonly<{
    source: "replay";
    acknowledgmentEligible: false;
  }>;

export type ProgressionPresentationRequest = AuthoritativePresentationRequest | ReplayPresentationRequest;

export type PlayerSectionRestoration = Readonly<{
  sectionId: PlayerSectionId;
  scrollPosition: Readonly<{ x: number; y: number }>;
  exactFocusTarget: HTMLElement | null;
  triggerTarget: HTMLElement | null;
  sectionHeadingTarget: HTMLElement | null;
}>;

export type PlayerSectionRestorationResult =
  | "not-attempted"
  | "exact-target"
  | "destination-control"
  | "section-heading"
  | "section-only"
  | "failed";

export type GlobalProgressionPresentation = Readonly<{
  heading: string;
  summaryFields: readonly string[];
  requiredTargets: readonly string[];
  optionalTargets: readonly string[];
  announcement: "polite" | "assertive";
}>;

export type SectionLocalEnhancement = Readonly<{
  section: PlayerSectionId;
  requiredHandleKeys: readonly string[];
  handoff: "after-global-commit";
  blocking: false;
  acknowledgmentOwner: "none";
}>;

export type ProgressionReplayPolicy = Readonly<{
  eligible: boolean;
  historySource: "player-safe";
  sourcePrecedence: "behind-authoritative";
}>;

export type ProgressionAcknowledgmentPolicy = Readonly<{
  source: "authoritative-only" | "none";
  outcomes: readonly ("presented" | "fallback" | "skipped")[];
  onePerEventPerDevice: boolean;
}>;

export type ProgressionFocusPolicy = Readonly<{
  capture: "meaningful-active-element";
  restore: "exact-destination-heading";
  preserveScroll: true;
}>;

export type ProgressionSkipPolicy = Readonly<{
  allowed: boolean;
  result: "readable-final-state" | "not-applicable";
}>;

export type ProgressionNotificationPolicy = Readonly<{
  politeness: "polite" | "assertive" | "off";
  unseenCount: "refresh-authoritative" | "preserve";
  destinationAction: PlayerSectionId | null;
  stacking: "serialize" | "coalesce-by-event-type" | "replace-state";
  dismissal: "user" | "on-settle" | "persistent";
}>;

export type ProgressionAudioLabel = Readonly<{
  cue: AudioCueName;
  semanticLabel: string;
  motionOnly: boolean;
}>;

export type ProgressionAudioPolicy =
  | Readonly<{ kind: "semantic-labels"; labels: readonly ProgressionAudioLabel[] }>
  | Readonly<{ kind: "intentional-silence"; reason: string }>;

export type ProgressionAudioLabelMap = Readonly<Record<Phase3PlayerProgressEventType, ProgressionAudioPolicy>>;

export type ProgressionMotionSemantics = Readonly<Record<MotionMode, string>>;

export type ProgressionFallbackPolicy = Readonly<{
  heading: string;
  summaryFields: readonly string[];
  controls: readonly ("continue" | "destination" | "replay")[];
  equivalentReducedOutcome: string;
  verification: "heading-and-summary-visible";
}>;

export type ProgressionSettledStateHandoff = Readonly<{
  target: "global" | "relevant-section-if-mounted";
  failure: "keep-global-readable-state";
}>;

export type ProgressionEventPresentationPolicy = Readonly<{
  sceneName: AnimationSceneName;
  priority: ProgressionPresentationPriority;
  requirement: "mandatory" | "optional";
  interruptibility: "always" | "before-semantic-commit" | "never";
  relevantSection: PlayerSectionId | null;
  globalPresentation: GlobalProgressionPresentation;
  localEnhancement: SectionLocalEnhancement | null;
  replayPolicy: ProgressionReplayPolicy;
  acknowledgmentPolicy: ProgressionAcknowledgmentPolicy;
  focusBehavior: ProgressionFocusPolicy;
  skipBehavior: ProgressionSkipPolicy;
  notificationPolicy: ProgressionNotificationPolicy;
  audio: ProgressionAudioPolicy;
  motionSemantics: ProgressionMotionSemantics;
  fallback: ProgressionFallbackPolicy;
  safePayloadProjector: (payload: Record<string, unknown>) => PlayerSafePresentationPayload;
  settledStateHandoff: ProgressionSettledStateHandoff;
  oneShotScope: "event-id";
}>;

export type ProgressionFallbackResult = "not-used" | "readable" | "unreadable";
export type ProgressionFinalStateResult = "not-run" | "committed" | "reconciled" | "fallback" | "failed";
export type ProgressionRetryDisposition = "none" | "retryable" | "replay-available" | "terminal";

export type ProgressionPresentationReceipt = Readonly<{
  requestId: string;
  eventId: string;
  eventType: Phase3PlayerProgressEventType;
  eventSequence: number;
  source: ProgressionPresentationSource;
  status: ProgressionPresentationStatus;
  queueWaitMs: number;
  sceneReceipt?: PresentationReceipt;
  semanticLabels: readonly string[];
  targetReport?: ScenePreflightReport;
  fallbackResult: ProgressionFallbackResult;
  finalStateResult: ProgressionFinalStateResult;
  restorationResult: PlayerSectionRestorationResult;
  acknowledgmentEligible: boolean;
  retryDisposition: ProgressionRetryDisposition;
  timestamps: Readonly<{
    queuedAt: number;
    startedAt?: number;
    completedAt: number;
  }>;
}>;

export type OpeningPresentationProfile = "first" | "reentry" | "completed-archive" | "manual-full-replay" | "reduced";

export type OpeningPresentationPolicy = Readonly<{
  profile: OpeningPresentationProfile;
  mode: MotionMode;
  skipAllowed: boolean;
  terminalPhase: "JOURNAL_READY";
  interruptionFallback: "readable-journal";
  archiveAnnouncement: "quiet" | "normal";
}>;

export type JournalReadyReceipt = Readonly<{
  profile: OpeningPresentationProfile;
  mode: MotionMode;
  outcome: JournalPhaseOutcome;
  pageFlipReadiness: "runtime" | "static-fallback";
  currentPageIdentity: string;
  interfaceReachable: boolean;
  objectiveReachable: boolean;
  focusDestination: string;
  announcement: string;
  fallbackTruth: "runtime" | "readable-static";
  cleanup: "ready" | "completed-with-fallback";
  phase: "JOURNAL_READY";
}>;

export type PageTurnLifecycleType = "turn-start" | "turn-commit" | "turn-settle" | "turn-cancel" | "turn-failed";

export type PageTurnLifecycleEvent = Readonly<{
  type: PageTurnLifecycleType;
  bookId: string;
  mountId: string;
  source: "user" | "programmatic" | "reconciliation";
  fromPage: number;
  toPage: number;
  orientation: "portrait" | "landscape";
  mode: MotionMode;
  timestamp: number;
  reason?: string;
  fallback?: "static-page";
  currentBoundaryGeneration: number;
}>;

export type OfflineReconciliationPresentation = Readonly<{
  access: "revalidated" | "revoked";
  observedCursor: number;
  queuedCursor: number;
  presentedCursor: number;
  acknowledgedCursor: number;
  missedEventIds: readonly string[];
  summary: string;
  replayPreserved: boolean;
  terminalAccessMessage?: string;
}>;
