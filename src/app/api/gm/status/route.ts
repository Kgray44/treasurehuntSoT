import { NextResponse } from "next/server";
import { describePresence } from "@/domain/admin";
import { db } from "@/lib/db";
import { requireGm, requireGmCapability } from "@/lib/security";
import { buildPublicSnapshot } from "@/lib/snapshot";

export async function GET() {
  const session = await requireGmCapability("CAPTAIN");
  if (!session) {
    const staff = await requireGm();
    return staff
      ? NextResponse.json({ error: "Captain authority required.", code: "FORBIDDEN" }, { status: 403 })
      : NextResponse.json({ error: "Authentication required.", code: "UNAUTHENTICATED" }, { status: 401 });
  }
  const campaign = await db.campaign.findFirstOrThrow({
    include: {
      chapters: {
        include: { content: true, hints: { orderBy: { ordinal: "asc" } }, clues: { orderBy: { ordinal: "asc" } } },
        orderBy: { ordinal: "asc" },
      },
      events: { orderBy: { sequence: "desc" }, take: 80 },
      artifacts: { include: { awards: true } },
      mapLocations: true,
      sideQuests: { include: { objectives: { orderBy: { ordinal: "asc" } } } },
      playerAccesses: true,
      playerPresences: { orderBy: { lastHeartbeatAt: "desc" } },
      preparedActions: { orderBy: { preparedAt: "desc" }, take: 40 },
      auditLogs: { include: { user: true }, orderBy: { createdAt: "desc" }, take: 80 },
      saveStates: { orderBy: { createdAt: "desc" }, take: 20 },
      journalEntries: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  const activeChapter =
    [...campaign.chapters].reverse().find((item) => item.state !== "LOCKED") ?? campaign.chapters[0];
  const fallbackPresences = campaign.playerPresences.length
    ? campaign.playerPresences
    : campaign.playerAccesses
        .filter((item) => item.lastSeenAt)
        .map((item) => ({
          lastHeartbeatAt: item.lastSeenAt!,
          disconnectedAt: null,
          acknowledgedSequence: 0,
          route: null,
        }));
  const presence = describePresence(fallbackPresences, campaign.currentSequence);
  const playerSnapshot = await buildPublicSnapshot(campaign.id);
  return NextResponse.json({
    csrfToken: session.csrfToken,
    permissions: [
      "VIEW_COMMAND_CENTER",
      "VIEW_PLAYER_PREVIEW",
      "PREPARE_PROGRESSION",
      "RELEASE_PROGRESSION",
      "REVERSE_PROGRESSION",
      "USE_EMERGENCY_CONTROLS",
      "VIEW_DIAGNOSTICS",
      "VIEW_AUDIT_LOG",
      ...(process.env.NODE_ENV !== "production" ? ["RESET_DEVELOPMENT_CAMPAIGN"] : []),
    ],
    campaign: {
      id: campaign.id,
      slug: campaign.slug,
      title: campaign.title,
      status: campaign.status,
      sequence: campaign.currentSequence,
      startedAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    },
    chapter: { ordinal: activeChapter.ordinal, state: activeChapter.state, title: activeChapter.content.title },
    chapters: campaign.chapters.map((chapter) => ({
      id: chapter.id,
      ordinal: chapter.ordinal,
      state: chapter.state,
      title: chapter.content.title,
      objective: chapter.content.objective,
      developmentOnly: chapter.content.developmentOnly,
      revealedAt: chapter.revealedAt,
      solvedAt: chapter.solvedAt,
      hints: chapter.hints.map((hint) => ({
        id: hint.id,
        ordinal: hint.ordinal,
        body: hint.body,
        releasedAt: hint.releasedAt,
      })),
    })),
    playerConnected: presence.state === "CONNECTED",
    presence,
    events: campaign.events.map((event) => ({
      id: event.id,
      type: event.type,
      sequence: event.sequence,
      actor: event.actor,
      payload: JSON.parse(event.payload) as Record<string, unknown>,
      createdAt: event.createdAt,
      reversesEventId: event.reversesEventId,
    })),
    inventory: campaign.artifacts.filter((item) => item.awards.length).map((item) => item.name),
    artifacts: campaign.artifacts.map((item) => ({ ...item, awarded: item.awards.length > 0 })),
    mapLocations: campaign.mapLocations,
    sideQuest: campaign.sideQuests[0]
      ? { title: campaign.sideQuests[0].title, state: campaign.sideQuests[0].state }
      : null,
    sideQuests: campaign.sideQuests,
    stagedActions: campaign.preparedActions.map((item) => ({ ...item, payload: JSON.parse(item.payload) })),
    journalEntries: campaign.journalEntries,
    recovery: campaign.saveStates.map((item) => ({
      id: item.id,
      sequence: item.sequence,
      reason: item.reason,
      createdAt: item.createdAt,
      reversible: item.sequence === campaign.currentSequence - 1,
    })),
    audit: campaign.auditLogs.map((item) => ({
      id: item.id,
      action: item.action,
      actor: item.user?.username ?? "system",
      outcome: item.outcome,
      reason: item.reason,
      correlationId: item.correlationId,
      metadata: JSON.parse(item.metadata) as Record<string, unknown>,
      createdAt: item.createdAt,
    })),
    preview: playerSnapshot,
    playerSnapshot,
    diagnostics: {
      database: "healthy",
      liveTransport: "SSE with database replay",
      latestCampaignSequence: campaign.currentSequence,
      latestAcknowledgedSequence: presence.acknowledgedSequence,
      lag: presence.lag,
      stalePreparedActions: campaign.preparedActions.filter(
        (item) => ["PREPARED", "SCHEDULED"].includes(item.status) && item.expectedSequence !== campaign.currentSequence,
      ).length,
    },
  });
}
