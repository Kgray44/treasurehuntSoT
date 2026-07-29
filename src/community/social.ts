import { createHash } from "node:crypto";
import type { CommunityCreatorResponse, CommunityReport, CommunityReview, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { CommunityError } from "./domain";
import type { CommunityActor } from "./services";
import { attachReportToModerationCase, moderationPublicReceipt } from "./moderation";

/**
 * The Phase 3 schema deliberately stores Community links as scalar records.
 * This module is the authorization and projection boundary for those records;
 * callers must never return raw social rows to a public client.
 */
const socialDb = db;
type SocialTransaction = Prisma.TransactionClient;
const MAX_COLLECTION_ITEMS = 500;
const MAX_COMMENT_DEPTH = 2;
const SUBJECT_TYPES = ["LISTING", "RELEASE", "CREATOR", "VOYAGE_LOG", "COLLECTION", "GUIDE"] as const;
const COMMENT_SUBJECT_TYPES = ["LISTING", "VOYAGE_LOG", "GUIDE"] as const;
const REPORT_SUBJECT_TYPES = ["LISTING", "CREATOR", "REVIEW", "COMMENT", "COLLECTION", "VOYAGE_LOG", "GUIDE"] as const;
const COLLECTION_VISIBILITIES = ["PRIVATE", "UNLISTED", "COMMUNITY"] as const;
const REVIEW_STATUSES = ["ACTIVE", "QUARANTINED", "REMOVED"] as const;

export type SocialSubjectType = (typeof SUBJECT_TYPES)[number];
export type CollectionVisibility = (typeof COLLECTION_VISIBILITIES)[number];
export type IdempotentState = "CREATED" | "EXISTING" | "REMOVED" | "ABSENT" | "UPDATED";
export type IdempotentOutcome<T = undefined> = { state: IdempotentState; value?: T };

type Profile = {
  id: string;
  accountId: string;
  displayName: string;
  handle: string;
  moderationStatus: string;
  creatorStatus: string;
  visibility?: string;
};
type Subject = {
  type: SocialSubjectType;
  id: string;
  ownerAccountId?: string;
  public: boolean;
  commentsEnabled?: boolean;
};
type PublicReviewRecord = Pick<
  CommunityReview,
  | "id"
  | "listingId"
  | "authorDisplayName"
  | "authorHandle"
  | "rating"
  | "spoilerFreeBody"
  | "spoilerBody"
  | "spoilerLevel"
  | "verifiedInstallation"
  | "verifiedCompletion"
  | "status"
  | "editedAt"
  | "deletedAt"
> &
  Readonly<Record<string, unknown>>;
type PublicCommentRecord = Pick<
  Prisma.CommunityCommentGetPayload<object>,
  | "id"
  | "subjectType"
  | "subjectId"
  | "authorDisplayName"
  | "authorHandle"
  | "parentCommentId"
  | "depth"
  | "body"
  | "spoilerBody"
  | "spoilerLevel"
  | "status"
  | "editedAt"
  | "deletedAt"
  | "createdAt"
> &
  Readonly<Record<string, unknown>>;
type PublicCreatorResponseRecord = Pick<
  CommunityCreatorResponse,
  | "id"
  | "reviewId"
  | "creatorDisplayName"
  | "creatorHandle"
  | "body"
  | "spoilerBody"
  | "deletedAt"
  | "editedAt"
  | "createdAt"
> &
  Readonly<Record<string, unknown>>;

export const reviewDimensionRegistry = {
  CHRONICLE: ["story", "clarity", "pacing", "technicalReliability", "accessibility", "setupDifficulty"],
  CHRONICLE_TEMPLATE: ["structure", "clarity", "adaptability", "documentation", "accessibility", "setupDifficulty"],
  STORY_BLOCK_PRESET: ["clarity", "reliability", "customization", "documentation", "accessibility"],
  ARTIFACT_2D: ["visualQuality", "listingAccuracy", "customization", "documentation", "accessibility"],
  ARTIFACT_3D: ["modelQuality", "performance", "mobileBehavior", "listingAccuracy", "customization", "accessibility"],
  ARTIFACT_COLLECTION: ["cohesion", "componentQuality", "documentation", "accessibility", "setupDifficulty"],
  MAP_PACK: ["visualQuality", "usability", "responsiveness", "listingAccuracy", "accessibility"],
  LOCATION_PACK: ["visualQuality", "usability", "responsiveness", "listingAccuracy", "accessibility"],
  AUDIO_PACK: ["audioQuality", "loopQuality", "listingAccuracy", "documentation", "accessibility"],
  GUIDE: ["clarity", "usefulness", "accuracy", "accessibility", "currency"],
} as const;

function fail(code: string, message: string): never {
  throw new CommunityError(code, message);
}
function hasCode(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === code;
}
function requiredId(value: string, field: string) {
  if (!value || !value.trim()) fail("COMMUNITY_INVALID_INPUT", `${field} is required.`);
  return value;
}
function boundedText(value: string, field: string, min: number, max: number, allowEmpty = false) {
  const trimmed = value.trim();
  if ((!allowEmpty && trimmed.length < min) || trimmed.length > max)
    fail("COMMUNITY_INVALID_TEXT", `${field} must be between ${min} and ${max} characters.`);
  if (/<\/?[a-z][^>]*>/iu.test(trimmed)) fail("COMMUNITY_UNSAFE_TEXT", `${field} cannot contain HTML.`);
  return trimmed;
}
function socialRate(actor: CommunityActor, action: string, limit = 30) {
  const result = consumeRateLimit(`community-social:${action}:${actor.accountId}`, { limit, windowMs: 60_000 });
  if (!result.allowed) fail("COMMUNITY_RATE_LIMITED", "Please wait before trying again.");
}
function commentId(actor: CommunityActor, idempotencyKey: string) {
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(idempotencyKey))
    fail("COMMUNITY_INVALID_IDEMPOTENCY_KEY", "A valid idempotency key is required for comments.");
  // Supplying the primary key makes the retry durable without storing a second
  // copy of the request token or exposing it in a projection.
  return `comment_${createHash("sha256").update(`${actor.accountId}:${idempotencyKey}`).digest("hex").slice(0, 40)}`;
}
function reportId(actor: CommunityActor, idempotencyKey?: string) {
  return idempotencyKey
    ? `report_${createHash("sha256").update(`${actor.accountId}:${idempotencyKey}`).digest("hex").slice(0, 40)}`
    : undefined;
}
function isCollectionVisibility(value: string): value is CollectionVisibility {
  return (COLLECTION_VISIBILITIES as readonly string[]).includes(value);
}
function isSubjectType(value: string): value is SocialSubjectType {
  return (SUBJECT_TYPES as readonly string[]).includes(value);
}
function isCommentSubjectType(value: string): value is (typeof COMMENT_SUBJECT_TYPES)[number] {
  return (COMMENT_SUBJECT_TYPES as readonly string[]).includes(value);
}
function isReportSubjectType(value: string): value is (typeof REPORT_SUBJECT_TYPES)[number] {
  return (REPORT_SUBJECT_TYPES as readonly string[]).includes(value);
}

