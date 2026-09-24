import { NextResponse } from "next/server";
import { z } from "zod";
import { musterIdentity, musterError } from "@/muster/http";
import { recordArrival } from "@/muster/arrival";
import { EMBARKATION_VERSION } from "@/animation/embarkation/program";
const receipt = z
  .object({
    program: z.literal(EMBARKATION_VERSION),
    readable: z.literal(true),
    reason: z.enum(["completed", "skipped", "fallback"]),
  })
  .strict();
export async function POST(request: Request, context: { params: Promise<{ voyageId: string }> }) {
  try {
    const { actor } = await musterIdentity(request);
    receipt.parse(await request.json());
    await recordArrival((await context.params).voyageId, actor);
    return NextResponse.json({ presented: true });
  } catch (cause) {
    return musterError(cause);
  }
}
