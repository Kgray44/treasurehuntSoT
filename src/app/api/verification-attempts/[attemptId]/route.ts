import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeTaleSessionPlayer } from "@/platform/auth";
import { apiError } from "@/tall-tale/api";
import { getVerificationAttempt } from "@/vision/attempts";
import { requireVisionPermission } from "@/vision/permissions";
export async function GET(_: Request, context: { params: Promise<{ attemptId: string }> }) {
  try {
    const attemptId = (await context.params).attemptId;
    const record = await db.verificationAttempt.findUnique({ where: { id: attemptId }, select: { sessionId: true } });
    if (!record?.sessionId) return NextResponse.json({ error: "Verification attempt not found." }, { status: 404 });
    const player = await authorizeTaleSessionPlayer(record.sessionId);
    if (!player) {
      const captain = await requireVisionPermission("visionWaypoint.viewDiagnostics");
      if (!captain) return NextResponse.json({ error: "Attempt access required." }, { status: 401 });
      const authorized = await db.taleSession.findFirst({
        where: { id: record.sessionId, OR: [{ captainId: captain.userId }, { captainId: null }] },
        select: { id: true },
      });
      if (!authorized) return NextResponse.json({ error: "Captain session access required." }, { status: 403 });
    }
    return NextResponse.json({ attempt: await getVerificationAttempt(attemptId) });
  } catch (cause) {
    return apiError(cause);
  }
}
