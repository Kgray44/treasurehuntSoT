import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertReusableCaptureSafe, parseReusableEnvelope, checksumReusableEnvelope } from "@/studio/reusable-content";
import { assertPublishingAllowed, CommunityError, listingInputSchema, stableJson } from "./domain";
import { resolvePublicProfileProjection } from "./public-profile";
import { communityPackageManifestSchema, packageChecksum, sha256, verifyCommunityPackage } from "./package";

const sourceSchema = z.strictObject({ itemId: z.string().min(1), versionId: z.string().min(1) });
export const creatorReusablePublicationSchema = z.strictObject({
  source: sourceSchema,
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().min(1).max(2000),
  tags: z.array(z.string().regex(/^[a-z0-9-]{1,32}$/)).max(12),
  licenseKey: z.string().min(1).max(128),
  rightsAcknowledged: z.literal(true),
});

type PublicationInput = z.infer<typeof creatorReusablePublicationSchema>;

async function loadSource(accountId: string, source: PublicationInput["source"]) {
  const item = await db.reusableAuthoringItem.findFirst({
    where: { id: source.itemId, ownerAccountId: accountId, archivedAt: null },
    include: { versions: { where: { id: source.versionId } } },
  });
  const version = item?.versions[0];
  if (!item || !version || version.itemId !== item.id || version.versionNumber !== item.currentVersionNumber)
    throw new CommunityError("COMMUNITY_SOURCE_NOT_OWNED", "Select a current saved Creator item that you own.");
  if (item.status !== "ACTIVE" || !["PRESET", "CHAPTER_TEMPLATE"].includes(item.kind))
    throw new CommunityError(
      "COMMUNITY_SOURCE_NOT_SHAREABLE",
      "This Creator item cannot be submitted for Community reuse.",
    );
  let envelope;
  try {
    envelope = parseReusableEnvelope(JSON.parse(version.envelope));
    assertReusableCaptureSafe(envelope.blocks);
  } catch {
    throw new CommunityError(
      "COMMUNITY_SOURCE_VERSION_MISMATCH",
      "The saved Creator item failed integrity or privacy checks.",
    );
  }
  if (
    envelope.itemId !== item.id ||
    envelope.versionId !== version.id ||
    envelope.ownerId !== accountId ||
    envelope.kind !== item.kind ||
    envelope.checksum !== version.checksum ||
    envelope.attribution.sourceOwnerId !== accountId ||
    envelope.attribution.sourceReleaseId ||
    envelope.lineage.length
  )
    throw new CommunityError(
      "COMMUNITY_REDISTRIBUTION_UNVERIFIED",
      "This item is not an independently owned Creator source.",
    );
  if (Object.values(envelope.dependencies).some((ids) => ids.length))
    throw new CommunityError(
      "COMMUNITY_DEPENDENCY_UNSUPPORTED",
      "This item references assets or providers that cannot yet be packaged with verified rights.",
    );
  const external = /(?:asset|artifact|location|provider|media|image|audio)Id$/i;
  const visit = (value: unknown, key = "") => {
    if (external.test(key) && value !== null && value !== undefined && value !== "")
      throw new CommunityError(
        "COMMUNITY_DEPENDENCY_UNSUPPORTED",
        "The saved item contains an unverified external dependency.",
      );
    if (Array.isArray(value)) value.forEach((entry) => visit(entry));
    else if (value && typeof value === "object") Object.entries(value).forEach(([child, entry]) => visit(entry, child));
  };
  envelope.blocks.forEach((block) => {
    visit(block.configuration);
    visit(block.presentation);
    visit(block.completion);
  });
  envelope.chapters.forEach((chapter) => {
    visit(chapter.coverAssetId, "coverAssetId");
    visit(chapter.metadata);
  });
  const itemType = item.kind === "PRESET" ? "STORY_BLOCK_PRESET" : "CHRONICLE_TEMPLATE";
  return { item, version, envelope, itemType };
}

async function resolveReview(accountId: string, raw: unknown) {
  const input = creatorReusablePublicationSchema.parse(raw);
  if (process.env.COMMUNITY_ENABLED === "false")
    throw new CommunityError("COMMUNITY_NOT_ENABLED", "Community Harbor is disabled.");
  const profile = await resolvePublicProfileProjection(db, accountId);
  assertPublishingAllowed(
    { enabled: true, publicPublishingEnabled: process.env.COMMUNITY_PUBLIC_PUBLISHING_ENABLED !== "false" },
    { role: "CREATOR", suspended: profile.creatorStatus === "SUSPENDED" || profile.moderationStatus !== "ACTIVE" },
  );
  const source = await loadSource(accountId, input.source);
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
    itemType: source.itemType,
    slug: input.slug,
    title: input.title,
    shortDescription: input.description.slice(0, 280),
    longDescription: input.description,
    visibility: "COMMUNITY",
    spoilerLevel: "NONE",
    locationClass: "FICTIONAL",
    tags: input.tags,
  });
  const attribution = [{ displayName: profile.displayName, contributionType: "Creator" }];
  const digest = sha256(
    stableJson({
      sourceId: source.item.id,
      versionId: source.version.id,
      sourceChecksum: source.version.checksum,
      listing,
      licenseKey: policy.key,
      licenseVersion: policy.policyVersion,
      attribution,
    }),
  );
  return { input, profile, source, policy, listing, attribution, digest };
}

export async function preflightCreatorReusablePublication(accountId: string, raw: unknown) {
  const review = await resolveReview(accountId, raw);
  return {
    reviewDigest: review.digest,
    itemType: review.source.itemType,
    sourceChecksum: review.source.version.checksum,
    included: review.source.envelope,
    license: {
      key: review.policy.key,
      name: review.policy.displayName,
      allowsModification: review.policy.allowsModification,
    },
    attribution: review.attribution,
    publicationState: "READY_FOR_REVIEW" as const,
  };
}

