import { describe, expect, it } from "vitest";
import type { PublishedBlock, PublishedTaleSnapshot } from "@/chronicle/types";
import type { DrydockScenario } from "@/drydock/simulation/model";
import { drydockSimulationSourceChecksum } from "@/drydock/simulation/source";
import { runDrydockScenario } from "@/drydock/simulation/engine";

const block = (id: string, blockType: string, configuration: Record<string, unknown> = {}): PublishedBlock => ({
  id,
  blockType,
  title: id,
  configuration,
  chapterId: "chapter-a",
  orderIndex: 0,
  isEnabled: true,
  nextBlockId: null,
  connections: [],
});

const fixture = (): PublishedTaleSnapshot => {
  const start = {
    ...block("start", "narrative"),
    nextBlockId: "set",
    connections: [{ targetBlockId: "set", connectionType: "DEFAULT", orderIndex: 0 }],
  };
  const set = {
    ...block("set", "setVariable", { variable: "counter", operation: "increment", value: 1 }),
    nextBlockId: "condition",
    connections: [{ targetBlockId: "condition", connectionType: "DEFAULT", orderIndex: 0 }],
  };
  const condition = {
    ...block("condition", "condition", {
      variable: "counter",
      operator: "greaterThan",
      value: 0,
      successTargetBlockId: "choice",
      failureTargetBlockId: "finish",
    }),
    connections: [
      { targetBlockId: "choice", connectionType: "SUCCESS", orderIndex: 0 },
      { targetBlockId: "finish", connectionType: "FAILURE", orderIndex: 1 },
    ],
  };
  const choice = {
    ...block("choice", "choice"),
    connections: [{ targetBlockId: "reveal", connectionType: "CHOICE", orderIndex: 0 }],
  };
  const reveal = {
    ...block("reveal", "artifactReveal", { artifactId: "artifact-a" }),
    nextBlockId: "finish",
    connections: [{ targetBlockId: "finish", connectionType: "DEFAULT", orderIndex: 0 }],
  };
  const finish = block("finish", "taleComplete");
  return {
    schemaVersion: 1,
    tale: {
      id: "synthetic-tale",
      slug: "synthetic-tale",
      title: "Synthetic tale",
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
        id: "chapter-a",
        title: "Chapter",
        orderIndex: 0,
        entryBlockId: "start",
        completionBlockId: "finish",
        blocks: [start, set, condition, choice, reveal, finish],
      },
    ],
    assets: [],
    locations: [],
    artifacts: [],
    publishedAt: "2026-08-12T00:00:00.000Z",
  };
};

const scenarioFor = (snapshot: PublishedTaleSnapshot): DrydockScenario => ({
  schemaVersion: 1,
  id: "synthetic-full-family",
  revision: 1,
  sourceChecksum: drydockSimulationSourceChecksum(snapshot),
  title: "Synthetic deterministic sea trial",
  purpose: "Prove shared canonical transition semantics without live mutation.",
  seed: "sea-trial-seed",
  initialState: { variables: { counter: 0 }, inventory: [], actorMode: "CREATOR" },
  environment: {
    virtualStart: "2026-08-12T00:00:00.000Z",
    locale: "en-US",
    viewport: "NARROW",
    reducedMotion: true,
    soundEnabled: false,
    keyboardOnly: true,
  },
  limits: { maxSteps: 10, maxStates: 10, maxTraceEntries: 10, maxVirtualMilliseconds: 10_000 },
  inputs: [
    { kind: "CONTINUE" },
    { kind: "CHOICE", targetBlockId: "reveal" },
    { kind: "CONTINUE" },
    { kind: "CONTINUE" },
  ],
  faults: [],
  assertions: [
    { kind: "STATUS", status: "COMPLETED" },
    { kind: "CURRENT_BLOCK", blockId: "finish" },
    { kind: "EVENT_COUNT", eventType: "blockCompleted", count: 6 },
    { kind: "COVERED_BLOCK", blockId: "reveal" },
  ],
  tags: ["synthetic", "regression"],
});

