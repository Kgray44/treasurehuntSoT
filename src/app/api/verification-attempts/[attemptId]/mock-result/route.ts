import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeTaleSessionPlayer, verifyPlayerCsrf } from "@/platform/auth";
import { apiError } from "@/tall-tale/api";
import { deliverMockVerificationResult } from "@/vision/attempts";
import { requireVisionFeature } from "@/vision/feature-flags";
export async function POST(request: Request, context: { params: Promise<{ attemptId: string }> }) {
  try {
    requireVisionFeature("player_hold_to_scan");
    requireVisionFeature("mock_verification_consumer");
    const attemptId = (await context.params).attemptId;
    const record = await db.verificationAttempt.findUnique({
      where: { id: attemptId },
      select: { sessionId: true, adapterType: true },
    });
    if (!record?.sessionId) return NextResponse.json({ error: "Verification attempt not found." }, { status: 404 });
    const access = await authorizeTaleSessionPlayer(record.sessionId);
    if (!access) return NextResponse.json({ error: "Voyage session required." }, { status: 401 });
    if (access.kind === "identity" && !(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
      return NextResponse.json({ error: "The Player session expired." }, { status: 403 });
    const body = (await request.json().catch(() => ({}))) as { scenario?: unknown };
    return NextResponse.json(
      await deliverMockVerificationResult(attemptId, body.scenario, {
        sourceType: record.adapterType === "DESKTOP" ? "desktopMock" : "mock",
        sourceId: access.kind === "identity" ? access.playerId : undefined,
      }),
    );
  } catch (cause) {
    return apiError(cause);
  }
}
