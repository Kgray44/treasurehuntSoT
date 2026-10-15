import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { canonicalChecksum } from "@/drydock/canonical";
import { DraftConflictError } from "@/chronicle/studio-service";
import { environmentReferenceSchema } from "./environment-reference";
import { libraryCreationSchema } from "./library-lifecycle-contracts";
import { environmentContentSchema, type EnvironmentContent } from "./legacy-scene-environment-contracts";
import {
  checkedLegacyEnvironmentWorking,
  createLegacyEnvironmentWorking,
  legacyEnvironmentMembership,
  legacyEnvironmentWorkingRowId,
  legacyEnvironmentWorkingSchema,
  materializeLegacyEnvironmentVersion,
  type LegacyEnvironmentWorking,
} from "./legacy-environment-working-contracts";
import { checkedLegacyEnvironmentRelease, resolvePinnedEnvironment } from "./environment-version-resolution";
import legacyBuiltinVersions from "./builtin-environments.v1.json";

export const legacyEnvironmentItemKind = "PARALLAX_ENVIRONMENT";
const definitionId = environmentContentSchema.shape.id;
const revision = z.number().int().nonnegative();
const operationId = libraryCreationSchema.shape.operationId;
export const legacyEnvironmentBeginSchema = z.strictObject({
  definitionId,
  revision,
  operationId,
  versionId: environmentReferenceSchema.shape.versionId.optional(),
});
export const legacyEnvironmentCopySchema = z.strictObject({
  source: environmentReferenceSchema,
  newId: definitionId,
  operationId,
  name: environmentContentSchema.shape.name,
  destination: z.enum(["WORKING", "SAVED"]).default("WORKING"),
});
export const legacyEnvironmentReleaseSchema = z.strictObject({
  definitionId,
  revision,
  operationId,
  contentChecksum: z.string().regex(/^[a-f0-9]{64}$/),
});

function assertEditableContent(content: EnvironmentContent) {
  if (content.id.startsWith("builtin:") || content.origin === "BUILTIN")
    throw new Error("Built-in Environments are immutable. Create an owned copy to edit.");
}

async function owned(tx: Prisma.TransactionClient, accountId: string, id: string, includeArchived = false) {
  const item = await tx.reusableAuthoringItem.findUnique({
    where: { id },
    include: { versions: { orderBy: { versionNumber: "desc" } } },
  });
  if (
    !item ||
    item.ownerAccountId !== accountId ||
    item.kind !== legacyEnvironmentItemKind ||
    (!includeArchived && item.archivedAt)
  )
    throw new Error("This Environment is unavailable to this Creator.");
  const workingRow = item.versions.find((row) => row.versionNumber === 0);
  const working = workingRow ? checkedLegacyEnvironmentWorking(workingRow, id) : null;
  const releases = item.versions
    .filter((row) => row.versionNumber > 0)
    .map((row) => checkedLegacyEnvironmentRelease(row, id));
  return { item, workingRow, working, releases };
}
type OwnedLegacyEnvironment = Awaited<ReturnType<typeof owned>>;

async function claim(
  tx: Prisma.TransactionClient,
  accountId: string,
  source: OwnedLegacyEnvironment,
  expectedRevision: number,
  data: Prisma.ReusableAuthoringItemUpdateManyMutationInput = {},
  includeArchived = false,
) {
  const claimed = await tx.reusableAuthoringItem.updateMany({
    where: {
      id: source.item.id,
      ownerAccountId: accountId,
      kind: legacyEnvironmentItemKind,
      currentVersionNumber: expectedRevision,
      ...(includeArchived ? {} : { archivedAt: null }),
    },
    data: { ...data, currentVersionNumber: { increment: 1 } },
  });
  if (!claimed.count) throw new DraftConflictError(source.item.currentVersionNumber);
  return expectedRevision + 1;
}

const result = (source: OwnedLegacyEnvironment, working: LegacyEnvironmentWorking | null, nextRevision: number) => ({
  revision: nextRevision,
  working,
  saveState: legacyEnvironmentMembership(source.item.status),
  archived: Boolean(source.item.archivedAt),
});