async function activeProfile(tx: SocialTransaction, actor: CommunityActor): Promise<Profile> {
  const profile = await tx.communityProfile.findUnique({ where: { accountId: actor.accountId } });
  if (!profile) fail("COMMUNITY_PROFILE_REQUIRED", "Create a Community Profile first.");
  if (profile.moderationStatus !== "ACTIVE" || profile.creatorStatus === "SUSPENDED")
    fail("COMMUNITY_ACCESS_DENIED", "This Community Profile is not active.");
  return profile;
}
async function activeAccount(tx: SocialTransaction, accountId: string) {
  const account = await tx.userAccount.findUnique({ where: { id: accountId }, select: { id: true, status: true } });
  if (!account || ["REMOVED", "SUSPENDED", "MERGED"].includes(account.status))
    fail("COMMUNITY_SUBJECT_UNAVAILABLE", "That Community account is unavailable.");
  return account;
}
export async function blockedBetween(tx: SocialTransaction, firstAccountId: string, secondAccountId: string) {
  if (firstAccountId === secondAccountId) return false;
  return Boolean(
    await tx.communityBlock.findFirst({
      where: {
        OR: [
          { blockerAccountId: firstAccountId, blockedAccountId: secondAccountId },
          { blockerAccountId: secondAccountId, blockedAccountId: firstAccountId },
        ],
      },
      select: { id: true },
    }),
  );
}
async function assertNotBlocked(tx: SocialTransaction, firstAccountId: string, secondAccountId?: string) {
  if (secondAccountId && (await blockedBetween(tx, firstAccountId, secondAccountId)))
    fail("COMMUNITY_BLOCKED", "This Community interaction is unavailable.");
}

async function resolveSubject(
  tx: SocialTransaction,
  subjectType: SocialSubjectType,
  subjectId: string,
): Promise<Subject> {
  if (subjectType === "LISTING") {
    const listing = await tx.communityListing.findUnique({
      where: { id: subjectId },
      include: { owner: { select: { accountId: true } } },
    });
    if (!listing) fail("COMMUNITY_SUBJECT_NOT_FOUND", "The Community item was not found.");
    return {
      type: subjectType,
      id: listing.id,
      ownerAccountId: listing.owner.accountId,
      public:
        listing.publicationStatus === "PUBLISHED" &&
        listing.moderationStatus === "ACTIVE" &&
        ["COMMUNITY", "FEATURED"].includes(listing.visibility),
      // The frozen Phase 3 model has no listing commentsEnabled field. Keep
      // listing comments fail-closed until its server-owned policy exists.
      commentsEnabled: false,
    };
  }
  if (subjectType === "RELEASE") {
    const release = await tx.communityRelease.findUnique({
      where: { id: subjectId },
      include: { listing: { include: { owner: { select: { accountId: true } } } } },
    });
    if (!release) fail("COMMUNITY_SUBJECT_NOT_FOUND", "The Community release was not found.");
    return {
      type: subjectType,
      id: release.id,
      ownerAccountId: release.listing.owner.accountId,
      public:
        release.moderationStatus === "ACTIVE" &&
        release.listing.publicationStatus === "PUBLISHED" &&
        ["COMMUNITY", "FEATURED"].includes(release.listing.visibility),
    };
  }
  if (subjectType === "CREATOR") {
    const profile = await tx.communityProfile.findUnique({ where: { id: subjectId } });
    if (!profile) fail("COMMUNITY_SUBJECT_NOT_FOUND", "The Creator profile was not found.");
    return {
      type: subjectType,
      id: profile.id,
      ownerAccountId: profile.accountId,
      public:
        profile.moderationStatus === "ACTIVE" &&
        profile.creatorStatus !== "SUSPENDED" &&
        profile.visibility === "COMMUNITY",
    };
  }
  if (subjectType === "VOYAGE_LOG") {
    const log = await tx.communityVoyageLog.findUnique({ where: { id: subjectId } });
    if (!log) fail("COMMUNITY_SUBJECT_NOT_FOUND", "The Voyage Log was not found.");
    return {
      type: subjectType,
      id: log.id,
      ownerAccountId: log.ownerAccountId,
      public: log.visibility === "COMMUNITY" && Boolean(log.publishedAt),
      commentsEnabled: log.commentsEnabled,
    };
  }
  if (subjectType === "COLLECTION") {
    const collection = await tx.communityCollection.findUnique({ where: { id: subjectId } });
    if (!collection) fail("COMMUNITY_SUBJECT_NOT_FOUND", "The collection was not found.");
    return {
      type: subjectType,
      id: collection.id,
      ownerAccountId: collection.ownerAccountId,
      public: collection.visibility === "COMMUNITY",
    };
  }
  const guide = await tx.communityGuideContent.findUnique({ where: { id: subjectId } });
  if (!guide) fail("COMMUNITY_SUBJECT_NOT_FOUND", "The Guide was not found.");
  const owner = await tx.communityProfile.findUnique({
    where: { id: guide.ownerProfileId },
    select: { accountId: true },
  });
  return {
    type: subjectType,
    id: guide.id,
    ownerAccountId: owner?.accountId,
    public: guide.status === "PUBLISHED" && !guide.deprecatedAt,
    commentsEnabled: guide.status === "PUBLISHED" && !guide.deprecatedAt,
  };
}

type UniqueDelegate = Readonly<{
  findUnique(input: { where: Record<string, unknown> }): Promise<unknown>;
  create(input: { data: Record<string, unknown> }): Promise<unknown>;
  delete(input: { where: Record<string, unknown> }): Promise<unknown>;
}>;
async function createUnique(
  _tx: SocialTransaction,
  delegate: UniqueDelegate,
  where: Record<string, unknown>,
  data: Record<string, unknown>,
) {
  const existing = await delegate.findUnique({ where });
  if (existing) return { state: "EXISTING" as const, value: existing };
  try {
    return { state: "CREATED" as const, value: await delegate.create({ data }) };
  } catch (error) {
    if (!hasCode(error, "P2002")) throw error;
    return { state: "EXISTING" as const, value: await delegate.findUnique({ where }) };
  }
}
async function removeUnique(_tx: SocialTransaction, delegate: UniqueDelegate, where: Record<string, unknown>) {
  const existing = await delegate.findUnique({ where });
  if (!existing) return { state: "ABSENT" as const };
  await delegate.delete({ where });
  return { state: "REMOVED" as const };
}

