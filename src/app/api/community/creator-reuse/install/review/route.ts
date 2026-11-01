import { NextResponse } from "next/server";
import { requireStudioWorkspace } from "@/chronicle/studio-authorization";
import { communityApiError } from "@/community/api";
import { reviewCreatorReusableInstallation } from "@/community/creator-reusable-installation";

export async function GET(request: Request) {
  const actor = await requireStudioWorkspace();
  if (!actor)
    return NextResponse.json({ code: "COMMUNITY_ACCESS_DENIED", error: "Creator access required." }, { status: 403 });
  const listingId = new URL(request.url).searchParams.get("listingId");
  if (!listingId || listingId.length > 128)
    return NextResponse.json(
      { code: "COMMUNITY_INVALID_REQUEST", error: "Choose a Community listing." },
      { status: 400 },
    );
  try {
    return NextResponse.json(await reviewCreatorReusableInstallation(actor.accountId, listingId), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (cause) {
    return communityApiError(cause);
  }
}