/** Explicit first edit adds v0 without touching any existing positive envelope. */
export async function beginLegacyEnvironmentEdit(accountId: string, raw: unknown, store: PrismaClient = db) {
  const input = legacyEnvironmentBeginSchema.parse(raw);
  if (input.definitionId.startsWith("builtin:"))
    throw new Error("Create an owned copy before editing a built-in Environment.");
  const requestDigest = canonicalChecksum({ action: "LEGACY_ENVIRONMENT_BEGIN", ...input });
  return store.$transaction(async (tx) => {
    const source = await owned(tx, accountId, input.definitionId);
    if (source.working?.creation.operationId === input.operationId) {
      if (source.working.creation.requestDigest !== requestDigest)
        throw new Error("This operation identity belongs to a different Environment request.");
      return result(source, source.working, source.item.currentVersionNumber);
    }
    if (source.item.currentVersionNumber !== input.revision)
      throw new DraftConflictError(source.item.currentVersionNumber);
    if (source.working) {
      if (input.versionId && source.working.source?.versionId !== input.versionId)
        throw new Error("An existing working copy is retained. Choose an explicit version copy to start elsewhere.");
      return result(source, source.working, input.revision);
    }
    const released = input.versionId
      ? source.releases.find((version) => version.reference.versionId === input.versionId)
      : source.releases.reduce<(typeof source.releases)[number] | null>(
          (best, version) => (!best || version.reference.revision > best.reference.revision ? version : best),
          null,
        );
    if (!released) throw new Error("Choose a verified Environment version before starting its working copy.");
    assertEditableContent(released.content);
    const document = createLegacyEnvironmentWorking(released.content, released.reference, {
      operationId: input.operationId,
      sourceDefinitionId: input.definitionId,
      sourceRevision: input.revision,
      requestDigest,
    });
    const nextRevision = await claim(tx, accountId, source, input.revision);
    await tx.reusableAuthoringItemVersion.create({
      data: {
        id: legacyEnvironmentWorkingRowId(document.id),
        itemId: document.id,
        versionNumber: 0,
        envelope: JSON.stringify(document),
        checksum: canonicalChecksum(document),
      },
    });
    return result(source, document, nextRevision);
  });
}

/** An immutable source and stable operation identity make owned copy retries safe. */
export async function copyLegacyEnvironment(accountId: string, raw: unknown, store: PrismaClient = db) {
  const input = legacyEnvironmentCopySchema.parse(raw);
  if (input.newId.startsWith("builtin:")) throw new Error("Choose a new owned Environment identity.");
  const requestDigest = canonicalChecksum({ action: "LEGACY_ENVIRONMENT_COPY", ...input });
  return store.$transaction(async (tx) => {
    const existing = await tx.reusableAuthoringItem.findUnique({ where: { id: input.newId } });
    if (existing) {
      const retained = await owned(tx, accountId, input.newId);
      if (
        retained.working?.creation.operationId !== input.operationId ||
        retained.working.creation.requestDigest !== requestDigest
      )
        throw new Error("This Environment identity belongs to another operation.");
      return result(retained, retained.working, retained.item.currentVersionNumber);
    }
    const resolved = await resolvePinnedEnvironment(accountId, input.source, tx);
    if (resolved.format !== "SC01_SCHEMA1")
      throw new Error("Use the existing Environment Save As flow for this room format.");
    const content = environmentContentSchema.parse({
      ...structuredClone(resolved.legacy),
      id: input.newId,
      name: input.name,
      origin: resolved.legacy.origin === "BUILTIN" ? "MANUAL" : resolved.legacy.origin,
      sourceLabel: `Owned copy of ${resolved.legacy.name}`,
    });
    assertEditableContent(content);
    const publicBuiltin = legacyBuiltinVersions.some(
      (version) => version.reference.environmentId === input.source.environmentId,
    );
    const parent = publicBuiltin
      ? null
      : await tx.reusableAuthoringItem.findUnique({ where: { id: input.source.environmentId } });
    if (!publicBuiltin && (!parent || parent.ownerAccountId !== accountId || parent.kind !== legacyEnvironmentItemKind))
      throw new Error("The source Environment is unavailable to this Creator.");
    const document = createLegacyEnvironmentWorking(content, input.source, {
      operationId: input.operationId,
      sourceDefinitionId: input.source.environmentId,
      sourceRevision: parent?.currentVersionNumber ?? 0,
      requestDigest,
    });
    await tx.reusableAuthoringItem.create({
      data: {
        id: document.id,
        ownerAccountId: accountId,
        kind: legacyEnvironmentItemKind,
        name: content.name,
        description: content.description,
        status: input.destination,
        currentVersionNumber: 1,
        versions: {
          create: {
            id: legacyEnvironmentWorkingRowId(document.id),
            versionNumber: 0,
            envelope: JSON.stringify(document),
            checksum: canonicalChecksum(document),
          },
        },
      },
    });
    return { revision: 1, working: document, saveState: input.destination, archived: false };
  });
}

