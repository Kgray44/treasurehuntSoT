import { NextResponse } from "next/server";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { startPreviewSession } from "@/tall-tale/progression";
import { setTaleSessionCookie } from "@/tall-tale/session-cookie";

export async function POST(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const session = await requireGmCapability("CREATE_TALES");
  if (!session) return NextResponse.json({ error: "Sign in with a creator account to continue." }, { status: 401 });
  if (!(await verifyCsrf(session)))
    return NextResponse.json({ error: "Your creator session has expired. Reload the page and try again." }, { status: 403 });
  try {
    const body = (await request.json().catch(() => ({}))) as { blockId?: string };
    const preview = await startPreviewSession((await context.params).taleId, session.userId, body.blockId);
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
