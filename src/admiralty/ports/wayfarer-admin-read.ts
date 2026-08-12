import { db } from "@/lib/db";
import type { AdmiraltyCurrentOperator } from "../authorization";
import { writeAdministrativeAudit } from "../audit";
import { enforceAdmiraltyRateLimit } from "../http";
import { abbreviatedId, projection, safeMetadata } from "../read-models";

const peopleTake = 25;

export type AdminAccountSummary = Readonly<{
  id: string;
  abbreviatedId: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  primaryEmail: string | null;
  emailVerified: boolean;
  status: string;
  roles: readonly string[];
  providers: readonly string[];
  lastSeenAt: Date | null;
  createdAt: Date;
  supportAccessState: "ACTIVE" | "PENDING" | "NONE";
}>;

function supportState(
  requests: readonly {
    status: string;
    expiresAt: Date;
    grant: { status: string; expiresAt: Date; revokedAt: Date | null } | null;
  }[],
) {
  const now = Date.now();
  if (requests.some(({ grant }) => grant?.status === "ACTIVE" && !grant.revokedAt && grant.expiresAt.getTime() > now))
    return "ACTIVE" as const;
  if (requests.some((request) => request.status === "REQUESTED" && request.expiresAt.getTime() > now))
    return "PENDING" as const;
  return "NONE" as const;
}

export async function searchPeople(operator: AdmiraltyCurrentOperator, query: string) {
  enforceAdmiraltyRateLimit(`people-search:${operator.accountId}`, 60, 5 * 60_000);
  const accounts = await db.userAccount.findMany({
    where: {
      OR: [
        { id: query },
        { profile: { is: { displayName: { contains: query } } } },
        { profile: { is: { normalizedHandle: { contains: query.toLocaleLowerCase("en-US") } } } },
        { emails: { some: { normalizedEmail: { contains: query.toLocaleLowerCase("en-US") } } } },
        { externalIdentities: { some: { providerAccountId: query } } },
      ],
    },
    select: {
      id: true,
      status: true,
      lastSeenAt: true,
      createdAt: true,
      profile: {
        select: {
          displayName: true,
          handle: true,
          avatarMedia: { select: { id: true, processingState: true, scanState: true, removedAt: true } },
        },
      },
      emails: {
        where: { isPrimary: true },
        select: { displayEmail: true, verificationState: true },
        take: 1,
      },
      roles: { where: { revokedAt: null }, select: { role: true } },
      externalIdentities: { where: { status: "LINKED" }, select: { provider: true } },
      supportRequestsTargeted: {
        select: {
          status: true,
          expiresAt: true,
          grant: { select: { status: true, expiresAt: true, revokedAt: true } },
        },
        orderBy: { requestedAt: "desc" },
        take: 5,
      },
    },
    orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
    take: peopleTake,
  });

  await writeAdministrativeAudit({
    actorAccountId: operator.accountId,
    actorRole: operator.roles[0] ?? "SUPPORT_OPERATOR",
    capability: "ACCOUNT_OBSERVE",
    action: "ADMIRALTY_PEOPLE_SEARCHED",
    targetType: "UserAccountSearch",
    targetId: "bounded-query",
    reason: "Read-only people search",
    authorizationBasis: operator.authorizationBasis,
    accountSessionId: operator.accountSessionId,
    detail: { resultCount: accounts.length, queryLength: query.length },
  });

  const results: AdminAccountSummary[] = accounts.map((account) => {
    const email = account.emails[0];
    const avatar = account.profile?.avatarMedia;
    return {
      id: account.id,
      abbreviatedId: abbreviatedId(account.id),
      displayName: account.profile?.displayName ?? "Profile not available",
      handle: account.profile?.handle ?? null,
      avatarUrl:
        avatar?.processingState === "READY" && avatar.scanState === "LOCAL_VALIDATED" && !avatar.removedAt
          ? `/api/profile-media/${avatar.id}`
          : null,
      primaryEmail: email?.displayEmail ?? null,
      emailVerified: email?.verificationState === "VERIFIED",
      status: account.status,
      roles: [...new Set(account.roles.map(({ role }) => role))].sort(),
      providers: [...new Set(account.externalIdentities.map(({ provider }) => provider))].sort(),
      lastSeenAt: account.lastSeenAt,
      createdAt: account.createdAt,
      supportAccessState: supportState(account.supportRequestsTargeted),
    };
  });
  return projection(
    "WayfarerAdminReadPort.UserAccount",
    { query, limit: peopleTake, results },
    { dataClass: "ACCOUNT_PRIVATE" },
  );
}

