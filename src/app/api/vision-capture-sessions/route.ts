import { NextResponse } from "next/server";
import { verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { listCreatorCaptures, persistCreatorCapture } from "@/vision/capture-persistence";
import { requireVisionFeature } from "@/vision/feature-flags";
import { requireVisionPermission } from "@/vision/permissions";

const maximumManifestBytes = 256 * 1024;
export const runtime = "nodejs";

export async function GET() {
  try {
    requireVisionFeature("native_window_capture");
    const session = await requireVisionPermission("visionWaypoint.read");
    if (!session) return NextResponse.json({ error: "Creator authentication required." }, { status: 401 });
    return NextResponse.json({ csrfToken: session.csrfToken, assets: await listCreatorCaptures(session.userId) });
  } catch (cause) {
    return apiError(cause);
  }
}

export async function POST(request: Request) {
  try {
    requireVisionFeature("native_window_capture");
    const session = await requireVisionPermission("visionWaypoint.editDraft");
    if (!session) return NextResponse.json({ error: "Creator authentication required." }, { status: 401 });
    if (!(await verifyCsrf(session)))
      return NextResponse.json({ error: "The creator session expired." }, { status: 403 });
    const declaredBytes = Number(request.headers.get("content-length") ?? 0);
    if (declaredBytes > maximumManifestBytes)
      return NextResponse.json({ error: "The capture manifest is too large." }, { status: 413 });
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > maximumManifestBytes)
      return NextResponse.json({ error: "The capture manifest is too large." }, { status: 413 });
    return NextResponse.json(await persistCreatorCapture(JSON.parse(body), session.userId), { status: 201 });
  } catch (cause) {
    return apiError(cause);
  }
}
