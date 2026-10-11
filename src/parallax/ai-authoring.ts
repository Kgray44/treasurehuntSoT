import { z } from "zod";
import { editSpatialDraft, type SpatialDraft } from "./authoring";
import { semanticRecipeSchema } from "./adaptive-contracts";
import { enableAdaptiveAuthoring, invalidateAdaptiveCalibration } from "./adaptive-authoring";

export const intentProposalSchema = z.strictObject({
  placement: z.enum(["DESK", "WALL", "ENTRANCE", "LOCAL"]),
  content: z.string().trim().min(1).max(2000),
  alternativeText: z.string().trim().min(1).max(2000),
  explanation: z.string().trim().min(1).max(2000),
  semanticRecipe: semanticRecipeSchema.optional(),
});
export type IntentProposal = z.infer<typeof intentProposalSchema>;
export function materializeIntent(draft: SpatialDraft, entityId: string, raw: unknown): SpatialDraft {
  const proposal = intentProposalSchema.parse(raw);
  const next = proposal.semanticRecipe
    ? enableAdaptiveAuthoring(draft)
    : editSpatialDraft(draft, { type: "PLACEMENT", entityId, placement: proposal.placement });
  if (proposal.semanticRecipe) {
    if (proposal.semanticRecipe.entityId !== entityId) throw new Error("PARALLAX_AI_RECIPE_TARGET_MISMATCH");
    next.content.adaptive!.recipes = next.content.adaptive!.recipes.map((r) =>
      r.entityId === entityId ? proposal.semanticRecipe! : r,
    );
    invalidateAdaptiveCalibration(next);
  }
  const entity = next.content.entities.find((e) => e.id === entityId)!;
  entity.content = proposal.content;
  entity.alternativeText = proposal.alternativeText;
  next.content.studio!.provenance = {
    origin: "AI_ASSISTED",
    generator: "Parallax intent schema v1",
    license: "Creator review required",
  };
  return editSpatialDraft(next, { type: "REPLACE", draft: next });
}
export const critiqueSchema = z.strictObject({
  findings: z
    .array(
      z.strictObject({
        topic: z.enum(["DISCOVERY", "COMPATIBILITY", "PRIVACY", "SAFETY", "PERFORMANCE", "ACCESSIBILITY"]),
        message: z.string().trim().min(1).max(2000),
      }),
    )
    .max(12),
});

/** Retired compatibility entry: all inference uses the authenticated, metered
 * Spatial Assistant service. Legacy endpoint credentials never authorize a call. */
export async function requestSpatialAI(
  _kind: "INTENT" | "CRITIQUE",
  _request: string,
  _draft: SpatialDraft,
  _fetcher: typeof fetch = fetch,
) {
  void _fetcher;
  return {
    status: "UNAVAILABLE" as const,
    code: "LEGACY_AI_RETIRED",
    message:
      "Use Spatial Assistant to prepare a reviewed proposal. Manual authoring and deterministic validation remain available.",
  };
}
