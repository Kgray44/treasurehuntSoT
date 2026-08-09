import { describe, expect, it } from "vitest";
import fixture from "../../tests/fixtures/drydock/current-authoring-v1.json";
import { canonicalChecksum } from "@/drydock/canonical";
import { snapshotFromStudio } from "@/chronicle/publishing";
import { studioDraftSchema } from "@/chronicle/studio-service";
import { providerForBlock } from "@/chronicle/block-registry";

describe("Drydock current product compatibility", () => {
  it("keeps v1 and separated v2 drafts accepted by the autosave transport", () => {
    const base = {
      autosaveVersion: 1,
      tale: { title: "Synthetic Chronicle", slug: "synthetic-chronicle" },
      chapters: [
        {
          id: "chapter-0001",
          title: "Synthetic Chapter",
          blocks: [
            {
              id: "block-0001",
              blockType: "narrative",
              title: "Synthetic Passage",
              configuration: { heading: "Synthetic", body: "Synthetic body.", completionMode: "playerConfirmation" },
              presentation: {},
              completion: {},
              schemaVersion: 1,
            },
          ],
        },
      ],
    };
    expect(studioDraftSchema.safeParse(base).success).toBe(true);
    const current = structuredClone(base) as unknown as {
      chapters: Array<{
        blocks: Array<{
          schemaVersion: number;
          configuration: Record<string, unknown>;
          completion: Record<string, unknown>;
        }>;
      }>;
    };
    current.chapters[0].blocks[0].schemaVersion = 2;
    delete current.chapters[0].blocks[0].configuration.completionMode;
    current.chapters[0].blocks[0].completion = { mode: "playerConfirmation" };
    expect(studioDraftSchema.safeParse(current).success).toBe(true);
  });

  it("publishes canonical v2 blocks while retaining the accepted runtime completion alias", () => {
    const before = canonicalChecksum(fixture);
    const blocks = fixture.blocks.map((block) => ({
      ...structuredClone(block),
      title: `Synthetic ${block.blockType}`,
      internalLabel: null,
      creatorNotes: null,
      isEnabled: true,
    }));
    const studio = {
      tale: {
        id: "tale-synthetic",
        slug: "synthetic-compatibility",
        title: "Synthetic Compatibility",
        subtitle: null,
        shortDescription: null,
        longDescription: null,
        coverAssetId: null,
        theme: "CARTOGRAPHERS_TABLE",
        visibility: "PRIVATE",
        playerCountMin: 1,
        playerCountMax: 4,
        estimatedDuration: 30,
        contentWarnings: null,
      },
      draft: {
        chapters: [
          {
            id: "chapter-synthetic",
            title: "Synthetic Chapter",
            subtitle: null,
            description: null,
            coverAssetId: null,
            estimatedDuration: 30,
            isOptional: false,
            metadata: {},
            blocks,
          },
        ],
      },
      assets: [],
      locations: [],
      artifacts: [],
    };
    const snapshot = snapshotFromStudio(studio as never);
    expect(snapshot.chapters[0].blocks).toHaveLength(23);
    expect(snapshot.chapters[0].blocks.every((block) => block.schemaVersion === 2)).toBe(true);
    const wait = snapshot.chapters[0].blocks.find((block) => block.blockType === "wait")!;
    expect(wait.completion?.mode).toBe("timer");
    expect(wait.configuration.completionMode).toBe("timer");
    expect(canonicalChecksum(fixture)).toBe(before);
  });

  it("prefers separated completion without changing hard-owned provider behavior", () => {
    expect(providerForBlock("narrative", { completionMode: "playerConfirmation" }, { mode: "automatic" })).toBeNull();
    expect(providerForBlock("captainApproval", {}, { mode: "automatic" })).toBe("captainManual");
    expect(providerForBlock("riddle", {}, { mode: "playerConfirmation" })).toBe("textAnswer");
  });
});
