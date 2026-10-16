import { createHash } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const assetId = z.enum(["brass-compass", "treasure-chest"]);
const entityId = z.enum(["fixture-model-brass-compass", "fixture-model-treasure-chest"]);
const elapsed = z.number().int().min(0).max(10000);
const coordinate = z.number().int().min(3).max(252);
const frame = z.strictObject({
  fileName: z.enum([
    "ncl01-filament-brass-compass-populated.png",
    "ncl01-filament-brass-compass-cleared.png",
    "ncl01-filament-treasure-chest-populated.png",
    "ncl01-filament-treasure-chest-cleared.png",
  ]),
  width: z.literal(256),
  height: z.literal(256),
  bytes: z.number().int().positive().max(300000),
  sha256: digest,
  rgbaSha256: digest,
  nontransparentPixels: z.number().int().min(0).max(65536),
  rgbaOrigin: z.literal("TOP_LEFT"),
  pngRowTransform: z.literal("NONE_FILAMENT_ALREADY_TOP_LEFT"),
  pickCoordinateSpace: z.literal("ANDROID_VIEW_TOP_LEFT"),
  sharedBudgetMs: z.literal(10000),
  readbackElapsedMs: elapsed,
  artifactPublishedElapsedMs: elapsed,
  picks: z
    .array(
      z.strictObject({
        kind: z.enum(["MODEL_HIT", "BACKGROUND_MISS", "CLEARED_MISS"]),
        x: coordinate,
        y: coordinate,
        viewPickX: coordinate,
        viewPickY: coordinate,
        neighborhoodRadius: z.literal(3),
        expectedEntityId: entityId.nullable(),
        observedEntityId: entityId.nullable(),
        callbackElapsedMs: elapsed,
        callbackCount: z.literal(1),
      }),
    )
    .min(1)
    .max(2),
});
const scene = z.strictObject({
  schemaVersion: z.literal(1),
  evidenceClass: z.literal("INSTRUMENTED_FILAMENT_GLTF_RENDERING_ONLY"),
  renderer: z.literal("FILAMENT_1_75_1_OPENGL"),
  fixtureUsesCamera: z.literal(false),
  fixtureCreatesARCoreSession: z.literal(false),
  physicalTrackingProven: z.literal(false),
  engineDisposed: z.literal(true),
  assets: z
    .array(
      z.strictObject({
        assetId,
        entityId,
        sha256: digest,
        renderables: z.number().int().positive().max(1000),
        materialInstances: z.number().int().min(4).max(1000),
        originalWorldBoundsMeters: z.array(z.number().finite().min(-10).max(10)).length(6),
        rootTransformAndBottomPivotVerified: z.literal(true),
        renderedNontransparentPixels: z.number().int().min(33).max(4_194_304),
        clearedNontransparentPixels: z.literal(0),
        renderedFrame: frame,
        clearedFrame: frame,
        assetDisposed: z.literal(true),
      }),
    )
    .length(2),
});
export type FilamentFrameProof = z.infer<typeof frame>;
const modelDigests = {
  "brass-compass": "5af1158b1a7f2b3339c159fbdca8b9d3d29020eaa06d41848bf5c04c0a682ccb",
  "treasure-chest": "2e31b5eed11242e583cfc99a5491ff2e4b10dec0d4fed5d90dffe1ccab122e6f",
};
function reject(): never {
  throw new Error("NATIVE_SCENE_RENDERING_EVIDENCE_MISMATCH");
}

/** Fixed fixture identities, paths, callback ordering and the unchanged per-frame deadline. */
export function parseFilamentSceneProof(raw: string) {
  if (Buffer.byteLength(raw) > 8192) throw new Error("NATIVE_SCENE_RENDERING_RECORD_TOO_LARGE");
  const proof = scene.parse(JSON.parse(raw));
  if (new Set(proof.assets.map((asset) => asset.assetId)).size !== 2) reject();
  for (const asset of proof.assets) {
    if (asset.sha256 !== modelDigests[asset.assetId] || asset.entityId !== `fixture-model-${asset.assetId}`) reject();
    for (const [captured, cleared] of [
      [asset.renderedFrame, false],
      [asset.clearedFrame, true],
    ] as const) {
      if (
        captured.fileName !== `ncl01-filament-${asset.assetId}-${cleared ? "cleared" : "populated"}.png` ||
        captured.nontransparentPixels !==
          (cleared ? asset.clearedNontransparentPixels : asset.renderedNontransparentPixels) ||
        captured.readbackElapsedMs > captured.artifactPublishedElapsedMs
      )
        reject();
      const kinds = cleared ? ["CLEARED_MISS"] : ["MODEL_HIT", "BACKGROUND_MISS"];
      if (
        captured.picks.length !== kinds.length ||
        new Set(captured.picks.map((pick) => pick.kind)).size !== kinds.length
      )
        reject();
      for (const pick of captured.picks) {
        const expected = pick.kind === "MODEL_HIT" ? asset.entityId : null;
        if (
          !kinds.includes(pick.kind) ||
          pick.expectedEntityId !== expected ||
          pick.observedEntityId !== expected ||
          pick.viewPickX !== pick.x ||
          pick.viewPickY !== captured.height - 1 - pick.y ||
          pick.callbackElapsedMs < captured.readbackElapsedMs ||
          pick.callbackElapsedMs > captured.artifactPublishedElapsedMs
        )
          reject();
      }
    }
  }
  return proof;
}

/** Independent standard PNG decoding verifies original RGBA, alpha metrics and sampled pick neighborhoods. */
export async function validateFilamentFramePng(captured: FilamentFrameProof, png: Buffer) {
  if (
    png.length > 300000 ||
    png.length !== captured.bytes ||
    createHash("sha256").update(png).digest("hex") !== captured.sha256
  )
    reject();
  const decoder = sharp(png, { failOn: "warning", limitInputPixels: 65536 });
  const metadata = await decoder.metadata();
  if (
    metadata.format !== "png" ||
    metadata.width !== captured.width ||
    metadata.height !== captured.height ||
    metadata.channels !== 4 ||
    metadata.depth !== "uchar" ||
    metadata.isPalette ||
    metadata.orientation !== undefined
  )
    reject();
  const { data: rgba, info } = await decoder.raw().toBuffer({ resolveWithObject: true });
  if (
    info.width !== captured.width ||
    info.height !== captured.height ||
    info.channels !== 4 ||
    createHash("sha256").update(rgba).digest("hex") !== captured.rgbaSha256
  )
    reject();
  let count = 0;
  for (let y = 0; y < captured.height; y++)
    for (let x = 0; x < captured.width; x++) {
      const alpha = rgba[(y * captured.width + x) * 4 + 3];
      if (alpha > 16) count++;
    }
  if (count !== captured.nontransparentPixels) reject();
  for (const pick of captured.picks) {
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const alpha = rgba[((pick.y + dy) * captured.width + pick.x + dx) * 4 + 3];
        if (pick.kind === "MODEL_HIT" ? alpha < 250 : alpha !== 0) reject();
      }
  }
}
