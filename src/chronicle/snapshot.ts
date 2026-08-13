import type { PublishedTaleSnapshot } from "@/chronicle/types";
import type { getStudioTale } from "@/chronicle/studio-service";
import { canonicalChecksum } from "@/drydock/canonical";
import { parseDrydockBlock, runtimeCompatibilityProjection } from "@/drydock/contracts/parser";

/** The shared immutable-source projection used by validation, compatibility, and One Voyage publication. */
export function snapshotFromStudio(studio: Awaited<ReturnType<typeof getStudioTale>>): PublishedTaleSnapshot {
  return {
    schemaVersion: 1,
    tale: {
      id: studio.tale.id, slug: studio.tale.slug, title: studio.tale.title,
      subtitle: studio.tale.subtitle, shortDescription: studio.tale.shortDescription,
      longDescription: studio.tale.longDescription, coverAssetId: studio.tale.coverAssetId,
      theme: studio.tale.theme, visibility: studio.tale.visibility, playerCountMin: studio.tale.playerCountMin,
      playerCountMax: studio.tale.playerCountMax, estimatedDuration: studio.tale.estimatedDuration,
      contentWarnings: studio.tale.contentWarnings,
    },
    chapters: studio.draft.chapters.map((chapter, chapterIndex) => ({
      id: chapter.id, title: chapter.title, subtitle: chapter.subtitle,
      description: chapter.description, coverAssetId: chapter.coverAssetId,
      estimatedDuration: chapter.estimatedDuration, isOptional: chapter.isOptional, metadata: chapter.metadata,
      orderIndex: chapterIndex, entryBlockId: chapter.blocks[0]?.id ?? null,
      completionBlockId: ([...chapter.blocks].reverse().find((block) => block.blockType === "chapterComplete" || block.blockType === "taleComplete")?.id ?? chapter.blocks.at(-1)?.id ?? null),
      blocks: chapter.blocks.map((block, blockIndex) => {
        const parsed = parseDrydockBlock({ ...block, connections: block.connections, nextBlockId: block.connections[0]?.targetBlockId ?? null });
        if (!parsed.success) throw new Error(`Passage ${block.id} does not satisfy its Drydock publishing contract.`);
        const canonical = runtimeCompatibilityProjection(parsed.block);
        return {
          id: block.id, chapterId: chapter.id, blockType: block.blockType, title: block.title, internalLabel: block.internalLabel,
          configuration: canonical.configuration, presentation: canonical.presentation, completion: canonical.completion, creatorNotes: null,
          isEnabled: Boolean(block.isEnabled), schemaVersion: canonical.schemaVersion, orderIndex: blockIndex, nextBlockId: canonical.nextBlockId,
          connections: canonical.connections.map((connection, connectionIndex) => ({ ...connection, orderIndex: connectionIndex })),
        };
      }),
    })),
    assets: studio.assets.map((asset) => ({
      id: asset.id, mediaType: asset.mediaType, displayName: asset.displayName, description: asset.description,
      mimeType: asset.mimeType, width: asset.width, height: asset.height, roles: asset.roles,
      variants: asset.variants.map((variant) => ({ id: variant.id, role: variant.role, mimeType: variant.mimeType, processingState: variant.processingState })),
    })) as PublishedTaleSnapshot["assets"],
    locations: studio.locations.map((location) => ({ ...location, captainNotes: undefined })),
    artifacts: studio.artifacts,
    publishedAt: new Date().toISOString(),
  };
}

/**
 * Source identity intentionally excludes the server-assigned publication time.
 * A draft validated one instant before publication is still the same authored
 * source; the stored snapshot retains publishedAt for immutable chronology.
 */
export function publishedSourceIdentity(snapshot: PublishedTaleSnapshot) {
  const { publishedAt: _publishedAt, ...source } = snapshot;
  return source;
}

export function publishedSourceChecksum(snapshot: PublishedTaleSnapshot): string {
  return canonicalChecksum(publishedSourceIdentity(snapshot));
}
