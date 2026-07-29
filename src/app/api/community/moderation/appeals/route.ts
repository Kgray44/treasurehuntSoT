import { NextResponse } from "next/server";
import { z } from "zod";
import { submitAppeal } from "@/community/moderation";
import { canonicalCommunityActor, denied, opaqueId, routeError } from "../contract";

const schema = z.object({ actionId: opaqueId, reason: z.string().trim().min(2).max(2000) }).strict();
export async function POST(request: Request) {
  const actor = await canonicalCommunityActor(request);
  if (!actor) return denied();
  try {
    return NextResponse.json(await submitAppeal(actor, schema.parse(await request.json())), { status: 201 });
  } catch (cause) {
    return routeError(cause);
  }
}
