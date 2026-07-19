import type { PresentationReceipt } from "@/animation/core/animation-types";
import type { ClientProgressEvent } from "@/domain/story";
import {
  type Phase3PlayerProgressEventType,
  type PlayerSectionRestorationResult,
  type ProgressionFallbackResult,
  type ProgressionFinalStateResult,
  type ProgressionPresentationReceipt,
  type ProgressionPresentationRequest,
  type ProgressionPresentationSource,
  type ProgressionPresentationStatus,
  type ProgressionRetryDisposition,
} from "./contracts";
import { isPhase3PlayerProgressEventType, policyForProgressionEvent } from "./event-policy";
import {
  createProgressionPresentationQueue,
  enqueueProgressionPresentation,
  interruptReplayForAuthoritative,
  settleActiveProgressionPresentation,
  takeNextProgressionPresentation,
  type ProgressionPresentationQueue,
} from "./presentation-queue";

export const MAX_PROGRESSION_CONTROLLER_RECEIPTS = 200;

export type ProgressionPresentationExecution = Readonly<{
  status: Extract<ProgressionPresentationStatus, "presented" | "skipped" | "fallback" | "failed" | "cancelled">;
  sceneReceipt?: PresentationReceipt;
  fallbackResult?: ProgressionFallbackResult;
  finalStateResult?: ProgressionFinalStateResult;
  restorationResult?: PlayerSectionRestorationResult;
  retryDisposition?: ProgressionRetryDisposition;
}>;

export type ProgressionPresentationControllerCursors = Readonly<{
  observed: number;
  queued: number;
  presented: number;
  acknowledged: number;
}>;

export type ProgressionPresentationControllerSnapshot = Readonly<{
  queue: ProgressionPresentationQueue;
  cursors: ProgressionPresentationControllerCursors;
  acknowledgedEventIds: readonly string[];
}>;

export type ProgressionPresentationSettledNotification = Readonly<{
  request: ProgressionPresentationRequest;
  receipt: ProgressionPresentationReceipt;
  acknowledgmentAttempted: boolean;
  acknowledged: boolean;
  snapshot: ProgressionPresentationControllerSnapshot;
}>;

export type ProgressionPresentationControllerDependencies = Readonly<{
  present: (request: ProgressionPresentationRequest) => Promise<ProgressionPresentationExecution>;
  acknowledge: (receipt: ProgressionPresentationReceipt) => Promise<boolean>;
  cancelActive: (requestId: string) => void;
  onReceipt?: (receipt: ProgressionPresentationReceipt) => void;
  onSnapshot?: (snapshot: ProgressionPresentationControllerSnapshot) => void;
  onSettled?: (notification: ProgressionPresentationSettledNotification) => void;
  now?: () => number;
  createIdentity?: (
    kind: "request" | "playback",
    event: ClientProgressEvent,
    source: ProgressionPresentationSource,
  ) => string;
}>;

export type ProgressionReconciliationInput = Readonly<{
  events: readonly ClientProgressEvent[];
  acknowledgedEventIds: readonly string[];
  source: "reconnect";
}>;

function defaultIdentity(
  kind: "request" | "playback",
  event: ClientProgressEvent,
  source: ProgressionPresentationSource,
) {
  return `${kind}:${source}:${event.id}:${crypto.randomUUID()}`;
}

function bounded(queue: ProgressionPresentationQueue): ProgressionPresentationQueue {
  if (queue.receipts.length <= MAX_PROGRESSION_CONTROLLER_RECEIPTS) return queue;
  return Object.freeze({
    ...queue,
    receipts: Object.freeze(queue.receipts.slice(-MAX_PROGRESSION_CONTROLLER_RECEIPTS)),
  });
}

