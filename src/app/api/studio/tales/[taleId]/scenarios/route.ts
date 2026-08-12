import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { snapshotFromStudio } from "@/chronicle/publishing";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { getStudioTale } from "@/chronicle/studio-service";
import {
  DrydockScenarioRevisionConflictError,
  listDrydockScenarios,
  saveDrydockScenario,
} from "@/drydock/scenario-store";
import { parseDrydockScenario } from "@/drydock/simulation/schema";
import { drydockSimulationSourceChecksum } from "@/drydock/simulation/source";

const privateHeaders = { "Cache-Control": "private, no-store" };

function unavailable() {
  return NextResponse.json({ error: "This Chronicle is not available to this Creator account." }, { status: 404, headers: privateHeaders });
}

export async function GET(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId, request))) return unavailable();
  try {
    const sourceChecksum = drydockSimulationSourceChecksum(snapshotFromStudio(await getStudioTale(taleId)));
    return NextResponse.json({ sourceChecksum, scenarios: await listDrydockScenarios(taleId) }, { headers: privateHeaders });
  } catch (cause) {
    return apiError(cause);
  }
}

/** Saves a revision only when it was authored against the current deterministic source identity. */
export async function POST(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  const authorization = await requireOwnedStudioTale(taleId, request);
  if (!authorization) return unavailable();
  try {
    const scenario = parseDrydockScenario(await request.json());
    const sourceChecksum = drydockSimulationSourceChecksum(snapshotFromStudio(await getStudioTale(taleId)));
    if (scenario.sourceChecksum !== sourceChecksum)
      return NextResponse.json(
        { error: "This Scenario was authored against an older Chronicle source. Reload it before saving.", code: "DRYDOCK_SCENARIO_STALE_SOURCE" },
        { status: 409, headers: privateHeaders },
      );
    return NextResponse.json({ scenario: await saveDrydockScenario(taleId, scenario) }, { status: 201, headers: privateHeaders });
  } catch (cause) {
    if (cause instanceof DrydockScenarioRevisionConflictError)
      return NextResponse.json({ error: cause.message, code: "DRYDOCK_SCENARIO_REVISION_CONFLICT" }, { status: 409, headers: privateHeaders });
    return apiError(cause);
  }
}
