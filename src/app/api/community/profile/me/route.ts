import { NextResponse } from "next/server";
import { requirePlayerIdentity, verifyPlayerCsrf } from "@/platform/auth";
import { communityApiError } from "@/community/api";
import { updateOwnProfile } from "@/community/services";
export async function PATCH(request: Request) {
  const identity = await requirePlayerIdentity();
  if (!identity || !(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
    return NextResponse.json(
      { code: "COMMUNITY_ACCESS_DENIED", error: "A valid signed-in session is required." },
      { status: 403 },
    );
  try {
    return NextResponse.json(
      await updateOwnProfile({ playerProfileId: identity.playerProfileId }, await request.json()),
    );
  } catch (cause) {
    return communityApiError(cause);
  }
}
