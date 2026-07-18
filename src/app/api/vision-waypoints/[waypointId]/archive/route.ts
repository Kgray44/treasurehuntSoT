import { NextResponse } from "next/server";
import { verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { requireVisionFeature } from "@/vision/feature-flags";
import { archiveWaypoint } from "@/vision/lifecycle";
import { requireVisionPermission } from "@/vision/permissions";

export async function POST(_: Request, context: { params: Promise<{ waypointId: string }> }) {
  try {
    requireVisionFeature("vision_waypoints");
    const session = await requireVisionPermission("visionWaypoint.editDraft");
    if (!session) return NextResponse.json({ error: "Creator authentication required." }, { status: 401 });
    if (!(await verifyCsrf(session)))
      return NextResponse.json({ error: "The creator session expired." }, { status: 403 });
    return NextResponse.json(await archiveWaypoint((await context.params).waypointId, session.userId));
  } catch (cause) {
    return apiError(cause);
  }
}
