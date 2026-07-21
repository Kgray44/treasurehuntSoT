import { NextResponse } from "next/server";
import { requirePlayerIdentity, verifyPlayerCsrf } from "@/platform/auth";
import { communityApiError } from "@/community/api";
import { createRelease } from "@/community/services";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await requirePlayerIdentity();
  if (!identity || !(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
    return NextResponse.json(
      { code: "COMMUNITY_ACCESS_DENIED", error: "A valid signed-in session is required." },
      { status: 403 },
    );
  try {
    return NextResponse.json(
      await createRelease(
        { playerProfileId: identity.playerProfileId },
        (await context.params).id,
        await request.json(),
      ),
      { status: 201 },
    );
  } catch (cause) {
    return communityApiError(cause);
  }
}
