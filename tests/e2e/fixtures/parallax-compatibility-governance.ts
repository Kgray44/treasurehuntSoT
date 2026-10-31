import type { PrismaClient } from "@prisma/client";
import { resolvePublicProfileProjection } from "../../../src/community/public-profile";
import { ensureGenericSoundingLineIsolation } from "./sounding-line-isolation";

/** Synthetic attached target for preview/authorization tests; grants no approval. */
export async function prepareParallaxModerationFixture(store: PrismaClient, ownerAccountId: string, prefix: string) {
  ensureGenericSoundingLineIsolation();
  const owner = await resolvePublicProfileProjection(store, ownerAccountId);
  const listingId = `${prefix}-listing`;
  const caseId = `${prefix}-case`;
  const caseKey = `${prefix.toUpperCase()}-CASE`;
  await store.communityListing.upsert({
    where: { id: listingId },
    create: {
      id: listingId,
      slug: listingId,
      itemType: "TEMPLATE",
      ownerProfileId: owner.id,
      title: "Synthetic moderation compatibility target",
      visibility: "PRIVATE",
      publicationStatus: "DRAFT",
      moderationStatus: "ACTIVE",
      locationClass: "FICTIONAL",
    },
    update: {},
  });
  await store.communityModerationCase.upsert({
    where: { id: caseId },
    create: {
      id: caseId,
      caseKey,
      status: "OPEN",
      severity: "LOW",
      priority: "LOW",
      primaryReasonCode: "OTHER",
      subjectFingerprint: prefix,
      conflictAccountId: ownerAccountId,
      correlationId: prefix,
    },
    update: {},
  });
  await store.communityModerationCaseSubject.upsert({
    where: { caseId_subjectType_subjectId: { caseId, subjectType: "LISTING", subjectId: listingId } },
    create: { caseId, subjectType: "LISTING", subjectId: listingId },
    update: {},
  });
  return { listingId, caseId, caseKey };
}
