import { db } from "@/lib/db";
import type { Prisma, PrismaClient } from "@prisma/client";
import { canonicalChecksum } from "@/drydock/canonical";
import { recordAICanonicalSave } from "./ai-outcomes";
import { DraftConflictError } from "@/chronicle/studio-service";
import { draftSchema, forkSpatialDraft, type SpatialDraft } from "./authoring";
import {
  spatialItemKind,
  saveSpatialDraftInTransaction,
  listSpatialItems,
  assertSpatialDraftAccess,
} from "./library-service";
import { spatialLibraryKind } from "./reusable-assets";
import {
  environmentDraftSchema,
  environmentVersionSchema,
  librarySaveState,
  type EnvironmentDraft,
  type EnvironmentLibraryRecord,
} from "./library-lifecycle-contracts";
import { syntheticRoomGeometry } from "./room-geometry";
import { boundRoomSurfaceIds } from "./parametric-room";
import { validateSpatialAuthoring } from "./studio-validation";

const isEnvironment = (value: unknown): value is EnvironmentDraft =>
  Boolean(value && typeof value === "object" && "format" in value && value.format === "PARALLAX_ENVIRONMENT_DRAFT_1");
const itemType = (draft: SpatialDraft) =>
  (({ SCENES: "SCENE", ASSETS: "ASSET", ASSEMBLIES: "ASSEMBLY", TEMPLATES: "TEMPLATE" }) as const)[
    spatialLibraryKind(draft)
  ];

function checkedEnvironmentVersion(
  row: { id: string; itemId: string; versionNumber: number; envelope: string; checksum: string },
  definitionId: string,
) {
  const value = environmentVersionSchema.parse(JSON.parse(row.envelope));
  if (
    row.itemId !== definitionId ||
    value.id !== row.id ||
    value.definitionId !== definitionId ||
    value.content.id !== definitionId ||
    value.number !== row.versionNumber ||
    canonicalChecksum(value) !== row.checksum
  )
    throw new Error("Environment version binding and integrity failed.");
  return value;
}

async function owned(tx: Prisma.TransactionClient, accountId: string, id: string, archived = false) {
  const item = await tx.reusableAuthoringItem.findFirst({
    where: { id, ownerAccountId: accountId, kind: spatialItemKind, ...(archived ? {} : { archivedAt: null }) },
    include: { versions: { orderBy: { versionNumber: "desc" } } },
  });
  const working = item?.versions.find((version) => version.versionNumber === 0);
  if (!item || !working) throw new Error("This spatial definition is unavailable.");
  const value = JSON.parse(working.envelope);
  if (canonicalChecksum(value) !== working.checksum) throw new Error("Definition integrity could not be verified.");
  if (
    isEnvironment(value)
      ? environmentDraftSchema.parse(value).id !== id
      : draftSchema.parse(value).content.definitionId !== id
  )
    throw new Error("Definition identity does not match its working data.");
  return { item, working, value };
}

async function claim(
  tx: Prisma.TransactionClient,
  accountId: string,
  id: string,
  revision: number,
  data: Prisma.ReusableAuthoringItemUpdateManyMutationInput,
  archived = false,
) {
  const result = await tx.reusableAuthoringItem.updateMany({
    where: {
      id,
      ownerAccountId: accountId,
      kind: spatialItemKind,
      currentVersionNumber: revision,
      ...(archived ? {} : { archivedAt: null }),
    },
    data: { ...data, currentVersionNumber: { increment: 1 } },
  });
  if (!result.count) throw new DraftConflictError(revision);
  return revision + 1;
}

/** Durable membership is item status, never inferred from persistence or imported geometry. */
export async function saveDefinitionToLibrary(
  accountId: string,
  id: string,
  revision: number,
  store: PrismaClient = db,
) {
  return store.$transaction(async (tx) => {
    const { item } = await owned(tx, accountId, id);
    if (item.currentVersionNumber !== revision) throw new DraftConflictError(item.currentVersionNumber);
    if (item.status === "SAVED") return { revision, saveState: "SAVED" as const };
    return { revision: await claim(tx, accountId, id, revision, { status: "SAVED" }), saveState: "SAVED" as const };
  });
}

