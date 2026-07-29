import { NextResponse } from "next/server";
import { listModerationCases } from "@/community/moderation";
import { canonicalCommunityActor, denied, routeError } from "../contract";

export async function GET(request: Request) {
  const actor = await canonicalCommunityActor();
  if (!actor) return denied();
  const take = Number(new URL(request.url).searchParams.get("take") ?? 50);
  try {
    return NextResponse.json(
      { cases: await listModerationCases(actor, take) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (cause) {
    return routeError(cause);
  }
}
