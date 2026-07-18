import { NextResponse } from "next/server";
import { verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { createWaypoint, listVisionWaypoints } from "@/vision/lifecycle";
import { requireVisionFeature } from "@/vision/feature-flags";
import { requireVisionPermission } from "@/vision/permissions";

export async function GET(request: Request) {
  try {
    requireVisionFeature("vision_waypoint_library");
    const session = await requireVisionPermission("visionWaypoint.read");
    if (!session) return NextResponse.json({ error: "Creator authentication required." }, { status: 401 });
    const url = new URL(request.url);
    return NextResponse.json({
      csrfToken: session.csrfToken,
      ...(await listVisionWaypoints({
        actorId: session.userId,
        query: url.searchParams.get("q") ?? undefined,
        lifecycle: url.searchParams.get("lifecycle") ?? undefined,
        cursor: url.searchParams.get("cursor") ?? undefined,
        limit: Number(url.searchParams.get("limit") ?? 25),
      })),
    });
  } catch (cause) {
    return apiError(cause);
  }
}

export async function POST(request: Request) {
  try {
    requireVisionFeature("vision_waypoints");
    const session = await requireVisionPermission("visionWaypoint.create");
    if (!session) return NextResponse.json({ error: "Creator authentication required." }, { status: 401 });
    if (!(await verifyCsrf(session)))
      return NextResponse.json({ error: "The creator session expired." }, { status: 403 });
    return NextResponse.json(await createWaypoint(await request.json(), session.userId), { status: 201 });
  } catch (cause) {
    return apiError(cause);
  }
}
