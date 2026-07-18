import { z } from "zod";
import { db } from "@/lib/db";
import { getBlockDefinition, serializeBlockRegistry } from "@/tall-tale/block-registry";
import type { JsonObject, PublishedTaleSnapshot, StudioDraftInput } from "@/tall-tale/types";
import { parseJsonObject } from "@/tall-tale/types";

export const slugSchema = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens.");

export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

const blockInputSchema = z.object({
  id: z.string().min(8).max(128),
  blockType: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  internalLabel: z.string().max(160).nullish(),
  configuration: z.record(z.string(), z.unknown()),
  presentation: z.record(z.string(), z.unknown()).optional(),
  completion: z.record(z.string(), z.unknown()).optional(),
  creatorNotes: z.string().max(10000).nullish(),
  isEnabled: z.boolean().optional(),
  schemaVersion: z.number().int().min(1).max(100).optional(),
});

export const studioDraftSchema = z.object({
  autosaveVersion: z.number().int().min(1),
  tale: z.object({
    title: z.string().min(1).max(160),
    slug: slugSchema,
    subtitle: z.string().max(240).nullish(),
    shortDescription: z.string().max(600).nullish(),
    longDescription: z.string().max(20000).nullish(),
    coverAssetId: z.string().max(128).nullish(),
    theme: z.string().max(80).optional(),
    visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]).optional(),
    playerCountMin: z.number().int().min(1).max(20).optional(),
    playerCountMax: z.number().int().min(1).max(20).optional(),
    estimatedDuration: z.number().int().min(1).max(10000).nullish(),
    contentWarnings: z.string().max(4000).nullish(),
  }),
  chapters: z
    .array(
      z.object({
        id: z.string().min(8).max(128),
        title: z.string().min(1).max(160),
        subtitle: z.string().max(240).nullish(),
        description: z.string().max(10000).nullish(),
        coverAssetId: z.string().max(128).nullish(),
        estimatedDuration: z.number().int().min(1).max(10000).nullish(),
        isOptional: z.boolean().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
        blocks: z.array(blockInputSchema).max(1000),
      }),
    )
    .max(200),
});

export class DraftConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super("This draft changed in another window. Your unsaved work has been preserved in this browser.");
  }
}

function publicAsset(asset: Awaited<ReturnType<typeof db.taleAsset.findFirstOrThrow>>) {
  return asset;
}

export async function listStudioTales() {
  const tales = await db.tallTale.findMany({
    orderBy: [{ archivedAt: "asc" }, { updatedAt: "desc" }],
    include: {
      drafts: { orderBy: { revisionNumber: "desc" }, take: 1 },
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      _count: { select: { sessions: true, assets: true } },
    },
  });
  return tales.map((tale) => ({
    id: tale.id,
    slug: tale.slug,
    title: tale.title,
    subtitle: tale.subtitle,
    shortDescription: tale.shortDescription,
    coverAssetId: tale.coverAssetId,
    status: tale.archivedAt
      ? "ARCHIVED"
      : tale.latestPublishedVersionId
        ? tale.drafts[0]?.updatedAt > (tale.versions[0]?.publishedAt ?? new Date(0))
          ? "PUBLISHED_WITH_CHANGES"
          : "PUBLISHED"
        : "DRAFT",
    visibility: tale.visibility,
    updatedAt: tale.updatedAt.toISOString(),
    savedAt: tale.drafts[0]?.updatedAt.toISOString() ?? tale.updatedAt.toISOString(),
    validationState: tale.drafts[0]?.validationState ?? "NOT_VALIDATED",
    latestVersion: tale.versions[0]?.versionLabel ?? null,
    sessionCount: tale._count.sessions,
    assetCount: tale._count.assets,
  }));
}

