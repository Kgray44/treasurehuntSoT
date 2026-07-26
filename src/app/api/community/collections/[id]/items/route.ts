import { NextResponse } from "next/server";
import { addCollectionItem, removeCollectionItem } from "@/community/social";
import { executeSocialMutation } from "../../../social/contract";
import { addCollectionItemInputSchema, removeCollectionItemInputSchema } from "../../../collections/contract";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id))
    return NextResponse.json(
      { code: "COMMUNITY_INVALID_INPUT", error: "The Community request is invalid." },
      { status: 400 },
    );
  return executeSocialMutation(
    request,
    addCollectionItemInputSchema,
    (actor, input) => addCollectionItem(actor, { collectionId: id, ...input }),
    201,
  );
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id))
    return NextResponse.json(
      { code: "COMMUNITY_INVALID_INPUT", error: "The Community request is invalid." },
      { status: 400 },
    );
  return executeSocialMutation(request, removeCollectionItemInputSchema, (actor, input) =>
    removeCollectionItem(actor, id, input.itemId),
  );
}
