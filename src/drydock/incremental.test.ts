import { describe, expect, it } from "vitest";
import fixture from "../../tests/fixtures/drydock/current-authoring-v1.json";
import { canonicalJson, DrydockCanonicalizationError } from "@/drydock/canonical";
import { validateDrydockDraftContracts } from "@/drydock/incremental";
import { createDrydockIssue, privacySafeMetadata, sanitizedIssueProjection } from "@/drydock/issues";

const draft = {
  schemaVersion: 1 as const,
  chapters: [{ id: "fixture-chapter", blocks: fixture.blocks }],
};

describe("Drydock validation foundation", () => {
  it("validates the complete current synthetic fixture and indexes dependencies", () => {
    const result = validateDrydockDraftContracts(draft);
    expect(result.valid).toBe(true);
    expect(result.checkedBlockCount).toBe(23);
    expect(result.blocks).toHaveLength(23);
    expect(result.variableRegistry.declarations).toHaveLength(1);
    expect(result.variableUsageIndex.usages.some((usage) => usage.kind === "EXPRESSION")).toBe(true);
    expect(result.dependencyIndex.records.some((record) => record.kind === "PROVIDER")).toBe(true);
  });

  it("rechecks only directly affected blocks", () => {
    const result = validateDrydockDraftContracts(draft, { blockIds: ["drydock-fixture-image-v1"] });
    expect(result.checkedBlockCount).toBe(1);
    expect(result.blocks.map((block) => block.id)).toEqual(["drydock-fixture-image-v1"]);
  });

  it("keeps issue identity stable across copy changes and strips private metadata", () => {
    const base = {
      code: "DRYDOCK_TEST",
      category: "SCHEMA" as const,
      severity: "ERROR" as const,
      ruleVersion: 1,
      location: { blockId: "block-1", fieldPath: "configuration.heading" },
      remediation: "Correct it.",
    };
    const first = createDrydockIssue({ ...base, message: "First wording." });
    const second = createDrydockIssue({ ...base, message: "Second wording." });
    expect(first.id).toBe(second.id);
    expect(
      privacySafeMetadata({ blockCount: 3, answerKey: "secret", captainNotes: "private", state: "CURRENT" }),
    ).toEqual({
      blockCount: 3,
      state: "CURRENT",
    });
    expect(sanitizedIssueProjection({ ...first, technicalDetail: "private detail" })).not.toHaveProperty(
      "technicalDetail",
    );
    expect(
      createDrydockIssue({ ...base, message: "Safe.", metadata: { answerKey: "never-log", count: 1 } }).metadata,
    ).toEqual({ count: 1 });
  });

  it("rejects duplicate and out-of-Chronicle Passage references", () => {
    const broken = structuredClone(draft);
    broken.chapters[0].blocks[0].connections[0].targetBlockId = "foreign-chronicle-block";
    broken.chapters[0].blocks[0].nextBlockId = "foreign-chronicle-block";
    const result = validateDrydockDraftContracts(broken);
    expect(result.issues.map((issue) => issue.code)).toContain("DRYDOCK_REFERENCE_TARGET_MISSING");
    broken.chapters[0].blocks[1].id = broken.chapters[0].blocks[0].id;
    expect(validateDrydockDraftContracts(broken).issues.map((issue) => issue.code)).toContain(
      "DRYDOCK_BLOCK_ID_DUPLICATE",
    );
  });

  it("rejects non-finite, executable, and oversized canonical values", () => {
    expect(() => canonicalJson({ value: Number.POSITIVE_INFINITY })).toThrow(DrydockCanonicalizationError);
    expect(() => canonicalJson({ value: () => true })).toThrow(DrydockCanonicalizationError);
    expect(() => canonicalJson({ prose: "x".repeat(33 * 1024) })).toThrow("Canonical authored content exceeds");
  });

  it("validates a 230-block contract sample within the local unit budget", () => {
    const sample = {
      schemaVersion: 1 as const,
      chapters: Array.from({ length: 10 }, (_, chapterIndex) => ({
        id: `chapter-${chapterIndex}`,
        blocks: fixture.blocks.map((block) => {
          const clone = structuredClone(block);
          const remap = (id: string) => `${id}-${chapterIndex}`;
          clone.id = remap(clone.id);
          clone.nextBlockId = clone.nextBlockId ? remap(clone.nextBlockId) : null;
          clone.connections = clone.connections.map((connection) => ({
            ...connection,
            targetBlockId: remap(connection.targetBlockId),
          }));
          if (clone.blockType === "choice") {
            const choices = clone.configuration.choices as Array<{ id: string; label: string; targetBlockId: string }>;
            clone.configuration.choices = choices.map((choice) => ({
              ...choice,
              targetBlockId: remap(choice.targetBlockId),
            }));
          }
          if (clone.blockType === "condition") {
            clone.configuration.successTargetBlockId = remap(String(clone.configuration.successTargetBlockId));
            clone.configuration.failureTargetBlockId = remap(String(clone.configuration.failureTargetBlockId));
          }
          return clone;
        }),
      })),
    };
    const started = performance.now();
    const result = validateDrydockDraftContracts(sample);
    expect(result.valid).toBe(true);
    expect(result.checkedBlockCount).toBe(230);
    expect(performance.now() - started).toBeLessThan(3000);
  });
});
