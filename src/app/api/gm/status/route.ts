import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireGm } from "@/lib/security";
import { buildPublicSnapshot } from "@/lib/snapshot";
export async function GET() {
  const session = await requireGm();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const campaign = await db.campaign.findFirstOrThrow({
    include: {
      chapters: { include: { content: true }, orderBy: { ordinal: "asc" } },
      events: { orderBy: { sequence: "desc" }, take: 8 },
      artifacts: { include: { awards: true } },
      sideQuests: true,
      playerAccesses: true,
    },
  });
  return NextResponse.json({
    csrfToken: session.csrfToken,
    campaign: {
      id: campaign.id,
      slug: campaign.slug,
      title: campaign.title,
      status: campaign.status,
      sequence: campaign.currentSequence,
    },
    chapter: {
      ordinal: campaign.chapters[0].ordinal,
      state: campaign.chapters[0].state,
      title: campaign.chapters[0].content.title,
    },
    playerConnected: campaign.playerAccesses.some(
      (item) => item.lastSeenAt && Date.now() - item.lastSeenAt.getTime() < 45000,
    ),
    events: campaign.events.map((event) => ({
      id: event.id,
      type: event.type,
      sequence: event.sequence,
      createdAt: event.createdAt,
    })),
    inventory: campaign.artifacts.filter((item) => item.awards.length).map((item) => item.name),
    sideQuest: campaign.sideQuests[0]
      ? { title: campaign.sideQuests[0].title, state: campaign.sideQuests[0].state }
      : null,
    preview: await buildPublicSnapshot(campaign.id),
  });
}
