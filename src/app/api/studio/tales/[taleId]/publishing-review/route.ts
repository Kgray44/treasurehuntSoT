import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { getStudioPublishingReview } from "@/chronicle/publishing-review";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId, request)))
    return NextResponse.json(
      { error: "This Chronicle is not available to this Creator account." },
      { status: 404, headers: privateHeaders },
    );
  try {
    return NextResponse.json(await getStudioPublishingReview(taleId), { headers: privateHeaders });
  } catch (cause) {
    return apiError(cause);
  }
}
