import { describe, expect, it } from "vitest";
import fixture from "../../tests/fixtures/drydock/current-authoring-v1.json";
import type { PublishedTaleSnapshot } from "@/chronicle/types";
import { assessDrydockCompatibility, migrationPreviewForHistoricalSnapshot } from "@/drydock/compatibility";

const historical = (): PublishedTaleSnapshot => ({
  schemaVersion: 1,
  tale: { id: "historical-tale", slug: "historical", title: "Historical corpus", subtitle: null, shortDescription: null, longDescription: null, coverAssetId: null, theme: "CARTOGRAPHERS_TABLE", visibility: "PRIVATE", playerCountMin: 1, playerCountMax: 4, estimatedDuration: null, contentWarnings: null },
  chapters: [{ id: "historical-chapter", title: "Historical", subtitle: null, description: null, coverAssetId: null, estimatedDuration: null, isOptional: false, metadata: {}, orderIndex: 0, entryBlockId: fixture.blocks[0]?.id ?? null, completionBlockId: null, blocks: fixture.blocks.map((block, orderIndex) => ({ ...block, chapterId: "historical-chapter", title: `Historical ${block.blockType}`, internalLabel: null, creatorNotes: null, isEnabled: true, orderIndex, connections: block.connections.map((connection, connectionIndex) => ({ ...connection, orderIndex: connectionIndex })) })) }],
  assets: [], locations: [], artifacts: [], publishedAt: "2024-01-01T00:00:00.000Z",
} as unknown as PublishedTaleSnapshot);

describe("Phase 4 frozen historical compatibility corpus", () => {
  it("reads and in-memory upcasts every supported Phase 1 block fixture without mutating its published source", () => {
    const source = historical();
    const original = JSON.stringify(source);
    const assessment = assessDrydockCompatibility(source);
    expect(assessment.sourceSchemaVersion).toBe(1);
    expect(assessment.supportedBlockCount).toBe(fixture.blocks.length);
    expect(assessment.status).toBe("COMPATIBLE_WITH_UPCAST");
    expect(assessment.findings.filter((finding) => finding.code === "DRYDOCK_BLOCK_UPCAST_AVAILABLE")).toHaveLength(fixture.blocks.length);
    expect(JSON.stringify(source)).toBe(original);
  });

  it("offers a descriptive, non-destructive modernization preview for the frozen corpus", () => {
    const preview = migrationPreviewForHistoricalSnapshot(historical());
    expect(preview).toMatchObject({ status: "COMPATIBLE_WITH_UPCAST", createsNewDraftOnly: true, mutatesPublishedSnapshot: false });
    expect(preview.safeSummary).toHaveLength(fixture.blocks.length);
  });
});
