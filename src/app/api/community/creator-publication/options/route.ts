import { NextResponse } from "next/server";
import { requireStudioWorkspace } from "@/chronicle/studio-authorization";
import { db } from "@/lib/db";
import { communityApiError } from "@/community/api";

export async function GET() {
  const actor = await requireStudioWorkspace();
  if (!actor)
    return NextResponse.json({ code: "COMMUNITY_ACCESS_DENIED", error: "Creator access required." }, { status: 403 });
  try {
    const [tales, items, licenses] = await Promise.all([
      db.publishedTaleVersion.findMany({
        where: {
          isCurrent: true,
          publishedByAccountId: actor.accountId,
          tale: { creatorAccountId: actor.accountId, latestPublishedVersionId: { not: null } },
          drydockPublishingEvidence: { isNot: null },
        },
        select: { id: true, checksum: true, versionLabel: true, tale: { select: { id: true, title: true } } },
        orderBy: { publishedAt: "desc" },
        take: 50,
      }),
      db.reusableAuthoringItem.findMany({
        where: {
          ownerAccountId: actor.accountId,
          kind: { in: ["PRESET", "CHAPTER_TEMPLATE"] },
          status: "ACTIVE",
          archivedAt: null,
        },
        include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      db.communityLicensePolicy.findMany({
        where: {
          active: true,
          allowsPrivateUse: true,
          allowsPublicUse: true,
          allowsModification: true,
          allowsRedistribution: true,
          requiresSourceLink: false,
          key: { not: "CUSTOM" },
        },
        select: { key: true, displayName: true, requiresAttribution: true, shareAlike: true },
        orderBy: { displayName: "asc" },
      }),
    ]);
    return NextResponse.json(
      {
        sources: [
          ...tales
            .filter((version) => version.tale.id && version.id)
            .map((version) => ({
              type: "CHRONICLE" as const,
              id: version.id,
              title: `${version.tale.title} · ${version.versionLabel}`,
              sourceChecksum: version.checksum,
            })),
          ...items.flatMap((item) =>
            item.versions[0]
              ? [
                  {
                    type: item.kind === "PRESET" ? ("STORY_BLOCK_PRESET" as const) : ("CHRONICLE_TEMPLATE" as const),
                    id: item.id,
                    versionId: item.versions[0].id,
                    title: item.name,
                    sourceChecksum: item.versions[0].checksum,
                  },
                ]
              : [],
          ),
        ],
        licenses,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (cause) {
    return communityApiError(cause);
  }
}
