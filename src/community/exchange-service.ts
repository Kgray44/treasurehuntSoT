import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { CommunityError } from "./domain";
import { beginInstallOperation, commitInstallOperation, createInstallPlan, type InstallMode } from "./exchange";
import { verifyCommunityPackage, type CommunityPackageFile } from "./package";

// Prisma is generated at deploy/test time from the Phase 2 schemas. Keeping
// this narrow adapter avoids a second Chronicle or identity aggregate.
const exchangeDb = db as unknown as {
  communityRelease: typeof db.communityRelease;
  communityPackage: { create(input: unknown): Promise<{ id: string; packageChecksum: string }> };
  communityPackageItem: { createMany(input: unknown): Promise<unknown> };
  communityInstallOperation: { create(input: unknown): Promise<{ id: string }> };
  communityInstallMapping: { createMany(input: unknown): Promise<unknown> };
  communityInstallation: { create(input: unknown): Promise<{ id: string }> };
};

export async function preflightCommunityPublication(accountId: string, releaseId: string, manifest: unknown, files: CommunityPackageFile[]) {
  const release = await exchangeDb.communityRelease.findFirst({
    where: { id: releaseId, listing: { owner: { accountId } } },
    include: { listing: true },
  });
  if (!release) throw new CommunityError("COMMUNITY_ACCESS_DENIED", "You cannot publish this release.");
  if (!release.sourcePublishedTaleVersionId) throw new CommunityError("COMMUNITY_SOURCE_NOT_IMMUTABLE", "A published Chronicle version is required.");
  const verified = verifyCommunityPackage(manifest, files);
  return { releaseId, listingId: release.listingId, packageChecksum: verified.checksum, files: verified.manifest.items.length, ready: true };
}

export async function persistVerifiedCommunityPackage(accountId: string, releaseId: string, manifest: unknown, files: CommunityPackageFile[]) {
  const preflight = await preflightCommunityPublication(accountId, releaseId, manifest, files);
  const verified = verifyCommunityPackage(manifest, files);
  const packageId = randomUUID();
  const packageRecord = await exchangeDb.communityPackage.create({ data: { id: packageId, releaseId, packageSchema: 1, packageChecksum: verified.checksum, manifest: JSON.stringify(verified.manifest), byteLength: verified.byteLength, storageStatus: "READY", scanStatus: "CLEAN", finalizedAt: new Date() } });
  await exchangeDb.communityPackageItem.createMany({ data: verified.manifest.items.map((item) => ({ packageId, logicalId: item.id, itemType: item.type, relativePath: item.path, checksum: item.checksum, mediaType: item.mediaType, byteLength: item.byteLength, metadata: "{}", accessibility: JSON.stringify(item.accessibility ?? {}) })) });
  return { ...preflight, packageId: packageRecord.id };
}

export async function installVerifiedCommunityPackage(input: Parameters<typeof createInstallPlan>[0] & { accountId: string; requestId: string; releaseId: string; packageId: string; finalizationSucceeded: boolean }) {
  const plan = createInstallPlan(input);
  const operation = commitInstallOperation(beginInstallOperation(plan, input.requestId), input.finalizationSucceeded);
  const stored = await exchangeDb.communityInstallOperation.create({ data: { id: operation.id, requestId: input.requestId, idempotencyKey: operation.idempotencyKey, packageId: input.packageId, releaseId: input.releaseId, accountId: input.accountId, mode: plan.mode, status: operation.status, destinationRevision: plan.destinationRevision, plan: JSON.stringify(plan), completedAt: operation.status === "COMMITTED" ? new Date() : null } });
  await exchangeDb.communityInstallMapping.createMany({ data: Object.entries(plan.idMappings).map(([sourceId, targetId]) => ({ operationId: stored.id, sourceId, targetId, kind: "PACKAGE_ITEM" })) });
  if (operation.status === "COMMITTED") await exchangeDb.communityInstallation.create({ data: { accountId: input.accountId, packageId: input.packageId, releaseId: input.releaseId, operationId: stored.id, mode: plan.mode as InstallMode, installedPackageChecksum: plan.packageChecksum, upstreamReleaseId: input.releaseId } });
  return { operation, plan };
}
