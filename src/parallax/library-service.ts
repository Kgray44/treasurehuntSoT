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
import { createReusableSpatialAsset, insertReusableSpatialAsset, type AssetMetadata } from "./reusable-assets";
import type { PreviewEnvironment } from "./environment-authoring";

export const spatialItemKind = "PARALLAX_STUDIO";
export type SpatialLibraryRecord = {
  id: string;
  revision: number;
  draft: SpatialDraft;
  releases: SpatialVersion[];
  usageCount: number;
  updatedAt: string;
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
    };
  });
}
export async function assertSpatialDraftAccess(draft: SpatialDraft) {
  if (draft.chronicleId && !(await requireOwnedStudioTale(draft.chronicleId)))
    throw new Error("This Chronicle is not available to this Creator account.");
  if (draft.scope === "CHRONICLE_ONLY" && !draft.chronicleId) return; // Unsaved personal workshop draft.
}

/** Same owned library and immutable version records; saving an asset leaves its source scene untouched. */
export async function saveReusableAsset(
  ownerAccountId: string,
  draft: SpatialDraft,
  revision: number,
  rootId: string,
  metadata: AssetMetadata,
  environment: PreviewEnvironment,
) {
  await assertSpatialDraftAccess(draft);
  const asset = createReusableSpatialAsset(draft, rootId, crypto.randomUUID(), metadata, environment);
  const moment = materializeLibraryMoment(asset, ownerAccountId, 1);
  await db.$transaction(async (tx) => {
    const source = await tx.reusableAuthoringItem.findUnique({
      where: { id: draft.content.definitionId },
      include: { versions: { where: { versionNumber: 0 } } },
    });
    if (!source || source.ownerAccountId !== ownerAccountId || source.kind !== spatialItemKind || source.archivedAt)
      throw new Error("Source scene unavailable.");
    if (source.currentVersionNumber !== revision || source.versions[0]?.checksum !== canonicalChecksum(draft))
      throw new DraftConflictError(source.currentVersionNumber);
    await saveSpatialDraftInTransaction(ownerAccountId, asset, 0, tx);
    await tx.reusableAuthoringItemVersion.create({
      data: {
        id: moment.version.id,
        itemId: asset.content.definitionId,
        versionNumber: 1,
        checksum: moment.version.checksum,
        envelope: JSON.stringify(moment),
      },
    });
  });
  return { definitionId: asset.content.definitionId, versionId: moment.version.id };
}

export async function reuseSpatialAsset(
  ownerAccountId: string,
  draft: SpatialDraft,
  revision: number,
  definitionId: string,
  versionId: string,
) {
  await assertSpatialDraftAccess(draft);
  return db.$transaction(async (tx) => {
    const row = await tx.reusableAuthoringItemVersion.findFirst({
      where: {
        id: versionId,
        itemId: definitionId,
        versionNumber: { gt: 0 },
        item: { ownerAccountId, kind: spatialItemKind, archivedAt: null },
      },
    });
    if (!row) throw new Error("Choose an owned, active reusable asset version.");
    const moment = validateSpatialMoment(JSON.parse(row.envelope));
    if (
      moment.definition.id !== definitionId ||
      moment.definition.ownerPersonId !== ownerAccountId ||
      moment.version.id !== versionId ||
      moment.version.checksum !== row.checksum
    )
      throw new Error("Reusable asset version binding is invalid.");
    const next = insertReusableSpatialAsset(draft, moment.version, crypto.randomUUID());
    const target = await tx.reusableAuthoringItem.findUnique({ where: { id: draft.content.definitionId } });
    if (!target || target.ownerAccountId !== ownerAccountId || target.kind !== spatialItemKind || target.archivedAt)
      throw new Error("Target scene unavailable.");
    if (target.currentVersionNumber !== revision) throw new DraftConflictError(target.currentVersionNumber);
    // Client checks its editor generation, installs through ordinary history, then autosaves.
    return { draft: next };
  });
}

/** Archive removes a definition from discovery; immutable releases and placed copies remain intact. */
export async function archiveSpatialItem(ownerAccountId: string, definitionId: string, revision: number) {
  const claimed = await db.reusableAuthoringItem.updateMany({
    where: {
      id: definitionId,
      ownerAccountId,
      kind: spatialItemKind,
      archivedAt: null,
      currentVersionNumber: revision,
    },
    data: { archivedAt: new Date(), currentVersionNumber: { increment: 1 } },
  });
  if (!claimed.count) throw new DraftConflictError(revision);
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
  if (draft.content.studio?.environmentLibraryArchived) {
    const previous = await tx.reusableAuthoringItemVersion.findFirst({
      where: { itemId: draft.content.definitionId, versionNumber: 0 },
    });
    if (previous) {
      const priorRoom = draftSchema.parse(JSON.parse(previous.envelope)).content.studio?.environment;
      if (canonicalChecksum(priorRoom ?? null) !== canonicalChecksum(draft.content.studio.environment ?? null))
        delete draft.content.studio.environmentLibraryArchived;
    }
  }
  await assertCalibrationClaim(ownerAccountId, draft, tx);
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
  if (item.ownerAccountId !== ownerAccountId || item.kind !== spatialItemKind || item.archivedAt)
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

/** Environment entries project existing owned scene working copies; there is no parallel room store.
 * Placed copies stay independent. Discovery deletion retains geometry and immutable releases.
 */
export async function updateEnvironmentLibraryEntry(
  ownerAccountId: string,
  definitionId: string,
  revision: number,
  change: { name: string } | { archive: true },
) {
  const row = await db.reusableAuthoringItem.findFirst({
    where: { id: definitionId, ownerAccountId, kind: spatialItemKind, archivedAt: null },
    include: { versions: { where: { versionNumber: 0 } } },
  });
  const working = row?.versions[0];
  if (
    !row ||
    row.ownerAccountId !== ownerAccountId ||
    row.kind !== spatialItemKind ||
    row.archivedAt ||
    !working ||
    canonicalChecksum(JSON.parse(working.envelope)) !== working.checksum
  )
    throw new Error("This environment is unavailable.");
  const draft = draftSchema.parse(JSON.parse(working.envelope));
  if (draft.content.definitionId !== definitionId) throw new Error("Environment source binding is invalid.");
  if (!draft.content.studio?.environment || draft.content.studio.libraryDefinition)
    throw new Error("Choose an environment from a saved scene.");
  if ("name" in change) draft.content.studio.environment.name = change.name;
  else draft.content.studio.environmentLibraryArchived = true;
  return { draft, revision: await saveSpatialDraft(ownerAccountId, draft, revision) };
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
  await assertSpatialDraftAccess(record.draft);
  await assertCalibrationClaim(ownerAccountId, record.draft);
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
