import type { Prisma } from "@prisma/client";
import { canTransition, type ClientProgressEvent, type ChapterState, type ProgressEventType } from "@/domain/story";
import { db } from "@/lib/db";
import { publishCampaignEvent } from "@/lib/events";
import { buildPublicSnapshot } from "@/lib/snapshot";

type Action =
  | "PREPARE_CHAPTER"
  | "RELEASE_CHAPTER"
  | "MARK_SOLVED"
  | "AWARD_ARTIFACT"
  | "REVEAL_MAP"
  | "UNDO_LAST"
  | "PAUSE"
  | "RESUME";

async function saveBefore(tx: Prisma.TransactionClient, campaignId: string, reason: string) {
  const campaign = await tx.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    include: { chapters: true, awards: true, mapLocations: true },
  });
  await tx.saveStateSnapshot.create({
    data: {
      campaignId,
      sequence: campaign.currentSequence,
      reason,
      state: JSON.stringify({
        status: campaign.status,
        chapters: campaign.chapters.map(({ id, state, revealedAt, solvedAt }) => ({ id, state, revealedAt, solvedAt })),
        awardIds: campaign.awards.map((a) => a.id),
        locations: campaign.mapLocations.map(({ id, revealedAt }) => ({ id, revealedAt })),
      }),
    },
  });
}

async function appendEvent(
  tx: Prisma.TransactionClient,
  campaignId: string,
  type: ProgressEventType,
  payload: Record<string, unknown>,
  actor: string,
  reversesEventId?: string,
) {
  const campaign = await tx.campaign.update({ where: { id: campaignId }, data: { currentSequence: { increment: 1 } } });
  return tx.progressEvent.create({
    data: {
      campaignId,
      type,
      payload: JSON.stringify(payload),
      actor,
      sequence: campaign.currentSequence,
      reversesEventId,
    },
  });
}