export async function saveEnvironmentDraftInTransaction(
  accountId: string,
  raw: unknown,
  revision: number,
  tx: Prisma.TransactionClient,
  options: { saveToLibrary?: boolean; trustedCreation?: boolean } = {},
) {
  const document = environmentDraftSchema.parse(raw);
  if (document.room) document.room.name = document.name;
  const item = await tx.reusableAuthoringItem.findUnique({ where: { id: document.id } });
  const sources = [...new Set(document.room?.features.flatMap((feature) => feature.provenance.sourceMediaIds) ?? [])];
  if (sources.length) {
    const count = await tx.protectedMedia.count({ where: { id: { in: sources }, ownerAccountId: accountId } });
    if (count !== sources.length)
      throw new Error(
        "A photograph reference is not owned by this account. Preserve the original scene and review its source references.",
      );
  }
  const envelope = JSON.stringify(document),
    checksum = canonicalChecksum(document);
  if (!item) {
    if (revision !== 0) throw new DraftConflictError(0);
    if (document.creation && !options.trustedCreation)
      throw new Error("Use Save As to create independent definition lineage.");
    await tx.reusableAuthoringItem.create({
      data: {
        id: document.id,
        ownerAccountId: accountId,
        kind: spatialItemKind,
        status: options.saveToLibrary ? "SAVED" : "WORKING",
        name: document.name,
        description: document.description,
        tags: JSON.stringify(document.tags),
        currentVersionNumber: 1,
        versions: { create: { id: `${document.id}:working`, versionNumber: 0, envelope, checksum } },
      },
    });
    return 1;
  }
  const previous = await owned(tx, accountId, document.id);
  if (previous.item.currentVersionNumber > revision && previous.working.checksum === checksum)
    return previous.item.currentVersionNumber;
  const before = environmentDraftSchema.parse(previous.value);
  if (canonicalChecksum(before.creation ?? null) !== canonicalChecksum(document.creation ?? null))
    throw new Error("Save As lineage is immutable.");
  const next = await claim(tx, accountId, document.id, revision, {
    name: document.name,
    description: document.description,
    tags: JSON.stringify(document.tags),
    ...(options.saveToLibrary ? { status: "SAVED" } : {}),
  });
  await tx.reusableAuthoringItemVersion.update({
    where: { itemId_versionNumber: { itemId: document.id, versionNumber: 0 } },
    data: { envelope, checksum },
  });
  await recordAICanonicalSave(tx, accountId, document.id, canonicalChecksum(document.room), checksum);
  return next;
}

export async function saveEnvironmentDraft(
  accountId: string,
  raw: unknown,
  revision: number,
  store: PrismaClient = db,
) {
  return store.$transaction((tx) => saveEnvironmentDraftInTransaction(accountId, raw, revision, tx));
}

