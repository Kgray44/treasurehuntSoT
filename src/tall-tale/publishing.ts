import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { eventBus } from "@/lib/events";
import { getStudioTale } from "@/tall-tale/studio-service";
import type { PublishedTaleSnapshot } from "@/tall-tale/types";
import { validateTaleDraft } from "@/tall-tale/validation";
import { logger } from "@/lib/logger";
import { publishedVisionBindingConfiguration, publishedVisionBindingKey } from "@/vision/binding-contract";
import { runtimeResultPayloadHash } from "@/vision/runtime-contract";

export class PublishValidationError extends Error {
  constructor(public readonly validation: Awaited<ReturnType<typeof validateTaleDraft>>) {
    super("Draft validation failed. Resolve the blocking issues before publishing.");
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
  logger.info({ area: "tall-tale-publish", taleId, publisherId }, "Tall Tale publish validation started");
  const validation = await validateTaleDraft(taleId);
  if (!validation.valid) throw new PublishValidationError(validation);
  if (expectedAutosaveVersion !== undefined && validation.autosaveVersion !== expectedAutosaveVersion)
    throw new Error("The draft changed before publishing. Review the latest saved version and try again.");
  const studio = await getStudioTale(taleId);
  if (studio.draft.autosaveVersion !== validation.autosaveVersion)
    throw new Error("The draft changed during validation. Publish again after reviewing the current draft.");
  const snapshot = snapshotFromStudio(studio);
  const contentSnapshot = JSON.stringify(snapshot);
  const checksum = createHash("sha256").update(contentSnapshot).digest("hex");
  const version = await db.$transaction(async (tx) => {
    const latest = await tx.publishedTaleVersion.findFirst({ where: { taleId }, orderBy: { versionNumber: "desc" } });
    const versionNumber = (latest?.versionNumber ?? 0) + 1;
    const structuredReleaseNotes =
      releaseNotes.trim() ||
      `Published ${snapshot.chapters.length} chapters, ${snapshot.chapters.reduce((count, chapter) => count + chapter.blocks.length, 0)} story blocks, and ${snapshot.assets.length} assets${latest ? ` from version ${latest.versionLabel}` : " as the initial release"}.`;
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
    for (const block of snapshot.chapters
      .flatMap((chapter) => chapter.blocks)
      .filter((candidate) => candidate.blockType === "visionWaypoint")) {
      const waypointVersionId = String(block.configuration.waypointVersionId ?? "");
      const waypointVersion = await tx.visionWaypointVersion.findUniqueOrThrow({
        where: { id: waypointVersionId },
      });
      const configuration = publishedVisionBindingConfiguration(block);
      const bindingKey = runtimeResultPayloadHash(
        publishedVisionBindingKey({
          publishedVersionId: created.id,
          storyId: taleId,
          stageId: block.id,
          waypointId: waypointVersion.waypointId,
          waypointVersionId,
          configuration,
        }),
      );
      await tx.visionPublishedBinding.create({
        data: {
          bindingKey,
          publishedVersionId: created.id,
          storyId: taleId,
          stageId: block.id,
          waypointId: waypointVersion.waypointId,
          waypointVersionId,
          runtimeMode: configuration.runtimeMode,
          scanInteraction: JSON.stringify(configuration.scanInteraction),
          scanConfiguration: JSON.stringify(configuration.scanConfiguration),
          successEvent: configuration.successEvent,
          guidanceConfiguration: JSON.stringify(configuration.guidanceConfiguration),
          captainFallbackPolicy: JSON.stringify(configuration.captainFallbackPolicy),
          offlineBehavior: configuration.offlineBehavior,
          assignmentPolicy: JSON.stringify(configuration.assignmentPolicy),
          accessibilityPolicy: JSON.stringify(configuration.accessibilityPolicy),
        },
      });
    }
    await tx.tallTale.update({
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
  eventBus.emit("tall-tale:catalog", {
    type: "catalog.updated",
    taleId,
    versionId: version.id,
    at: version.publishedAt.toISOString(),
  });
  logger.info(
    { area: "tall-tale-publish", taleId, versionId: version.id, versionLabel: version.versionLabel },
    "Immutable Tall Tale version published",
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
    throw new Error("This published tale uses an unsupported schema version.");
  return snapshot;
}
