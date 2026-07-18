import { NextResponse } from "next/server";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { captainSessionAction, getTaleSessionState } from "@/tall-tale/progression";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export async function GET(_: Request, context: { params: Promise<{ sessionId: string }> }) {
  const captain = await requireGmCapability("CAPTAIN");
  if (!captain) return NextResponse.json({ error: "Captain authentication required." }, { status: 401 });
  try {
    const sessionId = (await context.params).sessionId;
    const assigned = await db.taleSession.findFirst({
      where: { id: sessionId, OR: [{ captainId: captain.userId }, { captainId: null }] },
      select: { id: true },
    });
    if (!assigned) return NextResponse.json({ error: "Voyage not found." }, { status: 404 });
    return NextResponse.json(await getTaleSessionState(sessionId, undefined, true));
  } catch (cause) {
    return apiError(cause);
  }
}

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const session = await requireGmCapability("CAPTAIN");
  if (!session) return NextResponse.json({ error: "Captain authentication required." }, { status: 401 });
  if (!(await verifyCsrf(session)))
    return NextResponse.json({ error: "The Captain session expired." }, { status: 403 });
  try {
    const rate = consumeRateLimit(`tale-captain:${session.userId}`, { limit: 60, windowMs: 60_000 });
    if (!rate.allowed)
      return NextResponse.json(
        { error: "Too many Captain actions. Wait a moment before trying again." },
        { status: 429, headers: rateLimitHeaders(rate) },
      );
    return NextResponse.json(
      await captainSessionAction((await context.params).sessionId, session.userId, await request.json()),
    );
  } catch (cause) {
    return apiError(cause);
  }
}
