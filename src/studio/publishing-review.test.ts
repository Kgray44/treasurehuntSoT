import { describe, expect, it } from "vitest";
import type { PublishedTaleSnapshot } from "@/chronicle/types";
import { buildPublishingReview } from "./publishing-review";

const checksum = "a".repeat(64);
const snapshot = (title: string, blockTitle: string, assetState = "READY"): PublishedTaleSnapshot => ({
  schemaVersion: 1,
  tale: {
    id: "tale-1",
    slug: "synthetic-chronicle",
    title,
    subtitle: null,
    shortDescription: null,
    longDescription: null,
    coverAssetId: null,
    theme: "CARTOGRAPHERS_TABLE",
    visibility: "PRIVATE",
    playerCountMin: 1,
    playerCountMax: 4,
    estimatedDuration: null,
    contentWarnings: null,
  },
  chapters: [
    {
      id: "chapter-1",
      title: "Harbor",
      subtitle: null,
      description: null,
      coverAssetId: null,
      estimatedDuration: null,
      isOptional: false,
      metadata: {},
      orderIndex: 0,
      entryBlockId: "passage-1",
      completionBlockId: "passage-1",
      blocks: [
        {
          id: "passage-1",
          chapterId: "chapter-1",
          blockType: "narrative",
          title: blockTitle,
          internalLabel: null,
          configuration: { text: blockTitle },
          presentation: {},
          completion: {},
          creatorNotes: null,
          isEnabled: true,
          schemaVersion: 1,
          orderIndex: 0,
          nextBlockId: null,
          connections: [],
        },
      ],
    },
  ],
  assets: [
    {
      id: "asset-1",
      mediaType: "IMAGE",
      displayName: "Harbor chart",
      description: null,
      mimeType: "image/png",
      width: 1,
      height: 1,
      roles: [],
      variants: [{ id: "variant-1", role: "PREVIEW", mimeType: "image/png", processingState: assetState }],
    },
  ],
  locations: [{ id: "location-1", name: "North Harbor", captainNotes: undefined }],
  artifacts: [{ id: "artifact-1", name: "Signal Lantern" }],
  publishedAt: "2026-08-26T00:00:00.000Z",
});

describe("Shipwright publishing review", () => {
  it("reports the exact Creator-readable changes without returning internal identifiers", () => {
    const previous = snapshot("Previous Chronicle", "Old opening", "PROCESSING");
    previous.locations[0].region = "South Harbor";
    previous.artifacts[0].shortDescription = "Unlit";
    const review = buildPublishingReview(snapshot("Current Chronicle", "New opening"), {
      versionLabel: "1.0",
      checksum,
      snapshot: previous,
    });
    expect(review.currentPublished).toEqual({ versionLabel: "1.0", checksum });
    expect(review.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ subject: "Chronicle", kind: "CHANGED", label: "Current Chronicle" }),
        expect.objectContaining({ subject: "Passage", kind: "CHANGED", label: "New opening" }),
        expect.objectContaining({ subject: "Asset", kind: "CHANGED", label: "Harbor chart" }),
        expect.objectContaining({ subject: "Location", kind: "CHANGED", label: "North Harbor" }),
        expect.objectContaining({ subject: "Artifact", kind: "CHANGED", label: "Signal Lantern" }),
      ]),
    );
    expect(JSON.stringify(review.changes)).not.toContain("passage-1");
    expect(JSON.stringify(review.changes)).not.toContain("location-1");
    expect(JSON.stringify(review.changes)).not.toContain("artifact-1");
    expect(review.assets).toEqual({
      total: 1,
      ready: 1,
      attention: 0,
      items: [{ label: "Harbor chart", readiness: "READY" }],
    });
  });

  it("treats a first release as an all-new draft and keeps large Chronicles inspectable", () => {
    const first = snapshot("First Chronicle", "Opening");
    first.chapters[0].blocks = Array.from({ length: 250 }, (_, index) => ({
      ...first.chapters[0].blocks[0],
      id: `passage-${index}`,
      title: `Passage ${index + 1}`,
      orderIndex: index,
    }));
    const startedAt = performance.now();
    const review = buildPublishingReview(first, null);
    const elapsedMilliseconds = performance.now() - startedAt;
    expect(review.summary).toMatchObject({ chapters: 1, passages: 250, assets: 1 });
    expect(review.changes.filter((change) => change.subject === "Passage")).toHaveLength(250);
    expect(elapsedMilliseconds).toBeLessThan(1_000);
  });
});
