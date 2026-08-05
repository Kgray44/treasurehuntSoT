import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  chronicleFind: vi.fn(),
  releaseFind: vi.fn(),
  sessionCount: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    chronicle: { findFirst: mocks.chronicleFind },
    communityRelease: { findMany: mocks.releaseFind },
    taleSession: { count: mocks.sessionCount },
  },
}));

import { chroniclePreviewHrefByVersion, getPublicChroniclePreview } from "./public-preview";

describe("Project Homeport public Chronicle preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.releaseFind.mockResolvedValue([]);
    mocks.sessionCount.mockResolvedValueOnce(8).mockResolvedValueOnce(3);
    mocks.chronicleFind.mockResolvedValue({
      id: "tale-1",
      slug: "moonlit-map",
      title: "The Moonlit Map",
      subtitle: "A preview-safe subtitle",
      shortDescription: "Follow the lantern.",
      longDescription: "A public description without solution content.",
      theme: "MYSTERY",
      coverAssetId: null,
      estimatedDuration: 75,
      playerCountMin: 1,
      playerCountMax: 4,
      contentWarnings: "Low-light imagery",
      creatorAccount: { profile: { displayName: "Synthetic Creator", handle: "synthetic-creator" } },
      versions: [
        {
          id: "version-1",
          versionLabel: "1.0",
          publishedAt: new Date("2026-08-04T00:00:00.000Z"),
          releaseNotes: "Initial public release.",
        },
      ],
    });
  });

  it("homeport.owner-correction.round1.chronicle-preview.nonmutating reads only public metadata and aggregate counts", async () => {
    const preview = await getPublicChroniclePreview("moonlit-map");
    expect(preview).toMatchObject({
      slug: "moonlit-map",
      title: "The Moonlit Map",
      statistics: { voyagesStarted: 8, voyagesCompleted: 3 },
      startHref: "/play/moonlit-map",
    });
    expect(mocks.chronicleFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          slug: "moonlit-map",
          archivedAt: null,
          status: "PUBLISHED",
          visibility: { in: ["PUBLIC", "UNLISTED"] },
        }),
      }),
    );
    expect(mocks.sessionCount).toHaveBeenNthCalledWith(1, {
      where: { publishedVersionId: "version-1", previewMode: false },
    });
    expect(mocks.sessionCount).toHaveBeenNthCalledWith(2, {
      where: { publishedVersionId: "version-1", previewMode: false, status: "COMPLETED" },
    });
  });

  it("homeport.owner-correction.round1.chronicle-preview.community-route selects only the current eligible release", async () => {
    mocks.releaseFind.mockResolvedValue([
      {
        id: "release-old",
        sourcePublishedTaleVersionId: "version-1",
        listing: { slug: "moonlit-map", currentReleaseId: "release-current" },
      },
      {
        id: "release-current",
        sourcePublishedTaleVersionId: "version-1",
        listing: { slug: "moonlit-map", currentReleaseId: "release-current" },
      },
    ]);
    const hrefs = await chroniclePreviewHrefByVersion(["version-1"]);
    expect(hrefs.get("version-1")).toBe("/community/moonlit-map");
    expect(mocks.releaseFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          moderationStatus: "ACTIVE",
          deprecatedAt: null,
          listing: expect.objectContaining({ publicationStatus: "PUBLISHED" }),
        }),
      }),
    );
  });

  it("returns no preview for a nonpublic or unavailable Chronicle", async () => {
    mocks.chronicleFind.mockResolvedValue(null);
    await expect(getPublicChroniclePreview("private-chart")).resolves.toBeNull();
    expect(mocks.sessionCount).not.toHaveBeenCalled();
  });
});
