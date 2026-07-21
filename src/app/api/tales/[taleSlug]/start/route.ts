import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { startTaleSession } from "@/chronicle/progression";
import { setTaleSessionCookie } from "@/chronicle/session-cookie";

export async function POST(request: Request, context: { params: Promise<{ taleSlug: string }> }) {
  try {
    const body = (await request.json().catch(() => ({}))) as { ownerLabel?: string };
    const result = await startTaleSession((await context.params).taleSlug, body.ownerLabel);
    await setTaleSessionCookie(result.sessionId, result.token);
    return NextResponse.json(
      { sessionId: result.sessionId, url: `/play/${result.taleSlug}/session/${result.sessionId}` },
      { status: 201 },
    );
  } catch (cause) {
    return apiError(cause);
  }
}
