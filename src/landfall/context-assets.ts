import type { LandfallDefinition } from "@/landfall/schema";

export function landfallReferenceAssetIds(definition: LandfallDefinition): string[] {
  return [
    ...new Set(
      (definition.context?.landmarks ?? []).flatMap((landmark) => [
        ...landmark.referenceAssetIds,
        ...landmark.negativeReferenceAssetIds,
      ]),
    ),
  ];
}

/** IDs only, resolved within the owned Chronicle's validated media library. */
export function validateLandfallReferenceAssets(
  definition: LandfallDefinition,
  assets: readonly { id: string; mediaType?: string; mimeType: string; deletedAt?: Date | null }[],
): void {
  const available = new Map(assets.map((asset) => [asset.id, asset]));
  for (const id of landfallReferenceAssetIds(definition)) {
    const asset = available.get(id);
    if (
      !asset ||
      asset.deletedAt ||
      (asset.mediaType && asset.mediaType !== "IMAGE") ||
      !/^image\/(png|jpeg|webp|avif)$/.test(asset.mimeType)
    )
      throw new Error("LANDFALL_LANDMARK_REFERENCE_UNAVAILABLE");
  }
}
