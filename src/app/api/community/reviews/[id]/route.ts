import { NextResponse } from "next/server";

import { deleteReview, updateReview } from "@/community/social";
import { executeSocialAction, executeSocialMutation } from "@/app/api/community/social/contract";

import { reviewUpdateInputSchema } from "../contract";

const validId = (id: string) => /^[A-Za-z0-9_-]{1,128}$/.test(id);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!validId(id)) return NextResponse.json({ code: "COMMUNITY_INVALID_INPUT", error: "Review identifier is invalid." }, { status: 400 });
  return executeSocialMutation(request, reviewUpdateInputSchema, (actor, input) => updateReview(actor, id, input));
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!validId(id)) return NextResponse.json({ code: "COMMUNITY_INVALID_INPUT", error: "Review identifier is invalid." }, { status: 400 });
  return executeSocialAction(request, (actor) => deleteReview(actor, id));
}
