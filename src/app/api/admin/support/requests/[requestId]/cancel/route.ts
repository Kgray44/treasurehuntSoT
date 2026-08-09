import { NextResponse } from "next/server";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { supportCancelSchema } from "@/admiralty/schemas";
import { cancelSupportAccessRequest } from "@/admiralty/support-access";

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  try {
    const operator = await requireAdmiraltyOperator("SUPPORT_REQUEST", { request });
    const headers = enforceAdmiraltyRateLimit(`support-cancel:${operator.accountId}`, 20, 10 * 60_000);
    const input = await parseAdmiraltyBody(request, supportCancelSchema);
    const cancelled = await cancelSupportAccessRequest(operator, (await context.params).requestId, input.reason);
    return NextResponse.json({ ok: true, status: cancelled.status }, { headers });
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
