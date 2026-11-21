import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { CommunityError } from "./domain";
import type { CommunityModeratorActor } from "./moderation";

export const creatorPublicationDecisionSchema = z
  .strictObject({
    releaseId: z.string().min(1),
    packageChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    packageReviewed: z.literal(true),
    decision: z.enum(["APPROVE", "REJECT"]).default("APPROVE"),
    reason: z.string().trim().min(5).max(500).optional(),
  })
  .refine(({ decision, reason }) => decision === "APPROVE" || Boolean(reason), {
    path: ["reason"],
    message: "Explain why the submitted release was rejected.",
  });

export async function recordCreatorPublicationDecision(
  actor: CommunityModeratorActor,
  source: "CHRONICLE" | "CREATOR",
  listingId: string,
  input: z.output<typeof creatorPublicationDecisionSchema>,
) {
  const approved = input.decision === "APPROVE";
  const publicationStatus = approved ? "PUBLISHED" : "REJECTED";
  const publishedAt = approved ? new Date() : null;
  return db.$transaction(async (tx) => {
    const changed = await tx.communityListing.updateMany({
      where: {
        id: listingId,
        currentReleaseId: input.releaseId,
        currentRelease: { packageChecksum: input.packageChecksum, moderationStatus: "ACTIVE", deprecatedAt: null },
        owner: { moderationStatus: "ACTIVE", creatorStatus: { not: "SUSPENDED" } },
        publicationStatus: { in: ["READY_FOR_REVIEW", "IN_REVIEW", "UPDATE_PENDING"] },
        moderationStatus: "ACTIVE",
        archivedAt: null,
        removedAt: null,
      },
      data: { publicationStatus, publishedAt },
    });
    if (changed.count !== 1)
      throw new CommunityError("COMMUNITY_REVIEW_STALE", "The submission changed before the decision was recorded.");
    if (publishedAt) {
      await tx.communityRelease.update({ where: { id: input.releaseId }, data: { publishedAt } });
      await tx.communityOutboxEvent.create({
        data: {
          eventType: "COMMUNITY_RELEASE_PUBLISHED",
          aggregateType: "COMMUNITY_RELEASE",
          aggregateId: input.releaseId,
          payload: JSON.stringify({ listingId, releaseId: input.releaseId }),
          idempotencyKey: `COMMUNITY_${source}_RELEASE_PUBLISHED:${input.releaseId}`,
        },
      });
    }
    await tx.platformAuditEvent.create({
      data: {
        actorType: "USER_ACCOUNT",
        actorId: actor.accountId,
        action: `COMMUNITY_${source}_RELEASE_${approved ? "APPROVED" : "REJECTED"}`,
        resourceType: "COMMUNITY_LISTING",
        resourceId: listingId,
        correlationId: randomUUID(),
        metadata: JSON.stringify({
          releaseId: input.releaseId,
          packageChecksum: input.packageChecksum,
          reason: input.reason,
        }),
      },
    });
    return { listingId, releaseId: input.releaseId, publicationStatus };
  });
}
