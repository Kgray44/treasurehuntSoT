import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { getDrydockCurrentCompatibility } from "@/drydock/readiness-store";

const privateHeaders = { "Cache-Control": "private, no-store" };

/** Current-draft compatibility is owner-only and contains no authored prose. */
export async function GET(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId, request)))
    return NextResponse.json(
      { error: "This Chronicle is not available to this Creator account." },
      { status: 404, headers: privateHeaders },
    );
  try {
    return NextResponse.json(
      { compatibility: await getDrydockCurrentCompatibility(taleId) },
      { headers: privateHeaders },
    );
  } catch (cause) {
    return apiError(cause);
  }
}
