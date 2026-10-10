import { NextResponse } from "next/server";
import { requirePlayerIdentity, playerCanAccessPlaythrough, verifyPlayerCsrf } from "@/platform/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { loadReleasedSpatialMoment, recordSpatialObservation } from "@/parallax/service";
import { spatialId } from "@/parallax/contracts";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
export async function GET(request: Request, context: { params: Promise<{ playthroughId: string }> }) {
  const identity = await requirePlayerIdentity();
  if (!identity) return NextResponse.json({ error: "Player sign-in required." }, { status: 401, headers });
  const { playthroughId } = await context.params;
  if (!(await playerCanAccessPlaythrough(playthroughId, identity.playerProfileId)))
    return NextResponse.json({ error: "Voyage not found." }, { status: 404, headers });
  const block = new URL(request.url).searchParams.get("block");
  if (!spatialId.safeParse(block).success)
    return NextResponse.json({ error: "Choose a released passage." }, { status: 400, headers });
  try {
    return NextResponse.json(await loadReleasedSpatialMoment(playthroughId, identity.playerProfileId, block!), {
      headers,
    });
  } catch {
    return NextResponse.json({ error: "This spatial moment is unavailable." }, { status: 404, headers });
  }
}
export async function POST(request: Request, context: { params: Promise<{ playthroughId: string }> }) {
  const identity = await requirePlayerIdentity();
  if (!identity) return NextResponse.json({ error: "Player sign-in required." }, { status: 401, headers });
  const { playthroughId } = await context.params;
  if (!(await playerCanAccessPlaythrough(playthroughId, identity.playerProfileId)))
    return NextResponse.json({ error: "Voyage not found." }, { status: 404, headers });
  if (!(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
    return NextResponse.json({ error: "The Player session expired." }, { status: 403, headers });
  if (
    !consumeRateLimit(`parallax:${playthroughId}:${identity.playerProfileId}`, { limit: 40, windowMs: 60000 }).allowed
  )
    return NextResponse.json({ error: "Wait a moment before trying again." }, { status: 429, headers });
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 8192)
      return NextResponse.json({ error: "Spatial evidence is too large." }, { status: 413, headers });
    return NextResponse.json(await recordSpatialObservation(playthroughId, identity.playerProfileId, JSON.parse(raw)), {
      headers,
    });
  } catch {
    return NextResponse.json(
      { error: "This interaction could not be recorded. Your Voyage progress has not changed." },
      { status: 409, headers },
    );
  }
}
