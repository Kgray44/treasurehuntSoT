import { describe, expect, it } from "vitest";
import type { DraftState } from "@/components/studio/studio-types";
import {
  applyReusableInsertion,
  assertReusableCaptureSafe,
  checksumReusableEnvelope,
  parseReusableEnvelope,
  planReusableInsertion,
  resolveReusableParameters,
  type ReusableContentEnvelope,
} from "@/studio/reusable-content";

const baseDraft: DraftState = {
  tale: {
    id: "tale-0001",
    slug: "test-tale",
    title: "Test",
    subtitle: null,
    shortDescription: null,
    longDescription: null,
    coverAssetId: null,
    theme: "CARTOGRAPHERS_TABLE",
    visibility: "PRIVATE",
    playerCountMin: 1,
    playerCountMax: 4,
    estimatedDuration: null,
    contentWarnings: null,
    latestPublishedVersionId: null,
  },
  chapters: [
    {
      id: "chapter-0001",
      title: "First",
      isOptional: false,
      metadata: {},
      blocks: [
        {
          id: "block-0001",
          blockType: "narrative",
          title: "Existing",
          configuration: {},
          presentation: {},
          completion: {},
          isEnabled: true,
          schemaVersion: 2,
        },
      ],
    },
  ],
};

function envelope(): ReusableContentEnvelope {
  const unsigned = {
    envelopeType: "voyagewright.reusable-authoring" as const,
    envelopeVersion: 1 as const,
    itemId: "item-0001",
    versionId: "version-0001",
    kind: "FRAGMENT" as const,
    name: "A choice",
    description: "A safe fragment",
    tags: ["choice"],
    ownerId: "creator-1",
    blocks: [
      {
        id: "block-source-1",
        blockType: "choice",
        title: "Choose",
        configuration: { variableId: "var-source-1", successTargetBlockId: "block-source-2" },
        presentation: {},
        completion: {},
        isEnabled: true,
        schemaVersion: 2,
        connections: [{ targetBlockId: "block-source-2", connectionType: "CHOICE" }],
      },
      {
        id: "block-source-2",
        blockType: "narrative",
        title: "Result",
        configuration: {},
        presentation: {},
        completion: {},
        isEnabled: true,
        schemaVersion: 2,
      },
    ],
    chapters: [],
    entryPorts: [],
    exitPorts: [],
    parameters: [],
    dependencies: { assetIds: [], artifactIds: [], locationIds: [], providerIds: [] },
    accessibilityObligations: ["Provide a descriptive choice label."],
    attribution: { sourceOwnerId: "creator-1", modified: false },
    lineage: [],
    compatibility: { minimumReaderVersion: 1, blockContractVersions: { choice: 2, narrative: 2 } },
  };
  return { ...unsigned, checksum: checksumReusableEnvelope(unsigned) };
}

