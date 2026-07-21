import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  CommunityError,
  assertTransition,
  listingInputSchema,
  manifestChecksum,
  normalizeHandle,
  releaseManifestSchema,
  sanitizeChronicleMetadata,
} from "./domain";

export type CommunityActor = {
  playerProfileId: string;
  role?: "VISITOR" | "AUTHENTICATED_USER" | "CREATOR" | "VERIFIED_CREATOR" | "MODERATOR" | "ADMIN";
  correlationId?: string;
};

const rate = (actor: CommunityActor, policy: string, limit = 10) => {
  const result = consumeRateLimit(`${policy}:${actor.playerProfileId}`, { limit, windowMs: 60_000 });
  if (!result.allowed) throw new CommunityError("COMMUNITY_RATE_LIMITED", "Please wait before trying again.");
  return result;
};
const correlation = (actor: CommunityActor) => actor.correlationId ?? randomUUID();
const safeEventPayload = (value: Record<string, string | number | boolean | null | undefined>) =>
  JSON.stringify(Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null)));
async function audit(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  actor: CommunityActor,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, string | number | boolean | null | undefined>,
) {
  await tx.platformAuditEvent.create({
    data: {
      actorType: "PLAYER_PROFILE",
      actorId: actor.playerProfileId,
      action,
      resourceType,
      resourceId,
      correlationId: correlation(actor),
      metadata: safeEventPayload(metadata),
    },
  });
}
async function outbox(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  type: string,
  aggregateType: string,
  aggregateId: string,
  payload: Record<string, string | number | boolean | null | undefined>,
) {
  await tx.communityOutboxEvent.create({
    data: {
      eventType: type,
      aggregateType,
      aggregateId,
      payload: safeEventPayload(payload),
      idempotencyKey: `${type}:${aggregateId}:${randomUUID()}`,
    },
  });
}

export async function resolveProfileForActor(actor: CommunityActor) {
  return db.communityProfile.findUnique({ where: { playerProfileId: actor.playerProfileId } });
}
async function ownProfile(actor: CommunityActor) {
  const profile = await resolveProfileForActor(actor);
  if (!profile) throw new CommunityError("COMMUNITY_PROFILE_REQUIRED", "Create a Community Profile first.");
  if (profile.moderationStatus !== "ACTIVE" || profile.creatorStatus === "SUSPENDED")
    throw new CommunityError("COMMUNITY_ACCESS_DENIED", "This Community Profile is suspended.");
  return profile;
}

export async function createProfile(
  actor: CommunityActor,
  input: {
    handle: string;
    displayName: string;
    biography?: string;
    visibility?: "PRIVATE" | "COMMUNITY";
    supportedLanguages?: string[];
  },
) {
  rate(actor, "community-profile-create", 5);
  const handle = normalizeHandle(input.handle);
  if (!input.displayName.trim() || input.displayName.length > 120)
    throw new CommunityError(
      "COMMUNITY_INVALID_PROFILE",
      "Display name is required and must be 120 characters or fewer.",
    );
  return db.$transaction(async (tx) => {
    const existing = await tx.communityProfile.findUnique({ where: { playerProfileId: actor.playerProfileId } });
    if (existing) throw new CommunityError("COMMUNITY_PROFILE_EXISTS", "A Community Profile already exists.");
    const profile = await tx.communityProfile.create({
      data: {
        identityKey: `player:${actor.playerProfileId}`,
        playerProfileId: actor.playerProfileId,
        normalizedHandle: handle,
        handle,
        displayName: input.displayName.trim(),
        biography: input.biography?.trim() || null,
        visibility: input.visibility ?? "COMMUNITY",
        supportedLanguages: JSON.stringify(input.supportedLanguages ?? []),
      },
    });
    await outbox(tx, "COMMUNITY_PROFILE_CREATED", "COMMUNITY_PROFILE", profile.id, { handle: profile.handle });
    await audit(tx, actor, "COMMUNITY_PROFILE_CREATED", "COMMUNITY_PROFILE", profile.id, { handle: profile.handle });
    return ownerProfileProjection(profile);
  });
}

