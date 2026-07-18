import { NextResponse } from "next/server";
import { verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { deprecatePublishedVersion } from "@/vision/lifecycle";
import { requireVisionPermission } from "@/vision/permissions";
export async function POST(_: Request, context: { params: Promise<{ versionId: string }> }) {
  try {
    const session = await requireVisionPermission("visionWaypoint.deprecate");
    if (!session) return NextResponse.json({ error: "Publisher authentication required." }, { status: 401 });
    if (!(await verifyCsrf(session)))
      return NextResponse.json({ error: "The publisher session expired." }, { status: 403 });
    return NextResponse.json(await deprecatePublishedVersion((await context.params).versionId, session.userId));
  } catch (cause) {
    return apiError(cause);
  }
}
