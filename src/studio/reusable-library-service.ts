import { db } from "@/lib/db";
import { randomUUID } from "node:crypto";
import {
  assertReusableCaptureSafe,
  checksumReusableEnvelope,
  planReusableInsertion,
  parseReusableEnvelope,
  type InsertionPlan,
  type ReusableContentEnvelope,
} from "@/studio/reusable-content";
import type { Block, DraftState } from "@/components/studio/studio-types";
import { parseJsonObject } from "@/chronicle/types";

function parseJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((entry) => typeof entry === "string") ? parsed : [];
  } catch {
    return [];
  }
}

export async function listReusableAuthoringItems(ownerAccountId: string) {
  const items = await db.reusableAuthoringItem.findMany({
    where: { ownerAccountId, archivedAt: null },
    orderBy: [{ updatedAt: "desc" }],
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 }, _count: { select: { usages: true } } },
  });
  return items.map((item) => ({
    id: item.id,
    kind: item.kind,
    name: item.name,
    description: item.description,
    tags: parseJsonArray(item.tags),
    status: item.status,
    currentVersionNumber: item.currentVersionNumber,
    currentVersionId: item.versions[0]?.id ?? null,
    checksum: item.versions[0]?.checksum ?? null,
    usageCount: item._count.usages,
    updatedAt: item.updatedAt.toISOString(),
  }));
}

export async function getReusableAuthoringItemVersion(ownerAccountId: string, itemId: string) {
  const item = await db.reusableAuthoringItem.findFirst({
    where: { id: itemId, ownerAccountId, archivedAt: null },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });
  const version = item?.versions[0];
  if (!item || !version) throw new Error("That reusable item is not available to this Creator.");
  const envelope = parseReusableEnvelope(JSON.parse(version.envelope));
  if (envelope.itemId !== item.id || envelope.versionId !== version.id || envelope.ownerId !== ownerAccountId)
    throw new Error("The reusable item version does not match its owner-scoped Library record.");
  return { itemId: item.id, versionId: version.id, versionNumber: version.versionNumber, envelope };
}

export async function planReusableAuthoringInsertion(input: {
  ownerAccountId: string;
  itemId: string;
  operationId: string;
  targetChapterId?: string;
  draft: DraftState;
}): Promise<InsertionPlan> {
  if (
    !input.draft ||
    !Array.isArray(input.draft.chapters) ||
    !input.draft.chapters.every((chapter) => typeof chapter?.id === "string")
  )
    throw new Error("The destination Chronicle draft is invalid for reusable-content planning.");
  const { envelope } = await getReusableAuthoringItemVersion(input.ownerAccountId, input.itemId);
  const plan = planReusableInsertion({
    envelope,
    draft: input.draft,
    operationId: input.operationId,
    targetChapterId: input.targetChapterId,
  });
  const portWarnings = [
    ...envelope.entryPorts.map((port) => `Connect the imported entry port: ${port.label}.`),
    ...envelope.exitPorts.map((port) => `Connect the imported exit port: ${port.label}.`),
  ];
  return { ...plan, warnings: [...plan.warnings, ...portWarnings] };
}

export async function createReusableAuthoringItem(ownerAccountId: string, rawEnvelope: unknown) {
  const envelope = parseReusableEnvelope(rawEnvelope);
  if (envelope.ownerId !== ownerAccountId || envelope.attribution.sourceOwnerId !== ownerAccountId)
    throw new Error("Reusable content ownership must be derived from the authenticated Creator.");
  return db.$transaction(async (tx) => {
    const item = await tx.reusableAuthoringItem.create({
      data: {
        id: envelope.itemId,
        ownerAccountId,
        kind: envelope.kind,
        name: envelope.name,
        description: envelope.description,
        tags: JSON.stringify(envelope.tags),
        currentVersionNumber: 1,
      },
    });
    const version = await tx.reusableAuthoringItemVersion.create({
      data: {
        id: envelope.versionId,
        itemId: item.id,
        versionNumber: 1,
        envelope: JSON.stringify(envelope),
        checksum: envelope.checksum,
      },
    });
    return { itemId: item.id, versionId: version.id, versionNumber: version.versionNumber };
  });
}

function collectDependencyIds(
  value: unknown,
  dependencies: { assetIds: Set<string>; artifactIds: Set<string>; locationIds: Set<string>; providerIds: Set<string> },
  key = "",
) {
  if (typeof value === "string") {
    const target = key.toLocaleLowerCase();
    if (target.endsWith("assetid")) dependencies.assetIds.add(value);
    if (target.endsWith("artifactid")) dependencies.artifactIds.add(value);
    if (target.endsWith("locationid")) dependencies.locationIds.add(value);
    if (target.endsWith("providerid")) dependencies.providerIds.add(value);
    return;
  }
  if (Array.isArray(value)) return value.forEach((entry) => collectDependencyIds(entry, dependencies, key));
  if (value && typeof value === "object")
    Object.entries(value).forEach(([childKey, childValue]) => collectDependencyIds(childValue, dependencies, childKey));
}