export async function createStudioTale(input: {
  title: string;
  slug?: string;
  subtitle?: string;
  shortDescription?: string;
  longDescription?: string;
  theme?: string;
  playerCountMin?: number;
  playerCountMax?: number;
  estimatedDuration?: number;
  visibility?: "PRIVATE" | "UNLISTED" | "PUBLIC";
  initialChapterTitle?: string;
  creatorId: string;
}) {
  const slug = slugSchema.parse(input.slug?.trim() || slugify(input.title));
  return db.$transaction(async (tx) => {
    const tale = await tx.tallTale.create({
      data: {
        slug,
        title: input.title.trim(),
        subtitle: input.subtitle?.trim() || null,
        shortDescription: input.shortDescription?.trim() || null,
        longDescription: input.longDescription?.trim() || null,
        theme: input.theme ?? "CARTOGRAPHERS_TABLE",
        visibility: input.visibility ?? "PRIVATE",
        creatorId: input.creatorId,
        playerCountMin: input.playerCountMin ?? 1,
        playerCountMax: input.playerCountMax ?? 4,
        estimatedDuration: input.estimatedDuration ?? null,
      },
    });
    const draft = await tx.taleDraft.create({ data: { taleId: tale.id, createdBy: input.creatorId } });
    await tx.taleChapter.create({
      data: { draftRevisionId: draft.id, title: input.initialChapterTitle?.trim() || "Chapter One", orderIndex: 0 },
    });
    await tx.tallTale.update({ where: { id: tale.id }, data: { currentDraftRevisionId: draft.id } });
    return { id: tale.id, slug: tale.slug, draftId: draft.id };
  });
}

export async function getStudioTale(taleId: string) {
  const tale = await db.tallTale.findUniqueOrThrow({
    where: { id: taleId },
    include: {
      drafts: {
        orderBy: { revisionNumber: "desc" },
        take: 1,
        include: {
          chapters: {
            orderBy: { orderIndex: "asc" },
            include: {
              blocks: { orderBy: { orderIndex: "asc" }, include: { outgoing: { orderBy: { orderIndex: "asc" } } } },
            },
          },
        },
      },
      assets: {
        where: { deletedAt: null },
        orderBy: { updatedAt: "desc" },
        include: {
          variants: { orderBy: { createdAt: "desc" } },
          tags: { include: { tag: true } },
          roles: true,
          collectionItems: true,
        },
      },
      collections: { orderBy: { name: "asc" }, include: { items: { orderBy: { orderIndex: "asc" } } } },
      locations: { where: { archivedAt: null }, orderBy: { orderIndex: "asc" } },
      storyArtifacts: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } },
      versions: { orderBy: { versionNumber: "desc" }, include: { _count: { select: { sessions: true } } } },
    },
  });
  const draft = tale.drafts[0];
  if (!draft) throw new Error("The tale has no editable draft.");
  return {
    tale: {
      id: tale.id,
      slug: tale.slug,
      title: tale.title,
      subtitle: tale.subtitle,
      shortDescription: tale.shortDescription,
      longDescription: tale.longDescription,
      coverAssetId: tale.coverAssetId,
      theme: tale.theme,
      status: tale.status,
      visibility: tale.visibility,
      playerCountMin: tale.playerCountMin,
      playerCountMax: tale.playerCountMax,
      estimatedDuration: tale.estimatedDuration,
      contentWarnings: tale.contentWarnings,
      archivedAt: tale.archivedAt?.toISOString() ?? null,
      latestPublishedVersionId: tale.latestPublishedVersionId,
    },
    draft: {
      id: draft.id,
      revisionNumber: draft.revisionNumber,
      autosaveVersion: draft.autosaveVersion,
      validationState: draft.validationState,
      validationSummary: parseJsonObject(draft.validationSummary),
      savedAt: draft.updatedAt.toISOString(),
      chapters: draft.chapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        subtitle: chapter.subtitle,
        description: chapter.description,
        coverAssetId: chapter.coverAssetId,
        estimatedDuration: chapter.estimatedDuration,
        isOptional: chapter.isOptional,
        metadata: parseJsonObject(chapter.metadata),
        blocks: chapter.blocks.map((block) => ({
          id: block.id,
          blockType: block.blockType,
          title: block.title,
          internalLabel: block.internalLabel,
          configuration: parseJsonObject(block.configuration),
          presentation: parseJsonObject(block.presentation),
          completion: parseJsonObject(block.completion),
          creatorNotes: block.creatorNotes,
          isEnabled: block.isEnabled,
          schemaVersion: block.schemaVersion,
          connections: block.outgoing.map((connection) => ({
            targetBlockId: connection.targetBlockId,
            connectionType: connection.connectionType,
            label: connection.label,
            conditionExpression: connection.conditionExpression,
          })),
        })),
      })),
    },
    assets: tale.assets.map((asset) => ({
      ...publicAsset(asset),
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
      tags: asset.tags.map((link) => link.tag.name),
      roles: asset.roles.map((role) => role.role),
      variants: asset.variants.map((variant) => ({
        ...variant,
        createdAt: variant.createdAt.toISOString(),
        url: `/api/media/${asset.id}?variant=${variant.role}`,
      })),
    })),
    collections: tale.collections,
    locations: tale.locations.map((location) => ({
      ...location,
      verificationProfile: parseJsonObject(location.verificationProfile),
    })),
    artifacts: tale.storyArtifacts,
    versions: tale.versions.map((version) => ({
      id: version.id,
      versionNumber: version.versionNumber,
      versionLabel: version.versionLabel,
      publishedAt: version.publishedAt.toISOString(),
      publishedBy: version.publishedBy,
      releaseNotes: version.releaseNotes,
      isCurrent: version.isCurrent,
      activeSessions: version._count.sessions,
    })),
    registry: serializeBlockRegistry(),
  };
}

