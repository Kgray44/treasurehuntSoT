import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { CommunityError, stableJson } from "./domain";
import { beginInstallOperation, commitInstallOperation, createInstallPlan, type InstallMode } from "./exchange";
import { assertPublicationScanStatus, verifyCommunityPackage, type CommunityPackageFile } from "./package";
import { assertTrustedCommunityScanReceipts, scanCommunityPackageFiles } from "./scanner";
import { assertCommunityDrydockPublicationGate } from "./drydock-publication-gate";

// Prisma is generated at deploy/test time from the Phase 2 schemas. Keeping
// this narrow adapter avoids a second Chronicle or identity aggregate.
const exchangeDb = db as unknown as {
  $transaction<T>(callback: (transaction: typeof db) => Promise<T>): Promise<T>;
  communityRelease: typeof db.communityRelease;
  communityPackage: {
    create(input: unknown): Promise<{ id: string; packageChecksum: string }>;
    findUnique(input: unknown): Promise<{
      id: string;
      releaseId: string;
      packageChecksum: string;
      manifest: string;
      scanStatus: string;
      storageStatus: string;
    } | null>;
  };
  communityPackageItem: { createMany(input: unknown): Promise<unknown> };
  communityInstallOperation: { create(input: unknown): Promise<{ id: string }> };
  communityInstallMapping: { createMany(input: unknown): Promise<unknown> };
  communityInstallation: { create(input: unknown): Promise<{ id: string }> };
};

export async function preflightCommunityPublication(
  accountId: string,
  releaseId: string,
  manifest: unknown,
  files: CommunityPackageFile[],
) {
  const release = await exchangeDb.communityRelease.findFirst({
    where: { id: releaseId, listing: { owner: { accountId } } },
    include: { listing: true },
  });
  if (!release) throw new CommunityError("COMMUNITY_ACCESS_DENIED", "You cannot publish this release.");
  if (!release.sourcePublishedTaleVersionId)
    throw new CommunityError("COMMUNITY_SOURCE_NOT_IMMUTABLE", "A published Chronicle version is required.");
  const drydock = assertCommunityDrydockPublicationGate(
    await db.publishedTaleVersion.findFirst({
      where: { id: release.sourcePublishedTaleVersionId },
      select: { id: true, checksum: true, drydockPublishingEvidence: { select: { digest: true, sourceChecksum: true } } },
    }),
  );
  const verified = verifyCommunityPackage(manifest, files);
  const scan = await scanCommunityPackageFiles(files);
  assertTrustedCommunityScanReceipts(scan.receipts);
  assertPublicationScanStatus(scan.result, files);
  return {
    releaseId,
    listingId: release.listingId,
    packageChecksum: verified.checksum,
    files: verified.manifest.items.length,
    scanStatus: scan.result,
    scanReceipts: scan.receipts,
    drydock,
    ready: true,
  };
}

export async function persistVerifiedCommunityPackage(
  accountId: string,
  releaseId: string,
  manifest: unknown,
  files: CommunityPackageFile[],
) {
  const preflight = await preflightCommunityPublication(accountId, releaseId, manifest, files);
  const verified = verifyCommunityPackage(manifest, files);
  const packageId = randomUUID();
  const packageRecord = await exchangeDb.communityPackage.create({
    data: {
      id: packageId,
      releaseId,
      packageSchema: 1,
      packageChecksum: verified.checksum,
      manifest: JSON.stringify(verified.manifest),
      byteLength: verified.byteLength,
      storageStatus: "READY",
      scanStatus: preflight.scanStatus,
      finalizedAt: new Date(),
    },
  });
  await exchangeDb.communityPackageItem.createMany({
    data: verified.manifest.items.map((item) => ({
      packageId,
      logicalId: item.id,
      itemType: item.type,
      relativePath: item.path,
      checksum: item.checksum,
      mediaType: item.mediaType,
      byteLength: item.byteLength,
      metadata: "{}",
      accessibility: JSON.stringify(item.accessibility ?? {}),
    })),
  });
  return { ...preflight, packageId: packageRecord.id };
}

/**
 * Returns the facts a second Creator must review from the finalized Exchange
 * records.  The browser can suggest an installation mode, but it cannot
 * invent the package, creator, license, inventory, or safety posture shown
 * in this review.
 */
