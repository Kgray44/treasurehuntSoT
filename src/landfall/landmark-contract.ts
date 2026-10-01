import { z } from "zod";
import { landfallId } from "@/landfall/schema";
import { observationSchema } from "@/landfall/observation";

export const landmarkComparisonSchema = z.strictObject({
  sessionId: landfallId,
  publishedVersionId: landfallId,
  expectedSequence: z.number().int().nonnegative(),
  worldspaceId: landfallId,
  waypointId: landfallId,
  landmarkId: landfallId,
  observations: z.array(observationSchema).min(1).max(20),
  // Small stills only. No video, URLs, or externally fetched Player imagery.
  frames: z
    .array(
      z
        .string()
        .max(350_000)
        .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/),
    )
    .min(2)
    .max(5),
});
export type LandmarkComparison = z.infer<typeof landmarkComparisonSchema>;
export type LandmarkResult = "unavailable" | "insufficient" | "possible" | "likely" | "confirmed";

export const landmarkReceiptPayloadSchema = z.strictObject({
  id: landfallId,
  sessionId: landfallId,
  playerProfileId: landfallId,
  publishedVersionId: landfallId,
  expectedSequence: z.number().int().nonnegative(),
  worldspaceId: landfallId,
  waypointId: landfallId,
  landmarkId: landfallId,
  regionId: landfallId,
  definitionHash: z.string().regex(/^[a-f0-9]{64}$/),
  frameCount: z.number().int().min(2).max(5),
  result: z.literal("confirmed"),
  issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative(),
});
export type LandmarkReceiptPayload = z.infer<typeof landmarkReceiptPayloadSchema>;
