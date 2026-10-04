import { NextResponse } from "next/server";
import { GET as authorizedChart } from "../route";
import { requirePlayerIdentity, verifyPlayerCsrf } from "@/platform/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { readLandfallBoundedJson } from "@/landfall/bounded-request-body";
import { remoteDataRequestSchema } from "@/landfall/remote-data";
import { deployedLandfallRemoteData as service } from "@/landfall/remote-data-deployment-server";
import type { PlayerLandfallBootstrap } from "@/landfall/player-bootstrap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

/** Deliberate optional data only: no coordinates, queries or results enter progression or telemetry. */
export async function POST(request: Request, context: { params: Promise<{ playthroughId: string }> }) {
  try {
    const identity = await requirePlayerIdentity();
    if (!identity) return NextResponse.json({ error: "Player sign-in required." }, { status: 401, headers });
    if (!(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
      return NextResponse.json({ error: "Player session expired." }, { status: 403, headers });
    if (!consumeRateLimit(`landfall-data:${identity.playerProfileId}`, { limit: 12, windowMs: 60000 }).allowed)
      return NextResponse.json(
        { state: "RATE_LIMITED", canComplete: false, retryAfterSeconds: 60 },
        { status: 429, headers },
      );
    const authorized = await authorizedChart(request, context);
    if (!authorized.ok) return authorized;
    const body = (await authorized.json()) as { available: boolean; bootstrap?: PlayerLandfallBootstrap };
    const bootstrap = body.bootstrap,
      world = bootstrap?.runtimeDefinition.worldspaces[0];
    const { playthroughId } = await context.params;
    if (
      !body.available ||
      !bootstrap ||
      bootstrap.sessionId !== playthroughId ||
      bootstrap.paused ||
      bootstrap.replayOnly ||
      !bootstrap.activeWaypointId ||
      world?.kind !== "PHYSICAL" ||
      !["PUBLIC_REAL_WORLD", "GENERIC"].includes(world.privacyPolicy.classification)
    )
      return NextResponse.json(
        { error: "Online data is unavailable for this objective. Use the released chart and guidance." },
        { status: 409, headers },
      );
    let input;
    try {
      input = remoteDataRequestSchema.parse(await readLandfallBoundedJson(request));
    } catch (error) {
      return NextResponse.json(
        { error: "Online data request is invalid." },
        {
          status: error instanceof Error && error.message === "BODY_TOO_LARGE" ? 413 : 400,
          headers,
        },
      );
    }
    const recipient = service.recipient(input.operation);
    if (recipient && request.headers.get("x-landfall-recipient") !== recipient)
      return NextResponse.json({ state: "UNAVAILABLE", canComplete: false }, { status: 409, headers });
    const result = await service.execute(input, request.signal);
    if (input.operation !== "STATUS") {
      const refreshed = await authorizedChart(request, context);
      if (!refreshed.ok) return refreshed;
      const refreshedBody = (await refreshed.json()) as { available: boolean; bootstrap?: PlayerLandfallBootstrap };
      const current = refreshedBody.bootstrap;
      if (
        !refreshedBody.available ||
        !current ||
        current.paused ||
        current.replayOnly ||
        current.sessionId !== bootstrap.sessionId ||
        current.publishedVersionId !== bootstrap.publishedVersionId ||
        current.currentSequence !== bootstrap.currentSequence ||
        current.activeWaypointId !== bootstrap.activeWaypointId ||
        current.runtimeDefinition.worldspaces[0]?.id !== world.id ||
        !["PUBLIC_REAL_WORLD", "GENERIC"].includes(
          current.runtimeDefinition.worldspaces[0]?.privacyPolicy.classification,
        )
      )
        return NextResponse.json({ state: "UNAVAILABLE", canComplete: false }, { status: 409, headers });
    }
    return NextResponse.json(result, { headers });
  } catch {
    return NextResponse.json({ state: "UNAVAILABLE", canComplete: false }, { status: 503, headers });
  }
}
