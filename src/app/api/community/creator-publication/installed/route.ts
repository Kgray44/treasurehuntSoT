import { NextResponse } from "next/server";
import { requireStudioWorkspace } from "@/chronicle/studio-authorization";
import { communityApiError } from "@/community/api";
import { listCreatorInstalledCommunityItems } from "@/community/creator-installed-library";

export async function GET() {
  const actor = await requireStudioWorkspace();
  if (!actor)
    return NextResponse.json({ code: "COMMUNITY_ACCESS_DENIED", error: "Creator access required." }, { status: 403 });
  try {
    return NextResponse.json(
      { items: await listCreatorInstalledCommunityItems(actor.accountId) },
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (cause) {
    return communityApiError(cause);
  }
}
