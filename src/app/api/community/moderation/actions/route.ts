import { NextResponse } from "next/server";
import { z } from "zod";
import { applyModerationAction } from "@/community/moderation";
import { canonicalCommunityActor, denied, expectedRevision, opaqueId, reasonCode, routeError } from "../contract";

const schema = z
  .object({
    caseId: opaqueId,
    subjectType: z.string().trim().max(64),
    subjectId: opaqueId,
    actionType: z.string().trim().max(64),
    expectedRevision,
    reasonCode,
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/u),
    secondReviewerId: opaqueId.optional(),
  })
  .strict();
export async function POST(request: Request) {
  const actor = await canonicalCommunityActor(request);
  if (!actor) return denied();
  try {
    return NextResponse.json(await applyModerationAction(actor, schema.parse(await request.json())), { status: 201 });
  } catch (cause) {
    return routeError(cause);
  }
}
