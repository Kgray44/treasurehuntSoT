import { db } from "@/lib/db";
import { AdmiraltyError } from "@/admiralty/errors";
import { preferencesForProfile, preferenceV1Schema } from "./profile";
import { revokeAccountSessionByAdministrator, type WayfarerAdministratorActor } from "./admin-commands";

const staleSessionAgeMs = 30 * 24 * 60 * 60 * 1000;

export type WayfarerSupportRepairPreview = Readonly<{
  targetId: string;
  targetRevision: string;
  affectedRecords: number;
  currentState: Record<string, unknown>;
  resultingState: Record<string, unknown>;
}>;

export async function previewWayfarerProfileReconcile(targetAccountId: string, targetId: string) {
  const profile = await db.playerProfile.findFirst({
    where: { id: targetId, accountId: targetAccountId },
    select: { id: true, updatedAt: true, preferenceSet: { select: { updatedAt: true } } },
  });
  if (!profile)
    throw new AdmiraltyError(
      "SUPPORT_REPAIR_PRECONDITION_FAILED",
      "The consented profile is no longer available.",
      409,
    );
  return {
    targetId: profile.id,
    targetRevision: profile.updatedAt.toISOString(),
    // A reconcile is idempotent when the representation is already present,
    // but it still operates on exactly one bounded profile representation.
    affectedRecords: 1,
    currentState: { preferenceProjection: profile.preferenceSet ? "PRESENT" : "MISSING" },
    resultingState: { preferenceProjection: "PRESENT" },
  } satisfies WayfarerSupportRepairPreview;
}

export async function executeWayfarerProfileReconcile(input: {
  targetAccountId: string;
  targetId: string;
  targetRevision: string;
}) {
  const preview = await previewWayfarerProfileReconcile(input.targetAccountId, input.targetId);
  if (preview.targetRevision !== input.targetRevision)
    throw new AdmiraltyError("SUPPORT_REPAIR_STALE", "The profile changed after the repair proposal was created.", 409);
  const preferences = await preferencesForProfile(input.targetId);
  return { ...preview, preferencesSchemaVersion: preferences.version };
}

export async function verifyWayfarerProfileReconcile(targetAccountId: string, targetId: string) {
  const profile = await db.playerProfile.findFirst({
    where: { id: targetId, accountId: targetAccountId },
    select: { preferenceSet: { select: { payload: true } } },
  });
  if (!profile?.preferenceSet) return false;
  try {
    preferenceV1Schema.parse(JSON.parse(profile.preferenceSet.payload));
    return true;
  } catch {
    return false;
  }
}

export async function previewWayfarerStaleSessionRevoke(targetAccountId: string, targetId: string, now = new Date()) {
  const session = await db.accountSession.findFirst({
    where: { id: targetId, accountId: targetAccountId },
    select: {
      id: true,
      lastSeenAt: true,
      expiresAt: true,
      revokedAt: true,
      sessionType: true,
      privilegedAssurances: { where: { revokedAt: null }, select: { id: true } },
    },
  });
  if (!session)
    throw new AdmiraltyError(
      "SUPPORT_REPAIR_PRECONDITION_FAILED",
      "The consented session is no longer available.",
      409,
    );
  if (session.revokedAt || session.expiresAt <= now || now.getTime() - session.lastSeenAt.getTime() < staleSessionAgeMs)
    throw new AdmiraltyError(
      "SUPPORT_REPAIR_PRECONDITION_FAILED",
      "Only a still-authenticating session inactive for 30 days can be revoked.",
      409,
    );
  if (session.privilegedAssurances.length > 1)
    throw new AdmiraltyError(
      "SUPPORT_REPAIR_PRECONDITION_FAILED",
      "The stale-session repair would exceed its two-record safety limit.",
      409,
    );
  return {
    targetId: session.id,
    targetRevision: `${session.lastSeenAt.toISOString()}:${session.expiresAt.toISOString()}`,
    affectedRecords: 1 + session.privilegedAssurances.length,
    currentState: { session: "STALE_ACTIVE", sessionType: session.sessionType },
    resultingState: { session: "REVOKED", privilegedAssurances: "REVOKED" },
  } satisfies WayfarerSupportRepairPreview;
}

export async function executeWayfarerStaleSessionRevoke(input: {
  actor: WayfarerAdministratorActor;
  targetAccountId: string;
  targetId: string;
  targetRevision: string;
  correlationId: string;
  idempotencyKey: string;
}) {
  const preview = await previewWayfarerStaleSessionRevoke(input.targetAccountId, input.targetId);
  if (preview.targetRevision !== input.targetRevision)
    throw new AdmiraltyError("SUPPORT_REPAIR_STALE", "The session changed after the repair proposal was created.", 409);
  const result = await revokeAccountSessionByAdministrator({
    actor: input.actor,
    accountId: input.targetAccountId,
    sessionId: input.targetId,
    reason: "Registered Support Pilot stale-session repair.",
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
  });
  return { ...preview, result };
}

export async function verifyWayfarerStaleSessionRevoke(targetAccountId: string, targetId: string) {
  const session = await db.accountSession.findFirst({
    where: { id: targetId, accountId: targetAccountId },
    select: { revokedAt: true, privilegedAssurances: { where: { revokedAt: null }, select: { id: true } } },
  });
  return Boolean(session?.revokedAt) && (session ? session.privilegedAssurances.length === 0 : false);
}
