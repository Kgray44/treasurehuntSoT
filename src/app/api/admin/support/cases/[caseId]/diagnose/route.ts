import { NextResponse } from "next/server";
import { requireRecentPrivilegedAssurance } from "@/admiralty/assurance";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { supportCaseDiagnosisSchema } from "@/admiralty/schemas";
import { runSupportCaseDiagnostic } from "@/admiralty/support-pilot-service";

export async function POST(request: Request, context: { params: Promise<{ caseId: string }> }) {
  try {
    const operator = await requireAdmiraltyOperator("SUPPORT_USE", { request });
    await requireRecentPrivilegedAssurance(operator);
    const headers = enforceAdmiraltyRateLimit(`support-diagnosis:${operator.accountId}`, 20, 10 * 60_000);
    const input = await parseAdmiraltyBody(request, supportCaseDiagnosisSchema);
    const { caseId } = await context.params;
    const diagnostic = await runSupportCaseDiagnostic(operator, { caseId, grantId: input.grantId });
    return NextResponse.json(
      { ok: true, diagnostic },
      { headers: { ...headers, "Cache-Control": "private, no-store" } },
    );
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
