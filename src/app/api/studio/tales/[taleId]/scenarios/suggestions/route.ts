import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { snapshotFromStudio } from "@/chronicle/publishing";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { getStudioTale } from "@/chronicle/studio-service";
import { createDrydockCoverageReport, createDrydockScenarioSuggestions } from "@/drydock/simulation/coverage";
import type { DrydockSimulationResult } from "@/drydock/simulation/engine";
import { getDrydockSimulationRun, listDrydockSimulationRuns } from "@/drydock/simulation-store";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId, request)))
    return NextResponse.json(
      { error: "This Chronicle is not available to this Creator account." },
      { status: 404, headers: privateHeaders },
    );
  try {
    const snapshot = snapshotFromStudio(await getStudioTale(taleId));
    const summaries = await listDrydockSimulationRuns(taleId);
    const receipts = await Promise.all(
      summaries.filter((run) => run.status === "COMPLETED").map((run) => getDrydockSimulationRun(taleId, run.runId)),
    );
    const report = createDrydockCoverageReport(
      snapshot,
      receipts.map((receipt) => receipt.result as DrydockSimulationResult),
    );
    return NextResponse.json(
      { coverage: report, suggestions: createDrydockScenarioSuggestions(report) },
      { headers: privateHeaders },
    );
  } catch (cause) {
    return apiError(cause);
  }
}
