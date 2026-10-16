import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { CommunityError } from "./domain";
import { assertLicenseCompatible } from "./exchange";

const licenseSnapshotSchema = z.strictObject({
  key: z.string().min(1),
  version: z.number().int().positive(),
  allowsModification: z.boolean(),
  allowsPublicUse: z.boolean(),
  allowsCommercialUse: z.boolean(),
  requiresAttribution: z.boolean(),
  shareAlike: z.boolean(),
});

/** An installed Library reference may be placed into an editable Scene only when
 * its exact pinned Harborlight release permits modification. */
export async function assertInstalledSpatialReuseRights(
  tx: Prisma.TransactionClient,
  accountId: string,
  targetId: string,
) {
  const mappings = await tx.communityInstallMapping.findMany({
    where: { targetId, sourceId: "spatial" },
    select: { operationId: true },
    take: 2,
  });
  if (mappings.length !== 1)
    throw new CommunityError(
      "COMMUNITY_INSTALLATION_STALE",
      "The installed release binding needs review before reuse.",
    );
  const installation = await tx.communityInstallation.findUnique({
    where: { operationId: mappings[0].operationId },
    select: { accountId: true, mode: true, releaseId: true, installedPackageChecksum: true },
  });
  if (!installation || installation.accountId !== accountId || installation.mode !== "LIBRARY_REFERENCE")
    throw new CommunityError(
      "COMMUNITY_INSTALLATION_STALE",
      "The installed release binding needs review before reuse.",
    );
  const [release, storedPackage] = await Promise.all([
    tx.communityRelease.findUnique({
      where: { id: installation.releaseId },
      select: {
        packageChecksum: true,
        licenseSnapshot: true,
        moderationStatus: true,
        listing: { select: { moderationStatus: true, removedAt: true } },
      },
    }),
    tx.communityPackage.findUnique({
      where: { releaseId: installation.releaseId },
      select: { packageChecksum: true, storageStatus: true, scanStatus: true },
    }),
  ]);
  if (
    !release ||
    !storedPackage ||
    release.moderationStatus !== "ACTIVE" ||
    release.listing.moderationStatus !== "ACTIVE" ||
    release.listing.removedAt ||
    release.packageChecksum !== installation.installedPackageChecksum ||
    storedPackage.packageChecksum !== installation.installedPackageChecksum ||
    storedPackage.storageStatus !== "READY" ||
    storedPackage.scanStatus !== "CLEAN"
  )
    throw new CommunityError("COMMUNITY_INSTALLATION_STALE", "The pinned release is unavailable for reuse.");
  let snapshot: unknown;
  try {
    snapshot = JSON.parse(release.licenseSnapshot);
  } catch {
    throw new CommunityError("COMMUNITY_LICENSE_INCOMPATIBLE", "The pinned license needs review before reuse.");
  }
  const license = licenseSnapshotSchema.safeParse(snapshot);
  if (!license.success)
    throw new CommunityError("COMMUNITY_LICENSE_INCOMPATIBLE", "The pinned license needs review before reuse.");
  assertLicenseCompatible(license.data, "EDITABLE_COPY");
  return { releaseId: installation.releaseId, license: license.data };
}
