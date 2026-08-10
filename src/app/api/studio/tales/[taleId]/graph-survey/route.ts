import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { getStudioTale } from "@/chronicle/studio-service";
import { drydockDraftInputFromStudio, validateDrydockDraftContracts } from "@/drydock/incremental";
import { createDrydockGraphSurvey } from "@/drydock/graph-survey";

export async function GET(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  const authorization = await requireOwnedStudioTale(taleId, request);
  if (!authorization) return NextResponse.json({ error: "This Chronicle is not available to this Creator account." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  try {
    const studio = await getStudioTale(taleId);
    const validation = validateDrydockDraftContracts(
      drydockDraftInputFromStudio({ ...studio.draft, assets: studio.assets }, { analysisMode: "FULL" }),
    );
    return NextResponse.json({ survey: createDrydockGraphSurvey(validation.blocks, validation.graphAnalysis, validation.issues) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    return apiError(cause);
  }
}