export async function createBlockPreset(
  ownerAccountId: string,
  taleId: string,
  input: { name: string; description?: string; tags?: string[]; blockId: string },
) {
  const source = await db.chronicle.findFirst({
    where: { id: taleId },
    select: {
      creatorAccountId: true,
      creatorId: true,
      currentDraftRevisionId: true,
    },
  });
  if (!source?.currentDraftRevisionId)
    throw new Error("This Chronicle does not have a current draft to save as a preset.");
  const sourceBlock = await db.storyBlock.findFirst({
    where: { id: input.blockId, chapter: { draft: { id: source.currentDraftRevisionId, taleId } } },
    select: {
      id: true,
      blockType: true,
      title: true,
      internalLabel: true,
      configuration: true,
      presentation: true,
      completion: true,
      isEnabled: true,
      schemaVersion: true,
    },
  });
  if (!sourceBlock) throw new Error("The selected Passage is not available in this Chronicle's saved draft.");

  const itemId = randomUUID();
  const versionId = randomUUID();
  const block: Block = {
    id: sourceBlock.id,
    blockType: sourceBlock.blockType,
    title: sourceBlock.title,
    internalLabel: sourceBlock.internalLabel,
    configuration: parseJsonObject(sourceBlock.configuration),
    presentation: parseJsonObject(sourceBlock.presentation),
    completion: parseJsonObject(sourceBlock.completion),
    isEnabled: sourceBlock.isEnabled,
    schemaVersion: sourceBlock.schemaVersion,
  };
  const collected = {
    assetIds: new Set<string>(),
    artifactIds: new Set<string>(),
    locationIds: new Set<string>(),
    providerIds: new Set<string>(),
  };
  assertReusableCaptureSafe([block]);
  collectDependencyIds(block.configuration, collected);
  collectDependencyIds(block.presentation, collected);
  collectDependencyIds(block.completion, collected);
  const unsigned = {
    envelopeType: "voyagewright.reusable-authoring" as const,
    envelopeVersion: 1 as const,
    itemId,
    versionId,
    kind: "PRESET" as const,
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    tags: (input.tags ?? [])
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 30),
    ownerId: ownerAccountId,
    blocks: [block],
    chapters: [],
    entryPorts: [],
    exitPorts: [],
    parameters: [],
    dependencies: {
      assetIds: [...collected.assetIds].sort(),
      artifactIds: [...collected.artifactIds].sort(),
      locationIds: [...collected.locationIds].sort(),
      providerIds: [...collected.providerIds].sort(),
    },
    accessibilityObligations: [],
    attribution: { sourceOwnerId: source.creatorAccountId ?? source.creatorId, modified: false },
    lineage: [],
    compatibility: { minimumReaderVersion: 1, blockContractVersions: { [block.blockType]: block.schemaVersion } },
  };
  const envelope: ReusableContentEnvelope = { ...unsigned, checksum: checksumReusableEnvelope(unsigned) };
  return createReusableAuthoringItem(ownerAccountId, envelope);
}

