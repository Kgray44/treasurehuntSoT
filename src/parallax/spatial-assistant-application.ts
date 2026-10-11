import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { canonicalChecksum } from "@/drydock/canonical";
import { draftSchema } from "./authoring";
import { spatialId } from "./contracts";
import { assertSpatialDraftAccess, spatialItemKind } from "./library-service";
import { assistantProposalSchema, materializeAssistantProposal, SpatialAssistantError } from "./spatial-assistant";

export const assistantApplicationSchema = z.strictObject({
  proposal: assistantProposalSchema,
  selectedOperationIds: z.array(spatialId).min(1).max(24),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
});
export type AssistantApplication = z.infer<typeof assistantApplicationSchema>;

/** Owner-side application preparation, with no writes. Final integration must
 * invoke this inside the canonical save transaction and commit its CAS/receipt
 * atomically. This function alone is NOT a completed or saved application. */
export async function prepareSpatialAssistantApplication(
  accountId: string,
  raw: unknown,
  store: PrismaClient | Prisma.TransactionClient = db,
  now = new Date(),
) {
  const input = assistantApplicationSchema.parse(raw);
  const records = await store.aIUsageLedger.findMany({
    where: {
      accountId,
      requestId: input.proposal.requestId,
      definitionId: input.proposal.definitionId,
      status: { in: ["SETTLED", "UNKNOWN"] },
      result: { not: null },
      resultExpiresAt: { gt: now },
    },
    take: 2,
  });
  if (records.length !== 1)
    throw new SpatialAssistantError(
      "PROPOSAL_UNAVAILABLE",
      "This reviewed proposal is unavailable or expired. Request a fresh proposal.",
      409,
    );
  const result = z
    .object({ status: z.literal("PROPOSED"), proposal: assistantProposalSchema })
    .safeParse(JSON.parse(records[0].result!));
  if (!result.success || canonicalChecksum(result.data.proposal) !== canonicalChecksum(input.proposal))
    throw new SpatialAssistantError(
      "PROPOSAL_MISMATCH",
      "The reviewed proposal changed. Request a fresh proposal.",
      409,
    );
  const item = await store.reusableAuthoringItem.findFirst({
    where: { id: input.proposal.definitionId, ownerAccountId: accountId, kind: spatialItemKind, archivedAt: null },
    include: { versions: { where: { versionNumber: 0 } } },
  });
  const working = item?.versions[0];
  if (!item || !working)
    throw new SpatialAssistantError("DRAFT_UNAVAILABLE", "The owned working draft is unavailable.", 404);
  const draft = draftSchema.parse(JSON.parse(working.envelope));
  await assertSpatialDraftAccess(draft);
  if (working.checksum !== canonicalChecksum(draft))
    throw new SpatialAssistantError(
      "STALE_SCENE",
      "The saved scene could not be verified. Refresh it before applying changes.",
      409,
    );
  const next = await materializeAssistantProposal(
    draft,
    item.currentVersionNumber,
    result.data.proposal,
    input.selectedOperationIds,
  );
  return {
    input,
    proposal: result.data.proposal,
    expectedRevision: item.currentVersionNumber,
    previousChecksum: working.checksum,
    draft: next,
    admissionId: records[0].id,
  };
}
