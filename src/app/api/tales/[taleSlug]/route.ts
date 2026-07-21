import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_: Request, context: { params: Promise<{ taleSlug: string }> }) {
  const tale = await db.chronicle.findFirst({
    where: {
      slug: (await context.params).taleSlug,
      archivedAt: null,
      status: "PUBLISHED",
      visibility: { in: ["PUBLIC", "UNLISTED"] },
    },
    include: { versions: { where: { isCurrent: true }, take: 1 } },
  });
  const version = tale?.versions[0];
  if (!tale || !version) return NextResponse.json({ error: "This Chronicle is not available." }, { status: 404 });
  return NextResponse.json({
    tale: {
      id: tale.id,
      slug: tale.slug,
      title: tale.title,
      subtitle: tale.subtitle,
      shortDescription: tale.shortDescription,
      longDescription: tale.longDescription,
      coverUrl: tale.coverAssetId
        ? `/api/media/${tale.coverAssetId}?variant=PREVIEW&version=${version.id}&public=cover`
        : null,
      estimatedDuration: tale.estimatedDuration,
      playerCountMin: tale.playerCountMin,
      playerCountMax: tale.playerCountMax,
      contentWarnings: tale.contentWarnings,
      version: version.versionLabel,
    },
  });
}
