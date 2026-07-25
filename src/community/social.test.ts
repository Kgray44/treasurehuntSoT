import { describe, expect, it } from "vitest";
import {
  normalizeCollectionSlug,
  publicCommentProjection,
  publicCreatorResponseProjection,
  publicReviewProjection,
  reviewDimensionRegistry,
  socialLimits,
  validateCommentBody,
  validateReviewInput,
} from "./social";

describe("Community social interaction contracts", () => {
  it("normalizes collection slugs and rejects unsafe or too-short values", () => {
    expect(normalizeCollectionSlug("  Indoor-Adventures  ")).toBe("indoor-adventures");
    expect(() => normalizeCollectionSlug("no")).toThrow("Collection slug");
    expect(() => normalizeCollectionSlug("unsafe_slug")).toThrow("Collection slug");
  });

  it("uses the typed dimension registry rather than accepting arbitrary review JSON", () => {
    expect(reviewDimensionRegistry.CHRONICLE).toContain("pacing");
    expect(validateReviewInput({ rating: 5, spoilerFreeBody: "A safe review body with enough detail.", dimensions: { pacing: 4 } }, "CHRONICLE")).toMatchObject({ rating: 5 });
    expect(() => validateReviewInput({ rating: 3, dimensions: { notARealDimension: 4 } }, "CHRONICLE")).toThrow("dimension");
    expect(() => validateReviewInput({ rating: 0 }, "CHRONICLE")).toThrow("rating");
  });

  it("rejects HTML from comments and keeps ordinary text bounded", () => {
    expect(validateCommentBody("Useful plain text")).toBe("Useful plain text");
    expect(() => validateCommentBody("<script>alert(1)</script>")).toThrow("HTML");
    expect(() => validateCommentBody("[unsafe](javascript:alert(1))")).toThrow("executable");
  });

  it("never returns review spoiler bodies from the default public projection", () => {
    const projection = publicReviewProjection({ id: "review-1", listingId: "listing-1", authorDisplayName: "First Mate", authorHandle: "first-mate", rating: 5, spoilerFreeBody: "Safe body", spoilerBody: "Hidden finale", spoilerLevel: "SPOILER", verifiedInstallation: true, verifiedCompletion: false, completionSessionId: "private-session", status: "ACTIVE", editedAt: null, deletedAt: null });
    expect(projection).toMatchObject({ spoilerFreeBody: "Safe body", hasSpoiler: true });
    expect(projection).not.toHaveProperty("spoilerBody");
    expect(projection).not.toHaveProperty("completionSessionId");
    expect(projection).toMatchObject({ author: { displayName: "First Mate", handle: "first-mate" } });
  });

  it("never returns Creator-response spoiler bodies from the ordinary projection", () => {
    const projection = publicCreatorResponseProjection({ id: "response-1", reviewId: "review-1", creatorDisplayName: "Chartmaker", creatorHandle: "chartmaker", body: "Thank you.", spoilerBody: "Hidden ending note", deletedAt: null, editedAt: null, createdAt: new Date("2026-07-25") });
    expect(projection).toMatchObject({ hasSpoiler: true, creator: { displayName: "Chartmaker" } });
    expect(projection).not.toHaveProperty("spoilerBody");
  });

  it("never returns comment spoiler bodies from the default public projection", () => {
    const projection = publicCommentProjection({ id: "comment-1", subjectType: "GUIDE", subjectId: "guide-1", authorDisplayName: "Deckhand", authorHandle: "deckhand", parentCommentId: null, depth: 0, body: "Safe", spoilerBody: "Hidden", spoilerLevel: "SPOILER", status: "ACTIVE", editedAt: null, deletedAt: null, createdAt: new Date("2026-07-25") });
    expect(projection).toMatchObject({ body: "Safe", hasSpoiler: true });
    expect(projection).not.toHaveProperty("spoilerBody");
    expect(projection).toMatchObject({ author: { displayName: "Deckhand", handle: "deckhand" } });
  });

  it("freezes the bounded collection and reply-depth rules", () => {
    expect(socialLimits.maxCollectionItems).toBe(500);
    expect(socialLimits.maxCommentDepth).toBe(2);
  });
});
