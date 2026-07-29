import { NextResponse } from "next/server";
import { getModerationCase } from "@/community/moderation";
import { canonicalCommunityActor, denied, routeError } from "../../contract";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await canonicalCommunityActor();
  if (!actor) return denied();
  try {
    return NextResponse.json(await getModerationCase(actor, (await context.params).id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (cause) {
    return routeError(cause);
  }
}
