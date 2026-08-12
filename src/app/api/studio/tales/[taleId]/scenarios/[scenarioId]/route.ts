import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { archiveDrydockScenario, duplicateDrydockScenario, getDrydockScenario } from "@/drydock/scenario-store";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET(request: Request, context: { params: Promise<{ taleId: string; scenarioId: string }> }) {
  const { taleId, scenarioId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId, request)))
    return NextResponse.json(
      { error: "This Chronicle is not available to this Creator account." },
      { status: 404, headers: privateHeaders },
    );
  const revisionValue = new URL(request.url).searchParams.get("revision");
  const revision = revisionValue === null ? undefined : Number(revisionValue);
  if (revision !== undefined && (!Number.isSafeInteger(revision) || revision < 1))
    return NextResponse.json(
      { error: "Scenario revision must be a positive integer." },
      { status: 400, headers: privateHeaders },
    );
  try {
    const scenario = await getDrydockScenario(taleId, scenarioId, revision);
    if (!scenario)
      return NextResponse.json(
        { error: "This Scenario is not available for the current Chronicle." },
        { status: 404, headers: privateHeaders },
      );
    return NextResponse.json({ scenario }, { headers: privateHeaders });
  } catch (cause) {
    return apiError(cause);
  }
}

export async function POST(request: Request, context: { params: Promise<{ taleId: string; scenarioId: string }> }) {
  const { taleId, scenarioId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId, request)))
    return NextResponse.json(
      { error: "This Chronicle is not available to this Creator account." },
      { status: 404, headers: privateHeaders },
    );
  const revisionValue = new URL(request.url).searchParams.get("revision");
  const revision = revisionValue === null ? undefined : Number(revisionValue);
  if (revision !== undefined && (!Number.isSafeInteger(revision) || revision < 1))
    return NextResponse.json(
      { error: "Scenario revision must be a positive integer." },
      { status: 400, headers: privateHeaders },
    );
  try {
    const scenario = await duplicateDrydockScenario(taleId, scenarioId, revision);
    if (!scenario)
      return NextResponse.json(
        { error: "This Scenario is not available for the current Chronicle." },
        { status: 404, headers: privateHeaders },
      );
    return NextResponse.json({ scenario }, { status: 201, headers: privateHeaders });
  } catch (cause) {
    return apiError(cause);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ taleId: string; scenarioId: string }> }) {
  const { taleId, scenarioId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId, request)))
    return NextResponse.json(
      { error: "This Chronicle is not available to this Creator account." },
      { status: 404, headers: privateHeaders },
    );
  try {
    if (!(await archiveDrydockScenario(taleId, scenarioId)))
      return NextResponse.json(
        { error: "This Scenario is not available for the current Chronicle." },
        { status: 404, headers: privateHeaders },
      );
    return NextResponse.json({ scenarioId, archived: true }, { headers: privateHeaders });
  } catch (cause) {
    return apiError(cause);
  }
}
