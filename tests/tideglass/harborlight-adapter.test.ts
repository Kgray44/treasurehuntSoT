import { describe, expect, it } from "vitest";
import { resolveHarborlightTideglassComparison, type HarborlightTideglassRelease } from "@/tideglass/harborlight";

const publicSource = (id: string, taleId = "chronicle-1", slug = "lantern-coast") => ({
  id,
  tale: { id: taleId, slug, status: "PUBLISHED", visibility: "PUBLIC" },
});

const release = (
  semanticVersion: string,
  sourcePublishedTaleVersion: HarborlightTideglassRelease["sourcePublishedTaleVersion"],
) => ({
  semanticVersion,
  sourcePublishedTaleVersion,
});

describe("Harborlight Tideglass handoff", () => {
  it("hands the exact same-Chronicle release pair to the public Tideglass passage", () => {
    expect(
      resolveHarborlightTideglassComparison({
        listingItemType: "CHRONICLE",
        currentRelease: release("2.0.0", publicSource("edition-2")),
        earlierReleases: [release("1.4.0", publicSource("edition-1"))],
        returnTo: "/community/lantern-coast",
      }),
    ).toEqual({
      href: "/chronicles/lantern-coast/compare?from=edition-1&to=edition-2&returnTo=%2Fcommunity%2Flantern-coast",
      sourceReleaseVersion: "1.4.0",
      targetReleaseVersion: "2.0.0",
    });
  });

  it("fails closed for cross-Chronicle, unpublished, and package-only releases", () => {
    const current = release("2.0.0", publicSource("edition-2"));
    expect(
      resolveHarborlightTideglassComparison({
        listingItemType: "CHRONICLE",
        currentRelease: current,
        earlierReleases: [release("1.0.0", publicSource("edition-1", "another-chronicle"))],
        returnTo: "/community/lantern-coast",
      }),
    ).toBeNull();
    expect(
      resolveHarborlightTideglassComparison({
        listingItemType: "CHRONICLE",
        currentRelease: current,
        earlierReleases: [release("1.0.0", null)],
        returnTo: "/community/lantern-coast",
      }),
    ).toBeNull();
    expect(
      resolveHarborlightTideglassComparison({
        listingItemType: "ARTIFACT_2D",
        currentRelease: current,
        earlierReleases: [release("1.0.0", publicSource("edition-1"))],
        returnTo: "/community/lantern-coast",
      }),
    ).toBeNull();
  });
});
