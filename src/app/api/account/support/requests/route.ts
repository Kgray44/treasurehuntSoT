import { NextResponse } from "next/server";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit } from "@/admiralty/http";
import { listSupportAccessForTarget } from "@/admiralty/support-access";
import { AdmiraltyError } from "@/admiralty/errors";
import { requireWayfarerAccount } from "@/wayfarer/http";

export async function GET() {
  try {
    const session = await requireWayfarerAccount();
    if (!session) throw new AdmiraltyError("ADMIRALTY_AUTH_REQUIRED", "Sign in again to continue.", 401);
    const headers = enforceAdmiraltyRateLimit(`target-list:${session.accountId}`, 60, 60_000);
    return NextResponse.json(
      { csrfToken: session.csrfToken, requests: await listSupportAccessForTarget(session.accountId) },
      { headers: { ...headers, "Cache-Control": "private, no-store" } },
    );
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