describe("reusable authoring insertion", () => {
  it("resolves declared parameters only into bounded canonical destinations", () => {
    const base = envelope();
    base.blocks[1].configuration.body = "Original opening.";
    const parameterized = {
      ...base,
      parameters: [
        {
          key: "opening_text",
          label: "Opening text",
          type: "TEXT" as const,
          required: true,
          helpText: "Player-facing opening.",
          destinationPath: "blocks.block-source-2.configuration.body",
        },
      ],
    };
    const signed = { ...parameterized, checksum: checksumReusableEnvelope(parameterized) };
    expect(resolveReusableParameters(signed, { opening_text: "A calm harbor." }).blocks[1].configuration.body).toBe(
      "A calm harbor.",
    );
    expect(() => resolveReusableParameters(signed)).toThrow(/required/i);
    expect(() =>
      resolveReusableParameters(
        { ...signed, parameters: [{ ...signed.parameters[0], destinationPath: "tale.visibility" }] },
        { opening_text: "A calm harbor." },
      ),
    ).toThrow(/destinations/i);
    expect(() =>
      resolveReusableParameters(
        {
          ...signed,
          parameters: [{ ...signed.parameters[0], destinationPath: "blocks.block-source-2.configuration.newField" }],
        },
        { opening_text: "A calm harbor." },
      ),
    ).toThrow(/existing canonical field/i);
    expect(() =>
      resolveReusableParameters(
        {
          ...signed,
          parameters: [signed.parameters[0], { ...signed.parameters[0], label: "Duplicate key" }],
        },
        { opening_text: "A calm harbor." },
      ),
    ).toThrow(/unique/i);
  });
  it("fails closed when a reusable capture contains protected source material", () => {
    expect(() =>
      assertReusableCaptureSafe([{ ...envelope().blocks[0], configuration: { privacy: "CREATOR_PRIVATE" } }]),
    ).toThrow(/private variable/i);
    expect(() =>
      assertReusableCaptureSafe([
        {
          ...envelope().blocks[0],
          configuration: { body: "SEALED-HOLD-SYNTHETIC-PRIVATE-SENTINEL-73A9C1" },
        },
      ]),
    ).toThrow(/Sealed Hold/i);
  });
  it("rejects envelopes whose content changes after checksum creation", () => {
    const changed = { ...envelope(), name: "Changed" };
    expect(() => parseReusableEnvelope(changed)).toThrow("checksum");
  });

  it("allocates collision-safe deterministic identities and remaps known references", () => {
    const plan = planReusableInsertion({ envelope: envelope(), draft: baseDraft, operationId: "operation-0001" });
    const inserted = plan.chapters[0].blocks.slice(-2);
    expect(inserted.map((block) => block.id)).toEqual([
      "operation-0001-block-block-source-1",
      "operation-0001-block-block-source-2",
    ]);
    expect(inserted[0].configuration.variableId).toBe("operation-0001-variable-var-source-1");
    expect(inserted[0].configuration.successTargetBlockId).toBe("operation-0001-block-block-source-2");
    expect(inserted[0].connections?.[0].targetBlockId).toBe("operation-0001-block-block-source-2");
  });

  it("applies the entire plan in one immutable draft result", () => {
    const plan = planReusableInsertion({ envelope: envelope(), draft: baseDraft, operationId: "operation-0002" });
    const next = applyReusableInsertion(baseDraft, plan);
    expect(baseDraft.chapters[0].blocks).toHaveLength(1);
    expect(next.chapters[0].blocks).toHaveLength(3);
    expect(plan.warnings).toEqual(["Review 1 inherited accessibility obligation(s) before publication."]);
  });

  it("keeps a 100-plus Passage multi-Chapter composition collision-safe and undoable", () => {
    const largeDraft: DraftState = {
      ...baseDraft,
      chapters: Array.from({ length: 5 }, (_, chapterIndex) => ({
        id: `chapter-large-${chapterIndex}`,
        title: `Chapter ${chapterIndex + 1}`,
        isOptional: false,
        metadata: {},
        blocks: Array.from({ length: 20 }, (_, blockIndex) => ({
          id: `large-${chapterIndex}-${blockIndex}`,
          blockType: "narrative",
          title: `Passage ${chapterIndex * 20 + blockIndex + 1}`,
          configuration: {},
          presentation: {},
          completion: {},
          isEnabled: true,
          schemaVersion: 1,
        })),
      })),
    };
    const plan = planReusableInsertion({
      envelope: envelope(),
      draft: largeDraft,
      operationId: "operation-large-0001",
      targetChapterId: "chapter-large-3",
    });
    const applied = applyReusableInsertion(largeDraft, plan);
    expect(largeDraft.chapters[3].blocks).toHaveLength(20);
    expect(applied.chapters[3].blocks).toHaveLength(22);
    expect(new Set(applied.chapters.flatMap((chapter) => chapter.blocks.map((block) => block.id))).size).toBe(102);
    expect(applied.chapters[3].blocks.at(-2)?.connections?.[0]?.targetBlockId).toBe(
      "operation-large-0001-block-block-source-2",
    );
  });
});
