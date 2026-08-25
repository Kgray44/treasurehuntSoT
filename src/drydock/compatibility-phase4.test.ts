import { describe, expect, it } from "vitest";
import { assessDrydockCompatibility, migrationPreviewForHistoricalSnapshot } from "@/drydock/compatibility";
import { snapshotFromStudio } from "@/chronicle/publishing";

const snapshot = () =>
  snapshotFromStudio({
    tale: {
      id: "tale-1",
      slug: "synthetic",
      title: "Synthetic",
      subtitle: null,
      shortDescription: null,
      longDescription: null,
      coverAssetId: null,
      theme: "CARTOGRAPHERS_TABLE",
      visibility: "PRIVATE",
      playerCountMin: 1,
      playerCountMax: 4,
      estimatedDuration: 10,
      contentWarnings: null,
    },
    draft: {
      chapters: [
        {
          id: "chapter-1",
          title: "Synthetic",
          subtitle: null,
          description: null,
          coverAssetId: null,
          estimatedDuration: 10,
          isOptional: false,
          metadata: {},
          blocks: [
            {
              id: "block-1",
              blockType: "narrative",
              title: "Start",
              internalLabel: null,
              isEnabled: true,
              schemaVersion: 1,
              configuration: { heading: "Synthetic", body: "Synthetic", completionMode: "playerConfirmation" },
              presentation: {},
              completion: {},
              connections: [],
            },
          ],
        },
      ],
    },
    assets: [],
    locations: [],
    artifacts: [],
  } as never);

describe("Phase 4 compatibility", () => {
  it("provides a deterministic in-memory upcast assessment without altering the published snapshot", () => {
    const historical = snapshot();
    const before = JSON.stringify(historical);
    const assessment = assessDrydockCompatibility(historical);
    expect(assessment.status).toBe("COMPATIBLE_WITH_UPCAST");
    expect(assessment.findings).toContainEqual(expect.objectContaining({ code: "DRYDOCK_BLOCK_UPCAST_AVAILABLE" }));
    expect(JSON.stringify(historical)).toBe(before);
  });

  it("fails closed for an unsupported block version and makes the preview non-destructive", () => {
    const historical = snapshot();
    historical.chapters[0].blocks[0].schemaVersion = 99;
    expect(assessDrydockCompatibility(historical).status).toBe("UNSUPPORTED");
    expect(migrationPreviewForHistoricalSnapshot(historical)).toMatchObject({
      createsNewDraftOnly: true,
      mutatesPublishedSnapshot: false,
    });
  });
});
