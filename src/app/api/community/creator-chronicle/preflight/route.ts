import { NextResponse } from "next/server";
import { requireStudioWorkspace } from "@/chronicle/studio-authorization";
import { communityApiError } from "@/community/api";
import { preflightCreatorChroniclePublication } from "@/community/creator-chronicle-publication";

export async function POST(request: Request) {
  const actor = await requireStudioWorkspace();
  if (!actor)
    return NextResponse.json({ code: "COMMUNITY_ACCESS_DENIED", error: "Creator access required." }, { status: 403 });
  try {
    return NextResponse.json(await preflightCreatorChroniclePublication(actor.accountId, await request.json()), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (cause) {
    return communityApiError(cause);
  }
}
