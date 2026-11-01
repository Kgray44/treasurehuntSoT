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
  const prior = await installedFork(input.accountId, input.releaseId);
  if (prior)
    return {
      status: "ALREADY_INSTALLED" as const,
      taleId: prior.fork.id,
      releaseId: input.releaseId,
      studioUrl: `/studio/tales/${prior.fork.id}`,
    };
  const operationId = randomUUID();
  const operation = await db.communityInstallOperation
    .create({
      data: {
        id: operationId,
        requestId: input.requestId,
        idempotencyKey: `CREATOR_CHRONICLE:${input.accountId}:${input.requestId}`,
        packageId: source.record.id,
        releaseId: input.releaseId,
        accountId: input.accountId,
        mode: "PRIVATE_COPY",
        status: "PLANNED",
        destinationRevision: "NEW_PRIVATE_CHRONICLE",
        plan: JSON.stringify({
          sourceVersionId: source.source.id,
          sourceChecksum: source.source.checksum,
          packageChecksum: source.record.packageChecksum,
        }),
      },
    })
    .catch(async (cause: unknown) => {
      if ((cause as { code?: string })?.code !== "P2002") throw cause;
      const existing = await db.communityInstallOperation.findUnique({
        where: { accountId_requestId: { accountId: input.accountId, requestId: input.requestId } },
      });
      if (!existing || existing.releaseId !== input.releaseId || existing.packageId !== source.record.id)
        throw new CommunityError("COMMUNITY_SOURCE_CONFLICT", "This request was used for another release.");
      const completed = await installedFork(input.accountId, input.releaseId);
      if (completed) return existing;
      if (existing.status === "FAILED")
        throw new CommunityError(
          "COMMUNITY_INSTALLATION_FAILED",
          "The previous private copy failed. Start a new installation review.",
        );
      throw new CommunityError(
        "COMMUNITY_INSTALLATION_IN_PROGRESS",
        "This private Chronicle copy is still being created.",
      );
    });
  if (operation.status !== "PLANNED" || operation.id !== operationId) {
    const completed = await installedFork(input.accountId, input.releaseId);
    if (!completed) throw new CommunityError("COMMUNITY_INSTALLATION_STALE", "The installation receipt is incomplete.");
    return {
      status: "ALREADY_INSTALLED" as const,
      taleId: completed.fork.id,
      releaseId: input.releaseId,
      studioUrl: `/studio/tales/${completed.fork.id}`,
    };
  }
  let fork;
  try {
    fork = await forkPublishedVersion(source.source.taleId, source.source.id, input.accountId);
  } catch (cause) {
    await db.communityInstallOperation.update({
      where: { id: operationId },
      data: {
        status: "FAILED",
        finalizationErrorCode: "PRIVATE_FORK_FAILED",
      },
    });
    throw cause;
  }
  try {
    await db.$transaction(async (tx) => {
      const stillPublic = await tx.communityListing.findFirst({
        where: {
          id: input.listingId,
          currentReleaseId: input.releaseId,
          publicationStatus: "PUBLISHED",
          moderationStatus: "ACTIVE",
          archivedAt: null,
          removedAt: null,
        },
      });
      if (!stillPublic)
        throw new CommunityError("COMMUNITY_REVIEW_STALE", "This Chronicle release is no longer public.");
      const privateFork = await tx.chronicle.findFirst({
        where: {
          id: fork.id,
          creatorAccountId: input.accountId,
          forkedFromTaleId: source.source.taleId,
          forkedFromVersionId: source.source.id,
          visibility: "PRIVATE",
        },
      });
      if (!privateFork)
        throw new CommunityError("COMMUNITY_INSTALLATION_STALE", "The private fork did not match its pinned source.");
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
      await tx.communityInstallOperation.update({
        where: { id: operationId },
        data: {
          status: "COMMITTED",
          completedAt: new Date(),
        },
      });
    });
  } catch (cause) {
    // The Studio fork is created by an existing non-transactional service. Compensate
    // a failed receipt commit so an unreceipted private copy is not left usable.
    const removed = await db.chronicle.deleteMany({
      where: {
        id: fork.id,
        creatorAccountId: input.accountId,
        forkedFromTaleId: source.source.taleId,
        forkedFromVersionId: source.source.id,
        visibility: "PRIVATE",
      },
    });
    await db.communityInstallOperation.updateMany({
      where: { id: operationId, status: "PLANNED" },
      data: {
        status: "FAILED",
        finalizationErrorCode:
          removed.count === 1 ? "PRIVATE_FORK_FINALIZATION_FAILED" : "PRIVATE_FORK_CLEANUP_REQUIRED",
      },
    });
    if (removed.count !== 1)
      throw new CommunityError(
        "COMMUNITY_INSTALLATION_RECOVERY_REQUIRED",
        "The private Chronicle copy needs recovery before another attempt.",
      );
    throw cause;
  }
  return {
    status: "COMMITTED" as const,
    taleId: fork.id,
    releaseId: input.releaseId,
    studioUrl: `/studio/tales/${fork.id}`,
  };
}
