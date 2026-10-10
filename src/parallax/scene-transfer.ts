import { z } from "zod";
import { spatialId, resolvedTransformSchema } from "./contracts";

export const sceneTransferLimits = Object.freeze({
  version: 1,
  requestBytes: 16384,
  sceneBytes: 393216,
  chunkBytes: 8192,
  chunks: 48,
  entities: 32,
  timeoutMs: 15000,
});
/** Provider limits concern effective geometry, independently of source authoring scale. */
export const nativeEntitySchema = z
  .strictObject({
    id: spatialId,
    kind: z.enum(["PARCHMENT", "MARKER", "TEXT"]),
    content: z.string().min(1).max(2000),
    widthMeters: z.number().finite().min(0.01).max(5),
    transform: resolvedTransformSchema,
  })
  .superRefine((e, ctx) => {
    const effective = e.widthMeters * e.transform.scale;
    if (
      !Number.isFinite(effective) ||
      effective < 0.000001 ||
      effective > 100 ||
      e.transform.scale > 100000000 ||
      Object.values(e.transform.position).some((v) => Math.abs(v) > 1000000)
    )
      ctx.addIssue({ code: "custom", message: "PARALLAX_NATIVE_GEOMETRY_UNSAFE" });
  });
export const nativeSceneSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    transformKind: z.literal("RESOLVED_LOCAL_V1"),
    coordinateFrame: z.literal("LOCAL_Y_UP_NEGATIVE_Z"),
    entities: z.array(nativeEntitySchema).min(1).max(sceneTransferLimits.entities),
  })
  .refine((s) => new Set(s.entities.map((e) => e.id)).size === s.entities.length, "PARALLAX_DUPLICATE_ID");
export type NativeScene = z.infer<typeof nativeSceneSchema>;
export function encodeScene(entities: NativeScene["entities"]) {
  const scene = nativeSceneSchema.parse({
    schemaVersion: 1,
    transformKind: "RESOLVED_LOCAL_V1",
    coordinateFrame: "LOCAL_Y_UP_NEGATIVE_Z",
    entities,
  });
  const bytes = new TextEncoder().encode(JSON.stringify(scene));
  if (bytes.length > sceneTransferLimits.sceneBytes) throw new Error("PARALLAX_SCENE_TOO_LARGE");
  return bytes;
}
export async function sceneDigest(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("");
}
export function sceneChunks(bytes: Uint8Array) {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += sceneTransferLimits.chunkBytes)
    chunks.push(btoa(String.fromCharCode(...bytes.subarray(offset, offset + sceneTransferLimits.chunkBytes))));
  return chunks;
}