/** Idempotent operation identity is supplied once by the dialog and reused after network failure. */
export async function saveSpatialAs(
  accountId: string,
  input: {
    definitionId: string;
    revision: number;
    newId: string;
    operationId: string;
    name: string;
    destination: "WORKING" | "SAVED";
    type: "SCENE" | "TEMPLATE" | "ASSET" | "ASSEMBLY" | "ENVIRONMENT";
    versionId?: string;
    retainedSnapshot?: SpatialDraft | EnvironmentDraft;
  },
  store: PrismaClient = db,
) {
  const digest = canonicalChecksum(input);
  return store.$transaction(async (tx) => {
    const existing = await tx.reusableAuthoringItem.findUnique({
      where: { id: input.newId },
      include: { versions: { where: { versionNumber: 0 } } },
    });
    if (existing) {
      if (existing.ownerAccountId !== accountId || existing.kind !== spatialItemKind)
        throw new Error("Choose a new definition identity.");
      const value = JSON.parse(existing.versions[0].envelope);
      const creation = isEnvironment(value) ? value.creation : draftSchema.parse(value).library?.creation;
      if (creation?.operationId !== input.operationId || creation.requestDigest !== digest)
        throw new Error("This Save As identity belongs to another operation.");
      return { definitionId: input.newId, revision: existing.currentVersionNumber, replayed: true };
    }
    const source = await owned(tx, accountId, input.definitionId);
    if (source.item.currentVersionNumber !== input.revision && !input.retainedSnapshot)
      throw new DraftConflictError(source.item.currentVersionNumber);
    if (input.retainedSnapshot) {
      if (input.versionId) throw new Error("Choose a retained working snapshot or an immutable version, not both.");
      const snapshot = isEnvironment(input.retainedSnapshot)
        ? environmentDraftSchema.parse(input.retainedSnapshot)
        : draftSchema.parse(input.retainedSnapshot);
      if (
        isEnvironment(snapshot) !== isEnvironment(source.value) ||
        (isEnvironment(snapshot) ? snapshot.id : snapshot.content.definitionId) !== input.definitionId
      )
        throw new Error("Retained working identity does not match the owned source.");
      if (!isEnvironment(snapshot)) await assertSpatialDraftAccess(snapshot);
      source.value = snapshot;
    }
    if (input.versionId && !isEnvironment(source.value)) {
      const row = source.item.versions.find((v) => v.id === input.versionId && v.versionNumber > 0);
      if (!row) throw new Error("Choose an existing immutable version.");
      const { validateSpatialMoment } = await import("./publication");
      const moment = validateSpatialMoment(JSON.parse(row.envelope));
      if (
        moment.definition.id !== input.definitionId ||
        moment.definition.ownerPersonId !== accountId ||
        moment.version.id !== row.id ||
        moment.version.checksum !== row.checksum
      )
        throw new Error("Spatial version binding and integrity failed.");
      const { checksum: _checksum, ...content } = moment.version;
      void _checksum;
      source.value = { ...source.value, content };
    }
    const creation = {
      operationId: input.operationId,
      sourceDefinitionId: input.definitionId,
      sourceRevision: input.revision,
      requestDigest: digest,
    };
    if (isEnvironment(source.value) || input.type === "ENVIRONMENT") {
      let original: EnvironmentDraft;
      if (isEnvironment(source.value)) {
        original = environmentDraftSchema.parse(source.value);
        if (input.versionId) {
          const row = source.item.versions.find((v) => v.id === input.versionId && v.versionNumber > 0);
          if (!row) throw new Error("Choose an existing immutable environment version.");
          const value = checkedEnvironmentVersion(row, input.definitionId);
          original = value.content;
        }
      } else {
        const scene = draftSchema.parse(source.value);
        if (!scene.content.studio?.environment)
          throw new Error("Edit or reconstruct a room before saving an environment.");
        original = {
          format: "PARALLAX_ENVIRONMENT_DRAFT_1",
          id: input.newId,
          name: input.name,
          description: "",
          category: scene.content.studio.environment.origin === "PHOTO_RECONSTRUCTION" ? "RECONSTRUCTED" : "ROOM",
          room: structuredClone(scene.content.studio.environment),
          tags: [],
          collection: scene.collection,
          favorite: false,
          lineage: null,
        };
      }
      if (input.type !== "ENVIRONMENT") throw new Error("An environment cannot be saved as a scene or asset.");
      const document = environmentDraftSchema.parse({
        ...original,
        id: input.newId,
        name: input.name,
        room: original.room ? { ...original.room, id: input.newId, name: input.name } : null,
        lineage: { definitionId: input.definitionId, versionId: input.versionId ?? null },
        creation,
      });
      const revision = await saveEnvironmentDraftInTransaction(accountId, document, 0, tx, {
        saveToLibrary: input.destination === "SAVED",
        trustedCreation: true,
      });
      return { definitionId: document.id, revision, replayed: false };
    }
    const original = draftSchema.parse(source.value);
    const inferred = itemType(original);
    if (["ASSET", "ASSEMBLY"].includes(input.type) && input.type !== inferred)
      throw new Error("Export a selected object or subtree to create a new asset or assembly.");
    if (["SCENE", "TEMPLATE"].includes(input.type) && ["ASSET", "ASSEMBLY"].includes(inferred))
      throw new Error("Place an instance in a scene before saving that scene.");
    const copy = forkSpatialDraft(original, input.newId);
    copy.scope = "MY_LIBRARY";
    copy.chronicleId = null;
    copy.content.title = input.name;
    copy.library = {
      type: input.type as "SCENE" | "TEMPLATE" | "ASSET" | "ASSEMBLY",
      description: original.library?.description ?? "",
      creation,
    };
    if (input.type === "TEMPLATE") copy.category = "SCENE_TEMPLATE";
    const revision = await saveSpatialDraftInTransaction(accountId, copy, 0, tx, {
      trustedCreation: true,
      saveToLibrary: input.destination === "SAVED",
    });
    return { definitionId: copy.content.definitionId, revision, replayed: false };
  });
}

