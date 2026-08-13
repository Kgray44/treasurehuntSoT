import { db } from "@/lib/db";
import { createProtectedMediaAssociation, listOwnerProtectedMedia } from "@/private-content/media/service";

async function ownedActiveMemory(playerProfileId: string, recordId: string, memoryId: string) {
  const memory = await db.chronicleMemory.findFirst({
    where: {
      id: memoryId,
      playerProfileId,
      playerChronicleRecordId: recordId,
      deletedAt: null,
      record: { playerProfileId },
    },
    select: { id: true, updatedAt: true },
  });
  if (!memory) throw new Error("Chronicle Memory not found.");
  return memory;
}

/** Lists only clean, available owner media; storage identifiers never leave Sealed Hold. */
export async function listAvailableMemoryMedia(ownerAccountId: string, playerProfileId: string, recordId: string) {
  const record = await db.playerChronicleRecord.findFirst({
    where: { id: recordId, playerProfileId },
    select: { id: true },
  });
  if (!record) throw new Error("Chronicle history record not found.");
  const media = await listOwnerProtectedMedia(ownerAccountId);
  return media
    .filter(
      (item: { scanState: string; availabilityState: string; withdrawnAt: Date | null }) =>
        item.scanState === "CLEAN" && item.availabilityState === "AVAILABLE" && !item.withdrawnAt,
    )
    .map((item: { id: string; mediaKind: string; accessibilityDescription: string | null }) => ({
      id: item.id,
      kind: item.mediaKind,
      description: item.accessibilityDescription,
    }));
}

/** Binds an existing clean owner asset to one private Chronicle Memory. */
export async function attachMemoryMedia(input: {
  ownerAccountId: string;
  playerProfileId: string;
  recordId: string;
  memoryId: string;
  mediaId: string;
}) {
  const memory = await ownedActiveMemory(input.playerProfileId, input.recordId, input.memoryId);
  return createProtectedMediaAssociation({
    ownerAccountId: input.ownerAccountId,
    mediaId: input.mediaId,
    authority: "WAYFARER",
    subjectKind: "WAYFARER_MEMORY",
    subjectOpaqueId: memory.id,
    purpose: "MEMORY_PRIVATE",
    role: "MEMORY_ATTACHMENT",
    sourceRevision: memory.updatedAt.toISOString(),
    subjectOwnerConfirmed: true,
  });
}
