import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { requirePlayerIdentity, playerCanAccessPlaythrough, verifyPlayerCsrf } from "@/platform/auth";
import { resolveAssetVariant } from "@/chronicle/assets";
import { loadPinnedLandfallDefinition } from "@/landfall/published";
import { landmarkComparisonSchema } from "@/landfall/landmark-contract";
import { verifyPlayerLandmark } from "@/landfall/landmark-verification";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
export async function POST(request: Request, context: { params: Promise<{ playthroughId: string }> }) {
  const identity = await requirePlayerIdentity();
  if (!identity) return NextResponse.json({ error: "Player sign-in required." }, { status: 401, headers });
  const { playthroughId } = await context.params;
  if (!(await playerCanAccessPlaythrough(playthroughId, identity.playerProfileId)))
    return NextResponse.json({ error: "Voyage not found." }, { status: 404, headers });
  if (!(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
    return NextResponse.json({ error: "The Player session expired." }, { status: 403, headers });
  const rate = consumeRateLimit(`landfall-landmark:${playthroughId}:${identity.playerProfileId}`, {
    limit: 6,
    windowMs: 60_000,
  });
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Wait a moment before comparing again." },
      { status: 429, headers: { ...headers, ...rateLimitHeaders(rate) } },
    );
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 1800 * 1024)
      return NextResponse.json({ error: "Choose a smaller landmark view." }, { status: 413, headers });
    const input = landmarkComparisonSchema.parse(JSON.parse(raw));
    if (input.sessionId !== playthroughId) throw new Error("wrong session");
    const [pinned, session] = await Promise.all([
      loadPinnedLandfallDefinition(playthroughId),
      db.taleSession.findUnique({
        where: { id: playthroughId },
        select: {
          status: true,
          previewMode: true,
          currentSequence: true,
          currentChapterId: true,
          currentBlockId: true,
          captainAuthorityState: true,
        },
      }),
    ]);
    if (
      !pinned ||
      !session ||
      session.status !== "ACTIVE" ||
      session.previewMode ||
      session.captainAuthorityState === "VACANT" ||
      pinned.publishedVersionId !== input.publishedVersionId ||
      session.currentSequence !== input.expectedSequence
    )
      return NextResponse.json({ error: "The Voyage changed. Refresh before comparing." }, { status: 409, headers });
    const events = await db.taleSessionEvent.findMany({
      where: { sessionId: playthroughId, eventType: { startsWith: "landfall" } },
      orderBy: [{ sequence: "asc" }, { id: "asc" }],
      take: 2048,
      select: { id: true, sequence: true, eventType: true, payload: true, createdAt: true },
    });
    const result = await verifyPlayerLandmark({
      definition: pinned.definition,
      request: input,
      playerProfileId: identity.playerProfileId,
      events,
      chapterId: session.currentChapterId,
      blockId: session.currentBlockId,
      now: Date.now(),
      readReference: async (assetId) =>
        (await resolveAssetVariant(assetId, "PREVIEW", input.publishedVersionId)).buffer,
    });
    return NextResponse.json(result, { headers });
  } catch {
    return NextResponse.json(
      {
        result: "unavailable",
        error: "This landmark could not be verified. Refresh your location or use the configured fallback.",
      },
      { status: 422, headers },
    );
  }
}