function json(value: unknown) {
  return JSON.stringify(value ?? {});
}

export async function saveStudioDraft(taleId: string, unchecked: StudioDraftInput, userId: string) {
  const input = studioDraftSchema.parse(unchecked);
  for (const chapter of input.chapters) {
    for (const block of chapter.blocks) {
      if (!getBlockDefinition(block.blockType)) throw new Error(`Unknown block type: ${block.blockType}`);
    }
  }
  return db.$transaction(async (tx) => {
    const tale = await tx.tallTale.findUniqueOrThrow({
      where: { id: taleId },
      include: { drafts: { orderBy: { revisionNumber: "desc" }, take: 1 } },
    });
    const draft = tale.drafts[0];
    if (!draft) throw new Error("The tale has no editable draft.");
    const reserved = await tx.tallTale.findFirst({
      where: { slug: input.tale.slug, id: { not: taleId } },
      select: { id: true },
    });
    if (reserved) throw new Error("That tale address is already in use.");
    const claimed = await tx.taleDraft.updateMany({
      where: { id: draft.id, autosaveVersion: input.autosaveVersion },
      data: {
        autosaveVersion: { increment: 1 },
        validationState: "STALE",
        validationSummary: "{}",
        lastValidatedAt: null,
      },
    });
    if (!claimed.count) {
      const current = await tx.taleDraft.findUniqueOrThrow({
        where: { id: draft.id },
        select: { autosaveVersion: true },
      });
      throw new DraftConflictError(current.autosaveVersion);
    }
    await tx.tallTale.update({
      where: { id: taleId },
      data: {
        title: input.tale.title,
        slug: input.tale.slug,
        subtitle: input.tale.subtitle || null,
        shortDescription: input.tale.shortDescription || null,
        longDescription: input.tale.longDescription || null,
        coverAssetId: input.tale.coverAssetId || null,
        theme: input.tale.theme ?? tale.theme,
        visibility: input.tale.visibility ?? tale.visibility,
        playerCountMin: input.tale.playerCountMin ?? tale.playerCountMin,
        playerCountMax: input.tale.playerCountMax ?? tale.playerCountMax,
        estimatedDuration: input.tale.estimatedDuration ?? null,
        contentWarnings: input.tale.contentWarnings || null,
        creatorId: tale.creatorId || userId,
      },
    });
    await tx.taleChapter.deleteMany({ where: { draftRevisionId: draft.id } });
    const flattened: Array<{ id: string; type: string; configuration: JsonObject }> = [];
    for (let chapterIndex = 0; chapterIndex < input.chapters.length; chapterIndex += 1) {
      const chapter = input.chapters[chapterIndex];
      const createdChapter = await tx.taleChapter.create({
        data: {
          id: chapter.id,
          draftRevisionId: draft.id,
          title: chapter.title,
          subtitle: chapter.subtitle || null,
          description: chapter.description || null,
          orderIndex: chapterIndex,
          coverAssetId: chapter.coverAssetId || null,
          estimatedDuration: chapter.estimatedDuration ?? null,
          entryBlockId: chapter.blocks[0]?.id ?? null,
          completionBlockId:
            [...chapter.blocks]
              .reverse()
              .find((block) => block.blockType === "chapterComplete" || block.blockType === "taleComplete")?.id ??
            chapter.blocks.at(-1)?.id ??
            null,
          isOptional: chapter.isOptional ?? false,
          metadata: json(chapter.metadata),
        },
      });
      for (let blockIndex = 0; blockIndex < chapter.blocks.length; blockIndex += 1) {
        const block = chapter.blocks[blockIndex];
        await tx.storyBlock.create({
          data: {
            id: block.id,
            chapterId: createdChapter.id,
            blockType: block.blockType,
            title: block.title,
            internalLabel: block.internalLabel || null,
            orderIndex: blockIndex,
            configuration: json(block.configuration),
            presentation: json(block.presentation),
            completion: json(block.completion),
            creatorNotes: block.creatorNotes || null,
            isEnabled: block.isEnabled ?? true,
            schemaVersion: block.schemaVersion ?? 1,
          },
        });
        if (block.isEnabled !== false)
          flattened.push({ id: block.id, type: block.blockType, configuration: block.configuration });
      }
    }
    const allBlockIds = new Set(flattened.map((block) => block.id));
    for (let index = 0; index < flattened.length; index += 1) {
      const block = flattened[index];
      const fallback = flattened[index + 1]?.id ?? null;
      const connections: Array<{ target: string; type: string; label?: string; condition?: string }> = [];
      if (block.type === "choice" && Array.isArray(block.configuration.choices)) {
        for (const choice of block.configuration.choices as Array<Record<string, unknown>>) {
          const target = typeof choice.targetBlockId === "string" ? choice.targetBlockId : "";
          if (allBlockIds.has(target))
            connections.push({ target, type: "CHOICE", label: String(choice.label ?? "Choice") });
        }
      } else if (block.type === "condition") {
        const success = String(block.configuration.successTargetBlockId ?? "");
        const failure = String(block.configuration.failureTargetBlockId ?? "");
        if (allBlockIds.has(success))
          connections.push({ target: success, type: "SUCCESS", condition: json({ result: true }) });
        if (allBlockIds.has(failure))
          connections.push({ target: failure, type: "FAILURE", condition: json({ result: false }) });
      }
      if (!connections.length && fallback) connections.push({ target: fallback, type: "DEFAULT" });
      await tx.storyBlock.update({ where: { id: block.id }, data: { nextBlockId: connections[0]?.target ?? null } });
      for (let connectionIndex = 0; connectionIndex < connections.length; connectionIndex += 1) {
        const connection = connections[connectionIndex];
        await tx.blockConnection.create({
          data: {
            sourceBlockId: block.id,
            targetBlockId: connection.target,
            connectionType: connection.type,
            label: connection.label,
            conditionExpression: connection.condition,
            orderIndex: connectionIndex,
          },
        });
      }
    }
    const updated = await tx.taleDraft.findUniqueOrThrow({ where: { id: draft.id } });
    return {
      autosaveVersion: updated.autosaveVersion,
      savedAt: updated.updatedAt.toISOString(),
      validationState: updated.validationState,
    };
  });
}