export async function blockAccount(
  actor: CommunityActor,
  blockedAccountId: string,
): Promise<IdempotentOutcome<unknown>> {
  socialRate(actor, "block", 15);
  requiredId(blockedAccountId, "Blocked account");
  if (actor.accountId === blockedAccountId) fail("COMMUNITY_SELF_BLOCK", "You cannot block yourself.");
  return socialDb.$transaction(async (tx) => {
    await activeProfile(tx, actor);
    await activeAccount(tx, blockedAccountId);
    return createUnique(
      tx,
      tx.communityBlock,
      { blockerAccountId_blockedAccountId: { blockerAccountId: actor.accountId, blockedAccountId } },
      { blockerAccountId: actor.accountId, blockedAccountId },
    );
  });
}
export async function unblockAccount(actor: CommunityActor, blockedAccountId: string): Promise<IdempotentOutcome> {
  socialRate(actor, "unblock", 15);
  return socialDb.$transaction(async (tx) =>
    removeUnique(tx, tx.communityBlock, {
      blockerAccountId_blockedAccountId: { blockerAccountId: actor.accountId, blockedAccountId },
    }),
  );
}
export async function blockCreatorProfile(
  actor: CommunityActor,
  creatorProfileId: string,
): Promise<IdempotentOutcome<unknown>> {
  const creator = await socialDb.communityProfile.findUnique({
    where: { id: creatorProfileId },
    select: { accountId: true },
  });
  if (!creator) fail("COMMUNITY_SUBJECT_UNAVAILABLE", "That Creator is unavailable.");
  return blockAccount(actor, creator.accountId);
}
export async function unblockCreatorProfile(
  actor: CommunityActor,
  creatorProfileId: string,
): Promise<IdempotentOutcome> {
  const creator = await socialDb.communityProfile.findUnique({
    where: { id: creatorProfileId },
    select: { accountId: true },
  });
  if (!creator) return { state: "ABSENT" };
  return unblockAccount(actor, creator.accountId);
}

export async function followCreator(
  actor: CommunityActor,
  creatorProfileId: string,
): Promise<IdempotentOutcome<unknown>> {
  socialRate(actor, "follow", 30);
  return socialDb.$transaction(async (tx) => {
    await activeProfile(tx, actor);
    const creator = await tx.communityProfile.findUnique({ where: { id: creatorProfileId } });
    if (!creator || creator.moderationStatus !== "ACTIVE" || creator.creatorStatus === "SUSPENDED")
      fail("COMMUNITY_SUBJECT_UNAVAILABLE", "That Creator cannot be followed.");
    if (creator.accountId === actor.accountId) fail("COMMUNITY_SELF_FOLLOW", "You cannot follow yourself.");
    await assertNotBlocked(tx, actor.accountId, creator.accountId);
    return createUnique(
      tx,
      tx.communityCreatorFollow,
      { followerAccountId_creatorProfileId: { followerAccountId: actor.accountId, creatorProfileId } },
      { followerAccountId: actor.accountId, creatorProfileId },
    );
  });
}
export async function unfollowCreator(actor: CommunityActor, creatorProfileId: string): Promise<IdempotentOutcome> {
  socialRate(actor, "unfollow", 30);
  return socialDb.$transaction(async (tx) =>
    removeUnique(tx, tx.communityCreatorFollow, {
      followerAccountId_creatorProfileId: { followerAccountId: actor.accountId, creatorProfileId },
    }),
  );
}
export async function creatorFollowerCount(creatorProfileId: string) {
  return socialDb.communityCreatorFollow.count({ where: { creatorProfileId } });
}

export async function saveSubject(
  actor: CommunityActor,
  input: { subjectType: SocialSubjectType; subjectId: string; kind?: "SAVE" | "FAVORITE" },
): Promise<IdempotentOutcome<unknown>> {
  socialRate(actor, "save", 60);
  if (!isSubjectType(input.subjectType)) fail("COMMUNITY_INVALID_SUBJECT", "Unsupported saved subject.");
  const kind = input.kind ?? "SAVE";
  if (kind !== "SAVE" && kind !== "FAVORITE") fail("COMMUNITY_INVALID_SAVE_KIND", "Unsupported save kind.");
  return socialDb.$transaction(async (tx) => {
    await activeProfile(tx, actor);
    const subject = await resolveSubject(tx, input.subjectType, requiredId(input.subjectId, "Subject"));
    await assertNotBlocked(tx, actor.accountId, subject.ownerAccountId);
    return createUnique(
      tx,
      tx.communitySave,
      {
        accountId_subjectType_subjectId_kind: {
          accountId: actor.accountId,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          kind,
        },
      },
      { accountId: actor.accountId, subjectType: input.subjectType, subjectId: input.subjectId, kind },
    );
  });
}
export const favoriteSubject = (actor: CommunityActor, subjectType: SocialSubjectType, subjectId: string) =>
  saveSubject(actor, { subjectType, subjectId, kind: "FAVORITE" });
export async function unsaveSubject(
  actor: CommunityActor,
  input: { subjectType: SocialSubjectType; subjectId: string; kind?: "SAVE" | "FAVORITE" },
): Promise<IdempotentOutcome> {
  socialRate(actor, "unsave", 60);
  const kind = input.kind ?? "SAVE";
  return socialDb.$transaction(async (tx) =>
    removeUnique(tx, tx.communitySave, {
      accountId_subjectType_subjectId_kind: {
        accountId: actor.accountId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        kind,
      },
    }),
  );
}
export async function activeSaveCount(
  subjectType: SocialSubjectType,
  subjectId: string,
  kind: "SAVE" | "FAVORITE" = "SAVE",
) {
  return socialDb.communitySave.count({ where: { subjectType, subjectId, kind } });
}

