import { db } from "@/lib/db";
import { CommunityError } from "./domain";
import type { CommunityActor } from "./services";
import type { CommunityAssetStorageProvider } from "./storage";

export async function registerStagedAsset(
  actor: CommunityActor,
  storage: CommunityAssetStorageProvider,
  input: { name: string; bytes: Uint8Array; declaredMimeType: string; detectedMimeType?: string },
) {
  const profile = await db.communityProfile.findUnique({ where: { playerProfileId: actor.playerProfileId } });
  if (!profile || profile.moderationStatus !== "ACTIVE")
    throw new CommunityError("COMMUNITY_ACCESS_DENIED", "An active Community Profile is required.");
  const stored = await storage.putStagedObject(profile.id, input.name, input.bytes);
  return db.communityAssetReference.create({
    data: {
      ownerProfileId: profile.id,
      checksum: stored.checksum,
      declaredMimeType: input.declaredMimeType,
      detectedMimeType: input.detectedMimeType ?? null,
      fileSize: input.bytes.byteLength,
      storageProvider: "local",
      storageKey: stored.key,
      scanStatus: "SCAN_NOT_CONFIGURED",
      processingStatus: "UPLOADED",
    },
  });
}
export async function attachAssetToRelease(
  actor: CommunityActor,
  storage: CommunityAssetStorageProvider,
  assetId: string,
  releaseId: string,
) {
  const profile = await db.communityProfile.findUnique({ where: { playerProfileId: actor.playerProfileId } });
  const asset = await db.communityAssetReference.findFirst({ where: { id: assetId, ownerProfileId: profile?.id } });
  const release = await db.communityRelease.findFirst({
    where: { id: releaseId, listing: { ownerProfileId: profile?.id } },
  });
  if (!asset || !release) throw new CommunityError("COMMUNITY_ACCESS_DENIED", "You cannot attach this asset.");
  const copied = await storage.copyToImmutableRelease(asset.storageKey, releaseId);
  if (copied.checksum !== asset.checksum)
    throw new CommunityError("COMMUNITY_STORAGE_ERROR", "Asset checksum changed during immutable copy.");
  return db.communityAssetReference.update({
    where: { id: asset.id },
    data: { releaseId, storageKey: copied.key, processingStatus: "READY" },
  });
}
export async function readAuthorizedCommunityAsset(
  actor: CommunityActor,
  storage: CommunityAssetStorageProvider,
  assetId: string,
) {
  const profile = await db.communityProfile.findUnique({ where: { playerProfileId: actor.playerProfileId } });
  const asset = await db.communityAssetReference.findFirst({
    where: { id: assetId, ownerProfileId: profile?.id, removedAt: null },
  });
  if (!asset) throw new CommunityError("COMMUNITY_ACCESS_DENIED", "Asset not found.");
  return storage.readObject(asset.storageKey);
}
export async function quarantineAsset(actor: CommunityActor, storage: CommunityAssetStorageProvider, assetId: string) {
  if (actor.role !== "MODERATOR" && actor.role !== "ADMIN")
    throw new CommunityError("COMMUNITY_ACCESS_DENIED", "Moderation capability is required.");
  const asset = await db.communityAssetReference.findUnique({ where: { id: assetId } });
  if (!asset) throw new CommunityError("COMMUNITY_STORAGE_ERROR", "Asset not found.");
  const moved = await storage.moveToQuarantine(asset.storageKey);
  return db.communityAssetReference.update({
    where: { id: asset.id },
    data: { storageKey: moved.key, scanStatus: "SUSPICIOUS", processingStatus: "QUARANTINED", visibility: "PRIVATE" },
  });
}
