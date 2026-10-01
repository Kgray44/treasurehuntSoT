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
  method: z.enum(["FOREGROUND_LOCATION", "PLAYER_FALLBACK", "LANDMARK"]),
  observations: z.array(observationSchema).max(20).optional(),
  contextualEvidence: z.array(contextualEvidenceSchema).max(40).optional(),
  landmarkReceipt: z.string().min(1).max(4096).optional(),
});
export type PlayerLandfallEvidence = z.infer<typeof playerLandfallEvidenceSchema>;
