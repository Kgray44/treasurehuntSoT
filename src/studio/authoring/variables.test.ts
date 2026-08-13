import { describe, expect, it } from "vitest";
import type { Chapter } from "@/components/studio/studio-types";
import { renameStudioDraftVariable } from "@/studio/authoring/variables";

const declaration = {
  id: "var-lantern",
  name: "lanternFound",
  type: { kind: "BOOLEAN" as const },
  scope: "SESSION" as const,
  defaultValue: false,
  description: "Whether the crew found the lantern.",
  allowedOperations: ["assign", "toggle"] as const,
  privacy: "PLAYER_SAFE" as const,
};

const chapters: Chapter[] = [
  {
    id: "chapter-1",
    title: "Harbor",
    isOptional: false,
    metadata: {},
    blocks: [
      {
        id: "set-lantern",
        blockType: "setVariable",
        title: "Set lantern",
        configuration: {
          variableId: "var-lantern",
          variableName: "lanternFound",
          variable: "lanternFound",
          prose: "The prose lanternFound must not change.",
        },
        presentation: {},
        completion: {},
        isEnabled: true,
        schemaVersion: 2,
      },
      {
        id: "check-lantern",
        blockType: "condition",
        title: "Check lantern",
        configuration: { variable: "lanternFound", expression: { kind: "variable", variableId: "var-lantern" } },
        presentation: {},
        completion: {},
        isEnabled: true,
        schemaVersion: 2,
      },
    ],
  },
];

describe("Shipwright variable rename", () => {
  it("uses the canonical Drydock propagation while preserving IDs, expressions, and prose", () => {
    const renamed = renameStudioDraftVariable({
      chapters,
      declarations: [declaration],
      variableId: "var-lantern",
      nextName: "beaconFound",
    });

    expect(renamed[0].blocks[0].configuration).toMatchObject({
      variableId: "var-lantern",
      variableName: "beaconFound",
      variable: "beaconFound",
      prose: "The prose lanternFound must not change.",
    });
    expect(renamed[0].blocks[1].configuration).toMatchObject({
      variable: "beaconFound",
      expression: { kind: "variable", variableId: "var-lantern" },
    });
    expect(chapters[0].blocks[0].configuration.variableName).toBe("lanternFound");
  });
});
