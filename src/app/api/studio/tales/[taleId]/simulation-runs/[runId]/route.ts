import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import {
  DrydockSimulationUnavailableError,
  getDrydockSimulationRun,
  requestDrydockSimulationCancellation,
} from "@/drydock/simulation-store";

const privateHeaders = { "Cache-Control": "private, no-store" };

function unavailable() {
  return NextResponse.json({ error: "This simulation run is not available for the current Chronicle." }, { status: 404, headers: privateHeaders });
}

export async function GET(request: Request, context: { params: Promise<{ taleId: string; runId: string }> }) {
  const { taleId, runId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId, request))) return unavailable();
  try {
    return NextResponse.json({ run: await getDrydockSimulationRun(taleId, runId) }, { headers: privateHeaders });
  } catch (cause) {
    if (cause instanceof DrydockSimulationUnavailableError) return unavailable();
    return apiError(cause);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ taleId: string; runId: string }> }) {
  const { taleId, runId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId, request))) return unavailable();
  try {
    if (!(await requestDrydockSimulationCancellation(taleId, runId))) return unavailable();
    return NextResponse.json({ runId, cancellationRequested: true }, { status: 202, headers: privateHeaders });
  } catch (cause) {
    return apiError(cause);
  }
}
