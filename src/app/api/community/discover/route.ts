import { NextRequest, NextResponse } from "next/server";
import { CommunityError } from "@/community/domain";
import {
  communitySortModes,
  discoveryAccessibilityFeatures,
  discoveryDifficulties,
  discoveryEnvironments,
  type CommunityDiscoveryFilters,
  type CommunitySortMode,
} from "@/community/discovery";
import { parseHomeportDurationFilter, parseHomeportPlayerFilter, searchHomeportCommunity } from "@/community/homeport";
import { consumeConfiguredCommunityRateLimit } from "@/community/rate-limit";
import { requireCanonicalAccountIdentity } from "@/platform/auth";

const groupedTypes: Readonly<Record<string, readonly string[]>> = {
  CHRONICLE: ["CHRONICLE"],
  ARTIFACT: ["ARTIFACT_2D", "ARTIFACT_3D", "ARTIFACT_COLLECTION"],
  TEMPLATE: ["CHRONICLE_TEMPLATE", "STORY_BLOCK_PRESET"],
  MAP: ["MAP_PACK", "LOCATION_PACK"],
  AUDIO: ["AUDIO_PACK", "REVEAL_PRESET", "INVITATION_STYLE", "COMPLETION_STYLE"],
};

export async function GET(request: NextRequest) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  if (
    !(
      await consumeConfiguredCommunityRateLimit(
        { scope: "community-discovery", network: address, action: "search" },
        60,
        60_000,
      )
    ).allowed
  )
    return NextResponse.json(
      { code: "COMMUNITY_RATE_LIMITED", message: "Please wait before searching again." },
      { status: 429 },
    );
  try {
    const { searchParams } = request.nextUrl;
    const filters = parseFilters(searchParams);
    const rawSort = searchParams.get("sort") ?? "FEATURED";
    if (!communitySortModes.includes(rawSort as CommunitySortMode))
      throw new CommunityError("COMMUNITY_DISCOVERY_FILTER_INVALID", "The selected result order is not supported.");
    const sort = rawSort as CommunitySortMode;
    const pageSize = searchParams.get("pageSize");
    const identity = await requireCanonicalAccountIdentity();
    const result = await searchHomeportCommunity({
      query: searchParams.get("q"),
      filters,
      sort,
      cursor: searchParams.get("cursor") ?? undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      viewerAccountId: identity?.accountId,
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

function parseFilters(searchParams: URLSearchParams): Partial<CommunityDiscoveryFilters> {
  const requestedTypes = searchParams.getAll("type");
  const itemTypes = [
    ...new Set(requestedTypes.flatMap((type) => groupedTypes[type] ?? (isKnownItemType(type) ? [type] : []))),
  ] as CommunityDiscoveryFilters["itemTypes"];
  if (requestedTypes.length && !itemTypes.length)
    throw new CommunityError("COMMUNITY_DISCOVERY_FILTER_INVALID", "The selected content type is not supported.");

  const rawDifficulties = searchParams.getAll("difficulty");
  if (rawDifficulties.some((value) => !discoveryDifficulties.includes(value as never)))
    throw new CommunityError("COMMUNITY_DISCOVERY_FILTER_INVALID", "The selected difficulty is not supported.");
  const difficulties = rawDifficulties as CommunityDiscoveryFilters["difficulties"];
  const rawEnvironments = searchParams.getAll("environment");
  if (rawEnvironments.some((value) => !discoveryEnvironments.includes(value as never)))
    throw new CommunityError("COMMUNITY_DISCOVERY_FILTER_INVALID", "The selected environment is not supported.");
  const environments = rawEnvironments as CommunityDiscoveryFilters["environments"];
  const rawAccessibilityFeatures = searchParams.getAll("accessibility");
  if (rawAccessibilityFeatures.some((value) => !discoveryAccessibilityFeatures.includes(value as never)))
    throw new CommunityError(
      "COMMUNITY_DISCOVERY_FILTER_INVALID",
      "The selected accessibility filter is not supported.",
    );
  const accessibilityFeatures = rawAccessibilityFeatures as CommunityDiscoveryFilters["accessibilityFeatures"];
  const themes = searchParams
    .getAll("theme")
    .map((value) => value.trim())
    .filter(Boolean);
  if (themes.some((value) => value.length > 48))
    throw new CommunityError("COMMUNITY_DISCOVERY_FILTER_INVALID", "Theme filters may contain at most 48 characters.");

  return {
    ...(itemTypes.length ? { itemTypes } : {}),
    ...(difficulties.length ? { difficulties } : {}),
    ...(environments.length ? { environments } : {}),
    ...(accessibilityFeatures.length ? { accessibilityFeatures } : {}),
    ...(themes.length ? { themes } : {}),
    ...parseHomeportDurationFilter(searchParams.get("duration")),
    ...parseHomeportPlayerFilter(searchParams.get("players")),
    ...(searchParams.get("free") === "1" ? { freeOnly: true } : {}),
    ...(searchParams.get("remixable") === "1" ? { remixable: true } : {}),
  };
}

function isKnownItemType(value: string) {
  return [
    "CHRONICLE",
    "CHRONICLE_TEMPLATE",
    "STORY_BLOCK_PRESET",
    "ARTIFACT_2D",
    "ARTIFACT_3D",
    "ARTIFACT_COLLECTION",
    "MAP_PACK",
    "LOCATION_PACK",
    "AUDIO_PACK",
    "REVEAL_PRESET",
    "INVITATION_STYLE",
    "COMPLETION_STYLE",
  ].includes(value);
}
