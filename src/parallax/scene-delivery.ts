import { z } from "zod";
import manifest from "../../public/parallax/sc02/manifest.json";
import {
  anchorSchema,
  authoredTransformSchema,
  instanceIdSchema,
  spatialId,
  type SpatialVersion,
  type Transform,
} from "./contracts";
import { nativeEntitySchema, sceneTransferLimits } from "./scene-transfer";
import { spatialElementSchema } from "./element-contracts";
import { environmentReferenceSchema } from "./environment-reference";
import { studioContentSchema } from "./studio-contracts";
import { adaptiveContentSchema } from "./adaptive-contracts";
import { runtimePresentableEntityIds } from "./behavior";

/** A delivery revision never changes the immutable authored Scene/checksum format. */
export const sceneDeliveryCapabilities = ["WORLD_TRACKING", "PLANE_PLACEMENT", "MODEL_GLB"] as const;
export const initialModelIds = ["treasure-chest", "brass-compass"] as const;
export const modelReferenceSchema = z
  .strictObject({
    assetId: z.enum(initialModelIds),
    version: z.literal("1.0.0"),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    byteLength: z.number().int().positive().max(33554432),
    url: z
      .string()
      .max(2048)
      .regex(
        /^\/api\/player\/playthroughs\/[^/?#]+\/parallax\/assets\/(treasure-chest|brass-compass)\?block=[^&#]+&versionChecksum=[a-f0-9]{64}$/,
      ),
    format: z.literal("GLB"),
    metersPerUnit: z.literal(1),
    sourceWidthMeters: z.number().finite().positive().max(5),
  })
  .superRefine((m, ctx) => {
    const source = manifest.assets.find((a) => a.id === m.assetId)!;
    if (
      source.sha256 !== m.sha256 ||
      source.bytes !== m.byteLength ||
      source.dimensions[0] !== m.sourceWidthMeters ||
      !m.url.includes(`/assets/${m.assetId}?`)
    )
      ctx.addIssue({ code: "custom", message: "PARALLAX_ASSET_IDENTITY_MISMATCH" });
  });
export type ModelReference = z.infer<typeof modelReferenceSchema>;
export const deliveryEntitySchema = nativeEntitySchema.safeExtend({
  anchorId: spatialId,
  parentEntityId: spatialId.optional(),
  authoredTransform: authoredTransformSchema,
  interactions: z
    .array(z.enum(["PICK", "INSPECT", "PLACE"]))
    .min(1)
    .max(3),
  visible: z.boolean(),
  selectable: z.boolean(),
  opacity: z.number().finite().min(0).max(1),
  element: spatialElementSchema.optional(),
  model: modelReferenceSchema.optional(),
});
export const sceneDeliverySchema = z
  .strictObject({
    schemaVersion: z.literal(2),
    transformKind: z.literal("RESOLVED_LOCAL_V1"),
    coordinateFrame: z.literal("LOCAL_Y_UP_NEGATIVE_Z"),
    identity: z.strictObject({
      definitionId: spatialId,
      versionId: spatialId,
      versionChecksum: z.string().regex(/^[a-f0-9]{64}$/),
      instanceId: instanceIdSchema,
      environment: environmentReferenceSchema.optional(),
    }),
    units: z.literal("METERS"),
    entities: z.array(deliveryEntitySchema).max(32),
    anchors: z.array(anchorSchema).min(1).max(16),
    requirements: z.array(z.string().min(1).max(80)).max(32),
    presentation: z.strictObject({
      elapsedMs: z.number().finite().min(0).max(Number.MAX_SAFE_INTEGER),
      reducedMotion: z.boolean(),
      studio: studioContentSchema.optional(),
      adaptive: adaptiveContentSchema.optional(),
    }),
    fallback: z.strictObject({
      mode: z.literal("GUIDED"),
      narrative: z.string().min(1).max(4000),
      preservesMeaning: z.literal(true),
    }),
  })
  .superRefine((scene, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const entities = new Map(scene.entities.map((e) => [e.id, e]));
    const anchors = new Set(scene.anchors.map((a) => a.id));
    if (entities.size !== scene.entities.length || anchors.size !== scene.anchors.length) fail("PARALLAX_DUPLICATE_ID");
    if (new Set(scene.requirements).size !== scene.requirements.length) fail("PARALLAX_DUPLICATE_CAPABILITY");
    for (const e of scene.entities) {
      if (!anchors.has(e.anchorId) || new Set(e.interactions).size !== e.interactions.length)
        fail("PARALLAX_ENTITY_REFERENCE_INVALID");
      const seen = new Set([e.id]);
      let parent = e.parentEntityId;
      while (parent) {
        const p = entities.get(parent);
        if (!p || p.anchorId !== e.anchorId || seen.has(parent)) {
          fail("PARALLAX_PARENT_FRAME_INVALID");
          break;
        }
        seen.add(parent);
        parent = p.parentEntityId;
      }
      if (
        e.model &&
        (e.element?.kind !== "PHYSICAL_ASSET" ||
          e.element.modelId !== e.model.assetId ||
          e.element.packageVersion !== e.model.version)
      )
        fail("PARALLAX_ASSET_ENTITY_MISMATCH");
      if (e.element?.enabled && e.element.kind === "PHYSICAL_ASSET" && !e.model)
        fail("PARALLAX_MODEL_REFERENCE_REQUIRED");
      if (e.model && !scene.requirements.includes("MODEL_GLB")) fail("PARALLAX_MODEL_CAPABILITY_REQUIRED");
      if (e.model && !e.model.url.endsWith(`&versionChecksum=${scene.identity.versionChecksum}`))
        fail("PARALLAX_ASSET_REVISION_MISMATCH");
    }
  });
export type SceneDelivery = z.infer<typeof sceneDeliverySchema>;

export function sceneRequirements(version: SpatialVersion): string[] {
  const required = new Set<string>(["WORLD_TRACKING"]);
  const presentable = runtimePresentableEntityIds(version);
  if (version.anchors.some((a) => a.kind === "SURFACE_RELATIVE")) required.add("PLANE_PLACEMENT");
  if (version.anchors.some((a) => a.kind === "DEVICE_RELATIVE")) required.add("DEVICE_RELATIVE");
  if (version.anchors.some((a) => a.kind === "FIXED_WORLDSPACE")) required.add("FIXED_WORLDSPACE");
  for (const e of version.entities) {
    if (!presentable.has(e.id) || !e.element?.enabled) continue;
    if (e.element.kind === "PHYSICAL_ASSET") {
      required.add("MODEL_GLB");
      if (!(initialModelIds as readonly string[]).includes(e.element.modelId))
        required.add("CATALOG_MODEL_UNAVAILABLE");
      if (e.element.articulation !== 0) required.add("ARTICULATION");
    } else required.add(e.element.kind);
    if (e.element.playback) required.add("ELEMENT_TIMELINE");
  }
  if (version.studio?.assets.some((a) => presentable.has(a.entityId))) required.add("IMPORTED_MEDIA");
  if (version.studio?.behaviors.some((b) => b.action === "HIGHLIGHT" && presentable.has(b.targetEntityId)))
    required.add("HIGHLIGHT");
  return [...required].sort();
}
export function supportsSceneDelivery(version: SpatialVersion, capabilities: readonly string[]) {
  return sceneRequirements(version).every((r) => capabilities.includes(r));
}
export function catalogModelReference(
  assetId: (typeof initialModelIds)[number],
  playthroughId: string,
  blockId: string,
  versionChecksum: string,
): ModelReference {
  const source = manifest.assets.find((a) => a.id === assetId)!;
  return modelReferenceSchema.parse({
    assetId,
    version: manifest.version,
    sha256: source.sha256,
    byteLength: source.bytes,
    url: `/api/player/playthroughs/${encodeURIComponent(playthroughId)}/parallax/assets/${assetId}?block=${encodeURIComponent(blockId)}&versionChecksum=${versionChecksum}`,
    format: "GLB",
    metersPerUnit: manifest.metersPerUnit,
    sourceWidthMeters: source.dimensions[0],
  });
}
export function createSceneDelivery(input: {
  version: SpatialVersion;
  instanceId: string;
  playthroughId: string;
  blockId: string;
  transforms: ReadonlyMap<string, Transform>;
  visibleEntityIds: readonly string[];
  elapsedMs: number;
  reducedMotion?: boolean;
}): SceneDelivery {
  const v = input.version;
  const presentable = runtimePresentableEntityIds(v);
  return sceneDeliverySchema.parse({
    schemaVersion: 2,
    transformKind: "RESOLVED_LOCAL_V1",
    coordinateFrame: "LOCAL_Y_UP_NEGATIVE_Z",
    units: "METERS",
    identity: {
      definitionId: v.definitionId,
      versionId: v.id,
      versionChecksum: v.checksum,
      instanceId: input.instanceId,
      ...(v.environment ? { environment: v.environment } : {}),
    },
    entities: v.entities.map((e) => ({
      id: e.id,
      kind: e.kind,
      content: e.content,
      widthMeters: e.widthMeters,
      transform: input.transforms.get(e.id),
      anchorId: e.anchorId,
      authoredTransform: e.transform,
      ...(e.parentEntityId ? { parentEntityId: e.parentEntityId } : {}),
      interactions: e.interactions,
      visible: presentable.has(e.id) && input.visibleEntityIds.includes(e.id),
      selectable: presentable.has(e.id) && v.studio?.layers.find((l) => l.entityId === e.id)?.selectable !== false,
      opacity: 1,
      ...(e.element ? { element: presentable.has(e.id) ? e.element : { ...e.element, enabled: false } } : {}),
      ...(presentable.has(e.id) &&
      e.element?.enabled &&
      e.element.kind === "PHYSICAL_ASSET" &&
      (initialModelIds as readonly string[]).includes(e.element.modelId)
        ? {
            model: catalogModelReference(
              e.element.modelId as (typeof initialModelIds)[number],
              input.playthroughId,
              input.blockId,
              v.checksum,
            ),
          }
        : {}),
    })),
    anchors: v.anchors,
    requirements: sceneRequirements(v),
    presentation: {
      elapsedMs: Math.max(0, input.elapsedMs),
      reducedMotion: input.reducedMotion ?? false,
      ...(v.studio ? { studio: v.studio } : {}),
      ...(v.adaptive ? { adaptive: v.adaptive } : {}),
    },
    fallback: v.fallback,
  });
}
export function encodeSceneDelivery(scene: SceneDelivery) {
  const bytes = new TextEncoder().encode(JSON.stringify(sceneDeliverySchema.parse(scene)));
  if (bytes.byteLength > sceneTransferLimits.sceneBytes) throw new Error("PARALLAX_SCENE_TOO_LARGE");
  return bytes;
}
