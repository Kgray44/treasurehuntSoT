import { NextResponse } from "next/server";
import { verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { getAuthoringAggregate, mutateAuthoring } from "@/vision/authoring";
import { requireVisionFeature } from "@/vision/feature-flags";
import { requireVisionPermission } from "@/vision/permissions";

type Context = { params: Promise<{ versionId: string }> };
const maximumAuthoringBytes = 512 * 1024;
export const runtime = "nodejs";

export async function GET(_: Request, context: Context) {
  try {
    requireVisionFeature("vision_waypoints");
    const session = await requireVisionPermission("visionWaypoint.read");
    if (!session) return NextResponse.json({ error: "Creator authentication required." }, { status: 401 });
    return NextResponse.json({
      csrfToken: session.csrfToken,
      authoring: await getAuthoringAggregate((await context.params).versionId, session.userId),
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
    const declaredBytes = Number(request.headers.get("content-length") ?? 0);
    if (declaredBytes > maximumAuthoringBytes)
      return NextResponse.json(
        { error: "The authoring change is too large.", code: "AUTHORING_PAYLOAD_TOO_LARGE" },
        { status: 413 },
      );
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > maximumAuthoringBytes)
      return NextResponse.json(
        { error: "The authoring change is too large.", code: "AUTHORING_PAYLOAD_TOO_LARGE" },
        { status: 413 },
      );
    return NextResponse.json({
      authoring: await mutateAuthoring((await context.params).versionId, JSON.parse(text), session.userId),
    });
  } catch (cause) {
    return apiError(cause);
  }
}