export function normalizeCollectionSlug(value: string) {
  const slug = value.trim().toLowerCase();
  if (slug.length < 3 || slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    fail("COMMUNITY_INVALID_COLLECTION_SLUG", "Collection slug must be 3 to 80 lowercase URL-safe characters.");
  return slug;
}
export async function createCollection(
  actor: CommunityActor,
  input: { slug: string; title: string; description?: string; visibility?: CollectionVisibility },
): Promise<IdempotentOutcome<unknown>> {
  socialRate(actor, "collection-create", 15);
  const slug = normalizeCollectionSlug(input.slug);
  const visibility = input.visibility ?? "PRIVATE";
  if (!isCollectionVisibility(visibility))
    fail("COMMUNITY_INVALID_COLLECTION_VISIBILITY", "Unsupported collection visibility.");
  const title = boundedText(input.title, "Collection title", 1, 120);
  const description =
    input.description === undefined
      ? null
      : boundedText(input.description, "Collection description", 0, 2_000, true) || null;
  return socialDb.$transaction(async (tx) => {
    await activeProfile(tx, actor);
    const existing = await tx.communityCollection.findUnique({ where: { slug } });
    if (existing) {
      if (existing.ownerAccountId !== actor.accountId)
        fail("COMMUNITY_COLLECTION_SLUG_TAKEN", "That collection slug is already in use.");
      return { state: "EXISTING" as const, value: existing };
    }
    return {
      state: "CREATED" as const,
      value: await tx.communityCollection.create({
        data: { ownerAccountId: actor.accountId, slug, title, description, visibility },
      }),
    };
  });
}
async function ownCollection(tx: SocialTransaction, actor: CommunityActor, collectionId: string) {
  const collection = await tx.communityCollection.findUnique({ where: { id: collectionId } });
  if (!collection || collection.ownerAccountId !== actor.accountId)
    fail("COMMUNITY_ACCESS_DENIED", "You cannot change this collection.");
  return collection;
}
async function containsCollection(
  tx: SocialTransaction,
  collectionId: string,
  targetId: string,
  depth = 0,
): Promise<boolean> {
  if (collectionId === targetId) return true;
  if (depth >= 2) return false;
  const children = await tx.communityCollectionItem.findMany({
    where: { collectionId, subjectType: "COLLECTION" },
    select: { subjectId: true },
  });
  for (const child of children) if (await containsCollection(tx, child.subjectId, targetId, depth + 1)) return true;
  return false;
}
async function collectionAncestorDepth(tx: SocialTransaction, collectionId: string, depth = 0): Promise<number> {
  if (depth >= 3) return depth;
  const parent = await tx.communityCollectionItem.findFirst({
    where: { subjectType: "COLLECTION", subjectId: collectionId },
    select: { collectionId: true },
  });
  return parent ? collectionAncestorDepth(tx, parent.collectionId, depth + 1) : depth;
}
async function collectionDescendantDepth(tx: SocialTransaction, collectionId: string, depth = 0): Promise<number> {
  const children = await tx.communityCollectionItem.findMany({
    where: { collectionId, subjectType: "COLLECTION" },
    select: { subjectId: true },
  });
  if (!children.length) return depth;
  return Math.max(
    ...(await Promise.all(
      children.map((child: { subjectId: string }) => collectionDescendantDepth(tx, child.subjectId, depth + 1)),
    )),
  );
}
export async function addCollectionItem(
  actor: CommunityActor,
  input: { collectionId: string; subjectType: SocialSubjectType; subjectId: string },
): Promise<IdempotentOutcome<unknown>> {
  socialRate(actor, "collection-add", 60);
  if (!isSubjectType(input.subjectType)) fail("COMMUNITY_INVALID_SUBJECT", "Unsupported collection subject.");
  return socialDb.$transaction(async (tx) => {
    await activeProfile(tx, actor);
    const collection = await ownCollection(tx, actor, input.collectionId);
    const subject = await resolveSubject(tx, input.subjectType, input.subjectId);
    await assertNotBlocked(tx, actor.accountId, subject.ownerAccountId);
    if (collection.visibility === "COMMUNITY" && !subject.public)
      fail("COMMUNITY_COLLECTION_PRIVATE_ITEM", "Public collections can contain only current public items.");
    if (input.subjectType === "COLLECTION") {
      if (input.subjectId === collection.id || (await containsCollection(tx, input.subjectId, collection.id)))
        fail("COMMUNITY_COLLECTION_CYCLE", "Collections cannot contain themselves or form a cycle.");
      if (
        (await collectionAncestorDepth(tx, collection.id)) +
          1 +
          (await collectionDescendantDepth(tx, input.subjectId)) >
        2
      )
        fail("COMMUNITY_COLLECTION_DEPTH", "Collections can nest no more than two levels deep.");
      if (collection.visibility === "COMMUNITY" && !subject.public)
        fail("COMMUNITY_COLLECTION_PRIVATE_ITEM", "Public collections cannot contain a private collection.");
    }
    const existing = await tx.communityCollectionItem.findUnique({
      where: {
        collectionId_subjectType_subjectId: {
          collectionId: collection.id,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
        },
      },
    });
    if (existing) return { state: "EXISTING" as const, value: existing };
    const count = await tx.communityCollectionItem.count({ where: { collectionId: collection.id } });
    if (count >= MAX_COLLECTION_ITEMS)
      fail("COMMUNITY_COLLECTION_FULL", `Collections are limited to ${MAX_COLLECTION_ITEMS} items.`);
    return {
      state: "CREATED" as const,
      value: await tx.communityCollectionItem.create({
        data: {
          collectionId: collection.id,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          position: count,
        },
      }),
    };
  });
}
export async function reorderCollection(
  actor: CommunityActor,
  input: { collectionId: string; orderedItemIds: string[]; expectedUpdatedAt: string },
): Promise<IdempotentOutcome> {
  socialRate(actor, "collection-reorder", 30);
  return socialDb.$transaction(async (tx) => {
    const collection = await ownCollection(tx, actor, input.collectionId);
    if (collection.updatedAt.toISOString() !== input.expectedUpdatedAt)
      fail("COMMUNITY_COLLECTION_REVISION_CONFLICT", "This collection changed before it could be reordered.");
    const items = await tx.communityCollectionItem.findMany({
      where: { collectionId: collection.id },
      orderBy: { position: "asc" },
    });
    if (
      items.length !== input.orderedItemIds.length ||
      new Set(input.orderedItemIds).size !== items.length ||
      items.some((item) => !input.orderedItemIds.includes(item.id))
    )
      fail("COMMUNITY_INVALID_COLLECTION_ORDER", "The collection order does not match its current items.");
    // Free unique positions before assigning the requested keyboard/drag order.
    await Promise.all(
      items.map((item, index: number) =>
        tx.communityCollectionItem.update({ where: { id: item.id }, data: { position: -(index + 1) } }),
      ),
    );
    await Promise.all(
      input.orderedItemIds.map((id, position) =>
        tx.communityCollectionItem.update({ where: { id }, data: { position } }),
      ),
    );
    await tx.communityCollection.update({ where: { id: collection.id }, data: {} });
    return { state: "UPDATED" as const };
  });
}
export async function updateCollection(
  actor: CommunityActor,
  input: {
    collectionId: string;
    title?: string;
    description?: string | null;
    coverReference?: string | null;
    visibility?: CollectionVisibility;
    expectedUpdatedAt: string;
  },
) {
  socialRate(actor, "collection-update", 30);
  return socialDb.$transaction(async (tx) => {
    const collection = await ownCollection(tx, actor, input.collectionId);
    if (collection.updatedAt.toISOString() !== input.expectedUpdatedAt)
      fail("COMMUNITY_COLLECTION_REVISION_CONFLICT", "This collection changed before it could be saved.");
    if (input.visibility && !isCollectionVisibility(input.visibility))
      fail("COMMUNITY_INVALID_COLLECTION_VISIBILITY", "Unsupported collection visibility.");
    if (input.visibility === "COMMUNITY") {
      const items = await tx.communityCollectionItem.findMany({ where: { collectionId: collection.id } });
      for (const item of items) {
        if (!isSubjectType(item.subjectType) || !(await resolveSubject(tx, item.subjectType, item.subjectId)).public)
          fail("COMMUNITY_COLLECTION_PRIVATE_ITEM", "Public collections can contain only current public items.");
      }
    }
    const data = {
      ...(input.title !== undefined ? { title: boundedText(input.title, "Collection title", 1, 120) } : {}),
      ...(input.description !== undefined
        ? {
            description:
              input.description === null
                ? null
                : boundedText(input.description, "Collection description", 0, 2_000, true) || null,
          }
        : {}),
      ...(input.coverReference !== undefined
        ? {
            coverReference: input.coverReference === null ? null : requiredId(input.coverReference, "Collection cover"),
          }
        : {}),
      ...(input.visibility ? { visibility: input.visibility } : {}),
    };
    return {
      state: "UPDATED" as const,
      value: await tx.communityCollection.update({ where: { id: collection.id }, data }),
    };
  });
}
export async function removeCollectionItem(actor: CommunityActor, collectionId: string, itemId: string) {
  socialRate(actor, "collection-remove", 60);
  return socialDb.$transaction(async (tx) => {
    const collection = await ownCollection(tx, actor, collectionId);
    const item = await tx.communityCollectionItem.findFirst({ where: { id: itemId, collectionId: collection.id } });
    if (!item) return { state: "ABSENT" as const };
    await tx.communityCollectionItem.delete({ where: { id: item.id } });
    const remaining = await tx.communityCollectionItem.findMany({
      where: { collectionId: collection.id },
      orderBy: { position: "asc" },
    });
    await Promise.all(
      remaining.map((entry, position: number) =>
        tx.communityCollectionItem.update({ where: { id: entry.id }, data: { position } }),
      ),
    );
    await tx.communityCollection.update({ where: { id: collection.id }, data: {} });
    return { state: "REMOVED" as const };
  });
}
export async function archiveCollection(actor: CommunityActor, collectionId: string) {
  return socialDb.$transaction(async (tx) => {
    const collection = await ownCollection(tx, actor, collectionId);
    if (collection.archivedAt) return { state: "EXISTING" as const };
    await tx.communityCollection.update({
      where: { id: collection.id },
      data: { archivedAt: new Date(), visibility: "PRIVATE" },
    });
    return { state: "UPDATED" as const };
  });
}
export async function tombstoneCollection(actor: CommunityActor, collectionId: string) {
  return socialDb.$transaction(async (tx) => {
    const collection = await ownCollection(tx, actor, collectionId);
    if (collection.deletedAt) return { state: "EXISTING" as const };
    await tx.communityCollection.update({
      where: { id: collection.id },
      data: {
        deletedAt: new Date(),
        archivedAt: collection.archivedAt ?? new Date(),
        visibility: "PRIVATE",
        title: "Unavailable collection",
        description: null,
        coverReference: null,
      },
    });
    return { state: "UPDATED" as const };
  });
}

export function validateReviewInput(
  input: {
    rating: number;
    spoilerFreeBody?: string | null;
    spoilerBody?: string | null;
    dimensions?: Record<string, number>;
  },
  itemType: string,
) {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)
    fail("COMMUNITY_INVALID_RATING", "Review rating must be an integer from 1 to 5.");
  const spoilerFreeBody =
    input.spoilerFreeBody == null ? null : boundedText(input.spoilerFreeBody, "Spoiler-free review", 10, 5_000);
  const spoilerBody =
    input.spoilerBody == null ? null : boundedText(input.spoilerBody, "Spoiler review", 0, 5_000, true) || null;
  const allowed = reviewDimensionRegistry[itemType as keyof typeof reviewDimensionRegistry];
  const dimensions = Object.entries(input.dimensions ?? {});
  if (!allowed && dimensions.length)
    fail("COMMUNITY_INVALID_REVIEW_DIMENSION", "This item type does not accept review dimensions.");
  for (const [dimension, score] of dimensions) {
    if (!allowed?.includes(dimension as never) || !Number.isInteger(score) || score < 1 || score > 5)
      fail("COMMUNITY_INVALID_REVIEW_DIMENSION", "Review dimensions must be applicable integer scores from 1 to 5.");
  }
  return { rating: input.rating, spoilerFreeBody, spoilerBody, dimensions };
}
async function reviewEligibility(
  tx: SocialTransaction,
  actor: CommunityActor,
  listing: { id: string; ownerProfileId: string; currentReleaseId: string | null },
  releaseId?: string,
) {
  const reviewedReleaseId = releaseId ?? listing.currentReleaseId;
  if (releaseId) {
    const release = await tx.communityRelease.findFirst({ where: { id: releaseId, listingId: listing.id } });
    if (!release) fail("COMMUNITY_REVIEW_RELEASE_MISMATCH", "The reviewed release does not belong to this listing.");
  }
  const installation = reviewedReleaseId
    ? await tx.communityInstallation.findFirst({
        where: { accountId: actor.accountId, releaseId: reviewedReleaseId, mode: { not: "PREVIEW_SANDBOX" } },
        select: { id: true, operationId: true },
      })
    : null;
  // An installation row alone is not eligibility evidence: Phase 2 writes it
  // only after commit, and this explicit status check protects future adapters.
  const committedInstallation = installation
    ? await tx.communityInstallOperation.findFirst({
        where: {
          id: installation.operationId,
          accountId: actor.accountId,
          ...(reviewedReleaseId ? { releaseId: reviewedReleaseId } : {}),
          status: "COMMITTED",
        },
        select: { id: true },
      })
    : null;
  const player = await tx.playerProfile.findUnique({ where: { accountId: actor.accountId }, select: { id: true } });
  const release = reviewedReleaseId
    ? await tx.communityRelease.findUnique({
        where: { id: reviewedReleaseId },
        select: { sourcePublishedTaleVersionId: true },
      })
    : null;
  const completion =
    player && release?.sourcePublishedTaleVersionId
      ? await tx.playthroughMembership.findFirst({
          where: {
            playerProfileId: player.id,
            completedAt: { not: null },
            playthrough: {
              status: "COMPLETED",
              publishedVersionId: release.sourcePublishedTaleVersionId,
              previewMode: false,
            },
          },
          select: { playthroughId: true },
        })
      : null;
  return {
    reviewedReleaseId,
    verifiedInstallation: Boolean(committedInstallation),
    verifiedCompletion: Boolean(completion),
    // Stored only for server-derived eligibility/audit; never projected.
    completionSessionId: completion?.playthroughId ?? null,
  };
}
export async function createOrUpdateReview(
  actor: CommunityActor,
  input: {
    listingId: string;
    reviewedReleaseId?: string;
    rating: number;
    spoilerFreeBody?: string | null;
    spoilerBody?: string | null;
    dimensions?: Record<string, number>;
  },
): Promise<IdempotentOutcome<unknown>> {
  socialRate(actor, "review", 12);
  return socialDb.$transaction(async (tx) => {
    const profile = await activeProfile(tx, actor);
    const listing = await tx.communityListing.findUnique({
      where: { id: input.listingId },
      include: { owner: { select: { accountId: true } } },
    });
    if (!listing || listing.publicationStatus !== "PUBLISHED" || listing.moderationStatus !== "ACTIVE")
      fail("COMMUNITY_SUBJECT_UNAVAILABLE", "This listing cannot be reviewed.");
    if (listing.ownerProfileId === profile.id || listing.owner.accountId === actor.accountId)
      fail("COMMUNITY_SELF_REVIEW", "You cannot review your own content.");
    const coCreator = await tx.communityReleaseAttribution.findFirst({
      where: { creditedProfileId: profile.id, release: { listingId: listing.id } },
      select: { id: true },
    });
    if (coCreator) fail("COMMUNITY_SELF_REVIEW", "Creators cannot review work they co-created.");
    await assertNotBlocked(tx, actor.accountId, listing.owner.accountId);
    const data = validateReviewInput(input, listing.itemType);
    const eligibility = await reviewEligibility(tx, actor, listing, input.reviewedReleaseId);
    const existing = await tx.communityReview.findUnique({
      where: { listingId_authorAccountId: { listingId: listing.id, authorAccountId: actor.accountId } },
    });
    const review = existing
      ? await tx.communityReview.update({
          where: { id: existing.id },
          data: {
            ...data,
            spoilerLevel: data.spoilerBody ? "SPOILER" : "NONE",
            ...eligibility,
            authorDisplayName: profile.displayName,
            authorHandle: profile.handle,
            status: "ACTIVE",
            deletedAt: null,
            editedAt: new Date(),
          },
        })
      : await tx.communityReview.create({
          data: {
            listingId: listing.id,
            authorAccountId: actor.accountId,
            authorDisplayName: profile.displayName,
            authorHandle: profile.handle,
            ...data,
            spoilerLevel: data.spoilerBody ? "SPOILER" : "NONE",
            ...eligibility,
          },
        });
    await tx.communityReviewDimension.deleteMany({ where: { reviewId: review.id } });
    if (data.dimensions.length)
      await tx.communityReviewDimension.createMany({
        data: data.dimensions.map(([dimension, score]) => ({ reviewId: review.id, dimension, score })),
      });
    return {
      state: existing ? ("UPDATED" as const) : ("CREATED" as const),
      value: publicReviewProjection(review, data.dimensions),
    };
  });
}
export async function deleteReview(actor: CommunityActor, reviewId: string): Promise<IdempotentOutcome> {
  socialRate(actor, "review-delete", 12);
  return socialDb.$transaction(async (tx) => {
    const review = await tx.communityReview.findUnique({ where: { id: reviewId } });
    if (!review || review.authorAccountId !== actor.accountId)
      fail("COMMUNITY_ACCESS_DENIED", "You cannot delete this review.");
    if (review.deletedAt) return { state: "ABSENT" as const };
    await tx.communityReview.update({ where: { id: review.id }, data: { status: "REMOVED", deletedAt: new Date() } });
    return { state: "REMOVED" as const };
  });
}
export async function updateReview(
  actor: CommunityActor,
  reviewId: string,
  input: Omit<Parameters<typeof createOrUpdateReview>[1], "listingId">,
): Promise<IdempotentOutcome<unknown>> {
  const existing = await socialDb.communityReview.findUnique({
    where: { id: reviewId },
    select: { listingId: true, authorAccountId: true },
  });
  if (!existing || existing.authorAccountId !== actor.accountId)
    fail("COMMUNITY_ACCESS_DENIED", "You cannot edit this review.");
  return createOrUpdateReview(actor, { ...input, listingId: existing.listingId });
}
export function publicReviewProjection(
  review: PublicReviewRecord,
  dimensions: readonly (readonly [string, number])[] = [],
) {
  return {
    id: review.id,
    listingId: review.listingId,
    rating: review.rating,
    author: review.authorDisplayName
      ? { displayName: review.authorDisplayName, ...(review.authorHandle ? { handle: review.authorHandle } : {}) }
      : null,
    spoilerFreeBody: review.deletedAt || review.status !== "ACTIVE" ? null : review.spoilerFreeBody,
    hasSpoiler: Boolean(!review.deletedAt && review.status === "ACTIVE" && review.spoilerBody),
    spoilerLevel: review.spoilerLevel,
    verifiedInstallation: review.verifiedInstallation,
    verifiedCompletion: review.verifiedCompletion,
    editedAt: review.editedAt,
    deletedAt: review.deletedAt,
    dimensions: dimensions.map(([dimension, score]) => ({ dimension, score })),
  };
}
export async function revealReviewSpoiler(reviewId: string) {
  const review = await socialDb.communityReview.findUnique({ where: { id: reviewId } });
  const listing = review ? await socialDb.communityListing.findUnique({ where: { id: review.listingId } }) : null;
  if (
    !review ||
    !listing ||
    review.status !== "ACTIVE" ||
    review.deletedAt ||
    !review.spoilerBody ||
    listing.publicationStatus !== "PUBLISHED" ||
    !["COMMUNITY", "FEATURED"].includes(listing.visibility)
  )
    fail("COMMUNITY_SPOILER_UNAVAILABLE", "This spoiler section is unavailable.");
  return { spoilerBody: review.spoilerBody };
}

