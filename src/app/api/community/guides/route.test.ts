import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  communityGuideContent: { findMany: vi.fn(), findFirst: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: dependencies }));

import { GET as getGuide } from "./[slug]/route";
import { GET as listGuides } from "./route";

describe("public Community Guide routes", () => {
  beforeEach(() => vi.resetAllMocks());

  it("lists only a bounded, persisted public Guide projection", async () => {
    dependencies.communityGuideContent.findMany.mockResolvedValue([
      {
        slug: "safe-chart",
        title: "Safe chart",
        safeSummary: "A public summary",
        category: "SAFETY",
        publishedAt: new Date("2026-07-25"),
        updatedAt: new Date("2026-07-25"),
      },
    ]);
    const response = await listGuides();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      guides: [
        {
          slug: "safe-chart",
          title: "Safe chart",
          safeSummary: "A public summary",
          category: "SAFETY",
          publishedAt: "2026-07-25T00:00:00.000Z",
          updatedAt: "2026-07-25T00:00:00.000Z",
        },
      ],
    });
    expect(dependencies.communityGuideContent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PUBLISHED", publishedAt: { not: null }, deprecatedAt: null },
        take: 48,
      }),
    );
  });

  it("returns an allowlisted Guide detail only when its stored public state is eligible", async () => {
    dependencies.communityGuideContent.findFirst.mockResolvedValue({
      slug: "safe-chart",
      title: "Safe chart",
      safeSummary: "A public summary",
      sanitizedBody: "# Safe",
      category: "SAFETY",
      publishedAt: new Date("2026-07-25"),
      updatedAt: new Date("2026-07-25"),
    });
    const response = await getGuide(new Request("http://localhost/api/community/guides/safe-chart"), {
      params: Promise.resolve({ slug: "safe-chart" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      slug: "safe-chart",
      title: "Safe chart",
      safeSummary: "A public summary",
      sanitizedBody: "# Safe",
      category: "SAFETY",
      publishedAt: "2026-07-25T00:00:00.000Z",
      updatedAt: "2026-07-25T00:00:00.000Z",
    });
    expect(dependencies.communityGuideContent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PUBLISHED", publishedAt: { not: null }, deprecatedAt: null, slug: "safe-chart" },
      }),
    );
  });

  it("does not distinguish draft, deprecated, or absent Guides", async () => {
    dependencies.communityGuideContent.findFirst.mockResolvedValue(null);
    const response = await getGuide(new Request("http://localhost/api/community/guides/private"), {
      params: Promise.resolve({ slug: "private" }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: "COMMUNITY_GUIDE_NOT_FOUND", error: "Guide not found." });
  });
});
