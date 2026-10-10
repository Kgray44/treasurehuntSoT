import { z } from "zod";

export const spatialId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
// Instance identity contains two independently bounded IDs plus its namespace.
export const instanceIdSchema = z
  .string()
  .min(1)
  .max(300)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const copy = (max: number) => z.string().trim().min(1).max(max);
export const vectorSchema = z.strictObject({
  x: z.number().finite().min(-10000).max(10000),
  y: z.number().finite().min(-10000).max(10000),
  z: z.number().finite().min(-10000).max(10000),
});
export const quaternionSchema = z
  .strictObject({ x: z.number().finite(), y: z.number().finite(), z: z.number().finite(), w: z.number().finite() })
  .refine((q) => Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) < 1e-5, "PARALLAX_ROTATION_NOT_UNIT");
/** Derived reference frames may exceed authoring scale limits; all components stay finite. */
export const resolvedTransformSchema = z.strictObject({
  position: z.strictObject({ x: z.number().finite(), y: z.number().finite(), z: z.number().finite() }),
  rotation: quaternionSchema,
  scale: z.number().finite().positive(),
});
export const authoredTransformSchema = z.strictObject({
  position: vectorSchema,
  rotation: quaternionSchema,
  scale: z.number().finite().min(0.01).max(10),
});
// Historical source schema name remains compatible with published checksum material.
export const transformSchema = authoredTransformSchema;
export type AuthoredTransform = z.infer<typeof authoredTransformSchema>;
export type ResolvedTransform = z.infer<typeof resolvedTransformSchema>;
export type Transform = {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  scale: number;
};
export const identityTransform = (): Transform => ({
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: 1,
});
export const anchorSchema = z.discriminatedUnion("kind", [
  z.strictObject({ id: spatialId, kind: z.literal("LOCAL_WORLD"), frameId: spatialId, transform: transformSchema }),
  z.strictObject({
    id: spatialId,
    kind: z.literal("SURFACE_RELATIVE"),
    frameId: spatialId,
    alignment: z.enum(["HORIZONTAL", "VERTICAL"]),
    transform: transformSchema,
  }),
  z.strictObject({
    id: spatialId,
    kind: z.literal("FIXED_WORLDSPACE"),
    frameId: spatialId,
    worldspaceId: spatialId,
    transform: transformSchema,
  }),
  z.strictObject({ id: spatialId, kind: z.literal("DEVICE_RELATIVE"), frameId: spatialId, transform: transformSchema }),
]);
export const entitySchema = z.strictObject({
  id: spatialId,
  name: copy(160),
  kind: z.enum(["PARCHMENT", "MARKER", "TEXT"]),
  parentEntityId: spatialId.optional(),
  anchorId: spatialId,
  coordinateSpace: z.enum(["LOCAL_SESSION", "SURFACE_RELATIVE", "WORLDSPACE", "DEVICE", "ENTITY_RELATIVE"]),
  transform: transformSchema,
  widthMeters: z.number().finite().min(0.01).max(5),
  content: copy(2000),
  alternativeText: copy(2000),
  interactions: z
    .array(z.enum(["PICK", "INSPECT", "PLACE"]))
    .min(1)
    .max(3),
  visibility: z.literal("RELEASED"),
  sharingScope: z.literal("PERSONAL"),
});
export const definitionSchema = z.strictObject({
  id: spatialId,
  ownerPersonId: spatialId,
  title: copy(240),
  libraryScope: z.literal("CHRONICLE_ONLY"),
});
export const versionContentSchema = z
  .strictObject({
    id: spatialId,
    definitionId: spatialId,
    semanticVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    schemaVersion: z.literal(1),
    title: copy(240),
    anchors: z.array(anchorSchema).min(1).max(16),
    entities: z.array(entitySchema).min(1).max(32),
    placementPolicy: z.literal("FIXED"),
    privacyClass: z.literal("LOCAL_EPHEMERAL"),
    fallback: z.strictObject({ mode: z.literal("GUIDED"), narrative: copy(4000), preservesMeaning: z.literal(true) }),
    accessibility: z.strictObject({
      seated: z.literal(true),
      keyboard: z.literal(true),
      reducedMotion: z.literal(true),
      soundIndependent: z.literal(true),
    }),
  })
  .superRefine((v, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const anchors = new Map(v.anchors.map((a) => [a.id, a]));
    const entities = new Map(v.entities.map((e) => [e.id, e]));
    if (anchors.size !== v.anchors.length || entities.size !== v.entities.length) fail("PARALLAX_DUPLICATE_ID");
    for (const e of v.entities) {
      const a = anchors.get(e.anchorId);
      if (!a) {
        fail("PARALLAX_ANCHOR_MISSING");
        continue;
      }
      if (new Set(e.interactions).size !== e.interactions.length) fail("PARALLAX_DUPLICATE_INTERACTION");
      const expected = {
        LOCAL_WORLD: "LOCAL_SESSION",
        SURFACE_RELATIVE: "SURFACE_RELATIVE",
        FIXED_WORLDSPACE: "WORLDSPACE",
        DEVICE_RELATIVE: "DEVICE",
      }[a.kind];
      if (e.parentEntityId) {
        const p = entities.get(e.parentEntityId);
        if (!p || p.anchorId !== e.anchorId || e.coordinateSpace !== "ENTITY_RELATIVE")
          fail("PARALLAX_PARENT_FRAME_INVALID");
      } else if (e.coordinateSpace !== expected) fail("PARALLAX_FRAME_MISMATCH");
      const seen = new Set([e.id]);
      let parent = e.parentEntityId;
      while (parent) {
        if (seen.has(parent)) {
          fail("PARALLAX_ENTITY_CYCLE");
          break;
        }
        seen.add(parent);
        parent = entities.get(parent)?.parentEntityId;
      }
    }
  });
