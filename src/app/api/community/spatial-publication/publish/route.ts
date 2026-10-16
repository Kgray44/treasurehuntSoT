import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCanonicalAccountIdentity, verifyPlayerCsrf } from "@/platform/auth";
import { communityApiError } from "@/community/api";
import { publishSpatialToCommunity, spatialPublicationInputSchema } from "@/community/spatial-publication";

const requestSchema = z.strictObject({
  publication: spatialPublicationInputSchema,
  reviewDigest: z.string().regex(/^[a-f0-9]{64}$/),
});

export async function POST(request: Request) {
  const actor = await requireCanonicalAccountIdentity();
  if (!actor || !(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
    return NextResponse.json(
      { code: "COMMUNITY_ACCESS_DENIED", error: "Creator access and CSRF verification required." },
      { status: 403 },
    );
  try {
    const input = requestSchema.parse(await request.json());
    return NextResponse.json(await publishSpatialToCommunity(actor.accountId, input.publication, input.reviewDigest), {
      status: 201,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (cause) {
    return communityApiError(cause);
  }
}