/** Ordinary editor/autosave replaces only v0 and never creates a release/member. */
export async function saveLegacyEnvironmentWorking(
  accountId: string,
  raw: unknown,
  expectedRevision: number,
  store: PrismaClient = db,
) {
  const document = legacyEnvironmentWorkingSchema.parse(raw);
  assertEditableContent(document.content);
  const checksum = canonicalChecksum(document);
  return store.$transaction(async (tx) => {
    const source = await owned(tx, accountId, document.id);
    if (!source.working || !source.workingRow) throw new Error("Open this Environment's working copy before saving.");
    if (
      canonicalChecksum([source.working.creation, source.working.source]) !==
      canonicalChecksum([document.creation, document.source])
    )
      throw new Error("Environment creation and source lineage are immutable.");
    if (source.item.currentVersionNumber > expectedRevision && source.workingRow.checksum === checksum)
      return result(source, source.working, source.item.currentVersionNumber);
    const nextRevision = await claim(tx, accountId, source, expectedRevision, {
      name: document.content.name,
      description: document.content.description,
      ...(document.metadata.tags === null ? {} : { tags: JSON.stringify(document.metadata.tags) }),
    });
    await tx.reusableAuthoringItemVersion.update({
      where: { itemId_versionNumber: { itemId: document.id, versionNumber: 0 } },
      data: { envelope: JSON.stringify(document), checksum },
    });
    return result(source, document, nextRevision);
  });
}

/** Explicit releases use a replayable operation identity and a separate positive ordinal. */
export async function releaseLegacyEnvironmentVersion(accountId: string, raw: unknown, store: PrismaClient = db) {
  const input = legacyEnvironmentReleaseSchema.parse(raw);
  const operationPrefix = `legacy-env-release:${canonicalChecksum({ definitionId: input.definitionId, operationId: input.operationId })}:`;
  const versionId = operationPrefix + canonicalChecksum(input);
  return store.$transaction(async (tx) => {
    const source = await owned(tx, accountId, input.definitionId);
    const replay = source.releases.find((version) => version.reference.versionId.startsWith(operationPrefix));
    if (replay) {
      if (replay.reference.versionId !== versionId || replay.reference.checksum !== input.contentChecksum)
        throw new Error("This release operation identity belongs to a different request.");
      return { ...result(source, source.working, source.item.currentVersionNumber), version: replay, replayed: true };
    }
    if (source.item.currentVersionNumber !== input.revision)
      throw new DraftConflictError(source.item.currentVersionNumber);
    if (!source.working) throw new Error("Save a working Environment before creating a version.");
    assertEditableContent(source.working.content);
    if (canonicalChecksum(source.working.content) !== input.contentChecksum)
      throw new Error("The working Environment changed. Review it before creating this version.");
    const ordinal = Math.max(0, ...source.releases.map((version) => version.reference.revision)) + 1;
    const version = materializeLegacyEnvironmentVersion(source.working, ordinal, versionId);
    const nextRevision = await claim(tx, accountId, source, input.revision);
    await tx.reusableAuthoringItemVersion.create({
      data: {
        id: version.reference.versionId,
        itemId: input.definitionId,
        versionNumber: ordinal,
        envelope: JSON.stringify(version),
        checksum: version.reference.checksum,
      },
    });
    return { ...result(source, source.working, nextRevision), version, replayed: false };
  });
}

/** Membership is an explicit owner action, independent from working and release saves. */
export async function saveLegacyEnvironmentToLibrary(
  accountId: string,
  id: string,
  expectedRevision: number,
  store: PrismaClient = db,
) {
  return store.$transaction(async (tx) => {
    const source = await owned(tx, accountId, id);
    if (source.item.status === "SAVED")
      return { ...result(source, source.working, source.item.currentVersionNumber), saveState: "SAVED" as const };
    if (!source.working && !source.releases.length)
      throw new Error("Review Environment content before saving to Library.");
    const nextRevision = await claim(tx, accountId, source, expectedRevision, { status: "SAVED" });
    return { ...result(source, source.working, nextRevision), saveState: "SAVED" as const };
  });
}

export async function archiveLegacyEnvironment(
  accountId: string,
  id: string,
  expectedRevision: number,
  archived: boolean,
  store: PrismaClient = db,
) {
  return store.$transaction(async (tx) => {
    const source = await owned(tx, accountId, id, true);
    if (Boolean(source.item.archivedAt) === archived)
      return result(source, source.working, source.item.currentVersionNumber);
    const nextRevision = await claim(
      tx,
      accountId,
      source,
      expectedRevision,
      { archivedAt: archived ? new Date() : null },
      true,
    );
    return { ...result(source, source.working, nextRevision), archived };
  });
}
