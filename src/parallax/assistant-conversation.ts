import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import type { SpatialDraft } from "./authoring";
import { spatialId } from "./contracts";
import { assistantProposalSchema, SpatialAssistantError } from "./spatial-assistant";

// Private retained context shares the proposal's owner/draft scope and expiry.
// Clients supply an identity, never authoritative conversation text or operations.
export const retainedAssistantContextSchema = z.strictObject({
  request: z.string().trim().min(1).max(2000),
  previousRequestId: spatialId.nullable(),
});
const retainedProposal = z.object({
  status: z.literal("PROPOSED"),
  proposal: assistantProposalSchema,
  conversation: retainedAssistantContextSchema,
});
function unavailable(): never {
  throw new SpatialAssistantError(
    "CONTEXT_UNAVAILABLE",
    "The earlier task context is unavailable or expired. Start a new task using your current scene.",
    409,
  );
}

export async function readAssistantConversation(
  store: PrismaClient,
  accountId: string,
  draft: SpatialDraft,
  previousRequestId?: string | null,
  now = new Date(),
) {
  const turns = [];
  const seen = new Set<string>();
  let identity = previousRequestId;
  const currentIds = new Set(draft.content.entities.map((entity) => entity.id));
  const groupIds = new Set(draft.content.studio?.editingGroups?.map((group) => group.id) ?? []);
  const featureIds = new Set(draft.content.studio?.environment?.features.map((feature) => feature.id) ?? []);
  while (identity && turns.length < 2) {
    if (seen.has(identity)) unavailable();
    seen.add(identity);
    const rows = await store.aIUsageLedger.findMany({
      where: {
        accountId,
        definitionId: draft.content.definitionId,
        requestId: identity,
        status: { in: ["SETTLED", "UNKNOWN"] },
        result: { not: null },
        resultExpiresAt: { gt: now },
      },
      select: { result: true },
      take: 2,
    });
    if (rows.length !== 1) unavailable();
    let raw: unknown;
    try {
      raw = JSON.parse(rows[0].result!);
    } catch {
      unavailable();
    }
    const parsed = retainedProposal.safeParse(raw);
    if (
      !parsed.success ||
      parsed.data.proposal.requestId !== identity ||
      parsed.data.proposal.definitionId !== draft.content.definitionId
    )
      unavailable();
    const { proposal, conversation } = parsed.data;
    turns.push({
      requestId: identity,
      creatorRequest: conversation.request,
      intentType: proposal.intentType,
      summary: proposal.summary,
      clarification: proposal.clarification,
      authority: "ADVISORY_ONLY" as const,
      baseRevision: proposal.sceneRevision,
      operations: proposal.operations.map((operation) => {
        const entityId =
          operation.type === "DUPLICATE"
            ? operation.newEntityId
            : operation.type === "ANIMATION"
              ? operation.track.entityId
              : "entityId" in operation
                ? operation.entityId
                : operation.type === "BEHAVIOR"
                  ? operation.targetEntityId
                  : null;
        return {
          type: operation.type,
          entityId,
          trackId:
            operation.type === "ANIMATION" ? operation.track.id : "trackId" in operation ? operation.trackId : null,
          behaviorId: "behaviorId" in operation ? operation.behaviorId : null,
          changedFields:
            operation.type === "CONTENT"
              ? (["name", "content", "alternativeText", "widthMeters", "interactions"] as const).filter(
                  (field) => operation[field] !== null,
                )
              : operation.type === "SCENE_DETAILS"
                ? (["title", "tags", "collection", "favorite"] as const).filter((field) => operation[field] !== null)
                : [],
          groupId: "groupId" in operation ? operation.groupId : null,
          groupExistsInCurrentScene: "groupId" in operation && groupIds.has(operation.groupId),
          featureId: "featureId" in operation ? operation.featureId : null,
          featureExistsInCurrentScene: "featureId" in operation && featureIds.has(operation.featureId),
          existsInCurrentScene: entityId ? currentIds.has(entityId) : false,
          proposedName: operation.type === "CREATE" ? operation.name : null,
        };
      }),
    });
    identity = conversation.previousRequestId;
  }
  // Chronological, bounded context. No recursive proposal bodies or whole scenes.
  return turns.reverse();
}

/** Strip private retained context on idempotent replay. */
export function publicAssistantResult(raw: unknown) {
  const schema = z.discriminatedUnion("status", [
    z.object({ status: z.literal("PROPOSED"), proposal: assistantProposalSchema, accounting: z.string().optional() }),
    z.object({
      status: z.literal("FAILED"),
      code: z.string().max(100),
      message: z.string().max(1000),
      accounting: z.string().optional(),
    }),
  ]);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) unavailable();
  return parsed.data;
}
