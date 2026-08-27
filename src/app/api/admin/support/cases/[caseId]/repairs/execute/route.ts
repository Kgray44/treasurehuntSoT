import { NextResponse } from "next/server";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { supportRepairExecuteSchema } from "@/admiralty/schemas";
import { executeSupportRepair } from "@/admiralty/support-repair-service";

export async function POST(request: Request, context: { params: Promise<{ caseId: string }> }) {
  try {
    const operator = await requireAdmiraltyOperator("SUPPORT_USE", { request });
    const headers = enforceAdmiraltyRateLimit(`support-repair-execute:${operator.accountId}`, 10, 10 * 60_000);
    const input = await parseAdmiraltyBody(request, supportRepairExecuteSchema);
    const { caseId } = await context.params;
    const result = await executeSupportRepair(operator, { caseId, ...input });
    return NextResponse.json(
      { ok: true, execution: result.execution, idempotent: result.idempotent },
      { headers: { ...headers, "Cache-Control": "private, no-store" } },
    );
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