export async function archiveStudioTale(taleId: string, archived: boolean) {
  return db.tallTale.update({
    where: { id: taleId },
    data: { archivedAt: archived ? new Date() : null, status: archived ? "ARCHIVED" : undefined },
  });
}

export async function duplicateStudioTale(taleId: string, creatorId: string) {
  const source = await getStudioTale(taleId);
  const base = slugify(`${source.tale.slug}-copy`);
  let slug = base;
  let suffix = 2;
  while (await db.tallTale.findUnique({ where: { slug }, select: { id: true } })) slug = `${base}-${suffix++}`;
  const created = await createStudioTale({
    title: `${source.tale.title} Copy`,
    slug,
    subtitle: source.tale.subtitle ?? undefined,
    shortDescription: source.tale.shortDescription ?? undefined,
    longDescription: source.tale.longDescription ?? undefined,
    theme: source.tale.theme,
    playerCountMin: source.tale.playerCountMin,
    playerCountMax: source.tale.playerCountMax,
    estimatedDuration: source.tale.estimatedDuration ?? undefined,
    visibility: "PRIVATE",
    initialChapterTitle: source.draft.chapters[0]?.title ?? "Chapter One",
    creatorId,
  });
  const target = await getStudioTale(created.id);
  const chapterIds = new Map(source.draft.chapters.map((chapter) => [chapter.id, crypto.randomUUID()]));
  const blockIds = new Map(
    source.draft.chapters.flatMap((chapter) => chapter.blocks.map((block) => [block.id, crypto.randomUUID()] as const)),
  );
  const remapTarget = (value: unknown) =>
    typeof value === "string" && blockIds.has(value) ? blockIds.get(value) : value;
  await saveStudioDraft(
    created.id,
    {
      autosaveVersion: target.draft.autosaveVersion,
      tale: { ...source.tale, title: `${source.tale.title} Copy`, slug, visibility: "PRIVATE" },
      chapters: source.draft.chapters.map((chapter) => ({
        ...chapter,
        id: chapterIds.get(chapter.id)!,
        blocks: chapter.blocks.map((block) => ({
          ...block,
          id: blockIds.get(block.id)!,
          configuration: {
            ...block.configuration,
            successTargetBlockId: remapTarget(block.configuration.successTargetBlockId),
            failureTargetBlockId: remapTarget(block.configuration.failureTargetBlockId),
            choices: Array.isArray(block.configuration.choices)
              ? block.configuration.choices.map((choice) =>
                  choice && typeof choice === "object" && !Array.isArray(choice)
                    ? { ...choice, targetBlockId: remapTarget(choice.targetBlockId) }
                    : choice,
                )
              : block.configuration.choices,
          },
        })),
      })),
    },
    creatorId,
  );
  return created;
}

