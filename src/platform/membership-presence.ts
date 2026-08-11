import { z } from "zod";
import { db } from "@/lib/db";

export const membershipPresencePolicy = Object.freeze({
  freshMs: 45_000,
  recentlyLostMs: 5 * 60_000,
  heartbeatLimitPerMinute: 120,
  retentionMs: 30 * 24 * 60 * 60_000,
  maxDevicesPerMembership: 8,
});

export const safePresenceActivities = [
  "WAITING_ROOM",
  "JOURNAL",
  "CHART",
  "ARTIFACT",
  "PLAYER_LIBRARY",
  "RECONNECTING",
  "UNKNOWN",
] as const;
export type SafePresenceActivity = (typeof safePresenceActivities)[number];
export type MembershipPresenceState = "UNKNOWN" | "CONNECTED" | "RECENTLY_LOST" | "STALE";
export type MembershipSynchronizationState = "UNKNOWN" | "SYNCHRONIZED" | "CATCHING_UP";

export const membershipPresenceHeartbeatSchema = z
  .object({
    membershipId: z.string().trim().min(1).max(191),
    deviceInstanceId: z.string().uuid(),
    acknowledgedSequence: z.number().int().nonnegative(),
    safeActivity: z.enum(safePresenceActivities).optional(),
    disconnected: z.boolean().optional(),
  })
  .strict();

type DeviceEvidence = Readonly<{
  lastHeartbeatAt: Date;
  acknowledgedSequence: number;
  safeActivity: string | null;
  disconnectedAt: Date | null;
  updatedAt: Date;
}>;

export type MembershipPresenceProjection = Readonly<{
  state: MembershipPresenceState;
  lastSeenAt: string | null;
  activeDeviceCount: number;
  acknowledgedSequence: number | null;
  eventLag: number | null;
  synchronized: boolean | null;
  synchronizationState: MembershipSynchronizationState;
  safeActivity: SafePresenceActivity | null;
  evidenceUpdatedAt: string | null;
}>;

function latest<T extends { lastHeartbeatAt: Date }>(rows: readonly T[]) {
  return rows.reduce<T | null>(
    (selected, row) => (!selected || row.lastHeartbeatAt > selected.lastHeartbeatAt ? row : selected),
    null,
  );
}

function activity(value: string | null): SafePresenceActivity | null {
  return safePresenceActivities.includes(value as SafePresenceActivity) ? (value as SafePresenceActivity) : null;
}

export function aggregateMembershipPresence(
  devices: readonly DeviceEvidence[],
  currentSequence: number,
  now = new Date(),
): MembershipPresenceProjection {
  if (!devices.length)
    return {
      state: "UNKNOWN",
      lastSeenAt: null,
      activeDeviceCount: 0,
      acknowledgedSequence: null,
      eventLag: null,
      synchronized: null,
      synchronizationState: "UNKNOWN",
      safeActivity: null,
      evidenceUpdatedAt: null,
    };
  const fresh = devices.filter(
    (device) =>
      !device.disconnectedAt && now.getTime() - device.lastHeartbeatAt.getTime() <= membershipPresencePolicy.freshMs,
  );
  const latestEvidence = latest(devices)!;
  if (fresh.length) {
    const acknowledgedSequence = Math.max(...fresh.map((device) => device.acknowledgedSequence));
    const eventLag = Math.max(0, currentSequence - acknowledgedSequence);
    const newestFresh = latest(fresh)!;
    return {
      state: "CONNECTED",
      lastSeenAt: newestFresh.lastHeartbeatAt.toISOString(),
      activeDeviceCount: fresh.length,
      acknowledgedSequence,
      eventLag,
      synchronized: eventLag === 0,
      synchronizationState: eventLag === 0 ? "SYNCHRONIZED" : "CATCHING_UP",
      safeActivity: activity(newestFresh.safeActivity),
      evidenceUpdatedAt: newestFresh.updatedAt.toISOString(),
    };
  }
  const age = now.getTime() - latestEvidence.lastHeartbeatAt.getTime();
  return {
    state: age <= membershipPresencePolicy.recentlyLostMs ? "RECENTLY_LOST" : "STALE",
    lastSeenAt: latestEvidence.lastHeartbeatAt.toISOString(),
    activeDeviceCount: 0,
    acknowledgedSequence: null,
    eventLag: null,
    synchronized: null,
    synchronizationState: "UNKNOWN",
    safeActivity: activity(latestEvidence.safeActivity),
    evidenceUpdatedAt: latestEvidence.updatedAt.toISOString(),
  };
}

