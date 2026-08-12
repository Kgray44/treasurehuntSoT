import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { compareDrydockSimulationRuns, DrydockSimulationUnavailableError } from "@/drydock/simulation-store";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET(
  request: Request,
  context: { params: Promise<{ taleId: string; runId: string; otherRunId: string }> },
) {
  const { taleId, runId, otherRunId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId, request)))
    return NextResponse.json(
      { error: "These simulation runs are not available for the current Chronicle." },
      { status: 404, headers: privateHeaders },
    );
  try {
    return NextResponse.json(
      { comparison: await compareDrydockSimulationRuns(taleId, runId, otherRunId) },
      { headers: privateHeaders },
    );
  } catch (cause) {
    if (cause instanceof DrydockSimulationUnavailableError)
      return NextResponse.json({ error: cause.message }, { status: 404, headers: privateHeaders });
    return apiError(cause);
  }
}