export async function listEnvironmentDefinitions(
  accountId: string,
  store: PrismaClient = db,
): Promise<EnvironmentLibraryRecord[]> {
  const items = await store.reusableAuthoringItem.findMany({
    where: { ownerAccountId: accountId, kind: spatialItemKind },
    orderBy: { updatedAt: "desc" },
    include: { versions: { orderBy: { versionNumber: "desc" } } },
  });
  return items.flatMap((item) => {
    const working = item.versions.find((v) => v.versionNumber === 0);
    if (!working) throw new Error("A working definition is missing.");
    const value = JSON.parse(working.envelope);
    if (!isEnvironment(value)) return [];
    const draft = environmentDraftSchema.parse(value);
    if (draft.id !== item.id || canonicalChecksum(draft) !== working.checksum)
      throw new Error("Environment definition integrity failed.");
    const releases = item.versions
      .filter((v) => v.versionNumber > 0)
      .map((version) => {
        const result = checkedEnvironmentVersion(version, item.id);
        if (
          result.id !== version.id ||
          result.definitionId !== item.id ||
          canonicalChecksum(result) !== version.checksum
        )
          throw new Error("Environment version integrity failed.");
        return { ...result, checksum: version.checksum, usageCount: 0 };
      });
    return [
      {
        id: item.id,
        revision: item.currentVersionNumber,
        draft,
        saveState: librarySaveState(item.status, releases.length > 0),
        archived: Boolean(item.archivedAt),
        updatedAt: item.updatedAt.toISOString(),
        lastUsedAt: null,
        usageCount: 0,
        releases,
      },
    ];
  });
}

export async function releaseEnvironmentVersion(
  accountId: string,
  id: string,
  revision: number,
  notes = "",
  store: PrismaClient = db,
) {
  return store.$transaction(async (tx) => {
    const source = await owned(tx, accountId, id);
    const document = environmentDraftSchema.parse(source.value);
    if (!document.room) throw new Error("Build a room before creating a version.");
    const { verifyConstructedEnvironment } = await import("./construction-verification");
    if (
      verifyConstructedEnvironment(
        document.room,
        syntheticRoomGeometry({ ...document.room, horizontal: true, vertical: true }),
      ).status === "NEEDS_CORRECTION"
    )
      throw new Error("Correct the environment construction before creating a version.");
    const releases = source.item.versions.filter((v) => v.versionNumber > 0);
    const last = releases[0];
    if (last && canonicalChecksum(checkedEnvironmentVersion(last, id).content) === canonicalChecksum(document))
      return { revision: source.item.currentVersionNumber, versionId: last.id, reused: true };
    const number = Math.max(0, ...releases.map((v) => v.versionNumber)) + 1;
    const version = environmentVersionSchema.parse({
      format: "PARALLAX_ENVIRONMENT_VERSION_1",
      id: `${id}:v${number}`,
      definitionId: id,
      number,
      createdAt: new Date().toISOString(),
      notes,
      content: document,
    });
    const next = await claim(tx, accountId, id, revision, { status: "SAVED" });
    await tx.reusableAuthoringItemVersion.create({
      data: {
        id: version.id,
        itemId: id,
        versionNumber: number,
        envelope: JSON.stringify(version),
        checksum: canonicalChecksum(version),
      },
    });
    return { revision: next, versionId: version.id, reused: false };
  });
}

export async function mutateLibraryDefinition(
  accountId: string,
  id: string,
  revision: number,
  change: {
    archive?: boolean;
    name?: string;
    description?: string;
    tags?: string[];
    collection?: string;
    favorite?: boolean;
  },
  store: PrismaClient = db,
) {
  return store.$transaction(async (tx) => {
    const source = await owned(tx, accountId, id, true);
    if (change.archive !== undefined)
      return {
        revision: await claim(tx, accountId, id, revision, { archivedAt: change.archive ? new Date() : null }, true),
      };
    if (source.item.archivedAt) throw new Error("Restore this definition before editing it.");
    if (isEnvironment(source.value)) {
      const doc = environmentDraftSchema.parse(source.value);
      if (change.name) {
        doc.name = change.name.slice(0, 120);
        if (doc.room) doc.room.name = doc.name;
      }
      for (const key of ["description", "tags", "collection", "favorite"] as const)
        if (change[key] !== undefined) Object.assign(doc, { [key]: change[key] });
      return { revision: await saveEnvironmentDraftInTransaction(accountId, doc, revision, tx) };
    }
    const draft = draftSchema.parse(source.value);
    if (change.name) draft.content.title = change.name;
    if (change.description !== undefined)
      draft.library = { ...(draft.library ?? { type: itemType(draft) }), description: change.description };
    for (const key of ["tags", "collection", "favorite"] as const)
      if (change[key] !== undefined) Object.assign(draft, { [key]: change[key] });
    return { revision: await saveSpatialDraftInTransaction(accountId, draft, revision, tx) };
  });
}

