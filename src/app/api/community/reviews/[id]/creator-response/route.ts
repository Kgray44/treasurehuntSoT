import { NextResponse } from "next/server";

import { deleteCreatorResponse, respondToReview } from "@/community/social";
import { executeSocialAction, executeSocialMutation } from "@/app/api/community/social/contract";

import { creatorResponseInputSchema } from "../../contract";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id))
    return NextResponse.json(
      { code: "COMMUNITY_INVALID_INPUT", error: "Review identifier is invalid." },
      { status: 400 },
    );
  return executeSocialMutation(request, creatorResponseInputSchema, (actor, input) =>
    respondToReview(actor, id, input),
  );
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id))
    return NextResponse.json(
      { code: "COMMUNITY_INVALID_INPUT", error: "Review identifier is invalid." },
      { status: 400 },
    );
  return executeSocialAction(request, (actor) => deleteCreatorResponse(actor, id));
}
