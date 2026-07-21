import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { eventBus } from "@/lib/events";
import { getStudioTale } from "@/chronicle/studio-service";
import type { PublishedTaleSnapshot } from "@/chronicle/types";
import { validateTaleDraft } from "@/chronicle/validation";
import { logger } from "@/lib/logger";

export class PublishValidationError extends Error {
  constructor(public readonly validation: Awaited<ReturnType<typeof validateTaleDraft>>) {
    super("This Chronicle cannot be published yet. Resolve the blocking validation issues, then publish again.");
  }
}

export function snapshotFromStudio(studio: Awaited<ReturnType<typeof getStudioTale>>): PublishedTaleSnapshot {
  return {
    schemaVersion: 1,
    tale: {
      id: studio.tale.id,
      slug: studio.tale.slug,
      title: studio.tale.title,
      subtitle: studio.tale.subtitle,
      shortDescription: studio.tale.shortDescription,
      longDescription: studio.tale.longDescription,
      coverAssetId: studio.tale.coverAssetId,
      theme: studio.tale.theme,
      visibility: studio.tale.visibility,
      playerCountMin: studio.tale.playerCountMin,
      playerCountMax: studio.tale.playerCountMax,
      estimatedDuration: studio.tale.estimatedDuration,
      contentWarnings: studio.tale.contentWarnings,
    },
    chapters: studio.draft.chapters.map((chapter, chapterIndex) => ({
      id: chapter.id,
      title: chapter.title,
      subtitle: chapter.subtitle,
      description: chapter.description,
      coverAssetId: chapter.coverAssetId,
      estimatedDuration: chapter.estimatedDuration,
      isOptional: chapter.isOptional,
      metadata: chapter.metadata,
      orderIndex: chapterIndex,
      entryBlockId: chapter.blocks[0]?.id ?? null,
      completionBlockId:
        [...chapter.blocks]
          .reverse()
          .find((block) => block.blockType === "chapterComplete" || block.blockType === "taleComplete")?.id ??
        chapter.blocks.at(-1)?.id ??
        null,
      blocks: chapter.blocks.map((block, blockIndex) => ({
        id: block.id,
        chapterId: chapter.id,
        blockType: block.blockType,
        title: block.title,
        internalLabel: block.internalLabel,
        configuration: block.configuration,
        presentation: block.presentation,
        completion: block.completion,
        creatorNotes: null,
        isEnabled: block.isEnabled,
        schemaVersion: block.schemaVersion,
        orderIndex: blockIndex,
        nextBlockId: block.connections[0]?.targetBlockId ?? null,
        connections: block.connections.map((connection, connectionIndex) => ({
          ...connection,
          orderIndex: connectionIndex,
        })),
      })),
    })),
    assets: studio.assets.map((asset) => ({
      id: asset.id,
      mediaType: asset.mediaType,
      displayName: asset.displayName,
      description: asset.description,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      roles: asset.roles,
      variants: asset.variants.map((variant) => ({
        id: variant.id,
        role: variant.role,
        mimeType: variant.mimeType,
        processingState: variant.processingState,
      })),
    })) as PublishedTaleSnapshot["assets"],
    locations: studio.locations.map((location) => ({ ...location, captainNotes: undefined })),
    artifacts: studio.artifacts,
    publishedAt: new Date().toISOString(),
  };
}

export async function publishTale(
  taleId: string,
  publisherId: string,
  releaseNotes: string,
  expectedAutosaveVersion?: number,
) {
  logger.info({ area: "chronicle-publish", taleId, publisherId }, "Chronicle publish validation started");
  const validation = await validateTaleDraft(taleId);
  if (!validation.valid) throw new PublishValidationError(validation);
  if (expectedAutosaveVersion !== undefined && validation.autosaveVersion !== expectedAutosaveVersion)
    throw new Error("This Chronicle changed before publishing. Review the latest saved draft, then try again.");
  const studio = await getStudioTale(taleId);
  if (studio.draft.autosaveVersion !== validation.autosaveVersion)
    throw new Error("This Chronicle changed during validation. Review the current draft, then publish again.");
  const snapshot = snapshotFromStudio(studio);
  const contentSnapshot = JSON.stringify(snapshot);
  const checksum = createHash("sha256").update(contentSnapshot).digest("hex");
  const version = await db.$transaction(async (tx) => {
    const latest = await tx.publishedTaleVersion.findFirst({ where: { taleId }, orderBy: { versionNumber: "desc" } });
    const versionNumber = (latest?.versionNumber ?? 0) + 1;
    const structuredReleaseNotes =
      releaseNotes.trim() ||
      `Published ${snapshot.chapters.length} Chapters, ${snapshot.chapters.reduce((count, chapter) => count + chapter.blocks.length, 0)} Passages, and ${snapshot.assets.length} assets${latest ? ` from Version ${latest.versionLabel}` : " as the first published Version"}.`;
    await tx.publishedTaleVersion.updateMany({ where: { taleId, isCurrent: true }, data: { isCurrent: false } });
    const created = await tx.publishedTaleVersion.create({
      data: {
        taleId,
        versionNumber,
        versionLabel: versionNumber === 1 ? "1.0" : `1.${versionNumber - 1}`,
        publishedBy: publisherId,
        releaseNotes: structuredReleaseNotes,
        contentSnapshot,
        checksum,
        isCurrent: true,
      },
    });
    await tx.chronicle.update({
      where: { id: taleId },
      data: { status: "PUBLISHED", latestPublishedVersionId: created.id },
    });
    await tx.platformAuditEvent.create({
      data: {
        actorType: "CREATOR",
        actorId: publisherId,
        action: "TALE_VERSION_PUBLISHED",
        resourceType: "PUBLISHED_TALE_VERSION",
        resourceId: created.id,
        correlationId: crypto.randomUUID(),
        metadata: JSON.stringify({ taleId, versionLabel: created.versionLabel, checksum: created.checksum }),
      },
    });
    return created;
  });
  eventBus.emit("chronicle:catalog", {
    type: "catalog.updated",
    taleId,
    versionId: version.id,
    at: version.publishedAt.toISOString(),
  });
  logger.info(
    { area: "chronicle-publish", taleId, versionId: version.id, versionLabel: version.versionLabel },
    "Immutable Chronicle version published",
  );
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    versionLabel: version.versionLabel,
    checksum: version.checksum,
    publishedAt: version.publishedAt.toISOString(),
  };
}

export function parsePublishedSnapshot(raw: string): PublishedTaleSnapshot {
  const snapshot = JSON.parse(raw) as PublishedTaleSnapshot;
  if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.chapters))
    throw new Error("This Chronicle version uses an unsupported format. Update Voyagewright, then try again.");
  return snapshot;
}
