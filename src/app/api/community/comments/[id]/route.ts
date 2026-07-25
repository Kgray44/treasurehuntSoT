import { NextResponse } from "next/server";

import { deleteComment, updateComment } from "@/community/social";
import { executeSocialAction, executeSocialMutation } from "@/app/api/community/social/contract";

import { commentUpdateInputSchema } from "../contract";

const validId = (id: string) => /^[A-Za-z0-9_-]{1,128}$/.test(id);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!validId(id)) return NextResponse.json({ code: "COMMUNITY_INVALID_INPUT", error: "Comment identifier is invalid." }, { status: 400 });
  return executeSocialMutation(request, commentUpdateInputSchema, (actor, input) => updateComment(actor, id, input.body, input.spoilerBody));
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!validId(id)) return NextResponse.json({ code: "COMMUNITY_INVALID_INPUT", error: "Comment identifier is invalid." }, { status: 400 });
  return executeSocialAction(request, (actor) => deleteComment(actor, id));
}