export class MembershipPresenceError extends Error {
  constructor(
    message: string,
    readonly code: "MEMBERSHIP_UNAVAILABLE" | "FUTURE_SEQUENCE",
  ) {
    super(message);
  }
}

function isTransientPresenceWriteError(error: unknown) {
  const detail = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /P1008|P2024|socket timeout|database is locked|database is busy/i.test(detail);
}

async function retryTransientPresenceWrite<T>(operation: () => Promise<T>) {
  let lastError: unknown;
  for (const delayMs of [0, 25, 75, 150]) {
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientPresenceWriteError(error)) throw error;
    }
  }
  throw lastError;
}

export async function recordMembershipPresence(input: {
  taleSessionId: string;
  playerProfileId: string;
  membershipId: string;
  deviceInstanceId: string;
  acknowledgedSequence: number;
  safeActivity?: SafePresenceActivity;
  disconnected?: boolean;
}) {
  const membership = await db.playthroughMembership.findFirst({
    where: {
      id: input.membershipId,
      playthroughId: input.taleSessionId,
      playerProfileId: input.playerProfileId,
      status: { in: ["INVITED", "ACCEPTED", "READY", "ACTIVE_MEMBER", "COMPLETED_MEMBER"] },
    },
    include: { playthrough: { select: { currentSequence: true } } },
  });
  if (!membership)
    throw new MembershipPresenceError("This Player membership is unavailable.", "MEMBERSHIP_UNAVAILABLE");
  if (input.acknowledgedSequence > membership.playthrough.currentSequence)
    throw new MembershipPresenceError("The acknowledged Voyage sequence is unavailable.", "FUTURE_SEQUENCE");
  const now = new Date();
  const retentionCutoff = new Date(now.getTime() - membershipPresencePolicy.retentionMs);
  // Keep an individual heartbeat to one short SQLite write transaction. The
  // Captain's waiting room and an invitation acceptance can legitimately be
  // active at the same time; allowing the cleanup, upsert, acknowledgement,
  // and retention trim to interleave would turn that normal overlap into a
  // transient lock conflict. The bounded retry is intentionally around the
  // whole idempotent operation, never around a partial acknowledgement.
  const persist = async (tx: { membershipPresenceDevice: typeof db.membershipPresenceDevice }) => {
    await tx.membershipPresenceDevice.deleteMany({
      where: {
        playthroughMembershipId: membership.id,
        OR: [{ lastHeartbeatAt: { lt: retentionCutoff } }, { disconnectedAt: { lt: retentionCutoff } }],
      },
    });
    const device = await tx.membershipPresenceDevice.upsert({
      where: {
        playthroughMembershipId_deviceInstanceId: {
          playthroughMembershipId: membership.id,
          deviceInstanceId: input.deviceInstanceId,
        },
      },
      create: {
        playthroughMembershipId: membership.id,
        taleSessionId: input.taleSessionId,
        deviceInstanceId: input.deviceInstanceId,
        lastHeartbeatAt: now,
        acknowledgedSequence: input.acknowledgedSequence,
        safeActivity: input.safeActivity,
        disconnectedAt: input.disconnected ? now : null,
      },
      update: {
        lastHeartbeatAt: now,
        safeActivity: input.safeActivity,
        disconnectedAt: input.disconnected ? now : null,
      },
      select: { id: true },
    });
    if (!input.disconnected)
      await tx.membershipPresenceDevice.updateMany({
        where: { id: device.id, acknowledgedSequence: { lte: input.acknowledgedSequence } },
        data: {
          acknowledgedSequence: input.acknowledgedSequence,
          lastHeartbeatAt: now,
          safeActivity: input.safeActivity,
        },
      });
    const overflow = await tx.membershipPresenceDevice.findMany({
      where: { playthroughMembershipId: membership.id },
      orderBy: [{ lastHeartbeatAt: "desc" }, { id: "desc" }],
      skip: membershipPresencePolicy.maxDevicesPerMembership,
      select: { id: true },
    });
    if (overflow.length)
      await tx.membershipPresenceDevice.deleteMany({ where: { id: { in: overflow.map((row) => row.id) } } });
  };
  // The production Prisma client always provides the transaction function.
  // Keeping the direct persistence fallback preserves compatibility with the
  // narrow service-test double, while the application runtime uses the bounded
  // transaction path above.
  const transaction = db.$transaction;
  if (typeof transaction === "function")
    await retryTransientPresenceWrite(() => transaction((tx) => persist(tx), { maxWait: 1_000, timeout: 5_000 }));
  else await retryTransientPresenceWrite(() => persist(db));
  return { recordedAt: now.toISOString(), currentSequence: membership.playthrough.currentSequence };
}
