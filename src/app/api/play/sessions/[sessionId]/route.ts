import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { getTaleSessionState, interactWithTaleSession } from "@/chronicle/progression";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { authorizeTaleSessionPlayer, verifyPlayerCsrf } from "@/platform/auth";

export async function GET(_: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await context.params;
    const access = await authorizeTaleSessionPlayer(sessionId);
    if (!access) return NextResponse.json({ error: "Sign in to access this Voyage." }, { status: 401 });
    return NextResponse.json({
      ...(await getTaleSessionState(
        sessionId,
        access.kind === "legacy" ? access.token : undefined,
        false,
        access.kind === "identity",
      )),
      csrfToken: access.kind === "identity" ? access.csrfToken : undefined,
    });
  } catch (cause) {
    return apiError(cause);
  }
}

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await context.params;
    const access = await authorizeTaleSessionPlayer(sessionId);
    if (!access) return NextResponse.json({ error: "Sign in to access this Voyage." }, { status: 401 });
    if (access.kind === "identity" && !(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
      return NextResponse.json({ error: "The Player session expired." }, { status: 403 });
    const rate = consumeRateLimit(`tale-player:${sessionId}`, { limit: 45, windowMs: 60_000 });
    if (!rate.allowed)
      return NextResponse.json(
        { error: "Too many voyage actions. Wait a moment before trying again." },
        { status: 429, headers: rateLimitHeaders(rate) },
      );
    return NextResponse.json(
      await interactWithTaleSession(
        sessionId,
        access.kind === "legacy" ? access.token : undefined,
        await request.json(),
        access.kind === "identity",
      ),
    );
  } catch (cause) {
    return apiError(cause);
  }
}
