import { NextResponse } from "next/server";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { publishTale } from "@/tall-tale/publishing";

export async function POST(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const session = await requireGmCapability("PUBLISH_TALES");
  if (!session) return NextResponse.json({ error: "You do not have permission to publish this Chronicle." }, { status: 403 });
  if (!(await verifyCsrf(session)))
    return NextResponse.json({ error: "Your creator session has expired. Reload the page and try again." }, { status: 403 });
  try {
    const body = (await request.json().catch(() => ({}))) as { releaseNotes?: string; autosaveVersion?: number };
    return NextResponse.json(
      await publishTale((await context.params).taleId, session.userId, body.releaseNotes ?? "", body.autosaveVersion),
    );
  } catch (cause) {
    return apiError(cause);
  }
}
