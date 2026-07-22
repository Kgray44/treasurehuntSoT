import { createHash } from "node:crypto";
import { getBlockDefinition } from "@/chronicle/block-registry";
import { studioDraftSchema } from "@/chronicle/studio-service";
import type { JsonObject, PublishedTaleSnapshot, StudioDraftInput } from "@/chronicle/types";
import { db } from "@/lib/db";
import { privateFailure, sha256, type PrivatePackageAsset, type PrivatePayload } from "./core";

/**
 * Chronicle materialization is intentionally a projection into One Voyage's
 * existing models.  It does not create a TaleSession, invitation, Community
 * record, or a second private story model.
 */
export type PrivateMaterializationInput = {
  importId: string;
  payload: PrivatePayload;
  ownerActorId: string;
  ownerAccountId?: string | null;
  /** A slug collision must be consciously resolved by the caller. */
  slugConflict?: "reject" | "remap";
  /** Injectable only for isolated tests and durable workers. */
  client?: typeof db;
};

export type PrivateMaterializationReceipt = {
  taleIds: string[];
  draftIds: string[];
  versionIds: string[];
  mappings: Array<{ sourceLogicalId: string; targetId: string; kind: string }>;
  warnings: string[];
};

type ImportedLocation = Record<string, unknown> & { logicalId?: string; name?: string; slug?: string };
type ImportedArtifact = Record<string, unknown> & { logicalId?: string; name?: string; legacyKey?: string };
type NormalizedTale = {
  logicalId: string;
  draft: StudioDraftInput;
  locations: ImportedLocation[];
  artifacts: ImportedArtifact[];
  sourcePublishedAt?: string;
};

type PlanTale = NormalizedTale & { taleId: string; draftId: string; slug: string; versionId?: string };
export type PrivateMaterializationPlan = {
  tales: PlanTale[];
  assets: Array<{ asset: PrivatePackageAsset; assetId: string; variantId: string }>;
  mappings: Array<{ sourceLogicalId: string; targetId: string; kind: string }>;
  /** Source IDs that may occur in Studio configuration fields. */
  references: Record<string, string>;
  warnings: string[];
};

