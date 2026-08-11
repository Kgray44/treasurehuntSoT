import { describe, expect, it } from "vitest";
import type { CanonicalDrydockBlock } from "@/drydock/contracts/model";
import { analyzeDrydockGraph } from "@/drydock/graph";
import { analyzeDrydockPerformance } from "@/drydock/performance";
import type { DrydockVariableDeclaration } from "@/drydock/variables";

const block = (id: string, targets: string[] = []): CanonicalDrydockBlock => ({
  id,
  blockType: "narrative",
  schemaVersion: 2,
  configuration: {},
  presentation: {},
  completion: {},
  connections: targets.map((targetBlockId, orderIndex) => ({ targetBlockId, connectionType: "DEFAULT", orderIndex })),
  nextBlockId: targets[0] ?? null,
});
const declaration = (id: string): DrydockVariableDeclaration => ({
  schemaVersion: 1,
  id,
  name: id,
  type: { kind: "BOOLEAN" },
  scope: "SESSION",
  allowedOperations: ["assign", "toggle"],
  privacy: "PLAYER_SAFE",
});

describe("Drydock bounded static performance analysis", () => {
  it("warns about high fan-out and variable catalog growth before hard limits", () => {
    const blocks = [
      block(
        "entry",
        Array.from({ length: 12 }, (_, index) => `target-${index}`),
      ),
      ...Array.from({ length: 12 }, (_, index) => block(`target-${index}`)),
    ];
    const issues = analyzeDrydockPerformance({
      blocks,
      graphAnalysis: analyzeDrydockGraph(blocks),
      declarations: Array.from({ length: 64 }, (_, index) => declaration(`var-${index}`)),
    });
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["DRYDOCK_PERFORMANCE_FAN_OUT_HIGH", "DRYDOCK_PERFORMANCE_VARIABLE_COUNT_HIGH"]),
    );
  });
});
