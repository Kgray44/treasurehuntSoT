import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCatalogSessionStatus } from "@/chronicle/progression";
import { readTaleSessionCookie } from "@/chronicle/session-cookie";

export async function GET() {
  const access = await readTaleSessionCookie();
  const currentSession = access ? await getCatalogSessionStatus(access.sessionId, access.token) : null;
  const tales = await db.chronicle.findMany({
    where: { archivedAt: null, status: "PUBLISHED", visibility: "PUBLIC", latestPublishedVersionId: { not: null } },
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { updatedAt: "desc" }],
    include: { versions: { where: { isCurrent: true }, take: 1 } },
  });
  return NextResponse.json({
    tales: tales
      .filter((tale) => tale.versions.length)
      .map((tale) => ({
        id: tale.id,
        slug: tale.slug,
        title: tale.title,
        subtitle: tale.subtitle,
        shortDescription: tale.shortDescription,
        coverAssetId: tale.coverAssetId,
        coverUrl: tale.coverAssetId
          ? `/api/media/${tale.coverAssetId}?variant=PREVIEW&version=${tale.versions[0].id}&public=cover`
          : null,
        estimatedDuration: tale.estimatedDuration,
        playerCountMin: tale.playerCountMin,
        playerCountMax: tale.playerCountMax,
        version: tale.versions[0].versionLabel,
        versionId: tale.versions[0].id,
        playerState:
          currentSession?.taleId === tale.id
            ? currentSession.status === "COMPLETED"
              ? "COMPLETED"
              : "IN_PROGRESS"
            : "NEW",
        sessionId: currentSession?.taleId === tale.id ? currentSession.sessionId : null,
      })),
  });
}
