import { NextResponse } from "next/server";
import { z } from "zod";
import { attachMemoryMedia } from "@/wakebook/memory-media";
import { requireWayfarerAccount } from "@/wayfarer/http";

const attachSchema = z.object({ mediaId: z.string().trim().min(1).max(191) }).strict();

export async function POST(request: Request, context: { params: Promise<{ recordId: string; memoryId: string }> }) {
  const session = await requireWayfarerAccount(request);
  if (!session?.account.profile)
    return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    const params = await context.params;
    return NextResponse.json(
      await attachMemoryMedia({
        ownerAccountId: session.account.id,
        playerProfileId: session.account.profile.id,
        recordId: params.recordId,
        memoryId: params.memoryId,
        mediaId: attachSchema.parse(await request.json()).mediaId,
      }),
    );
  } catch {
    return NextResponse.json({ error: "Private media could not be attached to this Memory." }, { status: 400 });
  }
}
