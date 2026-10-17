import { z } from "zod";
const score = z.number().finite().min(0).max(1).nullable();
const landmark = z.strictObject({
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
  z: z.number().finite(),
  valid: z.boolean(),
});
/** Auxiliary monocular estimates beyond the image, never observed landmarks. */
const offImageFingerLandmark = z
  .strictObject({
    index: z
      .number()
      .int()
      .min(10)
      .max(20)
      .refine((index) => index !== 17),
    x: z.number().finite().min(-0.15).max(1.15),
    y: z.number().finite().min(-0.15).max(1.15),
    z: z.number().finite(),
  })
  .refine((point) => point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1);
export const handObservationSchema = z.strictObject({
  observationVersion: z.literal(1),
  providerId: z.string().min(1),
  providerVersion: z.string().min(1),
  modelId: z.string().min(1),
  modelVersion: z.string().min(1),
  modelDigest: z.string().regex(/^[a-f0-9]{64}$/),
  providerGeneration: z.number().int().positive(),
  observationId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  monotonicCaptureTime: z.number().finite().nonnegative(),
  monotonicInferenceTime: z.number().finite().nonnegative(),
  cameraLeaseId: z.string().min(1),
  cameraFrameVersion: z.number().int().positive(),
  frameWidth: z.number().int().positive(),
  frameHeight: z.number().int().positive(),
  orientation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  mirrorTransform: z.enum(["NONE", "PREVIEW_X"]),
  evidenceTier: z.enum(["UNQUALIFIED", "D0", "D1", "D4", "D5"]),
  hands: z
    .array(
      z
        .strictObject({
          trackId: z.string().min(1),
          trackGeneration: z.number().int().positive(),
          continuity: z.enum(["ACQUIRED", "CONTINUOUS", "AMBIGUOUS"]).optional(),
          handedness: z.enum(["LEFT", "RIGHT", "UNKNOWN"]),
          handednessConfidence: score,
          coordinateFrame: z.literal("CAMERA_IMAGE_NORMALIZED"),
          landmarks: z.array(landmark).length(21),
          offImageFingerLandmarks: z
            .array(offImageFingerLandmark)
            .max(12)
            .refine((points) => new Set(points.map((point) => point.index)).size === points.length)
            .optional(),
          presenceScore: score,
          trackingScore: score,
          occluded: z.boolean(),
          pose: z.enum(["POINT_CANDIDATE", "UNKNOWN"]),
          uncertainty: z.number().finite().nonnegative().nullable(),
        })
        .refine(
          (hand) =>
            hand.offImageFingerLandmarks?.every((point) => hand.landmarks[point.index]?.valid === false) ?? true,
        ),
    )
    .max(2),
  quality: z.enum(["USABLE", "LOW", "UNKNOWN"]),
  reason: z.enum(["NONE", "NO_HAND", "MULTIPLE_HANDS", "LOW_VISIBILITY", "MODEL_FAILURE", "INTERRUPTED"]),
});
export type HandObservation = z.infer<typeof handObservationSchema>;
