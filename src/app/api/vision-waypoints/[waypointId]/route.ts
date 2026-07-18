import { NextResponse } from "next/server";
import { verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { getVisionWaypoint, updateWaypointMetadata } from "@/vision/lifecycle";
import { requireVisionFeature } from "@/vision/feature-flags";
import { requireVisionPermission } from "@/vision/permissions";

type Context = { params: Promise<{ waypointId: string }> };
export async function GET(_: Request, context: Context) {
  try {
    requireVisionFeature("vision_waypoints");
    const session = await requireVisionPermission("visionWaypoint.read");
    if (!session) return NextResponse.json({ error: "Creator authentication required." }, { status: 401 });
    return NextResponse.json({
      csrfToken: session.csrfToken,
      waypoint: await getVisionWaypoint((await context.params).waypointId, session.userId),
    });
  } catch (cause) {
    return apiError(cause);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    requireVisionFeature("vision_waypoints");
    const session = await requireVisionPermission("visionWaypoint.editDraft");
    if (!session) return NextResponse.json({ error: "Creator authentication required." }, { status: 401 });
    if (!(await verifyCsrf(session)))
      return NextResponse.json({ error: "The creator session expired." }, { status: 403 });
    return NextResponse.json(
      await updateWaypointMetadata((await context.params).waypointId, await request.json(), session.userId),
    );
  } catch (cause) {
    return apiError(cause);
  }
}
