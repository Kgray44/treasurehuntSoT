import { z } from "zod";
import { indexImageAlgorithm, type IndexImageObservation } from "./index-image-tracker";

const nonempty = z.string().refine((value) => value.trim().length > 0);
const generation = z.number().finite().int().positive();
const clock = z.number().finite().nonnegative();
const diagnostic = z.number().finite().nullable();
const nonnegativeDiagnostic = z.number().finite().nonnegative().nullable();
const imagePoint = z.strictObject({ x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1) });
const contextSchema = z.strictObject({
  providerGeneration: generation,
  cameraLeaseId: nonempty,
  cameraFrameVersion: generation,
  mirrorTransform: z.enum(["NONE", "PREVIEW_X"]),
  orientation: z.literal(0),
});
export type IndexImageObservationBinding = z.infer<typeof contextSchema>;

/** Metadata only: image pixels, model landmarks and extra payloads are rejected. */
export const indexImageObservationSchema = z
  .strictObject({
    observationVersion: z.literal(1),
    providerId: z.literal(indexImageAlgorithm.providerId),
    providerVersion: z.literal(indexImageAlgorithm.providerVersion),
    algorithmDigest: z.literal(indexImageAlgorithm.algorithmDigest),
    ...contextSchema.shape,
    frameWidth: z.number().finite().int().positive(),
    frameHeight: z.number().finite().int().positive(),
    sequence: z.number().finite().int().nonnegative(),
    monotonicCaptureTime: clock,
    monotonicInferenceTime: clock,
    trackId: nonempty.nullable(),
    trackGeneration: z.number().finite().int().nonnegative(),
    point: imagePoint.nullable(),
    matchedPoint: imagePoint.nullable().optional(),
    state: z.enum(["UNSEEDED", "TRACKING", "UNCERTAIN", "LOST"]),
    modelAgreement: z.enum(["AGREE", "DISAGREE", "UNAVAILABLE"]),
    anchorSource: z.enum(["MODEL_INDEX", "MANUAL_HINT"]).nullable(),
    quality: z.strictObject({
      correlation: diagnostic,
      separation: diagnostic,
      texture: nonnegativeDiagnostic,
      forwardBackwardErrorPixels: nonnegativeDiagnostic,
    }),
    uncertaintyRadiusPixels: nonnegativeDiagnostic,
    reason: nonempty,
  })
  .refine((o) => (o.trackId === null ? o.trackGeneration === 0 : o.trackGeneration > 0))
  .refine((o) =>
    o.state === "TRACKING" ? o.point !== null && o.trackId !== null && o.trackGeneration > 0 : o.point === null,
  )
  .refine((o) => {
    if (o.matchedPoint == null) return true;
    if (o.state === "TRACKING")
      return o.point !== null && o.point.x === o.matchedPoint.x && o.point.y === o.matchedPoint.y;
    return o.state === "UNCERTAIN" && o.reason.startsWith("FULL_HAND_") && o.trackId !== null && o.trackGeneration > 0;
  });

/** A rejected envelope never advances the original-pixel clock or frame binding. */
export class IndexImageObservationGate {
  readonly binding: Readonly<IndexImageObservationBinding>;
  private sequence = -1;
  private capture = -1;
  private frame: string | null = null;
  constructor(binding: IndexImageObservationBinding) {
    this.binding = Object.freeze(contextSchema.parse(binding));
  }
  accept(input: unknown, now: number): IndexImageObservation {
    const o = indexImageObservationSchema.parse(input);
    if (
      !Number.isFinite(now) ||
      now < 0 ||
      Object.entries(this.binding).some(([key, value]) => o[key as keyof IndexImageObservation] !== value)
    )
      throw new Error("INDEX_IMAGE_BINDING_MISMATCH");
    if (o.sequence <= this.sequence || o.monotonicCaptureTime <= this.capture) throw new Error("INDEX_IMAGE_REORDERED");
    if (
      now - o.monotonicCaptureTime > 150 ||
      o.monotonicInferenceTime < o.monotonicCaptureTime ||
      o.monotonicInferenceTime > now + 5
    )
      throw new Error("INDEX_IMAGE_CLOCK_OR_FRESHNESS");
    const frame = `${o.frameWidth}:${o.frameHeight}`;
    if (this.frame !== null && frame !== this.frame) throw new Error("INDEX_IMAGE_FRAME_CHANGED");
    this.sequence = o.sequence;
    this.capture = o.monotonicCaptureTime;
    this.frame = frame;
    return o;
  }
}