export async function submitCreatorReusablePublication(accountId: string, raw: unknown, expectedDigest: string) {
  const review = await resolveReview(accountId, raw);
  if (review.digest !== expectedDigest)
    throw new CommunityError(
      "COMMUNITY_REVIEW_STALE",
      "The source or publishing choices changed. Review the item again.",
    );
  const slugOwner = await db.communityListing.findUnique({ where: { slug: review.input.slug } });
  if (slugOwner) throw new CommunityError("COMMUNITY_SLUG_TAKEN", "This Community address is already in use.");
  const listingId = randomUUID();
  const releaseId = randomUUID();
  const packageId = randomUUID();
  const bytes = new TextEncoder().encode(stableJson(review.source.envelope));
  const item = {
    id: "creator-item",
    type: review.source.itemType,
    path: "items/creator.json",
    checksum: sha256(bytes),
    mediaType: "application/json",
    byteLength: bytes.byteLength,
    dependencies: [],
  };
  const license = { key: review.policy.key, version: review.policy.policyVersion };
  const packageManifest = communityPackageManifestSchema.parse({
    schemaVersion: 1,
    packageId,
    releaseId,
    semanticVersion: "1.0.0",
    license,
    attribution: review.attribution,
    items: [item],
  });
  const verified = verifyCommunityPackage(packageManifest, [{ path: item.path, mediaType: item.mediaType, bytes }]);
  const releaseManifest = {
    schemaVersion: 1,
    sourceKind: review.source.item.kind,
    sourceId: review.source.item.id,
    sourceVersionId: review.source.version.id,
    sourceChecksum: review.source.version.checksum,
    reviewDigest: review.digest,
    packageChecksum: verified.checksum,
    publicMetadata: {
      title: review.listing.title,
      shortDescription: review.listing.shortDescription,
      spoilerLevel: "NONE",
    },
  };
  return db.$transaction(async (tx) => {
    // Recheck ownership and the exact saved version at commit time.
    const pinned = await tx.reusableAuthoringItemVersion.findFirst({
      where: {
        id: review.source.version.id,
        itemId: review.source.item.id,
        checksum: review.source.version.checksum,
        item: {
          ownerAccountId: accountId,
          archivedAt: null,
          currentVersionNumber: review.source.version.versionNumber,
        },
      },
    });
    if (!pinned || pinned.envelope !== review.source.version.envelope)
      throw new CommunityError("COMMUNITY_SOURCE_CONFLICT", "The Creator source changed before submission.");
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
        spoilerSnapshot: JSON.stringify({ level: "NONE" }),
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
        packageChecksum: packageChecksum(packageManifest),
        manifest: JSON.stringify(packageManifest),
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
          "I own or have permission to distribute the included Creator item.",
          "I reviewed the exact content, license, and attribution for public distribution.",
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

export function verifyCreatorReusablePackage(input: {
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
}) {
  const releaseManifest = JSON.parse(input.releaseManifest) as {
    sourceId?: string;
    sourceVersionId?: string;
    sourceChecksum?: string;
    packageChecksum?: string;
  };
  const manifest = communityPackageManifestSchema.parse(JSON.parse(input.packageManifest));
  const bytes = new TextEncoder().encode(input.itemMetadata);
  const verified = verifyCommunityPackage(manifest, [{ path: input.itemPath, mediaType: input.itemMediaType, bytes }]);
  if (
    manifest.releaseId !== input.releaseId ||
    manifest.packageId !== input.packageId ||
    verified.checksum !== input.packageRecordChecksum ||
    input.packageChecksum !== verified.checksum ||
    releaseManifest.packageChecksum !== verified.checksum ||
    sha256(stableJson(releaseManifest)) !== input.releaseManifestChecksum ||
    manifest.items.length !== 1 ||
    manifest.items[0].type !== input.itemType ||
    input.itemChecksum !== sha256(bytes) ||
    input.itemByteLength !== bytes.byteLength ||
    input.itemPath !== "items/creator.json" ||
    input.itemMediaType !== "application/json"
  )
    throw new CommunityError(
      "COMMUNITY_PACKAGE_RECEIPT_INVALID",
      "The pinned Creator package failed integrity verification.",
    );
  const envelope = parseReusableEnvelope(JSON.parse(input.itemMetadata));
  if (
    envelope.itemId !== releaseManifest.sourceId ||
    envelope.versionId !== releaseManifest.sourceVersionId ||
    envelope.checksum !== releaseManifest.sourceChecksum ||
    (envelope.kind === "PRESET" ? "STORY_BLOCK_PRESET" : "CHRONICLE_TEMPLATE") !== input.itemType
  )
    throw new CommunityError(
      "COMMUNITY_PACKAGE_RECEIPT_INVALID",
      "The package does not match its saved Creator source.",
    );
  return { manifest, envelope };
}

export function copyCreatorReusableEnvelope(
  envelope: ReturnType<typeof parseReusableEnvelope>,
  ownerId: string,
  itemId: string,
  versionId: string,
  releaseId: string,
  licenseKey: string,
) {
  const { checksum: _checksum, ...content } = envelope;
  void _checksum;
  const unsigned = {
    ...content,
    itemId,
    versionId,
    ownerId,
    attribution: {
      ...content.attribution,
      sourceItemId: envelope.itemId,
      sourceVersionId: envelope.versionId,
      sourceReleaseId: releaseId,
      license: licenseKey,
      modified: false,
    },
    lineage: [...content.lineage, { itemId: envelope.itemId, versionId: envelope.versionId }],
  };
  return { ...unsigned, checksum: checksumReusableEnvelope(unsigned) };
}
