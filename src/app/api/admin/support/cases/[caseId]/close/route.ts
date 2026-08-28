import { NextResponse } from "next/server";
import { requireRecentPrivilegedAssurance } from "@/admiralty/assurance";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { supportCaseCloseSchema } from "@/admiralty/schemas";
import { closeSupportCase } from "@/admiralty/support-pilot-service";

export async function POST(request: Request, context: { params: Promise<{ caseId: string }> }) {
  try {
    const operator = await requireAdmiraltyOperator("SUPPORT_USE", { request });
    await requireRecentPrivilegedAssurance(operator);
    const headers = enforceAdmiraltyRateLimit(`support-case-close:${operator.accountId}`, 10, 10 * 60_000);
    const input = await parseAdmiraltyBody(request, supportCaseCloseSchema);
    const { caseId } = await context.params;
    const closed = await closeSupportCase(operator, { caseId, ...input });
    return NextResponse.json(
      { ok: true, supportCase: closed },
      { headers: { ...headers, "Cache-Control": "private, no-store" } },
    );
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