function stableId(importId: string, kind: string, logicalId: string) {
  return `sh_${createHash("sha256").update(`${importId}:${kind}:${logicalId}`).digest("hex").slice(0, 28)}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function jsonEntry(payload: PrivatePayload, contentPath: string) {
  const raw = payload.entries[contentPath];
  if (!raw) throw privateFailure("PRIVATE_PACKAGE_INVALID");
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (!isObject(parsed)) throw new Error("not an object");
    return parsed;
  } catch {
    throw privateFailure("PRIVATE_PACKAGE_INVALID");
  }
}

function snapshotDraft(value: Record<string, unknown>): { draft: StudioDraftInput; publishedAt?: string } | null {
  if (value.schemaVersion !== 1 || !isObject(value.tale) || !Array.isArray(value.chapters)) return null;
  const snapshot = value as unknown as PublishedTaleSnapshot;
  return {
    draft: studioDraftSchema.parse({
      autosaveVersion: 1,
      tale: { ...snapshot.tale, visibility: "PRIVATE" },
      chapters: snapshot.chapters.map((chapter) => ({
        ...chapter,
        blocks: chapter.blocks.map((block) => ({
          ...block,
          // Connections are derived from canonical Studio fields below.
          connections: undefined,
        })),
      })),
    }),
    publishedAt: snapshot.publishedAt,
  };
}

function extractTale(content: Record<string, unknown>, logicalId: string): NormalizedTale {
  const selected = Array.isArray(content.tales)
    ? content.tales.find((item) => isObject(item) && (item.logicalId === logicalId || item.id === logicalId))
    : content;
  if (!isObject(selected)) throw privateFailure("PRIVATE_PACKAGE_INVALID");
  const root = isObject(selected.content) ? selected.content : selected;
  const snapshot = snapshotDraft(isObject(root.snapshot) ? root.snapshot : root);
  const draftSource = snapshot?.draft ?? (isObject(root.draft) ? root.draft : root);
  let draft: StudioDraftInput;
  try {
    draft = studioDraftSchema.parse({
      ...draftSource,
      autosaveVersion: 1,
      tale: { ...(draftSource as any).tale, visibility: "PRIVATE" },
    });
  } catch {
    throw privateFailure("PRIVATE_PACKAGE_INVALID");
  }
  return {
    logicalId,
    draft,
    locations: Array.isArray(root.locations) ? root.locations.filter(isObject) : [],
    artifacts: Array.isArray(root.artifacts) ? root.artifacts.filter(isObject) : [],
    sourcePublishedAt: snapshot?.publishedAt,
  };
}

export function normalizePrivatePackageTales(payload: PrivatePayload): NormalizedTale[] {
  const parsed = payload.manifest.tales.map((manifestTale) =>
    extractTale(jsonEntry(payload, manifestTale.contentPath), manifestTale.logicalId),
  );
  if (!parsed.length) throw privateFailure("PRIVATE_PACKAGE_INVALID");
  return parsed;
}

function addMapping(
  mappings: Array<{ sourceLogicalId: string; targetId: string; kind: string }>,
  seen: Set<string>,
  sourceLogicalId: string,
  targetId: string,
  kind: string,
) {
  if (seen.has(sourceLogicalId))
    throw privateFailure("PRIVATE_PACKAGE_CONFLICT", "The package reuses a logical identifier.");
  seen.add(sourceLogicalId);
  mappings.push({ sourceLogicalId, targetId, kind });
}

function remapValues(value: unknown, ids: Map<string, string>): unknown {
  if (typeof value === "string") return ids.get(value) ?? value;
  if (Array.isArray(value)) return value.map((item) => remapValues(item, ids));
  if (isObject(value))
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, remapValues(item, ids)]));
  return value;
}

function remappedSlug(source: string, importId: string) {
  const suffix = `-private-${sha256(importId).slice(0, 8)}`;
  return `${source.slice(0, Math.max(3, 80 - suffix.length))}${suffix}`;
}

/** Builds stable IDs and checks the Studio registry before any database write. */
export function buildPrivateMaterializationPlan(
  input: Omit<PrivateMaterializationInput, "client">,
): PrivateMaterializationPlan {
  const tales = normalizePrivatePackageTales(input.payload);
  const mappings: PrivateMaterializationPlan["mappings"] = [];
  const seen = new Set<string>();
  const references = new Map<string, string>();
  const rememberReference = (source: string, target: string) => {
    if (references.has(source))
      throw privateFailure("PRIVATE_PACKAGE_CONFLICT", "The package reuses a logical reference identifier.");
    references.set(source, target);
  };
  const planTales: PlanTale[] = [];
  const warnings: string[] = [];
  for (const tale of tales) {
    const taleKey = `tale:${tale.logicalId}`;
    const taleId = stableId(input.importId, "tale", tale.logicalId);
    const draftId = stableId(input.importId, "draft", tale.logicalId);
    addMapping(mappings, seen, taleKey, taleId, "CHRONICLE");
    addMapping(mappings, seen, `draft:${tale.logicalId}`, draftId, "TALE_DRAFT");
    for (const chapter of tale.draft.chapters) {
      const chapterKey = `chapter:${tale.logicalId}:${chapter.id}`;
      const chapterId = stableId(input.importId, "chapter", chapterKey);
      addMapping(mappings, seen, chapterKey, chapterId, "TALE_CHAPTER");
      rememberReference(chapter.id, chapterId);
      for (const block of chapter.blocks) {
        if (!getBlockDefinition(block.blockType))
          throw privateFailure("PRIVATE_PACKAGE_INVALID", "The package contains an unrecognized Studio block.");
        const definition = getBlockDefinition(block.blockType)!;
        if (!definition.validationSchema.safeParse(block.configuration).success)
          throw privateFailure("PRIVATE_PACKAGE_INVALID", "The package contains an invalid Studio block.");
        const blockKey = `block:${tale.logicalId}:${block.id}`;
        const blockId = stableId(input.importId, "block", blockKey);
        addMapping(mappings, seen, blockKey, blockId, "STORY_BLOCK");
        rememberReference(block.id, blockId);
      }
    }
    for (const [index, location] of tale.locations.entries()) {
      const logicalId = String(location.logicalId ?? location.slug ?? `location-${index}`);
      const key = `location:${tale.logicalId}:${logicalId}`;
      const id = stableId(input.importId, "location", key);
      addMapping(mappings, seen, key, id, "TALE_LOCATION");
      rememberReference(logicalId, id);
    }
    for (const [index, artifact] of tale.artifacts.entries()) {
      const logicalId = String(artifact.logicalId ?? artifact.legacyKey ?? `artifact-${index}`);
      const key = `artifact:${tale.logicalId}:${logicalId}`;
      const id = stableId(input.importId, "artifact", key);
      addMapping(mappings, seen, key, id, "TALE_ARTIFACT");
      rememberReference(logicalId, id);
    }
    planTales.push({
      ...tale,
      taleId,
      draftId,
      slug: tale.draft.tale.slug,
      ...(input.payload.manifest.contentType === "published-tale"
        ? { versionId: stableId(input.importId, "version", tale.logicalId) }
        : {}),
    });
  }
  const assets = input.payload.manifest.assets.map((asset) => {
    const assetId = stableId(input.importId, "asset", asset.logicalId);
    const variantId = stableId(input.importId, "asset-variant", asset.logicalId);
    addMapping(mappings, seen, `asset:${asset.logicalId}`, assetId, "TALE_ASSET");
    rememberReference(asset.logicalId, assetId);
    return { asset, assetId, variantId };
  });
  for (const tale of planTales)
    if (input.payload.manifest.contentType === "published-tale" && tale.versionId)
      addMapping(mappings, seen, `version:${tale.logicalId}`, tale.versionId, "PUBLISHED_TALE_VERSION");
  if (input.payload.manifest.contentType === "tale-archive")
    warnings.push("Archive imported as private editable Chronicle drafts.");
  return { tales: planTales, assets, mappings, references: Object.fromEntries(references), warnings };
}

function mediaType(asset: PrivatePackageAsset) {
  return (
    {
      image: "IMAGE",
      audio: "AUDIO",
      video: "VIDEO",
      document: "DOCUMENT",
      "model-3d": "MODEL_3D",
      binary: "BINARY",
    } as const
  )[asset.representation];
}

function connectionsFor(
  tale: PlanTale,
  ids: Map<string, string>,
): Array<{
  sourceBlockId: string;
  targetBlockId: string;
  connectionType: string;
  label?: string;
  conditionExpression?: string;
  orderIndex: number;
}> {
  const blocks = tale.draft.chapters.flatMap((chapter) => chapter.blocks.filter((block) => block.isEnabled !== false));
  const all = new Set(blocks.map((block) => block.id));
  const rows: ReturnType<typeof connectionsFor> = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const sourceBlockId = ids.get(block.id)!;
    const configuration = block.configuration;
    const output: Array<{ target: string; type: string; label?: string; condition?: string }> = [];
    if (block.blockType === "choice" && Array.isArray(configuration.choices)) {
      for (const choice of configuration.choices) {
        const target = isObject(choice) && typeof choice.targetBlockId === "string" ? choice.targetBlockId : "";
        if (!all.has(target))
          throw privateFailure("PRIVATE_PACKAGE_INVALID", "The package contains a broken Studio connection.");
        output.push({ target, type: "CHOICE", label: isObject(choice) ? String(choice.label ?? "Choice") : "Choice" });
      }
    } else if (block.blockType === "condition") {
      for (const [field, type, result] of [
        ["successTargetBlockId", "SUCCESS", true],
        ["failureTargetBlockId", "FAILURE", false],
      ] as const) {
        const target = typeof configuration[field] === "string" ? configuration[field] : "";
        if (!all.has(target))
          throw privateFailure("PRIVATE_PACKAGE_INVALID", "The package contains a broken Studio connection.");
        output.push({ target, type, condition: JSON.stringify({ result }) });
      }
    }
    const fallback = blocks[index + 1]?.id;
    if (!output.length && fallback) output.push({ target: fallback, type: "DEFAULT" });
    output.forEach((connection, orderIndex) =>
      rows.push({
        sourceBlockId,
        targetBlockId: ids.get(connection.target)!,
        connectionType: connection.type,
        label: connection.label,
        conditionExpression: connection.condition,
        orderIndex,
      }),
    );
  }
  return rows;
}

function snapshotFor(
  tale: PlanTale,
  ids: Map<string, string>,
  assets: PrivateMaterializationPlan["assets"],
): PublishedTaleSnapshot {
  return {
    schemaVersion: 1,
    tale: {
      id: tale.taleId,
      slug: tale.slug,
      title: tale.draft.tale.title,
      subtitle: tale.draft.tale.subtitle ?? null,
      shortDescription: tale.draft.tale.shortDescription ?? null,
      longDescription: tale.draft.tale.longDescription ?? null,
      coverAssetId: remapAsset(tale.draft.tale.coverAssetId, ids),
      theme: tale.draft.tale.theme ?? "CARTOGRAPHERS_TABLE",
      visibility: "PRIVATE",
      playerCountMin: tale.draft.tale.playerCountMin ?? 1,
      playerCountMax: tale.draft.tale.playerCountMax ?? 4,
      estimatedDuration: tale.draft.tale.estimatedDuration ?? null,
      contentWarnings: tale.draft.tale.contentWarnings ?? null,
    } as PublishedTaleSnapshot["tale"],
    chapters: tale.draft.chapters.map((chapter, chapterIndex) => ({
      ...chapter,
      id: ids.get(chapter.id)!,
      orderIndex: chapterIndex,
      entryBlockId: chapter.blocks[0] ? ids.get(chapter.blocks[0].id)! : null,
      completionBlockId:
        ids.get(
          [...chapter.blocks].reverse().find((block) => ["chapterComplete", "taleComplete"].includes(block.blockType))
            ?.id ?? "",
        ) ?? null,
      blocks: chapter.blocks.map((block, blockIndex) => ({
        ...block,
        id: ids.get(block.id)!,
        chapterId: ids.get(chapter.id)!,
        configuration: remapValues(block.configuration, ids) as JsonObject,
        presentation: (block.presentation ?? {}) as JsonObject,
        completion: (block.completion ?? {}) as JsonObject,
        orderIndex: blockIndex,
        nextBlockId: null,
        connections: [],
      })),
    })),
    assets: assets.map(({ asset, assetId }) => ({
      id: assetId,
      mediaType: mediaType(asset),
      displayName: asset.relativePath.split("/").at(-1) ?? asset.logicalId,
      description: null,
      mimeType: asset.mediaType,
      width: null,
      height: null,
      roles: ["SEALED_HOLD_PRIVATE"],
      variants: [
        {
          id: assets.find((item) => item.asset.logicalId === asset.logicalId)?.variantId ?? "",
          role: "SEALED_HOLD_PRIVATE",
          mimeType: asset.mediaType,
          processingState: "PENDING_PRIVATE_AUTHORIZATION",
        },
      ],
    })),
    locations: tale.locations.map((location) => remapValues(location, ids) as Record<string, unknown>),
    artifacts: tale.artifacts.map((artifact) => remapValues(artifact, ids) as Record<string, unknown>),
    publishedAt: tale.sourcePublishedAt ?? new Date(0).toISOString(),
  };
}

/**
 * Transactionally creates One Voyage records after the worker has authenticated,
 * normalized, and scanned the private package.  The caller must run the current
 * draft validator after this returns; published imports are only versioned when
 * their source snapshot has already passed the same block-level validation.
 */
export async function materializePrivatePackage(
  input: PrivateMaterializationInput,
): Promise<PrivateMaterializationReceipt> {
  const client = input.client ?? db;
  const plan = buildPrivateMaterializationPlan(input);
  const existingSlugs = await client.chronicle.findMany({
    where: { slug: { in: plan.tales.map((tale) => tale.slug) } },
    select: { slug: true },
  });
  const occupied = new Set(existingSlugs.map((row) => row.slug));
  for (const tale of plan.tales) {
    if (!occupied.has(tale.slug)) continue;
    if (input.slugConflict !== "remap")
      throw privateFailure(
        "PRIVATE_PACKAGE_CONFLICT",
        "A private Chronicle address is already in use. Resolve the conflict before confirming import.",
      );
    const source = tale.slug;
    tale.slug = remappedSlug(source, input.importId);
    plan.warnings.push(`Remapped conflicting private Chronicle address ${source}.`);
  }
  return client.$transaction(async (tx) => {
    const previous = await tx.privateContentImportMapping.findMany({ where: { importId: input.importId } });
    if (previous.length) {
      const taleIds = previous.filter((row: any) => row.kind === "CHRONICLE").map((row: any) => row.targetId);
      return {
        taleIds,
        draftIds: previous.filter((row: any) => row.kind === "TALE_DRAFT").map((row: any) => row.targetId),
        versionIds: previous
          .filter((row: any) => row.kind === "PUBLISHED_TALE_VERSION")
          .map((row: any) => row.targetId),
        mappings: previous,
        warnings: [],
      };
    }
    const ids = new Map<string, string>(Object.entries(plan.references));
    for (const { asset, assetId, variantId } of plan.assets) {
      const ownerTale = plan.tales[0];
      await tx.taleAsset.create({
        data: {
          id: assetId,
          taleId: ownerTale.taleId,
          mediaType: mediaType(asset),
          displayName: asset.relativePath.split("/").at(-1) ?? asset.logicalId,
          originalFilename: asset.relativePath.split("/").at(-1) ?? asset.logicalId,
          mimeType: asset.mediaType,
          fileSize: asset.byteLength,
          checksum: asset.sha256,
          createdBy: input.ownerActorId,
          createdByAccountId: input.ownerAccountId ?? null,
        },
      });
      await tx.taleAssetVariant.create({
        data: {
          id: variantId,
          assetId,
          role: "SEALED_HOLD_PRIVATE",
          storageKey: `sealed-hold/${input.importId}/${asset.sha256}`,
          mimeType: asset.mediaType,
          fileSize: asset.byteLength,
          checksum: asset.sha256,
          processingState: "PENDING_PRIVATE_AUTHORIZATION",
        },
      });
      await tx.taleAsset.update({ where: { id: assetId }, data: { currentVariantId: variantId } });
      await tx.taleAssetRole.create({ data: { assetId, role: "SEALED_HOLD_PRIVATE" } });
      await tx.privateAssetReference.updateMany({
        where: { importId: input.importId, logicalId: asset.logicalId },
        data: { taleId: ownerTale.taleId, visibility: "PRIVATE", revealState: "LOCKED" },
      });
    }
    for (const tale of plan.tales) {
      await tx.chronicle.create({
        data: {
          id: tale.taleId,
          slug: tale.slug,
          title: tale.draft.tale.title,
          subtitle: tale.draft.tale.subtitle || null,
          shortDescription: tale.draft.tale.shortDescription || null,
          longDescription: tale.draft.tale.longDescription || null,
          theme: tale.draft.tale.theme ?? "CARTOGRAPHERS_TABLE",
          status: "DRAFT",
          visibility: "PRIVATE",
          creatorId: input.ownerActorId,
          creatorAccountId: input.ownerAccountId ?? null,
          playerCountMin: tale.draft.tale.playerCountMin ?? 1,
          playerCountMax: tale.draft.tale.playerCountMax ?? 4,
          estimatedDuration: tale.draft.tale.estimatedDuration ?? null,
          contentWarnings: tale.draft.tale.contentWarnings || null,
        },
      });
      await tx.taleDraft.create({
        data: {
          id: tale.draftId,
          taleId: tale.taleId,
          createdBy: input.ownerActorId,
          createdByAccountId: input.ownerAccountId ?? null,
          validationState: "STALE",
        },
      });
      for (const [chapterIndex, chapter] of tale.draft.chapters.entries()) {
        const chapterId = ids.get(chapter.id)!;
        await tx.taleChapter.create({
          data: {
            id: chapterId,
            draftRevisionId: tale.draftId,
            title: chapter.title,
            subtitle: chapter.subtitle || null,
            description: chapter.description || null,
            orderIndex: chapterIndex,
            coverAssetId: (remapValues(chapter.coverAssetId ?? null, ids) as string | null) ?? null,
            estimatedDuration: chapter.estimatedDuration ?? null,
            entryBlockId: chapter.blocks[0] ? ids.get(chapter.blocks[0].id)! : null,
            completionBlockId:
              ids.get(
                [...chapter.blocks]
                  .reverse()
                  .find((block) => ["chapterComplete", "taleComplete"].includes(block.blockType))?.id ?? "",
              ) ?? null,
            isOptional: chapter.isOptional ?? false,
            metadata: JSON.stringify(remapValues(chapter.metadata ?? {}, ids)),
          },
        });
        for (const [blockIndex, block] of chapter.blocks.entries())
          await tx.storyBlock.create({
            data: {
              id: ids.get(block.id)!,
              chapterId,
              blockType: block.blockType,
              title: block.title,
              internalLabel: block.internalLabel || null,
              orderIndex: blockIndex,
              configuration: JSON.stringify(remapValues(block.configuration, ids)),
              presentation: JSON.stringify(remapValues(block.presentation ?? {}, ids)),
              completion: JSON.stringify(remapValues(block.completion ?? {}, ids)),
              creatorNotes: block.creatorNotes || null,
              isEnabled: block.isEnabled ?? true,
              schemaVersion: block.schemaVersion ?? 1,
            },
          });
      }
      for (const connection of connectionsFor(tale, ids)) await tx.blockConnection.create({ data: connection });
      for (const [index, location] of tale.locations.entries()) {
        const logicalId = String(location.logicalId ?? location.slug ?? `location-${index}`);
        await tx.taleLocation.create({
          data: {
            id: ids.get(logicalId)!,
            taleId: tale.taleId,
            name: String(location.name ?? logicalId),
            slug: String(location.slug ?? logicalId).toLowerCase(),
            region: stringOrNull(location.region),
            generalDescription: stringOrNull(location.generalDescription),
            playerFacingDescription: stringOrNull(location.playerFacingDescription),
            captainNotes: stringOrNull(location.captainNotes),
            legacyKey: logicalId,
            locationType: stringOrNull(location.locationType) ?? "STORY",
            safeLabel: stringOrNull(location.safeLabel),
            exactness: stringOrNull(location.exactness) ?? "APPROXIMATE",
            orderIndex: index,
            verificationProfile: JSON.stringify(remapValues(location.verificationProfile ?? {}, ids)),
          },
        });
      }
      for (const [index, artifact] of tale.artifacts.entries()) {
        const logicalId = String(artifact.logicalId ?? artifact.legacyKey ?? `artifact-${index}`);
        await tx.taleArtifact.create({
          data: {
            id: ids.get(logicalId)!,
            taleId: tale.taleId,
            name: String(artifact.name ?? logicalId),
            shortDescription: stringOrNull(artifact.shortDescription),
            loreDescription: stringOrNull(artifact.loreDescription),
            ordinaryGameObjectLabel: stringOrNull(artifact.ordinaryGameObjectLabel),
            artworkAssetId: remapAsset(artifact.artworkAssetId, ids),
            revealVideoAssetId: remapAsset(artifact.revealVideoAssetId, ids),
            modelAssetId: remapAsset(artifact.modelAssetId, ids),
            inventoryCategory: stringOrNull(artifact.inventoryCategory) ?? "RELIC",
            collectionGroup: stringOrNull(artifact.collectionGroup),
            legacyKey: logicalId,
            safeName: stringOrNull(artifact.safeName),
            silhouetteLabel: stringOrNull(artifact.silhouetteLabel),
            sortOrder: index,
            persistentAfterUnlock: artifact.persistentAfterUnlock !== false,
          },
        });
      }
      await tx.chronicle.update({
        where: { id: tale.taleId },
        data: { currentDraftRevisionId: tale.draftId, coverAssetId: remapAsset(tale.draft.tale.coverAssetId, ids) },
      });
      if (tale.versionId) {
        const contentSnapshot = JSON.stringify(snapshotFor(tale, ids, plan.assets));
        await tx.publishedTaleVersion.create({
          data: {
            id: tale.versionId,
            taleId: tale.taleId,
            versionNumber: 1,
            versionLabel: "imported-1.0",
            publishedBy: input.ownerActorId,
            publishedByAccountId: input.ownerAccountId ?? null,
            releaseNotes: "Private source package snapshot; not published or released.",
            contentSnapshot,
            checksum: sha256(contentSnapshot),
            isCurrent: false,
          },
        });
      }
    }
    await tx.privateContentImportMapping.createMany({
      data: plan.mappings.map((mapping) => ({ importId: input.importId, ...mapping })),
    });
    await (tx as any).privateContentImport.update({
      where: { id: input.importId },
      data: {
        sourceTaleId: plan.tales[0]?.taleId ?? null,
        importedTaleIds: JSON.stringify(plan.tales.map((tale) => tale.taleId)),
        materializationStatus: "COMPLETED",
        warnings: JSON.stringify(plan.warnings),
      },
    });
    return {
      taleIds: plan.tales.map((tale) => tale.taleId),
      draftIds: plan.tales.map((tale) => tale.draftId),
      versionIds: plan.tales.flatMap((tale) => (tale.versionId ? [tale.versionId] : [])),
      mappings: plan.mappings,
      warnings: plan.warnings,
    };
  });
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function remapAsset(value: unknown, ids: Map<string, string>) {
  return typeof value === "string" ? (ids.get(value) ?? null) : null;
}
