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
      }),
    )
    .max(48),
  uncertainties: z.array(z.string().trim().min(1).max(300)).max(16),
});
export type RoomObservation = z.infer<typeof roomObservationSchema>;
