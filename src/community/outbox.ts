import { db } from "@/lib/db";

export type OutboxHandler = (event: {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: string;
}) => Promise<void>;

export const communityOutboxLeaseMs = 30_000;
export const communityOutboxMaxBackoffMs = 5 * 60_000;

/** Bounded deterministic backoff avoids retry storms without making a poison
 * event invisible. It deliberately has no random jitter so recovery tests and
 * reconciliation can explain the next eligible attempt. */
export function communityOutboxBackoffMs(attempt: number) {
  return Math.min(communityOutboxMaxBackoffMs, 1_000 * 2 ** Math.max(0, Math.min(attempt - 1, 12)));
}

export async function claimAvailableEvents(workerId: string, limit = 25, leaseMs = communityOutboxLeaseMs) {
  const now = new Date();
  const candidates = await db.communityOutboxEvent.findMany({
    where: {
      processedAt: null,
      terminalFailureAt: null,
      availableAt: { lte: now },
      OR: [{ claimExpiresAt: null }, { claimExpiresAt: { lt: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  const claimed: string[] = [];
  for (const candidate of candidates) {
    const result = await db.communityOutboxEvent.updateMany({
      where: {
        id: candidate.id,
        processedAt: null,
        terminalFailureAt: null,
        OR: [{ claimExpiresAt: null }, { claimExpiresAt: { lt: now } }],
      },
      data: { claimedAt: now, claimOwner: workerId, claimExpiresAt: new Date(now.getTime() + leaseMs) },
    });
    if (result.count) claimed.push(candidate.id);
  }
  return db.communityOutboxEvent.findMany({ where: { id: { in: claimed } }, orderBy: { createdAt: "asc" } });
}
export async function markEventProcessed(id: string, workerId: string) {
  return db.communityOutboxEvent.updateMany({
    where: { id, claimOwner: workerId, processedAt: null },
    data: { processedAt: new Date(), claimExpiresAt: null },
  });
}
export async function renewEventClaim(id: string, workerId: string, leaseMs = communityOutboxLeaseMs) {
  const now = new Date();
  return db.communityOutboxEvent.updateMany({
    where: { id, claimOwner: workerId, processedAt: null, terminalFailureAt: null, claimExpiresAt: { gt: now } },
    data: { claimExpiresAt: new Date(now.getTime() + leaseMs) },
  });
}
export async function releaseWorkerClaims(workerId: string) {
  return db.communityOutboxEvent.updateMany({
    where: { claimOwner: workerId, processedAt: null, terminalFailureAt: null },
    data: { claimOwner: null, claimedAt: null, claimExpiresAt: null },
  });
}
export async function markEventRetryableFailure(id: string, workerId: string, failureCode: string) {
  const event = await db.communityOutboxEvent.findFirst({ where: { id, claimOwner: workerId, processedAt: null } });
  if (!event) return false;
  const attempts = event.attemptCount + 1;
  await db.communityOutboxEvent.update({
    where: { id },
    data:
      attempts >= event.maxAttempts
        ? { attemptCount: attempts, terminalFailureAt: new Date(), failureCode, claimExpiresAt: null }
        : {
            attemptCount: attempts,
            failureCode,
            claimOwner: null,
            claimedAt: null,
            claimExpiresAt: null,
            availableAt: new Date(Date.now() + communityOutboxBackoffMs(attempts)),
          },
  });
  return true;
}
export async function markEventTerminalFailure(id: string, workerId: string, failureCode: string) {
  return db.communityOutboxEvent.updateMany({
    where: { id, claimOwner: workerId, processedAt: null, terminalFailureAt: null },
    data: { terminalFailureAt: new Date(), failureCode, claimExpiresAt: null },
  });
}
export async function releaseExpiredClaims() {
  return db.communityOutboxEvent.updateMany({
    where: { processedAt: null, terminalFailureAt: null, claimExpiresAt: { lt: new Date() } },
    data: { claimOwner: null, claimedAt: null, claimExpiresAt: null },
  });
}
export async function dispatchOutboxBatch(
  workerId: string,
  handler: OutboxHandler,
  limit = 25,
  signal?: AbortSignal,
) {
  const events = await claimAvailableEvents(workerId, limit);
  let processed = 0;
  for (const event of events) {
    if (signal?.aborted) break;
    try {
      await handler(event);
      if ((await markEventProcessed(event.id, workerId)).count) processed += 1;
    } catch {
      await markEventRetryableFailure(event.id, workerId, "HANDLER_FAILED");
    }
  }
  return { claimed: events.length, processed };
}