/** Every saved scene embeds an independent snapshot; source edits never move its authored content. */
export async function useEnvironmentDefinition(
  accountId: string,
  input: { draft: SpatialDraft; revision: number; definitionId: string; versionId?: string },
  store: PrismaClient = db,
) {
  await assertSpatialDraftAccess(input.draft);
  return store.$transaction(async (tx) => {
    const source = await owned(tx, accountId, input.definitionId);
    if (
      librarySaveState(
        source.item.status,
        source.item.versions.some((v) => v.versionNumber > 0),
      ) !== "SAVED"
    )
      throw new Error("Save this environment to Library before reusing it.");
    let document = environmentDraftSchema.parse(source.value),
      checksum = source.working.checksum;
    if (input.versionId) {
      const version = source.item.versions.find((v) => v.id === input.versionId && v.versionNumber > 0);
      if (!version) throw new Error("Choose an environment version.");
      const value = checkedEnvironmentVersion(version, input.definitionId);
      if (canonicalChecksum(value) !== version.checksum) throw new Error("Environment version integrity failed.");
      document = value.content;
      checksum = version.checksum;
    }
    if (!document.room) throw new Error("This environment has no constructed room yet.");
    const next = draftSchema.parse(structuredClone(input.draft));
    const before = next.content.studio?.environment;
    if (before) {
      const old = syntheticRoomGeometry({ ...before, horizontal: true, vertical: true });
      const fresh = syntheticRoomGeometry({ ...document.room, horizontal: true, vertical: true });
      const unsafe = boundRoomSurfaceIds(next.content).filter((id) => {
        const a = old.find((p) => p.id === id),
          b = fresh.find((p) => p.id === id);
        return (
          !a ||
          !b ||
          canonicalChecksum({ position: a.position, size: a.size, rotation: a.rotation ?? null, face: a.face }) !==
            canonicalChecksum({ position: b.position, size: b.size, rotation: b.rotation ?? null, face: b.face })
        );
      });
      if (unsafe.length)
        throw new Error(
          `This environment changes or removes ${unsafe.length} attached support surface(s). Move the affected assets to another support or detach them before updating. The saved scene is unchanged.`,
        );
    }
    next.content.studio!.environment = structuredClone(document.room);
    next.content.studio!.environmentBinding = {
      definitionId: document.id,
      versionId: input.versionId ?? null,
      revision: source.item.currentVersionNumber,
      checksum,
      usedAt: new Date().toISOString(),
      policy: "INDEPENDENT_PINNED_SNAPSHOT",
    };
    if (before)
      for (const frame of next.content.studio!.surfacePreviewFrames ?? [])
        if (frame.environmentId === before.id) frame.environmentId = document.room.id;
    const errors = validateSpatialAuthoring(next.content).filter((f) => f.severity === "ERROR");
    if (errors.length)
      throw new Error("Review the existing asset placement constraints before applying this environment.");
    return { draft: next, revision: await saveSpatialDraftInTransaction(accountId, next, input.revision, tx) };
  });
}

export async function restoreDefinitionVersion(
  accountId: string,
  id: string,
  revision: number,
  versionId: string,
  store: PrismaClient = db,
) {
  return store.$transaction(async (tx) => {
    const source = await owned(tx, accountId, id);
    const version = source.item.versions.find((v) => v.id === versionId && v.versionNumber > 0);
    if (!version) throw new Error("Choose an immutable version belonging to this definition.");
    if (isEnvironment(source.value)) {
      const value = checkedEnvironmentVersion(version, id);
      if (canonicalChecksum(value) !== version.checksum) throw new Error("Version integrity failed.");
      return { revision: await saveEnvironmentDraftInTransaction(accountId, value.content, revision, tx) };
    }
    const { validateSpatialMoment } = await import("./publication");
    const moment = validateSpatialMoment(JSON.parse(version.envelope));
    if (
      moment.definition.id !== id ||
      moment.definition.ownerPersonId !== accountId ||
      moment.version.checksum !== version.checksum
    )
      throw new Error("Version binding failed.");
    const { checksum: _checksum, ...content } = moment.version;
    void _checksum;
    const draft = draftSchema.parse({
      ...source.value,
      content: { ...content, id: `${id}:draft`, semanticVersion: "1.0.0" },
    });
    return { revision: await saveSpatialDraftInTransaction(accountId, draft, revision, tx) };
  });
}