export async function getOwnProfile(actor: CommunityActor) {
  const profile = await ownProfile(actor);
  return ownerProfileProjection(profile);
}
export async function updateOwnProfile(
  actor: CommunityActor,
  input: {
    handle?: string;
    displayName?: string;
    biography?: string | null;
    visibility?: "PRIVATE" | "COMMUNITY";
    supportedLanguages?: string[];
  },
) {
  rate(actor, "community-profile-update", 15);
  const profile = await ownProfile(actor);
  const handle = input.handle === undefined ? undefined : normalizeHandle(input.handle);
  if (input.displayName !== undefined && (!input.displayName.trim() || input.displayName.length > 120))
    throw new CommunityError("COMMUNITY_INVALID_PROFILE", "Display name is invalid.");
  return db.$transaction(async (tx) => {
    const updated = await tx.communityProfile.update({
      where: { id: profile.id },
      data: {
        ...(handle ? { handle, normalizedHandle: handle } : {}),
        ...(input.displayName !== undefined ? { displayName: input.displayName.trim() } : {}),
        ...(input.biography !== undefined ? { biography: input.biography?.trim() || null } : {}),
        ...(input.visibility ? { visibility: input.visibility } : {}),
        ...(input.supportedLanguages ? { supportedLanguages: JSON.stringify(input.supportedLanguages) } : {}),
      },
    });
    await outbox(tx, "COMMUNITY_PROFILE_UPDATED", "COMMUNITY_PROFILE", updated.id, { handle: updated.handle });
    await audit(
      tx,
      actor,
      handle ? "COMMUNITY_HANDLE_CHANGED" : "COMMUNITY_PROFILE_UPDATED",
      "COMMUNITY_PROFILE",
      updated.id,
      { handle: updated.handle },
    );
    return ownerProfileProjection(updated);
  });
}
export async function getPublicProfile(handle: string) {
  const profile = await db.communityProfile.findUnique({ where: { normalizedHandle: normalizeHandle(handle) } });
  if (!profile || profile.visibility !== "COMMUNITY" || profile.moderationStatus !== "ACTIVE") return null;
  return publicProfileProjection(profile);
}

