import { NextResponse } from "next/server";
import { verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { publishDraftVersion } from "@/vision/lifecycle";
import { requireVisionPermission } from "@/vision/permissions";
export async function POST(request: Request, context: { params: Promise<{ versionId: string }> }) {
  try {
    const session = await requireVisionPermission("visionWaypoint.publish");
    if (!session) return NextResponse.json({ error: "Publisher authentication required." }, { status: 401 });
    if (!(await verifyCsrf(session)))
      return NextResponse.json({ error: "The publisher session expired." }, { status: 403 });
    const body = (await request.json().catch(() => ({}))) as { scenario?: unknown };
    return NextResponse.json(
      await publishDraftVersion((await context.params).versionId, session.userId, body.scenario as never),
    );
  } catch (cause) {
    return apiError(cause);
  }
}
