import { NextResponse } from "next/server";
import { requireCanonicalAccountIdentity, verifyPlayerCsrf } from "@/platform/auth";
import { communityApiError } from "@/community/api";
import { createProfile, getOwnProfile } from "@/community/services";
export async function GET() {
  const identity = await requireCanonicalAccountIdentity();
  if (!identity)
    return NextResponse.json(
      { code: "COMMUNITY_ACCESS_DENIED", error: "Sign in to view your Community Profile." },
      { status: 401 },
    );
  try {
    return NextResponse.json(await getOwnProfile({ accountId: identity.accountId }));
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
    return NextResponse.json(await createProfile({ accountId: identity.accountId }, await request.json()), {
      status: 201,
    });
  } catch (cause) {
    return communityApiError(cause);
  }
}
