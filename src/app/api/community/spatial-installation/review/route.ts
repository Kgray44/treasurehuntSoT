import { NextResponse } from "next/server";
import { requireCanonicalAccountIdentity } from "@/platform/auth";
import { communityApiError } from "@/community/api";
import { reviewSpatialInstallation } from "@/community/spatial-installation";

export async function GET(request: Request) {
  const actor = await requireCanonicalAccountIdentity();
  if (!actor)
    return NextResponse.json(
      { code: "COMMUNITY_ACCESS_DENIED", error: "Sign in before installing Community content." },
      { status: 403 },
    );
  try {
    const listingId = new URL(request.url).searchParams.get("listingId");
    if (!listingId || listingId.length > 128)
      return NextResponse.json(
        { code: "COMMUNITY_INVALID_REQUEST", error: "Choose a Community listing." },
        { status: 400 },
      );
    return NextResponse.json(await reviewSpatialInstallation(actor.accountId, listingId), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (cause) {
    return communityApiError(cause);
  }
}
