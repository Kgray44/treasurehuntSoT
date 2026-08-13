import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { inspectHistoricalDrydockCompatibility } from "@/drydock/historical-store";

export async function GET(request: Request, context: { params: Promise<{ taleId: string; versionId: string }> }) {
  const { taleId, versionId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId, request)))
    return NextResponse.json({ error: "This Chronicle is not available to this Creator account." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  try {
    const result = await inspectHistoricalDrydockCompatibility(taleId, versionId);
    if (!result) return NextResponse.json({ error: "This Chronicle version is not available." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) { return apiError(cause); }
}
