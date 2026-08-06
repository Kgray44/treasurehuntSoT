import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { archiveStudioTale, duplicateStudioTale, getStudioTale } from "@/chronicle/studio-service";

export async function GET(_: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  const authorization = await requireOwnedStudioTale(taleId);
  if (!authorization)
    return NextResponse.json({ error: "This Chronicle is not available to this Creator account." }, { status: 404 });
  try {
    return NextResponse.json({ csrfToken: authorization.session.csrfToken, ...(await getStudioTale(taleId)) });
  } catch (cause) {
    return apiError(cause);
  }
}

export async function POST(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  const authorization = await requireOwnedStudioTale(taleId, request);
  if (!authorization)
    return NextResponse.json({ error: "This Chronicle is not available to this Creator account." }, { status: 404 });
  try {
    const { action } = (await request.json()) as { action: "duplicate" | "archive" | "restore" };
    if (action === "duplicate")
      return NextResponse.json(await duplicateStudioTale(taleId, authorization.session.accountId));
    if (action === "archive" || action === "restore")
      return NextResponse.json(await archiveStudioTale(taleId, action === "archive"));
    return NextResponse.json({ error: "That Chronicle action is not available." }, { status: 400 });
  } catch (cause) {
    return apiError(cause);
  }
}
