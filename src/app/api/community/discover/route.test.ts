import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  searchHomeportCommunity: vi.fn(),
  requireCanonicalAccountIdentity: vi.fn(),
  consumeConfiguredCommunityRateLimit: vi.fn(),
}));

vi.mock("@/community/homeport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/community/homeport")>()),
  searchHomeportCommunity: dependencies.searchHomeportCommunity,
}));
vi.mock("@/platform/auth", () => ({
  requireCanonicalAccountIdentity: dependencies.requireCanonicalAccountIdentity,
}));
vi.mock("@/community/rate-limit", () => ({
  consumeConfiguredCommunityRateLimit: dependencies.consumeConfiguredCommunityRateLimit,
}));

import { GET } from "./route";

describe("GET /api/community/discover", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.consumeConfiguredCommunityRateLimit.mockResolvedValue({ allowed: true });
    dependencies.requireCanonicalAccountIdentity.mockResolvedValue({ accountId: "viewer-account" });
    dependencies.searchHomeportCommunity.mockResolvedValue({ items: [], facets: {} });
  });

  it("translates human URL parameters to the bounded Homeport search contract", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/community/discover?q=coast&type=ARTIFACT&duration=UNDER_60&difficulty=MODERATE&players=TWO_TO_FOUR&theme=mystery&environment=MIXED&accessibility=CAPTIONS&free=1&remixable=1&sort=NEWEST",
      ),
    );
    expect(response.status).toBe(200);
    expect(dependencies.searchHomeportCommunity).toHaveBeenCalledWith({
      query: "coast",
      filters: {
        itemTypes: ["ARTIFACT_2D", "ARTIFACT_3D", "ARTIFACT_COLLECTION"],
        durationMaximum: 60,
        playerMinimum: 2,
        playerMaximum: 4,
        difficulties: ["MODERATE"],
        environments: ["MIXED"],
        accessibilityFeatures: ["CAPTIONS"],
        themes: ["mystery"],
        freeOnly: true,
        remixable: true,
      },
      sort: "NEWEST",
      cursor: undefined,
      pageSize: undefined,
      viewerAccountId: "viewer-account",
    });
    expect(response.headers.get("cache-control")).toBe("private, max-age=0, must-revalidate");
  });

  it("rejects invalid public criteria without calling the provider or leaking internals", async () => {
    const response = await GET(new NextRequest("http://localhost/api/community/discover?type=PRIVATE_SOURCE"));
    expect(response.status).toBe(400);
    expect(dependencies.searchHomeportCommunity).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      code: "COMMUNITY_DISCOVERY_FILTER_INVALID",
      message: "The selected content type is not supported.",
    });
  });

  it("returns a stable safe failure when the discovery dependency fails", async () => {
    dependencies.searchHomeportCommunity.mockRejectedValue(new Error("file:C:/private/provider.db"));
    const response = await GET(new NextRequest("http://localhost/api/community/discover?q=coast"));
    expect(response.status).toBe(500);
    const wire = await response.text();
    expect(wire).toContain("Community discovery is unavailable.");
    expect(wire).not.toContain("provider.db");
  });
});
