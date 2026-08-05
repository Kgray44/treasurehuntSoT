import { compare } from "bcryptjs";
import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createAccountSession, normalizeEmail } from "@/wayfarer/accounts";

export const ACCOUNT_REACTIVATION_WINDOW_DAYS = 30;
export const ACCOUNT_DELETION_DELAY_DAYS = 30;
export const ACCOUNT_EXPORT_TTL_HOURS = 48;

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1_000);
const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 60 * 60 * 1_000);
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export class AccountLifecycleError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID" | "CONFLICT" | "FORBIDDEN" | "NOT_FOUND" | "EXPIRED" = "INVALID",
  ) {
    super(message);
  }
}

export function humanAccountState(status: string, verified: boolean) {
  if (status === "GUEST_UNCLAIMED") return "Account setup required";
  if (status === "PENDING_VERIFICATION" || !verified) return "Verification required";
  if (status === "ACTIVE") return "Active account";
  if (status === "DEACTIVATED") return "Deactivation pending";
  if (status === "DELETION_SCHEDULED") return "Deletion scheduled";
  if (["LOCKED", "SUSPENDED", "RESTRICTED"].includes(status)) return "Restricted account";
  if (status === "DELETED") return "Deleted account";
  return "Restricted account";
}

export async function verifyAccountPassword(accountId: string, password: string) {
  const account = await db.userAccount.findUnique({
    where: { id: accountId },
    select: { id: true, status: true, credential: { select: { passwordHash: true } } },
  });
  if (!account?.credential || !(await compare(password, account.credential.passwordHash))) {
    throw new AccountLifecycleError("Reauthentication failed. Check your password and try again.", "FORBIDDEN");
  }
  return account;
}

function exportSummary(row: {
  id: string;
  state: string;
  schemaVersion: number;
  checksum: string | null;
  requestedAt: Date;
  readyAt: Date | null;
  failedAt: Date | null;
  expiresAt: Date | null;
  downloadedAt: Date | null;
  failureSummary: string | null;
}) {
  const expired = Boolean(row.expiresAt && row.expiresAt.getTime() <= Date.now());
  return {
    id: row.id,
    state: expired && row.state === "READY" ? "EXPIRED" : row.state,
    schemaVersion: row.schemaVersion,
    checksum: row.checksum,
    requestedAt: row.requestedAt.toISOString(),
    readyAt: row.readyAt?.toISOString() ?? null,
    failedAt: row.failedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    downloadedAt: row.downloadedAt?.toISOString() ?? null,
    failureSummary: row.failureSummary,
    downloadHref: !expired && row.state === "READY" ? `/api/account/data/export/${encodeURIComponent(row.id)}` : null,
  };
}

