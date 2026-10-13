import { z } from "zod";
import { roomFeatureClasses } from "@/parallax/environment-contracts";

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/);
/** Creator-requested image interpretation is evidence for an approximate model.
 * It is not native tracking, an identity detector, calibration, or a progression receipt.
 * This contract carries no image bytes, URLs, paths or camera metadata.
 */
export const roomObservationSchema = z.strictObject({
  status: z.enum(["OBSERVED", "ABSTAINED", "ALIGNMENT_UNCERTAIN"]),
  explanation: z.string().trim().min(1).max(1000),
  clarification: z.string().trim().min(1).max(500).nullable(),
  alignment: z.enum(["INITIAL_ROOM", "EXISTING_ROOM_FRAME", "UNKNOWN"]),
  sharedFeatureId: id.nullable(),
  roomDimensions: z.tuple([
    z.number().finite().min(1).max(100),
    z.number().finite().min(1).max(20),
    z.number().finite().min(1).max(100),
  ]),
  dimensionBasis: z.literal("ESTIMATED"),
  features: z
    .array(
      z.strictObject({
        // Existing immutable authoring identity only when a corresponding feature is supported.
        matchedFeatureId: id.nullable(),
        classification: z.enum(roomFeatureClasses),
        name: z.string().trim().min(1).max(120),
        position: z.strictObject({
          x: z.number().finite().min(-100).max(100),
          y: z.number().finite().min(-20).max(20),
          z: z.number().finite().min(-100).max(100),
        }),
        yawDegrees: z.number().finite().min(-180).max(180),
        dimensions: z.tuple([
          z.number().finite().min(0.05).max(100),
          z.number().finite().min(0.05).max(20),
          z.number().finite().min(0.05).max(100),
        ]),
        basis: z.enum(["DIRECTLY_OBSERVED", "INFERRED"]),
        confidence: z.number().finite().min(0).max(1),
        attachment: z.enum(["FLOOR", "WALL", "CEILING", "FURNITURE"]).nullable().optional(),
        wallFace: z.enum(["BACK", "FRONT", "LEFT", "RIGHT"]).nullable().optional(),
        // Index in this observation only; never a vendor-specific persistent identity.
        attachmentTargetIndex: z.number().int().min(0).max(23).nullable().optional(),
        facesFeatureIndex: z.number().int().min(0).max(23).nullable().optional(),
      }),
    )
    .max(48),
  uncertainties: z.array(z.string().trim().min(1).max(300)).max(16),
});
export type RoomObservation = z.infer<typeof roomObservationSchema>;

// Named wire dimensions prevent an image model from confusing width/depth/height tuple order.
const wireDimensions = z.strictObject({
  widthMeters: z.number().min(0.05).max(100),
  heightMeters: z.number().min(0.05).max(20),
  depthMeters: z.number().min(0.05).max(100),
});
export const roomObservationWireSchema = roomObservationSchema
  .extend({
    roomDimensions: wireDimensions.extend({
      widthMeters: z.number().min(1).max(100),
      heightMeters: z.number().min(1).max(20),
      depthMeters: z.number().min(1).max(100),
    }),
    features: z
      .array(
        roomObservationSchema.shape.features.element
          .extend({
            dimensions: wireDimensions,
            attachment: z.enum(["FLOOR", "WALL", "CEILING", "FURNITURE"]).nullable(),
            wallFace: z.enum(["BACK", "FRONT", "LEFT", "RIGHT"]).nullable(),
            observationKey: id,
            attachmentTargetKey: id.nullable(),
            facesFeatureKey: id.nullable(),
          })
          .omit({ attachmentTargetIndex: true, facesFeatureIndex: true }),
      )
      .max(24),
  })
  .superRefine((observation, context) => {
    const keys = new Set(observation.features.map((feature) => feature.observationKey));
    if (keys.size !== observation.features.length)
      context.addIssue({ code: "custom", message: "Observed feature keys must be unique." });
    observation.features.forEach((feature, index) => {
      for (const field of ["attachmentTargetKey", "facesFeatureKey"] as const) {
        const target = feature[field];
        if (target && (!keys.has(target) || target === feature.observationKey))
          context.addIssue({
            code: "custom",
            path: ["features", index, field],
            message: "Use a distinct existing observation key.",
          });
      }
    });
  });
const axes = (v: z.infer<typeof wireDimensions>): [number, number, number] => [
  v.widthMeters,
  v.heightMeters,
  v.depthMeters,
];
export const roomObservationResponseSchema = z.union([
  roomObservationWireSchema.transform((value) => {
    const indices = new Map(value.features.map((feature, index) => [feature.observationKey, index]));
    return roomObservationSchema.parse({
      ...value,
      roomDimensions: axes(value.roomDimensions),
      features: value.features.map((feature) => ({
        matchedFeatureId: feature.matchedFeatureId,
        classification: feature.classification,
        name: feature.name,
        position: feature.position,
        yawDegrees: feature.yawDegrees,
        dimensions: axes(feature.dimensions),
        basis: feature.basis,
        confidence: feature.confidence,
        attachment: feature.attachment,
        wallFace: feature.wallFace,
        attachmentTargetIndex: feature.attachmentTargetKey === null ? null : indices.get(feature.attachmentTargetKey),
        facesFeatureIndex: feature.facesFeatureKey === null ? null : indices.get(feature.facesFeatureKey),
      })),
    });
  }),
  // Retained deterministic fixtures/older observations use the canonical ordered tuple shape.
  roomObservationSchema,
]);
