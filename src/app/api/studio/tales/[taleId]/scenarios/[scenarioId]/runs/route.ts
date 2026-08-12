import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { snapshotFromStudio } from "@/chronicle/publishing";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { getStudioTale } from "@/chronicle/studio-service";
import {
  DrydockSimulationSourceChangedError,
  DrydockSimulationUnavailableError,
  executeDrydockSimulationRun,
  listDrydockSimulationRuns,
  scheduleDrydockSimulation,
} from "@/drydock/simulation-store";

const privateHeaders = { "Cache-Control": "private, no-store" };

function unavailable() {
  return NextResponse.json(
    { error: "This Chronicle is not available to this Creator account." },
    { status: 404, headers: privateHeaders },
  );
}

function requestedRevision(body: unknown) {
  if (body === undefined || body === null) return undefined;
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Run options must be an object.");
  const entries = Object.entries(body);
  if (entries.some(([key]) => key !== "revision")) throw new Error("Run options contain an unsupported field.");
  const revision = (body as { revision?: unknown }).revision;
  if (revision === undefined) return undefined;
  if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1)
    throw new Error("Scenario revision must be a positive integer.");
  return revision;
}

export async function GET(request: Request, context: { params: Promise<{ taleId: string; scenarioId: string }> }) {
  const { taleId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId, request))) return unavailable();
  try {
    return NextResponse.json({ runs: await listDrydockSimulationRuns(taleId) }, { headers: privateHeaders });
  } catch (cause) {
    return apiError(cause);
  }
}

/** Schedules first, then claims the durable record for the bounded in-request worker. */
export async function POST(request: Request, context: { params: Promise<{ taleId: string; scenarioId: string }> }) {
  const { taleId, scenarioId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId, request))) return unavailable();
  try {
    const revision = requestedRevision(await request.json().catch(() => undefined));
    const snapshot = snapshotFromStudio(await getStudioTale(taleId));
    const queued = await scheduleDrydockSimulation({ taleId, scenarioId, revision, snapshot });
    const run = await executeDrydockSimulationRun(taleId, queued.runId);
    return NextResponse.json({ run }, { status: 201, headers: privateHeaders });
  } catch (cause) {
    if (cause instanceof DrydockSimulationSourceChangedError)
      return NextResponse.json(
        { error: cause.message, code: "DRYDOCK_SIMULATION_SOURCE_CHANGED" },
        { status: 409, headers: privateHeaders },
      );
    if (cause instanceof DrydockSimulationUnavailableError)
      return NextResponse.json(
        { error: cause.message, code: "DRYDOCK_SIMULATION_UNAVAILABLE" },
        { status: 404, headers: privateHeaders },
      );
    return apiError(cause);
  }
}