/** Legacy ACTIVE is classified on read; explicit reconciliation changes status only, once. No merging by title/geometry. */
export async function reconcileLegacySpatialMembership(accountId: string, store: PrismaClient = db) {
  return store.$transaction(async (tx) => {
    const items = await tx.reusableAuthoringItem.findMany({
      where: { ownerAccountId: accountId, kind: spatialItemKind, status: "ACTIVE" },
      include: { versions: { select: { versionNumber: true } } },
    });
    let migrated = 0;
    for (const item of items) {
      const result = await tx.reusableAuthoringItem.updateMany({
        where: {
          id: item.id,
          ownerAccountId: accountId,
          status: "ACTIVE",
          currentVersionNumber: item.currentVersionNumber,
        },
        data: {
          status: item.versions.some((v) => v.versionNumber > 0) ? "SAVED" : "LEGACY_REVIEW",
          currentVersionNumber: { increment: 1 },
        },
      });
      migrated += result.count;
    }
    return { migrated, preserved: items.length, deleted: 0 };
  });
}

export async function spatialLibraryInventory(accountId: string) {
  const [items, environments] = await Promise.all([
    listSpatialItems(accountId, true),
    listEnvironmentDefinitions(accountId),
  ]);
  const uses = new Map<string, { ids: Set<string>; last: string | null; versions: Map<string, Set<string>> }>();
  for (const scene of items) {
    const studios = [scene.draft.content.studio, ...scene.releases.map((v) => v.studio)];
    const bindings = studios.flatMap((studio) => [
      ...(studio?.assetInstances ?? []).map((i) => ({
        definitionId: i.definitionId,
        versionId: i.versionId,
        at: i.insertedAt ?? null,
      })),
      ...(studio?.environmentBinding ? [{ ...studio.environmentBinding, at: studio.environmentBinding.usedAt }] : []),
    ]);
    for (const binding of bindings) {
      const use = uses.get(binding.definitionId) ?? {
        ids: new Set<string>(),
        last: null,
        versions: new Map<string, Set<string>>(),
      };
      use.ids.add(scene.id);
      if (binding.at && (!use.last || binding.at > use.last)) use.last = binding.at;
      if (binding.versionId) {
        const ids = use.versions.get(binding.versionId) ?? new Set<string>();
        ids.add(scene.id);
        use.versions.set(binding.versionId, ids);
      }
      uses.set(binding.definitionId, use);
    }
  }
  const pinned = await db.reusableAuthoringUsage.findMany({
    where: { item: { ownerAccountId: accountId, kind: spatialItemKind } },
    select: { itemId: true, versionId: true, draftId: true, createdAt: true },
  });
  for (const row of pinned) {
    const use = uses.get(row.itemId) ?? {
      ids: new Set<string>(),
      last: null,
      versions: new Map<string, Set<string>>(),
    };
    const id = `chronicle:${row.draftId}`;
    use.ids.add(id);
    const at = row.createdAt.toISOString();
    if (!use.last || at > use.last) use.last = at;
    const ids = use.versions.get(row.versionId) ?? new Set<string>();
    ids.add(id);
    use.versions.set(row.versionId, ids);
    uses.set(row.itemId, use);
  }
  for (const record of items) {
    record.lastUsedAt = uses.get(record.id)?.last ?? null;
    record.usageCount = uses.get(record.id)?.ids.size ?? 0;
    for (const version of record.releaseMetadata ?? [])
      version.usageCount = uses.get(record.id)?.versions.get(version.id)?.size ?? 0;
  }
  for (const record of environments) {
    const use = uses.get(record.id);
    record.usageCount = use?.ids.size ?? 0;
    record.lastUsedAt = use?.last ?? null;
    for (const version of record.releases) version.usageCount = use?.versions.get(version.id)?.size ?? 0;
  }
  return { items, environments };
}