function immutableRequest(
  event: ClientProgressEvent,
  source: ProgressionPresentationSource,
  now: number,
  createIdentity: NonNullable<ProgressionPresentationControllerDependencies["createIdentity"]>,
): ProgressionPresentationRequest | null {
  if (!isPhase3PlayerProgressEventType(event.type)) return null;
  const eventType: Phase3PlayerProgressEventType = event.type;
  const policy = policyForProgressionEvent(eventType);
  const base = {
    requestId: createIdentity("request", event, source),
    eventId: event.id,
    eventSequence: event.sequence,
    eventType,
    payload: Object.freeze({ ...policy.safePayloadProjector(event.payload) }),
    source,
    policyVersion: 1 as const,
    priority: policy.priority,
    enqueuedAt: now,
    relevantSection: policy.relevantSection,
    mandatory: policy.requirement === "mandatory",
    playbackIdentity: createIdentity("playback", event, source),
  };
  return Object.freeze(
    source === "replay"
      ? { ...base, source: "replay" as const, acknowledgmentEligible: false as const }
      : { ...base, source, acknowledgmentEligible: policy.acknowledgmentPolicy.source === "authoritative-only" },
  );
}

/**
 * A bounded deterministic pump above AnimationDirector. It deliberately owns
 * delivery/presentation cursors only; it never mutates progression business
 * state or treats snapshot.sequence as presentation acknowledgment.
 */
export class ProgressionPresentationController {
  private queue: ProgressionPresentationQueue;
  private cursors: ProgressionPresentationControllerCursors;
  private readonly acknowledgedEventIds = new Set<string>();
  private readonly now: () => number;
  private readonly createIdentity: NonNullable<ProgressionPresentationControllerDependencies["createIdentity"]>;
  private pumping: Promise<void> | null = null;
  private stopped = false;
  private semanticCommitReached = false;

  constructor(
    private readonly dependencies: ProgressionPresentationControllerDependencies,
    initial: Readonly<{
      settledAuthoritativeSequence?: number;
      observedCursor?: number;
      queuedCursor?: number;
      presentedCursor?: number;
      acknowledgedCursor?: number;
      acknowledgedEventIds?: readonly string[];
    }> = {},
  ) {
    this.queue = createProgressionPresentationQueue(initial.settledAuthoritativeSequence ?? 0);
    this.cursors = Object.freeze({
      observed: initial.observedCursor ?? 0,
      queued: initial.queuedCursor ?? 0,
      presented: initial.presentedCursor ?? 0,
      acknowledged: initial.acknowledgedCursor ?? 0,
    });
    initial.acknowledgedEventIds?.forEach((eventId) => this.acknowledgedEventIds.add(eventId));
    this.now = dependencies.now ?? Date.now;
    this.createIdentity = dependencies.createIdentity ?? defaultIdentity;
  }

  snapshot(): ProgressionPresentationControllerSnapshot {
    return Object.freeze({
      queue: this.queue,
      cursors: this.cursors,
      acknowledgedEventIds: Object.freeze([...this.acknowledgedEventIds].sort()),
    });
  }

  seedAcknowledged(eventIds: readonly string[]) {
    eventIds.forEach((eventId) => this.acknowledgedEventIds.add(eventId));
    this.publishSnapshot();
  }

  setSemanticCommitReached(reached: boolean) {
    this.semanticCommitReached = reached;
  }

  submit(event: ClientProgressEvent, source: ProgressionPresentationSource = "live") {
    if (this.stopped) return null;
    const request = immutableRequest(event, source, this.now(), this.createIdentity);
    if (!request) return null;
    if (source !== "replay") {
      this.cursors = Object.freeze({ ...this.cursors, observed: Math.max(this.cursors.observed, event.sequence) });
      if (this.acknowledgedEventIds.has(event.id)) {
        this.publishSnapshot();
        return null;
      }
    }

    const enqueued = enqueueProgressionPresentation(this.queue, request, this.now());
    this.queue = bounded(enqueued.queue);
    if (enqueued.receipt) {
      this.publishReceipt(enqueued.receipt);
      this.publishSettled(request, enqueued.receipt, false, false);
    } else if (source !== "replay") {
      this.cursors = Object.freeze({ ...this.cursors, queued: Math.max(this.cursors.queued, event.sequence) });
    }

    if (source !== "replay" && this.queue.active?.request.source === "replay") {
      const interruptedRequest = this.queue.active.request;
      const interruption = interruptReplayForAuthoritative(this.queue, this.now(), this.semanticCommitReached);
      this.queue = bounded(interruption.queue);
      if (interruption.receipt) {
        this.publishReceipt(interruption.receipt);
        this.publishSettled(interruptedRequest, interruption.receipt, false, false);
        if (interruption.receipt.status === "interrupted") {
          this.dependencies.cancelActive(interruption.receipt.requestId);
        }
      }
    }
    this.publishSnapshot();
    this.startPump();
    return request;
  }