export async function voteReviewHelpful(actor: CommunityActor, reviewId: string): Promise<IdempotentOutcome<unknown>> {
  socialRate(actor, "helpful-vote", 30);
  return socialDb.$transaction(async (tx) => {
    await activeProfile(tx, actor);
    const review = await tx.communityReview.findUnique({ where: { id: reviewId } });
    if (!review || review.status !== "ACTIVE" || review.deletedAt)
      fail("COMMUNITY_SUBJECT_UNAVAILABLE", "This review cannot receive votes.");
    const listing = await tx.communityListing.findUnique({
      where: { id: review.listingId },
      include: { owner: { select: { accountId: true } } },
    });
    if (!listing) fail("COMMUNITY_SUBJECT_UNAVAILABLE", "This review cannot receive votes.");
    if (review.authorAccountId === actor.accountId)
      fail("COMMUNITY_SELF_HELPFUL_VOTE", "You cannot vote on your own review.");
    await assertNotBlocked(tx, actor.accountId, review.authorAccountId);
    await assertNotBlocked(tx, actor.accountId, listing.owner.accountId);
    return createUnique(
      tx,
      tx.communityReviewHelpfulVote,
      { reviewId_accountId: { reviewId, accountId: actor.accountId } },
      { reviewId, accountId: actor.accountId },
    );
  });
}
export async function removeReviewHelpfulVote(actor: CommunityActor, reviewId: string): Promise<IdempotentOutcome> {
  socialRate(actor, "helpful-unvote", 30);
  return socialDb.$transaction(async (tx) =>
    removeUnique(tx, tx.communityReviewHelpfulVote, { reviewId_accountId: { reviewId, accountId: actor.accountId } }),
  );
}
export async function helpfulVoteCount(reviewId: string) {
  return socialDb.communityReviewHelpfulVote.count({ where: { reviewId } });
}

