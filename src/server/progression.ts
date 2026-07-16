import type { Prisma } from "@prisma/client";
import { canTransition, type ClientProgressEvent, type ChapterState, type ProgressEventType } from "@/domain/story";
import { db } from "@/lib/db";
import { publishCampaignEvent } from "@/lib/events";
import { buildPublicSnapshot } from "@/lib/snapshot";
import { toClientEvent } from "@/domain/visibility";

type Action =
  | "PREPARE_CHAPTER"
  | "RELEASE_CHAPTER"
  | "MARK_SOLVED"
  | "AWARD_ARTIFACT"
  | "REVEAL_MAP"
  | "REVEAL_ROUTE"
  | "REVEAL_ARTIFACT_SILHOUETTE"
  | "CONNECT_ARTIFACTS"
  | "DISCOVER_SIDE_QUEST"
  | "UPDATE_SIDE_QUEST"
  | "COMPLETE_SIDE_QUEST"
  | "ADD_JOURNAL_ANNOTATION"
  | "ADD_LOG_ENTRY"
  | "TEASE_FINALE"
  | "UPDATE_FINALE_REQUIREMENT"
  | "UNDO_LAST"
  | "PAUSE"
  | "RESUME";

async function saveBefore(tx: Prisma.TransactionClient, campaignId: string, reason: string) {
  const campaign = await tx.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    include: {
      chapters: true,
      awards: true,
      artifacts: true,
      mapLocations: true,
      mapRoutes: true,
      sideQuests: { include: { objectives: true } },
      journalEntries: true,
    },
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
        routes: campaign.mapRoutes.map(({ id, state, revealedAt }) => ({ id, state, revealedAt })),
        artifacts: campaign.artifacts.map(({ id, state, connectedArtifactKey }) => ({
          id,
          state,
          connectedArtifactKey,
        })),
        quests: campaign.sideQuests.map(({ id, state, completedAt, objectives }) => ({
          id,
          state,
          completedAt,
          objectives: objectives.map(({ id, complete }) => ({ id, complete })),
        })),
        journalEntryIds: campaign.journalEntries.map(({ id }) => id),
        finaleState: campaign.finaleState,
        finaleTeaser: campaign.finaleTeaser,
        finaleRequirements: campaign.finaleRequirements,
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

export async function executeProgressionAction(
  slug: string,
  action: Action,
  userId: string,
  options: { targetKey?: string; value?: string } = {},
) {
  const result = await db.$transaction(async (tx) => {
    const campaign = await tx.campaign.findUniqueOrThrow({
      where: { slug },
      include: {
        chapters: { orderBy: { ordinal: "asc" }, include: { content: true, clues: true } },
        artifacts: true,
        mapLocations: true,
        mapRoutes: { orderBy: { ordinal: "asc" } },
        sideQuests: { include: { objectives: { orderBy: { ordinal: "asc" } } } },
      },
    });
    const chapter =
      action === "PREPARE_CHAPTER"
        ? (campaign.chapters.find((item) => ["LOCKED", "TEASER"].includes(item.state)) ?? campaign.chapters[0])
        : action === "RELEASE_CHAPTER"
          ? (campaign.chapters.find((item) => item.state === "READY") ?? campaign.chapters[0])
          : action === "MARK_SOLVED"
            ? (campaign.chapters.find((item) => item.state === "ACTIVE") ?? campaign.chapters[0])
            : ([...campaign.chapters].reverse().find((item) => ["ACTIVE", "SOLVED", "COMPLETE"].includes(item.state)) ??
              campaign.chapters[0]);
    let type: ProgressEventType;
    let payload: Record<string, unknown> = {};
    let reversesEventId: string | undefined;

    if (campaign.status === "PAUSED" && !["RESUME", "UNDO_LAST"].includes(action))
      throw new Error("The campaign is paused. Resume it before releasing progression.");

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
        routes: Array<{ id: string; state: string; revealedAt: string | null }>;
        artifacts: Array<{ id: string; state: string; connectedArtifactKey: string | null }>;
        quests: Array<{
          id: string;
          state: string;
          completedAt: string | null;
          objectives: Array<{ id: string; complete: boolean }>;
        }>;
        journalEntryIds: string[];
        finaleState: string;
        finaleTeaser: string | null;
        finaleRequirements: string;
      };
      await tx.campaign.update({ where: { id: campaign.id }, data: { status: state.status } });
      await tx.campaign.update({
        where: { id: campaign.id },
        data: {
          finaleState: state.finaleState,
          finaleTeaser: state.finaleTeaser,
          finaleRequirements: state.finaleRequirements,
        },
      });
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
      for (const item of state.routes)
        await tx.mapRoute.update({ where: { id: item.id }, data: { state: item.state, revealedAt: item.revealedAt } });
      for (const item of state.artifacts)
        await tx.artifact.update({
          where: { id: item.id },
          data: { state: item.state, connectedArtifactKey: item.connectedArtifactKey },
        });
      for (const item of state.quests) {
        await tx.sideQuest.update({
          where: { id: item.id },
          data: { state: item.state, completedAt: item.completedAt },
        });
        for (const objective of item.objectives)
          await tx.sideQuestObjective.update({ where: { id: objective.id }, data: { complete: objective.complete } });
      }
      await tx.journalEntry.deleteMany({
        where: {
          campaignId: campaign.id,
          id: { notIn: state.journalEntryIds.length ? state.journalEntryIds : ["__none__"] },
        },
      });
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
        const location =
          campaign.mapLocations.find((item) => item.key === options.targetKey) ??
          campaign.mapLocations.find((item) => !item.revealedAt);
        if (!location) throw new Error("No map location is configured.");
        if (location.revealedAt) throw new Error("This map location has already been revealed.");
        await tx.mapLocation.update({
          where: { id: location.id },
          data: { revealedAt: new Date(), state: "REVEALED" },
        });
        type = "MAP_LOCATION_REVEALED";
        payload = {
          key: location.key,
          name: location.name,
          regionLabel: location.regionLabel,
          x: location.x,
          y: location.y,
        };
      } else if (action === "REVEAL_ROUTE") {
        const route =
          campaign.mapRoutes.find((item) => item.key === options.targetKey) ??
          campaign.mapRoutes.find((item) => item.state === "HIDDEN");
        if (!route) throw new Error("No hidden route segment remains.");
        await tx.mapRoute.update({ where: { id: route.id }, data: { state: "REVEALED", revealedAt: new Date() } });
        type = "MAP_ROUTE_REVEALED";
        payload = { key: route.key, fromKey: route.fromKey, toKey: route.toKey };
      } else if (action === "REVEAL_ARTIFACT_SILHOUETTE") {
        const artifact =
          campaign.artifacts.find((item) => item.key === options.targetKey) ??
          campaign.artifacts.find((item) => item.state === "UNKNOWN");
        if (!artifact) throw new Error("No unknown artifact remains.");
        await tx.artifact.update({ where: { id: artifact.id }, data: { state: "SILHOUETTE" } });
        type = "ARTIFACT_SILHOUETTE_REVEALED";
        payload = { key: artifact.key, safeName: artifact.safeName, silhouetteLabel: artifact.silhouetteLabel };
      } else if (action === "CONNECT_ARTIFACTS") {
        const artifact =
          campaign.artifacts.find((item) => item.key === options.targetKey) ??
          campaign.artifacts.find((item) => item.connectedArtifactKey && item.state !== "CONNECTED");
        if (!artifact?.connectedArtifactKey) throw new Error("No safe development artifact connection is configured.");
        await tx.artifact.updateMany({
          where: { campaignId: campaign.id, key: { in: [artifact.key, artifact.connectedArtifactKey] } },
          data: { state: "CONNECTED" },
        });
        type = "ARTIFACT_CONNECTED";
        payload = { key: artifact.key, connectedArtifactKey: artifact.connectedArtifactKey };
      } else if (action === "DISCOVER_SIDE_QUEST") {
        const quest =
          campaign.sideQuests.find((item) => item.key === options.targetKey) ??
          campaign.sideQuests.find((item) => ["HIDDEN", "RUMORED"].includes(item.state));
        if (!quest) throw new Error("No undiscovered side quest remains.");
        await tx.sideQuest.update({ where: { id: quest.id }, data: { state: "DISCOVERED" } });
        type = "SIDE_QUEST_DISCOVERED";
        payload = { key: quest.key, title: quest.title };
      } else if (action === "UPDATE_SIDE_QUEST") {
        const quest =
          campaign.sideQuests.find((item) => item.key === options.targetKey) ??
          campaign.sideQuests.find((item) => ["DISCOVERED", "ACTIVE", "PARTIALLY_COMPLETE"].includes(item.state));
        if (!quest) throw new Error("No active side quest can be updated.");
        const objective = quest.objectives.find((item) => !item.complete);
        if (objective) await tx.sideQuestObjective.update({ where: { id: objective.id }, data: { complete: true } });
        await tx.sideQuest.update({ where: { id: quest.id }, data: { state: "ACTIVE" } });
        type = "SIDE_QUEST_UPDATED";
        payload = { key: quest.key, objectiveOrdinal: objective?.ordinal };
      } else if (action === "COMPLETE_SIDE_QUEST") {
        const quest =
          campaign.sideQuests.find((item) => item.key === options.targetKey) ??
          campaign.sideQuests.find((item) => ["DISCOVERED", "ACTIVE", "PARTIALLY_COMPLETE"].includes(item.state));
        if (!quest) throw new Error("No active side quest can be completed.");
        await tx.sideQuestObjective.updateMany({ where: { sideQuestId: quest.id }, data: { complete: true } });
        await tx.sideQuest.update({ where: { id: quest.id }, data: { state: "COMPLETE", completedAt: new Date() } });
        type = "SIDE_QUEST_COMPLETED";
        payload = { key: quest.key, title: quest.title, rewardLabel: quest.rewardLabel };
      } else if (action === "ADD_JOURNAL_ANNOTATION") {
        const entry = await tx.journalEntry.create({
          data: {
            campaignId: campaign.id,
            title: "Development margin note",
            body: options.value ?? "A safe development observation was added beside the active clue.",
            kind: "ANNOTATION",
            chapterOrdinal: chapter.ordinal,
            releasedAt: new Date(),
          },
        });
        type = "JOURNAL_ANNOTATION_ADDED";
        payload = { key: entry.id, title: entry.title, chapterOrdinal: chapter.ordinal };
      } else if (action === "ADD_LOG_ENTRY") {
        type = "PLAYER_LOG_ENTRY_ADDED";
        payload = { key: `log-${campaign.currentSequence + 1}`, title: options.value ?? "Development captain’s note" };
      } else if (action === "TEASE_FINALE") {
        await tx.campaign.update({
          where: { id: campaign.id },
          data: {
            finaleState: "TEASED",
            finaleTeaser: "A dormant arrangement of brass rings answers from behind the final seal.",
          },
        });
        type = "FINALE_TEASED";
        payload = { state: "TEASED" };
      } else if (action === "UPDATE_FINALE_REQUIREMENT") {
        const requirements = JSON.parse(campaign.finaleRequirements) as Array<{
          key: string;
          label: string;
          current: number;
          target: number;
          optional?: boolean;
        }>;
        const target = requirements.find((item) => item.key === options.targetKey) ?? requirements[0];
        if (!target) throw new Error("No safe finale requirement is configured.");
        target.current = Math.min(target.target, target.current + 1);
        await tx.campaign.update({
          where: { id: campaign.id },
          data: { finaleState: "REQUIREMENTS_PARTIAL", finaleRequirements: JSON.stringify(requirements) },
        });
        type = "FINALE_REQUIREMENT_UPDATED";
        payload = { key: target.key };
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
  const clientEvent: ClientProgressEvent = toClientEvent(result.event);
  publishCampaignEvent(result.campaignId, clientEvent);
  return { event: clientEvent, snapshot: await buildPublicSnapshot(result.campaignId) };
}
