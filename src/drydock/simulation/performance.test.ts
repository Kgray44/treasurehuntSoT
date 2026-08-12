import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import type { PublishedTaleSnapshot } from "@/chronicle/types";
import { runDrydockScenario } from "@/drydock/simulation/engine";
import { drydockSimulationSourceChecksum } from "@/drydock/simulation/source";

const snapshot: PublishedTaleSnapshot = {
  schemaVersion: 1,
  tale: {
    id: "performance",
    slug: "performance",
    title: "Performance",
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
      title: "Chapter",
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
const scenario = {
  schemaVersion: 1,
  id: "performance-linear",
  revision: 1,
  sourceChecksum: drydockSimulationSourceChecksum(snapshot),
  title: "Bounded performance regression",
  purpose: "Keep synthetic bounded replay within a local qualification budget.",
  seed: "performance",
  initialState: { variables: {}, inventory: [], actorMode: "CREATOR" },
  environment: {
    virtualStart: "2026-08-12T00:00:00.000Z",
    locale: "en-US",
    viewport: "DESKTOP",
    reducedMotion: false,
    soundEnabled: true,
    keyboardOnly: false,
  },
  limits: { maxSteps: 2, maxStates: 10, maxTraceEntries: 10, maxVirtualMilliseconds: 1_000 },
  inputs: [{ kind: "CONTINUE" }, { kind: "CONTINUE" }],
  faults: [],
  assertions: [],
  tags: ["performance", "synthetic"],
};

describe("Drydock bounded performance", () => {
  it("replays 500 short synthetic scenarios inside the local regression budget", () => {
    const started = performance.now();
    let completed = 0;
    for (let index = 0; index < 500; index += 1)
      if (runDrydockScenario(snapshot, { ...scenario, id: `performance-${index}` }).status === "COMPLETED")
        completed += 1;
    const elapsedMilliseconds = performance.now() - started;

    expect(completed).toBe(500);
    expect(elapsedMilliseconds).toBeLessThan(2_000);
  });
});
