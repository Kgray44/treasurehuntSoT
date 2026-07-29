import { NextResponse } from "next/server";

import { removeReviewHelpfulVote, voteReviewHelpful } from "@/community/social";
import { executeSocialAction } from "@/app/api/community/social/contract";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id))
    return NextResponse.json(
      { code: "COMMUNITY_INVALID_INPUT", error: "Review identifier is invalid." },
      { status: 400 },
    );
  return executeSocialAction(request, (actor) => voteReviewHelpful(actor, id), 201);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id))
    return NextResponse.json(
      { code: "COMMUNITY_INVALID_INPUT", error: "Review identifier is invalid." },
      { status: 400 },
    );
  return executeSocialAction(request, (actor) => removeReviewHelpfulVote(actor, id));
}
