import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { createDrydockWaiverFromRun, listDrydockWaivers } from "@/drydock/waiver-store";

const privateNoStore = { "Cache-Control": "private, no-store" };

export async function GET(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  const authorization = await requireOwnedStudioTale(taleId, request);
  if (!authorization) return NextResponse.json({ error: "This Chronicle is not available to this Creator account." }, { status: 404, headers: privateNoStore });
  try {
    return NextResponse.json({ waivers: await listDrydockWaivers(taleId) }, { headers: privateNoStore });
  } catch (cause) {
    return apiError(cause);
  }
}

export async function POST(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  const authorization = await requireOwnedStudioTale(taleId, request);
  if (!authorization) return NextResponse.json({ error: "This Chronicle is not available to this Creator account." }, { status: 404, headers: privateNoStore });
  if (!authorization.session.account.roles.some((assignment) => assignment.role === "ADMINISTRATOR"))
    return NextResponse.json({ error: "Drydock waivers require Administrator authorization." }, { status: 403, headers: privateNoStore });
  try {
    const body = await request.json() as Record<string, unknown>;
    const runId = typeof body.runId === "string" ? body.runId : "";
    const issueId = typeof body.issueId === "string" ? body.issueId : "";
    const rationale = typeof body.rationale === "string" ? body.rationale.trim() : "";
    const scope = typeof body.scope === "string" && body.scope.trim() ? body.scope.trim() : "CHRONICLE";
    const expiresAt = typeof body.expiresAt === "string" && !Number.isNaN(Date.parse(body.expiresAt)) ? body.expiresAt : undefined;
    if (!runId || !issueId || !rationale) return NextResponse.json({ error: "A validation run, issue, and rationale are required." }, { status: 400, headers: privateNoStore });
    const waiver = await createDrydockWaiverFromRun({
      taleId, runId, issueId, rationale, scope, expiresAt,
      reviewCondition: typeof body.reviewCondition === "string" ? body.reviewCondition.trim() || undefined : undefined,
      auditReference: typeof body.auditReference === "string" ? body.auditReference.trim() || undefined : undefined,
      authorizedByAccountId: authorization.session.accountId,
      authorizedRole: "ADMINISTRATOR",
    });
    return NextResponse.json({ waiver }, { status: 201, headers: privateNoStore });
  } catch (cause) {
    return apiError(cause);
  }
}
