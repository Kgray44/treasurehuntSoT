import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeTaleSessionPlayer, verifyPlayerCsrf } from "@/platform/auth";
import { apiError } from "@/tall-tale/api";
import { requireVisionFeature } from "@/vision/feature-flags";
import { requireVisionPermission } from "@/vision/permissions";
import { createRuntimeVerificationAttempt, listRuntimeVerificationAttempts } from "@/vision/runtime-attempts";
import { createRuntimeAttemptSchema } from "@/vision/runtime-contract";

export async function POST(request: Request) {
  try {
    requireVisionFeature("player_hold_to_scan");
    requireVisionFeature("vision_runtime_engine");
    requireVisionFeature("live_external_ar");
    requireVisionFeature("vision_player_story_integration");
    const input = createRuntimeAttemptSchema.parse(await request.json());
    const access = await authorizeTaleSessionPlayer(input.sessionId);
    if (!access) return NextResponse.json({ error: "Voyage session required." }, { status: 401 });
    if (access.kind === "identity" && !(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
      return NextResponse.json({ error: "The Player session expired." }, { status: 403 });
    return NextResponse.json(
      await createRuntimeVerificationAttempt(input, {
        playerId: access.kind === "identity" ? access.playerId : undefined,
      }),
      { status: 201 },
    );
  } catch (cause) {
    return apiError(cause);
  }
}

export async function GET(request: Request) {
  try {
    const captain = await requireVisionPermission("visionWaypoint.viewDiagnostics");
    if (!captain) return NextResponse.json({ error: "Captain authentication required." }, { status: 401 });
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    const authorized = await db.taleSession.findFirst({
      where: { id: sessionId, OR: [{ captainId: captain.userId }, { captainId: null }] },
      select: { id: true },
    });
    if (!authorized) return NextResponse.json({ error: "Captain session access required." }, { status: 403 });
    return NextResponse.json({
      csrfToken: captain.csrfToken,
      attempts: await listRuntimeVerificationAttempts(sessionId, Number(url.searchParams.get("limit") ?? 30)),
    });
  } catch (cause) {
    return apiError(cause);
  }
}
