import { NextResponse } from "next/server";
import { requirePlayerIdentity } from "@/platform/auth";
import { getPlayerPlaythrough } from "@/platform/libraries";

export async function GET(_: Request, context: { params: Promise<{ playthroughId: string }> }) {
  const session = await requirePlayerIdentity();
  if (!session) return NextResponse.json({ error: "Player sign-in required." }, { status: 401 });
  const result = await getPlayerPlaythrough(session.playerProfileId, (await context.params).playthroughId);
  return result
    ? NextResponse.json({ playthrough: result, csrfToken: session.csrfToken, serverTime: new Date().toISOString() })
    : NextResponse.json({ error: "Voyage not found." }, { status: 404 });
}
