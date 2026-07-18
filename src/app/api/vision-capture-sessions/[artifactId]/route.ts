import { NextResponse } from "next/server";
import { verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { markCreatorCaptureDeleted } from "@/vision/capture-persistence";
import { requireVisionFeature } from "@/vision/feature-flags";
import { requireVisionPermission } from "@/vision/permissions";

export async function DELETE(_: Request, context: { params: Promise<{ artifactId: string }> }) {
  try {
    requireVisionFeature("native_window_capture");
    const session = await requireVisionPermission("visionWaypoint.editDraft");
    if (!session) return NextResponse.json({ error: "Creator authentication required." }, { status: 401 });
    if (!(await verifyCsrf(session)))
      return NextResponse.json({ error: "The creator session expired." }, { status: 403 });
    return NextResponse.json(await markCreatorCaptureDeleted((await context.params).artifactId, session.userId));
  } catch (cause) {
    return apiError(cause);
  }
}
