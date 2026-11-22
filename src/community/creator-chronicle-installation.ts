import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { forkPublishedVersion } from "@/chronicle/studio-service";
import { CommunityError } from "./domain";
import { loadCreatorChronicleCandidate } from "./creator-chronicle-moderation";

async function installedFork(accountId: string, releaseId: string) {
  const receipt = await db.communityInstallation.findFirst({ where: { accountId, releaseId, mode: "PRIVATE_COPY" } });
  if (!receipt) return null;
  const mapping = await db.communityInstallMapping.findFirst({
    where: { operationId: receipt.operationId, sourceId: "chronicle" },
  });
  const fork = mapping
    ? await db.chronicle.findFirst({
        where: { id: mapping.targetId, creatorAccountId: accountId, visibility: "PRIVATE" },
      })
    : null;
  if (!fork) throw new CommunityError("COMMUNITY_INSTALLATION_STALE", "The pinned private Chronicle copy is missing.");
  return { receipt, fork };
}

export async function reviewCreatorChronicleInstallation(accountId: string, listingId: string) {
  const source = await loadCreatorChronicleCandidate(listingId, false);
  const prior = await installedFork(accountId, source.release.id);
  if (
    prior &&
    (prior.receipt.packageId !== source.record.id ||
      prior.receipt.installedPackageChecksum !== source.record.packageChecksum)
  )
    throw new CommunityError(
      "COMMUNITY_INSTALLATION_STALE",
      "The private Chronicle copy no longer matches this release.",
    );
  return {
    listingId,
    title: source.listing.title,
    itemType: "CHRONICLE" as const,
    creator: source.listing.owner.displayName,
    releaseId: source.release.id,
    semanticVersion: source.release.semanticVersion,
    packageChecksum: source.record.packageChecksum,
    license: source.license,
    attribution: source.verified.manifest.attribution,
    included: {
      chapters: source.verified.snapshot.chapters.length,
      passages: source.verified.snapshot.chapters.reduce((count, chapter) => count + chapter.blocks.length, 0),
    },
    alreadyInstalled: Boolean(prior),
    studioUrl: prior ? `/studio/tales/${prior.fork.id}` : null,
  };
}

export async function installCreatorChronicleRelease(input: {
  accountId: string;
  listingId: string;
  releaseId: string;
  packageChecksum: string;
  requestId: string;
}) {
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(input.requestId))
    throw new CommunityError("COMMUNITY_INVALID_REQUEST", "Use a unique installation request identifier.");
  const account = await db.userAccount.findUnique({ where: { id: input.accountId }, select: { status: true } });
  if (account?.status !== "ACTIVE")
    throw new CommunityError("COMMUNITY_ACCESS_DENIED", "An active Creator account is required.");
  const source = await loadCreatorChronicleCandidate(input.listingId, false);
  if (source.release.id !== input.releaseId || source.record.packageChecksum !== input.packageChecksum)
    throw new CommunityError("COMMUNITY_REVIEW_STALE", "The Chronicle release changed. Review its current version.");
  if (!source.license.allowsPrivateUse)
    throw new CommunityError("COMMUNITY_LICENSE_INCOMPATIBLE", "This license does not permit private reuse.");
  const existingResult = async () => {
    const prior = await installedFork(input.accountId, input.releaseId);
    if (!prior) return null;
    if (
      prior.receipt.packageId !== source.record.id ||
      prior.receipt.installedPackageChecksum !== input.packageChecksum
    )
      throw new CommunityError(
        "COMMUNITY_INSTALLATION_STALE",
        "The private Chronicle copy no longer matches this release.",
      );
    return {
      status: "ALREADY_INSTALLED" as const,
      taleId: prior.fork.id,
      releaseId: input.releaseId,
      studioUrl: `/studio/tales/${prior.fork.id}`,
    };
  };
  const assertRequestMatches = async () => {
    const existing = await db.communityInstallOperation.findUnique({
      where: { accountId_requestId: { accountId: input.accountId, requestId: input.requestId } },
    });
    if (existing && (existing.releaseId !== input.releaseId || existing.packageId !== source.record.id))
      throw new CommunityError("COMMUNITY_SOURCE_CONFLICT", "This request was used for another release.");
  };
  await assertRequestMatches();
  const prior = await existingResult();
  if (prior) return prior;

  const operationId = randomUUID();
  try {
    return await db.$transaction(async (tx) => {
      // Claim a single operation per account and release before creating a private fork.
      await tx.communityInstallOperation.create({
        data: {
          id: operationId,
          requestId: input.requestId,
          idempotencyKey: `CREATOR_CHRONICLE_RELEASE:${input.accountId}:${input.releaseId}`,
          packageId: source.record.id,
          releaseId: input.releaseId,
          accountId: input.accountId,
          mode: "PRIVATE_COPY",
          status: "COMMITTED",
          destinationRevision: "NEW_PRIVATE_CHRONICLE",
          plan: JSON.stringify({
            sourceVersionId: source.source.id,
            sourceChecksum: source.source.checksum,
            packageChecksum: source.record.packageChecksum,
          }),
          completedAt: new Date(),
        },
      });
      const stillPublic = await tx.communityListing.findFirst({
        where: {
          id: input.listingId,
          currentReleaseId: input.releaseId,
          publicationStatus: "PUBLISHED",
          visibility: "COMMUNITY",
          moderationStatus: "ACTIVE",
          archivedAt: null,
          removedAt: null,
          currentRelease: { moderationStatus: "ACTIVE", deprecatedAt: null, packageChecksum: input.packageChecksum },
          owner: { moderationStatus: "ACTIVE", creatorStatus: { not: "SUSPENDED" } },
        },
      });
      if (!stillPublic)
        throw new CommunityError("COMMUNITY_REVIEW_STALE", "This Chronicle release is no longer public.");
      const fork = await forkPublishedVersion(source.source.taleId, source.source.id, input.accountId, {
        client: tx,
        creatorAccountId: input.accountId,
      });
      await tx.communityInstallMapping.create({
        data: { operationId, sourceId: "chronicle", targetId: fork.id, kind: "CHRONICLE" },
      });
      await tx.communityInstallation.create({
        data: {
          accountId: input.accountId,
          packageId: source.record.id,
          releaseId: input.releaseId,
          operationId,
          mode: "PRIVATE_COPY",
          installedPackageChecksum: source.record.packageChecksum,
          upstreamReleaseId: input.releaseId,
        },
      });
      return {
        status: "COMMITTED" as const,
        taleId: fork.id,
        releaseId: input.releaseId,
        studioUrl: `/studio/tales/${fork.id}`,
      };
    });
  } catch (cause) {
    const code = (cause as { code?: string } | null)?.code;
    if (code === "P2002" || code === "P2034") {
      await assertRequestMatches();
      const completed = await existingResult();
      if (completed) return completed;
    }
    throw cause;
  }
}
