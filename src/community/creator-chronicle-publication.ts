import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { parsePublishedSnapshot } from "@/chronicle/types";
import { publishedSourceChecksum } from "@/chronicle/snapshot";
import { assertCommunityDrydockPublicationGate } from "./drydock-publication-gate";
import { assertPublishingAllowed, CommunityError, listingInputSchema, stableJson } from "./domain";
import { resolvePublicProfileProjection } from "./public-profile";
import { communityPackageManifestSchema, packageChecksum, sha256, verifyCommunityPackage } from "./package";

export const creatorChroniclePublicationSchema = z.strictObject({
  publishedVersionId: z.string().min(1).max(128),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().min(1).max(2000),
  tags: z.array(z.string().regex(/^[a-z0-9-]{1,32}$/)).max(12),
  licenseKey: z.string().min(1).max(128),
  rightsAcknowledged: z.literal(true),
  spoilersAcknowledged: z.literal(true),
});

function portableSnapshot(snapshot: ReturnType<typeof parsePublishedSnapshot>) {
  if (
    snapshot.landfall ||
    snapshot.assets.length ||
    snapshot.locations.length ||
    snapshot.artifacts.length ||
    snapshot.tale.coverAssetId ||
    snapshot.chapters.some((chapter) => chapter.coverAssetId)
  )
    throw new CommunityError(
      "COMMUNITY_DEPENDENCY_UNSUPPORTED",
      "This Chronicle has media, spatial or artifact dependencies that cannot yet be packaged with verified rights.",
    );
  const external = /(?:asset|artifact|location|provider|media|image|audio)Id$/i;
  const visit = (value: unknown, key = "") => {
    if (external.test(key) && value !== null && value !== undefined && value !== "")
      throw new CommunityError(
        "COMMUNITY_DEPENDENCY_UNSUPPORTED",
        "The Chronicle contains an unverified external dependency.",
      );
    if (Array.isArray(value)) value.forEach((entry) => visit(entry));
    else if (value && typeof value === "object") Object.entries(value).forEach(([child, entry]) => visit(entry, child));
  };
  snapshot.chapters.forEach((chapter) =>
    chapter.blocks.forEach((block) => {
      visit(block.configuration);
      visit(block.presentation);
      visit(block.completion);
    }),
  );
  return snapshot;
}

async function loadSource(accountId: string, publishedVersionId: string) {
  const version = await db.publishedTaleVersion.findUnique({
    where: { id: publishedVersionId },
    include: {
      tale: { select: { id: true, creatorAccountId: true, latestPublishedVersionId: true } },
      drydockPublishingEvidence: { select: { digest: true, sourceChecksum: true } },
    },
  });
  if (
    !version ||
    version.tale.creatorAccountId !== accountId ||
    version.publishedByAccountId !== accountId ||
    !version.isCurrent ||
    version.tale.latestPublishedVersionId !== version.id
  )
    throw new CommunityError("COMMUNITY_SOURCE_NOT_OWNED", "Select your current published Chronicle version.");
  assertCommunityDrydockPublicationGate(version);
  let snapshot;
  try {
    snapshot = portableSnapshot(parsePublishedSnapshot(version.contentSnapshot));
  } catch (cause) {
    if (cause instanceof CommunityError) throw cause;
    throw new CommunityError("COMMUNITY_SOURCE_VERSION_MISMATCH", "The published Chronicle snapshot is invalid.");
  }
  if (snapshot.tale.id !== version.taleId || publishedSourceChecksum(snapshot) !== version.checksum)
    throw new CommunityError(
      "COMMUNITY_SOURCE_VERSION_MISMATCH",
      "The published Chronicle failed exact-source verification.",
    );
  return { version, snapshot };
}

async function resolveReview(accountId: string, raw: unknown) {
  const input = creatorChroniclePublicationSchema.parse(raw);
  if (process.env.COMMUNITY_ENABLED === "false")
    throw new CommunityError("COMMUNITY_NOT_ENABLED", "Community Harbor is disabled.");
  const profile = await resolvePublicProfileProjection(db, accountId);
  assertPublishingAllowed(
    { enabled: true, publicPublishingEnabled: process.env.COMMUNITY_PUBLIC_PUBLISHING_ENABLED !== "false" },
    { role: "CREATOR", suspended: profile.creatorStatus === "SUSPENDED" || profile.moderationStatus !== "ACTIVE" },
  );
  const source = await loadSource(accountId, input.publishedVersionId);
  const policy = await db.communityLicensePolicy.findUnique({ where: { key: input.licenseKey } });
  if (
    !policy?.active ||
    !policy.allowsPrivateUse ||
    !policy.allowsPublicUse ||
    !policy.allowsModification ||
    !policy.allowsRedistribution ||
    policy.requiresSourceLink ||
    policy.key === "CUSTOM"
  )
    throw new CommunityError(
      "COMMUNITY_LICENSE_UNAVAILABLE",
      "Choose a configured license permitting public distribution, modification and private reuse without an unsatisfied source-link obligation.",
    );
  const listing = listingInputSchema.parse({
    itemType: "CHRONICLE",
    slug: input.slug,
    title: input.title,
    shortDescription: input.description.slice(0, 280),
    longDescription: input.description,
    visibility: "COMMUNITY",
    spoilerLevel: "PREVIEW_SAFE",
    locationClass: "FICTIONAL",
    tags: input.tags,
  });
  const attribution = [{ displayName: profile.displayName, contributionType: "Creator" }];
  const digest = sha256(
    stableJson({
      sourceId: source.version.id,
      checksum: source.version.checksum,
      evidenceDigest: source.version.drydockPublishingEvidence!.digest,
      listing,
      licenseKey: policy.key,
      licenseVersion: policy.policyVersion,
      attribution,
    }),
  );
  return { input, profile, source, policy, listing, attribution, digest };
}