export async function createBlockFragment(
  ownerAccountId: string,
  taleId: string,
  input: { name: string; description?: string; tags?: string[]; blockIds: string[] },
) {
  const source = await db.chronicle.findFirst({
    where: { id: taleId },
    select: { creatorAccountId: true, creatorId: true, currentDraftRevisionId: true },
  });
  if (!source?.currentDraftRevisionId)
    throw new Error("This Chronicle does not have a current draft to save as a reusable fragment.");
  const selectedIds = [...new Set(input.blockIds)];
  const selected = new Set(selectedIds);
  const sourceBlocks = await db.storyBlock.findMany({
    where: { id: { in: selectedIds }, chapter: { draft: { id: source.currentDraftRevisionId, taleId } } },
    orderBy: [{ chapter: { orderIndex: "asc" } }, { orderIndex: "asc" }],
    include: {
      chapter: { select: { orderIndex: true } },
      outgoing: { orderBy: { orderIndex: "asc" } },
      incoming: { orderBy: { orderIndex: "asc" } },
    },
  });
  if (sourceBlocks.length !== selectedIds.length)
    throw new Error("Every Passage in a reusable fragment must belong to this Chronicle's saved draft.");

  const blocks: Block[] = sourceBlocks.map((sourceBlock) => ({
    id: sourceBlock.id,
    blockType: sourceBlock.blockType,
    title: sourceBlock.title,
    internalLabel: sourceBlock.internalLabel,
    configuration: parseJsonObject(sourceBlock.configuration),
    presentation: parseJsonObject(sourceBlock.presentation),
    completion: parseJsonObject(sourceBlock.completion),
    isEnabled: sourceBlock.isEnabled,
    schemaVersion: sourceBlock.schemaVersion,
    nextBlockId: sourceBlock.nextBlockId && selected.has(sourceBlock.nextBlockId) ? sourceBlock.nextBlockId : null,
    connections: sourceBlock.outgoing
      .filter((connection) => selected.has(connection.targetBlockId))
      .map((connection) => ({
        targetBlockId: connection.targetBlockId,
        connectionType: connection.connectionType,
        label: connection.label,
        conditionExpression: connection.conditionExpression,
        orderIndex: connection.orderIndex,
      })),
  }));
  const collected = {
    assetIds: new Set<string>(),
    artifactIds: new Set<string>(),
    locationIds: new Set<string>(),
    providerIds: new Set<string>(),
  };
  assertReusableCaptureSafe(blocks);
  for (const block of blocks) {
    collectDependencyIds(block.configuration, collected);
    collectDependencyIds(block.presentation, collected);
    collectDependencyIds(block.completion, collected);
  }
  const entryPorts = sourceBlocks
    .filter((block) => block.incoming.some((connection) => !selected.has(connection.sourceBlockId)))
    .map((block) => ({
      key: `entry-${block.id}`,
      label: `Connect into ${block.title}`,
      sourceBlockId: block.id,
      connectionType: "DEFAULT",
    }));
  const exitPorts = sourceBlocks.flatMap((block) =>
    block.outgoing
      .filter((connection) => !selected.has(connection.targetBlockId))
      .map((connection, index) => ({
        key: `exit-${block.id}-${index}`,
        label: connection.label || `Connect ${block.title} onward`,
        sourceBlockId: block.id,
        connectionType: connection.connectionType,
      })),
  );
  const itemId = randomUUID();
  const versionId = randomUUID();
  const unsigned = {
    envelopeType: "voyagewright.reusable-authoring" as const,
    envelopeVersion: 1 as const,
    itemId,
    versionId,
    kind: "FRAGMENT" as const,
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    tags: (input.tags ?? [])
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 30),
    ownerId: ownerAccountId,
    blocks,
    chapters: [],
    entryPorts,
    exitPorts,
    parameters: [],
    dependencies: {
      assetIds: [...collected.assetIds].sort(),
      artifactIds: [...collected.artifactIds].sort(),
      locationIds: [...collected.locationIds].sort(),
      providerIds: [...collected.providerIds].sort(),
    },
    accessibilityObligations: [],
    attribution: { sourceOwnerId: source.creatorAccountId ?? source.creatorId, modified: false },
    lineage: [],
    compatibility: {
      minimumReaderVersion: 1,
      blockContractVersions: Object.fromEntries(blocks.map((block) => [block.blockType, block.schemaVersion])),
    },
  };
  const envelope: ReusableContentEnvelope = { ...unsigned, checksum: checksumReusableEnvelope(unsigned) };
  return createReusableAuthoringItem(ownerAccountId, envelope);
}