export async function restorePublishedVersionToDraft(taleId: string, versionId: string, creatorId: string) {
  const [tale, version, latestDraft] = await Promise.all([
    db.tallTale.findUniqueOrThrow({ where: { id: taleId } }),
    db.publishedTaleVersion.findFirstOrThrow({ where: { id: versionId, taleId } }),
    db.taleDraft.findFirst({ where: { taleId }, orderBy: { revisionNumber: "desc" } }),
  ]);
  const snapshot = JSON.parse(version.contentSnapshot) as PublishedTaleSnapshot;
  if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.chapters))
    throw new Error("This published version cannot be copied by the current Studio.");

  const previousDraftId = tale.currentDraftRevisionId;
  const draft = await db.taleDraft.create({
    data: {
      taleId,
      revisionNumber: (latestDraft?.revisionNumber ?? 0) + 1,
      basedOnPublishedVersionId: version.id,
      createdBy: creatorId,
    },
  });
  await db.tallTale.update({ where: { id: taleId }, data: { currentDraftRevisionId: draft.id } });

  const chapterIds = new Map(snapshot.chapters.map((chapter) => [chapter.id, crypto.randomUUID()]));
  const blockIds = new Map(
    snapshot.chapters.flatMap((chapter) => chapter.blocks.map((block) => [block.id, crypto.randomUUID()] as const)),
  );
  const remapTarget = (value: unknown) =>
    typeof value === "string" && blockIds.has(value) ? blockIds.get(value) : value;
  try {
    await saveStudioDraft(
      taleId,
      {
        autosaveVersion: draft.autosaveVersion,
        tale: {
          ...snapshot.tale,
          slug: tale.slug,
          visibility: snapshot.tale.visibility as "PRIVATE" | "UNLISTED" | "PUBLIC",
        },
        chapters: snapshot.chapters.map((chapter) => ({
          ...chapter,
          id: chapterIds.get(chapter.id)!,
          blocks: chapter.blocks.map((block) => ({
            ...block,
            id: blockIds.get(block.id)!,
            configuration: {
              ...block.configuration,
              successTargetBlockId: remapTarget(block.configuration.successTargetBlockId),
              failureTargetBlockId: remapTarget(block.configuration.failureTargetBlockId),
              choices: Array.isArray(block.configuration.choices)
                ? block.configuration.choices.map((choice) =>
                    choice && typeof choice === "object" && !Array.isArray(choice)
                      ? { ...choice, targetBlockId: remapTarget(choice.targetBlockId) }
                      : choice,
                  )
                : block.configuration.choices,
            },
          })),
        })),
      },
      creatorId,
    );
  } catch (cause) {
    await db.taleDraft.delete({ where: { id: draft.id } }).catch(() => undefined);
    await db.tallTale
      .update({ where: { id: taleId }, data: { currentDraftRevisionId: previousDraftId } })
      .catch(() => undefined);
    throw cause;
  }
  return { draftId: draft.id, basedOnPublishedVersionId: version.id, revisionNumber: draft.revisionNumber };
}
