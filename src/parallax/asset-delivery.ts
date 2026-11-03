import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import manifest from "../../public/parallax/sc02/manifest.json";
import { assetPackage } from "./asset-catalog";
import { spatialId } from "./contracts";
import { loadReleasedSpatialMoment } from "./service";

// Only these exact original catalog binaries have a renderer in the initial slice.
// A requested identifier never becomes an arbitrary filesystem path.
const supportedAssets = {
  "treasure-chest": {
    bytes: 630120,
    sha256: "2e31b5eed11242e583cfc99a5491ff2e4b10dec0d4fed5d90dffe1ccab122e6f",
  },
  "brass-compass": {
    bytes: 313396,
    sha256: "5af1158b1a7f2b3339c159fbdca8b9d3d29020eaa06d41848bf5c04c0a682ccb",
  },
} as const;
const requestSchema = z.strictObject({
  playthroughId: spatialId,
  playerProfileId: spatialId,
  blockId: spatialId,
  versionChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  assetId: z.enum(["treasure-chest", "brass-compass"]),
});

/** Callers authenticate current Player membership before invoking this loader.
 * Every request resolves the released passage again, including cache revalidation.
 * Repository bytes are verified before any part is exposed to the response stream.
 */
export async function loadReleasedSpatialAsset(input: unknown) {
  const request = requestSchema.parse(input);
  const { moment } = await loadReleasedSpatialMoment(request.playthroughId, request.playerProfileId, request.blockId);
  if (moment.version.checksum !== request.versionChecksum) throw new Error("PARALLAX_ASSET_SCENE_CHANGED");
  const authored = moment.version.entities.some((entity) => {
    const element = entity.element;
    const layer = moment.version.studio?.layers.find((candidate) => candidate.entityId === entity.id);
    return (
      layer?.audience !== "EDITOR_ONLY" &&
      element?.kind === "PHYSICAL_ASSET" &&
      element.enabled &&
      element.modelId === request.assetId &&
      element.packageVersion === assetPackage.version
    );
  });
  if (!authored) throw new Error("PARALLAX_ASSET_NOT_RELEASED");
  const expected = supportedAssets[request.assetId];
  const asset = manifest.assets.find((candidate) => candidate.id === request.assetId);
  if (
    manifest.id !== assetPackage.id ||
    manifest.version !== assetPackage.version ||
    !asset ||
    asset.path !== `models/${request.assetId}.glb` ||
    asset.bytes !== expected.bytes ||
    asset.sha256 !== expected.sha256
  )
    throw new Error("PARALLAX_ASSET_CATALOG_MISMATCH");
  const bytes = await readFile(join(process.cwd(), "public", "parallax", "sc02", "models", `${request.assetId}.glb`));
  if (bytes.byteLength !== expected.bytes || createHash("sha256").update(bytes).digest("hex") !== expected.sha256)
    throw new Error("PARALLAX_ASSET_INTEGRITY_FAILED");
  return { bytes: new Uint8Array(bytes), sha256: expected.sha256, byteLength: expected.bytes };
}
