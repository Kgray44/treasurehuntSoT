import type { PublicArtifact, PublicChapter, PublicSideQuest, PublicSnapshot } from "@/domain/story";
import { projectChapterReleaseReplay } from "@/domain/replay";
import { eventToLogEntry } from "@/domain/ships-log";
import { db } from "@/lib/db";

const readableChapterStates = new Set(["REVEALING", "ACTIVE", "SOLVED", "COMPLETE"]);
const detailedQuestStates = new Set(["DISCOVERED", "ACTIVE", "PARTIALLY_COMPLETE", "COMPLETE", "ARCHIVED"]);
const detailedArtifactStates = new Set(["DISCOVERED", "AWARDED", "INSPECTED", "CONNECTED", "ASSEMBLED"]);
const coordinateStates = new Set(["REVEALED", "ACTIVE_DESTINATION", "VISITED", "COMPLETED", "SIDE_QUEST"]);

function requirementList(raw: string): PublicSnapshot["finale"]["requirements"] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item.key === "string" && typeof item.label === "string")
      : [];
  } catch {
    return [];
  }
}

export async function buildPublicSnapshot(campaignId: string, playerAccessId?: string): Promise<PublicSnapshot> {
  const campaign = await db.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    include: {
      chapters: {
        orderBy: { ordinal: "asc" },
        include: { content: true, clues: { orderBy: { ordinal: "asc" } }, hints: { orderBy: { ordinal: "asc" } } },
      },
      artifacts: { orderBy: { displayX: "asc" }, include: { awards: true } },
      mapLocations: { orderBy: { key: "asc" } },
      mapRoutes: { orderBy: { ordinal: "asc" } },
      sideQuests: { orderBy: { key: "asc" }, include: { objectives: { orderBy: { ordinal: "asc" } } } },
      journalEntries: { where: { releasedAt: { not: null } }, orderBy: { createdAt: "asc" } },
      events: { where: { releaseAt: { lte: new Date() } }, orderBy: { sequence: "desc" }, take: 250 },
    },
  });
  const [viewed, latestChapterRelease] = await Promise.all([
    playerAccessId
      ? db.viewedContent.findMany({
          where: { playerAccessId },
          select: { contentType: true, contentKey: true },
        })
      : Promise.resolve([]),
    db.progressEvent.findFirst({
      where: {
        campaignId,
        type: "CHAPTER_RELEASED",
        releaseAt: { lte: new Date() },
      },
      orderBy: { sequence: "desc" },
      select: {
        id: true,
        type: true,
        sequence: true,
        version: true,
        payload: true,
        releaseAt: true,
      },
    }),
  ]);
  const viewedKeys = new Set(viewed.map((item) => `${item.contentType}:${item.contentKey}`));
  const isUnseen = (type: string, key: string, released: boolean) => released && !viewedKeys.has(`${type}:${key}`);

  const chapters: PublicChapter[] = campaign.chapters.map((item) => {
    const readable = readableChapterStates.has(item.state);
    const chapter: PublicChapter = {
      ordinal: item.ordinal,
      state: item.state as PublicChapter["state"],
      ...(item.safeTeaser ? { teaser: item.safeTeaser } : {}),
      unseen: isUnseen("chapter", String(item.ordinal), readable),
    };
    if (!readable) return chapter;
    const annotations = campaign.journalEntries
      .filter((entry) => entry.chapterOrdinal === item.ordinal)
      .map((entry) => ({
        key: entry.id,
        title: entry.title,
        body: entry.body,
        createdAt: entry.createdAt.toISOString(),
        unseen: isUnseen("annotation", entry.id, true),
      }));
    return {
      ...chapter,
      title: item.content.title,
      narrative: item.content.narrative,
      objective: item.content.objective,
      riddle: item.clues[0]?.body,
      hints: item.hints
        .filter((hint) => hint.releasedAt)
        .map((hint) => ({
          ordinal: hint.ordinal,
          body: hint.body,
          releasedAt: hint.releasedAt!.toISOString(),
          unseen: isUnseen("hint", hint.id, true),
        })),
      annotations,
      related: {
        ...(item.relatedMapKey ? { mapKey: item.relatedMapKey } : {}),
        ...(item.relatedArtifactKey ? { artifactKey: item.relatedArtifactKey } : {}),
        ...(item.relatedSideQuestKey ? { sideQuestKey: item.relatedSideQuestKey } : {}),
      },
    };
  });
  const chapter =
    [...chapters].reverse().find((item) => ["REVEALING", "ACTIVE", "SOLVED"].includes(item.state)) ??
    chapters.find((item) => item.state !== "LOCKED") ??
    chapters[0];

  const artifacts: PublicArtifact[] = campaign.artifacts.map((item) => {
    const state = item.awards.length
      ? item.state === "UNKNOWN" || item.state === "SILHOUETTE"
        ? "AWARDED"
        : item.state
      : item.state;
    const detailed = detailedArtifactStates.has(state);
    return {
      key: item.key,
      state,
      displayX: item.displayX,
      displayY: item.displayY,
      ...(item.assemblyGroup
        ? { assemblyGroup: item.assemblyGroup, assemblyPosition: item.assemblyPosition ?? undefined }
        : {}),
      ...(state === "SILHOUETTE"
        ? { safeName: item.safeName ?? undefined, silhouetteLabel: item.silhouetteLabel ?? "Unidentified relic" }
        : {}),
      ...(detailed
        ? {
            name: item.name,
            category: item.category,
            description: item.description,
            discoveryText: item.discoveryText ?? undefined,
            connectedArtifactKey: item.connectedArtifactKey ?? undefined,
            chapterOrdinal: item.chapterOrdinal ?? undefined,
            awardedAt: item.awards[0]?.awardedAt.toISOString(),
          }
        : {}),
      unseen: isUnseen("artifact", item.key, state !== "UNKNOWN"),
    };
  });

  const mapLocations = campaign.mapLocations
    .filter((item) => item.state !== "UNKNOWN")
    .map((item) => {
      const exact = coordinateStates.has(item.state) && Boolean(item.revealedAt);
      return {
        key: item.key,
        state: item.state,
        label: exact ? item.name : (item.safeLabel ?? "A place beyond the fog"),
        name: exact ? item.name : (item.safeLabel ?? "A place beyond the fog"),
        ...(exact
          ? {
              regionLabel: item.regionLabel,
              locationType: item.locationType,
              description: item.description ?? undefined,
              exactness: item.exactness,
              x: item.x,
              y: item.y,
              mobileX: item.mobileX ?? undefined,
              mobileY: item.mobileY ?? undefined,
              chapterOrdinal: item.chapterOrdinal ?? undefined,
              sideQuestKey: item.sideQuestKey ?? undefined,
            }
          : {}),
        unseen: isUnseen("map", item.key, Boolean(item.revealedAt)),
      };
    });
  const visibleLocationKeys = new Set(mapLocations.filter((item) => item.x !== undefined).map((item) => item.key));
  const mapRoutes = campaign.mapRoutes
    .filter(
      (route) =>
        route.state !== "HIDDEN" &&
        route.revealedAt &&
        visibleLocationKeys.has(route.fromKey) &&
        visibleLocationKeys.has(route.toKey),
    )
    .map((route) => ({
      key: route.key,
      fromKey: route.fromKey,
      toKey: route.toKey,
      ordinal: route.ordinal,
      state: route.state,
      ...(route.annotation ? { annotation: route.annotation } : {}),
      unseen: isUnseen("route", route.key, true),
    }));

  const sideQuests: PublicSideQuest[] = campaign.sideQuests
    .filter((item) => item.state !== "HIDDEN")
    .map((item) => {
      const detailed = detailedQuestStates.has(item.state);
      return {
        key: item.key,
        state: item.state,
        ...(item.safeTeaser ? { teaser: item.safeTeaser } : {}),
        ...(detailed
          ? {
              title: item.title,
              description: item.description ?? undefined,
              objectives: item.objectives.map(({ ordinal, body, complete }) => ({ ordinal, body, complete })),
              reward: item.rewardType ? { type: item.rewardType, label: item.rewardLabel ?? undefined } : undefined,
              completionSummary: item.state === "COMPLETE" ? (item.completionSummary ?? undefined) : undefined,
              chapterOrdinal: item.chapterOrdinal ?? undefined,
              mapLocationKey: item.mapLocationKey ?? undefined,
              artifactKey: item.artifactKey ?? undefined,
            }
          : {}),
        unseen: isUnseen("quest", item.key, item.state !== "RUMORED"),
      };
    });

  const log = campaign.events
    .map((event) => eventToLogEntry(event, isUnseen("log", event.id, true)))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const finaleReleased = campaign.finaleState !== "HIDDEN";
  const finale = {
    state: campaign.finaleState,
    ...(finaleReleased && campaign.finaleTeaser ? { teaser: campaign.finaleTeaser } : {}),
    requirements: finaleReleased ? requirementList(campaign.finaleRequirements) : [],
    unseen: isUnseen("finale", campaign.finaleState, finaleReleased),
  };
  const unseen = {
    journal:
      chapters.filter((item) => item.unseen).length +
      chapters.flatMap((item) => item.hints ?? []).filter((item) => item.unseen).length,
    chart: mapLocations.filter((item) => item.unseen).length + mapRoutes.filter((item) => item.unseen).length,
    treasures: artifacts.filter((item) => item.unseen).length,
    quests: sideQuests.filter((item) => item.unseen).length,
    log: log.filter((item) => item.unseen).length,
    finale: finale.unseen ? 1 : 0,
  };
  const replayProjection = latestChapterRelease ? projectChapterReleaseReplay(latestChapterRelease, chapters) : null;
  return {
    campaign: { slug: campaign.slug, title: campaign.title, status: campaign.status },
    sequence: campaign.currentSequence,
    chapter,
    chapters,
    artifacts,
    mapLocations,
    mapRoutes,
    sideQuests,
    sideQuest: sideQuests.find((item) => item.title)
      ? { title: sideQuests.find((item) => item.title)!.title!, state: sideQuests.find((item) => item.title)!.state }
      : null,
    log,
    finale,
    unseen,
    ...(replayProjection && replayProjection.status !== "unavailable"
      ? { latestChapterReleasePresentation: replayProjection.presentation }
      : {}),
  };
}
