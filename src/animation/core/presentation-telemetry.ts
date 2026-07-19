import {
  sceneNames,
  type AnimationSceneName,
  type MotionMode,
  type PresentationCleanupOutcome,
  type PresentationOutcome,
  type PresentationReceipt,
  type PresentationTelemetryContext,
  type ResolvedMotionPolicy,
  type SceneRequestSource,
  type SceneFinalizationReceipt,
} from "./animation-types";

const DEFAULT_CAPACITY = 100;
const MAX_CAPACITY = 250;
const MAX_TARGET_PARTS = 64;
const MAX_SEMANTIC_LABELS = 32;
const MAX_COUNT = 10_000;
const MAX_DURATION_MS = 10 * 60 * 1_000;

const ID_MAX_LENGTH = 96;
const HOST_KIND_MAX_LENGTH = 48;
const ROUTE_MAX_LENGTH = 160;
const SECTION_MAX_LENGTH = 48;
const SEMANTIC_TOKEN_MAX_LENGTH = 80;
const TARGET_PART_MAX_LENGTH = 64;

const sceneNameSet = new Set<string>(sceneNames);
const motionModes = new Set<MotionMode>(["full", "gentle", "reduced"]);
const requestSources = new Set<SceneRequestSource>(["automatic", "explicit", "operation", "replay", "development"]);
const outcomes = new Set<PresentationOutcome>([
  "presented",
  "presented-fallback",
  "skipped-by-policy",
  "skipped-by-user",
  "aborted",
  "interrupted",
  "timed-out",
  "missing-required-target",
  "duplicate-required-target",
  "ownership-rejected",
  "runtime-failed",
]);
const cleanupOutcomes = new Set<PresentationCleanupOutcome>([
  "completed",
  "completed-with-fallback",
  "completed-with-errors",
]);
const boundedTokenPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;
const uuidLikePattern = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
const opaqueIdPattern = /^[A-Za-z0-9_-]{24,}$/;

export type PresentationTelemetryTarget = Readonly<{
  part: string;
  required: boolean;
  matchedCount: number;
  visibleCount: number;
  duplicateCount: number;
  ownershipRejectedCount: number;
}>;

export type PresentationTelemetryTargetSummary = Readonly<{
  partCount: number;
  requiredPartCount: number;
  matchedCount: number;
  visibleCount: number;
  duplicateCount: number;
  ownershipRejectedCount: number;
}>;

export type PresentationTelemetryMotion = Readonly<ResolvedMotionPolicy>;

export type PresentationTelemetryEvent = Readonly<{
  version: 1;
  sceneName: AnimationSceneName;
  sceneInstanceId: string;
  hostId: string;
  hostKind: string;
  requestSource: SceneRequestSource;
  eventOrActionId?: string;
  route?: string;
  playerSection?: string;
  motion: PresentationTelemetryMotion;
  targets: readonly PresentationTelemetryTarget[];
  targetSummary: PresentationTelemetryTargetSummary;
  outcome: PresentationOutcome;
  semanticLabelsReached: readonly string[];
  finalSemanticState?: string;
  fallbackUsed?: string;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  acknowledgmentAllowed: boolean;
  cleanup: PresentationCleanupOutcome;
  finalization?: Readonly<SceneFinalizationReceipt>;
}>;

export type PresentationTelemetryListener = (event: PresentationTelemetryEvent) => void;

export type PresentationTelemetryRecorder = Readonly<{
  record: <T>(
    receipt: PresentationReceipt<T>,
    context?: PresentationTelemetryContext,
  ) => PresentationTelemetryEvent | null;
  read: () => readonly PresentationTelemetryEvent[];
  subscribe: (listener: PresentationTelemetryListener) => () => void;
  clear: () => void;
}>;

function isEnumValue<T extends string>(set: ReadonlySet<T>, value: unknown): value is T {
  return typeof value === "string" && set.has(value as T);
}

function boundedInteger(value: unknown, maximum = MAX_COUNT): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(maximum, Math.max(0, Math.round(value)));
}

function boundedTimestamp(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.round(value)));
}

function boundedScale(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(4, Math.max(0, value));
}

function boundedToken(value: unknown, maximumLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const candidate = value.normalize("NFKC").trim();
  if (!candidate || candidate.length > maximumLength || !boundedTokenPattern.test(candidate)) return undefined;
  return candidate;
}

function requiredToken(value: unknown, maximumLength: number): string {
  return boundedToken(value, maximumLength) ?? "redacted";
}