export async function createListing(actor: CommunityActor, raw: unknown) {
  rate(actor, "community-listing-create", 10);
  const profile = await ownProfile(actor);
  const input = listingInputSchema.parse(raw);
  if (input.visibility === "FEATURED")
    throw new CommunityError("COMMUNITY_ACCESS_DENIED", "Only editorial staff may feature content.");
  return db.$transaction(async (tx) => {
    const listing = await tx.communityListing.create({
      data: {
        ownerProfileId: profile.id,
        slug: input.slug,
        itemType: input.itemType,
        title: input.title,
        shortDescription: input.shortDescription ?? null,
        longDescription: input.longDescription ?? null,
        visibility: input.visibility,
        spoilerLevel: input.spoilerLevel,
        locationClass: input.locationClass,
        tags: JSON.stringify([...new Set(input.tags.map((tag) => tag.toLowerCase()))]),
      },
    });
    await outbox(tx, "COMMUNITY_LISTING_CREATED", "COMMUNITY_LISTING", listing.id, {
      slug: listing.slug,
      itemType: listing.itemType,
    });
    await audit(tx, actor, "COMMUNITY_LISTING_CREATED", "COMMUNITY_LISTING", listing.id, { slug: listing.slug });
    return ownerListingProjection(listing);
  });
}
export async function getOwnerListing(actor: CommunityActor, id: string) {
  const profile = await ownProfile(actor);
  const listing = await db.communityListing.findFirst({ where: { id, ownerProfileId: profile.id } });
  if (!listing) throw new CommunityError("COMMUNITY_LISTING_NOT_FOUND", "Listing not found.");
  return ownerListingProjection(listing);
}
export async function updateListing(actor: CommunityActor, id: string, raw: unknown) {
  rate(actor, "community-listing-update", 20);
  const profile = await ownProfile(actor);
  const input = listingInputSchema.partial().strict().parse(raw);
  const listing = await db.communityListing.findFirst({ where: { id, ownerProfileId: profile.id } });
  if (!listing) throw new CommunityError("COMMUNITY_ACCESS_DENIED", "You cannot edit this listing.");
  if (input.visibility === "FEATURED")
    throw new CommunityError("COMMUNITY_ACCESS_DENIED", "Only editorial staff may feature content.");
  return db.$transaction(async (tx) => {
    const updated = await tx.communityListing.update({
      where: { id },
      data: {
        ...(input.slug ? { slug: input.slug } : {}),
        ...(input.itemType ? { itemType: input.itemType } : {}),
        ...(input.title ? { title: input.title } : {}),
        ...(input.shortDescription !== undefined ? { shortDescription: input.shortDescription } : {}),
        ...(input.longDescription !== undefined ? { longDescription: input.longDescription } : {}),
        ...(input.visibility ? { visibility: input.visibility } : {}),
        ...(input.spoilerLevel ? { spoilerLevel: input.spoilerLevel } : {}),
        ...(input.locationClass ? { locationClass: input.locationClass } : {}),
        ...(input.tags ? { tags: JSON.stringify([...new Set(input.tags.map((tag) => tag.toLowerCase()))]) } : {}),
      },
    });
    await outbox(tx, "COMMUNITY_LISTING_UPDATED", "COMMUNITY_LISTING", id, { slug: updated.slug });
    await audit(tx, actor, "COMMUNITY_LISTING_UPDATED", "COMMUNITY_LISTING", id, { slug: updated.slug });
    return ownerListingProjection(updated);
  });
}
export async function transitionListing(
  actor: CommunityActor,
  id: string,
  next:
    | "VALIDATING"
    | "READY_FOR_REVIEW"
    | "IN_REVIEW"
    | "PUBLISHED"
    | "UPDATE_PENDING"
    | "QUARANTINED"
    | "REJECTED"
    | "ARCHIVED"
    | "REMOVED",
) {
  const profile = await ownProfile(actor);
  const listing = await db.communityListing.findFirst({ where: { id, ownerProfileId: profile.id } });
  if (!listing) throw new CommunityError("COMMUNITY_ACCESS_DENIED", "You cannot change this listing.");
  assertTransition(listing.publicationStatus as Parameters<typeof assertTransition>[0], next);
  return db.$transaction(async (tx) => {
    const updated = await tx.communityListing.update({ where: { id }, data: { publicationStatus: next } });
    await outbox(tx, "COMMUNITY_PUBLICATION_STATE_CHANGED", "COMMUNITY_LISTING", id, { status: next });
    await audit(tx, actor, "COMMUNITY_PUBLICATION_STATE_CHANGED", "COMMUNITY_LISTING", id, { status: next });
    return ownerListingProjection(updated);
  });
}
export async function listPublicListingsFoundation() {
  const listings = await db.communityListing.findMany({
    where: {
      publicationStatus: "PUBLISHED",
      visibility: { in: ["COMMUNITY", "FEATURED"] },
      moderationStatus: "ACTIVE",
      locationClass: { not: "PRIVATE_REAL_WORLD" },
    },
    include: { owner: true },
    orderBy: { updatedAt: "desc" },
  });
  return listings.map(publicListingProjection);
}
export async function getPublicListingBySlug(slug: string) {
  const listing = await db.communityListing.findFirst({
    where: {
      slug,
      publicationStatus: "PUBLISHED",
      visibility: { in: ["COMMUNITY", "FEATURED"] },
      moderationStatus: "ACTIVE",
      locationClass: { not: "PRIVATE_REAL_WORLD" },
    },
    include: { owner: true, currentRelease: true },
  });
  return listing ? publicListingProjection(listing) : null;
}

