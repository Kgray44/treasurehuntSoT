import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { DrydockSimulationUnavailableError, getDrydockSimulationStateDiff } from "@/drydock/simulation-store";

const privateHeaders = { "Cache-Control": "private, no-store" };

function requiredOrdinal(url: URL, name: string) {
  const value = Number(url.searchParams.get(name));
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive trace ordinal.`);
  return value;
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
        diff: await getDrydockSimulationStateDiff(
          taleId,
          runId,
          requiredOrdinal(url, "from"),
          requiredOrdinal(url, "to"),
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
