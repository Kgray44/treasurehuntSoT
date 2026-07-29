import { NextResponse } from "next/server";
import { z } from "zod";
import { transitionModerationAppeal } from "@/community/moderation";
import { canonicalCommunityActor, denied, reasonCode, routeError } from "../../../contract";

const schema = z.object({ nextStatus: z.string().trim().max(64), reasonCode }).strict();
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await canonicalCommunityActor(request);
  if (!actor) return denied();
  try {
    return NextResponse.json(
      await transitionModerationAppeal(actor, {
        appealId: (await context.params).id,
        ...schema.parse(await request.json()),
      }),
    );
  } catch (cause) {
    return routeError(cause);
  }
}
