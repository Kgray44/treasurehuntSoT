import { NextResponse } from "next/server";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { startPublishedPreviewSession } from "@/tall-tale/progression";
import { setTaleSessionCookie } from "@/tall-tale/session-cookie";
import { forkPublishedVersion, restorePublishedVersionToDraft } from "@/tall-tale/studio-service";

async function authorize() {
  const session = await requireGmCapability("CREATE_TALES");
  return session && (await verifyCsrf(session)) ? session : null;
}

export async function POST(request: Request, context: { params: Promise<{ taleId: string; versionId: string }> }) {
  const session = await authorize();
  if (!session) return NextResponse.json({ error: "A current creator session is required." }, { status: 403 });
  try {
    const { action } = (await request.json()) as { action: "preview" | "restore" | "fork" };
    const { taleId, versionId } = await context.params;
    if (action === "restore")
      return NextResponse.json(await restorePublishedVersionToDraft(taleId, versionId, session.userId));
    if (action === "fork") return NextResponse.json(await forkPublishedVersion(taleId, versionId, session.userId));
    if (action === "preview") {
      const preview = await startPublishedPreviewSession(taleId, versionId, session.userId);
      await setTaleSessionCookie(preview.sessionId, preview.token);
      return NextResponse.json({
        ...preview,
        token: undefined,
        url: `/play/${preview.taleSlug}/session/${preview.sessionId}`,
      });
    }
    return NextResponse.json({ error: "Unknown version action." }, { status: 400 });
  } catch (cause) {
    return apiError(cause);
  }
}