export async function createRelease(actor: CommunityActor, listingId: string, raw: unknown) {
  rate(actor, "community-release-create", 5);
  const profile = await ownProfile(actor);
  const request = releaseManifestSchema.parse(raw);
  if (request.listingId !== listingId)
    throw new CommunityError("COMMUNITY_SOURCE_VERSION_MISMATCH", "Release manifest targets another listing.");
  if (process.env.COMMUNITY_ENABLED === "false")
    throw new CommunityError("COMMUNITY_NOT_ENABLED", "Community Harbor is disabled.");
  return db.$transaction(async (tx) => {
    const listing = await tx.communityListing.findFirst({ where: { id: listingId, ownerProfileId: profile.id } });
    if (!listing) throw new CommunityError("COMMUNITY_ACCESS_DENIED", "You cannot release this listing.");
    const source = await tx.publishedTaleVersion.findUnique({ where: { id: request.sourcePublishedTaleVersionId } });
    if (!source || !source.isCurrent)
      throw new CommunityError(
        "COMMUNITY_SOURCE_NOT_IMMUTABLE",
        "An immutable published Chronicle version is required.",
      );
    const publicMetadata = sanitizeChronicleMetadata(JSON.parse(source.contentSnapshot) as Record<string, unknown>);
    const manifest = releaseManifestSchema.parse({
      ...request,
      publicMetadata: { ...request.publicMetadata, ...publicMetadata },
    });
    const checksum = manifestChecksum(manifest);
    const release = await tx.communityRelease.create({
      data: {
        listingId,
        semanticVersion: manifest.semanticVersion,
        manifestSchemaVersion: manifest.schemaVersion,
        sourcePublishedTaleVersionId: source.id,
        manifest: JSON.stringify(manifest),
        manifestChecksum: checksum,
        compatibility: JSON.stringify({ sourceTaleId: source.taleId, sourceChecksum: source.checksum }),
        licenseSnapshot: JSON.stringify(manifest.license),
        attributionSnapshot: JSON.stringify(manifest.attribution),
        spoilerSnapshot: JSON.stringify({ level: manifest.publicMetadata.spoilerLevel }),
        publishedByProfileId: profile.id,
      },
    });
    await tx.communityListing.update({
      where: { id: listingId },
      data: { currentReleaseId: release.id, publicationStatus: "UPDATE_PENDING" },
    });
    await outbox(tx, "COMMUNITY_RELEASE_CREATED", "COMMUNITY_RELEASE", release.id, {
      listingId,
      semanticVersion: release.semanticVersion,
      checksum: release.manifestChecksum,
    });
    await audit(tx, actor, "COMMUNITY_RELEASE_CREATED", "COMMUNITY_RELEASE", release.id, {
      listingId,
      semanticVersion: release.semanticVersion,
    });
    return ownerReleaseProjection(release);
  });
}
export async function getPublicRelease(id: string) {
  const release = await db.communityRelease.findFirst({
    where: {
      id,
      moderationStatus: "ACTIVE",
      listing: {
        publicationStatus: "PUBLISHED",
        visibility: { in: ["COMMUNITY", "FEATURED"] },
        moderationStatus: "ACTIVE",
      },
    },
    include: { listing: { include: { owner: true } } },
  });
  return release ? publicReleaseProjection(release) : null;
}
export async function getOwnerRelease(actor: CommunityActor, id: string) {
  const profile = await ownProfile(actor);
  const release = await db.communityRelease.findFirst({ where: { id, listing: { ownerProfileId: profile.id } } });
  if (!release) throw new CommunityError("COMMUNITY_RELEASE_NOT_FOUND", "Release not found.");
  return ownerReleaseProjection(release);
}
export async function deprecateRelease(actor: CommunityActor, id: string, replacementReleaseId?: string) {
  const profile = await ownProfile(actor);
  const release = await db.communityRelease.findFirst({ where: { id, listing: { ownerProfileId: profile.id } } });
  if (!release) throw new CommunityError("COMMUNITY_ACCESS_DENIED", "You cannot deprecate this release.");
  if (replacementReleaseId) {
    const replacement = await db.communityRelease.findFirst({
      where: { id: replacementReleaseId, listingId: release.listingId },
    });
    if (!replacement)
      throw new CommunityError("COMMUNITY_RELEASE_NOT_FOUND", "Replacement must belong to the same listing.");
  }
  return db.$transaction(async (tx) => {
    const updated = await tx.communityRelease.update({
      where: { id },
      data: { deprecatedAt: new Date(), replacementReleaseId: replacementReleaseId ?? null },
    });
    await outbox(tx, "COMMUNITY_RELEASE_DEPRECATED", "COMMUNITY_RELEASE", id, { replacementReleaseId });
    await audit(
      tx,
      actor,
      replacementReleaseId ? "COMMUNITY_RELEASE_REPLACEMENT_SET" : "COMMUNITY_RELEASE_DEPRECATED",
      "COMMUNITY_RELEASE",
      id,
      { replacementReleaseId },
    );
    return ownerReleaseProjection(updated);
  });
}
export async function quarantineRelease(actor: CommunityActor, id: string) {
  if (actor.role !== "MODERATOR" && actor.role !== "ADMIN")
    throw new CommunityError("COMMUNITY_ACCESS_DENIED", "Moderation capability is required.");
  return db.$transaction(async (tx) => {
    const updated = await tx.communityRelease.update({ where: { id }, data: { moderationStatus: "QUARANTINED" } });
    await outbox(tx, "COMMUNITY_RELEASE_QUARANTINED", "COMMUNITY_RELEASE", id, {});
    await audit(tx, actor, "COMMUNITY_RELEASE_QUARANTINED", "COMMUNITY_RELEASE", id, {});
    return ownerReleaseProjection(updated);
  });
}
export async function restoreRelease(actor: CommunityActor, id: string) {
  if (actor.role !== "MODERATOR" && actor.role !== "ADMIN")
    throw new CommunityError("COMMUNITY_ACCESS_DENIED", "Moderation capability is required.");
  return db.$transaction(async (tx) => {
    const updated = await tx.communityRelease.update({ where: { id }, data: { moderationStatus: "ACTIVE" } });
    await outbox(tx, "COMMUNITY_RELEASE_RESTORED", "COMMUNITY_RELEASE", id, {});
    await audit(tx, actor, "COMMUNITY_RELEASE_RESTORED", "COMMUNITY_RELEASE", id, {});
    return ownerReleaseProjection(updated);
  });
}
export async function verifyReleaseIntegrity(actor: CommunityActor, id: string) {
  const release = await getOwnerRelease(actor, id);
  const stored = await db.communityRelease.findUnique({ where: { id } });
  if (!stored) throw new CommunityError("COMMUNITY_RELEASE_NOT_FOUND", "Release not found.");
  const manifest = releaseManifestSchema.parse(JSON.parse(stored.manifest));
  return { ...release, valid: manifestChecksum(manifest) === stored.manifestChecksum };
}

