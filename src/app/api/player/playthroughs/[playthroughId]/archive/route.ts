import { NextResponse } from "next/server";
import { requirePlayerIdentity } from "@/platform/auth";
import { getPlayerArchive } from "@/platform/libraries";

export async function GET(_: Request, context: { params: Promise<{ playthroughId: string }> }) {
  const session = await requirePlayerIdentity();
  if (!session) return NextResponse.json({ error: "Player sign-in required." }, { status: 401 });
  const result = await getPlayerArchive(session.playerProfileId, (await context.params).playthroughId);
  return result
    ? NextResponse.json(result)
    : NextResponse.json({ error: "Voyage archive not found." }, { status: 404 });
}
