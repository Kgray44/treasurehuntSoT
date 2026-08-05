import { NextResponse } from "next/server";

import { communityApiError } from "@/community/api";
import { createOrUpdateReview, listPublicReviews } from "@/community/social";
import { executeSocialMutation } from "@/app/api/community/social/contract";
import { requireCanonicalAccountIdentity } from "@/platform/auth";

import { listingQuerySchema, reviewInputSchema } from "./contract";

export async function GET(request: Request) {
  const parsed = listingQuerySchema.safeParse({ listingId: new URL(request.url).searchParams.get("listingId") ?? "" });
  if (!parsed.success)
    return NextResponse.json(
      { code: "COMMUNITY_INVALID_INPUT", error: "A valid listing is required." },
      { status: 400 },
    );
  try {
    const identity = await requireCanonicalAccountIdentity();
    return NextResponse.json({ reviews: await listPublicReviews(parsed.data.listingId, identity?.accountId) });
  } catch (cause) {
    return communityApiError(cause);
  }
}

export async function POST(request: Request) {
  return executeSocialMutation(request, reviewInputSchema, createOrUpdateReview, 201);
}
