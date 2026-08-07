import { describe, expect, it, vi } from "vitest";
import { authoritativeListingEngagement, reconcileListingEngagement } from "./engagement-aggregates";

function client() {
  return {
    communityListingAggregate: {
      findMany: vi.fn().mockResolvedValue([
        {
          listingId: "listing-1",
          installCount: 8,
          completionCount: 3,
          saveCount: 12,
          reviewCount: 9,
          averageRating: 4.8,
        },
      ]),
      upsert: vi.fn().mockResolvedValue({}),
    },
    communitySave: {
      groupBy: vi.fn().mockResolvedValue([{ subjectId: "listing-1", _count: { _all: 2 } }]),
    },
    communityReview: {
      groupBy: vi.fn().mockResolvedValue([{ listingId: "listing-1", _count: { _all: 1 }, _avg: { rating: 4 } }]),
    },
  };
}

describe("homeport.owner-correction.round2.authoritative-engagement", () => {
  it("ignores decorative cached save and rating totals", async () => {
    const fake = client();
    const result = (await authoritativeListingEngagement(["listing-1"], fake as never)).get("listing-1");
    expect(result).toMatchObject({ saveCount: 2, reviewCount: 1, averageRating: 4 });
    expect(fake.communityReview.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACTIVE", deletedAt: null, verifiedCompletion: true }),
      }),
    );
  });

  it("reconciles the rebuildable projection from source truth", async () => {
    const fake = client();
    await reconcileListingEngagement("listing-1", fake as never);
    expect(fake.communityListingAggregate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { saveCount: 2, reviewCount: 1, averageRating: 4 },
      }),
    );
  });
});