export async function executeProgressionAction(slug: string, action: Action, userId: string) {
  const result = await db.$transaction(async (tx) => {
    const campaign = await tx.campaign.findUniqueOrThrow({
      where: { slug },
      include: {
        chapters: { orderBy: { ordinal: "asc" }, include: { content: true, clues: true } },
        artifacts: true,
        mapLocations: true,
      },
    });
    const chapter = campaign.chapters[0];
    let type: ProgressEventType;
    let payload: Record<string, unknown> = {};
    let reversesEventId: string | undefined;

    if (action === "UNDO_LAST") {
      const saved = await tx.saveStateSnapshot.findFirst({
        where: { campaignId: campaign.id },
        orderBy: { createdAt: "desc" },
      });
      const last = await tx.progressEvent.findFirst({
        where: { campaignId: campaign.id, type: { not: "STATE_REVERTED" } },
        orderBy: { sequence: "desc" },
      });
      if (!saved || !last) throw new Error("There is no progression action to undo.");
      const state = JSON.parse(saved.state) as {
        status: string;
        chapters: Array<{ id: string; state: string; revealedAt: string | null; solvedAt: string | null }>;
        awardIds: string[];
        locations: Array<{ id: string; revealedAt: string | null }>;
      };
      await tx.campaign.update({ where: { id: campaign.id }, data: { status: state.status } });
      for (const item of state.chapters)
        await tx.chapter.update({
          where: { id: item.id },
          data: { state: item.state, revealedAt: item.revealedAt, solvedAt: item.solvedAt },
        });
      await tx.artifactAward.deleteMany({
        where: { campaignId: campaign.id, id: { notIn: state.awardIds.length ? state.awardIds : ["__none__"] } },
      });
      for (const item of state.locations)
        await tx.mapLocation.update({ where: { id: item.id }, data: { revealedAt: item.revealedAt } });
      await tx.saveStateSnapshot.delete({ where: { id: saved.id } });
      type = "STATE_REVERTED";
      payload = { reversedEventId: last.id, reversedType: last.type };
      reversesEventId = last.id;
    } else {
      await saveBefore(tx, campaign.id, action);
      if (action === "PREPARE_CHAPTER") {
        if (!canTransition(chapter.state as ChapterState, "READY"))
          throw new Error(`Chapter cannot be prepared from ${chapter.state}.`);
        await tx.chapter.update({ where: { id: chapter.id }, data: { state: "READY" } });
        type = "CHAPTER_PREPARED";
        payload = { ordinal: chapter.ordinal };
      } else if (action === "RELEASE_CHAPTER") {
        if (chapter.state !== "READY") throw new Error("Prepare the chapter before releasing it.");
        await tx.chapter.update({ where: { id: chapter.id }, data: { state: "ACTIVE", revealedAt: new Date() } });
        const location = campaign.mapLocations[0];
        if (location) await tx.mapLocation.update({ where: { id: location.id }, data: { revealedAt: new Date() } });
        type = "CHAPTER_RELEASED";
        payload = {
          ordinal: chapter.ordinal,
          title: chapter.content.title,
          narrative: chapter.content.narrative,
          objective: chapter.content.objective,
          riddle: chapter.clues[0]?.body,
          ...(location
            ? {
                mapLocation: {
                  key: location.key,
                  name: location.name,
                  regionLabel: location.regionLabel,
                  x: location.x,
                  y: location.y,
                },
              }
            : {}),
        };
      } else if (action === "MARK_SOLVED") {
        if (!canTransition(chapter.state as ChapterState, "SOLVED"))
          throw new Error("Only an active chapter can be solved.");
        await tx.chapter.update({ where: { id: chapter.id }, data: { state: "SOLVED", solvedAt: new Date() } });
        type = "CHAPTER_SOLVED";
        payload = { ordinal: chapter.ordinal };
      } else if (action === "AWARD_ARTIFACT") {
        const artifact = campaign.artifacts[0];
        if (!artifact) throw new Error("No artifact is configured.");
        const existingAward = await tx.artifactAward.findUnique({
          where: { campaignId_artifactId: { campaignId: campaign.id, artifactId: artifact.id } },
        });
        if (existingAward) throw new Error("This artifact has already been awarded.");
        await tx.artifactAward.create({ data: { campaignId: campaign.id, artifactId: artifact.id } });
        type = "ARTIFACT_AWARDED";
        payload = { key: artifact.key, name: artifact.name, description: artifact.description };
      } else if (action === "REVEAL_MAP") {
        const location = campaign.mapLocations[0];
        if (!location) throw new Error("No map location is configured.");
        if (location.revealedAt) throw new Error("This map location has already been revealed.");
        await tx.mapLocation.update({ where: { id: location.id }, data: { revealedAt: new Date() } });
        type = "MAP_LOCATION_REVEALED";
        payload = {
          key: location.key,
          name: location.name,
          regionLabel: location.regionLabel,
          x: location.x,
          y: location.y,
        };
      } else if (action === "PAUSE") {
        if (campaign.status === "PAUSED") throw new Error("Campaign is already paused.");
        await tx.campaign.update({ where: { id: campaign.id }, data: { status: "PAUSED" } });
        type = "CAMPAIGN_PAUSED";
      } else {
        if (campaign.status === "ACTIVE") throw new Error("Campaign is already underway.");
        await tx.campaign.update({ where: { id: campaign.id }, data: { status: "ACTIVE" } });
        type = "CAMPAIGN_RESUMED";
      }
    }
    const event = await appendEvent(tx, campaign.id, type, payload, userId, reversesEventId);
    await tx.campaignSnapshot.create({
      data: { campaignId: campaign.id, sequence: event.sequence, state: JSON.stringify({ eventType: type, payload }) },
    });
    await tx.adminAuditLog.create({
      data: {
        campaignId: campaign.id,
        userId,
        action,
        metadata: JSON.stringify({ eventId: event.id, sequence: event.sequence }),
      },
    });
    return { campaignId: campaign.id, event };
  });
  const clientEvent: ClientProgressEvent = {
    id: result.event.id,
    type: result.event.type as ProgressEventType,
    sequence: result.event.sequence,
    payload: JSON.parse(result.event.payload),
    releaseAt: result.event.releaseAt.toISOString(),
  };
  publishCampaignEvent(result.campaignId, clientEvent);
  return { event: clientEvent, snapshot: await buildPublicSnapshot(result.campaignId) };
}
