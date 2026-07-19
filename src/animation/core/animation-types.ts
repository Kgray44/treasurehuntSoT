import type { gsap } from "gsap";

export type MotionMode = "full" | "gentle" | "reduced";

export type JournalPhase =
  | "ENTRY_IDLE"
  | "ENTRY_ACTIVATED"
  | "CLOSED_BOOK_REVEAL"
  | "LATCH_RELEASING"
  | "COVER_OPENING"
  | "SEALED_PAGE_REVEAL"
  | "SEAL_BREAKING"
  | "BOOK_SETTLING"
  | "JOURNAL_READY";

export type JournalPhaseOutcome =
  | { status: "completed"; phase: JournalPhase; finiteAnimationCount: number; durationMs: number }
  | { status: "completed-fallback"; phase: JournalPhase; reason: string }
  | { status: "missing-actor"; phase: JournalPhase; actor: string }
  | { status: "missing-animation"; phase: JournalPhase }
  | { status: "timed-out"; phase: JournalPhase; timeoutMs: number }
  | { status: "aborted"; phase: JournalPhase }
  | { status: "runtime-failed"; phase: JournalPhase; errorCode: string };

export const sceneNames = [
  "first-arrival",
  "session-reentry",
  "player-access",
  "quartermaster-login",
  "journal-open",
  "manual-page-flip",
  "programmatic-page-flip",
  "chapter-heading",
  "prose-ink",
  "seal-break",
  "chapter-release",
  "map-reveal",
  "route-draw",
  "marker-stamp",
  "ship-course",
  "artifact-award",
  "artifact-inspection",
  "artifact-connection",
  "quest-discovery",
  "quest-complete",
  "log-entry",
  "finale-tease",
  "finale-requirement",
  "prepare-chapter",
  "mark-solved",
  "pause",
  "resume",
  "undo",
] as const;

export type AnimationSceneName = (typeof sceneNames)[number];

export type AnimationRuntimeOwner =
  | "gsap"
  | "motion"
  | "css"
  | "page-flip"
  | "rive"
  | "lottie"
  | "web-animations"
  | "web-audio"
  | "react";

/** @deprecated Use `"page-flip"` in new runtime contracts. */
export type LegacyAnimationOwner = "st-page-flip";

export type AnimationOwner = AnimationRuntimeOwner | LegacyAnimationOwner;

export function normalizeAnimationRuntimeOwner(owner: AnimationOwner): AnimationRuntimeOwner {
  return owner === "st-page-flip" ? "page-flip" : owner;
}

export type SceneTargetProperty =
  | "transform"
  | "opacity"
  | "clip-path"
  | "filter"
  | "stroke-dasharray"
  | "stroke-dashoffset"
  | "layout"
  | "visibility"
  | "custom";

export type SceneReachability = "production" | "legacy" | "development-only" | "future-contract" | "deprecated";

export type SceneTargetCardinality = {
  min: number;
  max: number;
};

export type SceneVisibilityRule = {
  mustBeConnected: boolean;
  mustHaveNonZeroBox: boolean;
  mustNotBeDisplayNone: boolean;
  mustNotBeVisibilityHidden: boolean;
  minimumEffectiveOpacity: number;
  mustIntersectHost: boolean;
  mustIntersectViewport?: boolean;
  rejectPageFlipSource: boolean;
  rejectStaleSceneInstance: boolean;
};

export type SceneTargetRequirement = {
  part: string;
  required: boolean;
  cardinality: SceneTargetCardinality;
  visibility: SceneVisibilityRule;
  owner: AnimationRuntimeOwner;
  properties: SceneTargetProperty[];
};

export type SceneRequestSource = "automatic" | "explicit" | "operation" | "replay" | "development";

export type ScenePlaybackPolicy = {
  source: SceneRequestSource;
  replayable: boolean;
  allowUserSkip: boolean;
  userSkipFinalState?: string;
  allowPolicySkip: boolean;
  allowedFallback?: string;
  priority: number;
};

