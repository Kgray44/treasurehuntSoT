import { z } from "zod";

const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const text = (max: number) => z.string().trim().min(1).max(max);
export const studioLayerSchema = z.strictObject({
  entityId: id,
  tags: z.array(text(60)).max(16),
  visible: z.boolean(),
  locked: z.boolean(),
  selectable: z.boolean(),
  audience: z.enum(["BOTH", "EDITOR_ONLY", "RUNTIME_ONLY"]),
});
export const behaviorSchema = z.strictObject({
  id,
  trigger: z.enum(["SCENE_ENTER", "INSPECT", "PICK", "PLACE", "TIMER"]),
  sourceEntityId: id.optional(),
  delayMs: z.number().int().min(0).max(60000),
  targetEntityId: id,
  action: z.enum(["SHOW", "HIDE", "HIGHLIGHT"]),
});
export const spatialAssetSchema = z.strictObject({
  id,
  entityId: id,
  kind: z.enum(["TEXTURE", "MODEL", "AUDIO"]),
  assetId: id,
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  format: z.enum(["PNG", "JPEG", "GLB", "MP3", "WAV"]),
  bytes: z.number().int().min(1).max(50000000),
  triangles: z.number().int().min(0).max(1000000),
  texturePixels: z.number().int().min(0).max(67108864),
  durationSeconds: z.number().finite().min(0).max(600),
  metersPerUnit: z.number().finite().min(0.0001).max(100),
  alternativeText: text(2000),
  license: text(240),
  provenance: z.enum(["CREATOR", "LICENSED", "AI_ASSISTED"]),
});
export const studioContentSchema = z.strictObject({
  schemaVersion: z.literal(1),
  layers: z.array(studioLayerSchema).max(32),
  behaviors: z.array(behaviorSchema).max(64),
  assets: z.array(spatialAssetSchema).max(32),
  // Synthetic editor reference frames never replace measured native plane frames.
  surfacePreviewFrames: z
    .array(
      z.strictObject({
        anchorId: id,
        environmentId: id,
        surfaceId: id,
        position: z.strictObject({
          x: z.number().finite().min(-100).max(100),
          y: z.number().finite().min(-10).max(20),
          z: z.number().finite().min(-100).max(100),
        }),
        rotation: z
          .strictObject({
            x: z.number().finite(),
            y: z.number().finite(),
            z: z.number().finite(),
            w: z.number().finite(),
          })
          .refine((q) => Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) < 1e-5),
      }),
    )
    .max(16)
    .optional(),
  visionReferences: z
    .array(
      z.strictObject({
        entityId: id,
        waypointId: id,
        versionId: id,
        checksum: z.string().regex(/^[a-f0-9]{64}$/),
        purpose: z.enum(["RELOCALIZATION", "DISCOVERY_VERIFICATION"]),
      }),
    )
    .max(16),
  minimumRuntime: z.literal("PARALLAX_2"),
  capabilityDependencies: z.array(z.enum(["WORLD_TRACKING", "PLANE_PLACEMENT"])).max(2),
  compatibilityNotes: z.string().max(2000),
  provenance: z.strictObject({
    origin: z.enum(["MANUAL", "PRESET", "AI_ASSISTED"]),
    generator: text(160),
    license: text(240),
  }),
});
export type StudioContent = z.infer<typeof studioContentSchema>;
export type Behavior = z.infer<typeof behaviorSchema>;
export type StudioLayer = z.infer<typeof studioLayerSchema>;
export function emptyStudioContent(): StudioContent {
  return {
    schemaVersion: 1,
    layers: [],
    behaviors: [],
    assets: [],
    visionReferences: [],
    minimumRuntime: "PARALLAX_2",
    capabilityDependencies: [],
    compatibilityNotes: "Guided View preserves the authored meaning. Asset dependencies require a compatible renderer.",
    provenance: { origin: "MANUAL", generator: "Parallax Spatial Studio", license: "Creator owned" },
  };
}
