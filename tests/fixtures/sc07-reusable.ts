import { randomUUID } from "node:crypto";
import { checksumReusableEnvelope, type ReusableContentEnvelope } from "../../src/studio/reusable-content";

export function createReusableFixtureEnvelope(
  ownerId: string,
  kind: "PRESET" | "CHAPTER_TEMPLATE",
  heading = "Welcome",
) {
  const blockId = randomUUID();
  const chapterId = randomUUID();
  const terminalId = randomUUID();
  const isChapter = kind === "CHAPTER_TEMPLATE";
  const blocks: ReusableContentEnvelope["blocks"] = [
    {
      id: blockId,
      blockType: "narrative",
      title: "Welcome",
      configuration: { heading, body: "Welcome to the fictional harbor." },
      presentation: {},
      completion: { mode: "playerConfirmation" },
      isEnabled: true,
      schemaVersion: 2,
      ...(isChapter && { connections: [{ targetBlockId: terminalId, connectionType: "DEFAULT", orderIndex: 0 }] }),
    },
  ];
  if (isChapter)
    blocks.push({
      id: terminalId,
      blockType: "taleComplete",
      title: "Voyage Complete",
      configuration: {
        finaleHeading: "Harbor reached",
        finaleContent: "The fictional voyage ends here.",
        replayAvailable: true,
      },
      presentation: {},
      completion: { mode: "playerConfirmation" },
      isEnabled: true,
      schemaVersion: 2,
    });
  const unsigned = {
    envelopeType: "voyagewright.reusable-authoring" as const,
    envelopeVersion: 1 as const,
    itemId: randomUUID(),
    versionId: randomUUID(),
    kind,
    name: kind === "PRESET" ? "Harbor welcome" : "Harbor opening",
    description: "A fictional introduction for another Creator.",
    tags: ["intro"],
    ownerId,
    blocks,
    chapters: isChapter
      ? [{ id: chapterId, title: "Opening", isOptional: false, metadata: {}, blockIds: [blockId, terminalId] }]
      : [],
    entryPorts: [],
    exitPorts: [],
    parameters: [],
    dependencies: { assetIds: [], artifactIds: [], locationIds: [], providerIds: [] },
    accessibilityObligations: [],
    attribution: { sourceOwnerId: ownerId, modified: false },
    lineage: [],
    compatibility: {
      minimumReaderVersion: 1,
      blockContractVersions: { narrative: 2, ...(isChapter ? { taleComplete: 2 } : {}) },
    },
  };
  return { ...unsigned, checksum: checksumReusableEnvelope(unsigned) } satisfies ReusableContentEnvelope;
}
