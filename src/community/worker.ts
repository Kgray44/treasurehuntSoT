import { randomUUID } from "node:crypto";
import {
  dispatchOutboxBatch,
  releaseExpiredClaims,
  releaseWorkerClaims,
  renewEventClaim,
  type OutboxHandler,
} from "./outbox";
import { CommunityError } from "./domain";
import { readCommunityOutboxRuntimePolicy } from "./operational-policy";
import { createCommunityBackupManifest, reconcileCommunityOperationalState } from "./operations";

export const communityWorkerEventTypes = [
  "SCAN_DISPATCH",
  "RESCAN",
  "QUARANTINE",
  "RESTORATION",
  "PACKAGE_FINALIZATION",
  "IMMUTABLE_OBJECT_PROMOTION",
  "DERIVATIVE_GENERATION",
  "EXIF_REMOVAL_VERIFICATION",
  "SEARCH_INDEX",
  "SEARCH_DEINDEX",
  "OPEN_GRAPH_INVALIDATION",
  "AGGREGATE_RECONCILIATION",
  "TREND_RECONCILIATION",
  "CONSENT_REVOCATION_CLEANUP",
  "MODERATION_ESCALATION",
  "STALE_SCAN_DETECTION",
  "ORPHAN_DETECTION",
  "BACKUP_SCHEDULING",
] as const;
export type CommunityWorkerEventType = (typeof communityWorkerEventTypes)[number];
export type CommunityWorkerRun = {
  workerId: string;
  claimed: number;
  processed: number;
  releasedClaims: number;
  dispatchPaused?: boolean;
};
export type CommunityWorkerOptions = {
  workerId?: string;
  concurrency?: number;
  pollMs?: number;
  signal?: AbortSignal;
  handlers?: Partial<Record<CommunityWorkerEventType, OutboxHandler>>;
};

/** Built-in operational handlers are safe and idempotent. Product effects
 * whose payload needs a storage/scanner port are injected by the production
 * host; an absent port fails the event and never fabricates completion. */
export function createDefaultCommunityWorkerHandlers(): Partial<Record<CommunityWorkerEventType, OutboxHandler>> {
  const reconcile: OutboxHandler = async () => {
    await reconcileCommunityOperationalState(false);
  };
  return {
    AGGREGATE_RECONCILIATION: reconcile,
    TREND_RECONCILIATION: reconcile,
    SEARCH_INDEX: reconcile,
    SEARCH_DEINDEX: reconcile,
    ORPHAN_DETECTION: reconcile,
    STALE_SCAN_DETECTION: reconcile,
    BACKUP_SCHEDULING: async () => {
      await createCommunityBackupManifest();
    },
  };
}

function isCommunityWorkerEventType(value: string): value is CommunityWorkerEventType {
  return (communityWorkerEventTypes as readonly string[]).includes(value);
}

async function runHandlerWithHeartbeat(workerId: string, event: Parameters<OutboxHandler>[0], handler: OutboxHandler) {
  const heartbeat = setInterval(() => void renewEventClaim(event.id, workerId), 10_000);
  try {
    await handler(event);
  } finally {
    clearInterval(heartbeat);
  }
}

/** The worker only observes payload envelopes here. Product handlers are
 * idempotent and payload-private; no event payload is emitted to stdout. */
export async function runCommunityWorkerOnce(
  workerId = `community-worker-${randomUUID()}`,
  handlers: Partial<Record<CommunityWorkerEventType, OutboxHandler>> = {},
  signal?: AbortSignal,
): Promise<CommunityWorkerRun> {
  const released = await releaseExpiredClaims();
  const policy = await readCommunityOutboxRuntimePolicy();
  // Recovery remains available while dispatch is paused: expired worker leases
  // are safely released, but no new Community work is claimed.
  if (!policy.dispatchEnabled)
    return { workerId, claimed: 0, processed: 0, releasedClaims: released.count, dispatchPaused: true };
  const result = await dispatchOutboxBatch(
    workerId,
    async (event) => {
      if (!isCommunityWorkerEventType(event.eventType))
        throw new CommunityError("COMMUNITY_OUTBOX_UNKNOWN_EVENT", "Unknown outbox event type.");
      const handler = handlers[event.eventType];
      if (!handler)
        throw new CommunityError("COMMUNITY_OUTBOX_HANDLER_UNAVAILABLE", "No enabled handler for outbox event.");
      await runHandlerWithHeartbeat(workerId, event, handler);
    },
    policy.batchSize,
    signal,
  );
  return { workerId, claimed: result.claimed, processed: result.processed, releasedClaims: released.count };
}

/** Polling owns only a worker's leases. Graceful shutdown releases those
 * leases for prompt recovery; a forced stop is recovered after lease expiry. */
export async function runCommunityWorker(options: CommunityWorkerOptions = {}) {
  const workerId = options.workerId ?? `community-worker-${randomUUID()}`;
  const concurrency = Math.max(1, Math.min(16, options.concurrency ?? 1));
  let totals = { workerId, claimed: 0, processed: 0, releasedClaims: 0 };
  try {
    while (!options.signal?.aborted) {
      const runs = await Promise.all(
        Array.from({ length: concurrency }, () => runCommunityWorkerOnce(workerId, options.handlers, options.signal)),
      );
      for (const run of runs) {
        totals = {
          workerId,
          claimed: totals.claimed + run.claimed,
          processed: totals.processed + run.processed,
          releasedClaims: totals.releasedClaims + run.releasedClaims,
        };
      }
      if (runs.every((run) => run.claimed === 0)) {
        const policy = await readCommunityOutboxRuntimePolicy();
        const pollMs = Math.max(50, Math.min(60_000, options.pollMs ?? policy.pollIntervalMs));
        await new Promise<void>((resolve) => setTimeout(resolve, pollMs));
      }
    }
  } finally {
    await releaseWorkerClaims(workerId);
  }
  return totals;
}
