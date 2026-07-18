import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireGmCapability } from "@/lib/security";
import { getTaleSessionState } from "@/tall-tale/progression";
import { apiError } from "@/tall-tale/api";

export async function GET(_: Request, context: { params: Promise<{ playthroughId: string }> }) {
  const captain = await requireGmCapability("CAPTAIN");
  if (!captain) return NextResponse.json({ error: "Captain authentication required." }, { status: 401 });
  const playthroughId = (await context.params).playthroughId;
  const assigned = await db.taleSession.findFirst({
    where: { id: playthroughId, previewMode: false, OR: [{ captainId: captain.userId }, { captainId: null }] },
    select: { id: true },
  });
  if (!assigned) return NextResponse.json({ error: "Voyage not found." }, { status: 404 });
  try {
    return NextResponse.json({
      preview: await getTaleSessionState(playthroughId, undefined, false, true),
      mutating: false,
    });
  } catch (cause) {
    return apiError(cause);
  }
}
