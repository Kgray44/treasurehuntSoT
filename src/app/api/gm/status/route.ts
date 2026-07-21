import { NextResponse } from "next/server";
import { requireGm, requireGmCapability } from "@/lib/security";
import { resolveFirstMigratedLegacyCampaign } from "@/compatibility/legacy-companion";
import { getTaleSessionState } from "@/chronicle/progression";
import { db } from "@/lib/db";

/**
 * Quartermaster compatibility projection. The old response envelope remains,
 * but every value is built from the mapped Chronicle Session and Platform audit
 * trail; it deliberately performs no Campaign reads after ID resolution.
 */
export async function GET() {
  const staff = await requireGmCapability("CAPTAIN");
  if (!staff) {
    const signedIn = await requireGm();
    return signedIn
      ? NextResponse.json({ error: "Captain access is required to continue.", code: "FORBIDDEN" }, { status: 403 })
      : NextResponse.json(
          { error: "Sign in to Captain's Console to continue.", code: "UNAUTHENTICATED" },
          { status: 401 },
        );
  }
  const resolved = await resolveFirstMigratedLegacyCampaign();
  if (!resolved) return NextResponse.json({ error: "No migrated Voyage is available." }, { status: 404 });
  const [state, audit] = await Promise.all([
    getTaleSessionState(resolved.sessionId, undefined, true),
    db.platformAuditEvent.findMany({
      where: { resourceType: "CHRONICLE_SESSION", resourceId: resolved.sessionId },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
  ]);
  const currentChapter = state.chapter;
  return NextResponse.json({
    csrfToken: staff.csrfToken,
    permissions: [
      "VIEW_COMMAND_CENTER",
      "VIEW_PLAYER_PREVIEW",
      "PREPARE_PROGRESSION",
      "RELEASE_PROGRESSION",
      "REVERSE_PROGRESSION",
      "USE_EMERGENCY_CONTROLS",
      "VIEW_DIAGNOSTICS",
      "VIEW_AUDIT_LOG",
    ],
    campaign: {
      id: resolved.sessionId,
      slug: resolved.campaignSlug,
      title: state.tale.title,
      status: state.session.status,
      sequence: state.session.currentSequence,
      startedAt: state.session.startedAt,
      updatedAt: state.session.updatedAt,
    },
    chapter: currentChapter
      ? { ordinal: currentChapter.orderIndex, state: state.session.status, title: currentChapter.title }
      : null,
    chapters: state.chapters ?? [],
    playerConnected: false,
    presence: {
      state: "UNKNOWN",
      activeDevices: 0,
      lastSeenAt: null,
      acknowledgedSequence: 0,
      synchronized: false,
      lag: 0,
      route: null,
    },
    events: state.events.map((event) => ({
      ...event,
      type: event.eventType,
      actor: event.sourceType,
      payload: event.payload,
    })),
    inventory: state.inventory,
    artifacts: [],
    mapLocations: [],
    sideQuest: null,
    sideQuests: [],
    stagedActions: [],
    journalEntries: [],
    recovery: [],
    audit: audit.map((event) => ({
      id: event.id,
      action: event.action,
      actor: event.actorId ?? event.actorType,
      outcome: event.outcome,
      reason: null,
      correlationId: event.correlationId,
      metadata: {},
      createdAt: event.createdAt,
    })),
    preview: state,
    playerSnapshot: state,
    diagnostics: {
      database: "healthy",
      liveTransport: "canonical Chronicle Session SSE",
      latestCampaignSequence: state.session.currentSequence,
      latestAcknowledgedSequence: 0,
      lag: 0,
      stalePreparedActions: 0,
    },
  });
}
