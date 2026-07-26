import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => {
  class Unavailable extends Error {
    code = "COMMUNITY_SOCIAL_STATE_UNAVAILABLE";
  }
  return {
    getSocialRelationshipStates: vi.fn(),
    requireCanonicalAccountIdentity: vi.fn(),
    Unavailable,
  };
});

vi.mock("@/community/social-state", () => ({
  CommunitySocialStateUnavailable: dependencies.Unavailable,
  getSocialRelationshipStates: dependencies.getSocialRelationshipStates,
  socialStateSubjectTypes: ["LISTING", "CREATOR", "GUIDE", "COLLECTION"],
}));
vi.mock("@/platform/auth", () => ({ requireCanonicalAccountIdentity: dependencies.requireCanonicalAccountIdentity }));

import { GET } from "./route";

describe("GET /api/community/social/state", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.requireCanonicalAccountIdentity.mockResolvedValue({ accountId: "account_1" });
  });

  it("returns a typed private unavailable result instead of an empty success set", async () => {
    dependencies.getSocialRelationshipStates.mockRejectedValue(new dependencies.Unavailable());
    const response = await GET(
      new Request(
        "http://localhost/api/community/social/state?subjects=%5B%7B%22subjectType%22%3A%22LISTING%22%2C%22subjectId%22%3A%22listing_1%22%7D%5D",
      ),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      code: "COMMUNITY_SOCIAL_STATE_UNAVAILABLE",
      error: "Community relationship state is temporarily unavailable.",
    });
  });
});
