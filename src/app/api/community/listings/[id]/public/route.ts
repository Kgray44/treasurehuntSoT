import { NextResponse } from "next/server";
import { getPublicListingBySlug } from "@/community/services";

// This segment deliberately shares the canonical [id] name with the sibling
// listing route. Next rejects sibling dynamic segments with different names
// even when one branch continues to /public; the value remains the public slug.
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const listing = await getPublicListingBySlug((await context.params).id);
  return listing
    ? NextResponse.json(listing)
    : NextResponse.json({ code: "COMMUNITY_LISTING_NOT_FOUND", error: "Listing not found." }, { status: 404 });
}