export type SceneAcknowledgmentOutcome = "presented" | "presented-fallback" | "skipped-by-user";

export type SceneAcknowledgmentPolicy = {
  kind: "mandatory" | "optional" | "informational" | "animation-independent";
  acknowledgeOn: SceneAcknowledgmentOutcome[];
  fallbackMustBeReadable: boolean;
  acknowledgmentOwner: "player-presentation" | "caller" | "none";
};

export type SceneFinalStatePolicy =
  | { kind: "revert-immediately" }
  | { kind: "hold-until-unmount"; semanticState: string }
  | { kind: "commit-semantic-pose"; semanticState: string }
  | { kind: "reconcile-then-revert"; semanticState: string }
  | { kind: "readable-static-fallback"; semanticState: string; fallback: string };

export type SceneTargetContract = {
  version: 1;
  sceneName: AnimationSceneName;
  reachability: SceneReachability;
  expectedHostKind: string;
  requiredTargets: SceneTargetRequirement[];
  optionalTargets: SceneTargetRequirement[];
  timeoutMs: number;
  playbackPolicy: ScenePlaybackPolicy;
  acknowledgmentPolicy: SceneAcknowledgmentPolicy;
  finalStatePolicy: SceneFinalStatePolicy;
  reducedFallback: "semantic-final-state" | "static-reader" | "none";
  replacedBy?: string;
};

export type SceneTimeline = ReturnType<typeof gsap.timeline>;

export type SceneDisplayContext = {
  chapterTitle?: string;
  objective?: string;
  artifactName?: string;
  locationName?: string;
  actionLabel?: string;
  [key: string]: string | number | boolean | undefined;
};

/**
 * Optional, non-content presentation location metadata. Callers must provide a
 * route template/path and a stable section token rather than story text or
 * private payload data.
 */
export type PresentationTelemetryContext = {
  route?: string;
  playerSection?: string;
};

export type SceneBuildContext = {
  root: HTMLElement;
  mode: MotionMode;
  /** Present for director-owned playback; optional until legacy builder fixtures migrate. */
  motionPolicy?: ResolvedMotionPolicy;
  sceneName: AnimationSceneName;
  display: SceneDisplayContext;
  emitLabel: (label: string) => void;
  addCleanup: (cleanup: () => void) => void;
};

export type SceneDefinition = {
  name: AnimationSceneName;
  reversible?: boolean;
  buildOpening: (context: SceneBuildContext) => SceneTimeline;
  buildSuccess: (context: SceneBuildContext) => SceneTimeline;
  buildFailure?: (context: SceneBuildContext) => SceneTimeline;
  buildIdle?: (context: SceneBuildContext) => SceneTimeline;
};

export type DirectorSnapshot = {
  isPlaying: boolean;
  isPaused: boolean;
  scene: AnimationSceneName | null;
  label: string;
  progress: number;
  speed: number;
  mode: MotionMode;
  phase: "idle" | "opening" | "await-server" | "success" | "failure";
  queueDepth: number;
  error: string | null;
};

export type PlaySceneOptions<T> = {
  root: HTMLElement;
  display?: SceneDisplayContext;
  operation?: () => Promise<T>;
  queue?: boolean;
  hostId?: string;
  hostKind?: string;
  requestSource?: SceneRequestSource;
  eventOrActionId?: string;
  telemetryContext?: PresentationTelemetryContext;
  signal?: AbortSignal;
  presentationFallback?: PresentationFallbackHandler;
};

export type ScenePlayRequest<T> = {
  root: HTMLElement;
  hostId: string;
  hostKind: string;
  requestSource: SceneRequestSource;
  eventOrActionId?: string;
  telemetryContext?: PresentationTelemetryContext;
  display?: SceneDisplayContext;
  operation?: () => Promise<T>;
  queue?: boolean;
  signal?: AbortSignal;
  presentationFallback?: PresentationFallbackHandler;
};

