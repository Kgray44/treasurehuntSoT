import { z } from "zod";
import { editSpatialDraft, type SpatialDraft } from "./authoring";
import { validateSpatialAuthoring } from "./studio-validation";

export const intentProposalSchema = z.strictObject({
  placement: z.enum(["DESK", "WALL", "ENTRANCE", "LOCAL"]),
  content: z.string().trim().min(1).max(2000),
  alternativeText: z.string().trim().min(1).max(2000),
  explanation: z.string().trim().min(1).max(2000),
});
export type IntentProposal = z.infer<typeof intentProposalSchema>;
export function materializeIntent(draft: SpatialDraft, entityId: string, raw: unknown): SpatialDraft {
  const proposal = intentProposalSchema.parse(raw);
  const next = editSpatialDraft(draft, { type: "PLACEMENT", entityId, placement: proposal.placement });
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

/** Model output is untrusted data. Only this strict allowlist can propose reversible edits. */
export async function requestSpatialAI(
  kind: "INTENT" | "CRITIQUE",
  request: string,
  draft: SpatialDraft,
  fetcher: typeof fetch = fetch,
) {
  const endpoint = process.env.PARALLAX_AUTHORING_AI_URL;
  const token = process.env.PARALLAX_AUTHORING_AI_TOKEN;
  if (!endpoint || !token)
    return {
      status: "UNAVAILABLE" as const,
      message: "AI authoring is not configured. Manual authoring and deterministic validation remain available.",
    };
  const url = new URL(endpoint);
  if (url.protocol !== "https:") throw new Error("Spatial AI requires a configured HTTPS provider.");
  // External asset/room/library text is never promoted into model instructions or sent here.
  const payload = {
    schemaVersion: 1,
    task: kind,
    creatorRequest: request.slice(0, 2000),
    constraints: {
      placement: ["DESK", "WALL", "ENTRANCE", "LOCAL"],
      maximumEntities: 32,
      noExecutableContent: true,
      advisoryOnly: true,
      fixedAuthoringOnly: true,
    },
    scene: {
      entityCount: draft.content.entities.length,
      dimensionsMeters: draft.content.entities.map((e) => e.widthMeters),
      findings: validateSpatialAuthoring(draft.content).map((i) => ({ code: i.code, severity: i.severity })),
    },
    responseSchema: kind === "INTENT" ? z.toJSONSchema(intentProposalSchema) : z.toJSONSchema(critiqueSchema),
  };
  const response = await fetcher(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  if (!response.ok) throw new Error("The AI provider could not prepare a proposal. Your draft is unchanged.");
  const body = await response.text();
  if (body.length > 32000) throw new Error("The AI proposal exceeds the allowed size.");
  const data = JSON.parse(body);
  return kind === "INTENT"
    ? { status: "PROPOSED" as const, kind, proposal: intentProposalSchema.parse(data) }
    : { status: "PROPOSED" as const, kind, critique: critiqueSchema.parse(data) };
}