export function publicProfileProjection(profile: {
  handle: string;
  displayName: string;
  biography: string | null;
  verificationStatus: string;
}) {
  return {
    handle: profile.handle,
    displayName: profile.displayName,
    biography: profile.biography,
    verificationStatus: profile.verificationStatus,
  };
}
export function ownerProfileProjection(profile: {
  id: string;
  handle: string;
  displayName: string;
  biography: string | null;
  visibility: string;
  supportedLanguages: string;
  creatorStatus: string;
  verificationStatus: string;
}) {
  return {
    id: profile.id,
    handle: profile.handle,
    displayName: profile.displayName,
    biography: profile.biography,
    visibility: profile.visibility,
    supportedLanguages: JSON.parse(profile.supportedLanguages),
    creatorStatus: profile.creatorStatus,
    verificationStatus: profile.verificationStatus,
  };
}
export function ownerListingProjection(listing: {
  id: string;
  slug: string;
  itemType: string;
  title: string;
  publicationStatus: string;
  visibility: string;
  spoilerLevel: string;
  locationClass: string;
  currentReleaseId: string | null;
}) {
  return {
    id: listing.id,
    slug: listing.slug,
    itemType: listing.itemType,
    title: listing.title,
    publicationStatus: listing.publicationStatus,
    visibility: listing.visibility,
    spoilerLevel: listing.spoilerLevel,
    locationClass: listing.locationClass,
    currentReleaseId: listing.currentReleaseId,
  };
}
export function publicListingProjection(listing: {
  slug: string;
  itemType: string;
  title: string;
  shortDescription: string | null;
  tags: string;
  spoilerLevel: string;
  locationClass: string;
  owner: { handle: string; displayName: string };
}) {
  return {
    slug: listing.slug,
    itemType: listing.itemType,
    title: listing.title,
    shortDescription: listing.shortDescription,
    tags: JSON.parse(listing.tags),
    spoilerLevel: listing.spoilerLevel === "NONE" ? "NONE" : "PREVIEW_SAFE",
    locationClass: listing.locationClass,
    creator: { handle: listing.owner.handle, displayName: listing.owner.displayName },
  };
}
export function ownerReleaseProjection(release: {
  id: string;
  listingId: string;
  semanticVersion: string;
  manifestChecksum: string;
  sourcePublishedTaleVersionId: string | null;
  moderationStatus: string;
}) {
  return {
    id: release.id,
    listingId: release.listingId,
    semanticVersion: release.semanticVersion,
    manifestChecksum: release.manifestChecksum,
    sourcePublishedTaleVersionId: release.sourcePublishedTaleVersionId,
    moderationStatus: release.moderationStatus,
  };
}
export function publicReleaseProjection(release: {
  id: string;
  semanticVersion: string;
  manifestSchemaVersion: number;
  minimumPlatformVersion: string | null;
  releaseNotes: string | null;
  manifestChecksum: string;
  licenseSnapshot: string;
  attributionSnapshot: string;
}) {
  return {
    id: release.id,
    semanticVersion: release.semanticVersion,
    manifestSchemaVersion: release.manifestSchemaVersion,
    minimumPlatformVersion: release.minimumPlatformVersion,
    releaseNotes: release.releaseNotes,
    manifestChecksum: release.manifestChecksum,
    license: JSON.parse(release.licenseSnapshot),
    attribution: JSON.parse(release.attributionSnapshot),
  };
}
