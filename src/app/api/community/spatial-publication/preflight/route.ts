import { NextResponse } from "next/server";
import { requireCanonicalAccountIdentity, verifyPlayerCsrf } from "@/platform/auth";
import { communityApiError } from "@/community/api";
import { preflightSpatialPublication } from "@/community/spatial-publication";

export async function POST(request: Request) {
  const actor = await requireCanonicalAccountIdentity();
  if (!actor || !(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
    return NextResponse.json(
      { code: "COMMUNITY_ACCESS_DENIED", error: "Creator access and CSRF verification required." },
      { status: 403 },
    );
  try {
    return NextResponse.json(await preflightSpatialPublication(actor.accountId, await request.json()), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (cause) {
    return communityApiError(cause);
  }
}
