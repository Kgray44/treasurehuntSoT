import { NextResponse } from "next/server";
import { AdmiraltyError } from "@/admiralty/errors";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit, parseAdmiraltyBody } from "@/admiralty/http";
import { supportDecisionSchema } from "@/admiralty/schemas";
import { decideSupportAccessRequest } from "@/admiralty/support-access";
import { requireWayfarerAccount, verifyWayfarerCsrf } from "@/wayfarer/http";

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  try {
    const session = await requireWayfarerAccount();
    if (!session) throw new AdmiraltyError("ADMIRALTY_AUTH_REQUIRED", "Sign in again to continue.", 401);
    if (!verifyWayfarerCsrf(session, request))
      throw new AdmiraltyError("ADMIRALTY_CSRF_INVALID", "The request could not be verified.", 403);
    const headers = enforceAdmiraltyRateLimit(`target-decision:${session.accountId}`, 20, 10 * 60_000);
    const input = await parseAdmiraltyBody(request, supportDecisionSchema);
    const result = await decideSupportAccessRequest(
      { accountId: session.accountId, accountSessionId: session.id },
      (await context.params).requestId,
      input.decision,
    );
    return NextResponse.json(
      {
        ok: true,
        status: result.grant ? "ACTIVE" : result.request.status,
        grantExpiresAt: result.grant?.expiresAt ?? null,
      },
      { headers },
    );
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
