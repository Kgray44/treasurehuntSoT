import { NextResponse } from "next/server";
import { z } from "zod";
import { previewModerationAction } from "@/community/moderation";
import { canonicalCommunityActor, denied, expectedRevision, opaqueId, reasonCode, routeError } from "../../contract";

const schema = z.object({ caseId: opaqueId, subjectType: z.string().trim().max(64), subjectId: opaqueId, actionType: z.string().trim().max(64), expectedRevision, reasonCode, secondReviewerId: opaqueId.optional() }).strict();
export async function POST(request: Request) {
  const actor = await canonicalCommunityActor(request);
  if (!actor) return denied();
  try {
    return NextResponse.json(await previewModerationAction(actor, schema.parse(await request.json())));
  } catch (cause) {
    return routeError(cause);
  }
}
