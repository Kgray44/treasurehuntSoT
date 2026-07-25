import { NextResponse } from "next/server";
import { archiveCollection, tombstoneCollection, updateCollection } from "@/community/social";
import { executeSocialAction, executeSocialMutation } from "../../social/contract";
import { updateCollectionInputSchema } from "../contract";

function valid(id: string) { return /^[A-Za-z0-9_-]{1,128}$/.test(id); }
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!valid(id)) return NextResponse.json({ code: "COMMUNITY_INVALID_INPUT", error: "The Community request is invalid." }, { status: 400 });
  return executeSocialMutation(request, updateCollectionInputSchema, (actor, input) => updateCollection(actor, { collectionId: id, ...input }));
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!valid(id)) return NextResponse.json({ code: "COMMUNITY_INVALID_INPUT", error: "The Community request is invalid." }, { status: 400 });
  return new URL(request.url).searchParams.get("action") === "archive"
    ? executeSocialAction(request, (actor) => archiveCollection(actor, id))
    : executeSocialAction(request, (actor) => tombstoneCollection(actor, id));
}
