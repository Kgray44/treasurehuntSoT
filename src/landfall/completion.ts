import { z } from "zod";
import { landfallId } from "@/landfall/schema";

export const landfallCompletionOptionsSchema = z.strictObject({
  worldspaceId: landfallId,
  locationId: landfallId,
  requiredOutcome: z.enum(["NEARBY", "LIKELY_INSIDE", "CONFIRMED"]),
  dwellSeconds: z.number().finite().nonnegative().max(3600).optional(),
  allowCaptainOverride: z.boolean(),
  allowPlayerFallback: z.boolean(),
  replayPolicy: z.enum(["PRESENTATION_ONLY", "NONE"]),
});
export type LandfallCompletionOptions = z.infer<typeof landfallCompletionOptionsSchema>;

export function landfallCompletionOptions(completion: Record<string, unknown>): LandfallCompletionOptions | null {
  if (completion.mode !== "landfall") return null;
  const provider = completion.provider;
  if (!provider || typeof provider !== "object" || Array.isArray(provider)) return null;
  const envelope = provider as Record<string, unknown>;
  if (envelope.id !== "landfall" || envelope.version !== 1) return null;
  return landfallCompletionOptionsSchema.parse(envelope.options);
}

export function landfallOutcomeSatisfies(
  actual: "NEARBY" | "LIKELY_INSIDE" | "CONFIRMED",
  required: "NEARBY" | "LIKELY_INSIDE" | "CONFIRMED",
) {
  const rank = { NEARBY: 1, LIKELY_INSIDE: 2, CONFIRMED: 3 };
  return rank[actual] >= rank[required];
}
