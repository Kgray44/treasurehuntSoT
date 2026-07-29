import { createHash } from "node:crypto";
import { db } from "@/lib/db";

export const communityScheduleTypes = [
  "SEARCH_RECONCILIATION",
  "AGGREGATE_RECONCILIATION",
  "SCAN_EXPIRY",
  "RESCAN",
  "ABANDONED_UPLOADS",
  "STALE_STAGING_OBJECTS",
  "EXPIRED_WORKER_CLAIMS",
  "MODERATION_ESCALATION",
  "QUARANTINE_RETENTION_REVIEW",
  "BACKUP",
  "RESTORE_DRILL_REMINDER",
  "DEAD_LETTER_REVIEW",
  "ORPHAN_DETECTION",
] as const;
export type CommunityScheduleType = (typeof communityScheduleTypes)[number];

const eventForSchedule: Record<CommunityScheduleType, string> = {
  SEARCH_RECONCILIATION: "SEARCH_INDEX",
  AGGREGATE_RECONCILIATION: "AGGREGATE_RECONCILIATION",
  SCAN_EXPIRY: "STALE_SCAN_DETECTION",
  RESCAN: "RESCAN",
  ABANDONED_UPLOADS: "ORPHAN_DETECTION",
  STALE_STAGING_OBJECTS: "ORPHAN_DETECTION",
  EXPIRED_WORKER_CLAIMS: "ORPHAN_DETECTION",
  MODERATION_ESCALATION: "MODERATION_ESCALATION",
  QUARANTINE_RETENTION_REVIEW: "QUARANTINE",
  BACKUP: "BACKUP_SCHEDULING",
  RESTORE_DRILL_REMINDER: "BACKUP_SCHEDULING",
  DEAD_LETTER_REVIEW: "ORPHAN_DETECTION",
  ORPHAN_DETECTION: "ORPHAN_DETECTION",
};
export function communityScheduleEventType(type: CommunityScheduleType) {
  return eventForSchedule[type];
}
function key(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/** Scheduler work is limited to durable enqueuing. Handlers, never the
 * scheduler, own object changes, quarantine, restoration, or cleanup. */
export async function enqueueDueCommunitySchedules(now = new Date(), nextDelayMs = 60 * 60 * 1000) {
  const due = await db.communityOperationalSchedule.findMany({
    where: { nextRunAt: { lte: now } },
    orderBy: { nextRunAt: "asc" },
  });
  let enqueued = 0;
  for (const schedule of due) {
    if (!(communityScheduleTypes as readonly string[]).includes(schedule.scheduleType)) continue;
    const type = schedule.scheduleType as CommunityScheduleType;
    const idempotencyKey = key(`community-schedule:${type}:${schedule.revision}:${schedule.nextRunAt.toISOString()}`);
    await db.$transaction(async (tx) => {
      await tx.communityOutboxEvent.upsert({
        where: { idempotencyKey },
        create: {
          eventType: communityScheduleEventType(type),
          aggregateType: "COMMUNITY_SCHEDULE",
          aggregateId: schedule.id,
          payload: JSON.stringify({ scheduleType: type, dryRun: false }),
          idempotencyKey,
        },
        update: {},
      });
      await tx.communityOperationalSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          lastOutcome: "ENQUEUED",
          nextRunAt: new Date(now.getTime() + nextDelayMs),
          revision: { increment: 1 },
        },
      });
    });
    enqueued += 1;
  }
  return { due: due.length, enqueued };
}

export async function seedCommunityOperationalSchedules(now = new Date()) {
  for (const scheduleType of communityScheduleTypes)
    await db.communityOperationalSchedule.upsert({
      where: { scheduleType },
      create: { scheduleType, nextRunAt: now },
      update: {},
    });
  return { schedules: communityScheduleTypes.length };
}
