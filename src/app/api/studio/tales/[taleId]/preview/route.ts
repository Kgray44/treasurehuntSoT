import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { startPreviewSession } from "@/chronicle/progression";
import { setTaleSessionCookie } from "@/chronicle/session-cookie";

export async function POST(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  const authorization = await requireOwnedStudioTale(taleId, request);
  if (!authorization)
    return NextResponse.json({ error: "This Chronicle is not available to this Creator account." }, { status: 404 });
  try {
    const body = (await request.json().catch(() => ({}))) as { blockId?: string };
    const preview = await startPreviewSession(taleId, authorization.session.accountId, body.blockId);
    await setTaleSessionCookie(preview.sessionId, preview.token);
    return NextResponse.json({
      ...preview,
      token: undefined,
      url: `/play/${preview.taleSlug}/session/${preview.sessionId}`,
    });
  } catch (cause) {
    return apiError(cause);
  }
}
