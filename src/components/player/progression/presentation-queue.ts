import type {
  ProgressionFallbackResult,
  ProgressionFinalStateResult,
  ProgressionPresentationReceipt,
  ProgressionPresentationRequest,
  ProgressionPresentationStatus,
  ProgressionRetryDisposition,
  ReplayPresentationRequest,
} from "./contracts";
import { policyForProgressionEvent } from "./event-policy";

export type ActiveProgressionPresentation = Readonly<{
  request: ProgressionPresentationRequest;
  startedAt: number;
}>;

export type ProgressionPresentationQueue = Readonly<{
  pending: readonly ProgressionPresentationRequest[];
  active: ActiveProgressionPresentation | null;
  receipts: readonly ProgressionPresentationReceipt[];
  knownRequestIds: readonly string[];
  authoritativeEventIds: readonly string[];
  settledAuthoritativeSequence: number;
}>;

export type EnqueueProgressionPresentationResult = Readonly<{
  queue: ProgressionPresentationQueue;
  receipt?: ProgressionPresentationReceipt;
}>;

export type TakeNextProgressionPresentationResult = Readonly<{
  queue: ProgressionPresentationQueue;
  request: ProgressionPresentationRequest | null;
}>;

type ReceiptEvidence = Readonly<{
  sceneReceipt?: ProgressionPresentationReceipt["sceneReceipt"];
  fallbackResult?: ProgressionFallbackResult;
  finalStateResult?: ProgressionFinalStateResult;
  restorationResult?: ProgressionPresentationReceipt["restorationResult"];
  retryDisposition?: ProgressionRetryDisposition;
}>;

export type SettleProgressionPresentationInput = ReceiptEvidence &
  Readonly<{
    requestId: string;
    status: Extract<ProgressionPresentationStatus, "presented" | "skipped" | "fallback" | "failed" | "cancelled">;
    completedAt: number;
  }>;

export type InterruptProgressionPresentationResult = Readonly<{
  queue: ProgressionPresentationQueue;
  receipt: ProgressionPresentationReceipt | null;
  replacementRequestId: string | null;
}>;

const successfulStatuses = new Set<ProgressionPresentationStatus>(["presented", "skipped", "fallback"]);

export function createProgressionPresentationQueue(settledAuthoritativeSequence = 0): ProgressionPresentationQueue {
  return Object.freeze({
    pending: Object.freeze([]),
    active: null,
    receipts: Object.freeze([]),
    knownRequestIds: Object.freeze([]),
    authoritativeEventIds: Object.freeze([]),
    settledAuthoritativeSequence,
  });
}

