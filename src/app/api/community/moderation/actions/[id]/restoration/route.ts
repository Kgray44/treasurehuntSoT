import { NextResponse } from "next/server";
import { z } from "zod";
import { restoreModerationAction } from "@/community/moderation";
import { canonicalCommunityActor, denied, opaqueId, routeError } from "../../../contract";

const checksum = z.string().regex(/^[a-f0-9]{64}$/u);
const schema = z
  .object({ scanReceiptId: opaqueId, objectChecksum: checksum, packageChecksum: checksum.optional() })
  .strict();
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await canonicalCommunityActor(request);
  if (!actor) return denied();
  try {
    return NextResponse.json(
      await restoreModerationAction(actor, {
        actionId: (await context.params).id,
        ...schema.parse(await request.json()),
      }),
      { status: 201 },
    );
  } catch (cause) {
    return routeError(cause);
  }
}
