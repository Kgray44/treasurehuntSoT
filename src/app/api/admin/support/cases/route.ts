import { NextResponse } from "next/server";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { supportCaseCreateSchema } from "@/admiralty/schemas";
import { createSupportCase } from "@/admiralty/support-pilot-service";

export async function POST(request: Request) {
  try {
    const operator = await requireAdmiraltyOperator("SUPPORT_REQUEST", { request });
    const headers = enforceAdmiraltyRateLimit(`support-case:${operator.accountId}`, 10, 10 * 60_000);
    const input = await parseAdmiraltyBody(request, supportCaseCreateSchema);
    const created = await createSupportCase(operator, input);
    return NextResponse.json(
      {
        ok: true,
        supportCase: {
          id: created.supportCase.id,
          caseNumber: created.supportCase.caseNumber,
          status: created.supportCase.status,
          consentRequestId: created.request.id,
        },
      },
      { status: 201, headers: { ...headers, "Cache-Control": "private, no-store" } },
    );
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
