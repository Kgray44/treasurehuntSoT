import { NextResponse } from "next/server";
import { requireCanonicalAccountIdentity, verifyPlayerCsrf } from "@/platform/auth";
import { communityApiError } from "@/community/api";
import { createListing, listPublicListingsFoundation } from "@/community/services";
export async function GET() {
  try {
    return NextResponse.json({ listings: await listPublicListingsFoundation() });
  } catch (cause) {
    return communityApiError(cause);
  }
}
export async function POST(request: Request) {
  const identity = await requireCanonicalAccountIdentity();
  if (!identity || !(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
    return NextResponse.json(
      { code: "COMMUNITY_ACCESS_DENIED", error: "A valid signed-in session is required." },
      { status: 403 },
    );
  try {
    return NextResponse.json(await createListing({ accountId: identity.accountId }, await request.json()), {
      status: 201,
    });
  } catch (cause) {
    return communityApiError(cause);
  }
}
