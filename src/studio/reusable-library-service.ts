import { db } from "@/lib/db";
import { parseReusableEnvelope, type ReusableContentEnvelope } from "@/studio/reusable-content";

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
      data: { id: envelope.versionId, itemId: item.id, versionNumber: 1, envelope: JSON.stringify(envelope), checksum: envelope.checksum },
    });
    return { itemId: item.id, versionId: version.id, versionNumber: version.versionNumber };
  });
}

export async function archiveReusableAuthoringItem(ownerAccountId: string, itemId: string) {
  const item = await db.reusableAuthoringItem.findFirst({ where: { id: itemId, ownerAccountId, archivedAt: null }, select: { id: true } });
  if (!item) throw new Error("That reusable item is not available to this Creator.");
  const usageCount = await db.reusableAuthoringUsage.count({ where: { itemId } });
  return db.reusableAuthoringItem.update({ where: { id: itemId }, data: { archivedAt: new Date(), status: "ARCHIVED" } }).then(() => ({ usageCount }));
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
    where: { id: input.versionId, itemId: input.itemId, item: { ownerAccountId: input.ownerAccountId, archivedAt: null } },
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