export type SceneTargetRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SceneTargetElementObservation = {
  connected: boolean;
  rect: SceneTargetRect;
  display: string;
  visibility: string;
  effectiveOpacity: number;
  hostIntersection: boolean;
  viewportIntersection?: boolean;
  pageFlipSource: boolean;
  staleSceneInstance: boolean;
  owner?: AnimationRuntimeOwner;
  rejectedOwner?: AnimationRuntimeOwner;
};

export type SceneTargetObservation = {
  part: string;
  required: boolean;
  matchedCount: number;
  visibleCount: number;
  duplicateCount: number;
  ownershipRejectedCount: number;
  observations: SceneTargetElementObservation[];
};

export type ScenePreflightFailureCode =
  | "missing-required-target"
  | "duplicate-required-target"
  | "disconnected-target"
  | "hidden-target"
  | "zero-box-target"
  | "outside-host"
  | "outside-viewport"
  | "page-flip-source"
  | "stale-scene-instance"
  | "ownership-rejected";

export type ScenePreflightFailure = {
  part: string;
  code: ScenePreflightFailureCode;
};

export type ScenePreflightReport = {
  sceneName: AnimationSceneName;
  sceneInstanceId: string;
  hostId: string;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  requiredSatisfied: boolean;
  observations: SceneTargetObservation[];
  failures: ScenePreflightFailure[];
};

export type PresentationOutcome =
  | "presented"
  | "presented-fallback"
  | "skipped-by-policy"
  | "skipped-by-user"
  | "aborted"
  | "interrupted"
  | "timed-out"
  | "missing-required-target"
  | "duplicate-required-target"
  | "ownership-rejected"
  | "runtime-failed";

export type PresentationFallbackTrigger = Extract<
  PresentationOutcome,
  "timed-out" | "missing-required-target" | "duplicate-required-target" | "ownership-rejected" | "runtime-failed"
>;

export type PresentationFallbackContext = {
  sceneName: AnimationSceneName;
  sceneInstanceId: string;
  hostId: string;
  hostKind: string;
  fallback: string;
  trigger: PresentationFallbackTrigger;
  motionPolicy: ResolvedMotionPolicy;
  signal?: AbortSignal;
};

export type PresentationFallbackResult =
  | { completed: true; readable: true; semanticState: string }
  | { completed: false; readable: boolean; semanticState?: string; reason?: string };

export type PresentationFallbackHandler = (
  context: PresentationFallbackContext,
) => PresentationFallbackResult | Promise<PresentationFallbackResult>;

export type ResolvedMotionPolicy = {
  level: MotionMode;
  source: {
    productSetting: MotionMode;
    browserPrefersReduced: boolean;
  };
  allowSpatialTravel: boolean;
  allowContinuousAmbientMotion: boolean;
  allowPageCurl: boolean;
  allowRiveStateTravel: boolean;
  allowLottiePlayback: boolean;
  allowMotionCues: boolean;
  durationScale: number;
  distanceScale: number;
  preserveSemanticStaging: true;
};

export type PresentationCleanupOutcome = "completed" | "completed-with-errors";

export type PresentationReceipt<T = void> = {
  sceneName: AnimationSceneName;
  sceneInstanceId: string;
  hostId: string;
  hostKind: string;
  requestSource: SceneRequestSource;
  eventOrActionId?: string;
  outcome: PresentationOutcome;
  motionPolicy: ResolvedMotionPolicy;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  semanticLabelsReached: string[];
  targetReport: ScenePreflightReport;
  fallbackUsed?: string;
  interruptionReason?: string;
  finalSemanticState?: string;
  acknowledgmentAllowed: boolean;
  cleanup: PresentationCleanupOutcome;
  operationResult?: T;
};

export class AnimationCancelledError extends Error {
  constructor(message = "Animation cancelled") {
    super(message);
    this.name = "AnimationCancelledError";
  }
}
