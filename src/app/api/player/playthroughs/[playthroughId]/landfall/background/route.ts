import { NextResponse } from "next/server";
import { observeLandfallOperation } from "@/landfall/operational-observability";
import { GET as authorizedChart } from "../route";
import { requirePlayerIdentity, verifyPlayerCsrf } from "@/platform/auth";
import { loadPinnedLandfallDefinition } from "@/landfall/published";
import { mintLandfallReturnHandle } from "@/landfall/notification-return-server";
import type { PlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
import { consumeRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
export async function POST(request: Request, context: { params: Promise<{ playthroughId: string }> }) {
  return observeLandfallOperation("BACKGROUND_SETUP", () => performPost(request, context));
}
async function performPost(request: Request, context: { params: Promise<{ playthroughId: string }> }) {
  try {
    const identity = await requirePlayerIdentity();
    if (!identity) return NextResponse.json({ error: "Player sign-in required." }, { status: 401, headers });
    if (!(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
      return NextResponse.json({ error: "Player session expired." }, { status: 403, headers });
    if (!consumeRateLimit(`landfall-background:${identity.playerProfileId}`, { limit: 10, windowMs: 60000 }).allowed)
      return NextResponse.json({ error: "Wait before preparing another reminder." }, { status: 429, headers });
    const response = await authorizedChart(request, context);
    if (!response.ok) return response;
    const body = (await response.json()) as { available: boolean; bootstrap?: PlayerLandfallBootstrap };
    const bootstrap = body.bootstrap;
    if (!body.available || !bootstrap || bootstrap.replayOnly || bootstrap.paused)
      return NextResponse.json({ available: false }, { headers });
    const { playthroughId } = await context.params;
    const pinned = await loadPinnedLandfallDefinition(playthroughId);
    const world = bootstrap.runtimeDefinition.worldspaces[0];
    const waypoint = bootstrap.runtimeDefinition.waypoints.find((item) => item.id === bootstrap.activeWaypointId);
    if (
      !pinned ||
      pinned.publishedVersionId !== bootstrap.publishedVersionId ||
      pinned.currentSequence !== bootstrap.currentSequence ||
      world.kind !== "PHYSICAL" ||
      !world.observationPolicy.allowedSources.includes("NATIVE_LOCATION") ||
      !waypoint ||
      waypoint.geometry.type !== "POINT_RADIUS" ||
      waypoint.geometry.center.type !== "WGS84"
    )
      return NextResponse.json({ available: false }, { headers });
    const scope = {
      playerProfileId: identity.playerProfileId,
      sessionId: playthroughId,
      publishedVersionId: pinned.publishedVersionId,
      worldspaceId: world.id,
      waypointId: waypoint.id,
      expectedSequence: pinned.currentSequence,
    };
    const expiresAt = Math.min(Date.now() + 3600_000, identity.expiresAt.getTime());
    const returnHandle = mintLandfallReturnHandle(scope, Date.now(), expiresAt);
    return NextResponse.json(
      {
        available: true,
        returnHandle,
        latitude: waypoint.geometry.center.latitude,
        longitude: waypoint.geometry.center.longitude,
        radiusMeters: Math.min(10000, Math.max(100, waypoint.geometry.radius)),
        expiresAt,
      },
      { headers },
    );
  } catch {
    return NextResponse.json({ available: false, reason: "BACKGROUND_NOT_CONFIGURED" }, { headers });
  }
}
