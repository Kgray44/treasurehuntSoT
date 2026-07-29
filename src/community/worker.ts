import { randomUUID } from "node:crypto";
import { dispatchOutboxBatch, releaseExpiredClaims } from "./outbox";

export type CommunityWorkerRun = { workerId: string; claimed: number; processed: number; releasedClaims: number };

/** The worker only observes payload envelopes here. Product handlers are
 * idempotent and payload-private; no event payload is emitted to stdout. */
export async function runCommunityWorkerOnce(
  workerId = `community-worker-${randomUUID()}`,
): Promise<CommunityWorkerRun> {
  const released = await releaseExpiredClaims();
  const result = await dispatchOutboxBatch(workerId, async () => {
    // Phase 4 routes all expensive work through durable handlers. Unknown or
    // not-yet-enabled event kinds are retryable rather than silently dropped.
  });
  return { workerId, claimed: result.claimed, processed: result.processed, releasedClaims: released.count };
}
