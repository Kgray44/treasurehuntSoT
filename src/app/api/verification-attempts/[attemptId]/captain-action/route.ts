import { NextResponse } from "next/server";
import { verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { recordCaptainAttemptAction } from "@/vision/attempts";
import { requireVisionPermission } from "@/vision/permissions";
import { db } from "@/lib/db";
import { z } from "zod";

const captainActionSchema = z
  .object({ action: z.enum(["APPROVED", "REJECTED"]), reason: z.string().trim().min(3).max(500) })
  .strict();
export async function POST(request: Request, context: { params: Promise<{ attemptId: string }> }) {
  try {
    const session = await requireVisionPermission("visionWaypoint.viewDiagnostics");
    if (!session) return NextResponse.json({ error: "Captain authentication required." }, { status: 401 });
    if (!(await verifyCsrf(session)))
      return NextResponse.json({ error: "The Captain session expired." }, { status: 403 });
    const authorized = await db.verificationAttempt.findFirst({
      where: {
        id: (await context.params).attemptId,
        session: { OR: [{ captainId: session.userId }, { captainId: null }] },
      },
      select: { id: true },
    });
    if (!authorized) return NextResponse.json({ error: "Captain session access required." }, { status: 403 });
    const body = captainActionSchema.parse(await request.json());
    return NextResponse.json(await recordCaptainAttemptAction(authorized.id, session.userId, body.action, body.reason));
  } catch (cause) {
    return apiError(cause);
  }
}
