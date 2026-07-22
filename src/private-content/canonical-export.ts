/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 2 is additive to the generated Prisma client. */
import { db } from "@/lib/db";
import { privateFailure, sha256, type PrivatePackageAsset, type PrivatePayload } from "./core";

function jsonObject(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function representation(mediaType: string): PrivatePackageAsset["representation"] {
  if (mediaType.startsWith("image/")) return "image";
  if (mediaType.startsWith("audio/")) return "audio";
  if (mediaType.startsWith("video/")) return "video";
  if (mediaType === "application/pdf") return "document";
  if (mediaType === "model/gltf-binary" || mediaType === "model/gltf+json") return "model-3d";
  return "binary";
}

/**
 * Rebuilds a private package from the live One Voyage projection.  The original
 * normalized package is used only to retain already-validated asset bytes; tale
 * metadata, chapters, blocks, connections, locations, and artifacts come from
 * current canonical records.
 */
export async function privatePayloadFromCanonicalImport(input: {
  importId: string;
  sourcePayload: PrivatePayload;
}): Promise<PrivatePayload> {
  const client = db as any;
  const record = await client.privateContentImport.findUniqueOrThrow({ where: { id: input.importId } });
  const mappings = await client.privateContentImportMapping.findMany({ where: { importId: input.importId } });
  const taleIds = mappings.filter((row: any) => row.kind === "CHRONICLE").map((row: any) => row.targetId);
  if (!taleIds.length || record.materializationStatus !== "COMPLETED")
    throw privateFailure("PRIVATE_PACKAGE_INVALID", "Private Chronicle materialization is not complete.");

  const sourceAssets = new Map(input.sourcePayload.manifest.assets.map((asset) => [asset.sha256, asset]));
  const entries: Record<string, string> = {};
  const manifestTales: PrivatePayload["manifest"]["tales"] = [];
  const assets: PrivatePackageAsset[] = [];

  for (const taleId of taleIds) {
    const tale = await client.chronicle.findUniqueOrThrow({ where: { id: taleId } });
    if (tale.visibility !== "PRIVATE") throw privateFailure("PRIVATE_CONTENT_FORBIDDEN");
    const versionId = mappings.find((row: any) => row.kind === "PUBLISHED_TALE_VERSION")?.targetId;
    const immutableVersion =
      input.sourcePayload.manifest.contentType === "published-tale" && versionId
        ? await client.publishedTaleVersion.findFirstOrThrow({ where: { id: versionId, taleId } })
        : null;
    const draft = immutableVersion
      ? null
      : await client.taleDraft.findFirstOrThrow({
          where: { taleId, ...(tale.currentDraftRevisionId ? { id: tale.currentDraftRevisionId } : {}) },
          include: {
            chapters: { orderBy: { orderIndex: "asc" }, include: { blocks: { orderBy: { orderIndex: "asc" } } } },
          },
        });
    const [locations, artifacts, taleAssets] = await Promise.all([
      client.taleLocation.findMany({ where: { taleId }, orderBy: { orderIndex: "asc" } }),
      client.taleArtifact.findMany({ where: { taleId }, orderBy: { sortOrder: "asc" } }),
      client.taleAsset.findMany({ where: { taleId, deletedAt: null }, orderBy: { createdAt: "asc" } }),
    ]);
    const taleLogicalId = tale.id;
    const contentPath = `tales/${taleLogicalId}.json`;
    const currentDraft = immutableVersion
      ? JSON.parse(immutableVersion.contentSnapshot)
      : {
          autosaveVersion: draft!.autosaveVersion,
          tale: {
            id: tale.id,
            slug: tale.slug,
            title: tale.title,
            subtitle: tale.subtitle ?? undefined,
            shortDescription: tale.shortDescription ?? undefined,
            longDescription: tale.longDescription ?? undefined,
            coverAssetId: tale.coverAssetId ?? undefined,
            theme: tale.theme,
            visibility: "PRIVATE",
            playerCountMin: tale.playerCountMin,
            playerCountMax: tale.playerCountMax,
            estimatedDuration: tale.estimatedDuration ?? undefined,
            contentWarnings: tale.contentWarnings ?? undefined,
          },
          chapters: draft!.chapters.map((chapter: any) => ({
            id: chapter.id,
            title: chapter.title,
            subtitle: chapter.subtitle ?? undefined,
            description: chapter.description ?? undefined,
            coverAssetId: chapter.coverAssetId ?? undefined,
            estimatedDuration: chapter.estimatedDuration ?? undefined,
            isOptional: chapter.isOptional,
            metadata: jsonObject(chapter.metadata),
            blocks: chapter.blocks.map((block: any) => ({
              id: block.id,
              blockType: block.blockType,
              title: block.title,
              internalLabel: block.internalLabel ?? undefined,
              configuration: jsonObject(block.configuration),
              presentation: jsonObject(block.presentation),
              completion: jsonObject(block.completion),
              creatorNotes: block.creatorNotes ?? undefined,
              isEnabled: block.isEnabled,
              schemaVersion: block.schemaVersion,
            })),
          })),
          locations: locations.map((location: any) => ({
            logicalId: location.legacyKey ?? location.id,
            name: location.name,
            slug: location.slug,
            region: location.region ?? undefined,
            generalDescription: location.generalDescription ?? undefined,
            playerFacingDescription: location.playerFacingDescription ?? undefined,
            captainNotes: location.captainNotes ?? undefined,
            locationType: location.locationType,
            safeLabel: location.safeLabel ?? undefined,
            exactness: location.exactness,
            verificationProfile: jsonObject(location.verificationProfile),
          })),
          artifacts: artifacts.map((artifact: any) => ({
            logicalId: artifact.legacyKey ?? artifact.id,
            name: artifact.name,
            shortDescription: artifact.shortDescription ?? undefined,
            loreDescription: artifact.loreDescription ?? undefined,
            ordinaryGameObjectLabel: artifact.ordinaryGameObjectLabel ?? undefined,
            artworkAssetId: artifact.artworkAssetId ?? undefined,
            revealVideoAssetId: artifact.revealVideoAssetId ?? undefined,
            modelAssetId: artifact.modelAssetId ?? undefined,
            inventoryCategory: artifact.inventoryCategory,
            collectionGroup: artifact.collectionGroup ?? undefined,
            safeName: artifact.safeName ?? undefined,
            silhouetteLabel: artifact.silhouetteLabel ?? undefined,
          })),
        };
    entries[contentPath] = Buffer.from(JSON.stringify(currentDraft)).toString("base64url");
    manifestTales.push({
      logicalId: taleLogicalId,
      slug: immutableVersion ? String(currentDraft.tale?.slug ?? tale.slug) : tale.slug,
      title: immutableVersion ? String(currentDraft.tale?.title ?? tale.title) : tale.title,
      contentPath,
    });
    for (const asset of taleAssets) {
      const source = sourceAssets.get(asset.checksum);
      if (!source)
        throw privateFailure("PRIVATE_PACKAGE_INVALID", "A private asset cannot be exported without retained bytes.");
      const bytes = input.sourcePayload.entries[source.relativePath];
      if (!bytes) throw privateFailure("PRIVATE_PACKAGE_CHECKSUM_MISMATCH");
      const relativePath = `assets/${asset.id}`;
      if (entries[relativePath]) continue;
      entries[relativePath] = bytes;
      assets.push({
        logicalId: asset.id,
        sha256: asset.checksum,
        relativePath,
        mediaType: asset.mimeType,
        byteLength: asset.fileSize,
        representation: representation(asset.mimeType),
        role: "SEALED_HOLD_PRIVATE",
      });
    }
  }
  const checksums = Object.fromEntries(
    Object.entries(entries).map(([entryPath, value]) => [entryPath, sha256(Buffer.from(value, "base64url"))]),
  );
  const plaintextBytes = Object.values(entries).reduce((sum, value) => sum + Buffer.from(value, "base64url").length, 0);
  return {
    manifest: {
      ...input.sourcePayload.manifest,
      createdAt: new Date().toISOString(),
      tales: manifestTales,
      assets,
      totals: { files: Object.keys(entries).length, assets: assets.length, plaintextBytes },
    },
    entries,
    checksums,
  };
}
