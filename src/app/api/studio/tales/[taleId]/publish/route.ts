import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { publishTale } from "@/chronicle/publishing";

export async function POST(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  const authorization = await requireOwnedStudioTale(taleId, request);
  if (!authorization)
    return NextResponse.json({ error: "This Chronicle is not available to this Creator account." }, { status: 404 });
  try {
    const body = (await request.json().catch(() => ({}))) as { releaseNotes?: string; autosaveVersion?: number };
    return NextResponse.json(
      await publishTale(taleId, authorization.session.accountId, body.releaseNotes ?? "", body.autosaveVersion),
    );
  } catch (cause) {
    return apiError(cause);
  }
}
