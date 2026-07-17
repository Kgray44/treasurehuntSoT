import { NextResponse } from "next/server";
import { apiError } from "@/tall-tale/api";
import { getTaleSessionState, interactWithTaleSession } from "@/tall-tale/progression";
import { readTaleSessionCookie } from "@/tall-tale/session-cookie";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export async function GET(_: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await context.params;
    const access = await readTaleSessionCookie(sessionId);
    if (!access) return NextResponse.json({ error: "Voyage session required." }, { status: 401 });
    return NextResponse.json(await getTaleSessionState(sessionId, access.token));
  } catch (cause) {
    return apiError(cause);
  }
}

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await context.params;
    const access = await readTaleSessionCookie(sessionId);
    if (!access) return NextResponse.json({ error: "Voyage session required." }, { status: 401 });
    const rate = consumeRateLimit(`tale-player:${sessionId}`, { limit: 45, windowMs: 60_000 });
    if (!rate.allowed)
      return NextResponse.json(
        { error: "Too many voyage actions. Wait a moment before trying again." },
        { status: 429, headers: rateLimitHeaders(rate) },
      );
    return NextResponse.json(await interactWithTaleSession(sessionId, access.token, await request.json()));
  } catch (cause) {
    return apiError(cause);
  }
}
