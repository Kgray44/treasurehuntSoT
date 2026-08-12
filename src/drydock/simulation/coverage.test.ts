import { describe, expect, it } from "vitest";
import type { PublishedTaleSnapshot } from "@/chronicle/types";
import { createDrydockCoverageReport } from "@/drydock/simulation/coverage";
import { runDrydockScenario } from "@/drydock/simulation/engine";
import { drydockSimulationSourceChecksum } from "@/drydock/simulation/source";

const snapshot: PublishedTaleSnapshot = {
  schemaVersion: 1,
  tale: { id: "tale", slug: "tale", title: "Tale", subtitle: null, shortDescription: null, longDescription: null, coverAssetId: null, theme: "default", visibility: "PRIVATE", playerCountMin: 1, playerCountMax: 1, estimatedDuration: null, contentWarnings: null },
  chapters: [{ id: "chapter", title: "Chapter", orderIndex: 0, entryBlockId: "start", completionBlockId: "finish", blocks: [
    { id: "start", chapterId: "chapter", blockType: "narrative", title: "Start", configuration: {}, presentation: {}, completion: { mode: "playerConfirmation" }, isEnabled: true, schemaVersion: 2, orderIndex: 0, nextBlockId: "finish", connections: [{ targetBlockId: "finish", connectionType: "DEFAULT", orderIndex: 0 }] },
    { id: "finish", chapterId: "chapter", blockType: "taleComplete", title: "Finish", configuration: {}, presentation: {}, completion: { mode: "playerConfirmation" }, isEnabled: true, schemaVersion: 2, orderIndex: 1, nextBlockId: null, connections: [] },
  ] }],
  assets: [], locations: [], artifacts: [], publishedAt: "2026-08-12T00:00:00.000Z",
};
const scenario = { schemaVersion: 1, id: "coverage", revision: 1, sourceChecksum: drydockSimulationSourceChecksum(snapshot), title: "Coverage", purpose: "Cover both synthetic blocks.", seed: "seed", initialState: { variables: {}, inventory: [], actorMode: "CREATOR" }, environment: { virtualStart: "2026-08-12T00:00:00.000Z", locale: "en-US", viewport: "DESKTOP", reducedMotion: false, soundEnabled: true, keyboardOnly: false }, limits: { maxSteps: 2, maxStates: 10, maxTraceEntries: 10, maxVirtualMilliseconds: 1_000 }, inputs: [{ kind: "CONTINUE" }, { kind: "CONTINUE" }], faults: [], assertions: [], tags: [] };

describe("Drydock coverage ledger", () => {
  it("reports exact uncovered paths rather than upgrading partial execution to complete proof", () => {
    const complete = createDrydockCoverageReport(snapshot, [runDrydockScenario(snapshot, scenario)]);
    expect(complete.proofStatus).toBe("COMPLETE");
    expect(complete.uncoveredBlockIds).toEqual([]);

    const partial = createDrydockCoverageReport(snapshot, [runDrydockScenario(snapshot, { ...scenario, inputs: [{ kind: "CONTINUE" }] })]);
    expect(partial.proofStatus).toBe("INCOMPLETE_PROOF");
    expect(partial.uncoveredBlockIds).toEqual([]);
  });
});
