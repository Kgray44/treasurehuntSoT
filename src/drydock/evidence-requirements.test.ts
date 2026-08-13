import { describe, expect, it } from "vitest";
import type { PublishedTaleSnapshot } from "@/chronicle/types";
import { deriveDrydockEvidenceRequirements } from "@/drydock/evidence-requirements";

const snapshot = (mode: string): PublishedTaleSnapshot => ({ schemaVersion: 1, tale: { id: "t", slug: "t", title: "T", subtitle: null, shortDescription: null, longDescription: null, coverAssetId: null, theme: "CARTOGRAPHERS_TABLE", visibility: "PRIVATE", playerCountMin: 1, playerCountMax: 1, estimatedDuration: null, contentWarnings: null }, chapters: [{ id: "c", title: "C", subtitle: null, description: null, coverAssetId: null, estimatedDuration: null, isOptional: false, metadata: {}, orderIndex: 0, entryBlockId: "b", completionBlockId: "b", blocks: [{ id: "b", chapterId: "c", blockType: "arrivalCheck", title: "B", configuration: {}, presentation: {}, completion: { mode }, isEnabled: true, schemaVersion: 2, orderIndex: 0, nextBlockId: null, connections: [] }] }], assets: [], locations: [], artifacts: [], publishedAt: "2026-08-13T00:00:00.000Z" });

describe("Drydock evidence requirement registry", () => {
  it("adds only the applicable provider evidence requirement", () => {
    expect(deriveDrydockEvidenceRequirements(snapshot("playerConfirmation")).map((item) => item.id)).toEqual(["DD-R-STATIC", "DD-R-SCENARIOS", "DD-R-COMPATIBILITY"]);
    expect(deriveDrydockEvidenceRequirements(snapshot("visionLocation"))).toContainEqual(expect.objectContaining({ id: "DD-R-LANDFALL-FIELD", providerId: "landfall", evidenceKind: "field-evidence" }));
  });
});