async function buildAccountExport(accountId: string, exportId: string) {
  const buildingAt = new Date();
  await db.accountDataExport.update({ where: { id: exportId }, data: { state: "BUILDING", buildingAt } });
  try {
    const [account, profile, roles, identities, events, reviews, saves] = await Promise.all([
      db.userAccount.findUnique({
        where: { id: accountId },
        select: {
          id: true,
          status: true,
          claimedAt: true,
          createdAt: true,
          updatedAt: true,
          emails: {
            select: {
              displayEmail: true,
              isPrimary: true,
              verificationState: true,
              verifiedAt: true,
              createdAt: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      db.playerProfile.findUnique({
        where: { accountId },
        select: {
          id: true,
          displayName: true,
          handle: true,
          biography: true,
          defaultVisibility: true,
          status: true,
          claimedAt: true,
          createdAt: true,
          updatedAt: true,
          preferenceSet: { select: { schemaVersion: true, payload: true, updatedAt: true } },
          privacyRules: { select: { section: true, visibility: true, updatedAt: true }, orderBy: { section: "asc" } },
          memberships: {
            select: {
              id: true,
              playthroughId: true,
              role: true,
              status: true,
              crewRole: true,
              participationAlias: true,
              joinedAt: true,
              removedAt: true,
              completedAt: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { createdAt: "asc" },
          },
          chronicleRecords: {
            select: {
              id: true,
              sourcePlaythroughId: true,
              chronicleTitleSnapshot: true,
              playerNameSnapshot: true,
              lifecycleStatus: true,
              startedAt: true,
              completedAt: true,
              createdAt: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      db.accountRoleAssignment.findMany({
        where: { accountId },
        select: { role: true, scopeType: true, scopeId: true, grantedAt: true, revokedAt: true },
        orderBy: { grantedAt: "asc" },
      }),
      db.externalIdentity.findMany({
        where: { accountId },
        select: {
          provider: true,
          providerDisplayName: true,
          useForLogin: true,
          visibility: true,
          status: true,
          linkedAt: true,
          lastVerifiedAt: true,
          revokedAt: true,
        },
        orderBy: { linkedAt: "asc" },
      }),
      db.securityEvent.findMany({
        where: { accountId },
        select: { eventType: true, correlationId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      db.communityReview.findMany({
        where: { authorAccountId: accountId },
        select: {
          id: true,
          listingId: true,
          rating: true,
          spoilerFreeBody: true,
          spoilerBody: true,
          status: true,
          createdAt: true,
          editedAt: true,
          deletedAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      db.communitySave.findMany({
        where: { accountId },
        select: { subjectType: true, subjectId: true, kind: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    if (!account) throw new AccountLifecycleError("Account export source no longer exists.", "NOT_FOUND");
    const files = {
      "account.json": account,
      "profile.json": profile,
      "workspace-capabilities.json": roles,
      "linked-identities.json": identities,
      "security-events.json": events,
      "community-reviews.json": reviews,
      "community-saves.json": saves,
    };
    const readyAt = new Date();
    const manifest = {
      schemaVersion: 1,
      exportId,
      accountId,
      generatedAt: readyAt.toISOString(),
      scope: Object.keys(files),
      exclusions: [
        "password hashes",
        "session and CSRF tokens",
        "one-time challenge tokens",
        "provider subjects and encrypted provider tokens",
        "other accounts' private data",
      ],
    };
    const payload = JSON.stringify({ manifest, files });
    const checksum = digest(payload);
    return db.accountDataExport.update({
      where: { id: exportId },
      data: {
        state: "READY",
        manifest: JSON.stringify(manifest),
        payload,
        checksum,
        readyAt,
        expiresAt: addHours(readyAt, ACCOUNT_EXPORT_TTL_HOURS),
      },
    });
  } catch (cause) {
    const failureSummary = cause instanceof AccountLifecycleError ? cause.message : "The export could not be built.";
    await db.accountDataExport.update({
      where: { id: exportId },
      data: { state: "FAILED", failedAt: new Date(), failureSummary: failureSummary.slice(0, 500) },
    });
    throw cause;
  }
}

export async function requestAccountExport(accountId: string, password: string) {
  await verifyAccountPassword(accountId, password);
  const pending = await db.accountDataExport.findFirst({
    where: { accountId, state: { in: ["REQUESTED", "BUILDING"] } },
    orderBy: { requestedAt: "desc" },
  });
  if (pending) return exportSummary(pending);
  const created = await db.accountDataExport.create({ data: { accountId, manifest: "{}" } });
  const ready = await buildAccountExport(accountId, created.id);
  await db.securityEvent.create({
    data: {
      accountId,
      eventType: "ACCOUNT_DATA_EXPORT_READY",
      correlationId: randomUUID(),
      metadata: JSON.stringify({ exportId: created.id, checksum: ready.checksum }),
    },
  });
  return exportSummary(ready);
}

export async function listAccountExports(accountId: string) {
  await db.accountDataExport.updateMany({
    where: { accountId, state: "READY", expiresAt: { lte: new Date() } },
    data: { state: "EXPIRED", payload: null },
  });
  return Promise.all(
    (await db.accountDataExport.findMany({ where: { accountId }, orderBy: { requestedAt: "desc" }, take: 10 })).map(
      exportSummary,
    ),
  );
}

export async function downloadAccountExport(accountId: string, exportId: string) {
  const record = await db.accountDataExport.findFirst({ where: { id: exportId, accountId } });
  if (!record) throw new AccountLifecycleError("Account export not found.", "NOT_FOUND");
  if (record.state !== "READY" || !record.payload || !record.checksum)
    throw new AccountLifecycleError("Account export is not ready.", "CONFLICT");
  if (!record.expiresAt || record.expiresAt.getTime() <= Date.now()) {
    await db.accountDataExport.update({ where: { id: record.id }, data: { state: "EXPIRED", payload: null } });
    throw new AccountLifecycleError("Account export has expired.", "EXPIRED");
  }
  await db.accountDataExport.update({ where: { id: record.id }, data: { downloadedAt: new Date() } });
  return { payload: record.payload, checksum: record.checksum };
}

async function leaveActivePlayerMemberships(tx: Prisma.TransactionClient, profileId: string | undefined, now: Date) {
  if (!profileId) return 0;
  const result = await tx.playthroughMembership.updateMany({
    where: {
      playerProfileId: profileId,
      status: { in: ["ACCEPTED", "READY", "ACTIVE_MEMBER"] },
      playthrough: { status: "ACTIVE", previewMode: false },
    },
    data: { status: "LEFT", removedAt: now },
  });
  return result.count;
}

export async function deactivateAccount(accountId: string, password: string, confirmation: string) {
  if (confirmation !== "DEACTIVATE")
    throw new AccountLifecycleError("Type DEACTIVATE exactly to confirm account deactivation.");
  const account = await verifyAccountPassword(accountId, password);
  if (account.status !== "ACTIVE") throw new AccountLifecycleError("Only an active account can be deactivated.");
  const now = new Date();
  const reactivationDeadline = addDays(now, ACCOUNT_REACTIVATION_WINDOW_DAYS);
  const request = await db.$transaction(async (tx) => {
    const profile = await tx.playerProfile.findUnique({ where: { accountId }, select: { id: true } });
    const leftMemberships = await leaveActivePlayerMemberships(tx, profile?.id, now);
    await tx.accountSession.updateMany({ where: { accountId, revokedAt: null }, data: { revokedAt: now } });
    await tx.userAccount.update({ where: { id: accountId }, data: { status: "DEACTIVATED", suspendedAt: now } });
    if (profile) await tx.playerProfile.update({ where: { id: profile.id }, data: { status: "DEACTIVATED" } });
    const lifecycle = await tx.accountLifecycleRequest.create({
      data: {
        accountId,
        kind: "DEACTIVATION",
        state: "COMPLETED",
        completedAt: now,
        cancellableUntil: reactivationDeadline,
        reason: "Owner-requested account deactivation",
      },
    });
    await tx.securityEvent.create({
      data: {
        accountId,
        eventType: "ACCOUNT_DEACTIVATED",
        correlationId: randomUUID(),
        metadata: JSON.stringify({ lifecycleId: lifecycle.id, leftMemberships, reactivationDeadline }),
      },
    });
    return lifecycle;
  });
  return { id: request.id, state: request.state, reactivationDeadline: reactivationDeadline.toISOString() };
}

export async function scheduleAccountDeletion(accountId: string, password: string, confirmation: string) {
  if (confirmation !== "DELETE ACCOUNT")
    throw new AccountLifecycleError("Type DELETE ACCOUNT exactly to schedule deletion.");
  const account = await verifyAccountPassword(accountId, password);
  if (account.status !== "ACTIVE") throw new AccountLifecycleError("Only an active account can schedule deletion.");
  const prior = await db.accountLifecycleRequest.findFirst({
    where: { accountId, kind: "DELETION", state: "SCHEDULED" },
    orderBy: { requestedAt: "desc" },
  });
  if (prior)
    return {
      id: prior.id,
      state: prior.state,
      scheduledFor: prior.scheduledFor?.toISOString() ?? null,
      cancellableUntil: prior.cancellableUntil?.toISOString() ?? null,
    };
  const now = new Date();
  const scheduledFor = addDays(now, ACCOUNT_DELETION_DELAY_DAYS);
  const request = await db.$transaction(async (tx) => {
    const profile = await tx.playerProfile.findUnique({ where: { accountId }, select: { id: true } });
    const leftMemberships = await leaveActivePlayerMemberships(tx, profile?.id, now);
    await tx.accountSession.updateMany({ where: { accountId, revokedAt: null }, data: { revokedAt: now } });
    await tx.userAccount.update({
      where: { id: accountId },
      data: { status: "DELETION_SCHEDULED", suspendedAt: now },
    });
    if (profile) await tx.playerProfile.update({ where: { id: profile.id }, data: { status: "DELETION_SCHEDULED" } });
    const lifecycle = await tx.accountLifecycleRequest.create({
      data: {
        accountId,
        kind: "DELETION",
        state: "SCHEDULED",
        scheduledFor,
        cancellableUntil: scheduledFor,
        reason: "Owner-requested account deletion",
      },
    });
    await tx.securityEvent.create({
      data: {
        accountId,
        eventType: "ACCOUNT_DELETION_SCHEDULED",
        correlationId: randomUUID(),
        metadata: JSON.stringify({ lifecycleId: lifecycle.id, scheduledFor, leftMemberships }),
      },
    });
    return lifecycle;
  });
  return {
    id: request.id,
    state: request.state,
    scheduledFor: scheduledFor.toISOString(),
    cancellableUntil: scheduledFor.toISOString(),
  };
}

async function accountByVerifiedEmail(email: string) {
  return db.accountEmail.findUnique({
    where: { normalizedEmail: normalizeEmail(email) },
    include: { account: { include: { credential: true, profile: true } } },
  });
}

export async function reactivateAccount(email: string, password: string) {
  const emailRecord = await accountByVerifiedEmail(email);
  const account = emailRecord?.account;
  if (
    !emailRecord ||
    emailRecord.verificationState !== "VERIFIED" ||
    !account?.credential ||
    account.status !== "DEACTIVATED" ||
    !(await compare(password, account.credential.passwordHash))
  )
    throw new AccountLifecycleError("Reactivation details are invalid or unavailable.", "FORBIDDEN");
  const lifecycle = await db.accountLifecycleRequest.findFirst({
    where: { accountId: account.id, kind: "DEACTIVATION", state: "COMPLETED" },
    orderBy: { requestedAt: "desc" },
  });
  if (!lifecycle?.cancellableUntil || lifecycle.cancellableUntil.getTime() <= Date.now())
    throw new AccountLifecycleError("The reactivation window has expired.", "EXPIRED");
  await db.$transaction(async (tx) => {
    await tx.userAccount.update({ where: { id: account.id }, data: { status: "ACTIVE", suspendedAt: null } });
    if (account.profile)
      await tx.playerProfile.update({ where: { id: account.profile.id }, data: { status: "ACTIVE" } });
    await tx.accountLifecycleRequest.update({
      where: { id: lifecycle.id },
      data: { state: "REACTIVATED", canceledAt: new Date() },
    });
    await tx.securityEvent.create({
      data: {
        accountId: account.id,
        eventType: "ACCOUNT_REACTIVATED",
        correlationId: randomUUID(),
        metadata: JSON.stringify({ lifecycleId: lifecycle.id }),
      },
    });
  });
  return { accountId: account.id, session: await createAccountSession(account.id, "Account reactivation") };
}

export async function cancelScheduledDeletion(email: string, password: string, confirmation: string) {
  if (confirmation !== "CANCEL DELETION")
    throw new AccountLifecycleError("Type CANCEL DELETION exactly to keep this account.");
  const emailRecord = await accountByVerifiedEmail(email);
  const account = emailRecord?.account;
  if (
    !emailRecord ||
    emailRecord.verificationState !== "VERIFIED" ||
    !account?.credential ||
    account.status !== "DELETION_SCHEDULED" ||
    !(await compare(password, account.credential.passwordHash))
  )
    throw new AccountLifecycleError("Deletion-cancellation details are invalid or unavailable.", "FORBIDDEN");
  const lifecycle = await db.accountLifecycleRequest.findFirst({
    where: { accountId: account.id, kind: "DELETION", state: "SCHEDULED" },
    orderBy: { requestedAt: "desc" },
  });
  if (!lifecycle?.cancellableUntil || lifecycle.cancellableUntil.getTime() <= Date.now())
    throw new AccountLifecycleError("The deletion cancellation window has expired.", "EXPIRED");
  await db.$transaction(async (tx) => {
    await tx.userAccount.update({ where: { id: account.id }, data: { status: "ACTIVE", suspendedAt: null } });
    if (account.profile)
      await tx.playerProfile.update({ where: { id: account.profile.id }, data: { status: "ACTIVE" } });
    await tx.accountLifecycleRequest.update({
      where: { id: lifecycle.id },
      data: { state: "CANCELED", canceledAt: new Date() },
    });
    await tx.securityEvent.create({
      data: {
        accountId: account.id,
        eventType: "ACCOUNT_DELETION_CANCELED",
        correlationId: randomUUID(),
        metadata: JSON.stringify({ lifecycleId: lifecycle.id }),
      },
    });
  });
  return { accountId: account.id, session: await createAccountSession(account.id, "Deletion cancellation") };
}

export async function processDueAccountDeletions(now = new Date()) {
  const due = await db.accountLifecycleRequest.findMany({
    where: { kind: "DELETION", state: "SCHEDULED", scheduledFor: { lte: now } },
    orderBy: { scheduledFor: "asc" },
  });
  let processed = 0;
  for (const lifecycle of due) {
    await db.$transaction(async (tx) => {
      const current = await tx.accountLifecycleRequest.findUnique({ where: { id: lifecycle.id } });
      if (!current || current.state !== "SCHEDULED" || !current.scheduledFor || current.scheduledFor > now) return;
      const profile = await tx.playerProfile.findUnique({ where: { accountId: lifecycle.accountId } });
      const tombstone = `deleted-${digest(lifecycle.accountId).slice(0, 20)}`;
      await tx.accountSession.updateMany({
        where: { accountId: lifecycle.accountId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.accountToken.deleteMany({ where: { accountId: lifecycle.accountId } });
      await tx.providerLinkAttempt.deleteMany({ where: { accountId: lifecycle.accountId } });
      const identities = await tx.externalIdentity.findMany({
        where: { accountId: lifecycle.accountId },
        select: { id: true },
      });
      for (const identity of identities)
        await tx.externalIdentity.update({
          where: { id: identity.id },
          data: {
            providerAccountId: `${tombstone}-${identity.id.slice(-12)}`,
            providerDisplayName: null,
            avatarReference: null,
            allowedScopes: "[]",
            useForLogin: false,
            visibility: "ONLY_ME",
            status: "REVOKED",
            encryptedToken: null,
            revokedAt: now,
          },
        });
      await tx.accountDataExport.updateMany({
        where: { accountId: lifecycle.accountId },
        data: { state: "EXPIRED", payload: null, expiresAt: now },
      });
      if (profile) {
        await tx.profileMedia.updateMany({
          where: { profileId: profile.id, removedAt: null },
          data: { removedAt: now },
        });
        await tx.profilePrivacyRule.updateMany({
          where: { playerProfileId: profile.id },
          data: { visibility: "ONLY_ME" },
        });
        await tx.profilePreferenceSet.updateMany({ where: { playerProfileId: profile.id }, data: { payload: "{}" } });
        await tx.playerProfile.update({
          where: { id: profile.id },
          data: {
            username: null,
            passwordHash: null,
            displayName: "Deleted Voyagewright",
            handle: null,
            normalizedHandle: null,
            biography: null,
            avatarMediaId: null,
            bannerMediaId: null,
            defaultVisibility: "ONLY_ME",
            status: "DELETED",
            preferences: "{}",
          },
        });
      }
      await tx.communityProfile.updateMany({
        where: { accountId: lifecycle.accountId },
        data: {
          normalizedHandle: tombstone,
          handle: tombstone,
          displayName: "Deleted Creator",
          biography: null,
          visibility: "PRIVATE",
          creatorStatus: "DELETED",
          socialLinks: "[]",
        },
      });
      await tx.accountEmail.deleteMany({ where: { accountId: lifecycle.accountId } });
      await tx.accountCredential.deleteMany({ where: { accountId: lifecycle.accountId } });
      await tx.userAccount.update({
        where: { id: lifecycle.accountId },
        data: { status: "DELETED", lockedAt: null, suspendedAt: null },
      });
      await tx.accountLifecycleRequest.update({
        where: { id: lifecycle.id },
        data: { state: "COMPLETED", completedAt: now },
      });
      await tx.securityEvent.create({
        data: {
          accountId: lifecycle.accountId,
          eventType: "ACCOUNT_DELETION_COMPLETED",
          correlationId: randomUUID(),
          metadata: JSON.stringify({ lifecycleId: lifecycle.id, tombstone }),
        },
      });
      processed += 1;
    });
  }
  return { processed };
}

export async function accountDataOverview(accountId: string) {
  const [exports, lifecycle] = await Promise.all([
    listAccountExports(accountId),
    db.accountLifecycleRequest.findMany({
      where: { accountId },
      select: {
        id: true,
        kind: true,
        state: true,
        requestedAt: true,
        scheduledFor: true,
        cancellableUntil: true,
        canceledAt: true,
        completedAt: true,
      },
      orderBy: { requestedAt: "desc" },
      take: 10,
    }),
  ]);
  return {
    policy: {
      exportTtlHours: ACCOUNT_EXPORT_TTL_HOURS,
      reactivationWindowDays: ACCOUNT_REACTIVATION_WINDOW_DAYS,
      deletionDelayDays: ACCOUNT_DELETION_DELAY_DAYS,
    },
    exports,
    lifecycle: lifecycle.map((row) => ({
      ...row,
      requestedAt: row.requestedAt.toISOString(),
      scheduledFor: row.scheduledFor?.toISOString() ?? null,
      cancellableUntil: row.cancellableUntil?.toISOString() ?? null,
      canceledAt: row.canceledAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
    })),
  };
}
