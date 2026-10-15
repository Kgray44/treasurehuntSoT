import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCanonicalAccountIdentity, verifyPlayerCsrf } from "@/platform/auth";
import { communityApiError } from "@/community/api";
import { installSpatialCommunityRelease } from "@/community/spatial-installation";

const inputSchema = z.strictObject({
  listingId: z.string().min(1).max(128),
  releaseId: z.string().min(1).max(128),
  packageChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  requestId: z.string().uuid(),
});

export async function POST(request: Request) {
  const actor = await requireCanonicalAccountIdentity();
  if (!actor || !(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
    return NextResponse.json(
      { code: "COMMUNITY_ACCESS_DENIED", error: "Signed-in session and CSRF verification required." },
      { status: 403 },
    );
  try {
    const input = inputSchema.parse(await request.json());
    return NextResponse.json(await installSpatialCommunityRelease({ ...input, accountId: actor.accountId }), {
      status: 201,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (cause) {
    return communityApiError(cause);
  }
}
