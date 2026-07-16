import type { PublicSnapshot } from "@/domain/story";
import { db } from "@/lib/db";

const visibleStates = new Set(["REVEALING", "ACTIVE", "SOLVED", "COMPLETE"]);

export async function buildPublicSnapshot(campaignId: string): Promise<PublicSnapshot> {
  const campaign = await db.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    include: {
      chapters: { orderBy: { ordinal: "asc" }, include: { content: true, clues: { orderBy: { ordinal: "asc" } } } },
      artifacts: { include: { awards: true } }, mapLocations: true, sideQuests: { take: 1 },
    },
  });
  const chapter = campaign.chapters.find((item) => item.state !== "LOCKED") ?? campaign.chapters[0];
  const canRead = visibleStates.has(chapter.state);
  return {
    campaign: { slug: campaign.slug, title: campaign.title, status: campaign.status },
    sequence: campaign.currentSequence,
    chapter: {
      ordinal: chapter.ordinal, state: chapter.state as PublicSnapshot["chapter"]["state"],
      ...(canRead ? { title: chapter.content.title, narrative: chapter.content.narrative, objective: chapter.content.objective, riddle: chapter.clues[0]?.body } : {}),
    },
    artifacts: campaign.artifacts.filter((item) => item.awards.length > 0).map(({ key, name, description }) => ({ key, name, description })),
    mapLocations: campaign.mapLocations.filter((item) => item.revealedAt).map(({ key, name, regionLabel, x, y }) => ({ key, name, regionLabel, x, y })),
    sideQuest: campaign.sideQuests[0] ? { title: campaign.sideQuests[0].title, state: campaign.sideQuests[0].state } : null,
  };
}
