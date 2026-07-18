import { NextResponse } from "next/server";
import { apiError } from "@/tall-tale/api";
import { getVisionWaypointVersion } from "@/vision/lifecycle";
import { requireVisionPermission } from "@/vision/permissions";
export async function GET(_: Request, context: { params: Promise<{ versionId: string }> }) {
  try {
    const session = await requireVisionPermission("visionWaypoint.read");
    if (!session) return NextResponse.json({ error: "Creator authentication required." }, { status: 401 });
    return NextResponse.json({
      csrfToken: session.csrfToken,
      version: await getVisionWaypointVersion((await context.params).versionId, session.userId),
    });
  } catch (cause) {
    return apiError(cause);
  }
}
