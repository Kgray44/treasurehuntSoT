import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type EngagementClient = Pick<
  Prisma.TransactionClient,
  "communityListingAggregate" | "communityReview" | "communitySave"
>;

export type AuthoritativeListingEngagement = {
  listingId: string;
  installCount: number;
  saveCount: number;
  completionCount: number;
  reviewCount: number;
  averageRating: number | null;
};

/** Public engagement is derived from source rows, never decorative fixture totals. */
export async function authoritativeListingEngagement(
  listingIds: readonly string[],
  client: EngagementClient = db,
): Promise<Map<string, AuthoritativeListingEngagement>> {
  const ids = [...new Set(listingIds)].filter(Boolean);
  if (!ids.length) return new Map();
  const [projections, saves, reviews] = await Promise.all([
    client.communityListingAggregate.findMany({ where: { listingId: { in: ids } } }),
    client.communitySave.groupBy({
      by: ["subjectId"],
      where: { subjectType: "LISTING", subjectId: { in: ids }, kind: "SAVE" },
      _count: { _all: true },
    }),
    client.communityReview.groupBy({
      by: ["listingId"],
      where: { listingId: { in: ids }, status: "ACTIVE", deletedAt: null, verifiedCompletion: true },
      _count: { _all: true },
      _avg: { rating: true },
    }),
  ]);
  const projectionById = new Map(projections.map((row) => [row.listingId, row]));
  const savesById = new Map(saves.map((row) => [row.subjectId, row._count._all]));
  const reviewsById = new Map(reviews.map((row) => [row.listingId, row]));
  return new Map(
    ids.map((listingId) => {
      const projection = projectionById.get(listingId);
      const review = reviewsById.get(listingId);
      return [
        listingId,
        {
          listingId,
          installCount: projection?.installCount ?? 0,
          saveCount: savesById.get(listingId) ?? 0,
          completionCount: projection?.completionCount ?? 0,
          reviewCount: review?._count._all ?? 0,
          averageRating: review?._avg.rating ?? null,
        },
      ];
    }),
  );
}

/** Rebuild the cache after mutations; public reads still derive source truth. */
export async function reconcileListingEngagement(listingId: string, client: EngagementClient = db) {
  const value = (await authoritativeListingEngagement([listingId], client)).get(listingId)!;
  await client.communityListingAggregate.upsert({
    where: { listingId },
    create: value,
    update: {
      saveCount: value.saveCount,
      reviewCount: value.reviewCount,
      averageRating: value.averageRating,
    },
  });
  return value;
}