export async function reviewVerifiedCommunityPackage(
  input: Parameters<typeof createInstallPlan>[0] & { releaseId: string; packageId: string },
) {
  const plan = createInstallPlan(input);
  const [persistedPackage, release] = await Promise.all([
    db.communityPackage.findUnique({ where: { id: input.packageId } }),
    db.communityRelease.findUnique({
      where: { id: input.releaseId },
      include: { listing: { include: { owner: true } }, publishedBy: true },
    }),
  ]);
  if (
    !persistedPackage ||
    !release ||
    persistedPackage.releaseId !== input.releaseId ||
    persistedPackage.packageChecksum !== input.packageChecksum ||
    persistedPackage.scanStatus !== "CLEAN" ||
    persistedPackage.storageStatus !== "READY" ||
    stableJson(JSON.parse(persistedPackage.manifest) as unknown) !== stableJson(input.packageManifest)
  )
    throw new CommunityError(
      "COMMUNITY_PACKAGE_RECEIPT_INVALID",
      "The selected package is not a finalized, clean Exchange package.",
    );

  const manifest = JSON.parse(persistedPackage.manifest) as {
    items: Array<{
      id: string;
      type: string;
      path: string;
      mediaType: string;
      byteLength: number;
      dependencies?: string[];
      accessibility?: { description?: string; posterPath?: string };
    }>;
  };
  const executable = manifest.items.some(
    (item) =>
      /(?:javascript|x-msdownload|x-sh|x-bat)/i.test(item.mediaType) ||
      /\.(?:exe|dll|js|mjs|cjs|sh|bat|cmd|ps1)$/i.test(item.path),
  );
  const accessibilityWarnings = manifest.items
    .filter(
      (item) => !item.accessibility?.description || (item.type === "ARTIFACT_3D" && !item.accessibility?.posterPath),
    )
    .map((item) => `Accessibility metadata needs attention for ${item.path}.`);
  const performanceWarnings = manifest.items
    .filter((item) => item.byteLength > 8 * 1024 * 1024)
    .map((item) => `${item.path} exceeds the Exchange's compact review threshold.`);
  const license = JSON.parse(release.licenseSnapshot) as { key?: string };
  return {
    ...plan,
    review: {
      creatorIdentity: release.publishedBy.displayName,
      listing: { id: release.listing.id, title: release.listing.title, slug: release.listing.slug },
      release: {
        id: release.id,
        semanticVersion: release.semanticVersion,
        schemaVersion: release.manifestSchemaVersion,
      },
      license,
      attribution: JSON.parse(release.attributionSnapshot) as unknown,
      dependencies: manifest.items.flatMap((item) => item.dependencies ?? []),
      package: {
        id: persistedPackage.id,
        checksum: persistedPackage.packageChecksum,
        byteLength: persistedPackage.byteLength,
        inventory: manifest.items.map((item) => ({
          id: item.id,
          type: item.type,
          path: item.path,
          byteLength: item.byteLength,
        })),
      },
      compatibility: JSON.parse(release.compatibility) as unknown,
      accessibilityWarnings,
      performanceWarnings,
      modificationRights: input.license.allowsModification,
      redistributionRights: input.license.allowsPublicUse,
      noArbitraryExecutableScripts: !executable,
    },
  };
}

