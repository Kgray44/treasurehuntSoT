import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { startPublishedPreviewSession } from "@/chronicle/progression";
import { setTaleSessionCookie } from "@/chronicle/session-cookie";
import { forkPublishedVersion, restorePublishedVersionToDraft } from "@/chronicle/studio-service";

export async function POST(request: Request, context: { params: Promise<{ taleId: string; versionId: string }> }) {
  const { taleId, versionId } = await context.params;
  const authorization = await requireOwnedStudioTale(taleId, request);
  if (!authorization)
    return NextResponse.json({ error: "This Chronicle is not available to this Creator account." }, { status: 404 });
  try {
    const { action } = (await request.json()) as { action: "preview" | "restore" | "fork" };
    if (action === "restore")
      return NextResponse.json(
        await restorePublishedVersionToDraft(taleId, versionId, authorization.session.accountId),
      );
    if (action === "fork")
      return NextResponse.json(await forkPublishedVersion(taleId, versionId, authorization.session.accountId));
    if (action === "preview") {
      const preview = await startPublishedPreviewSession(taleId, versionId, authorization.session.accountId);
      await setTaleSessionCookie(preview.sessionId, preview.token);
      return NextResponse.json({
        ...preview,
        token: undefined,
        url: `/play/${preview.taleSlug}/session/${preview.sessionId}`,
      });
    }
    return NextResponse.json({ error: "That Version action is not available." }, { status: 400 });
  } catch (cause) {
    return apiError(cause);
  }
}
