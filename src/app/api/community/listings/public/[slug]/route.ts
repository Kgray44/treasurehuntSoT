import { NextResponse } from "next/server";
import { getPublicListingBySlug } from "@/community/services";

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const listing = await getPublicListingBySlug((await context.params).slug);
  return listing
    ? NextResponse.json(listing)
    : NextResponse.json({ code: "COMMUNITY_LISTING_NOT_FOUND", error: "Listing not found." }, { status: 404 });
}
