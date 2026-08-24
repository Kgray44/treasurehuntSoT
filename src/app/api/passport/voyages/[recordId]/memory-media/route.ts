import { NextResponse } from "next/server";
import { listAvailableMemoryMedia } from "@/wakebook/memory-media";
import { requireWayfarerAccount } from "@/wayfarer/http";

export async function GET(_request: Request, context: { params: Promise<{ recordId: string }> }) {
  const session = await requireWayfarerAccount();
  if (!session?.account.profile)
    return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 401 });
  try {
    const { recordId } = await context.params;
    return NextResponse.json(await listAvailableMemoryMedia(session.account.id, session.account.profile.id, recordId), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Voyage history was not found." }, { status: 404 });
  }
}