describe("Drydock deterministic simulation", () => {
  it("replays a source-bound Scenario deterministically through canonical transition semantics", () => {
    const snapshot = fixture();
    const first = runDrydockScenario(snapshot, scenarioFor(snapshot));
    const replay = runDrydockScenario(snapshot, scenarioFor(snapshot));

    expect(first.status).toBe("COMPLETED");
    expect(first.traceDigest).toBe(replay.traceDigest);
    expect(first.coverage.blockIds).toEqual(["choice", "condition", "finish", "reveal", "set", "start"]);
    expect(first.assertions.every((assertion) => assertion.passed)).toBe(true);
    expect(JSON.stringify(first.trace)).not.toContain("counter");
  });

  it("returns an explicit incomplete proof when its declared step bound is exhausted", () => {
    const snapshot = fixture();
    const scenario = { ...scenarioFor(snapshot), limits: { ...scenarioFor(snapshot).limits, maxSteps: 2 } };

    expect(runDrydockScenario(snapshot, scenario).status).toBe("INCOMPLETE_PROOF");
  });

  it("cancels between safe inputs without changing the source snapshot", () => {
    const snapshot = fixture();
    const original = JSON.stringify(snapshot);
    let checks = 0;
    const result = runDrydockScenario(snapshot, scenarioFor(snapshot), { cancelled: () => ++checks === 2 });

    expect(result.status).toBe("CANCELLED");
    expect(JSON.stringify(snapshot)).toBe(original);
  });

  it("applies catalogued faults as explicit safe outcomes", () => {
    const snapshot = fixture();
    const scenario = {
      ...scenarioFor(snapshot),
      faults: [{ id: "asset-unavailable", family: "ASSET" as const, code: "UNAVAILABLE", beforeInput: 0 }],
    };

    const result = runDrydockScenario(snapshot, scenario);

    expect(result.status).toBe("COMPLETED");
    expect(result.coverage.eventTypes).toContain("assetUnavailable");
    expect(result.coverage.eventTypes).toContain("presentation:FALLBACK");
  });

  it("does not let an outcome token bypass the current One Voyage completion contract", () => {
    const snapshot = fixture();
    snapshot.chapters[0]!.blocks[0] = {
      ...snapshot.chapters[0]!.blocks[0]!,
      blockType: "textAnswer",
      completion: { mode: "textAnswer" },
      nextBlockId: "finish",
      connections: [{ targetBlockId: "finish", connectionType: "DEFAULT", orderIndex: 0 }],
    };
    const blocked = { ...scenarioFor(snapshot), inputs: [{ kind: "CONTINUE" as const }] };
    const accepted = {
      ...scenarioFor(snapshot),
      inputs: [{ kind: "TEXT_ANSWER" as const, outcome: "MATCH" as const }, { kind: "CONTINUE" as const }],
    };

    expect(runDrydockScenario(snapshot, blocked).status).toBe("ACTIVE");
    expect(runDrydockScenario(snapshot, blocked).coverage.eventTypes).toContain("inputRejected");
    expect(runDrydockScenario(snapshot, accepted).status).toBe("COMPLETED");
  });

  it("uses virtual time, not wall-clock time, for a timer completion", () => {
    const snapshot = fixture();
    snapshot.chapters[0]!.blocks[0] = {
      ...snapshot.chapters[0]!.blocks[0]!,
      blockType: "wait",
      configuration: { durationSeconds: 2 },
      completion: { mode: "timer" },
      nextBlockId: "finish",
      connections: [{ targetBlockId: "finish", connectionType: "DEFAULT", orderIndex: 0 }],
    };
    const tooSoon = { ...scenarioFor(snapshot), inputs: [{ kind: "ADVANCE_TIME" as const, milliseconds: 1_999 }] };
    const elapsed = {
      ...scenarioFor(snapshot),
      inputs: [{ kind: "ADVANCE_TIME" as const, milliseconds: 2_000 }, { kind: "CONTINUE" as const }],
    };

    expect(runDrydockScenario(snapshot, tooSoon).status).toBe("ACTIVE");
    expect(runDrydockScenario(snapshot, elapsed).status).toBe("COMPLETED");
  });
});
