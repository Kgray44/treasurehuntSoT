import { z } from "zod";
export const handInferenceBackendSchema = z.enum(["CPU_WASM", "GPU_WEBGL"]);
export type HandInferenceBackend = z.infer<typeof handInferenceBackendSchema>;
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
export const handObservationSchema = z
  .strictObject({
    observationVersion: z.literal(1),
    providerId: z.string().min(1),
    providerVersion: z.string().min(1),
    modelId: z.string().min(1),
    modelVersion: z.string().min(1),
    modelDigest: z.string().regex(/^[a-f0-9]{64}$/),
    inferenceBackend: handInferenceBackendSchema.optional(),
    providerGeneration: z.number().int().positive(),
    observationId: z.string().min(1),
    sequence: z.number().int().nonnegative(),
    monotonicCaptureTime: z.number().finite().nonnegative(),
    monotonicPixelOriginTime: z.number().finite().nonnegative().optional(),
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
            associationBasis: z.literal("INDEX_CHAIN_V1").optional(),
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
  })
  .refine(
    (o) => o.monotonicPixelOriginTime === undefined || o.monotonicPixelOriginTime <= o.monotonicCaptureTime + 5,
    "OBSERVATION_PIXEL_ORIGIN_CLOCK_INVALID",
  );
export type HandObservation = z.infer<typeof handObservationSchema>;

/** Oldest known pixel/dispatch clock; this never replaces the sample or pacer clock. */
export function observationFreshnessTime(o: {
  monotonicCaptureTime: number;
  monotonicPixelOriginTime?: number;
}): number {
  const capture = o.monotonicCaptureTime,
    origin = o.monotonicPixelOriginTime;
  if (
    !Number.isFinite(capture) ||
    capture < 0 ||
    (origin !== undefined && (!Number.isFinite(origin) || origin < 0 || origin > capture + 5))
  )
    return -Infinity;
  return Math.min(capture, origin ?? capture);
}
