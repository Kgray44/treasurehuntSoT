import { NextResponse } from "next/server";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { apiError } from "@/chronicle/api";
import { captainSessionAction, getTaleSessionState } from "@/chronicle/progression";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export async function GET(_: Request, context: { params: Promise<{ sessionId: string }> }) {
  const captain = await requireGmCapability("CAPTAIN");
  if (!captain)
    return NextResponse.json({ error: "Sign in to Captain's Console to open this Voyage." }, { status: 401 });
  try {
    const sessionId = (await context.params).sessionId;
    const assigned = await db.taleSession.findFirst({
      where: { id: sessionId, OR: [{ captainId: captain.userId }, { captainId: null }] },
      select: { id: true },
    });
    if (!assigned)
      return NextResponse.json(
        { error: "This Voyage is unavailable. Return to Captain's Console and choose another Voyage." },
        { status: 404 },
      );
    return NextResponse.json(await getTaleSessionState(sessionId, undefined, true));
  } catch (cause) {
    return apiError(cause);
  }
}

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const session = await requireGmCapability("CAPTAIN");
  if (!session)
    return NextResponse.json({ error: "Sign in to Captain's Console to control this Voyage." }, { status: 401 });
  if (!(await verifyCsrf(session)))
    return NextResponse.json(
      { error: "Your Captain session expired. Sign in again; no Voyage progress has changed." },
      { status: 403 },
    );
  try {
    const rate = consumeRateLimit(`tale-captain:${session.userId}`, { limit: 60, windowMs: 60_000 });
    if (!rate.allowed)
      return NextResponse.json(
        { error: "Too many Captain actions were requested. Wait a moment, review the Voyage status, then try again." },
        { status: 429, headers: rateLimitHeaders(rate) },
      );
    return NextResponse.json(
      await captainSessionAction((await context.params).sessionId, session.userId, await request.json()),
    );
  } catch (cause) {
    return apiError(cause);
  }
}
