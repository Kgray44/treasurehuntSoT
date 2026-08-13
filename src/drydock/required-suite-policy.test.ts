import { describe, expect, it } from "vitest";
import type { PublishedTaleSnapshot } from "@/chronicle/types";
import { requiredScenarioClasses } from "@/drydock/required-suite-policy";

const snapshot = (blockType: string, mode: string): PublishedTaleSnapshot => ({
  schemaVersion: 1,
  tale: { id: "tale", slug: "tale", title: "Tale", subtitle: null, shortDescription: null, longDescription: null, coverAssetId: null, theme: "CARTOGRAPHERS_TABLE", visibility: "PRIVATE", playerCountMin: 1, playerCountMax: 1, estimatedDuration: null, contentWarnings: null },
  chapters: [{ id: "chapter", title: "Chapter", subtitle: null, description: null, coverAssetId: null, estimatedDuration: null, isOptional: false, metadata: {}, orderIndex: 0, entryBlockId: "block", completionBlockId: "block", blocks: [{ id: "block", chapterId: "chapter", blockType, title: "Block", configuration: {}, presentation: {}, completion: { mode }, isEnabled: true, schemaVersion: 2, orderIndex: 0, nextBlockId: null, connections: [] }] }],
  assets: [], locations: [], artifacts: [], publishedAt: "2026-08-13T00:00:00.000Z",
});

describe("required Scenario Suite policy", () => {
  it("always requires a baseline path but only derives applicable classes", () => {
    expect(requiredScenarioClasses(snapshot("narrative", "playerConfirmation")).map((item) => item.id)).toEqual(["BASELINE_SUCCESS"]);
    expect(requiredScenarioClasses(snapshot("wait", "timer")).map((item) => item.id)).toContain("TIMER_TIMEOUT");
    expect(requiredScenarioClasses(snapshot("captainApproval", "captainManual")).map((item) => item.id)).toContain("CAPTAIN_APPROVE_REJECT");
  });
});