export async function listPublicReviews(listingId: string) {
  const listing = await socialDb.communityListing.findFirst({
    where: {
      id: listingId,
      publicationStatus: "PUBLISHED",
      moderationStatus: "ACTIVE",
      visibility: { in: ["COMMUNITY", "FEATURED"] },
    },
    select: { id: true },
  });
  if (!listing) return [];
  const reviews = await socialDb.communityReview.findMany({
    where: { listingId, status: "ACTIVE", deletedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
  });
  const responses: Awaited<ReturnType<typeof socialDb.communityCreatorResponse.findMany>> = reviews.length
    ? await socialDb.communityCreatorResponse.findMany({
        where: { reviewId: { in: reviews.map((review) => review.id) } },
      })
    : [];
  const responseByReviewId = new Map(responses.map((response) => [response.reviewId, response]));
  return Promise.all(
    reviews.map(async (review) => ({
      ...publicReviewProjection(review),
      helpfulCount: await helpfulVoteCount(review.id),
      creatorResponse: responseByReviewId.has(review.id)
        ? publicCreatorResponseProjection(responseByReviewId.get(review.id)!)
        : null,
    })),
  );
}

export function validateCommentBody(body: string) {
  const safe = boundedText(body, "Comment", 1, 5_000);
  if (/(?:javascript|data)\s*:/iu.test(safe) || /\bon[a-z]+\s*=/iu.test(safe))
    fail("COMMUNITY_UNSAFE_TEXT", "Comment cannot contain executable URLs or event handlers.");
  return safe;
}
export async function createComment(
  actor: CommunityActor,
  input: {
    subjectType: "LISTING" | "VOYAGE_LOG" | "GUIDE";
    subjectId: string;
    body: string;
    spoilerBody?: string | null;
    parentCommentId?: string;
    idempotencyKey: string;
  },
): Promise<IdempotentOutcome<unknown>> {
  socialRate(actor, "comment", 30);
  if (!isCommentSubjectType(input.subjectType))
    fail("COMMUNITY_INVALID_COMMENT_SUBJECT", "This subject does not accept comments.");
  const id = commentId(actor, input.idempotencyKey);
  const body = validateCommentBody(input.body);
  const spoilerBody =
    input.spoilerBody == null ? null : boundedText(input.spoilerBody, "Comment spoiler", 0, 5_000, true) || null;
  return socialDb.$transaction(async (tx) => {
    const profile = await activeProfile(tx, actor);
    const existing = await tx.communityComment.findUnique({ where: { id } });
    if (existing) return { state: "EXISTING" as const, value: publicCommentProjection(existing) };
    const subject = await resolveSubject(tx, input.subjectType, input.subjectId);
    if (!subject.public || !subject.commentsEnabled)
      fail("COMMUNITY_COMMENTS_DISABLED", "Comments are unavailable for this subject.");
    await assertNotBlocked(tx, actor.accountId, subject.ownerAccountId);
    let depth = 0;
    if (input.parentCommentId) {
      const parent = await tx.communityComment.findUnique({ where: { id: input.parentCommentId } });
      if (!parent || parent.subjectType !== input.subjectType || parent.subjectId !== input.subjectId)
        fail("COMMUNITY_INVALID_COMMENT_PARENT", "Replies must belong to the same subject.");
      if (parent.deletedAt || parent.status !== "ACTIVE")
        fail("COMMUNITY_INVALID_COMMENT_PARENT", "Replies require an active parent comment.");
      await assertNotBlocked(tx, actor.accountId, parent.authorAccountId);
      depth = parent.depth + 1;
    }
    if (depth > MAX_COMMENT_DEPTH)
      fail("COMMUNITY_COMMENT_DEPTH", `Replies are limited to depth ${MAX_COMMENT_DEPTH}.`);
    const comment = await tx.communityComment.create({
      data: {
        id,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        authorAccountId: actor.accountId,
        authorDisplayName: profile.displayName,
        authorHandle: profile.handle,
        parentCommentId: input.parentCommentId ?? null,
        depth,
        body,
        spoilerBody,
        spoilerLevel: spoilerBody ? "SPOILER" : "NONE",
      },
    });
    return { state: "CREATED" as const, value: publicCommentProjection(comment) };
  });
}
export function publicCommentProjection(comment: PublicCommentRecord) {
  return {
    id: comment.id,
    subjectType: comment.subjectType,
    subjectId: comment.subjectId,
    parentCommentId: comment.parentCommentId,
    depth: comment.depth,
    author: comment.authorDisplayName
      ? { displayName: comment.authorDisplayName, ...(comment.authorHandle ? { handle: comment.authorHandle } : {}) }
      : null,
    body: comment.deletedAt || comment.status !== "ACTIVE" ? null : comment.body,
    hasSpoiler: Boolean(!comment.deletedAt && comment.status === "ACTIVE" && comment.spoilerBody),
    spoilerLevel: comment.spoilerLevel,
    editedAt: comment.editedAt,
    deletedAt: comment.deletedAt,
    createdAt: comment.createdAt,
  };
}
export async function revealCommentSpoiler(commentIdValue: string) {
  const comment = await socialDb.communityComment.findUnique({ where: { id: commentIdValue } });
  if (!comment || comment.status !== "ACTIVE" || comment.deletedAt || !comment.spoilerBody)
    fail("COMMUNITY_SPOILER_UNAVAILABLE", "This spoiler section is unavailable.");
  const subject = await socialDb.$transaction((tx) =>
    resolveSubject(tx, comment.subjectType as SocialSubjectType, comment.subjectId),
  );
  if (!subject.public) fail("COMMUNITY_SPOILER_UNAVAILABLE", "This spoiler section is unavailable.");
  return { spoilerBody: comment.spoilerBody };
}
export async function updateComment(
  actor: CommunityActor,
  commentIdValue: string,
  body: string,
  spoilerBody?: string | null,
): Promise<IdempotentOutcome<unknown>> {
  socialRate(actor, "comment-update", 30);
  return socialDb.$transaction(async (tx) => {
    const comment = await tx.communityComment.findUnique({ where: { id: commentIdValue } });
    if (!comment || comment.authorAccountId !== actor.accountId || comment.deletedAt)
      fail("COMMUNITY_ACCESS_DENIED", "You cannot edit this comment.");
    const updated = await tx.communityComment.update({
      where: { id: comment.id },
      data: {
        body: validateCommentBody(body),
        spoilerBody: spoilerBody == null ? null : boundedText(spoilerBody, "Comment spoiler", 0, 5_000, true) || null,
        spoilerLevel: spoilerBody ? "SPOILER" : "NONE",
        editedAt: new Date(),
      },
    });
    return { state: "UPDATED" as const, value: publicCommentProjection(updated) };
  });
}
export async function deleteComment(actor: CommunityActor, commentIdValue: string): Promise<IdempotentOutcome> {
  socialRate(actor, "comment-delete", 30);
  return socialDb.$transaction(async (tx) => {
    const comment = await tx.communityComment.findUnique({ where: { id: commentIdValue } });
    if (!comment || comment.authorAccountId !== actor.accountId)
      fail("COMMUNITY_ACCESS_DENIED", "You cannot delete this comment.");
    if (comment.deletedAt) return { state: "ABSENT" as const };
    await tx.communityComment.update({ where: { id: comment.id }, data: { status: "REMOVED", deletedAt: new Date() } });
    return { state: "REMOVED" as const };
  });
}

export async function listPublicComments(subjectType: (typeof COMMENT_SUBJECT_TYPES)[number], subjectId: string) {
  if (!isCommentSubjectType(subjectType)) return [];
  const subject = await socialDb.$transaction((tx) => resolveSubject(tx, subjectType, subjectId));
  if (!subject.public || !subject.commentsEnabled) return [];
  const comments = await socialDb.communityComment.findMany({
    where: { subjectType, subjectId, status: "ACTIVE", deletedAt: null },
    orderBy: [{ depth: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    take: 200,
  });
  return comments.map(publicCommentProjection);
}

async function resolveReportSubject(tx: SocialTransaction, subjectType: string, subjectId: string) {
  if (!isReportSubjectType(subjectType)) return null;
  if (subjectType === "REVIEW") {
    const review = await tx.communityReview.findUnique({ where: { id: subjectId } });
    if (!review || review.status !== "ACTIVE" || review.deletedAt) return null;
    const listing = await resolveSubject(tx, "LISTING", review.listingId);
    return listing.public ? { ownerAccountId: listing.ownerAccountId } : null;
  }
  if (subjectType === "COMMENT") {
    const comment = await tx.communityComment.findUnique({ where: { id: subjectId } });
    if (!comment || comment.status !== "ACTIVE" || comment.deletedAt || !isCommentSubjectType(comment.subjectType))
      return null;
    const parent = await resolveSubject(tx, comment.subjectType, comment.subjectId);
    return parent.public ? { ownerAccountId: comment.authorAccountId } : null;
  }
  const subject = await resolveSubject(tx, subjectType, subjectId);
  return subject.public ? subject : null;
}

export async function respondToReview(
  actor: CommunityActor,
  reviewId: string,
  input: string | { body: string; spoilerBody?: string | null },
): Promise<IdempotentOutcome<unknown>> {
  socialRate(actor, "creator-response", 15);
  const body = typeof input === "string" ? input : input.body;
  const spoilerBody = typeof input === "string" ? null : (input.spoilerBody ?? null);
  const safeBody = boundedText(body, "Creator response", 1, 5_000);
  const safeSpoilerBody =
    spoilerBody == null ? null : boundedText(spoilerBody, "Creator response spoiler", 0, 5_000, true) || null;
  return socialDb.$transaction(async (tx) => {
    const profile = await activeProfile(tx, actor);
    const review = await tx.communityReview.findUnique({ where: { id: reviewId } });
    const listing = review ? await tx.communityListing.findUnique({ where: { id: review.listingId } }) : null;
    if (!review || !listing || review.status !== "ACTIVE" || review.deletedAt || listing.ownerProfileId !== profile.id)
      fail("COMMUNITY_ACCESS_DENIED", "You cannot respond to this review.");
    await assertNotBlocked(tx, actor.accountId, review.authorAccountId);
    const existing = await tx.communityCreatorResponse.findUnique({ where: { reviewId } });
    const response = existing
      ? await tx.communityCreatorResponse.update({
          where: { reviewId },
          data: {
            body: safeBody,
            spoilerBody: safeSpoilerBody,
            spoilerLevel: safeSpoilerBody ? "SPOILER" : "NONE",
            creatorDisplayName: profile.displayName,
            creatorHandle: profile.handle,
            deletedAt: null,
            editedAt: new Date(),
          },
        })
      : await tx.communityCreatorResponse.create({
          data: {
            reviewId,
            creatorAccountId: actor.accountId,
            creatorDisplayName: profile.displayName,
            creatorHandle: profile.handle,
            body: safeBody,
            spoilerBody: safeSpoilerBody,
            spoilerLevel: safeSpoilerBody ? "SPOILER" : "NONE",
          },
        });
    return {
      state: existing ? ("UPDATED" as const) : ("CREATED" as const),
      value: publicCreatorResponseProjection(response),
    };
  });
}
export function publicCreatorResponseProjection(response: PublicCreatorResponseRecord) {
  return {
    id: response.id,
    reviewId: response.reviewId,
    creator: response.creatorDisplayName
      ? {
          displayName: response.creatorDisplayName,
          ...(response.creatorHandle ? { handle: response.creatorHandle } : {}),
        }
      : null,
    body: response.deletedAt ? null : response.body,
    hasSpoiler: Boolean(!response.deletedAt && response.spoilerBody),
    editedAt: response.editedAt,
    deletedAt: response.deletedAt,
    createdAt: response.createdAt,
  };
}

export async function deleteCreatorResponse(actor: CommunityActor, reviewId: string): Promise<IdempotentOutcome> {
  socialRate(actor, "creator-response-delete", 15);
  return socialDb.$transaction(async (tx) => {
    const profile = await activeProfile(tx, actor);
    const review = await tx.communityReview.findUnique({ where: { id: reviewId } });
    const listing = review ? await tx.communityListing.findUnique({ where: { id: review.listingId } }) : null;
    const response = await tx.communityCreatorResponse.findUnique({ where: { reviewId } });
    if (!listing || listing.ownerProfileId !== profile.id || !response)
      fail("COMMUNITY_ACCESS_DENIED", "You cannot delete this Creator response.");
    if (response.deletedAt) return { state: "ABSENT" as const };
    await tx.communityCreatorResponse.update({ where: { id: response.id }, data: { deletedAt: new Date() } });
    return { state: "REMOVED" as const };
  });
}

export async function revealCreatorResponseSpoiler(reviewId: string) {
  const response = await socialDb.communityCreatorResponse.findUnique({ where: { reviewId } });
  const review = response ? await socialDb.communityReview.findUnique({ where: { id: response.reviewId } }) : null;
  if (!response || !review || response.deletedAt || !response.spoilerBody)
    fail("COMMUNITY_SPOILER_UNAVAILABLE", "This spoiler section is unavailable.");
  const listing = await socialDb.communityListing.findUnique({ where: { id: review.listingId } });
  if (!listing || listing.publicationStatus !== "PUBLISHED" || !["COMMUNITY", "FEATURED"].includes(listing.visibility))
    fail("COMMUNITY_SPOILER_UNAVAILABLE", "This spoiler section is unavailable.");
  return { spoilerBody: response.spoilerBody };
}

export async function createReport(
  actor: CommunityActor,
  input: { subjectType: string; subjectId: string; reason: string; detail?: string; idempotencyKey?: string },
): Promise<IdempotentOutcome<unknown>> {
  socialRate(actor, "report", 20);
  const reason = boundedText(input.reason, "Report reason", 2, 120);
  const detail = input.detail === undefined ? null : boundedText(input.detail, "Report detail", 0, 2_000, true) || null;
  const id = reportId(actor, input.idempotencyKey);
  return socialDb.$transaction(async (tx) => {
    await activeProfile(tx, actor);
    const subject = await resolveReportSubject(tx, input.subjectType, input.subjectId);
    // This uniform result intentionally does not distinguish a missing,
    // private, blocked, or unauthorized report target.
    if (!subject) fail("COMMUNITY_REPORT_SUBJECT_UNAVAILABLE", "This report target is unavailable.");
    await assertNotBlocked(tx, actor.accountId, subject.ownerAccountId);
    if (id) {
      const existing = await tx.communityReport.findUnique({ where: { id } });
      if (existing) return { state: "EXISTING" as const, value: reportProjection(existing) };
    }
    const report = await tx.communityReport.create({
      data: {
        ...(id ? { id } : {}),
        subjectType: requiredId(input.subjectType, "Report subject type"),
        subjectId: requiredId(input.subjectId, "Report subject"),
        reporterAccountId: actor.accountId,
        reason,
        detail,
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      },
    });
    await attachReportToModerationCase(tx, report);
    const receipt = await tx.communityReport.findUniqueOrThrow({ where: { id: report.id } });
    return { state: "CREATED" as const, value: moderationPublicReceipt(receipt) };
  });
}
export function reportProjection(report: CommunityReport) {
  // Reporters can see receipt status, never moderation notes or another reporter.
  return {
    id: report.id,
    subjectType: report.subjectType,
    subjectId: report.subjectId,
    reason: report.reason,
    status: report.status,
    createdAt: report.createdAt,
  };
}

export const socialLimits = {
  maxCollectionItems: MAX_COLLECTION_ITEMS,
  maxCommentDepth: MAX_COMMENT_DEPTH,
  reviewStatuses: REVIEW_STATUSES,
} as const;
