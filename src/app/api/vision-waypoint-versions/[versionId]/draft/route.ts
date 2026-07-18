import { NextResponse } from "next/server";
import { verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { updateDraftConfiguration } from "@/vision/lifecycle";
import { requireVisionPermission } from "@/vision/permissions";
export async function PATCH(request: Request, context: { params: Promise<{ versionId: string }> }) {
  try {
    const session = await requireVisionPermission("visionWaypoint.editDraft");
    if (!session) return NextResponse.json({ error: "Creator authentication required." }, { status: 401 });
    if (!(await verifyCsrf(session)))
      return NextResponse.json({ error: "The creator session expired." }, { status: 403 });
    return NextResponse.json(
      await updateDraftConfiguration((await context.params).versionId, await request.json(), session.userId),
    );
  } catch (cause) {
    return apiError(cause);
  }
}
