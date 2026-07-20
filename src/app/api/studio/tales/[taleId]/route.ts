import { NextResponse } from "next/server";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { archiveStudioTale, duplicateStudioTale, getStudioTale } from "@/tall-tale/studio-service";

export async function GET(_: Request, context: { params: Promise<{ taleId: string }> }) {
  const session = await requireGmCapability("CREATE_TALES");
  if (!session) return NextResponse.json({ error: "Sign in with a creator account to continue." }, { status: 401 });
  try {
    return NextResponse.json({ csrfToken: session.csrfToken, ...(await getStudioTale((await context.params).taleId)) });
  } catch (cause) {
    return apiError(cause);
  }
}

export async function POST(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const session = await requireGmCapability("CREATE_TALES");
  if (!session) return NextResponse.json({ error: "Sign in with a creator account to continue." }, { status: 401 });
  if (!(await verifyCsrf(session)))
    return NextResponse.json({ error: "Your creator session has expired. Reload the page and try again." }, { status: 403 });
  try {
    const { action } = (await request.json()) as { action: "duplicate" | "archive" | "restore" };
    const { taleId } = await context.params;
    if (action === "duplicate") return NextResponse.json(await duplicateStudioTale(taleId, session.userId));
    if (action === "archive" || action === "restore")
      return NextResponse.json(await archiveStudioTale(taleId, action === "archive"));
    return NextResponse.json({ error: "That Chronicle action is not available." }, { status: 400 });
  } catch (cause) {
    return apiError(cause);
  }
}
