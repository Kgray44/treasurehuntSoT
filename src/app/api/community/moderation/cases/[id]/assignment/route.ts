import { NextResponse } from "next/server";
import { z } from "zod";
import { assignModerationCase, unassignModerationCase } from "@/community/moderation";
import { canonicalCommunityActor, denied, expectedRevision, opaqueId, reasonCode, routeError } from "../../../contract";

const schema = z.object({ moderatorAccountId: opaqueId, expectedRevision, reasonCode }).strict();
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await canonicalCommunityActor(request);
  if (!actor) return denied();
  try {
    await assignModerationCase(actor, { ...schema.parse(await request.json()), caseId: (await context.params).id });
    return NextResponse.json({ ok: true });
  } catch (cause) {
    return routeError(cause);
  }
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await canonicalCommunityActor(request);
  if (!actor) return denied();
  try {
    await unassignModerationCase(actor, { ...schema.omit({ moderatorAccountId: true }).parse(await request.json()), caseId: (await context.params).id });
    return NextResponse.json({ ok: true });
  } catch (cause) {
    return routeError(cause);
  }
}
