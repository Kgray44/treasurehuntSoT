import { NextResponse } from "next/server";
import { z } from "zod";
import { transitionModerationCase } from "@/community/moderation";
import { canonicalCommunityActor, denied, expectedRevision, reasonCode, routeError } from "../../../contract";

const schema = z.object({ expectedRevision, nextStatus: z.string().trim().max(64), reasonCode }).strict();
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await canonicalCommunityActor(request);
  if (!actor) return denied();
  try {
    return NextResponse.json(
      await transitionModerationCase(actor, {
        ...schema.parse(await request.json()),
        caseId: (await context.params).id,
      }),
    );
  } catch (cause) {
    return routeError(cause);
  }
}
