import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { DrydockSimulationUnavailableError, getDrydockSimulationTraceWindow } from "@/drydock/simulation-store";

const privateHeaders = { "Cache-Control": "private, no-store" };

function pageValue(value: string | null, fallback: number) {
  if (value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0)
    throw new Error("Trace pagination values must be non-negative integers.");
  return parsed;
}

export async function GET(request: Request, context: { params: Promise<{ taleId: string; runId: string }> }) {
  const { taleId, runId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId, request)))
    return NextResponse.json(
      { error: "This simulation run is not available for the current Chronicle." },
      { status: 404, headers: privateHeaders },
    );
  try {
    const url = new URL(request.url);
    return NextResponse.json(
      {
        trace: await getDrydockSimulationTraceWindow(
          taleId,
          runId,
          pageValue(url.searchParams.get("from"), 0),
          pageValue(url.searchParams.get("limit"), 100),
        ),
      },
      { headers: privateHeaders },
    );
  } catch (cause) {
    if (cause instanceof DrydockSimulationUnavailableError)
      return NextResponse.json({ error: cause.message }, { status: 404, headers: privateHeaders });
    return apiError(cause);
  }
}
