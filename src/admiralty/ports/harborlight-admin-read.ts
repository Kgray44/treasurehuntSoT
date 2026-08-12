import { collectCommunityProviderHealth, communityOperationalSnapshot } from "@/community/operations";
import { db } from "@/lib/db";
import type { AdmiraltyCurrentOperator } from "../authorization";
import { writeAdministrativeAudit } from "../audit";
import { enforceAdmiraltyRateLimit } from "../http";
import { abbreviatedId, projection } from "../read-models";

export async function getCommunityOverview(operator: AdmiraltyCurrentOperator) {
  const observedAt = new Date();
  const [profiles, creators, listings, releases, reports, cases, sanctions, appeals, snapshot, providers] =
    await Promise.all([
      db.communityProfile.count(),
      db.communityProfile.count({ where: { creatorStatus: "ACTIVE" } }),
      db.communityListing.count(),
      db.communityRelease.count(),
      db.communityReport.count({ where: { status: { in: ["OPEN", "TRIAGED"] } } }),
      db.communityModerationCase.count({ where: { status: { notIn: ["CLOSED", "RESOLVED"] } } }),
      db.communitySanction.count({ where: { state: "ACTIVE" } }),
      db.communityModerationAppeal.count({ where: { status: { notIn: ["CLOSED", "DENIED", "GRANTED"] } } }),
      communityOperationalSnapshot(observedAt),
      collectCommunityProviderHealth().catch(() => null),
    ]);
  await auditCommunityRead(operator, "ADMIRALTY_COMMUNITY_OVERVIEW_READ", "CommunityOverview", "current");
  return projection(
    "HarborlightAdminReadPort.Community",
    {
      counts: {
        profiles,
        creators,
        listings,
        releases,
        pendingReports: reports,
        openCases: cases,
        activeSanctions: sanctions,
        pendingAppeals: appeals,
      },
      operations: snapshot,
      providers: providers ?? [],
      providerProjectionState: providers ? "AVAILABLE" : "UNAVAILABLE",
    },
    { observedAt },
  );
}

export async function searchCommunity(operator: AdmiraltyCurrentOperator, query: string) {
  enforceAdmiraltyRateLimit(`community-search:${operator.accountId}`, 60, 5 * 60_000);
  const listings = await db.communityListing.findMany({
    where: {
      OR: [
        { id: query },
        { slug: { contains: query } },
        { title: { contains: query } },
        { ownerProfileId: query },
        { owner: { is: { OR: [{ displayName: { contains: query } }, { handle: { contains: query } }] } } },
      ],
    },
    select: {
      id: true,
      slug: true,
      itemType: true,
      title: true,
      shortDescription: true,
      visibility: true,
      publicationStatus: true,
      moderationStatus: true,
      spoilerLevel: true,
      primaryCategory: true,
      currentReleaseId: true,
      publishedAt: true,
      archivedAt: true,
      removedAt: true,
      updatedAt: true,
      owner: {
        select: {
          id: true,
          accountId: true,
          handle: true,
          displayName: true,
          creatorStatus: true,
          moderationStatus: true,
        },
      },
      _count: { select: { releases: true, declarations: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });
  await auditCommunityRead(operator, "ADMIRALTY_COMMUNITY_SEARCHED", "CommunityListingSearch", "bounded-query", {
    queryLength: query.length,
    resultCount: listings.length,
  });
  return projection("HarborlightAdminReadPort.CommunityListing", {
    query,
    limit: 30,
    results: listings.map((listing) => ({ ...listing, abbreviatedId: abbreviatedId(listing.id) })),
  });
}

export async function getCommunityListingDetail(operator: AdmiraltyCurrentOperator, listingId: string) {
  enforceAdmiraltyRateLimit(`community-detail:${operator.accountId}`, 90, 5 * 60_000);
  const listing = await db.communityListing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      slug: true,
      itemType: true,
      title: true,
      shortDescription: true,
      visibility: true,
      publicationStatus: true,
      moderationStatus: true,
      spoilerLevel: true,
      locationClass: true,
      primaryCategory: true,
      tags: true,
      contentWarnings: true,
      currentReleaseId: true,
      publishedAt: true,
      archivedAt: true,
      removedAt: true,
      createdAt: true,
      updatedAt: true,
      owner: {
        select: {
          id: true,
          accountId: true,
          handle: true,
          displayName: true,
          creatorStatus: true,
          moderationStatus: true,
          verificationStatus: true,
        },
      },
      releases: {
        select: {
          id: true,
          semanticVersion: true,
          manifestSchemaVersion: true,
          minimumPlatformVersion: true,
          sourcePublishedTaleVersionId: true,
          manifestChecksum: true,
          packageChecksum: true,
          moderationStatus: true,
          publishedAt: true,
          deprecatedAt: true,
          replacementReleaseId: true,
        },
        orderBy: { publishedAt: "desc" },
        take: 30,
      },
      declarations: {
        select: { id: true, declarationVersion: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
  if (!listing) return null;
  const reports = await db.communityReport.findMany({
    where: { subjectId: listing.id },
    select: { id: true, subjectType: true, reason: true, status: true, caseId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const cases = await db.communityModerationCase.findMany({
    where: { subjects: { some: { subjectId: listing.id } } },
    select: {
      id: true,
      caseKey: true,
      status: true,
      severity: true,
      priority: true,
      primaryReasonCode: true,
      correlationId: true,
      openedAt: true,
      closedAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  await auditCommunityRead(operator, "ADMIRALTY_COMMUNITY_LISTING_READ", "CommunityListing", listing.id);
  return projection("HarborlightAdminReadPort.CommunityListingDetail", { ...listing, reports, cases });
}

async function auditCommunityRead(
  operator: AdmiraltyCurrentOperator,
  action: string,
  targetType: string,
  targetId: string,
  detail: Record<string, unknown> = {},
) {
  await writeAdministrativeAudit({
    actorAccountId: operator.accountId,
    actorRole: operator.roles[0] ?? "MODERATION_OPERATOR",
    capability: "COMMUNITY_OBSERVE",
    action,
    targetType,
    targetId,
    reason: "Read-only Community inspection",
    authorizationBasis: operator.authorizationBasis,
    accountSessionId: operator.accountSessionId,
    detail,
  });
}
