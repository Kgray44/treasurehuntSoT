import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { SpatialAssistantError } from "./spatial-assistant";

/** Authenticated owner feedback records only preview/rejection. Acceptance and
 * Apply are emitted exclusively by their canonical save transactions. */
export async function recordAIPreviewDecision(
  accountId: string,
  requestId: string,
  decision: "PREVIEWED" | "REJECTED",
  store: PrismaClient = db,
  now = new Date(),
) {
  const rows = await store.aIUsageLedger.findMany({ where: { accountId, requestId }, select: { id: true }, take: 2 });
  if (rows.length !== 1)
    throw new SpatialAssistantError("OPERATION_UNAVAILABLE", "This owned operation is unavailable.", 404);
  await store.$transaction(async (tx) => {
    await tx.aIUsageLedger.updateMany({
      where: {
        id: rows[0].id,
        accountId,
        ...(decision === "PREVIEWED" ? { previewedAt: null } : { rejectedAt: null }),
        outcome: { in: ["PROPOSED", "GENERATED", "PREVIEWED", "REJECTED"] },
      },
      data: {
        ...(decision === "PREVIEWED" ? { previewedAt: now } : { rejectedAt: now }),
      },
    });
    await tx.aIUsageLedger.updateMany({
      where: {
        id: rows[0].id,
        accountId,
        outcome: {
          in:
            decision === "PREVIEWED"
              ? ["PROPOSED", "GENERATED", "PREVIEWED"]
              : ["PROPOSED", "GENERATED", "PREVIEWED", "REJECTED"],
        },
      },
      data: { outcome: decision, outcomeAt: now },
    });
  });
  return { recorded: true };
}

/** A later canonical room save can mark an existing accepted room as edited.
 * The comparison uses room geometry, so metadata-only saves do not imply editing. */
export async function recordAICanonicalSave(
  tx: Prisma.TransactionClient,
  accountId: string,
  definitionId: string,
  roomChecksum: string | null,
  documentChecksum: string,
  now = new Date(),
) {
  if (roomChecksum)
    await tx.aIUsageLedger.updateMany({
      where: {
        accountId,
        acceptedResourceId: definitionId,
        outcome: "ACCEPTED",
        acceptedVersion: { not: roomChecksum },
      },
      data: { outcome: "ACCEPTED_THEN_EDITED", outcomeAt: now },
    });
  await tx.aIUsageLedger.updateMany({
    where: {
      accountId,
      definitionId,
      outcome: "APPLIED",
      outcomeEvidence: { contains: `"previousChecksum":"${documentChecksum}"` },
    },
    data: { outcome: "UNDONE", undoneAt: now, outcomeAt: now },
  });
}