export async function createChapterTemplate(
  ownerAccountId: string,
  taleId: string,
  input: { name: string; description?: string; tags?: string[]; chapterId: string },
) {
  const source = await db.chronicle.findFirst({
    where: { id: taleId },
    select: { creatorAccountId: true, creatorId: true, currentDraftRevisionId: true },
  });
  if (!source?.currentDraftRevisionId)
    throw new Error("This Chronicle does not have a current draft to save as a Chapter template.");
  const chapter = await db.taleChapter.findFirst({
    where: { id: input.chapterId, draftRevisionId: source.currentDraftRevisionId },
    include: { blocks: { orderBy: { orderIndex: "asc" }, include: { outgoing: { orderBy: { orderIndex: "asc" } } } } },
  });
  if (!chapter) throw new Error("The selected Chapter is not available in this Chronicle's saved draft.");
  const blockIds = new Set(chapter.blocks.map((block) => block.id));
  const blocks: Block[] = chapter.blocks.map((block) => ({
    id: block.id,
    blockType: block.blockType,
    title: block.title,
    internalLabel: block.internalLabel,
    configuration: parseJsonObject(block.configuration),
    presentation: parseJsonObject(block.presentation),
    completion: parseJsonObject(block.completion),
    isEnabled: block.isEnabled,
    schemaVersion: block.schemaVersion,
    nextBlockId: block.nextBlockId && blockIds.has(block.nextBlockId) ? block.nextBlockId : null,
    connections: block.outgoing
      .filter((connection) => blockIds.has(connection.targetBlockId))
      .map((connection) => ({
        targetBlockId: connection.targetBlockId,
        connectionType: connection.connectionType,
        label: connection.label,
        conditionExpression: connection.conditionExpression,
        orderIndex: connection.orderIndex,
      })),
  }));
  const collected = {
    assetIds: new Set<string>(),
    artifactIds: new Set<string>(),
    locationIds: new Set<string>(),
    providerIds: new Set<string>(),
  };
  assertReusableCaptureSafe(blocks);
  for (const block of blocks) {
    collectDependencyIds(block.configuration, collected);
    collectDependencyIds(block.presentation, collected);
    collectDependencyIds(block.completion, collected);
  }
  const itemId = randomUUID();
  const versionId = randomUUID();
  const unsigned = {
    envelopeType: "voyagewright.reusable-authoring" as const,
    envelopeVersion: 1 as const,
    itemId,
    versionId,
    kind: "CHAPTER_TEMPLATE" as const,
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    tags: (input.tags ?? [])
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 30),
    ownerId: ownerAccountId,
    blocks,
    chapters: [
      {
        id: chapter.id,
        title: chapter.title,
        subtitle: chapter.subtitle,
        description: chapter.description,
        coverAssetId: chapter.coverAssetId,
        estimatedDuration: chapter.estimatedDuration,
        isOptional: chapter.isOptional,
        metadata: parseJsonObject(chapter.metadata),
        blockIds: blocks.map((block) => block.id),
      },
    ],
    entryPorts: [],
    exitPorts: chapter.blocks.flatMap((block) =>
      block.outgoing
        .filter((connection) => !blockIds.has(connection.targetBlockId))
        .map((connection, index) => ({
          key: `exit-${block.id}-${index}`,
          label: connection.label || `Connect ${block.title} onward`,
          sourceBlockId: block.id,
          connectionType: connection.connectionType,
        })),
    ),
    parameters: [],
    dependencies: {
      assetIds: [...collected.assetIds].sort(),
      artifactIds: [...collected.artifactIds].sort(),
      locationIds: [...collected.locationIds].sort(),
      providerIds: [...collected.providerIds].sort(),
    },
    accessibilityObligations: [],
    attribution: { sourceOwnerId: source.creatorAccountId ?? source.creatorId, modified: false },
    lineage: [],
    compatibility: {
      minimumReaderVersion: 1,
      blockContractVersions: Object.fromEntries(blocks.map((block) => [block.blockType, block.schemaVersion])),
    },
  };
  const envelope: ReusableContentEnvelope = { ...unsigned, checksum: checksumReusableEnvelope(unsigned) };
  return createReusableAuthoringItem(ownerAccountId, envelope);
}

export async function archiveReusableAuthoringItem(ownerAccountId: string, itemId: string) {
  const item = await db.reusableAuthoringItem.findFirst({
    where: { id: itemId, ownerAccountId, archivedAt: null },
    select: { id: true },
  });
  if (!item) throw new Error("That reusable item is not available to this Creator.");
  const usageCount = await db.reusableAuthoringUsage.count({ where: { itemId } });
  return db.reusableAuthoringItem
    .update({ where: { id: itemId }, data: { archivedAt: new Date(), status: "ARCHIVED" } })
    .then(() => ({ usageCount }));
}

export async function recordReusableAuthoringUsage(input: {
  ownerAccountId: string;
  draftId: string;
  itemId: string;
  versionId: string;
  sourceKind: string;
  insertedBlockIds: string[];
  insertedChapterIds: string[];
  provenance: ReusableContentEnvelope["attribution"];
}) {
  const version = await db.reusableAuthoringItemVersion.findFirst({
    where: {
      id: input.versionId,
      itemId: input.itemId,
      item: { ownerAccountId: input.ownerAccountId, archivedAt: null },
    },
    select: { id: true },
  });
  if (!version) throw new Error("The reusable item or source version is not available to this Creator.");
  return db.reusableAuthoringUsage.create({
    data: {
      draftId: input.draftId,
      itemId: input.itemId,
      versionId: input.versionId,
      sourceKind: input.sourceKind,
      insertedBlockIds: JSON.stringify(input.insertedBlockIds),
      insertedChapterIds: JSON.stringify(input.insertedChapterIds),
      provenance: JSON.stringify(input.provenance),
    },
  });
}
