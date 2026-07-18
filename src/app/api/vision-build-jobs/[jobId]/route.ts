import { NextResponse } from "next/server";
import { apiError } from "@/tall-tale/api";
import { getBuildInput } from "@/vision/authoring";
import { requireVisionPermission } from "@/vision/permissions";

export async function GET(_: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const session = await requireVisionPermission("visionWaypoint.read");
    if (!session) return NextResponse.json({ error: "Creator authentication required." }, { status: 401 });
    return NextResponse.json(await getBuildInput((await context.params).jobId, session.userId));
  } catch (cause) {
    return apiError(cause);
  }
}