export async function getAccountDossier(operator: AdmiraltyCurrentOperator, accountId: string) {
  enforceAdmiraltyRateLimit(`account-dossier:${operator.accountId}`, 90, 5 * 60_000);
  const account = await db.userAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      status: true,
      claimedAt: true,
      lastSeenAt: true,
      lockedAt: true,
      suspendedAt: true,
      createdAt: true,
      updatedAt: true,
      emails: {
        select: { displayEmail: true, isPrimary: true, verificationState: true, verifiedAt: true, createdAt: true },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      roles: {
        select: { role: true, scopeType: true, scopeId: true, grantedAt: true, revokedAt: true },
        orderBy: { grantedAt: "desc" },
      },
      externalIdentities: {
        select: {
          id: true,
          provider: true,
          providerAccountId: true,
          providerDisplayName: true,
          useForLogin: true,
          status: true,
          linkedAt: true,
          lastVerifiedAt: true,
          revokedAt: true,
        },
        orderBy: { linkedAt: "desc" },
      },
      sessions: {
        select: {
          id: true,
          deviceLabel: true,
          sessionType: true,
          expiresAt: true,
          lastSeenAt: true,
          revokedAt: true,
          createdAt: true,
        },
        orderBy: { lastSeenAt: "desc" },
        take: 25,
      },
      securityEvents: {
        select: { id: true, eventType: true, correlationId: true, metadata: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 30,
      },
      lifecycleRequests: {
        select: {
          id: true,
          kind: true,
          state: true,
          requestedAt: true,
          scheduledFor: true,
          canceledAt: true,
          completedAt: true,
        },
        orderBy: { requestedAt: "desc" },
        take: 20,
      },
      profile: {
        select: {
          id: true,
          displayName: true,
          handle: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          chronicleRecords: {
            select: {
              id: true,
              sourcePlaythroughId: true,
              publishedVersionId: true,
              chronicleTitleSnapshot: true,
              participationRole: true,
              lifecycleStatus: true,
              outcome: true,
              startedAt: true,
              completedAt: true,
              projectionStatus: true,
              lastDerivedAt: true,
            },
            orderBy: { updatedAt: "desc" },
            take: 20,
          },
        },
      },
      communityProfile: {
        select: {
          id: true,
          creatorStatus: true,
          moderationStatus: true,
          verificationStatus: true,
          lastPublishedAt: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { listings: true } },
        },
      },
      supportRequestsTargeted: {
        select: {
          id: true,
          requestingAdminAccountId: true,
          purpose: true,
          requestedScopes: true,
          status: true,
          requestedAt: true,
          expiresAt: true,
          decisionAt: true,
          grant: {
            select: { id: true, grantedScopes: true, status: true, issuedAt: true, expiresAt: true, revokedAt: true },
          },
        },
        orderBy: { requestedAt: "desc" },
        take: 20,
      },
    },
  });
  if (!account) return null;

  await writeAdministrativeAudit({
    actorAccountId: operator.accountId,
    actorRole: operator.roles[0] ?? "SUPPORT_OPERATOR",
    capability: "ACCOUNT_OBSERVE",
    action: "ADMIRALTY_ACCOUNT_DOSSIER_READ",
    targetType: "UserAccount",
    targetId: account.id,
    reason: "Read-only account dossier inspection",
    authorizationBasis: operator.authorizationBasis,
    accountSessionId: operator.accountSessionId,
    detail: { sections: ["identity", "roles", "sessions", "security", "history", "community", "lifecycle", "support"] },
  });

  return projection(
    "WayfarerAdminReadPort.UserAccountDossier",
    {
      ...account,
      securityEvents: account.securityEvents.map((event) => ({
        ...event,
        detail: safeMetadata(event.metadata),
        metadata: undefined,
      })),
      supportRequestsTargeted: account.supportRequestsTargeted.map((request) => ({
        ...request,
        requestedScopes: parseStringArray(request.requestedScopes),
        grant: request.grant
          ? { ...request.grant, grantedScopes: parseStringArray(request.grant.grantedScopes) }
          : null,
      })),
      supportAccessState: supportState(account.supportRequestsTargeted),
    },
    { dataClass: "ACCOUNT_PRIVATE" },
  );
}

function parseStringArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 30) : [];
  } catch {
    return [];
  }
}