export async function preflightCreatorChroniclePublication(accountId: string, raw: unknown) {
  const review = await resolveReview(accountId, raw);
  return {
    reviewDigest: review.digest,
    sourceChecksum: review.source.version.checksum,
    included: review.source.snapshot,
    attribution: review.attribution,
    license: {
      key: review.policy.key,
      name: review.policy.displayName,
      allowsModification: review.policy.allowsModification,
    },
    publicationState: "READY_FOR_REVIEW" as const,
  };
}

export async function submitCreatorChroniclePublication(accountId: string, raw: unknown, expectedDigest: string) {
  const review = await resolveReview(accountId, raw);
  if (review.digest !== expectedDigest)
    throw new CommunityError(
      "COMMUNITY_REVIEW_STALE",
      "The Chronicle or publishing choices changed. Review the release again.",
    );
  if (await db.communityListing.findUnique({ where: { slug: review.input.slug } }))
    throw new CommunityError("COMMUNITY_SLUG_TAKEN", "This Community address is already in use.");
  const listingId = randomUUID();
  const releaseId = randomUUID();
  const packageId = randomUUID();
  const bytes = new TextEncoder().encode(stableJson(review.source.snapshot));
  const item = {
    id: "chronicle",
    type: "CHRONICLE" as const,
    path: "items/chronicle.json",
    checksum: sha256(bytes),
    mediaType: "application/json",
    byteLength: bytes.byteLength,
    dependencies: [],
  };
  const license = { key: review.policy.key, version: review.policy.policyVersion };
  const manifest = communityPackageManifestSchema.parse({
    schemaVersion: 1,
    packageId,
    releaseId,
    semanticVersion: "1.0.0",
    license,
    attribution: review.attribution,
    items: [item],
  });
  const verified = verifyCommunityPackage(manifest, [{ path: item.path, mediaType: item.mediaType, bytes }]);
  const releaseManifest = {
    schemaVersion: 1,
    sourcePublishedTaleVersionId: review.source.version.id,
    sourceChecksum: review.source.version.checksum,
    evidenceDigest: review.source.version.drydockPublishingEvidence!.digest,
    reviewDigest: review.digest,
    packageChecksum: verified.checksum,
    publicMetadata: {
      title: review.listing.title,
      shortDescription: review.listing.shortDescription,
      spoilerLevel: "PREVIEW_SAFE",
    },
  };
  return db.$transaction(async (tx) => {
    const pinned = await tx.publishedTaleVersion.findFirst({
      where: {
        id: review.source.version.id,
        taleId: review.source.version.taleId,
        checksum: review.source.version.checksum,
        isCurrent: true,
        tale: { creatorAccountId: accountId, latestPublishedVersionId: review.source.version.id },
      },
      select: { contentSnapshot: true, drydockPublishingEvidence: { select: { digest: true, sourceChecksum: true } } },
    });
    if (
      !pinned ||
      pinned.contentSnapshot !== review.source.version.contentSnapshot ||
      pinned.drydockPublishingEvidence?.digest !== review.source.version.drydockPublishingEvidence!.digest ||
      pinned.drydockPublishingEvidence.sourceChecksum !== review.source.version.checksum
    )
      throw new CommunityError("COMMUNITY_SOURCE_CONFLICT", "The published Chronicle changed before submission.");
    await tx.communityListing.create({
      data: {
        id: listingId,
        ownerProfileId: review.profile.id,
        ...review.listing,
        tags: JSON.stringify(review.listing.tags),
        publicationStatus: "READY_FOR_REVIEW",
      },
    });
    await tx.communityRelease.create({
      data: {
        id: releaseId,
        listingId,
        semanticVersion: "1.0.0",
        sourcePublishedTaleVersionId: review.source.version.id,
        manifest: JSON.stringify(releaseManifest),
        manifestChecksum: sha256(stableJson(releaseManifest)),
        packageChecksum: verified.checksum,
        licenseSnapshot: JSON.stringify({
          key: license.key,
          version: license.version,
          allowsPrivateUse: review.policy.allowsPrivateUse,
          allowsPublicUse: review.policy.allowsPublicUse,
          allowsModification: review.policy.allowsModification,
          allowsRedistribution: review.policy.allowsRedistribution,
          requiresAttribution: review.policy.requiresAttribution,
          shareAlike: review.policy.shareAlike,
        }),
        attributionSnapshot: JSON.stringify(review.attribution),
        spoilerSnapshot: JSON.stringify({ level: "PREVIEW_SAFE" }),
        publishedByProfileId: review.profile.id,
        attributions: {
          create: review.attribution.map((credit, sortOrder) => ({
            creditedDisplayName: credit.displayName,
            contributionType: credit.contributionType,
            sortOrder,
          })),
        },
      },
    });
    await tx.communityPackage.create({
      data: {
        id: packageId,
        releaseId,
        packageSchema: 1,
        packageChecksum: packageChecksum(manifest),
        manifest: JSON.stringify(manifest),
        byteLength: bytes.byteLength,
        storageStatus: "READY",
        scanStatus: "CLEAN",
        finalizedAt: new Date(),
      },
    });
    await tx.communityPackageItem.create({
      data: {
        packageId,
        logicalId: item.id,
        itemType: item.type,
        relativePath: item.path,
        checksum: item.checksum,
        mediaType: item.mediaType,
        byteLength: item.byteLength,
        metadata: new TextDecoder().decode(bytes),
      },
    });
    await tx.communityOwnershipDeclaration.create({
      data: {
        listingId,
        releaseId,
        declarantProfileId: review.profile.id,
        declarationVersion: 1,
        acceptedStatements: JSON.stringify([
          "I own or may distribute every included Chronicle passage.",
          "I reviewed the entire package, license, attribution and spoiler implications.",
        ]),
      },
    });
    await tx.communityListing.update({ where: { id: listingId }, data: { currentReleaseId: releaseId } });
    await tx.communityOutboxEvent.create({
      data: {
        eventType: "COMMUNITY_RELEASE_CREATED",
        aggregateType: "COMMUNITY_RELEASE",
        aggregateId: releaseId,
        payload: JSON.stringify({ listingId, packageId, semanticVersion: "1.0.0" }),
        idempotencyKey: `COMMUNITY_RELEASE_CREATED:${releaseId}`,
      },
    });
    return {
      listingId,
      releaseId,
      packageId,
      publicationStatus: "READY_FOR_REVIEW" as const,
      listingUrl: `/community/${review.input.slug}`,
    };
  });
}

