import { NextResponse } from "next/server";
import { requireCanonicalAccountIdentity, verifyPlayerCsrf } from "@/platform/auth";
import { communityApiError } from "@/community/api";
import { getOwnerListing, updateListing } from "@/community/services";
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await requireCanonicalAccountIdentity();
  if (!identity)
    return NextResponse.json({ code: "COMMUNITY_ACCESS_DENIED", error: "Sign in required." }, { status: 401 });
  try {
    return NextResponse.json(
      await getOwnerListing({ accountId: identity.accountId }, (await context.params).id),
    );
  } catch (cause) {
    return communityApiError(cause);
  }
}
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await requireCanonicalAccountIdentity();
  if (!identity || !(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
    return NextResponse.json(
      { code: "COMMUNITY_ACCESS_DENIED", error: "A valid signed-in session is required." },
      { status: 403 },
    );
  try {
    return NextResponse.json(
      await updateListing(
        { accountId: identity.accountId },
        (await context.params).id,
        await request.json(),
      ),
    );
  } catch (cause) {
    return communityApiError(cause);
  }
}
