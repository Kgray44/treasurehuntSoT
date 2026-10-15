import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { canonicalChecksum } from "@/drydock/canonical";
import { draftSchema, type SpatialDraft } from "./authoring";
import { materializeSpatialVersion, validateSpatialMoment } from "./publication";
import { validateSpatialAuthoring } from "./studio-validation";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { getStudioTale, saveStudioDraft, DraftConflictError } from "@/chronicle/studio-service";
import type { JsonObject } from "@/chronicle/types";
import type { SpatialVersion, SpatialMoment } from "./contracts";
import { assertCalibrationClaim } from "./field-service";
import { assertSceneEnvironment } from "./environment-service";

export const spatialItemKind = "PARALLAX_STUDIO";
export type SpatialLibraryRecord = {
  id: string;
  revision: number;
  draft: SpatialDraft;
  releases: SpatialVersion[];
  usageCount: number;
  updatedAt: string;
  readOnly?: boolean;
};
export async function listSpatialItems(ownerAccountId: string): Promise<SpatialLibraryRecord[]> {
  const items = await db.reusableAuthoringItem.findMany({
    where: { ownerAccountId, kind: spatialItemKind, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    include: { versions: { orderBy: { versionNumber: "desc" } }, _count: { select: { usages: true } } },
  });
  return items.map((item) => {
    const working = item.versions.find((v) => v.versionNumber === 0);
    if (!working || canonicalChecksum(JSON.parse(working.envelope)) !== working.checksum)
      throw new Error("Spatial draft integrity could not be verified.");
    const draft = draftSchema.parse(JSON.parse(working.envelope));
    if (draft.content.definitionId !== item.id) throw new Error("Spatial definition binding is invalid.");
    const releases = item.versions
      .filter((v) => v.versionNumber > 0)
      .map((v) => {
        const moment = validateSpatialMoment(JSON.parse(v.envelope));
        if (
          moment.definition.id !== item.id ||
          moment.definition.ownerPersonId !== ownerAccountId ||
          moment.version.checksum !== v.checksum ||
          moment.version.id !== v.id
        )
          throw new Error("Spatial Library version binding is invalid.");
        return moment.version;
      });
    return {
      id: item.id,
      revision: item.currentVersionNumber,
      draft,
      releases,
      usageCount: item._count.usages,
      updatedAt: item.updatedAt.toISOString(),
      readOnly: item.status === "INSTALLED_READ_ONLY",
    };
  });
}
export async function assertSpatialDraftAccess(draft: SpatialDraft) {
  if (draft.chronicleId && !(await requireOwnedStudioTale(draft.chronicleId)))
    throw new Error("This Chronicle is not available to this Creator account.");
  if (draft.scope === "CHRONICLE_ONLY" && !draft.chronicleId) return; // Unsaved personal workshop draft.
}
export async function saveSpatialDraft(ownerAccountId: string, raw: unknown, revision: number): Promise<number> {
  const draft = draftSchema.parse(raw);
  await assertSpatialDraftAccess(draft);
  return db.$transaction((tx) => saveSpatialDraftInTransaction(ownerAccountId, draft, revision, tx));
}
/** Canonical save/CAS for manual autosave and reviewed Apply. Callers authorize
 * the exact draft before opening the transaction; use only tx queries here. */
export async function saveSpatialDraftInTransaction(
  ownerAccountId: string,
  raw: unknown,
  revision: number,
  tx: Prisma.TransactionClient,
): Promise<number> {
  const draft = draftSchema.parse(raw);
  await assertCalibrationClaim(ownerAccountId, draft, tx);
  await assertSceneEnvironment(ownerAccountId, draft, tx);
  const id = draft.content.definitionId;
  const envelope = JSON.stringify(draft);
  const checksum = canonicalChecksum(draft);
  const item = await tx.reusableAuthoringItem.findUnique({ where: { id } });
  if (!item) {
    if (revision !== 0) throw new DraftConflictError(0);
    await tx.reusableAuthoringItem.create({
      data: {
        id,
        ownerAccountId,
        kind: spatialItemKind,
        name: draft.content.title,
        tags: JSON.stringify(draft.tags),
        currentVersionNumber: 1,
        versions: { create: { id: `${id}:working`, versionNumber: 0, envelope, checksum } },
      },
    });
    return 1;
  }
  if (
    item.ownerAccountId !== ownerAccountId ||
    item.kind !== spatialItemKind ||
    item.archivedAt ||
    item.status !== "ACTIVE"
  )
    throw new Error("Spatial item unavailable.");
  const claimed = await tx.reusableAuthoringItem.updateMany({
    where: { id, ownerAccountId, currentVersionNumber: revision },
    data: { name: draft.content.title, tags: JSON.stringify(draft.tags), currentVersionNumber: { increment: 1 } },
  });
  if (!claimed.count) throw new DraftConflictError(item.currentVersionNumber);
  // Only version zero is a mutable working copy. Every released version is append-only.
  await tx.reusableAuthoringItemVersion.update({
    where: { itemId_versionNumber: { itemId: id, versionNumber: 0 } },
    data: { envelope, checksum },
  });
  return revision + 1;
}
export function materializeLibraryMoment(
  draft: SpatialDraft,
  ownerAccountId: string,
  releaseNumber: number,
): SpatialMoment {
  const findings = validateSpatialAuthoring(draft.content);
  if (findings.some((i) => i.severity === "ERROR"))
    throw new Error(
      `Resolve spatial validation: ${findings
        .filter((i) => i.severity === "ERROR")
        .map((i) => i.message)
        .join(" ")}`,
    );
  const version = materializeSpatialVersion({
    ...draft.content,
    id: `${draft.content.definitionId}:v${releaseNumber}`,
    semanticVersion: `${releaseNumber}.0.0`,
  });
  return {
    schemaVersion: 1,
    definition: {
      id: draft.content.definitionId,
      ownerPersonId: ownerAccountId,
      title: version.title,
      libraryScope: draft.scope,
    },
    version,
    attachment: {
      id: `${version.id}:library`,
      storyMomentId: "library-preview",
      spatialDefinitionVersionId: version.id,
      versionChecksum: version.checksum,
      overrides: {},
    },
  };
}
export async function releaseSpatialVersion(ownerAccountId: string, definitionId: string, revision: number) {
  const record = (await listSpatialItems(ownerAccountId)).find((i) => i.id === definitionId);
  if (!record) throw new Error("Spatial item unavailable.");
  if (record.readOnly)
    throw new Error("This Community installation is read-only. Create an eligible editable copy before changing it.");
  await assertSpatialDraftAccess(record.draft);
  await assertCalibrationClaim(ownerAccountId, record.draft);
  await assertSceneEnvironment(ownerAccountId, record.draft);
  const number = record.releases.length + 1;
  const moment = materializeLibraryMoment(record.draft, ownerAccountId, number);
  await db.$transaction(async (tx) => {
    const claimed = await tx.reusableAuthoringItem.updateMany({
      where: { id: definitionId, ownerAccountId, currentVersionNumber: revision },
      data: { currentVersionNumber: { increment: 1 } },
    });
    if (!claimed.count || record.revision !== revision) throw new DraftConflictError(record.revision);
    await tx.reusableAuthoringItemVersion.create({
      data: {
        id: moment.version.id,
        itemId: definitionId,
        versionNumber: number,
        checksum: moment.version.checksum,
        envelope: JSON.stringify(moment),
      },
    });
  });
  return { revision: revision + 1, version: moment.version };
}
export async function attachSpatialVersion(input: {
  ownerAccountId: string;
  definitionId: string;
  versionId: string;
  chronicleId: string;
  blockId: string;
  autosaveVersion: number;
  narrative?: string;
}) {
  if (!(await requireOwnedStudioTale(input.chronicleId))) throw new Error("Chronicle unavailable.");
  const row = await db.reusableAuthoringItemVersion.findFirst({
    where: {
      id: input.versionId,
      itemId: input.definitionId,
      versionNumber: { gt: 0 },
      item: { ownerAccountId: input.ownerAccountId, kind: spatialItemKind, archivedAt: null },
    },
  });
  if (!row) throw new Error("Choose an immutable Spatial Library version.");
  const moment = validateSpatialMoment(JSON.parse(row.envelope));
  if (moment.version.checksum !== row.checksum) throw new Error("Spatial version checksum mismatch.");
  const record = (await listSpatialItems(input.ownerAccountId)).find((i) => i.id === input.definitionId)!;
  if (
    record.draft.scope === "CHRONICLE_ONLY" &&
    record.draft.chronicleId &&
    record.draft.chronicleId !== input.chronicleId
  )
    throw new Error("Save this item to My Spatial Library before reusing it across Chronicles.");
  const source = await getStudioTale(input.chronicleId);
  const block = source.draft.chapters.flatMap((c) => c.blocks).find((b) => b.id === input.blockId);
  if (!block) throw new Error("Choose a current Chronicle Passage.");
  const capsule = validateSpatialMoment(
    {
      ...moment,
      attachment: {
        ...moment.attachment,
        id: `${input.blockId}:spatial`,
        storyMomentId: input.blockId,
        overrides: input.narrative ? { narrative: input.narrative } : {},
      },
    },
    input.blockId,
  );
  block.presentation = { ...block.presentation, spatialMoment: capsule as unknown as JsonObject };
  return saveStudioDraft(
    input.chronicleId,
    {
      ...source.draft,
      autosaveVersion: input.autosaveVersion,
      tale: source.tale,
      reusableUsage: {
        itemId: input.definitionId,
        versionId: input.versionId,
        sourceKind: "SPATIAL_MOMENT",
        insertedBlockIds: [input.blockId],
        insertedChapterIds: [],
        provenance: {
          sourceOwnerId: input.ownerAccountId,
          sourceItemId: input.definitionId,
          sourceVersionId: input.versionId,
          modified: Boolean(input.narrative),
        },
      },
    },
    input.ownerAccountId,
  );
}

/** Attachment history restores content only from the owner's immutable library. */
export async function restoreSpatialAttachment(input: {
  ownerAccountId: string;
  chronicleId: string;
  blockId: string;
  autosaveVersion: number;
  moment: SpatialMoment | null;
}) {
  if (!(await requireOwnedStudioTale(input.chronicleId))) throw new Error("Chronicle unavailable.");
  if (input.moment) {
    const moment = validateSpatialMoment(input.moment, input.blockId);
    const row = await db.reusableAuthoringItemVersion.findFirst({
      where: {
        id: moment.version.id,
        itemId: moment.definition.id,
        versionNumber: { gt: 0 },
        item: { ownerAccountId: input.ownerAccountId, kind: spatialItemKind, archivedAt: null },
      },
    });
    if (!row || row.checksum !== moment.version.checksum)
      throw new Error("Attachment history must reference an owned immutable library version.");
    const stored = validateSpatialMoment(JSON.parse(row.envelope));
    if (stored.definition.id !== moment.definition.id || stored.version.checksum !== moment.version.checksum)
      throw new Error("Spatial version binding is invalid.");
    return attachSpatialVersion({
      ...input,
      definitionId: moment.definition.id,
      versionId: moment.version.id,
      narrative: moment.attachment.overrides.narrative,
    });
  }
  const source = await getStudioTale(input.chronicleId);
  const block = source.draft.chapters.flatMap((c) => c.blocks).find((b) => b.id === input.blockId);
  if (!block) throw new Error("Choose a current Chronicle Passage.");
  delete block.presentation.spatialMoment;
  return saveStudioDraft(
    input.chronicleId,
    { ...source.draft, autosaveVersion: input.autosaveVersion, tale: source.tale },
    input.ownerAccountId,
  );
}

/** Archive only the mutable item listing; immutable releases remain available to their existing pins. */
export async function archiveSpatialScene(ownerAccountId: string, definitionId: string, revision: number) {
  const item = (await listSpatialItems(ownerAccountId)).find((i) => i.id === definitionId);
  if (!item) throw new Error("Scene unavailable.");
  await assertSpatialDraftAccess(item.draft);
  const result = await db.reusableAuthoringItem.updateMany({
    where: {
      id: definitionId,
      ownerAccountId,
      kind: spatialItemKind,
      archivedAt: null,
      currentVersionNumber: revision,
    },
    data: { archivedAt: new Date(), currentVersionNumber: { increment: 1 } },
  });
  if (!result.count) throw new DraftConflictError(item.revision);
}
