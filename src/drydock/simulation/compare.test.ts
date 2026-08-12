import { describe, expect, it } from "vitest";
import { compareDrydockReceipts, diffDrydockTraceStates } from "@/drydock/simulation/compare";
import type { DrydockSimulationTraceEntry } from "@/drydock/simulation/engine";

const trace = (ordinal: number, overrides: Partial<DrydockSimulationTraceEntry> = {}): DrydockSimulationTraceEntry => ({
  ordinal,
  virtualAt: "2026-08-12T00:00:00.000Z",
  blockId: ordinal === 1 ? "start" : "finish",
  inputKind: "CONTINUE",
  intentTypes: ordinal === 1 ? ["blockCompleted"] : ["sessionCompleted"],
  faultIds: [],
  status: ordinal === 1 ? "ACTIVE" : "COMPLETED",
  stateDigest: `state-${ordinal}`,
  ...overrides,
});

describe("Drydock receipt comparison and State Diff", () => {
  it("reports the exact first semantic divergence without treating different sources as equivalent", () => {
    const left = {
      summary: { runId: "left", sourceChecksum: "a".repeat(64), status: "COMPLETED" },
      result: {
        runtimeAdapterVersion: "one-voyage-transition-v1",
        traceDigest: "left",
        coverage: { blockIds: ["start"], edgeIds: [], faultIds: [] },
        assertions: [],
      },
      trace: [trace(1)],
    };
    const right = {
      ...left,
      summary: { ...left.summary, runId: "right", sourceChecksum: "b".repeat(64) },
      trace: [trace(1, { intentTypes: ["eventOrderChanged"] })],
    };

    expect(compareDrydockReceipts(left, right)).toMatchObject({
      compatible: false,
      source: { same: false },
      trace: { firstDivergence: { ordinal: 1, kind: "TRACE_MISMATCH" } },
    });
  });

  it("returns a redacted before/after state model for keyboard and table views", () => {
    const diff = diffDrydockTraceStates([trace(1), trace(2)], 1, 2);

    expect(diff.changed).toEqual(
      expect.arrayContaining(["currentPassage", "completionState", "canonicalState", "eventIntents"]),
    );
    expect(JSON.stringify(diff)).not.toContain("private");
  });
});
