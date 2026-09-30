import { NextResponse } from "next/server";
import { getTaleSessionState, submitPlayerLandfallEvidence } from "@/chronicle/progression";
import { apiError } from "@/chronicle/api";
import { loadPinnedLandfallDefinition } from "@/landfall/published";
import { projectPlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
import { requirePlayerIdentity, playerCanAccessPlaythrough, verifyPlayerCsrf } from "@/platform/auth";
import { db } from "@/lib/db";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0" };
export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ playthroughId: string }> }) {
  try {
    const identity = await requirePlayerIdentity();
    if (!identity)
      return NextResponse.json({ error: "Player sign-in required." }, { status: 401, headers: privateHeaders });
    const { playthroughId } = await context.params;
    if (!(await playerCanAccessPlaythrough(playthroughId, identity.playerProfileId)))
      return NextResponse.json({ error: "Voyage not found." }, { status: 404, headers: privateHeaders });
    const state = await getTaleSessionState(playthroughId, undefined, false, true);
    if (!["ACTIVE", "COMPLETED"].includes(state.session.status))
      return NextResponse.json({ available: false }, { headers: privateHeaders });
    const pinned = await loadPinnedLandfallDefinition(playthroughId);
    if (!pinned) return NextResponse.json({ available: false }, { headers: privateHeaders });
    if (pinned.publishedVersionId !== state.session.versionId)
      return NextResponse.json({ error: "Pinned version changed." }, { status: 409, headers: privateHeaders });
    const events = await db.taleSessionEvent.findMany({
      where: { sessionId: playthroughId, eventType: { startsWith: "landfall" } },
      orderBy: [{ sequence: "asc" }, { id: "asc" }],
      take: 2048,
      select: { id: true, sequence: true, eventType: true, payload: true, createdAt: true },
    });
    return NextResponse.json(
      {
        available: true,
        bootstrap: projectPlayerLandfallBootstrap(pinned, {
          chapterId: state.chapter?.id ?? null,
          blockId: state.block?.id ?? null,
          releasedAssets: state.assets,
          events,
          replayOnly: state.session.status === "COMPLETED",
        }),
      },
      { headers: privateHeaders },
    );
  } catch {
    return NextResponse.json({ error: "Voyage Chart is unavailable." }, { status: 503, headers: privateHeaders });
  }
}

export async function POST(request: Request, context: { params: Promise<{ playthroughId: string }> }) {
  const identity = await requirePlayerIdentity();
  if (!identity)
    return NextResponse.json({ error: "Player sign-in required." }, { status: 401, headers: privateHeaders });
  const { playthroughId } = await context.params;
  if (!(await playerCanAccessPlaythrough(playthroughId, identity.playerProfileId)))
    return NextResponse.json({ error: "Voyage not found." }, { status: 404, headers: privateHeaders });
  if (!(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
    return NextResponse.json({ error: "The Player session expired." }, { status: 403, headers: privateHeaders });
  const rate = consumeRateLimit(`landfall-player:${playthroughId}`, { limit: 20, windowMs: 60_000 });
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Too many location attempts. Wait a moment before retrying." },
      { status: 429, headers: { ...privateHeaders, ...rateLimitHeaders(rate) } },
    );
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 48 * 1024)
      return NextResponse.json({ error: "Location evidence is too large." }, { status: 413, headers: privateHeaders });
    const input = JSON.parse(raw) as Record<string, unknown>;
    if (input.sessionId !== playthroughId)
      return NextResponse.json(
        { error: "Location evidence belongs to another Voyage." },
        { status: 409, headers: privateHeaders },
      );
    return NextResponse.json(await submitPlayerLandfallEvidence(input), { headers: privateHeaders });
  } catch (cause) {
    const response = apiError(cause);
    response.headers.set("Cache-Control", privateHeaders["Cache-Control"]);
    return response;
  }
}
