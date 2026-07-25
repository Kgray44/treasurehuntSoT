import { NextResponse } from "next/server";
import { reorderCollection } from "@/community/social";
import { executeSocialMutation } from "../../../social/contract";
import { reorderCollectionInputSchema } from "../../../collections/contract";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id))
    return NextResponse.json({ code: "COMMUNITY_INVALID_INPUT", error: "The Community request is invalid." }, { status: 400 });
  return executeSocialMutation(request, reorderCollectionInputSchema, (actor, input) =>
    reorderCollection(actor, { collectionId: id, ...input }),
  );
}
