import { db } from "@/lib/db";

export type OutboxHandler = (event: {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: string;
}) => Promise<void>;

export async function claimAvailableEvents(workerId: string, limit = 25, leaseMs = 30_000) {
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
            availableAt: new Date(Date.now() + attempts * 1_000),
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
export async function dispatchOutboxBatch(workerId: string, handler: OutboxHandler, limit = 25) {
  const events = await claimAvailableEvents(workerId, limit);
  let processed = 0;
  for (const event of events) {
    try {
      await handler(event);
      if ((await markEventProcessed(event.id, workerId)).count) processed += 1;
    } catch {
      await markEventRetryableFailure(event.id, workerId, "HANDLER_FAILED");
    }
  }
  return { claimed: events.length, processed };
}
