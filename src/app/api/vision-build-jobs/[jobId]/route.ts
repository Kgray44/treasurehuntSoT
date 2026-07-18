import { NextResponse } from "next/server";
import { apiError } from "@/tall-tale/api";
import { verifyCsrf } from "@/lib/security";
import { getVisionBuildJob, updateVisionBuildJob } from "@/vision/build-jobs";
import { requireVisionPermission } from "@/vision/permissions";

export async function GET(_: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const session = await requireVisionPermission("visionWaypoint.read");
    if (!session) return NextResponse.json({ error: "Creator authentication required." }, { status: 401 });
    return NextResponse.json(await getVisionBuildJob((await context.params).jobId, session.userId));
  } catch (cause) {
    return apiError(cause);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const session = await requireVisionPermission("visionWaypoint.editDraft");
    if (!session) return NextResponse.json({ error: "Creator authentication required." }, { status: 401 });
    if (!(await verifyCsrf(session)))
      return NextResponse.json({ error: "The creator session expired." }, { status: 403 });
    return NextResponse.json(
      await updateVisionBuildJob((await context.params).jobId, await request.json(), session.userId),
    );
  } catch (cause) {
    return apiError(cause);
  }
}