export function verifyCreatorChroniclePackage(input: {
  releaseId: string;
  releaseManifest: string;
  releaseManifestChecksum: string;
  packageChecksum: string | null;
  packageId: string;
  packageManifest: string;
  packageRecordChecksum: string;
  itemMetadata: string;
  itemChecksum: string;
  itemType: string;
  itemPath: string;
  itemMediaType: string;
  itemByteLength: number;
  sourceVersionId: string | null;
}) {
  const releaseManifest = JSON.parse(input.releaseManifest) as {
    sourcePublishedTaleVersionId?: string;
    sourceChecksum?: string;
    evidenceDigest?: string;
    packageChecksum?: string;
  };
  const manifest = communityPackageManifestSchema.parse(JSON.parse(input.packageManifest));
  const bytes = new TextEncoder().encode(input.itemMetadata);
  const verified = verifyCommunityPackage(manifest, [{ path: input.itemPath, mediaType: input.itemMediaType, bytes }]);
  if (
    manifest.releaseId !== input.releaseId ||
    manifest.packageId !== input.packageId ||
    manifest.items.length !== 1 ||
    manifest.items[0].type !== "CHRONICLE" ||
    input.itemType !== "CHRONICLE" ||
    input.itemPath !== "items/chronicle.json" ||
    input.itemMediaType !== "application/json" ||
    input.itemChecksum !== sha256(bytes) ||
    input.itemByteLength !== bytes.byteLength ||
    input.packageChecksum !== verified.checksum ||
    input.packageRecordChecksum !== verified.checksum ||
    releaseManifest.packageChecksum !== verified.checksum ||
    releaseManifest.sourcePublishedTaleVersionId !== input.sourceVersionId ||
    input.releaseManifestChecksum !== sha256(stableJson(releaseManifest))
  )
    throw new CommunityError(
      "COMMUNITY_PACKAGE_RECEIPT_INVALID",
      "The pinned Chronicle package failed integrity verification.",
    );
  const snapshot = portableSnapshot(parsePublishedSnapshot(input.itemMetadata));
  if (publishedSourceChecksum(snapshot) !== releaseManifest.sourceChecksum)
    throw new CommunityError(
      "COMMUNITY_PACKAGE_RECEIPT_INVALID",
      "The package does not match its published Chronicle source.",
    );
  return { manifest, snapshot, releaseManifest };
}
