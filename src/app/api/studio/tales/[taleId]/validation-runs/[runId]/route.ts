import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { getDrydockValidationRun } from "@/drydock/report-store";

export async function GET(request: Request, context: { params: Promise<{ taleId: string; runId: string }> }) {
  const { taleId, runId } = await context.params;
  const authorization = await requireOwnedStudioTale(taleId, request);
  if (!authorization) return NextResponse.json({ error: "This Chronicle is not available to this Creator account." }, { status: 404 });
  try {
    const report = await getDrydockValidationRun(taleId, runId);
    if (!report) return NextResponse.json({ error: "This validation receipt is not available for the current Chronicle." }, { status: 404 });
    return NextResponse.json({ report });
  } catch (cause) {
    return apiError(cause);
  }
}
