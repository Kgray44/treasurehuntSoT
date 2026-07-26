import { describe, expect, it } from "vitest";

import { creatorResponseInputSchema, reviewInputSchema } from "./contract";

describe("Community review request contracts", () => {
  it("accepts bounded review fields but rejects forged author and eligibility claims", () => {
    expect(
      reviewInputSchema.parse({
        listingId: "listing_1",
        reviewedReleaseId: "release_1",
        rating: 5,
        spoilerFreeBody: "A useful spoiler-free review with enough detail.",
        dimensions: { pacing: 4 },
      }),
    ).toMatchObject({ listingId: "listing_1", rating: 5 });
    expect(() =>
      reviewInputSchema.parse({
        listingId: "listing_1",
        rating: 5,
        verifiedCompletion: true,
        authorAccountId: "forged",
      }),
    ).toThrow();
  });

  it("keeps Creator response spoilers separate and rejects markup", () => {
    expect(
      creatorResponseInputSchema.parse({
        body: "Thank you for the thoughtful review.",
        spoilerBody: "A future finale detail.",
      }),
    ).toMatchObject({ body: "Thank you for the thoughtful review." });
    expect(() => creatorResponseInputSchema.parse({ body: "<script>alert(1)</script>" })).toThrow();
  });
});
