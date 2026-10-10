import { db } from "@/lib/db";
import { getTaleSessionState } from "@/chronicle/progression";
import { parsePublishedSnapshot } from "@/chronicle/publishing";
import { canonicalChecksum } from "@/drydock/canonical";
import { validateSpatialMoment } from "./publication";
import { evaluateSpatialEvidence } from "./evidence";
import { receiptSchema, spatialId } from "./contracts";

/** Callers authorize Player membership first. Projection is restricted to released passages. */
export async function loadReleasedSpatialMoment(sessionId: string, actorId: string, blockId: string) {
  spatialId.parse(blockId);
  const state = await getTaleSessionState(sessionId, undefined, false, true);
  const released = state.journal?.chapters.flatMap((c) => c.blocks).find((b) => b.id === blockId);
  if (!released) throw new Error("PARALLAX_PASSAGE_NOT_RELEASED");
  const session = await db.taleSession.findUnique({
    where: { id: sessionId },
    select: {
      status: true,
      currentBlockId: true,
      previewMode: true,
      publishedVersionId: true,
      taleId: true,
      version: { select: { id: true, taleId: true, contentSnapshot: true } },
    },
  });
  if (
    !session?.version ||
    session.previewMode ||
    session.version.id !== session.publishedVersionId ||
    session.version.taleId !== session.taleId
  )
    throw new Error("PARALLAX_PUBLISHED_SESSION_REQUIRED");
  const snapshot = parsePublishedSnapshot(session.version.contentSnapshot);
  const block = snapshot.chapters.flatMap((c) => c.blocks).find((b) => b.id === blockId);
  if (!block?.presentation?.spatialMoment) throw new Error("PARALLAX_MOMENT_NOT_FOUND");
  const moment = validateSpatialMoment(block.presentation.spatialMoment, blockId);
  return {
    moment,
    binding: { sessionId, chronicleVersionId: session.version.id, blockId, actorId, runId: sessionId },
    replayOnly: session.status !== "ACTIVE" || session.currentBlockId !== blockId || released.progress !== "active",
  };
}
export async function recordSpatialObservation(sessionId: string, actorId: string, input: unknown) {
  const raw = receiptSchema.parse(input);
  const bound = await loadReleasedSpatialMoment(sessionId, actorId, raw.blockId);
  const evidence = evaluateSpatialEvidence(input, bound.moment, bound.binding, new Date());
  if (bound.replayOnly) throw new Error("PARALLAX_REPLAY_PRESENTATION_ONLY");
  const digest = canonicalChecksum(evidence.receipt);
  const key = { sessionId_actorId_idempotencyKey: { sessionId, actorId, idempotencyKey: raw.idempotencyKey } };
  return db.$transaction(async (tx) => {
    const session = await tx.taleSession.findUnique({
      where: { id: sessionId },
      select: { status: true, currentBlockId: true, publishedVersionId: true },
    });
    if (
      session?.status !== "ACTIVE" ||
      session.currentBlockId !== raw.blockId ||
      session.publishedVersionId !== raw.chronicleVersionId
    )
      throw new Error("PARALLAX_EVIDENCE_SCOPE_CHANGED");
    const membership = await tx.playthroughMembership.findFirst({
      where: {
        playthroughId: sessionId,
        playerProfileId: actorId,
        status: { in: ["ACCEPTED", "READY", "ACTIVE_MEMBER", "COMPLETED_MEMBER"] },
      },
      select: { id: true },
    });
    if (!membership) throw new Error("PARALLAX_MEMBERSHIP_CHANGED");
    const row = await tx.parallaxObservation.upsert({
      where: key,
      create: {
        sessionId,
        actorId,
        idempotencyKey: raw.idempotencyKey,
        receiptDigest: digest,
        blockId: raw.blockId,
        publishedVersionId: raw.chronicleVersionId,
        evidence: JSON.stringify(evidence.receipt),
        observedAt: new Date(raw.observedAt),
      },
      update: {},
    });
    if (row.receiptDigest !== digest) throw new Error("PARALLAX_IDEMPOTENCY_CONFLICT");
    return {
      observationId: row.id,
      disposition: evidence.disposition,
      progressionChanged: false,
      physicalQualification: evidence.physicalQualification,
    };
  });
}
