import { db } from "@/lib/db";
import type { Prisma, PrismaClient } from "@prisma/client";
import { canonicalChecksum } from "@/drydock/canonical";
import { loadReleasedSpatialMoment } from "./service";
import {
  fieldContributionSchema,
  fieldMetadataSchema,
  calibrationReviewInputSchema,
  summarizeFieldQuality,
} from "./field-contracts";
import { draftSchema, type SpatialDraft } from "./authoring";
import { validateSpatialMoment } from "./publication";

export async function purgeExpiredFieldEvidence(now = new Date()) {
  // Metadata and original feedback are deleted, rather than merely hidden after expiry.
  await db.parallaxFieldObservation.deleteMany({
    where: { OR: [{ expiresAt: { lte: now } }, { withdrawnAt: { not: null } }] },
  });
}
export async function contributeFieldObservation(sessionId: string, actorId: string, raw: unknown) {
  const input = fieldContributionSchema.parse(raw);
  const bound = await loadReleasedSpatialMoment(sessionId, actorId, input.blockId);
  const v = bound.moment.version;
  if (
    bound.replayOnly ||
    v.id !== input.versionId ||
    v.checksum !== input.versionChecksum ||
    !v.adaptive?.calibration.enabled
  )
    throw new Error("PARALLAX_FIELD_SCOPE_INVALID");
  const digest = canonicalChecksum(input),
    now = new Date();
  await purgeExpiredFieldEvidence(now);
  return db
    .$transaction(async (tx) => {
      const current = await tx.taleSession.findUnique({
        where: { id: sessionId },
        select: { status: true, currentBlockId: true, publishedVersionId: true },
      });
      const member = await tx.playthroughMembership.findFirst({
        where: {
          playthroughId: sessionId,
          playerProfileId: actorId,
          status: { in: ["ACCEPTED", "READY", "ACTIVE_MEMBER", "COMPLETED_MEMBER"] },
        },
      });
      if (
        !member ||
        current?.status !== "ACTIVE" ||
        current.currentBlockId !== input.blockId ||
        current.publishedVersionId !== bound.binding.chronicleVersionId
      )
        throw new Error("PARALLAX_FIELD_SCOPE_CHANGED");
      const key = { sessionId_actorId_idempotencyKey: { sessionId, actorId, idempotencyKey: input.idempotencyKey } };
      const prior = await tx.parallaxFieldObservation.findUnique({ where: key });
      if (prior) {
        if (prior.digest !== digest) throw new Error("PARALLAX_FIELD_IDEMPOTENCY_CONFLICT");
        return { observationId: prior.id, progressionChanged: false };
      }
      // One contribution per actor/version/run prevents inflated encounter counts.
      if (await tx.parallaxFieldObservation.findFirst({ where: { sessionId, actorId, versionId: v.id } }))
        throw new Error("PARALLAX_FIELD_ALREADY_CONTRIBUTED");
      const row = await tx.parallaxFieldObservation.create({
        data: {
          definitionId: v.definitionId,
          versionId: v.id,
          versionChecksum: v.checksum,
          sessionId,
          actorId,
          blockId: input.blockId,
          idempotencyKey: input.idempotencyKey,
          digest,
          metadata: JSON.stringify(input.metadata),
          provenance: input.metadata.provenance,
          expiresAt: new Date(now.getTime() + v.adaptive!.calibration.retentionDays * 86400000),
        },
      });
      await tx.parallaxFieldAudit.create({ data: { recordId: row.id, actorId, action: "CONSENTED_CONTRIBUTION_V1" } });
      return { observationId: row.id, progressionChanged: false };
    })
    .catch(async (error: unknown) => {
      if (!(error && typeof error === "object" && "code" in error && error.code === "P2002")) throw error;
      const prior = await db.parallaxFieldObservation.findUnique({
        where: { sessionId_actorId_idempotencyKey: { sessionId, actorId, idempotencyKey: input.idempotencyKey } },
      });
      if (!prior) throw new Error("PARALLAX_FIELD_ALREADY_CONTRIBUTED");
      if (prior.digest !== digest) throw new Error("PARALLAX_FIELD_IDEMPOTENCY_CONFLICT");
      return { observationId: prior.id, progressionChanged: false };
    });
}
export async function withdrawFieldObservation(actorId: string, observationId: string) {
  await db.$transaction(async (tx) => {
    const row = await tx.parallaxFieldObservation.findFirst({ where: { id: observationId, actorId } });
    if (!row) throw new Error("PARALLAX_FIELD_UNAVAILABLE");
    await tx.parallaxFieldObservation.delete({ where: { id: row.id } });
    await tx.parallaxFieldAudit.create({ data: { recordId: row.id, actorId, action: "WITHDRAWN_AND_DELETED" } });
  });
  return { withdrawn: true, progressionChanged: false };
}
async function ownedItem(ownerAccountId: string, definitionId: string) {
  const row = await db.reusableAuthoringItem.findFirst({
    where: { id: definitionId, ownerAccountId, kind: "PARALLAX_STUDIO", archivedAt: null },
    include: { versions: true },
  });
  if (!row) throw new Error("PARALLAX_FIELD_CREATOR_FORBIDDEN");
  return row;
}
export async function creatorFieldQuality(ownerAccountId: string, definitionId: string, draft?: SpatialDraft) {
  await ownedItem(ownerAccountId, definitionId);
  if (draft && draft.content.definitionId !== definitionId) throw new Error("PARALLAX_CALIBRATION_DEFINITION_MISMATCH");
  await purgeExpiredFieldEvidence();
  const rows = await db.parallaxFieldObservation.findMany({
    where: { definitionId, expiresAt: { gt: new Date() }, withdrawnAt: null },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  await db.parallaxFieldAudit.create({
    data: { recordId: definitionId, actorId: ownerAccountId, action: "CREATOR_REVIEW_ACCESS" },
  });
  const review = await db.parallaxCalibrationReview.findFirst({
    where: { definitionId, ownerAccountId },
    orderBy: { reviewSequence: "desc" },
  });
  return {
    quality: summarizeFieldQuality(rows.map((r) => fieldMetadataSchema.parse(JSON.parse(r.metadata)))),
    maturity:
      review?.maturity ??
      (rows.some(
        (r) =>
          r.provenance === "PLAYER_REPORTED_PHYSICAL" && fieldMetadataSchema.parse(JSON.parse(r.metadata)).resolved,
      )
        ? "OBSERVED"
        : "SEMANTIC"),
    review: review
      ? {
          id: review.id,
          revision: review.revision,
          maturity: review.maturity,
          matchesDraftRecipes: draft?.content.adaptive
            ? review.recipeDigest === canonicalChecksum(draft.content.adaptive.recipes)
            : undefined,
        }
      : null,
    observations: rows.map((r) => ({
      id: r.id,
      versionId: r.versionId,
      metadata: fieldMetadataSchema.parse(JSON.parse(r.metadata)),
    })),
  };
}
export async function reviewCalibration(ownerAccountId: string, raw: unknown, rawDraft: unknown) {
  const input = calibrationReviewInputSchema.parse(raw),
    draft = draftSchema.parse(rawDraft);
  const item = await ownedItem(ownerAccountId, input.definitionId);
  if (draft.content.definitionId !== item.id) throw new Error("PARALLAX_CALIBRATION_DEFINITION_MISMATCH");
  const released = item.versions.find((v) => v.id === input.versionId && v.versionNumber > 0);
  if (!released) throw new Error("PARALLAX_CALIBRATION_VERSION_INVALID");
  const capsule = validateSpatialMoment(JSON.parse(released.envelope));
  const a = draft.content.adaptive;
  if (!a || !capsule.version.adaptive) throw new Error("PARALLAX_CALIBRATION_RECIPE_REQUIRED");
  return db
    .$transaction(async (tx) => {
      const evidence = await tx.parallaxFieldObservation.findFirst({
        where: {
          id: input.evidenceId,
          definitionId: item.id,
          versionId: input.versionId,
          versionChecksum: capsule.version.checksum,
          provenance: "PLAYER_REPORTED_PHYSICAL",
          expiresAt: { gt: new Date() },
          withdrawnAt: null,
        },
      });
      if (!evidence) throw new Error("PARALLAX_CALIBRATION_FIELD_EVIDENCE_REQUIRED");
      const metadata = fieldMetadataSchema.parse(JSON.parse(evidence.metadata));
      if (
        !metadata.resolved ||
        !["HIGH", "ACCEPTABLE"].includes(metadata.confidence) ||
        metadata.placementQuality !== "BELIEVABLE"
      )
        throw new Error("PARALLAX_CALIBRATION_QUALITY_INSUFFICIENT");
      const prior = await tx.parallaxCalibrationReview.findFirst({
        where: { definitionId: item.id, ownerAccountId },
        orderBy: { reviewSequence: "desc" },
      });
      if ((prior?.id ?? null) !== input.expectedReviewId || (prior?.revision ?? 0) !== input.expectedRevision)
        throw new Error("PARALLAX_CALIBRATION_CONCURRENT_UPDATE");
      const order = ["CREATOR_REVIEWED", "CALIBRATED", "VERIFIED"];
      const changedRecipes = prior && prior.recipeDigest !== canonicalChecksum(a.recipes);
      if (order.indexOf(input.maturity) !== (prior && !changedRecipes ? order.indexOf(prior.maturity) + 1 : 0))
        throw new Error("PARALLAX_CALIBRATION_TRANSITION_INVALID");
      if (prior) {
        const claim = await tx.parallaxCalibrationReview.updateMany({
          where: { id: prior.id, revision: input.expectedRevision },
          data: { revision: { increment: 1 } },
        });
        if (!claim.count) throw new Error("PARALLAX_CALIBRATION_CONCURRENT_UPDATE");
      }
      if (input.maturity === "VERIFIED") {
        if (
          !prior ||
          capsule.version.adaptive?.calibration.reviewReceiptId !== prior.id ||
          canonicalChecksum(a.recipes) !== prior.recipeDigest
        )
          throw new Error("PARALLAX_CALIBRATION_REVIEWED_VERSION_REQUIRED");
        const later = await tx.parallaxFieldObservation.findMany({
          where: {
            definitionId: item.id,
            versionId: capsule.version.id,
            versionChecksum: capsule.version.checksum,
            provenance: "PLAYER_REPORTED_PHYSICAL",
            expiresAt: { gt: new Date() },
            createdAt: { gt: prior.createdAt },
            withdrawnAt: null,
          },
        });
        const valid = later.filter((r) => {
          const m = fieldMetadataSchema.parse(JSON.parse(r.metadata));
          return m.resolved && m.confidence === "HIGH" && m.placementQuality === "BELIEVABLE";
        });
        if (new Set(valid.map((r) => r.actorId)).size < 2 || new Set(valid.map((r) => r.sessionId)).size < 2)
          throw new Error("PARALLAX_CALIBRATION_INDEPENDENT_VERIFICATION_REQUIRED");
      }
      const review = await tx.parallaxCalibrationReview.create({
        data: {
          definitionId: item.id,
          versionId: capsule.version.id,
          ownerAccountId,
          evidenceId: evidence.id,
          recipeDigest: canonicalChecksum(a.recipes),
          maturity: input.maturity,
          reviewSequence: (prior?.reviewSequence ?? 0) + 1,
        },
      });
      await tx.parallaxFieldAudit.create({
        data: { recordId: review.id, actorId: ownerAccountId, action: `CALIBRATION_${input.maturity}` },
      });
      return { reviewReceiptId: review.id, maturity: input.maturity, physicalQualification: "NOT_ESTABLISHED" };
    })
    .catch((error: unknown) => {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002")
        throw new Error("PARALLAX_CALIBRATION_CONCURRENT_UPDATE");
      throw error;
    });
}
export async function assertCalibrationClaim(
  ownerAccountId: string,
  draft: SpatialDraft,
  store: PrismaClient | Prisma.TransactionClient = db,
) {
  const a = draft.content.adaptive;
  if (!a || a.calibration.maturity === "SEMANTIC") return;
  const review = await store.parallaxCalibrationReview.findFirst({
    where: {
      id: a.calibration.reviewReceiptId,
      definitionId: draft.content.definitionId,
      ownerAccountId,
      maturity: a.calibration.maturity,
      recipeDigest: canonicalChecksum(a.recipes),
    },
  });
  if (!review) throw new Error("PARALLAX_CALIBRATION_CLAIM_UNSUPPORTED");
}
