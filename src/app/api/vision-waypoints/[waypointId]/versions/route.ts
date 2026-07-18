import { NextResponse } from "next/server";
import { verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { requireVisionFeature } from "@/vision/feature-flags";
import { createDraftVersion, getPublishedVersions, getLatestDraft } from "@/vision/lifecycle";
import { requireVisionPermission } from "@/vision/permissions";

type Context = { params: Promise<{ waypointId: string }> };
export async function GET(_: Request, context: Context) {
  try {
    requireVisionFeature("vision_waypoints");
    const session = await requireVisionPermission("visionWaypoint.read");
    if (!session) return NextResponse.json({ error: "Creator authentication required." }, { status: 401 });
    const id = (await context.params).waypointId;
    const [draft, published] = await Promise.all([
      getLatestDraft(id, session.userId),
      getPublishedVersions(id, session.userId),
    ]);
    return NextResponse.json({ csrfToken: session.csrfToken, draft, published });
  } catch (cause) {
    return apiError(cause);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    requireVisionFeature("vision_waypoints");
    const session = await requireVisionPermission("visionWaypoint.editDraft");
    if (!session) return NextResponse.json({ error: "Creator authentication required." }, { status: 401 });
    if (!(await verifyCsrf(session)))
      return NextResponse.json({ error: "The creator session expired." }, { status: 403 });
    const body = (await request.json().catch(() => ({}))) as { parentVersionId?: string };
    return NextResponse.json(
      await createDraftVersion((await context.params).waypointId, session.userId, body.parentVersionId),
      { status: 201 },
    );
  } catch (cause) {
    return apiError(cause);
  }
}