export async function installVerifiedCommunityPackage(
  input: Parameters<typeof createInstallPlan>[0] & {
    accountId: string;
    requestId: string;
    releaseId: string;
    packageId: string;
    finalizationSucceeded: boolean;
  },
) {
  const persistedPackage = await exchangeDb.communityPackage.findUnique({ where: { id: input.packageId } });
  if (
    !persistedPackage ||
    persistedPackage.releaseId !== input.releaseId ||
    persistedPackage.packageChecksum !== input.packageChecksum ||
    persistedPackage.scanStatus !== "CLEAN" ||
    persistedPackage.storageStatus !== "READY" ||
    stableJson(JSON.parse(persistedPackage.manifest) as unknown) !== stableJson(input.packageManifest)
  )
    throw new CommunityError(
      "COMMUNITY_PACKAGE_RECEIPT_INVALID",
      "The selected package is not a finalized, clean Exchange package.",
    );
  const plan = createInstallPlan(input);
  const operation = commitInstallOperation(beginInstallOperation(plan, input.requestId), input.finalizationSucceeded);
  if (plan.nonMutating) return { operation, plan, preview: true };
  return exchangeDb.$transaction(async (transaction) => {
    const existing = await transaction.communityInstallOperation.findUnique({
      where: { accountId_requestId: { accountId: input.accountId, requestId: input.requestId } },
    });
    if (existing?.status === "COMMITTED") return { operation: { ...operation, status: "COMMITTED" as const }, plan };
    const stored = existing
      ? await transaction.communityInstallOperation.update({
          where: { id: existing.id },
          data: {
            status: operation.status,
            plan: JSON.stringify(plan),
            completedAt: operation.status === "COMMITTED" ? new Date() : null,
          },
        })
      : await transaction.communityInstallOperation.create({
          data: {
            id: operation.id,
            requestId: input.requestId,
            idempotencyKey: operation.idempotencyKey,
            packageId: input.packageId,
            releaseId: input.releaseId,
            accountId: input.accountId,
            mode: plan.mode,
            status: operation.status,
            destinationRevision: plan.destinationRevision,
            plan: JSON.stringify(plan),
            completedAt: operation.status === "COMMITTED" ? new Date() : null,
          },
        });
    // A retryable finalization record intentionally has no mappings or
    // installation rows. They are written atomically only with the commit.
    if (operation.status !== "COMMITTED") return { operation, plan };
    await transaction.communityInstallMapping.createMany({
      data: Object.entries(plan.idMappings).map(([sourceId, targetId]) => ({
        operationId: stored.id,
        sourceId,
        targetId,
        kind: "PACKAGE_ITEM",
      })),
    });
    await transaction.communityInstallation.create({
      data: {
        accountId: input.accountId,
        packageId: input.packageId,
        releaseId: input.releaseId,
        operationId: stored.id,
        mode: plan.mode as InstallMode,
        installedPackageChecksum: plan.packageChecksum,
        upstreamReleaseId: input.releaseId,
      },
    });
    if (plan.mode !== "FORK") return { operation, plan };
    const [sourceRelease, destinationProfile] = await Promise.all([
      transaction.communityRelease.findUnique({ where: { id: input.releaseId }, include: { listing: true } }),
      transaction.communityProfile.findUnique({ where: { accountId: input.accountId } }),
    ]);
    if (!sourceRelease || !destinationProfile)
      throw new CommunityError(
        "COMMUNITY_FORK_SOURCE_INVALID",
        "The source release or destination Creator profile is unavailable.",
      );
    const forkListing = await transaction.communityListing.create({
      data: {
        ownerProfileId: destinationProfile.id,
        slug: `fork-${stored.id}`,
        itemType: sourceRelease.listing.itemType,
        title: `${sourceRelease.listing.title} (Fork)`,
        shortDescription: "Private editable fork created through the Community Exchange.",
        visibility: "PRIVATE",
        spoilerLevel: sourceRelease.listing.spoilerLevel,
        locationClass: sourceRelease.listing.locationClass,
        tags: sourceRelease.listing.tags,
      },
    });
    const forkRelease = await transaction.communityRelease.create({
      data: {
        listingId: forkListing.id,
        semanticVersion: `0.0.0-fork.${stored.id.slice(0, 12)}`,
        manifestSchemaVersion: sourceRelease.manifestSchemaVersion,
        sourcePublishedTaleVersionId: sourceRelease.sourcePublishedTaleVersionId,
        manifest: sourceRelease.manifest,
        manifestChecksum: sourceRelease.manifestChecksum,
        packageChecksum: sourceRelease.packageChecksum,
        compatibility: sourceRelease.compatibility,
        licenseSnapshot: sourceRelease.licenseSnapshot,
        attributionSnapshot: sourceRelease.attributionSnapshot,
        spoilerSnapshot: sourceRelease.spoilerSnapshot,
        publishedByProfileId: destinationProfile.id,
      },
    });
    const lineage = await transaction.communityRemixLineage.create({
      data: {
        derivedReleaseId: forkRelease.id,
        sourceReleaseId: sourceRelease.id,
        rootReleaseId: sourceRelease.id,
        sourcePackageChecksum: plan.packageChecksum,
        mode: plan.mode,
        attributionSnapshot: sourceRelease.attributionSnapshot,
      },
    });
    return { operation, plan, fork: { listingId: forkListing.id, releaseId: forkRelease.id, lineageId: lineage.id } };
  });
}
