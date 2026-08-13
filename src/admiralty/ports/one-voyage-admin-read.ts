import { db } from "@/lib/db";
import type { AdmiraltyCurrentOperator } from "../authorization";
import { writeAdministrativeAudit } from "../audit";
import { enforceAdmiraltyRateLimit } from "../http";
import { abbreviatedId, projection } from "../read-models";

const resultLimit = 30;

export async function searchChronicles(operator: AdmiraltyCurrentOperator, query: string) {
  enforceAdmiraltyRateLimit(`chronicle-search:${operator.accountId}`, 60, 5 * 60_000);
  const chronicles = await db.chronicle.findMany({
    where: {
      OR: [
        { id: query },
        { slug: { contains: query } },
        { title: { contains: query } },
        { creatorId: { contains: query } },
        { creatorAccountId: query },
        { creatorAccount: { is: { profile: { is: { displayName: { contains: query } } } } } },
      ],
    },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      visibility: true,
      creatorId: true,
      creatorAccountId: true,
      creatorAccount: { select: { profile: { select: { displayName: true, handle: true } } } },
      latestPublishedVersionId: true,
      playerCountMin: true,
      playerCountMax: true,
      updatedAt: true,
      createdAt: true,
      _count: { select: { versions: true, sessions: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: resultLimit,
  });
  await auditRead(operator, "ADMIRALTY_CHRONICLES_SEARCHED", "ChronicleSearch", "bounded-query", {
    queryLength: query.length,
    resultCount: chronicles.length,
  });
  return projection(
    "OneVoyageAdminReadPort.Chronicle",
    {
      query,
      limit: resultLimit,
      results: chronicles.map((chronicle) => ({
        ...chronicle,
        abbreviatedId: abbreviatedId(chronicle.id),
        creatorDisplayName: chronicle.creatorAccount?.profile?.displayName ?? chronicle.creatorId,
        creatorHandle: chronicle.creatorAccount?.profile?.handle ?? null,
      })),
    },
    { dataClass: "OPERATIONAL_SENSITIVE" },
  );
}

export async function getChronicleDetail(operator: AdmiraltyCurrentOperator, chronicleId: string) {
  enforceAdmiraltyRateLimit(`chronicle-detail:${operator.accountId}`, 90, 5 * 60_000);
  const chronicle = await db.chronicle.findUnique({
    where: { id: chronicleId },
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      shortDescription: true,
      theme: true,
      status: true,
      visibility: true,
      creatorId: true,
      creatorAccountId: true,
      creatorAccount: { select: { profile: { select: { displayName: true, handle: true } } } },
      currentDraftRevisionId: true,
      latestPublishedVersionId: true,
      forkedFromTaleId: true,
      forkedFromVersionId: true,
      playerCountMin: true,
      playerCountMax: true,
      estimatedDuration: true,
      contentWarnings: true,
      featured: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
      versions: {
        select: {
          id: true,
          versionNumber: true,
          versionLabel: true,
          publishedAt: true,
          publishedBy: true,
          publishedByAccountId: true,
          releaseNotes: true,
          schemaVersion: true,
          checksum: true,
          isCurrent: true,
          _count: { select: { sessions: true, communityReleases: true } },
          communityReleases: {
            select: {
              id: true,
              semanticVersion: true,
              moderationStatus: true,
              publishedAt: true,
              manifestChecksum: true,
              packageChecksum: true,
              listing: { select: { id: true, slug: true, title: true, publicationStatus: true } },
            },
            orderBy: { publishedAt: "desc" },
            take: 5,
          },
        },
        orderBy: { versionNumber: "desc" },
        take: 50,
      },
      sessions: {
        select: {
          id: true,
          voyageName: true,
          status: true,
          previewMode: true,
          publishedVersionId: true,
          startedAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      },
    },
  });
  if (!chronicle) return null;
  await auditRead(operator, "ADMIRALTY_CHRONICLE_DETAIL_READ", "Chronicle", chronicle.id, {
    versionCount: chronicle.versions.length,
  });
  return projection(
    "OneVoyageAdminReadPort.ChronicleDetail",
    {
      ...chronicle,
      creatorDisplayName: chronicle.creatorAccount?.profile?.displayName ?? chronicle.creatorId,
      creatorHandle: chronicle.creatorAccount?.profile?.handle ?? null,
    },
    { dataClass: "OPERATIONAL_SENSITIVE" },
  );
}

export async function searchVoyages(operator: AdmiraltyCurrentOperator, query: string) {
  enforceAdmiraltyRateLimit(`voyage-search:${operator.accountId}`, 60, 5 * 60_000);
  const voyages = await db.taleSession.findMany({
    where: {
      OR: [
        { id: query },
        { voyageName: { contains: query } },
        { ownerLabel: { contains: query } },
        { tale: { is: { title: { contains: query } } } },
        { taleId: query },
        { captainAccountId: query },
        { captainAccount: { is: { profile: { is: { displayName: { contains: query } } } } } },
        {
          memberships: {
            some: { player: { is: { OR: [{ displayName: { contains: query } }, { handle: { contains: query } }] } } },
          },
        },
      ],
    },
    select: {
      id: true,
      voyageName: true,
      ownerLabel: true,
      status: true,
      captainMode: true,
      previewMode: true,
      taleId: true,
      publishedVersionId: true,
      startedAt: true,
      launchedAt: true,
      updatedAt: true,
      completedAt: true,
      lastHeartbeatAt: true,
      tale: { select: { title: true, slug: true } },
      captainAccount: { select: { id: true, profile: { select: { displayName: true, handle: true } } } },
      _count: { select: { memberships: true, events: true, verificationRequests: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: resultLimit,
  });
  await auditRead(operator, "ADMIRALTY_VOYAGES_SEARCHED", "TaleSessionSearch", "bounded-query", {
    queryLength: query.length,
    resultCount: voyages.length,
  });
  return projection(
    "OneVoyageAdminReadPort.TaleSession",
    {
      query,
      limit: resultLimit,
      results: voyages.map((voyage) => ({ ...voyage, abbreviatedId: abbreviatedId(voyage.id) })),
    },
    { dataClass: "OPERATIONAL_SENSITIVE" },
  );
}

export async function getVoyageDetail(operator: AdmiraltyCurrentOperator, voyageId: string) {
  enforceAdmiraltyRateLimit(`voyage-detail:${operator.accountId}`, 90, 5 * 60_000);
  const voyage = await db.taleSession.findUnique({
    where: { id: voyageId },
    select: {
      id: true,
      voyageName: true,
      ownerLabel: true,
      status: true,
      captainMode: true,
      scheduleTimezone: true,
      plannedStartAt: true,
      launchedAt: true,
      cancelledAt: true,
      abandonedAt: true,
      historicalHidden: true,
      currentChapterId: true,
      currentBlockId: true,
      currentSequence: true,
      previewMode: true,
      startedAt: true,
      updatedAt: true,
      completedAt: true,
      expiresAt: true,
      lastHeartbeatAt: true,
      tale: { select: { id: true, slug: true, title: true } },
      version: { select: { id: true, versionNumber: true, versionLabel: true, checksum: true, schemaVersion: true } },
      captainAccount: { select: { id: true, profile: { select: { displayName: true, handle: true } } } },
      memberships: {
        select: {
          id: true,
          role: true,
          status: true,
          crewRole: true,
          joinedAt: true,
          removedAt: true,
          completedAt: true,
          updatedAt: true,
          player: { select: { id: true, accountId: true, displayName: true, handle: true, status: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
      },
      verificationRequests: {
        select: {
          id: true,
          blockId: true,
          providerType: true,
          status: true,
          requestedAt: true,
          resolvedAt: true,
          expiresAt: true,
          providerCorrelationId: true,
        },
        orderBy: { requestedAt: "desc" },
        take: 30,
      },
      events: {
        select: {
          id: true,
          eventType: true,
          sourceType: true,
          sourceId: true,
          sequence: true,
          correlationId: true,
          verificationRequestId: true,
          createdAt: true,
        },
        orderBy: { sequence: "desc" },
        take: 100,
      },
    },
  });
  if (!voyage) return null;
  await auditRead(operator, "ADMIRALTY_VOYAGE_DETAIL_READ", "TaleSession", voyage.id, {
    eventCountReturned: voyage.events.length,
    payloadReturned: false,
  });
  return projection("OneVoyageAdminReadPort.TaleSessionDetail", voyage, { dataClass: "OPERATIONAL_SENSITIVE" });
}

async function auditRead(
  operator: AdmiraltyCurrentOperator,
  action: string,
  targetType: string,
  targetId: string,
  detail: Record<string, unknown>,
) {
  await writeAdministrativeAudit({
    actorAccountId: operator.accountId,
    actorRole: operator.roles[0] ?? "ADMINISTRATOR",
    capability: targetType.startsWith("Chronicle") ? "CHRONICLE_OBSERVE" : "VOYAGE_OBSERVE",
    action,
    targetType,
    targetId,
    reason: "Read-only Admiralty inspection",
    authorizationBasis: operator.authorizationBasis,
    accountSessionId: operator.accountSessionId,
    detail,
  });
}
