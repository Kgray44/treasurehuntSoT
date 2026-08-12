import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { snapshotFromStudio } from "@/chronicle/publishing";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { getStudioTale } from "@/chronicle/studio-service";
import { DrydockSimulationSourceChangedError } from "@/drydock/simulation-store";
import { DrydockScenarioSuiteUnavailableError, runDrydockScenarioSuite } from "@/drydock/suite-store";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function POST(request: Request, context: { params: Promise<{ taleId: string; suiteId: string }> }) {
  const { taleId, suiteId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId, request)))
    return NextResponse.json({ error: "This Chronicle is not available to this Creator account." }, { status: 404, headers: privateHeaders });
  try {
    const result = await runDrydockScenarioSuite(taleId, suiteId, snapshotFromStudio(await getStudioTale(taleId)));
    return NextResponse.json({ result }, { status: 201, headers: privateHeaders });
  } catch (cause) {
    if (cause instanceof DrydockScenarioSuiteUnavailableError)
      return NextResponse.json({ error: cause.message, code: "DRYDOCK_SUITE_UNAVAILABLE" }, { status: 404, headers: privateHeaders });
    if (cause instanceof DrydockSimulationSourceChangedError)
      return NextResponse.json({ error: cause.message, code: "DRYDOCK_SIMULATION_SOURCE_CHANGED" }, { status: 409, headers: privateHeaders });
    return apiError(cause);
  }
}
