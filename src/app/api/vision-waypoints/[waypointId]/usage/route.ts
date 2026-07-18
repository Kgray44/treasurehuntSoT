import { NextResponse } from "next/server";
import { apiError } from "@/tall-tale/api";
import { getWaypointUsage } from "@/vision/lifecycle";
import { requireVisionPermission } from "@/vision/permissions";
export async function GET(_: Request, context: { params: Promise<{ waypointId: string }> }) {
  try {
    const session = await requireVisionPermission("visionWaypoint.read");
    if (!session) return NextResponse.json({ error: "Creator authentication required." }, { status: 401 });
    return NextResponse.json({ usage: await getWaypointUsage((await context.params).waypointId, session.userId) });
  } catch (cause) {
    return apiError(cause);
  }
}
