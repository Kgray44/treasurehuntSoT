import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { DrydockSimulationUnavailableError, getDrydockSimulationRun } from "@/drydock/simulation-store";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET(request: Request, context: { params: Promise<{ taleId: string; runId: string }> }) {
  const { taleId, runId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId, request)))
    return NextResponse.json(
      { error: "This simulation run is not available for the current Chronicle." },
      { status: 404, headers: privateHeaders },
    );
  try {
    const receipt = await getDrydockSimulationRun(taleId, runId);
    return NextResponse.json({ runId, assertions: receipt.result.assertions ?? [] }, { headers: privateHeaders });
  } catch (cause) {
    if (cause instanceof DrydockSimulationUnavailableError)
      return NextResponse.json({ error: cause.message }, { status: 404, headers: privateHeaders });
    return apiError(cause);
  }
}
