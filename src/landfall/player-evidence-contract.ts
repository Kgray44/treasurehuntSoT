import { z } from "zod";
import { landfallId } from "@/landfall/schema";
import { observationSchema } from "@/landfall/observation";
import { contextualEvidenceSchema } from "@/landfall/contextual";

/** Shared input validation; importing this schema never loads a server signing key. */
export const playerLandfallEvidenceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  sessionId: landfallId,
  publishedVersionId: landfallId,
  worldspaceId: landfallId,
  waypointId: landfallId,
  evidenceId: landfallId,
  expectedSequence: z.number().int().nonnegative(),
  idempotencyKey: landfallId,
  method: z.enum(["FOREGROUND_LOCATION", "PLAYER_FALLBACK", "LANDMARK", "WATCHGLASS", "EVIDENCE_BUNDLE"]),
  sources: z
    .array(
      z.discriminatedUnion("method", [
        z.strictObject({
          method: z.literal("FOREGROUND_LOCATION"),
          evidenceId: landfallId,
          observations: z.array(observationSchema).min(1).max(20),
        }),
        z.strictObject({
          method: z.literal("WATCHGLASS"),
          evidenceId: landfallId,
          watchglassReceipt: z.string().min(1).max(8192),
        }),
        z.strictObject({
          method: z.literal("LANDMARK"),
          evidenceId: landfallId,
          landmarkReceipt: z.string().min(1).max(4096),
        }),
        z.strictObject({ method: z.literal("PLAYER_FALLBACK"), evidenceId: landfallId }),
      ]),
    )
    .min(1)
    .max(4)
    .optional(),
  observations: z.array(observationSchema).max(20).optional(),
  contextualEvidence: z.array(contextualEvidenceSchema).max(40).optional(),
  watchglassReceipt: z.string().min(1).max(8192).optional(),
  landmarkReceipt: z.string().min(1).max(4096).optional(),
});
export type PlayerLandfallEvidence = z.infer<typeof playerLandfallEvidenceSchema>;
