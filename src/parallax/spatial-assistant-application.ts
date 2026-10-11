import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { canonicalChecksum } from "@/drydock/canonical";
import { draftSchema } from "./authoring";
import { spatialId } from "./contracts";
import { assertSpatialDraftAccess, spatialItemKind, saveSpatialDraftInTransaction } from "./library-service";
import { assertCalibrationClaim } from "./field-service";
import { lockAIControl } from "./ai-ledger";
import { assistantProposalSchema, materializeAssistantProposal, SpatialAssistantError } from "./spatial-assistant";

export const assistantApplicationSchema = z.strictObject({
  proposal: assistantProposalSchema,
  selectedOperationIds: z.array(spatialId).min(1).max(24),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
});
export type AssistantApplication = z.infer<typeof assistantApplicationSchema>;

/** Owner-side preparation without writes; Apply calls this within the canonical save transaction. */
export async function prepareSpatialAssistantApplication(
  accountId: string,
  raw: unknown,
  store: PrismaClient | Prisma.TransactionClient = db,
  now = new Date(),
) {
  return prepareOwnedApplication(accountId, raw, store, now);
}
async function prepareOwnedApplication(
  accountId: string,
  raw: unknown,
  store: PrismaClient | Prisma.TransactionClient,
  now: Date,
  authorizedChecksum?: string,
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
  if (authorizedChecksum !== undefined && working.checksum !== authorizedChecksum)
    throw new SpatialAssistantError(
      "STALE_SCENE",
      "The saved scene changed after access verification. Review its current revision.",
      409,
    );
  if (authorizedChecksum === undefined) await assertSpatialDraftAccess(draft);
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

/** Commit canonical save/CAS and durable retry metadata together. No provider call.
 * Replays acknowledge only the unchanged saved result; never overwrite later work. */
export async function applySpatialAssistant(
  accountId: string,
  raw: unknown,
  store: PrismaClient = db,
  now = new Date(),
) {
  const input = assistantApplicationSchema.parse(raw);
  const fingerprint = canonicalChecksum(input);
  // Canonical session/Chronicle authorization uses the ordinary client. Resolve
  // it before the SQLite transaction, then bind every tx read to this checksum.
  const owned = await store.reusableAuthoringItem.findFirst({
    where: { id: input.proposal.definitionId, ownerAccountId: accountId, kind: spatialItemKind, archivedAt: null },
    include: { versions: { where: { versionNumber: 0 } } },
  });
  const authorized = owned?.versions[0];
  if (!authorized) throw new SpatialAssistantError("DRAFT_UNAVAILABLE", "The owned working draft is unavailable.", 404);
  const authorizedDraft = draftSchema.parse(JSON.parse(authorized.envelope));
  if (canonicalChecksum(authorizedDraft) !== authorized.checksum)
    throw new SpatialAssistantError(
      "STALE_SCENE",
      "The saved scene could not be verified. Refresh it before applying changes.",
      409,
    );
  await assertSpatialDraftAccess(authorizedDraft);
  return store.$transaction(
    async (tx) => {
      await lockAIControl(tx);
      const receipt = await tx.aIUsageLedger.findUnique({
        where: { accountId_applicationKey: { accountId, applicationKey: input.idempotencyKey } },
      });
      if (receipt) {
        if (receipt.applicationFingerprint !== fingerprint)
          throw new SpatialAssistantError(
            "IDEMPOTENCY_CONFLICT",
            "This apply identity belongs to different reviewed changes.",
            409,
          );
        const item = await tx.reusableAuthoringItem.findFirst({
          where: { id: receipt.definitionId, ownerAccountId: accountId, kind: spatialItemKind, archivedAt: null },
          include: { versions: { where: { versionNumber: 0 } } },
        });
        const working = item?.versions[0];
        if (
          !working ||
          item!.currentVersionNumber !== receipt.applicationRevision ||
          working.checksum !== receipt.applicationChecksum ||
          canonicalChecksum(JSON.parse(working.envelope)) !== receipt.applicationChecksum
        )
          throw new SpatialAssistantError(
            "PROPOSAL_ALREADY_APPLIED",
            "These changes were saved earlier. Reopen the current scene to preserve later work.",
            409,
          );
        const draft = draftSchema.parse(JSON.parse(working.envelope));
        await assertCalibrationClaim(accountId, draft, tx);
        return { status: "SAVED" as const, draft, revision: receipt.applicationRevision! };
      }
      const applied = await tx.aIUsageLedger.findFirst({
        where: {
          accountId,
          requestId: input.proposal.requestId,
          definitionId: input.proposal.definitionId,
          applicationKey: { not: null },
        },
      });
      if (applied)
        throw new SpatialAssistantError(
          "PROPOSAL_ALREADY_APPLIED",
          "This proposal has already been saved. Request a fresh proposal for further changes.",
          409,
        );
      const prepared = await prepareOwnedApplication(accountId, input, tx, now, authorized.checksum);
      const revision = await saveSpatialDraftInTransaction(accountId, prepared.draft, prepared.expectedRevision, tx);
      const claimed = await tx.aIUsageLedger.updateMany({
        where: { id: prepared.admissionId, accountId, applicationKey: null },
        data: {
          applicationKey: input.idempotencyKey,
          applicationFingerprint: fingerprint,
          applicationRevision: revision,
          applicationChecksum: canonicalChecksum(prepared.draft),
          appliedAt: now,
        },
      });
      if (claimed.count !== 1)
        throw new SpatialAssistantError(
          "PROPOSAL_ALREADY_APPLIED",
          "This proposal has already been saved. Reopen its current scene.",
          409,
        );
      return { status: "SAVED" as const, draft: prepared.draft, revision };
    },
    { maxWait: 10000, timeout: 15000 },
  );
}
