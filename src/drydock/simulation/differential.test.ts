import { describe, expect, it } from "vitest";
import { blockTypeIds } from "@/chronicle/block-registry";
import { planCanonicalCompletion, type CanonicalRuntimeState } from "@/chronicle/runtime-semantics";
import type { PublishedBlock, PublishedTaleSnapshot } from "@/chronicle/types";
import { getDrydockBlockContract } from "@/drydock/contracts/registry";
import { runDrydockScenario } from "@/drydock/simulation/engine";
import type { DrydockScenario, DrydockScenarioInput } from "@/drydock/simulation/model";
import { drydockSimulationSourceChecksum } from "@/drydock/simulation/source";

const finish = (): PublishedBlock => ({
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
});

function sourceFor(blockType: string): PublishedTaleSnapshot {
  const contract = getDrydockBlockContract(blockType)!;
  const configuration = structuredClone(contract.defaultConfiguration);
  const block: PublishedBlock = {
    id: "start",
    chapterId: "chapter",
    blockType,
    title: blockType,
    configuration,
    presentation: {},
    completion: structuredClone(contract.defaultCompletion),
    isEnabled: true,
    schemaVersion: contract.currentVersion,
    orderIndex: 0,
    nextBlockId: blockType === "taleComplete" ? null : "finish",
    connections: blockType === "taleComplete" ? [] : [{ targetBlockId: "finish", connectionType: blockType === "choice" ? "CHOICE" : "DEFAULT", orderIndex: 0 }],
  };
  if (blockType === "choice") {
    block.configuration.choices = [{ id: "choice", label: "Finish", targetBlockId: "finish" }];
    block.connections = [{ targetBlockId: "finish", connectionType: "CHOICE", orderIndex: 0 }];
  }
  if (blockType === "condition") {
    block.configuration.successTargetBlockId = "finish";
    block.configuration.failureTargetBlockId = "finish";
    block.connections = [
      { targetBlockId: "finish", connectionType: "SUCCESS", orderIndex: 0 },
      { targetBlockId: "finish", connectionType: "FAILURE", orderIndex: 1 },
    ];
  }
  return {
    schemaVersion: 1,
    tale: { id: "synthetic", slug: "synthetic", title: "Synthetic", subtitle: null, shortDescription: null, longDescription: null, coverAssetId: null, theme: "default", visibility: "PRIVATE", playerCountMin: 1, playerCountMax: 1, estimatedDuration: null, contentWarnings: null },
    chapters: [{ id: "chapter", title: "Synthetic", orderIndex: 0, entryBlockId: "start", completionBlockId: "finish", blocks: blockType === "taleComplete" ? [block] : [block, finish()] }],
    assets: [], locations: [], artifacts: [], publishedAt: "2026-08-12T00:00:00.000Z",
  };
}

function inputFor(blockType: string): DrydockScenarioInput {
  if (blockType === "choice") return { kind: "CHOICE", targetBlockId: "finish" };
  if (["riddle", "textAnswer"].includes(blockType)) return { kind: "TEXT_ANSWER", outcome: "MATCH" };
  if (["arrivalCheck", "captainApproval"].includes(blockType)) return { kind: "CAPTAIN", outcome: "APPROVE" };
  if (blockType === "wait") return { kind: "ADVANCE_TIME", milliseconds: 5_000 };
  return { kind: "CONTINUE" };
}

function scenarioFor(snapshot: PublishedTaleSnapshot, blockType: string): DrydockScenario {
  const input = inputFor(blockType);
  return {
    schemaVersion: 1,
    id: `all-types-${blockType}`,
    revision: 1,
    sourceChecksum: drydockSimulationSourceChecksum(snapshot),
    title: `Synthetic ${blockType}`,
    purpose: "Differentially compare the shared One Voyage transition plan.",
    seed: "all-current-block-types",
    initialState: { variables: {}, inventory: [], actorMode: "CREATOR" },
    environment: { virtualStart: "2026-08-12T00:00:00.000Z", locale: "en-US", viewport: "DESKTOP", reducedMotion: true, soundEnabled: false, keyboardOnly: true },
    limits: { maxSteps: 2, maxStates: 10, maxTraceEntries: 10, maxVirtualMilliseconds: 10_000 },
    inputs: [input], faults: [], assertions: [], tags: ["synthetic", "differential"],
  };
}

describe("Drydock One Voyage transition differential", () => {
  it("uses the canonical production planner for every current Passage type", () => {
    expect(blockTypeIds).toHaveLength(23);
    for (const blockType of blockTypeIds) {
      const snapshot = sourceFor(blockType);
      const scenario = scenarioFor(snapshot, blockType);
      const prior: CanonicalRuntimeState = { currentBlockId: "start", variables: {}, inventory: [], status: "ACTIVE" };
      const plan = planCanonicalCompletion(snapshot, prior, {
        selectedTargetId: scenario.inputs[0]?.kind === "CHOICE" ? scenario.inputs[0].targetBlockId : undefined,
      });
      const result = runDrydockScenario(snapshot, scenario);
      const trace = result.trace.at(-1)!;

      expect(trace.blockId, blockType).toBe(plan.state.currentBlockId);
      expect(trace.intentTypes, blockType).toEqual(plan.intents.map((intent) => intent.eventType));
      expect(trace.status, blockType).toBe(plan.state.status);
    }
  });
});
