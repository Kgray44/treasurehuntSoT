import { z } from "zod";
import { studioContentSchema, type StudioContent } from "./studio-contracts";
import { adaptiveContentSchema, placementPolicies, type AdaptiveContent } from "./adaptive-contracts";
import { spatialElementSchema } from "./element-contracts";
import { environmentReferenceSchema, type EnvironmentReference } from "./environment-reference";

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
  element: spatialElementSchema.optional(),
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
  libraryScope: z.enum(["CHRONICLE_ONLY", "MY_LIBRARY"]),
});
export const versionContentSchema = z
  .strictObject({
    id: spatialId,
    definitionId: spatialId,
    semanticVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    schemaVersion: z.literal(1),
    title: copy(240),
    studio: studioContentSchema.optional(),
    anchors: z.array(anchorSchema).min(1).max(16),
    entities: z.array(entitySchema).min(1).max(32),
    placementPolicy: z.enum(placementPolicies),
    adaptive: adaptiveContentSchema.optional(),
    environment: environmentReferenceSchema.optional(),
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
    if (v.placementPolicy !== "FIXED" && !v.adaptive) fail("PARALLAX_ADAPTIVE_RECIPE_REQUIRED");
    if (v.adaptive) {
      const a = v.adaptive;
      if (v.placementPolicy === "FIXED") fail("PARALLAX_ADAPTIVE_POLICY_REQUIRED");
      const scope = { ADAPTIVE_PER_CREW: "CREW", ADAPTIVE_PER_RUN: "RUN", ADAPTIVE_VARIANT: "VARIANT" }[
        v.placementPolicy as string
      ];
      if (scope && a.lifecycle !== scope) fail("PARALLAX_POLICY_SCOPE_CONFLICT");
      const roots = v.entities.filter((e) => !e.parentEntityId);
      if (roots.some((e) => !a.recipes.some((r) => r.entityId === e.id))) fail("PARALLAX_ROOT_RECIPE_REQUIRED");
      if (new Set(roots.map((e) => e.anchorId)).size !== roots.length) fail("PARALLAX_ADAPTIVE_ANCHOR_CONFLICT");
      for (const r of a.recipes) {
        if (!entities.has(r.entityId) || entities.get(r.entityId)?.parentEntityId)
          fail("PARALLAX_RECIPE_ENTITY_INVALID");
        if (!a.discovery.some((p) => p.entityId === r.entityId)) fail("PARALLAX_DISCOVERY_REQUIRED");
      }
      for (const p of a.discovery) if (!entities.has(p.entityId)) fail("PARALLAX_DISCOVERY_ENTITY_MISSING");
      for (const r of a.relationships)
        if (!a.recipes.some((x) => x.entityId === r.entityId) || !a.recipes.some((x) => x.entityId === r.otherEntityId))
          fail("PARALLAX_RELATIONSHIP_ENTITY_MISSING");
      if (a.revealOrder.some((id) => !entities.has(id))) fail("PARALLAX_REVEAL_ENTITY_MISSING");
      if (
        a.relationships.some(
          (r) =>
            r.visibility === "SEQUENTIAL" &&
            (!a.revealOrder.includes(r.entityId) || !a.revealOrder.includes(r.otherEntityId)),
        )
      )
        fail("PARALLAX_REVEAL_ORDER_REQUIRED");
      if (v.placementPolicy === "CALIBRATED" && !["CALIBRATED", "VERIFIED"].includes(a.calibration.maturity))
        fail("PARALLAX_CALIBRATED_EVIDENCE_REQUIRED");
    }
    if (v.studio) {
      const s = v.studio;
      if (new Set(s.layers.map((l) => l.entityId)).size !== s.layers.length) fail("PARALLAX_LAYER_DUPLICATE");
      if (new Set(s.behaviors.map((b) => b.id)).size !== s.behaviors.length) fail("PARALLAX_BEHAVIOR_DUPLICATE");
      for (const l of s.layers) if (!entities.has(l.entityId)) fail("PARALLAX_LAYER_ENTITY_MISSING");
      for (const b of s.behaviors) {
        if (!entities.has(b.targetEntityId) || (b.sourceEntityId && !entities.has(b.sourceEntityId)))
          fail("PARALLAX_BEHAVIOR_ENTITY_MISSING");
        if (["PICK", "PLACE", "INSPECT"].includes(b.trigger) && !b.sourceEntityId)
          fail("PARALLAX_BEHAVIOR_SOURCE_MISSING");
        if (
          b.sourceEntityId &&
          ["PICK", "PLACE", "INSPECT"].includes(b.trigger) &&
          !entities.get(b.sourceEntityId)?.interactions.includes(b.trigger as "PICK" | "PLACE" | "INSPECT")
        )
          fail("PARALLAX_BEHAVIOR_INTERACTION_MISSING");
      }
      for (const a of [...s.assets, ...s.visionReferences])
        if (!entities.has(a.entityId)) fail("PARALLAX_DEPENDENCY_ENTITY_MISSING");
      if (new Set(s.assets.map((a) => a.id)).size !== s.assets.length) fail("PARALLAX_ASSET_DUPLICATE");
    }
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
  studio?: StudioContent;
  adaptive?: AdaptiveContent;
  environment?: EnvironmentReference;
  anchors: Anchor[];
  entities: SpatialEntity[];
  placementPolicy: (typeof placementPolicies)[number];
  privacyClass: "LOCAL_EPHEMERAL";
  fallback: { mode: "GUIDED"; narrative: string; preservesMeaning: true };
  accessibility: { seated: true; keyboard: true; reducedMotion: true; soundIndependent: true };
};
export type SpatialMoment = {
  schemaVersion: 1;
  definition: { id: string; ownerPersonId: string; title: string; libraryScope: "CHRONICLE_ONLY" | "MY_LIBRARY" };
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
  resolutionSeed: z
    .string()
    .regex(/^[a-f0-9]{8}$/)
    .optional(),
  resolutionDecisionId: spatialId.optional(),
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
