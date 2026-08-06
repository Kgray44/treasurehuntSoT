import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { validateTaleDraft } from "@/chronicle/validation";

export async function POST(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  const authorization = await requireOwnedStudioTale(taleId, request);
  if (!authorization)
    return NextResponse.json({ error: "This Chronicle is not available to this Creator account." }, { status: 404 });
  try {
    return NextResponse.json(await validateTaleDraft(taleId));
  } catch (cause) {
    return apiError(cause);
  }
}