function lexicalCompare(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Source precedence is intentionally separate from event priority. Sequence
 * remains authoritative inside the live/reconnect lane; priority only breaks
 * a sequence tie, and stable request identity is the final deterministic tie.
 */
export function compareProgressionPresentationRequests(
  left: ProgressionPresentationRequest,
  right: ProgressionPresentationRequest,
) {
  const leftReplay = left.source === "replay" ? 1 : 0;
  const rightReplay = right.source === "replay" ? 1 : 0;
  if (leftReplay !== rightReplay) return leftReplay - rightReplay;
  if (left.eventSequence !== right.eventSequence) return left.eventSequence - right.eventSequence;
  if (left.priority !== right.priority) return right.priority - left.priority;
  return lexicalCompare(left.requestId, right.requestId);
}

function sortPending(pending: readonly ProgressionPresentationRequest[]) {
  return Object.freeze([...pending].sort(compareProgressionPresentationRequests));
}

function receiptFor(
  request: ProgressionPresentationRequest,
  status: ProgressionPresentationStatus,
  completedAt: number,
  startedAt?: number,
  evidence: ReceiptEvidence = {},
): ProgressionPresentationReceipt {
  const hasDirectorAcknowledgment = evidence.sceneReceipt?.acknowledgmentAllowed === true;
  const acknowledgmentEligible =
    request.source !== "replay" &&
    request.acknowledgmentEligible &&
    successfulStatuses.has(status) &&
    hasDirectorAcknowledgment;
  const retryDisposition =
    evidence.retryDisposition ??
    (status === "failed" || status === "cancelled" || status === "interrupted"
      ? "retryable"
      : status === "presented" || status === "fallback" || status === "skipped"
        ? "replay-available"
        : status === "stale" || status === "duplicate"
          ? "terminal"
          : "none");

  return Object.freeze({
    requestId: request.requestId,
    eventId: request.eventId,
    eventType: request.eventType,
    eventSequence: request.eventSequence,
    source: request.source,
    status,
    queueWaitMs: startedAt === undefined ? 0 : Math.max(0, startedAt - request.enqueuedAt),
    ...(evidence.sceneReceipt ? { sceneReceipt: evidence.sceneReceipt } : {}),
    semanticLabels: Object.freeze([...(evidence.sceneReceipt?.semanticLabelsReached ?? [])]),
    ...(evidence.sceneReceipt?.targetReport ? { targetReport: evidence.sceneReceipt.targetReport } : {}),
    fallbackResult: evidence.fallbackResult ?? (status === "fallback" ? "readable" : "not-used"),
    finalStateResult:
      evidence.finalStateResult ??
      (status === "fallback" ? "fallback" : successfulStatuses.has(status) ? "committed" : "not-run"),
    restorationResult: evidence.restorationResult ?? "not-attempted",
    acknowledgmentEligible,
    retryDisposition,
    timestamps: Object.freeze({
      queuedAt: request.enqueuedAt,
      ...(startedAt === undefined ? {} : { startedAt }),
      completedAt,
    }),
  });
}

function withReceipt(
  queue: ProgressionPresentationQueue,
  receipt: ProgressionPresentationReceipt,
  changes: Partial<ProgressionPresentationQueue> = {},
): ProgressionPresentationQueue {
  return Object.freeze({
    ...queue,
    ...changes,
    receipts: Object.freeze([...queue.receipts, receipt]),
  });
}

function releaseAuthoritativeReservation(queue: ProgressionPresentationQueue, request: ProgressionPresentationRequest) {
  if (request.source === "replay") return queue.authoritativeEventIds;
  return Object.freeze(queue.authoritativeEventIds.filter((eventId) => eventId !== request.eventId));
}

export function enqueueProgressionPresentation(
  queue: ProgressionPresentationQueue,
  request: ProgressionPresentationRequest,
  observedAt = request.enqueuedAt,
): EnqueueProgressionPresentationResult {
  const duplicateRequest = queue.knownRequestIds.includes(request.requestId);
  const duplicateAuthoritativeEvent =
    request.source !== "replay" && queue.authoritativeEventIds.includes(request.eventId);
  if (duplicateRequest || duplicateAuthoritativeEvent) {
    const receipt = receiptFor(request, "duplicate", observedAt);
    return { queue: withReceipt(queue, receipt), receipt };
  }

  if (request.source !== "replay" && request.eventSequence <= queue.settledAuthoritativeSequence) {
    const receipt = receiptFor(request, "stale", observedAt);
    return {
      queue: withReceipt(queue, receipt, {
        knownRequestIds: Object.freeze([...queue.knownRequestIds, request.requestId]),
      }),
      receipt,
    };
  }

  const pending = sortPending([...queue.pending, request]);
  return {
    queue: Object.freeze({
      ...queue,
      pending,
      knownRequestIds: Object.freeze([...queue.knownRequestIds, request.requestId]),
      authoritativeEventIds:
        request.source === "replay"
          ? queue.authoritativeEventIds
          : Object.freeze([...queue.authoritativeEventIds, request.eventId]),
    }),
  };
}

export function takeNextProgressionPresentation(
  queue: ProgressionPresentationQueue,
  startedAt: number,
): TakeNextProgressionPresentationResult {
  if (queue.active || queue.pending.length === 0) return { queue, request: null };
  const [request, ...pending] = queue.pending;
  return {
    queue: Object.freeze({
      ...queue,
      pending: Object.freeze(pending),
      active: Object.freeze({ request, startedAt }),
    }),
    request,
  };
}

export function settleActiveProgressionPresentation(
  queue: ProgressionPresentationQueue,
  input: SettleProgressionPresentationInput,
): Readonly<{ queue: ProgressionPresentationQueue; receipt: ProgressionPresentationReceipt }> {
  const active = queue.active;
  if (!active || active.request.requestId !== input.requestId) {
    throw new Error(`Cannot settle inactive progression request ${input.requestId}.`);
  }

  const receipt = receiptFor(active.request, input.status, input.completedAt, active.startedAt, input);
  const advancesCursor = active.request.source !== "replay" && successfulStatuses.has(input.status);
  const releasesReservation = input.status === "failed" || input.status === "cancelled";
  return {
    queue: withReceipt(queue, receipt, {
      active: null,
      settledAuthoritativeSequence: advancesCursor
        ? Math.max(queue.settledAuthoritativeSequence, active.request.eventSequence)
        : queue.settledAuthoritativeSequence,
      authoritativeEventIds: releasesReservation
        ? releaseAuthoritativeReservation(queue, active.request)
        : queue.authoritativeEventIds,
    }),
    receipt,
  };
}

export function cancelProgressionPresentation(
  queue: ProgressionPresentationQueue,
  requestId: string,
  completedAt: number,
): Readonly<{ queue: ProgressionPresentationQueue; receipt: ProgressionPresentationReceipt | null }> {
  if (queue.active?.request.requestId === requestId) {
    const active = queue.active;
    const receipt = receiptFor(active.request, "cancelled", completedAt, active.startedAt);
    return {
      queue: withReceipt(queue, receipt, {
        active: null,
        authoritativeEventIds: releaseAuthoritativeReservation(queue, active.request),
      }),
      receipt,
    };
  }

  const pending = queue.pending.find((request) => request.requestId === requestId);
  if (!pending) return { queue, receipt: null };
  const receipt = receiptFor(pending, "cancelled", completedAt);
  return {
    queue: withReceipt(queue, receipt, {
      pending: Object.freeze(queue.pending.filter((request) => request.requestId !== requestId)),
      authoritativeEventIds: releaseAuthoritativeReservation(queue, pending),
    }),
    receipt,
  };
}

/**
 * Reports whether authoritative work may replace an active replay. The caller
 * still owns Director normalization/abort; after an interrupt receipt, calling
 * `takeNextProgressionPresentation` deterministically selects the reported
 * replacement and cannot overlap two active scenes.
 */
export function interruptReplayForAuthoritative(
  queue: ProgressionPresentationQueue,
  completedAt: number,
  semanticCommitReached: boolean,
): InterruptProgressionPresentationResult {
  const active = queue.active;
  const replacement = queue.pending.find((request) => request.source !== "replay") ?? null;
  if (!active || active.request.source !== "replay" || !replacement) {
    return { queue, receipt: null, replacementRequestId: null };
  }

  const interruptibility = policyForProgressionEvent(active.request.eventType).interruptibility;
  const mustDefer =
    interruptibility === "never" || (interruptibility === "before-semantic-commit" && semanticCommitReached);
  if (mustDefer) {
    const receipt = receiptFor(replacement, "deferred", completedAt);
    return {
      queue: withReceipt(queue, receipt),
      receipt,
      replacementRequestId: replacement.requestId,
    };
  }

  const receipt = receiptFor(active.request, "interrupted", completedAt, active.startedAt);
  return {
    queue: withReceipt(queue, receipt, { active: null }),
    receipt,
    replacementRequestId: replacement.requestId,
  };
}

export function createReplayPresentationRequest(
  original: ProgressionPresentationRequest,
  identity: Readonly<{ requestId: string; playbackIdentity: string; enqueuedAt: number }>,
): ReplayPresentationRequest {
  if (identity.requestId === original.requestId || identity.playbackIdentity === original.playbackIdentity) {
    throw new Error("Replay requires fresh request and playback identities.");
  }
  return Object.freeze({
    ...original,
    requestId: identity.requestId,
    playbackIdentity: identity.playbackIdentity,
    enqueuedAt: identity.enqueuedAt,
    source: "replay",
    acknowledgmentEligible: false,
  });
}
