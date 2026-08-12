import { describe, expect, it } from "vitest";
import fixture from "../../tests/fixtures/drydock/current-authoring-v1.json";
import { previewDrydockMigration } from "@/drydock/migration-preview";

describe("Drydock migration preview", () => {
  it("reports canonical structural changes without echoing authored values", () => {
    const source = structuredClone(fixture.blocks.find((block) => block.blockType === "condition"));
    const preview = previewDrydockMigration(source!);

    expect(preview).toMatchObject({
      sourceVersion: 1,
      targetVersion: 2,
      migrationIds: ["drydock.condition.v1-to-v2"],
      dataLoss: ["NONE"],
      canonicalOutputChanges: ["CANONICAL_OUTPUT_CHANGES"],
    });
    expect(preview?.affectedFields).toEqual(expect.arrayContaining(["configuration.expression", "schemaVersion"]));
    expect(JSON.stringify(preview?.affectedFields)).not.toContain("synthetic");
  });
});
