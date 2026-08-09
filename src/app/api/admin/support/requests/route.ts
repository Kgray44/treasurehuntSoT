import { NextResponse } from "next/server";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { supportRequestSchema } from "@/admiralty/schemas";
import { createSupportAccessRequest } from "@/admiralty/support-access";

export async function POST(request: Request) {
  try {
    const operator = await requireAdmiraltyOperator("SUPPORT_REQUEST", { request });
    const headers = enforceAdmiraltyRateLimit(`support-request:${operator.accountId}`, 10, 10 * 60_000);
    const input = await parseAdmiraltyBody(request, supportRequestSchema);
    const created = await createSupportAccessRequest(operator, input);
    return NextResponse.json(
      {
        ok: true,
        request: {
          id: created.id,
          targetAccountId: created.targetAccountId,
          status: created.status,
          requestedAt: created.requestedAt,
          decisionDeadline: created.expiresAt,
        },
      },
      { status: 201, headers },
    );
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
