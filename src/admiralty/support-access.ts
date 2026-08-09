import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { sanitizeAdministrativeMetadata, writeAdministrativeAudit } from "./audit";
import type { AdmiraltyCurrentOperator } from "./authorization";
import { AdmiraltyError } from "./errors";
import type { SupportAccessScope } from "./schemas";

export const supportRequestLifetimeMs = 24 * 60 * 60 * 1000;
export const supportGrantLifetimeMs = 30 * 60 * 1000;

export type SupportTargetActor = Readonly<{ accountId: string; accountSessionId: string }>;

function parseScopes(value: string): SupportAccessScope[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is SupportAccessScope => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseSafeMetadata(value: string) {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed ? sanitizeAdministrativeMetadata(parsed) : {};
  } catch {
    return {};
  }
}

function effectiveRequestStatus(
  request: {
    status: string;
    expiresAt: Date;
    grant?: { status: string; expiresAt: Date; revokedAt: Date | null } | null;
  },
  now: Date,
) {
  if (request.status === "REQUESTED" && request.expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  if (request.grant?.revokedAt || request.grant?.status === "REVOKED") return "REVOKED";
  if (request.grant && request.grant.expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  if (request.grant?.status === "ACTIVE") return "ACTIVE";
  return request.status;
}

export async function createSupportAccessRequest(
  operator: AdmiraltyCurrentOperator,
  input: { targetAccountId: string; purpose: string; requestedScopes: readonly SupportAccessScope[] },
  now = new Date(),
) {
  if (operator.accountId === input.targetAccountId)
    throw new AdmiraltyError("ADMIN_VALIDATION_FAILED", "Choose a different support target account.", 400);
  const target = await db.userAccount.findUnique({ where: { id: input.targetAccountId }, select: { id: true } });
  if (!target) throw new AdmiraltyError("ADMIN_TARGET_NOT_FOUND", "The support target was not found.", 404);
  const requestedScopes = [...new Set(input.requestedScopes)].sort();
  const correlationId = randomUUID();
  return db.$transaction(async (tx) => {
    const created = await tx.supportAccessRequest.create({
      data: {
        requestingAdminAccountId: operator.accountId,
        targetAccountId: target.id,
        purpose: input.purpose.slice(0, 240),
        requestedScopes: JSON.stringify(requestedScopes),
        requestedAt: now,
        expiresAt: new Date(now.getTime() + supportRequestLifetimeMs),
        correlationId,
      },
    });
    await writeAdministrativeAudit(
      {
        actorAccountId: operator.accountId,
        actorRole: operator.roles[0] ?? "SUPPORT_OPERATOR",
        capability: "SUPPORT_REQUEST",
        action: "ADMIRALTY_SUPPORT_REQUEST_CREATED",
        targetType: "UserAccount",
        targetId: target.id,
        reason: input.purpose,
        authorizationBasis: operator.authorizationBasis,
        accountSessionId: operator.accountSessionId,
        correlationId,
        afterSummary: {
          requestId: created.id,
          requestedScopes,
          status: "REQUESTED",
          decisionDeadline: created.expiresAt,
        },
      },
      tx,
    );
    return created;
  });
}

export async function listSupportAccessForTarget(targetAccountId: string, now = new Date()) {
  const requests = await db.supportAccessRequest.findMany({
    where: { targetAccountId },
    include: {
      requestingAdmin: {
        select: {
          profile: { select: { displayName: true } },
          roles: { where: { revokedAt: null }, select: { role: true } },
        },
      },
      grant: true,
    },
    orderBy: { requestedAt: "desc" },
    take: 30,
  });
  return requests.map((request) => ({
    id: request.id,
    operator: request.requestingAdmin.profile?.displayName ?? "Voyagewright support operator",
    operatorRoles: request.requestingAdmin.roles.map((role) => role.role).sort(),
    purpose: request.purpose,
    requestedScopes: parseScopes(request.requestedScopes),
    requestedAt: request.requestedAt,
    decisionDeadline: request.expiresAt,
    status: effectiveRequestStatus(request, now),
    grant: request.grant
      ? {
          id: request.grant.id,
          scopes: parseScopes(request.grant.grantedScopes),
          issuedAt: request.grant.issuedAt,
          expiresAt: request.grant.expiresAt,
          status: effectiveRequestStatus(request, now),
        }
      : null,
  }));
}

export async function decideSupportAccessRequest(
  target: SupportTargetActor,
  requestId: string,
  decision: "APPROVE" | "DENY",
  now = new Date(),
) {
  const correlationId = randomUUID();
  return db.$transaction(async (tx) => {
    const request = await tx.supportAccessRequest.findUnique({ where: { id: requestId }, include: { grant: true } });
    if (!request || request.targetAccountId !== target.accountId)
      throw new AdmiraltyError("ADMIN_TARGET_NOT_FOUND", "The support request was not found.", 404);
    if (request.status !== "REQUESTED" || request.grant)
      throw new AdmiraltyError("ADMIN_CONFLICT", "This support request already has a decision.", 409);
    if (request.expiresAt.getTime() <= now.getTime())
      throw new AdmiraltyError("SUPPORT_GRANT_EXPIRED", "This support request has expired.", 409);

    if (decision === "DENY") {
      const denied = await tx.supportAccessRequest.update({
        where: { id: request.id },
        data: { status: "DENIED", decisionAt: now, decisionByTargetAccountId: target.accountId },
      });
      await writeAdministrativeAudit(
        {
          actorAccountId: target.accountId,
          actorRole: "ACCOUNT_OWNER",
          actorType: "PLAYER",
          capability: "SUPPORT_USE",
          action: "ADMIRALTY_SUPPORT_REQUEST_DENIED",
          targetType: "SupportAccessRequest",
          targetId: request.id,
          reason: "The target account denied the scoped support request.",
          authorizationBasis: "TARGET_ACCOUNT_OWNERSHIP",
          accountSessionId: target.accountSessionId,
          correlationId,
          beforeSummary: { status: "REQUESTED" },
          afterSummary: { status: "DENIED" },
        },
        tx,
      );
      return { request: denied, grant: null };
    }

    const expiresAt = new Date(now.getTime() + supportGrantLifetimeMs);
    const approved = await tx.supportAccessRequest.update({
      where: { id: request.id },
      data: { status: "APPROVED", decisionAt: now, decisionByTargetAccountId: target.accountId },
    });
    const grant = await tx.supportAccessGrant.create({
      data: {
        requestId: request.id,
        operatorAccountId: request.requestingAdminAccountId,
        targetAccountId: request.targetAccountId,
        grantedScopes: request.requestedScopes,
        issuedAt: now,
        expiresAt,
        correlationId,
      },
    });
    await writeAdministrativeAudit(
      {
        actorAccountId: target.accountId,
        actorRole: "ACCOUNT_OWNER",
        actorType: "PLAYER",
        capability: "SUPPORT_USE",
        action: "ADMIRALTY_SUPPORT_REQUEST_APPROVED",
        targetType: "SupportAccessGrant",
        targetId: grant.id,
        reason: "The target account approved the exact requested support scopes.",
        authorizationBasis: "TARGET_ACCOUNT_OWNERSHIP",
        accountSessionId: target.accountSessionId,
        supportGrantId: grant.id,
        correlationId,
        beforeSummary: { status: "REQUESTED" },
        afterSummary: { status: "ACTIVE", grantedScopes: parseScopes(grant.grantedScopes), expiresAt },
      },
      tx,
    );
    return { request: approved, grant };
  });
}

export async function cancelSupportAccessRequest(
  operator: AdmiraltyCurrentOperator,
  requestId: string,
  reason = "The requesting operator cancelled the request.",
  now = new Date(),
) {
  const correlationId = randomUUID();
  return db.$transaction(async (tx) => {
    const request = await tx.supportAccessRequest.findUnique({ where: { id: requestId } });
    if (!request || request.requestingAdminAccountId !== operator.accountId)
      throw new AdmiraltyError("ADMIN_TARGET_NOT_FOUND", "The support request was not found.", 404);
    if (request.status !== "REQUESTED")
      throw new AdmiraltyError("ADMIN_CONFLICT", "Only a pending support request can be cancelled.", 409);
    const cancelled = await tx.supportAccessRequest.update({
      where: { id: request.id },
      data: { status: "CANCELLED", cancelledAt: now },
    });
    await writeAdministrativeAudit(
      {
        actorAccountId: operator.accountId,
        actorRole: operator.roles[0] ?? "SUPPORT_OPERATOR",
        capability: "SUPPORT_REQUEST",
        action: "ADMIRALTY_SUPPORT_REQUEST_CANCELLED",
        targetType: "SupportAccessRequest",
        targetId: request.id,
        reason,
        authorizationBasis: operator.authorizationBasis,
        accountSessionId: operator.accountSessionId,
        correlationId,
        beforeSummary: { status: "REQUESTED" },
        afterSummary: { status: "CANCELLED" },
      },
      tx,
    );
    return cancelled;
  });
}

async function revokeGrant(
  actor: {
    accountId: string;
    accountSessionId: string;
    actorRole: string;
    actorType: "PLAYER" | "SECURITY_OPERATOR";
    authorizationBasis: string;
  },
  grantId: string,
  reason: string,
  targetPolicy: "OWNER" | "SECURITY",
  now = new Date(),
) {
  const correlationId = randomUUID();
  return db.$transaction(async (tx) => {
    const grant = await tx.supportAccessGrant.findUnique({ where: { id: grantId } });
    if (!grant || (targetPolicy === "OWNER" && grant.targetAccountId !== actor.accountId))
      throw new AdmiraltyError("ADMIN_TARGET_NOT_FOUND", "The support grant was not found.", 404);
    if (grant.revokedAt || grant.status === "REVOKED")
      throw new AdmiraltyError("ADMIN_CONFLICT", "This support grant is already revoked.", 409);
    const revoked = await tx.supportAccessGrant.update({
      where: { id: grant.id },
      data: {
        status: "REVOKED",
        revokedAt: now,
        revokedByAccountId: actor.accountId,
        revocationReason: reason.slice(0, 160),
      },
    });
    await writeAdministrativeAudit(
      {
        actorAccountId: actor.accountId,
        actorRole: actor.actorRole,
        actorType: actor.actorType,
        capability: targetPolicy === "OWNER" ? "SUPPORT_USE" : "SECURITY_OPERATE",
        action: "ADMIRALTY_SUPPORT_GRANT_REVOKED",
        targetType: "SupportAccessGrant",
        targetId: grant.id,
        reason,
        authorizationBasis: actor.authorizationBasis,
        accountSessionId: actor.accountSessionId,
        supportGrantId: grant.id,
        correlationId,
        beforeSummary: { status: grant.status, expiresAt: grant.expiresAt },
        afterSummary: { status: "REVOKED", revokedAt: now },
      },
      tx,
    );
    return revoked;
  });
}

export function revokeSupportGrantByTarget(
  target: SupportTargetActor,
  grantId: string,
  reason: string,
  now = new Date(),
) {
  return revokeGrant(
    {
      accountId: target.accountId,
      accountSessionId: target.accountSessionId,
      actorRole: "ACCOUNT_OWNER",
      actorType: "PLAYER",
      authorizationBasis: "TARGET_ACCOUNT_OWNERSHIP",
    },
    grantId,
    reason,
    "OWNER",
    now,
  );
}

export function revokeSupportGrantBySecurityOperator(
  operator: AdmiraltyCurrentOperator,
  grantId: string,
  reason: string,
  now = new Date(),
) {
  return revokeGrant(
    {
      accountId: operator.accountId,
      accountSessionId: operator.accountSessionId,
      actorRole: operator.roles[0] ?? "SECURITY_OPERATOR",
      actorType: "SECURITY_OPERATOR",
      authorizationBasis: operator.authorizationBasis,
    },
    grantId,
    reason,
    "SECURITY",
    now,
  );
}

export async function operatorSupportSummary(operatorAccountId: string, now = new Date()) {
  const requests = await db.supportAccessRequest.findMany({
    where: { requestingAdminAccountId: operatorAccountId },
    include: { grant: true },
    orderBy: { requestedAt: "desc" },
    take: 20,
  });
  return {
    activeGrantCount: requests.filter((request) => effectiveRequestStatus(request, now) === "ACTIVE").length,
    pendingRequestCount: requests.filter((request) => effectiveRequestStatus(request, now) === "REQUESTED").length,
    recent: requests.map((request) => ({
      id: request.id,
      targetAccountId: request.targetAccountId,
      purpose: request.purpose,
      scopes: parseScopes(request.requestedScopes),
      status: effectiveRequestStatus(request, now),
      requestedAt: request.requestedAt,
      expiresAt: request.grant?.expiresAt ?? request.expiresAt,
      grantId: request.grant?.id ?? null,
    })),
  };
}

async function supportProjection(targetAccountId: string, scope: SupportAccessScope) {
  if (scope === "ACCOUNT_STATE") {
    const account = await db.userAccount.findUnique({
      where: { id: targetAccountId },
      select: {
        status: true,
        claimedAt: true,
        lastSeenAt: true,
        lockedAt: true,
        suspendedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!account) throw new AdmiraltyError("ADMIN_TARGET_NOT_FOUND", "The support target was not found.", 404);
    return { scope, account };
  }
  if (scope === "AUTH_EVENTS") {
    const events = await db.securityEvent.findMany({
      where: { accountId: targetAccountId },
      select: { eventType: true, correlationId: true, metadata: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 25,
    });
    return {
      scope,
      events: events.map((event) => ({
        eventType: event.eventType,
        correlationId: event.correlationId,
        createdAt: event.createdAt,
        detail: parseSafeMetadata(event.metadata),
      })),
    };
  }
  if (scope === "SESSION_DIAGNOSTICS") {
    const sessions = await db.accountSession.findMany({
      where: { accountId: targetAccountId },
      select: { sessionType: true, createdAt: true, lastSeenAt: true, expiresAt: true, revokedAt: true },
      orderBy: { lastSeenAt: "desc" },
      take: 20,
    });
    return { scope, sessionCount: sessions.length, sessions };
  }
  if (scope === "PROFILE_DIAGNOSTICS") {
    const profile = await db.playerProfile.findUnique({
      where: { accountId: targetAccountId },
      select: {
        status: true,
        claimedAt: true,
        createdAt: true,
        updatedAt: true,
        lastSeenAt: true,
        handle: true,
        avatarMediaId: true,
        bannerMediaId: true,
      },
    });
    return {
      scope,
      profile: profile
        ? {
            status: profile.status,
            claimedAt: profile.claimedAt,
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt,
            lastSeenAt: profile.lastSeenAt,
            hasHandle: Boolean(profile.handle),
            hasAvatar: Boolean(profile.avatarMediaId),
            hasBanner: Boolean(profile.bannerMediaId),
          }
        : null,
    };
  }
  if (scope === "CHRONICLE_HISTORY_METADATA") {
    const profile = await db.playerProfile.findUnique({ where: { accountId: targetAccountId }, select: { id: true } });
    const records = profile
      ? await db.playerChronicleRecord.findMany({
          where: { playerProfileId: profile.id },
          select: {
            id: true,
            publishedVersionId: true,
            publishedVersionChecksum: true,
            lifecycleStatus: true,
            outcome: true,
            startedAt: true,
            joinedAt: true,
            completedAt: true,
            projectionStatus: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 25,
        })
      : [];
    return { scope, recordCount: records.length, records };
  }

  const profile = await db.communityProfile.findUnique({
    where: { accountId: targetAccountId },
    select: {
      id: true,
      creatorStatus: true,
      moderationStatus: true,
      verificationStatus: true,
      lastPublishedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const [listings, reviews, comments, reports, voyageLogs] = await Promise.all([
    profile ? db.communityListing.count({ where: { ownerProfileId: profile.id } }) : 0,
    db.communityReview.count({ where: { authorAccountId: targetAccountId } }),
    db.communityComment.count({ where: { authorAccountId: targetAccountId } }),
    db.communityReport.count({ where: { reporterAccountId: targetAccountId } }),
    db.communityVoyageLog.count({ where: { ownerAccountId: targetAccountId } }),
  ]);
  return {
    scope,
    community: profile
      ? {
          creatorStatus: profile.creatorStatus,
          moderationStatus: profile.moderationStatus,
          verificationStatus: profile.verificationStatus,
          lastPublishedAt: profile.lastPublishedAt,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        }
      : null,
    counts: { listings, reviews, comments, reports, voyageLogs },
  };
}

export async function readSupportAccessGrant(
  operator: AdmiraltyCurrentOperator,
  input: { grantId: string; targetAccountId: string; scope: SupportAccessScope },
  now = new Date(),
) {
  const grant = await db.supportAccessGrant.findUnique({ where: { id: input.grantId }, include: { request: true } });
  authorizeSupportGrantRecord(grant, operator.accountId, input, now);
  if (!grant) throw new AdmiraltyError("SUPPORT_GRANT_REQUIRED", "An active support grant is required.", 403);
  const projection = await supportProjection(input.targetAccountId, input.scope);
  await writeAdministrativeAudit({
    actorAccountId: operator.accountId,
    actorRole: operator.roles[0] ?? "SUPPORT_OPERATOR",
    capability: "SUPPORT_USE",
    action: "ADMIRALTY_SUPPORT_SCOPE_READ",
    targetType: "UserAccount",
    targetId: input.targetAccountId,
    reason: grant.request.purpose,
    authorizationBasis: `${operator.authorizationBasis};SUPPORT_GRANT`,
    accountSessionId: operator.accountSessionId,
    supportGrantId: grant.id,
    correlationId: grant.correlationId,
    detail: { scope: input.scope },
  });
  return projection;
}

type SupportGrantRecord = {
  operatorAccountId: string;
  targetAccountId: string;
  grantedScopes: string;
  status: string;
  expiresAt: Date;
  revokedAt: Date | null;
  request: { status: string };
} | null;

export function authorizeSupportGrantRecord(
  grant: SupportGrantRecord,
  operatorAccountId: string,
  input: { targetAccountId: string; scope: SupportAccessScope },
  now = new Date(),
) {
  if (!grant) throw new AdmiraltyError("SUPPORT_GRANT_REQUIRED", "An active support grant is required.", 403);
  if (grant.revokedAt || grant.status === "REVOKED")
    throw new AdmiraltyError("SUPPORT_GRANT_REVOKED", "The support grant has been revoked.", 403);
  if (grant.expiresAt.getTime() <= now.getTime() || grant.status === "EXPIRED")
    throw new AdmiraltyError("SUPPORT_GRANT_EXPIRED", "The support grant has expired.", 403);
  if (grant.status !== "ACTIVE" || grant.request.status !== "APPROVED")
    throw new AdmiraltyError("SUPPORT_GRANT_REQUIRED", "An approved active support grant is required.", 403);
  if (grant.operatorAccountId !== operatorAccountId || grant.targetAccountId !== input.targetAccountId)
    throw new AdmiraltyError("SUPPORT_GRANT_SCOPE_DENIED", "The support grant does not authorize this target.", 403);
  if (!parseScopes(grant.grantedScopes).includes(input.scope))
    throw new AdmiraltyError("SUPPORT_GRANT_SCOPE_DENIED", "The support grant does not authorize this category.", 403);
  return true;
}
