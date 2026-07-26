import { NextRequest, NextResponse } from "next/server";
import { CommunityError } from "@/community/domain";
import { databaseCommunitySearchProvider, type CommunitySortMode } from "@/community/discovery";
import { consumeRateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  if (!consumeRateLimit(`community-discovery:${address}`, { limit: 60, windowMs: 60_000 }).allowed)
    return NextResponse.json(
      { code: "COMMUNITY_RATE_LIMITED", message: "Please wait before searching again." },
      { status: 429 },
    );
  try {
    const { searchParams } = request.nextUrl;
    const rawFilters = searchParams.get("filters");
    const filters = rawFilters ? JSON.parse(rawFilters) : undefined;
    const sort = (searchParams.get("sort") ?? "FEATURED") as CommunitySortMode;
    const pageSize = searchParams.get("pageSize");
    const result = await databaseCommunitySearchProvider.search({
      query: searchParams.get("q"),
      filters,
      sort,
      cursor: searchParams.get("cursor") ?? undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, max-age=0, must-revalidate" } });
  } catch (error) {
    if (error instanceof CommunityError)
      return NextResponse.json({ code: error.code, message: error.message }, { status: 400 });
    return NextResponse.json(
      { code: "COMMUNITY_DISCOVERY_UNAVAILABLE", message: "Community discovery is unavailable." },
      { status: 500 },
    );
  }
}
