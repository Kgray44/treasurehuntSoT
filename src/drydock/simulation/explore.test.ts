import { describe, expect, it } from "vitest";
import type { PublishedTaleSnapshot } from "@/chronicle/types";
import { exploreDrydockScenario } from "@/drydock/simulation/explore";
import { drydockSimulationSourceChecksum } from "@/drydock/simulation/source";

const snapshot: PublishedTaleSnapshot = {
  schemaVersion: 1,
  tale: {
    id: "tale",
    slug: "tale",
    title: "Synthetic",
    subtitle: null,
    shortDescription: null,
    longDescription: null,
    coverAssetId: null,
    theme: "default",
    visibility: "PRIVATE",
    playerCountMin: 1,
    playerCountMax: 1,
    estimatedDuration: null,
    contentWarnings: null,
  },
  chapters: [
    {
      id: "chapter",
      title: "Synthetic",
      orderIndex: 0,
      entryBlockId: "start",
      completionBlockId: "finish",
      blocks: [
        {
          id: "start",
          chapterId: "chapter",
          blockType: "narrative",
          title: "Start",
          configuration: {},
          presentation: {},
          completion: { mode: "playerConfirmation" },
          isEnabled: true,
          schemaVersion: 2,
          orderIndex: 0,
          nextBlockId: "finish",
          connections: [{ targetBlockId: "finish", connectionType: "DEFAULT", orderIndex: 0 }],
        },
        {
          id: "finish",
          chapterId: "chapter",
          blockType: "taleComplete",
          title: "Finish",
          configuration: {},
          presentation: {},
          completion: { mode: "playerConfirmation" },
          isEnabled: true,
          schemaVersion: 2,
          orderIndex: 1,
          nextBlockId: null,
          connections: [],
        },
      ],
    },
  ],
  assets: [],
  locations: [],
  artifacts: [],
  publishedAt: "2026-08-12T00:00:00.000Z",
};

describe("Drydock bounded exhaustive exploration", () => {
  it("explores only the declared finite input domain and reports any bound truthfully", () => {
    const scenario = {
      schemaVersion: 1 as const,
      id: "explore",
      revision: 1,
      sourceChecksum: drydockSimulationSourceChecksum(snapshot),
      title: "Explore",
      purpose: "Synthetic finite exploration.",
      seed: "seed",
      initialState: { variables: {}, inventory: [], actorMode: "CREATOR" as const },
      environment: {
        virtualStart: "2026-08-12T00:00:00.000Z",
        locale: "en-US",
        viewport: "DESKTOP" as const,
        reducedMotion: false,
        soundEnabled: true,
        keyboardOnly: false,
      },
      limits: { maxSteps: 5, maxStates: 5, maxTraceEntries: 5, maxVirtualMilliseconds: 1_000 },
      inputs: [],
      faults: [],
      assertions: [],
      tags: [],
    };
    const complete = exploreDrydockScenario(snapshot, scenario, {
      inputs: [{ kind: "CONTINUE" }],
      maxDepth: 2,
      maxStates: 5,
      maxTransitions: 5,
    });
    const bounded = exploreDrydockScenario(snapshot, scenario, {
      inputs: [{ kind: "CONTINUE" }],
      maxDepth: 2,
      maxStates: 5,
      maxTransitions: 0,
    });

    expect(complete.status).toBe("COMPLETE");
    expect(complete.coverage.coveredEndingBlockIds).toEqual(["finish"]);
    expect(bounded.status).toBe("INCOMPLETE_PROOF");
  });
});
