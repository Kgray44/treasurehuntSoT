import { NextResponse } from "next/server";
import { apiError } from "@/tall-tale/api";
import { authorizeTaleSessionPlayer, verifyPlayerCsrf } from "@/platform/auth";
import { createAttemptSchema, createVerificationAttempt, listVerificationAttempts } from "@/vision/attempts";
import { requireVisionFeature } from "@/vision/feature-flags";
import { requireVisionPermission } from "@/vision/permissions";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    requireVisionFeature("player_hold_to_scan");
    const input = createAttemptSchema.parse(await request.json());
    const access = await authorizeTaleSessionPlayer(input.sessionId);
    if (!access) return NextResponse.json({ error: "Voyage session required." }, { status: 401 });
    if (access.kind === "identity" && !(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
      return NextResponse.json({ error: "The Player session expired." }, { status: 403 });
    return NextResponse.json(
      await createVerificationAttempt(input, { playerId: access.kind === "identity" ? access.playerId : undefined }),
      { status: 201 },
    );
  } catch (cause) {
    return apiError(cause);
  }
}

export async function GET(request: Request) {
  try {
    const session = await requireVisionPermission("visionWaypoint.viewDiagnostics");
    if (!session) return NextResponse.json({ error: "Captain authentication required." }, { status: 401 });
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    const authorizedSession = await db.taleSession.findFirst({
      where: { id: sessionId, OR: [{ captainId: session.userId }, { captainId: null }] },
      select: { id: true },
    });
    if (!authorizedSession) return NextResponse.json({ error: "Captain session access required." }, { status: 403 });
    return NextResponse.json({
      csrfToken: session.csrfToken,
      attempts: await listVerificationAttempts({ sessionId, limit: Number(url.searchParams.get("limit") ?? 20) }),
    });
  } catch (cause) {
    return apiError(cause);
  }
}