function safeRoute(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const pathname = value.trim().split(/[?#]/u, 1)[0];
  if (!pathname?.startsWith("/") || pathname.length > ROUTE_MAX_LENGTH) return undefined;

  const safeSegments = pathname.split("/").map((segment) => {
    if (!segment) return segment;
    if (
      segment.length > 48 ||
      uuidLikePattern.test(segment) ||
      opaqueIdPattern.test(segment) ||
      !/^[A-Za-z0-9._~-]+$/u.test(segment)
    ) {
      return ":redacted";
    }
    return segment;
  });

  return safeSegments.join("/");
}

function sanitizedMotion(value: unknown): PresentationTelemetryMotion | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ResolvedMotionPolicy>;
  const source = candidate.source;
  if (
    !isEnumValue(motionModes, candidate.level) ||
    !source ||
    !isEnumValue(motionModes, source.productSetting) ||
    typeof source.browserPrefersReduced !== "boolean" ||
    typeof candidate.allowSpatialTravel !== "boolean" ||
    typeof candidate.allowContinuousAmbientMotion !== "boolean" ||
    typeof candidate.allowPageCurl !== "boolean" ||
    typeof candidate.allowRiveStateTravel !== "boolean" ||
    typeof candidate.allowLottiePlayback !== "boolean" ||
    typeof candidate.allowMotionCues !== "boolean" ||
    candidate.preserveSemanticStaging !== true
  ) {
    return null;
  }

  return Object.freeze({
    level: candidate.level,
    source: Object.freeze({
      productSetting: source.productSetting,
      browserPrefersReduced: source.browserPrefersReduced,
    }),
    allowSpatialTravel: candidate.allowSpatialTravel,
    allowContinuousAmbientMotion: candidate.allowContinuousAmbientMotion,
    allowPageCurl: candidate.allowPageCurl,
    allowRiveStateTravel: candidate.allowRiveStateTravel,
    allowLottiePlayback: candidate.allowLottiePlayback,
    allowMotionCues: candidate.allowMotionCues,
    durationScale: boundedScale(candidate.durationScale),
    distanceScale: boundedScale(candidate.distanceScale),
    preserveSemanticStaging: true,
  });
}

function sanitizedTargets(receipt: PresentationReceipt<unknown>): readonly PresentationTelemetryTarget[] {
  const targets = receipt.targetReport?.observations;
  if (!Array.isArray(targets)) return Object.freeze([]);

  return Object.freeze(
    targets.slice(0, MAX_TARGET_PARTS).flatMap((target) => {
      const part = boundedToken(target?.part, TARGET_PART_MAX_LENGTH);
      if (!part) return [];
      return [
        Object.freeze({
          part,
          required: target.required === true,
          matchedCount: boundedInteger(target.matchedCount),
          visibleCount: boundedInteger(target.visibleCount),
          duplicateCount: boundedInteger(target.duplicateCount),
          ownershipRejectedCount: boundedInteger(target.ownershipRejectedCount),
        }),
      ];
    }),
  );
}

function summarizeTargets(targets: readonly PresentationTelemetryTarget[]): PresentationTelemetryTargetSummary {
  return Object.freeze(
    targets.reduce(
      (summary, target) => ({
        partCount: summary.partCount + 1,
        requiredPartCount: summary.requiredPartCount + (target.required ? 1 : 0),
        matchedCount: Math.min(MAX_COUNT, summary.matchedCount + target.matchedCount),
        visibleCount: Math.min(MAX_COUNT, summary.visibleCount + target.visibleCount),
        duplicateCount: Math.min(MAX_COUNT, summary.duplicateCount + target.duplicateCount),
        ownershipRejectedCount: Math.min(MAX_COUNT, summary.ownershipRejectedCount + target.ownershipRejectedCount),
      }),
      {
        partCount: 0,
        requiredPartCount: 0,
        matchedCount: 0,
        visibleCount: 0,
        duplicateCount: 0,
        ownershipRejectedCount: 0,
      },
    ),
  );
}

function sanitizedFinalization(
  value: PresentationReceipt<unknown>["finalization"],
): SceneFinalizationReceipt | undefined {
  if (!value || typeof value !== "object" || !cleanupOutcomes.has(value.cleanupResult)) return undefined;
  const allowedPolicies = new Set([
    "revert-immediately",
    "hold-final-until-unmount",
    "commit-final-state",
    "reconcile-then-revert",
    "fallback-to-static-state",
  ]);
  if (!allowedPolicies.has(value.finalStatePolicy)) return undefined;
  const handoffTargetId = boundedToken(value.handoffTargetId, ID_MAX_LENGTH);
  const allowedFailures = new Set([
    "handoff-timeout",
    "handoff-target-missing",
    "handoff-rejected",
    "handoff-runtime-failed",
    "cleanup-failed",
  ]);
  const handoffFailure =
    typeof value.handoffFailure === "string" && allowedFailures.has(value.handoffFailure)
      ? value.handoffFailure
      : undefined;
  return Object.freeze({
    finalStatePolicy: value.finalStatePolicy,
    finalStateCommitted: value.finalStateCommitted === true,
    ...(handoffTargetId ? { handoffTargetId } : {}),
    handoffStarted: value.handoffStarted === true,
    handoffCompleted: value.handoffCompleted === true,
    ...(handoffFailure ? { handoffFailure } : {}),
    cleanupStarted: value.cleanupStarted === true,
    cleanupCompleted: value.cleanupCompleted === true,
    cleanupResult: value.cleanupResult,
  });
}

export function toPresentationTelemetryEvent<T>(
  receipt: PresentationReceipt<T>,
  context: PresentationTelemetryContext = {},
): PresentationTelemetryEvent | null {
  if (
    !isEnumValue(sceneNameSet, receipt.sceneName) ||
    !isEnumValue(requestSources, receipt.requestSource) ||
    !isEnumValue(outcomes, receipt.outcome) ||
    !isEnumValue(cleanupOutcomes, receipt.cleanup)
  ) {
    return null;
  }

  const motion = sanitizedMotion(receipt.motionPolicy);
  if (!motion) return null;

  const targets = sanitizedTargets(receipt);
  const eventOrActionId = boundedToken(receipt.eventOrActionId, ID_MAX_LENGTH);
  const route = safeRoute(context.route);
  const playerSection = boundedToken(context.playerSection, SECTION_MAX_LENGTH);
  const finalSemanticState = boundedToken(receipt.finalSemanticState, SEMANTIC_TOKEN_MAX_LENGTH);
  const fallbackUsed = boundedToken(receipt.fallbackUsed, SEMANTIC_TOKEN_MAX_LENGTH);
  const semanticLabelsReached = Object.freeze(
    (Array.isArray(receipt.semanticLabelsReached) ? receipt.semanticLabelsReached : [])
      .slice(0, MAX_SEMANTIC_LABELS)
      .flatMap((label) => {
        const safeLabel = boundedToken(label, SEMANTIC_TOKEN_MAX_LENGTH);
        return safeLabel ? [safeLabel] : [];
      }),
  );
  const finalization = sanitizedFinalization(receipt.finalization);

  return Object.freeze({
    version: 1,
    sceneName: receipt.sceneName,
    sceneInstanceId: requiredToken(receipt.sceneInstanceId, ID_MAX_LENGTH),
    hostId: requiredToken(receipt.hostId, ID_MAX_LENGTH),
    hostKind: requiredToken(receipt.hostKind, HOST_KIND_MAX_LENGTH),
    requestSource: receipt.requestSource,
    ...(eventOrActionId ? { eventOrActionId } : {}),
    ...(route ? { route } : {}),
    ...(playerSection ? { playerSection } : {}),
    motion,
    targets,
    targetSummary: summarizeTargets(targets),
    outcome: receipt.outcome,
    semanticLabelsReached,
    ...(finalSemanticState ? { finalSemanticState } : {}),
    ...(fallbackUsed ? { fallbackUsed } : {}),
    startedAt: boundedTimestamp(receipt.startedAt),
    completedAt: boundedTimestamp(receipt.completedAt),
    durationMs: boundedInteger(receipt.durationMs, MAX_DURATION_MS),
    acknowledgmentAllowed: receipt.acknowledgmentAllowed === true,
    cleanup: receipt.cleanup,
    ...(finalization ? { finalization } : {}),
  });
}

export function createPresentationTelemetryRecorder(
  options: { capacity?: number } = {},
): PresentationTelemetryRecorder {
  const capacity = Math.min(
    MAX_CAPACITY,
    Math.max(1, boundedInteger(options.capacity ?? DEFAULT_CAPACITY, MAX_CAPACITY)),
  );
  const events: PresentationTelemetryEvent[] = [];
  const listeners = new Set<PresentationTelemetryListener>();

  return Object.freeze({
    record<T>(receipt: PresentationReceipt<T>, context: PresentationTelemetryContext = {}) {
      const event = toPresentationTelemetryEvent(receipt, context);
      if (!event) return null;

      if (events.length === capacity) events.shift();
      events.push(event);
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {
          // Telemetry observers are diagnostic only and must never affect presentation truth.
        }
      }
      return event;
    },
    read() {
      return Object.freeze([...events]);
    },
    subscribe(listener: PresentationTelemetryListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clear() {
      events.length = 0;
    },
  });
}

export const presentationTelemetry = createPresentationTelemetryRecorder();

export function recordPresentationTelemetry<T>(
  receipt: PresentationReceipt<T>,
  context?: PresentationTelemetryContext,
): PresentationTelemetryEvent | null {
  return presentationTelemetry.record(receipt, context);
}

export function readPresentationTelemetry(): readonly PresentationTelemetryEvent[] {
  return presentationTelemetry.read();
}

export function subscribePresentationTelemetry(listener: PresentationTelemetryListener): () => void {
  return presentationTelemetry.subscribe(listener);
}

export function resetPresentationTelemetry(): void {
  presentationTelemetry.clear();
}
