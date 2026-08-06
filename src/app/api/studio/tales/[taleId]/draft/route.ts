import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { saveStudioDraft } from "@/chronicle/studio-service";

export async function PATCH(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  const authorization = await requireOwnedStudioTale(taleId, request);
  if (!authorization)
    return NextResponse.json({ error: "This Chronicle is not available to this Creator account." }, { status: 404 });
  try {
    return NextResponse.json(await saveStudioDraft(taleId, await request.json(), authorization.session.accountId));
  } catch (cause) {
    return apiError(cause);
  }
}
