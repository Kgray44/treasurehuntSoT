import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { recordCaptainRuntimeAction } from "@/vision/runtime-attempts";
import { captainVisionActionSchema } from "@/vision/runtime-contract";
import { requireVisionPermission } from "@/vision/permissions";
import { requireVisionFeature } from "@/vision/feature-flags";

export async function POST(request: Request, context: { params: Promise<{ attemptId: string }> }) {
  try {
    requireVisionFeature("vision_captain_integration");
    const captain = await requireVisionPermission("visionWaypoint.viewDiagnostics");
    if (!captain) return NextResponse.json({ error: "Captain authentication required." }, { status: 401 });
    if (!(await verifyCsrf(captain)))
      return NextResponse.json({ error: "The Captain session expired." }, { status: 403 });
    const attemptId = (await context.params).attemptId;
    const authorized = await db.verificationAttempt.findFirst({
      where: { id: attemptId, session: { OR: [{ captainId: captain.userId }, { captainId: null }] } },
      select: { id: true },
    });
    if (!authorized) return NextResponse.json({ error: "Captain session access required." }, { status: 403 });
    return NextResponse.json(
      await recordCaptainRuntimeAction(
        attemptId,
        captain.userId,
        captainVisionActionSchema.parse(await request.json()),
      ),
    );
  } catch (cause) {
    return apiError(cause);
  }
}
