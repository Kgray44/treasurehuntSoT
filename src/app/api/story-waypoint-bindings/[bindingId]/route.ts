import { NextResponse } from "next/server";
import { verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { deleteStoryWaypointBinding, replaceStoryWaypointBinding } from "@/vision/lifecycle";
import { requireVisionPermission } from "@/vision/permissions";
type Context = { params: Promise<{ bindingId: string }> };
async function authenticated() {
  const session = await requireVisionPermission("visionWaypoint.bindToStory");
  if (!session || !(await verifyCsrf(session))) return null;
  return session;
}
export async function PATCH(request: Request, context: Context) {
  try {
    const session = await authenticated();
    if (!session) return NextResponse.json({ error: "Authorized creator session required." }, { status: 403 });
    return NextResponse.json(
      await replaceStoryWaypointBinding((await context.params).bindingId, await request.json(), session.userId),
    );
  } catch (cause) {
    return apiError(cause);
  }
}
export async function DELETE(_: Request, context: Context) {
  try {
    const session = await authenticated();
    if (!session) return NextResponse.json({ error: "Authorized creator session required." }, { status: 403 });
    return NextResponse.json(await deleteStoryWaypointBinding((await context.params).bindingId, session.userId));
  } catch (cause) {
    return apiError(cause);
  }
}