  reconcile(input: ProgressionReconciliationInput) {
    this.seedAcknowledged(input.acknowledgedEventIds);
    const oldestFirst = [...input.events].sort(
      (left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id),
    );
    for (const event of oldestFirst) {
      if (!this.acknowledgedEventIds.has(event.id)) this.submit(event, input.source);
    }
    return this.awaitIdle();
  }

  awaitIdle() {
    return this.pumping ?? Promise.resolve();
  }

  stop() {
    this.stopped = true;
  }

  private startPump() {
    if (this.pumping || this.stopped) return;
    this.pumping = this.pump().finally(() => {
      this.pumping = null;
      if (!this.stopped && !this.queue.active && this.queue.pending.length > 0) this.startPump();
    });
  }

  private async pump() {
    while (!this.stopped) {
      const next = takeNextProgressionPresentation(this.queue, this.now());
      this.queue = next.queue;
      const request = next.request;
      if (!request) return;
      this.semanticCommitReached = false;
      this.publishSnapshot();
      let execution: ProgressionPresentationExecution;
      try {
        execution = await this.dependencies.present(request);
      } catch {
        execution = { status: "failed", finalStateResult: "failed", retryDisposition: "retryable" };
      }

      // An authoritative arrival may have interrupted this replay while its
      // Director abort was unwinding. The queue already owns that receipt.
      if (this.queue.active?.request.requestId !== request.requestId) continue;
      const settled = settleActiveProgressionPresentation(this.queue, {
        requestId: request.requestId,
        status: execution.status,
        completedAt: this.now(),
        ...(execution.sceneReceipt ? { sceneReceipt: execution.sceneReceipt } : {}),
        ...(execution.fallbackResult ? { fallbackResult: execution.fallbackResult } : {}),
        ...(execution.finalStateResult ? { finalStateResult: execution.finalStateResult } : {}),
        ...(execution.restorationResult ? { restorationResult: execution.restorationResult } : {}),
        ...(execution.retryDisposition ? { retryDisposition: execution.retryDisposition } : {}),
      });
      this.queue = bounded(settled.queue);
      if (request.source !== "replay" && ["presented", "fallback", "skipped"].includes(settled.receipt.status)) {
        this.cursors = Object.freeze({
          ...this.cursors,
          presented: Math.max(this.cursors.presented, request.eventSequence),
        });
      }
      this.publishReceipt(settled.receipt);
      let acknowledgmentAttempted = false;
      let acknowledged = false;
      if (settled.receipt.acknowledgmentEligible && !this.acknowledgedEventIds.has(request.eventId)) {
        acknowledgmentAttempted = true;
        acknowledged = await this.dependencies.acknowledge(settled.receipt).catch(() => false);
        if (acknowledged) {
          this.acknowledgedEventIds.add(request.eventId);
          this.cursors = Object.freeze({
            ...this.cursors,
            acknowledged: Math.max(this.cursors.acknowledged, request.eventSequence),
          });
        }
      }
      this.publishSnapshot();
      this.publishSettled(request, settled.receipt, acknowledgmentAttempted, acknowledged);
    }
  }

  private publishReceipt(receipt: ProgressionPresentationReceipt) {
    this.dependencies.onReceipt?.(receipt);
  }

  private publishSnapshot() {
    this.dependencies.onSnapshot?.(this.snapshot());
  }

  private publishSettled(
    request: ProgressionPresentationRequest,
    receipt: ProgressionPresentationReceipt,
    acknowledgmentAttempted: boolean,
    acknowledged: boolean,
  ) {
    this.dependencies.onSettled?.(
      Object.freeze({ request, receipt, acknowledgmentAttempted, acknowledged, snapshot: this.snapshot() }),
    );
  }
}
