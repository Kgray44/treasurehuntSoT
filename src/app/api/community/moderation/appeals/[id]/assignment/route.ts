import { NextResponse } from "next/server";
import { z } from "zod";
import { assignModerationAppeal } from "@/community/moderation";
import { canonicalCommunityActor, denied, opaqueId, routeError } from "../../../contract";

const schema = z.object({ moderatorAccountId: opaqueId }).strict();
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await canonicalCommunityActor(request);
  if (!actor) return denied();
  try {
    return NextResponse.json(
      await assignModerationAppeal(actor, {
        appealId: (await context.params).id,
        ...schema.parse(await request.json()),
      }),
    );
  } catch (cause) {
    return routeError(cause);
  }
}
