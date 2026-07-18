import { NextResponse } from "next/server";
import { verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { persistShadowAttempt } from "@/vision/build-jobs";
import { requireVisionPermission } from "@/vision/permissions";

export async function POST(request: Request) {
  try {
    const session = await requireVisionPermission("visionWaypoint.editDraft");
    if (!session) return NextResponse.json({ error: "Creator authentication required." }, { status: 401 });
    if (!(await verifyCsrf(session)))
      return NextResponse.json({ error: "The creator session expired." }, { status: 403 });
    return NextResponse.json(await persistShadowAttempt(await request.json(), session.userId), { status: 201 });
  } catch (cause) {
    return apiError(cause);
  }
}
