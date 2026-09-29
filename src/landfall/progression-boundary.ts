import { z } from "zod";
import { landfallId, observationSourceSchema } from "@/landfall/schema";

/** Proposal only. One Voyage owns the eventual transaction and canonical event. */
export const landfallCompletionRequestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  sessionId: landfallId,
  publishedVersionId: landfallId,
  worldspaceId: landfallId,
  waypointId: landfallId,
  evidenceId: landfallId,
  expectedSequence: z.number().int().nonnegative(),
  idempotencyKey: landfallId,
  method: observationSourceSchema,
  outcome: z.enum(["NEARBY", "LIKELY_INSIDE", "CONFIRMED"]),
  observedAt: z.string().datetime({ offset: true }),
});
export type LandfallCompletionRequest = z.infer<typeof landfallCompletionRequestSchema>;

export function createLandfallCompletionRequest(input: LandfallCompletionRequest): LandfallCompletionRequest {
  return landfallCompletionRequestSchema.parse(input);
}
