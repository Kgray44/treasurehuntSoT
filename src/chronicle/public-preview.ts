import { db } from "@/lib/db";

export async function chroniclePreviewHrefByVersion(versionIds: string[]) {
  if (!versionIds.length) return new Map<string, string>();
  const releases = await db.communityRelease.findMany({
    where: {
      sourcePublishedTaleVersionId: { in: versionIds },
      moderationStatus: "ACTIVE",
      deprecatedAt: null,
      listing: {
        publicationStatus: "PUBLISHED",
        visibility: { in: ["COMMUNITY", "FEATURED"] },
        moderationStatus: "ACTIVE",
        archivedAt: null,
        removedAt: null,
      },
    },
    select: {
      id: true,
      sourcePublishedTaleVersionId: true,
      listing: { select: { slug: true, currentReleaseId: true } },
    },
  });
  return new Map(
    releases
      .filter((release) => release.sourcePublishedTaleVersionId && release.listing.currentReleaseId === release.id)
      .map((release) => [
        release.sourcePublishedTaleVersionId!,
        `/community/${encodeURIComponent(release.listing.slug)}`,
      ]),
  );
}

export async function getPublicChroniclePreview(slug: string) {
  const tale = await db.chronicle.findFirst({
    where: {
      slug,
      archivedAt: null,
      status: "PUBLISHED",
      visibility: { in: ["PUBLIC", "UNLISTED"] },
      latestPublishedVersionId: { not: null },
    },
    include: {
      versions: { where: { isCurrent: true }, take: 1 },
      creatorAccount: { select: { profile: { select: { displayName: true, handle: true } } } },
    },
  });
  const version = tale?.versions[0];
  if (!tale || !version) return null;
  const communityHref = (await chroniclePreviewHrefByVersion([version.id])).get(version.id) ?? null;
  const [sessionCount, completionCount] = await Promise.all([
    db.taleSession.count({ where: { publishedVersionId: version.id, previewMode: false } }),
    db.taleSession.count({ where: { publishedVersionId: version.id, previewMode: false, status: "COMPLETED" } }),
  ]);
  return {
    id: tale.id,
    slug: tale.slug,
    title: tale.title,
    subtitle: tale.subtitle,
    shortDescription: tale.shortDescription,
    longDescription: tale.longDescription,
    theme: tale.theme,
    coverUrl: tale.coverAssetId
      ? `/api/media/${tale.coverAssetId}?variant=PREVIEW&version=${version.id}&public=cover`
      : null,
    estimatedDuration: tale.estimatedDuration,
    playerCountMin: tale.playerCountMin,
    playerCountMax: tale.playerCountMax,
    contentWarnings: tale.contentWarnings,
    version: version.versionLabel,
    publishedAt: version.publishedAt.toISOString(),
    releaseNotes: version.releaseNotes,
    creator: tale.creatorAccount?.profile
      ? { displayName: tale.creatorAccount.profile.displayName, handle: tale.creatorAccount.profile.handle }
      : { displayName: "Voyagewright Creator", handle: null },
    statistics: { voyagesStarted: sessionCount, voyagesCompleted: completionCount },
    communityHref,
    startHref: `/play/${encodeURIComponent(tale.slug)}`,
  };
}
