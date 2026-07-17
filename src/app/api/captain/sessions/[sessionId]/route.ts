import { NextResponse } from "next/server";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { captainSessionAction, getTaleSessionState } from "@/tall-tale/progression";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export async function GET(_: Request, context: { params: Promise<{ sessionId: string }> }) {
  if (!(await requireGmCapability("CAPTAIN")))
    return NextResponse.json({ error: "Captain authentication required." }, { status: 401 });
  try {
    return NextResponse.json(await getTaleSessionState((await context.params).sessionId, undefined, true));
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
