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
import { recordAICanonicalSave } from "./ai-outcomes";
import { createReusableSpatialAsset, insertReusableSpatialAsset, type AssetMetadata } from "./reusable-assets";
import type { PreviewEnvironment } from "./environment-authoring";
import { librarySaveState, type LibrarySaveState } from "./library-lifecycle-contracts";
import { assertPinnedSceneEnvironment } from "./environment-version-resolution";
import type { SpatialReleaseIndexEntry } from "./library-release-index";
import { insertSavedComposition } from "./element-authoring";
import { assertInstalledSpatialReuseRights } from "@/community/spatial-reuse-rights";

export const spatialItemKind = "PARALLAX_STUDIO";
export type SpatialLibraryRecord = {
  id: string;
  revision: number;
  draft: SpatialDraft;
  releases: SpatialVersion[];
  releasesState?: "LOADED" | "INDEX_ONLY";
  releaseIndex?: SpatialReleaseIndexEntry[];
  usageCount: number;
  updatedAt: string;
  saveState?: LibrarySaveState;
  archived?: boolean;
  lastUsedAt?: string | null;
  releaseMetadata?: { id: string; createdAt: string; notes: string; usageCount: number }[];
  readOnly?: boolean;
};
export async function listSpatialItems(
  ownerAccountId: string,
  includeArchived = false,
): Promise<SpatialLibraryRecord[]> {
  const items = await db.reusableAuthoringItem.findMany({
    where: { ownerAccountId, kind: spatialItemKind, ...(includeArchived ? {} : { archivedAt: null }) },
    orderBy: { updatedAt: "desc" },
    include: { versions: { orderBy: { versionNumber: "desc" } }, _count: { select: { usages: true } } },
  });
  return items
    .filter((item) => {
      const working = item.versions.find((v) => v.versionNumber === 0);
      return !working || JSON.parse(working.envelope).format !== "PARALLAX_ENVIRONMENT_DRAFT_1";
    })
    .map((item) => {
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
        saveState: librarySaveState(item.status ?? "ACTIVE", releases.length > 0),
        archived: Boolean(item.archivedAt),
        releaseMetadata: item.versions
          .filter((v) => v.versionNumber > 0)
          .map((v) => ({
            id: v.id,
            createdAt: v.createdAt?.toISOString() ?? item.updatedAt.toISOString(),
            notes: validateSpatialMoment(JSON.parse(v.envelope)).version.studio?.releaseNotes ?? "",
            usageCount: 0,
          })),
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
  operation?: { newId: string; operationId: string },
) {
  await assertSpatialDraftAccess(draft);
  const asset = createReusableSpatialAsset(
    draft,
    rootId,
    operation?.newId ?? crypto.randomUUID(),
    metadata,
    environment,
  );
  const requestDigest = canonicalChecksum({
    definitionId: draft.content.definitionId,
    revision,
    rootId,
    metadata,
    environment,
    operation,
  });
  if (operation)
    asset.library!.creation = {
      operationId: operation.operationId,
      sourceDefinitionId: draft.content.definitionId,
      sourceRevision: revision,
      requestDigest,
    };
  const moment = materializeLibraryMoment(asset, ownerAccountId, 1);
  await db.$transaction(async (tx) => {
    if (operation) {
      const existing = await tx.reusableAuthoringItem.findUnique({
        where: { id: operation.newId },
        include: { versions: { where: { versionNumber: 0 } } },
      });
      if (existing) {
        if (
          existing.ownerAccountId !== ownerAccountId ||
          existing.kind !== spatialItemKind ||
          existing.status === "INSTALLED_READ_ONLY"
        )
          throw new Error("This asset identity is unavailable.");
        const before = draftSchema.parse(JSON.parse(existing.versions[0].envelope));
        if (
          before.library?.creation?.operationId !== operation.operationId ||
          before.library.creation.requestDigest !== requestDigest
        )
          throw new Error("This asset identity belongs to another export.");
        return;
      }
    }
    const source = await tx.reusableAuthoringItem.findUnique({
      where: { id: draft.content.definitionId },
      include: { versions: { where: { versionNumber: 0 } } },
    });
    if (!source || source.ownerAccountId !== ownerAccountId || source.kind !== spatialItemKind || source.archivedAt)
      throw new Error("Source scene unavailable.");
    if (source.status === "INSTALLED_READ_ONLY")
      throw new Error("Installed content is read-only. Use the licensed copy flow to create an editable copy.");
    if (source.currentVersionNumber !== revision || source.versions[0]?.checksum !== canonicalChecksum(draft))
      throw new DraftConflictError(source.currentVersionNumber);
    await saveSpatialDraftInTransaction(ownerAccountId, asset, 0, tx, {
      saveToLibrary: true,
      trustedCreation: !!operation,
    });
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
    const source = await tx.reusableAuthoringItem.findUnique({
      where: { id: definitionId },
      select: { status: true, versions: { where: { versionNumber: 0 }, select: { envelope: true, checksum: true } } },
    });
    const working = source?.versions[0];
    if (!source || !["SAVED", "INSTALLED_READ_ONLY"].includes(source.status) || !working)
      throw new Error("Choose a saved reusable asset from your Library.");
    const sourceDraft = draftSchema.parse(JSON.parse(working.envelope));
    if (sourceDraft.content.definitionId !== definitionId || canonicalChecksum(sourceDraft) !== working.checksum)
      throw new Error("The reusable asset source failed integrity verification.");
    const allowSavedLibraryAsset = sourceDraft.library?.type === "ASSET" || sourceDraft.library?.type === "ASSEMBLY";
    if (source?.status === "INSTALLED_READ_ONLY")
      await assertInstalledSpatialReuseRights(tx, ownerAccountId, definitionId);
    const next = insertReusableSpatialAsset(draft, moment.version, crypto.randomUUID(), allowSavedLibraryAsset);
    const target = await tx.reusableAuthoringItem.findUnique({ where: { id: draft.content.definitionId } });
    if (
      !target ||
      target.ownerAccountId !== ownerAccountId ||
      target.kind !== spatialItemKind ||
      target.archivedAt ||
      target.status === "INSTALLED_READ_ONLY"
    )
      throw new Error("Target scene unavailable.");
    if (target.currentVersionNumber !== revision) throw new DraftConflictError(target.currentVersionNumber);
    // Client checks its editor generation, installs through ordinary history, then autosaves.
    return { draft: next };
  });
}

/** Installed compositions enter a private Scene through the same pinned-license
 * check as installed reusable assets. The source installation stays read-only. */
export async function reuseInstalledSpatialComposition(
  ownerAccountId: string,
  draft: SpatialDraft,
  revision: number,
  definitionId: string,
  versionId: string,
) {
  await assertSpatialDraftAccess(draft);
  return db.$transaction(async (tx) => {
    const source = await tx.reusableAuthoringItem.findFirst({
      where: {
        id: definitionId,
        ownerAccountId,
        kind: spatialItemKind,
        status: "INSTALLED_READ_ONLY",
        archivedAt: null,
      },
      include: { versions: true },
    });
    if (!source) throw new Error("Choose an installed Community composition.");
    await assertInstalledSpatialReuseRights(tx, ownerAccountId, definitionId);
    const working = source.versions.find((row) => row.versionNumber === 0);
    const selected = source.versions.find((row) => row.id === versionId && row.versionNumber > 0);
    if (!working || !selected || canonicalChecksum(JSON.parse(working.envelope)) !== working.checksum)
      throw new Error("The installed composition snapshot is unavailable or invalid.");
    const sourceDraft = draftSchema.parse(JSON.parse(working.envelope));
    const moment = validateSpatialMoment(JSON.parse(selected.envelope));
    if (
      sourceDraft.content.definitionId !== definitionId ||
      moment.definition.id !== definitionId ||
      moment.definition.ownerPersonId !== ownerAccountId ||
      moment.version.id !== versionId ||
      moment.version.checksum !== selected.checksum
    )
      throw new Error("The installed composition version binding is invalid.");
    const { checksum: _checksum, ...content } = moment.version;
    void _checksum;
    const composition = draftSchema.parse({ ...sourceDraft, content });
    const target = await tx.reusableAuthoringItem.findUnique({ where: { id: draft.content.definitionId } });
    if (
      !target ||
      target.ownerAccountId !== ownerAccountId ||
      target.kind !== spatialItemKind ||
      target.archivedAt ||
      target.status === "INSTALLED_READ_ONLY"
    )
      throw new Error("Target scene unavailable.");
    if (target.currentVersionNumber !== revision) throw new DraftConflictError(target.currentVersionNumber);
    return { draft: insertSavedComposition(draft, composition, crypto.randomUUID()) };
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
      status: { not: "INSTALLED_READ_ONLY" },
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
  options: { trustedCreation?: boolean; saveToLibrary?: boolean } = {},
): Promise<number> {
  const draft = draftSchema.parse(raw);
  await assertCalibrationClaim(ownerAccountId, draft, tx);
  await assertPinnedSceneEnvironment(ownerAccountId, draft, tx);
  const id = draft.content.definitionId;
  const envelope = JSON.stringify(draft);
  const checksum = canonicalChecksum(draft);
  const item = await tx.reusableAuthoringItem.findUnique({
    where: { id },
    include: { versions: { where: { versionNumber: 0 } } },
  });
  if (!item) {
    if (revision !== 0) throw new DraftConflictError(0);
    if (draft.library?.creation && !options.trustedCreation)
      throw new Error("Use Save As to create independent definition lineage.");
    await tx.reusableAuthoringItem.create({
      data: {
        id,
        ownerAccountId,
        kind: spatialItemKind,
        status: options.saveToLibrary ? "SAVED" : "WORKING",
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
  if (item.status === "INSTALLED_READ_ONLY")
    throw new Error("Installed content is read-only. Use the licensed copy flow to create an editable copy.");
  // An acknowledged payload may be retried after the HTTP response was lost.
  if (item.currentVersionNumber > revision && item.versions?.find((v) => v.versionNumber === 0)?.checksum === checksum)
    return item.currentVersionNumber;
  const previous = item.versions?.find((version) => version.versionNumber === 0);
  if (previous) {
    const before = draftSchema.parse(JSON.parse(previous.envelope));
    if (before.library && before.library.type !== draft.library?.type)
      throw new Error("Definition type is stable. Use Save As to create another reusable type.");
    if (canonicalChecksum(before.library?.creation ?? null) !== canonicalChecksum(draft.library?.creation ?? null))
      throw new Error("Save As lineage is immutable.");
  }
  const claimed = await tx.reusableAuthoringItem.updateMany({
    where: {
      id,
      ownerAccountId,
      kind: spatialItemKind,
      archivedAt: null,
      status: { not: "INSTALLED_READ_ONLY" },
      currentVersionNumber: revision,
    },
    data: {
      name: draft.content.title,
      tags: JSON.stringify(draft.tags),
      currentVersionNumber: { increment: 1 },
      ...(options.saveToLibrary ? { status: "SAVED" } : {}),
    },
  });
  if (!claimed.count) throw new DraftConflictError(item.currentVersionNumber);
  // Only version zero is a mutable working copy. Every released version is append-only.
  await tx.reusableAuthoringItemVersion.update({
    where: { itemId_versionNumber: { itemId: id, versionNumber: 0 } },
    data: { envelope, checksum },
  });
  await recordAICanonicalSave(
    tx,
    ownerAccountId,
    id,
    draft.content.studio?.environment ? canonicalChecksum(draft.content.studio.environment) : null,
    checksum,
  );
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
export async function releaseSpatialVersion(
  ownerAccountId: string,
  definitionId: string,
  revision: number,
  notes = "",
) {
  const record = (await listSpatialItems(ownerAccountId)).find((i) => i.id === definitionId);
  if (!record) throw new Error("Spatial item unavailable.");
  if (record.readOnly)
    throw new Error("Installed content is read-only. Create an editable licensed copy before releasing it.");
  await assertSpatialDraftAccess(record.draft);
  await assertCalibrationClaim(ownerAccountId, record.draft);
  await assertPinnedSceneEnvironment(ownerAccountId, record.draft);
  const snapshot = structuredClone(record.draft);
  if (notes) snapshot.content.studio!.releaseNotes = notes;
  const last = record.releases[0];
  if (
    last &&
    materializeLibraryMoment(snapshot, ownerAccountId, Number(last.semanticVersion.split(".")[0])).version.checksum ===
      last.checksum
  )
    return { revision: record.revision, version: last, reused: true };
  const number = record.releases.length + 1;
  const moment = materializeLibraryMoment(snapshot, ownerAccountId, number);
  await db.$transaction(async (tx) => {
    const claimed = await tx.reusableAuthoringItem.updateMany({
      where: {
        id: definitionId,
        ownerAccountId,
        kind: spatialItemKind,
        archivedAt: null,
        status: { not: "INSTALLED_READ_ONLY" },
        currentVersionNumber: revision,
      },
      data: { currentVersionNumber: { increment: 1 }, status: "SAVED" },
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
