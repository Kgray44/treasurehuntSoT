import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { snapshotFromStudio } from "@/chronicle/publishing";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { getStudioTale } from "@/chronicle/studio-service";
import { drydockSimulationSourceChecksum } from "@/drydock/simulation/source";
import {
  DrydockScenarioSuiteUnavailableError,
  listDrydockScenarioSuites,
  saveDrydockScenarioSuite,
} from "@/drydock/suite-store";

const privateHeaders = { "Cache-Control": "private, no-store" };
const unavailable = () =>
  NextResponse.json(
    { error: "This Chronicle is not available to this Creator account." },
    { status: 404, headers: privateHeaders },
  );

export async function GET(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId, request))) return unavailable();
  try {
    return NextResponse.json({ suites: await listDrydockScenarioSuites(taleId) }, { headers: privateHeaders });
  } catch (cause) {
    return apiError(cause);
  }
}

export async function POST(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId, request))) return unavailable();
  try {
    const checksum = drydockSimulationSourceChecksum(snapshotFromStudio(await getStudioTale(taleId)));
    return NextResponse.json(
      { suite: await saveDrydockScenarioSuite(taleId, await request.json(), checksum) },
      { status: 201, headers: privateHeaders },
    );
  } catch (cause) {
    if (cause instanceof DrydockScenarioSuiteUnavailableError)
      return NextResponse.json(
        { error: cause.message, code: "DRYDOCK_SUITE_UNAVAILABLE" },
        { status: 404, headers: privateHeaders },
      );
    if (cause instanceof Error && cause.message === "DRYDOCK_SUITE_STALE_SOURCE")
      return NextResponse.json(
        { error: "This Suite was authored against an older Chronicle source.", code: "DRYDOCK_SUITE_STALE_SOURCE" },
        { status: 409, headers: privateHeaders },
      );
    return apiError(cause);
  }
}
