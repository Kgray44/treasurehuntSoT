import { NextResponse } from "next/server";
import { AdmiraltyError } from "@/admiralty/errors";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { supportRevokeSchema } from "@/admiralty/schemas";
import { revokeSupportGrantByTarget } from "@/admiralty/support-access";
import { requireWayfarerAccount, verifyWayfarerCsrf } from "@/wayfarer/http";

export async function POST(request: Request, context: { params: Promise<{ grantId: string }> }) {
  try {
    const session = await requireWayfarerAccount();
    if (!session) throw new AdmiraltyError("ADMIRALTY_AUTH_REQUIRED", "Sign in again to continue.", 401);
    if (!verifyWayfarerCsrf(session, request))
      throw new AdmiraltyError("ADMIRALTY_CSRF_INVALID", "The request could not be verified.", 403);
    const headers = enforceAdmiraltyRateLimit(`target-revoke:${session.accountId}`, 20, 10 * 60_000);
    const input = await parseAdmiraltyBody(request, supportRevokeSchema);
    const result = await revokeSupportGrantByTarget(
      { accountId: session.accountId, accountSessionId: session.id },
      (await context.params).grantId,
      input.reason,
    );
    return NextResponse.json({ ok: true, status: result.status }, { headers });
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