export const versionSchema: z.ZodType<SpatialVersion> = versionContentSchema.safeExtend({
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});
export const spatialMomentSchema: z.ZodType<SpatialMoment> = z
  .strictObject({
    schemaVersion: z.literal(1),
    definition: definitionSchema,
    version: versionSchema,
    attachment: z.strictObject({
      id: spatialId,
      storyMomentId: spatialId,
      spatialDefinitionVersionId: spatialId,
      versionChecksum: z.string().regex(/^[a-f0-9]{64}$/),
      overrides: z.strictObject({ narrative: copy(4000).optional() }),
    }),
  })
  .superRefine((m, ctx) => {
    if (
      m.definition.id !== m.version.definitionId ||
      m.attachment.spatialDefinitionVersionId !== m.version.id ||
      m.attachment.versionChecksum !== m.version.checksum
    )
      ctx.addIssue({ code: "custom", message: "PARALLAX_VERSION_PIN_MISMATCH" });
  });
export type SpatialVersion = {
  id: string;
  definitionId: string;
  semanticVersion: string;
  schemaVersion: 1;
  checksum: string;
  title: string;
  anchors: Anchor[];
  entities: SpatialEntity[];
  placementPolicy: "FIXED";
  privacyClass: "LOCAL_EPHEMERAL";
  fallback: { mode: "GUIDED"; narrative: string; preservesMeaning: true };
  accessibility: { seated: true; keyboard: true; reducedMotion: true; soundIndependent: true };
};
export type SpatialMoment = {
  schemaVersion: 1;
  definition: { id: string; ownerPersonId: string; title: string; libraryScope: "CHRONICLE_ONLY" };
  version: SpatialVersion;
  attachment: {
    id: string;
    storyMomentId: string;
    spatialDefinitionVersionId: string;
    versionChecksum: string;
    overrides: { narrative?: string };
  };
};
export type SpatialEntity = z.infer<typeof entitySchema>;
export type Anchor = z.infer<typeof anchorSchema>;
export const instanceBindingSchema = z.strictObject({
  sessionId: spatialId,
  chronicleVersionId: spatialId,
  blockId: spatialId,
  actorId: spatialId,
  runId: spatialId,
});
export type InstanceBinding = z.infer<typeof instanceBindingSchema>;
export const receiptSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    interactionId: spatialId,
    idempotencyKey: spatialId,
    instanceId: instanceIdSchema,
    sessionId: spatialId,
    chronicleVersionId: spatialId,
    blockId: spatialId,
    actorId: spatialId,
    spatialDefinitionVersionId: spatialId,
    versionChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    entityId: spatialId,
    interactionType: z.enum(["PICK", "INSPECT", "PLACE"]),
    anchorId: spatialId,
    anchorVersion: z.number().int().positive(),
    observedAt: z.string().datetime(),
    mode: z.enum(["GUIDED", "NATIVE", "SIMULATED"]),
    providerId: spatialId,
    synthetic: z.boolean(),
    authority: z.literal("NONAUTHORITATIVE"),
  })
  .superRefine((r, ctx) => {
    if (r.synthetic !== (r.mode === "SIMULATED"))
      ctx.addIssue({ code: "custom", message: "PARALLAX_SYNTHETIC_PROVENANCE_INVALID" });
  });
export type InteractionReceipt = z.infer<typeof receiptSchema>;
