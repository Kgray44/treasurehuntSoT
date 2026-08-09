import { NextResponse } from "next/server";
import { requireRecentPrivilegedAssurance } from "@/admiralty/assurance";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { supportRevokeSchema } from "@/admiralty/schemas";
import { revokeSupportGrantBySecurityOperator } from "@/admiralty/support-access";

export async function POST(request: Request, context: { params: Promise<{ grantId: string }> }) {
  try {
    const operator = await requireAdmiraltyOperator("SECURITY_OPERATE", { request });
    await requireRecentPrivilegedAssurance(operator);
    const headers = enforceAdmiraltyRateLimit(`support-security-revoke:${operator.accountId}`, 20, 10 * 60_000);
    const input = await parseAdmiraltyBody(request, supportRevokeSchema);
    const revoked = await revokeSupportGrantBySecurityOperator(operator, (await context.params).grantId, input.reason);
    return NextResponse.json({ ok: true, status: revoked.status }, { headers });
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
